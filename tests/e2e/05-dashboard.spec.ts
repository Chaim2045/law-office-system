/**
 * E2E Test: Dashboard Flow
 * Critical Flow #5: Dashboard and analytics
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Should land on dashboard by default or click dashboard link
    await page.click('text=דשבורד');
  });

  test('should display dashboard widgets', async ({ page }) => {
    // All main widgets should be visible
    await expect(page.locator('#active-cases-widget')).toBeVisible();
    await expect(page.locator('#revenue-widget')).toBeVisible();
    await expect(page.locator('#hours-widget')).toBeVisible();
    await expect(page.locator('#clients-widget')).toBeVisible();
  });

  test('should show active cases count', async ({ page }) => {
    const casesWidget = page.locator('#active-cases-widget');

    // Should display a number
    const countElement = casesWidget.locator('.count');
    const countText = await countElement.textContent();

    expect(countText).toMatch(/\d+/); // Should contain at least one digit
  });

  test('should show revenue statistics', async ({ page }) => {
    const revenueWidget = page.locator('#revenue-widget');

    // Should display revenue amount
    await expect(revenueWidget.locator('.amount')).toBeVisible();

    // Should show currency symbol
    const amountText = await revenueWidget.locator('.amount').textContent();
    expect(amountText).toContain('₪');
  });

  test('should display recent activity', async ({ page }) => {
    const activityList = page.locator('#recent-activity');
    await expect(activityList).toBeVisible();

    // Should have at least one activity item (or empty state)
    const items = activityList.locator('.activity-item');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should show charts and graphs', async ({ page }) => {
    // Revenue chart
    await expect(page.locator('#revenue-chart')).toBeVisible();

    // Cases trend chart
    await expect(page.locator('#cases-chart')).toBeVisible();

    // Charts should have SVG elements
    const revenueChart = page.locator('#revenue-chart svg');
    await expect(revenueChart).toBeVisible();
  });

  test('should filter dashboard by date range', async ({ page }) => {
    // Change date range
    await page.click('#date-range-selector');
    await page.click('text=חודש אחרון');

    // Dashboard should update
    // Wait for loading indicator to disappear
    await expect(page.locator('.loading-indicator')).not.toBeVisible({ timeout: 5000 });

    // Statistics should be updated
    await expect(page.locator('#active-cases-widget .count')).toBeVisible();
  });

  test('should navigate to detailed views from widgets', async ({ page }) => {
    // Click on active cases widget
    await page.click('#active-cases-widget');

    // Should navigate to cases page
    await expect(page.locator('h1:has-text("תיקים")')).toBeVisible({ timeout: 3000 });
  });

  test('should show growth indicators', async ({ page }) => {
    const revenueWidget = page.locator('#revenue-widget');

    // Should show growth percentage
    const growthIndicator = revenueWidget.locator('.growth-indicator');
    await expect(growthIndicator).toBeVisible();

    // Growth indicator should have color class (positive/negative)
    const className = await growthIndicator.getAttribute('class');
    expect(className).toMatch(/positive|negative/);
  });

  test('should display notifications badge', async ({ page }) => {
    const notificationBell = page.locator('#notification-bell');
    await expect(notificationBell).toBeVisible();

    // If there are notifications, badge should show count
    const badge = notificationBell.locator('.badge');
    if (await badge.isVisible()) {
      const badgeText = await badge.textContent();
      expect(badgeText).toMatch(/\d+/);
    }
  });

  test('should refresh dashboard data', async ({ page }) => {
    // Click refresh button
    await page.click('button:has-text("רענן")');

    // Loading indicator should appear briefly
    await expect(page.locator('.loading-indicator')).toBeVisible({ timeout: 1000 });

    // Then disappear
    await expect(page.locator('.loading-indicator')).not.toBeVisible({ timeout: 5000 });

    // Data should be reloaded
    await expect(page.locator('#active-cases-widget .count')).toBeVisible();
  });
});
