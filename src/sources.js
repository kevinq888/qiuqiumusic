// 音乐源列表：同一曲库有多个入口，某个域名不可用时自动切换，后续可继续追加。
const https = require('node:https');

const HOSTS = [
  'https://myfreemp3ku.com',
  'https://www.myfreemp3ku.com',
];

let preferred = 0;

function fetchHtml(pathname, { timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const order = [HOSTS[preferred], ...HOSTS.filter((_, index) => index !== preferred)];
    let index = 0;
    let settled = false;
    const next = () => {
      if (settled) return;
      const host = order[index++];
      if (!host) {
        settled = true;
        reject(new Error('所有音源都不可用'));
        return;
      }
      const request = https.get(`${host}${pathname}`, { headers: { 'User-Agent': 'qiuqiumusic/1.0' } }, response => {
        if (response.statusCode !== 200) {
          response.resume();
          next();
          return;
        }
        let html = '';
        response.setEncoding('utf8');
        response.on('data', chunk => {
          html += chunk;
          if (html.length > 2_000_000) request.destroy(new Error('source page too large'));
        });
        response.on('end', () => {
          if (settled) return;
          settled = true;
          preferred = HOSTS.indexOf(host);
          resolve({ html, source: host });
        });
        response.on('error', () => next());
      });
      request.setTimeout(timeout, () => request.destroy(new Error('source timeout')));
      request.on('error', () => next());
    };
    next();
  });
}

module.exports = { fetchHtml, HOSTS };
