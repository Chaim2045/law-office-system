# Claude Session Template

## 📋 Purpose
השתמש בתבנית הזו בתחילת כל שיחה חדשה עם Claude כדי לתת לו context מלא.

---

## 🔄 How to Use

בתחילת שיחה חדשה, העתק את התבנית למטה ומלא את הפרטים:

```markdown
# Session Context

## Previous Session Summary
[מה עשינו בשיחה הקודמת]

## Current Goal
[מה אני רוצה להשיג בשיחה הזו]

## Important Context
- Files involved: [רשימת קבצים]
- Current branch: [שם ה-branch]
- Known issues: [בעיות ידועות]

## Questions/Blockers
[שאלות או חסמים שצריך לפתור]
```

---

## 📝 Session Log Template

בסוף כל שיחה, תעד את מה שקרה:

```markdown
# Session Log - [תאריך]

## What We Did
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Files Changed
- `path/to/file1.js`
- `path/to/file2.ts`

## Commits
- `commit-hash`: Description

## Issues Found
- Issue 1: Description
- Issue 2: Description

## Next Steps
1. Next task
2. Another task

## Notes
[הערות חשובות לעתיד]
```

---

## 🗂️ Example Sessions

### Example 1: Bug Fix Session

```markdown
# Session Context - Firebase Functions Fix

## Previous Session Summary
N/A - First session for this issue

## Current Goal
Fix "Cannot read properties of undefined (reading 'httpsCallable')" error when adding service to existing case.

## Important Context
- Files involved:
  - js/modules/case-creation/case-creation-dialog.js
  - master-admin-panel/js/modules/case-creation-dialog.js
- Current branch: main
- Known issues:
  - window.firebaseFunctions not defined in index.html
  - Code uses window.firebaseFunctions.httpsCallable()

## Questions/Blockers
Should we use firebase.functions() or define window.firebaseFunctions globally?
```

**Session Log:**
```markdown
# Session Log - 2025-12-02

## What We Did
- ✅ Identified root cause: window.firebaseFunctions undefined
- ✅ Fixed js/modules/case-creation/case-creation-dialog.js (lines 1980, 2055)
- ✅ Rolled back to stable commit (bea22c9)
- ✅ Applied fix manually
- ✅ Deployed to Netlify

## Files Changed
- `js/modules/case-creation/case-creation-dialog.js`

## Commits
- `415ed7b`: 🐛 CRITICAL FIX: firebase.functions() instead of window.firebaseFunctions

## Issues Found
- Same issue exists in master-admin-panel files (not fixed yet)

## Next Steps
1. Fix remaining files in master-admin-panel
2. Verify admin panel works
3. Consider standardizing all files to firebase.functions()

## Notes
- firebase.functions() works everywhere
- window.firebaseFunctions requires initialization
- Prefer firebase.functions() for consistency
```

---

### Example 2: Feature Development Session

```markdown
# Session Context - React POC

## Previous Session Summary
Discussed migration strategy to React. Decided on monorepo approach with pnpm workspaces.

## Current Goal
Create POC (Proof of Concept):
1. Setup monorepo structure
2. Create shared NotificationSystem component
3. Create simple Dashboard page in employee-app

## Important Context
- Files involved: Will create new structure
- Current branch: main (will create react-migration/poc)
- Known issues: None yet

## Questions/Blockers
- Need to decide on exact folder structure
- TailwindCSS config for monorepo?
```

**Session Log:**
```markdown
# Session Log - 2025-12-03

## What We Did
- ✅ Created monorepo structure with pnpm workspaces
- ✅ Setup packages/shared with TypeScript
- ✅ Created NotificationSystem React component
- ✅ Setup packages/employee-app with Vite
- ✅ Created simple Dashboard with NotificationSystem

## Files Changed
- New structure created (see REACT_MIGRATION_PLAN.md)

## Commits
- `abc123`: 🚀 POC: Setup React monorepo structure
- `def456`: ✨ POC: Add NotificationSystem component
- `ghi789`: 🎨 POC: Create Dashboard page

## Issues Found
- TailwindCSS purging not working correctly (fixed)
- pnpm workspace resolution issue (fixed)

## Next Steps
1. Review POC with stakeholders
2. Decide: continue with full migration?
3. If yes: Start Phase 1 (full setup)

## Notes
- Monorepo works well with pnpm
- Vite is blazing fast
- Component migration is straightforward
- Consider adding Storybook for component development
```

---

## 💡 Tips for Better Sessions

### Do's:
- ✅ **Start each session with context** - paste the template
- ✅ **Focus on ONE task** - don't try to do everything
- ✅ **Document as you go** - update the log during session
- ✅ **Ask for summary** - at the end, ask Claude to summarize
- ✅ **Commit often** - small commits are easier to rollback

### Don'ts:
- ❌ **Don't assume Claude remembers** - always provide context
- ❌ **Don't have marathon sessions** - max 2-3 hours
- ❌ **Don't skip documentation** - future you will thank you
- ❌ **Don't ignore warnings** - if Claude repeats itself, end session

---

## 🚨 Warning Signs - When to End Session

| Sign | Action |
|------|--------|
| Claude repeats previous suggestions | 🛑 End session, start fresh |
| Claude forgets what we discussed | 🛑 End session, document & restart |
| You're confused about what we're doing | 🛑 End session, review plan |
| Session > 2-3 hours | ⚠️ Consider ending |
| Token usage > 150K | 🛑 End session soon |

---

## 📂 Folder Structure for Sessions

```
.claude/
├── sessions/
│   ├── 2025-12-02-firebase-fix.md
│   ├── 2025-12-03-react-poc.md
│   └── 2025-12-05-dashboard-migration.md
├── SESSION_TEMPLATE.md (this file)
└── README.md
```

---

**Created:** 2025-12-02
**Last Updated:** 2025-12-02
