#!/usr/bin/env node
/**
 * Data validation script for Garmin activities database
 * Validates data consistency between FIT file parsing and database storage
 */

const Database = require('better-sqlite3');
const path = require('path');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class DataValidator {
  constructor(dbPath = 'app/data/activities.db') {
    this.dbPath = path.resolve(dbPath);
    this.db = new Database(this.dbPath, { readonly: true });
    this.issues = [];
    this.warnings = [];
  }

  addIssue(category, message) {
    this.issues.push({ category, message });
  }

  addWarning(category, message) {
    this.warnings.push({ category, message });
  }

  async validate() {
    log('\n╔═══════════════════════════════════════════════════════╗', 'blue');
    log('║        数据验证报告                                    ║', 'blue');
    log('║        Data Validation Report                         ║', 'blue');
    log('╚═══════════════════════════════════════════════════════╝\n', 'blue');

    // Get basic stats
    const activityCount = this.db.prepare('SELECT COUNT(*) as count FROM activities').get().count;
    const lapCount = this.db.prepare('SELECT COUNT(*) as count FROM activity_laps').get().count;
    log(`总活动数: ${activityCount}`, 'cyan');
    log(`总分段数: ${lapCount}\n`, 'cyan');

    // Phase 1: Unit and calculation validation
    log('═══════════════════════════════════════════════════════', 'bright');
    log('Phase 1: 单位和计算正确性验证', 'bright');
    log('═══════════════════════════════════════════════════════\n', 'bright');

    this.validateActivityUnits();
    this.validateActivityCalculations();
    this.validateLapUnits();
    this.validateLapCalculations();

    // Phase 2: Data integrity validation
    log('\n═══════════════════════════════════════════════════════', 'bright');
    log('Phase 2: 数据完整性验证', 'bright');
    log('═══════════════════════════════════════════════════════\n', 'bright');

    this.validateNullValues();
    this.validateDataRanges();
    this.validateRelationships();

    // Summary
    this.printSummary();
  }

  validateActivityUnits() {
    log('1. Activities 表单位验证', 'cyan');

    // Check distance unit (km vs m)
    const activities = this.db.prepare(`
      SELECT activity_id, distance, duration, average_speed, average_pace
      FROM activities
      WHERE distance > 0 AND duration > 0
      LIMIT 100
    `).all();

    let distanceUnitIssues = 0;
    activities.forEach(act => {
      // average_speed 为 km/h，distance 为米时 expectedSpeed = (distance/duration)*3.6
      const expectedSpeed = (act.distance / act.duration) * 3.6;
      const diff = Math.abs(expectedSpeed - act.average_speed);

      if (diff > 0.01) {
        distanceUnitIssues++;
      }
    });

    if (distanceUnitIssues === 0) {
      log('  ✓ average_speed 与 distance 一致 (km/h, 验证通过)', 'green');
    } else {
      log(`  ✗ distance 单位问题: ${distanceUnitIssues} 条记录异常`, 'red');
      this.addIssue('单位', `Activities.distance 单位不一致，${distanceUnitIssues} 条记录`);
    }

    // Check max_speed range (should be m/s, reasonable range 0-20)
    const maxSpeedStats = this.db.prepare(`
      SELECT
        MIN(max_speed) as min_val,
        MAX(max_speed) as max_val,
        AVG(max_speed) as avg_val,
        COUNT(*) as count
      FROM activities
      WHERE max_speed IS NOT NULL
    `).get();

    if (maxSpeedStats.count > 0) {
      log(`  ✓ max_speed 范围: ${maxSpeedStats.min_val.toFixed(2)} - ${maxSpeedStats.max_val.toFixed(2)} m/s (平均: ${maxSpeedStats.avg_val.toFixed(2)})`, 'green');

      if (maxSpeedStats.max_val > 20) {
        this.addWarning('单位', `max_speed 最大值 ${maxSpeedStats.max_val.toFixed(2)} m/s 超出合理范围`);
      }
    }
  }

  validateActivityCalculations() {
    log('\n2. Activities 表计算验证', 'cyan');

    const activities = this.db.prepare(`
      SELECT
        activity_id, distance, duration, elapsed_time, moving_time,
        average_speed, average_pace
      FROM activities
      WHERE distance > 0 AND duration > 0
    `).all();

    let speedErrors = 0;
    let paceErrors = 0;
    let timeErrors = 0;

    activities.forEach(act => {
      // average_speed 公里/小时 = (distance米 / duration秒) * 3.6
      const expectedSpeed = (act.distance / act.duration) * 3.6;
      if (Math.abs(expectedSpeed - act.average_speed) > 0.01) {
        speedErrors++;
      }

      // average_pace 秒/公里 = duration / (distance/1000)
      const expectedPace = (act.duration * 1000) / act.distance;
      if (Math.abs(expectedPace - act.average_pace) > 0.01) {
        paceErrors++;
      }

      // Validate time relationships
      if (act.elapsed_time < act.moving_time) {
        timeErrors++;
      }
    });

    if (speedErrors === 0) {
      log(`  ✓ average_speed 计算: ${activities.length}/${activities.length} 正确`, 'green');
    } else {
      log(`  ✗ average_speed 计算错误: ${speedErrors}/${activities.length}`, 'red');
      this.addIssue('计算', `average_speed 计算错误 ${speedErrors} 条`);
    }

    if (paceErrors === 0) {
      log(`  ✓ average_pace 计算: ${activities.length}/${activities.length} 正确`, 'green');
    } else {
      log(`  ✗ average_pace 计算错误: ${paceErrors}/${activities.length}`, 'red');
      this.addIssue('计算', `average_pace 计算错误 ${paceErrors} 条`);
    }

    if (timeErrors === 0) {
      log(`  ✓ 时间关系验证: 通过`, 'green');
    } else {
      log(`  ⚠ elapsed_time < moving_time: ${timeErrors} 条记录`, 'yellow');
      this.addWarning('数据一致性', `${timeErrors} 条记录的 elapsed_time < moving_time`);
    }
  }

  validateLapUnits() {
    log('\n3. Activity_laps 表单位验证', 'cyan');

    const laps = this.db.prepare(`
      SELECT lap_index, distance, duration, average_speed, average_pace
      FROM activity_laps
      WHERE distance > 0 AND duration > 0
      LIMIT 100
    `).all();

    if (laps.length === 0) {
      log('  ⚠ 没有分段数据', 'yellow');
      return;
    }

    // average_speed 应为公里/小时
    const avgSpeed = laps.reduce((sum, lap) => sum + lap.average_speed, 0) / laps.length;

    if (avgSpeed < 1) {
      log(`  ✗ average_speed 单位异常: 平均值 ${avgSpeed.toFixed(4)} (期望: km/h, 典型约 5-15)`, 'red');
      this.addIssue('单位', 'Laps.average_speed 单位错误或计算错误');
    } else if (avgSpeed >= 5 && avgSpeed <= 20) {
      log(`  ✓ average_speed 单位: 公里/小时 (平均: ${avgSpeed.toFixed(2)} km/h)`, 'green');
    } else {
      log(`  ⚠ average_speed 平均值异常: ${avgSpeed.toFixed(2)} km/h`, 'yellow');
    }

    // distance 应为米（与 Activity 一致）
    const avgDistance = laps.reduce((sum, lap) => sum + lap.distance, 0) / laps.length;
    log(`  ✓ distance 单位: 米 (平均: ${avgDistance.toFixed(0)} m)`, 'green');
  }

  validateLapCalculations() {
    log('\n4. Activity_laps 表计算验证', 'cyan');

    // Sample activities with laps
    const activitiesWithLaps = this.db.prepare(`
      SELECT DISTINCT activity_id
      FROM activity_laps
      LIMIT 20
    `).all();

    if (activitiesWithLaps.length === 0) {
      log('  ⚠ 没有分段数据', 'yellow');
      return;
    }

    let speedCalcErrors = 0;
    let paceCalcErrors = 0;
    let cumulativeTimeErrors = 0;
    let distanceSumErrors = 0;

    activitiesWithLaps.forEach(({ activity_id }) => {
      const laps = this.db.prepare(`
        SELECT lap_index, distance, duration, average_speed, average_pace, cumulative_time
        FROM activity_laps
        WHERE activity_id = ?
        ORDER BY lap_index
      `).all(activity_id);

      const activity = this.db.prepare(`
        SELECT distance as total_distance FROM activities WHERE activity_id = ?
      `).get(activity_id);

      let expectedCumulativeTime = 0;

      laps.forEach(lap => {
        // average_speed 公里/小时 = (distance米 / duration秒) * 3.6
        if (lap.duration > 0 && lap.distance > 0) {
          const expectedSpeed = (lap.distance / lap.duration) * 3.6;
          if (lap.average_speed != null && Math.abs(expectedSpeed - lap.average_speed) > 0.01) {
            speedCalcErrors++;
          }

          // average_pace 秒/公里 = duration / (distance/1000)
          const expectedPace = (lap.duration * 1000) / lap.distance;
          if (lap.average_pace != null && Math.abs(expectedPace - lap.average_pace) > 0.01) {
            paceCalcErrors++;
          }
        }

        // Validate cumulative_time
        expectedCumulativeTime += lap.duration;
        if (Math.abs(expectedCumulativeTime - lap.cumulative_time) > 1) {
          cumulativeTimeErrors++;
        }
      });

      // Validate total distance（均为米）
      const lapDistanceSum = laps.reduce((sum, lap) => sum + lap.distance, 0);
      if (activity && Math.abs(lapDistanceSum - activity.total_distance) > 1) {
        distanceSumErrors++;
      }
    });

    const totalLaps = this.db.prepare('SELECT COUNT(*) as count FROM activity_laps').get().count;

    if (speedCalcErrors === 0) {
      log(`  ✓ average_speed 计算: 正确`, 'green');
    } else {
      log(`  ✗ average_speed 计算错误: ${speedCalcErrors} 条分段`, 'red');
      this.addIssue('计算', `Laps.average_speed 计算错误 ${speedCalcErrors} 条`);
    }

    if (paceCalcErrors === 0) {
      log(`  ✓ average_pace 计算: 正确`, 'green');
    } else {
      log(`  ✗ average_pace 计算错误: ${paceCalcErrors} 条分段`, 'red');
      this.addIssue('计算', `Laps.average_pace 计算错误 ${paceCalcErrors} 条`);
    }

    if (cumulativeTimeErrors === 0) {
      log(`  ✓ cumulative_time 累加: 正确`, 'green');
    } else {
      log(`  ✗ cumulative_time 累加错误: ${cumulativeTimeErrors} 条分段`, 'red');
      this.addIssue('计算', `Laps.cumulative_time 累加错误 ${cumulativeTimeErrors} 条`);
    }

    if (distanceSumErrors === 0) {
      log(`  ✓ 分段距离总和: 与活动总距离一致`, 'green');
    } else {
      log(`  ⚠ 分段距离总和: ${distanceSumErrors} 个活动不一致`, 'yellow');
      this.addWarning('数据一致性', `${distanceSumErrors} 个活动的分段距离总和不一致`);
    }
  }

  validateNullValues() {
    log('5. NULL 值统计', 'cyan');

    const fields = [
      'average_cadence', 'max_cadence', 'average_stride_length',
      'average_vertical_oscillation', 'average_vertical_ratio',
      'average_ground_contact_time', 'average_gct_balance',
      'average_power', 'max_power', 'total_ascent', 'total_descent',
      'vdot_value', 'training_load'
    ];

    const totalCount = this.db.prepare('SELECT COUNT(*) as count FROM activities').get().count;

    fields.forEach(field => {
      const nullCount = this.db.prepare(`
        SELECT COUNT(*) as count FROM activities WHERE ${field} IS NULL
      `).get().count;

      const percentage = ((nullCount / totalCount) * 100).toFixed(1);
      const nonNullCount = totalCount - nullCount;

      if (nullCount === totalCount) {
        log(`  ⚠ ${field}: ${nonNullCount}/${totalCount} (${percentage}% NULL) - 全部缺失`, 'yellow');
        this.addWarning('数据完整性', `${field} 全部为 NULL`);
      } else if (percentage > 50) {
        log(`  ⚠ ${field}: ${nonNullCount}/${totalCount} (${percentage}% NULL)`, 'yellow');
      } else if (percentage > 0) {
        log(`  ✓ ${field}: ${nonNullCount}/${totalCount} (${percentage}% NULL)`, 'green');
      } else {
        log(`  ✓ ${field}: ${nonNullCount}/${totalCount} (完整)`, 'green');
      }
    });
  }

  validateDataRanges() {
    log('\n6. 数据范围验证', 'cyan');

    const ranges = {
      average_cadence: { min: 150, max: 220, unit: '步/分钟' },
      average_vertical_oscillation: { min: 5, max: 15, unit: '厘米' },
      average_ground_contact_time: { min: 150, max: 350, unit: '毫秒' },
      average_gct_balance: { min: 45, max: 55, unit: '%' },
      average_vertical_ratio: { min: 5, max: 15, unit: '%' },
      average_heart_rate: { min: 100, max: 200, unit: 'bpm' },
      max_heart_rate: { min: 120, max: 220, unit: 'bpm' }
    };

    Object.entries(ranges).forEach(([field, range]) => {
      const stats = this.db.prepare(`
        SELECT
          MIN(${field}) as min_val,
          MAX(${field}) as max_val,
          AVG(${field}) as avg_val,
          COUNT(*) as count
        FROM activities
        WHERE ${field} IS NOT NULL
      `).get();

      if (stats.count === 0) {
        return;
      }

      const outOfRange = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM activities
        WHERE ${field} IS NOT NULL
          AND (${field} < ? OR ${field} > ?)
      `).get(range.min, range.max).count;

      if (outOfRange === 0) {
        log(`  ✓ ${field}: ${stats.min_val.toFixed(1)}-${stats.max_val.toFixed(1)} ${range.unit} (在合理范围)`, 'green');
      } else {
        log(`  ⚠ ${field}: ${stats.min_val.toFixed(1)}-${stats.max_val.toFixed(1)} ${range.unit} (${outOfRange} 条超出范围 ${range.min}-${range.max})`, 'yellow');
        this.addWarning('数据范围', `${field} 有 ${outOfRange} 条记录超出合理范围`);
      }
    });
  }

  validateRelationships() {
    log('\n7. 关联性验证', 'cyan');

    // Check foreign key integrity
    const orphanedLaps = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM activity_laps
      WHERE activity_id NOT IN (SELECT activity_id FROM activities)
    `).get().count;

    if (orphanedLaps === 0) {
      log('  ✓ 外键完整性: 所有分段都关联到有效活动', 'green');
    } else {
      log(`  ✗ 外键完整性: ${orphanedLaps} 条分段记录孤立`, 'red');
      this.addIssue('数据完整性', `${orphanedLaps} 条分段记录没有对应的活动`);
    }

    // Check lap count reasonability
    const lapStats = this.db.prepare(`
      SELECT
        activity_id,
        COUNT(*) as lap_count,
        SUM(distance) as total_distance
      FROM activity_laps
      GROUP BY activity_id
      HAVING lap_count > 100 OR lap_count < 1
    `).all();

    if (lapStats.length === 0) {
      log('  ✓ 分段数量: 合理范围 (1-100)', 'green');
    } else {
      log(`  ⚠ ${lapStats.length} 个活动的分段数量异常`, 'yellow');
      this.addWarning('数据范围', `${lapStats.length} 个活动的分段数量异常`);
    }
  }

  printSummary() {
    log('\n╔═══════════════════════════════════════════════════════╗', 'blue');
    log('║        验证总结                                        ║', 'blue');
    log('╚═══════════════════════════════════════════════════════╝\n', 'blue');

    if (this.issues.length === 0 && this.warnings.length === 0) {
      log('✓ 所有验证通过！数据格式和内容与 FIT 数据一致。\n', 'green');
      return;
    }

    if (this.issues.length > 0) {
      log(`发现 ${this.issues.length} 个问题:\n`, 'red');
      this.issues.forEach((issue, idx) => {
        log(`  ${idx + 1}. [${issue.category}] ${issue.message}`, 'red');
      });
      log('');
    }

    if (this.warnings.length > 0) {
      log(`发现 ${this.warnings.length} 个警告:\n`, 'yellow');
      this.warnings.forEach((warning, idx) => {
        log(`  ${idx + 1}. [${warning.category}] ${warning.message}`, 'yellow');
      });
      log('');
    }

    // Recommendations
    log('建议:', 'cyan');
    if (this.issues.some(i => i.message.includes('average_speed'))) {
      log('  - 检查 fit-parser.js 中 Laps 的 average_speed 计算逻辑', 'cyan');
    }
    if (this.warnings.some(w => w.message.includes('average_stride_length'))) {
      log('  - 确认 FIT 文件是否包含步幅数据，检查字段映射是否正确', 'cyan');
    }
    if (this.issues.some(i => i.message.includes('单位'))) {
      log('  - 更新数据库表结构注释，确保单位说明准确', 'cyan');
    }
    log('');
  }

  close() {
    this.db.close();
  }
}

// CLI
async function main() {
  try {
    const validator = new DataValidator();
    await validator.validate();
    validator.close();
  } catch (error) {
    log(`\n✗ 验证失败: ${error.message}`, 'red');
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DataValidator;
