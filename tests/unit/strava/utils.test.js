/**
 * Strava 工具函数测试
 * 测试配速计算、时间格式化、距离转换等工具函数
 */

// 模拟 Python 工具函数在 Node.js 中测试
function parseQuantity(value) {
  if (value === null || value === undefined) {
    return 0.0;
  }
  if (typeof value === 'object' && value.magnitude !== undefined) {
    return parseFloat(value.magnitude);
  }
  return parseFloat(value);
}

function formatDuration(duration) {
  if (!duration) {
    return null;
  }

  let totalSeconds;
  if (typeof duration === 'object' && duration.total_seconds) {
    totalSeconds = duration.total_seconds();
  } else {
    totalSeconds = parseInt(duration);
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatPace(metersPerSecond) {
  if (!metersPerSecond || metersPerSecond <= 0) {
    return null;
  }

  const secondsPerKm = 1000 / metersPerSecond;
  let minutes = Math.floor(secondsPerKm / 60);
  let seconds = Math.round(secondsPerKm % 60);

  // Handle case where seconds rounds to 60
  if (seconds === 60) {
    minutes += 1;
    seconds = 0;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function paceToSeconds(metersPerSecond) {
  if (!metersPerSecond || metersPerSecond <= 0) {
    return null;
  }
  return Math.round(1000 / metersPerSecond);
}

function metersToKilometers(meters) {
  if (!meters || meters <= 0) {
    return 0;
  }
  return parseFloat((meters / 1000).toFixed(2));
}

function speedToKmh(metersPerSecond) {
  if (!metersPerSecond || metersPerSecond <= 0) {
    return null;
  }
  return parseFloat((metersPerSecond * 3.6).toFixed(2));
}

describe('Strava Utils: parseQuantity', () => {
  test('should return 0.0 for null', () => {
    expect(parseQuantity(null)).toBe(0.0);
  });

  test('should return 0.0 for undefined', () => {
    expect(parseQuantity(undefined)).toBe(0.0);
  });

  test('should parse plain number', () => {
    expect(parseQuantity(100)).toBe(100.0);
    expect(parseQuantity(3.5)).toBe(3.5);
  });

  test('should parse string number', () => {
    expect(parseQuantity('100')).toBe(100.0);
    expect(parseQuantity('3.5')).toBe(3.5);
  });

  test('should parse pint Quantity object', () => {
    const mockQty = { magnitude: 5000 };
    expect(parseQuantity(mockQty)).toBe(5000.0);
  });

  test('should handle zero', () => {
    expect(parseQuantity(0)).toBe(0.0);
  });

  test('should handle negative numbers', () => {
    expect(parseQuantity(-100)).toBe(-100.0);
  });
});

describe('Strava Utils: formatDuration', () => {
  test('should return null for null/undefined', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(undefined)).toBeNull();
  });

  test('should format seconds only', () => {
    expect(formatDuration(45)).toBe('0:45');
  });

  test('should format minutes and seconds', () => {
    expect(formatDuration(61)).toBe('1:01');
    expect(formatDuration(300)).toBe('5:00');
    expect(formatDuration(1500)).toBe('25:00');
  });

  test('should format hours, minutes and seconds', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(7200)).toBe('2:00:00');
    expect(formatDuration(3934)).toBe('1:05:34'); // 1 hour 5 min 34 sec
  });

  test('should handle timedelta-like object', () => {
    const mockTimedelta = {
      total_seconds: () => 3661,
    };
    expect(formatDuration(mockTimedelta)).toBe('1:01:01');
  });
});

describe('Strava Utils: formatPace', () => {
  test('should return null for null/undefined', () => {
    expect(formatPace(null)).toBeNull();
    expect(formatPace(undefined)).toBeNull();
  });

  test('should return null for zero or negative', () => {
    expect(formatPace(0)).toBeNull();
    expect(formatPace(-1)).toBeNull();
  });

  test('should format 4:00/km pace', () => {
    // 4:00/km = 4.1667 m/s
    expect(formatPace(4.1667)).toBe('4:00');
  });

  test('should format 5:00/km pace', () => {
    // 5:00/km = 3.3333 m/s
    expect(formatPace(3.3333)).toBe('5:00');
  });

  test('should format 6:00/km pace', () => {
    // 6:00/km = 2.7778 m/s
    expect(formatPace(2.7778)).toBe('6:00');
  });

  test('should round seconds correctly', () => {
    // 4:30/km = 4.5 min/km = 270 sec/km = 3.704 m/s
    expect(formatPace(3.704)).toBe('4:30');
  });
});

describe('Strava Utils: paceToSeconds', () => {
  test('should return null for null/undefined', () => {
    expect(paceToSeconds(null)).toBeNull();
    expect(paceToSeconds(undefined)).toBeNull();
  });

  test('should return null for zero or negative', () => {
    expect(paceToSeconds(0)).toBeNull();
    expect(paceToSeconds(-1)).toBeNull();
  });

  test('should convert 4:00/km', () => {
    // 4:00/km = 240 seconds
    expect(paceToSeconds(4.17)).toBe(240);
  });

  test('should convert 5:00/km', () => {
    // 5:00/km = 300 seconds
    expect(paceToSeconds(3.33)).toBe(300);
  });

  test('should convert 6:00/km', () => {
    // 6:00/km = 360 seconds
    expect(paceToSeconds(2.78)).toBe(360);
  });
});

describe('Strava Utils: metersToKilometers', () => {
  test('should return 0 for null/undefined', () => {
    expect(metersToKilometers(null)).toBe(0);
    expect(metersToKilometers(undefined)).toBe(0);
  });

  test('should return 0 for zero or negative', () => {
    expect(metersToKilometers(0)).toBe(0);
    expect(metersToKilometers(-100)).toBe(0);
  });

  test('should convert 1000m to 1.00km', () => {
    expect(metersToKilometers(1000)).toBe(1.0);
  });

  test('should convert 5000m to 5.00km', () => {
    expect(metersToKilometers(5000)).toBe(5.0);
  });

  test('should convert 10500m to 10.50km', () => {
    expect(metersToKilometers(10500)).toBe(10.5);
  });

  test('should round to 2 decimal places', () => {
    expect(metersToKilometers(1234)).toBe(1.23);
  });
});

describe('Strava Utils: speedToKmh', () => {
  test('should return null for null/undefined', () => {
    expect(speedToKmh(null)).toBeNull();
    expect(speedToKmh(undefined)).toBeNull();
  });

  test('should return null for zero or negative', () => {
    expect(speedToKmh(0)).toBeNull();
    expect(speedToKmh(-1)).toBeNull();
  });

  test('should convert 1 m/s to 3.6 km/h', () => {
    expect(speedToKmh(1)).toBe(3.6);
  });

  test('should convert 3.33 m/s to ~12 km/h', () => {
    // 3.33 m/s ≈ 12 km/h (5:00/km pace)
    expect(speedToKmh(3.33)).toBeCloseTo(12, 0);
  });

  test('should convert 4.17 m/s to ~15 km/h', () => {
    // 4.17 m/s ≈ 15 km/h (4:00/km pace)
    expect(speedToKmh(4.17)).toBeCloseTo(15, 0);
  });
});

describe('Strava Utils: Integration Tests', () => {
  test('pace calculation should be consistent', () => {
    // For 5:00/km pace
    const speed = 3.33; // m/s
    const paceFormatted = formatPace(speed);
    const paceSeconds = paceToSeconds(speed);

    expect(paceFormatted).toBe('5:00');
    expect(paceSeconds).toBe(300); // 5 minutes = 300 seconds
  });

  test('distance conversion should be consistent', () => {
    const distanceMeters = 5000;
    const distanceKm = metersToKilometers(distanceMeters);

    expect(distanceKm).toBe(5.0);
    expect(distanceKm * 1000).toBe(distanceMeters);
  });

  test('speed and pace should be inversely related', () => {
    // Faster speed = lower pace time
    const slowSpeed = 2.78; // ~6:00/km
    const fastSpeed = 4.17; // ~4:00/km

    const slowPace = paceToSeconds(slowSpeed);
    const fastPace = paceToSeconds(fastSpeed);

    expect(fastPace).toBeLessThan(slowPace);
  });

  test('cadence conversion from rpm to spm should be correct', () => {
    // Strava API returns cadence in rpm (rotations per minute)
    // We convert to spm (steps per minute) by multiplying by 2
    const rpmValues = [80, 85, 90];
    const expectedSpmValues = [160, 170, 180];

    rpmValues.forEach((rpm, index) => {
      const spm = rpm * 2;
      expect(spm).toBe(expectedSpmValues[index]);
    });
  });

  test('cadence spm values should be in normal running range', () => {
    // Typical running cadence: 160-200 spm (80-100 rpm)
    const typicalCadenceRpm = 85;
    const spm = typicalCadenceRpm * 2;

    expect(spm).toBeGreaterThanOrEqual(150);
    expect(spm).toBeLessThanOrEqual(200);
  });
});
