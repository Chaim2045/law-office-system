/**
 * 🔍 Admin Panel Console Diagnostics
 * העתק והדבק את הקוד הזה בקונסול של הדפדפן (F12)
 * כשאתה על דף ה-Admin Panel
 */

console.clear();
console.log('%c🔍 Admin Panel Diagnostics Tool', 'font-size: 24px; font-weight: bold; color: #667eea;');
console.log('%c═══════════════════════════════════════════════════════════', 'color: #999;');

// =====================================================
// 1️⃣ FIREBASE CHECKS
// =====================================================
console.log('\n%c🔥 Firebase Checks', 'font-size: 18px; font-weight: bold; color: #ff6b35;');
console.log('─'.repeat(50));

if (typeof firebase !== 'undefined') {
    console.log('✅ Firebase SDK loaded');
    console.log('   Version:', firebase.SDK_VERSION);

    if (firebase.apps && firebase.apps.length > 0) {
        console.log('✅ Firebase Apps initialized:', firebase.apps.length);
        firebase.apps.forEach((app, index) => {
            console.log(`   ${index + 1}. App Name: "${app.name}"`);
            console.log('      Project ID:', app.options.projectId);
            console.log('      Auth Domain:', app.options.authDomain);
        });
    } else {
        console.error('❌ No Firebase Apps initialized!');
    }
} else {
    console.error('❌ Firebase SDK not loaded!');
}

// Check global Firebase instances
console.log('\n📦 Global Firebase Instances:');
console.log('   window.firebaseApp:', window.firebaseApp ? '✅ קיים' : '❌ לא קיים');
console.log('   window.firebaseAuth:', window.firebaseAuth ? '✅ קיים' : '❌ לא קיים');
console.log('   window.firebaseDB:', window.firebaseDB ? '✅ קיים' : '❌ לא קיים');
console.log('   window.firebaseFunctions:', window.firebaseFunctions ? '✅ קיים' : '❌ לא קיים');

// =====================================================
// 2️⃣ AUTHENTICATION CHECKS
// =====================================================
console.log('\n%c🔐 Authentication Checks', 'font-size: 18px; font-weight: bold; color: #4ecdc4;');
console.log('─'.repeat(50));

if (window.firebaseAuth) {
    const currentUser = window.firebaseAuth.currentUser;

    if (currentUser) {
        console.log('✅ User is authenticated');
        console.log('   Email:', currentUser.email);
        console.log('   UID:', currentUser.uid);
        console.log('   Display Name:', currentUser.displayName || 'Not set');
        console.log('   Email Verified:', currentUser.emailVerified ? '✅' : '❌');

        // Get ID Token with claims
        currentUser.getIdTokenResult()
            .then(tokenResult => {
                console.log('\n🎫 ID Token Claims:');
                console.log('   Auth Time:', new Date(tokenResult.authTime).toLocaleString('he-IL'));
                console.log('   Issued At:', new Date(tokenResult.issuedAtTime).toLocaleString('he-IL'));
                console.log('   Expiration:', new Date(tokenResult.expirationTime).toLocaleString('he-IL'));
                console.log('   Custom Claims:', tokenResult.claims);

                // Check admin status
                const isAdmin = tokenResult.claims.admin === true || tokenResult.claims.role === 'admin';
                console.log(`   ${isAdmin ? '✅' : '❌'} Admin Status:`, isAdmin);
            })
            .catch(error => {
                console.error('❌ Error getting ID token:', error);
            });
    } else {
        console.warn('⚠️  No user is currently authenticated');
    }
} else {
    console.error('❌ Firebase Auth not available!');
}

// Check AuthSystem
console.log('\n📦 AuthSystem:');
if (window.AuthSystem) {
    console.log('✅ AuthSystem exists');
    console.log('   Is Admin?', window.AuthSystem.isCurrentUserAdmin ? window.AuthSystem.isCurrentUserAdmin() : 'Method not found');
    console.log('   Current User:', window.AuthSystem.getCurrentAdmin ? window.AuthSystem.getCurrentAdmin() : 'Method not found');
} else {
    console.error('❌ AuthSystem not found!');
}

// =====================================================
// 3️⃣ FIRESTORE CHECKS
// =====================================================
console.log('\n%c📊 Firestore Checks', 'font-size: 18px; font-weight: bold; color: #95e1d3;');
console.log('─'.repeat(50));

if (window.firebaseDB) {
    console.log('✅ Firestore instance available');

    // Test employees collection
    console.log('\n🔍 Testing employees collection...');
    window.firebaseDB.collection('employees').limit(5).get()
        .then(snapshot => {
            console.log(`✅ Found ${snapshot.size} employees (showing max 5)`);
            snapshot.forEach((doc, index) => {
                const data = doc.data();
                console.log(`   ${index + 1}. ${doc.id}`);
                console.log('      Email:', data.email || 'N/A');
                console.log('      Role:', data.role || 'N/A');
                console.log('      Name:', data.firstName || data.fullName || 'N/A');
            });
        })
        .catch(error => {
            console.error('❌ Error reading employees:', error.message);
            console.error('   Code:', error.code);
            if (error.code === 'permission-denied') {
                console.error('   🔒 Permission denied - check Firestore rules');
            }
        });

    // Test cases collection
    console.log('\n🔍 Testing cases collection...');
    window.firebaseDB.collection('cases').limit(3).get()
        .then(snapshot => {
            console.log(`✅ Found ${snapshot.size} cases (showing max 3)`);
            snapshot.forEach((doc, index) => {
                const data = doc.data();
                console.log(`   ${index + 1}. ${doc.id}`);
                console.log('      Client:', data.clientName || 'N/A');
                console.log('      Status:', data.status || 'N/A');
            });
        })
        .catch(error => {
            console.error('❌ Error reading cases:', error.message);
        });
} else {
    console.error('❌ Firestore not available!');
}

// =====================================================
// 4️⃣ DATA MANAGER CHECKS
// =====================================================
console.log('\n%c📈 Data Manager Checks', 'font-size: 18px; font-weight: bold; color: #f38181;');
console.log('─'.repeat(50));

if (window.DataManager) {
    console.log('✅ DataManager exists');
    console.log('   Initialized?', window.DataManager.initialized || 'Unknown');
    console.log('   DB Connection:', window.DataManager.db ? '✅ קיים' : '❌ לא קיים');

    // Check if data is loaded
    if (window.DataManager.users) {
        console.log('   Users loaded:', Array.isArray(window.DataManager.users) ? window.DataManager.users.length : 'Not an array');
    } else {
        console.warn('   ⚠️  No users data loaded yet');
    }
} else {
    console.error('❌ DataManager not found!');
}

// =====================================================
// 5️⃣ UI COMPONENTS CHECKS
// =====================================================
console.log('\n%c🎨 UI Components Checks', 'font-size: 18px; font-weight: bold; color: #aa96da;');
console.log('─'.repeat(50));

const uiComponents = {
    'DashboardUI': window.DashboardUI,
    'Modals': window.Modals,
    'Notifications': window.Notifications,
    'UsersTable': window.UsersTable,
    'StatsCards': window.StatsCards,
    'FilterBar': window.FilterBar,
    'Pagination': window.Pagination,
    'UserForm': window.UserForm,
    'UserDetailsModal': window.UserDetailsModal,
    'UsersActions': window.UsersActions,
    'AuditLogger': window.AuditLogger
};

let componentsFound = 0;
let componentsTotal = Object.keys(uiComponents).length;

for (const [name, component] of Object.entries(uiComponents)) {
    if (component) {
        console.log(`✅ ${name}`);
        componentsFound++;
    } else {
        console.warn(`⚠️  ${name} - not found`);
    }
}

console.log(`\n📊 Components: ${componentsFound}/${componentsTotal} loaded`);

// =====================================================
// 6️⃣ DOM ELEMENTS CHECKS
// =====================================================
console.log('\n%c🌐 DOM Elements Checks', 'font-size: 18px; font-weight: bold; color: #fcbad3;');
console.log('─'.repeat(50));

const requiredElements = {
    'loginScreen': 'Login Screen',
    'dashboardScreen': 'Dashboard Screen',
    'loginForm': 'Login Form',
    'emailInput': 'Email Input',
    'passwordInput': 'Password Input',
    'loginButton': 'Login Button',
    'logoutButton': 'Logout Button',
    'dashboardContent': 'Dashboard Content'
};

let elementsFound = 0;
let elementsTotal = Object.keys(requiredElements).length;

for (const [id, name] of Object.entries(requiredElements)) {
    const element = document.getElementById(id);
    if (element) {
        console.log(`✅ ${name} (#${id})`);
        elementsFound++;
    } else {
        console.warn(`⚠️  ${name} (#${id}) - not found`);
    }
}

console.log(`\n📊 DOM Elements: ${elementsFound}/${elementsTotal} found`);

// =====================================================
// 7️⃣ NETWORK CHECKS
// =====================================================
console.log('\n%c🌍 Network Checks', 'font-size: 18px; font-weight: bold; color: #ffbe0b;');
console.log('─'.repeat(50));

console.log('Online Status:', navigator.onLine ? '✅ Online' : '❌ Offline');

// Check Firebase connection
if (window.firebaseDB) {
    console.log('\n🔍 Testing Firestore connectivity...');
    window.firebaseDB.collection('_test_connection_').limit(1).get()
        .then(() => {
            console.log('✅ Firestore connection successful');
        })
        .catch(error => {
            console.error('❌ Firestore connection failed:', error.message);
        });
}

// =====================================================
// 8️⃣ BROWSER CHECKS
// =====================================================
console.log('\n%c🌐 Browser Information', 'font-size: 18px; font-weight: bold; color: #06ffa5;');
console.log('─'.repeat(50));

console.log('User Agent:', navigator.userAgent);
console.log('Language:', navigator.language);
console.log('Platform:', navigator.platform);
console.log('Cookies Enabled:', navigator.cookieEnabled ? '✅' : '❌');

// Check localStorage
try {
    localStorage.setItem('_test', '1');
    localStorage.removeItem('_test');
    console.log('LocalStorage:', '✅ Available');
} catch (e) {
    console.error('LocalStorage:', '❌ Not available');
}

// Check sessionStorage
try {
    sessionStorage.setItem('_test', '1');
    sessionStorage.removeItem('_test');
    console.log('SessionStorage:', '✅ Available');
} catch (e) {
    console.error('SessionStorage:', '❌ Not available');
}

// =====================================================
// 9️⃣ CONSOLE ERRORS CHECK
// =====================================================
console.log('\n%c⚠️  Console Errors', 'font-size: 18px; font-weight: bold; color: #ff006e;');
console.log('─'.repeat(50));
console.log('Check the Console tab for any errors (red messages)');
console.log('Common issues to look for:');
console.log('  • CORS errors');
console.log('  • 404 File not found');
console.log('  • Permission denied');
console.log('  • Uncaught TypeError');

// =====================================================
// 🎯 SUMMARY
// =====================================================
console.log('\n%c═══════════════════════════════════════════════════════════', 'color: #999;');
console.log('%c🎯 Quick Summary', 'font-size: 20px; font-weight: bold; color: #667eea;');
console.log('%c═══════════════════════════════════════════════════════════', 'color: #999;');

const summary = {
    'Firebase SDK': typeof firebase !== 'undefined',
    'Firebase App': firebase?.apps?.length > 0,
    'Auth Available': !!window.firebaseAuth,
    'User Logged In': !!window.firebaseAuth?.currentUser,
    'Firestore Available': !!window.firebaseDB,
    'DataManager': !!window.DataManager,
    'UI Components': componentsFound > componentsTotal / 2,
    'DOM Elements': elementsFound > elementsTotal / 2
};

for (const [check, status] of Object.entries(summary)) {
    console.log(`${status ? '✅' : '❌'} ${check}`);
}

console.log('\n%c💡 Next Steps:', 'font-weight: bold; color: #667eea;');
if (!window.firebaseAuth?.currentUser) {
    console.log('   1. Try logging in with admin credentials');
    console.log('   2. Check if you see any errors during login');
} else {
    console.log('   1. Everything looks good!');
    console.log('   2. If you still see issues, check the Network tab (F12)');
}

console.log('\n%c═══════════════════════════════════════════════════════════', 'color: #999;');
console.log('%c✨ Diagnostics Complete!', 'font-size: 18px; font-weight: bold; color: #28a745;');
