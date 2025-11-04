/**
 * E2E Test: Case Management Flow
 * Critical Flow #3: Creating and managing legal cases
 */

import { test, expect } from '@playwright/test';

test.describe('Case Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Assume authentication and client exists
  });

  test('should display cases list', async ({ page }) => {
    // Navigate to cases section
    await page.click('text=תיקים');

    // Cases list should be visible
    await expect(page.locator('#cases-list')).toBeVisible();
    await expect(page.locator('.case-card')).toHaveCount(0, { timeout: 0 }); // Or > 0 if cases exist
  });

  test('should open new case dialog', async ({ page }) => {
    await page.click('text=תיקים');
    await page.click('button:has-text("תיק חדש")');

    // Dialog should open
    await expect(page.locator('#case-dialog')).toBeVisible();
    await expect(page.locator('h2:has-text("יצירת תיק חדש")')).toBeVisible();
  });

  test('should create new case with required fields', async ({ page }) => {
    await page.click('text=תיקים');
    await page.click('button:has-text("תיק חדש")');

    // Fill case details
    await page.selectOption('#client-select', { index: 1 }); // Select first client
    await page.fill('#case-number', '12345');
    await page.fill('#case-title', 'תיק בדיקה');
    await page.selectOption('#case-type', 'אזרחי');
    await page.fill('#case-description', 'תיאור התיק');

    // Submit
    await page.click('button:has-text("צור תיק")');

    // Success message
    await expect(page.locator('.success-message')).toBeVisible({ timeout: 5000 });

    // Case should appear in list
    await expect(page.locator('text=תיק בדיקה')).toBeVisible({ timeout: 3000 });
  });

  test('should filter cases by status', async ({ page }) => {
    await page.click('text=תיקים');

    // Apply filter
    await page.selectOption('#status-filter', 'פעיל');

    // Only active cases should be visible
    const cases = page.locator('.case-card');
    const count = await cases.count();

    for (let i = 0; i < count; i++) {
      const statusBadge = cases.nth(i).locator('.status-badge');
      await expect(statusBadge).toHaveText('פעיל');
    }
  });

  test('should search cases by case number', async ({ page }) => {
    await page.click('text=תיקים');

    // Type in search box
    await page.fill('#case-search', '12345');

    // Should show only matching cases
    await expect(page.locator('.case-card:has-text("12345")')).toHaveCount(1, { timeout: 0 });
  });

  test('should update case status', async ({ page }) => {
    await page.click('text=תיקים');

    // Click on first case
    await page.click('.case-card:first-child');

    // Case details should open
    await expect(page.locator('#case-details')).toBeVisible();

    // Change status
    await page.selectOption('#status-select', 'סגור');
    await page.click('button:has-text("עדכן")');

    // Success message
    await expect(page.locator('.success-message')).toBeVisible();

    // Status should be updated
    await expect(page.locator('.status-badge')).toHaveText('סגור');
  });
});
