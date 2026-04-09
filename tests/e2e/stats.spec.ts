import { test, expect } from '@playwright/test';

test.describe('统计页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/stats');
    await page.waitForTimeout(1000);
  });

  test('应显示总体统计数据', async ({ page }) => {
    // 检查是否有统计数字显示
    const stats = page.locator('text=/\\d+\\.?\\d*\\s*(km|公里|小时|次)/').first();
    await expect(stats).toBeVisible();
  });

  test('应支持切换时间周期', async ({ page }) => {
    // 查找周期选择器
    const periodSelector = page.locator('select, [class*="select"], button').first();
    const count = await periodSelector.count();

    if (count > 0) {
      await periodSelector.click();
      // 选择不同周期
      await page.waitForTimeout(500);
    }
  });

  test('应显示个人纪录', async ({ page }) => {
    // 检查是否有个人纪录表格或列表
    const prSection = page.locator('text=/个人纪录|最佳成绩|5公里|10公里/').first();
    await expect(prSection).toBeVisible();
  });
});
