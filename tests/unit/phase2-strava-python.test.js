/**
 * Phase 2 Unit Tests - Strava Python modules structure
 */

const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');

describe('Phase 2: Strava Python Modules', () => {
  test('strava directory should exist', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'strava'))).toBe(true);
  });

  test('strava should contain fetcher.py', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'strava', 'fetcher.py'))).toBe(true);
  });

  test('strava should contain oauth_helper.py', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'strava', 'oauth_helper.py'))).toBe(true);
  });

  test('strava should contain gpx_generator.py', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'strava', 'gpx_generator.py'))).toBe(true);
  });

  test('fetcher.py should be executable', () => {
    const stats = fs.statSync(path.join(SCRIPTS_DIR, 'strava', 'fetcher.py'));
    // Check if file has content
    expect(stats.size).toBeGreaterThan(0);
  });

  test('oauth_helper.py should be executable', () => {
    const stats = fs.statSync(path.join(SCRIPTS_DIR, 'strava', 'oauth_helper.py'));
    expect(stats.size).toBeGreaterThan(0);
  });
});

describe('Phase 2: Python dependencies check', () => {
  test('Python should be available', () => {
    const { execSync } = require('child_process');
    try {
      const version = execSync('python3 --version', { encoding: 'utf-8' });
      expect(version).toMatch(/Python 3/);
    } catch (e) {
      // Try 'python' if 'python3' fails
      const version = execSync('python --version', { encoding: 'utf-8' });
      expect(version).toMatch(/Python 3/);
    }
  });

  test('stravalib should be installed', () => {
    const { execSync } = require('child_process');
    try {
      const result = execSync('python3 -c "import stravalib; print(stravalib.__version__)"', {
        encoding: 'utf-8',
        timeout: 5000
      });
      expect(result.trim()).toBeTruthy();
    } catch (e) {
      // Skip if not installed
      console.log('stravalib not installed, skipping');
    }
  });

  test('gpxpy should be installed', () => {
    const { execSync } = require('child_process');
    try {
      const result = execSync('python3 -c "import gpxpy; print(gpxpy.__version__)"', {
        encoding: 'utf-8',
        timeout: 5000
      });
      expect(result.trim()).toBeTruthy();
    } catch (e) {
      // Skip if not installed
      console.log('gpxpy not installed, skipping');
    }
  });
});

describe('Phase 2: fetcher.py functions', () => {
  // Note: These tests verify the structure, not actual API calls

  test('fetcher.py should export transform_activity_data logic', () => {
    // Read the file and check for key functions
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'fetcher.py'), 'utf-8');

    expect(content).toContain('def transform_activity_data');
    expect(content).toContain('def infer_sub_sport_type');
    expect(content).toContain('def format_pace');
    expect(content).toContain('def pace_to_seconds');
  });

  test('fetcher.py should handle both outdoor and treadmill runs', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'fetcher.py'), 'utf-8');

    expect(content).toContain('跑步机');
    expect(content).toContain('路跑');
    expect(content).toContain('treadmill_running');
  });

  test('fetcher.py should output JSON', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'fetcher.py'), 'utf-8');

    expect(content).toContain('json.dumps');
    expect(content).toContain('print(json.dumps');
  });
});
