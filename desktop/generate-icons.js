const fs = require('node:fs');
const path = require('node:path');

// 品牌图标由 public/picture/logo.svg 经无头 Chrome 渲染成 512 PNG 后落到 icon.png，
// 打包阶段只需把同一张图同步为应用图标，避免旧版唱片图标覆盖新品牌视觉。
const source = path.join(__dirname, 'icon.png');
const appIconPath = path.join(__dirname, 'app-icon.png');
fs.copyFileSync(source, appIconPath);
console.log('Synced app-icon.png from icon.png (brand icon kept as-is).');
