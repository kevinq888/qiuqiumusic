const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// 品牌图形只有一个来源：desktop/logo-master.png（从设计稿原样抠出的 1024 母版）。
// 直接用位图母版铺图标，保证与设计稿完全一致，不做任何重绘。
// app-icon.png 按 macOS Big Sur 之后的图标网格排版：1024 画布内放 824 的圆角方块（左右各留 100）。
const ROOT = path.resolve(__dirname, '..');
const MASTER = path.join(__dirname, 'logo-master.png');
const TRAY_NOTE = path.join(__dirname, 'tray-note.png');
const CANVAS = 1024;
const TILE = 824;
const MARGIN = (CANVAS - TILE) / 2;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const target = path.join(__dirname, 'app-icon.png');

const RASTERS = [
  [512, 'public/icons/icon-512.png'],
  [192, 'public/icons/icon-192.png'],
  [180, 'public/icons/apple-touch-icon.png'],
  [48, 'android/res/mipmap-mdpi/ic_launcher.png'],
  [72, 'android/res/mipmap-hdpi/ic_launcher.png'],
  [96, 'android/res/mipmap-xhdpi/ic_launcher.png'],
  [144, 'android/res/mipmap-xxhdpi/ic_launcher.png'],
  [192, 'android/res/mipmap-xxxhdpi/ic_launcher.png'],
];

function dataUri(file) {
  return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
}

function render(chrome, html, size) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'weimo-icon-'));
  try {
    const source = path.join(scratch, 'icon.html');
    const output = path.join(scratch, 'icon.png');
    fs.writeFileSync(source, html);
    const result = spawnSync(chrome, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
      '--force-device-scale-factor=1', '--default-background-color=00000000',
      // 独立 profile：避免转发到正在运行的 Chrome 实例而不产出截图（表现为构建卡住）
      `--user-data-dir=${path.join(scratch, 'profile')}`,
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

function page(imgHtml) {
  return `<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}img{display:block}</style></head><body>${imgHtml}</body></html>`;
}

function square(uri, size) {
  return page(`<img src="${uri}" width="${size}" height="${size}" style="width:${size}px;height:${size}px">`);
}

if (process.platform !== 'darwin' || !fs.existsSync(CHROME) || !fs.existsSync(MASTER)) {
  // 非 macOS / 没装 Chrome / 母版缺失时保留既有图标，避免把构建卡死。
  const missing = [{ file: target, label: 'app-icon.png' }, ...RASTERS.map(([, file]) => ({ file: path.join(ROOT, file), label: file }))]
    .filter(item => !fs.existsSync(item.file));
  if (missing.length) throw Error(`缺少 ${missing.map(item => item.label).join('、')}，且当前环境无法渲染图标（需要 macOS + Chrome + logo-master.png）`);
  console.log('Skipped icon rendering (keeps existing icons).');
} else {
  fs.writeFileSync(target, render(CHROME, page(
    `<img src="${dataUri(MASTER)}" width="${TILE}" height="${TILE}" style="position:absolute;left:${MARGIN}px;top:${MARGIN}px;width:${TILE}px;height:${TILE}px">`,
  ), CANVAS));
  // 菜单栏图标走模板图（只取 alpha）：白色音符在透明底上的精确轮廓
  if (fs.existsSync(TRAY_NOTE)) {
    fs.copyFileSync(TRAY_NOTE, path.join(__dirname, 'tray-icon.png'));
  }
  for (const [size, file] of RASTERS) {
    const destination = path.join(ROOT, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, render(CHROME, square(dataUri(MASTER), size), size));
  }
  // Windows 安装器需要多尺寸 ico：有 PIL 就顺手重生成，没有就保留现有文件
  const ico = path.join(__dirname, 'build', 'icon.ico');
  const py = spawnSync('python3', ['-c', [
    'from PIL import Image',
    `Image.open(${JSON.stringify(target)}).convert("RGBA").save(${JSON.stringify(ico)}, sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])`,
  ].join('\n')], { stdio: 'ignore' });
  console.log(`Generated app-icon.png ${CANVAS}x${CANVAS} (macOS grid: tile ${TILE}), tray icon and ${RASTERS.length} site icons.`);
}
