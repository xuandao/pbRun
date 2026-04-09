/**
 * Strava 子类型推断功能测试
 * 测试跑步机/路跑/越野/田径场等子类型的自动识别
 */

// 模拟 Python 子类型推断逻辑在 Node.js 中测试
function inferSubSportType(activity) {
  // Check for GPS data
  if (!activity.map || !activity.map.summary_polyline) {
    return '跑步机';
  }

  // Check activity name (case-insensitive)
  const name = activity.name.toLowerCase();

  if (name.includes('跑步机') || name.includes('treadmill')) {
    return '跑步机';
  }
  if (name.includes('越野') || name.includes('trail')) {
    return '越野';
  }
  if (name.includes('田径') || name.includes('track')) {
    return '田径场';
  }
  if (name.includes('室内') || name.includes('indoor')) {
    return '室内跑步';
  }

  // Default to outdoor road running
  return '路跑';
}

describe('Strava Sub-sport Inference: Treadmill Detection', () => {
  test('should detect treadmill by missing GPS', () => {
    const activity = {
      name: 'Morning Run',
      map: null,
    };
    expect(inferSubSportType(activity)).toBe('跑步机');
  });

  test('should detect treadmill by empty polyline', () => {
    const activity = {
      name: 'Morning Run',
      map: {
        summary_polyline: null,
      },
    };
    expect(inferSubSportType(activity)).toBe('跑步机');
  });

  test('should detect treadmill by name in English', () => {
    const activity = {
      name: 'Morning Treadmill Run',
      map: {
        summary_polyline: 'some_polyline',
      },
    };
    expect(inferSubSportType(activity)).toBe('跑步机');
  });

  test('should detect treadmill by name in Chinese', () => {
    const activity = {
      name: '跑步机 5公里',
      map: {
        summary_polyline: 'some_polyline',
      },
    };
    expect(inferSubSportType(activity)).toBe('跑步机');
  });

  test('should detect treadmill case insensitive', () => {
    const activity = {
      name: 'TREADMILL WORKOUT',
      map: {
        summary_polyline: 'some_polyline',
      },
    };
    expect(inferSubSportType(activity)).toBe('跑步机');
  });
});

describe('Strava Sub-sport Inference: Trail Detection', () => {
  test('should detect trail run by name in English', () => {
    const activity = {
      name: 'Trail Running in Mountains',
      map: {
        summary_polyline: 'some_polyline',
      },
    };
    expect(inferSubSportType(activity)).toBe('越野');
  });

  test('should detect trail run by name in Chinese', () => {
    const activity = {
      name: '周末越野跑',
      map: {
        summary_polyline: 'some_polyline',
      },
    };
    expect(inferSubSportType(activity)).toBe('越野');
  });

  test('should detect trail case insensitive', () => {
    const activity = {
      name: 'TRAIL RUN',
      map: {
        summary_polyline: 'some_polyline',
      },
    };
    expect(inferSubSportType(activity)).toBe('越野');
  });
});

describe('Strava Sub-sport Inference: Track Detection', () => {
  test('should detect track run by name in Chinese', () => {
    const activity = {
      name: '田径场训练',
      map: {
        summary_polyline: 'some_polyline',
      },
    };
    expect(inferSubSportType(activity)).toBe('田径场');
  });

  test('should detect track run by name in English', () => {
    const activity = {
      name: 'Track Workout',
      map: {
        summary_polyline: 'some_polyline',
      },
    };
    expect(inferSubSportType(activity)).toBe('田径场');
  });
});

describe('Strava Sub-sport Inference: Indoor Detection', () => {
  test('should detect indoor run by name in Chinese', () => {
    const activity = {
      name: '室内跑步',
      map: {
        summary_polyline: 'some_polyline',
      },
    };
    expect(inferSubSportType(activity)).toBe('室内跑步');
  });

  test('should detect indoor run by name in English', () => {
    const activity = {
      name: 'Indoor Running',
      map: {
        summary_polyline: 'some_polyline',
      },
    };
    expect(inferSubSportType(activity)).toBe('室内跑步');
  });
});

describe('Strava Sub-sport Inference: Road Run (Default)', () => {
  test('should default to road run for outdoor activities', () => {
    const activity = {
      name: 'Morning Run',
      map: {
        summary_polyline: 'some_polyline',
      },
    };
    expect(inferSubSportType(activity)).toBe('路跑');
  });

  test('should default to road run for generic names', () => {
    const activity = {
      name: 'Lunch Run',
      map: {
        summary_polyline: 'some_polyline',
      },
    };
    expect(inferSubSportType(activity)).toBe('路跑');
  });

  test('should default to road run for empty name', () => {
    const activity = {
      name: '',
      map: {
        summary_polyline: 'some_polyline',
      },
    };
    expect(inferSubSportType(activity)).toBe('路跑');
  });
});

describe('Strava Sub-sport Inference: Edge Cases', () => {
  test('should handle mixed language names', () => {
    const activity = {
      name: 'Morning 跑步机 workout',
      map: {
        summary_polyline: 'some_polyline',
      },
    };
    expect(inferSubSportType(activity)).toBe('跑步机');
  });

  test('should handle special characters in name', () => {
    const activity = {
      name: 'Trail-Run (Mountain)!',
      map: {
        summary_polyline: 'some_polyline',
      },
    };
    expect(inferSubSportType(activity)).toBe('越野');
  });

  test('should prioritize GPS check over name', () => {
    // Even with "trail" in name, if no GPS, it's treadmill
    const activity = {
      name: 'Trail Run on Treadmill',
      map: null,
    };
    expect(inferSubSportType(activity)).toBe('跑步机');
  });
});
