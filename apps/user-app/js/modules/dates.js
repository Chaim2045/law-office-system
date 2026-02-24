/**
 * Dates Module - מודול ניהול תאריכים
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 08/10/2025
 * גרסה: 1.0.0
 *
 * תכונות:
 * - המרת Firebase Timestamps ל-JavaScript Date
 * - פורמט תאריכים בעברית
 * - הצגת תאריכי יצירה עם fallback
 * - פונקציות עזר מודולריות ובדוקות
 */

// ===== המרת Firebase Timestamps =====

/**
 * ממיר Firebase Timestamp ל-JavaScript Date
 * @param {Object|Date|string} timestamp - Timestamp מ-Firebase או Date או string
 * @returns {Date|null} אובייקט Date או null אם לא תקין
 */
function convertFirebaseTimestamp(timestamp) {
  if (!timestamp) {
return null;
}

  // אם זה כבר Date - החזר כמו שזה
  if (timestamp instanceof Date) {
    return timestamp;
  }

  // אם יש פונקציה toDate (Firebase Timestamp)
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }

  // נסה להמיר string או number
  try {
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.warn('Failed to convert timestamp:', timestamp);
    return null;
  }
}

/**
 * ממיר כל השדות של תאריך באובייקט
 * @param {Object} data - אובייקט עם שדות תאריך
 * @param {Array<string>} fields - רשימת שדות להמרה (ברירת מחדל: createdAt, updatedAt)
 * @returns {Object} אובייקט עם תאריכים מומרים
 */
function convertTimestampFields(data, fields = ['createdAt', 'updatedAt']) {
  if (!data) {
return data;
}

  const converted = { ...data };

  fields.forEach(field => {
    if (converted[field]) {
      converted[field] = convertFirebaseTimestamp(converted[field]);
    }
  });

  return converted;
}

// ===== פורמט תאריכים =====

/**
 * פורמט תאריך קצר בעברית (יום חודש)
 * @param {Date|string|Object} date - תאריך להצגה
 * @returns {string} תאריך מפורמט או '-'
 */
function formatShort(date) {
  if (!date) {
return '-';
}

  const d = convertFirebaseTimestamp(date);
  if (!d) {
return '-';
}

  return d.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short'
  });
}

/**
 * פורמט תאריך מלא בעברית (יום/חודש/שנה)
 * @param {Date|string|Object} date - תאריך להצגה
 * @returns {string} תאריך מפורמט או '-'
 */
function formatDate(date) {
  if (!date) {
return '-';
}

  const d = convertFirebaseTimestamp(date);
  if (!d) {
return '-';
}

  return d.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * פורמט תאריך ושעה מלא בעברית
 * Updated to match VanillaCalendarPicker format: DD/MM/YYYY בשעה HH:MM
 * @param {Date|string|Object} date - תאריך להצגה
 * @returns {string} תאריך ושעה מפורמט או '-'
 */
function formatDateTime(date) {
  if (!date) {
return '-';
}

  const d = convertFirebaseTimestamp(date);
  if (!d) {
return '-';
}

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} בשעה ${hours}:${minutes}`;
}

// ===== הצגת תאריכי יצירה עם Fallback =====

/**
 * מחזיר תאריך יצירה עם fallback לתאריך עדכון
 * @param {Object} item - אובייקט עם createdAt ו/או updatedAt
 * @returns {Date|null} תאריך יצירה או עדכון
 */
function getCreationDate(item) {
  if (!item) {
return null;
}
  return item.createdAt || item.updatedAt || null;
}

/**
 * מחזיר תאריך יצירה מפורמט עם fallback
 * @param {Object} item - אובייקט עם createdAt ו/או updatedAt
 * @param {string} format - 'short' או 'full' או 'datetime' (ברירת מחדל: 'short')
 * @returns {string} תאריך מפורמט או '-'
 */
function getFormattedCreationDate(item, format = 'short') {
  const date = getCreationDate(item);
  if (!date) {
return '-';
}

  switch (format) {
    case 'full':
      return formatDate(date);
    case 'datetime':
      return formatDateTime(date);
    case 'short':
    default:
      return formatShort(date);
  }
}

/**
 * מחזיר HTML לתצוגת תאריך יצירה (לשימוש בכרטיסים)
 * @param {Object} item - אובייקט עם createdAt ו/או updatedAt
 * @returns {string} HTML מפורמט או string ריק
 */
function getCreationDateHTML(item) {
  const date = getCreationDate(item);
  if (!date) {
return '';
}

  const fullDate = formatDate(date);
  const time = new Date(date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

  return `<div class="creation-date-tag">
    <i class="far fa-clock"></i>
    <span>נוצר ב-${fullDate} ${time}</span>
  </div>`;
}

/**
 * מחזיר HTML לתצוגת תאריך יצירה בפינת הכרטיס
 * @param {Object} item - אובייקט עם createdAt ו/או updatedAt
 * @returns {string} HTML מפורמט לפינה או string ריק
 */
function getCreationDateCorner(item) {
  const date = getCreationDate(item);
  if (!date) {
return '';
}

  const shortDate = formatShort(date);
  const fullDate = formatDate(date);

  return `<div class="card-creation-date" title="תאריך יצירה: ${fullDate}">${shortDate}</div>`;
}

/**
 * מחזיר תא טבלה לתצוגת תאריך יצירה
 * @param {Object} item - אובייקט עם createdAt ו/או updatedAt
 * @returns {string} תוכן תא הטבלה
 */
function getCreationDateTableCell(item) {
  const date = getCreationDate(item);
  return date ? formatShort(date) : '-';
}

// ===== ייצוא למרחב הגלובלי =====

window.DatesModule = {
  // המרות
  convertFirebaseTimestamp,
  convertTimestampFields,

  // פורמטים
  formatShort,
  formatDate,
  formatDateTime,

  // תאריכי יצירה
  getCreationDate,
  getFormattedCreationDate,
  getCreationDateHTML,
  getCreationDateCorner,
  getCreationDateTableCell
};

