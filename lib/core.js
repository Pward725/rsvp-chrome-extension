// Core logic extracted for testability
// These functions are used by content.js and can be tested independently

/**
 * Get the Optimal Recognition Point index for a word.
 * ~30% into the word to help eye fixation during RSVP reading.
 * @param {string} word
 * @returns {number} index of the ORP letter
 */
function getORPIndex(word) {
  const len = word.length;
  if (len <= 0) return 0;
  if (len <= 1) return 0;
  if (len <= 3) return 1;
  return Math.floor(len * 0.3);
}

/**
 * Render a word with ORP markup (before, pivot, after spans).
 * @param {string} word
 * @returns {string} HTML string with ORP spans
 */
function renderWordWithORP(word) {
  if (!word || word.length === 0) return '';
  const i = getORPIndex(word);
  const before = word.substring(0, i);
  const pivot = word[i];
  const after = word.substring(i + 1);
  return `<span class="rsvp-before">${before}</span><span class="rsvp-pivot">${pivot}</span><span class="rsvp-after">${after}</span>`;
}

/**
 * Split text into words, filtering empty strings.
 * @param {string} text
 * @returns {string[]} array of words
 */
function splitWords(text) {
  if (!text || typeof text !== 'string') return [];
  return text.split(/\s+/).filter(w => w.length > 0);
}

/**
 * Calculate interval in ms from WPM.
 * @param {number} wpm - words per minute
 * @returns {number} milliseconds per word
 */
function wpmToMs(wpm) {
  if (!wpm || wpm <= 0) return Infinity;
  return 60000 / wpm;
}

/**
 * Calculate progress percentage.
 * @param {number} currentIndex
 * @param {number} totalWords
 * @returns {number} percentage 0-100
 */
function calcProgress(currentIndex, totalWords) {
  if (totalWords <= 1) return 100;
  return (currentIndex / (totalWords - 1)) * 100;
}

/**
 * Clamp index within valid word bounds.
 * @param {number} index
 * @param {number} totalWords
 * @returns {number} clamped index
 */
function clampIndex(index, totalWords) {
  return Math.max(0, Math.min(index, totalWords - 1));
}

/**
 * Validate CSS text doesn't contain problematic constructs for shadow DOM.
 * @param {string} css
 * @returns {{ valid: boolean, issues: string[] }}
 */
function validateCSS(css) {
  const issues = [];
  if (css.includes('@import')) {
    issues.push('@import is not supported inside shadow DOM stylesheets');
  }
  if (css.includes('url(') && css.includes('fonts.googleapis')) {
    issues.push('External font URLs inside shadow DOM may not load correctly');
  }
  return { valid: issues.length === 0, issues };
}

// Export for testing (Node.js) or attach to window for browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getORPIndex,
    renderWordWithORP,
    splitWords,
    wpmToMs,
    calcProgress,
    clampIndex,
    validateCSS,
  };
}
