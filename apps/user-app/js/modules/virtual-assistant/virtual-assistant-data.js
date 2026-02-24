/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIRTUAL ASSISTANT - DATA LAYER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description מסד נתונים של כל הפעולות והדרכות במערכת
 * @version 2.0.0
 * @module VirtualAssistant/Data
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

/**
 * @constant ACTION_DATABASE
 * @description מסד נתונים של כל הפעולות האפשריות במערכת
 *
 * @structure {
 *   id: string,              - מזהה ייחודי
 *   title: string,           - שם הפעולה
 *   icon: string,            - אימוג'י/אייקון
 *   category: string,        - קטגוריה (tasks/timesheet/clients/general)
 *   keywords: string[],      - מילות מפתח לחיפוש
 *   quickSteps: string[],    - צעדים מהירים (רשימה קצרה)
 *   fullGuide: {             - הדרכה מלאה צעד-אחר-צעד
 *     totalSteps: number,
 *     steps: Array<{
 *       number: number,
 *       title: string,
 *       description: string,
 *       highlight: string,     - CSS selector להדגשה
 *       action: Function,      - פעולה אוטומטית
 *       tips: string[],        - טיפים נוספים
 *       validation: Function   - בדיקת השלמת השלב
 *     }>
 *   },
 *   info: Object             - מידע כללי (לפעולות ללא הדרכה)
 * }
 */
const ACTION_DATABASE = {
    // ═══════════════════════════════════════════════════════
    // דיווח שעות
    // ═══════════════════════════════════════════════════════
    'report_hours': {
        id: 'report_hours',
        title: 'דיווח שעות עבודה',
        icon: '📝',
        category: 'timesheet',
        keywords: ['דווח שעות', 'רישום שעות', 'הוסף שעות', 'timesheet', 'שעתון', 'דיווח', 'שעות עבודה'],
        quickSteps: [
            'לחץ על כפתור + בראש המסך',
            'בחר "דווח שעות"',
            'מלא תאריך, דקות ותיאור',
            'לחץ "הוסף לשעתון"'
        ],
        fullGuide: {
            totalSteps: 5,
            steps: [
                {
                    number: 1,
                    title: 'פתיחת תפריט הוספה מהירה',
                    description: 'ראשית, בואו נפתח את טופס דיווח השעות.\n\nלחץ על הכפתור הכחול **+** שנמצא במרכז החלק העליון של המסך.',
                    highlight: '#smartPlusBtn',
                    actionButton: {
                        text: '🚀 פתח את התפריט עבורי',
                        handler: 'SystemBridge.openSmartForm()'
                    },
                    validation: `
                        const modal = DOMController.querySelector('#smartFormModal');
                        return modal && !DOMController.hasClass(modal, 'hidden');
                    `
                },
                {
                    number: 2,
                    title: 'בחירת "דווח שעות"',
                    description: 'עכשיו, בחר באפשרות **"דווח שעות"** מהתפריט שנפתח.',
                    highlight: '.smart-form-option[data-type="timesheet"]',
                    actionButton: {
                        text: '👆 בחר עבורי',
                        handler: `
                            const option = DOMController.querySelector('.smart-form-option[data-type="timesheet"]');
                            if (option) option.click();
                        `
                    },
                    validation: `
                        const timesheetForm = DOMController.querySelector('#timesheetFormContainer');
                        return timesheetForm && !DOMController.hasClass(timesheetForm, 'hidden');
                    `
                },
                {
                    number: 3,
                    title: 'מילוי פרטי הדיווח',
                    description: `הגיע הזמן למלא את הפרטים:

**📅 תאריך**: בחר את התאריך שבו עבדת (ברירת מחדל: היום)

**⏱️ דקות**: הזן כמה דקות עבדת (1-999)

**👤 לקוח ותיק**: חפש ובחר את הלקוח (או סמן "פעילות פנימית")

**📝 תיאור**: תאר מה עשית (לפחות 3 תווים)`,
                    highlight: '#timesheetFormContainer',
                    tips: [
                        '💡 אם זו פעילות משרדית, סמן את "פעילות משרדית פנימית"',
                        '⏱️ ניתן להזין גם שעות (המערכת תמיר לדקות)',
                        '🔍 החיפוש מתעדכן אוטומטית תוך כדי הקלדה'
                    ]
                },
                {
                    number: 4,
                    title: 'שמירת הדיווח',
                    description: 'וודא שמילאת את כל השדות הנדרשים, ולחץ על **"הוסף לשעתון"**.',
                    highlight: '#submitTimesheetBtn',
                    tips: [
                        '⚠️ לא אוכל לשמור עבורך - וודא שהפרטים נכונים!'
                    ]
                },
                {
                    number: 5,
                    title: 'אישור והצלחה ✨',
                    description: 'מעולה! הדיווח נשמר בהצלחה.\n\nתוכל לראות אותו ברשימת הדיווחים בטאב **"שעתון"**.',
                    tips: [
                        '✅ הדיווח התווסף לסיכום השעות השבועי',
                        '📊 ניתן לערוך את הדיווח בכל עת',
                        '🔄 ניתן לדווח גם ישירות מהשלמת משימה'
                    ]
                }
            ]
        }
    },

    // ═══════════════════════════════════════════════════════
    // יצירת משימה
    // ═══════════════════════════════════════════════════════
    'create_task': {
        id: 'create_task',
        title: 'יצירת משימת תקצוב',
        icon: '✅',
        category: 'tasks',
        keywords: ['משימה חדשה', 'תקצוב', 'הוסף משימה', 'task', 'todo', 'משימה'],
        quickSteps: [
            'לחץ על + ובחר "משימה חדשה"',
            'בחר לקוח ותיק',
            'הזן תיאור ודקות משוערות',
            'בחר תאריך יעד ושמור'
        ],
        fullGuide: {
            totalSteps: 4,
            steps: [
                {
                    number: 1,
                    title: 'פתיחת טופס משימה',
                    description: 'לחץ על הכפתור **+** בראש המסך ובחר **"משימה חדשה"**',
                    highlight: '#smartPlusBtn',
                    actionButton: {
                        text: '🚀 פתח טופס משימה',
                        handler: 'SystemBridge.openSmartForm("task")'
                    }
                },
                {
                    number: 2,
                    title: 'בחירת לקוח ותיק',
                    description: 'חפש ובחר את הלקוח והתיק הרלוונטיים.\n\nהחיפוש עובד על שם, ת.ז., טלפון ואימייל.',
                    highlight: '#taskClientSearch',
                    tips: ['🔍 ניתן לחפש גם לפי מספר תיק']
                },
                {
                    number: 3,
                    title: 'פרטי המשימה',
                    description: `מלא את פרטי המשימה:

**📝 תיאור**: מה צריך לעשות? (מינימום 3 תווים)

**⏱️ דקות משוערות**: כמה זמן תיקח המשימה?

**📅 תאריך יעד**: מתי צריך לסיים?`,
                    highlight: '#taskFormFields'
                },
                {
                    number: 4,
                    title: 'שמירה',
                    description: 'לחץ **"הוסף לתקצוב"**.\n\nהמשימה תופיע ברשימת **"פעילות בלבד"**.',
                    highlight: '#submitTaskBtn',
                    tips: ['✅ המשימה תופיע מיד ברשימה']
                }
            ]
        }
    },

    // ═══════════════════════════════════════════════════════
    // יצירת תיק
    // ═══════════════════════════════════════════════════════
    'create_case': {
        id: 'create_case',
        title: 'פתיחת תיק חדש',
        icon: '📁',
        category: 'clients',
        keywords: ['תיק חדש', 'לקוח חדש', 'case', 'client', 'פתח תיק', 'תיק'],
        quickSteps: [
            'לחץ על "תיק חדש" בצד',
            'בחר או צור לקוח',
            'בחר סוג תיק (שעות/הליך/מחיר קבוע)',
            'הזן פרטים ושמור'
        ],
        fullGuide: {
            totalSteps: 3,
            steps: [
                {
                    number: 1,
                    title: 'פתיחת טופס תיק',
                    description: 'לחץ על **"תיק חדש"** בסרגל הצדדי\n\nאו השתמש בקיצור: **Ctrl+N**',
                    highlight: '#newCaseBtn',
                    actionButton: {
                        text: '🚀 פתח טופס תיק',
                        handler: 'SystemBridge.openSmartForm("case")'
                    }
                },
                {
                    number: 2,
                    title: 'פרטי התיק',
                    description: `מלא את פרטי התיק:

**👤 לקוח**: בחר קיים או צור חדש

**📋 סוג תיק**: שעות / הליך משפטי / מחיר קבוע

**📝 כותרת**: שם התיק

**⚖️ עו"ד מטפל**: מי אחראי על התיק`,
                    highlight: '#caseFormFields'
                },
                {
                    number: 3,
                    title: 'שמירה',
                    description: 'בחר **תאריך התחלה** ולחץ **"צור תיק"**',
                    highlight: '#submitCaseBtn',
                    tips: ['✅ התיק ייווצר וייפתח אוטומטית']
                }
            ]
        }
    },

    // ═══════════════════════════════════════════════════════
    // חיפוש לקוח
    // ═══════════════════════════════════════════════════════
    'search_client': {
        id: 'search_client',
        title: 'חיפוש לקוח',
        icon: '🔍',
        category: 'clients',
        keywords: ['חפש לקוח', 'מצא לקוח', 'search', 'find client', 'חיפוש'],
        quickSteps: [
            'השתמש בשדה החיפוש בכל טופס',
            'הקלד שם / ת.ז. / טלפון / אימייל',
            'התוצאות מתעדכנות אוטומטית',
            'לחץ על התוצאה הרצויה'
        ],
        fullGuide: {
            totalSteps: 2,
            steps: [
                {
                    number: 1,
                    title: 'שדה חיפוש מהיר',
                    description: 'בכל טופס יש שדה חיפוש מהיר.\n\nהחיפוש עובד על **כל השדות** של הלקוח:',
                    tips: [
                        '📝 חפש לפי שם מלא או חלקי',
                        '🆔 חפש לפי ת.ז.',
                        '📞 חפש לפי מספר טלפון',
                        '📧 חפש לפי אימייל'
                    ]
                },
                {
                    number: 2,
                    title: 'בחירת תוצאה',
                    description: 'התוצאות מתעדכנות **תוך כדי הקלדה** (300ms).\n\nפשוט לחץ על התוצאה הרצויה.',
                    tips: ['⚡ החיפוש מיידי וחכם']
                }
            ]
        }
    },

    // ═══════════════════════════════════════════════════════
    // קיצורי מקלדת
    // ═══════════════════════════════════════════════════════
    'keyboard_shortcuts': {
        id: 'keyboard_shortcuts',
        title: 'קיצורי מקלדת',
        icon: '⌨️',
        category: 'general',
        keywords: ['קיצורים', 'מקלדת', 'shortcuts', 'keys', 'keyboard'],
        quickSteps: null,
        info: {
            type: 'shortcuts',
            title: 'קיצורי מקלדת שימושיים',
            description: 'השתמש בקיצורים האלה לעבודה מהירה יותר:',
            shortcuts: [
                { keys: 'Ctrl + N', description: 'פתיחת טופס חדש (משימה/תיק)', icon: '➕' },
                { keys: 'Ctrl + F', description: 'מעבר לשדה חיפוש', icon: '🔍' },
                { keys: 'Ctrl + S', description: 'שמירת טופס', icon: '💾' },
                { keys: 'Esc', description: 'סגירת דיאלוג/מודאל', icon: '❌' },
                { keys: 'F1', description: 'פתיחת העוזר החכם (אני!)', icon: '💬' }
            ]
        }
    },

    // ═══════════════════════════════════════════════════════
    // סיור במערכת
    // ═══════════════════════════════════════════════════════
    'system_tour': {
        id: 'system_tour',
        title: 'סיור במערכת',
        icon: '🎯',
        category: 'general',
        keywords: ['סיור', 'הדרכה', 'tour', 'guide', 'למידה', 'מדריך'],
        quickSteps: null,
        directAction: 'SystemBridge.startSystemTour()',
        info: {
            type: 'feature',
            title: 'סיור אינטראקטיבי במערכת',
            description: 'סיור מודרך של **9 שלבים** שילמד אותך את כל התכונות במערכת',
            duration: 'כ-5 דקות',
            features: [
                { icon: '📚', text: '9 שלבים מודרכים' },
                { icon: '⏱️', text: 'כ-5 דקות' },
                { icon: '🎮', text: 'למידה אינטראקטיבית' },
                { icon: '⏸️', text: 'ניתן להפסיק בכל עת' }
            ],
            actionButton: {
                text: '🚀 התחל סיור',
                handler: 'SystemBridge.startSystemTour()'
            }
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// קטגוריות לתצוגה בדף הבית
// ═══════════════════════════════════════════════════════════════════════════

const ACTION_CATEGORIES = {
    'timesheet': {
        id: 'timesheet',
        name: 'שעתון ודיווחים',
        icon: '⏱️',
        color: '#3b82f6'
    },
    'tasks': {
        id: 'tasks',
        name: 'משימות ותקצוב',
        icon: '✅',
        color: '#10b981'
    },
    'clients': {
        id: 'clients',
        name: 'תיקים ולקוחות',
        icon: '📁',
        color: '#f59e0b'
    },
    'general': {
        id: 'general',
        name: 'כללי ועזרה',
        icon: '❓',
        color: '#8b5cf6'
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ACTION_DATABASE, ACTION_CATEGORIES };
}
