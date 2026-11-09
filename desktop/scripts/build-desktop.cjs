const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const desktop = path.resolve(__dirname, '..');
const repo = path.resolve(desktop, '..');
const pkg = require(path.join(desktop, 'package.json'));
const [platform, ...args] = process.argv.slice(2);
const targets = {
  mac: [['--mac', 'dmg', '--x64', '--arm64', ...args]],
  win: [['--win', 'nsis', '--x64', ...args]],
  all: [['--mac', 'dmg', '--x64', '--arm64'], ['--win', 'nsis', '--x64']],
};

// 安装包统一落在 dist/<版本>/<平台>/，四个平台使用同一套文件名前缀。
const productName = pkg.build.productName;
const prefix = `${productName}-${pkg.version}`;
const installers = new Map([
  [`${prefix}-mac-arm64.dmg`, 'mac'],
  [`${prefix}-mac-x64.dmg`, 'mac'],
  [`${prefix}-windows-x64.exe`, 'windows'],
]);

function outputPath(name) {
  return path.join(repo, 'dist', pkg.version, installers.get(name), name);
}

function build() {
  if (!Object.hasOwn(targets, platform)) throw Error('Specify mac, win, or all.');
  if (platform === 'all' && args.length) throw Error('build:all already selects both Mac architectures and Windows x64.');
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(pkg.version)) throw Error('Invalid release version.');
  const icons = spawnSync(process.execPath, [path.join(desktop, 'generate-icons.js')], { cwd: desktop, stdio: 'inherit' });
  if (icons.error) throw icons.error;
  if (icons.status !== 0) throw Error('Icon generation failed.');
  const expected = platform === 'all' ? 3 : 1;
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qiuqiu-build-'));
  const cli = path.join(path.dirname(require.resolve('electron-builder/package.json')), 'cli.js');
  let complete = false;
  try {
    for (const target of targets[platform]) {
      const result = spawnSync(process.execPath, [cli, ...target, `--config.directories.output=${scratch}`], { cwd: desktop, stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) throw Error(`electron-builder failed (${result.signal || result.status}).`);
    }
    const built = fs.readdirSync(scratch).filter(name => installers.has(name));
    if (built.length < expected) throw Error('Expected installers are missing from the build output.');
    for (const name of built) {
      const destination = outputPath(name);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(scratch, name), destination, fs.constants.COPYFILE_FICLONE);
      console.log(`Installer: ${destination}`);
    }
    complete = true;
  } finally {
    if (complete) {
      if (process.platform === 'darwin') {
        const register = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
        for (const folder of ['mac', 'mac-arm64']) {
          const application = path.join(scratch, folder, `${productName}.app`);
          if (fs.existsSync(application)) spawnSync(register, ['-u', application], { stdio: 'ignore' });
        }
      }
      fs.rmSync(scratch, { recursive: true, force: true });
    }
    else console.error(`Build diagnostics retained at: ${scratch}`);
  }
}

try { build(); } catch (error) { console.error(error.message); process.exitCode = 1; }
