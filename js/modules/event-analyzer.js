/**
 * 🔍 Event Analyzer - ניתוח מערך האירועים במערכת
 *
 * כלי לבדיקה וניתוח של כל האירועים במערכת:
 * - מי שולח מה (emitters)
 * - מי מאזין למה (listeners)
 * - אירועים יתומים (orphans - נשלחים אבל אף אחד לא מאזין)
 * - listeners מתים (dead - מאזינים לאירועים שלא נשלחים)
 *
 * שימוש:
 * 1. פתח את הדפדפן
 * 2. הרץ: EventAnalyzer.analyze()
 * 3. הרץ: EventAnalyzer.printReport()
 * 4. הרץ: EventAnalyzer.visualizeFlow('client:selected')
 *
 * Created: October 2025
 */

window.EventAnalyzer = {

  /**
   * תוצאות הניתוח
   */
  results: {
    defined: [],      // אירועים מוגדרים ב-EventBus
    emitted: [],      // אירועים שנשלחים בפועל
    listened: [],     // אירועים שמאזינים להם
    orphans: [],      // נשלחים אבל אף אחד לא מאזין
    deadListeners: [], // מאזינים לאירועים שלא נשלחים
    flows: {}         // מפת זרימה: event -> {emitters: [], listeners: []}
  },

  /**
   * 📊 ניתוח המערכת
   */
  async analyze() {
    console.log('🔍 Starting Event Analysis...');

    // Step 1: קרא אירועים מוגדרים מ-EventBus
    this.analyzeDefinedEvents();

    // Step 2: סרוק את כל הקוד
    await this.scanSourceCode();

    // Step 3: זהה בעיות
    this.findOrphans();
    this.findDeadListeners();

    // Step 4: בנה מפת זרימה
    this.buildFlowMap();

    console.log('✅ Analysis complete!');
    return this.results;
  },

  /**
   * 📋 קרא אירועים מוגדרים מ-EventBus
   */
  analyzeDefinedEvents() {
    console.log('📋 Reading defined events from EventBus...');

    // EventBus מכיל את כל ההגדרות ב-TypeScript interfaces
    // כרגע נעבוד עם רשימה ידועה, אבל אפשר גם לקרוא מהקובץ
    this.results.defined = [
      // ClientEvents
      'client:selected',
      'client:created',
      'client:updated',
      'client:deleted',

      // TaskEvents
      'task:created',
      'task:updated',
      'task:completed',
      'task:budget-adjusted',
      'task:deadline-extended',

      // TimesheetEvents
      'timesheet:entry-added',
      'timesheet:entry-updated',
      'timesheet:entry-deleted',
      'timesheet:day-completed',
      'timesheet:week-summary',

      // BudgetEvents
      'budget:overspend-warning',
      'budget:milestone-reached',
      'budget:depleted',

      // UIEvents
      'ui:modal-opened',
      'ui:modal-closed',
      'ui:tab-changed',
      'ui:filter-applied',
      'ui:search-performed',

      // SelectorEvents
      'selector:client-changed',
      'selector:case-changed',

      // SystemEvents
      'system:initialized',
      'system:error',
      'system:warning',
      'system:user-logged-in',
      'system:user-logged-out'
    ];

    console.log(`   Found ${this.results.defined.length} defined events`);
  },

  /**
   * 🔎 סרוק את כל קבצי הקוד
   */
  async scanSourceCode() {
    console.log('🔎 Scanning source code...');

    // רשימת קבצים לסריקה
    const filesToScan = [
      'js/main.js',
      'js/cases.js',
      'js/legal-procedures.js',
      'js/cases-integration.js',
      'js/modules/budget-tasks.js',
      'js/modules/timesheet.js',
      'js/modules/client-case-selector.js',
      'js/modules/selectors-init.js',           // ✅ Added - listeners for client/case selection
      'js/modules/modals-compat.js',
      'js/modules/statistics.js',
      'js/modules/notification-system.js',      // ✅ Added - notification listeners
      'js/modules/task-actions.js',
      'js/modules/integration-manager.js',
      'dist/js/services/firebase-service.js'    // ✅ Added - system events (compiled TS)
    ];

    const emittedEvents = new Map();  // event -> [locations]
    const listenedEvents = new Map(); // event -> [locations]

    for (const file of filesToScan) {
      try {
        const response = await fetch(file);
        const code = await response.text();

        // חפש EventBus.emit()
        const emitRegex = /EventBus\.emit\(['"]([^'"]+)['"]/g;
        let match;
        while ((match = emitRegex.exec(code)) !== null) {
          const eventName = match[1];
          if (!emittedEvents.has(eventName)) {
            emittedEvents.set(eventName, []);
          }
          emittedEvents.get(eventName).push(file);
        }

        // חפש EventBus.on()
        const onRegex = /EventBus\.on\(['"]([^'"]+)['"]/g;
        while ((match = onRegex.exec(code)) !== null) {
          const eventName = match[1];
          if (!listenedEvents.has(eventName)) {
            listenedEvents.set(eventName, []);
          }
          listenedEvents.get(eventName).push(file);
        }

      } catch (err) {
        console.warn(`   ⚠️  Could not scan ${file}:`, err.message);
      }
    }

    // המר ל-arrays
    this.results.emitted = Array.from(emittedEvents.entries()).map(([event, locations]) => ({
      event,
      locations
    }));

    this.results.listened = Array.from(listenedEvents.entries()).map(([event, locations]) => ({
      event,
      locations
    }));

    console.log(`   Found ${this.results.emitted.length} emitted events`);
    console.log(`   Found ${this.results.listened.length} listened events`);
  },

  /**
   * 🔴 זהה אירועים יתומים (נשלחים אבל אף אחד לא מאזין)
   */
  findOrphans() {
    const listenedEventNames = this.results.listened.map(l => l.event);

    this.results.orphans = this.results.emitted.filter(e => {
      return !listenedEventNames.includes(e.event);
    });

    if (this.results.orphans.length > 0) {
      console.warn(`⚠️  Found ${this.results.orphans.length} orphan events (emitted but no listeners)`);
    }
  },

  /**
   * 💀 זהה listeners מתים (מאזינים לאירועים שלא נשלחים)
   */
  findDeadListeners() {
    const emittedEventNames = this.results.emitted.map(e => e.event);

    this.results.deadListeners = this.results.listened.filter(l => {
      return !emittedEventNames.includes(l.event);
    });

    if (this.results.deadListeners.length > 0) {
      console.warn(`⚠️  Found ${this.results.deadListeners.length} dead listeners (listening but never emitted)`);
    }
  },

  /**
   * 🗺️ בנה מפת זרימה
   */
  buildFlowMap() {
    this.results.flows = {};

    // הוסף emitters
    this.results.emitted.forEach(({ event, locations }) => {
      if (!this.results.flows[event]) {
        this.results.flows[event] = { emitters: [], listeners: [] };
      }
      this.results.flows[event].emitters = locations;
    });

    // הוסף listeners
    this.results.listened.forEach(({ event, locations }) => {
      if (!this.results.flows[event]) {
        this.results.flows[event] = { emitters: [], listeners: [] };
      }
      this.results.flows[event].listeners = locations;
    });
  },

  /**
   * 📄 הדפס דוח מפורט
   */
  printReport() {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 EVENT ANALYSIS REPORT');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    // סיכום
    console.log('📋 SUMMARY:');
    console.log(`   Defined events:     ${this.results.defined.length}`);
    console.log(`   Emitted events:     ${this.results.emitted.length}`);
    console.log(`   Listened events:    ${this.results.listened.length}`);
    console.log(`   Orphan events:      ${this.results.orphans.length} ⚠️`);
    console.log(`   Dead listeners:     ${this.results.deadListeners.length} ⚠️`);
    console.log('');

    // אירועים יתומים
    if (this.results.orphans.length > 0) {
      console.log('🔴 ORPHAN EVENTS (נשלחים אבל אף אחד לא מאזין):');
      this.results.orphans.forEach(({ event, locations }) => {
        console.log(`   ❌ ${event}`);
        locations.forEach(loc => console.log(`      📍 Emitted in: ${loc}`));
      });
      console.log('');
    }

    // listeners מתים
    if (this.results.deadListeners.length > 0) {
      console.log('💀 DEAD LISTENERS (מאזינים לאירועים שלא נשלחים):');
      this.results.deadListeners.forEach(({ event, locations }) => {
        console.log(`   ❌ ${event}`);
        locations.forEach(loc => console.log(`      👂 Listening in: ${loc}`));
      });
      console.log('');
    }

    // אירועים תקינים
    const healthyEvents = this.results.emitted.filter(e => {
      return !this.results.orphans.find(o => o.event === e.event);
    });

    if (healthyEvents.length > 0) {
      console.log(`✅ HEALTHY EVENTS (${healthyEvents.length} events working correctly):`);
      healthyEvents.forEach(({ event }) => {
        const flow = this.results.flows[event];
        console.log(`   ✅ ${event}`);
        console.log(`      📤 Emitters:  ${flow.emitters.length}`);
        console.log(`      👂 Listeners: ${flow.listeners.length}`);
      });
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('💡 TIP: Use EventAnalyzer.visualizeFlow("event-name") to see details');
    console.log('═══════════════════════════════════════════════════════');
  },

  /**
   * 🎨 הצג זרימה ויזואלית של אירוע ספציפי
   */
  visualizeFlow(eventName) {
    const flow = this.results.flows[eventName];

    if (!flow) {
      console.error(`❌ Event "${eventName}" not found in system`);
      return;
    }

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`🎨 FLOW VISUALIZATION: "${eventName}"`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    // Emitters
    if (flow.emitters.length > 0) {
      console.log('📤 EMITTERS (מי שולח):');
      flow.emitters.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file}`);
      });
    } else {
      console.log('📤 EMITTERS: ❌ None found');
    }

    console.log('');
    console.log('              ↓ ↓ ↓');
    console.log(`        Event: "${eventName}"`);
    console.log('              ↓ ↓ ↓');
    console.log('');

    // Listeners
    if (flow.listeners.length > 0) {
      console.log('👂 LISTENERS (מי מאזין):');
      flow.listeners.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file}`);
      });
    } else {
      console.log('👂 LISTENERS: ❌ None found (ORPHAN!)');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
  },

  /**
   * 📊 הצג רשימת כל האירועים
   */
  listAllEvents() {
    console.log('\n');
    console.log('📋 ALL EVENTS IN SYSTEM:');
    console.log('═══════════════════════════════════════════════════════');

    const allEventNames = new Set([
      ...this.results.emitted.map(e => e.event),
      ...this.results.listened.map(l => l.event)
    ]);

    Array.from(allEventNames).sort().forEach(eventName => {
      const flow = this.results.flows[eventName] || { emitters: [], listeners: [] };
      const status = flow.emitters.length > 0 && flow.listeners.length > 0 ? '✅' :
                     flow.emitters.length > 0 ? '⚠️ ' : '💀';
      console.log(`${status} ${eventName} (${flow.emitters.length}→${flow.listeners.length})`);
    });

    console.log('═══════════════════════════════════════════════════════');
    console.log('Legend: ✅ = healthy | ⚠️  = orphan | 💀 = dead listener');
  },

  /**
   * 🎯 המלצות לתיקון
   */
  getRecommendations() {
    console.log('\n');
    console.log('💡 RECOMMENDATIONS:');
    console.log('═══════════════════════════════════════════════════════');

    if (this.results.orphans.length > 0) {
      console.log('\n🔴 Orphan Events - צריך להוסיף listeners:');
      this.results.orphans.forEach(({ event, locations }) => {
        console.log(`\n   Event: ${event}`);
        console.log(`   Action: Add a listener with EventBus.on('${event}', ...)`);
        console.log(`   Emitted in: ${locations.join(', ')}`);
      });
    }

    if (this.results.deadListeners.length > 0) {
      console.log('\n💀 Dead Listeners - צריך להוסיף emitters או למחוק:');
      this.results.deadListeners.forEach(({ event, locations }) => {
        console.log(`\n   Event: ${event}`);
        console.log(`   Action: Either emit this event or remove the listener`);
        console.log(`   Listening in: ${locations.join(', ')}`);
      });
    }

    if (this.results.orphans.length === 0 && this.results.deadListeners.length === 0) {
      console.log('\n✅ All events are healthy! No issues found.');
    }

    console.log('\n═══════════════════════════════════════════════════════');
  }
};

console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🔍 Event Analyzer Loaded!                                ║
╚═══════════════════════════════════════════════════════════╝

שימוש:

1️⃣  הרץ ניתוח:
    await EventAnalyzer.analyze()

2️⃣  הצג דוח מלא:
    EventAnalyzer.printReport()

3️⃣  הצג זרימה של אירוע ספציפי:
    EventAnalyzer.visualizeFlow('client:selected')

4️⃣  רשימת כל האירועים:
    EventAnalyzer.listAllEvents()

5️⃣  קבל המלצות לתיקון:
    EventAnalyzer.getRecommendations()

💡 דוגמה מלאה:
    await EventAnalyzer.analyze()
    EventAnalyzer.printReport()
    EventAnalyzer.visualizeFlow('task:created')
`);
