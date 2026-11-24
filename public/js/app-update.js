// 顶栏「检查更新」：每 10 秒核对一次当前客户端版本与最新发布版。
// 有新版本时在后台静默下载（安卓原生多线程 + 断点续传，用户无感），按钮切换到下载图标并点亮徽标；
// 点击按钮直接用本地已下载好的安装包更新，下载尚未完成时则等下载结束后自动安装。
(() => {
  const button = document.getElementById('app-update');
  if (!button) return;
  const bridge = window.WeiMoNative;
  const native = !!(bridge && typeof bridge.appVersion === 'function');
  const REMOTE = 'https://weimomusic.onrender.com';
  const RELEASES = 'https://github.com/kevinq888/weimomusic/releases/download';
  const GITHUB_API = 'https://api.github.com/repos/kevinq888/weimomusic/releases/latest';
  const INTERVAL = 10000;
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const kind = native ? 'android-native' : iOS ? 'ios' : android ? 'android-web' : 'web';
  const targetKey = iOS ? 'iphone' : 'android';

  // 桌面端由顶栏的桌面版更新按钮负责，这里只管手机 / 平板。
  if (kind === 'web') { button.remove(); return; }
  button.dataset.enabled = '1';

  // 顶栏按钮只有图标，下载进度和「已就绪」提示放在浮层里，
  // 让人一眼知道点了之后在做什么、什么时候可以更新。
  const toast = document.createElement('div');
  toast.className = 'update-toast';
  toast.hidden = true;
  toast.innerHTML = '<button class="update-toast-close" type="button" aria-label="关闭">×</button>'
    + '<div class="update-toast-head"><strong class="update-toast-title">更新</strong><span class="update-toast-pct"></span></div>'
    + '<div class="update-toast-bar"><i></i></div>'
    + '<button class="update-toast-cta" type="button">一键更新</button>';
  document.body.appendChild(toast);
  const toastTitle = toast.querySelector('.update-toast-title');
  const toastPct = toast.querySelector('.update-toast-pct');
  const toastBar = toast.querySelector('.update-toast-bar i');
  const toastCta = toast.querySelector('.update-toast-cta');
  let toastDismissed = '';
  toast.querySelector('.update-toast-close').addEventListener('click', () => {
    toast.hidden = true;
    toastDismissed = state + latest;
  });
  toastCta.addEventListener('click', () => { if (!toastCta.hidden) button.click(); });

  const pageVersion = document.querySelector('meta[name="app-version"]')?.content || '';
  let currentVersion = native ? safe(() => bridge.appVersion(), pageVersion) || pageVersion : pageVersion;
  let latest = '';
  let pkg = null;
  let state = 'idle';       // idle | checking | available | downloading | ready | latest | error
  let checking = false;
  let pendingInstall = false;
  let pollTimer = 0;
  let githubBlockedUntil = 0;

  function safe(fn, fallback = '') {
    try { const value = fn(); return value === undefined || value === null ? fallback : value; } catch { return fallback; }
  }

  function compare(a, b) {
    const pa = String(a || '0').split('.').map(Number);
    const pb = String(b || '0').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const x = pa[i] || 0;
      const y = pb[i] || 0;
      if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
  }

  function setState(next, label, detail = {}) {
    state = next;
    button.dataset.state = next;
    const text = label || '检查更新';
    button.setAttribute('aria-label', text);
    button.title = text;
    if (detail.progress != null) {
      const percent = Math.max(0, Math.min(100, Math.round(detail.progress)));
      button.style.setProperty('--update-progress', String(percent));
      button.dataset.progress = String(percent);
    }
    renderToast(label, detail);
  }

  // 下载中显示百分比 + 速度，下载完成把按钮和浮层都变成明确的「一键更新」
  function renderToast(label, detail = {}) {
    const showable = state === 'downloading' || state === 'ready' || state === 'available';
    if (!showable) {
      toast.hidden = true;
      if (state === 'latest' || state === 'idle') toastDismissed = '';
      return;
    }
    if (toastDismissed === state + latest) { toast.hidden = true; return; }
    toast.hidden = false;
    toast.dataset.state = state;
    const percent = Math.max(0, Math.min(100, Math.round(Number(detail.progress) || 0)));
    if (state === 'downloading') {
      toastTitle.textContent = `正在下载新版本 v${latest}`;
      toastPct.textContent = percent ? `${percent}%${detail.speed ? ' · ' + detail.speed : ''}` : '准备中…';
      toastBar.style.width = `${percent}%`;
      toastCta.hidden = true;
    } else if (state === 'ready') {
      toastTitle.textContent = `v${latest} 已就绪，点击更新`;
      toastPct.textContent = '下载完成';
      toastBar.style.width = '100%';
      toastCta.hidden = false;
      toastCta.textContent = kind === 'ios' ? '立即更新' : '一键更新';
    } else {
      toastTitle.textContent = `发现新版本 v${latest}`;
      toastPct.textContent = '';
      toastBar.style.width = '0%';
      toastCta.hidden = false;
      toastCta.textContent = kind === 'android-web' ? '下载安装包' : '立即更新';
    }
  }

  // ① 当前系统 / 客户端版本：原生每次重新读取，升级安装后立刻反映新版本号。
  function readCurrentVersion() {
    if (native) currentVersion = safe(() => bridge.appVersion(), currentVersion) || currentVersion;
    else currentVersion = document.querySelector('meta[name="app-version"]')?.content || currentVersion;
    return currentVersion;
  }

  function fetchWithTimeout(url, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return fetch(url, { cache: 'no-store', signal: controller.signal })
        .then(response => {
          if (!response.ok) throw Error(String(response.status));
          return response.json();
        })
        .finally(() => clearTimeout(timer));
    } catch (error) {
      clearTimeout(timer);
      return Promise.reject(error);
    }
  }

  // ② 检查应用更新：优先问线上站点（渲染冷启动可能慢，给足 15 秒），站点不可达时兜底查 GitHub Release。
  async function loadRelease() {
    const local = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
    const urls = local ? [`${REMOTE}/api/app-release`] : ['/api/app-release', `${REMOTE}/api/app-release`];
    for (const url of urls) {
      try {
        const data = await fetchWithTimeout(url, 15000);
        if (data && data.latest) return data;
      } catch { /* 换下一个地址 */ }
    }
    if (Date.now() < githubBlockedUntil) throw Error('offline');
    try {
      const json = await fetchWithTimeout(GITHUB_API, 8000);
      return fromGithub(json);
    } catch (error) {
      githubBlockedUntil = Date.now() + 5 * 60 * 1000;
      throw error;
    }
  }

  function fromGithub(json) {
    const version = String(json.tag_name || '').replace(/^v/, '');
    const platforms = {};
    for (const asset of json.assets || []) {
      const name = decodeURI(asset.name || '');
      if (/-android-arm64-v8a\.apk$/.test(name)) platforms.android = { version, name, size: asset.size, url: asset.browser_download_url };
      if (/-iphone\.zip$/.test(name)) platforms.iphone = { version, name, size: asset.size, url: asset.browser_download_url };
    }
    return { latest: version, current: pageVersion, platforms };
  }

  function fallbackPackage(version) {
    const name = `未末音乐-${version}-android-arm64-v8a.apk`;
    return { version, name, size: 0, url: `${RELEASES}/v${version}/${encodeURIComponent(name)}` };
  }

  function pkgOf(data) {
    const found = data.platforms?.[targetKey];
    if (found && found.url) return found;
    if (targetKey === 'android') return fallbackPackage(data.latest);
    return null;
  }

  function nativeStatus() {
    const raw = safe(() => bridge.updateDownloadStatus(), '{}');
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw || {}; } catch { return {}; }
  }

  function formatSpeed(bytes) {
    if (!bytes || bytes < 1024) return '';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB/s';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB/s';
  }

  // 静默下载：原生端把安装包分片并行下载并落地进度，页面关闭或断网后再次进入会接着下。
  function ensureDownload() {
    if (kind !== 'android-native' || !pkg) return;
    const info = nativeStatus();
    if (info.status === 'downloading' && String(info.version) === String(latest)) {
      pollNative();
      setState('downloading', `正在后台下载新版本 v${latest}…`);
      return;
    }
    if (info.status === 'done' && String(info.version) === String(latest)) {
      setState('ready', `新版本 v${latest} 已就绪，点击更新`, { progress: 100 });
      return;
    }
    if (typeof bridge.startUpdateDownload !== 'function') return;
    const started = safe(() => bridge.startUpdateDownload(pkg.url, pkg.name, String(latest)), false);
    if (!started) { setState('available', `发现新版本 v${latest}，点击重试`); return; }
    pollNative();
    setState('downloading', `正在后台下载新版本 v${latest}…`);
  }

  function pollNative() {
    clearTimeout(pollTimer);
    if (kind !== 'android-native') return;
    const info = nativeStatus();
    const total = Number(info.total || 0);
    const done = Number(info.done || 0);
    if (info.status === 'downloading' && String(info.version) === String(latest)) {
      const percent = total ? Math.floor((done / total) * 100) : 0;
      const speed = formatSpeed(Number(info.speed || 0));
      setState('downloading', `正在后台下载新版本 v${latest} · ${percent}%${speed ? ' · ' + speed : ''}`, { progress: percent, speed });
      pollTimer = setTimeout(pollNative, 800);
      return;
    }
    if (info.status === 'done' && String(info.version) === String(latest)) {
      setState('ready', `新版本 v${latest} 已就绪，点击更新`, { progress: 100 });
      if (pendingInstall) { pendingInstall = false; install(); }
      return;
    }
    if (info.status === 'error') {
      setState('available', `新版本 v${latest} 下载中断，点击继续下载`);
      return;
    }
    pollTimer = setTimeout(pollNative, 1000);
  }

  function install() {
    if (kind !== 'android-native' || typeof bridge.installUpdateDownloaded !== 'function') return;
    const result = safe(() => bridge.installUpdateDownloaded(), 'error');
    if (result === 'permission') {
      setState('ready', '请允许「未末音乐」安装未知应用，返回后再点一次更新');
      return;
    }
    if (result === 'missing') {
      setState('available', '安装包已失效，点击重新下载');
      return;
    }
    if (result === 'error') {
      setState('ready', '打开安装器失败，点击再试一次');
      return;
    }
    setState('ready', '正在打开安装程序…');
  }

  async function refreshPwa() {
    setState('ready', '正在更新新版本…');
    try {
      const registrations = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
      await Promise.all(registrations.map(item => item.unregister()));
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
    } catch { /* 清缓存失败也直接刷新 */ }
    setTimeout(() => location.reload(), 400);
  }

  async function check(manual = false) {
    if (checking) return;
    checking = true;
    readCurrentVersion();
    if (manual || state === 'idle') setState('checking', '正在检查版本…');
    let data;
    try {
      data = await loadRelease();
    } catch {
      checking = false;
      // 已有下载任务或已就绪时保留原状态，不让一次网络抖动把徽标抹掉。
      if (state === 'checking') setState('error', '检查更新失败，点击重试');
      return;
    }
    checking = false;
    latest = String(data.latest || '');
    pkg = latest ? pkgOf(data) : null;
    if (!latest) { setState('error', '检查更新失败，点击重试'); return; }
    if (compare(latest, readCurrentVersion()) <= 0) {
      clearTimeout(pollTimer);
      setState('latest', `已是最新版本 v${currentVersion}`);
      return;
    }
    if (kind === 'ios') { setState('ready', `发现新版本 v${latest}，点击更新`); return; }
    if (kind === 'android-web') { setState('available', `发现新版本 v${latest}，点击下载`); return; }
    ensureDownload();
  }

  button.addEventListener('click', () => {
    if (state === 'ready') {
      if (kind === 'ios') refreshPwa();
      else install();
      return;
    }
    if (state === 'available' && kind === 'android-web' && pkg) { window.location.href = pkg.url; return; }
    if (state === 'downloading') {
      // 还没下完就点：记下意图，下载结束后自动拉起安装，不再需要第二次点击。
      pendingInstall = true;
      button.title = `下载完成后自动安装 v${latest}`;
      button.setAttribute('aria-label', button.title);
      if (!toast.hidden) toastTitle.textContent = `下载完成后将自动更新 v${latest}`;
      return;
    }
    if (state === 'checking') return;
    check(true);
  });

  setState('idle', '检查更新');
  setTimeout(() => check(), 1200);
  setInterval(() => { if (!document.hidden) check(); }, INTERVAL);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });

  // 上次没下完的包，进入页面立即接着下。
  if (kind === 'android-native') {
    const info = nativeStatus();
    if (info.status === 'downloading' && info.version) {
      latest = String(info.version);
      setState('downloading', `正在继续下载 v${latest}…`);
      pollNative();
    }
  }
})();
