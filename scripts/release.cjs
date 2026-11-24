#!/usr/bin/env node
// 一键发布：上传命名规范的安装包 → 校验 → 清理旧版本（GitHub + 本地 dist）→ 同步清单。
// 用法：
//   npm run release           正式发布
//   npm run release -- --dry-run  只打印计划，不做修改
// 需要 GITHUB_TOKEN 环境变量，或 macOS 钥匙串里 github.com 的密码。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const pkg = require('../package.json');
const VERSION = pkg.version;
const TAG = `v${VERSION}`;
const REPO = 'kevinq888/weimomusic';
const DIST = path.join(ROOT, 'dist', VERSION);
const UPDATE_DIR = path.join(DIST, 'update');
const DRY = process.argv.includes('--dry-run');
// 桌面端自动更新只认 <version>-<target>.zip，这个格式不能改。
const UPDATER_TARGETS = ['mac-arm64', 'mac-x64', 'windows-x64'];
// 对外下载名统一为 weimomusic-<version>-<platform>.<ext>。
const DOWNLOADS = [
  ['android', 'android/未末音乐-%s-android-arm64-v8a.apk'],
  ['iphone', 'iphone/未末音乐-%s-iphone.zip'],
  ['mac-arm64', 'mac/未末音乐-%s-mac-arm64.dmg'],
  ['mac-x64', 'mac/未末音乐-%s-mac-x64.dmg'],
  ['windows-x64', 'windows/未末音乐-%s-windows-x64.exe'],
];

function localAsset(file) {
  return path.join(DIST, file.replace(/%s/g, VERSION));
}

function downloadName(key) {
  const ext = { android: 'apk', iphone: 'zip', 'mac-arm64': 'dmg', 'mac-x64': 'dmg', 'windows-x64': 'exe' }[key];
  const suffix = key === 'android' ? 'android-arm64-v8a' : key;
  return `weimomusic-${VERSION}-${suffix}.${ext}`;
}

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync('security', ['find-internet-password', '-s', 'github.com', '-w'], { encoding: 'utf8' }).trim();
  } catch {
    throw Error('缺少 GitHub 令牌：请设置 GITHUB_TOKEN，或在钥匙串中添加 github.com 的互联网密码。');
  }
}

const TOKEN = token();

async function api(route, init = {}) {
  const response = await fetch(`https://api.github.com${route}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'weimomusic-release',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = Error(`${init.method || 'GET'} ${route} -> ${response.status} ${data.message || text.slice(0, 120)}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function semver(value) {
  return String(value || '0').replace(/^v/, '').split('.').map(Number);
}
function compare(a, b) {
  const pa = semver(a);
  const pb = semver(b);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// 桌面更新器要求 zip 内只有一个安装包，且文件名就是未末音乐-<version>-<target>.<ext>。
// 用 python3 的 zipfile 写 UTF-8 文件名，Windows 端解压才不会乱码。
function makeUpdaterZip(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const script = [
    'import sys, zipfile, os',
    'src, dst = sys.argv[1], sys.argv[2]',
    "with zipfile.ZipFile(dst, 'w', zipfile.ZIP_STORED, allowZip64=True) as z:",
    '    z.write(src, arcname=os.path.basename(src))',
  ].join('\n');
  execFileSync('python3', ['-c', script, source, target], { stdio: 'inherit' });
}

function upload(releaseId, repoId, name, file) {
  const config = path.join(os.tmpdir(), `qiuqiu-curl-${process.pid}.conf`);
  fs.writeFileSync(config, `header = "Authorization: Bearer ${TOKEN}"\n`, { mode: 0o600 });
  try {
    const output = execFileSync('curl', [
      '-sS', '--fail-with-body', '--retry', '3', '--retry-delay', '3', '--max-time', '0',
      '-X', 'POST', '--config', config,
      '-H', 'Content-Type: application/octet-stream',
      '--data-binary', `@${file}`,
      `https://uploads.github.com/repositories/${repoId}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`,
    ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const data = JSON.parse(output);
    if (data.state !== 'uploaded') throw Error(`上传未完成：${name} (${data.state || data.message})`);
    return data;
  } finally {
    fs.rmSync(config, { force: true });
  }
}

function releaseBody() {
  try {
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    const section = readme.match(/### v[\d.]+（当前版本）\n+([\s\S]*?)\n\n\| 系统 \|/);
    if (section) return `### 更新内容\n\n${section[1].trim()}`;
  } catch { /* 读不到就用通用文案 */ }
  return `### 更新内容\n\n未末音乐 ${VERSION}`;
}

function updateReadme() {
  const file = path.join(ROOT, 'README.md');
  let text = fs.readFileSync(file, 'utf8');
  const rows = DOWNLOADS.map(([key]) =>
    `| ${({ android: 'Android（arm64-v8a）', iphone: 'iPhone / iPad（PWA）', 'mac-arm64': 'macOS（Apple 芯片）', 'mac-x64': 'macOS（Intel）', 'windows-x64': 'Windows（64 位）' })[key]} | [${downloadName(key)}](https://github.com/${REPO}/releases/download/${TAG}/${downloadName(key)}) |`
  ).join('\n');
  const table = `| 系统 | 下载 |\n| --- | --- |\n${rows}`;
  text = text.replace(/### v[\d.]+（当前版本）/g, `### v${VERSION}（当前版本）`);
  const replaced = text.replace(/\| 系统 \| 下载 \|\n\| --- \| --- \|\n(?:\|[^\n]*\n)+/, `${table}\n`);
  if (replaced !== fs.readFileSync(file, 'utf8')) {
    fs.writeFileSync(file, replaced);
    console.log('已更新 README 下载表');
  }
}

function writeDesktopManifest(assets) {
  const file = path.join(ROOT, 'desktop', 'release.json');
  const picked = [];
  for (const target of UPDATER_TARGETS) {
    const asset = assets.find(item => item.name === `${VERSION}-${target}.zip`);
    if (!asset) throw Error(`Release 里缺少 ${VERSION}-${target}.zip`);
    picked.push({
      name: asset.name,
      state: asset.state,
      size: asset.size,
      digest: asset.digest || `sha256:${sha256(path.join(UPDATE_DIR, asset.name))}`,
      browser_download_url: asset.browser_download_url,
    });
  }
  const next = JSON.stringify({ tag_name: TAG, draft: false, prerelease: false, assets: picked }, null, 2) + '\n';
  if (fs.readFileSync(file, 'utf8') !== next) {
    fs.writeFileSync(file, next);
    console.log('已同步 desktop/release.json');
  }
}

async function cleanup() {
  const releases = [];
  for (let page = 1; ; page++) {
    const chunk = await api(`/repos/${REPO}/releases?per_page=100&page=${page}`);
    if (!chunk.length) break;
    releases.push(...chunk);
  }
  for (const release of releases) {
    if (release.tag_name === TAG) continue;
    if (compare(release.tag_name, VERSION) > 0) {
      console.log(`保留更高版本 ${release.tag_name}`);
      continue;
    }
    if (DRY) { console.log(`[dry] 删除 Release ${release.tag_name}`); continue; }
    await api(`/repos/${REPO}/releases/${release.id}`, { method: 'DELETE' });
    console.log(`已删除 Release ${release.tag_name}`);
  }

  const tags = [];
  for (let page = 1; ; page++) {
    const chunk = await api(`/repos/${REPO}/tags?per_page=100&page=${page}`);
    if (!chunk.length) break;
    tags.push(...chunk);
  }
  for (const tag of tags) {
    if (tag.name === TAG) continue;
    if (compare(tag.name, VERSION) > 0) continue;
    if (DRY) { console.log(`[dry] 删除 tag ${tag.name}`); continue; }
    await api(`/repos/${REPO}/git/refs/tags/${tag.name}`, { method: 'DELETE' });
    console.log(`已删除 tag ${tag.name}`);
  }

  for (const entry of fs.readdirSync(path.join(ROOT, 'dist'), { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d+\.\d+\.\d+$/.test(entry.name) || entry.name === VERSION) continue;
    if (compare(entry.name, VERSION) > 0) continue;
    if (DRY) { console.log(`[dry] 删除本地 dist/${entry.name}`); continue; }
    fs.rmSync(path.join(ROOT, 'dist', entry.name), { recursive: true, force: true });
    console.log(`已删除本地 dist/${entry.name}`);
  }
}

async function main() {
  console.log(`发布未末音乐 ${TAG}${DRY ? '（演练）' : ''}`);
  const repo = await api(`/repos/${REPO}`);
  let release;
  try {
    release = await api(`/repos/${REPO}/releases/tags/${TAG}`);
  } catch (error) {
    if (error.status !== 404) throw error;
    if (DRY) { console.log(`[dry] 创建 Release ${TAG}`); release = { id: 0, assets: [] }; }
    else release = await api(`/repos/${REPO}/releases`, {
      method: 'POST',
      body: JSON.stringify({ tag_name: TAG, name: `未末音乐 ${VERSION}`, body: releaseBody(), draft: false, prerelease: false }),
    });
    console.log(`已创建 Release ${TAG}`);
  }

  const plan = DOWNLOADS.map(([key, file]) => ({ name: downloadName(key), file: localAsset(file) }));
  for (const target of UPDATER_TARGETS) {
    const source = localAsset(DOWNLOADS.find(([key]) => key === target)[1]);
    const name = `${VERSION}-${target}.zip`;
    const file = path.join(UPDATE_DIR, name);
    if (!fs.existsSync(file) || fs.statSync(file).mtimeMs < fs.statSync(source).mtimeMs) {
      makeUpdaterZip(source, file);
    }
    plan.push({ name, file });
  }

  let assets = release.assets || [];
  for (const item of plan) {
    if (!fs.existsSync(item.file)) throw Error(`缺少本地安装包：${item.file}`);
    const existing = assets.find(asset => asset.name === item.name);
    if (existing && existing.state === 'uploaded' && existing.size === fs.statSync(item.file).size) {
      console.log(`跳过（已存在）${item.name}`);
      continue;
    }
    if (DRY) { console.log(`[dry] 上传 ${item.name} <- ${path.relative(ROOT, item.file)}`); continue; }
    if (existing) await api(`/repos/${REPO}/releases/assets/${existing.id}`, { method: 'DELETE' });
    const data = upload(release.id, repo.id, item.name, item.file);
    assets = assets.filter(asset => asset.name !== item.name).concat(data);
    console.log(`已上传 ${item.name}`);
  }

  if (!DRY) {
    release = await api(`/repos/${REPO}/releases/tags/${TAG}`);
    const missing = plan.filter(item => !(release.assets || []).some(asset => asset.name === item.name && asset.state === 'uploaded'));
    if (missing.length) throw Error(`发布包不完整：${missing.map(item => item.name).join(', ')}`);
    writeDesktopManifest(release.assets);
  }
  if (!DRY) updateReadme();
  await cleanup();

  fs.rmSync(UPDATE_DIR, { recursive: true, force: true });
  console.log(`完成：https://github.com/${REPO}/releases/tag/${TAG}`);
}

main().catch(error => {
  console.error(`发布失败：${error.message}`);
  process.exit(1);
});
