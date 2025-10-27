/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KNOWLEDGE BASE ANALYTICS - מערכת אנליטיקס
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description מערכת מעקב אחר שימוש במרכז העזרה
 * @version 1.0.0
 * @features:
 *   - מעקב אחר פתיחת/סגירת KB
 *   - מעקב אחר חיפושים (מוצלחים ולא)
 *   - מעקב אחר צפייה במאמרים וזמן קריאה
 *   - מעקב אחר feedback משתמשים
 *   - שמירת נתונים ב-Firestore
 *
 */

'use strict';

class KBAnalytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.currentArticleStartTime = null;
        this.openTime = null;
        this.enabled = true; // אפשר לכבות בדיבאג

        console.log('📊 KB Analytics initialized - Session:', this.sessionId);
    }

    /**
     * יצירת Session ID ייחודי
     */
    generateSessionId() {
        return `kb_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * בדיקה אם Firebase זמין
     */
    isFirebaseReady() {
        return typeof firebase !== 'undefined' &&
               firebase.firestore &&
               firebase.auth;
    }

    /**
     * שליחת אירוע ל-Firestore
     */
    async trackEvent(eventName, metadata = {}, metrics = {}) {
        if (!this.enabled) {
            console.log('📊 Analytics disabled - skipping:', eventName);
            return;
        }

        if (!this.isFirebaseReady()) {
            console.warn('⚠️ Firebase not ready - Analytics event not tracked:', eventName);
            return;
        }

        try {
            const user = firebase.auth().currentUser;

            const eventData = {
                event: eventName,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: user ? user.uid : 'anonymous',
                userEmail: user ? user.email : null,
                sessionId: this.sessionId,

                metadata: {
                    ...metadata,
                    userAgent: navigator.userAgent,
                    screenWidth: window.screen.width,
                    screenHeight: window.screen.height,
                    language: navigator.language || 'he',
                    referrer: document.referrer || 'direct',
                    url: window.location.href
                },

                metrics: metrics
            };

            // שמירה ל-Firestore
            await firebase.firestore()
                .collection('kb_analytics')
                .add(eventData);

            console.log('📊 Analytics tracked:', eventName, metadata);

        } catch (error) {
            console.error('❌ Analytics error:', error);
            // לא נזרוק שגיאה - Analytics לא צריך לשבור את האפליקציה
        }
    }

    /**
     * מעקב אחר פתיחת KB
     */
    trackKBOpened(source = 'unknown') {
        this.openTime = Date.now();
        this.trackEvent('kb_opened', {
            source: source // 'button', 'virtual-assistant', 'keyboard-shortcut', etc.
        });
    }

    /**
     * מעקב אחר סגירת KB
     */
    trackKBClosed() {
        if (!this.openTime) return;

        const totalTimeSpent = Math.floor((Date.now() - this.openTime) / 1000);

        this.trackEvent('kb_closed', {}, {
            totalTimeSpent: totalTimeSpent // שניות
        });

        this.openTime = null;
    }

    /**
     * מעקב אחר חיפוש
     */
    trackSearch(query, resultsCount) {
        const hasResults = resultsCount > 0;

        this.trackEvent(
            hasResults ? 'search_performed' : 'search_no_results',
            {
                query: query.toLowerCase().trim(),
                resultsCount: resultsCount
            }
        );
    }

    /**
     * מעקב אחר פתיחת קטגוריה
     */
    trackCategoryExpanded(categoryId, categoryName) {
        this.trackEvent('category_expanded', {
            categoryId: categoryId,
            categoryName: categoryName
        });
    }

    /**
     * מעקב אחר כיווץ קטגוריה
     */
    trackCategoryCollapsed(categoryId, categoryName) {
        this.trackEvent('category_collapsed', {
            categoryId: categoryId,
            categoryName: categoryName
        });
    }

    /**
     * מעקב אחר פתיחת מאמר
     */
    trackArticleOpened(article, fromSearch = false, searchQuery = null) {
        this.currentArticleStartTime = Date.now();

        this.trackEvent('article_opened', {
            articleId: article.id,
            articleTitle: article.title,
            categoryId: article.category,
            fromSearch: fromSearch,
            searchQuery: searchQuery
        });
    }

    /**
     * מעקב אחר סגירת מאמר (כמה זמן קראו)
     */
    trackArticleClosed(article) {
        if (!this.currentArticleStartTime) return;

        const timeSpent = Math.floor((Date.now() - this.currentArticleStartTime) / 1000);

        this.trackEvent('article_read_time', {
            articleId: article.id,
            articleTitle: article.title,
            categoryId: article.category
        }, {
            timeSpent: timeSpent
        });

        this.currentArticleStartTime = null;
    }

    /**
     * מעקב אחר feedback על מאמר
     */
    trackArticleFeedback(article, isHelpful, comment = null) {
        this.trackEvent(
            isHelpful ? 'article_helpful' : 'article_not_helpful',
            {
                articleId: article.id,
                articleTitle: article.title,
                categoryId: article.category,
                comment: comment
            }
        );
    }

    /**
     * מעקב אחר לחיצה על כפתור פעולה
     */
    trackActionButton(article, buttonText, action) {
        this.trackEvent('action_button_clicked', {
            articleId: article.id,
            articleTitle: article.title,
            buttonText: buttonText,
            action: action
        });
    }

    /**
     * מעקב אחר מאמרים קשורים
     */
    trackRelatedArticleClick(fromArticle, toArticle) {
        this.trackEvent('related_article_clicked', {
            fromArticleId: fromArticle.id,
            fromArticleTitle: fromArticle.title,
            toArticleId: toArticle.id,
            toArticleTitle: toArticle.title
        });
    }

    /**
     * מעקב אחר לחיצה על "חזרה"
     */
    trackBackButton(fromArticle) {
        this.trackEvent('back_button_clicked', {
            articleId: fromArticle.id,
            articleTitle: fromArticle.title
        });
    }

    /**
     * פונקציות עזר לדוחות
     */

    /**
     * קבלת המאמרים הפופולריים ביותר
     */
    static async getTopArticles(limit = 10, days = 30) {
        if (typeof firebase === 'undefined') return [];

        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const snapshot = await firebase.firestore()
                .collection('kb_analytics')
                .where('event', '==', 'article_opened')
                .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(startDate))
                .get();

            const articleCounts = {};
            const articleTitles = {};

            snapshot.forEach(doc => {
                const data = doc.data();
                const articleId = data.metadata.articleId;
                const articleTitle = data.metadata.articleTitle;

                articleCounts[articleId] = (articleCounts[articleId] || 0) + 1;
                articleTitles[articleId] = articleTitle;
            });

            return Object.entries(articleCounts)
                .map(([id, count]) => ({
                    articleId: id,
                    title: articleTitles[id],
                    views: count
                }))
                .sort((a, b) => b.views - a.views)
                .slice(0, limit);

        } catch (error) {
            console.error('Error fetching top articles:', error);
            return [];
        }
    }

    /**
     * קבלת חיפושים ללא תוצאות (כדי לדעת איזה תוכן חסר)
     */
    static async getFailedSearches(limit = 50, days = 30) {
        if (typeof firebase === 'undefined') return [];

        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const snapshot = await firebase.firestore()
                .collection('kb_analytics')
                .where('event', '==', 'search_no_results')
                .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(startDate))
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            const queries = {};

            snapshot.forEach(doc => {
                const data = doc.data();
                const query = data.metadata.query;
                queries[query] = (queries[query] || 0) + 1;
            });

            return Object.entries(queries)
                .map(([query, count]) => ({
                    query: query,
                    count: count
                }))
                .sort((a, b) => b.count - a.count);

        } catch (error) {
            console.error('Error fetching failed searches:', error);
            return [];
        }
    }

    /**
     * קבלת סטטיסטיקות כלליות
     */
    static async getGeneralStats(days = 30) {
        if (typeof firebase === 'undefined') return null;

        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const snapshot = await firebase.firestore()
                .collection('kb_analytics')
                .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(startDate))
                .get();

            const stats = {
                totalEvents: 0,
                kbOpens: 0,
                searches: 0,
                articlesViewed: 0,
                helpfulVotes: 0,
                notHelpfulVotes: 0,
                avgSessionTime: 0,
                uniqueUsers: new Set()
            };

            let totalSessionTime = 0;
            let sessionCount = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                stats.totalEvents++;

                if (data.userId) {
                    stats.uniqueUsers.add(data.userId);
                }

                switch (data.event) {
                    case 'kb_opened':
                        stats.kbOpens++;
                        break;
                    case 'search_performed':
                    case 'search_no_results':
                        stats.searches++;
                        break;
                    case 'article_opened':
                        stats.articlesViewed++;
                        break;
                    case 'article_helpful':
                        stats.helpfulVotes++;
                        break;
                    case 'article_not_helpful':
                        stats.notHelpfulVotes++;
                        break;
                    case 'kb_closed':
                        if (data.metrics && data.metrics.totalTimeSpent) {
                            totalSessionTime += data.metrics.totalTimeSpent;
                            sessionCount++;
                        }
                        break;
                }
            });

            stats.uniqueUsers = stats.uniqueUsers.size;
            stats.avgSessionTime = sessionCount > 0 ? Math.floor(totalSessionTime / sessionCount) : 0;

            return stats;

        } catch (error) {
            console.error('Error fetching general stats:', error);
            return null;
        }
    }

    /**
     * הפעלה/כיבוי של Analytics
     */
    enable() {
        this.enabled = true;
        console.log('📊 KB Analytics enabled');
    }

    disable() {
        this.enabled = false;
        console.log('📊 KB Analytics disabled');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-INITIALIZE - יצירת instance גלובלי
// ═══════════════════════════════════════════════════════════════════════════

const kbAnalytics = new KBAnalytics();

// חשוף גלובלית
if (typeof window !== 'undefined') {
    window.kbAnalytics = kbAnalytics;
    window.KBAnalytics = KBAnalytics; // גם את ה-class עצמו לפונקציות סטטיות
}
