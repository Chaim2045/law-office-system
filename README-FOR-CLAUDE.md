# 🤖 README FOR CLAUDE (AI Assistant)

> **IMPORTANT: Read this BEFORE making any commits or pushes!**

---

## ⚠️ CRITICAL: Branch Workflow

This project uses a **two-branch deployment strategy**:

### Default Branch: `main` (DEVELOPMENT/TESTING)
- **Always work here by default!**
- Safe to commit and push
- Deploys to preview only: https://main--gh-law-office-system.netlify.app
- **Real users DO NOT see this**

### Production Branch: `production-stable` (LIVE SITE)
- **NEVER push directly to this branch!**
- Only merge from `main` when explicitly requested
- Deploys to: https://gh-law-office-system.netlify.app
- **Real users see this**

---

## 🚨 Critical Rules

1. **DEFAULT ASSUMPTION:** Always work on `main` unless explicitly told otherwise
2. **NEVER** checkout `production-stable` unless user says: "deploy to production" or "push to production-stable"
3. **ALWAYS** stay on `main` branch after any production deployment
4. **WHEN IN DOUBT:** Stay on `main`!

---

## ✅ Correct Workflow Example

```
User: "Add a new feature X"
You:
  - Work on main branch
  - git add . && git commit && git push origin main
  - Feature goes to preview only
  ✅ Real users not affected
```

---

## ❌ Wrong Workflow (DON'T DO THIS!)

```
User: "Add a new feature X"
You:
  - git checkout production-stable  ❌ WRONG!
  - git push origin production-stable  ❌ WRONG!
  ❌ Real users see untested changes!
```

---

## 🎯 When to Deploy to Production

**ONLY** when user explicitly says one of these:
- "Deploy to production"
- "Push to production-stable"
- "Make it live"
- "Update the real site"

**Then and ONLY then:**
```bash
git checkout production-stable
git merge main
git push origin production-stable
git checkout main  # Return to main immediately!
```

---

## 📝 Summary

- **Default branch:** `main` (always work here)
- **Production branch:** `production-stable` (touch only when explicitly requested)
- **When in doubt:** Work on `main`
- **User's peace of mind:** They can test changes on `main` before going live

For detailed workflow in Hebrew, see: [DEPLOYMENT-WORKFLOW.md](DEPLOYMENT-WORKFLOW.md)
