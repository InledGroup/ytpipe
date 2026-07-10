const DEFAULTS = {
  pipedInstance: 'https://piped.video',
  useHomepageUrl: false,
  homepageUrl: '',
  redirectFeed: false,
  feedRedirectUrl: '',
  redirectTrending: false,
  trendingRedirectUrl: ''
};

const $ = id => document.getElementById(id);

async function loadConfig() {
  const config = await chrome.storage.sync.get(DEFAULTS);

  $('pipedInstance').value = config.pipedInstance;
  $('useHomepageUrl').checked = config.useHomepageUrl;
  $('homepageUrl').value = config.homepageUrl;
  $('homepageUrl').disabled = !config.useHomepageUrl;

  $('redirectFeed').checked = config.redirectFeed;
  $('feedRedirectUrl').value = config.feedRedirectUrl;
  $('feedRedirectUrl').disabled = !config.redirectFeed;

  $('redirectTrending').checked = config.redirectTrending;
  $('trendingRedirectUrl').value = config.trendingRedirectUrl;
  $('trendingRedirectUrl').disabled = !config.redirectTrending;
}

function showStatus(msg, isError = false) {
  const el = $('status');
  el.textContent = msg;
  el.className = isError ? 'error' : '';
  setTimeout(() => { el.textContent = ''; el.className = ''; }, 3500);
}

async function saveConfig() {
  const pipedInstance = $('pipedInstance').value.trim();
  if (!pipedInstance) {
    showStatus('Piped instance URL is required', true);
    return;
  }

  try {
    new URL(pipedInstance);
  } catch {
    showStatus('Piped instance URL is not valid', true);
    return;
  }

  const useHomepageUrl = $('useHomepageUrl').checked;
  const homepageUrl = $('homepageUrl').value.trim();

  if (useHomepageUrl && !homepageUrl) {
    showStatus('Enter a homepage URL or disable the option', true);
    return;
  }

  if (useHomepageUrl) {
    try { new URL(homepageUrl); }
    catch { showStatus('Homepage URL is not valid', true); return; }
  }

  const redirectFeed = $('redirectFeed').checked;
  const feedRedirectUrl = $('feedRedirectUrl').value.trim();

  if (redirectFeed && !feedRedirectUrl) {
    showStatus('Enter a URL for /feed or disable the option', true);
    return;
  }
  if (redirectFeed) {
    try { new URL(feedRedirectUrl); }
    catch { showStatus('The URL for /feed is not valid', true); return; }
  }

  const redirectTrending = $('redirectTrending').checked;
  const trendingRedirectUrl = $('trendingRedirectUrl').value.trim();

  if (redirectTrending && !trendingRedirectUrl) {
    showStatus('Enter a URL for /trending or disable the option', true);
    return;
  }
  if (redirectTrending) {
    try { new URL(trendingRedirectUrl); }
    catch { showStatus('The URL for /trending is not valid', true); return; }
  }

  await chrome.storage.sync.set({
    pipedInstance,
    useHomepageUrl,
    homepageUrl,
    redirectFeed,
    feedRedirectUrl,
    redirectTrending,
    trendingRedirectUrl
  });

  showStatus('Settings saved successfully');
}

$('save').addEventListener('click', saveConfig);

$('useHomepageUrl').addEventListener('change', () => {
  $('homepageUrl').disabled = !$('useHomepageUrl').checked;
});

$('redirectFeed').addEventListener('change', () => {
  $('feedRedirectUrl').disabled = !$('redirectFeed').checked;
});

$('redirectTrending').addEventListener('change', () => {
  $('trendingRedirectUrl').disabled = !$('redirectTrending').checked;
});

document.addEventListener('DOMContentLoaded', loadConfig);
