/**
 * FlatpickrWrapper - Modern Date & Time Picker
 *
 * Hi-Tech Linear/Vercel-Inspired Design
 * Event-Driven Architecture with EventBus Integration
 * Hebrew RTL Support - Professional Implementation
 *
 * @version 2.0.4
 * @author Law Office Management System
 */

class FlatpickrWrapper {
  /**
   * Create a new Flatpickr instance
   * @param {HTMLElement|string} element - Input element or selector
   * @param {Object} options - Configuration options
   */
  constructor(element, options = {}) {
    this.input = typeof element === 'string' ? document.querySelector(element) : element;

    if (!this.input) {
      Logger?.error('FlatpickrWrapper: Input element not found');
      return;
    }

    this.options = {
      enableTime: options.enableTime !== false, // Default: true
      time_24hr: true,
      dateFormat: options.dateFormat || 'd/m/Y בשעה H:i',
      defaultHour: options.defaultHour !== undefined ? options.defaultHour : new Date().getHours(),
      defaultMinute: options.defaultMinute !== undefined ? options.defaultMinute : new Date().getMinutes(),
      minDate: options.minDate || 'today',
      maxDate: options.maxDate || null,
      showPresets: options.showPresets !== false, // Default: true
      onSelect: options.onSelect || null,
      ...options
    };

    this.instance = null;
    this.init();
  }

  /**
   * Initialize Flatpickr
   */
  init() {
    if (typeof flatpickr === 'undefined') {
      Logger?.error('Flatpickr library not loaded');
      return;
    }

    // Build custom Hebrew locale with single-letter weekdays
    const heLocale = {
      ...(flatpickr.l10ns?.he || {}),
      firstDayOfWeek: 0,
      weekdays: {
        shorthand: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'],
        longhand: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
      }
    };

    // Base configuration
    const config = {
      enableTime: this.options.enableTime,
      time_24hr: this.options.time_24hr,
      dateFormat: this.options.dateFormat,
      defaultHour: this.options.defaultHour,
      defaultMinute: this.options.defaultMinute,
      minDate: this.options.minDate,
      maxDate: this.options.maxDate,
      locale: heLocale,
      position: 'auto',

      // RTL Support + Interaction Fix
      static: false,
      appendTo: document.body,
      clickOpens: true,
      allowInput: false,
      disableMobile: true,
      inline: false,

      // Callbacks
      onChange: (selectedDates, dateStr, instance) => this.handleChange(selectedDates, dateStr, instance),
      onValueUpdate: (selectedDates, dateStr, instance) => this.handleValueUpdate(selectedDates, dateStr, instance),
      onOpen: (selectedDates, dateStr, instance) => this.handleOpen(selectedDates, dateStr, instance),
      onClose: (selectedDates, dateStr, instance) => this.handleClose(selectedDates, dateStr, instance),
      onReady: (selectedDates, dateStr, instance) => this.handleReady(selectedDates, dateStr, instance)
    };

    // Initialize Flatpickr
    this.instance = flatpickr(this.input, config);

    // Add presets if enabled
    if (this.options.showPresets) {
      this.addPresets();
    }

    // Set default value if input is empty
    if (!this.input.value) {
      this.setDefaultValue();
    }

    Logger?.log('✅ FlatpickrWrapper initialized for', this.input.id);
  }

  /**
   * Set default value based on configuration
   */
  setDefaultValue() {
    const defaultDate = new Date();
    defaultDate.setHours(this.options.defaultHour, this.options.defaultMinute, 0, 0);
    this.instance.setDate(defaultDate, true);
  }

  /**
   * Convert Date to local ISO string with timezone offset
   * @param {Date} date - Date to format
   * @returns {string} ISO string with local timezone
   */
  toLocalISOString(date) {
    const tz = -date.getTimezoneOffset();
    const sign = tz >= 0 ? '+' : '-';
    const pad = n => String(Math.abs(Math.trunc(n))).padStart(2, '0');
    const hhOfs = pad(tz / 60);
    const mmOfs = pad(tz % 60);
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}${sign}${hhOfs}:${mmOfs}`;
  }

  /**
   * Add quick action presets with accessibility
   */
  addPresets() {
    setTimeout(() => {
      const cal = this.instance.calendarContainer;
      if (!cal || cal.querySelector('.flatpickr-presets')) {
return;
}

      const bar = document.createElement('div');
      bar.className = 'flatpickr-presets';
      bar.setAttribute('role', 'toolbar');
      bar.setAttribute('aria-label', 'בחירות מהירות');

      const makeButton = (label, getValue) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'flatpickr-preset-btn';
        b.textContent = label;
        b.setAttribute('aria-label', `בחר ${label}`);
        b.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          this.instance.setDate(getValue(), true);
          this.instance.close();
          this.input?.focus();
        });
        return b;
      };

      const presets = [
        { label: 'עכשיו', getValue: () => new Date() },
        {
          label: 'מחר 09:00',
          getValue: () => {
            const t = new Date();
            t.setDate(t.getDate() + 1);
            t.setHours(9, 0, 0, 0);
            return t;
          }
        },
        {
          label: 'שבוע הבא',
          getValue: () => {
            const t = new Date();
            t.setDate(t.getDate() + 7);
            t.setHours(9, 0, 0, 0);
            return t;
          }
        },
        {
          label: 'חודש הבא',
          getValue: () => {
            const t = new Date();
            t.setMonth(t.getMonth() + 1);
            t.setHours(9, 0, 0, 0);
            return t;
          }
        }
      ];

      presets.forEach(p => bar.appendChild(makeButton(p.label, p.getValue)));
      cal.insertBefore(bar, cal.firstChild);
    }, 0);
  }

  /**
   * Handle date change event with dynamic minTime
   */
  handleChange(selectedDates, dateStr, instance) {
    if (!selectedDates.length) {
return;
}

    const d = selectedDates[0];
    const now = new Date();
    const isToday = d.getFullYear() === now.getFullYear() &&
                    d.getMonth() === now.getMonth() &&
                    d.getDate() === now.getDate();

    // Set minTime for today, remove for other dates
    instance.set('minTime', isToday ?
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` :
      null
    );

    // Emit EventBus event with both UTC and local ISO
    if (window.EventBus) {
      EventBus.emit('date:selected', {
        inputId: this.input.id,
        date: d,
        dateStr: dateStr,
        isoUtc: d.toISOString(),
        isoLocal: this.toLocalISOString(d),
        formattedDate: this.formatDate(d)
      });
    }

    // Custom callback
    if (this.options.onSelect) {
      this.options.onSelect(d, dateStr);
    }

    // Force close the calendar after selection (immediate)
    if (instance && instance.isOpen) {
      // Close immediately without setTimeout for faster response
      requestAnimationFrame(() => {
        instance.close();
      });
    }

    Logger?.log('📅 Date selected:', dateStr, 'for', this.input.id);
  }

  /**
   * Handle value update event (covers UI changes)
   * WARNING: Do NOT call instance.set() here - it causes infinite loop!
   */
  handleValueUpdate(selectedDates, dateStr, instance) {
    // This is called for UI updates only
    // minTime is already set in handleChange
    // Do nothing here to avoid infinite loop
  }

  /**
   * Handle picker open event
   */
  handleOpen(selectedDates, dateStr, instance) {
    if (window.EventBus) {
      EventBus.emit('picker:opened', {
        inputId: this.input.id
      });
    }

    // Add click outside listener to close calendar (bubble phase)
    this.outsideClickHandler = (e) => {
      if (instance && instance.isOpen) {
        const calendar = instance.calendarContainer;
        const input = this.input;

        // Check if click is outside both calendar and input
        if (calendar && !calendar.contains(e.target) && e.target !== input && !input.contains(e.target)) {
          instance.close();
        }
      }
    };

    // Use setTimeout to avoid immediate trigger from same click that opened it
    setTimeout(() => {
      document.addEventListener('click', this.outsideClickHandler, false);
    }, 100);

    Logger?.log('📅 Picker opened for', this.input.id);
  }

  /**
   * Handle picker close event with focus return
   */
  handleClose(selectedDates, dateStr, instance) {
    if (window.EventBus) {
      EventBus.emit('picker:closed', {
        inputId: this.input.id
      });
    }

    // Remove click outside listener
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler, false);
      this.outsideClickHandler = null;
    }

    this.input?.focus();
    Logger?.log('📅 Picker closed for', this.input.id);
  }

  /**
   * Handle picker ready event - Add RTL class
   */
  handleReady(selectedDates, dateStr, instance) {
    // Add RTL class to calendar for CSS scoping
    if (instance.calendarContainer) {
      instance.calendarContainer.classList.add('flatpickr-rtl');
    }

    Logger?.log('📅 Picker ready for', this.input.id);
  }

  /**
   * Format date to Hebrew format
   * @param {Date} date - Date to format
   * @returns {string} Formatted date string
   */
  formatDate(date) {
    if (!date) {
return '';
}

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} בשעה ${hours}:${minutes}`;
  }

  /**
   * Get selected date as Date object
   * @returns {Date|null}
   */
  getSelectedDate() {
    return this.instance?.selectedDates?.[0] || null;
  }

  /**
   * Get selected date as ISO string (UTC)
   * @returns {string|null}
   */
  getSelectedDateISO() {
    const date = this.getSelectedDate();
    return date ? date.toISOString() : null;
  }

  /**
   * Get selected date as local ISO string
   * @returns {string|null}
   */
  getSelectedDateISOLocal() {
    const date = this.getSelectedDate();
    return date ? this.toLocalISOString(date) : null;
  }

  /**
   * Set date programmatically
   * @param {Date|string} date - Date to set
   * @param {boolean} triggerChange - Whether to trigger onChange event
   */
  setDate(date, triggerChange = true) {
    if (this.instance) {
      this.instance.setDate(date, triggerChange);
    }
  }

  /**
   * Clear selected date
   */
  clear() {
    if (this.instance) {
      this.instance.clear();
    }
  }

  /**
   * Open the picker
   */
  open() {
    if (this.instance) {
      this.instance.open();
    }
  }

  /**
   * Close the picker
   */
  close() {
    if (this.instance) {
      this.instance.close();
    }
  }

  /**
   * Destroy the picker instance
   */
  destroy() {
    if (this.instance) {
      this.instance.destroy();
      Logger?.log('🗑️ FlatpickrWrapper destroyed for', this.input.id);
    }
  }
}

// Export to global scope for Vanilla JS
window.FlatpickrWrapper = FlatpickrWrapper;

Logger?.log('✅ FlatpickrWrapper module loaded (v2.0.4)');
