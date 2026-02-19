chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'rsvp-speed-read',
    title: 'Speed Read Selection',
    contexts: ['selection']
  });
});

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  }
}

async function sendToTab(tabId, text) {
  await ensureContentScript(tabId);
  await chrome.tabs.sendMessage(tabId, { action: 'startRSVP', text });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'rsvp-speed-read' && info.selectionText) {
    sendToTab(tab.id, info.selectionText);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startRSVPFromPopup') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        try {
          await sendToTab(tabs[0].id, message.text);
          sendResponse({ success: true });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      } else {
        sendResponse({ success: false, error: 'No active tab' });
      }
    });
    return true;
  }
});
