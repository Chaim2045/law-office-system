#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
סקריפט לעדכון הדיאלוג - רק header + buttons
עדכון זהיר לפי כללי הפרויקט
"""

import re

def update_dialog_file():
    """עדכון הקובץ case-creation-dialog.js"""

    file_path = r'js\modules\case-creation\case-creation-dialog.js'

    # קריאת הקובץ
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # ✅ שינוי 1: Overlay div
    content = re.sub(
        r'<div id="modernCaseDialog" style="[^"]*">',
        '<div id="modernCaseDialog" class="case-dialog-overlay">',
        content
    )

    # ✅ שינוי 2: Container div (הראשון אחרי ה-overlay)
    # מחפש את הדיב הראשון בתוך ה-overlay
    content = re.sub(
        r'(<div id="modernCaseDialog"[^>]*>\s*)<div style="\s*background: white;[^"]*">',
        r'\1<div class="case-dialog-container">',
        content
    )

    # ✅ שינוי 3: Header section - הסרת הגרדיאנט
    content = re.sub(
        r'<!-- Header -->\s*<div style="[^"]*background:[^"]*linear-gradient[^"]*">',
        '<!-- Header -->\n            <div class="case-dialog-header">',
        content
    )

    # ✅ שינוי 4: Header content div
    content = re.sub(
        r'(<div class="case-dialog-header">\s*)<div style="display: flex;[^"]*">',
        r'\1<div class="case-dialog-header-content">',
        content
    )

    # ✅ שינוי 5: הסרת style מהאייקון בheader
    content = re.sub(
        r'<i class="fas fa-folder-plus" style="[^"]*">',
        '<i class="fas fa-folder-plus">',
        content
    )

    # ✅ שינוי 6: הסרת style מה-h2 בheader
    content = re.sub(
        r'<h2 style="[^"]*">תיק חדש</h2>',
        '<h2>תיק חדש</h2>',
        content
    )

    # ✅ שינוי 7: כפתור סגירה
    content = re.sub(
        r'<button id="modernCaseDialog_close" style="[^"]*">',
        '<button id="modernCaseDialog_close" class="case-dialog-close">',
        content
    )

    # ✅ שינוי 8: Content div
    content = re.sub(
        r'<!-- Content -->\s*<div style="padding:[^"]*">',
        '<!-- Content -->\n            <div class="case-dialog-content">',
        content
    )

    # ✅ שינוי 9: Buttons container - מציאת הדיב עם justify-content: flex-end
    content = re.sub(
        r'<div style="\s*display: flex;\s*gap: 12px;\s*justify-content: flex-end;[^"]*">',
        '<div class="case-dialog-actions">',
        content
    )

    # ✅ שינוי 10: כפתור ביטול
    content = re.sub(
        r'<button type="button" id="modernCaseDialog_cancel" style="[^"]*">',
        '<button type="button" id="modernCaseDialog_cancel" class="btn btn-secondary">',
        content
    )

    # ✅ שינוי 11: כפתור שמירה (עם gradient)
    content = re.sub(
        r'<button type="submit" style="[^"]*background:[^"]*linear-gradient[^"]*">',
        '<button type="submit" class="btn btn-primary">',
        content
    )

    # ✅ שינוי 12: הסרת style מאייקון השמירה
    content = re.sub(
        r'<i class="fas fa-save" style="[^"]*">',
        '<i class="fas fa-save">',
        content
    )

    # ✅ שינוי 13: הסרת <style> בסוף (אנימציות)
    content = re.sub(
        r'<style>\s*@keyframes fadeIn[^<]*</style>',
        '<!-- Animations moved to case-creation-dialog.css -->',
        content,
        flags=re.DOTALL
    )

    # שמירת הקובץ המעודכן
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print('✅ הקובץ עודכן בהצלחה!')
    print(f'📁 {file_path}')
    print('\n🔍 שינויים שבוצעו:')
    print('  1. ✅ Overlay div → class="case-dialog-overlay"')
    print('  2. ✅ Container div → class="case-dialog-container"')
    print('  3. ✅ Header section → class="case-dialog-header"')
    print('  4. ✅ Header content → class="case-dialog-header-content"')
    print('  5. ✅ Close button → class="case-dialog-close"')
    print('  6. ✅ Content div → class="case-dialog-content"')
    print('  7. ✅ Buttons container → class="case-dialog-actions"')
    print('  8. ✅ Cancel button → class="btn btn-secondary"')
    print('  9. ✅ Submit button → class="btn btn-primary"')
    print(' 10. ✅ הסרת inline styles מאייקונים')
    print(' 11. ✅ הסרת <style> tags (אנימציות)')
    print('\n🎨 עכשיו הדיאלוג משתמש בסטייל Linear/Vercel!')

if __name__ == '__main__':
    try:
        update_dialog_file()
    except Exception as e:
        print(f'❌ שגיאה: {e}')
        import traceback
        traceback.print_exc()
