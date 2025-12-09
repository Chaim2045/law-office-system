/**
 * Debug script for Add Task System
 * הוסף את הסקריפט הזה לפני </body> ב-index.html לבדיקה
 */

console.log('🔍 ====== ADD TASK SYSTEM DEBUG ======');

// Check 1: Is AddTaskSystem defined?
setTimeout(() => {
    console.log('\n📊 Check 1: window.AddTaskSystem');
    if (window.AddTaskSystem) {
        console.log('✅ window.AddTaskSystem קיים');
        console.log('   Version:', window.AddTaskSystem.version);
        console.log('   Has dialog:', !!window.AddTaskSystem.dialog);
        console.log('   Has show():', typeof window.AddTaskSystem.show === 'function');
        console.log('   Full object:', window.AddTaskSystem);
    } else {
        console.error('❌ window.AddTaskSystem לא קיים!');
        console.log('   זה אומר שהמערכת לא אותחלה.');
        console.log('   בדוק שיש קריאה ל-initializeAddTaskSystem() אחרי login.');
    }
}, 3000); // המתן 3 שניות אחרי טעינת הדף

// Check 2: Is the manager instance available?
setTimeout(() => {
    console.log('\n📊 Check 2: window.lawOfficeManager');
    if (window.lawOfficeManager) {
        console.log('✅ window.lawOfficeManager קיים');
        console.log('   Has addTaskDialog:', !!window.lawOfficeManager.addTaskDialog);
        console.log('   Current user:', window.lawOfficeManager.currentUser);
    } else {
        console.error('❌ window.lawOfficeManager לא קיים!');
    }
}, 3000);

// Check 3: Can we call openSmartForm?
setTimeout(() => {
    console.log('\n📊 Check 3: window.openSmartForm');
    if (typeof window.openSmartForm === 'function') {
        console.log('✅ window.openSmartForm קיים');
        console.log('   Function:', window.openSmartForm.toString().substring(0, 200));
    } else {
        console.error('❌ window.openSmartForm לא קיים!');
    }
}, 3000);

// Check 4: Test button click
window.debugTestAddTask = function() {
    console.log('\n🧪 ====== TESTING ADD TASK SYSTEM ======');

    console.log('\n1. Testing window.AddTaskSystem.show()...');
    if (window.AddTaskSystem && window.AddTaskSystem.show) {
        try {
            window.AddTaskSystem.show();
            console.log('✅ show() נקרא בהצלחה');
        } catch (error) {
            console.error('❌ show() נכשל:', error);
        }
    } else {
        console.error('❌ window.AddTaskSystem.show לא זמין');
    }

    console.log('\n2. Testing openSmartForm()...');
    if (typeof window.openSmartForm === 'function') {
        try {
            window.openSmartForm();
            console.log('✅ openSmartForm() נקרא בהצלחה');
        } catch (error) {
            console.error('❌ openSmartForm() נכשל:', error);
        }
    } else {
        console.error('❌ window.openSmartForm לא זמין');
    }

    console.log('\n3. Checking if form appeared...');
    const form = document.getElementById('budgetFormContainer');
    if (form) {
        console.log('✅ budgetFormContainer קיים');
        console.log('   Is hidden:', form.classList.contains('hidden'));
        console.log('   Display:', window.getComputedStyle(form).display);
        console.log('   Visibility:', window.getComputedStyle(form).visibility);
    } else {
        console.error('❌ budgetFormContainer לא נמצא ב-DOM!');
    }
};

console.log('\n✨ Debug script loaded!');
console.log('📝 To test manually, open Console and run: debugTestAddTask()');
console.log('🔍 ======================================\n');
