/**
 * 🔍 Console Diagnostic Script for Chat System
 *
 * כיצד להשתמש:
 * 1. פתח את Admin Panel
 * 2. התחבר כמנהל
 * 3. פתח פרטי עובד (לחץ על עובד ברשימה)
 * 4. לחץ על טאב "צ'אט"
 * 5. פתח Console (F12)
 * 6. העתק והדבק את כל הקוד הזה
 * 7. לחץ Enter
 */

(function() {
    console.clear();
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              🔍 Chat System Diagnostic Report                 ║
╠═══════════════════════════════════════════════════════════════╣
    `);

    const issues = [];
    const warnings = [];
    const success = [];

    // ============================================
    // 1. Check Firebase
    // ============================================
    console.log('1️⃣ Checking Firebase...');
    if (typeof firebase === 'undefined') {
        issues.push('❌ Firebase SDK לא טעון');
    } else {
        success.push('✅ Firebase SDK טעון');

        if (window.firebaseAuth?.currentUser) {
            const user = window.firebaseAuth.currentUser;
            success.push(`✅ משתמש מחובר: ${user.email}`);
            console.log(`   📧 Email: ${user.email}`);
            console.log(`   🆔 UID: ${user.uid}`);
        } else {
            issues.push('❌ אין משתמש מחובר');
        }
    }

    // ============================================
    // 2. Check ChatManager
    // ============================================
    console.log('\n2️⃣ Checking ChatManager...');
    if (typeof window.ChatManager === 'undefined') {
        issues.push('❌ ChatManager Class לא נמצא');
    } else {
        success.push('✅ ChatManager Class קיים');
    }

    if (typeof window.chatManager === 'undefined') {
        issues.push('❌ chatManager instance לא מאותחל');
    } else {
        success.push('✅ chatManager instance מאותחל');
        console.log(`   🔌 Active Listeners: ${window.chatManager.activeListeners?.size || 0}`);
        console.log(`   ⚙️ Chat Enabled: ${window.chatManager.CHAT_ENABLED}`);
    }

    // ============================================
    // 3. Check ModalManager
    // ============================================
    console.log('\n3️⃣ Checking ModalManager...');
    if (typeof window.ModalManager === 'undefined') {
        issues.push('❌ ModalManager לא נמצא');
    } else {
        success.push('✅ ModalManager קיים');

        if (!window.ModalManager.modals) {
            issues.push('❌ ModalManager.modals לא קיים');
        } else {
            const modalIds = Object.keys(window.ModalManager.modals);
            console.log(`   📦 Active Modals: ${modalIds.length}`);

            if (modalIds.length === 0) {
                warnings.push('⚠️ אין מודלים פעילים - פתח פרטי עובד!');
            } else {
                success.push(`✅ נמצאו ${modalIds.length} מודלים פעילים`);

                // Get first modal (should be UserDetailsModal)
                const modal = window.ModalManager.modals[modalIds[0]];
                console.log(`   📋 Modal Type: ${modal.constructor.name}`);

                // ============================================
                // 4. Check Modal Data - CRITICAL!
                // ============================================
                console.log('\n4️⃣ Checking Modal User Data (CRITICAL!)...');

                if (!modal.currentUser) {
                    issues.push('❌ modal.currentUser לא קיים');
                } else {
                    success.push('✅ modal.currentUser קיים');
                    console.log(`   👤 currentUser.uid: ${modal.currentUser.uid}`);
                    console.log(`   📧 currentUser.email: ${modal.currentUser.email}`);
                }

                if (!modal.userData) {
                    issues.push('❌ modal.userData לא קיים');
                } else {
                    success.push('✅ modal.userData קיים');

                    // THE CRITICAL CHECK - uid field
                    console.log('\n   🎯 CRITICAL FIELDS:');
                    console.log(`   ├─ userData.uid: ${modal.userData.uid || '❌ MISSING!!!'}`);
                    console.log(`   ├─ userData.authUID: ${modal.userData.authUID || 'N/A'}`);
                    console.log(`   ├─ userData.email: ${modal.userData.email || 'N/A'}`);
                    console.log(`   └─ userData.displayName: ${modal.userData.displayName || 'N/A'}`);

                    if (!modal.userData.uid) {
                        issues.push('❌ userData.uid חסר! זו הסיבה שהצ\'אט לא עובד!');
                    } else if (modal.userData.uid === 'undefined' || modal.userData.uid.includes('undefined')) {
                        issues.push('❌ userData.uid מכיל "undefined"! זו הסיבה שהצ\'אט לא עובד!');
                    } else {
                        success.push('✅ userData.uid תקין');
                    }
                }

                // Check renderChatTab method
                if (typeof modal.renderChatTab !== 'function') {
                    issues.push('❌ modal.renderChatTab method לא קיים');
                } else {
                    success.push('✅ modal.renderChatTab method קיים');
                }

                // Check chat listener
                if (modal.chatListener) {
                    success.push('✅ Chat listener פעיל');
                } else {
                    warnings.push('⚠️ Chat listener לא פעיל (נורמלי אם לא לחצת על טאב צ\'אט)');
                }

                // ============================================
                // 5. Check Conversation ID
                // ============================================
                console.log('\n5️⃣ Checking Conversation ID...');

                if (window.chatManager && modal.userData?.uid && window.firebaseAuth?.currentUser) {
                    const adminUid = window.firebaseAuth.currentUser.uid;
                    const employeeUid = modal.userData.uid;
                    const conversationId = window.chatManager.getConversationId(adminUid, employeeUid);

                    console.log(`   👨‍💼 Admin UID: ${adminUid}`);
                    console.log(`   👤 Employee UID: ${employeeUid}`);
                    console.log(`   💬 Conversation ID: ${conversationId}`);

                    if (conversationId.includes('undefined')) {
                        issues.push(`❌ Conversation ID מכיל "undefined": ${conversationId}`);
                    } else if (!/^conv_[^_]+_[^_]+$/.test(conversationId)) {
                        issues.push(`❌ Conversation ID בפורמט שגוי: ${conversationId}`);
                    } else {
                        success.push('✅ Conversation ID תקין');
                    }
                } else {
                    warnings.push('⚠️ לא ניתן לבדוק Conversation ID - חסרים נתונים');
                }
            }
        }
    }

    // ============================================
    // 6. Check DOM Elements
    // ============================================
    console.log('\n6️⃣ Checking DOM Elements...');

    const chatTab = document.querySelector('.tab-chat');
    if (!chatTab) {
        warnings.push('⚠️ טאב הצ\'אט לא נמצא בDOM - לחץ על טאב "צ\'אט"!');
    } else {
        success.push('✅ טאב הצ\'אט קיים בDOM');

        const messagesContainer = chatTab.querySelector('.modal-chat-messages');
        const inputField = chatTab.querySelector('.modal-chat-input');
        const sendButton = chatTab.querySelector('.modal-chat-send-btn');

        console.log(`   📦 Messages Container: ${messagesContainer ? '✅' : '❌'}`);
        console.log(`   ✏️ Input Field: ${inputField ? '✅' : '❌'}`);
        console.log(`   📤 Send Button: ${sendButton ? '✅' : '❌'}`);

        if (!messagesContainer) {
warnings.push('⚠️ Messages container לא נמצא');
}
        if (!inputField) {
warnings.push('⚠️ Input field לא נמצא');
}
        if (!sendButton) {
warnings.push('⚠️ Send button לא נמצא');
}
    }

    // ============================================
    // 7. Print Summary
    // ============================================
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                      📊 SUMMARY                               ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');

    console.log(`║  ✅ Success: ${success.length}`);
    console.log(`║  ⚠️ Warnings: ${warnings.length}`);
    console.log(`║  ❌ Issues: ${issues.length}`);
    console.log('╠═══════════════════════════════════════════════════════════════╣');

    if (issues.length > 0) {
        console.log('║  🚨 ISSUES FOUND:');
        issues.forEach(issue => console.log(`║     ${issue}`));
    }

    if (warnings.length > 0) {
        console.log('║  ⚠️ WARNINGS:');
        warnings.forEach(warning => console.log(`║     ${warning}`));
    }

    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    // ============================================
    // 8. Final Verdict
    // ============================================
    if (issues.length === 0 && warnings.length <= 2) {
        console.log('🎉 הכל תקין! המערכת מוכנה לשימוש.');
        console.log('💡 כעת נסה לשלוח הודעה בצ\'אט.');
    } else if (issues.length > 0) {
        console.log('❌ נמצאו בעיות שמונעות את פעולת הצ\'אט!');
        console.log('\n🔧 פתרונות מומלצים:');
        console.log('   1. עשה Hard Refresh (Ctrl+Shift+R)');
        console.log('   2. סגור את המודל ופתח אותו שוב');
        console.log('   3. בדוק שהקובץ UserDetailsModal.js?v=20251201v2 נטען (Network tab)');
        console.log('   4. בדוק את Firestore Rules');
    } else {
        console.log('⚠️ המערכת פעילה חלקית.');
        console.log('💡 רוב האזהרות תיפתרנה כשתלחץ על טאב הצ\'אט.');
    }

    // ============================================
    // 9. Return diagnostic object for further testing
    // ============================================
    return {
        success: success.length,
        warnings: warnings.length,
        issues: issues.length,
        allIssues: issues,
        allWarnings: warnings,
        allSuccess: success,
        modal: window.ModalManager?.modals ?
               window.ModalManager.modals[Object.keys(window.ModalManager.modals)[0]] :
               null,
        conversationId: (window.chatManager &&
                        window.ModalManager?.modals &&
                        Object.keys(window.ModalManager.modals).length > 0) ?
                        window.chatManager.getConversationId(
                            window.firebaseAuth.currentUser.uid,
                            window.ModalManager.modals[Object.keys(window.ModalManager.modals)[0]].userData?.uid
                        ) : null
    };
})();
