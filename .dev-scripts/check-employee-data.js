const admin = require('firebase-admin');

// Initialize with application default credentials
admin.initializeApp();

const db = admin.firestore();

async function checkEmployee() {
  try {
    const snapshot = await db.collection('employees').get();
    console.log('=== All Employees ===');
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\nEmail: ${doc.id}`);
      console.log(`  phone: ${data.phone || 'NOT SET'}`);
      console.log(`  whatsappEnabled: ${data.whatsappEnabled}`);
      console.log(`  isActive: ${data.isActive}`);
    });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkEmployee();
