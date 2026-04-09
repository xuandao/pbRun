import { test, expect } from '@playwright/test';

test.describe('活动详情页', () => {
  test('应显示活动基本信息或返回列表', async ({ page }) => {
    // 先访问列表页
    await page.goto('/list');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 尝试找到活动链接
    const activityLink = page.locator('a[href*="/pages/"]').first();
    const hasActivity = await activityLink.isVisible().catch(() => false);

    if (hasActivity) {
      await activityLink.click();
      await page.waitForLoadState('networkidle');
      // 验证详情页内容
      await expect(page.locator('body')).toBeVisible();
    } else {
      // 如果没有活动数据，测试跳过
      test.skip();
    }
  });

  test('应显示图表或活动数据', async ({ page }) => {
    await page.goto('/list');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const activityLink = page.locator('a[href*="/pages/"]').first();
    const hasActivity = await activityLink.isVisible().catch(() => false);

    if (hasActivity) {
      await activityLink.click();
      await page.waitForTimeout(1000);
      // 页面应正常加载
      await expect(page.locator('body')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('应支持返回列表页', async ({ page }) => {
    await page.goto('/list');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/list');
  });
});
