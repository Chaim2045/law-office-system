# Z-Index Hierarchy
**Law Office Management System - Admin Panel**

## Purpose
This document defines the z-index stacking order for the entire application to prevent layering conflicts.

## Hierarchy

| Layer | Range | Usage | Examples |
|-------|-------|-------|----------|
| **Base** | 0-99 | Normal content, background elements | Body, containers |
| **Navigation** | 100-199 | Fixed navigation, headers | `.admin-nav` (100) |
| **Dropdowns** | 1000-1999 | Tooltips, dropdowns, popovers | User menu, date pickers |
| **Modals (Standard)** | 10000-10099 | Standard modal dialogs | Alert modals, confirmation dialogs |
| **System Modals** | 10100-10199 | Critical system dialogs | Case creation (10000), Messaging (10000-10001) |
| **Critical Overlays** | 10200+ | Highest priority overlays | Client report modal (10200) |

## Rules

1. **Never use arbitrary high values** (e.g., 999999)
   - Use the defined hierarchy
   - Document exceptions

2. **Related elements should be grouped**
   - Modal backdrop: base z-index
   - Modal content: base z-index + 1
   - Modal close button: base z-index + 2

3. **Leave gaps for future additions**
   - Use increments of 100 for major categories
   - Use increments of 10 for subcategories
   - Use increments of 1 for related elements

## Current Assignments

### Navigation (100-199)
- `main.css:829` - `.admin-nav` - 100
- `main.css:654` - Header element - 100

### Modals (10000-10099)
- `case-creation-dialog.css:24` - 10000
- `components.css:1093` - 10000
- `messaging-system.css:154` - 10000

### System Modals (10100-10199)
- `messaging.css:24` - 10000 (should be 10100)
- `messaging.css:168` - 10001 (should be 10101)

### Critical Overlays (10200+)
- `clients.css:255` - `.modal` (Client Report) - **10200**

## Migration Plan

To clean up inconsistent z-index values:

1. ✅ Client report modal: 10200 (Done)
2. ⏳ Update messaging modals: 10100-10101
3. ⏳ Update case creation: 10100
4. ⏳ Verify all navigation elements: 100-199

## Best Practices

### DO ✅
- Use semantic layer names
- Document all z-index usage
- Test on all browsers
- Consider stacking context (position: fixed/absolute/relative)

### DON'T ❌
- Use magic numbers (e.g., 9999, 999999)
- Increment by 1 between unrelated elements
- Forget about stacking context
- Override without documentation

## Debugging Tips

1. **Element hidden behind another?**
   ```js
   // Check z-index in console
   getComputedStyle(element).zIndex
   ```

2. **Stacking context issue?**
   - Check parent elements
   - Look for `transform`, `filter`, `opacity < 1`
   - These create new stacking contexts

3. **Modal not on top?**
   - Verify z-index is in Critical Overlays range (10200+)
   - Check for conflicting CSS
   - Inspect with DevTools layer visualization

## References

- [MDN: Understanding z-index](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Positioning/Understanding_z_index)
- [CSS Tricks: Z-Index](https://css-tricks.com/almanac/properties/z/z-index/)

---

**Last Updated**: 2025-12-02
**Maintained By**: Development Team
