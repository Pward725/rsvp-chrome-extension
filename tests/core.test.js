const {
  getORPIndex,
  renderWordWithORP,
  splitWords,
  wpmToMs,
  calcProgress,
  clampIndex,
  validateCSS,
} = require('../lib/core');

// ─── ORP Index ───

describe('getORPIndex', () => {
  test('empty string returns 0', () => {
    expect(getORPIndex('')).toBe(0);
  });

  test('single character returns 0', () => {
    expect(getORPIndex('a')).toBe(0);
  });

  test('2-3 character words return 1', () => {
    expect(getORPIndex('hi')).toBe(1);
    expect(getORPIndex('the')).toBe(1);
  });

  test('4+ character words return ~30% index', () => {
    expect(getORPIndex('word')).toBe(1);       // floor(4 * 0.3) = 1
    expect(getORPIndex('hello')).toBe(1);      // floor(5 * 0.3) = 1
    expect(getORPIndex('reading')).toBe(2);    // floor(7 * 0.3) = 2
    expect(getORPIndex('perception')).toBe(3); // floor(10 * 0.3) = 3
  });

  test('long words scale correctly', () => {
    expect(getORPIndex('extraordinary')).toBe(3); // floor(13 * 0.3) = 3
    expect(getORPIndex('supercalifragilistic')).toBe(6); // floor(20 * 0.3) = 6
  });

  test('index is always within word bounds', () => {
    const words = ['a', 'ab', 'abc', 'abcd', 'abcdefghij', 'abcdefghijklmnopqrstuvwxyz'];
    words.forEach(word => {
      const idx = getORPIndex(word);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(word.length);
    });
  });
});

// ─── ORP Rendering ───

describe('renderWordWithORP', () => {
  test('empty/null returns empty string', () => {
    expect(renderWordWithORP('')).toBe('');
    expect(renderWordWithORP(null)).toBe('');
    expect(renderWordWithORP(undefined)).toBe('');
  });

  test('single character has only pivot', () => {
    const result = renderWordWithORP('I');
    expect(result).toBe('<span class="rsvp-before"></span><span class="rsvp-pivot">I</span><span class="rsvp-after"></span>');
  });

  test('multi-character word splits correctly', () => {
    const result = renderWordWithORP('hello');
    // ORP index for 'hello' (5 chars) = floor(5 * 0.3) = 1
    expect(result).toContain('<span class="rsvp-before">h</span>');
    expect(result).toContain('<span class="rsvp-pivot">e</span>');
    expect(result).toContain('<span class="rsvp-after">llo</span>');
  });

  test('all characters are preserved', () => {
    const word = 'testing';
    const result = renderWordWithORP(word);
    // Strip HTML tags and check all chars are present
    const text = result.replace(/<[^>]+>/g, '');
    expect(text).toBe(word);
  });

  test('special characters preserved', () => {
    const word = "don't";
    const result = renderWordWithORP(word);
    const text = result.replace(/<[^>]+>/g, '');
    expect(text).toBe(word);
  });

  test('output contains exactly 3 spans', () => {
    const result = renderWordWithORP('word');
    const spans = result.match(/<span/g);
    expect(spans).toHaveLength(3);
  });

  test('output contains correct CSS classes', () => {
    const result = renderWordWithORP('test');
    expect(result).toContain('class="rsvp-before"');
    expect(result).toContain('class="rsvp-pivot"');
    expect(result).toContain('class="rsvp-after"');
  });
});

// ─── Word Splitting ───

describe('splitWords', () => {
  test('null/undefined/empty returns empty array', () => {
    expect(splitWords(null)).toEqual([]);
    expect(splitWords(undefined)).toEqual([]);
    expect(splitWords('')).toEqual([]);
  });

  test('non-string returns empty array', () => {
    expect(splitWords(123)).toEqual([]);
    expect(splitWords({})).toEqual([]);
  });

  test('single word', () => {
    expect(splitWords('hello')).toEqual(['hello']);
  });

  test('multiple words with single spaces', () => {
    expect(splitWords('hello world test')).toEqual(['hello', 'world', 'test']);
  });

  test('multiple spaces collapsed', () => {
    expect(splitWords('hello    world')).toEqual(['hello', 'world']);
  });

  test('tabs and newlines treated as separators', () => {
    expect(splitWords('hello\tworld\ntest')).toEqual(['hello', 'world', 'test']);
  });

  test('leading/trailing whitespace ignored', () => {
    expect(splitWords('  hello world  ')).toEqual(['hello', 'world']);
  });

  test('only whitespace returns empty', () => {
    expect(splitWords('   \t\n  ')).toEqual([]);
  });
});

// ─── WPM to Milliseconds ───

describe('wpmToMs', () => {
  test('300 WPM = 200ms', () => {
    expect(wpmToMs(300)).toBe(200);
  });

  test('600 WPM = 100ms', () => {
    expect(wpmToMs(600)).toBe(100);
  });

  test('100 WPM = 600ms', () => {
    expect(wpmToMs(100)).toBe(600);
  });

  test('0 WPM returns Infinity', () => {
    expect(wpmToMs(0)).toBe(Infinity);
  });

  test('negative WPM returns Infinity', () => {
    expect(wpmToMs(-100)).toBe(Infinity);
  });

  test('null/undefined returns Infinity', () => {
    expect(wpmToMs(null)).toBe(Infinity);
    expect(wpmToMs(undefined)).toBe(Infinity);
  });
});

// ─── Progress Calculation ───

describe('calcProgress', () => {
  test('start of text = 0%', () => {
    expect(calcProgress(0, 100)).toBe(0);
  });

  test('end of text = 100%', () => {
    expect(calcProgress(99, 100)).toBe(100);
  });

  test('middle of text = ~50%', () => {
    expect(calcProgress(50, 101)).toBeCloseTo(50);
  });

  test('single word = 100%', () => {
    expect(calcProgress(0, 1)).toBe(100);
  });

  test('two words: first = 0%, second = 100%', () => {
    expect(calcProgress(0, 2)).toBe(0);
    expect(calcProgress(1, 2)).toBe(100);
  });
});

// ─── Index Clamping ───

describe('clampIndex', () => {
  test('negative index clamped to 0', () => {
    expect(clampIndex(-5, 10)).toBe(0);
  });

  test('index beyond length clamped to last', () => {
    expect(clampIndex(15, 10)).toBe(9);
  });

  test('valid index unchanged', () => {
    expect(clampIndex(5, 10)).toBe(5);
  });

  test('0 index stays 0', () => {
    expect(clampIndex(0, 10)).toBe(0);
  });

  test('last valid index stays', () => {
    expect(clampIndex(9, 10)).toBe(9);
  });
});

// ─── CSS Validation ───

describe('validateCSS', () => {
  test('clean CSS passes', () => {
    const result = validateCSS('.foo { color: red; }');
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  test('detects @import', () => {
    const result = validateCSS('@import url("something.css"); .foo { color: red; }');
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain('@import');
  });

  test('detects Google Fonts URL', () => {
    const result = validateCSS('.foo { background: url(https://fonts.googleapis.com/css2); }');
    expect(result.valid).toBe(false);
  });
});
