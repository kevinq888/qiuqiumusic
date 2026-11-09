const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// 品牌图形与 public/picture/logo.svg 一致，但按 macOS Big Sur 之后的图标网格排版：
// 1024 画布内放 824 的圆角方块（左右各留 100），圆角半径 185。
// 这样 Dock / 启动台 / 访达里的视觉大小才和系统 App 一致，不会被“放大一圈”。
const CANVAS = 1024;
const TILE = 824;
const MARGIN = (CANVAS - TILE) / 2;
const RADIUS = 185;
const SCALE = TILE / 96; // logo.svg 的 viewBox 是 96

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f1fff9"/><stop offset="1" stop-color="#a3ddc0"/>
    </linearGradient>
    <linearGradient id="leaf" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#17795a"/><stop offset="1" stop-color="#59cb91"/>
    </linearGradient>
    <linearGradient id="stem" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#14523f"/><stop offset="1" stop-color="#0a2b24"/>
    </linearGradient>
  </defs>
  <g transform="translate(${MARGIN} ${MARGIN}) scale(${SCALE.toFixed(4)})">
    <rect width="96" height="96" rx="${(RADIUS / SCALE).toFixed(3)}" fill="url(#bg)"/>
    <ellipse cx="33" cy="64" rx="14" ry="11" transform="rotate(-18 33 64)" fill="url(#leaf)"/>
    <path d="M51 36 C44 31 37 28 27 28 C30 34 38 41 49 42 Z" fill="url(#leaf)" opacity=".9"/>
    <path d="M45 60 C46.5 44 49.5 32 56 24" stroke="url(#stem)" stroke-width="6.4" stroke-linecap="round" fill="none"/>
    <path d="M56 24 C65 26 76 31 83 42 C74 47 63 43 56 33 Z" fill="url(#leaf)"/>
  </g>
</svg>`;

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const target = path.join(__dirname, 'app-icon.png');

if (process.platform !== 'darwin' || !fs.existsSync(CHROME)) {
  // 非 macOS 或没装 Chrome 时保留既有图标，避免把构建卡死。
  if (!fs.existsSync(target)) throw Error('缺少 app-icon.png，且当前环境无法渲染图标（需要 macOS + Chrome）');
  console.log('Skipped icon rendering (keeps existing app-icon.png).');
} else {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qiuqiu-icon-'));
  const source = path.join(scratch, 'icon.svg');
  const output = path.join(scratch, 'icon.png');
  fs.writeFileSync(source, svg);
  const result = spawnSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--force-device-scale-factor=1', '--default-background-color=00000000',
    `--window-size=${CANVAS},${CANVAS}`, `--screenshot=${output}`,
    `file://${source}`,
  ], { stdio: 'ignore', timeout: 60000 });
  if (result.error) throw result.error;
  if (!fs.existsSync(output)) throw Error('图标渲染失败：Chrome 未产出截图');
  const png = fs.readFileSync(output);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== CANVAS || height !== CANVAS) throw Error(`图标尺寸异常：${width}x${height}`);
  fs.copyFileSync(output, target);
  fs.rmSync(scratch, { recursive: true, force: true });
  console.log(`Generated app-icon.png ${CANVAS}x${CANVAS} (macOS grid: tile ${TILE}, radius ${RADIUS}).`);
}
