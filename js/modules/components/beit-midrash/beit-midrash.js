/**
 * Beit Midrash Component — Presentations Library
 * GH Law Office System
 *
 * Displays a grid of presentation cards fetched from Firestore.
 * Clicking a card opens PresentationViewer (fullscreen carousel).
 *
 * Dependencies:
 *   - Firebase Firestore (window.firebaseDB)
 *   - PresentationViewer from ./beit-midrash-viewer.js
 *
 * Firestore collection: presentations
 * Document structure:
 *   {
 *     title: string,
 *     topic: string,
 *     description: string,
 *     date: Timestamp,
 *     slidesCount: number,
 *     slides: [{ url: string, order: number }],
 *     pdfUrl: string,
 *     thumbnail: string,
 *     active: boolean
 *   }
 */

import { PresentationViewer } from './beit-midrash-viewer.js';

export class BeitMidrash {
  constructor(container) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    this.db = window.firebaseDB;
    this.presentations = [];
    this.filteredPresentations = [];
    this.viewer = null;
    this._listeners = [];
    this._cssElement = null;
  }

  // ════════════════════════════════════
  // Lifecycle
  // ════════════════════════════════════

  async init() {
    this._injectCSS();
    this.render();
    this._bindEvents();
    await this.fetchPresentations();
  }

  destroy() {
    this.hide();
    if (this.topbar) {
      this.topbar.remove();
      this.topbar = null;
    }
    if (this.searchFloat) {
      this.searchFloat.remove();
      this.searchFloat = null;
    }
    this._listeners.forEach(({ el, event, handler }) => {
      el.removeEventListener(event, handler);
    });
    this._listeners = [];
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
    this._removeCSS();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  // ════════════════════════════════════
  // Data
  // ════════════════════════════════════

  async fetchPresentations() {
    if (!this.db) {
      console.error('BeitMidrash: Firestore not available');
      this._renderEmpty('לא ניתן להתחבר למסד הנתונים');
      return;
    }

    try {
      this._renderLoading();

      const snapshot = await this.db
        .collection('presentations')
        .where('active', '==', true)
        .orderBy('date', 'desc')
        .get();

      this.presentations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      this.filteredPresentations = [...this.presentations];
      this._renderCards();
    } catch (error) {
      console.error('BeitMidrash: Failed to fetch presentations', error);
      this._renderEmpty('שגיאה בטעינת המצגות');
    }
  }

  // ════════════════════════════════════
  // Search
  // ════════════════════════════════════

  _handleSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      this.filteredPresentations = [...this.presentations];
    } else {
      this.filteredPresentations = this.presentations.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.topic || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }
    this._renderCards();
  }

  // ════════════════════════════════════
  // Rendering
  // ════════════════════════════════════

  render() {
    // Create topbar (fixed, outside container)
    this.topbar = document.createElement('div');
    this.topbar.className = 'gh-bm-topbar';
    this.topbar.innerHTML = `
      <div class="gh-bm-topbar-content">
        <div class="gh-bm-topbar-title">
          <i class="fas fa-book-open"></i>
          <span>ברוכים הבאים לבית המדרש</span>
        </div>
        <div class="gh-bm-topbar-subtitle">ספריית הלמידה של משרד עו"ד גיא הרשקוביץ</div>
      </div>
    `;
    document.body.appendChild(this.topbar);

    // Create floating search (fixed, outside container)
    this.searchFloat = document.createElement('div');
    this.searchFloat.className = 'gh-bm-search-float';
    this.searchFloat.innerHTML = `
      <div class="gh-bm-search-container">
        <input type="text" class="gh-bm-search" placeholder="חיפוש לפי נושא, כותרת..." />
        <i class="fas fa-search gh-bm-search-icon"></i>
      </div>
    `;
    document.body.appendChild(this.searchFloat);

    // Container content (count + grid)
    this.container.innerHTML = `
      <div class="gh-bm-root">
        <div class="gh-bm-count"></div>
        <div class="gh-bm-grid"></div>
      </div>
    `;
  }

  show() {
    // Hide top-user-bar
    const topBar = document.querySelector('.top-user-bar');
    if (topBar) {
topBar.classList.add('bm-hidden');
}

    // Show beit midrash topbar + search
    requestAnimationFrame(() => {
      if (this.topbar) {
this.topbar.classList.add('visible');
}
      if (this.searchFloat) {
this.searchFloat.classList.add('visible');
}
    });
  }

  hide() {
    // Show top-user-bar
    const topBar = document.querySelector('.top-user-bar');
    if (topBar) {
topBar.classList.remove('bm-hidden');
}

    // Hide beit midrash topbar + search
    if (this.topbar) {
this.topbar.classList.remove('visible');
}
    if (this.searchFloat) {
this.searchFloat.classList.remove('visible');
}
  }

  _renderLoading() {
    const grid = this.container.querySelector('.gh-bm-grid');
    if (!grid) {
return;
}
    grid.innerHTML = `
      <div class="gh-bm-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <span>טוען מצגות...</span>
      </div>
    `;
  }

  _renderEmpty(message = 'אין מצגות להצגה') {
    const grid = this.container.querySelector('.gh-bm-grid');
    if (!grid) {
return;
}
    grid.innerHTML = `
      <div class="gh-bm-empty">
        <div class="gh-bm-empty-icon">
          <i class="fas fa-book-open"></i>
        </div>
        <h3 class="gh-bm-empty-title">${message}</h3>
        <p class="gh-bm-empty-subtitle">תכנים חדשים יתווספו בקרוב</p>
      </div>
    `;
    this._updateCount(0);
  }

  _renderCards() {
    const grid = this.container.querySelector('.gh-bm-grid');
    if (!grid) {
return;
}

    if (this.filteredPresentations.length === 0) {
      this._renderEmpty();
      return;
    }

    grid.innerHTML = this.filteredPresentations.map(p => this._renderCard(p)).join('');
    this._updateCount(this.filteredPresentations.length);
  }

  _renderCard(presentation) {
    const date = presentation.date?.toDate
      ? presentation.date.toDate().toLocaleDateString('he-IL')
      : '';

    const thumbnail = presentation.thumbnail || '';
    const thumbnailStyle = thumbnail ? `background-image: url('${thumbnail}')` : '';
    const hasVideo = !!presentation.videoUrl;

    return `
      <div class="gh-bm-card" data-presentation-id="${presentation.id}">
        <div class="gh-bm-card-thumbnail" style="${thumbnailStyle}">
          ${!thumbnail ? '<i class="fas fa-file-powerpoint"></i>' : ''}
          ${hasVideo ? '<div class="gh-bm-card-video-badge"><i class="fas fa-play-circle"></i> סרטון</div>' : ''}
          <div class="gh-bm-card-slides-count">
            <i class="fas fa-images"></i>
            ${presentation.slidesCount || 0} שקפים
          </div>
        </div>
        <div class="gh-bm-card-body">
          <div class="gh-bm-card-topic">${presentation.topic || ''}</div>
          <div class="gh-bm-card-title">${presentation.title || 'ללא כותרת'}</div>
          ${presentation.description ? `
            <div class="gh-bm-card-desc">
              <span class="gh-bm-card-desc-text">${presentation.description}</span>
              <button class="gh-bm-card-read-more">קרא עוד</button>
            </div>
          ` : ''}
          <div class="gh-bm-card-footer">
            <span class="gh-bm-card-date">
              <i class="fas fa-calendar-alt"></i>
              ${date}
            </span>
            <div class="gh-bm-card-tags">
              ${hasVideo ? '<span class="gh-bm-tag gh-bm-tag-video"><i class="fas fa-video"></i></span>' : ''}
              <span class="gh-bm-tag gh-bm-tag-slides"><i class="fas fa-images"></i></span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _updateCount(count) {
    const countEl = this.container.querySelector('.gh-bm-count');
    if (countEl) {
      countEl.textContent = count > 0 ? `${count} מצגות` : '';
    }
  }

  // ════════════════════════════════════
  // Events
  // ════════════════════════════════════

  _bindEvents() {
    const root = this.container;

    // Search (input lives in this.searchFloat, outside container)
    const searchInput = this.searchFloat
      ? this.searchFloat.querySelector('.gh-bm-search')
      : null;
    if (searchInput) {
      const handler = () => this._handleSearch(searchInput.value);
      searchInput.addEventListener('input', handler);
      this._listeners.push({ el: searchInput, event: 'input', handler });
    }

    // Read more toggle
    this._on(root, 'click', (e) => {
      if (e.target.classList.contains('gh-bm-card-read-more')) {
        e.stopPropagation();
        e.preventDefault();
        const descText = e.target.previousElementSibling;
        if (descText) {
          descText.classList.toggle('expanded');
          e.target.textContent = descText.classList.contains('expanded') ? 'פחות' : 'קרא עוד';
        }
      }
    });

    // Card click → open viewer
    this._on(root, 'click', (e) => {
      if (e.target.closest('.gh-bm-card-read-more')) {
return;
}
      const card = e.target.closest('.gh-bm-card');
      if (!card) {
return;
}

      const id = card.dataset.presentationId;
      const presentation = this.presentations.find(p => p.id === id);
      if (!presentation) {
return;
}

      this._openViewer(presentation);
    });
  }

  _openViewer(presentation) {
    if (this.viewer) {
      this.viewer.destroy();
    }
    this.viewer = new PresentationViewer();
    this.viewer.open(presentation);
  }

  _on(el, event, handler) {
    el.addEventListener(event, handler);
    this._listeners.push({ el, event, handler });
  }

  // ════════════════════════════════════
  // CSS Injection
  // ════════════════════════════════════

  _injectCSS() {
    if (document.getElementById('gh-bm-css')) {
return;
}
    const link = document.createElement('link');
    link.id = 'gh-bm-css';
    link.rel = 'stylesheet';
    link.href = '/js/modules/components/beit-midrash/beit-midrash.css';
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
