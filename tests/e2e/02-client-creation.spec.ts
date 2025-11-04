/**
 * E2E Test: Client Creation Flow
 * Critical Flow #2: Creating a new client
 */

import { test, expect } from '@playwright/test';

test.describe('Client Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Assume we're logged in (mock authentication or use test account)
    await page.goto('/');
    // Add authentication bypass for testing if needed
  });

  test('should open new client dialog', async ({ page }) => {
    // Click "New Client" button
    await page.click('button:has-text("לקוח חדש")');

    // Dialog should be visible
    await expect(page.locator('#client-dialog')).toBeVisible();
    await expect(page.locator('h2:has-text("הוספת לקוח חדש")')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.click('button:has-text("לקוח חדש")');

    // Try to submit without filling required fields
    await page.click('button:has-text("שמור")');

    // Should show validation errors
    await expect(page.locator('.validation-error')).toHaveCount(4); // name, id, phone, email
  });

  test('should create client with valid data', async ({ page }) => {
    await page.click('button:has-text("לקוח חדש")');

    // Fill all required fields
    await page.fill('#client-name', 'משה כהן');
    await page.fill('#client-id', '123456789');
    await page.fill('#client-phone', '050-1234567');
    await page.fill('#client-email', 'moshe@example.com');

    // Submit
    await page.click('button:has-text("שמור")');

    // Should show success message
    await expect(page.locator('.success-message')).toBeVisible({ timeout: 5000 });

    // Client should appear in list
    await expect(page.locator('text=משה כהן')).toBeVisible({ timeout: 3000 });
  });

  test('should prevent duplicate client IDs', async ({ page }) => {
    // Create first client
    await page.click('button:has-text("לקוח חדש")');
    await page.fill('#client-name', 'לקוח ראשון');
    await page.fill('#client-id', '111111111');
    await page.fill('#client-phone', '050-1111111');
    await page.fill('#client-email', 'first@example.com');
    await page.click('button:has-text("שמור")');

    await expect(page.locator('.success-message')).toBeVisible({ timeout: 5000 });

    // Try to create second client with same ID
    await page.click('button:has-text("לקוח חדש")');
    await page.fill('#client-name', 'לקוח שני');
    await page.fill('#client-id', '111111111'); // Same ID!
    await page.fill('#client-phone', '050-2222222');
    await page.fill('#client-email', 'second@example.com');
    await page.click('button:has-text("שמור")');

    // Should show error about duplicate ID
    await expect(page.locator('.error-message:has-text("קיים")')).toBeVisible();
  });

  test('should close dialog on cancel', async ({ page }) => {
    await page.click('button:has-text("לקוח חדש")');

    const dialog = page.locator('#client-dialog');
    await expect(dialog).toBeVisible();

    await page.click('button:has-text("ביטול")');

    // Dialog should be closed
    await expect(dialog).not.toBeVisible();
  });
});
