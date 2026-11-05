// 抓取真实专辑封面：先查 QQ 音乐（稳定、无需登录）取专辑 mid，再回退到网易云；结果写入 data/covers.json
const fs = require('node:fs');
const path = require('node:path');
const { songs } = require('../src/store');

const OUTPUT = path.join(__dirname, '..', 'data', 'covers.json');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getJson(url, referer) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': UA, Referer: referer } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data && data.code && data.code !== 0 && data.code !== 200) throw new Error(`code ${data.code}`);
      return data;
    } catch (error) {
      if (attempt === 2) throw error;
      await sleep(900 * (attempt + 1));
    }
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

async function qqCover(song) {
  const name = String(song.song || song.title);
  const artist = String(song.artist || '');
  for (const query of [`${name} ${artist}`.trim(), name]) {
    const data = await getJson(`https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${encodeURIComponent(query)}&format=json&n=8`, 'https://y.qq.com/');
    const list = data?.data?.song?.list || [];
    if (!list.length) continue;
    const best = list.map(item => ({ item, value: score(item, artist, name) })).sort((a, b) => b.value - a.value)[0];
    if (best && best.value >= 3 && best.item.albummid) {
      return `https://y.qq.com/music/photo_new/T002R300x300M000${best.item.albummid}.jpg`;
    }
  }
  return '';
}

async function neteaseCover(song) {
  const name = String(song.song || song.title);
  const artist = String(song.artist || '');
  const data = await getJson(`https://music.163.com/api/search/get/web?s=${encodeURIComponent(`${name} ${artist}`.trim())}&type=1&limit=6`, 'https://music.163.com/');
  const list = data?.result?.songs || [];
  const best = list.map(item => ({
    item,
    value: (item.artists || []).map(a => a.name).join(' ').includes(artist) ? 4 : 0,
  })).sort((a, b) => b.value - a.value)[0];
  const id = best?.item?.id;
  if (!id) return '';
  const detail = await getJson(`https://music.163.com/api/song/detail?ids=[${id}]`, 'https://music.163.com/');
  const pic = detail?.songs?.[0]?.album?.picUrl;
  return pic ? String(pic).replace(/^http:/, 'https:') : '';
}

async function main() {
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(OUTPUT, 'utf8')); } catch {}
  const result = { ...existing };
  const targets = [...songs.values()];
  let done = 0;
  for (const song of targets) {
    done++;
    if (result[song.id]) continue;
    try {
      const cover = await qqCover(song);
      if (cover) result[song.id] = cover;
      else {
        const fallback = await neteaseCover(song).catch(() => '');
        if (fallback) result[song.id] = fallback;
      }
    } catch (error) {
      console.warn(`封面失败 ${song.title}: ${error.message}`);
    }
    if (done % 10 === 0) {
      console.log(`进度 ${done}/${targets.length}，已有 ${Object.keys(result).length} 首封面`);
      fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
    }
    await sleep(260);
  }

  // 第二轮：单曲标题经常带括号后缀（Live / cover / 现场版），用清洗后的歌名再查一次
  const clean = value => String(value)
    .replace(/[（(][^)）]*[)）]/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const isCompilation = value => /合集|歌单|精选|打包|母带|无损|首[^0-9]|HIFI|车载/i.test(value);
  for (const song of targets) {
    if (result[song.id]) continue;
    const name = String(song.song || song.title);
    if (isCompilation(name) || clean(name).length > 28) continue;
    try {
      const data = await getJson(`https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${encodeURIComponent(clean(name))}&format=json&n=5`, 'https://y.qq.com/');
      const list = data?.data?.song?.list || [];
      const hit = list.find(item => item.albummid && clean(item.songname || '').includes(clean(name)));
      if (hit) result[song.id] = `https://y.qq.com/music/photo_new/T002R300x300M000${hit.albummid}.jpg`;
    } catch (error) {
      console.warn(`二次封面失败 ${song.title}: ${error.message}`);
    }
    await sleep(400);
  }

  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`完成：${Object.keys(result).length}/${targets.length} 首封面 → ${OUTPUT}`);
}

main().catch(error => { console.error(error); process.exit(1); });
