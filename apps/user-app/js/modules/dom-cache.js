/**
 * DOM Cache Module
 * Provides efficient DOM element caching to reduce repeated queries
 *
 * Created: 2025
 * Part of Law Office Management System
 */

/**
 * DOMCache class - caches DOM elements for faster access
 * Reduces the need for repeated document.getElementById() calls
 */
export class DOMCache {
  constructor() {
    this.elements = new Map();
  }

  getElementById(id) {
    if (this.elements.has(id)) {
      return this.elements.get(id);
    }
    const element = document.getElementById(id);
    if (element) {
      this.elements.set(id, element);
    }
    return element;
  }

  querySelector(selector) {
    if (this.elements.has(selector)) {
      return this.elements.get(selector);
    }
    const element = document.querySelector(selector);
    if (element) {
      this.elements.set(selector, element);
    }
    return element;
  }

  /**
   * Clear the cache (useful when DOM structure changes)
   */
  clear() {
    this.elements.clear();
  }

  /**
   * Remove a specific element from cache
   */
  remove(key) {
    this.elements.delete(key);
  }
}

export default DOMCache;
