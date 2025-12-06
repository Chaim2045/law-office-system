/**
 * ═══════════════════════════════════════════════════════════════
 * LEGACY CODE - Budget Form Event Listener
 * ═══════════════════════════════════════════════════════════════
 *
 * מקור: js/main.js שורות 249-256 (בתוך setupEventListeners)
 * תאריך העברה: 2025-12-07
 * הועבר ל: components/add-task/AddTaskDialog.js → setupEventListeners()
 *
 * ⚠️ קוד זה לא בשימוש יותר - נשמר לבטיחות בלבד!
 */

// Budget form event listener (מתוך setupEventListeners)
const budgetForm = document.getElementById('budgetForm');
if (budgetForm) {
  budgetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    this.addBudgetTask();
  });
}

/**
 * הערות:
 *
 * 1. ה-event listener הזה היה בתוך setupEventListeners() של LawOfficeManager
 * 2. הוא קורא ל-this.addBudgetTask() שהייתה פונקציה מונוליטית
 * 3. במערכת החדשה:
 *    - ה-event listener עבר ל-AddTaskDialog.setupEventListeners()
 *    - הוא קורא ל-this.handleSubmit() במקום addBudgetTask()
 *    - הפונקציונליות זהה 100%
 *
 * 4. אם צריך לחזור למצב הישן:
 *    - החזר את הקוד הזה ל-main.js setupEventListeners()
 *    - ודא שהפונקציה addBudgetTask() קיימת
 */
