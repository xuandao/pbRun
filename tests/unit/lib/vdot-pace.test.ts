import {
  vdotToPaceSecPerKm,
  getPaceZoneBoundsFromVdot,
  getPaceZoneCenterFromVdot,
} from '@/app/lib/vdot-pace';

describe('vdot-pace', () => {
  describe('vdotToPaceSecPerKm', () => {
    test('应正确计算VDOT为50、Z3强度(80% VO2max)的配速', () => {
      const pace = vdotToPaceSecPerKm(50, 0.8);
      expect(pace).toBeGreaterThan(0);
      expect(pace).toBeLessThan(9999);
      // Z3配速应该比较舒适，大约4:00-5:00/km
      expect(pace).toBeGreaterThan(240);
      expect(pace).toBeLessThan(400);
    });

    test('VDOT为0时应返回9999(无效值)', () => {
      expect(vdotToPaceSecPerKm(0, 0.8)).toBe(9999);
    });

    test('负值VDOT应返回9999', () => {
      expect(vdotToPaceSecPerKm(-10, 0.8)).toBe(9999);
    });

    test('无效百分比(<=0)应返回9999', () => {
      expect(vdotToPaceSecPerKm(50, 0)).toBe(9999);
      expect(vdotToPaceSecPerKm(50, -0.1)).toBe(9999);
    });

    test('百分比>1应返回9999', () => {
      expect(vdotToPaceSecPerKm(50, 1.1)).toBe(9999);
    });

    test('不同VDOT值的配速应合理递减', () => {
      const pace30 = vdotToPaceSecPerKm(30, 0.8);
      const pace50 = vdotToPaceSecPerKm(50, 0.8);
      const pace70 = vdotToPaceSecPerKm(70, 0.8);

      // VDOT越高，配速越快(值越小)
      expect(pace70).toBeLessThan(pace50);
      expect(pace50).toBeLessThan(pace30);
    });

    test('不同区间百分比的配速应合理分布', () => {
      const vdot = 50;
      const paceZ1 = vdotToPaceSecPerKm(vdot, 0.65); // 最慢
      const paceZ5 = vdotToPaceSecPerKm(vdot, 0.98); // 最快

      expect(paceZ5).toBeLessThan(paceZ1);
    });
  });

  describe('getPaceZoneBoundsFromVdot', () => {
    test('应返回5个区间的边界值', () => {
      const bounds = getPaceZoneBoundsFromVdot(50);
      expect(Object.keys(bounds)).toHaveLength(5);
      expect(bounds[1]).toHaveProperty('paceMin');
      expect(bounds[1]).toHaveProperty('paceMax');
    });

    test('VDOT为0时应返回空对象', () => {
      const bounds = getPaceZoneBoundsFromVdot(0);
      expect(bounds).toEqual({});
    });

    test('负值VDOT应返回空对象', () => {
      const bounds = getPaceZoneBoundsFromVdot(-10);
      expect(bounds).toEqual({});
    });

    test('Z1区间应无上限(9999)', () => {
      const bounds = getPaceZoneBoundsFromVdot(50);
      expect(bounds[1].paceMax).toBe(9999);
    });

    test('Z5区间应从0开始', () => {
      const bounds = getPaceZoneBoundsFromVdot(50);
      expect(bounds[5].paceMin).toBe(0);
    });

    test('区间边界应连续(相邻区间边界相等)', () => {
      const bounds = getPaceZoneBoundsFromVdot(50);
      // Z1的下限应该等于Z2的上限
      expect(bounds[1].paceMin).toBe(bounds[2].paceMax);
      expect(bounds[2].paceMin).toBe(bounds[3].paceMax);
      expect(bounds[3].paceMin).toBe(bounds[4].paceMax);
      expect(bounds[4].paceMin).toBe(bounds[5].paceMax);
    });

    test('配速应随VDOT增加而变快', () => {
      const bounds30 = getPaceZoneBoundsFromVdot(30);
      const bounds50 = getPaceZoneBoundsFromVdot(50);

      // VDOT 50的Z1上限应该比VDOT 30的Z1上限快
      expect(bounds50[1].paceMin).toBeLessThan(bounds30[1].paceMin);
    });
  });

  describe('getPaceZoneCenterFromVdot', () => {
    test('应返回5个区间的中心配速', () => {
      const centers = getPaceZoneCenterFromVdot(50);
      expect(Object.keys(centers)).toHaveLength(5);
      expect(centers[1]).toBeGreaterThan(0);
      expect(centers[5]).toBeGreaterThan(0);
    });

    test('Z1应该最慢，Z5应该最快', () => {
      const centers = getPaceZoneCenterFromVdot(50);
      expect(centers[1]).toBeGreaterThan(centers[2]);
      expect(centers[2]).toBeGreaterThan(centers[3]);
      expect(centers[3]).toBeGreaterThan(centers[4]);
      expect(centers[4]).toBeGreaterThan(centers[5]);
    });

    test('VDOT为0时应返回包含9999值的对象', () => {
      const centers = getPaceZoneCenterFromVdot(0);
      // 当VDOT为0时，vdotToPaceSecPerKm返回9999，所以每个区间都是9999
      expect(centers[1]).toBe(9999);
      expect(centers[5]).toBe(9999);
    });

    test('不同VDOT的中心配速应有差异', () => {
      const centers30 = getPaceZoneCenterFromVdot(30);
      const centers50 = getPaceZoneCenterFromVdot(50);
      const centers70 = getPaceZoneCenterFromVdot(70);

      // 相同区间，VDOT越高配速越快
      expect(centers70[3]).toBeLessThan(centers50[3]);
      expect(centers50[3]).toBeLessThan(centers30[3]);
    });
  });
});
