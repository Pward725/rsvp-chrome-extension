chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'rsvp-speed-read',
    title: 'Speed Read Selection',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'rsvp-speed-read' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'startRSVP',
      text: info.selectionText
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startRSVPFromPopup') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'startRSVP',
          text: message.text
        });
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No active tab' });
      }
    });
    return true;
  }
});
