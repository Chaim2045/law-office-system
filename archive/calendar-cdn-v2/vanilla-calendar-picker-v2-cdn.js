/**
 * VanillaCalendarPicker - Modular Date & Time Picker
 *
 * Ultra-Minimal Hi-Tech Design with Hebrew RTL Support
 * Uses VanillaCalendar Pro built-in time picker API
 *
 * @version 4.0.0
 * @author Law Office Management System
 */

class VanillaCalendarPicker {
  /**
   * Create a new calendar picker instance
   * @param {HTMLElement} inputElement - Input field to attach calendar to
   * @param {Object} options - Configuration options
   */
  constructor(inputElement, options = {}) {
    if (!inputElement) {
      Logger.error('VanillaCalendarPicker: Input element is required');
      return;
    }

    this.input = inputElement;
    this.options = {
      minDate: options.minDate || 'today',
      maxDate: options.maxDate || null,
      showTime: options.showTime === true,
      defaultHour: options.defaultHour !== undefined ? options.defaultHour : new Date().getHours(),
      defaultMinute: options.defaultMinute !== undefined ? options.defaultMinute : new Date().getMinutes(),
      onSelect: options.onSelect || null,
      ...options
    };

    this.calendar = null;
    this.backdrop = null;
    this.container = null;

    this.init();
  }

  /**
   * Initialize the calendar picker
   */
  init() {
    if (typeof VanillaCalendar === 'undefined') {
      Logger.error('VanillaCalendar library not loaded');
      return;
    }

    this.createBackdrop();
    this.createContainer();
    this.createCalendar();
    this.attachEventListeners();

    Logger.log('✅ VanillaCalendarPicker initialized for', this.input.id, 'showTime:', this.options.showTime);
  }

  /**
   * Create backdrop overlay
   */
  createBackdrop() {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'calendar-backdrop calendar-hidden';
    document.body.appendChild(this.backdrop);
    this.backdrop.addEventListener('click', () => this.close());
  }

  /**
   * Create calendar container
   */
  createContainer() {
    this.container = document.createElement('div');
    this.container.className = 'vanilla-calendar-wrapper calendar-hidden';
    this.container.setAttribute('dir', 'rtl');
    document.body.appendChild(this.container);
  }

  /**
   * Create and configure Vanilla Calendar instance
   * Uses built-in time picker with selection.time API
   */
  createCalendar() {
    const minDate = this.options.minDate === 'today'
      ? new Date().toISOString().split('T')[0]
      : this.options.minDate;

    // Build settings object
    const settings = {
      lang: 'he',
      iso8601: false,
      range: {
        min: minDate,
        max: this.options.maxDate
      },
      selection: {
        day: 'single',
      },
      selected: {
        dates: [],
        month: new Date().getMonth(),
        year: new Date().getFullYear(),
      },
      visibility: {
        theme: 'light',
      },
    };

    // ✅ Add time picker if enabled - using built-in API
    if (this.options.showTime) {
      settings.selection.time = 24; // 24-hour format

      // Set default time
      settings.selected.time =
        String(this.options.defaultHour).padStart(2, '0') + ':' +
        String(this.options.defaultMinute).padStart(2, '0');
    }

    this.calendar = new VanillaCalendar(this.container, {
      settings: settings,
      locale: {
        months: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
        weekday: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
      },
      actions: {
        clickDay: (event, self) => this.handleDayClick(event, self),
      }
    });

    Logger.log('📅 Calendar created with time picker:', this.options.showTime);
  }

  /**
   * Attach event listeners to input and document
   */
  attachEventListeners() {
    this.input.addEventListener('click', (e) => this.open(e));
    this.input.setAttribute('readonly', true);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.container.classList.contains('calendar-hidden')) {
        this.close();
      }
    });

    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target) &&
          !this.input.contains(e.target) &&
          !this.backdrop.classList.contains('calendar-hidden')) {
        this.close();
      }
    });
  }

  /**
   * Open the calendar
   */
  open(e) {
    e.stopPropagation();

    // Show backdrop and container
    this.backdrop.classList.remove('calendar-hidden');
    this.container.classList.remove('calendar-hidden');

    // Position calendar
    const position = this.calculatePosition();
    this.container.style.position = 'fixed';
    this.container.style.top = position.top + 'px';
    this.container.style.left = position.left + 'px';
    this.container.style.zIndex = '9999';

    // Initialize calendar - library handles time picker rendering
    this.calendar.init();

    if (window.EventBus) {
      EventBus.emit('calendar:opened', { inputId: this.input.id });
    }

    Logger.log('📅 Calendar opened for', this.input.id);
  }

  /**
   * Close the calendar
   */
  close() {
    this.backdrop.classList.add('calendar-hidden');
    this.container.classList.add('calendar-hidden');

    if (window.EventBus) {
      EventBus.emit('calendar:closed', { inputId: this.input.id });
    }

    Logger.log('📅 Calendar closed for', this.input.id);
  }

  /**
   * Calculate optimal position for calendar
   */
  calculatePosition() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const calendarWidth = 340;
    const calendarHeight = this.options.showTime ? 500 : 450;

    const topPosition = Math.max(80, (viewportHeight - calendarHeight) / 2);
    const leftPosition = Math.max(20, (viewportWidth - calendarWidth) / 2);

    return { top: topPosition, left: leftPosition };
  }

  /**
   * Handle day click event
   */
  handleDayClick(event, self) {
    if (self.selectedDates && self.selectedDates.length > 0) {
      const dateStr = self.selectedDates[0];
      const date = new Date(dateStr);

      // Get time from calendar if time picker is enabled
      if (this.options.showTime && self.selectedTime) {
        const [hours, minutes] = self.selectedTime.split(':').map(Number);
        date.setHours(hours, minutes, 0, 0);
      } else {
        // No time picker - use current time or default
        date.setHours(this.options.defaultHour, this.options.defaultMinute, 0, 0);
      }

      // Update input
      this.input.value = this.formatDateTime(date);

      if (window.EventBus) {
        EventBus.emit('date:selected', {
          inputId: this.input.id,
          date: date,
          isoString: date.toISOString()
        });
      }

      if (this.options.onSelect) {
        this.options.onSelect(date);
      }

      Logger.log('📅 Date selected:', date.toISOString(), 'for', this.input.id);

      // Close calendar after selection
      setTimeout(() => this.close(), 200);
    }
  }

  /**
   * Format date and time for display
   */
  formatDateTime(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} בשעה ${hours}:${minutes}`;
  }

  /**
   * Get selected date as Date object
   */
  getSelectedDate() {
    if (this.calendar && this.calendar.selectedDates && this.calendar.selectedDates.length > 0) {
      const date = new Date(this.calendar.selectedDates[0]);

      // Get time if available
      if (this.calendar.selectedTime) {
        const [hours, minutes] = this.calendar.selectedTime.split(':').map(Number);
        date.setHours(hours, minutes, 0, 0);
      }

      return date;
    }
    return null;
  }

  /**
   * Get selected date as ISO string
   */
  getSelectedDateISO() {
    const date = this.getSelectedDate();
    return date ? date.toISOString() : null;
  }

  /**
   * Destroy calendar instance
   */
  destroy() {
    if (this.backdrop) {
      this.backdrop.remove();
    }
    if (this.container) {
      this.container.remove();
    }
    if (this.calendar && typeof this.calendar.destroy === 'function') {
      this.calendar.destroy();
    }

    Logger.log('🗑️ VanillaCalendarPicker destroyed for', this.input.id);
  }
}

// Export to global scope
window.VanillaCalendarPicker = VanillaCalendarPicker;

Logger.log('✅ VanillaCalendarPicker module loaded');
