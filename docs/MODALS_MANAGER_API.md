# ModalsManager API Documentation

**Version:** 1.0.0
**Author:** Development Team
**Last Updated:** 2025-10-17

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [API Reference](#api-reference)
   - [Core Modals](#core-modals)
   - [Event System](#event-system)
   - [State Management](#state-management)
5. [Advanced Usage](#advanced-usage)
6. [Migration Guide](#migration-guide)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

`ModalsManager` is a centralized, framework-agnostic modal management system designed for the Law Office Management System. It provides a consistent, type-safe API for creating and managing all types of modals/popups in the application.

### Features

- ✅ **Zero dependencies** - Pure vanilla JavaScript
- ✅ **Type-safe** - Full TypeScript definitions + JSDoc
- ✅ **Framework agnostic** - Works with any JS framework
- ✅ **RTL support** - Built-in Hebrew/RTL support
- ✅ **Accessible** - Keyboard navigation, focus management
- ✅ **Lightweight** - ~8KB gzipped
- ✅ **Testable** - 80%+ test coverage
- ✅ **Event-driven** - Observer pattern for custom logic

---

## Installation

### Option 1: Script Tag (Current Setup)

```html
<!-- Include ModalsManager before your application code -->
<script src="js/modules/modals-manager.js"></script>

<script>
  // ModalsManager is now available globally
  ModalsManager.showAlert('Hello World!');
</script>
```

### Option 2: ES Module (Future)

```javascript
import ModalsManager from './js/modules/modals-manager.js';

ModalsManager.showAlert('Hello World!');
```

### Option 3: CommonJS (Node.js/Testing)

```javascript
const ModalsManager = require('./js/modules/modals-manager.js');

ModalsManager.showAlert('Hello World!');
```

---

## Quick Start

### Basic Alert

```javascript
// Simple message
await ModalsManager.showAlert('Operation completed!');

// With configuration
await ModalsManager.showAlert({
  title: 'Success',
  message: 'הנתונים נשמרו בהצלחה',
  type: 'success',
  buttonText: 'סגור',
  onClose: () => console.log('Alert closed')
});
```

### Confirmation Dialog

```javascript
// Simple confirmation
const confirmed = await ModalsManager.showConfirm('האם למחוק את הלקוח?');
if (confirmed) {
  deleteClient();
}

// With configuration
const confirmed = await ModalsManager.showConfirm({
  title: 'אישור מחיקה',
  message: 'פעולה זו לא ניתנת לביטול',
  variant: 'danger',
  confirmText: 'כן, מחק',
  cancelText: 'בטל',
  onConfirm: () => trackEvent('client_deleted'),
  onCancel: () => trackEvent('delete_canceled')
});
```

### Loading Overlay

```javascript
// Show loading
const loadingId = ModalsManager.showLoading('שומר נתונים...');

try {
  await saveData();
  ModalsManager.showAlert('הנתונים נשמרו!');
} catch (error) {
  ModalsManager.showAlert({
    title: 'שגיאה',
    message: error.message,
    type: 'error'
  });
} finally {
  ModalsManager.hideLoading(loadingId);
}
```

---

## API Reference

### Core Modals

#### `showAlert(config)`

Display an alert modal with a single confirmation button.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `config` | `Object\|string` | Yes | - | Configuration object or message string |
| `config.title` | `string` | No | `'התראה'` | Modal title |
| `config.message` | `string` | Yes | - | Alert message (supports HTML) |
| `config.type` | `'info'\|'success'\|'warning'\|'error'` | No | `'info'` | Alert type (affects icon/color) |
| `config.icon` | `string` | No | Auto | Font Awesome icon class |
| `config.iconColor` | `string` | No | Auto | Icon color (CSS value) |
| `config.buttonText` | `string` | No | `'אישור'` | Button text |
| `config.onClose` | `Function` | No | - | Callback when closed |

**Returns:** `Promise<void>`

**Examples:**

```javascript
// Simple
await ModalsManager.showAlert('Hello!');

// Success alert
await ModalsManager.showAlert({
  title: 'הצלחה',
  message: 'הפעולה הושלמה',
  type: 'success'
});

// Error alert
await ModalsManager.showAlert({
  title: 'שגיאה',
  message: 'לא ניתן לשמור את הנתונים',
  type: 'error',
  onClose: () => {
    console.log('Error acknowledged');
  }
});

// Custom icon
await ModalsManager.showAlert({
  message: 'תזכורת חשובה',
  icon: 'fa-bell',
  iconColor: '#f59e0b'
});
```

---

#### `showConfirm(config)`

Display a confirmation dialog with confirm/cancel buttons.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `config` | `Object\|string` | Yes | - | Configuration object or message string |
| `config.title` | `string` | No | `'אישור פעולה'` | Modal title |
| `config.message` | `string` | Yes | - | Confirmation message |
| `config.confirmText` | `string` | No | `'אישור'` | Confirm button text |
| `config.cancelText` | `string` | No | `'ביטול'` | Cancel button text |
| `config.variant` | `'primary'\|'danger'` | No | `'primary'` | Button style |
| `config.icon` | `string` | No | `'fa-question-circle'` | Font Awesome icon |
| `config.iconColor` | `string` | No | `'#3b82f6'` | Icon color |
| `config.onConfirm` | `Function` | No | - | Callback when confirmed |
| `config.onCancel` | `Function` | No | - | Callback when canceled |

**Returns:** `Promise<boolean>` - `true` if confirmed, `false` if canceled

**Examples:**

```javascript
// Simple confirmation
if (await ModalsManager.showConfirm('למחוק?')) {
  deleteItem();
}

// Dangerous action
const confirmed = await ModalsManager.showConfirm({
  title: 'אזהרה',
  message: 'פעולה זו תמחק את כל הנתונים',
  variant: 'danger',
  confirmText: 'כן, מחק הכל',
  cancelText: 'לא, בטל'
});

if (confirmed) {
  await deleteAllData();
}

// With callbacks
await ModalsManager.showConfirm({
  message: 'לשמור שינויים?',
  onConfirm: async () => {
    await saveChanges();
    console.log('Saved');
  },
  onCancel: () => {
    console.log('Discarded');
  }
});
```

---

#### `showLoading(message)`

Display a loading overlay with spinner.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `message` | `string` | No | `'טוען...'` | Loading message |

**Returns:** `string | null` - Loading ID (use with `hideLoading`)

**Examples:**

```javascript
// Basic loading
const loadingId = ModalsManager.showLoading();
await longOperation();
ModalsManager.hideLoading(loadingId);

// Custom message
const loadingId = ModalsManager.showLoading('מעלה קבצים...');

// Multiple loading operations
const id1 = ModalsManager.showLoading('Loading 1...');
const id2 = ModalsManager.showLoading('Loading 2...');

await operation1();
ModalsManager.hideLoading(id1);

await operation2();
ModalsManager.hideLoading(id2);
```

---

#### `hideLoading(loadingId)`

Hide a loading overlay.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `loadingId` | `string` | No | - | Specific loading ID to hide |

**Returns:** `void`

**Examples:**

```javascript
// Hide specific loading
const loadingId = ModalsManager.showLoading();
ModalsManager.hideLoading(loadingId);

// Hide any loading
ModalsManager.showLoading();
ModalsManager.hideLoading(); // Hides the current loading
```

---

### Event System

#### `on(event, callback)`

Subscribe to modal events.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event` | `'open'\|'close'\|'submit'` | Yes | Event name |
| `callback` | `Function` | Yes | Event callback |

**Returns:** `Function` - Unsubscribe function

**Events:**

- **`open`** - Fired when a modal opens
  ```javascript
  { modalId: string, type: string, config: Object }
  ```

- **`close`** - Fired when a modal closes
  ```javascript
  { modalId: string, result: any }
  ```

- **`submit`** - Fired when a modal form is submitted
  ```javascript
  { modalId: string, data: any }
  ```

**Examples:**

```javascript
// Subscribe to events
const unsubscribe = ModalsManager.on('open', (data) => {
  console.log('Modal opened:', data.modalId);
  console.log('Type:', data.type);
});

// Unsubscribe later
unsubscribe();

// Track modal analytics
ModalsManager.on('close', (data) => {
  analytics.track('modal_closed', {
    modalId: data.modalId,
    result: data.result
  });
});

// Multiple subscriptions
const unsub1 = ModalsManager.on('open', handler1);
const unsub2 = ModalsManager.on('open', handler2);

// Cleanup
unsub1();
unsub2();
```

---

#### `off(event, callback)`

Unsubscribe from an event.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event` | `string` | Yes | Event name |
| `callback` | `Function` | Yes | Callback to remove |

**Returns:** `void`

**Examples:**

```javascript
const myHandler = (data) => console.log(data);

ModalsManager.on('open', myHandler);

// Later...
ModalsManager.off('open', myHandler);
```

---

### State Management

#### `getActiveModals()`

Get information about all currently open modals.

**Returns:** `Array<Object>`

```typescript
[
  {
    id: string,
    type: string,
    config: Object
  }
]
```

**Examples:**

```javascript
const activeModals = ModalsManager.getActiveModals();
console.log(`${activeModals.length} modals open`);

activeModals.forEach(modal => {
  console.log(`Modal ${modal.id} of type ${modal.type}`);
});
```

---

#### `closeAll()`

Close all open modals.

**Returns:** `void`

**Examples:**

```javascript
// Close everything
ModalsManager.closeAll();

// Close on navigation
router.on('navigate', () => {
  ModalsManager.closeAll();
});

// Close on logout
function logout() {
  ModalsManager.closeAll();
  redirectToLogin();
}
```

---

#### `isAnyModalOpen()`

Check if any modal is currently open.

**Returns:** `boolean`

**Examples:**

```javascript
if (ModalsManager.isAnyModalOpen()) {
  console.log('Please close modals before proceeding');
  return;
}

// Prevent navigation if modal is open
window.addEventListener('beforeunload', (e) => {
  if (ModalsManager.isAnyModalOpen()) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes';
  }
});
```

---

## Advanced Usage

### Chaining Operations

```javascript
// Show loading → perform operation → show result
const loadingId = ModalsManager.showLoading('שומר...');

try {
  const result = await saveData();

  ModalsManager.hideLoading(loadingId);

  await ModalsManager.showAlert({
    title: 'הצלחה',
    message: `נשמרו ${result.count} רשומות`,
    type: 'success'
  });
} catch (error) {
  ModalsManager.hideLoading(loadingId);

  await ModalsManager.showAlert({
    title: 'שגיאה',
    message: error.message,
    type: 'error'
  });
}
```

### Async/Await Patterns

```javascript
// Confirm before delete
async function deleteClient(clientId) {
  const confirmed = await ModalsManager.showConfirm({
    title: 'מחיקת לקוח',
    message: 'האם אתה בטוח?',
    variant: 'danger'
  });

  if (!confirmed) return;

  const loadingId = ModalsManager.showLoading('מוחק...');

  try {
    await api.deleteClient(clientId);
    await ModalsManager.showAlert({
      message: 'הלקוח נמחק בהצלחה',
      type: 'success'
    });
  } catch (error) {
    await ModalsManager.showAlert({
      title: 'שגיאה',
      message: error.message,
      type: 'error'
    });
  } finally {
    ModalsManager.hideLoading(loadingId);
  }
}
```

### Event-Driven Architecture

```javascript
// Centralized modal analytics
ModalsManager.on('open', (data) => {
  analytics.track('modal_opened', {
    type: data.type,
    timestamp: new Date()
  });
});

ModalsManager.on('close', (data) => {
  analytics.track('modal_closed', {
    modalId: data.modalId,
    result: data.result,
    timestamp: new Date()
  });
});

// Debug mode
if (DEBUG_MODE) {
  ModalsManager.on('open', console.log);
  ModalsManager.on('close', console.log);
}
```

---

## Migration Guide

### From `alert()` / `confirm()`

**Before:**
```javascript
alert('הפעולה הצליחה!');

if (confirm('למחוק?')) {
  deleteItem();
}
```

**After:**
```javascript
await ModalsManager.showAlert('הפעולה הצליחה!');

if (await ModalsManager.showConfirm('למחוק?')) {
  deleteItem();
}
```

### From Custom Modals

**Before:**
```javascript
function showCustomAlert(message) {
  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  overlay.innerHTML = `
    <div class="popup">
      <div class="popup-header">התראה</div>
      <div class="popup-content">${message}</div>
      <div class="popup-buttons">
        <button onclick="this.closest('.popup-overlay').remove()">
          אישור
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}
```

**After:**
```javascript
// Just use ModalsManager!
await ModalsManager.showAlert(message);
```

---

## Best Practices

### 1. Always use `await`

```javascript
// ❌ Bad
ModalsManager.showAlert('Saved');
redirectToHome(); // Redirects immediately!

// ✅ Good
await ModalsManager.showAlert('Saved');
redirectToHome(); // Waits for user to close modal
```

### 2. Clean up event listeners

```javascript
// ❌ Bad
function MyComponent() {
  ModalsManager.on('open', handler); // Memory leak!
}

// ✅ Good
function MyComponent() {
  const unsubscribe = ModalsManager.on('open', handler);

  // Cleanup on unmount
  onUnmount(() => {
    unsubscribe();
  });
}
```

### 3. Use proper error handling

```javascript
// ✅ Good
async function saveData() {
  const loadingId = ModalsManager.showLoading('Saving...');

  try {
    await api.save();
    await ModalsManager.showAlert({
      message: 'Saved!',
      type: 'success'
    });
  } catch (error) {
    await ModalsManager.showAlert({
      title: 'Error',
      message: error.message,
      type: 'error'
    });
  } finally {
    ModalsManager.hideLoading(loadingId);
  }
}
```

### 4. Sanitize user input

```javascript
// User input is automatically sanitized
const userInput = getUserInput();
await ModalsManager.showAlert(userInput); // Safe from XSS
```

---

## Troubleshooting

### Modal not appearing

**Problem:** Modal doesn't show up

**Solutions:**
- Check if CSS files are loaded ([css/modals.css](css/modals.css))
- Check console for errors
- Verify ModalsManager is loaded before usage

### Body scroll not restoring

**Problem:** Page is still not scrollable after closing modal

**Solution:**
```javascript
// Force restore scroll
ModalsManager.closeAll();
document.body.style.overflow = '';
```

### Multiple modals stacking

**Problem:** Too many modals open at once

**Solution:**
```javascript
// Close all before showing new one
ModalsManager.closeAll();
await ModalsManager.showAlert('New alert');
```

### Loading not hiding

**Problem:** Loading overlay stuck on screen

**Solution:**
```javascript
// Always use try/finally
const loadingId = ModalsManager.showLoading();
try {
  await operation();
} finally {
  ModalsManager.hideLoading(loadingId); // Always runs
}
```

---

## Support

- **Issues:** [GitHub Issues](https://github.com/your-repo/issues)
- **Docs:** [Full Documentation](./docs/)
- **Email:** dev-team@example.com

---

**Last Updated:** 2025-10-17
**Version:** 1.0.0
