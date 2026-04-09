#!/usr/bin/env node
/**
 * Sync Garmin activities and parse FIT files to SQLite database
 */

require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const GarminClient = require('./client');
const GarminFITParser = require('./fit-parser');
const VDOTCalculator = require('../common/vdot-calculator');
const DatabaseManager = require('../common/db-manager');

/** FIT 缓存目录，避免重复拉取 */
const FIT_CACHE_DIR = path.join(process.cwd(), '.cache', 'fit');

/** Garmin returns ZIP containing .fit; detect and extract. */
function isZip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4B; // PK
}

async function extractFitFromZip(zipBuffer) {
  const { ZipReader, Uint8ArrayReader, Uint8ArrayWriter } = await import('@zip.js/zip.js');
  const u8 = Buffer.isBuffer(zipBuffer) ? new Uint8Array(zipBuffer) : new Uint8Array(zipBuffer);
  const reader = new ZipReader(new Uint8ArrayReader(u8));
  const entries = await reader.getEntries();
  const fitEntry = entries.find(e => !e.directory && (e.filename.toLowerCase().endsWith('.fit') || e.filename.toLowerCase().endsWith('.fit.gz')));
  if (!fitEntry) {
    await reader.close();
    return null;
  }
  const data = await fitEntry.getData(new Uint8ArrayWriter());
  await reader.close();
  return Buffer.from(data);
}

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

/** 从 Garmin API 活动项推断子类型（activityType.display / subTypeKey 等） */
function inferSubSportFromApi(activityMeta) {
  const at = activityMeta?.activityType;
  if (!at) return null;
  const raw = (at.display ?? at.subTypeKey ?? at.typeKey ?? '').toString().toLowerCase();
  if (raw.includes('treadmill')) return '跑步机';
  if (raw.includes('street') || raw.includes('road') || raw.includes('outdoor')) return '路跑';
  if (raw.includes('trail')) return '越野';
  if (raw.includes('track')) return '田径场';
  if (raw.includes('indoor')) return '室内跑步';
  return null;
}

/** 从活动名称推断子类型（FIT 常为 generic 时的兜底），返回中文如 跑步机、路跑 */
function inferSubSportFromName(activityName) {
  if (!activityName || typeof activityName !== 'string') return null;
  const name = activityName.toLowerCase();
  if (name.includes('跑步机') || name.includes('treadmill')) return '跑步机';
  if (name.includes('路跑') || name.includes('street') || name.includes('户外') || name.includes('outdoor') || name.includes('outside') || (name.includes('run') && name.includes('road'))) return '路跑';
  if (name.includes('越野') || name.includes('trail')) return '越野';
  if (name.includes('田径') || name.includes('track')) return '田径场';
  if (name.includes('室内') || name.includes('indoor run') || name.includes('indoor running')) return '室内跑步';
  return null;
}

/**
 * 从列表/详情 API 的 GPS、海拔、轨迹推断子类型（列表与详情接口均无 subType 时的兜底）
 * - 有经纬度且（有爬升 或 有轨迹）且 有距离 → 路跑（户外）
 * - 无有效 GPS 且有距离 → 跑步机（室内，无轨迹）
 */
function inferSubSportFromGpsAndElevation(activityMeta) {
  if (!activityMeta) return null;
  const lat = activityMeta.startLatitude ?? activityMeta.summaryDTO?.startLatitude;
  const lon = activityMeta.startLongitude ?? activityMeta.summaryDTO?.startLongitude;
  const elevGain = activityMeta.elevationGain ?? activityMeta.summaryDTO?.elevationGain ?? 0;
  const distance = activityMeta.distance ?? activityMeta.summaryDTO?.distance ?? 0;
  const hasPolyline = activityMeta.hasPolyline === true;

  const hasGps = lat != null && lon != null && Number(lat) !== 0 && Number(lon) !== 0;
  if (hasGps && (Number(elevGain) > 0 || hasPolyline) && Number(distance) > 0) {
    return '路跑';
  }
  if (!hasGps && Number(distance) > 0) {
    return '跑步机';
  }
  return null;
}

/** 从 Garmin 活动项得到运动时间文案：年月日 + 时分 + 时长，如 "2026-02-13 16:30 · 45:20" */
function formatActivityTime(activity) {
  const durationSec = activity.duration ?? activity.durationInSeconds ?? activity.elapsedDuration;
  const startRaw = activity.startTimeGMT ?? activity.startTimeGmt ?? activity.beginTimestamp;
  const parts = [];
  if (startRaw) {
    try {
      const d = new Date(startRaw);
      if (!Number.isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        parts.push(`${y}-${m}-${day} ${h}:${min}`);
      }
    } catch (_) {}
  }
  if (durationSec != null && durationSec > 0) {
    const totalMin = Math.floor(durationSec / 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const s = Math.round(durationSec % 60);
    const durStr = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
    parts.push(durStr);
  }
  return parts.length ? parts.join(' · ') : '';
}

class GarminSync {
  constructor(options = {}) {
    this.secretString = process.env.GARMIN_SECRET_STRING;
    this.maxHr = process.env.MAX_HR ? parseInt(process.env.MAX_HR) : null;
    this.restingHr = process.env.RESTING_HR ? parseInt(process.env.RESTING_HR) : null;
    this.onlyRunning = options.onlyRunning !== false;
    this.withLaps = options.withLaps !== false;
    this.limit = options.limit || null;
    this.dbPath = options.dbPath || 'app/data/activities.db';

    if (!this.secretString) {
      throw new Error('GARMIN_SECRET_STRING environment variable not set');
    }

    // Initialize components
    this.client = new GarminClient(this.secretString);
    this.fitParser = new GarminFITParser();
    this.db = new DatabaseManager(this.dbPath);

    // VDOT calculator (if heart rate data available)
    this.vdotCalculator = null;
    if (this.maxHr && this.restingHr) {
      this.vdotCalculator = new VDOTCalculator(this.maxHr, this.restingHr);
    }
  }

  async syncAll() {
    try {
      log('\n╔═══════════════════════════════════════════════════════╗', 'blue');
      log('║        Garmin 数据同步                                 ║', 'blue');
      log('║        Starting Garmin Data Synchronization           ║', 'blue');
      log('╚═══════════════════════════════════════════════════════╝\n', 'blue');

      // Ensure FIT cache directory exists
      await fs.mkdir(FIT_CACHE_DIR, { recursive: true });

      // Check authentication
      log('检查 Garmin 认证...', 'cyan');
      const authValid = await this.client.checkAuth();
      if (!authValid) {
        throw new Error(
          'Garmin authentication failed. Please check your token.\n' +
          '若 token 已过期，可运行 python scripts/get_garmin_token.py 重新获取并更新 .env 中的 GARMIN_SECRET_STRING。'
        );
      }
      log('✓ 认证成功\n', 'green');

      // Get existing activity IDs
      const existingIds = new Set(this.db.getAllActivityIds());
      log(`发现 ${existingIds.size} 个现有活动\n`, 'cyan');

      // Fetch activities from Garmin
      log('从 Garmin Connect 获取活动列表...', 'yellow');
      const allActivities = await this._fetchAllActivities();
      log(`✓ 找到 ${allActivities.length} 个活动\n`, 'green');

      // Filter out already synced activities
      const newActivities = allActivities.filter(
        act => !existingIds.has(act.activityId)
      );

      if (newActivities.length === 0) {
        log('✓ 所有活动已同步！', 'green');
        return { success: true, synced: 0, total: allActivities.length };
      }

      log(`开始同步 ${newActivities.length} 个新活动...\n`, 'yellow');

      // Create temp directory
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'garmin-fit-'));

      try {
        let successCount = 0;
        const total = newActivities.length;

        for (let i = 0; i < newActivities.length; i++) {
          const activity = newActivities[i];
          const progress = `[${i + 1}/${total}]`;

          try {
            const result = await this._syncActivity(activity, tempDir);
            if (result.success) {
              successCount++;
              const source = result.fromCache ? '缓存' : '远程';
              const timeStr = formatActivityTime(activity);
              const timePart = timeStr ? ` ${timeStr}` : '';
              log(`${progress} ✓ ${activity.activityName}${timePart} (${source})`, 'green');
            } else if (result.skipped && result.reason === 'no_heart_rate') {
              const timeStr = formatActivityTime(activity);
              const timePart = timeStr ? ` ${timeStr} -` : ' -';
              log(`${progress} ○ ${activity.activityName}${timePart} 跳过（无心率）`, 'yellow');
            } else {
              const timeStr = formatActivityTime(activity);
              const timePart = timeStr ? ` ${timeStr} -` : ' -';
              log(`${progress} ✗ ${activity.activityName}${timePart} 失败`, 'red');
            }
          } catch (error) {
            const timeStr = formatActivityTime(activity);
            const timePart = timeStr ? ` ${timeStr} -` : ' -';
            log(`${progress} ✗ ${activity.activityName}${timePart} ${error.message}`, 'red');
          }

          // Small delay to avoid rate limiting
          await this._sleep(300);
        }

        log(`\n✓ 同步完成: ${successCount}/${total} 个活动`, 'green');
        return { success: true, synced: successCount, total: total };

      } finally {
        // Cleanup temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
      }

    } catch (error) {
      log(`\n✗ 同步失败: ${error.message}`, 'red');
      throw error;
    } finally {
      this.db.close();
    }
  }

  async _fetchAllActivities() {
    const allActivities = [];
    const batchSize = 100;
    let start = 0;
    const debugList = process.env.DEBUG_GARMIN_LIST === '1' || process.env.DEBUG_GARMIN_LIST === 'true';

    while (true) {
      const activities = await this.client.getActivities(start, batchSize);
      if (!activities || activities.length === 0) {
        break;
      }

      // 调试：首次拉取时输出活动列表 API 的原始结构，并请求活动详情看是否有子类型
      if (debugList && start === 0 && activities.length > 0) {
        log('\n[DEBUG] Garmin 活动列表 API 本批数量: ' + activities.length, 'cyan');
        log('[DEBUG] 第一条活动完整内容 (JSON):', 'cyan');
        console.log(JSON.stringify(activities[0], null, 2));
        if (activities.length > 1) {
          log('[DEBUG] 第二条活动（仅键名）: ' + Object.keys(activities[1]).join(', '), 'cyan');
        }
        log('[DEBUG] 以上为 getActivities 返回结构，用于确认 sub_sport / activityType 等', 'cyan');
        try {
          const detail = await this.client.getActivityDetails(activities[0].activityId);
          log('[DEBUG] 活动详情接口 getActivityDetails 返回 (第一条):', 'cyan');
          console.log(JSON.stringify(detail, null, 2));
        } catch (e) {
          log('[DEBUG] 活动详情接口请求失败: ' + e.message, 'yellow');
        }
        log('[DEBUG] 调试输出结束\n', 'cyan');
      }

      // Filter by activity type if needed（running + treadmill_running 均算跑步里程）
      const filtered = this.onlyRunning
        ? activities.filter(act => {
            const key = act.activityType?.typeKey || '';
            return key === 'running' || key === 'treadmill_running';
          })
        : activities;

      allActivities.push(...filtered);
      start += batchSize;

      if (this.limit && allActivities.length >= this.limit) {
        return allActivities.slice(0, this.limit);
      }

      // Small delay
      await this._sleep(500);
    }

    return allActivities;
  }

  async _syncActivity(activityMeta, tempDir) {
    const activityId = activityMeta.activityId;
    const activityName = activityMeta.activityName || 'Unknown';

    // 优先从 .cache/fit 读取，避免重复拉取
    const cachePath = path.join(FIT_CACHE_DIR, String(activityId));
    let rawData = null;
    let fromCache = false;
    try {
      rawData = await fs.readFile(cachePath);
      fromCache = true;
    } catch {
      // 缓存未命中，从 Garmin 下载
      rawData = await this.client.downloadFitFile(activityId);
      if (rawData) {
        await fs.writeFile(cachePath, Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData));
      }
    }
    if (!rawData) {
      return { success: false };
    }

    // Garmin 可能返回 ZIP 或裸 FIT，统一处理
    let fitData = rawData;
    if (isZip(fitData)) {
      const extracted = await extractFitFromZip(fitData);
      if (!extracted) return { success: false };
      fitData = extracted;
    }

    // Save to temp file
    const fitFilePath = path.join(tempDir, `${activityId}.fit`);
    await fs.writeFile(fitFilePath, Buffer.isBuffer(fitData) ? fitData : Buffer.from(fitData));

    // Parse FIT file (activity, laps, records for trend charts)
    const { activity: activityData, laps: lapsData, records: recordsData } = await this.fitParser.parseFitFile(fitFilePath);

    if (!activityData) {
      return { success: false };
    }

    // 无心率则跳过：VDOT、训练负荷、心率区间等均依赖心率，无心率活动不同步以保证统计口径一致。
    // 判定：session 的 avg_heart_rate 或 max_heart_rate > 0，或 records 中任一条有 heart_rate > 0（部分 FIT 仅 record 有心率）
    const sessionAvgHr = activityData.average_heart_rate != null ? Number(activityData.average_heart_rate) : null;
    const sessionMaxHr = activityData.max_heart_rate != null ? Number(activityData.max_heart_rate) : null;
    const hasHrInRecords = Array.isArray(recordsData) && recordsData.some(r => r.heart_rate != null && Number(r.heart_rate) > 0);
    const hasHeartRate = (sessionAvgHr != null && sessionAvgHr > 0) ||
      (sessionMaxHr != null && sessionMaxHr > 0) ||
      hasHrInRecords;
    if (!hasHeartRate) {
      await fs.unlink(fitFilePath).catch(() => {});
      return { success: false, skipped: true, reason: 'no_heart_rate' };
    }

    // Add activity metadata
    activityData.activity_id = activityId;
    activityData.name = activityName;
    activityData.activity_type = activityMeta.activityType?.typeKey || 'running';

    // FIT 常不区分子类型（多为 generic），用 API/名称/GPS 推断 sub_sport_type（列表与详情接口均无 subType）
    if (!activityData.sub_sport_type || activityData.sub_sport_type === '通用') {
      const fromApi = inferSubSportFromApi(activityMeta);
      const fromName = inferSubSportFromName(activityName);
      const fromGps = inferSubSportFromGpsAndElevation(activityMeta);
      if (fromApi) activityData.sub_sport_type = fromApi;
      else if (fromName) activityData.sub_sport_type = fromName;
      else if (fromGps) activityData.sub_sport_type = fromGps;
    }

    // Calculate VDOT if possible
    if (this.vdotCalculator && activityData.average_heart_rate) {
      const vdot = this.vdotCalculator.calculateVdotFromPace(
        (activityData.distance || 0) * 1000,  // Convert km to meters
        activityData.duration || 0,
        activityData.average_heart_rate
      );
      activityData.vdot_value = vdot;

      const trainingLoad = this.vdotCalculator.calculateTrainingLoad(
        activityData.duration || 0,
        activityData.average_heart_rate
      );
      activityData.training_load = trainingLoad;
    }

    // Save to database
    this.db.upsertActivity(activityData);

    // Save laps if enabled
    if (this.withLaps && lapsData.length > 0) {
      // Add activity_id to each lap
      const lapsWithId = lapsData.map(lap => ({
        ...lap,
        activity_id: activityId
      }));

      this.db.insertLaps(activityId, lapsWithId);
    }

    // Save record-level data (heart rate / cadence / stride trend)
    if (recordsData && recordsData.length > 0) {
      const recordsWithId = recordsData.map(rec => ({
        ...rec,
        activity_id: activityId
      }));
      this.db.insertActivityRecords(activityId, recordsWithId);
    }

    // Cleanup temp file
    await fs.unlink(fitFilePath);

    return { success: true, fromCache };
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const options = {
    onlyRunning: !args.includes('--all-types'),
    withLaps: !args.includes('--no-laps'),
    limit: null,
    dbPath: 'app/data/activities.db'
  };

  // Parse limit
  const limitIndex = args.indexOf('--limit');
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    options.limit = parseInt(args[limitIndex + 1]);
  }

  // Parse db path
  const dbIndex = args.indexOf('--db');
  if (dbIndex !== -1 && args[dbIndex + 1]) {
    options.dbPath = args[dbIndex + 1];
  }

  try {
    const sync = new GarminSync(options);
    const result = await sync.syncAll();
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    log(`\nFatal error: ${error.message}`, 'red');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = GarminSync;
