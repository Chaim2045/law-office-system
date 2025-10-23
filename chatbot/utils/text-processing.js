/**
 * מודול עיבוד טקסט - Text Processing Utilities
 * פונקציות לעיבוד טקסט עברי, חישוב דמיון ונורמליזציה
 */

/**
 * נורמליזציה של טקסט עברי
 * מטפל בטעויות הקלדה נפוצות, מסיר ניקוד, ממיר לאותיות קטנות
 * @param {string} text - הטקסט לנורמליזציה
 * @returns {string} - טקסט מנורמל
 */
export function normalizeText(text) {
    return text.toLowerCase()
        .replace(/[״׳'"]/g, '')
        // טיפול באותיות דומות בעברית (טעויות הקלדה נפוצות)
        .replace(/[כך]/g, 'כ')
        .replace(/[םמ]/g, 'מ')
        .replace(/[ןנ]/g, 'ן')
        .replace(/[ףפ]/g, 'פ')
        .replace(/[ץצ]/g, 'צ')
        // הסרת רווחים מיותרים
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * חישוב דמיון בין שתי מחרוזות
 * משתמש באלגוריתם Levenshtein distance
 * @param {string} str1 - מחרוזת ראשונה
 * @param {string} str2 - מחרוזת שנייה
 * @returns {number} - ציון דמיון בין 0 (שונה לגמרי) ל-1 (זהה)
 */
export function calculateSimilarity(str1, str2) {
    // חישוב דמיון בין 2 מחרוזות (0-1)
    // משתמש באלגוריתם Levenshtein distance מפושט

    const len1 = str1.length;
    const len2 = str2.length;

    // אם אחד ריק
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    // מטריצה לחישוב המרחק
    const matrix = [];

    // אתחול
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    // מילוי המטריצה
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);

    // המרה לציון דמיון (1 = זהה, 0 = שונה לגמרי)
    return 1 - (distance / maxLen);
}

/**
 * חישוב ציון התאמה בין שאילתה לפריט FAQ
 * @param {string} query - השאילתה של המשתמש (מנורמלת)
 * @param {Object} item - פריט FAQ מהמאגר
 * @param {string[]} item.keywords - מילות מפתח של הפריט
 * @returns {number} - ציון ההתאמה
 */
export function calculateMatchScore(query, item) {
    let score = 0;

    // בדוק התאמה למילות מפתח
    const queryWords = query.split(' ').filter(w => w.length > 2);

    for (const keyword of item.keywords) {
        const normalizedKeyword = normalizeText(keyword);

        // התאמה מלאה
        if (normalizedKeyword === query) {
            score += 10;
        }

        // מכיל את המילה
        if (normalizedKeyword.includes(query) || query.includes(normalizedKeyword)) {
            score += 5;
        }

        // חיפוש חכם - Fuzzy matching
        const similarity = calculateSimilarity(query, normalizedKeyword);
        if (similarity > 0.7) {
            score += 8; // דומה מאוד
        } else if (similarity > 0.5) {
            score += 4; // דומה למדי
        } else if (similarity > 0.3) {
            score += 2; // דומה קצת
        }

        // התאמה חלקית למילים
        for (const word of queryWords) {
            if (normalizedKeyword.includes(word)) {
                score += 1;
            }

            // בדוק גם דמיון למילה בודדת
            const wordSimilarity = calculateSimilarity(word, normalizedKeyword);
            if (wordSimilarity > 0.6) {
                score += 2;
            }
        }
    }

    return score;
}
