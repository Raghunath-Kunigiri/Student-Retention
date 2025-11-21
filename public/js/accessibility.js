/**
 * Accessibility Utilities for Midnight Glass Theme
 * Provides keyboard navigation, focus management, and ARIA support
 */

/**
 * Focus trap for modals - keeps focus within modal when open
 */
class FocusTrap {
  constructor(container) {
    this.container = container;
    this.previousActiveElement = null;
    this.focusableElements = null;
    this.firstFocusable = null;
    this.lastFocusable = null;
  }

  init() {
    // Store the element that had focus before opening modal
    this.previousActiveElement = document.activeElement;
    
    // Get all focusable elements within the modal
    this.focusableElements = this.container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    
    if (this.focusableElements.length === 0) return;
    
    this.firstFocusable = this.focusableElements[0];
    this.lastFocusable = this.focusableElements[this.focusableElements.length - 1];
    
    // Focus first element
    this.firstFocusable.focus();
    
    // Add keyboard event listener
    this.container.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  handleKeyDown(e) {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === this.firstFocusable) {
        e.preventDefault();
        this.lastFocusable.focus();
      }
    } else {
      // Tab
      if (document.activeElement === this.lastFocusable) {
        e.preventDefault();
        this.firstFocusable.focus();
      }
    }
  }

  destroy() {
    // Restore focus to previous element
    if (this.previousActiveElement) {
      this.previousActiveElement.focus();
    }
    this.container.removeEventListener('keydown', this.handleKeyDown.bind(this));
  }
}

/**
 * Keyboard navigation for search results
 */
class SearchKeyboardNav {
  constructor(searchInput, resultsContainer) {
    this.searchInput = searchInput;
    this.resultsContainer = resultsContainer;
    this.currentIndex = -1;
    this.items = [];
  }

  init() {
    this.searchInput.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.updateItems();
  }

  updateItems() {
    this.items = Array.from(
      this.resultsContainer.querySelectorAll('[role="option"]')
    );
    this.currentIndex = -1;
  }

  handleKeyDown(e) {
    if (!this.resultsContainer.hasAttribute('aria-expanded') || 
        this.resultsContainer.getAttribute('aria-expanded') !== 'true') {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.navigateDown();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.navigateUp();
        break;
      case 'Enter':
        if (this.currentIndex >= 0 && this.items[this.currentIndex]) {
          e.preventDefault();
          this.items[this.currentIndex].click();
        }
        break;
      case 'Escape':
        this.closeResults();
        break;
    }
  }

  navigateDown() {
    this.updateItems();
    if (this.items.length === 0) return;
    
    this.currentIndex = (this.currentIndex + 1) % this.items.length;
    this.items[this.currentIndex].focus();
    this.items[this.currentIndex].setAttribute('aria-selected', 'true');
    this.items.forEach((item, idx) => {
      if (idx !== this.currentIndex) {
        item.setAttribute('aria-selected', 'false');
      }
    });
  }

  navigateUp() {
    this.updateItems();
    if (this.items.length === 0) return;
    
    this.currentIndex = this.currentIndex <= 0 
      ? this.items.length - 1 
      : this.currentIndex - 1;
    this.items[this.currentIndex].focus();
    this.items[this.currentIndex].setAttribute('aria-selected', 'true');
    this.items.forEach((item, idx) => {
      if (idx !== this.currentIndex) {
        item.setAttribute('aria-selected', 'false');
      }
    });
  }

  closeResults() {
    this.resultsContainer.setAttribute('aria-expanded', 'false');
    this.resultsContainer.style.display = 'none';
    this.searchInput.focus();
  }
}

/**
 * Initialize accessibility features
 */
function initAccessibility() {
  // Initialize search keyboard navigation
  const searchInput = document.getElementById('student-search-input');
  const searchResults = document.getElementById('student-search-results');
  
  if (searchInput && searchResults) {
    const searchNav = new SearchKeyboardNav(searchInput, searchResults);
    searchNav.init();
  }
  
  // Add ARIA labels to modals
  const studentModal = document.getElementById('student-details-modal');
  const responseModal = document.getElementById('response-modal');
  
  if (studentModal) {
    studentModal.setAttribute('role', 'dialog');
    studentModal.setAttribute('aria-modal', 'true');
    studentModal.setAttribute('aria-labelledby', 'student-modal-title');
  }
  
  if (responseModal) {
    responseModal.setAttribute('role', 'dialog');
    responseModal.setAttribute('aria-modal', 'true');
    responseModal.setAttribute('aria-labelledby', 'response-modal-title');
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAccessibility);
} else {
  initAccessibility();
}

// Export for use in other scripts
window.FocusTrap = FocusTrap;
window.SearchKeyboardNav = SearchKeyboardNav;

