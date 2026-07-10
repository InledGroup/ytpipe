const DEFAULTS = {
  pipedInstance: 'https://piped.video',
  useHomepageUrl: false,
  homepageUrl: '',
  redirectFeed: false,
  feedRedirectUrl: '',
  redirectTrending: false,
  trendingRedirectUrl: ''
};

async function getConfig() {
  return chrome.storage.sync.get(DEFAULTS);
}

function isYoutubeUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'youtube.com' ||
      u.hostname.endsWith('.youtube.com') ||
      u.hostname === 'youtu.be';
  } catch {
    return false;
  }
}

function youtubeToPiped(youtubeUrl, pipedInstance) {
  const u = new URL(youtubeUrl);
  let base = pipedInstance.replace(/\/+$/, '');

  if (u.hostname === 'youtu.be') {
    const videoId = u.pathname.slice(1).split('/')[0];
    let result = base + '/watch?v=' + videoId;
    if (u.searchParams.has('t')) {
      result += '&t=' + u.searchParams.get('t');
    }
    return result;
  }

  let path = u.pathname;

  if (path.startsWith('/shorts/')) {
    const videoId = path.split('/shorts/')[1].split('/')[0];
    return base + '/watch?v=' + videoId + u.search;
  }

  const searchParams = new URLSearchParams(u.search);

  if (path.startsWith('/results')) {
    path = '/search';
    if (searchParams.has('search_query')) {
      searchParams.set('q', searchParams.get('search_query'));
      searchParams.delete('search_query');
    }
  }

  let result = base + path;
  const qs = searchParams.toString();
  if (qs) result += '?' + qs;

  return result;
}

async function handleNavigation(details) {
  if (details.frameId !== 0) return;

  const url = details.url;
  if (!isYoutubeUrl(url)) return;

  const config = await getConfig();
  const originUrl = new URL(url);
  const isHomepage = originUrl.pathname === '/' && !originUrl.search;

  if (isHomepage && config.useHomepageUrl && config.homepageUrl) {
    chrome.tabs.update(details.tabId, { url: config.homepageUrl });
    return;
  }

  const pipedUrl = youtubeToPiped(url, config.pipedInstance);
  if (pipedUrl !== url) {
    chrome.tabs.update(details.tabId, { url: pipedUrl });
  }
}

function isPipedUrl(url, pipedInstance) {
  try {
    const u = new URL(url);
    const ph = new URL(pipedInstance).hostname;
    return u.hostname === ph || u.hostname.endsWith('.' + ph);
  } catch { return false; }
}

[chrome.webNavigation.onBeforeNavigate, chrome.webNavigation.onHistoryStateUpdated].forEach(api => {
  api.addListener(handleNavigation, {
    url: [
      { hostEquals: 'youtube.com' },
      { hostSuffix: '.youtube.com' },
      { hostEquals: 'youtu.be' }
    ]
  });
});

async function handlePipedNavigation(details) {
  if (details.frameId !== 0) return;

  const config = await getConfig();
  if (!isPipedUrl(details.url, config.pipedInstance)) return;

  const u = new URL(details.url);
  const path = u.pathname;

  if (config.redirectFeed && config.feedRedirectUrl && (path === '/feed' || path.startsWith('/feed/'))) {
    chrome.tabs.update(details.tabId, { url: config.feedRedirectUrl });
  }

  if (config.redirectTrending && config.trendingRedirectUrl && (path === '/trending' || path.startsWith('/trending/'))) {
    chrome.tabs.update(details.tabId, { url: config.trendingRedirectUrl });
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(handlePipedNavigation);
chrome.webNavigation.onHistoryStateUpdated.addListener(handlePipedNavigation);

async function getChannelFeedUrl(pageUrl) {
  try {
    const u = new URL(pageUrl);
    const chMatch = u.pathname.match(/^\/channel\/(UC[\w-]+)/);
    if (chMatch) return { feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=' + chMatch[1], id: chMatch[1] };
    return null;
  } catch { return null; }
}

chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({
    id: 'open-link-in-piped',
    title: 'Open link in Piped',
    contexts: ['link'],
    targetUrlPatterns: ['*://*.youtube.com/*', '*://youtu.be/*']
  });

  chrome.contextMenus.create({
    id: 'open-page-in-piped',
    title: 'Open current page in Piped',
    contexts: ['page'],
    documentUrlPatterns: ['*://*.youtube.com/*', '*://youtu.be/*']
  });

  chrome.contextMenus.create({
    id: 'copy-channel-feed-yt',
    title: 'Copy channel feed URL',
    contexts: ['page'],
    documentUrlPatterns: [
      '*://*.youtube.com/channel/*', '*://youtube.com/channel/*',
      '*://*.youtube.com/@*', '*://youtube.com/@*'
    ]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const config = await getConfig();

  if (info.menuItemId === 'open-link-in-piped' && info.linkUrl) {
    const pipedUrl = youtubeToPiped(info.linkUrl, config.pipedInstance);
    chrome.tabs.create({ url: pipedUrl });
  }

  if (info.menuItemId === 'open-page-in-piped') {
    const pipedUrl = youtubeToPiped(info.pageUrl, config.pipedInstance);
    chrome.tabs.update(tab.id, { url: pipedUrl });
  }

  if (info.menuItemId === 'copy-channel-feed-yt') {
    const result = await getChannelFeedUrl(tab.url);
    if (result) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (text) => {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        },
        args: [result.feed]
      });
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULTS, (saved) => {
    const needsSave = Object.keys(DEFAULTS).some(
      k => saved[k] === undefined
    );
    if (needsSave) {
      chrome.storage.sync.set({ ...DEFAULTS, ...saved });
    }
  });
});
