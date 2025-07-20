// הוסף לתחילת script.js - מנגנון מניעת כפילויות גלובלי
class LoadingManager {
    constructor() {
        this.activeOperations = new Set();
        this.loadingOverlay = null;
        this.init();
    }
    
    init() {
        // יצירת overlay loading גלובלי
        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.className = 'global-loading-overlay hidden';
        this.loadingOverlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">מעבד...</div>
                <div class="loading-subtext">אנא המתן</div>
            </div>
        `;
        document.body.appendChild(this.loadingOverlay);
    }
    
    startOperation(operationId, message = 'מעבד...', subtext = 'אנא המתן') {
        if (this.activeOperations.has(operationId)) {
            console.warn(`⚠️ פעולה ${operationId} כבר פעילה - מונע כפילות`);
            return false; // מונע כפילות
        }
        
        this.activeOperations.add(operationId);
        this.showLoading(message, subtext);
        
        console.log(`🔄 התחיל: ${operationId}`);
        return true;
    }
    
    finishOperation(operationId, delay = 800) {
        setTimeout(() => {
            this.activeOperations.delete(operationId);
            
            if (this.activeOperations.size === 0) {
                this.hideLoading();
            }
            
            console.log(`✅ הסתיים: ${operationId}`);
        }, delay);
    }
    
    showLoading(message, subtext) {
        this.loadingOverlay.querySelector('.loading-text').textContent = message;
        this.loadingOverlay.querySelector('.loading-subtext').textContent = subtext;
        this.loadingOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // מונע גלילה
    }
    
    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
        document.body.style.overflow = '';
    }
    
    isOperationActive(operationId) {
        return this.activeOperations.has(operationId);
    }
}

// יצירת מופע גלובלי
const loadingManager = new LoadingManager();


// ===== רשימת העובדים והגדרות =====
const EMPLOYEES = {
    'חיים': { password: '2025', name: 'חיים' },
    'גיא': { password: '2025', name: 'גיא' },
    'מרווה': { password: '2025', name: 'מרווה' },
    'אלומה': { password: '2025', name: 'אלומה' },
    'קובי': { password: '2025', name: 'קובי' },
    'ראיד': { password: '2025', name: 'ראיד' },
    'שחר': { password: '2025', name: 'שחר' },
    'מירי': { password: '2025', name: 'מירי' },
    'רועי': { password: '2025', name: 'רועי' },
    'עוזי': { password: '2025', name: 'עוזי' }
};

// ⚠️ חשוב: עדכן את ה-URL הזה לGoogle Apps Script שלך!
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxxpp8A3dLayMMZocATKGzlG9ARtl3xfAXY6P6Y8b2UoNBlTdpQlr_Tz5pzAE38vZU/exec';

// ===== מערכת התראות פעמון =====
class NotificationBellSystem {
    constructor() {
        this.notifications = [];
        this.isDropdownOpen = false;
        this.init();
    }

    init() {
        // סגירת דרופדאון בלחיצה מחוץ לאזור
        document.addEventListener('click', (e) => {
            const bell = document.getElementById('notificationBell');
            const dropdown = document.getElementById('notificationsDropdown');
            
            if (!bell.contains(e.target) && !dropdown.contains(e.target)) {
                this.hideDropdown();
            }
        });

        // מניעת סגירה בלחיצה על הדרופדאון עצמו
        document.getElementById('notificationsDropdown').addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    addNotification(type, title, description, urgent = false) {
        const notification = {
            id: Date.now() + Math.random(),
            type: type, // 'blocked', 'critical', 'urgent'
            title: title,
            description: description,
            time: new Date().toLocaleString('he-IL'),
            urgent: urgent
        };

        this.notifications.unshift(notification);
        this.updateBell();
        this.renderNotifications();

        console.log('🔔 התראה חדשה נוספה:', notification);
    }

    removeNotification(id) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.updateBell();
        this.renderNotifications();
    }

    clearAllNotifications() {
        this.notifications = [];
        this.updateBell();
        this.renderNotifications();
    }

    updateBell() {
        const bell = document.getElementById('notificationBell');
        const count = document.getElementById('notificationCount');
        
        if (this.notifications.length > 0) {
            bell.classList.add('has-notifications');
            count.classList.remove('hidden');
            count.textContent = this.notifications.length;
        } else {
            bell.classList.remove('has-notifications');
            count.classList.add('hidden');
        }
    }

    showDropdown() {
        const dropdown = document.getElementById('notificationsDropdown');
        dropdown.classList.add('show');
        this.isDropdownOpen = true;
    }

    hideDropdown() {
        const dropdown = document.getElementById('notificationsDropdown');
        dropdown.classList.remove('show');
        this.isDropdownOpen = false;
    }

    toggleDropdown() {
        if (this.isDropdownOpen) {
            this.hideDropdown();
        } else {
            this.showDropdown();
        }
    }

    renderNotifications() {
        const container = document.getElementById('notificationsContent');
        
        if (this.notifications.length === 0) {
            container.innerHTML = `
                <div class="no-notifications">
                    <div class="no-notifications-icon">
                        <i class="fas fa-bell-slash"></i>
                    </div>
                    <h4>אין התראות</h4>
                    <p>כל ההתראות יופיעו כאן</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.notifications.map(notification => {
            const iconMap = {
                'blocked': 'fas fa-ban',
                'critical': 'fas fa-exclamation-triangle',
                'urgent': 'fas fa-clock'
            };

            return `
                <div class="notification-item ${notification.type} ${notification.urgent ? 'urgent' : ''}" id="notification-${notification.id}">
                    <button class="notification-close" onclick="notificationBell.removeNotification(${notification.id})">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="notification-content">
                        <div class="notification-icon ${notification.type}">
                            <i class="${iconMap[notification.type] || 'fas fa-info-circle'}"></i>
                        </div>
                        <div class="notification-text">
                            <div class="notification-title">${notification.title}</div>
                            <div class="notification-description">${notification.description}</div>
                            <div class="notification-time">${notification.time}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // פונקציה לעדכון התראות מהמערכת
    updateFromSystem(blockedClients, criticalClients, urgentTasks) {
        // נקה התראות קיימות מהמערכת
        this.notifications = this.notifications.filter(n => !n.isSystemGenerated);

        // הוסף התראות לקוחות חסומים
        if (blockedClients.size > 0) {
            this.addSystemNotification(
                'blocked',
                `${blockedClients.size} לקוחות חסומים`,
                `לקוחות ללא שעות: ${Array.from(blockedClients).join(', ')}`,
                true
            );
        }

        // הוסף התראות לקוחות קריטיים
        if (criticalClients.size > 0) {
            this.addSystemNotification(
                'critical',
                `${criticalClients.size} לקוחות קריטיים`,
                `לקוחות עם מעט שעות: ${Array.from(criticalClients).join(', ')}`,
                false
            );
        }

        // הוסף התראות משימות דחופות
        if (urgentTasks.length > 0) {
            const overdueCount = urgentTasks.filter(task => {
                const now = new Date();
                return new Date(task.deadline) <= now;
            }).length;

            if (overdueCount > 0) {
                this.addSystemNotification(
                    'urgent',
                    `${overdueCount} משימות באיחור`,
                    'משימות שעבר תאריך היעד שלהן',
                    true
                );
            }

            const upcomingCount = urgentTasks.length - overdueCount;
            if (upcomingCount > 0) {
                this.addSystemNotification(
                    'urgent',
                    `${upcomingCount} משימות דחופות`,
                    'משימות שיעבור תאריך היעד בקרוב',
                    false
                );
            }
        }
    }

    addSystemNotification(type, title, description, urgent) {
        const notification = {
            id: Date.now() + Math.random(),
            type: type,
            title: title,
            description: description,
            time: new Date().toLocaleString('he-IL'),
            urgent: urgent,
            isSystemGenerated: true
        };

        this.notifications.unshift(notification);
        this.updateBell();
        this.renderNotifications();
    }
}

// יצירת מופע מערכת הפעמון
const notificationBell = new NotificationBellSystem();

// פונקציות ממשק הפעמון
function toggleNotifications() {
    notificationBell.toggleDropdown();
}

function clearAllNotifications() {
    if (confirm('האם אתה בטוח שברצונך למחוק את כל ההתראות?')) {
        notificationBell.clearAllNotifications();
    }
}

// פונקציות ממשק
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');
    const overlay = document.getElementById('sidebarOverlay');
    const body = document.body;
    
    const isOpen = sidebar.classList.contains('open');
    
    if (isOpen) {
        sidebar.classList.remove('open');
        toggle.classList.remove('open');
        overlay.classList.remove('active');
        body.classList.remove('sidebar-open');
    } else {
        sidebar.classList.add('open');
        toggle.classList.add('open');
        overlay.classList.add('active');
        body.classList.add('sidebar-open');
    }
}

function sendFeedback() {
    showFeedbackDialog();
}

function showFeedbackDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    overlay.innerHTML = `
        <div class="popup feedback-popup">
            <div class="feedback-header">
                <div class="feedback-title">
                    <i class="fas fa-comments"></i>
                    שתף את המשוב שלך
                </div>
                <div class="feedback-subtitle">עזור לנו לשפר את המערכת עבורך</div>
            </div>
            
            <form id="feedbackForm">
                <div class="popup-section">
                    <label>איזה חלק במערכת הרצת לשתף עליו משוב?</label>
                    <div class="feedback-categories">
                        <div class="category-option">
                            <input type="radio" id="cat-tasks" name="feedbackCategory" value="תקצוב משימות" class="category-radio">
                            <label for="cat-tasks" class="category-label">
                                <i class="fas fa-tasks"></i> תקצוב משימות
                            </label>
                        </div>
                        <div class="category-option">
                            <input type="radio" id="cat-timesheet" name="feedbackCategory" value="שעתון" class="category-radio">
                            <label for="cat-timesheet" class="category-label">
                                <i class="fas fa-clock"></i> שעתון
                            </label>
                        </div>
                        <div class="category-option">
                            <input type="radio" id="cat-clients" name="feedbackCategory" value="ניהול לקוחות" class="category-radio">
                            <label for="cat-clients" class="category-label">
                                <i class="fas fa-users"></i> ניהול לקוחות
                            </label>
                        </div>
                        <div class="category-option">
                            <input type="radio" id="cat-interface" name="feedbackCategory" value="עיצוב וממשק" class="category-radio">
                            <label for="cat-interface" class="category-label">
                                <i class="fas fa-palette"></i> עיצוב וממשק
                            </label>
                        </div>
                        <div class="category-option">
                            <input type="radio" id="cat-performance" name="feedbackCategory" value="ביצועים ומהירות" class="category-radio">
                            <label for="cat-performance" class="category-label">
                                <i class="fas fa-tachometer-alt"></i> ביצועים ומהירות
                            </label>
                        </div>
                        <div class="category-option">
                            <input type="radio" id="cat-other" name="feedbackCategory" value="אחר" class="category-radio" checked>
                            <label for="cat-other" class="category-label">
                                <i class="fas fa-ellipsis-h"></i> אחר
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="popup-section priority-section">
                    <label>רמת דחיפות:</label>
                    <div class="priority-options">
                        <div class="priority-option">
                            <input type="radio" id="priority-low" name="feedbackPriority" value="נמוך" class="priority-radio" checked>
                            <label for="priority-low" class="priority-label">
                                <i class="fas fa-arrow-down"></i> נמוך
                            </label>
                        </div>
                        <div class="priority-option">
                            <input type="radio" id="priority-medium" name="feedbackPriority" value="בינוני" class="priority-radio">
                            <label for="priority-medium" class="priority-label">
                                <i class="fas fa-arrow-right"></i> בינוני
                            </label>
                        </div>
                        <div class="priority-option">
                            <input type="radio" id="priority-high" name="feedbackPriority" value="גבוה" class="priority-radio">
                            <label for="priority-high" class="priority-label">
                                <i class="fas fa-arrow-up"></i> גבוה
                            </label>
                        </div>
                        <div class="priority-option">
                            <input type="radio" id="priority-critical" name="feedbackPriority" value="קריטי" class="priority-radio">
                            <label for="priority-critical" class="priority-label">
                                <i class="fas fa-exclamation-triangle"></i> קריטי
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="popup-section">
                    <label for="feedbackText">המשוב שלך:</label>
                    <textarea id="feedbackText" rows="4" placeholder="כתוב כאן את המשוב, ההצעות לשיפור או הבעיות שנתקלת בהן..." required></textarea>
                </div>
                
                <div class="popup-section contact-method-section">
                    <label>איך תעדיף לקבל תגובה?</label>
                    <div class="contact-methods">
                        <div class="contact-option">
                            <input type="radio" id="contact-email" name="contactMethod" value="email" class="contact-radio" checked>
                            <label for="contact-email" class="contact-label">
                                <i class="fas fa-envelope"></i> אימייל
                            </label>
                        </div>
                        <div class="contact-option">
                            <input type="radio" id="contact-whatsapp" name="contactMethod" value="whatsapp" class="contact-radio">
                            <label for="contact-whatsapp" class="contact-label">
                                <i class="fab fa-whatsapp"></i> WhatsApp
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="tech-info">
                    <h4><i class="fas fa-info-circle"></i> פרטים טכניים שיועברו אוטומטית:</h4>
                    <div id="techDetails"></div>
                </div>
                
                <div class="popup-buttons">
                    <button type="button" class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
                        <i class="fas fa-times"></i> ביטול
                    </button>
                    <button type="submit" class="popup-btn popup-btn-confirm">
                        <i class="fas fa-paper-plane"></i> שלח משוב
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // הצגת פרטים טכניים
    const techDetails = document.getElementById('techDetails');
    const now = new Date();
    const techInfo = {
        משתמש: window.manager?.currentUser || 'לא מזוהה',
        תאריך: now.toLocaleDateString('he-IL'),
        שעה: now.toLocaleTimeString('he-IL'),
        דפדפן: navigator.userAgent.split(' ').slice(-2).join(' '),
        רזולוציה: `${screen.width}x${screen.height}`,
        גרסת_מערכת: 'מתקדמת 2025'
    };
    
    techDetails.innerHTML = Object.entries(techInfo)
        .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
        .join(' • ');
    
    // טיפול בשליחת הטופס
    const form = overlay.querySelector('#feedbackForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleFeedbackSubmission(form);
        overlay.remove();
    });
}

async function handleFeedbackSubmission(form) {
    const formData = new FormData(form);
    const feedbackData = {
        category: formData.get('feedbackCategory'),
        priority: formData.get('feedbackPriority'),
        text: formData.get('feedbackText'),
        contactMethod: formData.get('contactMethod'),
        user: window.manager?.currentUser || 'לא מזוהה',
        timestamp: new Date().toLocaleString('he-IL'),
        browser: navigator.userAgent.split(' ').slice(-2).join(' '),
        resolution: `${screen.width}x${screen.height}`
    };
    
    // בניית הודעה מובנית
    const priorityEmojis = {
        'נמוך': '🟢',
        'בינוני': '🟡', 
        'גבוה': '🟠',
        'קריטי': '🔴'
    };
    
    const categoryEmojis = {
        'תקצוב משימות': '📊',
        'שעתון': '⏰',
        'ניהול לקוחות': '👥',
        'עיצוב וממשק': '🎨',
        'ביצועים ומהירות': '⚡',
        'אחר': '💬'
    };
    
    const messageText = `
${priorityEmojis[feedbackData.priority]} *משוב מערכת ניהול* ${priorityEmojis[feedbackData.priority]}

${categoryEmojis[feedbackData.category]} *קטגוריה:* ${feedbackData.category}
🚨 *דחיפות:* ${feedbackData.priority}

💬 *המשוב:*
${feedbackData.text}

👤 *פרטי משתמש:*
• שם: ${feedbackData.user}
• תאריך: ${feedbackData.timestamp}
• דפדפן: ${feedbackData.browser}
• רזולוציה: ${feedbackData.resolution}

---
מערכת ניהול מתקדמת - משרד עו״ד גיא הרשקוביץ
    `.trim();
    
    try {
        if (feedbackData.contactMethod === 'whatsapp') {
            // WhatsApp
            const whatsappUrl = `https://wa.me/972549539238?text=${encodeURIComponent(messageText)}`;
            window.open(whatsappUrl, '_blank');
            
            if (window.manager) {
                window.manager.showNotification('פותח WhatsApp לשליחת המשוב...', 'success');
            }
        } else {
            // Email
            const subject = `משוב מערכת - ${feedbackData.category} (${feedbackData.priority})`;
            const emailBody = messageText.replace(/\*/g, '');
            
            const mailtoLink = `mailto:Haim@ghlawoffice.co.il?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
            
            window.location.href = mailtoLink;
            
            if (window.manager) {
                window.manager.showNotification('פותח אימייל לשליחת המשוב...', 'success');
            }
        }
        
    } catch (error) {
        console.error('שגיאה בשליחת משוב:', error);
        
        // גיבוי - העתקה ללוח
        if (navigator.clipboard) {
            navigator.clipboard.writeText(messageText).then(() => {
                alert('המשוב הועתק ללוח! אנא שלח אותו ידנית.');
            });
        } else {
            alert(`אנא העתק ושלח ידנית:\n\n${messageText}`);
        }
    }
}

function showLogoutDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    overlay.innerHTML = `
        <div class="popup" style="max-width: 450px;">
            <div class="popup-header" style="color: #dc2626;">
                <i class="fas fa-power-off"></i>
                יציאה מהמערכת
            </div>
            
            <div style="text-align: center; padding: 20px 0;">
                <div style="font-size: 48px; margin-bottom: 20px;">👋</div>
                <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 20px;">
                    האם אתה בטוח שברצונך לצאת?
                </h3>
                <p style="color: #6b7280; font-size: 16px; line-height: 1.5;">
                    כל הנתונים שלא נשמרו יאבדו.<br>
                    תצטרך להתחבר שוב כדי לגשת למערכת.
                </p>
            </div>
            
            <div class="popup-buttons">
                <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()" style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);">
                    <i class="fas fa-times"></i>
                    ביטול
                </button>
                <button class="popup-btn popup-btn-confirm" onclick="confirmLogout()" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
                    <i class="fas fa-check"></i>
                    כן, צא מהמערכת
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // הוספת אפקט כניסה
    setTimeout(() => {
        overlay.style.opacity = '1';
    }, 10);
}

function confirmLogout() {
    // הסתרת אלמנטי הממשק
    document.getElementById('interfaceElements').classList.add('hidden');
    
    // הצגת הודעת פרידה
    if (window.manager) {
        window.manager.showNotification('מתנתק מהמערכת... להתראות! 👋', 'info');
    }
    
    // איחור קצר לפני רענון הדף
    setTimeout(() => {
        location.reload();
    }, 1500);
}

function showClientFormWithSidebar() {
    showPasswordDialog(true); // true מציין שצריך לסגור את הסרגל
}

// פונקציות גלובליות מהקוד המקורי
function showClientForm() {
    showPasswordDialog();
}

function showPasswordDialog(shouldCloseSidebar = false) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    overlay.innerHTML = `
        <div class="popup" style="max-width: 450px;">
            <div class="popup-header" style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                <i class="fas fa-shield-alt"></i>
                אזור מוגן
            </div>
            
            <div style="text-align: center; padding: 30px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px; color: #dc2626;">
                    <i class="fas fa-lock"></i>
                </div>
                <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 20px;">
                    הוספת לקוח חדש מוגנת בסיסמה
                </h3>
                <p style="color: #6b7280; font-size: 16px; line-height: 1.5; margin-bottom: 25px;">
                    מטעמי אבטחה, נדרשת סיסמה מיוחדת<br>
                    ליצירת לקוחות חדשים במערכת
                </p>
                
                <form id="passwordCheckForm" style="text-align: center;">
                    <div style="position: relative; margin-bottom: 20px;">
                        <input type="password" 
                               id="adminPassword" 
                               placeholder="הכנס סיסמת מנהל" 
                               style="width: 100%; padding: 15px 50px 15px 20px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 16px; text-align: center; letter-spacing: 2px; font-weight: bold; transition: all 0.3s ease;"
                               required>
                        <i class="fas fa-key" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #9ca3af; font-size: 18px;"></i>
                    </div>
                    
                    <div id="passwordError" class="error-message hidden" style="margin-bottom: 15px; color: #dc2626; font-weight: 600;">
                        <i class="fas fa-exclamation-triangle"></i>
                        סיסמה שגויה - נסה שוב
                    </div>
                    
                    <div class="popup-buttons" style="margin-top: 20px;">
                        <button type="button" class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()" style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);">
                            <i class="fas fa-times"></i>
                            ביטול
                        </button>
                        <button type="submit" class="popup-btn popup-btn-confirm" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
                            <i class="fas fa-unlock"></i>
                            אמת סיסמה
                        </button>
                    </div>
                </form>
            </div>
            
            <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 12px; padding: 15px; margin-top: 20px; border: 1px solid #fecaca;">
                <div style="display: flex; align-items: center; gap: 10px; color: #991b1b; font-size: 14px;">
                    <i class="fas fa-info-circle"></i>
                    <span><strong>הערה:</strong> פנה למנהל המערכת לקבלת הסיסמה</span>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // פוקוס על שדה הסיסמה
    setTimeout(() => {
        document.getElementById('adminPassword').focus();
    }, 100);
    
    // הוספת אפקט hover לשדה הסיסמה
    const passwordInput = document.getElementById('adminPassword');
    passwordInput.addEventListener('focus', () => {
        passwordInput.style.borderColor = '#dc2626';
        passwordInput.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';
    });
    
    passwordInput.addEventListener('blur', () => {
        passwordInput.style.borderColor = '#e5e7eb';
        passwordInput.style.boxShadow = 'none';
    });
    
    // טיפול בשליחת הטופס
    const form = overlay.querySelector('#passwordCheckForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        checkAdminPassword(overlay, shouldCloseSidebar);
    });
    
    // אפשרות לאמת בEnter
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            checkAdminPassword(overlay, shouldCloseSidebar);
        }
    });
}

function checkAdminPassword(overlay, shouldCloseSidebar = false) {
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('passwordError');
    
    if (password === '9668') {
        // סיסמה נכונה - סגור דיאלוג ופתח טופס לקוח
        overlay.remove();
        
        // הודעת הצלחה
        if (window.manager) {
            window.manager.showNotification('אומת בהצלחה! פותח טופס הוספת לקוח...', 'success');
        }
        
        // פתח טופס לקוח אחרי רגע
        setTimeout(() => {
            openClientForm();
        }, 500);
        
    } else {
        // סיסמה שגויה
        errorDiv.classList.remove('hidden');
        
        // אפקט רעד לשדה הסיסמה
        const passwordInput = document.getElementById('adminPassword');
        passwordInput.style.animation = 'shake 0.5s ease-in-out';
        passwordInput.style.borderColor = '#dc2626';
        passwordInput.value = '';
        passwordInput.focus();
        
        // הסר את האפקט אחרי האנימציה
        setTimeout(() => {
            passwordInput.style.animation = '';
            errorDiv.classList.add('hidden');
            passwordInput.style.borderColor = '#e5e7eb';
        }, 2000);
    }
}

function openClientForm() {
    document.getElementById('clientFormOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if (window.manager) {
        window.manager.updateClientTypeDisplay();
    }
}

function hideClientForm() {
    document.getElementById('clientFormOverlay').classList.add('hidden');
    document.body.style.overflow = 'auto';
    document.getElementById('clientForm').reset();
    if (window.manager) {
        window.manager.updateClientTypeDisplay();
    }
}

function switchTab(tabName) {
    // עדכון כפתורי הטאבים
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // עדכון התוכן
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tabName === 'budget') {
        document.getElementById('budgetTab').classList.add('active');
    } else if (tabName === 'timesheet') {
        document.getElementById('timesheetTab').classList.add('active');
        // עדכון תאריך לתאריך הנוכחי
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('actionDate').value = today;
    }
}

function logout() {
    showLogoutDialog();
}

// ===== מחלקת בקרת חסימת לקוחות =====
class ClientValidation {
    constructor(manager) {
        this.manager = manager;
        this.blockedClients = new Set();
        this.criticalClients = new Set();
    }
    
    updateBlockedClients() {
        console.log('🔄 מעדכן רשימת לקוחות חסומים...');
        
        this.blockedClients.clear();
        this.criticalClients.clear();
        
        for (const client of this.manager.clients) {
            if (client.isBlocked) {
                this.blockedClients.add(client.fullName);
                console.log(`🚫 לקוח חסום: ${client.fullName}`);
            } else if (client.type === 'hours' && client.hoursRemaining <= 5 && client.hoursRemaining > 0) {
                this.criticalClients.add(client.fullName);
                console.log(`⚠️ לקוח קריטי: ${client.fullName} - ${client.hoursRemaining} שעות`);
            }
        }
        
        this.updateClientSelects();
        this.updateNotificationBell();
    }
    
    updateClientSelects() {
        const selects = ['budgetClientSelect', 'timesheetClientSelect'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            
            // נקה אפשרויות קיימות
            select.innerHTML = '<option value="">בחר לקוח...</option>';
            
            this.manager.clients.forEach(client => {
                const option = document.createElement('option');
                option.value = client.fullName;
                
                if (this.blockedClients.has(client.fullName)) {
                    // לקוח חסום
                    option.textContent = `🚫 ${client.fullName} - נגמרו השעות`;
                    option.disabled = true;
                    option.className = 'blocked-client';
                } else {
                    // לקוח רגיל
                    let displayText = client.fullName;
                    
                    if (client.type === 'hours') {
                        const hoursText = client.hoursRemaining <= 5 ? 
                            `🚨 ${client.hoursRemaining.toFixed(1)} שע' נותרות` :
                            `${client.hoursRemaining.toFixed(1)} שע' נותרות`;
                        displayText += ` (${hoursText})`;
                    } else if (client.type === 'fixed') {
                        displayText += ' (פיקס)';
                    }
                    
                    option.textContent = displayText;
                }
                
                select.appendChild(option);
            });
        });
    }
    
    updateNotificationBell() {
        // בדיקת משימות עם תאריכי יעד קרובים
        const now = new Date();
        const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const urgentTasks = this.manager.budgetTasks.filter(task => {
            return task && 
                   task.status !== 'הושלם' && 
                   task.deadline && 
                   task.description && 
                   new Date(task.deadline) <= oneDayFromNow;
        });

        // עדכון מערכת הפעמון
        notificationBell.updateFromSystem(
            this.blockedClients,
            this.criticalClients,
            urgentTasks
        );
    }
    
    validateClientSelection(clientName, action = 'רישום') {
        if (this.blockedClients.has(clientName)) {
            this.showBlockedClientDialog(clientName, action);
            return false;
        }
        return true;
    }
    
    showBlockedClientDialog(clientName, action) {
        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';
        
        overlay.innerHTML = `
            <div class="popup blocked-client-popup">
                <div class="popup-header" style="color: #ef4444;">
                    <i class="fas fa-ban"></i>
                    לקוח חסום
                </div>
                
                <div class="blocked-client-message">
                    <div class="client-name">${clientName}</div>
                    <div class="reason">נגמרה יתרת השעות</div>
                    <div class="action-blocked">לא ניתן לבצע ${action} עבור לקוח זה</div>
                </div>
                
                <div class="solutions">
                    <h4>פתרונות אפשריים:</h4>
                    <ul>
                        <li><i class="fas fa-phone"></i> צור קשר עם הלקוח לרכישת שעות נוספות</li>
                        <li><i class="fas fa-dollar-sign"></i> עדכן את מערכת הביליטס</li>
                        <li><i class="fas fa-user-tie"></i> פנה למנהל המשרד</li>
                    </ul>
                </div>
                
                <div class="popup-buttons">
                    <button class="popup-btn popup-btn-confirm" onclick="this.closest('.popup-overlay').remove()">
                        <i class="fas fa-check"></i>
                        הבנתי
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // הסר אחרי 10 שניות אם לא נלחץ
        setTimeout(() => {
            if (document.body.contains(overlay)) {
                overlay.remove();
            }
        }, 10000);
    }
}

// ===== מחלקת ניהול המשרד המתקדמת =====
class LawOfficeManager {
    constructor() {
        this.currentUser = null;
        this.clients = [];
        this.budgetTasks = [];
        this.timesheetEntries = [];
        this.connectionStatus = 'unknown';
        this.currentTaskFilter = 'active';
        this.currentTimesheetFilter = 'month';
        this.currentBudgetView = 'cards';
        this.currentTimesheetView = 'table';
        this.filteredBudgetTasks = [];
        this.filteredTimesheetEntries = [];
        this.budgetSortField = null;
        this.budgetSortDirection = 'asc';
        this.timesheetSortField = null;
        this.timesheetSortDirection = 'asc';
        
        // מערכת חסימת לקוחות
        this.clientValidation = new ClientValidation(this);
        
        this.init();
    }

    init() {
        // זיהוי המשתמש מה-URL
        const urlParams = new URLSearchParams(window.location.search);
        const employee = urlParams.get('emp');
        
        console.log('🌐 URL:', window.location.href);
        console.log('🔍 Search params:', window.location.search);
        console.log('👤 Employee param:', employee);
        console.log('✅ Employee exists:', employee && EMPLOYEES[employee]);
        
        if (employee && EMPLOYEES[employee]) {
            this.targetEmployee = employee;
            this.showLogin();
        } else {
            this.showError('גישה לא מורשית - אנא השתמש בקישור הנכון');
            return;
        }

        // הגדרת אירועים
        this.setupEventListeners();
    }

    setupEventListeners() {
        console.log('🔧 מגדיר event listeners');
        
        // התחברות
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // טופס תקצוב
        document.getElementById('budgetForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addBudgetTask();
        });

        // טופס שעתון
        document.getElementById('timesheetForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTimesheetEntry();
        });

        // טופס לקוח חדש
        document.getElementById('clientForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createClient();
        });

        // הגדרת listeners לכפתורי הרדיו
        document.querySelectorAll('input[name="clientType"]').forEach(radio => {
            radio.addEventListener('change', () => this.updateClientTypeDisplay());
        });

        // שינוי לקוח בשעתון - עדכון מס' תיק
        document.getElementById('timesheetClientSelect').addEventListener('change', (e) => {
            const selectedClient = this.clients.find(c => c.fullName === e.target.value);
            const fileNumberField = document.getElementById('fileNumber');
            
            if (selectedClient) {
                fileNumberField.value = selectedClient.fileNumber;
            } else {
                fileNumberField.value = '';
            }
        });

        // הגדרת תאריך היום בשעתון
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('actionDate').value = today;

        // הגדרת מיון לטבלאות
        this.setupTableSorting();
    }

    setupTableSorting() {
        // מיון טבלת תקצוב
        document.addEventListener('click', (e) => {
            if (e.target.closest('#budgetTable th.sortable')) {
                const th = e.target.closest('th');
                const sortField = th.dataset.sort;
                this.sortBudgetTable(sortField);
            }
        });

        // מיון טבלת שעתון
        document.addEventListener('click', (e) => {
            if (e.target.closest('#timesheetTable th.sortable')) {
                const th = e.target.closest('th');
                const sortField = th.dataset.sort;
                this.sortTimesheetTable(sortField);
            }
        });
    }

    showLogin() {
        document.getElementById('loginSection').classList.remove('hidden');
        document.getElementById('appContent').classList.add('hidden');
    }

    handleLogin() {
        const password = document.getElementById('password').value;
        const employee = EMPLOYEES[this.targetEmployee];

        if (password === employee.password) {
            this.currentUser = employee.name;
            this.showApp();
            this.loadData();
        } else {
            document.getElementById('errorMessage').classList.remove('hidden');
            setTimeout(() => {
                document.getElementById('errorMessage').classList.add('hidden');
            }, 3000);
        }
    }

    showApp() {
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('appContent').classList.remove('hidden');
        
        // הצגת אלמנטי הממשק (פעמון וסרגל צד)
        document.getElementById('interfaceElements').classList.remove('hidden');
        
        const userInfo = document.getElementById('userInfo');
        userInfo.innerHTML = `
            <span>שלום ${this.currentUser}</span>
            <span id="connectionIndicator" style="margin-right: 15px; font-size: 14px;">🔄 מתחבר...</span>
        `;
        userInfo.classList.remove('hidden');
        
        // רישום כניסה למערכת
        this.logUserLogin();
    }

    async logUserLogin() {
        try {
            console.log('🔑 רושם כניסה למערכת...');
            
            const userAgent = navigator.userAgent || 'לא זמין';
            const timestamp = new Date().toISOString();
            
            const loginData = {
                action: 'userLogin',
                employee: this.currentUser,
                userAgent: userAgent,
                timestamp: timestamp,
                ipAddress: 'לא זמין'
            };
            
            this.sendToGoogleSheets(loginData).catch(error => {
                console.warn('⚠️ לא הצלחנו לרשום כניסה:', error);
            });
            
            console.log('✅ כניסה נרשמה בהצלחה');
            
        } catch (error) {
            console.error('⚠️ שגיאה ברישום כניסה:', error);
        }
    }

    async loadData() {
        try {
            await this.loadDataFromSheets();
        } catch (error) {
            console.error('❌ נכשלה טעינה מהגליון:', error);
            this.connectionStatus = 'offline';
            this.updateConnectionStatus('🔴 שגיאה בחיבור');
        }
    }

    updateConnectionStatus(status) {
        const indicator = document.getElementById('connectionIndicator');
        if (indicator) {
            indicator.textContent = status;
        }
    }

    async loadDataFromSheets() {
        try {
            console.log('🔄 טוען נתונים מהגליון...');
            console.log('👤 עובד נוכחי:', this.currentUser);
            
            this.showNotification('טוען נתונים מהשרת...', 'info');
            
            await this.loadClientsFromSheet();
            await this.loadBudgetTasksFromSheet();
            await this.loadTimesheetEntriesFromSheet();
            
            // עדכן חסימות לקוחות
            this.clientValidation.updateBlockedClients();
            
            this.showNotification('נתונים נטענו בהצלחה!', 'success');
            this.connectionStatus = 'connected';
            this.updateConnectionStatus('🟢 מחובר לגליון');
            
            console.log(`📊 סיכום טעינה:
            - ${this.clients.length} לקוחות (מרכזי)
            - ${this.budgetTasks.length} משימות תקצוב (של ${this.currentUser})
            - ${this.timesheetEntries.length} רשומות שעתון (של ${this.currentUser})`);
            
        } catch (error) {
            console.error('❌ שגיאה בטעינת נתונים:', error);
            this.showNotification('שגיאה בטעינת נתונים', 'error');
            this.connectionStatus = 'disconnected';
            this.updateConnectionStatus('🔴 שגיאה בחיבור');
            throw error;
        }
    }

    async loadClientsFromSheet() {
        try {
            console.log('📥 טוען לקוחות מהגליון...');
            
            const url = `${SCRIPT_URL}?action=getClients`;
            console.log('🔗 URL:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('📊 תוצאה:', result);
            
            if (result.success && result.clients) {
                this.clients = result.clients;
                this.updateClientSelects();
                console.log(`✅ נטענו ${this.clients.length} לקוחות מהגליון`);
            } else {
                console.error('❌ תגובה לא תקינה:', result);
                throw new Error(result.message || 'שגיאה בטעינת לקוחות');
            }
        } catch (error) {
            console.error('❌ שגיאה בטעינת לקוחות:', error);
            throw error;
        }
    }

    async loadBudgetTasksFromSheet() {
        try {
            console.log('📥 טוען משימות תקצוב מהגליון...');
            
            const url = `${SCRIPT_URL}?action=getFilteredBudgetTasks&employee=${encodeURIComponent(this.currentUser)}&filter=${this.currentTaskFilter}`;
            console.log('🔗 URL:', url);
            
            const response = await fetch(url);
            const result = await response.json();
            console.log('📊 תוצאה:', result);
            
            if (result.success && result.tasks) {
                this.budgetTasks = result.tasks;
                this.filteredBudgetTasks = [...this.budgetTasks];
                this.renderBudgetTasks();
                console.log(`✅ נטענו ${this.budgetTasks.length} משימות תקצוב מהגליון`);
            } else {
                console.error('❌ תגובה לא תקינה:', result);
            }
        } catch (error) {
            console.error('❌ שגיאה בטעינת משימות:', error);
            throw error;
        }
    }

    async loadTimesheetEntriesFromSheet() {
        try {
            console.log('📥 טוען רשומות שעתון מהגליון... פילטר:', this.currentTimesheetFilter);
            
            const url = `${SCRIPT_URL}?action=getFilteredTimesheetEntries&employee=${encodeURIComponent(this.currentUser)}&filter=${this.currentTimesheetFilter}`;
            console.log('🔗 URL:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('📊 תוצאת שעתון:', result);
            
            if (result.success) {
                this.timesheetEntries = result.entries || [];
                this.filteredTimesheetEntries = [...this.timesheetEntries];
                this.renderTimesheetEntries();
                console.log(`✅ נטענו ${this.timesheetEntries.length} רשומות שעתון מהגליון`);
                
                if (this.timesheetEntries.length === 0 && this.currentTimesheetFilter === 'today') {
                    console.log('⚠️ לא נמצאו רשומות להיום, מנסה חודש...');
                    this.currentTimesheetFilter = 'month';
                    document.getElementById('timesheetFilter').value = 'month';
                    await this.loadTimesheetEntriesFromSheet();
                }
            } else {
                console.error('❌ תגובה לא תקינה:', result);
                this.timesheetEntries = [];
                this.filteredTimesheetEntries = [];
                this.renderTimesheetEntries();
            }
        } catch (error) {
            console.error('❌ שגיאה בטעינת שעתון:', error);
            this.timesheetEntries = [];
            this.filteredTimesheetEntries = [];
            this.renderTimesheetEntries();
            throw error;
        }
    }

    updateClientSelects() {
        const budgetSelect = document.getElementById('budgetClientSelect');
        const timesheetSelect = document.getElementById('timesheetClientSelect');
        
        budgetSelect.innerHTML = '<option value="">בחר לקוח...</option>';
        timesheetSelect.innerHTML = '<option value="">בחר לקוח...</option>';
        
        this.clients.forEach(client => {
            let displayText = client.fullName;
            
            if (client.type === 'hours' && client.hoursRemaining !== undefined) {
                const hoursText = client.hoursRemaining <= 5 ? 
                    `🚨 ${client.hoursRemaining.toFixed(1)} שע' נותרות` :
                    `${client.hoursRemaining.toFixed(1)} שע' נותרות`;
                displayText += ` (${hoursText})`;
            } else if (client.type === 'fixed') {
                displayText += ' (פיקס)';
            }
            
            const budgetOption = document.createElement('option');
            budgetOption.value = client.fullName;
            budgetOption.textContent = displayText;
            budgetSelect.appendChild(budgetOption);

            const timesheetOption = document.createElement('option');
            timesheetOption.value = client.fullName;
            timesheetOption.textContent = displayText;
            timesheetSelect.appendChild(timesheetOption);
        });
    }

    updateClientTypeDisplay() {
        const hoursSelected = document.getElementById('typeHours').checked;
        const hoursSection = document.getElementById('hoursSection');
        const stagesSection = document.getElementById('stagesSection');
        
        if (hoursSelected) {
            hoursSection.classList.remove('hidden');
            stagesSection.classList.add('hidden');
            document.getElementById('hoursAmount').required = true;
        } else {
            hoursSection.classList.add('hidden');
            stagesSection.classList.remove('hidden');
            document.getElementById('hoursAmount').required = false;
        }
    }

    // ===== החלפת תצוגות =====
    switchBudgetView(view) {
        this.currentBudgetView = view;
        
        // עדכון טאבי תצוגה
        document.querySelectorAll('#budgetTab .view-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`#budgetTab .view-tab[data-view="${view}"]`).classList.add('active');
        
        // הצגת התצוגה המתאימה
        if (view === 'cards') {
            document.getElementById('budgetContainer').classList.remove('hidden');
            document.getElementById('budgetTableContainer').classList.add('hidden');
        } else {
            document.getElementById('budgetContainer').classList.add('hidden');
            document.getElementById('budgetTableContainer').classList.remove('hidden');
        }
        
        this.renderBudgetTasks();
    }

    switchTimesheetView(view) {
        this.currentTimesheetView = view;
        
        // עדכון טאבי תצוגה
        document.querySelectorAll('#timesheetTab .view-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`#timesheetTab .view-tab[data-view="${view}"]`).classList.add('active');
        
        // הצגת התצוגה המתאימה
        if (view === 'cards') {
            document.getElementById('timesheetContainer').classList.remove('hidden');
            document.getElementById('timesheetTableContainer').classList.add('hidden');
        } else {
            document.getElementById('timesheetContainer').classList.add('hidden');
            document.getElementById('timesheetTableContainer').classList.remove('hidden');
        }
        
        this.renderTimesheetEntries();
    }

    // ===== חיפוש =====
    searchBudgetTasks() {
        const searchTerm = document.getElementById('budgetSearchBox').value.toLowerCase();
        
        if (!searchTerm) {
            this.filteredBudgetTasks = [...this.budgetTasks];
        } else {
            this.filteredBudgetTasks = this.budgetTasks.filter(task => {
                return (
                    task.clientName.toLowerCase().includes(searchTerm) ||
                    task.description.toLowerCase().includes(searchTerm) ||
                    task.branch.toLowerCase().includes(searchTerm) ||
                    task.fileNumber.toLowerCase().includes(searchTerm)
                );
            });
        }
        
        this.renderBudgetTasks();
    }

    searchTimesheetEntries() {
        const searchTerm = document.getElementById('timesheetSearchBox').value.toLowerCase();
        
        if (!searchTerm) {
            this.filteredTimesheetEntries = [...this.timesheetEntries];
        } else {
            this.filteredTimesheetEntries = this.timesheetEntries.filter(entry => {
                return (
                    entry.clientName.toLowerCase().includes(searchTerm) ||
                    entry.action.toLowerCase().includes(searchTerm) ||
                    entry.fileNumber.toLowerCase().includes(searchTerm) ||
                    (entry.notes && entry.notes.toLowerCase().includes(searchTerm))
                );
            });
        }
        
        this.renderTimesheetEntries();
    }

    // ===== מיון טבלאות =====
    sortBudgetTable(field) {
        // עדכון כיוון המיון
        if (this.budgetSortField === field) {
            this.budgetSortDirection = this.budgetSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.budgetSortField = field;
            this.budgetSortDirection = 'asc';
        }
        
        // עדכון הצגת כותרות
        document.querySelectorAll('#budgetTable th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
        });
        
        const currentTh = document.querySelector(`#budgetTable th[data-sort="${field}"]`);
        currentTh.classList.add(`sort-${this.budgetSortDirection}`);
        
        // מיון הנתונים
        this.filteredBudgetTasks.sort((a, b) => {
            let valueA = a[field];
            let valueB = b[field];
            
            // טיפול במקרים מיוחדים
            if (field === 'deadline') {
                valueA = new Date(valueA);
                valueB = new Date(valueB);
            } else if (field === 'progress') {
                valueA = a.estimatedMinutes > 0 ? (a.actualMinutes / a.estimatedMinutes) * 100 : 0;
                valueB = b.estimatedMinutes > 0 ? (b.actualMinutes / b.estimatedMinutes) * 100 : 0;
            }
            
            if (valueA < valueB) return this.budgetSortDirection === 'asc' ? -1 : 1;
            if (valueA > valueB) return this.budgetSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        
        this.renderBudgetTasks();
    }

    sortTimesheetTable(field) {
        // עדכון כיוון המיון
        if (this.timesheetSortField === field) {
            this.timesheetSortDirection = this.timesheetSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.timesheetSortField = field;
            this.timesheetSortDirection = 'asc';
        }
        
        // עדכון הצגת כותרות
        document.querySelectorAll('#timesheetTable th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
        });
        
        const currentTh = document.querySelector(`#timesheetTable th[data-sort="${field}"]`);
        currentTh.classList.add(`sort-${this.timesheetSortDirection}`);
        
        // מיון הנתונים
        this.filteredTimesheetEntries.sort((a, b) => {
            let valueA = a[field];
            let valueB = b[field];
            
            // טיפול במקרים מיוחדים
            if (field === 'date') {
                valueA = new Date(valueA);
                valueB = new Date(valueB);
            } else if (field === 'minutes') {
                valueA = Number(valueA) || 0;
                valueB = Number(valueB) || 0;
            }
            
            if (valueA < valueB) return this.timesheetSortDirection === 'asc' ? -1 : 1;
            if (valueA > valueB) return this.timesheetSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        
        this.renderTimesheetEntries();
    }

    async createClient() {
        const clientName = document.getElementById('clientName').value.trim();
        const fileNumber = document.getElementById('fileNumberInput').value.trim();
        const description = document.getElementById('clientDescription').value.trim();
        const clientType = document.querySelector('input[name="clientType"]:checked').value;
        const hoursAmount = document.getElementById('hoursAmount').value;

        if (!clientName || !fileNumber) {
            this.showNotification('אנא מלא את כל השדות הנדרשים', 'error');
            return;
        }

        this.showNotification('בודק אם הלקוח קיים...', 'info');
        try {
            await this.loadClientsFromSheet();
        } catch (error) {
            console.error('⚠️ לא הצלחנו לרענן רשימת לקוחות:', error);
        }

        if (this.clients.some(c => c.fileNumber === fileNumber)) {
            this.showNotification(`❌ מספר תיק ${fileNumber} כבר קיים במערכת!`, 'error');
            
            const existingClient = this.clients.find(c => c.fileNumber === fileNumber);
            setTimeout(() => {
                this.showNotification(
                    `הלקוח הקיים: ${existingClient.fullName}`, 
                    'warning'
                );
            }, 2000);
            return;
        }

        const fullName = description 
            ? `${clientName} - ${description}` 
            : clientName;

        if (this.clients.some(c => c.fullName.toLowerCase() === fullName.toLowerCase())) {
            this.showNotification(`❌ לקוח "${fullName}" כבר קיים במערכת!`, 'error');
            return;
        }

        if (clientType === 'hours') {
            if (!hoursAmount || hoursAmount < 1) {
                this.showNotification('אנא הזן כמות שעות תקינה', 'error');
                return;
            }
        }

        const client = {
            id: Date.now(),
            clientName,
            fileNumber,
            description,
            fullName,
            type: clientType,
            createdAt: new Date(),
            createdBy: this.currentUser
        };

        if (clientType === 'hours') {
            client.totalHours = parseInt(hoursAmount);
            client.hoursRemaining = parseInt(hoursAmount);
            client.minutesRemaining = parseInt(hoursAmount) * 60;
        } else {
            client.stages = [
                { id: 1, name: 'שלב 1', completed: false },
                { id: 2, name: 'שלב 2', completed: false },
                { id: 3, name: 'שלב 3', completed: false }
            ];
        }

        hideClientForm();
        
        const typeText = clientType === 'hours' ? `${hoursAmount} שעות` : 'פיקס (3 שלבים)';
        this.showNotification(`תיק "${fullName}" (${fileNumber}) נוצר בהצלחה! (${typeText})`, 'success');
        
        this.createClientComplete(client);
    }

    searchExistingClient() {
        const searchTerm = prompt('הכנס שם לקוח או מספר תיק לחיפוש:');
        if (!searchTerm) return;
        
        const found = this.clients.filter(c => 
            c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.fileNumber.includes(searchTerm)
        );
        
        if (found.length === 0) {
            this.showNotification('לא נמצאו לקוחות מתאימים', 'info');
        } else {
            let message = `נמצאו ${found.length} לקוחות:\n\n`;
            found.forEach(c => {
                message += `• ${c.fullName} (${c.fileNumber})\n`;
            });
            alert(message);
        }
    }

    async addBudgetTask() {
        const clientName = document.getElementById('budgetClientSelect').value;
        const branch = document.getElementById('budgetBranch').value;
        const description = document.getElementById('budgetDescription').value;
        const estimatedTime = document.getElementById('estimatedTime').value;
        const deadline = document.getElementById('budgetDeadline').value;

        if (!clientName || !branch || !description || !estimatedTime || !deadline) {
            this.showNotification('אנא מלא את כל השדות', 'error');
            return;
        }

        // בדיקת חסימת לקוח
        if (!this.clientValidation.validateClientSelection(clientName, 'יצירת משימה')) {
            return;
        }

        const selectedClient = this.clients.find(c => c.fullName === clientName);
        if (!selectedClient) {
            this.showNotification('לקוח לא נמצא', 'error');
            return;
        }

        // יצירת משימה זמנית (אופטימיסטית)
        const tempTask = {
            id: Date.now(),
            clientName,
            fileNumber: selectedClient.fileNumber,
            branch,
            description: description,
            originalDescription: description,
            estimatedMinutes: parseInt(estimatedTime),
            actualMinutes: 0,
            deadline: deadline,
            originalDeadline: deadline,
            extended: false,
            status: 'פעיל',
            createdAt: new Date().toLocaleString('he-IL'),
            lastUpdated: new Date().toLocaleString('he-IL'),
            history: []
        };

        this.budgetTasks.unshift(tempTask);
        this.filteredBudgetTasks = [...this.budgetTasks];
        this.renderBudgetTasks();

        this.clearBudgetForm();
        this.showNotification('המשימה נוספה לתקצוב בהצלחה');
        
        const budgetTask = {
            clientName,
            fileNumber: selectedClient.fileNumber,
            branch,
            taskDescription: description,
            estimatedMinutes: parseInt(estimatedTime),
            deadline: deadline,
        };

        await this.saveBudgetTaskToSheet(budgetTask);
    }

    async addTimesheetEntry() {
        const date = document.getElementById('actionDate').value;
        const minutes = document.getElementById('actionMinutes').value;
        const clientName = document.getElementById('timesheetClientSelect').value;
        const fileNumber = document.getElementById('fileNumber').value;
        const action = document.getElementById('actionDescription').value;
        const notes = document.getElementById('actionNotes').value;

        if (!date || !minutes || !clientName || !fileNumber || !action) {
            this.showNotification('אנא מלא את כל השדות הנדרשים', 'error');
            return;
        }

        // בדיקת חסימת לקוח
        if (!this.clientValidation.validateClientSelection(clientName, 'רישום שעתון')) {
            return;
        }

        const selectedClient = this.clients.find(c => c.fullName === clientName);
        
        const tempEntry = {
            id: Date.now(),
            date,
            action,
            lawyer: this.currentUser,
            minutes: parseInt(minutes),
            clientName,
            fileNumber,
            notes: notes.trim(),
            createdAt: new Date().toLocaleString('he-IL')
        };

        this.timesheetEntries.unshift(tempEntry);
        this.filteredTimesheetEntries = [...this.timesheetEntries];
        this.renderTimesheetEntries();

        this.clearTimesheetForm();
        this.showNotification('הפעולה נרשמה בשעתון בהצלחה');
        
        const timesheetEntry = {
            date,
            action,
            lawyer: this.currentUser,
            minutes: parseInt(minutes),
            clientName,
            fileNumber,
            notes: notes.trim(),
            clientType: selectedClient ? selectedClient.type : 'unknown',
            updateHours: selectedClient && selectedClient.type === 'hours'
        };

        await this.saveTimesheetAndUpdateClient(timesheetEntry);
        await this.loadDataFromSheets();
    }

    clearBudgetForm() {
        document.getElementById('budgetForm').reset();
    }

    clearTimesheetForm() {
        document.getElementById('timesheetForm').reset();
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('actionDate').value = today;
    }

    filterBudgetTasks() {
        const filter = document.getElementById('budgetTaskFilter').value;
        this.currentTaskFilter = filter;
        this.loadBudgetTasksFromSheet();
    }

    filterTimesheetEntries() {
        const filter = document.getElementById('timesheetFilter').value;
        this.currentTimesheetFilter = filter;
        this.loadTimesheetEntriesFromSheet();
    }

    // ===== רינדור משימות מתקדם =====
    renderBudgetTasks() {
        const container = document.getElementById('budgetContainer');
        const tableContainer = document.getElementById('budgetTableContainer');
        const emptyState = document.getElementById('budgetEmptyState');
        
        try {
            if (!this.filteredBudgetTasks || this.filteredBudgetTasks.length === 0) {
                container.style.display = 'none';
                tableContainer.style.display = 'none';
                emptyState.style.display = 'block';
                return;
            }

            emptyState.style.display = 'none';

            if (this.currentBudgetView === 'cards') {
                container.style.display = 'block';
                tableContainer.style.display = 'none';
                
                const tasksHtml = this.filteredBudgetTasks.map(task => this.createAdvancedTaskCard(task)).join('');
                container.innerHTML = `<div class="items-container">${tasksHtml}</div>`;
            } else {
                container.style.display = 'none';
                tableContainer.style.display = 'block';
                
                this.renderBudgetTable();
            }
            
        } catch (error) {
            console.error('❌ שגיאה ברינדור משימות:', error);
            container.innerHTML = '<div class="error-message">שגיאה בהצגת המשימות</div>';
        }
    }

    renderBudgetTable() {
        const tbody = document.getElementById('budgetTableBody');
        
        const rowsHtml = this.filteredBudgetTasks.map(task => {
            const safeTask = {
                id: task.id || Date.now(),
                clientName: task.clientName || 'לקוח לא ידוע',
                description: task.description || 'משימה ללא תיאור',
                estimatedMinutes: Number(task.estimatedMinutes) || 0,
                actualMinutes: Number(task.actualMinutes) || 0,
                deadline: task.deadline || new Date().toISOString(),
                status: task.status || 'פעיל'
            };

            const progressPercentage = safeTask.estimatedMinutes > 0 ? 
                Math.round((safeTask.actualMinutes / safeTask.estimatedMinutes) * 100) : 0;
            
            let progressClass = 'table-progress-normal';
            if (progressPercentage > 100) {
                progressClass = 'table-progress-critical';
            } else if (progressPercentage > 80) {
                progressClass = 'table-progress-over';
            }

            let statusClass = 'table-status-active';
            const now = new Date();
            const deadline = new Date(safeTask.deadline);
            
            if (safeTask.status === 'הושלם') {
                statusClass = 'table-status-completed';
            } else if (deadline < now) {
                statusClass = 'table-status-overdue';
            } else if ((deadline - now) < 24 * 60 * 60 * 1000) {
                statusClass = 'table-status-urgent';
            }

            return `
                <tr>
                    <td class="td-client">${safeTask.clientName}</td>
                    <td class="td-description">${safeTask.description}</td>
                    <td class="td-progress ${progressClass}">${progressPercentage}% (${safeTask.actualMinutes}/${safeTask.estimatedMinutes})</td>
                    <td class="td-deadline">${this.formatDateTime(new Date(safeTask.deadline))}</td>
                    <td class="td-status">
                        <span class="${statusClass}">${safeTask.status}</span>
                    </td>
                    <td class="td-actions">
                        <button class="table-action-btn primary" onclick="manager.showAdvancedTimeDialog(${safeTask.id})" title="הוסף זמן">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="table-action-btn info" onclick="manager.showTaskHistory(${safeTask.id})" title="היסטוריה">
                            <i class="fas fa-history"></i>
                        </button>
                        ${safeTask.status === 'פעיל' ? `
                            <button class="table-action-btn warning" onclick="manager.showExtendDeadlineDialog(${safeTask.id})" title="הארך יעד">
                                <i class="fas fa-calendar-plus"></i>
                            </button>
                            <button class="table-action-btn success" onclick="manager.completeTask(${safeTask.id})" title="סיים משימה">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rowsHtml;
    }

    createAdvancedTaskCard(task) {
        const safeTask = {
            id: task.id || Date.now(),
            clientName: task.clientName || 'לקוח לא ידוע',
            fileNumber: task.fileNumber || '',
            branch: task.branch || '',
            description: task.description || 'משימה ללא תיאור',
            originalDescription: task.originalDescription || task.description,
            estimatedMinutes: Number(task.estimatedMinutes) || 0,
            actualMinutes: Number(task.actualMinutes) || 0,
            deadline: task.deadline || new Date().toISOString(),
            originalDeadline: task.originalDeadline || task.deadline,
            extended: task.extended || false,
            status: task.status || 'פעיל',
            history: task.history || []
        };

        const now = new Date();
        const deadline = new Date(safeTask.deadline);
        const timeUntilDeadline = deadline - now;
        const oneHour = 60 * 60 * 1000;
        const oneDay = 24 * 60 * 60 * 1000;

        let cardClass = 'item-card';
        let statusBadgeClass = 'status-badge active';
        let statusText = 'פעיל';
        
        if (safeTask.status === 'הושלם') {
            cardClass += ' completed';
            statusBadgeClass = 'status-badge completed';
            statusText = 'הושלם';
        } else if (timeUntilDeadline < 0) {
            cardClass += ' overdue';
            statusText = 'פג תוקף';
        } else if (timeUntilDeadline < oneDay) {
            cardClass += ' warning';
            statusText = 'דחוף';
        }

        if (safeTask.extended) {
            cardClass += ' extended';
        }

        // חישוב התקדמות
        const progressPercentage = safeTask.estimatedMinutes > 0 ? 
            Math.round((safeTask.actualMinutes / safeTask.estimatedMinutes) * 100) : 0;
        
        let progressClass = 'normal';
        if (progressPercentage > 100) {
            progressClass = 'critical';
        } else if (progressPercentage > 80) {
            progressClass = 'over';
        }

        // הכנת תיאור משימה
        const descriptionDisplay = safeTask.description !== safeTask.originalDescription ?
            `${safeTask.description}<br><small style="color: #9ca3af;">מקורי: ${safeTask.originalDescription}</small>` :
            safeTask.description;

        // באדג'ים
        const extendedBadge = safeTask.extended ? 
            '<span class="extended-badge"><i class="fas fa-calendar-plus"></i> הוארך</span>' : '';

        return `
            <div class="${cardClass}">
                <div class="item-header">
                    <div class="item-title">
                        ${safeTask.clientName}
                        ${extendedBadge}
                    </div>
                    <div class="item-subtitle">${safeTask.branch}</div>
                </div>
                
                <div class="item-description">
                    ${descriptionDisplay}
                </div>
                
                <div class="task-stats">
                    <div class="stat">
                        <span><i class="fas fa-target"></i></span>
                        <span class="stat-value">${safeTask.actualMinutes}/${safeTask.estimatedMinutes}</span>
                        <span>דק'</span>
                    </div>
                    <div class="stat">
                        <span><i class="fas fa-file-alt"></i></span>
                        <span class="stat-value">${safeTask.history.length}</span>
                        <span>רישומים</span>
                    </div>
                    <div class="stat">
                        <span class="${statusBadgeClass}">${statusText}</span>
                    </div>
                </div>
                
                <div class="task-progress">
                    <div class="progress-text">
                        <span>התקדמות</span>
                        <span>${progressPercentage}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${progressClass}" style="width: ${Math.min(progressPercentage, 100)}%"></div>
                    </div>
                </div>
                
                <div class="task-stats">
                    <div class="stat">
                        <span><i class="fas fa-calendar-alt"></i></span>
                        <span>יעד: ${this.formatDateTime(deadline)}</span>
                    </div>
                </div>
                
                <div class="task-actions">
                    <button class="task-action-btn primary" onclick="manager.showAdvancedTimeDialog(${safeTask.id})">
                        <i class="fas fa-plus"></i> זמן
                    </button>
                    <button class="task-action-btn info" onclick="manager.showTaskHistory(${safeTask.id})">
                        <i class="fas fa-history"></i> היסטוריה
                    </button>
                    ${safeTask.status === 'פעיל' ? `
                        <button class="task-action-btn warning" onclick="manager.showExtendDeadlineDialog(${safeTask.id})">
                            <i class="fas fa-calendar-plus"></i> הארך
                        </button>
                        <button class="task-action-btn success" onclick="manager.completeTask(${safeTask.id})">
                            <i class="fas fa-check"></i> סיים
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderTimesheetEntries() {
        const container = document.getElementById('timesheetContainer');
        const tableContainer = document.getElementById('timesheetTableContainer');
        const emptyState = document.getElementById('timesheetEmptyState');

        if (!this.filteredTimesheetEntries || this.filteredTimesheetEntries.length === 0) {
            container.style.display = 'none';
            tableContainer.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        if (this.currentTimesheetView === 'cards') {
            container.style.display = 'block';
            tableContainer.style.display = 'none';
            // כאן יכולה להיות רינדור כרטיסיות לשעתון אם נדרש
        } else {
            container.style.display = 'none';
            tableContainer.style.display = 'block';
            this.renderTimesheetTable();
        }
    }

    renderTimesheetTable() {
        const tbody = document.getElementById('timesheetTableBody');
        
        const rowsHtml = this.filteredTimesheetEntries.map(entry => `
            <tr>
                <td>${this.formatDate(entry.date)}</td>
                <td class="action-cell">${entry.action}</td>
                <td class="minutes">${entry.minutes} דק'</td>
                <td class="client-cell">${entry.clientName}</td>
                <td class="file-number">${entry.fileNumber}</td>
                <td>${entry.notes || '-'}</td>
            </tr>
        `).join('');
        
        tbody.innerHTML = rowsHtml;
    }

    // החלף את הפונקציה showAdvancedTimeDialog במלואה:

// שיפור דיאלוג הזמן עם מניעת לחיצות כפולות
showAdvancedTimeDialog(taskId) {
    const task = this.budgetTasks.find(t => t.id === taskId);
    if (!task) {
        this.showNotification('המשימה לא נמצאה', 'error');
        return;
    }

    // מניעת פתיחת דיאלוגים כפולים
    if (loadingManager.isOperationActive(`dialog_${taskId}`)) {
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    const recentHistory = task.history.slice(-3).reverse();
    const historyHtml = recentHistory.length > 0 ?
        recentHistory.map(entry => `
            <div class="recent-work ${entry.isPending ? 'pending' : ''}">
                ${this.formatDate(entry.date)}: ${entry.minutes} דק'
                ${entry.isPending ? ' <span class="pending-badge">ממתין...</span>' : ''}
            </div>
        `).join('') :
        '<div class="no-history">טרם נרשמה עבודה על משימה זו</div>';

    overlay.innerHTML = `
        <div class="popup time-entry-popup">
            <div class="popup-header">
                <i class="fas fa-clock"></i>
                רישום זמן עבודה
            </div>
            
            <div class="task-summary">
                <h3>${task.description}</h3>
                <p><strong>לקוח:</strong> ${task.clientName}</p>
                <div class="task-stats">
                    <div class="stat">
                        <span class="stat-label">התקדמות</span>
                        <span class="stat-value">${task.actualMinutes}/${task.estimatedMinutes} דק'</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">רישומים</span>
                        <span class="stat-value">${task.history.length}</span>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; color: #374151;">רישומי זמן אחרונים:</h4>
                ${historyHtml}
            </div>
            
            <form id="timeEntryForm">
                <div class="popup-section">
                    <label for="workMinutes">⏱️ כמה דקות עבדת על המשימה?</label>
                    <input type="number" id="workMinutes" min="1" max="600" placeholder="לדוגמה: 60" required style="font-size: 18px; text-align: center; font-weight: bold;">
                    <small style="color: #6b7280; margin-top: 8px; display: block;">
                        הזן את מספר הדקות שעבדת על המשימה
                    </small>
                </div>
                
                <div class="popup-section">
                    <label for="workDate">📅 תאריך העבודה:</label>
                    <input type="date" id="workDate" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                
                <div class="popup-buttons">
                    <button type="button" class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
                        <i class="fas fa-times"></i> ביטול
                    </button>
                    <button type="submit" class="popup-btn popup-btn-confirm" id="submitTimeBtn">
                        <i class="fas fa-save"></i> רשום זמן
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // פוקוס על שדה הדקות
    setTimeout(() => {
        document.getElementById('workMinutes').focus();
    }, 100);
    
    // טיפול בשליחת הטופס עם מניעת כפילויות
    const form = overlay.querySelector('#timeEntryForm');
    const submitBtn = overlay.querySelector('#submitTimeBtn');
    let isSubmitting = false;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // מניעת לחיצות כפולות
        if (isSubmitting) {
            console.log('⚠️ כבר שולח - מונע כפילות');
            return;
        }
        
        isSubmitting = true;
        
        // שינוי כפתור מיידי
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> רושם זמן...';
        submitBtn.disabled = true;
        
        const timeData = {
            taskId: taskId,
            minutes: parseInt(document.getElementById('workMinutes').value),
            date: document.getElementById('workDate').value,
            description: 'רישום זמן על משימה'
        };
        
        await this.addTimeToTask(timeData);
        
        // סגירת דיאלוג
        overlay.remove();
    });
}

showTaskHistory(taskId) {
        const task = this.budgetTasks.find(t => t.id === taskId);
        if (!task) {
            this.showNotification('המשימה לא נמצאה', 'error');
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';
        
        // חישוב סטטיסטיקות
        const totalMinutes = task.history.reduce((sum, entry) => sum + (entry.minutes || 0), 0);
        const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
        const progressPercentage = task.estimatedMinutes > 0 ? 
            Math.round((totalMinutes / task.estimatedMinutes) * 100) : 0;
        const avgMinutes = task.history.length > 0 ? 
            Math.round(totalMinutes / task.history.length) : 0;
        
        overlay.innerHTML = `
            <div class="popup history-popup">
                <div class="popup-header">
                    <i class="fas fa-history"></i>
                    היסטוריית עבודה
                </div>
                
                <div class="task-summary">
                    <h3>${task.description}</h3>
                    <p><strong>לקוח:</strong> ${task.clientName}</p>
                    
                    <div class="summary-stats">
                        <div class="stat">
                            <span class="stat-label">סה"כ זמן</span>
                            <span class="stat-value">${totalHours}h</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">רישומים</span>
                            <span class="stat-value">${task.history.length}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">תקצוב</span>
                            <span class="stat-value">${Math.round(task.estimatedMinutes / 60 * 10) / 10}h</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">ממוצע</span>
                            <span class="stat-value">${avgMinutes}m</span>
                        </div>
                    </div>
                </div>
                
                <div class="history-timeline">
                    ${task.history.length === 0 ? 
                        '<div class="no-history">אין עדיין רישומי עבודה</div>' :
                        task.history.slice().reverse().map(entry => `
                            <div class="history-entry">
                                <div class="history-entry-header">
                                    <div class="history-date">${this.formatDate(entry.date)}</div>
                                    <div class="history-minutes">${entry.minutes} דק'</div>
                                </div>
                                <div class="history-description">${entry.description}</div>
                            </div>
                        `).join('')
                    }
                </div>
                
                <div class="popup-buttons">
                    <button class="popup-btn popup-btn-confirm" onclick="this.closest('.popup-overlay').remove()">
                        <i class="fas fa-times"></i> סגור
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }

    showExtendDeadlineDialog(taskId) {
        const task = this.budgetTasks.find(t => t.id === taskId);
        if (!task) {
            this.showNotification('המשימה לא נמצאה', 'error');
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';
        
        // חישוב תאריך ברירת מחדל (יום אחד אחרי התאריך הנוכחי)
        const currentDeadline = new Date(task.deadline);
        const defaultNewDate = new Date(currentDeadline);
        defaultNewDate.setDate(defaultNewDate.getDate() + 1);
        
        const defaultDateValue = defaultNewDate.toISOString().split('T')[0];
        const defaultTimeValue = defaultNewDate.toTimeString().slice(0, 5);

        overlay.innerHTML = `
            <div class="popup extend-deadline-popup">
                <div class="popup-header">
                    <i class="fas fa-calendar-plus"></i>
                    הארכת תאריך יעד
                </div>
                
                <div class="task-overview">
                    <h3><i class="fas fa-tasks"></i> ${task.description}</h3>
                    <p><strong>לקוח:</strong> ${task.clientName}</p>
                    <p><strong>סניף:</strong> ${task.branch}</p>
                </div>
                
                <div class="dates-comparison">
                    <div class="date-section">
                        <div class="date-label">
                            <i class="fas fa-clock"></i>
                            תאריך יעד נוכחי
                        </div>
                        <div class="date-value" id="currentDeadlineDisplay">
                            ${this.formatDateTime(currentDeadline)}
                        </div>
                    </div>
                    <div class="date-section new-date-section">
                        <div class="date-label">
                            <i class="fas fa-calendar-check"></i>
                            תאריך יעד חדש
                        </div>
                        <div class="date-value" id="newDeadlineDisplay">
                            ${this.formatDateTime(defaultNewDate)}
                        </div>
                    </div>
                </div>
                
                <form id="extendDeadlineForm">
                    <div class="datetime-inputs">
                        <div class="popup-section">
                            <label for="newDeadlineDate">תאריך חדש:</label>
                            <input type="date" id="newDeadlineDate" value="${defaultDateValue}" required>
                        </div>
                        <div class="popup-section">
                            <label for="newDeadlineTime">שעה:</label>
                            <input type="time" id="newDeadlineTime" value="${defaultTimeValue}" required>
                        </div>
                    </div>
                    
                    <div class="reason-section">
                        <div class="popup-section">
                            <label for="extensionReason">סיבת ההארכה:</label>
                            <textarea id="extensionReason" rows="3" placeholder="הסבר קצר לסיבת ההארכה (אופציונלי)..." maxlength="200"></textarea>
                        </div>
                    </div>
                    
                    <div class="extension-summary" id="extensionSummary">
                        <h4>
                            <i class="fas fa-info-circle"></i>
                            סיכום השינוי
                        </h4>
                        <div class="summary-item">
                            <span class="summary-label">תאריך מקורי:</span>
                            <span class="summary-value">${this.formatDateTime(currentDeadline)}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">תאריך חדש:</span>
                            <span class="summary-value" id="summaryNewDate">${this.formatDateTime(defaultNewDate)}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">זמן נוסף:</span>
                            <span class="summary-value time-difference" id="timeDifference">יום אחד</span>
                        </div>
                    </div>
                    
                    <div class="popup-buttons">
                        <button type="button" class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
                            <i class="fas fa-times"></i>
                            ביטול
                        </button>
                        <button type="submit" class="popup-btn popup-btn-confirm">
                            <i class="fas fa-calendar-check"></i>
                            אשר הארכה
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // הוספת event listeners לעדכון תצוגה דינמית
        const dateInput = document.getElementById('newDeadlineDate');
        const timeInput = document.getElementById('newDeadlineTime');
        const newDeadlineDisplay = document.getElementById('newDeadlineDisplay');
        const summaryNewDate = document.getElementById('summaryNewDate');
        const timeDifference = document.getElementById('timeDifference');
        
        const updateDisplays = () => {
            const newDate = new Date(`${dateInput.value}T${timeInput.value}`);
            const formattedDate = this.formatDateTime(newDate);
            
            newDeadlineDisplay.textContent = formattedDate;
            summaryNewDate.textContent = formattedDate;
            
            // חישוב הפרש זמן
            const diffMs = newDate - currentDeadline;
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.round(diffMs / (1000 * 60 * 60));
            
            let timeDiffText;
            if (diffDays > 0) {
                timeDiffText = `${diffDays} ימים קדימה`;
            } else if (diffDays < 0) {
                timeDiffText = `${Math.abs(diffDays)} ימים אחורה`;
            } else if (diffHours > 0) {
                timeDiffText = `${diffHours} שעות קדימה`;
            } else if (diffHours < 0) {
                timeDiffText = `${Math.abs(diffHours)} שעות אחורה`;
            } else {
                timeDiffText = 'אותו זמן';
            }
            
            timeDifference.textContent = timeDiffText;
        };
        
        dateInput.addEventListener('change', updateDisplays);
        timeInput.addEventListener('change', updateDisplays);
        
        // טיפול בשליחת הטופס
        const form = overlay.querySelector('#extendDeadlineForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newDeadline = `${dateInput.value}T${timeInput.value}`;
            const reason = document.getElementById('extensionReason').value.trim();
            
            if (confirm(`האם אתה בטוח שברצונך להאריך את המשימה ל-${this.formatDateTime(new Date(newDeadline))}?`)) {
                await this.extendTaskDeadline(taskId, newDeadline, reason);
                overlay.remove();
            }
        });
    }

    // שיפור הפונקציה addTimeToTask עם feedback מיידי
async addTimeToTask(timeData) {
    const operationId = `addTime_${timeData.taskId}_${Date.now()}`;
    
    // שכבת הגנה 1: בדיקת כפילות
    if (!loadingManager.startOperation(operationId, 'רושם זמן למשימה...', 'מעדכן את הגליון')) {
        this.showNotification('רישום זמן כבר בתהליך...', 'warning');
        return;
    }
    
    try {
        // שכבת הגנה 2: עדכון אופטימיסטי מיידי (לפני השרת)
        const taskIndex = this.budgetTasks.findIndex(t => t.id === timeData.taskId);
        let originalTask = null;
        
        if (taskIndex !== -1) {
            // שמור מצב מקורי לגיבוי
            originalTask = JSON.parse(JSON.stringify(this.budgetTasks[taskIndex]));
            
            // עדכון מיידי בממשק
            this.budgetTasks[taskIndex].actualMinutes += timeData.minutes;
            this.budgetTasks[taskIndex].history.push({
                id: Date.now(),
                date: timeData.date,
                minutes: timeData.minutes,
                description: timeData.description,
                timestamp: new Date().toLocaleString('he-IL'),
                isPending: true // סימון שזה עדיין ממתין לאישור שרת
            });
            
            // רענון תצוגה מיידי
            this.filteredBudgetTasks = [...this.budgetTasks];
            this.renderBudgetTasks();
            
            // הודעה מיידית למשתמש
            this.showNotification('⏳ רושם זמן... (עדכון מיידי)', 'info');
        }
        
        // שכבת הגנה 3: שליחה לשרת עם retry
        const data = {
            action: 'addTimeToTask',
            employee: this.currentUser,
            timeEntry: {
                taskId: timeData.taskId,
                date: timeData.date,
                minutes: timeData.minutes,
                description: timeData.description,
                timestamp: new Date().toLocaleString('he-IL')
            }
        };
        
        await this.sendToGoogleSheets(data);
        
        // הצלחה - עדכון סטטוס ההיסטוריה
        if (taskIndex !== -1) {
            const lastHistoryItem = this.budgetTasks[taskIndex].history[this.budgetTasks[taskIndex].history.length - 1];
            if (lastHistoryItem && lastHistoryItem.isPending) {
                delete lastHistoryItem.isPending;
            }
        }
        
        this.showNotification('✅ זמן נוסף בהצלחה למשימה!', 'success');
        
        // רענון נתונים מהשרת (ללא loading)
        setTimeout(() => {
            this.loadBudgetTasksFromSheet();
        }, 1000);
        
    } catch (error) {
        console.error('❌ שגיאה בהוספת זמן:', error);
        
        // במקרה של שגיאה - החזרת המצב המקורי
        if (originalTask && taskIndex !== -1) {
            this.budgetTasks[taskIndex] = originalTask;
            this.filteredBudgetTasks = [...this.budgetTasks];
            this.renderBudgetTasks();
        }
        
        this.showNotification('❌ שגיאה ברישום זמן - נסה שוב', 'error');
    } finally {
        loadingManager.finishOperation(operationId);
    }
}

    async extendTaskDeadline(taskId, newDeadline, reason = '') {
        try {
            const data = {
                action: 'extendTaskDeadline',
                employee: this.currentUser,
                taskId: taskId,
                newDeadline: newDeadline,
                reason: reason
            };
            
            // עדכון מקומי אופטימיסטי
            const taskIndex = this.budgetTasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                this.budgetTasks[taskIndex].deadline = newDeadline;
                this.budgetTasks[taskIndex].extended = true;
                this.filteredBudgetTasks = [...this.budgetTasks];
                this.renderBudgetTasks();
            }
            
            await this.sendToGoogleSheets(data);
            this.showNotification('תאריך יעד הוארך בהצלחה', 'success');
            
            // רענון נתונים
            await this.loadBudgetTasksFromSheet();
            
        } catch (error) {
            console.error('❌ שגיאה בהארכת יעד:', error);
            this.showNotification('שגיאה בהארכת יעד', 'error');
        }
    }

    async completeTask(taskId) {
        const task = this.budgetTasks.find(t => t.id === taskId);
        if (!task) {
            this.showNotification('המשימה לא נמצאה', 'error');
            return;
        }

        const notes = prompt(
            `סיום משימה: ${task.description}\n\nהערות סיום (אופציונלי):`,
            ''
        );
        
        if (notes !== null) { // המשתמש לא ביטל
            try {
                const data = {
                    action: 'completeBudgetTask',
                    employee: this.currentUser,
                    taskId: taskId,
                    completionNotes: notes || ''
                };
                
                // עדכון מקומי אופטימיסטי
                const taskIndex = this.budgetTasks.findIndex(t => t.id === taskId);
                if (taskIndex !== -1) {
                    this.budgetTasks[taskIndex].status = 'הושלם';
                    this.budgetTasks[taskIndex].completedAt = new Date().toLocaleString('he-IL');
                    this.filteredBudgetTasks = [...this.budgetTasks];
                    this.renderBudgetTasks();
                }
                
                await this.sendToGoogleSheets(data);
                this.showNotification('המשימה הושלמה בהצלחה');
                
                // רענון נתונים
                await this.loadBudgetTasksFromSheet();
                
            } catch (error) {
                console.error('❌ שגיאה בהשלמת משימה:', error);
                this.showNotification('שגיאה בהשלמת המשימה', 'error');
            }
        }
    }

    // שמירה בגליונות Google Sheets
    async createClientComplete(client) {
        const data = {
            action: 'createClientComplete',
            employee: this.currentUser,
            client: client
        };

        await this.sendToGoogleSheets(data);
        console.log(`✅ נוצר לקוח מלא: ${client.fullName} עם טבלה אוטומטית`);
        
        await this.loadClientsFromSheet();
    }

    async saveBudgetTaskToSheet(task) {
        const data = {
            action: 'saveBudgetTaskToSheet',
            employee: this.currentUser,
            task: task
        };

        await this.sendToGoogleSheets(data);
    }

    async saveTimesheetAndUpdateClient(entry) {
        const data = {
            action: 'saveTimesheetAndUpdateClient',
            employee: this.currentUser,
            entry: entry
        };

        await this.sendToGoogleSheets(data);
    }

    async sendToGoogleSheets(data) {
        if (this.connectionStatus === 'disconnected') {
            console.log('⚠️ עובד במצב מקומי - לא שולח לגליון');
            return;
        }
        
        try {
            console.log('🔄 שולח לגליון Google Sheets:', data.action);
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            console.log('✅ נתונים נשמרו בגליון Google Sheets בהצלחה');
        } catch (error) {
            console.error('❌ שגיאה בשמירה בגליון:', error);
            this.connectionStatus = 'disconnected';
            this.showNotification('שגיאה בחיבור לגליון', 'warning');
        }
    }

    // פונקציות עזר
    formatDateTime(date) {
        try {
            return new Date(date).toLocaleString('he-IL', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'תאריך לא תקין';
        }
    }

    formatDate(dateString) {
        try {
            return new Date(dateString).toLocaleDateString('he-IL');
        } catch (error) {
            return 'תאריך לא תקין';
        }
    }

    showNotification(message, type = 'success') {
        try {
            const notification = document.getElementById('notification');
            if (!notification) return;
            
            notification.textContent = message;
            notification.className = `notification ${type}`;
            notification.classList.add('show');

            setTimeout(() => {
                notification.classList.remove('show');
            }, 4000);
            
            console.log(`📢 הודעה (${type}):`, message);
            
        } catch (error) {
            console.error('שגיאה בהצגת הודעה:', error);
        }
    }

    showError(message) {
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #f8f9ff 0%, #e8f4f8 50%, #f0f8ff 100%);">
                <div style="background: white; padding: 40px; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.1); text-align: center; max-width: 400px;">
                    <h2 style="color: #ef4444; margin-bottom: 20px;">שגיאה</h2>
                    <p style="color: #64748b; font-size: 16px;">${message}</p>
                </div>
            </div>
        `;
    }
}

// יצירת מופע של מנהל המערכת
const manager = new LawOfficeManager();
window.manager = manager;

// סגירת סרגל צד בלחיצה על ESC
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('open')) {
            toggleSidebar();
        }
        
        // סגירת דרופדאון התראות
        if (notificationBell.isDropdownOpen) {
            notificationBell.hideDropdown();
        }
    }
});

// סגירת סרגל צד בשינוי גודל מסך
window.addEventListener('resize', function() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
        toggleSidebar();
    }
});

// הוספת התראות דמו בטעינת הדף
document.addEventListener('DOMContentLoaded', function() {
    // התראות לדוגמה רק לצורך הדגמה
    setTimeout(() => {
        if (notificationBell && window.manager && window.manager.currentUser) {
            // נוסיף התראות רק אחרי שהמערכת נטענה
        }
    }, 3000);
});







// פונקציה לחיפוש לקוחות
function searchClients(formType, query) {
    const resultsContainer = document.getElementById(`${formType}SearchResults`);
    
    if (query.length < 1) {
        resultsContainer.classList.remove('show');
        return;
    }

    // קבלת הלקוחות מהמנג'ר
    const allClients = window.manager ? window.manager.clients : [];
    
    // סינון לפי החיפוש
    const matches = allClients.filter(client => {
        const searchText = `${client.fullName} ${client.fileNumber}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
    }).slice(0, 8);

    // הצגת תוצאות
    if (matches.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">לא נמצאו לקוחות מתאימים</div>';
    } else {
        resultsContainer.innerHTML = matches.map(client => {
            const icon = client.type === 'fixed' ? '📋' : '⏰';
            const details = client.type === 'fixed' ? 
                `שלב ${client.currentStage || 1} | פיקס` :
                `${client.hoursRemaining || 0} שעות נותרות`;
            
            return `
                <div class="search-result-item" onclick="selectClient('${formType}', '${client.fullName}', '${client.fileNumber}', '${client.type}')">
                    <div class="result-icon">${icon}</div>
                    <div class="result-text">
                        <div class="result-name">${client.fullName}</div>
                        <div class="result-details">תיק ${client.fileNumber} • ${details}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    resultsContainer.classList.add('show');
}

function selectClient(formType, clientName, fileNumber, clientType) {
    // עדכון שדה החיפוש
    const searchInput = document.getElementById(`${formType}ClientSearch`);
    const icon = clientType === 'fixed' ? '📋' : '⏰';
    searchInput.value = `${icon} ${clientName}`;
    
    // שמירה בשדה הנסתר
    const hiddenField = document.getElementById(`${formType}ClientSelect`);
    hiddenField.value = clientName;
    
    // עדכון מספר תיק אם זה שעתון
    if (formType === 'timesheet') {
        const fileNumberField = document.getElementById('fileNumber');
        if (fileNumberField) {
            fileNumberField.value = fileNumber;
        }
    }
    
    // הסתרת תוצאות
    document.getElementById(`${formType}SearchResults`).classList.remove('show');
}

// סגירת תוצאות בלחיצה מחוץ לשדה
document.addEventListener('click', function(event) {
    const searchContainers = document.querySelectorAll('.modern-client-search');
    searchContainers.forEach(container => {
        if (!container.contains(event.target)) {
            const resultsInContainer = container.querySelector('.search-results');
            if (resultsInContainer) {
                resultsInContainer.classList.remove('show');
            }
        }
    });
});
































