// 全平台发布清单：手机端「检查更新」据此拿到当前最新版本与对应安装包地址。
// 版本以本服务的 package.json 为准（部署与打包同源），GitHub Release 只用来补全精确的资产地址与大小。
const REPO = 'https://github.com/kevinq888/qiuqiumusic';
const PLATFORMS = {
  android: { label: 'Android', match: /-android-arm64-v8a\.apk$/, file: version => `-${version}-android-arm64-v8a.apk` },
  iphone: { label: 'iPhone', match: /-iphone\.zip$/, file: version => `-${version}-iphone.zip` },
  'mac-arm64': { label: 'macOS Apple 芯片', match: /-mac-arm64\.dmg$/, file: version => `-${version}-mac-arm64.dmg` },
  'mac-x64': { label: 'macOS Intel', match: /-mac-x64\.dmg$/, file: version => `-${version}-mac-x64.dmg` },
  'windows-x64': { label: 'Windows', match: /-windows-x64\.exe$/, file: version => `-${version}-windows-x64.exe` },
};

function currentVersion() {
  try { return require('../package.json').version; } catch { return '0.0.0'; }
}

function compareVersions(a, b) {
  const pa = String(a || '0').split('.').map(Number);
  const pb = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const left = pa[i] || 0;
    const right = pb[i] || 0;
    if (left !== right) return left > right ? 1 : -1;
  }
  return 0;
}

// 资产地址是固定规则：仓库 + Release 标签 + 文件名。Release 没查到也能直接拼出来。
// 注意：GitHub 会把上传资产名里的中文替换成 "-"，所以兜底名以 "-" 开头。
function assetUrl(version, file) {
  return `${REPO}/releases/download/v${version}/${encodeURIComponent(file)}`;
}

function manifest(version, sizes = {}, downloads = {}) {
  const platforms = {};
  for (const [key, def] of Object.entries(PLATFORMS)) {
    const name = def.file(version);
    platforms[key] = {
      version,
      label: def.label,
      name,
      size: sizes[key] || 0,
      url: downloads[key] || assetUrl(version, name),
    };
  }
  return { current: currentVersion(), latest: version, platforms };
}

let cached = manifest(currentVersion());
let nextCheck = 0;
let pending;

async function githubRelease() {
  const response = await fetch(`https://api.github.com/repos/kevinq888/qiuqiumusic/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'weimomusic-app-update' },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw Error(`GitHub ${response.status}`);
  const release = await response.json();
  if (release.draft || release.prerelease) throw Error('Not a stable release');
  return release;
}

function assetsFrom(release) {
  const downloads = {};
  const sizes = {};
  for (const asset of release.assets || []) {
    if (asset.state !== 'uploaded' || !asset.size) continue;
    const name = decodeURI(asset.name || '');
    for (const [key, def] of Object.entries(PLATFORMS)) {
      if (!def.match.test(name)) continue;
      downloads[key] = asset.browser_download_url;
      sizes[key] = asset.size;
    }
  }
  return { downloads, sizes };
}

// 线上部署的版本号本身就是最新版本；GitHub Release 更新时以它为准（人工上传新资产后可能先于部署）。
async function latestAppRelease() {
  if (Date.now() < nextCheck) return cached;
  if (!pending) pending = (async () => {
    const local = currentVersion();
    let version = local;
    let sizes = {};
    let downloads = {};
    try {
      const release = await githubRelease();
      const remote = release.tag_name.replace(/^v/, '');
      if (compareVersions(remote, local) > 0) version = remote;
      if (version === remote) {
        const assets = assetsFrom(release);
        sizes = assets.sizes;
        downloads = assets.downloads;
      }
    } catch { /* 网络或限流失败时按本地版本拼地址，客户端仍然可下载 */ }
    cached = manifest(version, sizes, downloads);
    nextCheck = Date.now() + 10 * 60 * 1000;
    return cached;
  })().finally(() => { pending = undefined; });
  return pending;
}

module.exports = { latestAppRelease, compareVersions, currentVersion };
