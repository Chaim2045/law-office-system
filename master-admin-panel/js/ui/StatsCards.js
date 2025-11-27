/**
 * Statistics Cards Component
 * קומפוננטת כרטיסי סטטיסטיקה
 *
 * נוצר: 31/10/2025
 * גרסה: 1.0.0
 * Phase: 2 - Dashboard UI
 *
 * תפקיד: תצוגת 4 כרטיסי סטטיסטיקה
 */

(function() {
    'use strict';

    /**
     * StatsCards Class
     * מנהל את כרטיסי הסטטיסטיקה
     */
    class StatsCards {
        constructor() {
            this.cards = [
                {
                    id: 'total',
                    title: 'סה"כ משתמשים',
                    icon: 'fa-users',
                    color: 'blue',
                    getValue: (stats) => stats.total || 0
                },
                {
                    id: 'active',
                    title: 'משתמשים פעילים',
                    subtitle: '7 ימים אחרונים',
                    icon: 'fa-user-check',
                    color: 'green',
                    getValue: (stats) => stats.activeLastWeek || stats.active || 0
                },
                {
                    id: 'blocked',
                    title: 'משתמשים חסומים',
                    icon: 'fa-user-slash',
                    color: 'red',
                    getValue: (stats) => stats.blocked || 0
                },
                {
                    id: 'new',
                    title: 'משתמשים חדשים',
                    subtitle: '30 ימים אחרונים',
                    icon: 'fa-user-plus',
                    color: 'orange',
                    getValue: (stats) => stats.new || 0
                }
            ];
        }

        /**
         * Render statistics cards
         * רינדור כרטיסי סטטיסטיקה
         */
        render(container, statistics) {
            if (!container) {
                console.error('❌ StatsCards: Container not found');
                return;
            }

            if (!statistics) {
                console.error('❌ StatsCards: Statistics data missing');
                return;
            }

            // Generate HTML
            const html = `
                <div class="stats-grid">
                    ${this.cards.map(card => this.renderCard(card, statistics)).join('')}
                </div>
            `;

            container.innerHTML = html;

            // Animate cards
            this.animateCards();

            console.log('✅ StatsCards: Rendered', statistics);
        }

        /**
         * Render single card
         * רינדור כרטיס בודד
         */
        renderCard(card, statistics) {
            const value = card.getValue(statistics);
            const subtitle = card.subtitle ? `<p class="card-subtitle">${card.subtitle}</p>` : '';

            return `
                <div class="stat-card stat-card-${card.color}" data-card="${card.id}">
                    <div class="card-icon">
                        <i class="fas ${card.icon}"></i>
                    </div>
                    <div class="card-content">
                        <h3 class="card-title">${card.title}</h3>
                        ${subtitle}
                        <p class="card-value" data-value="${value}">0</p>
                    </div>
                </div>
            `;
        }

        /**
         * Animate cards
         * אנימציה של כרטיסים
         */
        animateCards() {
            // Animate entrance
            const cards = document.querySelectorAll('.stat-card');
            cards.forEach((card, index) => {
                setTimeout(() => {
                    card.classList.add('animate-in');
                }, index * 100);
            });

            // Animate numbers
            this.animateNumbers();
        }

        /**
         * Animate numbers (count up)
         * אנימציית מספרים
         */
        animateNumbers() {
            const valueElements = document.querySelectorAll('.card-value');

            valueElements.forEach(el => {
                const targetValue = parseInt(el.getAttribute('data-value')) || 0;
                const duration = 1000; // 1 second
                const steps = 30;
                const increment = targetValue / steps;
                let currentValue = 0;

                const timer = setInterval(() => {
                    currentValue += increment;

                    if (currentValue >= targetValue) {
                        el.textContent = targetValue.toLocaleString('he-IL');
                        clearInterval(timer);
                    } else {
                        el.textContent = Math.floor(currentValue).toLocaleString('he-IL');
                    }
                }, duration / steps);
            });
        }

        /**
         * Update statistics
         * עדכון סטטיסטיקות (without full re-render)
         */
        update(statistics) {
            if (!statistics) return;

            this.cards.forEach(card => {
                const value = card.getValue(statistics);
                const valueElement = document.querySelector(`[data-card="${card.id}"] .card-value`);

                if (valueElement) {
                    valueElement.setAttribute('data-value', value);
                    valueElement.textContent = value.toLocaleString('he-IL');
                }
            });

            console.log('✅ StatsCards: Updated', statistics);
        }
    }

    // Create global instance
    const statsCards = new StatsCards();

    // Make StatsCards available globally
    window.StatsCards = statsCards;

    // Export for ES6 modules (if needed in the future)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = statsCards;
    }

})();
