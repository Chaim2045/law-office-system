/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KNOWLEDGE BASE SEARCH ENGINE - מנוע חיפוש חכם
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description מנוע חיפוש מהיר ופשוט למאמרי KB
 * @version 1.0.0
 * @for Users age 40-60 - Fast and accurate search
 *
 */

'use strict';

class KBSearch {
    constructor(articles) {
        this.articles = articles || [];
        this.lastQuery = '';
        this.lastResults = [];
    }

    /**
     * חיפוש מאמרים לפי מחרוזת
     * @param {string} query - מחרוזת החיפוש
     * @returns {Array} מערך של מאמרים תואמים, ממוינים לפי רלוונטיות
     */
    search(query) {
        // אם אין מה לחפש - החזר הכל
        if (!query || query.trim() === '') {
            return this.articles;
        }

        const normalizedQuery = this.normalizeString(query);
        const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 1);

        // אם אין מילים תקינות - החזר הכל
        if (queryWords.length === 0) {
            return this.articles;
        }

        // חיפוש ודירוג
        const results = this.articles
            .map(article => ({
                article,
                score: this.calculateRelevanceScore(article, normalizedQuery, queryWords)
            }))
            .filter(result => result.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(result => result.article);

        this.lastQuery = query;
        this.lastResults = results;

        return results;
    }

    /**
     * חישוב ציון רלוונטיות למאמר
     */
    calculateRelevanceScore(article, query, queryWords) {
        let score = 0;

        // 1. התאמה מדויקת בכותרת (ציון גבוה מאוד)
        const normalizedTitle = this.normalizeString(article.title);
        if (normalizedTitle.includes(query)) {
            score += 100;
        }

        // 2. התאמת מילים בכותרת
        queryWords.forEach(word => {
            if (normalizedTitle.includes(word)) {
                score += 50;
            }
        });

        // 3. התאמה מדויקת בתקציר
        if (article.summary) {
            const normalizedSummary = this.normalizeString(article.summary);
            if (normalizedSummary.includes(query)) {
                score += 30;
            }

            queryWords.forEach(word => {
                if (normalizedSummary.includes(word)) {
                    score += 15;
                }
            });
        }

        // 4. התאמה במילות מפתח
        if (article.keywords && article.keywords.length > 0) {
            article.keywords.forEach(keyword => {
                const normalizedKeyword = this.normalizeString(keyword);
                if (normalizedKeyword.includes(query)) {
                    score += 40;
                }
                queryWords.forEach(word => {
                    if (normalizedKeyword.includes(word)) {
                        score += 20;
                    }
                });
            });
        }

        // 5. התאמה בתוכן (ציון נמוך יותר)
        if (article.content) {
            const contentText = this.extractContentText(article.content);
            const normalizedContent = this.normalizeString(contentText);

            if (normalizedContent.includes(query)) {
                score += 10;
            }

            queryWords.forEach(word => {
                if (normalizedContent.includes(word)) {
                    score += 5;
                }
            });
        }

        return score;
    }

    /**
     * חילוץ טקסט מתוך אובייקט התוכן
     */
    extractContentText(content) {
        let text = '';

        if (content.intro) {
text += ' ' + content.intro;
}
        if (content.important) {
text += ' ' + content.important;
}

        if (content.steps && Array.isArray(content.steps)) {
            content.steps.forEach(step => {
                if (step.title) {
text += ' ' + step.title;
}
                if (step.text) {
text += ' ' + step.text;
}
                if (step.description) {
text += ' ' + step.description;
}
            });
        }

        if (content.sections && Array.isArray(content.sections)) {
            content.sections.forEach(section => {
                if (section.title) {
text += ' ' + section.title;
}
                if (section.text) {
text += ' ' + section.text;
}
            });
        }

        if (content.tips && Array.isArray(content.tips)) {
            content.tips.forEach(tip => {
                text += ' ' + tip;
            });
        }

        return text;
    }

    /**
     * נורמליזציה של מחרוזת לחיפוש
     */
    normalizeString(str) {
        if (!str) {
return '';
}

        return str
            .toLowerCase()
            .trim()
            // הסרת סימני פיסוק
            .replace(/[^\u0590-\u05FF\w\s]/g, ' ')
            // הסרת רווחים מרובים
            .replace(/\s+/g, ' ');
    }

    /**
     * סינון מאמרים לפי קטגוריה
     */
    filterByCategory(categoryId) {
        if (!categoryId || categoryId === 'all') {
            return this.articles;
        }

        return this.articles.filter(article => article.category === categoryId);
    }

    /**
     * קבלת מאמרים קשורים
     */
    getRelatedArticles(articleId, limit = 3) {
        const currentArticle = this.articles.find(a => a.id === articleId);
        if (!currentArticle) {
return [];
}

        // אם יש relatedArticles מוגדר - השתמש בו
        if (currentArticle.content && currentArticle.content.relatedArticles) {
            const relatedIds = currentArticle.content.relatedArticles.slice(0, limit);
            return relatedIds
                .map(id => this.articles.find(a => a.id === id))
                .filter(a => a !== undefined);
        }

        // אחרת - מצא מאמרים דומים מאותה קטגוריה
        return this.articles
            .filter(a =>
                a.id !== articleId &&
                a.category === currentArticle.category
            )
            .slice(0, limit);
    }

    /**
     * מאמרים פופולריים (לפי סדר בקובץ)
     */
    getPopularArticles(limit = 5) {
        return this.articles.slice(0, limit);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
    module.exports = KBSearch;
}
