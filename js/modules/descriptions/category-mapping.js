/**
 * ═══════════════════════════════════════════════════════════════════════
 * WORK CATEGORIES MAPPING
 * מיפוי קטגוריות ופריטי תיאור עבודה למשרד עורכי דין
 * ═══════════════════════════════════════════════════════════════════════
 *
 * @version 1.0.0
 * @created 2025-01-04
 */

(function() {
  'use strict';

  /**
   * קטגוריות עבודה ופריטים מוגדרים מראש
   * כל קטגוריה מכילה:
   * - id: מזהה ייחודי
   * - name: שם בעברית
   * - icon: FontAwesome icon class
   * - color: צבע ייצוגי
   * - items: רשימת פריטי עבודה
   * - order: סדר הצגה
   */
  const WORK_CATEGORIES = {
    correspondence: {
      id: 'correspondence',
      name: 'תכתובת',
      icon: 'fa-envelope',
      color: '#3b82f6',
      order: 1,
      items: [
        { id: 'email_client', text: 'מייל ללקוח', order: 1 },
        { id: 'email_court', text: 'מייל לבית משפט', order: 2 },
        { id: 'email_opposing', text: 'מייל לצד שכנגד', order: 3 },
        { id: 'email_expert', text: 'מייל למומחה', order: 4 },
        { id: 'email_witness', text: 'מייל לעד', order: 5 },
        { id: 'letter_formal', text: 'מכתב רשמי', order: 6 },
        { id: 'letter_demand', text: 'מכתב דרישה', order: 7 },
        { id: 'fax', text: 'פקס', order: 8 },
        { id: 'correspondence_other', text: 'תכתובת אחרת', order: 99 }
      ]
    },

    meetings: {
      id: 'meetings',
      name: 'פגישות וישיבות',
      icon: 'fa-users',
      color: '#10b981',
      order: 2,
      items: [
        { id: 'meeting_client', text: 'פגישה עם לקוח', order: 1 },
        { id: 'meeting_opposing', text: 'פגישה עם הצד שכנגד', order: 2 },
        { id: 'meeting_witness', text: 'פגישה עם עד', order: 3 },
        { id: 'meeting_expert', text: 'פגישה עם מומחה', order: 4 },
        { id: 'meeting_internal', text: 'פגישה פנימית', order: 5 },
        { id: 'meeting_mediation', text: 'פגישת גישור', order: 6 },
        { id: 'conference_call', text: 'שיחת ועידה', order: 7 },
        { id: 'meeting_other', text: 'פגישה אחרת', order: 99 }
      ]
    },

    court: {
      id: 'court',
      name: 'בית משפט',
      icon: 'fa-gavel',
      color: '#8b5cf6',
      order: 3,
      items: [
        { id: 'hearing', text: 'דיון', order: 1 },
        { id: 'trial', text: 'משפט', order: 2 },
        { id: 'verdict', text: 'קריאת פסק דין', order: 3 },
        { id: 'mediation', text: 'גישור', order: 4 },
        { id: 'pre_trial', text: 'ישיבת קדם משפט', order: 5 },
        { id: 'execution', text: 'הליכי הוצל"פ', order: 6 },
        { id: 'appeal', text: 'ערעור', order: 7 },
        { id: 'court_other', text: 'הליך משפטי אחר', order: 99 }
      ]
    },

    documents: {
      id: 'documents',
      name: 'מסמכים וכתיבה',
      icon: 'fa-file-alt',
      color: '#f59e0b',
      order: 4,
      items: [
        { id: 'draft_claim', text: 'טיוטת כתב תביעה', order: 1 },
        { id: 'draft_defense', text: 'טיוטת כתב הגנה', order: 2 },
        { id: 'draft_motion', text: 'טיוטת בקשה', order: 3 },
        { id: 'draft_appeal', text: 'טיוטת ערעור', order: 4 },
        { id: 'draft_response', text: 'טיוטת תגובה', order: 5 },
        { id: 'contract', text: 'הכנת חוזה', order: 6 },
        { id: 'opinion', text: 'חוות דעת משפטית', order: 7 },
        { id: 'affidavit', text: 'תצהיר', order: 8 },
        { id: 'power_attorney', text: 'ייפוי כוח', order: 9 },
        { id: 'summary', text: 'סיכום משפטי', order: 10 },
        { id: 'document_other', text: 'מסמך אחר', order: 99 }
      ]
    },

    research: {
      id: 'research',
      name: 'מחקר ופסיקה',
      icon: 'fa-book',
      color: '#06b6d4',
      order: 5,
      items: [
        { id: 'case_law', text: 'מחקר פסיקה', order: 1 },
        { id: 'legislation', text: 'מחקר חקיקה', order: 2 },
        { id: 'legal_opinion_research', text: 'מחקר לחוות דעת', order: 3 },
        { id: 'precedent', text: 'חיפוש תקדימים', order: 4 },
        { id: 'legal_database', text: 'עיון במאגרי מידע', order: 5 },
        { id: 'research_other', text: 'מחקר אחר', order: 99 }
      ]
    },

    consultation: {
      id: 'consultation',
      name: 'ייעוץ ושיחות',
      icon: 'fa-comments',
      color: '#ec4899',
      order: 6,
      items: [
        { id: 'phone_client', text: 'שיחת טלפון עם לקוח', order: 1 },
        { id: 'phone_court', text: 'שיחה עם בית משפט', order: 2 },
        { id: 'phone_opposing', text: 'שיחה עם הצד שכנגד', order: 3 },
        { id: 'phone_expert', text: 'שיחה עם מומחה', order: 4 },
        { id: 'consultation_legal', text: 'ייעוץ משפטי', order: 5 },
        { id: 'consultation_strategy', text: 'ייעוץ אסטרטגי', order: 6 },
        { id: 'consultation_initial', text: 'ייעוץ ראשוני', order: 7 },
        { id: 'consultation_other', text: 'ייעוץ אחר', order: 99 }
      ]
    },

    admin: {
      id: 'admin',
      name: 'ניהול ואדמיניסטרציה',
      icon: 'fa-tasks',
      color: '#64748b',
      order: 7,
      items: [
        { id: 'file_management', text: 'ניהול תיק', order: 1 },
        { id: 'billing', text: 'חשבונאות וחיוב', order: 2 },
        { id: 'scheduling', text: 'תיאום פגישות', order: 3 },
        { id: 'follow_up', text: 'מעקב ופינגוס', order: 4 },
        { id: 'filing', text: 'ארכיון ותיוק', order: 5 },
        { id: 'coordination', text: 'תיאום עם גורמים', order: 6 },
        { id: 'admin_other', text: 'ניהול אחר', order: 99 }
      ]
    },

    review: {
      id: 'review',
      name: 'עיון ובדיקה',
      icon: 'fa-search',
      color: '#f97316',
      order: 8,
      items: [
        { id: 'review_documents', text: 'עיון במסמכים', order: 1 },
        { id: 'review_contract', text: 'בדיקת חוזה', order: 2 },
        { id: 'review_file', text: 'עיון בתיק', order: 3 },
        { id: 'review_evidence', text: 'בדיקת ראיות', order: 4 },
        { id: 'proofreading', text: 'הגהה ותיקון', order: 5 },
        { id: 'review_other', text: 'עיון אחר', order: 99 }
      ]
    }
  };

  /**
   * Helper: קבל קטגוריה לפי ID
   */
  function getCategoryById(categoryId) {
    return WORK_CATEGORIES[categoryId] || null;
  }

  /**
   * Helper: קבל פריט לפי IDs
   */
  function getItemById(categoryId, itemId) {
    const category = getCategoryById(categoryId);
    if (!category) return null;

    return category.items.find(item => item.id === itemId) || null;
  }

  /**
   * Helper: קבל את כל הקטגוריות ממוינות
   */
  function getAllCategories() {
    return Object.values(WORK_CATEGORIES)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Helper: קבל תיאור מלא (Category • Item)
   */
  function getFullDescription(categoryId, itemId) {
    const category = getCategoryById(categoryId);
    const item = getItemById(categoryId, itemId);

    if (!category || !item) return '';

    return `${category.name} • ${item.text}`;
  }

  // Export to global scope
  window.WorkCategories = {
    CATEGORIES: WORK_CATEGORIES,
    getCategoryById,
    getItemById,
    getAllCategories,
    getFullDescription
  };

  Logger.log('✅ WorkCategories module loaded - 8 categories with',
    Object.values(WORK_CATEGORIES).reduce((sum, cat) => sum + cat.items.length, 0),
    'items');

})();
