/**
 * E2E Test: Authentication Flow
 * Critical Flow #1: User login and logout
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should load login page', async ({ page }) => {
    await page.goto('/');

    // Check that login elements are visible
    await expect(page.locator('#email-input')).toBeVisible();
    await expect(page.locator('#password-input')).toBeVisible();
    await expect(page.locator('button:has-text("התחבר")')).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/');

    // Try to login with invalid credentials
    await page.fill('#email-input', 'invalid@example.com');
    await page.fill('#password-input', 'wrongpassword');
    await page.click('button:has-text("התחבר")');

    // Wait for error message
    await expect(page.locator('.error-message')).toBeVisible({ timeout: 5000 });
  });

  test('should remember email if checkbox is checked', async ({ page }) => {
    await page.goto('/');

    const testEmail = 'test@example.com';

    // Fill email and check "remember me"
    await page.fill('#email-input', testEmail);
    await page.check('#remember-checkbox');

    // Reload page
    await page.reload();

    // Email should be remembered
    const emailValue = await page.inputValue('#email-input');
    expect(emailValue).toBe(testEmail);
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/');

    // Try invalid email formats
    await page.fill('#email-input', 'invalid-email');
    await page.fill('#password-input', 'password123');
    await page.click('button:has-text("התחבר")');

    // Should show validation error
    const emailInput = page.locator('#email-input');
    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage
    );
    expect(validationMessage).toBeTruthy();
  });

  test('should disable login button while processing', async ({ page }) => {
    await page.goto('/');

    await page.fill('#email-input', 'test@example.com');
    await page.fill('#password-input', 'password123');

    const loginButton = page.locator('button:has-text("התחבר")');

    await loginButton.click();

    // Button should be disabled immediately
    await expect(loginButton).toBeDisabled();
  });
});
