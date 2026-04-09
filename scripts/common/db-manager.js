/**
 * Database manager for Garmin activities data
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class DatabaseManager {
  constructor(dbPath = 'app/data/activities.db') {
    this.dbPath = path.resolve(dbPath);

    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this._initDatabase();
  }

  _initDatabase() {
    // Create activities table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS activities (
        -- 基础信息
        activity_id INTEGER PRIMARY KEY,              -- 活动ID（主键）
        name TEXT NOT NULL,                           -- 活动名称
        activity_type TEXT DEFAULT 'running',         -- 活动类型（默认：跑步）
        sport_type TEXT,                              -- 运动主类型（FIT sport，如跑步、健身器械）
        sub_sport_type TEXT,                          -- 运动子类型（FIT sub_sport，如跑步机、路跑、越野）
        start_time DATETIME NOT NULL,                 -- 开始时间（UTC）
        start_time_local DATETIME NOT NULL,           -- 开始时间（本地时区）

        -- 基础指标
        distance REAL NOT NULL,                       -- 距离（公里）
        duration INTEGER NOT NULL,                    -- 总时长（秒）
        moving_time INTEGER NOT NULL,                 -- 移动时间（秒）
        elapsed_time INTEGER NOT NULL,                -- 经过时间（秒）

        -- 配速和速度
        average_pace REAL,                            -- 平均配速（秒/公里）
        average_speed REAL,                           -- 平均速度（公里/小时）
        max_speed REAL,                               -- 最大速度（米/秒）

        -- 心率数据
        average_heart_rate INTEGER,                   -- 平均心率（bpm）
        max_heart_rate INTEGER,                       -- 最大心率（bpm）

        -- 跑步动态数据
        average_cadence INTEGER,                      -- 平均步频（步/分钟）
        max_cadence INTEGER,                          -- 最大步频（步/分钟）
        average_stride_length REAL,                   -- 平均步幅（米）
        average_vertical_oscillation REAL,            -- 平均垂直摆动（厘米）
        average_vertical_ratio REAL,                  -- 平均垂直步幅比（%）
        average_ground_contact_time REAL,             -- 平均触地时间（毫秒）
        average_gct_balance REAL,                     -- 平均触地时间平衡（%）
        average_step_rate_loss REAL,                  -- 平均步速损失（厘米/秒）
        average_step_rate_loss_percent REAL,          -- 平均步速损失百分比（%）

        -- 功率数据
        average_power INTEGER,                        -- 平均功率（瓦）
        max_power INTEGER,                            -- 最大功率（瓦）
        average_power_to_weight REAL,                 -- 平均功率体重比（瓦/公斤）
        max_power_to_weight REAL,                     -- 最大功率体重比（瓦/公斤）

        -- 爬升数据
        total_ascent REAL,                            -- 累计爬升（米）
        total_descent REAL,                           -- 累计下降（米）

        -- 坡度（%）
        avg_grade REAL,                               -- 平均坡度
        avg_pos_grade REAL,                            -- 平均正坡度（上坡）
        avg_neg_grade REAL,                            -- 平均负坡度（下坡）
        max_pos_grade REAL,                            -- 最大正坡度
        max_neg_grade REAL,                            -- 最大负坡度

        -- 训练效果与负荷
        total_training_effect REAL,                    -- 有氧训练效果（0–5）
        total_anaerobic_training_effect REAL,          -- 无氧训练效果（0–5）
        normalized_power INTEGER,                     -- 标准化功率（瓦）
        training_stress_score INTEGER,                -- 训练负荷指数 TSS
        intensity_factor REAL,                        -- 强度因子 IF

        -- 海拔（米）
        avg_altitude REAL,                             -- 平均海拔
        max_altitude REAL,                             -- 最大海拔
        min_altitude REAL,                             -- 最低海拔

        -- 区间时间（秒），JSON 数组，如 [z0,z1,z2,...]
        time_in_hr_zone TEXT,                          -- 心率区间时间
        time_in_speed_zone TEXT,                       -- 速度区间时间
        time_in_cadence_zone TEXT,                     -- 步频区间时间
        time_in_power_zone TEXT,                       -- 功率区间时间

        -- 其他
        calories INTEGER,                             -- 热量消耗（卡路里）
        average_temperature REAL,                     -- 平均温度（摄氏度）

        -- VDOT 跑力值
        vdot_value REAL,                              -- VDOT 跑力值
        training_load INTEGER,                        -- 训练负荷

        -- 元数据
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,    -- 创建时间
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP     -- 更新时间
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activities_start_time
      ON activities(start_time)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activities_activity_type
      ON activities(activity_type)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activities_vdot
      ON activities(vdot_value)
    `);

    // 为已存在的数据库添加新列（兼容旧库）
    try {
      this.db.exec('ALTER TABLE activities ADD COLUMN sport_type TEXT');
    } catch (e) {
      if (!/duplicate column name/i.test(e.message)) throw e;
    }
    try {
      this.db.exec('ALTER TABLE activities ADD COLUMN sub_sport_type TEXT');
    } catch (e) {
      if (!/duplicate column name/i.test(e.message)) throw e;
    }
    const newActivityColumns = [
      ['avg_grade', 'REAL'], ['avg_pos_grade', 'REAL'], ['avg_neg_grade', 'REAL'], ['max_pos_grade', 'REAL'], ['max_neg_grade', 'REAL'],
      ['total_training_effect', 'REAL'], ['total_anaerobic_training_effect', 'REAL'], ['normalized_power', 'INTEGER'], ['training_stress_score', 'INTEGER'], ['intensity_factor', 'REAL'],
      ['avg_altitude', 'REAL'], ['max_altitude', 'REAL'], ['min_altitude', 'REAL'],
      ['time_in_hr_zone', 'TEXT'], ['time_in_speed_zone', 'TEXT'], ['time_in_cadence_zone', 'TEXT'], ['time_in_power_zone', 'TEXT']
    ];
    for (const [name, type] of newActivityColumns) {
      try {
        this.db.exec(`ALTER TABLE activities ADD COLUMN ${name} ${type}`);
      } catch (e) {
        if (!/duplicate column name/i.test(e.message)) throw e;
      }
    }

    // Create activity_laps table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS activity_laps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,         -- 分段ID（主键，自增）
        activity_id INTEGER NOT NULL,                 -- 活动ID（外键）
        lap_index INTEGER NOT NULL,                   -- 分段编号

        -- 时间数据
        duration INTEGER NOT NULL,                    -- 分段时长（秒）
        cumulative_time INTEGER NOT NULL,             -- 累积时间（秒）
        moving_time INTEGER,                          -- 移动时间（秒）

        -- 距离和配速
        distance REAL NOT NULL,                       -- 分段距离（米）
        average_pace REAL,                            -- 平均配速（秒/公里）
        average_pace_gap REAL,                        -- 平均坡度调整配速（秒/公里）
        best_pace REAL,                               -- 最佳配速（秒/公里）
        average_speed REAL,                           -- 平均速度（公里/小时）
        average_moving_pace REAL,                     -- 平均移动配速（秒/公里）

        -- 心率
        average_heart_rate INTEGER,                   -- 平均心率（bpm）
        max_heart_rate INTEGER,                       -- 最大心率（bpm）

        -- 爬升
        total_ascent REAL,                            -- 累计爬升（米）
        total_descent REAL,                           -- 累计下降（米）

        -- 功率
        average_power INTEGER,                        -- 平均功率（瓦）
        average_power_to_weight REAL,                 -- 平均功率体重比（瓦/公斤）
        max_power INTEGER,                            -- 最大功率（瓦）
        max_power_to_weight REAL,                     -- 最大功率体重比（瓦/公斤）

        -- 跑步动态
        average_cadence INTEGER,                      -- 平均步频（步/分钟）
        max_cadence INTEGER,                          -- 最大步频（步/分钟）
        average_stride_length REAL,                   -- 平均步幅（米）
        average_ground_contact_time REAL,             -- 平均触地时间（毫秒）
        average_gct_balance REAL,                     -- 平均触地时间平衡（%）
        average_vertical_oscillation REAL,            -- 平均垂直摆动（厘米）
        average_vertical_ratio REAL,                  -- 平均垂直步幅比（%）
        average_step_rate_loss REAL,                  -- 平均步速损失（厘米/秒）
        average_step_rate_loss_percent REAL,          -- 平均步速损失百分比（%）

        -- 坡度（%）
        avg_grade REAL,                               -- 平均坡度
        avg_pos_grade REAL,                           -- 平均正坡度（上坡）
        avg_neg_grade REAL,                           -- 平均负坡度（下坡）
        max_pos_grade REAL,                           -- 最大正坡度
        max_neg_grade REAL,                            -- 最大负坡度

        -- 区间时间（秒），JSON 数组
        time_in_hr_zone TEXT,                         -- 心率区间时间
        time_in_speed_zone TEXT,                       -- 速度区间时间
        time_in_cadence_zone TEXT,                     -- 步频区间时间
        time_in_power_zone TEXT,                       -- 功率区间时间

        -- 触发方式与时间戳
        lap_trigger TEXT,                              -- 分段触发方式（如 manual、distance、time）
        start_time DATETIME,                           -- 分段开始时间（UTC）

        -- 其他
        calories INTEGER,                             -- 热量消耗（卡路里）
        average_temperature REAL,                     -- 平均温度（摄氏度）

        FOREIGN KEY (activity_id) REFERENCES activities(activity_id) ON DELETE CASCADE
      )
    `);

    // 为已存在的 activity_laps 表添加新列（兼容旧库）
    const newLapColumns = [
      ['avg_grade', 'REAL'], ['avg_pos_grade', 'REAL'], ['avg_neg_grade', 'REAL'], ['max_pos_grade', 'REAL'], ['max_neg_grade', 'REAL'],
      ['time_in_hr_zone', 'TEXT'], ['time_in_speed_zone', 'TEXT'], ['time_in_cadence_zone', 'TEXT'], ['time_in_power_zone', 'TEXT'],
      ['lap_trigger', 'TEXT'], ['start_time', 'DATETIME']
    ];
    for (const [name, type] of newLapColumns) {
      try {
        this.db.exec(`ALTER TABLE activity_laps ADD COLUMN ${name} ${type}`);
      } catch (e) {
        if (!/duplicate column name/i.test(e.message)) throw e;
      }
    }

    // Create indexes for laps
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_laps_activity_id
      ON activity_laps(activity_id)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_laps_lap_index
      ON activity_laps(activity_id, lap_index)
    `);

    // activity_records: 单条活动内逐条记录（心率/步频/步幅/配速趋势）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS activity_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_id INTEGER NOT NULL,
        record_index INTEGER NOT NULL,
        elapsed_sec REAL NOT NULL,
        heart_rate INTEGER,
        cadence INTEGER,
        step_length REAL,
        pace REAL,
        FOREIGN KEY (activity_id) REFERENCES activities(activity_id) ON DELETE CASCADE
      )
    `);
    try {
      this.db.exec('ALTER TABLE activity_records ADD COLUMN pace REAL');
    } catch (e) {
      if (!/duplicate column name/i.test(e.message)) throw e;
    }
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_records_activity_id
      ON activity_records(activity_id)
    `);

    // 统计缓存表（由 preprocess-stats-cache.js 写入，前端按周/月查）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hr_zone_stats_cache (
        period TEXT NOT NULL,
        period_type TEXT NOT NULL,
        hr_zone INTEGER NOT NULL,
        activity_count INTEGER NOT NULL,
        total_duration REAL,
        total_distance REAL,
        avg_pace REAL,
        avg_cadence REAL,
        avg_stride_length REAL,
        avg_heart_rate REAL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (period, period_type, hr_zone)
      )
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vdot_trend_cache (
        period TEXT NOT NULL,
        period_type TEXT NOT NULL,
        avg_vdot REAL,
        max_vdot REAL,
        min_vdot REAL,
        activity_count INTEGER,
        total_distance REAL,
        total_duration REAL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (period, period_type)
      )
    `);
  }

  upsertActivity(activityData) {
    const columns = Object.keys(activityData);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(col => activityData[col]);

    const updateCols = columns.filter(col => col !== 'activity_id');
    const updateClause = updateCols.map(col => `${col} = excluded.${col}`).join(', ');

    const query = `
      INSERT INTO activities (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT(activity_id) DO UPDATE SET
        ${updateClause},
        updated_at = CURRENT_TIMESTAMP
    `;

    const stmt = this.db.prepare(query);
    stmt.run(...values);
  }

  insertLaps(activityId, lapsData) {
    // Delete existing laps
    const deleteStmt = this.db.prepare('DELETE FROM activity_laps WHERE activity_id = ?');
    deleteStmt.run(activityId);

    if (!lapsData || lapsData.length === 0) {
      return;
    }

    // Insert new laps
    const columns = Object.keys(lapsData[0]);
    const placeholders = columns.map(() => '?').join(', ');

    const insertStmt = this.db.prepare(`
      INSERT INTO activity_laps (${columns.join(', ')})
      VALUES (${placeholders})
    `);

    const insertMany = this.db.transaction((laps) => {
      for (const lap of laps) {
        const values = columns.map(col => lap[col]);
        insertStmt.run(...values);
      }
    });

    insertMany(lapsData);
  }

  insertActivityRecords(activityId, recordsData) {
    const deleteStmt = this.db.prepare('DELETE FROM activity_records WHERE activity_id = ?');
    deleteStmt.run(activityId);

    if (!recordsData || recordsData.length === 0) {
      return;
    }

    const columns = ['activity_id', 'record_index', 'elapsed_sec', 'heart_rate', 'cadence', 'step_length', 'pace'];
    const placeholders = columns.map(() => '?').join(', ');
    const insertStmt = this.db.prepare(`
      INSERT INTO activity_records (${columns.join(', ')})
      VALUES (${placeholders})
    `);

    const insertMany = this.db.transaction((rows) => {
      for (const row of rows) {
        insertStmt.run(
          row.activity_id,
          row.record_index,
          row.elapsed_sec,
          row.heart_rate ?? null,
          row.cadence ?? null,
          row.step_length ?? null,
          row.pace ?? null
        );
      }
    });

    insertMany(recordsData);
  }

  getActivity(activityId) {
    const stmt = this.db.prepare('SELECT * FROM activities WHERE activity_id = ?');
    return stmt.get(activityId);
  }

  getAllActivityIds() {
    const stmt = this.db.prepare('SELECT activity_id FROM activities ORDER BY start_time DESC');
    return stmt.all().map(row => row.activity_id);
  }

  getActivityCount() {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM activities');
    return stmt.get().count;
  }

  close() {
    this.db.close();
  }
}

module.exports = DatabaseManager;
