// 实时抓取歌曲（最近更新等）的封面缓存：按「歌手 + 歌名」存储，首次需要时异步去 QQ 音乐找图
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', 'data', 'live-covers.json');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const store = new Map();
const inflight = new Map();
let saveTimer = null;

try {
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  for (const [key, value] of Object.entries(raw)) if (value) store.set(key, String(value));
} catch {}

function keyOf(artist, song) {
  return `${String(artist || '').trim().toLowerCase()}|${String(song || '').trim().toLowerCase()}`.slice(0, 180);
}

function lookup(artist, song) {
  if (!song) return '';
  return store.get(keyOf(artist, song)) || '';
}

// 图床有防盗链，统一转成站内 /cover/ 代理地址
function proxyUrl(url) {
  if (!url) return '';
  const value = String(url).replace(/^http:/, 'https:');
  return value.startsWith('/') ? value : `/cover/${encodeURIComponent(value)}`;
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, `${JSON.stringify(Object.fromEntries(store), null, 2)}\n`);
    } catch {}
  }, 1500);
  if (saveTimer.unref) saveTimer.unref();
}

async function getJson(url, referer) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { headers: { 'User-Agent': UA, Referer: referer }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function score(item, artist, name) {
  const artists = (item.singer || []).map(singer => singer.name).join(' ');
  const title = item.songname || '';
  let value = 0;
  if (artist && artists.includes(artist)) value += 4;
  if (name && title.includes(name)) value += 3;
  if (name && title === name) value += 2;
  if (item.albummid) value += 1;
  return value;
}

async function qqPick(artist, name, query) {
  const data = await getJson(`https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${encodeURIComponent(query)}&format=json&n=8`, 'https://y.qq.com/');
  const list = data?.data?.song?.list || [];
  const best = list.map(item => ({ item, value: score(item, artist, name) })).sort((a, b) => b.value - a.value)[0];
  return best && best.value >= 3 && best.item.albummid
    ? `https://y.qq.com/music/photo_new/T002R300x300M000${best.item.albummid}.jpg`
    : '';
}

async function neteaseCover(artist, name) {
  const data = await getJson(`https://music.163.com/api/search/get/web?s=${encodeURIComponent(`${name} ${artist}`.trim())}&type=1&limit=6`, 'https://music.163.com/');
  const best = (data?.result?.songs || [])
    .map(item => ({ item, value: (item.artists || []).map(a => a.name).join(' ').includes(artist) ? 4 : 0 }))
    .sort((a, b) => b.value - a.value)[0];
  const id = best?.item?.id;
  if (!id) return '';
  const detail = await getJson(`https://music.163.com/api/song/detail?ids=[${id}]`, 'https://music.163.com/');
  const pic = detail?.songs?.[0]?.album?.picUrl;
  return pic ? String(pic).replace(/^http:/, 'https:') : '';
}

const cleanName = value => String(value)
  .replace(/[（(][^)）]*[)）]/g, ' ')
  .replace(/\[[^\]]*\]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const isCompilation = value => /合集|歌单|精选|打包|母带|无损|首[^0-9]|HIFI|车载/i.test(value);

async function fetchCover(artist, name) {
  const clean = cleanName(name);
  for (const query of [`${name} ${artist}`.trim(), name]) {
    try {
      const url = await qqPick(artist, name, query);
      if (url) return url;
    } catch {}
  }
  // 带括号后缀（Live / 现场版）的歌名，用清洗后的短名字再找一次
  if (clean && clean !== name && clean.length <= 28 && !isCompilation(clean)) {
    try {
      const url = await qqPick(artist, clean, clean);
      if (url) return url;
    } catch {}
  }
  try {
    return await neteaseCover(artist, name);
  } catch {
    return '';
  }
}

function resolve(artist, song) {
  if (!song) return Promise.resolve('');
  const key = keyOf(artist, song);
  const cached = store.get(key);
  if (cached) return Promise.resolve(cached);
  const running = inflight.get(key);
  if (running) return running;
  const task = (async () => {
    const url = await fetchCover(String(artist || ''), String(song));
    if (url) {
      store.set(key, url);
      scheduleSave();
    }
    return url;
  })().finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

// 首页要用的歌曲在后台串行补图，避免一次打太多上游请求
function warm(items) {
  const queue = [];
  const seen = new Set();
  for (const item of items || []) {
    const song = item && item.song;
    if (!song) continue;
    const key = keyOf(item.artist, song);
    if (store.has(key) || seen.has(key)) continue;
    seen.add(key);
    queue.push(item);
    if (queue.length >= 16) break;
  }
  if (!queue.length) return;
  (async () => {
    for (const item of queue) {
      await resolve(item.artist, item.song).catch(() => {});
    }
  })();
}

module.exports = { lookup, resolve, warm, proxyUrl, cleanName };
