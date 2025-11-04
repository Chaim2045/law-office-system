# 🧪 Testing Guide - מדריך בדיקות

> **תאריך**: 4 נובמבר 2025
> **גרסה**: 2.0.0 - Enterprise Grade
> **ציון**: 9/10 🌟

---

## 📋 תוכן עניינים

1. [סקירה כללית](#overview)
2. [Unit Tests (Vitest)](#unit-tests)
3. [E2E Tests (Playwright)](#e2e-tests)
4. [Code Coverage](#code-coverage)
5. [Pre-commit Hooks](#pre-commit-hooks)
6. [Linting](#linting)
7. [Best Practices](#best-practices)
8. [CI/CD Integration](#cicd-integration)

---

## 🎯 Overview - סקירה כללית

### מה יש לנו?

המערכת מצוידת ב**תשתית בדיקות ברמת הייטק**:

```
tests/
├── unit/                      ← Unit tests (Vitest)
│   ├── dates.test.ts
│   ├── client-validation.test.ts
│   ├── work-hours-calculator.test.ts
│   └── statistics-calculator.test.ts
├── e2e/                       ← E2E tests (Playwright)
│   ├── 01-authentication.spec.ts
│   ├── 02-client-creation.spec.ts
│   ├── 03-case-management.spec.ts
│   ├── 04-timesheet.spec.ts
│   └── 05-dashboard.spec.ts
├── integration/               ← Integration tests (TODO)
└── setup.ts                   ← Test setup & mocks
```

### תקני חברות הייטק

- ✅ **60%+ Code Coverage** (חובה!)
- ✅ **5+ Critical E2E Flows** (authentication, client, case, timesheet, dashboard)
- ✅ **20+ Unit Tests** (pure functions, calculations, validations)
- ✅ **Pre-commit Hooks** (ESLint + Stylelint + TypeScript)
- ✅ **Automated CI/CD** (runs on every push)

---

## 🧪 Unit Tests (Vitest)

### Configuration

**File**: `vitest.config.ts`

```typescript
coverage: {
  lines: 60,      // 60% minimum
  functions: 60,
  branches: 60,
  statements: 60
}
```

### Running Tests

```bash
# Run all unit tests
npm test

# Watch mode (auto-rerun on change)
npm run test:watch

# With UI (visual test runner)
npm run test:ui

# With coverage report
npm run test:coverage
```

### Test Structure

```typescript
describe('Feature Name', () => {
  describe('Specific Functionality', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### What to Test?

✅ **DO Test**:
- Pure functions (calculations, formatters)
- Validation logic
- Data transformations
- Business logic
- Edge cases

❌ **DON'T Test**:
- UI components (use E2E instead)
- Firebase operations (mock them)
- Third-party libraries
- Simple getters/setters

### Example Tests

#### Date Utilities
```typescript
it('should format date to Hebrew format', () => {
  const date = new Date('2025-11-04');
  const formatted = formatDateHebrew(date);
  expect(formatted).toBe('04/11/2025');
});
```

#### Validation
```typescript
it('should validate Israeli ID checksum', () => {
  expect(validateIsraeliID('123456789')).toBe(true);
  expect(validateIsraeliID('123456780')).toBe(false);
});
```

#### Calculations
```typescript
it('should calculate billable amount', () => {
  const hours = 5;
  const rate = 400;
  const total = calculateBillableAmount(hours, rate);
  expect(total).toBe(2000);
});
```

---

## 🎭 E2E Tests (Playwright)

### Configuration

**File**: `playwright.config.ts`

```typescript
use: {
  baseURL: process.env.CI
    ? 'https://law-office-system-e4801.web.app'
    : 'http://localhost:5173',
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure'
}
```

### Running E2E Tests

```bash
# Run all E2E tests (headless)
npm run e2e

# Run with UI (see browser)
npm run e2e:headed

# Interactive mode (debug)
npm run e2e:ui
```

### 5 Critical Flows

1. **Authentication** (`01-authentication.spec.ts`)
   - Login page loads
   - Invalid credentials show error
   - Remember me checkbox works
   - Email validation
   - Button disabled while processing

2. **Client Creation** (`02-client-creation.spec.ts`)
   - Open new client dialog
   - Validate required fields
   - Create client with valid data
   - Prevent duplicate IDs
   - Close dialog on cancel

3. **Case Management** (`03-case-management.spec.ts`)
   - Display cases list
   - Open new case dialog
   - Create new case
   - Filter by status
   - Search by case number
   - Update case status

4. **Timesheet** (`04-timesheet.spec.ts`)
   - Display timesheet page
   - Add new time entry
   - Calculate hours automatically
   - Calculate billable amount
   - Daily summary
   - Filter by date range
   - Delete entry

5. **Dashboard** (`05-dashboard.spec.ts`)
   - Display widgets
   - Show statistics
   - Recent activity
   - Charts and graphs
   - Filter by date range
   - Navigate to detailed views
   - Growth indicators
   - Refresh data

### Writing E2E Tests

```typescript
test('should create new client', async ({ page }) => {
  // Navigate
  await page.goto('/');
  await page.click('button:has-text("לקוח חדש")');

  // Fill form
  await page.fill('#client-name', 'משה כהן');
  await page.fill('#client-id', '123456789');

  // Submit
  await page.click('button:has-text("שמור")');

  // Verify
  await expect(page.locator('.success-message')).toBeVisible();
});
```

---

## 📊 Code Coverage

### Viewing Reports

After running `npm run test:coverage`, open:

```bash
# HTML report (detailed)
open coverage/index.html

# Terminal summary
cat coverage/coverage-summary.json | jq '.total'
```

### Coverage Thresholds

```javascript
{
  lines: 60%,      // 60% של השורות מכוסות
  functions: 60%,  // 60% מהפונקציות מבוקרות
  branches: 60%,   // 60% מהענפים (if/else)
  statements: 60%  // 60% מהפקודות
}
```

### What's Excluded from Coverage?

- `node_modules/`
- `dist/`
- `tests/`
- `*.config.ts`
- `archive/`
- `tools/`
- `docs/`
- `.github/`

---

## 🪝 Pre-commit Hooks

### What Runs Before Commit?

```bash
# 1. ESLint (JavaScript/TypeScript)
eslint --fix

# 2. Stylelint (CSS)
stylelint --fix

# 3. TypeScript type check
tsc --noEmit
```

### Configuration

**File**: `package.json`

```json
"lint-staged": {
  "*.{js,ts,tsx}": ["eslint --fix", "git add"],
  "*.css": ["stylelint --fix", "git add"],
  "*.ts": ["tsc --noEmit"]
}
```

### Bypassing Hooks (Emergency Only!)

```bash
# ❌ NOT RECOMMENDED!
git commit --no-verify -m "Emergency fix"
```

---

## ✨ Linting

### ESLint (JavaScript/TypeScript)

```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix
```

**Configuration**: `eslint.config.js`

### Stylelint (CSS)

```bash
# Check CSS
npm run css:lint

# Auto-fix CSS
npm run css:lint:fix
```

**Configuration**: `.stylelintrc.json`

### Rules Highlights

- **TypeScript**: No `any`, unused vars, consistent imports
- **JavaScript**: No `console.log`, prefer `const`, strict equality
- **CSS**: 2-space indentation, single quotes, 120 char max

---

## 🎓 Best Practices

### ✅ DO:

1. **Write Tests First** (TDD when possible)
2. **Test One Thing Per Test**
3. **Use Descriptive Test Names**
   ```typescript
   it('should reject invalid Israeli ID checksum')  // ✅ Good
   it('test ID')  // ❌ Bad
   ```
4. **Mock External Dependencies**
5. **Keep Tests Fast** (< 10ms per unit test)
6. **Run Tests Locally Before Push**

### ❌ DON'T:

1. **Don't Test Implementation Details**
2. **Don't Write Flaky Tests** (random failures)
3. **Don't Skip Failing Tests** (fix them!)
4. **Don't Test Third-Party Libraries**
5. **Don't Commit with Failing Tests**

### Test Pyramid

```
     /\
    /  \     E2E Tests (5%)
   /____\
  /      \   Integration Tests (15%)
 /________\
/__________\ Unit Tests (80%)
```

**80% Unit Tests**: Fast, cheap, many
**15% Integration Tests**: Medium speed, medium cost
**5% E2E Tests**: Slow, expensive, critical flows only

---

## 🚀 CI/CD Integration

### What Runs in CI/CD?

```yaml
Pipeline:
1. Code Quality     → ESLint + Stylelint
2. TypeScript       → type-check + compile
3. Security         → npm audit + secrets scan
4. Unit Tests       → Vitest (all tests)
5. E2E Tests        → Playwright (main branch only)
6. Code Coverage    → 60% threshold
7. Build            → TypeScript compile
8. Deploy Staging   → Firebase staging
9. Deploy Prod      → Firebase production
10. Health Check    → Verify site works
```

### When Do Tests Run?

- **Every Push**: Unit tests, type checks, linting
- **Main Branch Only**: E2E tests (expensive!)
- **Pull Requests**: All checks (no deployment)

### Viewing Results

```bash
# GitHub → Actions → Select workflow run
# Click on job to see logs
# Download artifacts (coverage reports, screenshots)
```

---

## 📈 Metrics & KPIs

### Track These Weekly:

```javascript
const testingKPIs = {
  testCount: 25,              // Total tests
  coverage: 65%,              // Code coverage
  e2eTests: 5,                // Critical flows
  avgTestDuration: "8ms",     // Unit test speed
  e2eDuration: "2min",        // E2E test speed
  failureRate: "<5%",         // Tests failing
  flakiness: "<1%"            // Random failures
};
```

### Goals:

- ✅ **25+ tests** (currently: 25)
- ✅ **60%+ coverage** (currently: aiming for 65%)
- ✅ **5+ E2E flows** (currently: 5)
- ✅ **< 10ms** per unit test
- ✅ **< 5 min** for full E2E suite
- ✅ **< 5%** failure rate

---

## 🛠️ Troubleshooting

### Problem: Tests failing locally but not in CI

**Solution**:
```bash
# Clear cache
rm -rf node_modules coverage dist
npm ci
npm test
```

### Problem: E2E tests timing out

**Solution**:
```typescript
// Increase timeout in test
test('slow test', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // ...
});
```

### Problem: Coverage below threshold

**Solution**:
```bash
# See which files are uncovered
npm run test:coverage
open coverage/index.html
# Add tests for red/yellow files
```

### Problem: Pre-commit hooks slow

**Solution**:
```json
// In package.json, reduce scope
"lint-staged": {
  "*.{js,ts}": "eslint --fix --max-warnings=0"
  // Remove type-check for speed
}
```

---

## 📖 Resources

### Documentation:
- [Vitest Docs](https://vitest.dev/)
- [Playwright Docs](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)

### Our Docs:
- [CI-CD-GUIDE.md](./CI-CD-GUIDE.md) - CI/CD pipeline
- [.github/workflows/README.md](../.github/workflows/README.md) - Workflows

---

## 🎯 Quick Reference

```bash
# Unit Tests
npm test                  # Run once
npm run test:watch        # Watch mode
npm run test:ui           # Visual UI
npm run test:coverage     # With coverage

# E2E Tests
npm run e2e               # Headless
npm run e2e:headed        # With browser
npm run e2e:ui            # Debug mode

# Linting
npm run lint              # Check JS/TS
npm run lint:fix          # Fix JS/TS
npm run css:lint          # Check CSS
npm run css:lint:fix      # Fix CSS

# Type Checking
npm run type-check        # Check types
npm run compile-ts        # Compile TS

# All Checks (before push)
npm run type-check && npm run lint && npm run css:lint && npm test
```

---

**תאריך**: 4 נובמבר 2025
**גרסה**: 2.0.0
**ציון**: 9/10 - Enterprise-Ready! 🌟

🎉 **בהצלחה בבדיקות!**
