const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// 品牌图形只有一个来源：public/picture/logo.svg。
// app-icon.png 按 macOS Big Sur 之后的图标网格排版：1024 画布内放 824 的圆角方块（左右各留 100），
// 圆角半径 185。这样 Dock / 启动台 / 访达里的视觉大小才和系统 App 一致，不会被“放大一圈”。
const ROOT = path.resolve(__dirname, '..');
const LOGO = path.join(ROOT, 'public', 'picture', 'logo.svg');
const CANVAS = 1024;
const TILE = 824;
const MARGIN = (CANVAS - TILE) / 2;
const RADIUS = 185;
const SCALE = TILE / 96; // logo.svg 的 viewBox 是 96

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const target = path.join(__dirname, 'app-icon.png');

// 站点与安装包里要用的位图尺寸，logo.svg 直接按目标尺寸缩放。
const RASTERS = [
  [512, 'public/icons/icon-512.png'],
  [192, 'public/icons/icon-192.png'],
  [180, 'public/icons/apple-touch-icon.png'],
  [512, 'public/picture/logo.png'],
  [48, 'android/res/mipmap-mdpi/ic_launcher.png'],
  [72, 'android/res/mipmap-hdpi/ic_launcher.png'],
  [96, 'android/res/mipmap-xhdpi/ic_launcher.png'],
  [144, 'android/res/mipmap-xxhdpi/ic_launcher.png'],
  [192, 'android/res/mipmap-xxxhdpi/ic_launcher.png'],
];

function inner(file) {
  return fs.readFileSync(file, 'utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}

function render(chrome, svgSource, size) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'weimo-icon-'));
  try {
    const source = path.join(scratch, 'icon.svg');
    const output = path.join(scratch, 'icon.png');
    fs.writeFileSync(source, svgSource);
    const result = spawnSync(chrome, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
      '--force-device-scale-factor=1', '--default-background-color=00000000',
      `--window-size=${size},${size}`, `--screenshot=${output}`,
      `file://${source}`,
    ], { stdio: 'ignore', timeout: 60000 });
    if (result.error) throw result.error;
    if (!fs.existsSync(output)) throw Error('图标渲染失败：Chrome 未产出截图');
    const png = fs.readFileSync(output);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (width !== size || height !== size) throw Error(`图标尺寸异常：${width}x${height}`);
    return png;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

if (process.platform !== 'darwin' || !fs.existsSync(CHROME)) {
  // 非 macOS 或没装 Chrome 时保留既有图标，避免把构建卡死。
  const missing = [{ file: target, label: 'app-icon.png' }, ...RASTERS.map(([, file]) => ({ file: path.join(ROOT, file), label: file }))]
    .filter(item => !fs.existsSync(item.file));
  if (missing.length) throw Error(`缺少 ${missing.map(item => item.label).join('、')}，且当前环境无法渲染图标（需要 macOS + Chrome）`);
  console.log('Skipped icon rendering (keeps existing icons).');
} else {
  const mark = inner(LOGO);
  fs.writeFileSync(target, render(CHROME, `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}"><g transform="translate(${MARGIN} ${MARGIN}) scale(${SCALE.toFixed(4)})">${mark}</g></svg>`, CANVAS));
  // 菜单栏图标走模板图（只取 alpha），所以去掉底板与深色描边，只留环与音符本体。
  const trayMark = mark
    .replace(/<rect[^>]*fill="url\(#bg\)"[^>]*\/>/, '')
    .replace(/<(?:ellipse|path)[^>]*#123f2f[^>]*\/>/g, '');
  fs.writeFileSync(path.join(__dirname, 'tray-icon.png'), render(CHROME, `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 96 96">${trayMark}</svg>`, 512));
  for (const [size, file] of RASTERS) {
    const destination = path.join(ROOT, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, render(CHROME, `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96">${mark}</svg>`, size));
  }
  console.log(`Generated app-icon.png ${CANVAS}x${CANVAS} (macOS grid: tile ${TILE}, radius ${RADIUS}) and ${RASTERS.length} site icons.`);
}
