document.getElementById('start').addEventListener('click', () => {
  const text = document.getElementById('text').value.trim();
  const error = document.getElementById('error');

  if (!text) {
    error.textContent = 'Please paste some text first.';
    error.style.display = 'block';
    return;
  }

  error.style.display = 'none';

  chrome.runtime.sendMessage({ action: 'startRSVPFromPopup', text }, (response) => {
    if (chrome.runtime.lastError) {
      error.textContent = 'Could not connect to the page. Try refreshing.';
      error.style.display = 'block';
      return;
    }
    if (response && response.success) {
      window.close();
    } else {
      error.textContent = response?.error || 'Something went wrong.';
      error.style.display = 'block';
    }
  });
});
