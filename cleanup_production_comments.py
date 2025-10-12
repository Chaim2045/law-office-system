#!/usr/bin/env python3
"""
ניקוי הערות Production mode והערות מיותרות אחרות
"""

import os
import re

# קבצים לעיבוד
files_to_clean = [
    'activity-logger.js',
    'dates.js',
    'firebase-pagination.js',
    'integration-manager.js',
    'reports.js',
    'script.js',
    'skeleton-loader.js',
    'statistics.js',
    'task-actions.js',
    'firebase-server-adapter.js',
    'api-client-v2.js'
]

# תבניות להסרה
patterns_to_remove = [
    r'^\s*//\s*Production mode.*$',
    r'^\s*//\s*מצב פרודקשן.*$',
    r'^\s*//\s*Old TablePagination class removed.*$'
]

total_lines_removed = 0
files_modified = 0

for filename in files_to_clean:
    filepath = os.path.join(r'C:\Users\User\Desktop\law-office-system', filename)

    if not os.path.exists(filepath):
        print(f"[WARN] File not found: {filename}")
        continue

    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    original_count = len(lines)
    cleaned_lines = []

    for line in lines:
        # בדיקה אם השורה תואמת לאחת מהתבניות
        should_remove = False
        for pattern in patterns_to_remove:
            if re.match(pattern, line):
                should_remove = True
                break

        if not should_remove:
            cleaned_lines.append(line)

    lines_removed = original_count - len(cleaned_lines)

    if lines_removed > 0:
        # שמירת הקובץ המנוקה
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(cleaned_lines)

        print(f"[OK] {filename}: removed {lines_removed} lines")
        total_lines_removed += lines_removed
        files_modified += 1
    else:
        print(f"[-] {filename}: no lines to remove")

print(f"\n{'='*50}")
print(f"[DONE] Total: {total_lines_removed} lines removed from {files_modified} files")
print(f"{'='*50}")
