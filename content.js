(() => {
  let overlay = null;
  let shadowRoot = null;
  let words = [];
  let currentIndex = 0;
  let isPlaying = false;
  let wpm = 300;
  let intervalId = null;

  // DOM refs
  let wordEl, counterEl, progressBar, playBtn;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startRSVP' && message.text) {
      startReader(message.text.trim());
    }
  });

  function startReader(text) {
    words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return;

    currentIndex = 0;
    isPlaying = false;

    // Load saved WPM
    chrome.storage.local.get('rsvpWPM', (data) => {
      if (data.rsvpWPM) wpm = data.rsvpWPM;
      createOverlay();
      updateDisplay();
      // Auto-play
      togglePlay();
    });
  }

  function createOverlay() {
    removeOverlay();

    const host = document.createElement('div');
    host.id = 'rsvp-speed-reader-host';
    shadowRoot = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = CSS_TEXT;
    shadowRoot.appendChild(style);

    const el = document.createElement('div');
    el.className = 'rsvp-overlay';
    el.innerHTML = `
      <button class="rsvp-close-btn" title="Close (Esc)">✕</button>
      <div class="rsvp-word-container">
        <div class="rsvp-word"></div>
      </div>
      <div class="rsvp-controls">
        <div class="rsvp-counter"></div>
        <div class="rsvp-progress-track">
          <div class="rsvp-progress-bar"></div>
        </div>
        <div class="rsvp-buttons">
          <button class="rsvp-btn rsvp-restart-btn" title="Restart (R)">⏮</button>
          <button class="rsvp-btn rsvp-rewind-btn" title="Back 10 (←)">⏪</button>
          <button class="rsvp-btn rsvp-play-btn" title="Play/Pause (Space)">▶</button>
          <button class="rsvp-btn rsvp-skip-btn" title="Skip 10 (→)">⏩</button>
        </div>
        <div class="rsvp-wpm-container">
          <span class="rsvp-wpm-label">${wpm} WPM</span>
          <input type="range" class="rsvp-wpm-slider" min="100" max="1000" step="25" value="${wpm}">
        </div>
      </div>
      <div class="rsvp-shortcuts">
        <kbd>Space</kbd> Play/Pause &nbsp; <kbd>←</kbd> Back 10 &nbsp; <kbd>→</kbd> Skip 10 &nbsp; <kbd>R</kbd> Restart &nbsp; <kbd>Esc</kbd> Close
      </div>
    `;
    shadowRoot.appendChild(el);

    wordEl = shadowRoot.querySelector('.rsvp-word');
    counterEl = shadowRoot.querySelector('.rsvp-counter');
    progressBar = shadowRoot.querySelector('.rsvp-progress-bar');
    playBtn = shadowRoot.querySelector('.rsvp-play-btn');

    // Event listeners
    shadowRoot.querySelector('.rsvp-close-btn').addEventListener('click', removeOverlay);
    shadowRoot.querySelector('.rsvp-restart-btn').addEventListener('click', restart);
    shadowRoot.querySelector('.rsvp-rewind-btn').addEventListener('click', () => skip(-10));
    shadowRoot.querySelector('.rsvp-play-btn').addEventListener('click', togglePlay);
    shadowRoot.querySelector('.rsvp-skip-btn').addEventListener('click', () => skip(10));

    const slider = shadowRoot.querySelector('.rsvp-wpm-slider');
    const wpmLabel = shadowRoot.querySelector('.rsvp-wpm-label');
    slider.addEventListener('input', (e) => {
      wpm = parseInt(e.target.value);
      wpmLabel.textContent = `${wpm} WPM`;
      chrome.storage.local.set({ rsvpWPM: wpm });
      if (isPlaying) {
        stopInterval();
        startInterval();
      }
    });

    const progressTrack = shadowRoot.querySelector('.rsvp-progress-track');
    progressTrack.addEventListener('click', (e) => {
      const rect = progressTrack.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      currentIndex = Math.floor(pct * words.length);
      currentIndex = Math.max(0, Math.min(currentIndex, words.length - 1));
      updateDisplay();
    });

    document.body.appendChild(host);
    overlay = host;

    document.addEventListener('keydown', handleKeydown);
  }

  function handleKeydown(e) {
    if (!overlay) return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        skip(-10);
        break;
      case 'ArrowRight':
        e.preventDefault();
        skip(10);
        break;
      case 'KeyR':
        e.preventDefault();
        restart();
        break;
      case 'Escape':
        e.preventDefault();
        removeOverlay();
        break;
    }
  }

  function togglePlay() {
    isPlaying = !isPlaying;
    if (isPlaying) {
      if (currentIndex >= words.length) currentIndex = 0;
      playBtn.textContent = '⏸';
      startInterval();
    } else {
      playBtn.textContent = '▶';
      stopInterval();
    }
    updateDisplay();
  }

  function startInterval() {
    stopInterval();
    const ms = 60000 / wpm;
    intervalId = setInterval(() => {
      currentIndex++;
      if (currentIndex >= words.length) {
        currentIndex = words.length - 1;
        isPlaying = false;
        playBtn.textContent = '▶';
        stopInterval();
        wordEl.textContent = '✓ Done';
        wordEl.classList.add('rsvp-paused-label');
      }
      updateDisplay();
    }, ms);
  }

  function stopInterval() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function skip(n) {
    currentIndex = Math.max(0, Math.min(currentIndex + n, words.length - 1));
    updateDisplay();
  }

  function restart() {
    currentIndex = 0;
    if (!isPlaying) {
      updateDisplay();
    } else {
      stopInterval();
      startInterval();
      updateDisplay();
    }
  }

  function getORPIndex(word) {
    // Optimal Recognition Point: ~30% into the word, min index 0
    const len = word.length;
    if (len <= 1) return 0;
    if (len <= 3) return 1;
    return Math.floor(len * 0.3);
  }

  function renderWordWithORP(word) {
    const i = getORPIndex(word);
    const before = word.substring(0, i);
    const pivot = word[i];
    const after = word.substring(i + 1);
    return `<span class="rsvp-before">${before}</span><span class="rsvp-pivot">${pivot}</span><span class="rsvp-after">${after}</span>`;
  }

  function updateDisplay() {
    if (!wordEl) return;
    if (currentIndex < words.length) {
      wordEl.innerHTML = renderWordWithORP(words[currentIndex]);
      wordEl.classList.remove('rsvp-paused-label');
    }
    counterEl.textContent = `Word ${currentIndex + 1} / ${words.length}`;
    const pct = words.length > 1 ? (currentIndex / (words.length - 1)) * 100 : 100;
    progressBar.style.width = `${pct}%`;
  }

  function removeOverlay() {
    stopInterval();
    isPlaying = false;
    document.removeEventListener('keydown', handleKeydown);
    if (overlay) {
      overlay.remove();
      overlay = null;
      shadowRoot = null;
    }
  }

  // CSS will be injected inline since we're in shadow DOM
  const CSS_TEXT = `:host { all: initial; } * { margin: 0; padding: 0; box-sizing: border-box; } .rsvp-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 15, 19, 0.92); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e0e0e0; backdrop-filter: blur(8px); animation: rsvp-fade-in 0.2s ease-out; } @keyframes rsvp-fade-in { from { opacity: 0; } to { opacity: 1; } } .rsvp-close-btn { position: absolute; top: 24px; right: 32px; background: none; border: none; color: #888; font-size: 28px; cursor: pointer; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px; transition: all 0.15s; } .rsvp-close-btn:hover { color: #fff; background: rgba(108, 92, 231, 0.2); } .rsvp-word-container { display: flex; align-items: center; justify-content: center; min-height: 120px; width: 80%; max-width: 800px; } .rsvp-word { font-size: 64px; font-weight: 700; color: #ffffff; text-align: center; transition: opacity 0.05s; user-select: none; line-height: 1.2; } .rsvp-word.rsvp-paused-label { font-size: 24px; color: #6c5ce7; font-weight: 500; } .rsvp-pivot { color: #ff4757; } .rsvp-before, .rsvp-after { color: #ffffff; } .rsvp-controls { display: flex; flex-direction: column; align-items: center; gap: 20px; margin-top: 40px; width: 80%; max-width: 500px; } .rsvp-counter { font-size: 14px; color: #888; letter-spacing: 0.5px; } .rsvp-progress-track { width: 100%; height: 4px; background: rgba(255, 255, 255, 0.08); border-radius: 2px; overflow: hidden; cursor: pointer; } .rsvp-progress-bar { height: 100%; background: #6c5ce7; border-radius: 2px; transition: width 0.1s linear; width: 0%; } .rsvp-buttons { display: flex; align-items: center; gap: 12px; } .rsvp-btn { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.08); color: #ccc; width: 44px; height: 44px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: all 0.15s; } .rsvp-btn:hover { background: rgba(108, 92, 231, 0.2); border-color: rgba(108, 92, 231, 0.4); color: #fff; } .rsvp-btn.rsvp-play-btn { width: 56px; height: 56px; border-radius: 50%; font-size: 22px; background: #6c5ce7; border-color: #6c5ce7; color: #fff; } .rsvp-btn.rsvp-play-btn:hover { background: #7c6ff0; border-color: #7c6ff0; } .rsvp-wpm-container { display: flex; align-items: center; gap: 12px; margin-top: 8px; } .rsvp-wpm-label { font-size: 13px; color: #888; min-width: 70px; text-align: center; } .rsvp-wpm-slider { -webkit-appearance: none; appearance: none; width: 200px; height: 4px; background: rgba(255, 255, 255, 0.08); border-radius: 2px; outline: none; } .rsvp-wpm-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #6c5ce7; cursor: pointer; transition: transform 0.1s; } .rsvp-wpm-slider::-webkit-slider-thumb:hover { transform: scale(1.2); } .rsvp-wpm-slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #6c5ce7; cursor: pointer; border: none; } .rsvp-shortcuts { position: absolute; bottom: 24px; font-size: 12px; color: #555; text-align: center; line-height: 1.8; } .rsvp-shortcuts kbd { display: inline-block; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 4px; padding: 1px 6px; font-family: inherit; font-size: 11px; color: #888; } `;
})();
