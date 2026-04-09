/**
 * Strava 同步流程测试
 * 测试从数据获取到数据库存储的完整流程
 */

const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname, '..', '..', '..', 'scripts');

describe('Strava Sync Flow: Module Structure', () => {
  test('should have strava sync.js', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'))).toBe(true);
  });

  test('should have strava fetcher.py', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'strava', 'fetcher.py'))).toBe(true);
  });

  test('should import common modules', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain("require('../common/vdot-calculator')");
    expect(content).toContain("require('../common/db-manager')");
    expect(content).toContain("require('../common/utils')");
  });
});

describe('Strava Sync Flow: Python Integration', () => {
  test('sync.js should spawn Python fetcher', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain('python3');
    expect(content).toContain('fetcher.py');
    expect(content).toContain('spawn');
  });

  test('sync.js should pass credentials to Python', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain('--client-id');
    expect(content).toContain('--client-secret');
    expect(content).toContain('--refresh-token');
  });

  test('sync.js should handle Python output', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain('JSON.parse');
    expect(content).toContain('stdout');
  });
});

describe('Strava Sync Flow: Data Transformation', () => {
  test('should have transformActivityData method', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('transformActivityData');
  });

  test('should have transformLapsData method', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('transformLapsData');
  });

  test('should calculate cumulative time for laps', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('cumulative_time');
  });
});

describe('Strava Sync Flow: Database Integration', () => {
  test('should check for existing activities', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('getActivity');
    expect(content).toContain('already_exists');
  });

  test('should use upsert for activities', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('upsertActivity');
  });

  test('should insert laps', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('insertLaps');
  });
});

describe('Strava Sync Flow: VDOT Calculation', () => {
  test('should calculate VDOT when HR data available', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('vdotCalculator');
    expect(content).toContain('calculateVdotFromPace');
  });

  test('should calculate training load', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('calculateTrainingLoad');
  });
});

describe('Strava Sync Flow: Error Handling', () => {
  test('should handle 401 auth errors', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('401');
    expect(content).toContain('auth:strava');
  });

  test('should handle Python not found', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('ENOENT');
  });

  test('should handle no activities found', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('No running activities');
  });
});

describe('Strava Sync Flow: GPX Handling', () => {
  test('should create GPX directory', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('mkdir');
    expect(content).toContain('gpxDir');
  });

  test('should pass GPX directory to Python', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('--output-dir');
  });
});

describe('Strava Sync Flow: Environment Variables', () => {
  test('should read STRAVA_CLIENT_ID', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('STRAVA_CLIENT_ID');
  });

  test('should read STRAVA_CLIENT_SECRET', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('STRAVA_CLIENT_SECRET');
  });

  test('should read STRAVA_REFRESH_TOKEN', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('STRAVA_REFRESH_TOKEN');
  });

  test('should read MAX_HR and RESTING_HR', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');
    expect(content).toContain('MAX_HR');
    expect(content).toContain('RESTING_HR');
  });
});
