function getChannelInfo() {
  const url = new URL(location.href);
  const path = url.pathname;
  let channelId = null;
  let handle = null;
  let channelName = null;

  const channelMatch = path.match(/^\/channel\/(UC[\w-]+)/);
  if (channelMatch) channelId = channelMatch[1];

  const handleMatch = path.match(/^\/@([^/]+)/);
  if (handleMatch) handle = handleMatch[1];

  const metaId = document.querySelector('meta[itemprop="channelId"]');
  if (metaId) channelId = metaId.getAttribute('content');

  const metaTitle = document.querySelector('meta[property="og:title"]');
  if (metaTitle) channelName = metaTitle.getAttribute('content');

  const h1 = document.querySelector('h1');
  if (h1 && !channelName) channelName = h1.textContent.trim();

  if (!channelId && !handle) return null;
  return { channelId, handle, channelName, url: location.href, hostname: url.hostname };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_CHANNEL_INFO') {
    sendResponse(getChannelInfo());
  }
  return true;
});
