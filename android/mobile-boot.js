// 安卓端入口：与桌面版共用同一套服务端。
// 部分 ROM（例如 Android 16 的小米 HyperOS）会拒绝绑定固定的回环端口，listen/bind 直接返回
// EPERM。这里按顺序尝试多种绑定方式，谁成功就用谁，并把实际端口写进 port 文件，
// 由界面进程读取后再加载 WebView。
const fs = require('node:fs');
const path = require('node:path');

const preferred = Number(process.env.PORT) || 43219;
const portFile = process.env.QIUQIU_PORT_FILE || '';
process.env.QIUQIU_DATA_DIR = process.env.QIUQIU_DATA_DIR || path.join(__dirname, 'userdata');
// 绑定到 0.0.0.0 时也只允许本机访问。
process.env.QIUQIU_LOOPBACK_ONLY = '1';

const { startServer } = require('./server.js');

// host 为 null 表示不指定地址（由系统选择），可绕开个别 ROM 对固定回环地址的限制。
const candidates = [
  ['auto', null, preferred],
  ['loopback', '127.0.0.1', preferred],
  ['auto-random', null, 0],
  ['loopback-random', '127.0.0.1', 0],
  ['ipv6-loopback', '::1', 0],
];

(async () => {
  for (const [label, host, port] of candidates) {
    try {
      const server = await startServer({ port, host });
      const actual = server.address().port;
      if (portFile) {
        try {
          fs.mkdirSync(path.dirname(portFile), { recursive: true });
          fs.writeFileSync(portFile, String(actual));
        } catch (error) {
          console.error(`port file write failed: ${error.code || error.message}`);
        }
      }
      console.log(`QIUQIU_READY ${actual} (${label} ${host || 'auto'})`);
      return;
    } catch (error) {
      console.error(`bind failed: ${label} ${host || 'auto'}:${port} ${error.code || error.message}`);
    }
  }
  console.error('本地服务启动失败：系统拒绝了所有本地绑定方式');
  process.exit(1);
})();
