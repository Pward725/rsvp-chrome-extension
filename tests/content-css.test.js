const fs = require('fs');
const path = require('path');

describe('content.js CSS validation', () => {
  let cssText;

  beforeAll(() => {
    const content = fs.readFileSync(
      path.join(__dirname, '..', 'content.js'),
      'utf-8'
    );
    // Extract CSS_TEXT string from content.js
    const match = content.match(/const CSS_TEXT\s*=\s*`([\s\S]*?)`;/);
    if (match) {
      cssText = match[1];
    }
  });

  test('CSS_TEXT is extractable', () => {
    expect(cssText).toBeDefined();
    expect(cssText.length).toBeGreaterThan(0);
  });

  test('no @import statements (breaks shadow DOM)', () => {
    expect(cssText).not.toMatch(/@import/);
  });

  test('no external URL references in CSS', () => {
    // urls to external resources won't load inside shadow DOM reliably
    const externalUrls = cssText.match(/url\s*\(\s*['"]?https?:\/\//g);
    expect(externalUrls).toBeNull();
  });

  test('contains required class selectors', () => {
    const requiredClasses = [
      '.rsvp-overlay',
      '.rsvp-word',
      '.rsvp-pivot',
      '.rsvp-before',
      '.rsvp-after',
      '.rsvp-controls',
      '.rsvp-progress-bar',
      '.rsvp-progress-track',
      '.rsvp-btn',
      '.rsvp-play-btn',
      '.rsvp-close-btn',
      '.rsvp-counter',
      '.rsvp-wpm-slider',
      '.rsvp-wpm-label',
      '.rsvp-shortcuts',
      '.rsvp-paused-label',
    ];
    requiredClasses.forEach(cls => {
      expect(cssText).toContain(cls);
    });
  });

  test('overlay has full viewport coverage', () => {
    expect(cssText).toMatch(/width:\s*100vw/);
    expect(cssText).toMatch(/height:\s*100vh/);
    expect(cssText).toMatch(/position:\s*fixed/);
  });

  test('overlay has max z-index', () => {
    expect(cssText).toContain('2147483647');
  });

  test('pivot has distinct color from before/after', () => {
    const pivotColor = cssText.match(/\.rsvp-pivot\s*\{[^}]*color:\s*([^;]+)/);
    const beforeColor = cssText.match(/\.rsvp-before[^{]*\{[^}]*color:\s*([^;]+)/);
    expect(pivotColor).not.toBeNull();
    expect(beforeColor).not.toBeNull();
    if (pivotColor && beforeColor) {
      expect(pivotColor[1].trim()).not.toBe(beforeColor[1].trim());
    }
  });
});

describe('content.js structure validation', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(
      path.join(__dirname, '..', 'content.js'),
      'utf-8'
    );
  });

  test('is wrapped in IIFE', () => {
    expect(content.trimStart()).toMatch(/^\(\(\)\s*=>\s*\{/);
    expect(content.trimEnd()).toMatch(/\}\)\(\);?\s*$/);
  });

  test('listens for startRSVP message', () => {
    expect(content).toContain("message.action === 'startRSVP'");
  });

  test('uses shadow DOM (closed mode)', () => {
    expect(content).toContain("attachShadow({ mode: 'closed' })");
  });

  test('registers keydown handler', () => {
    expect(content).toContain("addEventListener('keydown'");
  });

  test('handles keyboard shortcuts', () => {
    expect(content).toContain("'Space'");
    expect(content).toContain("'ArrowLeft'");
    expect(content).toContain("'ArrowRight'");
    expect(content).toContain("'Escape'");
    expect(content).toContain("'KeyR'");
  });

  test('cleans up keydown handler on remove', () => {
    expect(content).toContain("removeEventListener('keydown'");
  });

  test('uses innerHTML for ORP rendering (not textContent)', () => {
    expect(content).toMatch(/wordEl\.innerHTML\s*=\s*renderWordWithORP/);
  });
});
