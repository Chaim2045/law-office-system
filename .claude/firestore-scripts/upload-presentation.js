/**
 * Upload Presentation to Firebase Storage + Firestore
 * Run with: node .claude/firestore-scripts/upload-presentation.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../../service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'law-office-system-e4801.firebasestorage.app'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// ══════════════════════════════════
// PRESENTATION DATA
// ══════════════════════════════════

const PRESENTATION = {
  title: 'ניהול הליכים מקדמיים: אסטרטגיה ופרקטיקה בהגשת רשימת עדים ובקשות',
  topic: 'סדר דין אזרחי וניהול ליטיגציה',
  description: 'המצגת מחדדת את חשיבות העמידה במועדים הקשיחים (20 ו-60 ימים) להגשת הרשימות, ומדגישה כי מדובר בשלב מהותי ולא טכני שיכול להכריע את התיק. היא מפרטת את שלבי העבודה הנדרשים: החל ממיצוי העדים מול הלקוח, דרך ניסוח תמצית עדות למניעת מחיקה, ועד להיערכות טקטית לזימון עדים בצו וטיפול ב"עד עוין".',
  date: new Date('2026-02-15'),
  active: true
};

const LOCAL_DIR = path.join(__dirname, '../presentations/edim-ubkashot');
const STORAGE_BASE = 'presentations/edim-ubkashot';

// Infographic metadata
const INFOGRAPHIC = {
  filename: 'unnamed.png',
  description: 'תרשים זרימה המציג את ציר הזמן להגשה (כולל חובת ההתראה של 7 ימים לצד השני), לצד "עץ קבלת החלטות" בבחירת עדים'
};

async function run() {
  console.log('=== Upload Presentation ===\n');

  // 1. Read local files
  const allFiles = fs.readdirSync(LOCAL_DIR).sort();
  console.log(`Found ${allFiles.length} files in ${LOCAL_DIR}`);

  // 2. Separate slides from other files
  const slideFiles = allFiles
    .filter(f => f.startsWith('עדים בקשות') && f.endsWith('.png'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\.(\d+)\.png$/)?.[1] || '0');
      const numB = parseInt(b.match(/\.(\d+)\.png$/)?.[1] || '0');
      return numA - numB;
    });

  const videoFile = allFiles.find(f => f.endsWith('.mp4'));
  const infographicFile = allFiles.find(f => f === INFOGRAPHIC.filename);

  console.log(`Slides: ${slideFiles.length}`);
  console.log(`Video: ${videoFile || 'none'}`);
  console.log(`Infographic: ${infographicFile || 'none'}`);
  console.log('');

  // 3. Upload slides
  const slides = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const filename = slideFiles[i];
    const localPath = path.join(LOCAL_DIR, filename);
    const storagePath = `${STORAGE_BASE}/slides/slide-${String(i + 1).padStart(2, '0')}.png`;

    console.log(`Uploading slide ${i + 1}/${slideFiles.length}: ${filename}`);

    await bucket.upload(localPath, {
      destination: storagePath,
      metadata: {
        contentType: 'image/png',
        metadata: { originalName: filename }
      }
    });

    // Get public URL
    const file = bucket.file(storagePath);
    await file.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    slides.push({ url, order: i + 1 });
  }

  console.log(`\n✅ ${slides.length} slides uploaded`);

  // 4. Upload video
  let videoUrl = null;
  if (videoFile) {
    const localPath = path.join(LOCAL_DIR, videoFile);
    const storagePath = `${STORAGE_BASE}/video/${videoFile}`;

    console.log(`\nUploading video: ${videoFile} (this may take a moment...)`);

    await bucket.upload(localPath, {
      destination: storagePath,
      metadata: {
        contentType: 'video/mp4',
        metadata: { originalName: videoFile }
      }
    });

    const file = bucket.file(storagePath);
    await file.makePublic();
    videoUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    console.log('✅ Video uploaded');
  }

  // 5. Upload infographic
  let infographicUrl = null;
  if (infographicFile) {
    const localPath = path.join(LOCAL_DIR, infographicFile);
    const storagePath = `${STORAGE_BASE}/infographic/${infographicFile}`;

    console.log(`\nUploading infographic: ${infographicFile}`);

    await bucket.upload(localPath, {
      destination: storagePath,
      metadata: {
        contentType: 'image/png',
        metadata: { originalName: infographicFile }
      }
    });

    const file = bucket.file(storagePath);
    await file.makePublic();
    infographicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    console.log('✅ Infographic uploaded');
  }

  // 6. Create Firestore document
  console.log('\nCreating Firestore document...');

  const docData = {
    ...PRESENTATION,
    slidesCount: slides.length,
    slides,
    thumbnail: slides.length > 0 ? slides[0].url : null,
    videoUrl,
    pdfUrl: null,
    infographic: infographicUrl ? {
      url: infographicUrl,
      description: INFOGRAPHIC.description
    } : null,
    uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    uploadedBy: 'admin-script'
  };

  const docRef = await db.collection('presentations').add(docData);

  console.log(`\n✅ Firestore document created: ${docRef.id}`);
  console.log('\n=== DONE ===');
  console.log(`Slides: ${slides.length}`);
  console.log(`Video: ${videoUrl ? 'yes' : 'no'}`);
  console.log(`Infographic: ${infographicUrl ? 'yes' : 'no'}`);
  console.log(`Document ID: ${docRef.id}`);

  process.exit(0);
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
