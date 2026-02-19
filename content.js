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
    if (message.action === 'ping') {
      sendResponse({ pong: true });
      return;
    }
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

  function ensureFont() {
    if (!document.querySelector('#rsvp-cinzel-font')) {
      const link = document.createElement('link');
      link.id = 'rsvp-cinzel-font';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
  }

  function createOverlay() {
    removeOverlay();
    ensureFont();

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

  // ORP logic — kept in sync with lib/core.js
  function getORPIndex(word) {
    const len = word.length;
    if (len <= 0) return 0;
    if (len <= 1) return 0;
    if (len <= 3) return 1;
    return Math.floor(len * 0.3);
  }

  function renderWordWithORP(word) {
    if (!word || word.length === 0) return '';
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
  const CSS_TEXT = `
:host { all: initial; }
* { margin: 0; padding: 0; box-sizing: border-box; }

.rsvp-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: radial-gradient(ellipse at center, #1a0a2e 0%, #0a0a12 50%, #050508 100%);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  z-index: 2147483647;
  font-family: 'Cinzel', Georgia, 'Times New Roman', serif;
  color: #f0e6ff;
  backdrop-filter: blur(12px);
  animation: rsvp-fade-in 0.4s ease-out;
  overflow: hidden;
}

/* Sacred geometry background */
.rsvp-overlay::before {
  content: '';
  position: absolute; top: 50%; left: 50%;
  width: 600px; height: 600px;
  transform: translate(-50%, -50%);
  background:
    radial-gradient(circle at 50% 50%, transparent 29%, #8b5cf620 30%, transparent 31%),
    radial-gradient(circle at 25% 50%, transparent 29%, #8b5cf615 30%, transparent 31%),
    radial-gradient(circle at 75% 50%, transparent 29%, #8b5cf615 30%, transparent 31%),
    radial-gradient(circle at 37.5% 28%, transparent 29%, #8b5cf612 30%, transparent 31%),
    radial-gradient(circle at 62.5% 28%, transparent 29%, #8b5cf612 30%, transparent 31%),
    radial-gradient(circle at 37.5% 72%, transparent 29%, #8b5cf612 30%, transparent 31%),
    radial-gradient(circle at 62.5% 72%, transparent 29%, #8b5cf612 30%, transparent 31%);
  opacity: 0.5;
  pointer-events: none;
  animation: rsvp-rotate-slow 120s linear infinite;
}

/* Outer ring glow */
.rsvp-overlay::after {
  content: '';
  position: absolute; top: 50%; left: 50%;
  width: 500px; height: 500px;
  transform: translate(-50%, -50%);
  border: 1px solid #d946ef30;
  border-radius: 50%;
  box-shadow: 0 0 30px #d946ef20, 0 0 60px #8b5cf615, inset 0 0 30px #d946ef10;
  pointer-events: none;
  animation: rsvp-pulse-ring 4s ease-in-out infinite;
}

@keyframes rsvp-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes rsvp-rotate-slow { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
@keyframes rsvp-pulse-ring { 0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.02); } }

.rsvp-close-btn {
  position: absolute; top: 24px; right: 32px;
  background: none; border: none; color: #6b5b8a;
  font-size: 28px; cursor: pointer; width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 8px; transition: all 0.2s; z-index: 10;
}
.rsvp-close-btn:hover { color: #d946ef; background: rgba(139, 92, 246, 0.15); }

.rsvp-word-container {
  display: flex; align-items: center; justify-content: center;
  min-height: 140px; width: 80%; max-width: 800px;
  position: relative; z-index: 2;
}

.rsvp-word {
  font-size: 68px; font-weight: 700;
  color: #f0e6ff;
  text-align: center; transition: opacity 0.05s;
  user-select: none; line-height: 1.2;
  letter-spacing: 0.05em;
  text-shadow: 0 0 20px #8b5cf640, 0 0 60px #4c1d9530;
}

.rsvp-word.rsvp-paused-label {
  font-size: 24px; color: #8b5cf6; font-weight: 500;
  text-shadow: 0 0 15px #8b5cf650;
}

.rsvp-pivot {
  color: #d946ef;
  text-shadow: 0 0 12px #d946ef80, 0 0 30px #d946ef40;
}
.rsvp-before, .rsvp-after { color: #f0e6ff; }

.rsvp-controls {
  display: flex; flex-direction: column; align-items: center;
  gap: 20px; margin-top: 40px; width: 80%; max-width: 500px;
  position: relative; z-index: 2;
}

.rsvp-counter {
  font-size: 13px; color: #6b5b8a;
  letter-spacing: 0.15em; text-transform: uppercase;
  font-weight: 500;
}

.rsvp-progress-track {
  width: 100%; height: 6px;
  background: #2d1b4e; border-radius: 3px;
  overflow: hidden; cursor: pointer;
  box-shadow: inset 0 0 8px #0a0a1280;
}

.rsvp-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6, #d946ef);
  border-radius: 3px;
  transition: width 0.1s linear; width: 0%;
  box-shadow: 0 0 10px #8b5cf660;
}

.rsvp-buttons { display: flex; align-items: center; gap: 14px; }

.rsvp-btn {
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.2);
  color: #c4b5fd; width: 46px; height: 46px;
  border-radius: 12px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; transition: all 0.2s;
}
.rsvp-btn:hover {
  background: rgba(217, 70, 239, 0.15);
  border-color: rgba(217, 70, 239, 0.4);
  color: #f0e6ff;
  box-shadow: 0 0 15px #d946ef30;
}

.rsvp-btn.rsvp-play-btn {
  width: 58px; height: 58px; border-radius: 50%;
  font-size: 22px;
  background: linear-gradient(135deg, #8b5cf6, #d946ef);
  border: none; color: #fff;
  box-shadow: 0 0 20px #8b5cf650, 0 0 40px #d946ef30;
}
.rsvp-btn.rsvp-play-btn:hover {
  background: linear-gradient(135deg, #9d6ff8, #e060fb);
  box-shadow: 0 0 30px #8b5cf670, 0 0 60px #d946ef40;
}

.rsvp-wpm-container {
  display: flex; align-items: center; gap: 12px; margin-top: 8px;
}

.rsvp-wpm-label {
  font-size: 12px; color: #6b5b8a; min-width: 80px;
  text-align: center; letter-spacing: 0.1em; font-weight: 500;
}

.rsvp-wpm-slider {
  -webkit-appearance: none; appearance: none;
  width: 200px; height: 4px;
  background: #2d1b4e; border-radius: 2px; outline: none;
}
.rsvp-wpm-slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 16px; height: 16px; border-radius: 50%;
  background: #d946ef; cursor: pointer;
  transition: transform 0.1s;
  box-shadow: 0 0 10px #d946ef60;
}
.rsvp-wpm-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
.rsvp-wpm-slider::-moz-range-thumb {
  width: 16px; height: 16px; border-radius: 50%;
  background: #d946ef; cursor: pointer; border: none;
}

.rsvp-shortcuts {
  position: absolute; bottom: 24px;
  font-size: 11px; color: #4c3d6e;
  text-align: center; line-height: 1.8;
  letter-spacing: 0.05em; z-index: 2;
}
.rsvp-shortcuts kbd {
  display: inline-block;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 4px; padding: 1px 6px;
  font-family: inherit; font-size: 10px;
  color: #8b5cf6;
}
`;
})();
