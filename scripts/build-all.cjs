#!/usr/bin/env node
// 一键打包所有平台：mac / windows / android / iphone，统一输出到 dist/<平台>/<版本>/。
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const version = require(path.join(root, 'desktop', 'package.json')).version;
const node = process.execPath;

// 版本号只有一个来源（desktop/package.json），其余位置必须与它一致。
function checkVersion() {
  const rootVersion = require(path.join(root, 'package.json')).version;
  const manifest = fs.readFileSync(path.join(root, 'android', 'AndroidManifest.xml'), 'utf8');
  const androidVersion = (manifest.match(/android:versionName="([^"]+)"/) || [])[1];
  if (rootVersion !== version) throw Error(`版本号不一致：package.json 为 ${rootVersion}，desktop/package.json 为 ${version}`);
  if (androidVersion !== version) throw Error(`版本号不一致：AndroidManifest.xml 为 ${androidVersion}，desktop/package.json 为 ${version}`);
}
const steps = {
  mac: () => run(node, ['desktop/scripts/build-desktop.cjs', 'mac']),
  windows: () => run(node, ['desktop/scripts/build-desktop.cjs', 'win']),
  iphone: () => run(node, ['scripts/build-iphone.cjs']),
  android: () => {
    const sdk = process.env.ANDROID_SDK_ROOT || '/tmp/abuild/sdk';
    if (!fs.existsSync(sdk)) throw Error(`Android SDK 不存在：${sdk}（可用 ANDROID_SDK_ROOT 指定）`);
    run('/bin/bash', ['scripts/build-android-apk.sh']);
  },
};

function run(command, args) {
  console.log(`\n==> ${path.basename(args[args.length - 1])}`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`失败：${command} ${args.join(' ')}`);
}

function summary() {
  console.log(`\n版本 ${version} 的安装包：`);
  for (const platform of ['mac', 'windows', 'android', 'iphone']) {
    const dir = path.join(root, 'dist', platform, version);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      console.log(`  ${path.relative(root, file)}  ${(fs.statSync(file).size / 1024 / 1024).toFixed(1)} MB`);
    }
  }
}

try {
  checkVersion();
  const selected = process.argv.slice(2);
  const names = selected.length ? selected : Object.keys(steps);
  for (const name of names) {
    if (!Object.hasOwn(steps, name)) throw Error(`未知平台：${name}（可选 ${Object.keys(steps).join(' / ')}）`);
    steps[name]();
  }
  summary();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
