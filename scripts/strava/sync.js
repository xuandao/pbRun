#!/usr/bin/env node
/**
 * Sync Strava activities to SQLite database
 * Usage: npm run sync:strava [--options]
 */

require('dotenv').config();

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const VDOTCalculator = require('../common/vdot-calculator');
const DatabaseManager = require('../common/db-manager');
const { log, logSection, formatDuration, sleep } = require('../common/utils');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Strava Sync class
 */
class StravaSync {
  constructor(options = {}) {
    this.clientId = process.env.STRAVA_CLIENT_ID;
    this.clientSecret = process.env.STRAVA_CLIENT_SECRET;
    this.refreshToken = process.env.STRAVA_REFRESH_TOKEN;
    this.maxHr = process.env.MAX_HR ? parseInt(process.env.MAX_HR) : null;
    this.restingHr = process.env.RESTING_HR ? parseInt(process.env.RESTING_HR) : null;

    this.dbPath = options.dbPath || 'app/data/activities.db';
    this.gpxDir = options.gpxDir || 'public/gpx/strava';
    this.limit = options.limit || 100;
    this.activityId = options.activityId || null;
    this.since = options.since || null;  // Date string YYYY-MM-DD

    // Validate credentials
    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new Error(
        'Missing Strava credentials. Please set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, ' +
        'and STRAVA_REFRESH_TOKEN environment variables.\n' +
        'Run: npm run auth:strava to obtain credentials.'
      );
    }

    // Initialize components
    this.db = new DatabaseManager(this.dbPath);

    // VDOT calculator (if heart rate data available)
    this.vdotCalculator = null;
    if (this.maxHr && this.restingHr) {
      this.vdotCalculator = new VDOTCalculator(this.maxHr, this.restingHr);
    }
  }

  /**
   * Run Python fetcher to get activity data
   */
  async fetchActivityData() {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, 'fetcher.py');
      const args = [
        scriptPath,
        '--client-id', this.clientId,
        '--client-secret', this.clientSecret,
        '--refresh-token', this.refreshToken,
        '--output-dir', this.gpxDir,
        '--json',
      ];

      // Add activity ID if specified
      if (this.activityId) {
        args.push('--activity-id', this.activityId);
      }

      // Add since date if specified
      if (this.since) {
        args.push('--since', this.since);
        args.push('--limit', String(this.limit));
      }

      const fetchType = this.activityId
        ? `activity ${this.activityId}`
        : this.since
          ? `activities since ${this.since}`
          : 'latest activity';
      log(`Fetching ${fetchType} from Strava...`, 'cyan');

      const child = spawn('python3', args, {
        cwd: process.cwd(),
        env: process.env,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          // Check for specific errors
          if (stderr.includes('401') || stderr.includes('unauthorized')) {
            reject(new Error(
              'Strava authentication failed. Token may be expired.\n' +
              'Run: npm run auth:strava to re-authorize.'
            ));
          } else if (stderr.includes('No running activities')) {
            reject(new Error('No running activities found in Strava.'));
          } else if (stderr.includes('not found')) {
            reject(new Error(`Activity ${this.activityId} not found in Strava.`));
          } else {
            reject(new Error(`Python fetcher failed: ${stderr || stdout}`));
          }
          return;
        }

        try {
          const data = JSON.parse(stdout);
          if (data.error) {
            reject(new Error(data.error));
            return;
          }

          // Handle batch result (with activities array) or single result
          if (data.activities && Array.isArray(data.activities)) {
            resolve({
              type: 'batch',
              activities: data.activities,
              count: data.count
            });
          } else {
            resolve({
              type: 'single',
              activity: data
            });
          }
        } catch (e) {
          reject(new Error(`Failed to parse fetcher output: ${e.message}`));
        }
      });

      child.on('error', (error) => {
        if (error.code === 'ENOENT') {
          reject(new Error(
            'Python3 not found. Please install Python 3 and required packages:\n' +
            'pip3 install stravalib gpxpy requests'
          ));
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Transform Strava data to SQLite schema
   */
  transformActivityData(data) {
    // Map fields from Strava format to SQLite schema
    const activityData = {
      activity_id: data.activity_id,
      name: data.name,
      activity_type: data.activity_type || 'running',
      sport_type: data.sport_type || 'running',
      sub_sport_type: data.sub_sport_type || '路跑',
      start_time: data.start_time,
      start_time_local: data.start_time_local,

      // Distance and time
      distance: data.distance,
      duration: data.duration,
      moving_time: data.moving_time,
      elapsed_time: data.elapsed_time,

      // Pace and speed
      average_pace: data.average_pace,
      average_speed: data.average_speed,
      max_speed: data.max_speed,

      // Heart rate
      average_heart_rate: data.average_heart_rate,
      max_heart_rate: data.max_heart_rate,

      // Cadence
      average_cadence: data.average_cadence,
      max_cadence: data.max_cadence,

      // Elevation
      total_ascent: data.total_ascent,

      // Power
      average_power: data.average_power,
      max_power: data.max_power,

      // Calories
      calories: data.calories,
    };

    // Calculate VDOT if heart rate data available
    if (this.vdotCalculator && data.average_heart_rate) {
      const distanceMeters = data.distance * 1000;
      const vdot = this.vdotCalculator.calculateVdotFromPace(
        distanceMeters,
        data.duration,
        data.average_heart_rate
      );
      activityData.vdot_value = vdot;

      const trainingLoad = this.vdotCalculator.calculateTrainingLoad(
        data.duration,
        data.average_heart_rate
      );
      activityData.training_load = trainingLoad;
    }

    return activityData;
  }

  /**
   * Transform laps data
   */
  transformLapsData(activityId, laps) {
    if (!laps || !Array.isArray(laps)) {
      return [];
    }

    let cumulativeTime = 0;

    return laps.map(lap => {
      cumulativeTime += lap.duration || 0;

      return {
        activity_id: activityId,
        lap_index: lap.lap_index,
        duration: lap.duration,
        cumulative_time: cumulativeTime,
        distance: lap.distance,
        average_pace: lap.average_pace,
        average_heart_rate: lap.average_heart_rate,
        max_heart_rate: lap.max_heart_rate,
        total_ascent: lap.total_ascent,
        average_cadence: lap.average_cadence,
      };
    });
  }

  /**
   * Transform records data for database
   */
  transformRecordsData(activityId, records) {
    if (!records || !Array.isArray(records)) {
      return [];
    }

    return records.map(rec => ({
      activity_id: activityId,
      record_index: rec.record_index,
      elapsed_sec: rec.elapsed_sec,
      heart_rate: rec.heart_rate,
      cadence: rec.cadence,
      step_length: rec.step_length,
      pace: rec.pace,
    }));
  }

  /**
   * Sync activity to database
   */
  async syncActivity(data) {
    const activityId = data.activity_id;

    // Check if activity already exists
    const existing = this.db.getActivity(activityId);
    if (existing) {
      log(`Activity ${activityId} already exists, skipping`, 'yellow');
      return { success: false, reason: 'already_exists' };
    }

    // Transform and save activity
    const activityData = this.transformActivityData(data);
    this.db.upsertActivity(activityData);

    // Save laps
    const lapsData = this.transformLapsData(activityId, data.laps);
    if (lapsData.length > 0) {
      this.db.insertLaps(activityId, lapsData);
    }

    // Save records
    const recordsData = this.transformRecordsData(activityId, data.records);
    if (recordsData.length > 0) {
      this.db.insertActivityRecords(activityId, recordsData);
    }

    return { success: true, activityId };
  }

  /**
   * Run full sync
   */
  async sync() {
    try {
      logSection('Strava Data Sync');

      // Ensure GPX directory exists
      await fs.mkdir(this.gpxDir, { recursive: true });

      // Fetch activity data from Python fetcher
      const result = await this.fetchActivityData();

      // Handle batch sync (multiple activities)
      if (result.type === 'batch') {
        log(`Found ${result.count} activities`, 'green');

        let synced = 0;
        let skipped = 0;
        let failed = 0;

        for (const activityData of result.activities) {
          try {
            log(`\nProcessing: ${activityData.name}`, 'cyan');
            log(`  Distance: ${activityData.distance} km`, 'cyan');
            log(`  Date: ${activityData.start_time_local}`, 'cyan');

            const syncResult = await this.syncActivity(activityData);

            if (syncResult.success) {
              synced++;
              log(`  ✓ Synced: ${syncResult.activityId}`, 'green');
            } else {
              skipped++;
              log(`  ⚠ Skipped: ${syncResult.reason}`, 'yellow');
            }
          } catch (error) {
            failed++;
            log(`  ✗ Failed: ${error.message}`, 'red');
          }
        }

        log(`\n${'='.repeat(60)}`, 'bright');
        log(`Sync Summary:`, 'bright');
        log(`  Synced: ${synced}`, 'green');
        log(`  Skipped: ${skipped}`, 'yellow');
        log(`  Failed: ${failed}`, failed > 0 ? 'red' : 'reset');
        log(`${'='.repeat(60)}`, 'bright');

        return { success: true, synced, skipped, failed };

      } else {
        // Single activity sync
        const data = result.activity;

        log(`Found activity: ${data.name}`, 'green');
        log(`  Distance: ${data.distance} km`, 'cyan');
        log(`  Duration: ${formatDuration(data.duration)}`, 'cyan');
        log(`  Date: ${data.start_time_local}`, 'cyan');

        // Sync to database
        const syncResult = await this.syncActivity(data);

        if (syncResult.success) {
          log(`\nSynced activity ${syncResult.activityId} to database`, 'green');

          // Show GPX info
          if (data.gpx_path) {
            log(`GPX saved: ${data.gpx_path}`, 'cyan');
          }

          // Show VDOT info
          if (data.vdot_value) {
            log(`VDOT: ${data.vdot_value}`, 'cyan');
          }

          return { success: true, activityId: syncResult.activityId };
        } else {
          log(`Skipped: ${syncResult.reason}`, 'yellow');
          return { success: false, reason: syncResult.reason };
        }
      }

    } catch (error) {
      log(`\nSync failed: ${error.message}`, 'red');
      throw error;
    } finally {
      this.db.close();
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dbPath: 'app/data/activities.db',
    gpxDir: 'public/gpx/strava',
    limit: 100,
    activityId: null,
    since: null,  // Date string in YYYY-MM-DD format
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--db' && args[i + 1]) {
      options.dbPath = args[++i];
    } else if (arg === '--gpx-dir' && args[i + 1]) {
      options.gpxDir = args[++i];
    } else if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[++i]);
    } else if (arg === '--activity-id' && args[i + 1]) {
      options.activityId = args[++i];
    } else if (arg === '--since' && args[i + 1]) {
      options.since = args[++i];
    }
  }

  return options;
}

/**
 * Main function
 */
async function main() {
  try {
    const options = parseArgs();
    const sync = new StravaSync(options);
    const result = await sync.sync();

    // For batch sync, success if at least one activity synced
    if (result.synced !== undefined) {
      process.exit(result.synced > 0 ? 0 : 1);
    }

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('\n' + colors.red + 'Error: ' + error.message + colors.reset);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = StravaSync;
