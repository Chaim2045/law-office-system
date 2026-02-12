const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'rules_' + Date.now());

(async () => {
  // Get access token from Admin SDK
  const token = await app.options.credential.getAccessToken();

  const projectId = sa.project_id;

  // Get releases (which ruleset is active)
  console.log('=== Active Releases ===');
  const releaseUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`;
  const releaseResp = await fetch(releaseUrl, {
    headers: { 'Authorization': `Bearer ${token.access_token}` }
  });
  const releaseData = await releaseResp.json();

  if (releaseData.releases) {
    releaseData.releases.forEach(rel => {
      console.log('Release:', rel.name);
      console.log('  Ruleset:', rel.rulesetName);
      console.log('  Created:', rel.createTime);
      console.log('  Updated:', rel.updateTime);
      console.log('');
    });
  } else {
    console.log('No releases found');
    console.log('Raw:', JSON.stringify(releaseData, null, 2));
    process.exit(1);
  }

  // Get the Firestore ruleset content
  const firestoreRelease = releaseData.releases.find(r => r.name.includes('cloud.firestore'));
  if (!firestoreRelease) {
    console.log('No Firestore release found!');
    process.exit(1);
  }

  console.log('=== Active Firestore Ruleset ===');
  console.log('Ruleset name:', firestoreRelease.rulesetName);
  console.log('Last updated:', firestoreRelease.updateTime);
  console.log('');

  const rulesetUrl = `https://firebaserules.googleapis.com/v1/${firestoreRelease.rulesetName}`;
  const rulesetResp = await fetch(rulesetUrl, {
    headers: { 'Authorization': `Bearer ${token.access_token}` }
  });
  const rulesetData = await rulesetResp.json();

  if (rulesetData.source && rulesetData.source.files) {
    rulesetData.source.files.forEach(f => {
      console.log('=== DEPLOYED RULES CONTENT ===');
      console.log('File:', f.name);
      console.log('Content length:', f.content.length, 'chars');
      console.log('---');
      console.log(f.content);
    });
  } else {
    console.log('Could not read ruleset content');
    console.log('Raw:', JSON.stringify(rulesetData, null, 2));
  }

  // List recent rulesets to see deployment history
  console.log('');
  console.log('=== Recent Rulesets (deployment history) ===');
  const rulesetsUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets?pageSize=5`;
  const rulesetsResp = await fetch(rulesetsUrl, {
    headers: { 'Authorization': `Bearer ${token.access_token}` }
  });
  const rulesetsData = await rulesetsResp.json();

  if (rulesetsData.rulesets) {
    rulesetsData.rulesets.forEach((rs, i) => {
      console.log(`${i + 1}. ${rs.name}`);
      console.log('   Created:', rs.createTime);
    });
  }

  process.exit(0);
})();
