#!/usr/bin/env node
// 打包 iOS PWA 安装包：把可安装到主屏幕的入口页、图标与清单打成 zip。
// iOS 不能侧载未签名安装包，这里输出的是 Safari「添加到主屏幕」使用的 PWA 包。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const version = require(path.join(root, 'desktop', 'package.json')).version;
const site = 'https://qiuqiumusic.onrender.com/';
const outDir = path.join(root, 'dist', version, 'iphone');
const archive = path.join(outDir, `未末音乐-${version}-iphone.zip`);

const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>未末音乐 · iOS 安装</title>
<meta name="description" content="在 iPhone / iPad 上把未末音乐添加到主屏幕。">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="未末音乐">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#f1f8f5">
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 32px 20px;
    background: linear-gradient(160deg, #eaf7f0, #f7fcfa 55%, #e8f4f7); color: #17342a;
    font: 16px/1.7 -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif; }
  main { width: 100%; max-width: 480px; padding: 32px 26px 28px; border-radius: 26px; background: rgba(255,255,255,.82);
    box-shadow: 0 18px 48px rgba(28,84,64,.14); backdrop-filter: blur(14px); text-align: center; }
  img.icon { width: 96px; height: 96px; border-radius: 24px; box-shadow: 0 8px 20px rgba(28,84,64,.18); }
  h1 { margin: 18px 0 4px; font-size: 24px; }
  p.sub { margin: 0 0 22px; color: #4f7365; font-size: 14px; }
  ol { margin: 0 0 24px; padding-left: 1.2em; text-align: left; color: #26493c; }
  li { margin: 8px 0; }
  a.button { display: block; padding: 14px 18px; border-radius: 999px; background: #2f8f68; color: #fff;
    font-weight: 600; text-decoration: none; }
  p.tip { margin: 18px 0 0; color: #6b8b7f; font-size: 12px; }
</style>
</head>
<body>
<main>
  <img class="icon" src="icons/icon-192.png" alt="未末音乐">
  <h1>未末音乐</h1>
  <p class="sub">v${version} · iPhone / iPad 版</p>
  <ol>
    <li>用 <strong>Safari</strong> 打开下面的地址（微信内无法安装）。</li>
    <li>点底部「分享」按钮，选择<strong>「添加到主屏幕」</strong>。</li>
    <li>主屏幕出现未末音乐图标，点开即为独立窗口，无地址栏。</li>
  </ol>
  <a class="button" href="${site}">打开未末音乐</a>
  <p class="tip">安装包版本 v${version}。Android 请使用 APK，电脑请使用 macOS / Windows 安装包。</p>
</main>
</body>
</html>
`;

const guide = `# 未末音乐 iOS 版（v${version}）

iOS 不允许安装未签名的第三方应用包，因此 iPhone / iPad 使用 PWA 方式安装：

1. 用 Safari 打开 <${site}>（微信、QQ 等内置浏览器无法安装）。
2. 点底部分享按钮 → 「添加到主屏幕」。
3. 主屏幕会生成「未末音乐」图标，点开是独立窗口，没有地址栏。

说明：
- 需要 iOS 15 及以上；首次打开需要联网，之后常用页面会被缓存。
- 也可以把本压缩包解压后放到任意静态托管上，用 Safari 打开其中的 index.html 作为安装入口。
- Android 用 dist/${version}/android 下的 APK，电脑用 dist/${version}/mac 与 dist/${version}/windows 下的安装包。
`;

function copy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function build() {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'qiuqiu-ios-'));
  try {
    const manifest = {
      name: '未末音乐',
      short_name: '未末音乐',
      description: '听见喜欢的声音。未末音乐，发现与分享好音乐。',
      lang: 'zh-CN',
      start_url: site,
      scope: site,
      display: 'standalone',
      background_color: '#f1f8f5',
      theme_color: '#f1f8f5',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    };
    fs.writeFileSync(path.join(stage, 'index.html'), page);
    fs.writeFileSync(path.join(stage, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(stage, 'INSTALL.md'), guide);
    for (const icon of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
      copy(path.join(root, 'public', 'icons', icon), path.join(stage, 'icons', icon));
    }

    fs.mkdirSync(outDir, { recursive: true });
    fs.rmSync(archive, { force: true });
    const zip = spawnSync('/usr/bin/zip', ['-q', '-r', '-X', archive, '.'], { cwd: stage, stdio: 'inherit' });
    if (zip.error) throw zip.error;
    if (zip.status !== 0) throw Error('zip failed');
    fs.writeFileSync(path.join(outDir, `未末音乐-${version}-iphone-INSTALL.md`), guide);
    console.log(`Installer: ${archive}`);
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

try { build(); } catch (error) { console.error(error.message); process.exitCode = 1; }
