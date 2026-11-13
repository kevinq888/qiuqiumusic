const { seed, getSong, proxyMediaUrl } = require('./store');
const { lookup: coverLookup, warm: warmCovers } = require('./covers');

const SITE = '未末音乐';
const ASSET_VERSION = '20261114-fullscreen1';
function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function icon(name) {
  const paths = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>',
    play: '<path fill="currentColor" stroke="none" d="M7 4.5v15l12-7.5z"/>',
    pause: '<path fill="currentColor" stroke="none" d="M7.5 4.5h3.2v15H7.5zM13.3 4.5h3.2v15h-3.2z"/>',
    prev: '<path fill="currentColor" stroke="none" d="M6 5h2v14H6zM18.5 5.4v13.2L9.3 12z"/>',
    next: '<path fill="currentColor" stroke="none" d="M16 5h2v14h-2zM5.5 5.4v13.2L14.7 12z"/>',
    flame: '<path d="M12 22c4.4 0 7-3.3 7-7.3 0-3-1.7-5.4-4.5-7.8.2 3-1.3 4-2.3 4.3.7-3.7-.6-6.5-3.7-9.2.3 3.8-1.5 5.8-3.1 8C4.5 11.3 5 12.7 5 14.7 5 18.7 7.7 22 12 22z"/>',
    spark: '<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8zM19 17l.6 1.4L21 19l-1.4.6L19 21l-.6-1.4L17 19l1.4-.6z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    arrow: '<path d="m9 5 7 7-7 7"/>',
    note: '<path d="M9 18V5l10-2v13M9 8l10-2"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
    music: '<path fill="currentColor" stroke="none" d="M18 3.2a1 1 0 0 1 1.2 1v11.2a3.6 3.6 0 1 1-2-3.2V7.1l-6 1.3v9a3.6 3.6 0 1 1-2-3.2V6.8a1 1 0 0 1 .8-1z"/>',
    vinylNote: '<path fill="currentColor" stroke="none" d="M12 3v12.55A4 4 0 1 0 14 19V7h6V3h-8z"/>',
    minimize: '<path d="m6 10 6 6 6-6"/><path d="M5 20h14"/>',
    headphones: '<path d="M3 14v-3a9 9 0 0 1 18 0v3M3 14h3v6H4a1 1 0 0 1-1-1v-5Zm18 0h-3v6h2a1 1 0 0 0 1-1v-5Z"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M5 17v3h14v-3"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    sequence: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    repeat: '<path d="m17 2 3 3-3 3M20 5H7a4 4 0 0 0-4 4v2m4 11-3-3 3-3m-3 3h13a4 4 0 0 0 4-4v-2"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    list: '<path d="M4 7h13M4 12h13M4 17h9"/><path fill="currentColor" stroke="none" d="M18 14.4v6.6l5-3.3z"/>',
    home: '<path d="m3 10.2 9-7 9 7V20a1 1 0 0 1-1 1h-5v-6.5H9V21H4a1 1 0 0 1-1-1z"/>',
    noteBadge: '<rect x="4" y="3" width="16" height="18" rx="3.2"/><path d="M8 8.5h8M8 12.5h8M8 16.5h5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20c0-4 3.4-6.2 7.5-6.2s7.5 2.2 7.5 6.2"/>',
    comment: '<path d="M20.5 11.2a8.2 8.2 0 0 1-8.2 8.2H8.6L4 22l1-3.7A8.2 8.2 0 1 1 20.5 11.2Z"/><path d="M8.4 9.4h7.2M8.4 12.9h4.6"/>',
    dots: '<circle cx="12" cy="5.2" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="18.8" r="1.5" fill="currentColor" stroke="none"/>',
    trash: '<path d="M4 7h16M9.5 7V4.2h5V7M6.5 7l.9 13.4h9.2l.9-13.4"/>',
    scan: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/><path d="M3 12h18"/>',
    check: '<path d="m4.6 12.4 4.9 4.9L19.4 6.8"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6.5 13.5h11"/>',
  };
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.note}</svg>`;
}
// 无真实封面时用歌曲 id 生成稳定色相，让每个封面色块都可区分
function coverHue(value) {
  let hash = 0;
  for (const char of String(value)) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}
function cleanTitle(song) {
  // 源站部分标题带抓取编号，如 "周杰伦-(1781417012)晴天"：展示时去掉编号前缀
  return String(song.title || '').replace(/^\(\d{5,}\)/, '').trim();
}
function splitTitle(song) {
  const title = cleanTitle(song);
  const match = title.match(/-+/);
  if (!match || match.index <= 0) return { artist: '', song: title };
  return {
    artist: title.slice(0, match.index).trim(),
    song: title.slice(match.index + match[0].length).replace(/^\(\d{5,}\)/, '').trim(),
  };
}
function displayTitle(song) {
  if (song.song) return String(song.song);
  return splitTitle(song).song || cleanTitle(song);
}
function artistOf(song) {
  if (song.artist) return song.artist;
  return splitTitle(song).artist || '未末音乐';
}
// 实时抓取的歌曲只带 id/标题，这里补全本地已解析的歌手与封面
function enrichSong(song) {
  const known = getSong(song.id);
  if (!known) return song;
  return {
    ...song,
    artist: song.artist || known.artist,
    song: song.song || known.song,
    cover: song.cover || known.cover,
  };
}
// 真实专辑封面统一走站内代理（图床有防盗链），失败时由页面回退到渐变音符占位块
function coverUrl(song) {
  let value = (song && song.cover) || (song && song.id ? getSong(song.id)?.cover : '');
  // 最近更新等实时歌曲不在本地曲库，按「歌手 + 歌名」查异步补图缓存
  if (!value && song) value = coverLookup(rawArtist(song), displayTitle(song));
  if (!value) return '';
  const url = String(value).replace(/^http:/, 'https:');
  return url.startsWith('/') ? url : `/cover/${encodeURIComponent(url)}`;
}
function rawArtist(song) {
  return String((song && song.artist) || splitTitle(song || {}).artist || '');
}
function coverMark(song, className = 'song-cover') {
  const url = coverUrl(song);
  const artist = esc(rawArtist(song));
  const name = esc(displayTitle(song));
  return `<span class="${className}" style="--hue:${coverHue(song.id || song.title)}" data-cover-artist="${artist}" data-cover-song="${name}" aria-hidden="true">${url ? `<img src="${esc(url)}" alt="" loading="lazy" decoding="async">` : ''}<i></i><b>♪</b></span>`;
}
function songData(song) {
  const cover = coverUrl(song);
  return `data-play-id="${esc(song.id)}" data-play-title="${esc(song.title)}" data-play-artist="${esc(artistOf(song))}"${cover ? ` data-play-cover="${esc(cover)}"` : ''}`;
}
function songLink(song, label) {
  return `<a class="song-link" href="/library/${esc(song.id)}.html" ${songData(song)} title="播放 ${esc(song.title)}">${label || esc(displayTitle(song))}</a>`;
}
function pageHead(title, description = '听见喜欢的声音。未末音乐，发现与分享好音乐。') {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f1f8f5"><meta name="description" content="${esc(description)}"><meta name="keywords" content="未末音乐,weimomusic,在线音乐,音乐播放"><title>${SITE} · ${esc(title)}</title><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="未末音乐"><meta name="apple-mobile-web-app-status-bar-style" content="default"><link rel="icon" href="/projects/source_code/picture/logo.svg" type="image/svg+xml"><link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png"><link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png"><script>try{document.documentElement.dataset.theme=localStorage.getItem('qiuqiumusic.theme')||'mint'}catch{}</script><link rel="stylesheet" href="/projects/source_code/css/site.css?v=${ASSET_VERSION}"><script src="/projects/source_code/js/desktop-download.js?v=${ASSET_VERSION}" defer></script><script src="/projects/source_code/js/desktop-update.js?v=${ASSET_VERSION}" defer></script><script src="/projects/source_code/js/app.js?v=${ASSET_VERSION}" defer></script></head><body>`;
}
// 顶栏：电脑端深色导航 + 红色调分类条；手机端只保留菜单、标识与搜索入口
function nav(active = '') {
  const links = [['/', '发现音乐'], ['/charts', '排行榜'], ['/navigation/1/', '最近更新'], ['/navigation/2/', '歌单'], ['/hotsgr.html', '歌手'], ['/keyword.html', '热搜'], ['/my-music', '我的音乐']];
  const tabs = [['/', '推荐'], ['/charts', '排行榜'], ['/navigation/2/', '歌单'], ['/hotsgr.html', '歌手'], ['/navigation/1/', '新歌'], ['/keyword.html', '热搜']];
  return `<header class="site-header"><div class="shell nav-shell"><button class="mobile-menu" id="mobile-menu" type="button" aria-label="打开导航" aria-expanded="false" aria-controls="main-nav">${icon('menu')}</button><a class="brand" href="/" aria-label="未末音乐首页"><img src="/projects/source_code/picture/logo.svg" alt="" width="40" height="40"><span><strong>未末音乐</strong><small>weimomusic</small></span></a><a class="mobile-search" href="/keyword.html" aria-label="搜索音乐">${icon('search')}<span>搜索歌曲、歌手</span>${icon('scan')}</a><nav class="main-nav" id="main-nav" aria-label="主导航">${links.map(([url, text]) => `<a href="${url}" class="${active === url ? 'active' : ''}">${text}</a>`).join('')}</nav><button id="nav-scroll-next" class="nav-scroll-next" type="button" aria-label="向右查看更多导航">${icon('arrow')}</button><form class="nav-search" action="/search.php" method="get" role="search"><label class="sr-only" for="nav-search-input">搜索歌曲或歌手</label><input id="nav-search-input" name="q" type="search" placeholder="搜索歌曲/歌手"><button type="submit" aria-label="搜索">${icon('search')}</button></form><div class="header-actions"><div class="desktop-download-wrap" hidden><a id="desktop-download" aria-label="下载桌面版" class="desktop-download-button" href="https://github.com/kevinq888/qiuqiumusic/releases/latest" data-desktop-package hidden aria-controls="desktop-download-choices" aria-expanded="false">${icon('download')}<span class="download-label">下载桌面版</span></a><div id="desktop-download-choices" class="desktop-download-choices" hidden><strong>选择你的 Mac 芯片</strong><a href="/download/desktop/mac-arm64" data-desktop-package>Apple 芯片 <small>M1 / M2 / M3 / M4 / M5</small></a><a href="/download/desktop/mac-x64" data-desktop-package>Intel 芯片 <small>Intel Mac</small></a><p>下载后双击打开安装包，按提示完成安装。</p></div></div><button class="install-button" id="install-app" type="button" aria-label="保存未末音乐链接">${icon('save')}<span>保存链接</span></button><div class="theme-picker"><button class="theme-trigger" id="theme-mobile-trigger" type="button" aria-label="切换皮肤" aria-haspopup="dialog" aria-expanded="false"><span class="theme-trigger-mark" aria-hidden="true">◐</span><span id="theme-mobile-label">薄荷绿</span></button></div></div></div></header><nav class="subnav" aria-label="分类导航">${tabs.map(([url, text]) => `<a href="${url}" class="${active === url ? 'active' : ''}">${text}</a>`).join('')}</nav>`;
}
// 手机端底部导航：首页 / 搜索 / 笔记 / 我的
function mobileTabbar(active = '') {
  const tabs = [
    ['/', '首页', 'home'],
    ['/keyword.html', '搜索', 'search'],
    ['/navigation/2/', '笔记', 'noteBadge'],
    ['/my-music', '我的', 'user'],
  ];
  const map = { '/search.php': '/keyword.html' };
  const current = map[active] || active;
  return `<nav class="mobile-tabbar" aria-label="底部导航">${tabs.map(([url, text, iconName]) => `<a href="${url}" class="${current === url ? 'active' : ''}">${icon(iconName)}<span>${text}</span></a>`).join('')}</nav>`;
}
function searchForm(q = '') {
  return `<form class="search-form" action="/search.php" method="get" role="search"><label class="sr-only" for="song-search">搜索歌曲或歌手</label>${icon('search')}<input id="song-search" name="q" type="search" value="${esc(q)}" placeholder="搜索歌曲、歌手，开启好心情" required><button type="submit">搜索音乐 ${icon('arrow')}</button></form>`;
}
function searchIntro(title, description, query = '', notice = '') {
  return `<div class="page-intro search-intro"><div class="search-intro-form">${searchForm(query)}</div><h1>${title}</h1><p>${description}</p>${notice}</div>`;
}
function footer() {
  return `<footer class="site-footer"><div class="shell footer-content footer-simple"><span class="footer-copy">© ${new Date().getFullYear()} 未末音乐</span><span class="footer-tagline">未末音乐，让每一次播放，都刚好合你心意。</span></div></footer>`;
}
// 播放器：电脑端底部播放栏 + 手机端迷你胶囊 / 全屏播放页，共用同一套控件
function player() {
  return `<aside class="player-host" id="site-player" aria-label="音乐播放器"><div class="np-bg" id="np-bg" aria-hidden="true"><span></span><span></span></div><div class="np-veil" aria-hidden="true"></div><button class="vinyl-toggle" id="player-toggle" type="button" aria-label="展开播放器" aria-expanded="false"><span class="vinyl-disc"><span class="vinyl-label"><img class="vinyl-cover" id="vinyl-cover-img" src="/projects/source_code/picture/logo.svg" alt=""></span></span></button><div class="mini-player" id="mini-player" hidden><button class="mini-open" id="mini-open" type="button" aria-label="打开播放页"><span class="mini-cover" id="mini-cover"><img id="mini-cover-img" alt="" hidden><b id="mini-initial">♪</b></span><span class="mini-meta"><strong id="mini-title">选择一首歌</strong><small id="mini-artist">未末音乐</small></span></button><button class="mini-play" id="mini-play" type="button" aria-label="播放或暂停"><span class="tp-icon tp-play">${icon('play')}</span><span class="tp-icon tp-pause">${icon('pause')}</span></button><button class="mini-queue" id="mini-queue" type="button" aria-label="播放清单">${icon('list')}</button><span class="mini-progress" aria-hidden="true"><i id="mini-progress-bar"></i></span></div><section class="player-panel" id="player-panel" aria-label="当前播放" hidden><div class="np-top"><button id="player-collapse" class="np-icon" type="button" aria-label="收起播放页">${icon('chevronDown')}</button><span class="np-top-title">正在播放</span><button id="player-lyrics-toggle" class="np-icon np-lyrics-btn" type="button" aria-label="显示歌词" aria-pressed="false">词</button><button class="np-icon" type="button" data-queue-toggle aria-label="播放清单">${icon('list')}</button></div><div class="np-art" id="np-art"><div class="np-turntable"><span class="np-halo" aria-hidden="true"></span><span class="np-arm" aria-hidden="true"><svg viewBox="0 0 180 280" fill="none"><path d="M20 34C30 80 44 118 55 165" stroke="#f7f3ec" stroke-width="8" stroke-linecap="round"/><path d="M55 165L150 242" stroke="#f7f3ec" stroke-width="8" stroke-linecap="round"/><rect x="127" y="222" width="46" height="20" rx="8" fill="#f2ece4" transform="rotate(40 150 232)"/><circle cx="20" cy="20" r="14" fill="#f7f3ec"/></svg></span><div class="np-disc"><span class="np-cover" id="np-cover"><img id="np-cover-img" alt="" hidden><b id="np-initial">♪</b></span></div></div><div class="np-lyrics" id="np-lyrics" hidden><div class="np-lyrics-track" id="np-lyrics-track"></div></div></div><div class="player-panel-head"><div><small>未末音乐 · <span id="player-state">待命中</span></small><h2 id="player-title">选择一首歌</h2><div class="np-artist-line"><span id="player-artist">未末音乐</span><i class="np-dot" aria-hidden="true">·</i><span class="np-dock-title" id="player-dock-title">选择一首歌</span><button class="np-follow" id="player-follow" type="button">关注</button></div></div></div><audio id="player-audio" preload="none" aria-hidden="true" tabindex="-1"></audio><div class="player-center"><p class="player-lyric" id="player-lyric" aria-live="polite" hidden></p><div class="player-timeline" id="player-timeline"><span id="player-current-time">0:00</span><input id="player-seek" type="range" min="0" max="0" step="0.1" value="0" aria-label="播放进度" disabled><span id="player-duration">--:--</span><span class="np-quality">极高音质</span></div></div><div class="player-remote-progress" id="player-remote-progress" hidden><span id="player-remote-time">0:00 / --:--</span><progress id="player-remote-bar" max="1" value="0" aria-label="另一标签页的播放进度"></progress></div><div class="player-actions"><div class="player-transport"><button id="player-prev" type="button" aria-label="上一首" disabled class="tp-prev">${icon('prev')}</button><button id="player-play-pause" type="button" aria-label="播放或暂停" disabled><span class="tp-icon tp-play">${icon('play')}</span><span class="tp-icon tp-pause">${icon('pause')}</span></button><button id="player-next" type="button" aria-label="下一首" disabled>${icon('next')}</button></div><div class="player-options"><button id="player-shortcuts" type="button" aria-label="播放快捷键说明" title="播放快捷键：先按 Q，再按空格 / P / S / ← / →">${icon('keyboard')}</button><button id="player-mode" class="mode-button" type="button" data-mode="sequence" aria-label="播放模式：顺序播放，点击切换" title="顺序播放"><span class="mode-icon mode-sequence">${icon('sequence')}</span><span class="mode-icon mode-repeat">${icon('repeat')}</span><span class="mode-icon mode-one">${icon('repeat')}<b>1</b></span><span class="mode-label">顺序播放</span></button><button id="player-favorite" type="button" aria-label="收藏当前歌曲" disabled>${icon('heart')}</button><button id="player-queue" class="queue-button" type="button" aria-label="播放清单" aria-controls="queue-panel" aria-expanded="false">${icon('list')}<span id="queue-count">0/0</span></button><button id="player-collapse-desktop" class="icon-button" type="button" aria-label="收起播放栏" title="收起播放栏">${icon('minimize')}</button></div></div></section><div class="queue-backdrop" id="queue-backdrop" data-queue-close hidden></div><section class="queue-panel" id="queue-panel" aria-label="播放清单" hidden><span class="queue-handle" aria-hidden="true"></span><div class="queue-head"><div class="queue-title"><h2>播放清单</h2><small><b id="queue-index">0</b> / <b id="queue-total">0</b> 首<em id="queue-cache-summary" class="queue-cache-summary" hidden></em></small></div><div class="queue-head-actions"><button id="queue-select" class="queue-text-button" type="button" aria-label="选择歌曲" aria-pressed="false">选择</button><button id="queue-clear" class="queue-text-button" type="button" aria-label="清空播放清单">清空</button><button id="queue-close" class="queue-close" type="button" aria-label="关闭播放清单">×</button></div></div><div id="queue-items" class="queue-items"></div><div class="queue-select-bar" id="queue-select-bar" hidden><button id="queue-select-all" class="queue-pill queue-pill-ghost" type="button">全选</button><button id="queue-clear-selected" class="queue-pill queue-pill-danger" type="button" disabled>清除选中</button><button id="queue-select-cancel" class="queue-pill queue-pill-ghost" type="button">取消</button></div><div class="queue-foot"><button id="queue-mode" class="queue-pill" type="button"><span class="mode-icon">${icon('sequence')}</span><span id="queue-mode-label">顺序播放</span></button><button class="queue-pill queue-pill-ghost" type="button" data-queue-close>收起</button></div></section></aside>`;}
function loadingOverlay() {
  return `<div class="route-loading" id="route-loading" role="status" aria-live="polite" aria-label="正在加载" hidden><div class="route-loading-card"><span class="route-loading-record" aria-hidden="true"><span>${icon('music')}</span></span><strong class="route-loading-text">正在加载，请稍候…</strong><small>好音乐，马上就来</small></div></div>`;
}
function playbackShortcuts() {
  return `<span id="shortcut-status" class="shortcut-status" role="status" hidden>再按：空格 播放/暂停 · P 播放 · S 暂停 · ← 上一首 · → 下一首</span><dialog id="playback-shortcuts" class="install-card shortcuts-dialog" aria-labelledby="shortcuts-title"><h2 id="shortcuts-title">播放快捷键</h2><p>先按一下 Q，松开后在 2 秒内按下对应按键。</p><dl class="shortcut-list"><div><dt>播放 / 暂停</dt><dd><kbd>Q</kbd> → <kbd>空格</kbd></dd></div><div><dt>播放</dt><dd><kbd>Q</kbd> → <kbd>P</kbd></dd></div><div><dt>暂停</dt><dd><kbd>Q</kbd> → <kbd>S</kbd></dd></div><div><dt>上一首</dt><dd><kbd>Q</kbd> → <kbd>←</kbd></dd></div><div><dt>下一首</dt><dd><kbd>Q</kbd> → <kbd>→</kbd></dd></div></dl><p>仅当前未末音乐窗口生效；输入文字、输入法组字或打开弹窗时不触发。Esc 取消待输入的快捷键。</p><form method="dialog"><button class="install-done" autofocus>知道了</button></form></dialog>`;
}
function installDialog() {
  return `<div class="install-dialog" id="install-dialog" hidden><div class="install-backdrop" data-install-close></div><section class="install-card" role="dialog" aria-modal="true" aria-labelledby="install-title" aria-describedby="install-instructions"><button class="install-close" type="button" data-install-close aria-label="关闭">×</button><div class="install-card-icon"><img src="/icons/icon-192.png" alt=""></div><span class="eyebrow">随时打开未末音乐</span><h2 id="install-title">保存未末音乐链接</h2><p id="install-instructions"></p><div class="install-actions"><button class="install-copy-link" id="install-copy-link" type="button" hidden>复制网站链接</button><button class="install-done" type="button" data-install-close>知道了</button></div></section></div>`;
}
function themeSheet() {
  const choices = [['mint', '薄荷绿', '#58b79d'], ['sky', '晴空蓝', '#70b1df'], ['lilac', '晨雾紫', '#a890ce'], ['sunset', '日落橙', '#e99b69'], ['sakura', '樱花粉', '#e796ae'], ['dark', '暗夜黑', '#19352d'], ['glass', '毛玻璃', '#e4e5e8']];
  return `<div class="theme-sheet" id="theme-sheet" hidden><button class="theme-sheet-backdrop" type="button" data-theme-close aria-label="关闭皮肤选择"></button><section class="theme-sheet-card" role="dialog" aria-modal="true" aria-labelledby="theme-sheet-title"><div class="theme-sheet-head"><div><small>挑选喜欢的色彩</small><h2 id="theme-sheet-title">切换皮肤</h2></div><button class="theme-sheet-close" type="button" data-theme-close aria-label="关闭">×</button></div><div class="theme-choices">${choices.map(([value, label, color]) => `<button class="theme-choice" type="button" data-theme-choice="${value}" style="--theme-swatch:${color}" aria-pressed="false"><span class="theme-swatch" aria-hidden="true"></span><span>${label}</span><span class="theme-check" aria-hidden="true">✓</span></button>`).join('')}</div></section></div>`;
}
function layout(title, body, active = '', description) {
  return `${pageHead(title, description)}${nav(active)}<main class="shell main-content">${body}</main>${footer()}${player()}${mobileTabbar(active)}${playbackShortcuts()}${loadingOverlay()}${installDialog()}${themeSheet()}</body></html>`;}
function section(title, eyebrow, content, more, iconName = 'spark', className = '', action = '') {
  return `<section class="panel ${className}"><div class="panel-heading"><div class="heading-icon">${icon(iconName)}</div><div><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2></div>${action}${more ? `<a class="more-link" href="${more}">查看更多 ${icon('arrow')}</a>` : ''}</div>${content}</section>`;
}
function trendBadge(value) {
  if (value === 'new' || value === undefined) return '<span class="trend-badge trend-new">NEW</span>';
  if (value > 0) return `<span class="trend-badge trend-up">▲${value}</span>`;
  if (value < 0) return `<span class="trend-badge trend-down">▼${-value}</span>`;
  return '<span class="trend-badge trend-same">—</span>';
}
function rankClass(n) {
  return n === 1 ? 'rank-gold' : n === 2 ? 'rank-silver' : n === 3 ? 'rank-bronze' : '';
}
function songRows(items, start = 1, { date = false, trend = null, plays = false } = {}) {
  return `<div class="song-list">${items.map((song, index) => {
    const n = start + index;
    const medal = trend ? rankClass(n) : (index < 3 && start === 1 ? 'top-rank' : '');
    return `<div class="song-row"><span class="song-rank ${medal}">${String(n).padStart(2, '0')}</span>${coverMark(song)}<div class="song-main">${songLink(song)}<small>${esc(artistOf(song))}</small></div>${trend ? trendBadge(trend.get(String(song.id))) : ''}${plays && song.plays ? `<span class="song-plays">${song.plays} 次点播</span>` : ''}${date && song.date ? `<span class="song-date">${esc(song.date)}</span>` : ''}<button class="song-action favorite-button" type="button" data-favorite-id="${esc(song.id)}" data-song-title="${esc(song.title)}" aria-label="收藏 ${esc(song.title)}">${icon('heart')}</button><button class="song-action add-button" type="button" data-add-id="${esc(song.id)}" data-song-title="${esc(song.title)}" data-song-artist="${esc(artistOf(song))}" aria-label="加入播放清单 ${esc(song.title)}">${icon('plus')}</button><button class="play-button" type="button" ${songData(song)} aria-label="播放 ${esc(song.title)}">${icon('play')}</button></div>`;
  }).join('')}</div>`;
}
// 卡片式歌曲网格：电脑端四列、手机端三列，接近网易云「热门推荐」的封面卡片
function songCards(items) {
  return `<div class="song-cards">${items.map(song => `<article class="song-card" ${songData(song)}><span class="song-card-art" style="--hue:${coverHue(song.id || song.title)}" data-cover-artist="${esc(rawArtist(song))}" data-cover-song="${esc(displayTitle(song))}"><span class="song-card-grain"></span><b>♪</b>${coverUrl(song) ? `<img class="song-card-img" src="${esc(coverUrl(song))}" alt="" loading="lazy" decoding="async">` : ''}<span class="song-card-play">${icon('play')}</span></span><strong class="song-card-title">${esc(displayTitle(song))}</strong><small class="song-card-artist">${esc(artistOf(song))}</small></article>`).join('')}</div>`;
}
function featurePanel(title, eyebrow, content, more, tabs = [], iconName = 'flame') {
  return `<section class="panel feature-panel"><div class="panel-heading"><div class="heading-icon">${icon(iconName)}</div><div><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2></div>${tabs.length ? `<div class="feature-tabs">${tabs.map((tab, i) => `<a href="/search.php?q=${encodeURIComponent(tab)}" class="${i === 0 ? 'active' : ''}">${esc(tab)}</a>`).join('')}</div>` : ''}<a class="more-link" href="${more}">更多 ${icon('arrow')}</a></div>${content}</section>`;
}
function bulkAction(items) {
  return items.length ? `<button class="add-all-button" type="button" data-add-page aria-live="polite" aria-label="一键将本页 ${items.length} 首歌曲加入播放清单"><span class="add-all-icon">${icon('plus')}</span><span class="add-all-text">一键加入歌单</span><span class="add-all-count">${items.length} 首</span></button>` : '';
}
function homePage(live = {}) {
  const hot = seed.hot_tags.slice(0, 16).map(song => `<a href="/library/${esc(song.id)}.html" class="mood-tag" ${songData(song)}>${coverMark(song, 'song-cover mood-tag-cover')}<span class="mood-tag-text">${esc(displayTitle(song))}</span></a>`).join('');
  const hero = `<section class="hero"><span class="hero-badge">每日推荐</span><div class="hero-copy"><span class="hero-kicker">今日好音乐 <span>✦</span></span><h1>让喜欢的音乐，<br><em>刚好遇见你。</em></h1><p>从此刻的心情出发，听一首属于今天的歌。</p>${searchForm()}<div class="hero-notes"><span>${icon('headphones')} 随时在线聆听</span><span>${icon('spark')} 每日发现新声</span></div></div><div class="hero-graphic" aria-hidden="true"><div class="disc"><div class="disc-inner"><img src="/projects/source_code/picture/logo.svg" alt=""></div></div><span class="float-note note-one">♫</span><span class="float-note note-two">♪</span><span class="graphic-caption">听见此刻的喜欢。</span></div></section>`;
  const side = `<aside class="home-side"><div class="side-card side-download"><span class="side-eyebrow">桌面客户端</span><h3>把音乐带到桌面</h3><p>独立窗口、悬浮黑胶，开机就能听。</p><a class="side-primary" href="https://github.com/kevinq888/qiuqiumusic/releases/latest">${icon('download')} 下载客户端</a><div class="side-links"><a href="/charts">排行榜</a><a href="/navigation/2/">精选歌单</a><a href="/hotsgr.html">人气歌手</a></div></div><div class="side-card side-theme"><div class="side-theme-head"><span class="side-eyebrow">主题皮肤</span><span id="side-theme-name">薄荷绿</span></div><p>七套配色，随时把界面换成今天的心情。</p><button class="side-theme-open" type="button" data-open-theme>切换皮肤 ${icon('arrow')}</button></div></aside>`;
  const entries = `<div class="entry-grid"><a class="entry entry-a" href="/charts"><b>排行榜</b><small>每日更新</small><span class="entry-art">${icon('flame')}</span></a><a class="entry entry-b" href="/navigation/2/"><b>歌单</b><small>精选合集</small><span class="entry-art">${icon('note')}</span></a><a class="entry entry-c" href="/hotsgr.html"><b>歌手</b><small>熟悉的名字</small><span class="entry-art">${icon('user')}</span></a><a class="entry entry-d" href="/keyword.html"><b>热搜</b><small>大家正在听</small><span class="entry-art">${icon('search')}</span></a></div>`;
  const latestItems = (live.latest?.length ? live.latest : seed.nav1).map(enrichSong);
  const recItems = (live.recommend?.length ? live.recommend : seed.rank_recommend).map(enrichSong);
  const hotItems = (live.hot?.length ? live.hot : seed.rank_hot).map(enrichSong);
  // 首页实时歌曲缺封面时，后台按「歌手 + 歌名」补图并写盘缓存，下次访问即可直接命中
  warmCovers([...latestItems, ...recItems, ...hotItems].map(song => ({ artist: rawArtist(song), song: displayTitle(song) })));
  // 去重：源站同一首歌可能存在多个条目，同一区块内按标题去重，避免卡片重复
  const unique = list => {
    const seen = new Set();
    return list.filter(song => !seen.has(song.title) && seen.add(song.title));
  };
  const recommended = featurePanel('热门推荐', '此刻流行', songCards(unique(hotItems).slice(0, 8)), '/ranking/hot', ['华语', '流行', '摇滚', '民谣', '电子'], 'flame');
  const latest = featurePanel('最近更新', '新歌上架', songCards(unique(latestItems).slice(0, 8)), '/navigation/1/', ['新歌', '推荐', '原创'], 'clock');
  const featured = section('此刻热门', '此刻流行', `<div class="mood-tags">${hot}</div>`, '/viewmor.html', 'flame', 'trending-panel');
  // 首页右栏原本为空，用精选歌单补足版面：每行可直接播放
  const picks = section('精选歌单', '编辑精选', `<div class="picks-list">${seed.collections.slice(0, 5).map((item, index) => `<a class="pick-row" href="/library/${esc(item.id)}.html" ${songData(item)} title="播放 ${esc(item.title)}"><img class="pick-cover" src="/projects/source_code/picture/picks/pick-${index + 1}.jpg" alt="" loading="lazy"><span class="pick-copy"><b>${esc(displayTitle(item))}</b><small>精选歌单 · 点击直接播放</small></span><span class="pick-play">${icon('play')}</span></a>`).join('')}</div>`, '/navigation/2/', 'note', 'picks-panel');
  const rec = section('为你推荐', '猜你喜欢', songRows(unique(recItems).slice(0, 7)), '/ranking/recommend', 'spark');
  const popular = section('热门点播', '热门歌曲', songRows(unique(hotItems).slice(0, 7)), '/ranking/hot', 'flame');
  return layout('发现好音乐', `<div class="home-top">${hero}${side}</div>${entries}${recommended}${latest}<div class="home-grid ranking-grid">${popular}${rec}</div><div class="home-grid ranking-grid">${featured}${picks}</div>`, '/');
}
function pager(base, page, pages) {
  if (pages <= 1) return '';
  const window = new Set([1, pages]);
  for (let n = Math.max(1, page - 2); n <= Math.min(pages, page + 2); n++) window.add(n);
  const numbers = [...window].sort((a, b) => a - b);
  let previous = 0;
  const items = [];
  for (const n of numbers) {
    if (n - previous > 1) items.push('<span class="pager-ellipsis">…</span>');
    items.push(n === page ? `<span class="current" aria-current="page">${n}</span>` : `<a href="${base}${base.includes('?') ? '&' : '?'}page=${n}">${n}</a>`);
    previous = n;
  }
  return `<nav class="pager" aria-label="分页"><a class="${page <= 1 ? 'disabled' : ''}" href="${base}${base.includes('?') ? '&' : '?'}page=${Math.max(1, page - 1)}">上一页</a>${items.join('')}<a class="${page >= pages ? 'disabled' : ''}" href="${base}${base.includes('?') ? '&' : '?'}page=${Math.min(pages, page + 1)}">下一页</a></nav>`;
}
function rankingPage(data) {
  const recommend = data.kind === 'recommend';
  const title = recommend ? '推荐歌曲 · 5000 首' : '热门歌曲 · 5000 首';
  const note = data.stale ? '当前展示本地缓存；源站暂时不可用或更新中。' : '访问时检查本地缓存，缓存有效期为 6 小时。';
  const description = `前 10 首沿用${recommend ? '推荐' : '热门'}榜单，后续曲目取自实时更新的歌曲列表。${note}`;
  const content = `<div class="page-intro"><span class="eyebrow">精选曲库</span><h1>${title}</h1><p>${description}</p></div>${section(`第 ${data.page} / ${data.pages} 页`, '每页 20 首', data.items.length ? songRows(data.items, (data.page - 1) * 20 + 1) : `<div class="empty-state">这页暂时无法从源站获取曲目，请稍后重试。</div>`, null, recommend ? 'spark' : 'flame', 'bulk-panel', bulkAction(data.items))}${pager(recommend ? '/ranking/recommend' : '/ranking/hot', data.page, data.pages)}`;
  return layout(title, content, recommend ? '/ranking/recommend' : '/ranking/hot');
}
function searchPage(query, results) {
  const { items, page, hasNext, source, stale } = results;
  const notice = stale ? `<p class="search-notice">${source === 'cached' ? '在线搜索暂时不可用，当前展示上次缓存的搜索结果。' : '在线搜索暂时不可用，当前仅显示本地已有歌曲。'}</p>` : '';
  const base = `/search.php?q=${encodeURIComponent(query)}`;
  const pageNav = page > 1 || hasNext ? `<nav class="pager" aria-label="搜索分页">${page > 1 ? `<a href="${base}&page=${page - 1}">上一页</a>` : ''}<span class="current" aria-current="page">第 ${page} 页</span>${hasNext ? `<a href="${base}&page=${page + 1}">下一页</a>` : ''}</nav>` : '';
  const description = source === 'local' && !items.length ? `“${esc(query)}”暂未找到歌曲` : `“${esc(query)}”本页找到 ${items.length} 首歌曲`;
  return layout(`搜索 ${query}`, `${searchIntro('搜索结果', description, query, notice)}${section('歌曲', '搜索结果', items.length ? songRows(items, (page - 1) * 20 + 1) : '<div class="empty-state">没有找到相关歌曲，换个关键词试试。</div>', null, 'search', 'bulk-panel', bulkAction(items))}${pageNav}`, '/search.php');
}
function songPage(song) {
  const { title, artist, cover, lyrics } = song;
  const coverHtml = cover ? `<img class="detail-cover" src="${esc(coverUrl(song))}" alt="${esc(title)} 封面" loading="lazy">` : `<div class="detail-cover placeholder">${icon('note')}</div>`;
  return layout(title, `<div class="page-intro"><span class="eyebrow">歌曲详情</span><h1>${esc(displayTitle(song))}</h1><p>${esc(artist || '未末音乐')}</p></div><section class="panel song-detail"><div class="detail-top">${coverHtml}<div class="detail-copy"><span class="eyebrow">好歌分享</span><h2>${esc(displayTitle(song))}</h2><p>${esc(artist || '音乐让此刻更动听')}</p><div class="detail-actions"><button class="primary-action" type="button" ${songData(song)}>${icon('play')} 立即播放</button><button class="secondary-action favorite-button" type="button" data-favorite-id="${esc(song.id)}" data-song-title="${esc(title)}">${icon('heart')} 收藏</button><button class="secondary-action" type="button" data-add-id="${esc(song.id)}" data-song-title="${esc(title)}" ${artist ? `data-song-artist="${esc(artist)}"` : ''}>${icon('plus')} 加入播放清单</button></div></div></div>${lyrics ? `<details class="lyrics"><summary>查看歌词</summary><p>${esc(lyrics)}</p></details>` : ''}<a class="detail-download" href="${esc(proxyMediaUrl(title))}" download>下载音频文件</a></section>${section('继续听', '听完再听', songRows(seed.rank_hot.slice(0, 6)), '/ranking/hot', 'spark')}`);
}
function myMusicPage() {
  return layout('我的音乐', `<section class="profile-hero"><div class="profile-avatar"><img src="/projects/source_code/picture/logo.svg" alt=""></div><div class="profile-meta"><strong>未末音乐用户</strong><small>本地音乐空间 · 登录后可同步</small></div><div class="profile-stats"><span><b id="profile-favorites-count">0</b><small>收藏</small></span><span><b id="profile-tracks-count">0</b><small>清单</small></span><span><b>Lv.1</b><small>等级</small></span></div></section><div class="page-intro"><span class="eyebrow">专属音乐空间</span><h1>我的音乐</h1><p>收藏与播放清单保存在当前浏览器，未来可与微信账号同步。</p></div><div class="home-grid personal-grid">${section('我的收藏', '我的收藏', '<div id="favorites-list" class="personal-list"></div>', null, 'heart')}${section('播放清单', '我的播放清单', '<div id="playlist-list" class="personal-list"></div>', null, 'note')}</div>`, '/my-music');
}
function listPage(title, eyebrow, items, more = null, withBulk = false) {
  return layout(title, `${searchIntro(esc(title), '喜欢的声音，就从这里开始。')}${section(title, eyebrow, songRows(items), more, 'note', withBulk ? 'bulk-panel' : '', withBulk ? bulkAction(items) : '')}`);
}
function recentPage(items, page = 1, pages = 1) {
  const content = `${section(`第 ${page} / ${pages} 页`, '最新收录', items.length ? songRows(items, (page - 1) * 20 + 1, { date: true }) : '<div class="empty-state">这页暂时无法获取，请稍后重试。</div>', null, 'clock', 'bulk-panel', bulkAction(items))}${pager('/navigation/1/', page, pages)}`;
  return layout('最近更新', `${searchIntro('最近更新', '实时同步最新上架的歌曲，每 6 小时刷新缓存。')}${content}`, '/navigation/1/');
}
function viewmorPage(data) { return data ? rankingPage(data) : listPage('此刻热门', '此刻流行', seed.viewmor, '/ranking/hot'); }
function downPage(data) { return data ? rankingPage(data) : listPage('热门歌曲', '热门点播', seed.down, '/ranking/hot'); }
// 排行榜中心：四张榜单卡片，榜首大卡片 + Top 5 预览 + 走势徽章
function chartsHubPage(charts) {
  const cards = charts.map(chart => {
    const top5 = chart.items.slice(0, 5);
    const list = top5.length ? `<div class="chart-card-list">${top5.map((song, i) => {
      const n = i + 1;
      const badge = trendBadge(chart.trend && chart.trend.get(String(song.id)));
      if (n === 1) {
        return `<a class="chart-top1" href="/library/${esc(song.id)}.html" ${songData(song)} title="播放 ${esc(song.title)}"><span class="rank-badge rank-gold">1</span><span class="chart-top1-info"><strong>${esc(displayTitle(song))}</strong><small>${esc(artistOf(song))}${chart.plays && song.plays ? ` · ${song.plays} 次点播` : ''}</small></span>${badge}${icon('play')}</a>`;
      }
      return `<div class="chart-mini-row"><span class="rank-badge ${rankClass(n)}">${n}</span><div class="song-main">${songLink(song)}</div>${badge}<button class="play-button" type="button" ${songData(song)} aria-label="播放 ${esc(song.title)}">${icon('play')}</button></div>`;
    }).join('')}</div>` : '<div class="empty-state">榜单数据暂时不可用，稍后刷新试试。</div>';
    return `<section class="panel chart-card chart-${chart.kind}"><div class="panel-heading"><div class="heading-icon">${icon(chart.def.icon)}</div><div><span class="eyebrow">${esc(chart.def.eyebrow)}</span><h2>${esc(chart.def.name)}</h2></div><a class="more-link" href="/charts/${chart.kind}">完整榜单 ${icon('arrow')}</a></div><p class="chart-desc">${esc(chart.def.description)}</p>${list}</section>`;
  }).join('');
  return layout('排行榜', `${searchIntro('排行榜', '热门、新歌、编辑推荐与本站真实点播，走势每日更新。')}<div class="charts-grid">${cards}</div>`, '/charts');
}
// 完整榜单页：金银铜徽章 + 走势列 + 点播数（本站榜）+ 分页
function chartPage(kind, def, data) {
  const note = data.stale ? ' 源站暂时不可用，当前展示缓存数据。' : '';
  const list = data.items.length
    ? songRows(data.items, (data.page - 1) * 20 + 1, { trend: data.trend, plays: data.plays })
    : `<div class="empty-state">${kind === 'local' ? '还没有点播记录，播放过的歌曲会自动上榜。' : '榜单数据暂时不可用，稍后刷新试试。'}</div>`;
  const content = `${searchIntro(esc(def.name), `${esc(def.description)}${note}`)}${section(`第 ${data.page} / ${data.pages} 页`, def.name, list, '/charts', def.icon, 'bulk-panel', bulkAction(data.items))}${data.pages > 1 ? pager(`/charts/${kind}`, data.page, data.pages) : ''}`;
  return layout(def.name, content, '/charts');
}
function collectionsPage() {
  return layout('精选歌单', `<div class="page-intro"><span class="eyebrow">精选歌单</span><h1>精选歌单</h1><p>按心情收藏你的音乐灵感。</p></div><div class="collection-grid">${seed.collections.map((item, index) => `<article class="collection-card">${coverMark(item, 'collection-cover')}<span>0${index + 1}</span><h2>${esc(displayTitle(item))}</h2><p>发现更多好音乐</p>${songLink(item, `打开歌单 ${icon('arrow')}`)}</article>`).join('')}</div>`, '/navigation/2/');
}
function artistsPage() {
  return layout('人气歌手', `${searchIntro('人气歌手', '从熟悉的名字，找到下一首喜欢的歌。')}<div class="artist-grid">${seed.artists.map((artist, i) => `<a href="/search.php?q=${encodeURIComponent(artist)}" class="artist-card"><span>${String(i + 1).padStart(2, '0')}</span><strong>${esc(artist)}</strong>${icon('arrow')}</a>`).join('')}</div>`, '/hotsgr.html');
}
function keywordsPage() {
  return layout('热门搜索', `${searchIntro('热门搜索', '大家正在听什么？')}<div class="keyword-grid">${seed.keywords.map((word, i) => `<a href="/search.php?q=${encodeURIComponent(word)}"><span>${String(i + 1).padStart(2, '0')}</span>${esc(word)}${icon('arrow')}</a>`).join('')}</div>`, '/keyword.html');
}
module.exports = { homePage, rankingPage, searchPage, songPage, myMusicPage, collectionsPage, artistsPage, keywordsPage, recentPage, viewmorPage, downPage, chartsHubPage, chartPage };
