const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'readby_' + Date.now());
const db = app.firestore();

function analyzeObj(obj, prefix, depth) {
  const results = [];
  if (!obj || typeof obj !== 'object') {
return results;
}
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    const path = prefix ? prefix + '.' + key : key;
    if (val && typeof val === 'object' && !val._seconds) {
      results.push({ path, type: 'object', depth: depth + 1 });
      results.push(...analyzeObj(val, path, depth + 1));
    } else if (val && val._seconds) {
      results.push({ path, type: 'Timestamp', value: new Date(val._seconds * 1000).toISOString(), depth: depth + 1 });
    } else {
      results.push({ path, type: typeof val, value: val, depth: depth + 1 });
    }
  });
  return results;
}

(async () => {
  const snap = await db.collection('system_announcements').get();
  console.log('Total documents:', snap.size);
  console.log('');

  snap.forEach(doc => {
    const data = doc.data();
    const readBy = data.readBy;
    console.log('=== Document:', doc.id, '===');
    console.log('active:', data.active, '| title:', data.title || '(no title)');

    if (!readBy || Object.keys(readBy).length === 0) {
      console.log('readBy: EMPTY (no entries)');
    } else {
      console.log('readBy top-level keys:', JSON.stringify(Object.keys(readBy)));
      console.log('readBy max depth analysis:');
      const analysis = analyzeObj(readBy, '', 0);
      const maxDepth = Math.max(...analysis.map(a => a.depth));
      console.log('  Max nesting depth:', maxDepth);
      analysis.forEach(a => {
        const indent = '  '.repeat(a.depth + 1);
        if (a.type === 'Timestamp') {
          console.log(indent + a.path + ' = ' + a.value + ' (Timestamp)');
        } else if (a.type === 'object') {
          console.log(indent + a.path + ' → [nested object]');
        } else {
          console.log(indent + a.path + ' = ' + JSON.stringify(a.value) + ' (' + a.type + ')');
        }
      });
    }

    // Also check dismissedBy
    const dismissedBy = data.dismissedBy;
    if (dismissedBy && dismissedBy.length > 0) {
      console.log('dismissedBy:', JSON.stringify(dismissedBy));
    } else {
      console.log('dismissedBy: EMPTY or missing');
    }

    console.log('');
  });
  process.exit(0);
})();
