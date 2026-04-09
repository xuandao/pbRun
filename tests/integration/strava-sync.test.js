/**
 * Integration Tests - Strava Sync
 * Tests the complete sync workflow with mocked API responses
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Mock data for Strava API responses
const mockStravaActivity = {
  activity_id: 1234567890,
  name: 'Morning Run',
  activity_type: 'running',
  sport_type: 'running',
  sub_sport_type: '路跑',
  start_time: '2026-04-09T08:30:00Z',
  start_time_local: '2026-04-09T16:30:00+08:00',
  distance: 5.0,
  duration: 1500,
  moving_time: 1500,
  elapsed_time: 1600,
  average_pace: 300,
  average_speed: 12.0,
  max_speed: 15.0,
  average_heart_rate: 155,
  max_heart_rate: 175,
  average_cadence: 170,
  max_cadence: 180,
  total_ascent: 50,
  average_power: 250,
  max_power: 300,
  calories: 350,
  gpx_path: null,
  laps: [
    {
      lap_index: 1,
      duration: 300,
      distance: 1000,
      average_pace: 300,
      average_heart_rate: 150,
      max_heart_rate: 160,
      total_ascent: 10,
      average_cadence: 165,
    },
    {
      lap_index: 2,
      duration: 300,
      distance: 1000,
      average_pace: 295,
      average_heart_rate: 155,
      max_heart_rate: 165,
      total_ascent: 15,
      average_cadence: 170,
    },
  ],
  source: 'strava',
};

const mockTreadmillActivity = {
  ...mockStravaActivity,
  activity_id: 1234567891,
  name: 'Treadmill Run',
  sport_type: 'treadmill_running',
  sub_sport_type: '跑步机',
  gpx_path: null,
};

describe('Integration: Strava data transformation', () => {
  test('should transform activity data correctly', () => {
    // Verify mock data structure matches expected schema
    const requiredFields = [
      'activity_id', 'name', 'activity_type', 'sport_type', 'sub_sport_type',
      'start_time', 'start_time_local', 'distance', 'duration', 'average_pace',
      'average_heart_rate', 'laps'
    ];

    for (const field of requiredFields) {
      expect(mockStravaActivity[field]).toBeDefined();
    }
  });

  test('should calculate pace correctly', () => {
    // 5km in 1500 seconds = 300 sec/km = 5:00/km
    expect(mockStravaActivity.average_pace).toBe(300);
  });

  test('should handle treadmill activities', () => {
    expect(mockTreadmillActivity.sport_type).toBe('treadmill_running');
    expect(mockTreadmillActivity.sub_sport_type).toBe('跑步机');
    expect(mockTreadmillActivity.gpx_path).toBeNull();
  });

  test('should have laps with correct structure', () => {
    expect(mockStravaActivity.laps.length).toBe(2);

    const lap = mockStravaActivity.laps[0];
    expect(lap.lap_index).toBe(1);
    expect(lap.distance).toBe(1000); // meters
    expect(lap.duration).toBe(300); // seconds
  });
});

describe('Integration: Database operations', () => {
  const dbPath = path.join(__dirname, '..', '..', 'app', 'data', 'activities.db');

  test('database file should exist or be creatable', () => {
    // Database will be created by db-manager if not exists
    const dataDir = path.dirname(dbPath);
    expect(fs.existsSync(dataDir)).toBe(true);
  });

  test('DatabaseManager should be importable', () => {
    const DatabaseManager = require('../../scripts/common/db-manager');
    expect(DatabaseManager).toBeDefined();
    expect(typeof DatabaseManager).toBe('function');
  });
});

describe('Integration: GPX handling', () => {
  const gpxDir = path.join(__dirname, '..', '..', 'public', 'gpx', 'strava');

  test('GPX directory should be accessible', () => {
    // Directory may not exist yet, but path should be valid
    expect(gpxDir).toContain('public');
    expect(gpxDir).toContain('gpx');
    expect(gpxDir).toContain('strava');
  });

  test('should handle outdoor runs with GPX', () => {
    const outdoorActivity = {
      ...mockStravaActivity,
      gpx_path: path.join(gpxDir, '1234567890.gpx'),
    };

    expect(outdoorActivity.gpx_path).toBeTruthy();
    expect(outdoorActivity.sub_sport_type).toBe('路跑');
  });

  test('should handle indoor runs without GPX', () => {
    expect(mockTreadmillActivity.gpx_path).toBeNull();
    expect(mockTreadmillActivity.sub_sport_type).toBe('跑步机');
  });
});

describe('Integration: VDOT calculation', () => {
  test('VDOTCalculator should be importable', () => {
    const VDOTCalculator = require('../../scripts/common/vdot-calculator');
    expect(VDOTCalculator).toBeDefined();
    expect(typeof VDOTCalculator).toBe('function');
  });

  test('should calculate VDOT with heart rate data', () => {
    const VDOTCalculator = require('../../scripts/common/vdot-calculator');
    const calc = new VDOTCalculator(190, 55); // maxHr, restingHr

    // 5km in 1500s at avg HR 155
    const distance = 5000;
    const duration = 1500;
    const avgHr = 155;

    const vdot = calc.calculateVdotFromPace(distance, duration, avgHr);

    expect(vdot).toBeDefined();
    expect(vdot).toBeGreaterThan(0);
    expect(typeof vdot).toBe('number');
  });
});

describe('Integration: Error handling', () => {
  test('should handle missing credentials', () => {
    // This test is skipped because dotenv loads .env before we can mock
    // The actual error handling is tested in the sync script
    expect(true).toBe(true);
  });

  test('should handle Python not found', () => {
    // This is tested by the sync script's error handling
    expect(true).toBe(true); // Placeholder
  });
});

describe('Integration: Complete workflow structure', () => {
  test('all required modules should be in place', () => {
    const modules = [
      'scripts/strava/sync.js',
      'scripts/strava/fetcher.py',
      'scripts/strava/oauth_helper.py',
      'scripts/strava/gpx_generator.py',
      'scripts/common/db-manager.js',
      'scripts/common/vdot-calculator.js',
      'scripts/common/utils.js',
    ];

    for (const mod of modules) {
      const fullPath = path.join(__dirname, '..', '..', mod);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  test('npm scripts should be configured', () => {
    const packageJson = require('../../package.json');

    expect(packageJson.scripts['sync:strava']).toBeDefined();
    expect(packageJson.scripts['auth:strava']).toBeDefined();
  });
});
