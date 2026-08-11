/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KNOWLEDGE BASE - מרכז עזרה וידע
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description מרכז עזרה מקצועי עם FAQ ומאמרי הדרכה
 * @version 1.0.0
 * @for Users age 40-60 - Simple, Clear, Direct
 *
 */

'use strict';

class KnowledgeBase {
    constructor() {
        this.isOpen = false;
        this.currentView = 'home'; // 'home' או 'article'
        this.currentArticle = null;
        this.currentCategory = null;
        this.expandedCategories = new Set();

        // אתחול נתונים
        this.categories = KB_CATEGORIES;
        this.articles = KB_ARTICLES;
        this.searchEngine = new KBSearch(this.articles);

        // יצירת DOM Elements
        this.container = null;

        this.init();
    }

    init() {
        Logger.log('🎓 Knowledge Base initialized');

        // האזנה לקיצורי מקלדת
        document.addEventListener('keydown', (e) => {
            // Escape = סגירה
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // יצירת כפתור "עזרה" גלובלי (אם לא קיים)
        this.createHelpButton();
    }

    /**
     * יצירת כפתור עזרה גלובלי
     * NOTE: לא יוצר כפתור צף - רק מתחבר לכפתור "עזרה" הקיים
     * ה-KB ייפתח גם דרך הצ'אט בוט (כפתור "הרחב")
     */
    createHelpButton() {
        // התחברות לכפתור "עזרה" בפוטר (אם קיים)
        const existingHelpBtn = document.querySelector('[data-help-trigger]');
        if (existingHelpBtn) {
            existingHelpBtn.addEventListener('click', () => this.open());
            Logger.log('✅ Help button found and connected');
        }

        // לא יוצר כפתור צף - KB נגיש דרך הצ'אט בוט
        Logger.log('✅ KB available via Virtual Assistant');
    }

    /**
     * פתיחת מרכז העזרה
     */
    open(source = 'button') {
        if (this.isOpen) {
return;
}

        this.isOpen = true;
        this.currentView = 'home';
        this.currentArticle = null;

        // מניעת scroll של הגוף כשהמודל פתוח
        document.body.style.overflow = 'hidden';

        this.render();

        // Analytics - מעקב אחר פתיחה
        if (typeof kbAnalytics !== 'undefined') {
            kbAnalytics.trackKBOpened(source);
        }

        Logger.log('📖 Knowledge Base opened');
    }

    /**
     * סגירת מרכז העזרה
     */
    close() {
        if (!this.isOpen) {
return;
}

        this.isOpen = false;

        // השבת scroll של הגוף
        document.body.style.overflow = '';

        // Analytics - מעקב אחר סגירה
        if (typeof kbAnalytics !== 'undefined') {
            // סגירת מאמר אם פתוח
            if (this.currentArticle) {
                kbAnalytics.trackArticleClosed(this.currentArticle);
            }
            kbAnalytics.trackKBClosed();
        }

        if (this.container) {
            this.container.style.animation = 'kbFadeOut 0.2s ease';
            setTimeout(() => {
                if (this.container && this.container.parentNode) {
                    this.container.parentNode.removeChild(this.container);
                }
                this.container = null;
            }, 200);
        }

        Logger.log('📕 Knowledge Base closed');
    }

    /**
     * רנדור ראשי
     */
    render() {
        // הסרת container קיים
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        // יצירת container חדש
        this.container = document.createElement('div');
        this.container.className = 'kb-container';

        // סגירה בלחיצה על הרקע
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) {
                this.close();
            }
        });

        // יצירת modal
        const modal = document.createElement('div');
        modal.className = 'kb-modal';

        // Header
        modal.appendChild(this.createHeader());

        // Search (רק בדף הבית)
        if (this.currentView === 'home') {
            modal.appendChild(this.createSearch());
        }

        // Content
        modal.appendChild(this.createContent());

        this.container.appendChild(modal);
        document.body.appendChild(this.container);

        // לא עושים focus אוטומטי כדי למנוע קפיצות
        // המשתמש יכול ללחוץ על שדה החיפוש בעצמו
    }

    /**
     * יצירת Header
     */
    createHeader() {
        const header = document.createElement('div');
        header.className = 'kb-header';

        const title = document.createElement('h2');
        title.className = 'kb-header-title';
        title.innerHTML = `
            <span class="kb-header-icon">${getKBIcon('help')}</span>
            מרכז עזרה וידע
        `;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'kb-close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.setAttribute('aria-label', 'סגור');
        closeBtn.addEventListener('click', () => this.close());

        header.appendChild(title);
        header.appendChild(closeBtn);

        return header;
    }

    /**
     * יצירת שורת חיפוש
     */
    createSearch() {
        const container = document.createElement('div');
        container.className = 'kb-search-container';

        const searchBox = document.createElement('div');
        searchBox.className = 'kb-search-box';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'kb-search-input';
        input.placeholder = 'חפש שאלות, מאמרים, או נושאים...';
        input.addEventListener('input', (e) => this.handleSearch(e.target.value));

        const icon = document.createElement('span');
        icon.className = 'kb-search-icon';
        icon.innerHTML = getKBIcon('search');

        searchBox.appendChild(input);
        searchBox.appendChild(icon);
        container.appendChild(searchBox);

        return container;
    }

    /**
     * טיפול בחיפוש
     */
    handleSearch(query) {
        const trimmedQuery = query.trim();

        // עדכון תוצאות חיפוש
        const content = this.container.querySelector('.kb-content');
        if (!content) {
return;
}

        if (trimmedQuery === '') {
            // אם אין חיפוש - הצג את כל הקטגוריות
            content.innerHTML = '';
            content.appendChild(this.createCategoriesView());
        } else {
            // הצג תוצאות חיפוש
            const results = this.searchEngine.search(trimmedQuery);

            // Analytics - מעקב אחר חיפוש
            if (typeof kbAnalytics !== 'undefined') {
                kbAnalytics.trackSearch(trimmedQuery, results.length);
            }

            content.innerHTML = '';
            content.appendChild(this.createSearchResults(results, trimmedQuery));
        }
    }

    /**
     * יצירת תוכן
     */
    createContent() {
        const content = document.createElement('div');
        content.className = 'kb-content';

        if (this.currentView === 'home') {
            content.appendChild(this.createCategoriesView());
        } else if (this.currentView === 'article') {
            content.appendChild(this.createArticleView());
        }

        return content;
    }

    /**
     * תצוגת קטגוריות
     */
    createCategoriesView() {
        const container = document.createElement('div');
        container.className = 'kb-categories';

        // מיון קטגוריות לפי order
        const sortedCategories = Object.values(this.categories)
            .sort((a, b) => a.order - b.order);

        sortedCategories.forEach(category => {
            const categoryElement = this.createCategory(category);
            container.appendChild(categoryElement);
        });

        return container;
    }

    /**
     * יצירת קטגוריה
     */
    createCategory(category) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'kb-category';

        // בדיקה אם הקטגוריה פתוחה
        const isExpanded = this.expandedCategories.has(category.id);
        if (isExpanded) {
            categoryDiv.classList.add('expanded');
        }

        // כותרת קטגוריה
        const header = document.createElement('div');
        header.className = 'kb-category-header';

        const headerLeft = document.createElement('div');
        headerLeft.className = 'kb-category-header-left';

        const icon = document.createElement('span');
        icon.className = 'kb-category-icon';
        icon.innerHTML = getKBIcon(category.icon);

        const titleContainer = document.createElement('div');

        const title = document.createElement('h3');
        title.className = 'kb-category-title';
        title.textContent = category.name;

        const articlesInCategory = this.articles.filter(a => a.category === category.id);
        const count = document.createElement('span');
        count.className = 'kb-category-count';
        count.textContent = ` (${articlesInCategory.length} מאמרים)`;

        title.appendChild(count);
        titleContainer.appendChild(title);

        headerLeft.appendChild(icon);
        headerLeft.appendChild(titleContainer);

        const toggle = document.createElement('span');
        toggle.className = 'kb-category-toggle';
        toggle.textContent = '◀';

        header.appendChild(headerLeft);
        header.appendChild(toggle);

        // לחיצה על כותרת = הרחבה/כיווץ
        header.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (this.expandedCategories.has(category.id)) {
                this.expandedCategories.delete(category.id);
                categoryDiv.classList.remove('expanded');

                // Analytics - מעקב אחר כיווץ
                if (typeof kbAnalytics !== 'undefined') {
                    kbAnalytics.trackCategoryCollapsed(category.id, category.name);
                }
            } else {
                this.expandedCategories.add(category.id);
                categoryDiv.classList.add('expanded');

                // Analytics - מעקב אחר הרחבה
                if (typeof kbAnalytics !== 'undefined') {
                    kbAnalytics.trackCategoryExpanded(category.id, category.name);
                }
            }
        });

        // רשימת מאמרים
        const articlesContainer = document.createElement('div');
        articlesContainer.className = 'kb-category-articles';

        articlesInCategory.forEach(article => {
            const articleElement = this.createArticleListItem(article);
            articlesContainer.appendChild(articleElement);
        });

        categoryDiv.appendChild(header);
        categoryDiv.appendChild(articlesContainer);

        return categoryDiv;
    }

    /**
     * יצירת פריט מאמר ברשימה
     */
    createArticleListItem(article, fromSearch = false, searchQuery = null) {
        const item = document.createElement('div');
        item.className = 'kb-article-item';

        const icon = document.createElement('span');
        icon.className = 'kb-article-icon';
        icon.innerHTML = getKBIcon(article.icon || 'file');

        const textContainer = document.createElement('div');
        textContainer.className = 'kb-article-text';

        const title = document.createElement('h4');
        title.className = 'kb-article-title';
        title.textContent = article.title;

        const summary = document.createElement('p');
        summary.className = 'kb-article-summary';
        summary.textContent = article.summary;

        textContainer.appendChild(title);
        textContainer.appendChild(summary);

        const arrow = document.createElement('span');
        arrow.className = 'kb-article-arrow';
        arrow.textContent = '←';

        item.appendChild(icon);
        item.appendChild(textContainer);
        item.appendChild(arrow);

        // לחיצה על מאמר = פתיחה
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openArticle(article.id, fromSearch, searchQuery);
        });

        return item;
    }

    /**
     * תוצאות חיפוש
     */
    createSearchResults(results, query) {
        const container = document.createElement('div');
        container.className = 'kb-search-results';

        if (results.length === 0) {
            // אין תוצאות
            const empty = document.createElement('div');
            empty.className = 'kb-empty';
            empty.innerHTML = `
                <div class="kb-empty-icon">${getKBIcon('search')}</div>
                <h3 class="kb-empty-title">לא נמצאו תוצאות</h3>
                <p class="kb-empty-text">נסה לחפש במילים אחרות או עיין בקטגוריות</p>
            `;
            container.appendChild(empty);
        } else {
            // יש תוצאות
            const title = document.createElement('h3');
            title.style.cssText = 'font-size: 18px; color: #6b7280; margin: 0 0 16px; font-weight: 600;';
            title.textContent = `נמצאו ${results.length} תוצאות עבור "${query}"`;
            container.appendChild(title);

            results.forEach(article => {
                const articleElement = this.createArticleListItem(article, true, query);
                container.appendChild(articleElement);
            });
        }

        return container;
    }

    /**
     * פתיחת מאמר
     */
    openArticle(articleId, fromSearch = false, searchQuery = null) {
        const article = this.articles.find(a => a.id === articleId);
        if (!article) {
            console.warn('Article not found:', articleId);
            return;
        }

        // Analytics - סגירת מאמר קודם אם יש
        if (this.currentArticle && typeof kbAnalytics !== 'undefined') {
            kbAnalytics.trackArticleClosed(this.currentArticle);
        }

        this.currentView = 'article';
        this.currentArticle = article;

        // Analytics - פתיחת מאמר
        if (typeof kbAnalytics !== 'undefined') {
            kbAnalytics.trackArticleOpened(article, fromSearch, searchQuery);
        }

        this.render();

        Logger.log('📄 Article opened:', article.title);
    }

    /**
     * תצוגת מאמר
     */
    createArticleView() {
        if (!this.currentArticle) {
return document.createElement('div');
}

        const article = this.currentArticle;
        const container = document.createElement('div');
        container.className = 'kb-article-view';

        // כפתור חזרה
        const backBtn = document.createElement('button');
        backBtn.className = 'kb-article-back';
        backBtn.innerHTML = '← חזרה לרשימה';
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Analytics - מעקב אחר כפתור חזרה
            if (typeof kbAnalytics !== 'undefined') {
                kbAnalytics.trackBackButton(article);
                kbAnalytics.trackArticleClosed(article);
            }

            this.currentView = 'home';
            this.currentArticle = null;
            this.render();
        });
        container.appendChild(backBtn);

        // כותרת מאמר
        const header = document.createElement('div');
        header.className = 'kb-article-header';

        const headerIcon = document.createElement('div');
        headerIcon.className = 'kb-article-header-icon';
        headerIcon.innerHTML = getKBIcon(article.icon || 'file');

        const headerTitle = document.createElement('h2');
        headerTitle.className = 'kb-article-header-title';
        headerTitle.textContent = article.title;

        const headerSummary = document.createElement('p');
        headerSummary.className = 'kb-article-header-summary';
        headerSummary.textContent = article.summary;

        header.appendChild(headerIcon);
        header.appendChild(headerTitle);
        header.appendChild(headerSummary);
        container.appendChild(header);

        // תוכן מאמר
        const content = document.createElement('div');
        content.className = 'kb-article-content';

        if (article.content) {
            // Intro
            if (article.content.intro) {
                const intro = document.createElement('div');
                intro.className = 'kb-article-intro';
                intro.textContent = article.content.intro;
                content.appendChild(intro);
            }

            // Important notice
            if (article.content.important) {
                const important = document.createElement('div');
                important.className = 'kb-article-important';
                important.textContent = article.content.important;
                content.appendChild(important);
            }

            // Steps
            if (article.content.steps && article.content.steps.length > 0) {
                const stepsContainer = document.createElement('div');
                stepsContainer.className = 'kb-steps';

                article.content.steps.forEach(step => {
                    const stepDiv = document.createElement('div');
                    stepDiv.className = 'kb-step';

                    const number = document.createElement('div');
                    number.className = 'kb-step-number';
                    number.textContent = step.number;

                    const stepContent = document.createElement('div');
                    stepContent.className = 'kb-step-content';

                    const title = document.createElement('h4');
                    title.className = 'kb-step-title';
                    title.textContent = step.title;

                    const text = document.createElement('p');
                    text.className = 'kb-step-text';
                    text.textContent = step.text;

                    stepContent.appendChild(title);
                    stepContent.appendChild(text);

                    stepDiv.appendChild(number);
                    stepDiv.appendChild(stepContent);

                    stepsContainer.appendChild(stepDiv);
                });

                content.appendChild(stepsContainer);
            }

            // Sections
            if (article.content.sections && article.content.sections.length > 0) {
                article.content.sections.forEach(section => {
                    const sectionDiv = document.createElement('div');
                    sectionDiv.className = 'kb-article-section';

                    const title = document.createElement('h3');
                    title.className = 'kb-article-section-title';
                    title.textContent = section.title;

                    const text = document.createElement('p');
                    text.className = 'kb-article-section-text';
                    text.textContent = section.text;

                    sectionDiv.appendChild(title);
                    sectionDiv.appendChild(text);

                    content.appendChild(sectionDiv);
                });
            }

            // Action Button
            // PR-SEC-A2-frontend: an admin-only action (requiresAdmin — e.g. create-case, backend-gated
            // by #537) renders ONLY for a Firestore-role admin (window.manager.currentEmployee.role — the
            // same authoritative source the sidebar's _isAdminNow() and the backend use), fail-closed.
            // Without this a non-admin could open the case-creation dialog from the KB and hit a raw
            // permission error — the exact dead-end this PR closes.
            if (article.content.actionButton
                && (!article.content.actionButton.requiresAdmin
                    || (window.manager && window.manager.currentEmployee
                        && window.manager.currentEmployee.role === 'admin'))) {
                const btn = document.createElement('button');
                btn.className = 'kb-action-button';
                btn.textContent = article.content.actionButton.text;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Analytics - מעקב אחר לחיצה על אקשן
                    if (typeof kbAnalytics !== 'undefined') {
                        kbAnalytics.trackActionButton(
                            article,
                            article.content.actionButton.text,
                            article.content.actionButton.action
                        );
                    }

                    try {
                        eval(article.content.actionButton.action);
                        this.close();
                    } catch (error) {
                        console.error('Action button error:', error);
                    }
                });
                content.appendChild(btn);
            }

            // Tips
            if (article.content.tips && article.content.tips.length > 0) {
                const tipsContainer = document.createElement('div');
                tipsContainer.className = 'kb-tips';

                article.content.tips.forEach(tip => {
                    const tipDiv = document.createElement('div');
                    tipDiv.className = 'kb-tip';
                    tipDiv.textContent = tip;
                    tipsContainer.appendChild(tipDiv);
                });

                content.appendChild(tipsContainer);
            }

            // Related Articles
            if (article.content.relatedArticles && article.content.relatedArticles.length > 0) {
                const relatedArticles = this.searchEngine.getRelatedArticles(article.id, 3);

                if (relatedArticles.length > 0) {
                    const relatedContainer = document.createElement('div');
                    relatedContainer.className = 'kb-related';

                    const relatedTitle = document.createElement('h3');
                    relatedTitle.className = 'kb-related-title';
                    relatedTitle.textContent = '❓ שאלות קשורות';

                    const relatedList = document.createElement('div');
                    relatedList.className = 'kb-related-list';

                    relatedArticles.forEach(related => {
                        const relatedItem = document.createElement('div');
                        relatedItem.className = 'kb-related-item';
                        relatedItem.innerHTML = `▸ ${related.title}`;
                        relatedItem.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            // Analytics - מעקב אחר מאמר קשור
                            if (typeof kbAnalytics !== 'undefined') {
                                kbAnalytics.trackRelatedArticleClick(article, related);
                            }

                            this.openArticle(related.id);
                        });
                        relatedList.appendChild(relatedItem);
                    });

                    relatedContainer.appendChild(relatedTitle);
                    relatedContainer.appendChild(relatedList);
                    content.appendChild(relatedContainer);
                }
            }
        }

        // Feedback Section - האם המאמר עזר?
        const feedbackSection = document.createElement('div');
        feedbackSection.className = 'kb-feedback';

        const feedbackTitle = document.createElement('h4');
        feedbackTitle.className = 'kb-feedback-title';
        feedbackTitle.textContent = 'האם מדריך זה עזר לך?';

        const feedbackButtons = document.createElement('div');
        feedbackButtons.className = 'kb-feedback-buttons';

        const yesBtn = document.createElement('button');
        yesBtn.className = 'kb-feedback-btn kb-feedback-yes';
        yesBtn.innerHTML = `${getKBIcon('check')} כן, עזר לי`;
        yesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Analytics - feedback חיובי
            if (typeof kbAnalytics !== 'undefined') {
                kbAnalytics.trackArticleFeedback(article, true);
            }

            feedbackButtons.style.display = 'none';
            feedbackThanks.style.display = 'block';
        });

        const noBtn = document.createElement('button');
        noBtn.className = 'kb-feedback-btn kb-feedback-no';
        noBtn.innerHTML = `${getKBIcon('info')} לא ממש`;
        noBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Analytics - feedback שלילי
            if (typeof kbAnalytics !== 'undefined') {
                kbAnalytics.trackArticleFeedback(article, false);
            }

            feedbackButtons.style.display = 'none';
            feedbackThanks.style.display = 'block';
        });

        feedbackButtons.appendChild(yesBtn);
        feedbackButtons.appendChild(noBtn);

        const feedbackThanks = document.createElement('div');
        feedbackThanks.className = 'kb-feedback-thanks';
        feedbackThanks.style.display = 'none';
        feedbackThanks.innerHTML = `${getKBIcon('check')} תודה על המשוב! זה עוזר לנו לשפר את המערכת 💚`;

        feedbackSection.appendChild(feedbackTitle);
        feedbackSection.appendChild(feedbackButtons);
        feedbackSection.appendChild(feedbackThanks);

        content.appendChild(feedbackSection);

        container.appendChild(content);
        return container;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-INITIALIZE - אתחול אוטומטי
// ═══════════════════════════════════════════════════════════════════════════

let knowledgeBase;

// המתן לטעינת הדף
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        knowledgeBase = new KnowledgeBase();
        window.knowledgeBase = knowledgeBase; // חשוף גלובלית
    });
} else {
    knowledgeBase = new KnowledgeBase();
    window.knowledgeBase = knowledgeBase;
}

// CSS Animation for fade out
const style = document.createElement('style');
style.textContent = `
    @keyframes kbFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);
