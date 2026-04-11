#!/usr/bin/env node
/**
 * Preprocess statistics cache for heart rate zones and VDOT trends
 *
 * Usage:
 *   node scripts/preprocess-stats-cache.js [options]
 *
 * Options:
 *   --mode <mode>          'full' | 'incremental' (default: incremental)
 *   --period-type <type>   'week' | 'month' | 'both' (default: both)
 *   --start-date <date>    Start date (YYYY-MM-DD)
 *   --end-date <date>      End date (YYYY-MM-DD)
 *   --clear                Clear cache tables before rebuilding
 */

require('dotenv').config();

const Database = require('better-sqlite3');
const path = require('path');
const VDOTCalculator = require('./common/vdot-calculator');

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

class StatsCacheBuilder {
  constructor(dbPath, maxHr, restingHr) {
    this.dbPath = path.resolve(dbPath);
    this.db = new Database(this.dbPath);
    this.calculator = new VDOTCalculator(maxHr, restingHr);
  }

  /**
   * Get period string from date
   */
  getPeriod(dateStr, periodType) {
    const date = new Date(dateStr);

    if (periodType === 'month') {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    } else {
      // ISO week number calculation
      const year = date.getUTCFullYear();
      const startOfYear = new Date(Date.UTC(year, 0, 1));
      const daysSinceStartOfYear = Math.floor((date - startOfYear) / 86400000);
      const weekNo = Math.ceil((daysSinceStartOfYear + startOfYear.getUTCDay() + 1) / 7);
      return `${year}-W${String(weekNo).padStart(2, '0')}`;
    }
  }

  /**
   * Clear cache tables
   */
  clearCache() {
    log('Clearing cache tables...', 'cyan');
    this.db.exec('DELETE FROM hr_zone_stats_cache');
    this.db.exec('DELETE FROM vdot_trend_cache');
    log('✓ Cache cleared', 'green');
  }

  /**
   * Get activity laps with heart rate data
   * Filter out invalid laps: pace > 600 (10 min/km) or distance < 50m
   */
  getActivityLaps(startDate, endDate) {
    let query = `
      SELECT
        al.activity_id,
        al.lap_index,
        a.start_time,
        al.duration,
        al.distance,
        al.average_pace,
        al.average_cadence,
        al.average_stride_length,
        al.average_heart_rate
      FROM activity_laps al
      JOIN activities a ON al.activity_id = a.activity_id
      WHERE al.average_heart_rate IS NOT NULL
        AND al.distance >= 50
        AND (al.average_pace IS NULL OR al.average_pace <= 600)
    `;

    const params = [];

    if (startDate) {
      query += ' AND a.start_time >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND a.start_time <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY a.start_time, al.lap_index';

    return this.db.prepare(query).all(...params);
  }

  /**
   * Get activities with VDOT data (for VDOT trend, still use activities table)
   */
  getActivitiesWithVDOT(startDate, endDate) {
    let query = `
      SELECT
        start_time,
        vdot_value,
        distance,
        duration
      FROM activities
      WHERE vdot_value IS NOT NULL
    `;

    const params = [];

    if (startDate) {
      query += ' AND start_time >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND start_time <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY start_time';

    return this.db.prepare(query).all(...params);
  }

  /**
   * Build heart rate zone statistics based on activity laps
   */
  buildHrZoneStats(periodType, startDate, endDate) {
    log(`\nBuilding HR zone stats from laps (${periodType})...`, 'cyan');

    const laps = this.getActivityLaps(startDate, endDate);
    log(`Found ${laps.length} laps with heart rate data`, 'blue');

    // Aggregate by period + hr_zone
    const statsMap = new Map();
    const activitySets = new Map(); // Track unique activities per period+zone

    for (const lap of laps) {
      const hrZone = this.calculator.getHrZone(lap.average_heart_rate);
      if (hrZone === 0) continue;

      const period = this.getPeriod(lap.start_time, periodType);
      const key = `${period}_${hrZone}`;

      if (!statsMap.has(key)) {
        statsMap.set(key, {
          period,
          period_type: periodType,
          hr_zone: hrZone,
          activity_count: 0,
          total_duration: 0,
          total_distance: 0,
          sum_pace: 0,
          count_pace: 0,
          sum_cadence: 0,
          count_cadence: 0,
          sum_stride: 0,
          count_stride: 0,
          sum_hr: 0,
          count_hr: 0,
        });
        activitySets.set(key, new Set());
      }

      const stat = statsMap.get(key);
      const activitySet = activitySets.get(key);

      // Track unique activities
      activitySet.add(lap.activity_id);
      stat.activity_count = activitySet.size;

      // Accumulate lap metrics
      stat.total_duration += lap.duration || 0;
      stat.total_distance += lap.distance || 0;

      if (lap.average_pace) {
        stat.sum_pace += lap.average_pace;
        stat.count_pace += 1;
      }
      if (lap.average_cadence) {
        stat.sum_cadence += lap.average_cadence;
        stat.count_cadence += 1;
      }
      if (lap.average_stride_length) {
        stat.sum_stride += lap.average_stride_length;
        stat.count_stride += 1;
      }
      if (lap.average_heart_rate) {
        stat.sum_hr += lap.average_heart_rate;
        stat.count_hr += 1;
      }
    }

    // Calculate averages and insert/update cache
    const upsertStmt = this.db.prepare(`
      INSERT INTO hr_zone_stats_cache (
        period, period_type, hr_zone, activity_count,
        total_duration, total_distance,
        avg_pace, avg_cadence, avg_stride_length, avg_heart_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(period, period_type, hr_zone)
      DO UPDATE SET
        activity_count = excluded.activity_count,
        total_duration = excluded.total_duration,
        total_distance = excluded.total_distance,
        avg_pace = excluded.avg_pace,
        avg_cadence = excluded.avg_cadence,
        avg_stride_length = excluded.avg_stride_length,
        avg_heart_rate = excluded.avg_heart_rate,
        updated_at = CURRENT_TIMESTAMP
    `);

    let insertCount = 0;
    for (const stat of statsMap.values()) {
      const avg_pace = stat.count_pace > 0 ? stat.sum_pace / stat.count_pace : null;
      const avg_cadence = stat.count_cadence > 0 ? stat.sum_cadence / stat.count_cadence : null;
      const avg_stride = stat.count_stride > 0 ? stat.sum_stride / stat.count_stride : null;
      const avg_hr = stat.count_hr > 0 ? stat.sum_hr / stat.count_hr : null;

      upsertStmt.run(
        stat.period,
        stat.period_type,
        stat.hr_zone,
        stat.activity_count,
        stat.total_duration,
        stat.total_distance,
        avg_pace,
        avg_cadence,
        avg_stride,
        avg_hr
      );
      insertCount++;
    }

    log(`✓ Inserted/updated ${insertCount} HR zone stats records`, 'green');
  }

  /**
   * Build VDOT trend statistics (still based on activities table)
   */
  buildVDOTTrend(periodType, startDate, endDate) {
    log(`\nBuilding VDOT trend (${periodType})...`, 'cyan');

    const activities = this.getActivitiesWithVDOT(startDate, endDate);
    log(`Found ${activities.length} activities with VDOT data`, 'blue');

    // Aggregate by period
    const trendsMap = new Map();

    for (const activity of activities) {
      const period = this.getPeriod(activity.start_time, periodType);

      if (!trendsMap.has(period)) {
        trendsMap.set(period, {
          period,
          period_type: periodType,
          sum_vdot: 0,
          count_vdot: 0,
          max_vdot: null,
          min_vdot: null,
          activity_count: 0,
          total_distance: 0,
          total_duration: 0,
        });
      }

      const trend = trendsMap.get(period);
      const vdot = activity.vdot_value;

      trend.sum_vdot += vdot;
      trend.count_vdot += 1;
      trend.activity_count += 1;
      trend.total_distance += activity.distance || 0;
      trend.total_duration += activity.duration || 0;
      trend.max_vdot = trend.max_vdot === null ? vdot : Math.max(trend.max_vdot, vdot);
      trend.min_vdot = trend.min_vdot === null ? vdot : Math.min(trend.min_vdot, vdot);
    }

    // Insert/update cache
    const upsertStmt = this.db.prepare(`
      INSERT INTO vdot_trend_cache (
        period, period_type, avg_vdot, max_vdot, min_vdot,
        activity_count, total_distance, total_duration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(period, period_type)
      DO UPDATE SET
        avg_vdot = excluded.avg_vdot,
        max_vdot = excluded.max_vdot,
        min_vdot = excluded.min_vdot,
        activity_count = excluded.activity_count,
        total_distance = excluded.total_distance,
        total_duration = excluded.total_duration,
        updated_at = CURRENT_TIMESTAMP
    `);

    let insertCount = 0;
    for (const trend of trendsMap.values()) {
      const avg_vdot = trend.sum_vdot / trend.count_vdot;

      upsertStmt.run(
        trend.period,
        trend.period_type,
        avg_vdot,
        trend.max_vdot,
        trend.min_vdot,
        trend.activity_count,
        trend.total_distance,
        trend.total_duration
      );
      insertCount++;
    }

    log(`✓ Inserted/updated ${insertCount} VDOT trend records`, 'green');
  }

  /**
   * Build cache
   */
  build(options = {}) {
    const { mode, periodType, startDate, endDate, clear } = options;

    log('\n╔═══════════════════════════════════════════════════════╗', 'blue');
    log('║        Statistics Cache Builder                       ║', 'blue');
    log('╚═══════════════════════════════════════════════════════╝\n', 'blue');

    log(`Mode: ${mode}`, 'cyan');
    log(`Period Type: ${periodType}`, 'cyan');
    if (startDate) log(`Start Date: ${startDate}`, 'cyan');
    if (endDate) log(`End Date: ${endDate}`, 'cyan');

    if (clear) {
      this.clearCache();
    }

    const periodTypes = periodType === 'both' ? ['week', 'month'] : [periodType];

    for (const pt of periodTypes) {
      this.buildHrZoneStats(pt, startDate, endDate);
      this.buildVDOTTrend(pt, startDate, endDate);
    }

    log('\n✓ Cache build completed!', 'green');
  }

  close() {
    this.db.close();
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: 'incremental',
    periodType: 'both',
    startDate: null,
    endDate: null,
    clear: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--mode' && args[i + 1]) {
      options.mode = args[++i];
    } else if (arg === '--period-type' && args[i + 1]) {
      options.periodType = args[++i];
    } else if (arg === '--start-date' && args[i + 1]) {
      options.startDate = args[++i];
    } else if (arg === '--end-date' && args[i + 1]) {
      options.endDate = args[++i];
    } else if (arg === '--clear') {
      options.clear = true;
    }
  }

  return options;
}

// Main execution
(async function main() {
  try {
    const options = parseArgs();
    const dbPath = process.env.DB_PATH || 'app/data/activities.db';
    const maxHr = parseInt(process.env.MAX_HR) || 190;
    const restingHr = parseInt(process.env.RESTING_HR) || 55;

    const builder = new StatsCacheBuilder(dbPath, maxHr, restingHr);
    builder.build(options);
    builder.close();

    process.exit(0);
  } catch (error) {
    log(`\n✗ Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
})();
