const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'verify_' + Date.now());

(async () => {
  const token = await app.options.credential.getAccessToken();
  const projectId = sa.project_id;

  // Get active Firestore release
  const releaseUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`;
  const releaseResp = await fetch(releaseUrl, {
    headers: { 'Authorization': `Bearer ${token.access_token}` }
  });
  const releaseData = await releaseResp.json();

  const firestoreRelease = releaseData.releases.find(r => r.name.includes('cloud.firestore'));
  console.log('Active Firestore release:');
  console.log('  Ruleset:', firestoreRelease.rulesetName);
  console.log('  Updated:', firestoreRelease.updateTime);
  console.log('');

  // Get ruleset content
  const rulesetUrl = `https://firebaserules.googleapis.com/v1/${firestoreRelease.rulesetName}`;
  const rulesetResp = await fetch(rulesetUrl, {
    headers: { 'Authorization': `Bearer ${token.access_token}` }
  });
  const rulesetData = await rulesetResp.json();

  const content = rulesetData.source.files[0].content;

  // Check for readBy rule
  const lines = content.split('\n');
  const readByLines = [];
  lines.forEach((line, i) => {
    if (line.includes('readBy')) {
      readByLines.push({ lineNum: i + 1, content: line });
    }
  });

  console.log('=== readBy occurrences in DEPLOYED rules ===');
  if (readByLines.length === 0) {
    console.log('NOT FOUND — readBy rule is MISSING from PROD!');
  } else {
    readByLines.forEach(l => {
      console.log(`  Line ${l.lineNum}: ${l.content.trim()}`);
    });
  }

  // Show the system_announcements block
  console.log('');
  console.log('=== system_announcements block in DEPLOYED rules ===');
  let inBlock = false;
  let braceCount = 0;
  lines.forEach((line, i) => {
    if (line.includes('system_announcements')) {
      inBlock = true;
      braceCount = 0;
    }
    if (inBlock) {
      console.log(`  ${i + 1}: ${line}`);
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
      if (braceCount <= 0 && i > 0 && inBlock) {
        inBlock = false;
      }
    }
  });

  process.exit(0);
})();
