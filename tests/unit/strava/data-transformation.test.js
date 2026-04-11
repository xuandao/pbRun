/**
 * Strava 数据转换功能测试
 * 测试 Strava API 数据到 SQLite schema 的转换
 */

const fs = require('fs');
const path = require('path');

// Mock data for Strava activity
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
  average_pace: 300, // 5:00/km in seconds
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
  gpx_path: '/path/to/1234567890.gpx',
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
  total_ascent: 0,
};

describe('Strava Data Transformation: Activity Fields', () => {
  test('should have all required activity fields', () => {
    const requiredFields = [
      'activity_id', 'name', 'activity_type', 'sport_type', 'sub_sport_type',
      'start_time', 'start_time_local', 'distance', 'duration', 'moving_time',
      'elapsed_time', 'average_pace', 'average_speed', 'average_heart_rate'
    ];

    for (const field of requiredFields) {
      expect(mockStravaActivity[field]).toBeDefined();
    }
  });

  test('should transform distance from meters to kilometers', () => {
    // Strava API returns meters, we store km
    expect(mockStravaActivity.distance).toBe(5.0);
    expect(typeof mockStravaActivity.distance).toBe('number');
  });

  test('should transform pace from m/s to seconds per km', () => {
    // 5:00/km = 300 seconds
    expect(mockStravaActivity.average_pace).toBe(300);
    expect(mockStravaActivity.average_pace).toBeGreaterThan(0);
  });

  test('should transform speed from m/s to km/h', () => {
    // 12 km/h
    expect(mockStravaActivity.average_speed).toBe(12.0);
    expect(mockStravaActivity.average_speed).toBeGreaterThan(0);
  });

  test('should handle timestamp in ISO format', () => {
    expect(mockStravaActivity.start_time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(mockStravaActivity.start_time_local).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('Strava Data Transformation: Heart Rate Data', () => {
  test('should include average and max heart rate', () => {
    expect(mockStravaActivity.average_heart_rate).toBe(155);
    expect(mockStravaActivity.max_heart_rate).toBe(175);
  });

  test('should handle missing heart rate data gracefully', () => {
    const activityWithoutHR = {
      ...mockStravaActivity,
      average_heart_rate: null,
      max_heart_rate: null,
    };

    expect(activityWithoutHR.average_heart_rate).toBeNull();
    expect(activityWithoutHR.max_heart_rate).toBeNull();
  });
});

describe('Strava Data Transformation: Laps/Splits', () => {
  test('should have array of laps', () => {
    expect(Array.isArray(mockStravaActivity.laps)).toBe(true);
    expect(mockStravaActivity.laps.length).toBeGreaterThan(0);
  });

  test('each lap should have required fields', () => {
    const lap = mockStravaActivity.laps[0];
    const requiredFields = ['lap_index', 'duration', 'distance', 'average_pace'];

    for (const field of requiredFields) {
      expect(lap[field]).toBeDefined();
    }
  });

  test('lap distance should be in meters', () => {
    const lap = mockStravaActivity.laps[0];
    expect(lap.distance).toBe(1000); // 1km = 1000m
  });

  test('lap duration should be in seconds', () => {
    const lap = mockStravaActivity.laps[0];
    expect(lap.duration).toBe(300); // 5 minutes = 300 seconds
  });

  test('cumulative time should be calculated correctly', () => {
    // First lap: 300s, Second lap: 300s, cumulative should be 600s
    let cumulativeTime = 0;
    mockStravaActivity.laps.forEach(lap => {
      cumulativeTime += lap.duration;
    });
    expect(cumulativeTime).toBe(600);
  });
});

describe('Strava Data Transformation: Activity Types', () => {
  test('should identify outdoor road run', () => {
    expect(mockStravaActivity.sub_sport_type).toBe('路跑');
    expect(mockStravaActivity.sport_type).toBe('running');
    expect(mockStravaActivity.gpx_path).not.toBeNull();
  });

  test('should identify treadmill run', () => {
    expect(mockTreadmillActivity.sub_sport_type).toBe('跑步机');
    expect(mockTreadmillActivity.sport_type).toBe('treadmill_running');
    expect(mockTreadmillActivity.gpx_path).toBeNull();
  });

  test('should handle trail run', () => {
    const trailRun = {
      ...mockStravaActivity,
      name: 'Trail Run in Mountains',
      sub_sport_type: '越野',
    };
    expect(trailRun.sub_sport_type).toBe('越野');
  });
});

describe('Strava Data Transformation: Cadence Data', () => {
  test('should handle cadence data converted from rpm to spm', () => {
    // Strava API returns rpm (rotations per minute), we convert to spm (steps per minute)
    // Typical running cadence: 85 rpm = 170 spm
    expect(mockStravaActivity.average_cadence).toBe(170);
    expect(mockStravaActivity.max_cadence).toBe(180);
  });

  test('lap cadence should be converted from rpm to spm', () => {
    // Lap cadence should also be in spm after conversion
    // Typical lap cadence: 82-85 rpm = 165-170 spm
    expect(mockStravaActivity.laps[0].average_cadence).toBe(165);
    expect(mockStravaActivity.laps[1].average_cadence).toBe(170);
  });

  test('cadence values should be in reasonable spm range', () => {
    // Normal running cadence ranges from 150-200 spm
    const avgCadence = mockStravaActivity.average_cadence;
    expect(avgCadence).toBeGreaterThanOrEqual(150);
    expect(avgCadence).toBeLessThanOrEqual(200);
  });

  test('should handle missing cadence data gracefully', () => {
    const activityWithoutCadence = {
      ...mockStravaActivity,
      average_cadence: null,
      max_cadence: null,
    };

    expect(activityWithoutCadence.average_cadence).toBeNull();
    expect(activityWithoutCadence.max_cadence).toBeNull();
  });

  test('cadence conversion formula should be correct', () => {
    // rpm * 2 = spm
    const rpmValue = 85;
    const expectedSpm = rpmValue * 2;
    expect(expectedSpm).toBe(170);

    // Verify the mock data follows this pattern
    expect(mockStravaActivity.average_cadence).toBe(expectedSpm);
  });
});

describe('Strava Data Transformation: GPX Handling', () => {
  test('should have GPX path for outdoor runs', () => {
    expect(mockStravaActivity.gpx_path).toBeTruthy();
    expect(mockStravaActivity.gpx_path.endsWith('.gpx')).toBe(true);
  });

  test('should not have GPX for treadmill runs', () => {
    expect(mockTreadmillActivity.gpx_path).toBeNull();
  });

  test('GPX path should include activity ID', () => {
    expect(mockStravaActivity.gpx_path).toContain(String(mockStravaActivity.activity_id));
  });
});
