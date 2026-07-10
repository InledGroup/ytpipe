const YT_FEED = 'https://www.youtube.com/feeds/videos.xml?channel_id=';

const $ = id => document.getElementById(id);

function isYoutubeHost(h) {
  return h === 'youtube.com' || h.endsWith('.youtube.com');
}

function isSameHost(h, pipedUrl) {
  try {
    const ph = new URL(pipedUrl).hostname;
    return h === ph || h.endsWith('.' + ph);
  } catch { return false; }
}

function extractFromUrl(url) {
  const m = url.pathname.match(/^\/channel\/(UC[\w-]+)/);
  if (m) return { channelId: m[1], handle: null, channelName: null };
  const h = url.pathname.match(/^\/@([^/]+)/);
  if (h) return { channelId: null, handle: h[1], channelName: null };
  return null;
}

function getFeedUrl(info) {
  if (info.channelId) return YT_FEED + info.channelId;
  return null;
}

function makeOpml(name, feedUrl) {
  const title = name ? name.replace(/&/g, '&amp;').replace(/</g, '&lt;') : 'Channel';
  const safeUrl = feedUrl.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>${title} - YouTube RSS</title></head>
  <body>
    <outline text="${title}" title="${title}" type="rss" xmlUrl="${safeUrl}"/>
  </body>
</opml>`;
}

function showChannelUI(info) {
  const feedUrl = getFeedUrl(info);

  $('channelName').textContent = info.channelName || info.handle || info.channelId || '—';
  $('channelId').textContent = info.channelId || info.handle || '—';

  if (feedUrl) {
    $('feedUrl').textContent = feedUrl;
  } else {
    $('feedUrl').textContent = info.handle
      ? 'Use a channel ID (not @handle). Go to the channel at /channel/UC...'
      : 'Could not determine the feed URL';
  }

  $('channelSection').style.display = 'block';

  $('copyFeedUrl').onclick = () => {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl).then(() => {
      $('copyFeedUrl').textContent = 'Copied!';
      $('copyFeedUrl').classList.add('copied');
      setTimeout(() => {
        $('copyFeedUrl').textContent = 'Copy URL';
        $('copyFeedUrl').classList.remove('copied');
      }, 1800);
    });
  };

  $('downloadOpml').onclick = () => {
    const name = info.channelName || info.handle || info.channelId || 'channel';
    const url = feedUrl || (info.channelId ? getFeedUrl({ channelId: info.channelId }) : null);
    if (!url) return;
    const opml = makeOpml(name, url);
    const blob = new Blob([opml], { type: 'application/xml;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (name.replace(/[^a-zA-Z0-9]/g, '_') + '.opml').toLowerCase();
    a.click();
    URL.revokeObjectURL(a.href);
  };
}

async function tryChannelDetection(tab, pipedInstance) {
  const url = new URL(tab.url);
  const hostname = url.hostname;
  const isYt = isYoutubeHost(hostname);
  const isPiped = isSameHost(hostname, pipedInstance);
  if (!isYt && !isPiped) return;

  let info = null;

  if (isYt) {
    try {
      info = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CHANNEL_INFO' });
    } catch { /* content script not ready */ }
    if (!info) info = extractFromUrl(url);
  }

  if (isPiped) {
    try {
      const res = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const u = new URL(location.href);
          const p = u.pathname;
          let ch = null, h = null, nm = null;
          const cm = p.match(/^\/channel\/(UC[\w-]+)/);
          if (cm) ch = cm[1];
          const hm = p.match(/^\/@([^/]+)/);
          if (hm) h = hm[1];
          const mt = document.querySelector('meta[property="og:title"]');
          if (mt) nm = mt.getAttribute('content');
          const h1 = document.querySelector('h1');
          if (h1 && !nm) nm = h1.textContent.trim();
          if (!ch && !h) return null;
          return { channelId: ch, handle: h, channelName: nm, url: location.href, hostname: u.hostname };
        }
      });
      info = res?.[0]?.result;
    } catch { /* scripting not available */ }
    if (!info) info = extractFromUrl(url);
  }

  if (info) showChannelUI(info);
}

document.addEventListener('DOMContentLoaded', async () => {
  const config = await chrome.storage.sync.get({
    pipedInstance: 'https://piped.video',
    useHomepageUrl: false,
    homepageUrl: '',
    redirectFeed: false,
    feedRedirectUrl: '',
    redirectTrending: false,
    trendingRedirectUrl: ''
  });

  $('pipedDisplay').textContent =
    config.pipedInstance.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  $('homepageDisplay').textContent =
    config.useHomepageUrl && config.homepageUrl
      ? config.homepageUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')
      : 'Disabled';

  $('feedDisplay').textContent =
    config.redirectFeed && config.feedRedirectUrl
      ? config.feedRedirectUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')
      : 'Disabled';

  $('trendingDisplay').textContent =
    config.redirectTrending && config.trendingRedirectUrl
      ? config.trendingRedirectUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')
      : 'Disabled';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) tryChannelDetection(tab, config.pipedInstance);
});

$('openOptions').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

$('openPiped').addEventListener('click', async (e) => {
  e.preventDefault();
  const config = await chrome.storage.sync.get({ pipedInstance: 'https://piped.video' });
  chrome.tabs.create({ url: config.pipedInstance });
});
