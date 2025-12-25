/**
 * PasswordInput Component
 *
 * Enhanced password input field with:
 * - Toggle visibility button (eye icon)
 * - Caps Lock detection and warning
 * - Clean component-based architecture
 *
 * Features:
 * - Show/hide password with eye icon toggle
 * - Real-time Caps Lock detection
 * - Automatic warning display/hide
 * - Accessible (aria-label, keyboard support)
 * - Reusable component
 *
 * Usage:
 *   const passwordInput = new PasswordInput(
 *       document.getElementById('password'),
 *       { showToggleButton: true, showCapsLockWarning: true }
 *   );
 *
 *   const password = passwordInput.getValue();
 */

class PasswordInput {
    /**
     * @param {HTMLInputElement} inputElement - The password input element
     * @param {Object} options - Configuration options
     * @param {boolean} options.showToggleButton - Show visibility toggle button (default: true)
     * @param {boolean} options.showCapsLockWarning - Show Caps Lock warning (default: true)
     */
    constructor(inputElement, options = {}) {
        this.input = inputElement;
        this.options = {
            showToggleButton: true,
            showCapsLockWarning: true,
            ...options
        };

        this.wrapper = null;
        this.toggleBtn = null;
        this.capsLockWarning = null;

        this.init();
    }

    /**
     * Initialize component
     * Sets up wrapper, toggle button, and caps lock warning
     */
    init() {
        this.wrapInput();

        if (this.options.showToggleButton) {
            this.createToggleButton();
        }

        if (this.options.showCapsLockWarning) {
            this.createCapsLockWarning();
            this.attachCapsLockListeners();
        }
    }

    /**
     * Wrap input in container div
     * Allows for absolute positioning of toggle button
     */
    wrapInput() {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'password-input-wrapper';

        this.input.parentNode.insertBefore(this.wrapper, this.input);
        this.wrapper.appendChild(this.input);
    }

    /**
     * Create toggle visibility button (eye icon)
     */
    createToggleButton() {
        this.toggleBtn = document.createElement('button');
        this.toggleBtn.type = 'button';
        this.toggleBtn.className = 'password-toggle-btn';
        this.toggleBtn.setAttribute('aria-label', 'הצג/הסתר סיסמה');
        this.toggleBtn.setAttribute('tabindex', '-1'); // Don't include in tab order

        const icon = document.createElement('i');
        icon.className = 'fas fa-eye';
        icon.id = `toggle-icon-${this.input.id || 'password'}`;

        this.toggleBtn.appendChild(icon);
        this.wrapper.appendChild(this.toggleBtn);

        // Attach click listener
        this.toggleBtn.addEventListener('click', () => this.toggleVisibility());
    }

    /**
     * Create Caps Lock warning element
     */
    createCapsLockWarning() {
        this.capsLockWarning = document.createElement('div');
        this.capsLockWarning.className = 'caps-lock-warning';

        const icon = document.createElement('i');
        icon.className = 'fas fa-exclamation-triangle';

        const text = document.createElement('span');
        text.textContent = 'Caps Lock פעיל - אותיות גדולות';

        this.capsLockWarning.appendChild(icon);
        this.capsLockWarning.appendChild(text);

        // Insert after wrapper (sibling element)
        this.wrapper.parentNode.insertBefore(
            this.capsLockWarning,
            this.wrapper.nextSibling
        );
    }

    /**
     * Toggle password visibility
     * Switches between password and text input type
     * Updates icon accordingly
     */
    toggleVisibility() {
        const icon = this.toggleBtn.querySelector('i');
        const isPassword = this.input.type === 'password';

        // Toggle input type
        this.input.type = isPassword ? 'text' : 'password';

        // Update icon
        if (isPassword) {
            // Showing password - use eye-slash icon
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            // Hiding password - use eye icon
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    /**
     * Attach Caps Lock detection listeners
     * Monitors keyboard events to detect Caps Lock state
     */
    attachCapsLockListeners() {
        const checkCapsLock = (event) => {
            // Use getModifierState to check Caps Lock
            const capsLockOn = event.getModifierState && event.getModifierState('CapsLock');

            if (capsLockOn) {
                this.capsLockWarning.classList.add('show');
            } else {
                this.capsLockWarning.classList.remove('show');
            }
        };

        // Check on keydown and keyup
        this.input.addEventListener('keydown', checkCapsLock);
        this.input.addEventListener('keyup', checkCapsLock);

        // Hide warning when input loses focus
        this.input.addEventListener('blur', () => {
            this.capsLockWarning.classList.remove('show');
        });
    }

    /**
     * Get current input value
     * @returns {string} Password value
     */
    getValue() {
        return this.input.value;
    }

    /**
     * Clear input value
     */
    clear() {
        this.input.value = '';
    }

    /**
     * Set input value
     * @param {string} value - Value to set
     */
    setValue(value) {
        this.input.value = value;
    }

    /**
     * Focus the input
     */
    focus() {
        this.input.focus();
    }

    /**
     * Destroy component
     * Removes all created elements and returns to original state
     */
    destroy() {
        // Remove toggle button
        if (this.toggleBtn) {
            this.toggleBtn.remove();
        }

        // Remove caps lock warning
        if (this.capsLockWarning) {
            this.capsLockWarning.remove();
        }

        // Unwrap input (return to original position)
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.insertBefore(this.input, this.wrapper);
            this.wrapper.remove();
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PasswordInput;
}
