/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Message Categories Configuration
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * קטגוריות הודעות מוגדרות מראש למערכת התקשורת מנהל-עובד
 *
 * Created: 2025-12-08
 * Part of Law Office Management System
 */

(function() {
    'use strict';

    /**
     * Message Categories
     * קטגוריות הודעות
     */
    const MESSAGE_CATEGORIES = {
        critical: {
            id: 'critical',
            name: 'קריטי',
            icon: '🔴',
            color: '#dc2626',      // Red
            bgColor: '#fee2e2',
            description: 'דרוש תשובה/פעולה מיידית',
            priority: 1
        },
        urgent: {
            id: 'urgent',
            name: 'דחוף',
            icon: '🟠',
            color: '#ea580c',      // Orange
            bgColor: '#fed7aa',
            description: 'תוך 24 שעות',
            priority: 2
        },
        task: {
            id: 'task',
            name: 'משימה',
            icon: '📋',
            color: '#2563eb',      // Blue
            bgColor: '#dbeafe',
            description: 'משימה חדשה לביצוע',
            priority: 3
        },
        info: {
            id: 'info',
            name: 'מידע',
            icon: 'ℹ️',
            color: '#0891b2',      // Cyan
            bgColor: '#cffafe',
            description: 'הודעת מידע כללית',
            priority: 4
        },
        report: {
            id: 'report',
            name: 'דוח',
            icon: '📊',
            color: '#7c3aed',      // Purple
            bgColor: '#ede9fe',
            description: 'בקשה לדוח/עדכון',
            priority: 5
        },
        question: {
            id: 'question',
            name: 'שאלה',
            icon: '❓',
            color: '#059669',      // Green
            bgColor: '#d1fae5',
            description: 'שאלה שדורשת תשובה',
            priority: 6
        },
        approval: {
            id: 'approval',
            name: 'אישור',
            icon: '✅',
            color: '#16a34a',      // Dark Green
            bgColor: '#dcfce7',
            description: 'דרוש אישור/אישוי תקציב',
            priority: 7
        }
    };

    /**
     * Get category by ID
     * קבלת קטגוריה לפי ID
     * @param {string} categoryId - Category ID
     * @returns {Object|null} - Category object or null
     */
    function getCategoryById(categoryId) {
        return MESSAGE_CATEGORIES[categoryId] || null;
    }

    /**
     * Get all categories as array
     * קבלת כל הקטגוריות כמערך
     * @returns {Array} - Array of category objects
     */
    function getAllCategories() {
        return Object.values(MESSAGE_CATEGORIES).sort((a, b) => a.priority - b.priority);
    }

    /**
     * Get category display name with icon
     * קבלת שם תצוגה עם אייקון
     * @param {string} categoryId - Category ID
     * @returns {string} - Display name with icon
     */
    function getCategoryDisplayName(categoryId) {
        const category = getCategoryById(categoryId);
        return category ? `${category.icon} ${category.name}` : 'ללא קטגוריה';
    }

    /**
     * Get category color
     * קבלת צבע קטגוריה
     * @param {string} categoryId - Category ID
     * @returns {string} - Color hex code
     */
    function getCategoryColor(categoryId) {
        const category = getCategoryById(categoryId);
        return category ? category.color : '#6b7280';
    }

    /**
     * Get category background color
     * קבלת צבע רקע של קטגוריה
     * @param {string} categoryId - Category ID
     * @returns {string} - Background color hex code
     */
    function getCategoryBgColor(categoryId) {
        const category = getCategoryById(categoryId);
        return category ? category.bgColor : '#f3f4f6';
    }

    // Export to window
    window.MessageCategories = {
        CATEGORIES: MESSAGE_CATEGORIES,
        getCategoryById,
        getAllCategories,
        getCategoryDisplayName,
        getCategoryColor,
        getCategoryBgColor
    };

    console.log('✅ Message Categories: Configuration loaded');

})();
