const fs = require('node:fs');
const path = require('node:path');
const REPO = 'https://github.com/kevinq888/qiuqiumusic';
// 新版本安装包使用 mac-* 命名；旧版本发布过的 macos-* 继续兼容。
const TARGETS = ['mac-arm64', 'mac-x64', 'windows-x64'];
const ALIASES = { 'macos-arm64': 'mac-arm64', 'macos-x64': 'mac-x64' };
function downloadsFrom(links) {
  const downloads = {};
  for (const link of links) {
    if (typeof link !== 'string' || !link.startsWith(`${REPO}/releases/download/`)) continue;
    const match = decodeURI(link).match(/-(macos-arm64|macos-x64|mac-arm64|mac-x64|windows-x64)\.(zip|dmg|exe)$/);
    if (match) downloads[ALIASES[match[1]] || match[1]] = link;
  }
  return downloads;
}
function completeRelease(downloads) {
  return TARGETS.every(target => downloads[target]);
}
function readmeRelease() {
  // 安卓/旧包可能没带 README 或版本段落不完整，解析失败不能让服务启动失败
  try {
    const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
    const current = readme.match(/### v([\d.]+)（当前版本）([\s\S]*?)(?=\n### |$)/);
    if (current) {
      const downloads = downloadsFrom([...current[2].matchAll(/\]\((https:\/\/[^)]+)\)/g)].map(match => match[1]));
      if (completeRelease(downloads)) return { version: current[1], downloads };
    }
  } catch { /* Fall through to the package version. */ }
  let version = '0.0.0';
  try { version = require('../package.json').version; } catch {}
  return { version, downloads: {} };
}
let cached = readmeRelease();
let nextCheck = 0;
let pending;
async function latestRelease() {
  if (Date.now() < nextCheck) return cached;
  if (!pending) pending = (async () => {
    try {
      const response = await fetch('https://api.github.com/repos/kevinq888/qiuqiumusic/releases/latest', {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'qiuqiumusic-desktop-download' }, signal: AbortSignal.timeout(3500),
      });
      if (!response.ok) throw Error(`GitHub ${response.status}`);
      const release = await response.json();
      if (release.draft || release.prerelease) throw Error('Not a stable release');
      const downloads = downloadsFrom((release.assets || []).filter(asset => asset.state === 'uploaded' && asset.size > 0).map(asset => asset.browser_download_url));
      if (!completeRelease(downloads)) throw Error('Incomplete desktop release');
      cached = { version: release.tag_name.replace(/^v/, ''), downloads };
    } catch { /* Keep the last complete release, initially the README's current version. */ }
    nextCheck = Date.now() + 10 * 60 * 1000;
    return cached;
  })().finally(() => { pending = undefined; });
  return pending;
}
module.exports = { latestRelease, readmeRelease, downloadsFrom };
