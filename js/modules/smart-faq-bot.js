/**
 * העוזר המשפטי החכם - Smart Legal Assistant
 * מערכת חיפוש חכמה עם מאגר שאלות ותשובות מדויקות למשרד עו"ד
 * צבעי המערכת: #3b82f6 (כחול ראשי)
 */

class SmartFAQBot {
    constructor() {
        this.isOpen = false;
        this.chatHistory = [];
        this.currentContext = null;

        // מאגר שאלות ותשובות - מדויק לפי הקוד האמיתי
        this.faqDatabase = {
            // תיקים ולקוחות
            clients: [
                {
                    keywords: ['תיק חדש', 'הוסף תיק', 'לקוח חדש', 'יצירת תיק', 'תיק חדש',
                               'איך אני מוסיף לקוח', 'איך עושים תיק', 'לא יודע איך ליצור תיק',
                               'תעזור לי להוסיף לקוח', 'איך אני יוצר', 'תראה לי איך'],
                    question: 'איך ליצור תיק חדש?',
                    answer: `
                        <strong>יצירת תיק חדש:</strong>
                        <ol>
                            <li>לחץ על כפתור <strong>"תיק חדש"</strong> בסרגל הצדדי</li>
                            <li>בחר לקוח קיים או צור לקוח חדש</li>
                            <li>בחר סוג תיק: שעות, הליך משפטי, או מחיר קבוע</li>
                            <li>הזן כותרת תיק ומקצה עו"ד</li>
                            <li>בחר תאריך התחלה ולחץ "צור"</li>
                        </ol>
                        <em>💡 טיפ: אפשר גם ללחוץ Ctrl+N</em>
                    `,
                    category: 'clients',
                    guideType: 'create_client',
                    selector: '#smartPlusBtn'
                },
                {
                    keywords: ['חפש לקוח', 'מצא לקוח', 'איפה לקוח', 'חיפוש לקוח', 'מציאת תיק'],
                    question: 'איך לחפש לקוח או תיק?',
                    answer: `
                        <strong>חיפוש לקוח/תיק:</strong>
                        <p>בדיאלוג יצירת משימה או דיווח שעות, השתמש בשדה החיפוש:</p>
                        <ul>
                            <li>📝 שם הלקוח</li>
                            <li>🆔 תעודת זהות</li>
                            <li>📞 מספר טלפון</li>
                            <li>📧 כתובת אימייל</li>
                        </ul>
                        <em>החיפוש מיידי ומתעדכן תוך כדי הקלדה (300ms)</em>
                    `,
                    category: 'clients'
                },
                {
                    keywords: ['ערוך תיק', 'עדכן תיק', 'שנה תיק', 'עריכת לקוח'],
                    question: 'איך לערוך תיק?',
                    answer: `
                        <strong>עריכת תיק:</strong>
                        <ol>
                            <li>מצא את התיק ברשימה</li>
                            <li>לחץ על תפריט הפעולות (⋮)</li>
                            <li>בחר "ערוך"</li>
                            <li>עדכן את הפרטים הרצויים</li>
                            <li>לחץ "שמור"</li>
                        </ol>
                    `,
                    category: 'clients'
                },
                {
                    keywords: ['מחק תיק', 'הסר תיק', 'מחיקת לקוח'],
                    question: 'איך למחוק תיק?',
                    answer: `
                        <strong>מחיקת תיק:</strong>
                        <p>⚠️ <strong>אזהרה:</strong> מחיקת תיק תמחק את כל המשימות והשעות הקשורות!</p>
                        <ol>
                            <li>מצא את התיק ברשימה</li>
                            <li>לחץ על תפריט הפעולות (⋮)</li>
                            <li>בחר "מחק"</li>
                            <li>אשר את המחיקה</li>
                        </ol>
                    `,
                    category: 'clients'
                }
            ],

            // משימות תקצוב
            tasks: [
                {
                    keywords: ['משימה חדשה', 'הוסף משימה', 'יצירת משימה', 'תקצוב חדש', 'משימת תקצוב',
                               'איך אני מוסיף משימה', 'איך עושים משימה', 'לא יודע איך להוסיף משימה',
                               'תעזור לי ליצור משימה', 'איך אני יוצר משימה', 'תראה לי איך עושים משימה'],
                    question: 'איך ליצור משימת תקצוב?',
                    answer: `
                        <strong>יצירת משימת תקצוב:</strong>
                        <ol>
                            <li>עבור לטאב <strong>"תקצוב משימות"</strong></li>
                            <li>לחץ על כפתור <strong>"+"</strong> או "הוסף משימה"</li>
                            <li>בחר לקוח ותיק (2 שלבים)</li>
                            <li>הזן תיאור המשימה (לפחות 3 תווים)</li>
                            <li>הזן דקות משוערות (לפחות דקה אחת)</li>
                            <li>בחר תאריך יעד</li>
                            <li>לחץ <strong>"הוסף לתקצוב"</strong></li>
                        </ol>
                        <em>💡 המשימה תופיע ברשימת "פעילות בלבד"</em>
                    `,
                    category: 'tasks',
                    guideType: 'create_task',
                    selector: '#smartPlusBtn'
                },
                {
                    keywords: ['השלם משימה', 'סיים משימה', 'סמן משימה', 'השלמת משימה', 'משימה הושלמה'],
                    question: 'איך לסמן משימה כהושלמה?',
                    answer: `
                        <strong>השלמת משימה - 2 דרכים:</strong>
                        <p><strong>1. דרך מהירה:</strong></p>
                        <ul>
                            <li>לחץ על כפתור ה-✓ (V) הירוק ליד המשימה</li>
                        </ul>
                        <p><strong>2. דרך מפורטת:</strong></p>
                        <ol>
                            <li>לחץ על כרטיס המשימה להרחבה</li>
                            <li>לחץ על כפתור "השלם"</li>
                            <li>במודאל - צפה בסטטיסטיקות (זמן משוער vs בפועל)</li>
                            <li>הוסף הערות (אופציונלי)</li>
                            <li>לחץ "אשר"</li>
                        </ol>
                        <em>⏰ המערכת תתעד את הזמן בו המשימה הושלמה</em>
                    `,
                    category: 'tasks'
                },
                {
                    keywords: ['משימות פעילות', 'משימות שלי', 'מה יש לי', 'רשימת משימות', 'תצוגת משימות'],
                    question: 'איפה לראות את המשימות שלי?',
                    answer: `
                        <strong>תצוגות במסך תקצוב משימות:</strong>
                        <p><strong>סינון (Dropdown "הצג"):</strong></p>
                        <ul>
                            <li>🟢 <strong>פעילות בלבד</strong> (ברירת מחדל) - משימות שטרם הושלמו</li>
                            <li>✅ <strong>שהושלמו (חודש אחרון)</strong> - משימות מ-30 הימים האחרונים</li>
                            <li>📋 <strong>הכל</strong> - כל המשימות</li>
                        </ul>
                        <p><strong>תצוגות:</strong></p>
                        <ul>
                            <li>🎴 <strong>כרטיסיות</strong> - תצוגה חזותית עם פרטים</li>
                            <li>📊 <strong>טבלה</strong> - תצוגה קומפקטית</li>
                        </ul>
                        <em>אפשר גם לחפש משימות בשדה החיפוש</em>
                    `,
                    category: 'tasks'
                },
                {
                    keywords: ['סטטוס משימה', 'מצב משימה', 'פעילה', 'הושלמה'],
                    question: 'מה המשמעות של סטטוס משימה?',
                    answer: `
                        <strong>סטטוסים של משימות:</strong>
                        <ul>
                            <li>🟢 <strong>פעילה</strong> - משימה שטרם הושלמה (status: 'active')</li>
                            <li>✅ <strong>הושלמה</strong> - משימה שסומנה כהושלמה (status: 'הושלם')</li>
                        </ul>
                        <p>בנוסף, המערכת מעקבת אחרי:</p>
                        <ul>
                            <li>⏱️ דקות משוערות (estimatedMinutes)</li>
                            <li>✏️ דקות בפועל (actualMinutes)</li>
                            <li>📊 זמן שהושקע (timeSpent)</li>
                            <li>📅 תאריך יעד (deadline)</li>
                        </ul>
                    `,
                    category: 'tasks'
                }
            ],

            // שעתון
            timesheet: [
                {
                    keywords: ['דיווח שעות', 'רישום שעות', 'שעות עבודה', 'הוסף שעות', 'דיווח חדש',
                               'איך אני מדווח', 'איך עושים דיווח', 'לא יודע איך לדווח שעות',
                               'תעזור לי לדווח', 'איך אני מדווח שעות', 'תראה לי איך מדווחים'],
                    question: 'איך לדווח על שעות עבודה?',
                    answer: `
                        <strong>דיווח שעות עבודה:</strong>
                        <ol>
                            <li>עבור לטאב <strong>"שעתון"</strong></li>
                            <li>לחץ על כפתור <strong>"+"</strong> או "הוסף לשעתון"</li>
                            <li>בחר תאריך (ברירת מחדל: היום)</li>
                            <li>הזן דקות (1-999)</li>
                            <li>בחר לקוח ותיק (או סמן "פעילות משרדית פנימית")</li>
                            <li>תאר את הפעולה שביצעת (לפחות 3 תווים)</li>
                            <li>הוסף הערות (אופציונלי)</li>
                            <li>לחץ <strong>"הוסף לשעתון"</strong></li>
                        </ol>
                        <em>⚡ אפשר גם לדווח ישירות ממשימה שהושלמה</em>
                    `,
                    category: 'timesheet',
                    guideType: 'report_hours',
                    selector: '#smartPlusBtn'
                },
                {
                    keywords: ['סיכום שעות', 'כמה שעות', 'סך שעות', 'מכסת שעות', 'תקן שעות'],
                    question: 'איך לראות סיכום שעות?',
                    answer: `
                        <strong>סיכום שעות:</strong>
                        <p><strong>בראש מסך השעתון תמיד מוצג:</strong></p>
                        <ul>
                            <li>⏰ <strong>סך שעות השבוע</strong> - כמה עבדת השבוע</li>
                            <li>🎯 <strong>תקן שעות שבועי</strong> - היעד לפי תפקידך</li>
                            <li>📊 <strong>קו התקדמות</strong> - אחוז השלמה חזותי</li>
                        </ul>
                        <p><strong>דוחות מתקדמים:</strong></p>
                        <p>עבור לטאב "דוחות" לסינון לפי חודש/שנה/טווח תאריכים</p>
                    `,
                    category: 'timesheet'
                },
                {
                    keywords: ['ערוך שעות', 'שנה דיווח', 'תיקון שעות', 'עדכן דיווח'],
                    question: 'איך לערוך דיווח שעות קיים?',
                    answer: `
                        <strong>עריכת דיווח שעות:</strong>
                        <ol>
                            <li>מצא את הדיווח ברשימה</li>
                            <li>לחץ על כפתור העריכה ✏️</li>
                            <li>עדכן את השדות: דקות, תאריך, תיאור, לקוח</li>
                            <li>לחץ "עדכן"</li>
                        </ol>
                        <p>⚠️ <strong>הגבלה:</strong> ניתן לערוך רק דיווחים מהשבוע האחרון</p>
                    `,
                    category: 'timesheet'
                },
                {
                    keywords: ['תצוגות שעתון', 'סינון שעות', 'חודש אחרון', 'היום'],
                    question: 'איך לסנן את רשומות השעתון?',
                    answer: `
                        <strong>תצוגות וסינונים בשעתון:</strong>
                        <p><strong>Dropdown "הצג":</strong></p>
                        <ul>
                            <li>📅 <strong>חודש אחרון</strong> (ברירת מחדל) - רשומות מ-30 ימים</li>
                            <li>📆 <strong>היום בלבד</strong> - רק רשומות של היום</li>
                            <li>📋 <strong>הכל</strong> - כל הרשומות</li>
                        </ul>
                        <p><strong>תצוגות:</strong></p>
                        <ul>
                            <li>📊 <strong>טבלה</strong> (מומלץ) - תצוגה ברורה עם עמודות</li>
                            <li>🎴 <strong>כרטיסיות</strong> - תצוגה חזותית</li>
                        </ul>
                        <em>אפשר גם לחפש רשומות בשדה החיפוש</em>
                    `,
                    category: 'timesheet'
                },
                {
                    keywords: ['פעילות פנימית', 'משרדית פנימית', 'ללא לקוח'],
                    question: 'מה זה פעילות משרדית פנימית?',
                    answer: `
                        <strong>פעילות משרדית פנימית:</strong>
                        <p>זו פעילות שלא קשורה ללקוח ספציפי, כגון:</p>
                        <ul>
                            <li>ישיבות צוות</li>
                            <li>הדרכות פנימיות</li>
                            <li>עבודה מנהלית</li>
                        </ul>
                        <p><strong>איך לדווח:</strong></p>
                        <ol>
                            <li>בטופס דיווח שעות, סמן ✓ "פעילות משרדית פנימית"</li>
                            <li>כשמסומן - אין צורך לבחור לקוח/תיק</li>
                            <li>כשלא מסומן - חובה לבחור לקוח ותיק</li>
                        </ol>
                    `,
                    category: 'timesheet'
                }
            ],

            // כללי
            general: [
                {
                    keywords: ['קיצורי מקלדת', 'shortcuts', 'מקשים', 'קיצורים'],
                    question: 'אילו קיצורי מקלדת קיימים?',
                    answer: `
                        <strong>קיצורי מקלדת שימושיים:</strong>
                        <ul>
                            <li><kbd>Ctrl + N</kbd> - פתיחת טופס חדש (משימה/תיק)</li>
                            <li><kbd>Ctrl + F</kbd> - מעבר לשדה חיפוש</li>
                            <li><kbd>Ctrl + S</kbd> - שמירת טופס</li>
                            <li><kbd>Esc</kbd> - סגירת דיאלוג/מודאל</li>
                            <li><kbd>F1</kbd> - פתיחת הבוט החכם (אני!)</li>
                        </ul>
                        <em>💡 השתמש בהם לעבודה מהירה יותר</em>
                    `,
                    category: 'general'
                },
                {
                    keywords: ['שכחתי סיסמה', 'איפוס סיסמה', 'לא זוכר סיסמה', 'התחברות', 'אפס סיסמה'],
                    question: 'שכחתי את הסיסמה שלי',
                    answer: `
                        <strong>איפוס סיסמה:</strong>
                        <ol>
                            <li>במסך הכניסה, לחץ על "שכחתי סיסמה"</li>
                            <li>הזן את כתובת האימייל שלך</li>
                            <li>תקבל קישור לאיפוס באימייל</li>
                            <li>לחץ על הקישור והגדר סיסמה חדשה</li>
                        </ol>
                        <p>📧 <strong>לא קיבלת מייל?</strong> בדוק גם בתיקיית הספאם</p>
                        <p>⚠️ אם הבעיה נמשכת, פנה למנהל המערכת</p>
                    `,
                    category: 'general'
                },
                {
                    keywords: ['הרשאות', 'אין גישה', 'לא רואה', 'מנהל', 'עובד', 'גישה'],
                    question: 'למה אני לא רואה חלק מהאפשרויות?',
                    answer: `
                        <strong>הרשאות במערכת:</strong>
                        <p><strong>👤 עובד רגיל:</strong> רואה רק את המשימות והשעות שלו</p>
                        <p><strong>👑 מנהל:</strong> גישה מלאה לכל המערכת + דשבורד ניהולי</p>
                        <p>💼 צריך הרשאות נוספות? פנה למנהל המערכת</p>
                    `,
                    category: 'general'
                },
                {
                    keywords: ['דשבורד', 'סטטיסטיקות', 'נתונים', 'דוחות', 'ניהול'],
                    question: 'איפה הדשבורד והסטטיסטיקות?',
                    answer: `
                        <strong>דשבורד ניהולי:</strong>
                        <p>👑 זמין רק למנהלים</p>
                        <p>מציג: סטטיסטיקות, מעקב עובדים, סיכומי שעות וניתוח ביצועים</p>
                        <p><strong>איך לגשת:</strong> תפריט ראשי → "דשבורד ניהולי"</p>
                    `,
                    category: 'general'
                },
                {
                    keywords: ['בעיה טכנית', 'תקלה', 'לא עובד', 'שגיאה', 'באג', 'error'],
                    question: 'נתקלתי בבעיה טכנית',
                    answer: `
                        <strong>צעדים ראשונים:</strong>
                        <ol>
                            <li>🔄 רענן את הדף (F5)</li>
                            <li>🚪 צא והיכנס שוב</li>
                            <li>🧹 נקה מטמון (Ctrl+Shift+Del)</li>
                        </ol>
                        <p><strong>עדיין לא עובד?</strong> פנה למנהל עם תיאור הבעיה וצילום מסך</p>
                    `,
                    category: 'general'
                },
                {
                    keywords: ['כפתור פלוס', 'כפתור +', 'הוספה מהירה', 'smart plus'],
                    question: 'מה הכפתור + הגדול בראש המסך?',
                    answer: `
                        <strong>כפתור הפלוס החכם (+):</strong>
                        <p>זה כפתור "הוספה מהירה" שנמצא במרכז החלק העליון</p>
                        <p><strong>לחיצה עליו פותחת תפריט מהיר עם:</strong></p>
                        <ul>
                            <li>➕ הוסף משימת תקצוב</li>
                            <li>⏱️ דווח שעות</li>
                            <li>📁 צור תיק חדש</li>
                        </ul>
                        <p>💡 <strong>דרך מהירה:</strong> לחץ Ctrl+N לפתיחה מיידית</p>
                        <em>הפונקציה: openSmartForm() במערכת</em>
                    `,
                    category: 'general'
                },
                {
                    keywords: ['התראות', 'פעמון', 'notifications', 'הודעות'],
                    question: 'מה הפעמון בראש המסך?',
                    answer: `
                        <strong>מערכת התראות:</strong>
                        <p>הפעמון בחלק העליון מציג התראות חשובות:</p>
                        <ul>
                            <li>❌ <strong>חסומים</strong> - לקוחות ללא שעות נותרות</li>
                            <li>⚠️ <strong>קריטיים</strong> - לקוחות עם מעט שעות</li>
                            <li>⏱️ <strong>דחופים</strong> - משימות שעבר תאריך היעד</li>
                        </ul>
                        <p><strong>פעולות:</strong></p>
                        <ul>
                            <li>לחץ על התראה לפרטים</li>
                            <li>הסר התראה בודדת</li>
                            <li>נקה את כל ההתראות</li>
                        </ul>
                    `,
                    category: 'general'
                }
            ]
        };

        // הצעות לפי הקשר
        this.contextualSuggestions = {
            clients: [
                'איך ליצור תיק חדש?',
                'איך לחפש לקוח או תיק?',
                'איך לערוך תיק?'
            ],
            tasks: [
                'איך ליצור משימת תקצוב?',
                'איך לסמן משימה כהושלמה?',
                'איפה לראות את המשימות שלי?'
            ],
            timesheet: [
                'איך לדווח על שעות עבודה?',
                'איך לראות סיכום שעות?',
                'מה זה פעילות משרדית פנימית?'
            ],
            default: [
                'אילו קיצורי מקלדת קיימים?',
                'למה אני לא רואה חלק מהאפשרויות?',
                'איך ליצור תיק חדש?'
            ]
        };

        this.init();
    }

    init() {
        this.createBotUI();
        this.attachEventListeners();
        this.detectContext();
        this.addHighlightStyles(); // הוסף אנימציות להדגשה
        this.setupButtonDelegation(); // הוסף event delegation לכפתורים

        // F1 פותח את הבוט
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F1') {
                e.preventDefault();
                this.toggleBot();
            }
        });
    }

    /**
     * מגדיר event delegation לכפתורי פעולה
     */
    setupButtonDelegation() {
        // האזן לכל הלחיצות על כפתורים בתוך הודעות הבוט
        document.addEventListener('click', (e) => {
            // בדוק אם הלחיצה היא על כפתור פעולה
            if (e.target.classList.contains('bot-action-button')) {
                const action = e.target.dataset.action;
                const selector = e.target.dataset.selector;

                if (action) {
                    this.handleActionButton(action, selector || '');
                }
            }
        });
    }

    createBotUI() {
        const botHTML = `
            <!-- כפתור צף לפתיחת הבוט -->
            <div id="faq-bot-button" class="faq-bot-button" title="צ'אט עזרה - לחץ או F1">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
            </div>

            <!-- חלון הצ'אט -->
            <div id="faq-bot-container" class="faq-bot-container hidden">
                <div class="faq-bot-header">
                    <div class="faq-bot-header-content">
                        <div class="faq-bot-avatar">⚖️</div>
                        <div>
                            <h3>העוזר המשפטי החכם</h3>
                            <span class="faq-bot-status">תמיד כאן לעזור</span>
                        </div>
                    </div>
                    <div class="faq-bot-header-actions">
                        <button class="faq-bot-new-chat" id="faq-bot-new-chat" title="התחל שיחה חדשה">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h18M3 12h18M3 18h18"/>
                            </svg>
                        </button>
                        <button class="faq-bot-close" id="faq-bot-close">×</button>
                    </div>
                </div>

                <!-- שדה חיפוש -->
                <div class="faq-bot-search-container">
                    <div class="faq-bot-search-wrapper">
                        <svg class="faq-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="m21 21-4.35-4.35"/>
                        </svg>
                        <input
                            type="text"
                            id="faq-bot-search"
                            class="faq-bot-search-input"
                            placeholder="חפש שאלות..."
                            autocomplete="off"
                        />
                        <button class="faq-search-clear hidden" id="faq-search-clear">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="faq-bot-messages" id="faq-bot-messages">
                    <!-- הודעות יופיעו כאן -->
                </div>

                <div class="faq-bot-suggestions" id="faq-bot-suggestions">
                    <!-- שאלות והצעות יופיעו כאן -->
                </div>

                <!-- טאבים תחתונים -->
                <div class="faq-bot-tabs" id="faq-bot-tabs">
                    <button class="faq-tab active" data-tab="home">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                        <span>הביתה</span>
                    </button>
                    <button class="faq-tab" data-tab="notifications">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                        <span>התראות</span>
                        <span class="notification-badge hidden" id="faq-notification-badge">0</span>
                    </button>
                    <button class="faq-tab" data-tab="tour">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span>סיור</span>
                    </button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', botHTML);
        this.addBotStyles();
    }

    addBotStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Smart FAQ Bot - בצבעי המערכת */
            .faq-bot-button {
                position: fixed;
                bottom: 30px;
                left: 30px;
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
                transition: all 0.3s ease;
                z-index: 9998;
                color: white;
            }

            .faq-bot-button:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 30px rgba(59, 130, 246, 0.6);
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            }

            .faq-bot-button svg {
                width: 26px;
                height: 26px;
            }

            .faq-bot-container {
                position: fixed;
                bottom: 100px;
                left: 30px;
                width: 420px;
                max-width: calc(100vw - 60px);
                height: 600px;
                max-height: calc(100vh - 140px);
                background: white;
                border-radius: 16px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                display: flex;
                flex-direction: column;
                z-index: 9999;
                transition: all 0.3s ease;
                overflow: hidden;
                border: 1px solid #e5e7eb;
            }

            .faq-bot-container.hidden {
                opacity: 0;
                pointer-events: none;
                transform: translateY(20px);
            }

            .faq-bot-header {
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: white;
                padding: 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-radius: 16px 16px 0 0;
            }

            .faq-bot-header-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .faq-bot-avatar {
                width: 40px;
                height: 40px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
            }

            .faq-bot-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
            }

            .faq-bot-status {
                font-size: 12px;
                opacity: 0.9;
            }

            .faq-bot-header-actions {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .faq-bot-new-chat,
            .faq-bot-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                line-height: 1;
            }

            .faq-bot-close {
                font-size: 24px;
            }

            .faq-bot-new-chat:hover,
            .faq-bot-close:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.1);
            }

            /* ========== שדה חיפוש ========== */
            .faq-bot-search-container {
                padding: 12px 16px;
                background: white;
                border-bottom: 1px solid #e5e7eb;
            }

            .faq-bot-search-wrapper {
                position: relative;
                display: flex;
                align-items: center;
            }

            .faq-search-icon {
                position: absolute;
                right: 12px;
                color: #9ca3af;
                pointer-events: none;
            }

            .faq-bot-search-input {
                width: 100%;
                padding: 10px 40px 10px 40px;
                border: 2px solid #e5e7eb;
                border-radius: 10px;
                font-size: 14px;
                font-family: inherit;
                background: #f9fafb;
                transition: all 0.2s;
                color: #374151;
            }

            .faq-bot-search-input:focus {
                outline: none;
                border-color: #3b82f6;
                background: white;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }

            .faq-bot-search-input::placeholder {
                color: #9ca3af;
            }

            .faq-search-clear {
                position: absolute;
                left: 12px;
                background: transparent;
                border: none;
                cursor: pointer;
                padding: 4px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #9ca3af;
                transition: all 0.2s;
            }

            .faq-search-clear:hover {
                background: #f3f4f6;
                color: #374151;
            }

            .faq-search-clear.hidden {
                display: none;
            }

            /* ========== תוצאות חיפוש ========== */
            .faq-search-results-header {
                padding: 16px 20px;
                background: #f0f9ff;
                border-bottom: 1px solid #e0f2fe;
            }

            .faq-search-results-header h3 {
                margin: 0;
                font-size: 15px;
                font-weight: 600;
                color: #0369a1;
            }

            .faq-no-results {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 60px 30px;
                text-align: center;
            }

            .faq-no-results-icon {
                width: 80px;
                height: 80px;
                margin-bottom: 20px;
                color: #9ca3af;
                opacity: 0.6;
            }

            .faq-no-results-icon svg {
                width: 100%;
                height: 100%;
            }

            .faq-no-results h3 {
                margin: 0 0 12px 0;
                font-size: 20px;
                font-weight: 700;
                color: #374151;
            }

            .faq-no-results p {
                margin: 0;
                font-size: 14px;
                color: #6b7280;
                line-height: 1.6;
            }

            /* ========== הדגשת טקסט חיפוש ========== */
            .faq-highlight {
                background: #fef3c7;
                color: #92400e;
                padding: 2px 4px;
                border-radius: 3px;
                font-weight: 600;
            }

            .faq-bot-messages {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                display: none; /* מוסתר כברירת מחדל - יופיע רק בשיחה */
                flex-direction: column;
                gap: 12px;
                background: #f9fafb;
            }

            .faq-bot-messages:not(:empty) {
                display: flex; /* מופיע כשיש תוכן */
            }

            .faq-message {
                max-width: 85%;
                padding: 12px 16px;
                border-radius: 12px;
                animation: fadeInUp 0.3s ease;
                line-height: 1.6;
                font-size: 14px;
            }

            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .faq-message.user {
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: white;
                align-self: flex-end;
                border-radius: 12px 12px 0 12px;
            }

            .faq-message.bot {
                background: white;
                color: #374151;
                align-self: flex-start;
                border-radius: 12px 12px 12px 0;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                border: 1px solid #e5e7eb;
            }

            .faq-message.bot strong {
                color: #2563eb;
                display: block;
                margin-bottom: 8px;
                font-size: 15px;
            }

            .faq-message.bot ul,
            .faq-message.bot ol {
                margin: 8px 0;
                padding-right: 20px;
            }

            .faq-message.bot li {
                margin: 6px 0;
            }

            .faq-message.bot p {
                margin: 8px 0;
            }

            .faq-message.bot em {
                display: block;
                margin-top: 8px;
                font-size: 13px;
                color: #6b7280;
                font-style: italic;
            }

            .faq-message.bot kbd {
                background: #f3f4f6;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                padding: 2px 6px;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                color: #374151;
            }

            .faq-bot-suggestions {
                flex: 1;
                padding: 0;
                background: white;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
            }

            .faq-suggestion-chip {
                background: #f3f4f6;
                border: 1px solid #e5e7eb;
                padding: 8px 14px;
                border-radius: 20px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
                color: #374151;
            }

            .faq-suggestion-chip:hover {
                background: #3b82f6;
                color: white;
                border-color: #3b82f6;
                transform: translateY(-2px);
                box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
            }

            /* טאבים תחתונים - כמו Claude.ai */
            .faq-bot-tabs {
                display: flex;
                justify-content: space-around;
                align-items: center;
                border-top: 1px solid #e5e7eb;
                background: #f9fafb;
                padding: 12px 8px;
                min-height: 80px;
                flex-shrink: 0;
            }

            .faq-tab {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 14px 12px 10px 12px;
                background: transparent;
                border: none;
                cursor: pointer;
                transition: all 0.2s;
                color: #6b7280;
                font-size: 11px;
                font-weight: 500;
                border-radius: 8px;
                position: relative;
                max-width: 100px;
            }

            .faq-tab span {
                white-space: nowrap;
                text-overflow: ellipsis;
                overflow: hidden;
                max-width: 100%;
            }

            .faq-tab svg {
                width: 20px;
                height: 20px;
                stroke-width: 2;
                transition: all 0.2s;
                flex-shrink: 0;
                display: block;
                margin: 0 auto;
            }

            .faq-tab:hover {
                background: #e5e7eb;
                color: #374151;
            }

            .faq-tab.active {
                color: #3b82f6;
                background: white;
            }

            .faq-tab.active svg {
                stroke: #3b82f6;
            }

            /* תג מספר ההתראות */
            .notification-badge {
                position: absolute;
                top: 4px;
                right: 8px;
                background: #ef4444;
                color: white;
                font-size: 10px;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: 10px;
                min-width: 18px;
                text-align: center;
            }

            .notification-badge.hidden {
                display: none;
            }

            .faq-typing {
                background: white;
                padding: 12px 16px;
                border-radius: 12px 12px 12px 0;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                align-self: flex-start;
                display: flex;
                gap: 4px;
                border: 1px solid #e5e7eb;
            }

            .faq-typing-dot {
                width: 8px;
                height: 8px;
                background: #3b82f6;
                border-radius: 50%;
                animation: typingDot 1.4s infinite;
            }

            .faq-typing-dot:nth-child(2) {
                animation-delay: 0.2s;
            }

            .faq-typing-dot:nth-child(3) {
                animation-delay: 0.4s;
            }

            @keyframes typingDot {
                0%, 60%, 100% {
                    transform: translateY(0);
                    opacity: 0.4;
                }
                30% {
                    transform: translateY(-10px);
                    opacity: 1;
                }
            }

            /* Scrollbar styling */
            .faq-bot-messages::-webkit-scrollbar,
            .faq-bot-suggestions::-webkit-scrollbar {
                width: 6px;
            }

            .faq-bot-messages::-webkit-scrollbar-track,
            .faq-bot-suggestions::-webkit-scrollbar-track {
                background: #f3f4f6;
            }

            .faq-bot-messages::-webkit-scrollbar-thumb,
            .faq-bot-suggestions::-webkit-scrollbar-thumb {
                background: #d1d5db;
                border-radius: 3px;
            }

            .faq-bot-messages::-webkit-scrollbar-thumb:hover,
            .faq-bot-suggestions::-webkit-scrollbar-thumb:hover {
                background: #9ca3af;
            }

            /* ========== אקורדיון מתרחב - כמו Claude.ai ========== */
            .faq-accordion-container {
                display: flex;
                flex-direction: column;
                gap: 2px;
                background: #e5e7eb;
            }

            .faq-accordion-item {
                background: white;
                transition: all 0.3s ease;
            }

            .faq-accordion-header {
                width: 100%;
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px;
                background: transparent;
                border: none;
                cursor: pointer;
                text-align: right;
                transition: all 0.2s;
            }

            .faq-accordion-item:not(.special) .faq-accordion-header:hover {
                background: #f9fafb;
            }

            .faq-accordion-icon {
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
            }

            .faq-accordion-icon svg {
                color: #6b7280;
            }

            .faq-accordion-title-group {
                flex: 1;
            }

            .faq-accordion-title {
                font-size: 16px;
                font-weight: 600;
                color: #1f2937;
                margin-bottom: 4px;
            }

            .faq-accordion-subtitle {
                font-size: 13px;
                color: #6b7280;
            }

            .faq-accordion-chevron {
                color: #9ca3af;
                flex-shrink: 0;
                transition: transform 0.3s ease;
            }

            .faq-accordion-item.expanded .faq-accordion-chevron,
            .faq-accordion-item.active .faq-accordion-arrow {
                transform: rotate(180deg);
            }

            .faq-accordion-content {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.3s ease;
            }

            .faq-accordion-item.expanded .faq-accordion-content,
            .faq-accordion-content.show {
                max-height: 2000px;
            }

            /* תצוגה מיוחדת לתוצאות חיפוש */
            .faq-accordion-count {
                background: #e0f2fe;
                color: #0369a1;
                padding: 4px 10px;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 600;
            }

            .faq-accordion-arrow {
                color: #9ca3af;
                flex-shrink: 0;
                transition: transform 0.3s ease;
                margin-right: auto;
            }

            .faq-accordion-questions {
                padding: 8px 0;
            }

            /* שאלות בתוך קטגוריה */
            .faq-question-item {
                background: white;
                transition: all 0.3s ease;
            }

            .faq-question-header {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 14px 20px;
                background: transparent;
                border: none;
                border-top: 1px solid #f3f4f6;
                cursor: pointer;
                text-align: right;
                font-size: 14px;
                font-weight: 500;
                color: #374151;
                transition: all 0.2s;
            }

            .faq-question-header:hover {
                background: #f9fafb;
                color: #3b82f6;
            }

            .faq-question-chevron {
                color: #9ca3af;
                flex-shrink: 0;
                transition: transform 0.3s ease;
            }

            .faq-question-item.expanded .faq-question-chevron {
                transform: rotate(180deg);
            }

            .faq-question-answer {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.3s ease;
                padding: 0 20px;
            }

            .faq-question-item.expanded .faq-question-answer {
                max-height: 1500px;
                padding: 20px 24px 24px 24px;
                background: #f9fafb;
                border-top: 1px solid #e5e7eb;
                line-height: 1.7;
            }

            .faq-question-answer strong {
                display: block;
                font-size: 15px;
                font-weight: 600;
                color: #1f2937;
                margin-bottom: 12px;
            }

            .faq-question-answer p {
                margin: 12px 0;
                color: #374151;
                font-size: 14px;
            }

            .faq-question-answer ul,
            .faq-question-answer ol {
                margin: 12px 0;
                padding-right: 24px;
                color: #374151;
                font-size: 14px;
            }

            .faq-question-answer li {
                margin: 8px 0;
                line-height: 1.6;
            }

            .faq-question-answer em {
                display: block;
                margin-top: 12px;
                padding: 12px;
                background: white;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
                font-size: 13px;
                color: #6b7280;
                font-style: normal;
            }

            .faq-question-answer kbd {
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                padding: 2px 6px;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                color: #374151;
            }

            /* כפתור חזור */
            .faq-back-header {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px;
                border-bottom: 1px solid #e5e7eb;
                background: #f9fafb;
            }

            .faq-back-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 12px;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                color: #374151;
                transition: all 0.2s;
            }

            .faq-back-btn:hover {
                background: #f3f4f6;
                border-color: #3b82f6;
                color: #3b82f6;
            }

            .faq-back-btn svg {
                flex-shrink: 0;
            }

            .faq-back-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #1f2937;
            }

            /* רשימת שאלות */
            .faq-question-list {
                display: flex;
                flex-direction: column;
                gap: 6px;
                padding: 16px;
            }

            .faq-question-btn {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 14px 16px;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                cursor: pointer;
                text-align: right;
                font-size: 14px;
                color: #374151;
                transition: all 0.2s;
            }

            .faq-question-btn:hover {
                background: #f9fafb;
                border-color: #3b82f6;
                color: #3b82f6;
            }

            .faq-question-btn svg {
                color: #9ca3af;
                flex-shrink: 0;
                transition: transform 0.3s ease;
            }

            .faq-question-item .faq-question-btn svg {
                transform: rotate(0deg);
            }

            .faq-answer.expanded + .faq-question-btn svg,
            .faq-question-item .faq-question-btn:hover svg {
                transform: rotate(180deg);
            }

            /* תשובות בתוצאות חיפוש */
            .faq-answer {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.3s ease;
            }

            .faq-answer.expanded {
                max-height: 1000px;
            }

            .faq-answer-content {
                padding: 20px 24px;
                background: #f9fafb;
                border-top: 1px solid #e5e7eb;
                font-size: 14px;
                line-height: 1.8;
                color: #374151;
            }

            .faq-answer-content strong {
                display: block;
                color: #1f2937;
                font-weight: 700;
                font-size: 15px;
                margin-bottom: 16px;
            }

            .faq-answer-content ol,
            .faq-answer-content ul {
                margin: 16px 0;
                padding-right: 24px;
            }

            .faq-answer-content ol {
                counter-reset: item;
            }

            .faq-answer-content li {
                margin: 12px 0;
                padding-right: 4px;
                line-height: 1.7;
            }

            .faq-answer-content ol li {
                position: relative;
            }

            .faq-answer-content p {
                margin: 16px 0;
                line-height: 1.7;
            }

            .faq-answer-content em {
                display: block;
                margin-top: 16px;
                padding: 12px 16px;
                background: #dbeafe;
                border-right: 3px solid #3b82f6;
                border-radius: 6px;
                color: #1e40af;
                font-style: normal;
                font-size: 13px;
            }

            .faq-answer-content kbd {
                display: inline-block;
                padding: 3px 8px;
                background: #1f2937;
                color: white;
                border-radius: 4px;
                font-family: monospace;
                font-size: 12px;
                font-weight: 600;
            }

            /* פעולות תשובה */
            .faq-answer-actions {
                padding: 16px;
                border-top: 1px solid #e5e7eb;
            }

            .faq-back-btn-large {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                width: 100%;
                padding: 12px 20px;
                background: white;
                border: 2px solid #e5e7eb;
                border-radius: 10px;
                cursor: pointer;
                font-size: 15px;
                font-weight: 500;
                color: #374151;
                transition: all 0.2s;
            }

            .faq-back-btn-large:hover {
                background: #f9fafb;
                border-color: #3b82f6;
                color: #3b82f6;
            }

            /* ========== התראות ========== */
            .faq-no-notifications {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 60px 20px;
                text-align: center;
                color: #6b7280;
            }

            .faq-no-notifications-icon {
                margin-bottom: 16px;
                opacity: 0.5;
                display: flex;
                justify-content: center;
            }

            .faq-no-notifications-icon svg {
                color: #9ca3af;
            }

            .faq-no-notifications h3 {
                margin: 0 0 8px 0;
                font-size: 18px;
                font-weight: 600;
                color: #374151;
            }

            .faq-no-notifications p {
                margin: 0;
                font-size: 14px;
            }

            .faq-notifications-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid #e5e7eb;
                background: #f9fafb;
            }

            .faq-notifications-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: #374151;
            }

            .faq-clear-all-btn {
                padding: 6px 12px;
                background: transparent;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                color: #6b7280;
                cursor: pointer;
                transition: all 0.2s;
            }

            .faq-clear-all-btn:hover {
                background: white;
                border-color: #ef4444;
                color: #ef4444;
            }

            .faq-notifications-list {
                display: flex;
                flex-direction: column;
                gap: 1px;
                background: #e5e7eb;
            }

            .faq-notification-item {
                display: flex;
                gap: 12px;
                padding: 16px;
                background: white;
                position: relative;
                transition: all 0.2s;
            }

            .faq-notification-item:hover {
                background: #f9fafb;
            }

            .faq-notification-item.urgent {
                border-right: 4px solid #ef4444;
            }

            .faq-notification-icon {
                flex-shrink: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .faq-notification-icon svg {
                color: #6b7280;
            }

            .faq-notification-item.blocked .faq-notification-icon svg {
                color: #ef4444;
            }

            .faq-notification-item.critical .faq-notification-icon svg {
                color: #f59e0b;
            }

            .faq-notification-item.urgent .faq-notification-icon svg {
                color: #3b82f6;
            }

            .faq-notification-item.success .faq-notification-icon svg {
                color: #10b981;
            }

            .faq-notification-content {
                flex: 1;
            }

            .faq-notification-title {
                font-size: 14px;
                font-weight: 600;
                color: #374151;
                margin-bottom: 4px;
            }

            .faq-notification-description {
                font-size: 13px;
                color: #6b7280;
                line-height: 1.5;
                margin-bottom: 6px;
            }

            .faq-notification-time {
                font-size: 11px;
                color: #9ca3af;
            }

            .faq-notification-remove {
                position: absolute;
                top: 8px;
                left: 8px;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: transparent;
                border: none;
                border-radius: 50%;
                font-size: 20px;
                color: #9ca3af;
                cursor: pointer;
                transition: all 0.2s;
            }

            .faq-notification-remove:hover {
                background: #fee2e2;
                color: #ef4444;
            }

            /* ========== טאב סיור ========== */
            .faq-tour-screen {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
                padding: 50px 30px 60px 30px;
                text-align: center;
                min-height: 400px;
            }

            .faq-tour-icon {
                margin-top: 10px;
                margin-bottom: 24px;
                opacity: 0.8;
            }

            .faq-tour-icon svg {
                color: #3b82f6;
                display: block;
            }

            .faq-tour-screen h2 {
                margin: 0 0 12px 0;
                font-size: 24px;
                font-weight: 700;
                color: #1f2937;
            }

            .faq-tour-screen p {
                margin: 0 0 32px 0;
                font-size: 15px;
                color: #6b7280;
                line-height: 1.6;
                max-width: 320px;
            }

            .faq-tour-start-btn {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 14px 32px;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: white;
                border: none;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }

            .faq-tour-start-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
            }

            .faq-tour-start-btn:active {
                transform: translateY(0);
            }

            .faq-tour-start-btn svg {
                flex-shrink: 0;
            }

            .faq-tour-features {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-top: 32px;
                padding-top: 32px;
                border-top: 1px solid #e5e7eb;
                width: 100%;
                max-width: 280px;
            }

            .faq-tour-feature {
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 14px;
                color: #6b7280;
            }

            .faq-tour-feature svg {
                color: #9ca3af;
                flex-shrink: 0;
            }

            /* responsive */
            @media (max-width: 768px) {
                .faq-bot-container {
                    left: 15px;
                    right: 15px;
                    width: auto;
                    bottom: 100px;
                }

                .faq-bot-button {
                    left: 15px;
                    bottom: 15px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    attachEventListeners() {
        const button = document.getElementById('faq-bot-button');
        const closeBtn = document.getElementById('faq-bot-close');
        const newChatBtn = document.getElementById('faq-bot-new-chat');
        const tabs = document.querySelectorAll('.faq-tab');
        const searchInput = document.getElementById('faq-bot-search');
        const searchClear = document.getElementById('faq-search-clear');

        button.addEventListener('click', () => this.toggleBot());
        closeBtn.addEventListener('click', () => this.toggleBot());
        newChatBtn.addEventListener('click', () => this.startNewChat());

        // event listeners לטאבים
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // חיפוש בזמן אמת
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;

            // הצג/הסתר כפתור X
            if (query) {
                searchClear.classList.remove('hidden');
            } else {
                searchClear.classList.add('hidden');
            }

            // Debounce - המתן 300ms אחרי שהמשתמש מפסיק להקליד
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.performSearch(query);
            }, 300);
        });

        // כפתור ניקוי החיפוש
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.classList.add('hidden');
            this.performSearch(''); // הצג הכל
            searchInput.focus();
        });

        // Enter לחיפוש מיידי
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                this.performSearch(e.target.value);
            }
        });
    }

    /**
     * ביצוע חיפוש חכם בכל השאלות והתשובות
     */
    performSearch(query) {
        const suggestionsContainer = document.getElementById('faq-bot-suggestions');

        // אם אין שאילתה - הצג את כל הקטגוריות
        if (!query || query.trim() === '') {
            this.showQuestionCategories();
            return;
        }

        const searchTerm = query.trim().toLowerCase();
        const resultsMap = {};

        // חפש בכל הקטגוריות ב-faqDatabase
        for (const [categoryKey, questionsArray] of Object.entries(this.faqDatabase)) {
            // questionsArray הוא מערך של שאלות
            questionsArray.forEach((questionData, index) => {
                const questionText = questionData.question.toLowerCase();
                const answerText = questionData.answer.toLowerCase();
                const keywords = questionData.keywords ? questionData.keywords.map(k => k.toLowerCase()) : [];

                // בדוק התאמה בשאלה, תשובה, או מילות מפתח
                if (
                    questionText.includes(searchTerm) ||
                    answerText.includes(searchTerm) ||
                    keywords.some(keyword => keyword.includes(searchTerm))
                ) {
                    // השתמש ב-category מהשאלה או ב-categoryKey
                    const categoryId = questionData.category || categoryKey;

                    // אתחל את הקטגוריה אם עדיין לא קיימת
                    if (!resultsMap[categoryId]) {
                        resultsMap[categoryId] = {
                            categoryId,
                            categoryName: this.getCategoryName(categoryId),
                            categoryIcon: this.getCategoryIcon(categoryId),
                            questions: []
                        };
                    }

                    // הוסף את השאלה לקטגוריה
                    resultsMap[categoryId].questions.push({
                        questionId: `${categoryKey}-${index}`,
                        questionData,
                        categoryId
                    });
                }
            });
        }

        // המר את ה-Map למערך
        const results = Object.values(resultsMap);

        // הצג תוצאות
        this.displaySearchResults(results, searchTerm);
    }

    /**
     * הצגת תוצאות חיפוש
     */
    displaySearchResults(results, searchTerm) {
        const suggestionsContainer = document.getElementById('faq-bot-suggestions');

        if (results.length === 0) {
            suggestionsContainer.innerHTML = `
                <div class="faq-no-results">
                    <div class="faq-no-results-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="m21 21-4.35-4.35"/>
                        </svg>
                    </div>
                    <h3>לא נמצאו תוצאות</h3>
                    <p>נסה לחפש במילים אחרות או בדוק את הקטגוריות</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="faq-search-results-header">
                <h3>נמצאו ${this.countTotalQuestions(results)} תוצאות עבור "${this.escapeHtml(searchTerm)}"</h3>
            </div>
            <div class="faq-accordion-container">
        `;

        // הצג כל קטגוריה עם השאלות שנמצאו
        results.forEach((category, index) => {
            html += `
                <div class="faq-accordion-item ${index === 0 ? 'active' : ''}">
                    <button class="faq-accordion-header" onclick="smartFAQBot.toggleAccordion('search-${category.categoryId}')">
                        <div class="faq-accordion-title">
                            ${category.categoryIcon}
                            <span>${this.escapeHtml(category.categoryName)}</span>
                        </div>
                        <div class="faq-accordion-count">${category.questions.length}</div>
                        <svg class="faq-accordion-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>
                    <div class="faq-accordion-content ${index === 0 ? 'show' : ''}" id="search-${category.categoryId}">
            `;

            // הצג כל שאלה בקטגוריה
            category.questions.forEach(item => {
                const questionHighlighted = this.highlightText(item.questionData.question, searchTerm);
                const answerHighlighted = this.highlightTextInHtml(item.questionData.answer, searchTerm);
                html += `
                    <div class="faq-question-item">
                        <button class="faq-question-btn" onclick="smartFAQBot.toggleQuestion('search-q-${category.categoryId}-${item.questionId}')">
                            <span>${questionHighlighted}</span>
                            <svg class="faq-question-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </button>
                        <div class="faq-answer" id="search-q-${category.categoryId}-${item.questionId}">
                            <div class="faq-answer-content">
                                ${answerHighlighted}
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        html += '</div>';
        suggestionsContainer.innerHTML = html;
    }

    /**
     * הדגשת טקסט חיפוש (לשאלות - טקסט רגיל)
     */
    highlightText(text, searchTerm) {
        if (!searchTerm) return this.escapeHtml(text);

        const escapedText = this.escapeHtml(text);
        const escapedTerm = this.escapeHtml(searchTerm);
        const regex = new RegExp(`(${escapedTerm})`, 'gi');

        return escapedText.replace(regex, '<mark class="faq-highlight">$1</mark>');
    }

    /**
     * הדגשת טקסט חיפוש בתוך HTML (לתשובות)
     */
    highlightTextInHtml(html, searchTerm) {
        if (!searchTerm || !html) return html;

        // הדגש רק בתוך תוכן טקסט, לא בתוך תגים
        const regex = new RegExp(`(${this.escapeRegex(searchTerm)})`, 'gi');

        // נשתמש בפונקציה שמחליפה רק טקסט ולא תגים
        return html.replace(regex, '<mark class="faq-highlight">$1</mark>');
    }

    /**
     * Escape תווים מיוחדים ב-regex
     */
    escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * ספירת סך כל השאלות בתוצאות
     */
    countTotalQuestions(results) {
        return results.reduce((total, category) => total + category.questions.length, 0);
    }

    /**
     * קבלת שם קטגוריה
     */
    getCategoryName(categoryId) {
        const names = {
            'clients': 'תיקים ולקוחות',
            'tasks': 'משימות ותקצוב',
            'timesheet': 'שעתון ודיווח',
            'general': 'כללי',
            'system': 'הגדרות ומערכת',
            'reports': 'דוחות וניתוחים'
        };

        return names[categoryId] || 'כללי';
    }

    /**
     * קבלת אייקון קטגוריה
     */
    getCategoryIcon(categoryId) {
        const icons = {
            'clients': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>`,
            'tasks': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>`,
            'timesheet': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
            </svg>`,
            'general': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>`,
            'system': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6m5.2-14.2l-4.2 4.2m0 6l4.2 4.2M23 12h-6m-6 0H1m14.2 5.2l-4.2-4.2m0-6l-4.2-4.2"/>
            </svg>`,
            'reports': `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>`
        };

        return icons[categoryId] || icons['general'];
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * מעבר בין טאבים
     */
    switchTab(tabName) {
        // עדכן את הטאבים הפעילים
        const tabs = document.querySelectorAll('.faq-tab');
        tabs.forEach(tab => {
            if (tab.getAttribute('data-tab') === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // הצג תוכן מתאים
        const messagesContainer = document.getElementById('faq-bot-messages');
        const suggestionsContainer = document.getElementById('faq-bot-suggestions');

        switch(tabName) {
            case 'home':
                this.showHomeTab();
                break;
            case 'notifications':
                this.showNotificationsTab();
                break;
            case 'tour':
                this.showTourTab();
                break;
        }
    }

    /**
     * הצגת טאב הבית - שאלות נפוצות
     */
    showHomeTab() {
        const messagesContainer = document.getElementById('faq-bot-messages');
        const suggestionsContainer = document.getElementById('faq-bot-suggestions');

        // נקה הודעות קודמות
        messagesContainer.innerHTML = '';

        // הצג קטגוריות שאלות
        this.showQuestionCategories();
    }

    /**
     * הצגת טאב התראות
     */
    showNotificationsTab() {
        const messagesContainer = document.getElementById('faq-bot-messages');
        const suggestionsContainer = document.getElementById('faq-bot-suggestions');

        // נקה
        messagesContainer.innerHTML = '';

        // קבל התראות מהמערכת
        const notifications = window.notificationBell ? window.notificationBell.notifications : [];

        let html = '';

        if (notifications.length === 0) {
            html = `
                <div class="faq-no-notifications">
                    <div class="faq-no-notifications-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                    </div>
                    <h3>אין התראות</h3>
                    <p>כל ההתראות יופיעו כאן</p>
                </div>
            `;
        } else {
            html = `
                <div class="faq-notifications-header">
                    <h3>התראות (${notifications.length})</h3>
                    <button class="faq-clear-all-btn" onclick="smartFAQBot.clearAllNotifications()">
                        נקה הכל
                    </button>
                </div>
                <div class="faq-notifications-list">
            `;

            const iconMap = {
                blocked: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>`,
                critical: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>`,
                urgent: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>`,
                success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>`,
                info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>`
            };

            notifications.forEach(notification => {
                const icon = iconMap[notification.type] || iconMap.info;
                const urgentClass = notification.urgent ? 'urgent' : '';

                html += `
                    <div class="faq-notification-item ${notification.type} ${urgentClass}">
                        <div class="faq-notification-icon">${icon}</div>
                        <div class="faq-notification-content">
                            <div class="faq-notification-title">${notification.title}</div>
                            <div class="faq-notification-description">${notification.description}</div>
                            <div class="faq-notification-time">${notification.time}</div>
                        </div>
                        <button class="faq-notification-remove" onclick="smartFAQBot.removeNotification(${notification.id})">
                            ×
                        </button>
                    </div>
                `;
            });

            html += `</div>`;
        }

        suggestionsContainer.innerHTML = html;

        // עדכן את הבאדג'
        this.updateNotificationBadge();
    }

    /**
     * עדכון הבאדג' של ההתראות
     */
    updateNotificationBadge() {
        const badge = document.getElementById('faq-notification-badge');
        const count = window.notificationBell ? window.notificationBell.notifications.length : 0;

        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }

    /**
     * הסרת התראה בודדת
     */
    removeNotification(id) {
        if (window.notificationBell) {
            window.notificationBell.removeNotification(id);
            this.showNotificationsTab(); // רענן תצוגה
        }
    }

    /**
     * ניקוי כל ההתראות
     */
    clearAllNotifications() {
        if (window.notificationBell) {
            window.notificationBell.clearAllNotifications();
            this.showNotificationsTab(); // רענן תצוגה
        }
    }

    /**
     * הצגת טאב סיור
     */
    showTourTab() {
        const messagesContainer = document.getElementById('faq-bot-messages');
        const suggestionsContainer = document.getElementById('faq-bot-suggestions');

        // נקה
        messagesContainer.innerHTML = '';

        // הצג מסך סיור
        let html = `
            <div class="faq-tour-screen">
                <div class="faq-tour-icon">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <h2>סיור במערכת</h2>
                <p>למידה מודרכת של כל התכונות והיכולות של מערכת ניהול משרד עורכי הדין</p>

                <button class="faq-tour-start-btn" onclick="smartFAQBot.startSystemTourFromBot()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    התחל סיור
                </button>

                <div class="faq-tour-features">
                    <div class="faq-tour-feature">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                        <span>9 שלבים מודרכים</span>
                    </div>
                    <div class="faq-tour-feature">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span>כ-5 דקות</span>
                    </div>
                    <div class="faq-tour-feature">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <span>למידה אינטראקטיבית</span>
                    </div>
                </div>
            </div>
        `;

        suggestionsContainer.innerHTML = html;
    }

    /**
     * מתחיל שיחה חדשה - מנקה את ההיסטוריה
     */
    startNewChat() {
        // נקה את כל ההודעות
        const messagesContainer = document.getElementById('faq-bot-messages');
        messagesContainer.innerHTML = '';

        // נקה היסטוריה
        this.chatHistory = [];

        // חזור לטאב הבית
        this.switchTab('home');
    }

    toggleBot() {
        const container = document.getElementById('faq-bot-container');
        this.isOpen = !this.isOpen;

        if (this.isOpen) {
            container.classList.remove('hidden');

            // עדכן סטטוס עם שם המשתמש
            const userName = this.getUserName();
            const statusElement = document.querySelector('.faq-bot-status');
            if (statusElement && userName) {
                statusElement.textContent = `עוזר ל${userName}`;
            }

            // עדכן באדג' התראות
            this.updateNotificationBadge();

            // הצג טאב הבית אם זו הפעם הראשונה
            if (this.chatHistory.length === 0) {
                this.showHomeTab();
            }
        } else {
            container.classList.add('hidden');
        }
    }

    /**
     * הצגת קטגוריות שאלות - דף הבית עם אקורדיון מתרחב
     */
    showQuestionCategories() {
        const suggestionsContainer = document.getElementById('faq-bot-suggestions');

        let html = '<div class="faq-accordion-container">';

        const categories = [
            {
                id: 'clients',
                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>`,
                title: 'תיקים ולקוחות',
                count: 4
            },
            {
                id: 'tasks',
                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 5H2v7h7V5z"/>
                    <path d="M9 14H2v7h7v-7z"/>
                    <path d="M22 5h-7v7h7V5z"/>
                    <path d="M22 14h-7v7h7v-7z"/>
                </svg>`,
                title: 'משימות ותקצוב',
                count: 6
            },
            {
                id: 'timesheet',
                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>`,
                title: 'שעתון ודיווח',
                count: 5
            },
            {
                id: 'reports',
                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>`,
                title: 'דוחות וניתוחים',
                count: 3
            },
            {
                id: 'system',
                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v6m0 6v6m5.2-14.8l-4.2 4.2m0 6l4.2 4.2M23 12h-6m-6 0H1m14.8 5.2l-4.2-4.2m0-6l-4.2-4.2"/>
                </svg>`,
                title: 'הגדרות ומערכת',
                count: 4
            }
        ];

        categories.forEach(cat => {
            // מצא את כל השאלות בקטגוריה
            const categoryQuestions = [];
            for (const faqCat in this.faqDatabase) {
                this.faqDatabase[faqCat].forEach(item => {
                    if (item.category === cat.id || faqCat === cat.id) {
                        categoryQuestions.push(item);
                    }
                });
            }

            html += `
                <div class="faq-accordion-item" data-category="${cat.id}">
                    <button class="faq-accordion-header" onclick="smartFAQBot.toggleCategory('${cat.id}')">
                        <div class="faq-accordion-icon">${cat.icon}</div>
                        <div class="faq-accordion-title-group">
                            <div class="faq-accordion-title">${cat.title}</div>
                            <div class="faq-accordion-subtitle">${categoryQuestions.length} מאמרים</div>
                        </div>
                        <svg class="faq-accordion-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>
                    <div class="faq-accordion-content">
                        <div class="faq-accordion-questions">
            `;

            // שאלות בתוך הקטגוריה
            categoryQuestions.forEach((item, index) => {
                const questionId = `q-${cat.id}-${index}`;
                html += `
                    <div class="faq-question-item" data-question="${questionId}">
                        <button class="faq-question-header" onclick="smartFAQBot.toggleQuestion('${questionId}', '${cat.id}', ${index})">
                            <span>${item.question}</span>
                            <svg class="faq-question-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </button>
                        <div class="faq-question-answer">
                            ${item.answer}
                        </div>
                    </div>
                `;
            });

            html += `
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        suggestionsContainer.innerHTML = html;
    }

    /**
     * פתיחה/סגירה של אקורדיון בתוצאות חיפוש
     */
    toggleAccordion(contentId) {
        const content = document.getElementById(contentId);
        if (!content) return;

        const accordionItem = content.parentElement;
        const isActive = accordionItem.classList.contains('active');

        if (isActive) {
            accordionItem.classList.remove('active');
            content.classList.remove('show');
        } else {
            accordionItem.classList.add('active');
            content.classList.add('show');
        }
    }

    /**
     * פתיחה/סגירה של קטגוריה (אקורדיון)
     */
    toggleCategory(categoryId) {
        const item = document.querySelector(`.faq-accordion-item[data-category="${categoryId}"]`);
        if (!item) return;

        const isExpanded = item.classList.contains('expanded');

        // סגור את כל הקטגוריות האחרות
        document.querySelectorAll('.faq-accordion-item').forEach(i => {
            if (i !== item) {
                i.classList.remove('expanded');
            }
        });

        // סגור את כל השאלות הפתוחות
        document.querySelectorAll('.faq-question-item').forEach(q => {
            q.classList.remove('expanded');
        });

        // פתח/סגור את הקטגוריה הנוכחית
        if (isExpanded) {
            item.classList.remove('expanded');
        } else {
            item.classList.add('expanded');

            // גלילה חלקה לקטגוריה
            setTimeout(() => {
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
        }
    }

    /**
     * פתיחה/סגירה של שאלה (אקורדיון)
     */
    toggleQuestion(questionId, categoryId, questionIndex) {
        // בדוק אם זו שאלה מתוצאות חיפוש (ID מתחיל ב-search-q-)
        if (questionId.startsWith('search-q-')) {
            const answerDiv = document.getElementById(questionId);
            if (!answerDiv) return;

            const isExpanded = answerDiv.classList.contains('expanded');

            // סגור את כל התשובות האחרות בתוצאות החיפוש
            document.querySelectorAll('.faq-answer').forEach(a => {
                if (a !== answerDiv) {
                    a.classList.remove('expanded');
                }
            });

            // פתח/סגור את התשובה הנוכחית
            if (isExpanded) {
                answerDiv.classList.remove('expanded');
            } else {
                answerDiv.classList.add('expanded');
                setTimeout(() => {
                    answerDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 300);
            }
            return;
        }

        // לוגיקה רגילה לשאלות בעמוד הבית
        const item = document.querySelector(`.faq-question-item[data-question="${questionId}"]`);
        if (!item) return;

        const isExpanded = item.classList.contains('expanded');

        // סגור את כל השאלות האחרות
        document.querySelectorAll('.faq-question-item').forEach(q => {
            if (q !== item) {
                q.classList.remove('expanded');
            }
        });

        // פתח/סגור את השאלה הנוכחית
        if (isExpanded) {
            item.classList.remove('expanded');
        } else {
            item.classList.add('expanded');

            // גלילה חלקה לשאלה
            setTimeout(() => {
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
        }
    }

    /**
     * הפעלת סיור מערכת מתוך הבוט
     */
    startSystemTourFromBot() {
        // סגור את הבוט
        if (this.isOpen) {
            this.toggleBot();
        }

        // הפעל את הסיור
        setTimeout(() => {
            if (window.systemTour) {
                window.systemTour.start();
            }
        }, 300);
    }

    /**
     * הצגת שאלות בקטגוריה מסוימת
     */
    showCategoryQuestions(categoryId) {
        const suggestionsContainer = document.getElementById('faq-bot-suggestions');
        const messagesContainer = document.getElementById('faq-bot-messages');

        // מצא את כל השאלות בקטגוריה
        const categoryQuestions = [];

        for (const cat in this.faqDatabase) {
            this.faqDatabase[cat].forEach(item => {
                if (item.category === categoryId || cat === categoryId) {
                    categoryQuestions.push(item);
                }
            });
        }

        // נקה את ההודעות
        messagesContainer.innerHTML = '';

        // הצג כותרת
        const categoryNames = {
            'clients': '👤 תיקים ולקוחות',
            'tasks': '📝 משימות ותקצוב',
            'timesheet': '⏱️ שעתון ודיווח',
            'reports': '📊 דוחות וניתוחים',
            'system': '⚙️ הגדרות ומערכת'
        };

        // כפתור חזור + רשימת שאלות
        let html = `
            <div class="faq-back-header">
                <button class="faq-back-btn" onclick="smartFAQBot.showQuestionCategories()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    חזור
                </button>
                <h3>${categoryNames[categoryId] || 'שאלות'}</h3>
            </div>
            <div class="faq-question-list">
        `;

        categoryQuestions.forEach((item, index) => {
            html += `
                <button class="faq-question-btn" onclick="smartFAQBot.showAnswer(${index}, '${categoryId}')">
                    <span>${item.question}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </button>
            `;
        });

        html += '</div>';
        suggestionsContainer.innerHTML = html;
    }

    /**
     * הצגת תשובה לשאלה
     */
    showAnswer(questionIndex, categoryId) {
        const suggestionsContainer = document.getElementById('faq-bot-suggestions');
        const messagesContainer = document.getElementById('faq-bot-messages');

        // מצא את השאלה
        const categoryQuestions = [];
        for (const cat in this.faqDatabase) {
            this.faqDatabase[cat].forEach(item => {
                if (item.category === categoryId || cat === categoryId) {
                    categoryQuestions.push(item);
                }
            });
        }

        const question = categoryQuestions[questionIndex];
        if (!question) return;

        // נקה
        messagesContainer.innerHTML = '';

        // הצג את התשובה
        this.addBotMessage(question.answer);

        // כפתור חזור
        suggestionsContainer.innerHTML = `
            <div class="faq-answer-actions">
                <button class="faq-back-btn-large" onclick="smartFAQBot.showCategoryQuestions('${categoryId}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    חזור לרשימת השאלות
                </button>
            </div>
        `;
    }

    handleUserInput_OLD() {
        // פונקציה ישנה - לא בשימוש יותר
        const input = null; // document.getElementById('faq-bot-input');
        const query = ''; // input.value.trim();

        if (!query) return;

        // הצג את שאלת המשתמש
        this.addUserMessage(query);
        input.value = '';

        // חיפוש תשובה
        this.showTypingIndicator();

        setTimeout(() => {
            this.removeTypingIndicator();

            // בדוק אם זו תשובה לשאלה קודמת (כן/לא/תראה לי)
            const contextResponse = this.checkContextualResponse(query);
            if (contextResponse) {
                this.addBotMessage(contextResponse);
                this.showContextualSuggestions();
                return;
            }

            // קודם - בדוק תשובה דינמית (מידע אמיתי)
            const dynamicResponse = this.generateDynamicResponse(query);
            if (dynamicResponse) {
                this.addBotMessage(dynamicResponse);
                this.showContextualSuggestions();
                return;
            }

            // אחר כך - חפש בFAQ הרגיל
            const answer = this.searchFAQ(query);

            if (answer) {
                // הוסף את התשובה הבסיסית
                let fullAnswer = answer.answer;

                // אם יש guideType או selector, הוסף כפתורים אינטראקטיביים
                if (answer.guideType || answer.selector) {
                    const buttons = [];

                    if (answer.selector) {
                        buttons.push({
                            text: '👉 הראה לי איפה זה',
                            action: 'highlight',
                            selector: answer.selector
                        });
                    }

                    if (answer.guideType) {
                        buttons.push({
                            text: '🎬 תראה לי צעד אחר צעד',
                            action: 'show_guide',
                            selector: answer.guideType
                        });
                    }

                    if (buttons.length > 0) {
                        fullAnswer += this.addInteractiveButtons(buttons);
                    }
                }

                this.addBotMessage(fullAnswer);

                // הצע שאלות קשורות
                this.showRelatedQuestions(answer.category);
            } else {
                this.addBotMessage(`
                    <strong>מצטער, לא מצאתי תשובה מדויקת 😕</strong>
                    <p>נסה לנסח את השאלה אחרת, או בחר אחת מההצעות:</p>
                `);
                this.showContextualSuggestions();
            }
        }, 800);
    }

    searchFAQ(query) {
        const normalizedQuery = this.normalizeText(query);
        let bestMatch = null;
        let bestScore = 0;

        // חיפוש בכל הקטגוריות
        for (const category in this.faqDatabase) {
            const items = this.faqDatabase[category];

            for (const item of items) {
                const score = this.calculateMatchScore(normalizedQuery, item);

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = item;
                }
            }
        }

        // החזר תשובה רק אם הציון מספיק גבוה
        return bestScore > 0.3 ? bestMatch : null;
    }

    calculateMatchScore(query, item) {
        let score = 0;

        // בדוק התאמה למילות מפתח
        const queryWords = query.split(' ').filter(w => w.length > 2);

        for (const keyword of item.keywords) {
            const normalizedKeyword = this.normalizeText(keyword);

            // התאמה מלאה
            if (normalizedKeyword === query) {
                score += 10;
            }

            // מכיל את המילה
            if (normalizedKeyword.includes(query) || query.includes(normalizedKeyword)) {
                score += 5;
            }

            // חיפוש חכם - Fuzzy matching
            const similarity = this.calculateSimilarity(query, normalizedKeyword);
            if (similarity > 0.7) {
                score += 8; // דומה מאוד
            } else if (similarity > 0.5) {
                score += 4; // דומה למדי
            } else if (similarity > 0.3) {
                score += 2; // דומה קצת
            }

            // התאמה חלקית למילים
            for (const word of queryWords) {
                if (normalizedKeyword.includes(word)) {
                    score += 1;
                }

                // בדוק גם דמיון למילה בודדת
                const wordSimilarity = this.calculateSimilarity(word, normalizedKeyword);
                if (wordSimilarity > 0.6) {
                    score += 2;
                }
            }
        }

        return score;
    }

    calculateSimilarity(str1, str2) {
        // חישוב דמיון בין 2 מחרוזות (0-1)
        // משתמש באלגוריתם Levenshtein distance מפושט

        const len1 = str1.length;
        const len2 = str2.length;

        // אם אחד ריק
        if (len1 === 0) return len2 === 0 ? 1 : 0;
        if (len2 === 0) return 0;

        // מטריצה לחישוב המרחק
        const matrix = [];

        // אתחול
        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        // מילוי המטריצה
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // deletion
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }

        const distance = matrix[len1][len2];
        const maxLen = Math.max(len1, len2);

        // המרה לציון דמיון (1 = זהה, 0 = שונה לגמרי)
        return 1 - (distance / maxLen);
    }

    normalizeText(text) {
        return text.toLowerCase()
            .replace(/[״׳'"]/g, '')
            // טיפול באותיות דומות בעברית (טעויות הקלדה נפוצות)
            .replace(/[כך]/g, 'כ')
            .replace(/[םמ]/g, 'מ')
            .replace(/[ןנ]/g, 'ן')
            .replace(/[ףפ]/g, 'פ')
            .replace(/[ץצ]/g, 'צ')
            // הסרת רווחים מיותרים
            .replace(/\s+/g, ' ')
            .trim();
    }

    addUserMessage(text) {
        const messagesContainer = document.getElementById('faq-bot-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'faq-message user';
        messageDiv.textContent = text;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();

        this.chatHistory.push({ type: 'user', text });
    }

    addBotMessage(html) {
        const messagesContainer = document.getElementById('faq-bot-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'faq-message bot';
        messageDiv.innerHTML = html;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();

        this.chatHistory.push({ type: 'bot', html });
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('faq-bot-messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'faq-typing';
        typingDiv.id = 'faq-typing-indicator';
        typingDiv.innerHTML = `
            <div class="faq-typing-dot"></div>
            <div class="faq-typing-dot"></div>
            <div class="faq-typing-dot"></div>
        `;
        messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const indicator = document.getElementById('faq-typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    showContextualSuggestions() {
        const context = this.currentContext || 'default';
        const suggestions = this.contextualSuggestions[context] || this.contextualSuggestions.default;
        this.showSuggestions(suggestions);
    }

    showRelatedQuestions(category) {
        const items = this.faqDatabase[category] || [];
        const questions = items.slice(0, 3).map(item => item.question);
        this.showSuggestions(questions);
    }

    showSuggestions(suggestions) {
        const suggestionsContainer = document.getElementById('faq-bot-suggestions');
        suggestionsContainer.innerHTML = '';

        // הוספת כפתור "התחל סיור" מיוחד בתחילה
        const tourButton = document.createElement('button');
        tourButton.className = 'faq-suggestion-chip tour-chip';
        tourButton.innerHTML = '🎓 התחל סיור במערכת';
        tourButton.style.cssText = `
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            font-weight: 600;
            border: none;
        `;
        tourButton.addEventListener('click', () => {
            this.startSystemTour();
        });
        suggestionsContainer.appendChild(tourButton);

        // Suggestions disabled - using hierarchical menu instead
        // suggestions.forEach(suggestion => {
        //     const chip = document.createElement('button');
        //     chip.className = 'faq-suggestion-chip';
        //     chip.textContent = suggestion;
        //     suggestionsContainer.appendChild(chip);
        // });
    }

    /**
     * התחלת סיור במערכת - סוגר את הבוט ומתחיל את הסיור
     */
    startSystemTour() {
        // סגור את הבוט אם הוא פתוח
        if (this.isOpen) {
            this.toggleBot();
        }

        // המתן רגע ואז התחל את הסיור
        setTimeout(() => {
            if (systemTour) {
                systemTour.start();
            }
        }, 300);
    }

    /**
     * פונקציות עזר לפתיחה/סגירה
     */
    open() {
        if (!this.isOpen) {
            this.toggleBot();
        }
    }

    close() {
        if (this.isOpen) {
            this.toggleBot();
        }
    }

    detectContext() {
        // זיהוי המסך הנוכחי לפי ה-tab הפעיל
        const checkContext = () => {
            const activeTab = document.querySelector('.tab-button.active');
            if (activeTab) {
                const tabText = activeTab.textContent.trim();

                if (tabText.includes('לקוחות') || tabText.includes('תיקים')) {
                    this.currentContext = 'clients';
                } else if (tabText.includes('משימות') || tabText.includes('תקצוב')) {
                    this.currentContext = 'tasks';
                } else if (tabText.includes('שעתון')) {
                    this.currentContext = 'timesheet';
                } else {
                    this.currentContext = 'default';
                }
            }
        };

        // בדוק בכל פעם שלוחצים על טאב
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-button')) {
                setTimeout(checkContext, 100);
            }
        });

        // בדוק בפעם הראשונה
        checkContext();
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('faq-bot-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    getUserName() {
        // נסה לקבל את שם המשתמש מהמערכת
        try {
            // מהמנג'ר הראשי
            if (window.manager && window.manager.currentUsername) {
                return window.manager.currentUsername;
            }

            // מ-Firebase Auth (כשם fallback)
            if (window.firebaseAuth && window.firebaseAuth.currentUser) {
                const user = window.firebaseAuth.currentUser;
                return user.displayName || user.email?.split('@')[0];
            }

            // אין שם זמין
            return null;
        } catch (error) {
            console.warn('לא הצלחתי לקבל שם משתמש:', error);
            return null;
        }
    }

    /**
     * בודק אם המשתמש ענה על שאלה קודמת (כן/לא/תראה לי)
     */
    checkContextualResponse(query) {
        const normalized = this.normalizeText(query);

        // זיהוי תשובות חיוביות: כן, תראה לי, פירוט, הצג, וכו'
        const affirmativePatterns = ['כן', 'yes', 'תראה', 'הצג', 'פירוט', 'אוקי', 'ok', 'בטח', 'בוודאי'];
        const isAffirmative = affirmativePatterns.some(pattern => normalized.includes(pattern));

        if (isAffirmative) {
            // אם המשתמש ענה בחיוב, הצג את סיכום השעות המלא
            const stats = this.getSystemStats();
            if (stats && stats.hoursStatus) {
                return this.generateHoursDetailedResponse(stats);
            }
        }

        return null;
    }

    /**
     * יוצר תשובה מפורטת על שעות העבודה
     */
    generateHoursDetailedResponse(stats) {
        const h = stats.hoursStatus;
        const progressBar = this.generateProgressBar(h.percentageOfQuota);
        const userName = this.getUserName();
        const greeting = userName ? userName : '';

        // Debug log - נדפיס את כל הנתונים
        Logger.log('📊 DEBUG - נתוני שעות:', {
            hoursWorkedThisMonth: h.hoursWorkedThisMonth,
            monthlyQuota: h.monthlyQuota,
            workDaysPassed: h.workDaysPassed,
            workDaysRemaining: h.workDaysRemaining,
            hoursRemaining: h.hoursRemaining,
            avgHoursPerRemainingDay: h.avgHoursPerRemainingDay,
            percentageOfQuota: h.percentageOfQuota,
            percentageOfExpected: h.percentageOfExpected,
            timesheetEntriesCount: window.manager?.timesheetEntries?.length || 0
        });

        // בניית טקסט סטטוס
        let statusText = '';
        let statusIcon = '';

        if (h.percentageOfExpected >= 100) {
            statusIcon = '🎉';
            statusText = `<strong style="color: #10b981;">${h.status}</strong>`;
        } else if (h.percentageOfExpected >= 80) {
            statusIcon = '💪';
            statusText = `<strong style="color: #f59e0b;">${h.status}</strong>`;
        } else if (h.percentageOfExpected < 70) {
            statusIcon = '⚠️';
            statusText = `<strong style="color: #ef4444;">${h.status}</strong>`;
        } else {
            statusIcon = '📊';
            statusText = `<strong>${h.status}</strong>`;
        }

        // בדיקת יום עבודה
        let todayNote = '';
        if (!h.isTodayWorkDay && h.todayHolidayName) {
            todayNote = `<p style="background: #fef3c7; padding: 8px; border-radius: 6px; font-size: 13px;">
                           🎉 היום ${h.todayHolidayName} - אין צורך לדווח שעות
                         </p>`;
        } else if (!h.isTodayWorkDay) {
            todayNote = `<p style="background: #e0e7ff; padding: 8px; border-radius: 6px; font-size: 13px;">
                           🏖️ היום יום חופש (שישי/שבת)
                         </p>`;
        }

        // הסבר החישוב - ברור ומפורט
        const calculationExplanation = `
            <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 12px; margin: 12px 0; border-radius: 6px;">
                <strong style="color: #1e40af;">💡 הסבר החישוב</strong>
                <div style="font-size: 13px; color: #374151; margin-top: 8px; line-height: 1.8;">

                    <div style="background: white; padding: 10px; border-radius: 6px; margin: 8px 0;">
                        <strong style="color: #2563eb;">📅 נתוני חודש ${h.monthName}:</strong><br>
                        • סה"כ ימי עבודה בחודש כולו: <strong>${h.workDaysTotal} ימים</strong><br>
                        • ימי עבודה שכבר עברו: <strong>${h.workDaysPassed} ימים</strong><br>
                        • ימי עבודה שנותרו: <strong style="color: #ef4444;">${h.workDaysRemaining} ימים</strong>
                    </div>

                    <div style="background: white; padding: 10px; border-radius: 6px; margin: 8px 0;">
                        <strong style="color: #2563eb;">⏰ מכסת שעות:</strong><br>
                        • תקן חודשי: <strong>186 שעות</strong> (ממוצע)<br>
                        • מכסה לחודש זה: <strong>${h.monthlyQuota} שעות</strong><br>
                        <span style="font-size: 12px; color: #6b7280;">(${h.workDaysTotal} ימי עבודה × 8.45 שעות)</span>
                    </div>

                    <div style="background: white; padding: 10px; border-radius: 6px; margin: 8px 0;">
                        <strong style="color: #2563eb;">📊 מצב נוכחי:</strong><br>
                        • דיווחת עד היום: <strong>${h.hoursWorkedThisMonth} שעות</strong><br>
                        • עוד צריך לדווח: <strong style="color: #ef4444;">${h.hoursRemaining} שעות</strong>
                    </div>

                    <div style="background: #fef3c7; padding: 10px; border-radius: 6px; margin: 8px 0; border: 2px solid #f59e0b;">
                        <strong style="color: #92400e;">🔢 החישוב:</strong><br>
                        ${h.hoursRemaining} שעות נותרות ÷ ${h.workDaysRemaining} ימי עבודה נותרים<br>
                        = <strong style="font-size: 15px; color: #dc2626;">${h.avgHoursPerRemainingDay} שעות ביום ממוצע!</strong>
                    </div>
                </div>
            </div>
        `;

        // התראות
        let alertsHTML = '';
        if (h.alerts && h.alerts.length > 0) {
            alertsHTML = h.alerts.map(alert => {
                const bgColor = alert.type === 'warning' ? '#fef3c7' : alert.type === 'urgent' ? '#fee2e2' : '#d1fae5';
                return `<div style="background: ${bgColor}; padding: 8px; border-radius: 6px; margin: 8px 0; font-size: 13px;">
                          ${alert.icon} ${alert.message}
                        </div>`;
            }).join('');
        }

        return `<strong>📊 פירוט מלא - שעות ${h.monthName} ${greeting}:</strong>
                ${todayNote}
                <div style="margin: 12px 0;">
                    <div style="font-size: 28px; font-weight: bold; color: #2563eb;">${h.hoursWorkedThisMonth} שעות</div>
                    <div style="font-size: 14px; color: #6b7280;">
                        מתוך ${h.monthlyQuota} שעות (${h.percentageOfQuota}%)
                    </div>
                </div>
                ${progressBar}

                <div style="margin: 12px 0; padding: 12px; background: #f9fafb; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #6b7280;">ימי עבודה שעברו:</span>
                        <strong>${h.workDaysPassed} ימים</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #6b7280;">ימי עבודה נותרים:</span>
                        <strong>${h.workDaysRemaining} ימים</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #6b7280;">שעות נותרות:</span>
                        <strong style="color: ${h.hoursRemaining > 0 ? '#ef4444' : '#10b981'}">
                            ${h.hoursRemaining} שעות
                        </strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #6b7280;">ממוצע נדרש ליום:</span>
                        <strong style="color: ${h.avgHoursPerRemainingDay > 10 ? '#ef4444' : '#10b981'}">
                            ${h.avgHoursPerRemainingDay} שעות/יום
                        </strong>
                    </div>
                </div>

                ${calculationExplanation}
                ${alertsHTML}

                <p style="text-align: center; margin-top: 12px;">
                    ${statusIcon} ${statusText}
                </p>`;
    }

    // ========== תשובות דינמיות - מידע אמיתי מהמערכת ==========

    getSystemStats() {
        try {
            if (!window.manager) return null;

            const stats = {
                activeTasks: 0,
                urgentTasks: 0,
                completedTasks: 0,
                totalClients: 0
            };

            // משימות
            if (window.manager.budgetTasks) {
                stats.activeTasks = window.manager.budgetTasks.filter(t => t.status !== 'הושלם').length;
                stats.completedTasks = window.manager.budgetTasks.filter(t => t.status === 'הושלם').length;

                // משימות דחופות (עבר תאריך יעד)
                const now = new Date();
                stats.urgentTasks = window.manager.budgetTasks.filter(t => {
                    if (t.status === 'הושלם') return false;
                    const deadline = t.deadline?.toDate ? t.deadline.toDate() : new Date(t.deadline);
                    return deadline < now;
                }).length;
            }

            // שעות - חישוב חכם עם המחשבון החדש
            if (window.WorkHoursCalculator) {
                const calculator = new window.WorkHoursCalculator();
                const hoursStatus = calculator.calculateCurrentStatus(window.manager.timesheetEntries || []);

                stats.hoursStatus = hoursStatus;
                stats.monthlyHours = hoursStatus.hoursWorkedThisMonth;
                stats.monthlyQuota = hoursStatus.monthlyQuota;
                stats.hoursRemaining = hoursStatus.hoursRemaining;
                stats.percentageOfQuota = hoursStatus.percentageOfQuota;
                stats.percentageOfExpected = hoursStatus.percentageOfExpected;
                stats.workDaysRemaining = hoursStatus.workDaysRemaining;
                stats.avgHoursPerRemainingDay = hoursStatus.avgHoursPerRemainingDay;
                stats.isTodayWorkDay = hoursStatus.isTodayWorkDay;
                stats.todayHolidayName = hoursStatus.todayHolidayName;
            }

            // לקוחות
            if (window.manager.clients) {
                stats.totalClients = window.manager.clients.length;
            }

            return stats;
        } catch (error) {
            console.warn('שגיאה בקבלת נתוני מערכת:', error);
            return null;
        }
    }

    generateDynamicResponse(query) {
        // תשובות דינמיות מבוססות מידע אמיתי
        const stats = this.getSystemStats();
        if (!stats) return null;

        const userName = this.getUserName();
        const greeting = userName ? userName : '';

        // זיהוי שאלות שדורשות תשובה דינמית
        const normalizedQuery = this.normalizeText(query);

        // "כמה משימות יש לי"
        if (normalizedQuery.includes('כמה משימות') || normalizedQuery.includes('משימות שלי')) {
            if (stats.activeTasks === 0) {
                return `<strong>מעולה ${greeting}! 🎉</strong>
                        <p>אין לך משימות פעילות כרגע.</p>
                        <p>רוצה ליצור משימה חדשה?</p>`;
            } else {
                const urgentText = stats.urgentTasks > 0
                    ? `<br><strong style="color: #dc2626;">⚠️ ${stats.urgentTasks} מהן דחופות (עבר תאריך יעד)!</strong>`
                    : '';
                return `<strong>סיכום משימות ${greeting}:</strong>
                        <ul>
                            <li>📋 <strong>${stats.activeTasks}</strong> משימות פעילות</li>
                            <li>✅ <strong>${stats.completedTasks}</strong> משימות הושלמו</li>
                        </ul>
                        ${urgentText}
                        <p>רוצה לראות את המשימות?</p>`;
            }
        }

        // "כמה שעות עבדתי" - חישוב חכם חודשי
        if (normalizedQuery.includes('כמה שעות') || normalizedQuery.includes('שעות שלי') || normalizedQuery.includes('סיכום שעות')) {
            if (!stats.hoursStatus) {
                return `<strong>מצטער ${greeting},</strong>
                        <p>לא הצלחתי לקבל את נתוני השעות כרגע.</p>`;
            }

            const h = stats.hoursStatus;
            const progressBar = this.generateProgressBar(h.percentageOfQuota);

            // בניית טקסט סטטוס
            let statusText = '';
            let statusIcon = '';

            if (h.percentageOfExpected >= 100) {
                statusIcon = '🎉';
                statusText = `<strong style="color: #10b981;">${h.status}</strong>`;
            } else if (h.percentageOfExpected >= 80) {
                statusIcon = '💪';
                statusText = `<strong style="color: #f59e0b;">${h.status}</strong>`;
            } else if (h.percentageOfExpected < 70) {
                statusIcon = '⚠️';
                statusText = `<strong style="color: #ef4444;">${h.status}</strong>`;
            } else {
                statusIcon = '📊';
                statusText = `<strong>${h.status}</strong>`;
            }

            // בדיקת יום עבודה
            let todayNote = '';
            if (!h.isTodayWorkDay && h.todayHolidayName) {
                todayNote = `<p style="background: #fef3c7; padding: 8px; border-radius: 6px; font-size: 13px;">
                               🎉 היום ${h.todayHolidayName} - אין צורך לדווח שעות
                             </p>`;
            } else if (!h.isTodayWorkDay) {
                todayNote = `<p style="background: #e0e7ff; padding: 8px; border-radius: 6px; font-size: 13px;">
                               🏖️ היום יום חופש (שישי/שבת)
                             </p>`;
            }

            // התראות
            let alertsHTML = '';
            if (h.alerts && h.alerts.length > 0) {
                alertsHTML = h.alerts.map(alert => {
                    const bgColor = alert.type === 'warning' ? '#fef3c7' : alert.type === 'urgent' ? '#fee2e2' : '#d1fae5';
                    return `<div style="background: ${bgColor}; padding: 8px; border-radius: 6px; margin: 8px 0; font-size: 13px;">
                              ${alert.icon} ${alert.message}
                            </div>`;
                }).join('');
            }

            return `<strong>סיכום שעות ${h.monthName} ${greeting}:</strong>
                    ${todayNote}
                    <div style="margin: 12px 0;">
                        <div style="font-size: 28px; font-weight: bold; color: #2563eb;">${h.hoursWorkedThisMonth} שעות</div>
                        <div style="font-size: 14px; color: #6b7280;">
                            מתוך ${h.monthlyQuota} שעות (${h.percentageOfQuota}%)
                        </div>
                    </div>
                    ${progressBar}

                    <div style="margin: 12px 0; padding: 12px; background: #f9fafb; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: #6b7280;">ימי עבודה שעברו:</span>
                            <strong>${h.workDaysPassed} ימים</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: #6b7280;">ימי עבודה נותרים:</span>
                            <strong>${h.workDaysRemaining} ימים</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="color: #6b7280;">שעות נותרות:</span>
                            <strong style="color: ${h.hoursRemaining > 0 ? '#ef4444' : '#10b981'}">
                                ${h.hoursRemaining} שעות
                            </strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #6b7280;">ממוצע נדרש ליום:</span>
                            <strong>${h.avgHoursPerRemainingDay} שעות/יום</strong>
                        </div>
                    </div>

                    ${alertsHTML}

                    <p style="text-align: center; margin-top: 12px;">
                        ${statusIcon} ${statusText}
                    </p>`;
        }

        // "יש לי משימות דחופות"
        if (stats.urgentTasks > 0 && (normalizedQuery.includes('דחוף') || normalizedQuery.includes('urgent'))) {
            return `<strong>⚠️ ${greeting}, יש לך ${stats.urgentTasks} משימות דחופות!</strong>
                    <p>משימות אלו עברו את תאריך היעד.</p>
                    <p><strong>המלצה:</strong> עבור למסך "תקצוב משימות" וסמן "פעילות בלבד" כדי לראות אותן.</p>
                    <p>רוצה עזרה בסדר עדיפויות?</p>`;
        }

        return null; // אין תשובה דינמית מתאימה
    }

    generateProgressBar(percentage) {
        const filled = Math.min(100, Math.max(0, percentage));
        const color = filled >= 100 ? '#10b981' : filled >= 80 ? '#f59e0b' : '#3b82f6';

        return `<div style="background: #e5e7eb; border-radius: 8px; height: 8px; overflow: hidden; margin: 8px 0;">
                    <div style="background: ${color}; width: ${filled}%; height: 100%; transition: width 0.3s;"></div>
                </div>`;
    }

    // ========== בוט פרואקטיבי - הצעת עזרה אוטומטית ==========

    checkProactiveHelp() {
        // בודק אם צריך להציע עזרה פרואקטיבית
        const stats = this.getSystemStats();
        if (!stats) return null;

        const suggestions = [];

        // משימות דחופות - עדיפות עליונה!
        if (stats.urgentTasks > 0) {
            suggestions.push({
                title: '⚠️ משימות דחופות',
                message: `יש לך ${stats.urgentTasks} משימות שעבר תאריך היעד שלהן`,
                action: 'רוצה לראות אותן?',
                priority: 10
            });
        }

        // בדיקת שעות חכמה - עם המחשבון החדש
        if (stats.hoursStatus) {
            const h = stats.hoursStatus;

            // פיגור משמעותי
            if (h.percentageOfExpected < 70 && h.workDaysRemaining < 10) {
                suggestions.push({
                    title: '⏰ פיגור בדיווח שעות',
                    message: `דיווחת ${h.hoursWorkedThisMonth} שעות מתוך ${h.quotaForDaysPassed} הצפויות עד כה (${h.percentageOfExpected}%)`,
                    action: 'רוצה לדווח שעות עכשיו?',
                    priority: 8
                });
            }

            // נדרשות הרבה שעות ביום
            if (h.workDaysRemaining > 0 && h.avgHoursPerRemainingDay > 10) {
                suggestions.push({
                    title: '🔥 זהירות - עומס גבוה!',
                    message: `נדרש ממוצע של ${h.avgHoursPerRemainingDay} שעות ביום כדי להשלים את המכסה`,
                    action: 'רוצה לראות פירוט?',
                    priority: 9
                });
            }

            // יום חג - הערה ידידותית
            if (!h.isTodayWorkDay && h.todayHolidayName) {
                suggestions.push({
                    title: `🎉 ${h.todayHolidayName}`,
                    message: 'היום חג - אין צורך לדווח שעות',
                    action: 'תהנה מהחג!',
                    priority: 3
                });
            }
        }

        // אין משימות פעילות
        if (stats.activeTasks === 0 && stats.completedTasks > 0) {
            suggestions.push({
                title: '🎯 כל המשימות הושלמו!',
                message: 'מעולה! סיימת את כל המשימות',
                action: 'רוצה ליצור משימות חדשות?',
                priority: 5
            });
        }

        // מיון לפי עדיפות והחזרת הגבוהה ביותר
        if (suggestions.length > 0) {
            suggestions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
            return suggestions[0];
        }

        return null;
    }

    showProactiveSuggestion() {
        // הצג הצעה פרואקטיבית בפתיחת הבוט
        const suggestion = this.checkProactiveHelp();
        if (!suggestion) return false;

        setTimeout(() => {
            this.addBotMessage(`
                <strong>${suggestion.title}</strong>
                <p>${suggestion.message}</p>
                <p><em>${suggestion.action}</em></p>
            `);
        }, 2000); // אחרי 2 שניות

        return true;
    }

    // ========== מערכת הדגשה ויזואלית - Visual Highlighting ==========

    /**
     * מדגיש אלמנט בעמוד עם אנימציה וחץ
     * @param {string} selector - CSS selector של האלמנט להדגשה
     * @param {string} message - הודעה להצגה ליד האלמנט
     * @param {number} duration - משך זמן בms (ברירת מחדל: 5000)
     */
    highlightElement(selector, message = '', duration = 5000) {
        try {
            const element = document.querySelector(selector);
            if (!element) {
                console.warn(`לא נמצא אלמנט: ${selector}`);
                return false;
            }

            // הסר הדגשות קודמות
            this.removeAllHighlights();

            // צור overlay של הדגשה
            const highlightOverlay = document.createElement('div');
            highlightOverlay.className = 'bot-highlight-overlay';
            highlightOverlay.id = 'bot-active-highlight';

            // מיקום האלמנט
            const rect = element.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            highlightOverlay.style.cssText = `
                position: absolute;
                top: ${rect.top + scrollTop - 10}px;
                left: ${rect.left + scrollLeft - 10}px;
                width: ${rect.width + 20}px;
                height: ${rect.height + 20}px;
                border: 3px solid #ef4444;
                border-radius: 8px;
                background: rgba(239, 68, 68, 0.1);
                box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.3), 0 0 20px rgba(239, 68, 68, 0.5);
                z-index: 9997;
                pointer-events: none;
                animation: botPulse 1.5s infinite;
            `;

            document.body.appendChild(highlightOverlay);

            // צור חץ מצביע
            const arrow = document.createElement('div');
            arrow.className = 'bot-highlight-arrow';
            arrow.innerHTML = '👉';
            arrow.style.cssText = `
                position: absolute;
                top: ${rect.top + scrollTop + rect.height / 2 - 20}px;
                left: ${rect.left + scrollLeft - 60}px;
                font-size: 40px;
                z-index: 9997;
                pointer-events: none;
                animation: botArrowBounce 1s infinite;
            `;
            document.body.appendChild(arrow);

            // צור בועה עם הודעה וכפתור "הבנתי"
            if (message) {
                const bubble = document.createElement('div');
                bubble.className = 'bot-highlight-bubble';
                bubble.innerHTML = `
                    <div style="margin-bottom: 12px;">${message}</div>
                    <button
                        class="bot-highlight-btn"
                        onclick="smartFAQBot.removeAllHighlights()"
                        style="background: white; color: #3b82f6; border: none; padding: 8px 16px;
                               border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;
                               transition: all 0.2s ease;"
                        onmouseover="this.style.transform='scale(1.05)'"
                        onmouseout="this.style.transform='scale(1)'"
                    >
                        ✓ הבנתי
                    </button>
                `;
                bubble.style.cssText = `
                    position: absolute;
                    top: ${rect.top + scrollTop - 100}px;
                    left: ${rect.left + scrollLeft}px;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    padding: 16px;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    z-index: 9998;
                    font-size: 14px;
                    font-weight: 500;
                    max-width: 280px;
                    pointer-events: auto;
                    animation: botBubbleAppear 0.3s ease;
                `;
                document.body.appendChild(bubble);
            }

            // גלול לאלמנט
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

            return true;
        } catch (error) {
            console.error('שגיאה בהדגשת אלמנט:', error);
            return false;
        }
    }

    /**
     * מסיר את כל ההדגשות הויזואליות
     */
    removeAllHighlights() {
        const highlights = document.querySelectorAll('.bot-highlight-overlay, .bot-highlight-arrow, .bot-highlight-bubble');
        highlights.forEach(el => el.remove());
    }

    /**
     * מציג כפתורי פעולה אינטראקטיביים בתשובות הבוט
     * @param {Array} actions - מערך של פעולות {text, action, selector}
     */
    addInteractiveButtons(actions) {
        let buttonsHTML = '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;">';

        actions.forEach((action, index) => {
            buttonsHTML += `
                <button
                    class="bot-action-button"
                    data-action="${action.action}"
                    data-selector="${action.selector || ''}"
                    style="
                        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                        color: white;
                        border: none;
                        padding: 10px 16px;
                        border-radius: 8px;
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                        box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
                    "
                    onmouseenter="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.4)'"
                    onmouseleave="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 6px rgba(16, 185, 129, 0.3)'"
                >
                    ${action.text}
                </button>
            `;
        });

        buttonsHTML += '</div>';
        return buttonsHTML;
    }

    /**
     * מטפל בלחיצה על כפתור פעולה אינטראקטיבי
     */
    handleActionButton(action, selector) {
        Logger.log('פעולה:', action, 'Selector:', selector);

        // סגור את הבוט לפני כל פעולה ויזואלית
        if (action === 'highlight' || action === 'show_guide' || action === 'open_form') {
            this.close();

            // המתן רגע לסגירת האנימציה
            setTimeout(() => {
                this.executeAction(action, selector);
            }, 300);
        } else {
            this.executeAction(action, selector);
        }
    }

    /**
     * מבצע את הפעולה בפועל
     */
    executeAction(action, selector) {
        switch(action) {
            case 'highlight':
                if (selector) {
                    this.highlightElement(selector, 'לחץ כאן! 👆');
                }
                break;

            case 'show_guide':
                if (selector) {
                    // selector כאן זה בעצם guideType
                    this.showStepByStepGuide(selector);
                }
                break;

            case 'open_form':
                if (selector) {
                    this.highlightElement(selector, 'לחץ על הכפתור הזה', 3000);
                    setTimeout(() => {
                        const element = document.querySelector(selector);
                        if (element) element.click();
                    }, 3000);
                }
                break;

            case 'show_demo':
                this.startDemoMode();
                break;

            default:
                console.warn('פעולה לא מוכרת:', action);
        }
    }

    /**
     * מצב דמו - מראה איך לעשות משהו צעד אחר צעד
     */
    startDemoMode() {
        this.addBotMessage(`
            <strong>🎬 מצב הדרכה אינטראקטיבי</strong>
            <p>אני אראה לך צעד אחר צעד איך לעשות את זה!</p>
            <p><em>עקוב אחרי החצים והסימונים...</em></p>
        `);

        // דוגמה: הדרכה ליצירת משימה
        this.showStepByStepGuide('create_task');
    }

    /**
     * הדרכה צעד אחר צעד
     */
    showStepByStepGuide(guideType) {
        const guides = {
            'create_task': [
                { selector: '.tab-button', message: '1️⃣ ראשית, ודא שאתה בטאב "תקצוב משימות"', delay: 1000 },
                { selector: '#smartPlusBtn', message: '2️⃣ עכשיו לחץ על כפתור הפלוס הזה', delay: 3000 },
                { message: '3️⃣ הטופס ייפתח! תמלא את הפרטים: לקוח, תיק, תיאור, דקות, תאריך יעד', delay: 5000 },
                { message: '4️⃣ לחץ "הוסף לתקצוב" לסיום', delay: 7000 }
            ],
            'create_client': [
                { selector: '.tab-button', message: '1️⃣ ודא שאתה בטאב "לקוחות ותיקים"', delay: 1000 },
                { selector: '#smartPlusBtn', message: '2️⃣ לחץ על כפתור הפלוס', delay: 3000 },
                { message: '3️⃣ תמלא: שם לקוח, סוג תיק, פרטים נוספים', delay: 5000 },
                { message: '4️⃣ לחץ "צור" לשמירה', delay: 7000 }
            ],
            'report_hours': [
                { selector: '.tab-button', message: '1️⃣ ודא שאתה בטאב "שעתון"', delay: 1000 },
                { selector: '#smartPlusBtn', message: '2️⃣ לחץ על כפתור הפלוס', delay: 3000 },
                { message: '3️⃣ תמלא: תאריך, דקות, לקוח ותיק, תיאור הפעולה', delay: 5000 },
                { message: '4️⃣ לחץ "הוסף לשעתון" לסיום', delay: 7000 }
            ]
        };

        const steps = guides[guideType];
        if (!steps) {
            console.warn('סוג הדרכה לא קיים:', guideType);
            return;
        }

        // הרץ את השלבים ברצף
        let totalDelay = 0;
        steps.forEach((step, index) => {
            setTimeout(() => {
                if (step.selector) {
                    this.highlightElement(step.selector, step.message, 2000);
                } else {
                    this.addBotMessage(`<strong>${step.message}</strong>`);
                }
            }, totalDelay);
            totalDelay += step.delay;
        });
    }

    /**
     * הוסף אנימציות CSS לדף
     */
    addHighlightStyles() {
        if (document.getElementById('bot-highlight-styles')) return;

        const style = document.createElement('style');
        style.id = 'bot-highlight-styles';
        style.textContent = `
            @keyframes botPulse {
                0%, 100% {
                    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.3), 0 0 20px rgba(239, 68, 68, 0.5);
                }
                50% {
                    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.2), 0 0 30px rgba(239, 68, 68, 0.7);
                }
            }

            @keyframes botArrowBounce {
                0%, 100% {
                    transform: translateX(0);
                }
                50% {
                    transform: translateX(10px);
                }
            }

            @keyframes botBubbleAppear {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * מערכת סיור אינטראקטיבית במערכת
 * System Tour - guided walkthrough for new users
 */
/**
 * ========================================
 * סיור במערכת - System Tour (גרסה 2.0)
 * ========================================
 * מערכת הדרכה פשוטה ומקצועית למשתמשים חדשים
 * בנוי מחדש מאפס בצורה נקייה וקלאסית
 */
class SystemTour {
    constructor() {
        this.currentStep = 0;
        this.isActive = false;
        this.steps = this.getSteps();
    }

    /**
     * שלבי הסיור
     */
    getSteps() {
        return [
            {
                title: '🎉 ברוכים הבאים למערכת!',
                text: 'בואו נתחיל סיור קצר שיעזור לכם להכיר את המערכת',
                element: null,
                position: 'center'
            },
            {
                title: '🎨 תפריט ניווט צדדי',
                text: 'זה התפריט הראשי שלכם!\n\n📁 תיקים חדשים\n🔄 רענון נתונים\n💬 שליחת משוב\n📊 דוחות וניתוחים\n🚪 יציאה מהמערכת\n\nתוכלו לפתוח ולסגור אותו עם כפתור התפריט למעלה',
                element: '#minimalSidebar',
                position: 'right',
                action: () => {
                    const sidebar = document.getElementById('minimalSidebar');
                    if (sidebar && sidebar.classList.contains('hidden')) {
                        if (typeof toggleSidebar === 'function') {
                            toggleSidebar();
                        }
                    }
                }
            },
            {
                title: '➕ כפתור הוספה מהיר',
                text: 'הכפתור הירוק הזה פותח תפריט מהיר להוספת משימה חדשה או רישום שעות עבודה',
                element: '#smartPlusBtn',
                position: 'bottom'
            },
            {
                title: '📁 תיק חדש',
                text: 'כפתור זה פותח חלון להוספת לקוח חדש או יצירת תיק חדש ללקוח קיים',
                element: 'button[onclick*="casesManager.showCreateCaseDialog"]',
                position: 'bottom'
            },
            {
                title: '📝 הוספת משימה חדשה',
                text: 'זה החלון להוספת משימה:\n\n1️⃣ תיאור המשימה - לדוגמא: "ייצוג משפטי - ישראל ישראלי"\n2️⃣ בחרו לקוח ותיק\n3️⃣ הזינו תקצוב שעות\n4️⃣ קבעו תאריך יעד\n\nהכל פשוט ומהיר!',
                element: '#smartFormModal',
                position: 'left',
                action: () => {
                    if (typeof openSmartForm === 'function') {
                        openSmartForm();
                    }
                }
            },
            {
                title: '📊 טאב תקצוב משימות',
                text: 'כאן תנהלו את כל המשימות המתוקצבות שלכם',
                element: 'button[onclick*="switchTab(\'budget\')"]',
                position: 'bottom',
                action: () => {
                    if (typeof switchTab === 'function') switchTab('budget');
                }
            },
            {
                title: '👁️ תצוגות שונות',
                text: 'בחרו את סוג התצוגה המועדף עליכם:\n\n🎴 כרטיסים - תצוגה ויזואלית ונוחה\n📋 טבלה - תצוגה מסודרת ומפורטת\n\nכל אחד לפי הנוחות שלו!',
                element: '#budgetTab .view-tabs',
                position: 'bottom',
                action: () => {
                    if (typeof switchTab === 'function') switchTab('budget');
                }
            },
            {
                title: '⏱️ טאב שעתון',
                text: 'כאן תדווחו על השעות שביצעתם ותעקבו אחרי הזמן',
                element: 'button[onclick*="switchTab(\'timesheet\')"]',
                position: 'bottom',
                action: () => {
                    if (typeof switchTab === 'function') switchTab('timesheet');
                }
            },
            {
                title: '💬 העוזר החכם',
                text: 'אם יש שאלות - פשוט לחצו כאן ושאלו אותי!',
                element: '.faq-bot-button',
                position: 'top'
            }
        ];
    }

    /**
     * התחלת הסיור
     */
    start() {
        if (this.isActive) return;

        this.isActive = true;
        this.currentStep = 0;
        this.createOverlay();
        this.showStep(0);
    }

    /**
     * יצירת overlay
     */
    createOverlay() {
        // הסר overlay קיים
        this.destroy();

        const overlay = document.createElement('div');
        overlay.id = 'tour-overlay';
        overlay.innerHTML = `
            <div class="tour-backdrop"></div>
            <div class="tour-spotlight"></div>
            <div class="tour-tooltip">
                <div class="tour-tooltip-header">
                    <h3 class="tour-tooltip-title"></h3>
                    <button class="tour-close-btn" title="סגור">×</button>
                </div>
                <p class="tour-tooltip-text"></p>
                <div class="tour-tooltip-footer">
                    <div class="tour-progress"></div>
                    <div class="tour-buttons">
                        <button class="tour-btn tour-btn-prev">← הקודם</button>
                        <button class="tour-btn tour-btn-next">הבא →</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.addTourStyles();
        this.attachEvents();
    }

    /**
     * הצגת שלב
     */
    showStep(index) {
        if (index < 0 || index >= this.steps.length) return;

        this.currentStep = index;
        const step = this.steps[index];

        // סגור דיאלוגים פתוחים אם לא זה השלב שלהם
        if (step.title !== '📝 הוספת משימה חדשה') {
            const smartFormModal = document.getElementById('smartFormModal');
            if (smartFormModal && smartFormModal.style.display !== 'none') {
                if (typeof closeSmartForm === 'function') {
                    closeSmartForm();
                } else {
                    smartFormModal.style.display = 'none';
                }
            }
        }

        // סגור סרגל צדדי אם לא זה השלב שלו
        if (step.title !== '🎨 תפריט ניווט צדדי') {
            const sidebar = document.getElementById('minimalSidebar');
            if (sidebar && !sidebar.classList.contains('hidden')) {
                if (typeof toggleSidebar === 'function') {
                    toggleSidebar();
                }
            }
        }

        // הרץ action אם יש
        if (step.action) {
            step.action();
            // המתן יותר זמן לשלבים עם דיאלוגים
            const delay = step.title === '📝 הוספת משימה חדשה' ? 800 : 300;
            setTimeout(() => this.renderStep(step), delay);
        } else {
            this.renderStep(step);
        }
    }

    /**
     * רינדור שלב
     */
    renderStep(step) {
        // אם אין אלמנט (center mode) - הצג באמצע המסך
        if (!step.element) {
            this.showCenterMode(step);
            return;
        }

        // מצא אלמנט
        const element = document.querySelector(step.element);
        if (!element) {
            console.warn('Tour: Element not found -', step.element);
            // אם זה דיאלוג שלא נפתח - הצג center mode כ-fallback
            if (step.element.includes('Modal')) {
                Logger.log('Tour: Using center mode as fallback for modal');
                this.showCenterMode(step);
                return;
            }
            return;
        }

        const rect = element.getBoundingClientRect();

        // עדכן spotlight
        this.updateSpotlight(rect);

        // עדכן tooltip
        this.updateTooltip(step, rect);

        // עדכן כפתורים
        this.updateButtons();
    }

    /**
     * מצב מרכז - ללא spotlight, רק tooltip באמצע עם רקע כהה
     */
    showCenterMode(step) {
        const spotlight = document.querySelector('.tour-spotlight');
        const tooltip = document.querySelector('.tour-tooltip');
        const title = document.querySelector('.tour-tooltip-title');
        const text = document.querySelector('.tour-tooltip-text');
        const progress = document.querySelector('.tour-progress');

        // הסתר spotlight אבל הפוך אותו לרקע כהה
        if (spotlight) {
            spotlight.style.cssText = `
                display: block;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                pointer-events: none;
                z-index: 99998;
                transition: all 0.3s ease;
                border: none;
                box-shadow: none;
                border-radius: 0;
            `;
        }

        // עדכן תוכן
        if (title) title.textContent = step.title;
        if (text) text.textContent = step.text;
        if (progress) progress.textContent = `שלב ${this.currentStep + 1} מתוך ${this.steps.length}`;

        // מרכז tooltip
        if (tooltip) {
            tooltip.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 99999;
                transition: all 0.3s ease;
            `;
        }

        // עדכן כפתורים
        this.updateButtons();
    }

    /**
     * עדכון spotlight
     */
    updateSpotlight(rect) {
        const spotlight = document.querySelector('.tour-spotlight');
        if (!spotlight) return;

        const padding = 8;

        spotlight.style.cssText = `
            display: block;
            position: fixed;
            top: ${rect.top - padding}px;
            left: ${rect.left - padding}px;
            width: ${rect.width + padding * 2}px;
            height: ${rect.height + padding * 2}px;
            border-radius: 8px;
            border: 3px solid #3b82f6;
            box-shadow: 0 0 0 9999px rgba(0,0,0,0.7);
            pointer-events: none;
            z-index: 99998;
            transition: all 0.3s ease;
        `;
    }

    /**
     * עדכון tooltip
     */
    updateTooltip(step, rect) {
        const tooltip = document.querySelector('.tour-tooltip');
        const title = document.querySelector('.tour-tooltip-title');
        const text = document.querySelector('.tour-tooltip-text');
        const progress = document.querySelector('.tour-progress');

        if (!tooltip) return;

        // עדכן תוכן
        title.textContent = step.title;
        text.textContent = step.text;
        progress.textContent = `שלב ${this.currentStep + 1} מתוך ${this.steps.length}`;

        // חשב מיקום
        const pos = this.calculateTooltipPosition(rect, step.position);

        tooltip.style.cssText = `
            position: fixed;
            top: ${pos.top}px;
            left: ${pos.left}px;
            z-index: 99999;
            transition: all 0.3s ease;
        `;
    }

    /**
     * חישוב מיקום tooltip
     */
    calculateTooltipPosition(rect, position) {
        const tooltip = document.querySelector('.tour-tooltip');
        const width = 400;
        const height = tooltip.offsetHeight || 200;
        const gap = 20;
        const padding = 20;

        let top, left;

        switch (position) {
            case 'bottom':
                top = rect.bottom + gap;
                left = rect.left + rect.width / 2 - width / 2;
                break;
            case 'top':
                top = rect.top - height - gap;
                left = rect.left + rect.width / 2 - width / 2;
                break;
            case 'left':
                top = rect.top + rect.height / 2 - height / 2;
                left = rect.left - width - gap;
                break;
            case 'right':
                top = rect.top + rect.height / 2 - height / 2;
                left = rect.right + gap;
                break;
            default:
                top = window.innerHeight / 2 - height / 2;
                left = window.innerWidth / 2 - width / 2;
        }

        // ודא שהtooltip בתוך המסך
        top = Math.max(padding, Math.min(top, window.innerHeight - height - padding));
        left = Math.max(padding, Math.min(left, window.innerWidth - width - padding));

        return { top, left };
    }

    /**
     * עדכון כפתורים
     */
    updateButtons() {
        const prevBtn = document.querySelector('.tour-btn-prev');
        const nextBtn = document.querySelector('.tour-btn-next');

        if (!prevBtn || !nextBtn) return;

        // כפתור הקודם
        prevBtn.style.display = this.currentStep === 0 ? 'none' : 'inline-block';

        // כפתור הבא
        if (this.currentStep === this.steps.length - 1) {
            nextBtn.textContent = '✓ סיים';
            nextBtn.classList.add('tour-btn-finish');
        } else {
            nextBtn.textContent = 'הבא →';
            nextBtn.classList.remove('tour-btn-finish');
        }
    }

    /**
     * צירוף events
     */
    attachEvents() {
        document.querySelector('.tour-btn-next').addEventListener('click', () => this.next());
        document.querySelector('.tour-btn-prev').addEventListener('click', () => this.prev());
        document.querySelector('.tour-close-btn').addEventListener('click', () => this.end());

        // ESC לסגירה
        this.escHandler = (e) => {
            if (e.key === 'Escape' && this.isActive) {
                this.end();
            }
        };
        document.addEventListener('keydown', this.escHandler);
    }

    /**
     * מעבר לשלב הבא
     */
    next() {
        if (this.currentStep < this.steps.length - 1) {
            this.showStep(this.currentStep + 1);
        } else {
            this.end();
        }
    }

    /**
     * חזרה לשלב קודם
     */
    prev() {
        if (this.currentStep > 0) {
            this.showStep(this.currentStep - 1);
        }
    }

    /**
     * סיום הסיור
     */
    end() {
        this.isActive = false;

        // סגור דיאלוגים פתוחים
        const smartFormModal = document.getElementById('smartFormModal');
        if (smartFormModal && smartFormModal.style.display !== 'none') {
            if (typeof closeSmartForm === 'function') {
                closeSmartForm();
            } else {
                smartFormModal.style.display = 'none';
            }
        }

        // סגור סרגל צדדי
        const sidebar = document.getElementById('minimalSidebar');
        if (sidebar && !sidebar.classList.contains('hidden')) {
            if (typeof toggleSidebar === 'function') {
                toggleSidebar();
            }
        }

        this.destroy();

        // הודעת סיום
        if (window.showNotification) {
            showNotification('הסיור הושלם בהצלחה! 🎉', 'success');
        }
    }

    /**
     * מחיקת overlay
     */
    destroy() {
        const overlay = document.getElementById('tour-overlay');
        if (overlay) {
            overlay.remove();
        }

        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
        }
    }

    /**
     * הוספת סטיילים
     */
    addTourStyles() {
        if (document.getElementById('tour-styles')) return;

        const style = document.createElement('style');
        style.id = 'tour-styles';
        style.textContent = `
            /* Container */
            #tour-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 99997;
                pointer-events: none;
            }

            /* Backdrop (unused - box-shadow does the work) */
            .tour-backdrop {
                display: none;
            }

            /* Tooltip */
            .tour-tooltip {
                position: fixed;
                width: 400px;
                max-width: 90vw;
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3),
                           0 2px 8px rgba(0, 0, 0, 0.1);
                pointer-events: all;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                z-index: 99999;
            }

            /* Header */
            .tour-tooltip-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                padding: 20px 20px 16px 20px;
                border-bottom: 1px solid #e5e7eb;
            }

            .tour-tooltip-title {
                margin: 0;
                font-size: 20px;
                font-weight: 700;
                color: #1f2937;
                flex: 1;
            }

            .tour-close-btn {
                background: transparent;
                border: none;
                font-size: 28px;
                color: #9ca3af;
                cursor: pointer;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
                transition: all 0.2s ease;
                line-height: 1;
            }

            .tour-close-btn:hover {
                background: #f3f4f6;
                color: #6b7280;
            }

            /* Text */
            .tour-tooltip-text {
                padding: 16px 20px;
                font-size: 15px;
                line-height: 1.6;
                color: #4b5563;
                margin: 0;
                white-space: pre-line;
            }

            /* Footer */
            .tour-tooltip-footer {
                padding: 16px 20px 20px 20px;
                border-top: 1px solid #e5e7eb;
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .tour-progress {
                font-size: 13px;
                color: #6b7280;
                font-weight: 500;
                text-align: center;
            }

            /* Buttons */
            .tour-buttons {
                display: flex;
                justify-content: space-between;
                gap: 10px;
            }

            .tour-btn {
                flex: 1;
                padding: 10px 20px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                font-family: inherit;
            }

            .tour-btn-prev {
                background: #f3f4f6;
                color: #6b7280;
            }

            .tour-btn-prev:hover {
                background: #e5e7eb;
                color: #4b5563;
            }

            .tour-btn-next {
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: white;
            }

            .tour-btn-next:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
            }

            .tour-btn-finish {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            }

            .tour-btn-finish:hover {
                box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
            }

            /* Responsive */
            @media (max-width: 600px) {
                .tour-tooltip {
                    width: calc(100vw - 40px);
                }

                .tour-tooltip-header {
                    padding: 16px;
                }

                .tour-tooltip-title {
                    font-size: 18px;
                }

                .tour-tooltip-text {
                    padding: 12px 16px;
                    font-size: 14px;
                }

                .tour-tooltip-footer {
                    padding: 12px 16px 16px 16px;
                }

                .tour-buttons {
                    flex-direction: column;
                }

                .tour-btn {
                    width: 100%;
                }
            }

            /* RTL Support */
            [dir="rtl"] .tour-btn-prev {
                order: 2;
            }

            [dir="rtl"] .tour-btn-next {
                order: 1;
            }
        `;

        document.head.appendChild(style);
    }
}

// אתחול אוטומטי
let smartFAQBot;
let systemTour;

document.addEventListener('DOMContentLoaded', () => {
    smartFAQBot = new SmartFAQBot();
    systemTour = new SystemTour();

    // חשוף את smartFAQBot ל-window scope כדי שיהיה נגיש מ-onclick attributes
    window.smartFAQBot = smartFAQBot;
    window.systemTour = systemTour;

    Logger.log('⚖️ העוזר המשפטי החכם הופעל - v3.0');
});

// ייצוא למודול
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartFAQBot;
}
