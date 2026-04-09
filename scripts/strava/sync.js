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
    this.limit = options.limit || 1; // Default to 1 for single activity sync

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

      log('Fetching activity from Strava...', 'cyan');

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
          resolve(data);
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
      const data = await this.fetchActivityData();

      log(`Found activity: ${data.name}`, 'green');
      log(`  Distance: ${data.distance} km`, 'cyan');
      log(`  Duration: ${formatDuration(data.duration)}`, 'cyan');
      log(`  Date: ${data.start_time_local}`, 'cyan');

      // Sync to database
      const result = await this.syncActivity(data);

      if (result.success) {
        log(`\nSynced activity ${result.activityId} to database`, 'green');

        // Show GPX info
        if (data.gpx_path) {
          log(`GPX saved: ${data.gpx_path}`, 'cyan');
        }

        // Show VDOT info
        if (data.vdot_value) {
          log(`VDOT: ${data.vdot_value}`, 'cyan');
        }

        return { success: true, activityId: result.activityId };
      } else {
        log(`Skipped: ${result.reason}`, 'yellow');
        return { success: false, reason: result.reason };
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
    limit: 1,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--db' && args[i + 1]) {
      options.dbPath = args[++i];
    } else if (arg === '--gpx-dir' && args[i + 1]) {
      options.gpxDir = args[++i];
    } else if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[++i]);
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
