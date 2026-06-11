'use strict';

const express = require('express');
const path    = require('path');
const https   = require('https');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ─── 60초 캐시 ─── */
const cache     = new Map();
const CACHE_TTL = 60 * 1000;

function getCache(k) {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { cache.delete(k); return null; }
  return e.data;
}
function setCache(k, d) { cache.set(k, { data: d, ts: Date.now() }); }

/* ─── HTTPS GET ─── */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 12000 }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(new Error('JSON 파싱 오류')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('요청 시간 초과')); });
  });
}

const USGS_BASE = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary';

function usgsUrl(period) {
  const valid = { hour: 1, day: 1, week: 1 };
  return `${USGS_BASE}/all_${valid[period] ? period : 'day'}.geojson`;
}

function featureToEq(f) {
  const p      = f.properties || {};
  const coords = (f.geometry && Array.isArray(f.geometry.coordinates))
    ? f.geometry.coordinates : [0, 0, 0];
  return {
    id:        String(f.id || ''),
    time:      typeof p.time  === 'number' ? p.time  : null,
    lat:       typeof coords[1] === 'number' ? coords[1] : 0,
    lng:       typeof coords[0] === 'number' ? coords[0] : 0,
    depth:     typeof coords[2] === 'number' ? coords[2] : 0,
    magnitude: typeof p.mag  === 'number' ? p.mag  : null,
    place:     p.place  || '',
    title:     p.title  || '',
    url:       p.url    || '',
  };
}

/* ─── 노-캐시 헤더 ─── */
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

/* ─── GET /api/earthquakes ─── */
app.get('/api/earthquakes', async (req, res) => {
  const period = String(req.query.period || 'day').toLowerCase();
  const minmag = parseFloat(req.query.minmag) || 0;
  const cacheKey = `eq_${period}`;

  try {
    let all = getCache(cacheKey);
    if (!all) {
      const json = await httpGet(usgsUrl(period));
      if (!Array.isArray(json.features)) throw new Error('USGS 응답 구조 오류');
      all = json.features
        .filter(f => f.geometry && f.properties && f.properties.mag !== undefined)
        .map(featureToEq);
      setCache(cacheKey, all);
    }
    const earthquakes = minmag > 0
      ? all.filter(e => (e.magnitude != null ? e.magnitude : -Infinity) >= minmag)
      : all;
    res.json({ ok: true, count: earthquakes.length, earthquakes });
  } catch (err) {
    console.error('[/api/earthquakes]', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

/* ─── GET /api/earthquakes/significant ─── */
app.get('/api/earthquakes/significant', async (req, res) => {
  const cacheKey = 'eq_significant';
  try {
    let all = getCache(cacheKey);
    if (!all) {
      const json = await httpGet(`${USGS_BASE}/4.5_month.geojson`);
      if (!Array.isArray(json.features)) throw new Error('USGS 응답 구조 오류');
      all = json.features
        .filter(f => f.geometry && f.properties && (f.properties.mag ?? 0) >= 4.5)
        .map(featureToEq);
      setCache(cacheKey, all);
    }
    res.json({ ok: true, count: all.length, earthquakes: all });
  } catch (err) {
    console.error('[/api/earthquakes/significant]', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

/* ─── Health ─── */
app.get('/health', (req, res) => res.json({ status: 'ok', port: PORT }));

/* ─── 정적 파일 ─── */
app.use(express.static(path.join(__dirname, 'public')));

/* ─── SPA 폴백 ─── */
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ─── 에러 핸들러 ─── */
app.use((err, req, res, _n) => {
  console.error('[오류]', err.message);
  res.status(500).json({ ok: false, error: '서버 내부 오류' });
});

app.listen(PORT, () => console.log(`지진 데이터 서버: http://localhost:${PORT}`));
module.exports = app;
