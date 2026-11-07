// 歌词抓取：优先 QQ 音乐（逐句时间轴完整、命中率高），失败再回退网易云；
// 结果按「歌手|歌名」缓存到内存与本地文件，同一首歌只向上游请求一次。
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', 'data', 'live-lyrics.json');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const MAX_LENGTH = 32 * 1024;

const store = new Map();
const inflight = new Map();
let saveTimer = null;

try {
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value) store.set(key, value.slice(0, MAX_LENGTH));
  }
} catch {}

function keyOf(artist, song) {
  return `${String(artist || '').trim().toLowerCase()}|${String(song || '').trim().toLowerCase()}`.slice(0, 180);
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

async function request(url, referer, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: { 'User-Agent': UA, Referer: referer, ...(options.headers || {}) },
      body: options.body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url, referer, options) {
  return JSON.parse(await request(url, referer, options));
}

const cleanName = value => String(value)
  .replace(/[（(][^)）]*[)）]/g, ' ')
  .replace(/\[[^\]]*\]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();
// 翻唱、改编、伴奏、现场版等版本命中后降权，优先原曲
const VERSION_WORDS = /(翻唱|cover|治愈版|钢琴版|吉他版|demo|伴奏|dj|remix|环绕|合唱|童声|纯音乐|type beat|live|现场|改编|版)/i;

function score(title, artists, artist, song) {
  const cleanTitle = cleanName(title);
  const cleanSong = cleanName(song);
  let value = 0;
  if (cleanSong && cleanTitle === cleanSong) value += 6;
  else if (cleanSong && cleanTitle.includes(cleanSong)) value += 3;
  else if (cleanSong && cleanSong.includes(cleanTitle)) value += 2;
  if (artist && artists.includes(artist)) value += 5;
  if (VERSION_WORDS.test(title)) value -= 5;
  return value;
}

async function qqSearch(artist, song) {
  const query = `${song} ${artist}`.trim();
  const data = await getJson(`https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${encodeURIComponent(query)}&format=json&n=10`, 'https://y.qq.com/');
  const list = data?.data?.song?.list || [];
  return list
    .map(item => ({ mid: item.songmid, value: score(item.songname || '', (item.singer || []).map(s => s.name).join(' '), artist, song) }))
    .filter(item => item.mid && item.value >= 4)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
}

async function qqLyric(file) {
  const data = await getJson(`https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${encodeURIComponent(file.mid)}&format=json&nobase64=1`, 'https://y.qq.com/');
  const lyric = String(data?.lyric || '').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").trim();
  return lyric.length > 8 ? lyric : '';
}

async function neteaseSearch(artist, song) {
  const body = `s=${encodeURIComponent(`${song} ${artist}`.trim())}&type=1&limit=10&offset=0`;
  const data = await getJson('https://music.163.com/api/cloudsearch/pc', 'https://music.163.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const list = data?.result?.songs || [];
  return list
    .map(item => ({ id: item.id, value: score(item.name || '', (item.ar || item.artists || []).map(a => a.name).join(' '), artist, song) }))
    .filter(item => item.id && item.value >= 4)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
}

async function neteaseLyric(item) {
  const data = await getJson(`https://music.163.com/api/song/lyric?id=${encodeURIComponent(item.id)}&lv=-1&kv=-1&tv=-1`, 'https://music.163.com/');
  const lyric = String(data?.lrc?.lyric || '').trim();
  // 纯音乐提示不是有效歌词
  if (!lyric || /纯音乐，请欣赏/.test(lyric)) return '';
  return lyric;
}

async function fetchLyric(artist, song) {
  try {
    for (const candidate of await qqSearch(artist, song)) {
      const lyric = await qqLyric(candidate).catch(() => '');
      if (lyric) return lyric;
    }
  } catch {}
  try {
    for (const candidate of await neteaseSearch(artist, song)) {
      const lyric = await neteaseLyric(candidate).catch(() => '');
      if (lyric) return lyric;
    }
  } catch {}
  return '';
}

function resolve(artist, song) {
  if (!song) return Promise.resolve('');
  const key = keyOf(artist, song);
  const cached = store.get(key);
  if (cached) return Promise.resolve(cached);
  const running = inflight.get(key);
  if (running) return running;
  const task = (async () => {
    const lyric = (await fetchLyric(String(artist || ''), String(song))).slice(0, MAX_LENGTH);
    if (lyric) {
      store.set(key, lyric);
      scheduleSave();
    }
    return lyric;
  })().finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

module.exports = { resolve };
