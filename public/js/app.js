(() => {
  const KEY = 'qiuqiumusic.guest.v1';
  const LAST_PLAYBACK_KEY = 'qiuqiumusic.lastPlayback.v1';
  const THEME_KEY = 'qiuqiumusic.theme';
  const THEMES = ['mint', 'sky', 'lilac', 'sunset', 'sakura', 'dark', 'glass'];
  const THEME_NAMES = { mint: '薄荷绿', sky: '晴空蓝', lilac: '晨雾紫', sunset: '日落橙', sakura: '樱花粉', dark: '暗夜黑', glass: '毛玻璃' };
  const PLAY_MODE_KEY = 'qiuqiumusic.playmode';
  const PLAY_MODES = ['sequence', 'repeat-all', 'repeat-one'];
  const PLAY_MODE_NAMES = { sequence: '顺序播放', 'repeat-all': '列表循环', 'repeat-one': '单曲循环' };
  const THEME_COLORS = { mint: '#f1f8f5', sky: '#f2f8fc', lilac: '#f8f5fb', sunset: '#fdf6ef', sakura: '#fdf3f6', dark: '#0f1a17', glass: '#e9eaed' };
  const tabId = Math.random().toString(36).slice(2);
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('qiuqiumusic.playback.v1') : null;
  const host = document.getElementById('site-player');
  const panel = document.getElementById('player-panel');
  const queuePanel = document.getElementById('queue-panel');
  const audio = document.getElementById('player-audio');
  const seek = document.getElementById('player-seek');
  const currentTimeNode = document.getElementById('player-current-time');
  const durationNode = document.getElementById('player-duration');
  const titleNode = document.getElementById('player-title');
  const stateNode = document.getElementById('player-state');
  const toggle = document.getElementById('player-toggle');
  const queueButton = document.getElementById('player-queue');
  const remoteProgress = document.getElementById('player-remote-progress');
  const remoteTime = document.getElementById('player-remote-time');
  const remoteBar = document.getElementById('player-remote-bar');
  const loading = document.getElementById('route-loading');
  const installDialog = document.getElementById('install-dialog');
  const themeSheet = document.getElementById('theme-sheet');
  const shortcutsDialog = document.getElementById('playback-shortcuts');
  const shortcutStatus = document.getElementById('shortcut-status');
  let shortcutTimer;
  let shortcutDeadline = 0;
  const miniPlayer = document.getElementById('mini-player');
  const miniTitle = document.getElementById('mini-title');
  const miniArtist = document.getElementById('mini-artist');
  const miniCover = document.getElementById('mini-cover');
  const miniInitial = document.getElementById('mini-initial');
  const miniBar = document.getElementById('mini-progress-bar');
  const npCover = document.getElementById('np-cover');
  const npInitial = document.getElementById('np-initial');
  const npCoverImg = document.getElementById('np-cover-img');
  const npBackdrop = document.getElementById('np-bg');
  const miniCoverImg = document.getElementById('mini-cover-img');
  const heroCoverImg = document.querySelector('.disc-inner img');
  const heroLogoSrc = heroCoverImg?.getAttribute('src') || '';
  const vinylCoverImg = document.getElementById('vinyl-cover-img');
  const vinylLogoSrc = vinylCoverImg?.getAttribute('src') || '';
  const dockTitle = document.getElementById('player-dock-title');
  const artistNode = document.getElementById('player-artist');
  const lyricNode = document.getElementById('player-lyric');
  const artNode = document.getElementById('np-art');
  const lyricsPanel = document.getElementById('np-lyrics');
  const lyricsTrack = document.getElementById('np-lyrics-track');
  const lyricsToggle = document.getElementById('player-lyrics-toggle');
  let lyricsMode = false;
  let lyricsActiveLine = -1;
  const queueBackdrop = document.getElementById('queue-backdrop');
  let installPrompt = null;
  let installPromptConsumed = false;
  let installPromptWaiters = [];
  let installReturnFocus = null;
  let queue = [];
  let queueSelecting = false;
  const queueSelected = new Set();
  let favorites = [];
  let current = null;
  let owner = null;
  let isPlaying = false;
  let playbackError = '';
  let playRequestId = 0;
  let playbackTimer;
  let playbackWanted = false;
  let reloadPlayback = false;
  let recoveryAttempts = 0;
  let lastPlaybackTime = 0;
  let minimizedByUser = false;
  let remotePosition = { currentTime: 0, duration: 0 };
  let lyricLines = [];
  let lyricIndex = -1;
  let lyricTextNode = null;
  let lyricSongId = '';
  let lyricRequest = 0;
  const lyricCache = new Map();
  let lastProgressSent = 0;
  let lastPlaybackSave = 0;
  let pendingRestorePosition = 0;
  let trackLoadPending = false;
  let navigationId = 0;
  let loadingStartedAt = 0;
  let playMode = (() => { try { const value = localStorage.getItem(PLAY_MODE_KEY); return PLAY_MODES.includes(value) ? value : 'sequence'; } catch { return 'sequence'; } })();
  let themeReturnFocus = null;
  let cacheCached = new Set();
  let cacheDownloading = new Set();
  let cacheFailed = new Set();
  let cachePrefetchId = 0;
  let cacheLoopRunning = false;
  let cacheStatusTimer;
  let initializing = true;

  function showLoading(label) {
    loading.querySelector('.route-loading-text').textContent = label;
    loading.classList.remove('is-error');
    loading.hidden = false;
    loadingStartedAt = performance.now();
  }
  async function hideLoading(id) {
    if (id !== navigationId) return;
    const remaining = Math.max(0, 120 - (performance.now() - loadingStartedAt));
    if (remaining) await new Promise(resolve => setTimeout(resolve, remaining));
    if (id === navigationId) loading.hidden = true;
  }
  function setBuffering(value) { host.classList.toggle('is-buffering', value); }

  function installedApp() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function installEnvironment() {
    const ua = navigator.userAgent;
    return {
      ios: /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
      android: /Android/.test(ua),
      inApp: /MicroMessenger|WeChat|QQ\/|AlipayClient|DingTalk|Weibo/i.test(ua),
      safari: /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome|Chromium|Edg\//.test(ua),
    };
  }
  function updateInstallButton() {
    const button = document.getElementById('install-app');
    if (!button) return;
    // 桌面客户端（Electron）内不提供"保存链接"，网页里也统一叫"保存链接"
    const desktop = /Electron\//.test(navigator.userAgent);
    button.hidden = installedApp() || desktop;
    button.querySelector('span').textContent = '保存链接';
  }
  function closeInstallDialog() {
    installDialog.hidden = true;
    installReturnFocus?.focus();
    installReturnFocus = null;
  }
  function showInstallInstructions() {
    const env = installEnvironment();
    let instructions;
    if (env.inApp && env.ios) {
      instructions = '当前在微信等应用内打开，无法由网页直接安装。\n1. 点右上角“···”，选择“在 Safari 中打开”。\n2. 在 Safari 点“分享”→“添加到主屏幕”→“添加”。\n如果没有“在 Safari 中打开”，请复制链接并粘贴到 Safari。';
    } else if (env.inApp && env.android) {
      instructions = '当前在微信等应用内打开，系统安装按钮不会出现。\n1. 点右上角“···”，选择“在浏览器打开”。\n2. 在 Chrome 中点本站“安装”，确认安装。\n如果没有“在浏览器打开”，请复制链接并粘贴到 Chrome。';
    } else if (env.ios) {
      instructions = env.safari
        ? 'iPhone 需要通过 Safari 添加网页 App：点“分享”→“添加到主屏幕”→“添加”。如果看到“作为网页 App 打开”，请开启。'
        : '请用 Safari 打开本站，再点“分享”→“添加到主屏幕”→“添加”。';
    } else if (env.android) {
      instructions = '浏览器暂未准备好或不支持直接安装，可以手动添加：\n· Chrome：点右上角菜单（⋮）→"安装应用"或"添加到主屏幕"。\n· 小米/华为/OPPO/vivo 等浏览器：点菜单 →"添加到桌面"（有的在"工具箱"里）。\n添加后桌面会出现"未末音乐"图标。也可以刷新本页后再点一次"保存链接"重试直接安装。';
    } else if (env.safari) {
      instructions = '在 Safari 菜单中选择“文件”→“添加到程序坞”，或点工具栏的“分享”→“添加到程序坞”。';
    } else {
      instructions = '在浏览器地址栏右侧或菜单中选择“安装未末音乐”。如果暂时没有安装选项，请稍后刷新再试。';
    }
    installReturnFocus = document.activeElement;
    document.getElementById('install-title').textContent = '保存未末音乐链接';
    document.getElementById('install-instructions').textContent = instructions;
    const copy = document.getElementById('install-copy-link');
    copy.hidden = false;
    copy.textContent = '复制网站链接';
    installDialog.hidden = false;
    copy.focus();
  }
  // 复制站点首页链接（"保存链接"入口用）
  async function copySiteLink() {
    const url = new URL('/', location.href).href;
    try { await navigator.clipboard.writeText(url); return true; } catch {}
    const field = document.createElement('textarea');
    field.value = url;
    field.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.append(field);
    field.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch {}
    field.remove();
    if (!copied) window.prompt('请复制链接，在手机浏览器中打开：', url);
    return copied;
  }
  async function copyInstallLink() {
    if (await copySiteLink()) document.getElementById('install-copy-link').textContent = '链接已复制';
  }
  async function startInstall() {
    if (installedApp()) return;
    // 移动端浏览器常在页面加载后一小段时间才触发 beforeinstallprompt，
    // 点击时先短暂等待，避免过早落到复制链接的说明弹窗。
    const prompt = installPrompt || (installPromptConsumed ? null : await waitForInstallPrompt());
    if (!prompt) { showInstallInstructions(); return; }
    installPrompt = null;
    installPromptConsumed = true;
    // 系统安装确认必须直接由这次点击触发，无法由网页静默安装。
    prompt.prompt();
    prompt.userChoice.then(({ outcome }) => {
      if (outcome === 'accepted') updateInstallButton();
    }).catch(() => {});
  }
  function waitForInstallPrompt(timeout = 2500) {
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        installPromptWaiters = installPromptWaiters.filter(item => item !== settle);
        resolve(null);
      }, timeout);
      const settle = event => { clearTimeout(timer); resolve(event); };
      installPromptWaiters.push(settle);
    });
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    installPromptWaiters.forEach(settle => settle(event));
    installPromptWaiters = [];
    updateInstallButton();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    updateInstallButton();
    closeInstallDialog();
  });
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', updateInstallButton);
  if (location.protocol !== 'qiuqiu:' && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

  function readSaved(restorePlayback = false) {
    let data = {};
    let playback = {};
    try {
      data = JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {}
    queue = Array.isArray(data.queue) ? data.queue.filter(validSong).slice(0, 1000) : [];
    favorites = Array.isArray(data.favorites) ? data.favorites.filter(validSong).slice(0, 1000) : [];
    if (!restorePlayback) return;
    try { playback = JSON.parse(localStorage.getItem(LAST_PLAYBACK_KEY) || '{}'); } catch {}
    // Prefer the dedicated playback snapshot, but retain an older queue when
    // that snapshot was written by an empty/stale tab. Older app builds saved
    // the queue before they saved the current track, so its last item is the
    // best available migration candidate.
    const playbackQueue = Array.isArray(playback.queue) ? playback.queue.filter(validSong) : [];
    const legacyQueue = Array.isArray(data.queue) ? data.queue.filter(validSong) : [];
    queue = playbackQueue.length ? playbackQueue.slice(0, 1000) : legacyQueue.slice(0, 1000);
    const savedSong = validSong(playback.current) ? playback.current
      : validSong(data.current) ? data.current
        : [...playbackQueue, ...legacyQueue].at(-1);
    if (!validSong(savedSong)) return;
    current = savedSong;
    if (!queue.some(song => song.id === current.id)) queue.unshift(current);
    const savedPosition = playback.current?.id === savedSong.id ? playback.position : data.position;
    owner = tabId;
    isPlaying = false;
    pendingRestorePosition = Number.isFinite(savedPosition) ? Math.max(0, savedPosition) : 0;
    trackLoadPending = true;
    audio.src = `/media/${encodeURIComponent(current.title)}.m4a`;
    audio.load();
    persistPlayback();
  }
  // 切换皮肤并同步浏览器状态栏颜色（PWA 与移动端浏览体验）
  function applyTheme(theme) {
    document.documentElement.dataset.theme = THEMES.includes(theme) ? theme : 'mint';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEME_COLORS[theme] || THEME_COLORS.mint;
    updateThemeControls();
  }
  function updateThemeControls() {
    const theme = document.documentElement.dataset.theme || 'mint';
    const label = document.getElementById('theme-mobile-label');
    if (label) label.textContent = THEME_NAMES[theme];
    const sideLabel = document.getElementById('side-theme-name');
    if (sideLabel) sideLabel.textContent = THEME_NAMES[theme];
    themeSheet.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme)));
  }
  function setTheme(theme) {
    if (!THEMES.includes(theme)) return;
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }
  function openThemeSheet() {
    themeReturnFocus = document.activeElement;
    themeSheet.hidden = false;
    document.body.classList.add('theme-sheet-open');
    document.getElementById('theme-mobile-trigger')?.setAttribute('aria-expanded', 'true');
    themeSheet.querySelector('[aria-pressed="true"]')?.focus();
  }
  function closeThemeSheet() {
    themeSheet.hidden = true;
    document.body.classList.remove('theme-sheet-open');
    document.getElementById('theme-mobile-trigger')?.setAttribute('aria-expanded', 'false');
    themeReturnFocus?.focus();
    themeReturnFocus = null;
  }
  function updateModeButton() {
    const button = document.getElementById('player-mode');
    button.dataset.mode = playMode;
    button.setAttribute('aria-label', `播放模式：${PLAY_MODE_NAMES[playMode]}，点击切换`);
    button.querySelector('.mode-label').textContent = PLAY_MODE_NAMES[playMode];
    const queueLabel = document.getElementById('queue-mode-label');
    if (queueLabel) queueLabel.textContent = PLAY_MODE_NAMES[playMode];
  }
  function setPlayMode(mode, persist = true) {
    if (!PLAY_MODES.includes(mode)) return;
    playMode = mode;
    updateModeButton();
    if (persist) {
      try { localStorage.setItem(PLAY_MODE_KEY, mode); } catch {}
      message('mode', { mode });
    }
  }
  function validSong(song) { return song && /^\d+$/.test(String(song.id)) && typeof song.title === 'string'; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, queue, favorites, current, position: savedPosition() })); } catch {}
    persistPlayback();
    renderCollections();
  }
  function savedPosition() {
    if (!current) return 0;
    if (owner !== tabId) return remotePosition.currentTime || 0;
    if (trackLoadPending) return pendingRestorePosition;
    if (pendingRestorePosition > 0 && audio.readyState === 0) return pendingRestorePosition;
    return Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  }
  function persistPlayback() {
    try {
      const previous = JSON.parse(localStorage.getItem(LAST_PLAYBACK_KEY) || '{}');
      const savedSong = current || (validSong(previous.current) ? previous.current : null);
      const position = current ? savedPosition() : (Number.isFinite(previous.position) ? previous.position : 0);
      localStorage.setItem(LAST_PLAYBACK_KEY, JSON.stringify({ version: 1, queue, current: savedSong, position, savedAt: Date.now() }));
    } catch {}
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  function songFrom(button, idKey, titleKey) {
    const song = { id: String(button.dataset[idKey]), title: button.dataset[titleKey] };
    const artist = button.dataset.playArtist || button.dataset.songArtist;
    if (artist) song.artist = artist;
    if (button.dataset.playCover) song.cover = button.dataset.playCover;
    return song;
  }
  // 源站标题多为「歌手-(编号)歌名」，部分含连续连字符（谭咏麟--一生中最爱）
  function splitTitle(song) {
    const title = String(song?.title || '').replace(/^\(\d{5,}\)/, '').trim();
    const match = title.match(/-+/);
    if (!match || match.index <= 0) return { artist: '', song: title };
    return {
      artist: title.slice(0, match.index).trim(),
      song: title.slice(match.index + match[0].length).replace(/^\(\d{5,}\)/, '').trim(),
    };
  }
  // 展示用短标题：页面只显示歌名部分
  function displayTitle(song) {
    return splitTitle(song).song || String(song?.title || '');
  }
  // 没有 artist 字段时从标题推断
  function artistOf(song) {
    if (song?.artist) return song.artist;
    return splitTitle(song).artist || '未末音乐';
  }
  // 封面图加载失败时回退到渐变首字块，避免出现空白卡片
  document.addEventListener('error', event => {
    const img = event.target;
    if (!img || img.tagName !== 'IMG') return;
    const wrapper = img.closest('.song-cover, .song-card-art, .np-cover, .mini-cover');
    if (!wrapper) return;
    wrapper.classList.remove('has-cover');
    img.remove();
  }, true);
  function coverHue(value) {
    let hash = 0;
    for (const char of String(value || '')) hash = (hash * 31 + char.charCodeAt(0)) % 360;
    return hash;
  }
  // 外部图床有防盗链，统一走站内 /cover/ 代理；已是站内地址则原样使用
  function coverSrc(cover) {
    if (!cover) return '';
    const url = String(cover).replace(/^http:/, 'https:');
    return url.startsWith('/') ? url : `/cover/${encodeURIComponent(url)}`;
  }
  // 实时歌曲首屏只有占位块：收集缺失封面的「歌手|歌名」，一次请求后端批量补图
  function hydrateCovers(root = document, attempt = 0) {
    const nodes = [...root.querySelectorAll('[data-cover-song]')].filter(node => !node.querySelector('img'));
    if (!nodes.length) return;
    const keys = new Set();
    nodes.forEach(node => {
      const song = node.dataset.coverSong || '';
      if (song) keys.add(`${node.dataset.coverArtist || ''}|${song}`);
    });
    if (!keys.size) return;
    const query = [...keys].slice(0, 30).map(key => `s=${encodeURIComponent(key)}`).join('&');
    fetch(`/api/covers?${query}`)
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        const covers = (data && data.covers) || {};
        // 列表补图与悬浮球共用缓存，切歌时可直接取用
        for (const [key, url] of Object.entries(covers)) if (url) coverCache.set(key, coverSrc(url));
        let missing = 0;
        nodes.forEach(node => {
          const url = covers[`${node.dataset.coverArtist || ''}|${node.dataset.coverSong || ''}`];
          if (!url || !node.isConnected) { missing += 1; return; }
          applyHydratedCover(node, url);
        });
        // 上游偶尔限流，服务端补图会晚一点完成，隔几秒再补一轮
        if (missing && attempt < 2) setTimeout(() => hydrateCovers(root, attempt + 1), 3000);
      })
      .catch(() => {
        if (attempt < 2) setTimeout(() => hydrateCovers(root, attempt + 1), 3000);
      });
  }
  function applyHydratedCover(node, url) {
    if (node.querySelector('img')) return;
    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.className = node.classList.contains('song-card-art') ? 'song-card-img' : '';
    img.addEventListener('load', () => node.classList.add('has-cover'));
    img.addEventListener('error', () => img.remove());
    node.appendChild(img);
    img.src = url;
  }

  // 有真实封面时显示图片，缺失时回退到渐变首字块
  function setCoverImage(img, wrapper, cover) {
    if (!img || !wrapper) return;
    const url = coverSrc(cover);
    wrapper.classList.toggle('has-cover', !!url);
    if (url) {
      if (img.getAttribute('src') !== url) img.src = url;
      img.hidden = false;
    } else {
      img.removeAttribute('src');
      img.hidden = true;
    }
  }
  // 首页大黑胶跟着当前歌曲换封面，没有在播歌曲时回到 Logo
  function syncHeroCover(cover) {
    if (!heroCoverImg) return;
    const next = coverSrc(cover) || heroLogoSrc;
    if (!next || heroCoverImg.getAttribute('src') === next) return;
    heroCoverImg.src = next;
  }
  // 当前选中曲目必须仍在播放清单里（暂停也算），否则视为没有选中歌曲
  function queuedCurrent() {
    return current && queue.some(song => song.id === current.id) ? current : null;
  }
  // 清单里很多歌曲只存了标题/歌手，封面需要按「歌手|歌名」补查并缓存
  const coverCache = new Map();
  const coverInflight = new Map();
  function queueCoverKey(song) {
    return `${artistOf(song)}|${displayTitle(song)}`;
  }
  function ensureSongCover(song) {
    if (!song) return Promise.resolve('');
    const direct = coverSrc(song.cover);
    if (direct) return Promise.resolve(direct);
    const key = queueCoverKey(song);
    if (coverCache.has(key)) return Promise.resolve(coverCache.get(key));
    if (coverInflight.has(key)) return coverInflight.get(key);
    const task = fetch(`/api/covers?s=${encodeURIComponent(key)}`)
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        const url = coverSrc(((data && data.covers) || {})[key] || '');
        coverCache.set(key, url);
        return url;
      })
      .catch(() => '')
      .finally(() => coverInflight.delete(key));
    coverInflight.set(key, task);
    return task;
  }
  function warmQueueCovers() {
    const keys = [...new Set(queue
      .filter(song => !coverSrc(song.cover) && !coverCache.has(queueCoverKey(song)))
      .slice(0, 20)
      .map(queueCoverKey))];
    if (!keys.length) return;
    const query = keys.map(key => `s=${encodeURIComponent(key)}`).join('&');
    fetch(`/api/covers?${query}`)
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        const covers = (data && data.covers) || {};
        for (const key of keys) coverCache.set(key, coverSrc(covers[key] || ''));
        applyVinylCover();
      })
      .catch(() => {});
  }
  // 最小化后的悬浮唱片：清单里有当前选中歌曲时用它封面（暂停也显示），否则回到 Logo
  function syncVinylCover(cover) {
    if (!vinylCoverImg) return;
    const next = coverSrc(cover) || vinylLogoSrc;
    if (!next || vinylCoverImg.getAttribute('src') === next) return;
    vinylCoverImg.src = next;
  }
  function applyVinylCover() {
    const song = queuedCurrent();
    const known = song ? coverSrc(song.cover) || coverCache.get(queueCoverKey(song)) || '' : '';
    syncVinylCover(known);
    if (!song || known) return;
    ensureSongCover(song).then(url => {
      if (!url || queuedCurrent()?.id !== song.id) return;
      // 补到的封面写回当前曲目，播放页/迷你条/首页黑胶一起更新
      current.cover = url;
      updatePlayer();
    });
  }
  // 全屏播放页的背景直接取自当前封面：两层交替淡入，换歌时像参考应用一样整体换色
  let backdropSlot = 0;
  let backdropUrl = '';
  function setPlayerBackdrop(cover) {
    if (!npBackdrop) return;
    const layers = npBackdrop.children;
    if (!layers || layers.length < 2) return;
    const url = cover ? coverSrc(cover) : '';
    if (url === backdropUrl) return;
    backdropUrl = url;
    if (!url) {
      for (const layer of layers) {
        layer.classList.remove('is-active');
        layer.style.backgroundImage = '';
      }
      return;
    }
    backdropSlot = backdropSlot ? 0 : 1;
    const layer = layers[backdropSlot];
    layer.style.backgroundImage = `url("${url}")`;
    for (const item of layers) item.classList.toggle('is-active', item === layer);
  }
  function contains(list, song) { return list.some(item => item.id === song.id); }
  function setBulkButton(button, label, completed) {
    const text = button.querySelector('.add-all-text');
    if (text) text.textContent = label;
    else button.textContent = label;
    button.classList.toggle('completed', completed);
  }
  function addToQueue(song, autoPlay = true) {
    if (!validSong(song)) return;
    if (!contains(queue, song)) {
      queue.push(song);
      save();
      scheduleCacheStatusRefresh();
    }
    // 加入歌单后立刻播放这首（新加入的第一首），不用等用户切歌
    if (autoPlay) playSong(song);
  }
  function addPageToQueue(button) {
    const rows = button.closest('.panel')?.querySelectorAll('.song-row [data-add-id]') || [];
    let added = 0;
    let firstAdded = null;
    for (const row of rows) {
      const song = songFrom(row, 'addId', 'songTitle');
      if (!validSong(song) || contains(queue, song)) continue;
      queue.push(song);
      if (!firstAdded) firstAdded = song;
      added++;
    }
    if (added) {
      save();
      scheduleCacheStatusRefresh();
      playSong(firstAdded);
    }
    setBulkButton(button, added ? `已加入 ${added} 首` : '本页已加入', true);
  }
  function queueTitles() {
    return [...new Set(queue.map(song => song.title).filter(Boolean))];
  }
  function cacheStateFor(title) {
    if (cacheCached.has(title)) return 'cached';
    if (cacheDownloading.has(title)) return 'downloading';
    return 'pending';
  }
  function updateCacheMeters() {
    for (const node of document.querySelectorAll('[data-cache-title]')) {
      const state = cacheStateFor(node.dataset.cacheTitle);
      if (node.dataset.cacheState !== state) node.dataset.cacheState = state;
      const label = state === 'cached' ? '已缓存' : state === 'downloading' ? '缓存中' : '待缓存';
      if (node.getAttribute('aria-label') !== label) node.setAttribute('aria-label', label);
    }
    const summary = document.getElementById('queue-cache-summary');
    if (summary) {
      const cached = queue.filter(song => cacheCached.has(song.title)).length;
      summary.textContent = `已缓存 ${cached}/${queue.length}`;
      summary.hidden = queue.length === 0;
    }
  }
  function scheduleCacheStatusRefresh() {
    clearTimeout(cacheStatusTimer);
    cacheStatusTimer = setTimeout(refreshCacheStatus, 150);
  }
  async function refreshCacheStatus() {
    const titles = queueTitles();
    if (!titles.length) {
      cacheCached = new Set();
      cacheDownloading = new Set();
      updateCacheMeters();
      return;
    }
    try {
      const res = await fetch('/api/cache/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titles }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      cacheCached = new Set(Array.isArray(data.cached) ? data.cached : []);
      cacheDownloading = new Set(Array.isArray(data.downloading) ? data.downloading : []);
    } catch {}
    updateCacheMeters();
    startPrefetchLoop();
  }
  // 逐首预缓存：一次只下载一首，下载完成再处理下一首
  async function startPrefetchLoop() {
    if (cacheLoopRunning || !queue.length) return;
    cacheLoopRunning = true;
    const runId = ++cachePrefetchId;
    try {
      for (const song of queue) {
        if (runId !== cachePrefetchId) return;
        const title = song.title;
        if (!title || cacheCached.has(title) || cacheFailed.has(title)) continue;
        cacheDownloading.add(title);
        updateCacheMeters();
        try {
          const res = await fetch('/api/cache/prefetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
          });
          const data = await res.json().catch(() => ({}));
          cacheDownloading.delete(title);
          if (res.ok && data.cached) cacheCached.add(title);
          else cacheFailed.add(title);
        } catch {
          cacheDownloading.delete(title);
          cacheFailed.add(title);
        }
        if (runId !== cachePrefetchId) return;
        updateCacheMeters();
      }
    } finally {
      if (runId === cachePrefetchId) cacheLoopRunning = false;
    }
  }
  function toggleFavorite(song) {
    if (!validSong(song)) return;
    favorites = contains(favorites, song) ? favorites.filter(item => item.id !== song.id) : [...favorites, song];
    save();
  }
  function message(type, extra = {}) { channel?.postMessage({ type, tabId, ...extra }); }
  function playbackPosition() {
    return { currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0, duration: Number.isFinite(audio.duration) ? audio.duration : 0 };
  }
  function formatTime(seconds) {
    const value = Math.max(0, Math.floor(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }
  function updateTimeline() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    seek.max = String(duration || 0);
    seek.value = String(Math.min(currentTime, duration || 0));
    seek.disabled = duration <= 0 || owner !== tabId;
    seek.style.setProperty('--played', `${duration ? Math.min(100, currentTime / duration * 100) : 0}%`);
    seek.setAttribute('aria-valuetext', `${formatTime(currentTime)} / ${duration ? formatTime(duration) : '--:--'}`);
    currentTimeNode.textContent = formatTime(currentTime);
    durationNode.textContent = duration ? formatTime(duration) : '--:--';
    if (miniBar) miniBar.style.width = `${duration ? Math.min(100, currentTime / duration * 100) : 0}%`;
    updatePositionState(duration, currentTime);
    if (owner === tabId) syncLyric(currentTime);
  }
  // ---------- 同步歌词：按时间轴逐句显示在当前播放条 ----------
  function parseLrc(text) {
    const lines = [];
    for (const raw of String(text || '').split(/\r?\n/)) {
      const match = raw.match(/^\s*\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]\s*(.*)$/);
      if (!match) continue;
      const time = Number(match[1]) * 60 + Number(match[2]) + (match[3] ? Number(`0.${match[3]}`) : 0);
      const value = match[4].replace(/\s+/g, ' ').trim();
      if (value) lines.push({ time, text: value });
    }
    return lines.sort((a, b) => a.time - b.time);
  }
  function clearLyric() {
    lyricLines = [];
    lyricIndex = -1;
    lyricTextNode = null;
    if (lyricNode) {
      lyricNode.hidden = true;
      lyricNode.textContent = '';
    }
    renderLyricsTrack();
  }
  // 全屏播放页的歌词视图：固定显示约 7 行，当前句按 KTV 方式逐字点亮
  function renderLyricsTrack() {
    if (!lyricsTrack) return;
    lyricsTrack.replaceChildren();
    lyricsActiveLine = -1;
    if (!lyricLines.length) {
      const empty = document.createElement('p');
      empty.className = 'np-lyrics-empty';
      empty.textContent = '暂无歌词';
      lyricsTrack.append(empty);
      return;
    }
    for (const line of lyricLines) {
      const node = document.createElement('p');
      node.className = 'np-lyrics-line';
      node.textContent = line.text || '♪';
      lyricsTrack.append(node);
    }
  }
  function syncLyricsTrack(index) {
    if (!lyricsTrack) return;
    const nodes = lyricsTrack.children;
    const previous = nodes[lyricsActiveLine];
    if (previous) previous.classList.remove('is-active');
    lyricsActiveLine = index;
    const node = nodes[index];
    if (!node) return;
    node.classList.add('is-active');
    const top = node.offsetTop - lyricsTrack.clientHeight / 2 + node.offsetHeight / 2;
    lyricsTrack.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }
  function setLyricsMode(on) {
    if (!artNode || !lyricsPanel) return;
    lyricsMode = !!on;
    artNode.classList.toggle('is-lyrics', lyricsMode);
    document.body.classList.toggle('lyrics-open', lyricsMode);
    lyricsPanel.hidden = !lyricsMode;
    if (lyricsToggle) {
      lyricsToggle.setAttribute('aria-pressed', String(lyricsMode));
      lyricsToggle.setAttribute('aria-label', lyricsMode ? '收起歌词' : '显示歌词');
    }
    if (lyricsMode) {
      lyricsActiveLine = -1;
      syncLyric(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    }
  }
  function lyricTextTarget() {
    if (!lyricNode) return null;
    if (!lyricTextNode || lyricTextNode.parentNode !== lyricNode) {
      lyricNode.textContent = '';
      lyricTextNode = document.createElement('span');
      lyricTextNode.className = 'player-lyric-text';
      lyricNode.append(lyricTextNode);
    }
    return lyricTextNode;
  }
  function syncLyric(time) {
    if (!lyricNode || !lyricLines.length) return;
    let index = -1;
    for (let i = 0; i < lyricLines.length; i++) {
      if (lyricLines[i].time <= time) index = i;
      else break;
    }
    const line = lyricLines[index];
    if (index !== lyricIndex) {
      lyricIndex = index;
      const node = lyricTextTarget();
      if (!node) return;
      node.textContent = line ? line.text : '';
      const wasHidden = lyricNode.hidden;
      lyricNode.hidden = !line;
      if (!line) {
        syncLyricsTrack(index);
        return;
      }
      // 歌词出现会改变播放条高度，重新给页面留出空间
      if (wasHidden && host.classList.contains('is-expanded')) syncPlayerSpace();
    }
    if (index !== lyricsActiveLine) syncLyricsTrack(index);
    if (!line) return;
    // KTV 式填充：按本句已唱时长计算当前句的变色进度
    const next = lyricLines[index + 1];
    // LRC 每句的时长通常包含尾音与留白，按整段时长线性填充会越唱越慢；
    // 压缩到 80% 让高亮追平实际演唱速度
    const length = Math.max(1.2, (next ? next.time : line.time + 5) - line.time) * 0.8;
    const ratio = Math.max(0, Math.min(1, (time - line.time) / length));
    const percent = `${(ratio * 100).toFixed(1)}%`;
    lyricTextTarget().style.setProperty('--sing', percent);
    const activeLine = lyricsTrack && lyricsTrack.children[lyricsActiveLine];
    if (activeLine) activeLine.style.setProperty('--sing', percent);
  }
  // 逐帧驱动歌词填充，避免只靠 timeupdate（约 4 次/秒）导致高亮落后于声音
  let lyricFrame = 0;
  function lyricTick() {
    lyricFrame = requestAnimationFrame(lyricTick);
    if (owner === tabId && !audio.paused) syncLyric(audio.currentTime);
  }
  function startLyricLoop() {
    if (!lyricFrame) lyricFrame = requestAnimationFrame(lyricTick);
  }
  function stopLyricLoop() {
    if (lyricFrame) {
      cancelAnimationFrame(lyricFrame);
      lyricFrame = 0;
    }
  }
  function loadLyrics(song) {
    if (!lyricNode) return;
    const id = song ? String(song.id) : '';
    if (id === lyricSongId) return;
    lyricSongId = id;
    const request = ++lyricRequest;
    clearLyric();
    if (!song) return;
    const cached = lyricCache.get(id);
    if (cached) {
      lyricLines = cached;
      lyricIndex = -1;
      renderLyricsTrack();
      syncLyric(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
      return;
    }
    const artist = artistOf(song);
    const name = song.song || displayTitle(song);
    fetch(`/api/lyrics?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(name)}`)
      .then(response => response.json())
      .then(data => {
        const lines = parseLrc(data && data.lrc);
        lyricCache.set(id, lines);
        if (request !== lyricRequest) return;
        lyricLines = lines;
        lyricIndex = -1;
        renderLyricsTrack();
        syncLyric(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
      })
      .catch(() => {});
  }
  // 系统级"正在播放"：锁屏、灵动岛与通知中心都能看到当前歌曲与走带控制
  const MEDIA_ARTWORK = [
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
  ];
  function updateMediaSession() {
    if (!('mediaSession' in navigator) || !current) return;
    try {
      const artwork = current.cover
        ? [{ src: new URL(coverSrc(current.cover), location.href).href, sizes: '512x512' }, ...MEDIA_ARTWORK]
        : MEDIA_ARTWORK;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: displayTitle(current),
        artist: artistOf(current),
        album: '未末音乐',
        artwork,
      });
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch {}
  }
  function updatePositionState(duration, currentTime) {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState || owner !== tabId || !current) return;
    if (!(duration > 0) || !(currentTime >= 0)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(currentTime, duration),
        playbackRate: audio.playbackRate || 1,
      });
    } catch {}
  }
  function initMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const handlers = {
      play: () => {
        if (!current) { if (queue.length) playSong(queue[0]); return; }
        if (audio.paused) requestPlayback();
      },
      pause: pausePlayback,
      previoustrack: () => playbackCommand('prev'),
      nexttrack: () => playbackCommand('next'),
      seekto: details => {
        if (Number.isFinite(details.seekTime)) {
          audio.currentTime = details.seekTime;
          updateTimeline();
        }
      },
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
    }
  }
  function renderRemoteProgress() {
    const { currentTime, duration } = remotePosition;
    remoteTime.textContent = `${formatTime(currentTime)} / ${duration ? formatTime(duration) : '--:--'}`;
    remoteBar.max = duration || 1;
    remoteBar.value = Math.min(currentTime, duration || 1);
    remoteBar.style.setProperty('--played', `${duration ? Math.min(100, currentTime / duration * 100) : 0}%`);
    syncLyric(currentTime);
  }
  function announce() { if (owner === tabId && current) message('state', { current, playing: isPlaying, ...playbackPosition() }); }
  // 清单里高亮当前曲目（颜色跟随皮肤变量，见 site.css）
  function syncQueueHighlight() {
    const items = document.getElementById('queue-items');
    if (!items) return null;
    let active = null;
    for (const row of items.querySelectorAll('.personal-song')) {
      const on = !!current && row.dataset.songId === current.id;
      row.classList.toggle('is-current', on);
      if (on) { row.setAttribute('aria-current', 'true'); active = row; }
      else row.removeAttribute('aria-current');
    }
    return active;
  }
  // 打开清单时把当前曲目滚动到可视区域中间
  function focusQueueCurrent(active) {
    const items = document.getElementById('queue-items');
    if (!active || !items || queuePanel.hidden) return;
    const top = active.offsetTop - items.clientHeight / 2 + active.offsetHeight / 2;
    items.scrollTop = Math.max(0, top);
  }
  function updatePlayer() {
    host.hidden = false;
    host.classList.toggle('has-track', !!current);
    for (const id of ['player-prev', 'player-next', 'player-favorite']) {
      document.getElementById(id).disabled = !current;
    }
    // 计数徽标无条件刷新；清单有歌时播放键保持可用，解决"清单有歌却显示 0 首且无法播放"
    document.getElementById('player-play-pause').disabled = !current && !queue.length;
    const index = current ? queue.findIndex(song => song.id === current.id) + 1 : 0;
    // 「播放列表」胶囊只显示音符 + 当前序号/总数，宽度更紧凑
    document.getElementById('queue-count').textContent = `${index}/${queue.length}`;
    const queueIndex = document.getElementById('queue-index');
    if (queueIndex) queueIndex.textContent = String(index);
    const queueTotal = document.getElementById('queue-total');
    if (queueTotal) queueTotal.textContent = String(queue.length);
    queueButton.setAttribute('aria-label', queue.length
      ? `播放清单，共 ${queue.length} 首，当前第 ${index || 1} 首`
      : '播放清单，暂无曲目');
    syncQueueHighlight();
    updateCacheMeters();
    miniPlayer.hidden = host.classList.contains('is-expanded');
    if (!current) {
      stateNode.textContent = queue.length ? '按播放键开始' : '待命中';
      titleNode.textContent = '选择一首歌';
      artistNode.textContent = '未末音乐';
      miniPlayer.classList.add('is-idle');
      miniTitle.textContent = '未末音乐 · 今日推荐';
      miniArtist.textContent = '点击开始播放';
      if (dockTitle) dockTitle.textContent = '选择一首歌';
      loadLyrics(null);
      setCoverImage(npCoverImg, npCover);
      setCoverImage(miniCoverImg, miniCover);
      syncHeroCover('');
      applyVinylCover();
      setPlayerBackdrop('');
      return;
    }
    if (!initializing && !minimizedByUser && !host.classList.contains('is-expanded')) expand();
    miniPlayer.classList.remove('is-idle');
    const artist = artistOf(current);
    const title = displayTitle(current);
    titleNode.textContent = title;
    artistNode.textContent = artist;
    miniTitle.textContent = title;
    miniArtist.textContent = artist;
    if (dockTitle) dockTitle.textContent = title;
    setCoverImage(npCoverImg, npCover, current.cover);
    setCoverImage(miniCoverImg, miniCover, current.cover);
    syncHeroCover(current.cover);
    applyVinylCover();
    setPlayerBackdrop(current.cover);
    const hue = coverHue(current.id);
    npCover.style.setProperty('--hue', hue);
    miniCover.style.setProperty('--hue', hue);
    host.style.setProperty('--hue', hue);
    npInitial.textContent = '♪';
    miniInitial.textContent = '♪';
    document.getElementById('player-favorite').classList.toggle('selected', contains(favorites, current));
    host.classList.toggle('is-playing', isPlaying);
    host.classList.toggle('is-remote', owner !== tabId);
    remoteProgress.hidden = owner === tabId;
    if (owner !== tabId) renderRemoteProgress();
    updateTimeline();
    if (owner !== tabId) stateNode.textContent = isPlaying ? '正在另一标签页播放' : '另一标签页已暂停';
    else if (playbackError) stateNode.textContent = playbackError;
    else if (host.classList.contains('is-buffering')) stateNode.textContent = '正在加载…';
    else if (!isPlaying && audio.paused) stateNode.textContent = '已暂停';
    loadLyrics(current);
    updateMediaSession();
  }
  function syncPlayerSpace() {
    if (!host.classList.contains('is-expanded')) return;
    document.documentElement.style.setProperty('--player-dock-height', `${Math.ceil(panel.getBoundingClientRect().height)}px`);
  }
  let restoreVinylPos = null;
  // 全屏播放页时把状态栏/导航栏切成深色，让时间、电量浮在播放页上；回到首页再切回浅色
  function syncSystemBars(player) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', player ? '#14121a' : '#f1f8f5');
    try { window.WeiMoNative?.setPlayerMode(!!player); } catch {}
  }
  function expand() {
    minimizedByUser = false;
    panel.hidden = false;
    // 展开为底部播放条：清除悬浮球拖动留下的内联定位，让 is-expanded 吸底规则生效
    host.style.left = host.style.top = host.style.right = host.style.bottom = '';
    host.classList.add('is-expanded');
    document.body.classList.add('player-docked');
    document.body.classList.add('player-open');
    toggle.setAttribute('aria-expanded', 'true');
    miniPlayer.hidden = true;
    syncSystemBars(true);
    setLyricsMode(false);
    setQueueOpen(false);
    syncPlayerSpace();
  }
  function collapse() {
    minimizedByUser = true;
    panel.hidden = true;
    setQueueOpen(false);
    host.classList.remove('is-expanded');
    document.body.classList.remove('player-docked');
    document.body.classList.remove('player-open');
    document.documentElement.style.removeProperty('--player-dock-height');
    toggle.setAttribute('aria-expanded', 'false');
    miniPlayer.hidden = false;
    syncSystemBars(false);
    if (restoreVinylPos) restoreVinylPos(); // 恢复悬浮球拖动记忆位置
  }
  // 播放计数上报：每首歌每个会话只计一次，驱动本站"本站点播榜"。
  audio.addEventListener('play', () => {
    if (!current || owner !== tabId) return;
    // Save on the actual start event as a second checkpoint. This covers
    // browsers that suspend or kill an installed PWA before its next timer.
    persistPlayback();
    const key = `qiuqiumusic.played.${current.id}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch {}
    fetch('/api/stats/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: String(current.id), title: current.title }),
    }).catch(() => {});
  });
  function pausePlayback() {
    playRequestId++;
    playbackWanted = false;
    if (host.classList.contains('is-buffering')) reloadPlayback = true;
    clearTimeout(playbackTimer);
    playbackTimer = null;
    audio.pause();
    setBuffering(false);
  }
  function watchPlayback() {
    if (playbackTimer) return;
    if (!playbackWanted || owner !== tabId) return;
    const requestId = playRequestId;
    // A pending play() need not reject or emit a MediaError. Bound both initial
    // loading and later stalls; uncached tracks may need the server's 60s download.
    playbackTimer = setTimeout(() => {
      if (requestId !== playRequestId || !playbackWanted || owner !== tabId) return;
      playbackTimer = null;
      reloadPlayback = true;
      if (recoveryAttempts++ < 1) { requestPlayback(true); return; }
      pausePlayback();
      isPlaying = false;
      playbackError = '播放加载超时，点击播放重试或切换下一首';
      updatePlayer();
      announce();
    }, cacheCached.has(current?.title) ? 15000 : 75000);
  }
  function requestPlayback(automaticRecovery = false) {
    if (!current) return;
    const requestId = ++playRequestId;
    clearTimeout(playbackTimer);
    playbackTimer = null;
    if (!automaticRecovery) recoveryAttempts = 0;
    playbackWanted = true;
    lastPlaybackTime = audio.currentTime;
    if (reloadPlayback || host.classList.contains('is-buffering') || audio.error || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE || !audio.getAttribute('src')) {
      pendingRestorePosition = savedPosition();
      trackLoadPending = true;
      // A rejected play() keeps the old MediaError until load() is called.
      // A retry query also prevents reusing a cached failed HTTP response.
      audio.src = `/media/${encodeURIComponent(current.title)}.m4a?retry=${Date.now()}`;
      audio.load();
    }
    reloadPlayback = false;
    playbackError = '';
    setBuffering(true);
    stateNode.textContent = '正在加载…';
    watchPlayback();
    audio.play().catch(error => {
      if (requestId !== playRequestId) return;
      playbackWanted = false;
      clearTimeout(playbackTimer);
      playbackTimer = null;
      reloadPlayback = true;
      setBuffering(false);
      isPlaying = false;
      if (error.name !== 'AbortError') playbackError = '音源不可用，请切换下一首';
      updatePlayer();
      announce();
    });
    updatePlayer();
  }
  function playSong(song, expandPanel = true) {
    if (!validSong(song)) return;
    if (owner === tabId && current?.id === song.id) {
      if (audio.paused) requestPlayback();
      else pausePlayback();
      if (expandPanel) expand();
      return;
    }
    message('takeover');
    pausePlayback();
    owner = tabId;
    current = song;
    playbackError = '';
    if (expandPanel) minimizedByUser = false;
    pendingRestorePosition = 0;
    trackLoadPending = true;
    audio.src = `/media/${encodeURIComponent(song.title)}.m4a`;
    addToQueue(song, false);
    persistPlayback();
    stateNode.textContent = '正在加载…';
    isPlaying = true;
    updatePlayer();
    if (expandPanel) expand();
    requestPlayback();
    announce();
  }
  function shiftSong(step, automatic = false) {
    if (owner !== tabId || !queue.length) return false;
    if (automatic && playMode === 'repeat-one') {
      audio.currentTime = 0;
      requestPlayback();
      return true;
    }
    const index = queue.findIndex(song => song.id === current?.id);
    const target = (index < 0 ? (step > 0 ? -1 : 0) : index) + step;
    const wrap = playMode === 'repeat-all' || (!automatic && playMode === 'repeat-one');
    if (!wrap && (target < 0 || target >= queue.length)) return false;
    const next = queue[(target + queue.length) % queue.length];
    if (next.id === current?.id) {
      audio.currentTime = 0;
      requestPlayback();
    } else playSong(next, false);
    return true;
  }
  function playbackCommand(action) {
    // owner 为 null 说明没有任何标签页在播，本页直接接管；只有其他标签页在播时才转发遥控
    if (owner !== tabId) {
      if (owner !== null) { message('command', { action, owner }); return; }
      owner = tabId;
    }
    if (action === 'next') shiftSong(1);
    if (action === 'prev') shiftSong(-1);
    if (action === 'pause') {
      if (current) { pausePlayback(); isPlaying = false; updatePlayer(); announce(); }
      return;
    }
    if (action === 'play' && current && !audio.paused && !playbackError && !host.classList.contains('is-buffering')) return;
    if (action === 'toggle' || action === 'play') {
      // 清单有歌但尚未加载曲目时，播放键直接开播第一首
      if (!current && queue.length) { playSong(queue[0]); return; }
      action === 'play' || audio.paused ? requestPlayback() : pausePlayback();
    }
  }
  function listMarkup(items, kind, selecting = false) {
    if (!items.length) return `<p class="empty-personal">${kind === 'favorites' ? '还没有收藏歌曲，点击歌曲旁的爱心开始收藏。' : '播放清单还是空的，点击歌曲旁的加号添加。'}</p>`;
    return items.map((song, index) => {
      const isCurrent = kind === 'queue' && !!current && current.id === song.id;
      const selected = selecting && queueSelected.has(song.id);
      const meter = kind === 'queue'
        ? `<span class="cache-meter" data-cache-title="${escapeHtml(song.title)}" data-cache-state="${cacheStateFor(song.title)}" role="img" aria-label="${cacheStateFor(song.title) === 'cached' ? '已缓存' : cacheStateFor(song.title) === 'downloading' ? '缓存中' : '待缓存'}"><i></i></span>`
        : '';
      const title = displayTitle(song);
      const artist = artistOf(song);
      const action = kind === 'favorites'
        ? `<button type="button" data-favorite-id="${escapeHtml(song.id)}" data-song-title="${escapeHtml(song.title)}" aria-label="取消收藏 ${escapeHtml(song.title)}">×</button>`
        : selecting
          ? `<span class="queue-check" role="img" aria-label="${selected ? '已选中' : '未选中'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4.6 12.4 4.9 4.9L19.4 6.8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
          : `<button type="button" data-remove-id="${escapeHtml(song.id)}" data-song-title="${escapeHtml(song.title)}" aria-label="从播放清单移除 ${escapeHtml(song.title)}">×</button>`;
      return `<div class="personal-song${isCurrent ? ' is-current' : ''}${selected ? ' is-selected' : ''}" data-song-id="${escapeHtml(song.id)}"${isCurrent ? ' aria-current="true"' : ''}><span class="personal-index">${String(index + 1).padStart(2, '0')}</span><div class="personal-main"><button type="button" data-play-id="${escapeHtml(song.id)}" data-play-title="${escapeHtml(song.title)}" data-play-artist="${escapeHtml(artist)}"${song.cover ? ` data-play-cover="${escapeHtml(coverSrc(song.cover))}"` : ''}><span class="personal-title">${escapeHtml(title)}</span><small class="personal-artist">${escapeHtml(artist)}</small></button>${meter}</div>${action}</div>`;
    }).join('');
  }
  function renderCollections() {
    document.querySelectorAll('[data-favorite-id]').forEach(button => {
      const selected = favorites.some(song => song.id === button.dataset.favoriteId);
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const fav = document.getElementById('favorites-list');
    if (fav) fav.innerHTML = listMarkup(favorites, 'favorites');
    const playlist = document.getElementById('playlist-list');
    if (playlist) playlist.innerHTML = listMarkup(queue, 'queue');
    document.getElementById('queue-items').innerHTML = listMarkup(queue, 'queue', queueSelecting);
    const favCount = document.getElementById('profile-favorites-count');
    if (favCount) favCount.textContent = String(favorites.length);
    const trackCount = document.getElementById('profile-tracks-count');
    if (trackCount) trackCount.textContent = String(queue.length);
    document.querySelectorAll('[data-add-page]').forEach(button => {
      const songs = [...(button.closest('.panel')?.querySelectorAll('.song-row [data-add-id]') || [])];
      const allAdded = songs.length > 0 && songs.every(row => queue.some(song => song.id === row.dataset.addId));
      setBulkButton(button, allAdded ? '本页已加入' : '一键加入歌单', allAdded);
    });
    updatePlayer();
    updateCacheMeters();
    updateQueueSelection();
    warmQueueCovers();
  }
  // 选择模式：面板底部换成"全选 / 清除选中 / 取消"操作条
  function updateQueueSelection() {
    const selectButton = document.getElementById('queue-select');
    const bar = document.getElementById('queue-select-bar');
    const foot = document.querySelector('.queue-foot');
    if (!queuePanel) return;
    queuePanel.classList.toggle('is-selecting', queueSelecting);
    if (selectButton) selectButton.setAttribute('aria-pressed', String(queueSelecting));
    if (bar) bar.hidden = !queueSelecting;
    if (foot) foot.hidden = queueSelecting;
    const clear = document.getElementById('queue-clear-selected');
    if (clear) {
      clear.disabled = queueSelected.size === 0;
      clear.textContent = queueSelected.size ? `清除选中 ${queueSelected.size} 首` : '清除选中';
    }
    const all = document.getElementById('queue-select-all');
    if (all) all.textContent = queue.length && queueSelected.size === queue.length ? '取消全选' : '全选';
  }
  function setQueueSelecting(value) {
    queueSelecting = value;
    if (!value) queueSelected.clear();
    renderCollections();
  }
  function toggleQueueSelection(id) {
    if (!id) return;
    if (queueSelected.has(id)) queueSelected.delete(id); else queueSelected.add(id);
    renderCollections();
  }
  function clearSelectedSongs() {
    if (!queueSelected.size) return;
    const removed = new Set(queueSelected);
    queue = queue.filter(song => !removed.has(song.id));
    queueSelected.clear();
    save();
  }
  // 只同步导航高亮，不重建顶栏/分类条/底部导航，避免整页“刷新一下”的观感
  function syncNavState(pathname) {
    const active = pathname === '/search.php' ? '/keyword.html' : pathname;
    document.querySelectorAll('.main-nav a, .subnav a, .mobile-tabbar a').forEach(link => {
      link.classList.toggle('active', new URL(link.getAttribute('href'), location.href).pathname === active);
    });
  }
  async function navigate(url, { replace = false, pop = false } = {}) {
    const target = new URL(url, location.href);
    if (target.origin !== location.origin) { location.href = target.href; return; }
    const id = ++navigationId;
    const label = target.pathname === '/search.php' ? '正在搜索音乐…' : target.searchParams.has('page') ? '正在加载歌曲列表…' : '正在打开页面…';
    let loadingShown = false;
    // 无感刷新：请求足够快时不弹加载层，避免每次点击都闪一下
    const loadingTimer = setTimeout(() => {
      if (id !== navigationId) return;
      loadingShown = true;
      showLoading(label);
    }, 200);
    try {
      const response = await fetch(target.href, { headers: { 'X-Requested-With': 'qiuqiumusic' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (id !== navigationId || !page.querySelector('main.main-content')) return;
      const newScript = page.querySelector('script[src*="/projects/source_code/js/app.js"]')?.getAttribute('src');
      const oldScript = document.querySelector('script[src*="/projects/source_code/js/app.js"]')?.getAttribute('src');
      if (newScript && oldScript && newScript !== oldScript) { location.assign(target.href); return; }
      const newCss = page.querySelector('link[href*="/projects/source_code/css/site.css"]')?.getAttribute('href');
      const css = document.querySelector('link[href*="/projects/source_code/css/site.css"]');
      if (newCss && css && css.getAttribute('href') !== newCss) css.setAttribute('href', newCss);
      document.querySelector('main.main-content').innerHTML = page.querySelector('main.main-content').innerHTML;
      syncNavState(target.pathname);
      document.body.classList.remove('nav-open');
      document.title = page.title;
      if (!pop) history[replace ? 'replaceState' : 'pushState']({}, '', target.href);
      window.scrollTo({ top: 0, behavior: 'instant' });
      updateThemeControls();
      updateNavScrollHint();
      updateInstallButton();
      window.qiuqiuDownloads?.refresh();
      window.qiuqiuUpdateUI?.refresh();
      renderCollections();
      hydrateCovers();
    } catch {
      if (id === navigationId) {
        clearTimeout(loadingTimer);
        loadingShown = true;
        showLoading('页面暂时无法打开，请稍后重试');
        loading.classList.add('is-error');
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    } finally {
      clearTimeout(loadingTimer);
      if (loadingShown) await hideLoading(id);
      else if (id === navigationId) loading.hidden = true;
    }
  }
  function internalLink(link) {
    if (!link || !link.href || link.hasAttribute('download') || link.target === '_blank') return false;
    const url = new URL(link.href, location.href);
    return url.origin === location.origin && /^(https?|qiuqiu):$/.test(url.protocol) && !url.pathname.startsWith('/media/') && !url.pathname.startsWith('/projects/');
  }
  function updateNavScrollHint() {
    const nav = document.querySelector('.main-nav');
    const button = document.getElementById('nav-scroll-next');
    if (!nav || !button) return;
    button.hidden = nav.scrollWidth - nav.scrollLeft - nav.clientWidth < 8;
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#player-shortcuts')) { resetShortcut(); shortcutsDialog.showModal(); return; }
    if (event.target.closest('[data-desktop-package]')) return;
    if (event.target.closest('#install-app')) { startInstall(); return; }
    if (event.target.closest('#install-copy-link')) { copyInstallLink(); return; }
    if (event.target.closest('[data-install-close]')) { closeInstallDialog(); return; }
    if (event.target.closest('#theme-mobile-trigger') || event.target.closest('[data-open-theme]')) { openThemeSheet(); return; }
    if (event.target.closest('[data-theme-close]')) { closeThemeSheet(); return; }
    if (event.target.closest('#mobile-menu')) { setMobileMenuOpen(!document.body.classList.contains('nav-open')); return; }
    if (event.target.closest('[data-queue-toggle]')) { event.preventDefault(); event.stopPropagation(); setQueueOpen(queuePanel.hidden); return; }
    if (event.target.closest('[data-queue-close]')) { setQueueOpen(false); return; }
    if (event.target.closest('#queue-select')) { setQueueSelecting(!queueSelecting); return; }
    if (event.target.closest('#queue-select-cancel')) { setQueueSelecting(false); return; }
    if (event.target.closest('#queue-select-all')) {
      if (queue.length && queueSelected.size === queue.length) queueSelected.clear();
      else queue.forEach(song => queueSelected.add(song.id));
      renderCollections();
      return;
    }
    if (event.target.closest('#queue-clear-selected')) { clearSelectedSongs(); return; }
    if (event.target.closest('#queue-clear')) { queue = []; queueSelected.clear(); queueSelecting = false; save(); return; }
    if (event.target.closest('#queue-mode')) { setPlayMode(PLAY_MODES[(PLAY_MODES.indexOf(playMode) + 1) % PLAY_MODES.length]); return; }
    if (event.target.closest('#player-follow')) { toggleFollow(event.target.closest('#player-follow')); return; }
    const themeChoice = event.target.closest('[data-theme-choice]');
    if (themeChoice) { setTheme(themeChoice.dataset.themeChoice); closeThemeSheet(); return; }
    if (event.target.closest('#nav-scroll-next')) { document.querySelector('.main-nav')?.scrollBy({ left: 180, behavior: 'smooth' }); return; }
    const addPage = event.target.closest('[data-add-page]');
    if (addPage) { event.preventDefault(); addPageToQueue(addPage); return; }
    const favorite = event.target.closest('[data-favorite-id]');
    if (favorite) { event.preventDefault(); toggleFavorite(songFrom(favorite, 'favoriteId', 'songTitle')); return; }
    const add = event.target.closest('[data-add-id]');
    if (add) { event.preventDefault(); addToQueue(songFrom(add, 'addId', 'songTitle')); add.classList.add('added'); return; }
    if (queueSelecting) {
      const row = event.target.closest('.queue-items .personal-song');
      if (row) { event.preventDefault(); toggleQueueSelection(row.dataset.songId); return; }
    }
    const remove = event.target.closest('[data-remove-id]');
    if (remove) { event.preventDefault(); queue = queue.filter(song => song.id !== remove.dataset.removeId); save(); return; }
    const trigger = event.target.closest('[data-play-id]');
    if (trigger) { event.preventDefault(); playSong(songFrom(trigger, 'playId', 'playTitle')); return; }
    const link = event.target.closest('a[href]');
    if (link && internalLink(link) && !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
      event.preventDefault(); navigate(link.href);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !installDialog.hidden) closeInstallDialog();
    if (event.key === 'Escape' && !themeSheet.hidden) closeThemeSheet();
  });
  function resetShortcut() {
    clearTimeout(shortcutTimer);
    shortcutDeadline = 0;
    shortcutStatus.hidden = true;
  }
  document.addEventListener('keydown', event => {
    // Never register global shortcuts or consume OS/browser modifier chords.
    // Use key rather than code so an active non-Latin layout is left alone.
    if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229 ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        !document.hasFocus() || document.hidden || !installDialog.hidden || !themeSheet.hidden ||
        document.querySelector('dialog[open]') ||
        event.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"]')) {
      resetShortcut(); return;
    }
    const armed = performance.now() < shortcutDeadline;
    resetShortcut();
    if (armed) {
      const command = { ' ': 'toggle', p: 'play', s: 'pause', ArrowLeft: 'prev', ArrowRight: 'next' }[event.key];
      if (command) { event.preventDefault(); playbackCommand(command); return; }
    }
    if (event.key !== 'q') return;
    event.preventDefault();
    shortcutDeadline = performance.now() + 2000;
    shortcutStatus.hidden = false;
    shortcutTimer = setTimeout(resetShortcut, 2000);
  });
  window.addEventListener('blur', resetShortcut);
  document.addEventListener('focusin', resetShortcut);
  document.addEventListener('pointerdown', resetShortcut);
  document.addEventListener('compositionstart', resetShortcut);
  document.addEventListener('visibilitychange', resetShortcut);
  document.addEventListener('submit', event => {
    const form = event.target.closest('form.search-form');
    if (!form) return;
    event.preventDefault();
    const query = new FormData(form).get('q')?.toString().trim();
    if (query) navigate(`/search.php?q=${encodeURIComponent(query)}`);
  });
  window.addEventListener('popstate', () => navigate(location.href, { pop: true }));
  window.addEventListener('pagehide', persistPlayback);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistPlayback(); });
  document.addEventListener('scroll', event => { if (event.target.classList?.contains('main-nav')) updateNavScrollHint(); }, true);
  window.addEventListener('resize', updateNavScrollHint);
  window.addEventListener('storage', event => {
    if (event.key === KEY) { readSaved(); renderCollections(); }
    if (event.key === THEME_KEY) {
      applyTheme(event.newValue || 'mint');
    }
    if (event.key === PLAY_MODE_KEY) setPlayMode(event.newValue || 'sequence', false);
  });
  // 悬浮黑胶球支持拖动换位（电脑鼠标与手机触摸统一用 Pointer Events），位置记忆在本地；
  // 按下后位移超过 6px 视为拖动，否则仍点击展开。触屏滚动冲突由 touch-action:none 规避。
  function enableVinylDrag() {
    const POS_KEY = 'qiuqiumusic.vinylpos';
    let left = 0, top = 0, suppressClick = false;
    function clamp(x, y) {
      const w = host.offsetWidth || 74, h = host.offsetHeight || 74;
      return [
        Math.min(Math.max(8, x), Math.max(8, window.innerWidth - w - 8)),
        Math.min(Math.max(8, y), Math.max(8, window.innerHeight - h - 8)),
      ];
    }
    function place(x, y) {
      [left, top] = clamp(x, y);
      host.style.left = left + 'px';
      host.style.top = top + 'px';
      host.style.right = 'auto';
      host.style.bottom = 'auto';
    }
    restoreVinylPos = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
        if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) place(saved.left, saved.top);
      } catch {}
    };
    restoreVinylPos();
    toggle.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (host.classList.contains('is-expanded')) return;
      const rect = host.getBoundingClientRect();
      const offX = event.clientX - rect.left, offY = event.clientY - rect.top;
      const startX = event.clientX, startY = event.clientY;
      let moved = false;
      if (toggle.setPointerCapture) { try { toggle.setPointerCapture(event.pointerId); } catch {} }
      const onMove = move => {
        const dx = move.clientX - startX, dy = move.clientY - startY;
        if (!moved && Math.hypot(dx, dy) > 6) { moved = true; document.body.classList.add('vinyl-dragging'); }
        if (moved) place(move.clientX - offX, move.clientY - offY);
      };
      const onEnd = () => {
        toggle.removeEventListener('pointermove', onMove);
        toggle.removeEventListener('pointerup', onEnd);
        toggle.removeEventListener('pointercancel', onEnd);
        document.body.classList.remove('vinyl-dragging');
        if (moved) {
          suppressClick = true;
          try { localStorage.setItem(POS_KEY, JSON.stringify({ left, top })); } catch {}
        }
      };
      toggle.addEventListener('pointermove', onMove);
      toggle.addEventListener('pointerup', onEnd);
      toggle.addEventListener('pointercancel', onEnd);
    });
    toggle.addEventListener('click', event => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);
    window.addEventListener('resize', () => { if (host.style.left) place(left, top); });
  }
  toggle.addEventListener('click', expand);
  if ('ResizeObserver' in window) new ResizeObserver(syncPlayerSpace).observe(panel);
  window.addEventListener('resize', syncPlayerSpace);
  document.getElementById('player-collapse').addEventListener('click', collapse);
  document.getElementById('player-collapse-desktop').addEventListener('click', collapse);
  document.getElementById('player-prev').addEventListener('click', () => playbackCommand('prev'));
  document.getElementById('player-next').addEventListener('click', () => playbackCommand('next'));
  document.getElementById('player-mode').addEventListener('click', () => setPlayMode(PLAY_MODES[(PLAY_MODES.indexOf(playMode) + 1) % PLAY_MODES.length]));
  document.getElementById('player-play-pause').addEventListener('click', () => playbackCommand('toggle'));
  seek.addEventListener('input', () => {
    if (owner !== tabId || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Number(seek.value);
    updateTimeline();
  });
  const favoriteButton = document.getElementById('player-favorite');
  favoriteButton.addEventListener('click', () => { if (current) toggleFavorite(current); });
  // 手机播放页把爱心移到歌名右侧（参考主流播放器），桌面播放栏仍留在控制区
  const favoriteHome = favoriteButton.parentElement;
  const headRow = document.querySelector('.player-panel-head');
  const narrowPlayer = matchMedia('(max-width:680px)');
  const placeFavorite = () => {
    if (narrowPlayer.matches) headRow.appendChild(favoriteButton);
    else favoriteHome.insertBefore(favoriteButton, queueButton);
  };
  placeFavorite();
  narrowPlayer.addEventListener('change', placeFavorite);
  function setQueueOpen(open) {
    if (!open && queueSelecting) { queueSelecting = false; queueSelected.clear(); }
    queuePanel.hidden = !open;
    queueBackdrop.hidden = !open;
    document.body.classList.toggle('queue-open', open);
    queueButton.setAttribute('aria-expanded', String(open));
    if (open) {
      renderCollections();
      focusQueueCurrent(syncQueueHighlight());
      refreshCacheStatus();
    }
  }
  queueButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    setQueueOpen(queuePanel.hidden);
  });
  // 点击面板与开关以外的任意位置自动收回清单
  document.addEventListener('pointerdown', event => {
    if (queuePanel.hidden || queuePanel.contains(event.target) || event.target.closest('[data-queue-toggle], #mini-queue, #player-queue')) return;
    setQueueOpen(false);
  });
  document.getElementById('queue-close').addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    setQueueOpen(false);
  });
  // 手机端播放条：没有当前歌曲时，点一下就从今日推荐第一首开始
  function playFirstSong() {
    const first = document.querySelector('[data-play-id]');
    if (!first) return false;
    first.click();
    return true;
  }
  document.getElementById('mini-open').addEventListener('click', () => {
    if (current) expand();
    else playFirstSong();
  });
  lyricsToggle?.addEventListener('click', () => setLyricsMode(!lyricsMode));
  artNode?.addEventListener('click', event => {
    if (event.target.closest('.np-lyrics-track')) return;
    setLyricsMode(!lyricsMode);
  });
  lyricNode?.addEventListener('click', () => setLyricsMode(true));
  document.getElementById('mini-play').addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    if (current) playbackCommand('toggle');
    else playFirstSong();
  });
  document.getElementById('mini-queue').addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    setQueueOpen(queuePanel.hidden);
  });
  function setMobileMenuOpen(open) {
    document.body.classList.toggle('nav-open', open);
    const button = document.getElementById('mobile-menu');
    if (button) button.setAttribute('aria-expanded', String(open));
  }
  function toggleFollow(button) {
    const followed = button.classList.toggle('is-followed');
    button.textContent = followed ? '已关注' : '关注';
    button.setAttribute('aria-pressed', String(followed));
  }
  audio.addEventListener('playing', () => {
    clearTimeout(playbackTimer);
    playbackTimer = null;
    recoveryAttempts = 0;
    playbackError = ''; setBuffering(false); isPlaying = true; stateNode.textContent = '正在播放';
    startLyricLoop();
    // Only the backend can confirm a complete disk cache entry.
    scheduleCacheStatusRefresh();
    updatePlayer(); announce();
  });
  audio.addEventListener('canplay', () => setBuffering(false));
  audio.addEventListener('pause', () => { stopLyricLoop(); setBuffering(false); if (owner === tabId) { isPlaying = false; stateNode.textContent = audio.ended ? '播放完毕' : '已暂停'; persistPlayback(); updatePlayer(); announce(); } });
  audio.addEventListener('waiting', () => { if (owner === tabId && playbackWanted) { setBuffering(true); stateNode.textContent = '缓冲中…'; watchPlayback(); } });
  audio.addEventListener('stalled', () => { if (playbackWanted && !playbackTimer) watchPlayback(); });
  audio.addEventListener('error', () => {
    clearTimeout(playbackTimer);
    playbackTimer = null;
    playbackWanted = false;
    reloadPlayback = true;
    setBuffering(false);
    if (owner === tabId) {
      isPlaying = false;
      playbackError = '音源不可用，请切换下一首';
      updatePlayer(); announce();
    }
  });
  audio.addEventListener('ended', () => {
    if (owner !== tabId) return;
    stopLyricLoop();
    if (!shiftSong(1, true)) { pausePlayback(); isPlaying = false; stateNode.textContent = '播放完毕'; updatePlayer(); announce(); }
  });
  audio.addEventListener('timeupdate', () => {
    if (playbackWanted && !audio.paused && audio.readyState >= 3 && audio.currentTime > lastPlaybackTime) {
      clearTimeout(playbackTimer);
      playbackTimer = null;
      recoveryAttempts = 0;
      setBuffering(false);
    }
    lastPlaybackTime = audio.currentTime;
    updateTimeline();
    if (owner === tabId && current && performance.now() - lastPlaybackSave >= 4000) {
      lastPlaybackSave = performance.now();
      persistPlayback();
    }
    if (owner !== tabId || !current || performance.now() - lastProgressSent < 500) return;
    lastProgressSent = performance.now();
    message('progress', playbackPosition());
  });
  audio.addEventListener('loadedmetadata', () => {
    if (owner === tabId && current && pendingRestorePosition > 0) {
      audio.currentTime = Math.min(pendingRestorePosition, Number.isFinite(audio.duration) ? audio.duration : pendingRestorePosition);
      pendingRestorePosition = 0;
    }
    trackLoadPending = false;
    persistPlayback();
    updateTimeline();
  });
  audio.addEventListener('seeked', () => { updateTimeline(); if (owner === tabId) message('progress', playbackPosition()); });
  audio.addEventListener('durationchange', () => { updateTimeline(); if (owner === tabId) message('progress', playbackPosition()); });
  if (channel) channel.addEventListener('message', event => {
    const data = event.data;
    if (!data || data.tabId === tabId) return;
    if (data.type === 'takeover' && owner === tabId) { pausePlayback(); owner = data.tabId; }
    if (data.type === 'state') {
      if (owner === tabId && !audio.paused) return;
      owner = data.tabId; current = data.current; isPlaying = !!data.playing;
      remotePosition = { currentTime: data.currentTime || 0, duration: data.duration || 0 };
      updatePlayer();
    }
    if (data.type === 'progress' && owner === data.tabId) {
      remotePosition = { currentTime: data.currentTime || 0, duration: data.duration || 0 };
      renderRemoteProgress();
      updateTimeline();
    }
    if (data.type === 'command' && data.owner === tabId) playbackCommand(data.action);
    if (data.type === 'mode') setPlayMode(data.mode, false);
    if (data.type === 'hello') announce();
  });
  enableVinylDrag();
  initMediaSession();
  readSaved(true);
  renderCollections();
  hydrateCovers();
  applyTheme(document.documentElement.dataset.theme || 'mint');
  updateModeButton();
  updateInstallButton();
  updateNavScrollHint();
  // 恢复上次的播放状态时不要自动展开播放页，只让迷你条/悬浮球出现
  initializing = false;
  message('hello');
  // 已保存的清单在后台逐首补缓存
  if (queue.length) scheduleCacheStatusRefresh();
  document.documentElement.dataset.playerReady = 'true';
})();
