/**
 * Debug script to check lastLogin issue
 * Run this in browser console to check your employee document
 */

const email = firebase.auth().currentUser?.email;

if (!email) {
  console.error('❌ No user logged in');
} else {
  console.log('🔍 Checking employee document for:', email);

  window.firebaseDB.collection('employees').doc(email).get()
    .then(doc => {
      if (doc.exists) {
        const data = doc.data();
        console.log('📄 Employee document:', data);
        console.log('\n--- lastLogin Details ---');
        console.log('lastLogin field exists:', !!data.lastLogin);
        console.log('lastLogin value:', data.lastLogin);

        if (data.lastLogin && data.lastLogin.toDate) {
          const loginDate = data.lastLogin.toDate();
          console.log('lastLogin as Date:', loginDate);
          console.log('Formatted:', loginDate.toLocaleString('he-IL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }));
        } else {
          console.log('⚠️ lastLogin is null or not a Timestamp');
        }

        console.log('\nloginCount:', data.loginCount);
        console.log('authUID:', data.authUID);
      } else {
        console.error('❌ Employee document not found');
      }
    })
    .catch(error => {
      console.error('❌ Error:', error);
    });
}