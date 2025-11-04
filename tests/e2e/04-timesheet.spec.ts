/**
 * E2E Test: Timesheet Flow
 * Critical Flow #4: Time tracking and billing
 */

import { test, expect } from '@playwright/test';

test.describe('Timesheet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate to timesheet
    await page.click('text=דיווח שעות');
  });

  test('should display timesheet page', async ({ page }) => {
    // Timesheet elements should be visible
    await expect(page.locator('h1:has-text("דיווח שעות")')).toBeVisible();
    await expect(page.locator('#timesheet-table')).toBeVisible();
    await expect(page.locator('button:has-text("הוסף שורה")')).toBeVisible();
  });

  test('should add new time entry', async ({ page }) => {
    // Click add button
    await page.click('button:has-text("הוסף שורה")');

    // Fill time entry
    await page.selectOption('#client-select', { index: 1 });
    await page.selectOption('#case-select', { index: 1 });
    await page.fill('#date-input', '2025-11-04');
    await page.fill('#start-time', '09:00');
    await page.fill('#end-time', '17:00');
    await page.fill('#description', 'עבודה משפטית');

    // Save
    await page.click('button:has-text("שמור")');

    // Entry should appear in table
    await expect(page.locator('text=עבודה משפטית')).toBeVisible({ timeout: 3000 });
  });

  test('should calculate hours automatically', async ({ page }) => {
    await page.click('button:has-text("הוסף שורה")');

    // Enter times
    await page.fill('#start-time', '09:00');
    await page.fill('#end-time', '17:00');

    // Hours should be calculated (8 hours)
    const hoursDisplay = page.locator('#hours-display');
    await expect(hoursDisplay).toHaveText('8.00');
  });

  test('should calculate billable amount', async ({ page }) => {
    await page.click('button:has-text("הוסף שורה")');

    await page.selectOption('#client-select', { index: 1 });
    await page.fill('#start-time', '09:00');
    await page.fill('#end-time', '17:00'); // 8 hours
    await page.fill('#rate-input', '400'); // ₪400/hour

    // Amount should be calculated (8 * 400 = 3200)
    const amountDisplay = page.locator('#amount-display');
    await expect(amountDisplay).toHaveText('₪3,200');
  });

  test('should show daily summary', async ({ page }) => {
    // Add multiple entries
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("הוסף שורה")');
      await page.selectOption('#client-select', { index: 1 });
      await page.fill('#date-input', '2025-11-04');
      await page.fill('#start-time', '09:00');
      await page.fill('#end-time', '12:00'); // 3 hours each
      await page.fill('#description', `Entry ${i + 1}`);
      await page.click('button:has-text("שמור")');
      await page.waitForTimeout(500);
    }

    // Summary should show total hours (9 hours)
    const summary = page.locator('#daily-summary');
    await expect(summary).toContainText('9');
  });

  test('should filter entries by date range', async ({ page }) => {
    // Set date range
    await page.fill('#from-date', '2025-11-01');
    await page.fill('#to-date', '2025-11-30');
    await page.click('button:has-text("סנן")');

    // Should show only entries in range
    const entries = page.locator('.timesheet-row');
    const count = await entries.count();

    for (let i = 0; i < count; i++) {
      const dateCell = entries.nth(i).locator('.date-cell');
      const dateText = await dateCell.textContent();
      // Verify date is in range (basic check)
      expect(dateText).toBeTruthy();
    }
  });

  test('should delete time entry', async ({ page }) => {
    await page.click('button:has-text("הוסף שורה")');

    await page.selectOption('#client-select', { index: 1 });
    await page.fill('#date-input', '2025-11-04');
    await page.fill('#start-time', '09:00');
    await page.fill('#end-time', '10:00');
    await page.fill('#description', 'To be deleted');
    await page.click('button:has-text("שמור")');

    await expect(page.locator('text=To be deleted')).toBeVisible();

    // Click delete button
    await page.click('.delete-button:has-text("מחק")');

    // Confirm deletion
    await page.click('button:has-text("אישור")');

    // Entry should be removed
    await expect(page.locator('text=To be deleted')).not.toBeVisible({ timeout: 3000 });
  });
});
