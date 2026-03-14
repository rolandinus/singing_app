import { expect, test } from '@playwright/test';

test('app shell loads and navigation works', async ({ page }) => {
  await page.goto('/singV3.html');

  await expect(page.locator('#dashboardScreen')).toHaveClass(/active/);
  await expect(page.locator('#dashboardSummary')).toBeVisible();

  await page.locator('#navPracticeBtn').click();
  await expect(page.locator('#practiceScreen')).toHaveClass(/active/);
  await expect(page.locator('#startCustomBtn')).toBeVisible();

  await page.locator('#navSettingsBtn').click();
  await expect(page.locator('#settingsScreen')).toHaveClass(/active/);
  await expect(page.locator('#saveSettingsBtn')).toBeVisible();
});
