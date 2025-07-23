// הוסף לתחילת script.js - מנגנון מניעת כפילויות גלובלי
// ===== מערכת תצוגה רספונסיבית מתקדמת =====
class ResponsiveManager {
    constructor() {
        this.breakpoints = {
            mobile: 768,
            tablet: 1024, 
            laptop: 1366,
            desktop: 1920,
            ultrawide: 2560
        };
        
        this.currentSize = null;
        this.elements = {};
        this.init();
    }
    
    init() {
        // זיהוי אלמנטים לניהול
        this.elements = {
            topBar: document.querySelector('.top-user-bar'),
            userDropdown: document.querySelector('.user-dropdown-top'),
            plusButton: document.querySelector('.plus-container-new'),
            mainContent: document.querySelector('.main-content'),
            sidebar: document.querySelector('.minimal-sidebar'),
            mainTabs: document.querySelector('.main-tabs-container')
        };
        
        // הוספת event listeners
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.handleResize(), 100);
        });
        
        // התאמה ראשונית
        this.handleResize();
        
        console.log('🎨 מערכת רספונסיבית אותחלה');
    }
    
    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const newSize = this.getScreenSize(width);
        
        // עדכון רק אם השתנה הגודל
        if (newSize !== this.currentSize) {
            this.currentSize = newSize;
            this.applyResponsiveStyles(width, height);
            console.log(`📐 התאמה ל: ${newSize} (${width}x${height})`);
        }
    }
    
    getScreenSize(width) {
        if (width <= this.breakpoints.mobile) return 'mobile';
        if (width <= this.breakpoints.tablet) return 'tablet';
        if (width <= this.breakpoints.laptop) return 'laptop';
        if (width <= this.breakpoints.desktop) return 'desktop';
        return 'ultrawide';
    }
    
    applyResponsiveStyles(width, height) {
        const size = this.currentSize;
        
        // התאמות לפי גודל מסך
        switch(size) {
            case 'laptop':
                this.applyLaptopStyles();
                break;
            case 'desktop':
                this.applyDesktopStyles();
                break;
            case 'ultrawide':
                this.applyUltrawideStyles(width);
                break;
            default:
                this.applyDefaultStyles();
        }
        
        // התאמות מיוחדות לגובה
        if (height < 720) {
            this.applyShortScreenStyles();
        }
        
        // עדכון CSS variables דינמי
        this.updateCSSVariables(width, height);
    }
    
    applyLaptopStyles() {
        this.setStyles(this.elements.userDropdown, {
            fontSize: '13px',
            padding: '6px 12px',
            right: '180px'
        });
        
        this.setStyles(this.elements.plusButton, {
            top: '75px',
            left: '15px'
        });
        
        this.setStyles(this.elements.mainTabs, {
            margin: '5px auto 15px auto'
        });
    }
    
    applyDesktopStyles() {
        this.setStyles(this.elements.userDropdown, {
            fontSize: '14px',
            padding: '8px 16px',
            right: '200px'
        });
        
        this.setStyles(this.elements.plusButton, {
            top: '80px',
            left: '20px'
        });
        
        this.setStyles(this.elements.mainTabs, {
            margin: '10px auto 20px auto'
        });
    }
    
    applyUltrawideStyles(width) {
        // מגבילים רוחב מקסימלי למסכים גדולים
        const maxWidth = Math.min(width * 0.85, 2000);
        
        this.setStyles(this.elements.topBar, {
            maxWidth: `${maxWidth}px`,
            margin: '0 auto',
            left: 'auto',
            right: 'auto'
        });
        
        this.setStyles(this.elements.userDropdown, {
            fontSize: '15px',
            padding: '10px 20px',
            right: '150px'
        });
        
        this.setStyles(this.elements.mainContent, {
            maxWidth: `${maxWidth - 200}px`,
            margin: '70px auto 0 auto'
        });
    }
    
    applyShortScreenStyles() {
        // התאמה למסכים נמוכים
        this.setStyles(this.elements.topBar, {
            height: '50px'
        });
        
        this.setStyles(this.elements.plusButton, {
            top: '60px'
        });
        
        this.setStyles(this.elements.mainContent, {
            marginTop: '50px'
        });
    }
    
    applyDefaultStyles() {
        // איפוס לסטיילים בסיסיים
        this.setStyles(this.elements.userDropdown, {
            fontSize: '14px',
            padding: '8px 16px',
            right: '200px'
        });
    }
    
    updateCSSVariables(width, height) {
        const root = document.documentElement;
        
        // עדכון משתנים דינמיים
        root.style.setProperty('--screen-width', `${width}px`);
        root.style.setProperty('--screen-height', `${height}px`);
        root.style.setProperty('--screen-ratio', width/height);
        
        // עדכון גדלים יחסיים
        const scaleFactor = Math.min(Math.max(width / 1920, 0.8), 1.5);
        root.style.setProperty('--scale-factor', scaleFactor);
        
        // עדכון מרווחים דינמיים
        const baseSpacing = Math.max(width / 200, 8);
        root.style.setProperty('--dynamic-space', `${baseSpacing}px`);
    }
    
    setStyles(element, styles) {
        if (!element) return;
        
        Object.keys(styles).forEach(property => {
            element.style[property] = styles[property];
        });
    }
    
    // פונקציה לקבלת מידע על המסך הנוכחי
    getScreenInfo() {
        return {
            size: this.currentSize,
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio || 1,
            orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
        };
    }
    
    // פונקציה לבדיקת תמיכה בתכונות
    checkFeatureSupport() {
        return {
            containerQueries: CSS.supports('container-type: inline-size'),
            cssCustomProperties: CSS.supports('color', 'var(--test)'),
            viewportUnits: CSS.supports('height', '100vh'),
            clamp: CSS.supports('font-size', 'clamp(1rem, 2vw, 2rem)')
        };
    }
}

// יצירת מופע גלובלי
const responsiveManager = new ResponsiveManager();
window.responsiveManager = responsiveManager;

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
        
        // הצגת מספר התראות (מקסימום 99)
        const displayCount = this.notifications.length > 99 ? '99+' : this.notifications.length;
        count.textContent = displayCount;
        
        console.log(`🔔 ${this.notifications.length} התראות פעילות`);
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



// מצא את הפונקציה sendFeedback והחלף אותה:
function sendFeedback() {
    showFeedbackDialog();
    // הסר את השורה: toggleSidebar(); (אם קיימת)
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
    showPasswordDialog();
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

// מצא את הפונקציה switchTab והחלף אותה:
function switchTab(tabName) {
    console.log('🔄 מחליף טאב:', tabName);
    // סגור את כל הטפסים הפתוחים
    document.getElementById('budgetFormContainer').classList.add('hidden');
    document.getElementById('timesheetFormContainer').classList.add('hidden');
    
    // עדכון כפתורי הטאבים (קוד קיים)
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (event && event.target) {
        event.target.classList.add('active');
    }

    // עדכון התוכן (קוד קיים)
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tabName === 'budget') {
        document.getElementById('budgetTab').classList.add('active');
        setActiveNavItem('תקצוב'); // הדגש בסרגל
        console.log('✅ עבר לטאב תקצוב');
    } else if (tabName === 'timesheet') {
        document.getElementById('timesheetTab').classList.add('active');
        setActiveNavItem('שעתון'); // הדגש בסרגל
        
        // עדכון תאריך לתאריך הנוכחי
        const today = new Date().toISOString().split('T')[0];
        const dateField = document.getElementById('actionDate');
        if (dateField) {
            dateField.value = today;
        }
        console.log('✅ עבר לטאב שעתון');
    }
    
    // 👈 הוסף את השורה הזאת כאן - ממש לפני הסוגריים הסופיים:
    updatePlusTooltip(tabName);
}


// מצא את הפונקציה logout והחלף אותה:
function logout() {
    showLogoutDialog();
    // הסר את השורה: toggleSidebar(); (אם קיימת)
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
            // הוסף את השורה הזאת:
            updateUserDisplay(this.currentUser);
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

         // הוסף את השורות הבאות בסוף הפונקציה:
    
    // עדכון הסרגל עם פרטי המשתמש
    setTimeout(() => {
        updateSidebarUser(this.currentUser);
        console.log('👤 משתמש עודכן בסרגל:', this.currentUser);
    }, 500);
        
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
    // ===== IMPROVED RENDERING FUNCTIONS ===== 

// החלף את הפונקציה renderBudgetTasks() במחלקת LawOfficeManager
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
            this.renderBudgetCards();
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

// פונקציה חדשה לרינדור כרטיסיות משופרות
renderBudgetCards() {
    const container = document.getElementById('budgetContainer');
    const tasksHtml = this.filteredBudgetTasks.map(task => this.createModernTaskCard(task)).join('');
    
    container.innerHTML = `
        <div class="budget-cards-grid">
            ${tasksHtml}
        </div>
    `;
    
    // הוספת אנימציה חלקה
    setTimeout(() => {
        const cards = container.querySelectorAll('.modern-task-card');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            setTimeout(() => {
                card.style.transition = 'all 0.4s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }, 50);
}

// פונקציה משופרת ליצירת כרטיסייה מודרנית
createModernTaskCard(task) {
    const safeTask = this.sanitizeTaskData(task);
    const cardStatus = this.getTaskCardStatus(safeTask);
    const progressData = this.calculateProgress(safeTask);
    const metaData = this.getTaskMetaData(safeTask);
    
    return `
        <div class="modern-task-card ${cardStatus.cssClass}" data-task-id="${safeTask.id}">
            <!-- Header -->
            <div class="card-header">
                <h3 class="client-name">${safeTask.clientName}</h3>
                <span class="status-badge ${cardStatus.badgeClass}">
                    <i class="${cardStatus.icon}"></i>
                    ${cardStatus.text}
                </span>
            </div>
            
            <!-- Description -->
            <div class="task-description">
                <strong>📋 משימה:</strong> ${safeTask.description}
                ${safeTask.branch ? `<br><strong>🏢 סניף:</strong> ${safeTask.branch}` : ''}
                ${safeTask.fileNumber ? `<br><strong>📁 תיק:</strong> ${safeTask.fileNumber}` : ''}
            </div>
            
            <!-- Progress Section -->
            <div class="progress-section">
                <div class="progress-header">
                    <span>התקדמות</span>
                    <span class="progress-percentage">${progressData.percentage}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${progressData.statusClass}" 
                         style="width: ${Math.min(progressData.percentage, 100)}%"></div>
                </div>
                <div class="progress-details">
                    <small>${safeTask.actualMinutes} מתוך ${safeTask.estimatedMinutes} דקות</small>
                </div>
            </div>
            
            <!-- Meta Information -->
            <div class="card-meta">
                <div class="meta-item ${metaData.deadline.class}">
                    <i class="fas fa-calendar-alt"></i>
                    <span>${metaData.deadline.text}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-history"></i>
                    <span>${safeTask.history?.length || 0} רישומים</span>
                </div>
            </div>
            
            <!-- Actions -->
            <div class="card-actions">
                <button class="action-btn primary" onclick="manager.showAdvancedTimeDialog(${safeTask.id})" title="הוסף זמן">
                    <i class="fas fa-plus"></i> זמן
                </button>
                <button class="action-btn info" onclick="manager.showTaskHistory(${safeTask.id})" title="היסטוריה">
                    <i class="fas fa-history"></i> היסטוריה
                </button>
                ${safeTask.status === 'פעיל' ? `
                    <button class="action-btn warning" onclick="manager.showExtendDeadlineDialog(${safeTask.id})" title="הארך יעד">
                        <i class="fas fa-calendar-plus"></i> הארך
                    </button>
                    <button class="action-btn success" onclick="manager.completeTask(${safeTask.id})" title="סיים משימה">
                        <i class="fas fa-check"></i> סיים
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// פונקציה משופרת לרינדור טבלה
renderBudgetTable() {
    const tableContainer = document.getElementById('budgetTableContainer');
    
    const tableHtml = `
        <div class="advanced-table-container">
            <div class="table-header">
                <h3 class="table-title">
                    <i class="fas fa-chart-bar"></i>
                    משימות מתוקצבות
                </h3>
                <div class="table-controls">
                    <div class="table-search">
                        <i class="fas fa-search"></i>
                        <input type="text" placeholder="חפש משימות..." 
                               oninput="manager.handleTableSearch(this.value)">
                    </div>
                    <select class="table-filter" onchange="manager.handleTableFilter(this.value)">
                        <option value="all">הכל</option>
                        <option value="active">פעילות</option>
                        <option value="completed">הושלמו</option>
                        <option value="overdue">באיחור</option>
                    </select>
                </div>
            </div>
            
            <div class="table-stats">
                <div class="stats-item">
                    <i class="fas fa-tasks"></i>
                    <span>סה"כ משימות: <strong>${this.filteredBudgetTasks.length}</strong></span>
                </div>
                <div class="stats-item">
                    <i class="fas fa-clock"></i>
                    <span>זמן כולל: <strong>${this.getTotalMinutes()} דק'</strong></span>
                </div>
                <div class="stats-item">
                    <i class="fas fa-percentage"></i>
                    <span>ממוצע התקדמות: <strong>${this.getAverageProgress()}%</strong></span>
                </div>
            </div>
            
            <table class="advanced-table" id="budgetTable">
                <thead>
                    <tr>
                        <th class="sortable" data-sort="clientName" onclick="manager.sortTable('clientName')">
                            לקוח
                            <i class="sort-icon"></i>
                        </th>
                        <th class="sortable" data-sort="description" onclick="manager.sortTable('description')">
                            תיאור משימה
                            <i class="sort-icon"></i>
                        </th>
                        <th class="sortable" data-sort="progress" onclick="manager.sortTable('progress')">
                            התקדמות
                            <i class="sort-icon"></i>
                        </th>
                        <th class="sortable" data-sort="deadline" onclick="manager.sortTable('deadline')">
                            תאריך יעד
                            <i class="sort-icon"></i>
                        </th>
                        <th class="sortable" data-sort="status" onclick="manager.sortTable('status')">
                            סטטוס
                            <i class="sort-icon"></i>
                        </th>
                        <th>פעולות</th>
                    </tr>
                </thead>
                <tbody id="budgetTableBody">
                    ${this.generateTableRows()}
                </tbody>
            </table>
        </div>
    `;
    
    tableContainer.innerHTML = tableHtml;
    this.updateSortIndicators();
}

// פונקציה ליצירת שורות הטבלה
generateTableRows() {
    return this.filteredBudgetTasks.map(task => {
        const safeTask = this.sanitizeTaskData(task);
        const progressData = this.calculateProgress(safeTask);
        const statusData = this.getTaskCardStatus(safeTask);
        const deadlineData = this.getDeadlineStatus(safeTask);
        
        return `
            <tr data-task-id="${safeTask.id}">
                <td class="cell-client">${safeTask.clientName}</td>
                <td class="cell-description" title="${safeTask.description}">
                    ${safeTask.description}
                </td>
                <td class="cell-progress">
                    <div class="progress-cell">
                        <div class="progress-bar-mini">
                            <div class="progress-fill-mini ${progressData.statusClass}" 
                                 style="width: ${Math.min(progressData.percentage, 100)}%"></div>
                        </div>
                        <span class="progress-text-mini">
                            ${progressData.percentage}% (${safeTask.actualMinutes}/${safeTask.estimatedMinutes})
                        </span>
                    </div>
                </td>
                <td class="cell-deadline ${deadlineData.class}">
                    ${this.formatDateTime(new Date(safeTask.deadline))}
                </td>
                <td class="cell-status">
                    <span class="status-pill ${statusData.badgeClass}">
                        <i class="${statusData.icon}"></i>
                        ${statusData.text}
                    </span>
                </td>
                <td class="cell-actions">
                    <div class="table-action-group">
                        <button class="table-action-btn primary" 
                                onclick="manager.showAdvancedTimeDialog(${safeTask.id})" 
                                title="הוסף זמן">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="table-action-btn info" 
                                onclick="manager.showTaskHistory(${safeTask.id})" 
                                title="היסטוריה">
                            <i class="fas fa-history"></i>
                        </button>
                        ${safeTask.status === 'פעיל' ? `
                            <button class="table-action-btn warning" 
                                    onclick="manager.showExtendDeadlineDialog(${safeTask.id})" 
                                    title="הארך יעד">
                                <i class="fas fa-calendar-plus"></i>
                            </button>
                            <button class="table-action-btn success" 
                                    onclick="manager.completeTask(${safeTask.id})" 
                                    title="סיים משימה">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// פונקציות עזר
sanitizeTaskData(task) {
    return {
        id: task.id || Date.now(),
        clientName: task.clientName || 'לקוח לא ידוע',
        description: task.description || 'משימה ללא תיאור',
        estimatedMinutes: Number(task.estimatedMinutes) || 0,
        actualMinutes: Number(task.actualMinutes) || 0,
        deadline: task.deadline || new Date().toISOString(),
        status: task.status || 'פעיל',
        branch: task.branch || '',
        fileNumber: task.fileNumber || '',
        history: task.history || []
    };
}

getTaskCardStatus(task) {
    const now = new Date();
    const deadline = new Date(task.deadline);
    const isOverdue = deadline < now;
    const isCompleted = task.status === 'הושלם';
    
    if (isCompleted) {
        return {
            cssClass: 'completed',
            badgeClass: 'completed',
            icon: 'fas fa-check-circle',
            text: 'הושלם'
        };
    } else if (isOverdue) {
        return {
            cssClass: 'overdue',
            badgeClass: 'overdue', 
            icon: 'fas fa-exclamation-triangle',
            text: 'באיחור'
        };
    } else {
        return {
            cssClass: 'active',
            badgeClass: 'active',
            icon: 'fas fa-play-circle',
            text: 'פעיל'
        };
    }
}

calculateProgress(task) {
    const percentage = task.estimatedMinutes > 0 ? 
        Math.round((task.actualMinutes / task.estimatedMinutes) * 100) : 0;
    
    let statusClass = 'normal';
    if (percentage >= 100) {
        statusClass = 'completed';
    } else if (percentage > 80) {
        statusClass = 'overdue';
    }
    
    return { percentage, statusClass };
}

getTaskMetaData(task) {
    const now = new Date();
    const deadline = new Date(task.deadline);
    const timeUntilDeadline = deadline - now;
    const oneDay = 24 * 60 * 60 * 1000;
    
    let deadlineData = {
        text: this.formatDateTime(deadline),
        class: ''
    };
    
    if (timeUntilDeadline < 0) {
        deadlineData.class = 'deadline overdue';
        deadlineData.text = `⚠️ ${this.formatDateTime(deadline)}`;
    } else if (timeUntilDeadline < oneDay) {
        deadlineData.class = 'deadline soon';
        deadlineData.text = `🚨 ${this.formatDateTime(deadline)}`;
    }
    
    return { deadline: deadlineData };
}

getDeadlineStatus(task) {
    const now = new Date();
    const deadline = new Date(task.deadline);
    const timeUntilDeadline = deadline - now;
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (timeUntilDeadline < 0) {
        return { class: 'overdue' };
    } else if (timeUntilDeadline < oneDay) {
        return { class: 'soon' };
    }
    return { class: '' };
}

// פונקציות לחיפוש ומיון בטבלה
handleTableSearch(searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    
    if (!searchTerm) {
        this.filteredBudgetTasks = [...this.budgetTasks];
    } else {
        this.filteredBudgetTasks = this.budgetTasks.filter(task => {
            return (
                task.clientName.toLowerCase().includes(searchLower) ||
                task.description.toLowerCase().includes(searchLower) ||
                (task.branch && task.branch.toLowerCase().includes(searchLower)) ||
                (task.fileNumber && task.fileNumber.toLowerCase().includes(searchLower))
            );
        });
    }
    
    this.renderBudgetTable();
}

handleTableFilter(filterValue) {
    const now = new Date();
    
    switch (filterValue) {
        case 'active':
            this.filteredBudgetTasks = this.budgetTasks.filter(task => 
                task.status === 'פעיל');
            break;
        case 'completed':
            this.filteredBudgetTasks = this.budgetTasks.filter(task => 
                task.status === 'הושלם');
            break;
        case 'overdue':
            this.filteredBudgetTasks = this.budgetTasks.filter(task => 
                new Date(task.deadline) < now && task.status !== 'הושלם');
            break;
        default:
            this.filteredBudgetTasks = [...this.budgetTasks];
    }
    
    this.renderBudgetTable();
}

sortTable(field) {
    // עדכון כיוון המיון
    if (this.budgetSortField === field) {
        this.budgetSortDirection = this.budgetSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        this.budgetSortField = field;
        this.budgetSortDirection = 'asc';
    }
    
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
    
    this.renderBudgetTable();
}

updateSortIndicators() {
    // עדכון אייקוני המיון
    document.querySelectorAll('#budgetTable th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    if (this.budgetSortField) {
        const currentTh = document.querySelector(`#budgetTable th[data-sort="${this.budgetSortField}"]`);
        if (currentTh) {
            currentTh.classList.add(`sort-${this.budgetSortDirection}`);
        }
    }
}

// פונקציות לחישוב סטטיסטיקות
getTotalMinutes() {
    return this.filteredBudgetTasks.reduce((total, task) => {
        return total + (Number(task.actualMinutes) || 0);
    }, 0);
}

getAverageProgress() {
    if (this.filteredBudgetTasks.length === 0) return 0;
    
    const totalProgress = this.filteredBudgetTasks.reduce((total, task) => {
        const progress = task.estimatedMinutes > 0 ? 
            (task.actualMinutes / task.estimatedMinutes) * 100 : 0;
        return total + progress;
    }, 0);
    
    return Math.round(totalProgress / this.filteredBudgetTasks.length);
}

    // החלף את הפונקציה renderBudgetTable במחלקת LawOfficeManager:
renderBudgetTable() {
    const tableContainer = document.getElementById('budgetTableContainer');
    
    if (!this.filteredBudgetTasks || this.filteredBudgetTasks.length === 0) {
        tableContainer.innerHTML = this.createEmptyTableState();
        return;
    }
    
    const tableHtml = `
        <div class="modern-table-container">
            <div class="modern-table-header">
                <h3 class="modern-table-title">
                    <i class="fas fa-chart-bar"></i>
                    משימות מתוקצבות
                </h3>
                <div class="modern-table-subtitle">
                    ${this.filteredBudgetTasks.length} משימות • ${this.getActiveTasksCount()} פעילות • ${this.getCompletedTasksCount()} הושלמו
                </div>
            </div>
            
            <table class="modern-budget-table">
                <thead>
                    <tr>
                        <th class="sortable" data-sort="clientName" onclick="manager.sortTable('clientName')">
                            לקוח
                            <i class="sort-icon"></i>
                        </th>
                        <th class="sortable" data-sort="description" onclick="manager.sortTable('description')">
                            תיאור משימה
                            <i class="sort-icon"></i>
                        </th>
                        <th class="sortable" data-sort="progress" onclick="manager.sortTable('progress')">
                            התקדמות
                            <i class="sort-icon"></i>
                        </th>
                        <th class="sortable" data-sort="deadline" onclick="manager.sortTable('deadline')">
                            תאריך יעד
                            <i class="sort-icon"></i>
                        </th>
                        <th class="sortable" data-sort="status" onclick="manager.sortTable('status')">
                            סטטוס
                            <i class="sort-icon"></i>
                        </th>
                        <th>פעולות</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.generateModernTableRows()}
                </tbody>
            </table>
        </div>
    `;
    
    tableContainer.innerHTML = tableHtml;
    this.updateSortIndicators();
    
    // הוספת אנימציה חלקה לשורות
    setTimeout(() => {
        const rows = tableContainer.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
            row.style.opacity = '0';
            row.style.transform = 'translateY(10px)';
            setTimeout(() => {
                row.style.transition = 'all 0.3s ease';
                row.style.opacity = '1';
                row.style.transform = 'translateY(0)';
            }, index * 50);
        });
    }, 100);
}

// פונקציה חדשה ליצירת שורות הטבלה המודרנית
generateModernTableRows() {
    return this.filteredBudgetTasks.map(task => {
        const safeTask = this.sanitizeTaskData(task);
        const progressData = this.calculateModernProgress(safeTask);
        const deadlineData = this.getModernDeadlineStatus(safeTask);
        const statusData = this.getModernStatus(safeTask);
        
        return `
            <tr data-task-id="${safeTask.id}" class="modern-table-row">
                <td class="table-cell-client">
                    ${safeTask.clientName}
                    ${safeTask.fileNumber ? `<br><small style="color: #94a3b8; font-weight: 400;">תיק: ${safeTask.fileNumber}</small>` : ''}
                </td>
                
                <td class="table-cell-description ${this.shouldTruncateDescription(safeTask.description) ? 'truncated' : ''}" 
                    title="${safeTask.description}">
                    ${safeTask.description}
                    ${safeTask.branch ? `<br><small style="color: #94a3b8; font-weight: 400;">📍 ${safeTask.branch}</small>` : ''}
                </td>
                
                <td class="table-cell-progress">
                    ${this.createModernProgressBar(progressData, safeTask)}
                </td>
                
                <td class="table-cell-deadline ${deadlineData.cssClass}">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        ${deadlineData.icon}
                        <span>${this.formatDateTime(new Date(safeTask.deadline))}</span>
                    </div>
                </td>
                
                <td class="table-cell-status">
                    <span class="modern-status-badge ${statusData.cssClass}">
                        <i class="${statusData.icon}"></i>
                        ${statusData.text}
                    </span>
                </td>
                
                <td class="table-cell-actions">
                    ${this.createModernActionButtons(safeTask)}
                </td>
            </tr>
        `;
    }).join('');
}

// פונקציה ליצירת בר התקדמות מודרני
createModernProgressBar(progressData, task) {
    return `
        <div class="modern-progress-container">
            <div class="modern-progress-header">
                <span class="modern-progress-label">התקדמות</span>
                <span class="modern-progress-percentage">${progressData.percentage}%</span>
            </div>
            <div class="modern-progress-bar">
                <div class="modern-progress-fill ${progressData.colorClass}" 
                     style="width: ${Math.min(progressData.percentage, 100)}%"></div>
            </div>
            <div class="modern-progress-details">
                ${task.actualMinutes} מתוך ${task.estimatedMinutes} דק' • ${Math.round(task.actualMinutes / 60 * 10) / 10}h/${Math.round(task.estimatedMinutes / 60 * 10) / 10}h
            </div>
        </div>
    `;
}

// פונקציה ליצירת כפתורי פעולות מודרניים
createModernActionButtons(task) {
    const baseButtons = `
        <div class="modern-actions-group">
            <button class="modern-action-btn primary" 
                    onclick="manager.showAdvancedTimeDialog(${task.id})" 
                    title="הוסף זמן">
                <i class="fas fa-plus"></i>
            </button>
            <button class="modern-action-btn info" 
                    onclick="manager.showTaskHistory(${task.id})" 
                    title="היסטוריה">
                <i class="fas fa-history"></i>
            </button>
    `;
    
    const activeButtons = task.status === 'פעיל' ? `
            <button class="modern-action-btn warning" 
                    onclick="manager.showExtendDeadlineDialog(${task.id})" 
                    title="הארך יעד">
                <i class="fas fa-calendar-plus"></i>
            </button>
            <button class="modern-action-btn success" 
                    onclick="manager.completeTask(${task.id})" 
                    title="סיים משימה">
                <i class="fas fa-check"></i>
            </button>
    ` : '';
    
    return baseButtons + activeButtons + '</div>';
}

// פונקציות עזר מעודכנות
calculateModernProgress(task) {
    const percentage = task.estimatedMinutes > 0 ? 
        Math.round((task.actualMinutes / task.estimatedMinutes) * 100) : 0;
    
    let colorClass = 'normal';
    if (percentage >= 100) {
        colorClass = 'complete';
    } else if (percentage >= 85) {
        colorClass = 'danger';
    } else if (percentage >= 70) {
        colorClass = 'warning';
    }
    
    return { percentage, colorClass };
}

getModernDeadlineStatus(task) {
    const now = new Date();
    const deadline = new Date(task.deadline);
    const timeUntilDeadline = deadline - now;
    const oneDay = 24 * 60 * 60 * 1000;
    const threeDays = oneDay * 3;
    
    if (timeUntilDeadline < 0) {
        return {
            cssClass: 'overdue',
            icon: '<i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i>'
        };
    } else if (timeUntilDeadline < oneDay) {
        return {
            cssClass: 'soon',
            icon: '<i class="fas fa-clock" style="color: #f59e0b;"></i>'
        };
    } else if (timeUntilDeadline < threeDays) {
        return {
            cssClass: 'soon',
            icon: '<i class="fas fa-calendar-check" style="color: #f59e0b;"></i>'
        };
    }
    
    return {
        cssClass: 'normal',
        icon: '<i class="fas fa-calendar-alt" style="color: #64748b;"></i>'
    };
}

getModernStatus(task) {
    const now = new Date();
    const deadline = new Date(task.deadline);
    const isOverdue = deadline < now;
    const isCompleted = task.status === 'הושלם';
    
    if (isCompleted) {
        return {
            cssClass: 'completed',
            icon: 'fas fa-check-circle',
            text: 'הושלם'
        };
    } else if (isOverdue) {
        return {
            cssClass: 'overdue',
            icon: 'fas fa-exclamation-triangle',
            text: 'באיחור'
        };
    } else {
        return {
            cssClass: 'active',
            icon: 'fas fa-play-circle',
            text: 'פעיל'
        };
    }
}

// פונקציות נוספות
shouldTruncateDescription(description) {
    return description && description.length > 50;
}

getActiveTasksCount() {
    return this.filteredBudgetTasks.filter(task => task.status === 'פעיל').length;
}

getCompletedTasksCount() {
    return this.filteredBudgetTasks.filter(task => task.status === 'הושלם').length;
}

createEmptyTableState() {
    return `
        <div class="modern-table-container">
            <div class="modern-table-header">
                <h3 class="modern-table-title">
                    <i class="fas fa-chart-bar"></i>
                    משימות מתוקצבות
                </h3>
                <div class="modern-table-subtitle">אין משימות להצגה</div>
            </div>
            <div style="padding: 60px 40px; text-align: center; color: #94a3b8;">
                <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">
                    <i class="fas fa-chart-bar"></i>
                </div>
                <h4 style="color: #475569; margin-bottom: 8px;">אין משימות מתוקצבות</h4>
                <p style="margin: 0; font-size: 14px;">הוסף משימה חדשה כדי להתחיל</p>
            </div>
        </div>
    `;
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

    // ===== MODERN TIMESHEET TABLE 2025 - JavaScript =====

// החלף את הפונקציה renderTimesheetTable במחלקת LawOfficeManager:
renderTimesheetTable() {
    const tableContainer = document.getElementById('timesheetTableContainer');
    
    if (!this.filteredTimesheetEntries || this.filteredTimesheetEntries.length === 0) {
        tableContainer.innerHTML = this.createEmptyTimesheetState();
        return;
    }
    
    const tableHtml = `
        <div class="modern-table-container">
            <div class="modern-timesheet-header">
                <h3 class="modern-timesheet-title">
                    <i class="fas fa-clock"></i>
                    רשומות שעתון
                </h3>
                <div class="modern-timesheet-subtitle">
                    ${this.filteredTimesheetEntries.length} רשומות • ${this.getTotalHoursTimesheet()} שעות סה"כ
                </div>
                <div class="timesheet-stats">
                    <div class="timesheet-stat">
                        <i class="fas fa-calendar-day"></i>
                        <span>היום: ${this.getTodayEntries()} רשומות</span>
                    </div>
                    <div class="timesheet-stat">
                        <i class="fas fa-chart-line"></i>
                        <span>השבוע: ${this.getWeekEntries()} רשומות</span>
                    </div>
                    <div class="timesheet-stat">
                        <i class="fas fa-users"></i>
                        <span>${this.getUniqueClientsCount()} לקוחות</span>
                    </div>
                </div>
            </div>
            
            <table class="modern-timesheet-table">
                <thead>
                    <tr>
                        <th class="sortable" data-sort="date" onclick="manager.sortTimesheetTable('date')">
                            תאריך
                            <i class="sort-icon"></i>
                        </th>
                        <th class="sortable" data-sort="action" onclick="manager.sortTimesheetTable('action')">
                            פעולה שבוצעה
                            <i class="sort-icon"></i>
                        </th>
                        <th class="sortable" data-sort="minutes" onclick="manager.sortTimesheetTable('minutes')">
                            זמן
                            <i class="sort-icon"></i>
                        </th>
                        <th class="sortable" data-sort="clientName" onclick="manager.sortTimesheetTable('clientName')">
                            לקוח
                            <i class="sort-icon"></i>
                        </th>
                        <th class="sortable" data-sort="fileNumber" onclick="manager.sortTimesheetTable('fileNumber')">
                            מס׳ תיק
                            <i class="sort-icon"></i>
                        </th>
                        <th>הערות</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.generateModernTimesheetRows()}
                </tbody>
            </table>
        </div>
    `;
    
    tableContainer.innerHTML = tableHtml;
    this.updateTimesheetSortIndicators();
    
    // הוספת אנימציה חלקה לשורות
    setTimeout(() => {
        const rows = tableContainer.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
            row.style.opacity = '0';
            row.style.transform = 'translateY(10px)';
            setTimeout(() => {
                row.style.transition = 'all 0.3s ease';
                row.style.opacity = '1';
                row.style.transform = 'translateY(0)';
            }, index * 30);
        });
    }, 100);
}

// פונקציה ליצירת שורות טבלת שעתון מודרנית
generateModernTimesheetRows() {
    return this.filteredTimesheetEntries.map(entry => {
        const safeEntry = this.sanitizeTimesheetData(entry);
        
        return `
            <tr data-entry-id="${safeEntry.id}" class="modern-timesheet-row">
                <td class="timesheet-cell-date">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-calendar-alt" style="color: #16a34a;"></i>
                        <span>${this.formatDateModern(safeEntry.date)}</span>
                    </div>
                </td>
                
                <td class="timesheet-cell-action ${this.shouldTruncateAction(safeEntry.action) ? 'truncated' : ''}" 
                    title="${safeEntry.action}">
                    ${safeEntry.action}
                </td>
                
                <td class="timesheet-cell-time">
                    ${this.createTimeBadge(safeEntry.minutes)}
                </td>
                
                <td class="timesheet-cell-client">
                    ${safeEntry.clientName}
                    ${safeEntry.lawyer ? `<br><small style="color: #94a3b8; font-weight: 400;">👤 ${safeEntry.lawyer}</small>` : ''}
                </td>
                
                <td class="timesheet-cell-file">
                    ${this.createFileBadge(safeEntry.fileNumber)}
                </td>
                
                <td class="timesheet-cell-notes ${safeEntry.notes ? '' : 'empty'} ${this.shouldTruncateNotes(safeEntry.notes) ? 'truncated' : ''}" 
                    title="${safeEntry.notes || ''}">
                    ${safeEntry.notes || '—'}
                </td>
            </tr>
        `;
    }).join('');
}

// פונקציה ליצירת באדג' זמן מודרני
createTimeBadge(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    let timeDisplay = '';
    if (hours > 0) {
        timeDisplay = `<span class="time-hours">${hours}</span><span class="time-minutes">h</span>`;
        if (mins > 0) {
            timeDisplay += ` <span class="time-minutes">${mins}m</span>`;
        }
    } else {
        timeDisplay = `<span class="time-minutes">${mins}m</span>`;
    }
    
    return `
        <div class="time-badge">
            <i class="fas fa-clock"></i>
            ${timeDisplay}
        </div>
    `;
}

// פונקציה ליצירת באדג' תיק מודרני
createFileBadge(fileNumber) {
    return `
        <div class="file-badge">
            <i class="fas fa-folder"></i>
            ${fileNumber}
        </div>
    `;
}

// פונקציות עזר לטבלת שעתון
sanitizeTimesheetData(entry) {
    return {
        id: entry.id || Date.now(),
        date: entry.date || new Date().toISOString().split('T')[0],
        action: entry.action || 'פעולה לא ידועה',
        minutes: Number(entry.minutes) || 0,
        clientName: entry.clientName || 'לקוח לא ידוע',
        fileNumber: entry.fileNumber || 'לא ידוע',
        notes: entry.notes || '',
        lawyer: entry.lawyer || ''
    };
}

formatDateModern(dateString) {
    try {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // בדיקה אם זה היום
        if (date.toDateString() === today.toDateString()) {
            return 'היום';
        }
        
        // בדיקה אם זה אתמול
        if (date.toDateString() === yesterday.toDateString()) {
            return 'אתמול';
        }
        
        // תאריך רגיל
        return date.toLocaleDateString('he-IL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (error) {
        return 'תאריך לא תקין';
    }
}

shouldTruncateAction(action) {
    return action && action.length > 60;
}

shouldTruncateNotes(notes) {
    return notes && notes.length > 40;
}

// סטטיסטיקות שעתון
getTotalHoursTimesheet() {
    const totalMinutes = this.filteredTimesheetEntries.reduce((sum, entry) => {
        return sum + (Number(entry.minutes) || 0);
    }, 0);
    return Math.round((totalMinutes / 60) * 10) / 10;
}

getTodayEntries() {
    const today = new Date().toISOString().split('T')[0];
    return this.filteredTimesheetEntries.filter(entry => 
        entry.date === today
    ).length;
}

getWeekEntries() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return this.filteredTimesheetEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= oneWeekAgo;
    }).length;
}

getUniqueClientsCount() {
    const uniqueClients = new Set(
        this.filteredTimesheetEntries.map(entry => entry.clientName)
    );
    return uniqueClients.size;
}

// מיון טבלת שעתון
updateTimesheetSortIndicators() {
    // עדכון אייקוני המיון
    document.querySelectorAll('#timesheetTable th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    if (this.timesheetSortField) {
        const currentTh = document.querySelector(`#timesheetTable th[data-sort="${this.timesheetSortField}"]`);
        if (currentTh) {
            currentTh.classList.add(`sort-${this.timesheetSortDirection}`);
        }
    }
}

// מצב ריק לטבלת שעתון
createEmptyTimesheetState() {
    return `
        <div class="modern-table-container">
            <div class="modern-timesheet-header">
                <h3 class="modern-timesheet-title">
                    <i class="fas fa-clock"></i>
                    רשומות שעתון
                </h3>
                <div class="modern-timesheet-subtitle">אין רשומות להצגה</div>
            </div>
            <div style="padding: 60px 40px; text-align: center; color: #94a3b8;">
                <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5; color: #16a34a;">
                    <i class="fas fa-clock"></i>
                </div>
                <h4 style="color: #475569; margin-bottom: 8px;">אין רשומות שעתון</h4>
                <p style="margin: 0; font-size: 14px;">רשום את הפעולה הראשונה שלך</p>
            </div>
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
    console.log('🚀 DOM נטען - מאתחל סרגל מינימליסטי');
    
    // חכה קצת שהדף יסתדר
    setTimeout(() => {
        // הדגש את הפריט הראשון כברירת מחדל
        const firstNavItem = document.querySelector('.nav-item');
        if (firstNavItem) {
            firstNavItem.classList.add('active');
            console.log('✅ פריט ראשון הודגש');
        }
        
        // הפעל אנימציות
        initializeSidebarAnimations();
        
        // הגדר אפקטי hover
        setupAdvancedHoverEffects();
        
        // בדוק אם המשתמש כבר מחובר
        if (window.manager && window.manager.currentUser) {
            updateSidebarUser(window.manager.currentUser);
        }
        
    }, 200);
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








// ✨ שלב 3: הוספת פונקציות חדשות
// =================================

// הוסף את הפונקציות הבאות בסוף הקובץ script.js:

// פונקציה להדגשת פריט פעיל בסרגל
function setActiveNavItem(itemName) {
    console.log('🎯 מעדכן פריט פעיל:', itemName);
    
    // הסר הדגשה מכל הפריטים
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // נסה למצוא את הפריט לפי כמה שיטות
    let activeItem = null;
    
    // שיטה 1: חיפוש לפי onclick
    activeItem = document.querySelector(`[onclick*="${itemName}"]`);
    
    // שיטה 2: חיפוש לפי title
    if (!activeItem) {
        activeItem = document.querySelector(`[title*="${itemName}"]`);
    }
    
    // שיטה 3: חיפוש לפי טקסט
    if (!activeItem) {
        const navItems = document.querySelectorAll('.nav-item span');
        navItems.forEach(span => {
            if (span.textContent.includes(itemName)) {
                activeItem = span.closest('.nav-item');
            }
        });
    }
    
    // הדגש את הפריט שנמצא
    if (activeItem) {
        activeItem.classList.add('active');
        console.log('✅ פריט הודגש בהצלחה');
    } else {
        console.log('⚠️ לא נמצא פריט להדגשה');
    }
}

// פונקציה לעדכון מידע המשתמש בסרגל
function updateSidebarUser(userName) {
    console.log('👤 מעדכן משתמש בסרגל:', userName);
    
    const userAvatar = document.querySelector('.user-avatar');
    if (!userAvatar) {
        console.log('⚠️ לא נמצא avatar במערכת');
        return;
    }
    
    if (userName) {
        // הוסף טיפ עם שם המשתמש
        userAvatar.setAttribute('title', `מחובר: ${userName}`);
        userAvatar.setAttribute('data-user', userName);
        
        // מערך צבעים לבחירה
        const colors = [
            'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', // סגול
            'linear-gradient(135deg, #10b981 0%, #059669 100%)', // ירוק
            'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // כתום
            'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', // אדום
            'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', // כחול
            'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', // סגול בהיר
            'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', // תכלת
            'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)'  // ירוק בהיר
        ];
        
        // בחירת צבע לפי שם המשתמש
        const colorIndex = userName.charCodeAt(0) % colors.length;
        userAvatar.style.background = colors[colorIndex];
        
        // הוספת אפקט מיוחד
        userAvatar.style.transform = 'scale(1.05)';
        setTimeout(() => {
            userAvatar.style.transform = '';
        }, 300);
        
        console.log(`✅ משתמש עודכן: ${userName}, צבע: ${colorIndex}`);
    }
}

// פונקציה לאנימציית כניסה של הסרגל
function initializeSidebarAnimations() {
    console.log('🎨 מאתחל אנימציות סרגל');
    
    // חכה שהסרגל יטען
    setTimeout(() => {
        const navItems = document.querySelectorAll('.nav-item');
        const sidebar = document.querySelector('.minimal-sidebar');
        
        if (!sidebar) {
            console.log('⚠️ סרגל לא נמצא - מדלג על אנימציות');
            return;
        }
        
        // אנימציית כניסה לסרגל
        sidebar.style.transform = 'translateX(100%)';
        sidebar.style.opacity = '0';
        
        setTimeout(() => {
            sidebar.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            sidebar.style.transform = 'translateX(0)';
            sidebar.style.opacity = '1';
        }, 100);
        
        // אנימציית כניסה לפריטים
        navItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateX(20px)';
            
            setTimeout(() => {
                item.style.transition = 'all 0.4s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateX(0)';
            }, 200 + (index * 100));
        });
        
        console.log('✅ אנימציות הופעלו');
    }, 500);
}

// פונקציה לטיפול באירועי hover מתקדמים
function setupAdvancedHoverEffects() {
    console.log('✨ מגדיר אפקטי hover מתקדמים');
    
    const navItems = document.querySelectorAll('.nav-item');
    const sidebar = document.querySelector('.minimal-sidebar');
    
    if (!navItems.length || !sidebar) {
        console.log('⚠️ לא נמצאו אלמנטים לhover');
        return;
    }
    
    navItems.forEach((item, index) => {
        // אפקט כניסה
        item.addEventListener('mouseenter', function(e) {
            // אפקט ripple
            const ripple = document.createElement('div');
            ripple.style.cssText = `
                position: absolute;
                background: rgba(59, 130, 246, 0.2);
                border-radius: 50%;
                width: 0;
                height: 0;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                pointer-events: none;
                animation: ripple 0.6s ease-out;
            `;
            
            this.style.position = 'relative';
            this.appendChild(ripple);
            
            // הסרת ripple אחרי האנימציה
            setTimeout(() => {
                if (ripple && ripple.parentNode) {
                    ripple.parentNode.removeChild(ripple);
                }
            }, 600);
            
            // אפקט תזוזה
            this.style.transform = 'translateX(-3px) scale(1.02)';
            this.style.zIndex = '10';
        });
        
        // אפקט יציאה
        item.addEventListener('mouseleave', function() {
            this.style.transform = '';
            this.style.zIndex = '';
        });
        
        // אפקט לחיצה
        item.addEventListener('mousedown', function() {
            this.style.transform = 'translateX(-2px) scale(0.98)';
        });
        
        item.addEventListener('mouseup', function() {
            this.style.transform = 'translateX(-3px) scale(1.02)';
        });
    });
    
    // הוספת CSS לאנימציית ripple
    if (!document.getElementById('ripple-animation')) {
        const style = document.createElement('style');
        style.id = 'ripple-animation';
        style.textContent = `
            @keyframes ripple {
                from {
                    width: 0;
                    height: 0;
                    opacity: 1;
                }
                to {
                    width: 200px;
                    height: 200px;
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    console.log('✅ אפקטי hover הוגדרו');
}

// 🔄 שלב 4: עדכון event listeners קיימים
// ==========================================

// מצא את הקטע הזה ומחק אותו (אם קיים):
/*
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

window.addEventListener('resize', function() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
        toggleSidebar();
    }
});
*/



// הוסף פונקציה לבדיקת תקינות הסרגל:
function checkSidebarIntegrity() {
    console.log('🔍 בודק תקינות הסרגל החדש...');
    
    const sidebar = document.querySelector('.minimal-sidebar');
    const navItems = document.querySelectorAll('.nav-item');
    const userAvatar = document.querySelector('.user-avatar');
    
    const results = {
        sidebar: !!sidebar,
        navItems: navItems.length,
        userAvatar: !!userAvatar,
        isVisible: sidebar ? getComputedStyle(sidebar).display !== 'none' : false
    };
    
    console.log('📊 תוצאות בדיקה:', results);
    
    if (results.sidebar && results.navItems >= 4 && results.userAvatar && results.isVisible) {
        console.log('✅ הסרגל החדש עובד תקין!');
        return true;
    } else {
        console.log('❌ יש בעיה עם הסרגל החדש');
        console.log('🔧 בדוק שהקוד הועתק נכון לכל הקבצים');
        return false;
    }
}

// הפעל בדיקה אוטומטית אחרי 3 שניות
setTimeout(() => {
    checkSidebarIntegrity();
}, 3000);

// ===== סוף העדכונים ל-JavaScript =====
// קרא להוסיף את הקוד למטה לסוף הקובץ script.js

// ===== הוסף את הקוד הזה לסוף script.js =====

// החלף את הפונקציה toggleSidebar ב:
function toggleSidebar() {
    const sidebar = document.getElementById('minimalSidebar');
    
    // אפשרות להחביא/להציג את הסרגל הצף
    if (sidebar.style.display === 'none') {
        sidebar.style.display = 'flex';
        sidebar.style.animation = 'fadeInScale 0.3s ease forwards';
    } else {
        sidebar.style.display = 'none';
    }
}

// הוסף אנימציה יפה לכותרת ה-CSS:
const style = document.createElement('style');
style.textContent = `
@keyframes fadeInScale {
    from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
    }
    to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
    }
}
`;
document.head.appendChild(style);
// 2. מחק או הוסף הערה לשורות האלה אם הן קיימות:
/*
.app-container.sidebar-expanded .brand-text {
    opacity: 1;
    transform: translateX(0);
}

.app-container.sidebar-expanded .nav-item span {
    opacity: 1;
    transform: translateX(0);
}
*/
// התאמה אוטומטית לגודל מסך
function handleResize() {
    const container = document.getElementById('appContainer');
    const sidebar = document.getElementById('minimalSidebar');
    
    if (window.innerWidth > 600) {
        sidebar.classList.remove('open');
        if (window.innerWidth > 1200) {
            container.classList.add('sidebar-expanded');
        }
    }
}

// אתחול הסרגל החדש
function initializeNewSidebar() {
    console.log('🚀 מאתחל סרגל מינימליסטי חדש...');
    
    // הוסף event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('load', handleResize);
    
    // הוסף אפקטים לכפתורי התפריט
    document.querySelectorAll('.nav-item').forEach(item => {
        // רק אם אין onclick קיים
        if (!item.onclick && !item.getAttribute('onclick')) {
            item.addEventListener('click', function() {
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                this.classList.add('active');
            });
        }
    });
    
    // סגירת חיפושים וההתראות בלחיצה בחוץ
    document.addEventListener('click', function(e) {
        // סגירת תוצאות חיפוש
        if (!e.target.closest('.modern-client-search')) {
            document.querySelectorAll('.search-results').forEach(results => {
                results.classList.remove('show');
            });
        }
        
        // סגירת התראות
        if (!e.target.closest('.notification-bell') && !e.target.closest('.notifications-dropdown')) {
            const dropdown = document.getElementById('notificationsDropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
        }
        
        // סגירת סרגל צד במובייל
        if (window.innerWidth <= 600 && !e.target.closest('.minimal-sidebar') && !e.target.closest('.btn')) {
            const sidebar = document.getElementById('minimalSidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        }
    });
    
    console.log('✅ סרגל חדש מוכן!');
}

// פונקציות מתקדמות לחיפוש (שיפור של הקיימות)
function enhancedSearchClients(formType, query) {
    const resultsContainer = document.getElementById(`${formType}SearchResults`);
    
    if (!resultsContainer) {
        console.warn(`לא נמצא מיכל תוצאות: ${formType}SearchResults`);
        return;
    }
    
    if (query.length < 1) {
        resultsContainer.classList.remove('show');
        return;
    }

    // קבלת הלקוחות מהמנג'ר (אם קיים)
    const allClients = window.manager ? window.manager.clients : [];
    
    // סינון מתקדם
    const matches = allClients.filter(client => {
        const searchText = `${client.fullName} ${client.fileNumber} ${client.branch || ''}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
    }).slice(0, 8);

    // הצגת תוצאות משופרת
    if (matches.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">לא נמצאו לקוחות מתאימים</div>';
    } else {
        resultsContainer.innerHTML = matches.map(client => {
            const icon = client.type === 'fixed' ? '📋' : '⏰';
            const status = client.remainingHours <= 0 ? ' (חסום)' : 
                          client.remainingHours <= 5 ? ' (קריטי)' : '';
            
            return `
                <div class="search-result-item" onclick="selectClientEnhanced('${formType}', '${client.id}', '${client.fullName}', '${client.fileNumber}')">
                    <span class="result-icon">${icon}</span>
                    <div class="result-text">
                        <div class="result-name">${client.fullName}${status}</div>
                        <div class="result-details">תיק: ${client.fileNumber} • ${client.type === 'fixed' ? 'פיקס' : client.remainingHours + ' שעות'}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    resultsContainer.classList.add('show');
}

function selectClientEnhanced(formType, clientId, clientName, fileNumber) {
    const searchInput = document.getElementById(`${formType}ClientSearch`);
    const hiddenInput = document.getElementById(`${formType}ClientSelect`);
    const resultsContainer = document.getElementById(`${formType}SearchResults`);
    
    if (searchInput) searchInput.value = `${clientName} - תיק ${fileNumber}`;
    if (hiddenInput) hiddenInput.value = clientId;
    if (resultsContainer) resultsContainer.classList.remove('show');
    
    console.log(`✅ נבחר לקוח: ${clientName} (${clientId})`);
}

// פונקציות שיפור לטפסים
function enhanceFormExperience() {
    // הגדרת תאריך נוכחי לשעתון
    const timesheetDate = document.getElementById('timesheetDate');
    if (timesheetDate && !timesheetDate.value) {
        timesheetDate.value = new Date().toISOString().split('T')[0];
    }
    
    // שיפור validation לטפסים
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            const requiredFields = form.querySelectorAll('[required]');
            let isValid = true;
            
            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    field.style.borderColor = '#ef4444';
                    isValid = false;
                } else {
                    field.style.borderColor = '#e5e7eb';
                }
            });
            
            if (!isValid) {
                e.preventDefault();
                console.warn('⚠️ אנא מלא את כל השדות הנדרשים');
            }
        });
    });
    
    // אנימציות לאינפוטים
    document.querySelectorAll('input, textarea, select').forEach(input => {
        input.addEventListener('focus', function() {
            this.style.transform = 'translateY(-1px)';
        });
        
        input.addEventListener('blur', function() {
            this.style.transform = 'translateY(0)';
        });
    });
}

// פונקציית דיבוג למערכת החדשה
function debugNewSystem() {
    console.log('🔍 בדיקת מערכת חדשה:');
    console.log('📱 גודל מסך:', window.innerWidth, 'x', window.innerHeight);
    
    const elements = {
        appContainer: !!document.getElementById('appContainer'),
        sidebar: !!document.getElementById('minimalSidebar'),
        navItems: document.querySelectorAll('.nav-item').length,
        searchInputs: document.querySelectorAll('.search-input').length
    };
    
    console.log('📊 אלמנטים:', elements);
    
    if (elements.appContainer && elements.sidebar && elements.navItems >= 4) {
        console.log('✅ המערכת החדשה עובדת תקין!');
        return true;
    } else {
        console.log('❌ יש בעיה במערכת החדשה');
        return false;
    }
}

// קישור הפונקציות הקיימות לחדשות
if (typeof searchClients === 'undefined') {
    window.searchClients = enhancedSearchClients;
}

if (typeof selectClient === 'undefined') {
    window.selectClient = selectClientEnhanced;
}

// אתחול כשהדף נטען
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 מערכת חדשה נטענת...');
    
    // המתן קצת לטעינה
    setTimeout(() => {
        initializeNewSidebar();
        enhanceFormExperience();
        debugNewSystem();
        
        console.log('🚀 המערכת החדשה מוכנה לשימוש!');
    }, 500);
});

// התאמה מיוחדת למובייל
if (window.innerWidth <= 600) {
    // הוסף כפתור המבורגר אם לא קיים
    setTimeout(() => {
        if (!document.querySelector('.mobile-menu-btn')) {
            const headerActions = document.querySelector('.header-actions');
            if (headerActions) {
                const menuBtn = document.createElement('button');
                menuBtn.className = 'btn btn-secondary mobile-menu-btn';
                menuBtn.innerHTML = '<i class="fas fa-bars"></i> תפריט';
                menuBtn.onclick = toggleSidebar;
                headerActions.insertBefore(menuBtn, headerActions.firstChild);
            }
        }
    }, 1000);
}

// ===== סוף הקוד החדש ל-script.js =====

// ===== החלף את כל הפונקציות הקודמות - JavaScript נקי ופשוט =====

function showClientFormWithSidebar() {
    const content = `
        <div class="popup-header">
            <i class="fas fa-user-plus"></i>
            הוסף לקוח/תיק חדש
        </div>
        
        <div class="popup-content">
            <div class="popup-section">
                <h4><i class="fas fa-search"></i> חיפוש לקוח קיים</h4>
                <button type="button" class="search-existing-btn" onclick="searchExistingClient()">
                    <i class="fas fa-search"></i>
                    חפש לקוח קיים במערכת
                </button>
            </div>
            
            <div class="popup-section">
                <h4><i class="fas fa-user"></i> פרטי לקוח</h4>
                <div class="form-grid">
                    <div class="form-field">
                        <label for="clientName">שם הלקוח</label>
                        <input type="text" id="clientName" placeholder="דנה לוי" required>
                    </div>
                    <div class="form-field">
                        <label for="fileNumberInput">מספר תיק</label>
                        <input type="text" id="fileNumberInput" placeholder="2025001" required>
                    </div>
                </div>
                <div class="form-field">
                    <label for="clientDescription">תיאור/הבחנה (אופציונלי)</label>
                    <input type="text" id="clientDescription" placeholder="תוכנית שעות, מחוזי, ביהד לעבודה...">
                </div>
            </div>
            
            <div class="popup-section">
                <h4><i class="fas fa-cog"></i> סוג התיק</h4>
                <div class="client-type-grid">
                    <div class="type-option">
                        <input type="radio" id="typeHours" name="clientType" value="hours" checked>
                        <label for="typeHours" class="type-label">
                            <div class="type-icon"><i class="fas fa-clock"></i></div>
                            <div class="type-text">
                                <strong>תוכנית שעות</strong>
                                <span>מעקב אחר שעות עבודה</span>
                            </div>
                        </label>
                    </div>
                    <div class="type-option">
                        <input type="radio" id="typeFixed" name="clientType" value="fixed">
                        <label for="typeFixed" class="type-label">
                            <div class="type-icon"><i class="fas fa-list-ol"></i></div>
                            <div class="type-text">
                                <strong>פיקס (3 שלבים)</strong>
                                <span>עבודה לפי שלבים קבועים</span>
                            </div>
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="popup-section" id="hoursSection">
                <h4><i class="fas fa-calculator"></i> כמות שעות</h4>
                <div class="hours-input-container">
                    <input type="number" id="hoursAmount" placeholder="30" min="1" max="500" required>
                    <div class="hours-note">
                        <i class="fas fa-info-circle"></i>
                        התראה תופיע כאשר יישארו 5 שעות בלבד
                    </div>
                </div>
            </div>
            
            <div class="popup-section hidden" id="stagesSection">
                <h4><i class="fas fa-check-circle"></i> שלבי העבודה</h4>
                <div class="stages-preview">
                    <div class="stage-item">
                        <i class="far fa-square"></i>
                        <span>שלב 1 - לא הושלם</span>
                    </div>
                    <div class="stage-item">
                        <i class="far fa-square"></i>
                        <span>שלב 2 - לא הושלם</span>
                    </div>
                    <div class="stage-item">
                        <i class="far fa-square"></i>
                        <span>שלב 3 - לא הושלם</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="popup-buttons">
            <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
                <i class="fas fa-times"></i>
                ביטול
            </button>
            <button class="popup-btn popup-btn-confirm" onclick="createClientFromPopup()">
                <i class="fas fa-check"></i>
                צור תיק
            </button>
        </div>
    `;
    
    const overlay = popupManager.createPopup('client', content, 'large');
    
    // הוספת event listeners
    setTimeout(() => {
        const typeRadios = overlay.querySelectorAll('input[name="clientType"]');
        typeRadios.forEach(radio => {
            radio.addEventListener('change', toggleClientTypeDisplay);
        });
    }, 100);

    
    document.body.appendChild(overlay);
    
    // טיפול בסוג תיק
    const typeSelect = overlay.querySelector('#clientType');
    const hoursInput = overlay.querySelector('#hoursInput');
    
    typeSelect.addEventListener('change', function() {
        hoursInput.style.display = this.value === 'hours' ? 'block' : 'none';
    });
}

function createClient() {
    const name = document.getElementById('newClientName').value;
    const fileNumber = document.getElementById('newFileNumber').value;
    const type = document.getElementById('clientType').value;
    const hours = document.getElementById('hoursAmount').value;
    
    if (!name || !fileNumber) {
        alert('אנא מלא את כל השדות');
        return;
    }
    
    console.log('יוצר לקוח:', { name, fileNumber, type, hours });
    
    // סגור פופאפ
    document.querySelector('.popup-overlay').remove();
    
    // הודעת הצלחה
    showNotification(`לקוח "${name}" נוצר בהצלחה`, 'success');
}

// ===== פונקציית יציאה פשוטה =====
function logout() {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    overlay.innerHTML = `
        <div class="popup" style="max-width: 400px;">
            <div class="popup-header">
                <i class="fas fa-power-off"></i>
                יציאה מהמערכת
            </div>
            
            <div class="popup-content" style="text-align: center; padding: 20px 0;">
                <div style="font-size: 48px; margin-bottom: 16px;">👋</div>
                <h3 style="color: #1f2937; margin-bottom: 12px;">האם לצאת מהמערכת?</h3>
                <p style="color: #6b7280;">כל הנתונים הלא שמורים יאבדו</p>
            </div>
            
            <div class="popup-buttons">
                <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
                    <i class="fas fa-times"></i>
                    ביטול
                </button>
                <button class="popup-btn popup-btn-danger" onclick="confirmLogout()">
                    <i class="fas fa-power-off"></i>
                    כן, צא
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

function confirmLogout() {
    // החזר למסך התחברות
    document.getElementById('interfaceElements').classList.add('hidden');
    document.getElementById('appContent').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
    
    // סגור פופאפ
    document.querySelector('.popup-overlay').remove();
    
    // הודעה
    showNotification('יצאת מהמערכת', 'info');
}

// ===== פונקציית משוב פשוטה =====
function sendFeedback() {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    overlay.innerHTML = `
        <div class="popup" style="max-width: 500px;">
            <div class="popup-header">
                <i class="fas fa-comments"></i>
                שלח משוב
            </div>
            
            <div class="popup-content">
                <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">סוג משוב</label>
                    <select id="feedbackType" style="width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px;">
                        <option value="bug">דיווח על באג</option>
                        <option value="feature">בקשה לתכונה חדשה</option>
                        <option value="improvement">הצעה לשיפור</option>
                        <option value="other">אחר</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">המשוב שלך</label>
                    <textarea id="feedbackText" rows="4" placeholder="כתוב כאן את המשוב שלך..." 
                             style="width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; resize: vertical;"></textarea>
                </div>
            </div>
            
            <div class="popup-buttons">
                <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
                    <i class="fas fa-times"></i>
                    ביטול
                </button>
                <button class="popup-btn popup-btn-success" onclick="submitFeedback()">
                    <i class="fas fa-paper-plane"></i>
                    שלח
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

function submitFeedback() {
    const type = document.getElementById('feedbackType').value;
    const text = document.getElementById('feedbackText').value;
    
    if (!text.trim()) {
        alert('אנא כתוב את המשוב שלך');
        return;
    }
    
    console.log('משוב:', { type, text });
    
    // סגור פופאפ
    document.querySelector('.popup-overlay').remove();
    
    // הודעה
    showNotification('המשוב נשלח בהצלחה', 'success');
}

// ===== מערכת הודעות פשוטה =====
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type} show`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <i class="${icons[type]}" style="color: ${colors[type]}; font-size: 18px;"></i>
            <span style="flex: 1; font-weight: 500;">${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: #6b7280; cursor: pointer; padding: 4px;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // הסר אחרי 4 שניות
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
}

function toggleNotifications() {
    // אם הדרופדאון פתוח - סגור אותו ופתח פופ-אפ
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
    }
    
    const content = `
        <div class="popup-header">
            <i class="fas fa-bell"></i>
            מרכז ההתראות
        </div>
        
        <div class="popup-content">
            <div class="popup-section">
                <h4><i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i> התראות דחופות</h4>
                <div class="notifications-list urgent">
                    <div class="notification-item urgent">
                        <div class="notification-icon"><i class="fas fa-clock"></i></div>
                        <div class="notification-content">
                            <strong>משימה באיחור</strong>
                            <p>תיק לקוח ABC - עבר תאריך היעד ב-2 ימים</p>
                            <small>לפני 30 דקות</small>
                        </div>
                    </div>
                    <div class="notification-item critical">
                        <div class="notification-icon"><i class="fas fa-ban"></i></div>
                        <div class="notification-content">
                            <strong>לקוח חסום</strong>
                            <p>לקוח XYZ - נגמרו השעות בתוכנית</p>
                            <small>לפני שעה</small>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="popup-section">
                <h4><i class="fas fa-info-circle" style="color: #3b82f6;"></i> התראות כלליות</h4>
                <div class="notifications-list general">
                    <div class="notification-item">
                        <div class="notification-icon"><i class="fas fa-user-plus"></i></div>
                        <div class="notification-content">
                            <strong>לקוח חדש נוסף</strong>
                            <p>תיק 2025001 - דנה לוי נוצר בהצלחה</p>
                            <small>לפני 3 שעות</small>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="popup-section">
                <div class="stats-summary">
                    <div class="stat-item">
                        <span class="stat-number">3</span>
                        <span class="stat-label">משימות להיום</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">7</span>
                        <span class="stat-label">שעות נרשמו</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">2</span>
                        <span class="stat-label">לקוחות דחופים</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="popup-buttons">
            <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
                <i class="fas fa-times"></i>
                סגור
            </button>
            <button class="popup-btn popup-btn-success" onclick="clearAllNotifications(); this.closest('.popup-overlay').remove()">
                <i class="fas fa-check-double"></i>
                סמן הכל כנקרא
            </button>
        </div>
    `;
    
    popupManager.createPopup('notification', content, 'large');
}

function clearAllNotifications() {
    const content = document.getElementById('notificationsContent');
    if (content) {
        content.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280;">אין התראות</div>';
    }
    
    const count = document.getElementById('notificationCount');
    if (count) {
        count.classList.add('hidden');
    }
}

// ===== פונקציות עזר =====
function resetBudgetForm() {
    document.getElementById('budgetForm').reset();
    const searchResults = document.getElementById('budgetSearchResults');
    if (searchResults) {
        searchResults.classList.remove('show');
    }
}

function resetTimesheetForm() {
    document.getElementById('timesheetForm').reset();
    const searchResults = document.getElementById('timesheetSearchResults');
    if (searchResults) {
        searchResults.classList.remove('show');
    }
    
    // הגדר תאריך נוכחי
    const dateField = document.getElementById('actionDate');
    if (dateField) {
        dateField.value = new Date().toISOString().split('T')[0];
    }
}

function selectClient(formType, clientId, clientName) {
    const searchInput = document.getElementById(`${formType}ClientSearch`);
    const hiddenInput = document.getElementById(`${formType}ClientSelect`);
    const resultsContainer = document.getElementById(`${formType}SearchResults`);
    
    if (searchInput) searchInput.value = clientName;
    if (hiddenInput) hiddenInput.value = clientId;
    if (resultsContainer) resultsContainer.classList.remove('show');
}

// ===== אתחול =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 מערכת נקייה נטענה');
    
    // הגדר תאריך נוכחי בטופס השעתון
    const dateField = document.getElementById('actionDate');
    if (dateField) {
        dateField.value = new Date().toISOString().split('T')[0];
    }
    
    // סגירת פופאפים ותוצאות חיפוש בלחיצה בחוץ
    document.addEventListener('click', function(e) {
        // סגירת תוצאות חיפוש
        if (!e.target.closest('.modern-client-search')) {
            document.querySelectorAll('.search-results').forEach(results => {
                results.classList.remove('show');
            });
        }
        
        // סגירת התראות
        if (!e.target.closest('.notification-bell') && !e.target.closest('.notifications-dropdown')) {
            const dropdown = document.getElementById('notificationsDropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
        }
        
        // סגירת פופאפים בלחיצה על הרקע
        if (e.target.classList.contains('popup-overlay')) {
            e.target.remove();
        }
    });
});

// ===== סוף הקוד הנקי =====


// ===== פונקציות עדכון אינדיקטור חיבור =====

function updateConnectionIndicator(status, message) {
    const indicator = document.getElementById('connectionIndicator');
    const text = document.getElementById('connectionText');
    const dot = indicator.querySelector('.connection-dot');
    
    if (!indicator || !text) return;
    
    text.textContent = message;
    
    // עדכון צבעים לפי סטטוס
    indicator.style.borderColor = getStatusColor(status, 0.2);
    indicator.style.color = getStatusColor(status, 1);
    dot.style.background = getStatusColor(status, 1);
    
    // הוספת אפקט
    indicator.style.transform = 'scale(1.05)';
    setTimeout(() => {
        indicator.style.transform = 'scale(1)';
    }, 200);
}

function getStatusColor(status, opacity) {
    const colors = {
        'connected': `rgba(16, 185, 129, ${opacity})`,
        'disconnected': `rgba(239, 68, 68, ${opacity})`,
        'connecting': `rgba(245, 158, 11, ${opacity})`,
        'error': `rgba(239, 68, 68, ${opacity})`
    };
    return colors[status] || colors.connecting;
}

// ===== עדכון שם המשתמש בסרגל =====
function updateSidebarUser(userName) {
    const userNameElement = document.getElementById('currentUserName');
    const userAvatar = document.querySelector('.user-avatar');
    
    if (userNameElement && userName) {
        userNameElement.textContent = userName;
        console.log('✅ שם משתמש עודכן בסרגל:', userName);
    }
    
    if (userAvatar && userName) {
        // הוספת טיפ עם שם המשתמש
        userAvatar.setAttribute('title', `מחובר: ${userName}`);
        
        // צבע אווטאר לפי שם
        const colors = [
            'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
        ];
        
        const colorIndex = userName.charCodeAt(0) % colors.length;
        userAvatar.style.background = colors[colorIndex];
    }
}

// ===== הדגשת פריט פעיל בסרגל =====
function setActiveNavItem(itemName) {
    // הסרת הדגשה מכל הפריטים
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // הדגשת הפריט הנכון
    let activeItem = null;
    
    if (itemName === 'תקצוב') {
        activeItem = document.querySelector('[onclick*="budget"]');
    } else if (itemName === 'שעתון') {
        activeItem = document.querySelector('[onclick*="timesheet"]');
    }
    
    if (activeItem) {
        activeItem.classList.add('active');
        console.log('✅ פריט הודגש:', itemName);
    }
}

// ===== עדכון הפונקציה showApp הקיימת =====
// הוסף את השורות האלה לתוך הפונקציה showApp במנהג'ר:

/*
// במקום userInfo.innerHTML, הוסף:
updateSidebarUser(this.currentUser);
updateConnectionIndicator('connecting', 'מתחבר לשרת...');

// במקום updateConnectionStatus, הוסף:
updateConnectionIndicator('connected', 'מחובר לגליון');
*/

// ===== עדכון הפונקציה switchTab הקיימת =====
// הוסף בסוף הפונקציה switchTab:

/*
// הוסף את השורה הזאת בסוף הפונקציה:
if (tabName === 'budget') {
    setActiveNavItem('תקצוב');
} else if (tabName === 'timesheet') {
    setActiveNavItem('שעתון');
}
*/

// ===== אתחול הסרגל החדש =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 מאתחל ממשק חדש...');
    
    // הדגש את הטאב הראשון
    setTimeout(() => {
        setActiveNavItem('תקצוב');
        updateConnectionIndicator('connecting', 'מאתחל מערכת...');
    }, 500);
    
    // סימולציה של חיבור מוצלח
    setTimeout(() => {
        updateConnectionIndicator('connected', 'מערכת מוכנה');
    }, 2000);
});

// ===== טיפול במובייל =====
function toggleMobileSidebar() {
    const sidebar = document.getElementById('minimalSidebar');
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
    }
}

// סגירת סרגל במובייל בלחיצה בחוץ
document.addEventListener('click', function(e) {
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('minimalSidebar');
        if (!sidebar.contains(e.target) && !e.target.closest('.menu-btn')) {
            sidebar.classList.remove('open');
        }
    }
});

// ===== טאבים צפים בגלילה =====

let isScrolled = false;
let currentActiveTab = 'budget'; // ברירת מחדל

// זיהוי גלילה
function handleScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const shouldShow = scrollTop > 200; // מופיע אחרי 200px גלילה
    
    const floatingTabs = document.getElementById('floatingTabs');
    if (!floatingTabs) return;
    
    if (shouldShow && !isScrolled) {
        // הצגת הטאבים
        floatingTabs.classList.add('visible');
        isScrolled = true;
        console.log('🔼 טאבים צפים מופיעים');
    } else if (!shouldShow && isScrolled) {
        // הסתרת הטאבים
        floatingTabs.classList.remove('visible');
        isScrolled = false;
        console.log('🔽 טאבים צפים נעלמים');
    }
}

// מעבר בין טאבים
function switchToTab(tabName) {
    console.log('🔄 מעבר לטאב:', tabName);
    
    // עדכון הטאב הפעיל
    currentActiveTab = tabName;
    
    // עדכון הטאבים הרגילים
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // הפעלת הטאב החדש
    if (tabName === 'budget') {
        document.querySelector('[onclick*="budget"]').classList.add('active');
        document.getElementById('budgetTab').classList.add('active');
    } else if (tabName === 'timesheet') {
        document.querySelector('[onclick*="timesheet"]').classList.add('active');
        document.getElementById('timesheetTab').classList.add('active');
    }
    
    // עדכון הטאבים הצפים
    updateFloatingTabs();
    
    // גלילה חלקה לטאב (אופציונלי)
    const targetTab = document.getElementById(tabName + 'Tab');
    if (targetTab) {
        targetTab.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }
}

// עדכון מצב הטאבים הצפים
function updateFloatingTabs() {
    document.querySelectorAll('.floating-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const activeFloatingTab = document.querySelector(`[data-tab="${currentActiveTab}"]`);
    if (activeFloatingTab) {
        activeFloatingTab.classList.add('active');
    }
}

// ===== טפסים מכווצים (אקורדיון) =====

// פתיחה/סגירה של טופס
function toggleForm(formId) {
    const form = document.getElementById(formId);
    const header = form.querySelector('.form-header');
    const content = form.querySelector('.form-content');
    const toggleBtn = form.querySelector('.form-toggle-btn');
    const toggleText = toggleBtn.querySelector('.form-toggle-text');
    const toggleIcon = toggleBtn.querySelector('.form-toggle-icon');
    
    const isExpanded = content.classList.contains('expanded');
    
    if (isExpanded) {
        // כיווץ הטופס
        header.classList.remove('active');
        content.classList.remove('expanded');
        form.classList.remove('active');
        form.classList.add('collapsing');
        
        toggleText.textContent = toggleText.dataset.openText;
        toggleIcon.className = 'form-toggle-icon fas fa-chevron-down';
        
        console.log('📤 טופס מתכווץ:', formId);
        
        // הסרת אפקט אחרי אנימציה
        setTimeout(() => {
            form.classList.remove('collapsing');
        }, 400);
        
    } else {
        // פתיחת הטופס
        header.classList.add('active');
        content.classList.add('expanded');
        form.classList.add('active', 'expanding');
        
        toggleText.textContent = toggleText.dataset.closeText;
        toggleIcon.className = 'form-toggle-icon fas fa-chevron-up';
        
        console.log('📥 טופס מתרחב:', formId);
        
        // הסרת אפקט אחרי אנימציה
        setTimeout(() => {
            form.classList.remove('expanding');
        }, 400);
        
        // סגירת טפסים אחרים (אופציונלי)
        closeOtherForms(formId);
    }
}

// סגירת טפסים אחרים
function closeOtherForms(currentFormId) {
    const allForms = document.querySelectorAll('.collapsible-form');
    allForms.forEach(form => {
        if (form.id !== currentFormId && form.querySelector('.form-content').classList.contains('expanded')) {
            toggleForm(form.id);
        }
    });
}

// ===== אתחול המערכת =====

function initializeFloatingTabsAndAccordion() {
    console.log('🚀 מאתחל טאבים צפים וטפסים מכווצים...');
    
    // הוספת event listener לגלילה
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(handleScroll, 10); // מיטוב ביצועים
    });
    
    // אתחול מצב הטאבים
    updateFloatingTabs();
    
    // בדיקה ראשונית של מצב הגלילה
    handleScroll();
    
    console.log('✅ מערכת מוכנה!');
}

// ===== פונקציות עזר =====

// חזרה למעלה
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// עדכון הפונקציה הקיימת switchTab
const originalSwitchTab = window.switchTab;
window.switchTab = function(tabName) {
    if (originalSwitchTab) {
        originalSwitchTab(tabName);
    }
    
    // עדכון הטאבים הצפים
    currentActiveTab = tabName;
    updateFloatingTabs();
};

// אתחול כשהדף נטען
document.addEventListener('DOMContentLoaded', function() {
    // חכה קצת שהדף יסתדר
    setTimeout(() => {
        initializeFloatingTabsAndAccordion();
    }, 500);
});

// נקה listeners כשיוצאים מהדף (אופטימיזציה)
window.addEventListener('beforeunload', function() {
    window.removeEventListener('scroll', handleScroll);
});


// ===== כפתור פלוס חכם =====
// ===== כפתור פלוס חכם עם אנימציה =====
function openSmartForm() {
    const plusButton = document.getElementById('smartPlusBtn');
    const activeTab = document.querySelector('.tab-button.active');
    
    let currentForm;
    if (activeTab.onclick.toString().includes('budget')) {
        currentForm = document.getElementById('budgetFormContainer');
    } else if (activeTab.onclick.toString().includes('timesheet')) {
        currentForm = document.getElementById('timesheetFormContainer');
    }
    
    // בדיקה אם הטופס כבר פתוח
    if (currentForm.classList.contains('hidden')) {
        // פתח טופס
        currentForm.classList.remove('hidden');
        plusButton.classList.add('active');
        console.log('🎯 פותח טופס');
    } else {
        // סגור טופס
        currentForm.classList.add('hidden');
        plusButton.classList.remove('active');
        console.log('❌ סוגר טופס');
    }
}

function updateUserDisplay(userName) {
    const userDisplay = document.getElementById('currentUserDisplay');
    if (userDisplay && userName) {
        userDisplay.textContent = `${userName} - משרד עו"ד גיא הרשקוביץ`;
    }
}


function updatePlusTooltip(tabName) {
    const tooltip = document.getElementById('plusTooltip');
    
    if (tooltip) {
        if (tabName === 'budget') {
            tooltip.textContent = 'הוספת משימה לתקצוב';
        } else if (tabName === 'timesheet') {
            tooltip.textContent = 'הוסף רישום שעתון';
        }
    }
}


document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        updatePlusTooltip('budget'); // התחל עם טאב התקצוב
    }, 500);
});


// הוסף לסוף הקובץ JS - פונקציה לבדיקה
function checkResponsiveSystem() {
    console.log('🔍 בדיקת מערכת רספונסיבית:');
    console.log('📊 מידע מסך:', responsiveManager.getScreenInfo());
    console.log('🛠️ תמיכה בתכונות:', responsiveManager.checkFeatureSupport());
}

// אפשר להפעיל בקונסול
window.checkResponsive = checkResponsiveSystem;


// הוסף לסוף הקובץ JS - סימולציה של התראות
function addDemoNotifications() {
    setTimeout(() => {
        notificationBell.addNotification('urgent', 'משימה דחופה', 'תאריך יעד מתקרב למשימת לקוח ABC', true);
        notificationBell.addNotification('critical', '3 לקוחות קריטיים', 'לקוחות עם מעט שעות נותרות', false);
        notificationBell.addNotification('blocked', 'לקוח חסום', 'לקוח XYZ נגמרו השעות', true);
    }, 3000);
}

// הפעל את הדמו
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(addDemoNotifications, 2000);
});




