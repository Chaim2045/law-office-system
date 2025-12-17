/**
 * Browser Console Script - Reset Guy's Password
 * סקריפט לאיפוס סיסמת גיא
 *
 * העתק והדבק את הסקריפט הזה לקונסול של הדפדפן
 * כשאתה באתר: https://admin-gh-law-office-system.netlify.app/
 */

(async function resetGuyPassword() {
    console.log('🔄 Starting password reset for Guy...\n');
    console.log('══════════════════════════════════════════════════════════\n');

    const guyEmail = 'guy@ghlawoffice.co.il';

    try {
        // Check if Firebase is available
        if (!window.firebaseAuth) {
            console.error('❌ Firebase Auth not initialized!');
            console.log('   Make sure you are on the admin panel page.');
            return;
        }

        console.log('✅ Firebase Auth initialized\n');

        // Send password reset email
        console.log('📧 Sending password reset email to:', guyEmail);
        console.log('─────────────────────────────────────────────────────────');

        await window.firebaseAuth.sendPasswordResetEmail(guyEmail);

        console.log('✅ Password reset email sent successfully!\n');
        console.log('📬 Guy should receive an email at:', guyEmail);
        console.log('   with a link to reset his password.\n');

        console.log('📋 Next Steps:');
        console.log('1. Ask Guy to check his email inbox (and spam folder)');
        console.log('2. Guy should click the reset link in the email');
        console.log('3. Guy will be able to set a new password');
        console.log('4. After resetting, Guy can login at:');
        console.log('   https://admin-gh-law-office-system.netlify.app/\n');

        console.log('══════════════════════════════════════════════════════════');
        console.log('✅ Password reset process started!');
        console.log('══════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Error sending password reset email:', error);
        console.log('\nError code:', error.code);
        console.log('Error message:', error.message);

        // Provide troubleshooting
        console.log('\n🔧 Troubleshooting:');
        if (error.code === 'auth/user-not-found') {
            console.log('   - User does not exist in Firebase Auth');
            console.log('   - Need to create the user first');
        } else if (error.code === 'auth/invalid-email') {
            console.log('   - Email format is invalid');
        } else if (error.code === 'auth/too-many-requests') {
            console.log('   - Too many reset attempts');
            console.log('   - Wait a few minutes and try again');
        } else {
            console.log('   - Make sure you are logged in as an admin');
            console.log('   - Check network connection');
            console.log('   - Try refreshing the page and running again');
        }
    }
})();
