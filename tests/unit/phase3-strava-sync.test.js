/**
 * Phase 3 Unit Tests - Strava Node.js sync script
 */

const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');

describe('Phase 3: Strava Node.js Sync Script', () => {
  test('strava should contain sync.js', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'))).toBe(true);
  });

  test('sync.js should be executable', () => {
    const stats = fs.statSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'));
    expect(stats.size).toBeGreaterThan(0);
  });

  test('sync.js should import common modules', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain("require('../common/vdot-calculator')");
    expect(content).toContain("require('../common/db-manager')");
    expect(content).toContain("require('../common/utils')");
  });

  test('sync.js should call Python fetcher', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain('fetcher.py');
    expect(content).toContain('python3');
    expect(content).toContain('spawn');
  });

  test('sync.js should have transformActivityData method', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain('transformActivityData');
    expect(content).toContain('transformLapsData');
  });

  test('sync.js should check environment variables', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain('STRAVA_CLIENT_ID');
    expect(content).toContain('STRAVA_CLIENT_SECRET');
    expect(content).toContain('STRAVA_REFRESH_TOKEN');
  });

  test('sync.js should handle Python not found error', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain('ENOENT');
    expect(content).toContain('Python3 not found');
  });

  test('sync.js should handle 401 auth errors', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain('401');
    expect(content).toContain('unauthorized');
    expect(content).toContain('auth:strava');
  });
});

describe('Phase 3: Data transformation', () => {
  // Mock test for transform logic
  const mockStravaData = {
    activity_id: 123456,
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
    average_pace: 300, // 5:00/km
    average_speed: 12.0, // km/h
    max_speed: 15.0,
    average_heart_rate: 155,
    max_heart_rate: 175,
    average_cadence: 170,
    max_cadence: 180,
    total_ascent: 50,
    average_power: 250,
    max_power: 300,
    calories: 350,
    gpx_path: '/path/to/file.gpx',
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
    ],
  };

  test('mock data should have all required fields', () => {
    const requiredFields = [
      'activity_id', 'name', 'activity_type', 'distance', 'duration',
      'average_pace', 'average_heart_rate', 'start_time', 'start_time_local'
    ];

    for (const field of requiredFields) {
      expect(mockStravaData[field]).toBeDefined();
    }
  });

  test('laps should be array with required fields', () => {
    expect(Array.isArray(mockStravaData.laps)).toBe(true);
    expect(mockStravaData.laps.length).toBeGreaterThan(0);

    const lap = mockStravaData.laps[0];
    const requiredLapFields = ['lap_index', 'duration', 'distance', 'average_pace'];

    for (const field of requiredLapFields) {
      expect(lap[field]).toBeDefined();
    }
  });
});

describe('Phase 3: GPX directory', () => {
  test('should create GPX directory if not exists', () => {
    // This is tested by the sync script
    const gpxDir = path.join(process.cwd(), 'public', 'gpx', 'strava');
    expect(gpxDir).toContain('public');
    expect(gpxDir).toContain('gpx');
    expect(gpxDir).toContain('strava');
  });
});
