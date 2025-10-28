# 🤖 Instructions for AI Assistants - הנחיות לבינה מלאכותית

## ⚠️ CRITICAL - Read This When Editing style.css

This CSS file is undergoing gradual cleanup of **273 duplicates**.

---

## 🎯 Your Task (Simple 4-Step Process)

### Step 1: Check for TODO Tags
```bash
# Before ANY edit to style.css, run:
grep -B 2 -A 10 "TODO: CLEANUP" style.css | grep -A 10 "line_you_are_editing"
```

### Step 2: If You Find a TODO Tag - Merge It!

**Example:**
```css
/* TODO: CLEANUP - Duplicate! Merge to line 11285 */
@media (max-width: 768px) {
  .some-selector { ... }
}
/* END TODO: CLEANUP */
```

**Action**:
1. Copy content from this duplicate
2. Merge into the MAIN instance (line specified in comment)
3. Delete this duplicate block entirely
4. Go to Step 3

### Step 3: Update the Guide

Open `CSS_CLEANUP_GUIDE.md` and mark as done:
```markdown
- [x] Line XXX - Deleted on DD.MM.YYYY
```

### Step 4: Make Your Original Edit

Now proceed with the user's requested change.

---

## 🚫 What NOT to Delete

- ❌ `@keyframes` / animations
- ❌ `:root` CSS variables
- ❌ Print styles (unless marked TODO)
- ❌ Vendor prefixes (`-webkit-`, `-moz-`)

---

## ✅ What IS Safe to Delete

- ✅ Exact duplicate selectors
- ✅ Duplicate `@media` queries (after merging)
- ✅ Anything marked `/* TODO: CLEANUP */`

---

## 📊 Current Status

- **Total duplicates**: 273
- **Cleaned so far**: 2
- **Remaining**: 271
- **Progress**: 0.7%

---

## 📁 Related Files

- `CSS_CLEANUP_GUIDE.md` - Complete list of all 273 duplicates
- `CSS_CLEANUP_README.md` - User-facing instructions
- `style.css` (lines 1-35) - Contains cleanup protocol in header

---

## 💡 Quick Example

**User asks**: "Please add hover effect to .client-card"

**Your response should**:
1. ✅ Check for `TODO: CLEANUP` near `.client-card`
2. ✅ If found - merge duplicates first
3. ✅ Update CSS_CLEANUP_GUIDE.md
4. ✅ Then add the hover effect
5. ✅ Tell user: "I also cleaned up X duplicates in this area"

---

## 🎓 Remember

**Every edit = Opportunity to clean!**

The user wants gradual, safe cleanup. By removing 1-2 duplicates per edit, the file will be clean in ~6 months without dedicated cleanup sessions.

---

**Last Updated**: 28.10.2025
**Created for**: All AI assistants working on this codebase
**Purpose**: Ensure consistent, safe, gradual CSS cleanup
