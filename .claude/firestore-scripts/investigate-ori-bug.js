const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'investigate_' + Date.now());
const db = app.firestore();

(async () => {
  // Task 1: All active announcements
  console.log('=== TASK 1: Active announcements ===');
  const allSnap = await db.collection('system_announcements').get();
  console.log('Total documents:', allSnap.size);
  console.log('');

  allSnap.forEach(doc => {
    const data = doc.data();
    console.log('--- Document:', doc.id, '---');
    console.log('  active:', data.active);
    console.log('  title:', data.title || '(none)');
    console.log('  message:', data.message);
    console.log('  type:', data.type);
    console.log('  priority:', data.priority);
    console.log('  targetAudience:', data.targetAudience);
    console.log('  startDate:', data.startDate ? new Date(data.startDate._seconds * 1000).toISOString() : 'null');
    console.log('  endDate:', data.endDate ? new Date(data.endDate._seconds * 1000).toISOString() : 'null');
    console.log('  createdBy:', data.createdBy);
    console.log('  createdAt:', data.createdAt ? new Date(data.createdAt._seconds * 1000).toISOString() : 'null');
    console.log('  updatedAt:', data.updatedAt ? new Date(data.updatedAt._seconds * 1000).toISOString() : 'null');
    console.log('  displaySettings:', JSON.stringify(data.displaySettings));
    console.log('  popupSettings:', JSON.stringify(data.popupSettings));
    console.log('  displayStyle:', JSON.stringify(data.displayStyle));
    console.log('  tenantId:', data.tenantId);

    // readBy analysis
    const readBy = data.readBy;
    if (!readBy || Object.keys(readBy).length === 0) {
      console.log('  readBy: EMPTY');
    } else {
      console.log('  readBy keys:', JSON.stringify(Object.keys(readBy)));
      Object.keys(readBy).forEach(key => {
        const val = readBy[key];
        if (val && typeof val === 'object' && val.displayName !== undefined) {
          const readAt = val.readAt ? new Date(val.readAt._seconds * 1000).toISOString() : 'null';
          console.log('    "' + key + '" → FLAT | displayName=' + val.displayName + ' | readAt=' + readAt);
        } else if (val && typeof val === 'object') {
          console.log('    "' + key + '" → NESTED (broken) | content:', JSON.stringify(val));
        }
      });
    }

    // dismissedBy
    if (data.dismissedBy && data.dismissedBy.length > 0) {
      console.log('  dismissedBy:', JSON.stringify(data.dismissedBy));
    } else {
      console.log('  dismissedBy: EMPTY');
    }
    console.log('');
  });

  // Task 2: Check readBy for ori
  console.log('=== TASK 2: readBy for ori@ghlawoffice.co.il ===');
  let foundOri = false;
  allSnap.forEach(doc => {
    const data = doc.data();
    const readBy = data.readBy || {};

    // Check flat key
    if (readBy['ori@ghlawoffice.co.il']) {
      console.log('Document:', doc.id, '→ FLAT readBy entry for ori');
      console.log('  Value:', JSON.stringify(readBy['ori@ghlawoffice.co.il']));
      foundOri = true;
    }

    // Check nested key (broken: ori@ghlawoffice → co → il)
    if (readBy['ori@ghlawoffice'] && readBy['ori@ghlawoffice'].co) {
      console.log('Document:', doc.id, '→ NESTED (broken) readBy entry for ori');
      console.log('  Value:', JSON.stringify(readBy['ori@ghlawoffice']));
      foundOri = true;
    }
  });
  if (!foundOri) {
    console.log('NO readBy entry found for ori@ghlawoffice.co.il in any document');
  }
  console.log('');

  // Task 3: Ori's role
  console.log('=== TASK 3: ori employee record ===');
  const oriDoc = await db.collection('employees').doc('ori@ghlawoffice.co.il').get();
  if (oriDoc.exists) {
    const oriData = oriDoc.data();
    console.log('Email:', oriDoc.id);
    console.log('  displayName:', oriData.displayName || oriData.name || '(none)');
    console.log('  role:', oriData.role);
    console.log('  isActive:', oriData.isActive);
  } else {
    console.log('ori@ghlawoffice.co.il NOT FOUND in employees collection');
  }

  process.exit(0);
})();
