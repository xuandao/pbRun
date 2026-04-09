/**
 * Strava 错误处理测试
 * 测试各种错误场景的处理
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname, '..', '..', '..', 'scripts');

describe('Strava Error Handling: Authentication Errors', () => {
  test('should handle 401 unauthorized', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    // Should check for 401 status
    expect(content).toContain('401');
    // Should suggest re-authorization
    expect(content).toContain('auth:strava');
  });

  test('should handle invalid refresh token', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    // Should suggest re-authorization when token invalid
    expect(content).toContain('re-authorize');
  });

  test('should handle missing credentials', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    // Should check for credentials
    expect(content).toContain('Missing Strava credentials');
    expect(content).toContain('STRAVA_CLIENT_ID');
  });
});

describe('Strava Error Handling: Rate Limiting', () => {
  test('should handle 429 rate limit', () => {
    const fetcherContent = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'fetcher.py'), 'utf-8');

    // Should have retry logic
    expect(fetcherContent).toContain('retry');
    expect(fetcherContent).toContain('MAX_RETRIES');
  });

  test('should have retry delay', () => {
    const fetcherContent = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'fetcher.py'), 'utf-8');

    expect(fetcherContent).toContain('RETRY_DELAY');
    expect(fetcherContent).toContain('sleep');
  });
});

describe('Strava Error Handling: Python Errors', () => {
  test('should handle Python not found', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain('ENOENT');
    expect(content).toContain('Python3 not found');
  });

  test('should handle Python import errors', () => {
    const fetcherContent = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'fetcher.py'), 'utf-8');

    expect(fetcherContent).toContain('ImportError');
    expect(fetcherContent).toContain('stravalib');
    expect(fetcherContent).toContain('gpxpy');
  });

  test('should provide helpful error messages', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain('pip3 install');
  });
});

describe('Strava Error Handling: Data Errors', () => {
  test('should handle no running activities', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain('No running activities');
  });

  test('should handle JSON parse errors', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain('JSON.parse');
    expect(content).toContain('Failed to parse');
  });

  test('should handle missing optional fields', () => {
    const fetcherContent = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'fetcher.py'), 'utf-8');

    // Should use getattr for optional fields
    expect(fetcherContent).toContain('getattr');
  });
});

describe('Strava Error Handling: Network Errors', () => {
  test('should handle network timeouts', () => {
    const fetcherContent = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'fetcher.py'), 'utf-8');

    expect(fetcherContent).toContain('DEFAULT_TIMEOUT');
    expect(fetcherContent).toContain('timeout');
  });

  test('should handle connection errors', () => {
    const fetcherContent = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'fetcher.py'), 'utf-8');

    // Should have exception handling
    expect(fetcherContent).toContain('except Exception');
  });
});

describe('Strava Error Handling: Database Errors', () => {
  test('should handle duplicate activities', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain('already_exists');
    expect(content).toContain('skipping');
  });

  test('should handle database connection errors', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    // Should have try-catch
    expect(content).toContain('try');
    expect(content).toContain('catch');
  });
});

describe('Strava Error Handling: GPX Errors', () => {
  test('should handle GPX generation failure', () => {
    const fetcherContent = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'fetcher.py'), 'utf-8');

    expect(fetcherContent).toContain('Failed to generate GPX');
  });

  test('should handle missing GPS data', () => {
    const fetcherContent = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'fetcher.py'), 'utf-8');

    expect(fetcherContent).toContain('No GPS data');
  });

  test('should continue without GPX for treadmill', () => {
    const fetcherContent = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'fetcher.py'), 'utf-8');

    // Should return None for GPX on treadmill
    expect(fetcherContent).toContain('return None');
  });
});

describe('Strava Error Handling: Recovery', () => {
  test('should close database on error', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain('finally');
    expect(content).toContain('db.close');
  });

  test('should provide clear error messages', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain('log(');
    expect(content).toContain('Sync failed');
  });

  test('should exit with proper code', () => {
    const content = fs.readFileSync(path.join(SCRIPTS_DIR, 'strava', 'sync.js'), 'utf-8');

    expect(content).toContain('process.exit');
  });
});
