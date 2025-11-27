/**
 * User Form Component
 * קומפוננטת טופס משתמש
 *
 * נוצר: 31/10/2025
 * גרסה: 1.0.0
 * Phase: 3 - User Management Logic
 *
 * תפקיד: טופס ליצירה ועריכת משתמשים
 */

(function() {
    'use strict';

    /**
     * UserForm Class
     * מנהל את טופס המשתמש
     */
    class UserForm {
        constructor() {
            this.currentUser = null; // User being edited (null for new user)
            this.mode = 'create'; // 'create' or 'edit'
            this.modalId = null;
            this.validationErrors = {};
        }

        /**
         * Open user form
         * פתיחת טופס משתמש
         *
         * @param {Object} user - User data (null for new user)
         */
        open(user = null) {
            this.currentUser = user;
            this.mode = user ? 'edit' : 'create';
            this.validationErrors = {};

            const title = this.mode === 'create' ? 'הוספת משתמש חדש' : 'עריכת משתמש';

            this.modalId = window.ModalManager.create({
                title: title,
                content: this.renderForm(),
                footer: this.renderFooter(),
                size: 'medium',
                onOpen: () => {
                    this.setupFormEvents();
                    this.populateForm();
                }
            });

            console.log(`✅ UserForm opened in ${this.mode} mode`);
        }

        /**
         * Render form HTML
         * רינדור HTML של הטופס
         */
        renderForm() {
            return `
                <form id="userManagementForm" class="user-form" novalidate>
                    <!-- Display Name -->
                    <div class="form-group">
                        <label for="displayName" class="form-label">
                            <i class="fas fa-user"></i>
                            <span>שם מלא *</span>
                        </label>
                        <input
                            type="text"
                            id="displayName"
                            name="displayName"
                            class="form-input"
                            placeholder="הזן שם מלא"
                            required
                            ${this.mode === 'edit' ? '' : 'autofocus'}
                        >
                        <div class="form-error" data-error="displayName"></div>
                    </div>

                    <!-- Email -->
                    <div class="form-group">
                        <label for="email" class="form-label">
                            <i class="fas fa-envelope"></i>
                            <span>כתובת אימייל *</span>
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            class="form-input"
                            placeholder="example@company.com"
                            required
                            ${this.mode === 'edit' ? 'readonly' : ''}
                        >
                        <div class="form-error" data-error="email"></div>
                        ${this.mode === 'edit' ? '<small class="form-hint">לא ניתן לשנות כתובת אימייל</small>' : ''}
                    </div>

                    ${this.mode === 'create' ? `
                        <!-- Password (Create Only) -->
                        <div class="form-group">
                            <label for="password" class="form-label">
                                <i class="fas fa-lock"></i>
                                <span>סיסמה *</span>
                            </label>
                            <div class="password-input-wrapper">
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    class="form-input"
                                    placeholder="לפחות 6 תווים"
                                    required
                                    minlength="6"
                                >
                                <button type="button" class="password-toggle-btn" id="togglePasswordBtn">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                            <div class="form-error" data-error="password"></div>
                        </div>
                    ` : ''}

                    <!-- Role -->
                    <div class="form-group">
                        <label for="role" class="form-label">
                            <i class="fas fa-user-tag"></i>
                            <span>תפקיד *</span>
                        </label>
                        <select id="role" name="role" class="form-select" required>
                            <option value="">בחר תפקיד</option>
                            <option value="user">משתמש</option>
                            <option value="admin">מנהל</option>
                        </select>
                        <div class="form-error" data-error="role"></div>
                        <small class="form-hint">מנהלים יכולים לגשת לפאנל הניהול</small>
                    </div>

                    <!-- Status (Edit Only) -->
                    ${this.mode === 'edit' ? `
                        <div class="form-group">
                            <label for="status" class="form-label">
                                <i class="fas fa-toggle-on"></i>
                                <span>סטטוס</span>
                            </label>
                            <select id="status" name="status" class="form-select">
                                <option value="active">פעיל</option>
                                <option value="blocked">חסום</option>
                            </select>
                            <small class="form-hint">משתמשים חסומים לא יוכלו להתחבר</small>
                        </div>
                    ` : ''}

                    <!-- Username (Optional) -->
                    <div class="form-group">
                        <label for="username" class="form-label">
                            <i class="fas fa-at"></i>
                            <span>שם משתמש (אופציונלי)</span>
                        </label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            class="form-input"
                            placeholder="ללא רווחים"
                        >
                        <div class="form-error" data-error="username"></div>
                        <small class="form-hint">אם לא מוזן, יוצר אוטומטית מהאימייל</small>
                    </div>
                </form>
            `;
        }

        /**
         * Render footer buttons
         * רינדור כפתורי פוטר
         */
        renderFooter() {
            return `
                <button type="button" class="btn btn-secondary" id="userFormCancelBtn">
                    <i class="fas fa-times"></i>
                    <span>ביטול</span>
                </button>
                <button type="button" class="btn btn-primary" id="userFormSubmitBtn">
                    <i class="fas fa-save"></i>
                    <span>${this.mode === 'create' ? 'צור משתמש' : 'שמור שינויים'}</span>
                </button>
            `;
        }

        /**
         * Setup form event listeners
         * הגדרת מאזיני אירועים לטופס
         */
        setupFormEvents() {
            const modal = window.ModalManager.getElement(this.modalId);
            if (!modal) {
return;
}

            // Cancel button
            const cancelBtn = modal.querySelector('#userFormCancelBtn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    this.close();
                });
            }

            // Submit button
            const submitBtn = modal.querySelector('#userFormSubmitBtn');
            if (submitBtn) {
                submitBtn.addEventListener('click', () => {
                    this.handleSubmit();
                });
            }

            // Form Enter key
            const form = modal.querySelector('#userManagementForm');
            if (form) {
                form.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                        e.preventDefault();
                        this.handleSubmit();
                    }
                });
            }

            // Real-time validation
            const inputs = modal.querySelectorAll('.form-input, .form-select');
            inputs.forEach(input => {
                input.addEventListener('blur', () => {
                    this.validateField(input.name);
                });

                input.addEventListener('input', () => {
                    // Clear error on input
                    this.clearFieldError(input.name);
                });
            });

            // Password toggle (Create mode only)
            if (this.mode === 'create') {
                const toggleBtn = modal.querySelector('#togglePasswordBtn');
                const passwordInput = modal.querySelector('#password');
                if (toggleBtn && passwordInput) {
                    toggleBtn.addEventListener('click', () => {
                        const type = passwordInput.type === 'password' ? 'text' : 'password';
                        passwordInput.type = type;

                        const icon = toggleBtn.querySelector('i');
                        icon.classList.toggle('fa-eye');
                        icon.classList.toggle('fa-eye-slash');
                    });
                }
            }
        }

        /**
         * Populate form with user data (Edit mode)
         * אכלוס טופס עם נתוני משתמש
         */
        populateForm() {
            if (this.mode === 'create' || !this.currentUser) {
return;
}

            const modal = window.ModalManager.getElement(this.modalId);
            if (!modal) {
return;
}

            const form = modal.querySelector('#userManagementForm');
            if (!form) {
return;
}

            // Populate fields
            const fields = ['displayName', 'email', 'role', 'status', 'username'];
            fields.forEach(field => {
                const input = form.querySelector(`[name="${field}"]`);
                if (input && this.currentUser[field] !== undefined) {
                    input.value = this.currentUser[field];
                }
            });

            console.log('✅ Form populated with user data');
        }

        /**
         * Validate single field
         * אימות שדה בודד
         */
        validateField(fieldName) {
            const modal = window.ModalManager.getElement(this.modalId);
            if (!modal) {
return false;
}

            const form = modal.querySelector('#userManagementForm');
            const input = form.querySelector(`[name="${fieldName}"]`);
            if (!input) {
return false;
}

            const value = input.value.trim();
            let error = null;

            switch (fieldName) {
                case 'displayName':
                    if (!value) {
                        error = 'שם מלא הוא שדה חובה';
                    } else if (value.length < 2) {
                        error = 'שם מלא חייב להכיל לפחות 2 תווים';
                    } else if (value.length > 100) {
                        error = 'שם מלא ארוך מדי (מקסימום 100 תווים)';
                    }
                    break;

                case 'email':
                    if (!value) {
                        error = 'אימייל הוא שדה חובה';
                    } else if (!this.isValidEmail(value)) {
                        error = 'כתובת אימייל לא תקינה';
                    } else if (value.length > 254) {
                        error = 'כתובת אימייל ארוכה מדי (מקסימום 254 תווים)';
                    }
                    break;

                case 'password':
                    if (this.mode === 'create') {
                        if (!value) {
                            error = 'סיסמה היא שדה חובה';
                        } else if (value.length < 6) {
                            error = 'סיסמה חייבת להכיל לפחות 6 תווים';
                        } else if (value.length > 128) {
                            error = 'סיסמה ארוכה מדי (מקסימום 128 תווים)';
                        }
                    }
                    break;

                case 'role':
                    if (!value) {
                        error = 'תפקיד הוא שדה חובה';
                    } else if (!window.AdminPanelHelpers.isValidRole(value)) {
                        error = 'תפקיד לא חוקי';
                    }
                    break;

                case 'username':
                    if (value && value.includes(' ')) {
                        error = 'שם משתמש לא יכול להכיל רווחים';
                    } else if (value && value.length > 50) {
                        error = 'שם משתמש ארוך מדי (מקסימום 50 תווים)';
                    }
                    break;
            }

            if (error) {
                this.showFieldError(fieldName, error);
                return false;
            } else {
                this.clearFieldError(fieldName);
                return true;
            }
        }

        /**
         * Validate entire form
         * אימות כל הטופס
         */
        validateForm() {
            const modal = window.ModalManager.getElement(this.modalId);
            if (!modal) {
return false;
}

            const form = modal.querySelector('#userManagementForm');
            const inputs = form.querySelectorAll('.form-input, .form-select');

            let isValid = true;

            inputs.forEach(input => {
                if (input.name && !this.validateField(input.name)) {
                    isValid = false;
                }
            });

            return isValid;
        }

        /**
         * Show field error
         * הצגת שגיאה בשדה
         */
        showFieldError(fieldName, errorMessage) {
            const modal = window.ModalManager.getElement(this.modalId);
            if (!modal) {
return;
}

            const errorElement = modal.querySelector(`[data-error="${fieldName}"]`);
            const inputElement = modal.querySelector(`[name="${fieldName}"]`);

            if (errorElement) {
                errorElement.textContent = errorMessage;
                errorElement.style.display = 'block';
            }

            if (inputElement) {
                inputElement.classList.add('input-error');
            }

            this.validationErrors[fieldName] = errorMessage;
        }

        /**
         * Clear field error
         * ניקוי שגיאה משדה
         */
        clearFieldError(fieldName) {
            const modal = window.ModalManager.getElement(this.modalId);
            if (!modal) {
return;
}

            const errorElement = modal.querySelector(`[data-error="${fieldName}"]`);
            const inputElement = modal.querySelector(`[name="${fieldName}"]`);

            if (errorElement) {
                errorElement.textContent = '';
                errorElement.style.display = 'none';
            }

            if (inputElement) {
                inputElement.classList.remove('input-error');
            }

            delete this.validationErrors[fieldName];
        }

        /**
         * Handle form submission
         * טיפול בשליחת הטופס
         */
        async handleSubmit() {
            console.log('📝 Submitting user form...');

            // Validate form
            if (!this.validateForm()) {
                window.notify.error('אנא תקן את השגיאות בטופס');
                return;
            }

            // Get form data
            const formData = this.getFormData();

            // Show loading notification
            const loadingId = window.notify.loading(
                this.mode === 'create' ? 'יוצר משתמש חדש...' : 'שומר שינויים...'
            );

            try {
                if (this.mode === 'create') {
                    await this.createUser(formData);
                } else {
                    await this.updateUser(formData);
                }

                // Hide loading
                window.notify.hide(loadingId);

                // Show success
                window.notify.success(
                    this.mode === 'create'
                        ? 'המשתמש נוצר בהצלחה!'
                        : 'השינויים נשמרו בהצלחה!'
                );

                // Close form
                this.close();

                // Trigger data refresh
                window.dispatchEvent(new CustomEvent('data:refresh'));

            } catch (error) {
                console.error('❌ Form submission error:', error);

                // Hide loading
                window.notify.hide(loadingId);

                // Show error
                window.notify.error(error.message || 'אירעה שגיאה בביצוע הפעולה');
            }
        }

        /**
         * Get form data
         * קבלת נתוני הטופס
         */
        getFormData() {
            const modal = window.ModalManager.getElement(this.modalId);
            if (!modal) {
return null;
}

            const form = modal.querySelector('#userManagementForm');
            const formData = new FormData(form);

            const data = {};
            for (const [key, value] of formData.entries()) {
                data[key] = value.trim();
            }

            return data;
        }

        /**
         * Create new user
         * יצירת משתמש חדש
         */
        async createUser(userData) {
            console.log('➕ Creating user:', userData.email);

            try {
                // Call Cloud Function to create user
                const createUserFunction = window.firebaseFunctions.httpsCallable('createUser');

                const result = await createUserFunction({
                    email: userData.email,
                    password: userData.password,
                    displayName: userData.displayName,
                    username: userData.username || userData.email.split('@')[0],
                    role: userData.role,
                    phone: userData.phone || ''
                });

                console.log('✅ User created successfully:', result.data);

                // Log to audit
                if (window.AuditLogger && window.AuditLogger.initialized) {
                    await window.AuditLogger.logUserCreation(userData.email, {
                        username: userData.username || userData.email.split('@')[0],
                        role: userData.role,
                        status: 'active'
                    });
                }

                return result.data;

            } catch (error) {
                console.error('❌ Error creating user:', error);

                // Parse Firebase error messages
                let errorMessage = error.message || 'אירעה שגיאה ביצירת המשתמש';

                if (error.code === 'already-exists') {
                    errorMessage = 'משתמש עם כתובת מייל זו כבר קיים במערכת';
                } else if (error.code === 'invalid-argument') {
                    errorMessage = error.message;
                } else if (error.code === 'permission-denied') {
                    errorMessage = 'אין לך הרשאות לבצע פעולה זו';
                } else if (error.code === 'unauthenticated') {
                    errorMessage = 'יש להתחבר מחדש למערכת';
                }

                throw new Error(errorMessage);
            }
        }

        /**
         * Update existing user
         * עדכון משתמש קיים
         */
        async updateUser(userData) {
            console.log('✏️ Updating user:', userData.email);

            try {
                // Get old data for audit log
                const oldData = { ...this.currentUser };

                // Call Cloud Function to update user
                const updateUserFunction = window.firebaseFunctions.httpsCallable('updateUser');

                const result = await updateUserFunction({
                    email: userData.email,
                    displayName: userData.displayName,
                    username: userData.username,
                    role: userData.role,
                    status: userData.status,
                    phone: userData.phone
                });

                console.log('✅ User updated successfully:', result.data);

                // Log to audit
                if (window.AuditLogger && window.AuditLogger.initialized) {
                    const changes = {};
                    Object.keys(userData).forEach(key => {
                        if (oldData[key] !== userData[key]) {
                            changes[key] = { old: oldData[key], new: userData[key] };
                        }
                    });

                    await window.AuditLogger.logUserUpdate(userData.email, changes, oldData);
                }

                return result.data;

            } catch (error) {
                console.error('❌ Error updating user:', error);

                // Parse Firebase error messages
                let errorMessage = error.message || 'אירעה שגיאה בעדכון המשתמש';

                if (error.code === 'not-found') {
                    errorMessage = 'המשתמש לא נמצא במערכת';
                } else if (error.code === 'invalid-argument') {
                    errorMessage = error.message;
                } else if (error.code === 'permission-denied') {
                    errorMessage = 'אין לך הרשאות לבצע פעולה זו';
                }

                throw new Error(errorMessage);
            }
        }

        /**
         * Validate email format
         * אימות פורמט אימייל
         */
        isValidEmail(email) {
            const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return regex.test(email);
        }

        /**
         * Close form
         * סגירת הטופס
         */
        close() {
            if (this.modalId) {
                window.ModalManager.close(this.modalId);
                this.modalId = null;
            }

            this.currentUser = null;
            this.mode = 'create';
            this.validationErrors = {};

            console.log('✅ UserForm closed');
        }
    }

    // Create global instance
    const userForm = new UserForm();

    // Make UserForm available globally
    window.UserForm = userForm;

    // Export for ES6 modules (if needed in the future)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = userForm;
    }

})();
