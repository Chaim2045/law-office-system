/**
 * Pagination Component
 * קומפוננטת דפדוף
 *
 * נוצר: 31/10/2025
 * גרסה: 1.0.0
 * Phase: 2 - Dashboard UI
 *
 * תפקיד: ניווט בין עמודים ובחירת מספר פריטים בעמוד
 */

(function() {
    'use strict';

    /**
     * PaginationUI Class
     * מנהל את הדפדוף
     */
    class PaginationUI {
        constructor() {
            this.currentData = {
                currentPage: 1,
                totalPages: 1,
                totalItems: 0,
                itemsPerPage: 25
            };
        }

        /**
         * Render pagination
         * רינדור דפדוף
         */
        render(container, paginationData) {
            if (!container) {
                console.error('❌ PaginationUI: Container not found');
                return;
            }

            if (!paginationData || paginationData.totalPages === 0) {
                container.innerHTML = '';
                return;
            }

            this.currentData = paginationData;

            const html = `
                <div class="pagination-wrapper">
                    <!-- Items Per Page -->
                    <div class="pagination-info">
                        <label class="pagination-label">פריטים בעמוד:</label>
                        <select id="itemsPerPageSelect" class="pagination-select">
                            <option value="10" ${paginationData.itemsPerPage === 10 ? 'selected' : ''}>10</option>
                            <option value="25" ${paginationData.itemsPerPage === 25 ? 'selected' : ''}>25</option>
                            <option value="50" ${paginationData.itemsPerPage === 50 ? 'selected' : ''}>50</option>
                            <option value="100" ${paginationData.itemsPerPage === 100 ? 'selected' : ''}>100</option>
                        </select>
                        <span class="pagination-text">
                            מציג ${this.getDisplayRange(paginationData)} מתוך ${paginationData.totalItems}
                        </span>
                    </div>

                    <!-- Page Navigation -->
                    <div class="pagination-nav">
                        ${this.renderPrevButton(paginationData)}
                        ${this.renderPageNumbers(paginationData)}
                        ${this.renderNextButton(paginationData)}
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Setup event listeners
            this.setupEvents();

            console.log(`✅ PaginationUI: Rendered (Page ${paginationData.currentPage}/${paginationData.totalPages})`);
        }

        /**
         * Get display range text
         * קבלת טקסט טווח תצוגה
         */
        getDisplayRange(data) {
            const start = ((data.currentPage - 1) * data.itemsPerPage) + 1;
            const end = Math.min(data.currentPage * data.itemsPerPage, data.totalItems);
            return `${start}-${end}`;
        }

        /**
         * Render previous button
         * רינדור כפתור הקודם
         */
        renderPrevButton(data) {
            const disabled = data.currentPage === 1 ? 'disabled' : '';

            return `
                <button class="pagination-btn pagination-prev ${disabled}" id="paginationPrev" ${disabled}>
                    <i class="fas fa-chevron-right"></i>
                    <span>הקודם</span>
                </button>
            `;
        }

        /**
         * Render next button
         * רינדור כפתור הבא
         */
        renderNextButton(data) {
            const disabled = data.currentPage === data.totalPages ? 'disabled' : '';

            return `
                <button class="pagination-btn pagination-next ${disabled}" id="paginationNext" ${disabled}>
                    <span>הבא</span>
                    <i class="fas fa-chevron-left"></i>
                </button>
            `;
        }

        /**
         * Render page numbers
         * רינדור מספרי עמודים
         */
        renderPageNumbers(data) {
            const pages = this.getPageNumbers(data.currentPage, data.totalPages);

            return `
                <div class="pagination-pages">
                    ${pages.map(page => this.renderPageButton(page, data.currentPage)).join('')}
                </div>
            `;
        }

        /**
         * Get page numbers to display
         * קבלת מספרי עמודים להצגה
         */
        getPageNumbers(currentPage, totalPages) {
            const pages = [];
            const maxVisible = 7; // Maximum page buttons to show

            if (totalPages <= maxVisible) {
                // Show all pages
                for (let i = 1; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                // Always show first page
                pages.push(1);

                // Calculate range around current page
                let start = Math.max(2, currentPage - 1);
                let end = Math.min(totalPages - 1, currentPage + 1);

                // Add ellipsis after first page if needed
                if (start > 2) {
                    pages.push('...');
                }

                // Add pages around current page
                for (let i = start; i <= end; i++) {
                    pages.push(i);
                }

                // Add ellipsis before last page if needed
                if (end < totalPages - 1) {
                    pages.push('...');
                }

                // Always show last page
                pages.push(totalPages);
            }

            return pages;
        }

        /**
         * Render page button
         * רינדור כפתור עמוד
         */
        renderPageButton(page, currentPage) {
            if (page === '...') {
                return `<span class="pagination-ellipsis">...</span>`;
            }

            const active = page === currentPage ? 'active' : '';

            return `
                <button class="pagination-btn pagination-page ${active}" data-page="${page}">
                    ${page}
                </button>
            `;
        }

        /**
         * Setup event listeners
         * הגדרת מאזיני אירועים
         */
        setupEvents() {
            // Items per page select
            const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');
            if (itemsPerPageSelect) {
                itemsPerPageSelect.addEventListener('change', (e) => {
                    this.handleItemsPerPageChange(parseInt(e.target.value));
                });
            }

            // Previous button
            const prevButton = document.getElementById('paginationPrev');
            if (prevButton) {
                prevButton.addEventListener('click', () => {
                    this.handlePrevPage();
                });
            }

            // Next button
            const nextButton = document.getElementById('paginationNext');
            if (nextButton) {
                nextButton.addEventListener('click', () => {
                    this.handleNextPage();
                });
            }

            // Page number buttons
            document.querySelectorAll('.pagination-page').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const page = parseInt(e.target.getAttribute('data-page'));
                    this.handlePageChange(page);
                });
            });
        }

        /**
         * Handle items per page change
         * טיפול בשינוי מספר פריטים בעמוד
         */
        handleItemsPerPageChange(itemsPerPage) {
            console.log('📄 Items per page changed:', itemsPerPage);

            window.dispatchEvent(new CustomEvent('pagination:changed', {
                detail: {
                    type: 'itemsPerPage',
                    itemsPerPage
                }
            }));
        }

        /**
         * Handle previous page
         * טיפול בעמוד הקודם
         */
        handlePrevPage() {
            if (this.currentData.currentPage > 1) {
                this.handlePageChange(this.currentData.currentPage - 1);
            }
        }

        /**
         * Handle next page
         * טיפול בעמוד הבא
         */
        handleNextPage() {
            if (this.currentData.currentPage < this.currentData.totalPages) {
                this.handlePageChange(this.currentData.currentPage + 1);
            }
        }

        /**
         * Handle page change
         * טיפול בשינוי עמוד
         */
        handlePageChange(page) {
            if (page === this.currentData.currentPage) return;

            console.log('📄 Page changed:', page);

            window.dispatchEvent(new CustomEvent('pagination:changed', {
                detail: {
                    type: 'page',
                    page
                }
            }));
        }

        /**
         * Get current page
         * קבלת עמוד נוכחי
         */
        getCurrentPage() {
            return this.currentData.currentPage;
        }

        /**
         * Get total pages
         * קבלת סה"כ עמודים
         */
        getTotalPages() {
            return this.currentData.totalPages;
        }

        /**
         * Get items per page
         * קבלת מספר פריטים בעמוד
         */
        getItemsPerPage() {
            return this.currentData.itemsPerPage;
        }
    }

    // Create global instance
    const paginationUI = new PaginationUI();

    // Make PaginationUI available globally
    window.PaginationUI = paginationUI;

    // Export for ES6 modules (if needed in the future)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = paginationUI;
    }

})();
