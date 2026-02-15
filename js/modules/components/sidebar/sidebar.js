/**
 * Sidebar Component
 * GH Law Office System
 *
 * Dependencies:
 *   - SIDEBAR_CONFIG from sidebar-config.js
 *   - Font Awesome 6.5.1 (already loaded globally)
 *   - window.switchTab (from navigation.js)
 *   - window.logout (from authentication.js)
 *   - window.CaseCreationDialog (from case-creation-dialog.js)
 *   - window.manager (from main.js)
 *
 * IDs preserved for backward compatibility:
 *   - #minimalSidebar (authentication.js)
 *   - #sidebarBreakBtn (BreakManager)
 */

import { SIDEBAR_CONFIG } from './sidebar-config.js';

export class Sidebar {
  constructor(container, config = SIDEBAR_CONFIG) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    this.config = config;
    this.activeNavId = null;
    this.activeFlyoutItemId = null;
    this._listeners = [];
    this._cssElement = null;
    this._onNavigateCallback = null;
  }

  // ════════════════════════════════════
  // Lifecycle
  // ════════════════════════════════════

  init() {
    this._injectCSS();
    this.render();
    this._bindEvents();
    // Set default active
    if (this.config.nav.length > 0) {
      const firstNav = this.config.nav[0];
      this.setActivePage(firstNav.id, firstNav.defaultPage || firstNav.id);
    }
  }

  destroy() {
    this._listeners.forEach(({ el, event, handler }) => {
      el.removeEventListener(event, handler);
    });
    this._listeners = [];
    this._removeCSS();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  onNavigate(callback) {
    this._onNavigateCallback = callback;
  }

  // ════════════════════════════════════
  // Rendering
  // ════════════════════════════════════

  render() {
    const cfg = this.config;

    const html = `
      <div class="gh-sidebar-root" id="${cfg.rootId}">
        ${this._renderBrand()}
        <div class="gh-sidebar-group">
          ${cfg.nav.map(item => this._renderNavItem(item)).join('')}
        </div>
        <div class="gh-sidebar-group">
          ${cfg.actions.map(item => this._renderActionItem(item)).join('')}
        </div>
        <div class="gh-sidebar-footer">
          ${this._renderFooter()}
        </div>
      </div>
    `;

    this.container.innerHTML = html;
  }

  _renderBrand() {
    const { brand } = this.config;
    return `
      <div class="gh-sidebar-brand">
        <div class="gh-sidebar-brand-logo"></div>
        <div class="gh-sidebar-brand-name">${brand.name}</div>
      </div>
    `;
  }

  _renderNavItem(item) {
    const badgeHtml = item.badge === 'new'
      ? '<span class="gh-sidebar-badge-new"></span>'
      : '';

    const flyoutHtml = item.flyout
      ? this._renderFlyout(item)
      : '';

    return `
      <div class="gh-sidebar-item-wrapper">
        <button class="gh-sidebar-item" data-nav-id="${item.id}" title="${item.label}">
          ${badgeHtml}
          <i class="fas ${item.icon}"></i>
          <span>${item.label}</span>
        </button>
        ${flyoutHtml}
      </div>
    `;
  }

  _renderFlyout(item) {
    const items = item.flyout.map(sub => `
      <button class="gh-sidebar-flyout-item" data-flyout-id="${sub.id}"
              ${sub.tabName ? `data-tab-name="${sub.tabName}"` : ''}
              ${sub.actionType ? `data-action-type="${sub.actionType}"` : ''}>
        <i class="fas ${sub.icon}"></i>
        ${sub.label}
      </button>
    `).join('');

    return `
      <div class="gh-sidebar-flyout">
        <div class="gh-sidebar-flyout-header">${item.label}</div>
        ${items}
      </div>
    `;
  }

  _renderActionItem(item) {
    const styleClass = item.style === 'cta' ? ' gh-sidebar-item--cta' : '';
    return `
      <div class="gh-sidebar-item-wrapper">
        <button class="gh-sidebar-item${styleClass}" data-action="${item.actionType}" title="${item.label}">
          <i class="fas ${item.icon}"></i>
          <span>${item.label}</span>
        </button>
      </div>
    `;
  }

  _renderFooter() {
    const { footer, breakButtonId } = this.config;
    return `
      <div class="gh-sidebar-item-wrapper">
        <div class="sidebar-break-btn" id="${breakButtonId}" title="${footer.breakButton.label}">
          <div class="sidebar-break-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
                 stroke="currentColor" stroke-width="1.5"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 8h1a4 4 0 0 1 0 8h-1"/>
              <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
              <line x1="6" y1="1" x2="6" y2="4"/>
              <line x1="10" y1="1" x2="10" y2="4"/>
              <line x1="14" y1="1" x2="14" y2="4"/>
            </svg>
          </div>
          <span class="sidebar-break-label">${footer.breakButton.label}</span>
        </div>
      </div>
      <div class="gh-sidebar-item-wrapper">
        <button class="gh-sidebar-item gh-sidebar-item--danger" data-action="${footer.logout.actionType}" title="${footer.logout.label}">
          <i class="fas ${footer.logout.icon}"></i>
          <span>${footer.logout.label}</span>
        </button>
      </div>
      <button class="gh-sidebar-collapse" title="כווץ סרגל">
        <i class="fas fa-chevron-left"></i>
      </button>
    `;
  }

  // ════════════════════════════════════
  // Behavior
  // ════════════════════════════════════

  setActivePage(navId, flyoutItemId = null) {
    this.activeNavId = navId;
    this.activeFlyoutItemId = flyoutItemId;

    // Update nav items
    const navItems = this.container.querySelectorAll('.gh-sidebar-item[data-nav-id]');
    navItems.forEach(el => {
      el.classList.toggle('active', el.dataset.navId === navId);
    });

    // Update flyout items
    const flyoutItems = this.container.querySelectorAll('.gh-sidebar-flyout-item');
    flyoutItems.forEach(el => {
      el.classList.toggle('active', el.dataset.flyoutId === flyoutItemId);
    });
  }

  toggle() {
    const root = this.container.querySelector('.gh-sidebar-root');
    if (root) {
      root.classList.toggle('open');
    }
  }

  // ════════════════════════════════════
  // Events
  // ════════════════════════════════════

  _bindEvents() {
    const root = this.container.querySelector('.gh-sidebar-root');
    if (!root) {
return;
}

    // Nav item clicks (items WITHOUT flyout)
    this._on(root, 'click', (e) => {
      const navItem = e.target.closest('.gh-sidebar-item[data-nav-id]');
      if (!navItem) {
return;
}

      const navId = navItem.dataset.navId;
      const navConfig = this.config.nav.find(n => n.id === navId);
      if (!navConfig) {
return;
}

      // If has flyout — don't navigate on click (flyout handles it)
      if (navConfig.flyout) {
return;
}

      // Direct navigation
      this.setActivePage(navId);
      if (navConfig.tabName && window.switchTab) {
        window.switchTab(navConfig.tabName);
      }
      if (this._onNavigateCallback) {
        this._onNavigateCallback(navId, null);
      }
    });

    // Flyout item clicks
    this._on(root, 'click', (e) => {
      const flyoutItem = e.target.closest('.gh-sidebar-flyout-item');
      if (!flyoutItem) {
return;
}

      const flyoutId = flyoutItem.dataset.flyoutId;
      const tabName = flyoutItem.dataset.tabName;
      const actionType = flyoutItem.dataset.actionType;

      // Find parent nav
      const wrapper = flyoutItem.closest('.gh-sidebar-item-wrapper');
      const parentNav = wrapper?.querySelector('.gh-sidebar-item[data-nav-id]');
      const navId = parentNav?.dataset.navId;

      this.setActivePage(navId, flyoutId);

      if (tabName && window.switchTab) {
        window.switchTab(tabName);
      } else if (actionType) {
        this._handleAction(actionType);
      }

      if (this._onNavigateCallback) {
        this._onNavigateCallback(navId, flyoutId);
      }

      // Close flyout on mobile
      if (window.innerWidth <= 768) {
        this.toggle();
      }
    });

    // Action buttons
    this._on(root, 'click', (e) => {
      const actionBtn = e.target.closest('.gh-sidebar-item[data-action]');
      if (!actionBtn) {
return;
}

      this._handleAction(actionBtn.dataset.action);
    });

    // Collapse button (future use)
    this._on(root, 'click', (e) => {
      if (e.target.closest('.gh-sidebar-collapse')) {
        // Future: collapse sidebar
      }
    });
  }

  _on(el, event, handler) {
    el.addEventListener(event, handler);
    this._listeners.push({ el, event, handler });
  }

  _handleAction(actionType) {
    switch (actionType) {
      case 'new-client':
        if (window.CaseCreationDialog) {
          new window.CaseCreationDialog().open();
        }
        break;
      case 'existing-client':
        if (window.CaseCreationDialog) {
          new window.CaseCreationDialog().open();
          // TODO: בעתיד — לפתוח ישר במצב לקוח קיים
        }
        break;
      case 'refresh':
        if (window.manager?.loadDataFromFirebase) {
          window.manager.loadDataFromFirebase();
        }
        break;
      case 'logout':
        if (window.logout) {
          window.logout();
        }
        break;
    }
  }

  // ════════════════════════════════════
  // CSS Injection
  // ════════════════════════════════════

  _injectCSS() {
    if (document.getElementById('gh-sidebar-css')) {
return;
}

    const link = document.createElement('link');
    link.id = 'gh-sidebar-css';
    link.rel = 'stylesheet';
    link.href = '/js/modules/components/sidebar/sidebar.css';
    document.head.appendChild(link);
    this._cssElement = link;
  }

  _removeCSS() {
    if (this._cssElement) {
      this._cssElement.remove();
      this._cssElement = null;
    }
  }
}
