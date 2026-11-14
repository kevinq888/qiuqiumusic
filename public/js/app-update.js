// 手机端「一键检查并更新」：识别系统与当前版本 → 取对应安装包 → 下载（安卓原生支持断点续传 + 多线程加速）→ 安装。
(() => {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;
  const bridge = window.WeiMoNative;
  const native = !!(bridge && typeof bridge.appVersion === 'function');
  const REMOTE = 'https://weimomusic.onrender.com';
  const RELEASES = 'https://github.com/kevinq888/qiuqiumusic/releases/download';
  const GITHUB_API = 'https://api.github.com/repos/kevinq888/qiuqiumusic/releases/latest';
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const nativeSystem = native && typeof bridge.platform === 'function' ? safe(() => bridge.platform()) : '';
  const kind = native ? 'android-native' : iOS ? 'ios' : android ? 'android-web' : 'web';
  const targetKey = iOS ? 'iphone' : 'android';

  // 桌面端继续用顶栏的桌面版更新按钮，这个入口只在手机/平板上提供。
  if (kind === 'web') { panel.hidden = true; return; }

  const currentEl = document.getElementById('update-current');
  const platformEl = document.getElementById('update-platform');
  const button = document.getElementById('update-check');
  const titleEl = document.getElementById('update-title');
  const hintEl = document.getElementById('update-hint');
  const valueEl = document.getElementById('update-value');
  const progressEl = document.getElementById('update-progress');
  const barEl = document.getElementById('update-progress-bar');
  const noteEl = document.getElementById('update-note');
  const pageVersion = document.querySelector('meta[name="app-version"]')?.content || '';
  const currentVersion = native ? safe(() => bridge.appVersion(), pageVersion) : pageVersion;
  const platformName = native ? nativeSystem || 'Android' : iOS ? 'iPhone / iPad · Safari' : android ? 'Android 浏览器' : '桌面浏览器';

  let state = 'idle';       // idle | checking | available | downloading | done | latest | error
  let release = null;
  let busy = false;
  let pollTimer = 0;

  function safe(fn, fallback = '') {
    try { const value = fn(); return value === undefined || value === null ? fallback : value; } catch { return fallback; }
  }

  currentEl.textContent = 'v' + (currentVersion || '—');
  platformEl.textContent = platformName;

  function setValue(text) { valueEl.innerHTML = text; }

  function setStatus(next, text) {
    state = next;
    button.dataset.status = next;
    button.dataset.busy = String(next === 'checking' || next === 'downloading');
    setValue(text || '检查');
  }

  function showProgress(percent) {
    if (percent === null) { progressEl.hidden = true; barEl.style.width = '0%'; return; }
    progressEl.hidden = false;
    barEl.style.width = Math.max(0, Math.min(100, percent)) + '%';
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

  // 优先问线上站点（渲染冷启动可能慢，给足 25 秒）；站点不可达时直接查 GitHub Release。
  async function fetchWithTimeout(url, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw Error(String(response.status));
      return await response.json();
    } finally {
      clearTimeout(timer);
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

  async function loadRelease() {
    const local = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
    const urls = local ? [`${REMOTE}/api/app-release`] : ['/api/app-release', `${REMOTE}/api/app-release`];
    for (const url of urls) {
      try {
        const data = await fetchWithTimeout(url, 25000);
        if (data && data.latest) return data;
      } catch { /* 换下一个地址 */ }
    }
    const json = await fetchWithTimeout(GITHUB_API, 8000);
    return fromGithub(json);
  }

  function pkgOf(data) {
    const pkg = data.platforms?.[targetKey];
    if (pkg && pkg.url) return pkg;
    if (targetKey === 'android') return fallbackPackage(data.latest);
    return null;
  }

  async function check() {
    if (busy) return;
    busy = true;
    setStatus('checking', '检查中…');
    hintEl.textContent = '正在连接更新服务，识别当前版本…';
    showProgress(null);
    let data;
    try {
      data = await loadRelease();
    } catch {
      busy = false;
      setStatus('error', '重试');
      hintEl.textContent = '暂时无法连接更新服务，请稍后重试';
      return;
    }
    release = data;
    busy = false;
    const latest = data.latest;
    if (!latest || compare(latest, currentVersion) <= 0) {
      setStatus('latest', '已是最新');
      hintEl.textContent = `当前 v${currentVersion}，已经是最新版本`;
      titleEl.textContent = '检查更新';
      noteEl.textContent = '安卓端支持断点续传与多线程加速下载，下载完成后直接安装新版本。';
      return;
    }
    // 一键更新：发现新版本立即下载对应安装包，不再让用户点第二次。
    titleEl.textContent = `发现新版本 v${latest}`;
    hintEl.textContent = kind === 'ios' ? '正在刷新到最新版本…' : '正在获取安装包…';
    setStatus('available', `v${latest}`);
    await startUpdate(pkgOf(data), latest);
  }

  async function startUpdate(pkg, latest) {
    if (kind === 'ios') {
      hintEl.textContent = '正在更新页面资源，稍后自动重新打开';
      setStatus('downloading', '更新中…');
      await refreshPwa();
      return;
    }
    if (!pkg) {
      setStatus('error', '重试');
      hintEl.textContent = '暂未找到适配当前系统的安装包';
      return;
    }
    if (kind === 'android-native' && typeof bridge.startUpdateDownload === 'function') {
      const started = safe(() => bridge.startUpdateDownload(pkg.url, pkg.name, String(latest)), false);
      if (!started) {
        hintEl.textContent = '下载任务未能启动，请重试';
        setStatus('error', '重试');
        return;
      }
      hintEl.textContent = '正在多线程下载，支持断点续传…';
      setStatus('downloading', '0%');
      showProgress(0);
      pollNative();
      return;
    }
    // 手机浏览器里直接交给系统下载器（同样支持断点续传），下载完点通知安装。
    hintEl.textContent = '已交给系统浏览器下载，完成后点击通知安装';
    setStatus('downloading', '下载中…');
    showProgress(0);
    window.location.href = pkg.url;
  }

  async function refreshPwa() {
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

  function formatSpeed(bytes) {
    if (!bytes || bytes < 1024) return '';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB/s';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB/s';
  }

  function pollNative() {
    clearTimeout(pollTimer);
    const raw = safe(() => bridge.updateDownloadStatus(), '{}');
    let info = {};
    try { info = typeof raw === 'string' ? JSON.parse(raw) : raw || {}; } catch { info = {}; }
    const total = Number(info.total || 0);
    const done = Number(info.done || 0);
    if (info.status === 'downloading') {
      const percent = total ? Math.floor((done / total) * 100) : 0;
      setStatus('downloading', percent + '%');
      showProgress(percent);
      const speed = formatSpeed(Number(info.speed || 0));
      hintEl.textContent = `正在多线程下载${speed ? ' · ' + speed : ''}，支持断点续传`;
      pollTimer = setTimeout(pollNative, 700);
      return;
    }
    if (info.status === 'done') {
      setStatus('done', '安装');
      showProgress(100);
      hintEl.textContent = '下载完成，点击安装新版本';
      titleEl.textContent = '更新已就绪';
      install();
      return;
    }
    if (info.status === 'error') {
      setStatus('error', '重试');
      showProgress(null);
      hintEl.textContent = info.error || '下载中断，再次点击可继续下载';
      return;
    }
    pollTimer = setTimeout(pollNative, 900);
  }

  function install() {
    if (kind !== 'android-native' || typeof bridge.installUpdateDownloaded !== 'function') return;
    const result = safe(() => bridge.installUpdateDownloaded(), 'error');
    if (result === 'permission') {
      hintEl.textContent = '请允许「未末音乐」安装未知应用，返回后再点一次安装';
      setStatus('done', '安装');
      return;
    }
    if (result === 'missing') {
      setStatus('error', '重试');
      hintEl.textContent = '安装包已失效，请重新检查更新';
      return;
    }
    if (result === 'error') {
      setStatus('done', '安装');
      hintEl.textContent = '打开安装器失败，可再点一次重试';
      return;
    }
    hintEl.textContent = '正在打开安装程序…';
  }

  button.addEventListener('click', () => {
    if (state === 'done') { install(); return; }
    check();
  });

  // 页面重新打开时接着上次的下载进度，不重复下载。
  if (kind === 'android-native' && typeof bridge.updateDownloadStatus === 'function') {
    const raw = safe(() => bridge.updateDownloadStatus(), '{}');
    let info = {};
    try { info = typeof raw === 'string' ? JSON.parse(raw) : raw || {}; } catch { info = {}; }
    if (info.status === 'downloading') {
      setStatus('downloading', '0%');
      hintEl.textContent = '正在多线程下载，支持断点续传…';
      showProgress(Number(info.total) ? Math.floor((info.done / info.total) * 100) : 0);
      pollNative();
    } else if (info.status === 'done') {
      setStatus('done', '安装');
      showProgress(100);
      titleEl.textContent = '更新已就绪';
      hintEl.textContent = '下载完成，点击安装新版本';
    }
  }
})();
