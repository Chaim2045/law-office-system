# Pull Request: [Feature/Fix Name]

## 📋 PR Type
<!-- Mark with 'x' -->
- [ ] 🚀 New Feature
- [ ] 🐛 Bug Fix
- [ ] 🔨 Refactoring
- [ ] 📝 Documentation
- [ ] 🎨 UI/UX
- [ ] ⚡ Performance
- [ ] 🧪 Tests
- [ ] 🔧 Chore/Config

---

## 📝 Description

### What does this PR do?
<!-- Clear, concise description of changes -->

### Why is this change needed?
<!-- Business/technical justification -->

### Related Issues
<!-- Link to Jira, GitHub issues, etc. -->
- Closes #
- Related to #

---

## 🎯 Changes Made

### Modified Files
<!-- List key files and what changed -->
- `file1.js` - [Description]
- `file2.js` - [Description]

### New Files
<!-- List new files created -->
- `new-file.js` - [Purpose]

### Deleted Files
<!-- List files removed -->
- `old-file.js` - [Reason]

---

## 🧪 Testing

### Test Coverage
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

### Test Results
<!-- Paste test results -->
```
Tests: X passed, Y total
Coverage: Z%
```

### Manual Testing Checklist
- [ ] Tested on Chrome
- [ ] Tested on Firefox
- [ ] Tested on Safari
- [ ] Tested on Mobile (iOS/Android)
- [ ] Tested RTL (Hebrew)
- [ ] Tested with screen reader

---

## 📸 Screenshots/Videos
<!-- If applicable, add screenshots or screen recordings -->

**Before:**
[Screenshot/Video]

**After:**
[Screenshot/Video]

---

## 🔍 Code Quality Checklist

### Code Standards
- [ ] Follows project coding style
- [ ] No console.log/debugger statements
- [ ] No commented-out code
- [ ] Meaningful variable/function names
- [ ] JSDoc comments added
- [ ] TypeScript definitions updated

### Performance
- [ ] No performance regressions
- [ ] Bundle size impact analyzed
- [ ] Memory leaks checked
- [ ] No blocking operations

### Security
- [ ] Input sanitization added
- [ ] No XSS vulnerabilities
- [ ] No SQL injection risks
- [ ] Secrets/credentials removed

### Accessibility (Design Bar — PR-META-7)

**Grader-verifiable (these are auto-checked when the PR diff touches HTML/CSS):**
- [ ] Every interactive element in NEW code has a visible `:focus-visible` style (CSS) OR I declare `N/A — no new interactive elements`
- [ ] Every `<img>` in NEW code has an `alt` attribute (empty `alt=""` is fine for decorative) OR I declare `N/A — no new images`
- [ ] Every form input in NEW code has a matched `<label for="...">` OR `aria-labelledby` OR I declare `N/A — no new form inputs`

**Aspirational (reviewer attention; not auto-enforced — see `docs/DESIGN_BAR.md` "Aspirational guidance" section):**
- [ ] Keyboard navigation works (Tab order is logical, ESC closes modals)
- [ ] Screen reader (NVDA + Hebrew voice) reads each control correctly
- [ ] Color contrast verified (text + background ≥ 4.5:1 normal; ≥ 3:1 large/UI)
- [ ] Tested at 200% browser zoom — no clipped content or horizontal scroll
- [ ] RTL Hebrew layout correct; directional icons mirrored appropriately
- [ ] Loading / empty / error states all have visible feedback
- [ ] No console errors on page load

---

## 📊 Performance Impact

### Bundle Size
<!-- If applicable -->
- Before: X KB
- After: Y KB
- Change: ±Z KB (±W%)

### Load Time
<!-- If applicable -->
- Before: X ms
- After: Y ms
- Change: ±Z ms

### Memory Usage
<!-- If applicable -->
- Before: X MB
- After: Y MB
- Change: ±Z MB

---

## 🚨 Breaking Changes
<!-- Mark if applicable -->
- [ ] This PR contains breaking changes

### Breaking Changes Details
<!-- If yes, describe what breaks and migration path -->

---

## 📚 Documentation
- [ ] README updated
- [ ] API docs updated
- [ ] Inline comments added
- [ ] Migration guide provided

### Documentation Links
- [API Docs](#)
- [User Guide](#)
- [Migration Guide](#)

---

## 🔗 Dependencies
<!-- List any new dependencies added -->
- None
- OR
- `package-name@version` - [Reason]

---

## 🚀 Deployment Notes
<!-- Special deployment instructions -->
- [ ] Database migrations required
- [ ] Environment variables needed
- [ ] Configuration changes needed
- [ ] Feature flag required

### Deployment Steps
1. Step 1
2. Step 2
3. Step 3

---

## 👥 Reviewers
<!-- Solo + AI review model — no codeowners team in this repo -->
Reviewer: @Chaim2045 (Product Owner — Haim)

### Review Focus
<!-- What should the reviewer + outcomes-grader pay attention to? -->
- [ ] Architecture/design patterns
- [ ] Performance implications
- [ ] Security concerns
- [ ] Test coverage
- [ ] Design Bar compliance (if UI) — see `docs/DESIGN_BAR.md`
- [ ] Engineering Bar compliance (if backend TS) — see `docs/ENGINEERING_BAR.md`

---

## ✅ Pre-Merge Checklist
- [ ] All CI checks passing
- [ ] `outcomes-grader` verdict = PASS or PASS_WITH_WARNINGS in PR body
- [ ] PRODUCT-GRADE GATES section in PR body (G1-G7)
- [ ] Tests passing locally
- [ ] Documentation updated (if behavior/architecture changed)
- [ ] No merge conflicts

---

## 📝 Additional Notes
<!-- Any other context, warnings, or information -->

---

**Target Branch:** `main` (DEV) or `production-stable` (PROD)
**Author:** @Chaim2045
