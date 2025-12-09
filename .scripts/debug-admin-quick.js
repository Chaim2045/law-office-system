/**
 * Quick Admin Panel Debug - Check if everything is loaded
 * Run in Admin Panel Console (F12)
 */

console.clear();
console.log('%c🔍 QUICK ADMIN DEBUG', 'font-size: 18px; font-weight: bold; color: #2563eb;');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Check UserDetailsModal
if (window.userDetailsModal) {
    console.log('✅ window.userDetailsModal exists');
} else if (window.UserDetailsModal) {
    console.log('⚠️ Found window.UserDetailsModal (uppercase)');
    console.log('   Creating lowercase version...');
    window.userDetailsModal = window.UserDetailsModal;
} else {
    console.log('❌ UserDetailsModal NOT FOUND - this is a critical error!');
}

// Check other required components
console.log('\n📦 Required Components:');
console.log(`  Firebase DB: ${window.firebaseDB ? '✅' : '❌'}`);
console.log(`  AlertCommunicationManager: ${window.alertCommManager ? '✅' : '❌'}`);
console.log(`  AdminThreadView: ${window.adminThreadView ? '✅' : '❌'}`);
console.log(`  ModalManager: ${window.ModalManager ? '✅' : '❌'}`);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (window.userDetailsModal) {
    console.log('%c✅ Ready to test!', 'font-size: 16px; font-weight: bold; color: #059669;');
    console.log('Now open a user details modal and run the full debug script.');
} else {
    console.log('%c❌ NOT READY', 'font-size: 16px; font-weight: bold; color: #dc2626;');
    console.log('Please refresh the page and try again.');
}
