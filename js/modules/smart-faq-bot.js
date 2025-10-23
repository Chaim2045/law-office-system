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

                <div class="faq-bot-messages" id="faq-bot-messages">
                    <!-- הודעות יופיעו כאן -->
                </div>

                <div class="faq-bot-suggestions" id="faq-bot-suggestions">
                    <!-- הצעות יופיעו כאן -->
                </div>

                <div class="faq-bot-input-container">
                    <input
                        type="text"
                        id="faq-bot-input"
                        class="faq-bot-input"
                        placeholder="שאל שאלה או חפש נושא..."
                        autocomplete="off"
                    />
                    <button class="faq-bot-send" id="faq-bot-send">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="22" y1="2" x2="11" y2="13"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
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

            .faq-bot-messages {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                background: #f9fafb;
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
                padding: 12px;
                background: white;
                border-top: 1px solid #e5e7eb;
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                max-height: 120px;
                overflow-y: auto;
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

            .faq-bot-input-container {
                display: flex;
                gap: 8px;
                padding: 16px;
                background: white;
                border-top: 1px solid #e5e7eb;
            }

            .faq-bot-input {
                flex: 1;
                border: 2px solid #e5e7eb;
                border-radius: 24px;
                padding: 10px 16px;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s;
                color: #374151;
            }

            .faq-bot-input:focus {
                border-color: #3b82f6;
            }

            .faq-bot-input::placeholder {
                color: #9ca3af;
            }

            .faq-bot-send {
                width: 44px;
                height: 44px;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                border: none;
                border-radius: 50%;
                color: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                flex-shrink: 0;
            }

            .faq-bot-send:hover {
                transform: scale(1.1);
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
            }

            .faq-bot-send:active {
                transform: scale(0.95);
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
        const sendBtn = document.getElementById('faq-bot-send');
        const input = document.getElementById('faq-bot-input');

        button.addEventListener('click', () => this.toggleBot());
        closeBtn.addEventListener('click', () => this.toggleBot());
        newChatBtn.addEventListener('click', () => this.startNewChat());
        sendBtn.addEventListener('click', () => this.handleUserInput());

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleUserInput();
            }
        });
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

        // הצג הודעת פתיחה מחדש
        const userName = this.getUserName();
        const greeting = userName ? `<strong>שלום ${userName}! 👋</strong>` : `<strong>שלום! 👋</strong>`;

        this.addBotMessage(`
            ${greeting}
            <p>אני כאן לעזור לך! 😊</p>
            <p>מה תרצה לדעת?</p>
        `);

        // הצג הצעות
        this.showContextualSuggestions();

        // הצג הצעה פרואקטיבית (אם יש)
        this.showProactiveSuggestion();

        // נקה את שדה הקלט
        document.getElementById('faq-bot-input').value = '';
        document.getElementById('faq-bot-input').focus();
    }

    toggleBot() {
        const container = document.getElementById('faq-bot-container');
        this.isOpen = !this.isOpen;

        if (this.isOpen) {
            container.classList.remove('hidden');
            document.getElementById('faq-bot-input').focus();

            // עדכן סטטוס עם שם המשתמש
            const userName = this.getUserName();
            const statusElement = document.querySelector('.faq-bot-status');
            if (statusElement && userName) {
                statusElement.textContent = `עוזר ל${userName}`;
            }

            // הודעת פתיחה
            if (this.chatHistory.length === 0) {
                const greeting = userName
                    ? `<strong>שלום ${userName}! 👋</strong>`
                    : `<strong>שלום! 👋</strong>`;

                this.addBotMessage(`
                    ${greeting}
                    <p>אני העוזר המשפטי החכם שלך.</p>
                    <p>איך אוכל לעזור לך היום?</p>
                `);
                this.showContextualSuggestions();

                // הצג הצעה פרואקטיבית (אם יש)
                this.showProactiveSuggestion();
            }
        } else {
            container.classList.add('hidden');
        }
    }

    handleUserInput() {
        const input = document.getElementById('faq-bot-input');
        const query = input.value.trim();

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

        suggestions.forEach(suggestion => {
            const chip = document.createElement('button');
            chip.className = 'faq-suggestion-chip';
            chip.textContent = suggestion;
            chip.addEventListener('click', () => {
                document.getElementById('faq-bot-input').value = suggestion;
                this.handleUserInput();
            });
            suggestionsContainer.appendChild(chip);
        });
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
        console.log('📊 DEBUG - נתוני שעות:', {
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

            // צור בועה עם הודעה
            if (message) {
                const bubble = document.createElement('div');
                bubble.className = 'bot-highlight-bubble';
                bubble.innerHTML = message;
                bubble.style.cssText = `
                    position: absolute;
                    top: ${rect.top + scrollTop - 60}px;
                    left: ${rect.left + scrollLeft}px;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    padding: 12px 16px;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    z-index: 9998;
                    font-size: 14px;
                    font-weight: 500;
                    max-width: 250px;
                    pointer-events: none;
                    animation: botBubbleAppear 0.3s ease;
                `;
                document.body.appendChild(bubble);
            }

            // גלול לאלמנט
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // הסר אחרי זמן
            setTimeout(() => {
                this.removeAllHighlights();
            }, duration);

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
        console.log('פעולה:', action, 'Selector:', selector);

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

// אתחול אוטומטי
let smartFAQBot;

document.addEventListener('DOMContentLoaded', () => {
    smartFAQBot = new SmartFAQBot();
    console.log('⚖️ העוזר המשפטי החכם הופעל - v1.0');
});

// ייצוא למודול
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartFAQBot;
}
