import {
  getActivities,
  getActivityById,
  getActivityLaps,
  getStats,
  getPersonalRecords,
  getVDOTHistory,
} from '@/app/lib/db';

// Mock better-sqlite3
const mockGet = jest.fn();
const mockAll = jest.fn();
const mockPrepare = jest.fn(() => ({
  get: mockGet,
  all: mockAll,
}));
const mockClose = jest.fn();

jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    prepare: mockPrepare,
    close: mockClose,
  }));
});

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
}));

describe('Database Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue({ count: 100 });
    mockAll.mockReturnValue([]);
  });

  describe('getActivities', () => {
    test('应支持基本分页查询', () => {
      const mockActivities = [
        { activity_id: 1, name: 'Run 1', distance: 10 },
        { activity_id: 2, name: 'Run 2', distance: 15 },
      ];
      mockAll.mockReturnValue(mockActivities);

      const result = getActivities({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({ page: 1, limit: 20, total: 100 });
    });

    test('应支持类型过滤', () => {
      getActivities({ page: 1, limit: 20, type: 'running' });

      const calls = mockPrepare.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });

    test('应支持日期范围过滤', () => {
      getActivities({
        page: 1,
        limit: 20,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      const calls = mockPrepare.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });

    test('默认分页参数应为 page=1, limit=20', () => {
      mockAll.mockReturnValue([]);

      const result = getActivities({});

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });
  });

  describe('getActivityById', () => {
    test('应返回活动详情', () => {
      const mockActivity = {
        activity_id: 1,
        name: 'Morning Run',
        distance: 10,
      };
      mockGet.mockReturnValue(mockActivity);

      const result = getActivityById(1);

      expect(result).toEqual(mockActivity);
    });

    test('活动不存在时应返回 null', () => {
      mockGet.mockReturnValue(undefined);

      const result = getActivityById(999);

      expect(result).toBeNull();
    });
  });

  describe('getActivityLaps', () => {
    test('应返回分段数据', () => {
      const mockLaps = [
        { activity_id: 1, lap_index: 1, distance: 1000 },
        { activity_id: 1, lap_index: 2, distance: 1000 },
      ];
      mockAll.mockReturnValue(mockLaps);

      const result = getActivityLaps(1);

      expect(result).toHaveLength(2);
      expect(result[0].lap_index).toBe(1);
    });

    test('无分段时应返回空数组', () => {
      mockAll.mockReturnValue([]);

      const result = getActivityLaps(1);

      expect(result).toEqual([]);
    });
  });

  describe('getStats', () => {
    test('应返回总体统计', () => {
      mockGet.mockReturnValue({
        totalActivities: 100,
        totalDistance: 1000,
        totalDuration: 360000,
        averagePace: 360,
        averageHeartRate: 150,
      });

      const result = getStats('total');

      expect(result.totalActivities).toBe(100);
      expect(result.totalDistance).toBe(1000000); // 转换为米
    });

    test('应支持不同周期过滤', () => {
      mockGet.mockReturnValue({
        totalActivities: 10,
        totalDistance: 100,
        totalDuration: 36000,
      });

      getStats('week');
      getStats('month');
      getStats('year');

      expect(mockPrepare).toHaveBeenCalledTimes(3);
    });
  });

  describe('getPersonalRecords', () => {
    test('应返回6个距离的最佳成绩', () => {
      mockAll.mockReturnValue([]);

      const result = getPersonalRecords('total');

      expect(result.records).toHaveLength(6);
      expect(result.records[0].distanceLabel).toContain('1.6公里');
      expect(result.records[5].distanceLabel).toContain('全程马拉松');
    });

    test('应包含最长跑步数据', () => {
      mockAll.mockReturnValue([]);

      const result = getPersonalRecords('total');

      expect(result).toHaveProperty('longestRunMeters');
      expect(result).toHaveProperty('longestRunDate');
    });

    test('应支持不同周期', () => {
      mockAll.mockReturnValue([]);

      const weekResult = getPersonalRecords('week');
      const monthResult = getPersonalRecords('month');
      const yearResult = getPersonalRecords('year');

      expect(weekResult.period).toBe('week');
      expect(monthResult.period).toBe('month');
      expect(yearResult.period).toBe('year');
    });
  });

  describe('getVDOTHistory', () => {
    test('应返回VDOT历史数据', () => {
      const mockHistory = [
        { activity_id: 1, start_time: '2024-01-01', vdot_value: 45.5 },
        { activity_id: 2, start_time: '2024-01-02', vdot_value: 46.0 },
      ];
      mockAll.mockReturnValue(mockHistory);

      const result = getVDOTHistory(50);

      expect(result).toHaveLength(2);
      expect(result[0].vdot_value).toBe(45.5);
    });

    test('默认应返回50条记录', () => {
      mockAll.mockReturnValue([]);

      getVDOTHistory();

      const lastCall = mockAll.mock.calls[mockAll.mock.calls.length - 1];
      expect(lastCall).toContain(50);
    });
  });
});
