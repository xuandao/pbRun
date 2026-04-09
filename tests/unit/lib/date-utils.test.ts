import {
  getDateRangeFromDays,
  parseTimeRangeDays,
  monthToRange,
  TimeRangeDays,
} from '@/app/lib/date-utils';

describe('date-utils', () => {
  describe('getDateRangeFromDays', () => {
    beforeEach(() => {
      // Mock Date to have consistent tests
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-03-15').getTime());
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('应正确计算30天前的日期范围', () => {
      const result = getDateRangeFromDays(30);
      expect(result).toEqual({
        startDate: '2024-02-14',
        endDate: '2024-03-15',
      });
    });

    test('应正确计算90天前的日期范围', () => {
      const result = getDateRangeFromDays(90);
      expect(result).toEqual({
        startDate: '2023-12-16',
        endDate: '2024-03-15',
      });
    });

    test('应正确计算180天前的日期范围', () => {
      const result = getDateRangeFromDays(180);
      expect(result).toEqual({
        startDate: '2023-09-17',
        endDate: '2024-03-15',
      });
    });
  });

  describe('parseTimeRangeDays', () => {
    test('应正确解析有效的天数参数', () => {
      expect(parseTimeRangeDays('30')).toBe(30);
      expect(parseTimeRangeDays('90')).toBe(90);
      expect(parseTimeRangeDays('180')).toBe(180);
    });

    test('无效参数应返回默认值30', () => {
      expect(parseTimeRangeDays('60')).toBe(30);
      expect(parseTimeRangeDays('abc')).toBe(30);
      expect(parseTimeRangeDays('')).toBe(30);
      expect(parseTimeRangeDays(null)).toBe(30);
    });

    test('边界值测试', () => {
      expect(parseTimeRangeDays('29')).toBe(30);
      expect(parseTimeRangeDays('31')).toBe(30);
      expect(parseTimeRangeDays('179')).toBe(30);
      expect(parseTimeRangeDays('181')).toBe(30);
    });
  });

  describe('monthToRange', () => {
    test('应正确转换普通月份到日期范围', () => {
      const result = monthToRange('2024-03');
      expect(result).toEqual({
        startDate: '2024-03-01',
        endDate: '2024-03-31',
      });
    });

    test('应正确处理月份前导零', () => {
      const result = monthToRange('2024-01');
      expect(result).toEqual({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });
    });

    test('应正确处理闰年2月', () => {
      const result = monthToRange('2024-02');
      expect(result).toEqual({
        startDate: '2024-02-01',
        endDate: '2024-02-29',
      });
    });

    test('应正确处理非闰年2月', () => {
      const result = monthToRange('2023-02');
      expect(result).toEqual({
        startDate: '2023-02-01',
        endDate: '2023-02-28',
      });
    });

    test('应正确处理小月', () => {
      const result = monthToRange('2024-04');
      expect(result).toEqual({
        startDate: '2024-04-01',
        endDate: '2024-04-30',
      });
    });

    test('应正确处理大月', () => {
      const result = monthToRange('2024-12');
      expect(result).toEqual({
        startDate: '2024-12-01',
        endDate: '2024-12-31',
      });
    });
  });
});
