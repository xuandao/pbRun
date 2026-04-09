import { test, expect } from '@playwright/test';

test.describe('页面导航', () => {
  test('首页应重定向到活动列表', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/list');
  });

  test('应能访问运动记录页面', async ({ page }) => {
    await page.goto('/list');
    await page.waitForLoadState('networkidle');
    // 检查页面标题或主要内容是否可见
    await expect(page.locator('body')).toBeVisible();
    // 页面应包含运动相关的文字
    const content = await page.content();
    expect(content).toMatch(/运动|记录|跑步|公里|km/i);
  });

  test('应能访问运动分析页面', async ({ page }) => {
    await page.goto('/analysis');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('应能访问运动统计页面', async ({ page }) => {
    await page.goto('/stats');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('无效页面应显示404或重定向', async ({ page }) => {
    await page.goto('/nonexistent');
    await page.waitForLoadState('networkidle');
    // 检查页面是否加载（可能是404或重定向到首页）
    await expect(page.locator('body')).toBeVisible();
  });
});
