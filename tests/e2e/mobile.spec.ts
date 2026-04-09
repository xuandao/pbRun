import { test, expect } from '@playwright/test';

test.describe('移动端响应式', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('活动列表在移动端应正常显示', async ({ page }) => {
    await page.goto('/list');
    await page.waitForTimeout(1000);

    // 检查月份标题可见
    const monthTitles = page.locator('text=/\\d{4}年\\d{1,2}月/').first();
    await expect(monthTitles).toBeVisible();
  });

  test('导航栏在移动端应正常显示', async ({ page }) => {
    await page.goto('/list');

    // 检查导航项
    const navItems = page.locator('nav a, [class*="nav"] a').first();
    await expect(navItems).toBeVisible();
  });

  test('统计页面在移动端应正常显示', async ({ page }) => {
    await page.goto('/stats');
    await page.waitForTimeout(1000);

    // 检查统计内容
    const stats = page.locator('text=/\\d+/').first();
    await expect(stats).toBeVisible();
  });
});
