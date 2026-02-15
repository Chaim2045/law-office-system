/**
 * Presentation Viewer — Fullscreen Carousel
 * GH Law Office System
 *
 * Opens a fullscreen overlay with slide navigation.
 * Supports: arrows, keyboard, swipe (mobile), slide counter, PDF download.
 */

export class PresentationViewer {
  constructor() {
    this.overlay = null;
    this.presentation = null;
    this.currentSlide = 0;
    this.totalSlides = 0;
    this._keyHandler = null;
    this._touchStartX = 0;
    this._touchEndX = 0;
  }

  // ════════════════════════════════════
  // Lifecycle
  // ════════════════════════════════════

  open(presentation) {
    this.presentation = presentation;
    this.currentSlide = 0;
    this.totalSlides = presentation.slides?.length || 0;

    if (this.totalSlides === 0) {
      console.warn('PresentationViewer: No slides');
      return;
    }

    // Sort slides by order
    this.presentation.slides.sort((a, b) => a.order - b.order);

    this._render();
    this._bindEvents();
    document.body.style.overflow = 'hidden';
  }

  destroy() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    document.body.style.overflow = '';
  }

  // ════════════════════════════════════
  // Navigation
  // ════════════════════════════════════

  goTo(index) {
    if (index < 0 || index >= this.totalSlides) {
return;
}
    this.currentSlide = index;
    this._updateSlide();
  }

  next() {
    if (this.currentSlide < this.totalSlides - 1) {
      this.goTo(this.currentSlide + 1);
    }
  }

  prev() {
    if (this.currentSlide > 0) {
      this.goTo(this.currentSlide - 1);
    }
  }

  // ════════════════════════════════════
  // Rendering
  // ════════════════════════════════════

  _render() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'gh-bm-viewer-overlay';
    this.overlay.innerHTML = `
      <div class="gh-bm-viewer">
        <div class="gh-bm-viewer-header">
          <div class="gh-bm-viewer-title">${this.presentation.title || ''}</div>
          <div class="gh-bm-viewer-controls">
            <span class="gh-bm-viewer-counter">
              ${this.totalSlides} / 1
            </span>
            ${this.presentation.pdfUrl ? `
              <a class="gh-bm-viewer-download" href="${this.presentation.pdfUrl}" target="_blank" title="הורד PDF">
                <i class="fas fa-download"></i>
              </a>
            ` : ''}
            <button class="gh-bm-viewer-close" title="סגור (ESC)">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        <div class="gh-bm-viewer-stage">
          <button class="gh-bm-viewer-arrow gh-bm-viewer-arrow-right" title="הקודם">
            <i class="fas fa-chevron-right"></i>
          </button>
          <div class="gh-bm-viewer-slide-container">
            <img class="gh-bm-viewer-slide" src="${this.presentation.slides[0].url}" alt="Slide 1" />
          </div>
          <button class="gh-bm-viewer-arrow gh-bm-viewer-arrow-left" title="הבא">
            <i class="fas fa-chevron-left"></i>
          </button>
        </div>
        <div class="gh-bm-viewer-dots">
          ${this.presentation.slides.map((_, i) => `
            <button class="gh-bm-viewer-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></button>
          `).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    // Fade in
    requestAnimationFrame(() => {
      this.overlay.classList.add('visible');
    });
  }

  _updateSlide() {
    if (!this.overlay) {
return;
}

    const img = this.overlay.querySelector('.gh-bm-viewer-slide');
    const counter = this.overlay.querySelector('.gh-bm-viewer-counter');
    const dots = this.overlay.querySelectorAll('.gh-bm-viewer-dot');
    const arrowRight = this.overlay.querySelector('.gh-bm-viewer-arrow-right');
    const arrowLeft = this.overlay.querySelector('.gh-bm-viewer-arrow-left');

    // Update image
    const slide = this.presentation.slides[this.currentSlide];
    if (img && slide) {
      img.src = slide.url;
      img.alt = `Slide ${this.currentSlide + 1}`;
    }

    // Update counter (RTL: total / current)
    if (counter) {
      counter.textContent = `${this.totalSlides} / ${this.currentSlide + 1}`;
    }

    // Update dots
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === this.currentSlide);
    });

    // Update arrows
    if (arrowRight) {
      arrowRight.style.opacity = this.currentSlide > 0 ? '1' : '0.3';
      arrowRight.style.pointerEvents = this.currentSlide > 0 ? 'auto' : 'none';
    }
    if (arrowLeft) {
      arrowLeft.style.opacity = this.currentSlide < this.totalSlides - 1 ? '1' : '0.3';
      arrowLeft.style.pointerEvents = this.currentSlide < this.totalSlides - 1 ? 'auto' : 'none';
    }
  }

  // ════════════════════════════════════
  // Events
  // ════════════════════════════════════

  _bindEvents() {
    if (!this.overlay) {
return;
}

    // Close button
    this.overlay.querySelector('.gh-bm-viewer-close')?.addEventListener('click', () => this.destroy());

    // Overlay background click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay || e.target.classList.contains('gh-bm-viewer')) {
        this.destroy();
      }
    });

    // Arrows (RTL: right = prev, left = next)
    this.overlay.querySelector('.gh-bm-viewer-arrow-right')?.addEventListener('click', () => this.prev());
    this.overlay.querySelector('.gh-bm-viewer-arrow-left')?.addEventListener('click', () => this.next());

    // Dots
    this.overlay.querySelectorAll('.gh-bm-viewer-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        this.goTo(parseInt(dot.dataset.index));
      });
    });

    // Keyboard
    this._keyHandler = (e) => {
      switch (e.key) {
        case 'Escape': this.destroy(); break;
        case 'ArrowRight': this.prev(); break;  // RTL
        case 'ArrowLeft': this.next(); break;    // RTL
        case 'Home': this.goTo(0); break;
        case 'End': this.goTo(this.totalSlides - 1); break;
      }
    };
    document.addEventListener('keydown', this._keyHandler);

    // Touch swipe (mobile)
    const stage = this.overlay.querySelector('.gh-bm-viewer-stage');
    if (stage) {
      stage.addEventListener('touchstart', (e) => {
        this._touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      stage.addEventListener('touchend', (e) => {
        this._touchEndX = e.changedTouches[0].screenX;
        const diff = this._touchStartX - this._touchEndX;
        if (Math.abs(diff) > 50) {
          // RTL: swipe left = prev, swipe right = next
          if (diff > 0) {
this.prev();
} else {
this.next();
}
        }
      }, { passive: true });
    }
  }
}
