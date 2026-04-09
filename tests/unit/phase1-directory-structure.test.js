/**
 * Phase 1 Unit Tests - Directory structure validation
 */

const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');

describe('Phase 1: Directory Structure', () => {
  test('should have common directory', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'common'))).toBe(true);
  });

  test('should have garmin directory', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'garmin'))).toBe(true);
  });

  test('should have strava directory', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'strava'))).toBe(true);
  });

  test('common should contain db-manager.js', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'common', 'db-manager.js'))).toBe(true);
  });

  test('common should contain vdot-calculator.js', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'common', 'vdot-calculator.js'))).toBe(true);
  });

  test('common should contain utils.js', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'common', 'utils.js'))).toBe(true);
  });

  test('garmin should contain sync.js', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'garmin', 'sync.js'))).toBe(true);
  });

  test('garmin should contain client.js', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'garmin', 'client.js'))).toBe(true);
  });

  test('garmin should contain fit-parser.js', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'garmin', 'fit-parser.js'))).toBe(true);
  });

  test('should have compatible entry point sync-garmin.js', () => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, 'sync-garmin.js'))).toBe(true);
  });
});

describe('Phase 1: Module imports', () => {
  test('should import common/utils', () => {
    const utils = require('../../scripts/common/utils');
    expect(utils).toBeDefined();
    expect(typeof utils.log).toBe('function');
    expect(typeof utils.formatDuration).toBe('function');
    expect(typeof utils.formatPace).toBe('function');
  });

  test('should import common/vdot-calculator', () => {
    const VDOTCalculator = require('../../scripts/common/vdot-calculator');
    expect(VDOTCalculator).toBeDefined();
    expect(typeof VDOTCalculator).toBe('function');
  });

  test('should import common/db-manager', () => {
    const DatabaseManager = require('../../scripts/common/db-manager');
    expect(DatabaseManager).toBeDefined();
    expect(typeof DatabaseManager).toBe('function');
  });
});

describe('Phase 1: Utility functions', () => {
  const utils = require('../../scripts/common/utils');

  test('formatDuration should format seconds correctly', () => {
    expect(utils.formatDuration(3661)).toBe('1:01:01');
    expect(utils.formatDuration(61)).toBe('1:01');
    expect(utils.formatDuration(0)).toBe('N/A');
  });

  test('formatPace should convert m/s to min:sec/km', () => {
    // 3.33 m/s ≈ 5:00/km
    expect(utils.formatPace(3.33)).toMatch(/^5:00$/);
    // 4.0 m/s = 4:10/km (1000/4 = 250 seconds = 4:10)
    expect(utils.formatPace(4.0)).toBe('4:10');
    expect(utils.formatPace(0)).toBe('N/A');
  });

  test('parsePace should convert pace string to seconds', () => {
    expect(utils.parsePace('4:30')).toBe(270);
    expect(utils.parsePace('10:00')).toBe(600);
    expect(utils.parsePace('N/A')).toBeNull();
  });
});
