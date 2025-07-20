// auth.js - הגנת סיסמה חכמה (מתוקן)
(function() {
    'use strict';
    
    // בדיקת אם המשתמש כבר התחבר
    const isAuthenticated = () => {
        const authToken = sessionStorage.getItem('gh_office_auth');
        const authTime = sessionStorage.getItem('gh_office_auth_time');
        
        // הסיסמה תקפה ל-8 שעות
        if (authToken && authTime) {
            const timeDiff = Date.now() - parseInt(authTime);
            return authToken === 'gh2025_authenticated' && timeDiff < (8 * 60 * 60 * 1000);
        }
        return false;
    };
    
    // אם לא מחובר - הצג מסך כניסה
    if (!isAuthenticated()) {
        showLoginScreen();
    }
    
    function showLoginScreen() {
        // שמור את התוכן המקורי
        const originalContent = document.body.innerHTML;
        
        // בנה את מסך הכניסה
        const loginHTML = buildLoginScreen();
        document.body.innerHTML = loginHTML;
        
        // הגדר את פונקציית הכניסה
        setupLoginFunction(originalContent);
        
        // פוקוס על שדה הסיסמה
        setTimeout(() => {
            document.getElementById('officePassword').focus();
        }, 100);
    }
    
    function buildLoginScreen() {
        return `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #0f172a 100%);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 99999;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            ">
                <div style="
                    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
                    padding: 50px 40px;
                    border-radius: 20px;
                    text-align: center;
                    box-shadow: 0 25px 60px rgba(0,0,0,0.15);
                    border: 2px solid rgba(255,255,255,0.2);
                    max-width: 400px;
                    width: 90%;
                    animation: slideIn 0.5s ease;
                ">
                    <div style="font-size: 48px; margin-bottom: 20px;">🏢</div>
                    <h2 style="color: #1e293b; margin-bottom: 10px; font-size: 24px; font-weight: 700;">
                        משרד עו"ד גיא הרשקוביץ
                    </h2>
                    <p style="color: #64748b; margin-bottom: 30px; font-size: 16px;">
                        מערכת ניהול פנימית
                    </p>
                    
                    <div style="margin-bottom: 25px;">
                        <input type="password" 
                               id="officePassword" 
                               placeholder="הזן קוד גישה למערכת"
                               style="
                                   width: 100%;
                                   padding: 18px 24px;
                                   border: 2px solid #e5e7eb;
                                   border-radius: 12px;
                                   font-size: 16px;
                                   text-align: center;
                                   letter-spacing: 2px;
                                   font-weight: 600;
                                   transition: all 0.3s ease;
                                   box-sizing: border-box;
                               "
                               onkeypress="if(event.key==='Enter') attemptLogin()">
                    </div>
                    
                    <button onclick="attemptLogin()" style="
                        background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
                        color: white;
                        border: none;
                        padding: 18px 30px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        width: 100%;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 15px rgba(30,64,175,0.2);
                    ">
                        🔓 כניסה למערכת
                    </button>
                    
                    <div id="errorMessage" style="
                        color: #ef4444;
                        margin-top: 15px;
                        font-weight: 600;
                        display: none;
                        background: #fef2f2;
                        padding: 10px;
                        border-radius: 8px;
                        border: 1px solid #fecaca;
                    ">
                        קוד גישה שגוי - נסה שוב
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                        <small style="color: #9ca3af; font-size: 13px;">
                            🔒 מערכת מאובטחת - גישה למורשים בלבד
                        </small>
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(20px) scale(0.9); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .shake { animation: shake 0.5s ease; }
            </style>
        `;
    }
    
    function setupLoginFunction(originalContent) {
        // פונקציה לניסיון התחברות
        window.attemptLogin = function() {
            const password = document.getElementById('officePassword').value;
            const errorDiv = document.getElementById('errorMessage');
            
            // הסיסמאות המורשות
            const validPasswords = [
                'GH2025Office!',
                'GilaLaw2025',
                'משרד-גיא-2025'
            ];
            
            if (validPasswords.includes(password)) {
                // הצלחה - שמור אוטורייזציה
                sessionStorage.setItem('gh_office_auth', 'gh2025_authenticated');
                sessionStorage.setItem('gh_office_auth_time', Date.now().toString());
                
                // הצג הודעת הצלחה
                showSuccessMessage();
                
                // טען את הדף המקורי אחרי השהייה קצרה
                setTimeout(() => {
                    document.body.innerHTML = originalContent;
                    reloadScripts();
                }, 1500);
                
            } else {
                // שגיאה
                showError(errorDiv);
            }
        };
    }
    
    function showSuccessMessage() {
        document.body.innerHTML = `
            <div style="
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                display: flex; justify-content: center; align-items: center;
                color: white; font-size: 24px; font-weight: 600;
                font-family: 'Segoe UI', sans-serif; text-align: center;
            ">
                <div>
                    <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
                    <div>כניסה מוצלחת למערכת!</div>
                    <div style="font-size: 16px; margin-top: 10px; opacity: 0.9;">טוען...</div>
                </div>
            </div>
        `;
    }
    
    function showError(errorDiv) {
        errorDiv.style.display = 'block';
        document.getElementById('officePassword').value = '';
        document.getElementById('officePassword').className = 'shake';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
            document.getElementById('officePassword').className = '';
        }, 3000);
    }
    
    function reloadScripts() {
        // טען מחדש את הסקריפטים הדרושים
        const scripts = document.querySelectorAll('script');
        scripts.forEach(script => {
            if (script.src && !script.src.includes('auth.js')) {
                const newScript = document.createElement('script');
                newScript.src = script.src;
                document.head.appendChild(newScript);
            }
        });
    }
    
})();