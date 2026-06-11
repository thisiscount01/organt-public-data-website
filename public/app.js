'use strict';
/* ═══════════════════════════════════════════════════════════
 *  EarthQuakeViz — app.js
 *  USGS 실시간 지진 데이터 Canvas 시각화 엔진
 * ═══════════════════════════════════════════════════════════ */

/* ── 규모별 설정 (6단계) ── */
const MAG_CONFIG = [
  { level:0, min:0,   max:2,        label:'M < 2', color:'#00E5FF', coreR:2,  maxRipR:14, rings:1, rspd:0.30, pCount:0  },
  { level:1, min:2,   max:3,        label:'M 2-3', color:'#76FF03', coreR:4,  maxRipR:22, rings:2, rspd:0.40, pCount:0  },
  { level:2, min:3,   max:5,        label:'M 3-5', color:'#FFD600', coreR:7,  maxRipR:34, rings:2, rspd:0.55, pCount:5  },
  { level:3, min:5,   max:6,        label:'M 5-6', color:'#FF6D00', coreR:12, maxRipR:52, rings:3, rspd:0.68, pCount:10 },
  { level:4, min:6,   max:7,        label:'M 6-7', color:'#FF1744', coreR:18, maxRipR:75, rings:4, rspd:0.82, pCount:16 },
  { level:5, min:7,   max:Infinity, label:'M 7+',  color:'#D500F9', coreR:26, maxRipR:110,rings:5, rspd:1.00, pCount:28 },
];

/* ── State ── */
let W = 0, H = 0, dpr = 1;
let worldData    = null;
let offCanvas    = null;
let earthquakes  = [];
let effects      = [];
let positions    = [];
let glowSprites  = [];
let hoveredIdx   = -1;
let selectedIdx  = -1;
let currentPeriod = 'day';
let degradeLevel  = 0;

/* ── FPS ── */
let lastTime = 0, rafId = null;
let fpsFrames = 0, fpsAccum = 0, currentFps = 60;

/* ── DOM ── */
const canvas    = document.getElementById('eq-canvas');
const ctx       = canvas.getContext('2d', { alpha: false });
const tooltip   = document.getElementById('eq-tooltip');
const dpPanel   = document.getElementById('detail-panel');
const dpContent = document.getElementById('dp-content');
const loadingEl = document.getElementById('loading-overlay');

/* ════════════════════════════════════════════════════════════
 *  유틸
 * ════════════════════════════════════════════════════════════ */
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function getMagConfig(mag) {
  const m = (typeof mag === 'number' && isFinite(mag)) ? mag : 0;
  for (let i = MAG_CONFIG.length - 1; i >= 0; i--) {
    if (m >= MAG_CONFIG[i].min) return MAG_CONFIG[i];
  }
  return MAG_CONFIG[0];
}

function hexRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

/* ════════════════════════════════════════════════════════════
 *  프로젝션 (Equirectangular)
 * ════════════════════════════════════════════════════════════ */
function project(lng, lat) {
  return [((lng + 180) / 360) * W, ((90 - lat) / 180) * H];
}

/* ════════════════════════════════════════════════════════════
 *  글로우 스프라이트 (pre-rendered, 프레임마다 radialGradient 재생성 방지)
 * ════════════════════════════════════════════════════════════ */
function buildGlowSprites() {
  glowSprites = MAG_CONFIG.map(cfg => {
    const r = cfg.maxRipR * 0.9;
    const oc = document.createElement('canvas');
    oc.width = oc.height = Math.round(r * 2 * dpr);
    const oc2 = oc.getContext('2d');
    oc2.scale(dpr, dpr);
    const [cr, cg, cb] = hexRgb(cfg.color);
    const grd = oc2.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0,    `rgba(${cr},${cg},${cb},0.75)`);
    grd.addColorStop(0.3,  `rgba(${cr},${cg},${cb},0.38)`);
    grd.addColorStop(0.65, `rgba(${cr},${cg},${cb},0.12)`);
    grd.addColorStop(1,    `rgba(${cr},${cg},${cb},0)`);
    oc2.fillStyle = grd;
    oc2.fillRect(0, 0, r * 2, r * 2);
    return { canvas: oc, r };
  });
}

/* ════════════════════════════════════════════════════════════
 *  세계지도 오프스크린 렌더
 * ════════════════════════════════════════════════════════════ */
function buildOffscreenCanvas() {
  offCanvas = document.createElement('canvas');
  offCanvas.width  = Math.round(W * dpr);
  offCanvas.height = Math.round(H * dpr);
  const oc = offCanvas.getContext('2d');
  oc.scale(dpr, dpr);

  /* 심우주 배경 */
  const bgGrd = oc.createLinearGradient(0, 0, 0, H);
  bgGrd.addColorStop(0, '#030810');
  bgGrd.addColorStop(1, '#05101E');
  oc.fillStyle = bgGrd;
  oc.fillRect(0, 0, W, H);

  drawGraticules(oc);

  if (!worldData) return;

  /* 육지 채우기 */
  oc.fillStyle = '#0C1D33';
  if (worldData.land) {
    oc.beginPath();
    drawGeoObject(oc, worldData.land);
    oc.fill();
  } else {
    worldData.countries.features.forEach(f => {
      oc.beginPath();
      drawGeometry(oc, f.geometry);
      oc.fill();
    });
  }

  /* 국가 내부 경계선 */
  if (worldData.borders) {
    oc.strokeStyle = '#183050';
    oc.lineWidth = 0.4;
    oc.beginPath();
    drawGeometry(oc, worldData.borders);
    oc.stroke();
  }

  /* 해안선 하이라이트 */
  if (worldData.land) {
    oc.strokeStyle = '#1A3C60';
    oc.lineWidth = 0.7;
    oc.beginPath();
    drawGeoObject(oc, worldData.land);
    oc.stroke();
  }
}

function drawGraticules(oc) {
  oc.save();
  /* 위경도 격자 */
  oc.strokeStyle = 'rgba(15,40,70,0.55)';
  oc.lineWidth = 0.5;
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, y] = project(0, lat);
    oc.beginPath(); oc.moveTo(0, y); oc.lineTo(W, y); oc.stroke();
  }
  for (let lng = -120; lng <= 120; lng += 60) {
    const [x] = project(lng, 0);
    oc.beginPath(); oc.moveTo(x, 0); oc.lineTo(x, H); oc.stroke();
  }
  /* 적도 점선 */
  const [, eqY] = project(0, 0);
  oc.strokeStyle = 'rgba(20,55,95,0.8)';
  oc.lineWidth = 0.7;
  oc.setLineDash([4, 7]);
  oc.beginPath(); oc.moveTo(0, eqY); oc.lineTo(W, eqY); oc.stroke();
  oc.setLineDash([]);
  oc.restore();
}

function drawGeoObject(ctx, obj) {
  if (!obj) return;
  if (obj.type === 'FeatureCollection') {
    obj.features.forEach(f => drawGeometry(ctx, f.geometry));
  } else if (obj.type === 'Feature') {
    drawGeometry(ctx, obj.geometry);
  } else {
    drawGeometry(ctx, obj);
  }
}

function drawGeometry(ctx, geom) {
  if (!geom) return;
  switch (geom.type) {
    case 'Polygon':         drawRings(ctx, geom.coordinates); break;
    case 'MultiPolygon':    geom.coordinates.forEach(p => drawRings(ctx, p)); break;
    case 'LineString':      drawLineString(ctx, geom.coordinates); break;
    case 'MultiLineString': geom.coordinates.forEach(l => drawLineString(ctx, l)); break;
    case 'GeometryCollection': geom.geometries.forEach(g => drawGeometry(ctx, g)); break;
  }
}

function drawRings(ctx, rings) {
  rings.forEach(ring => {
    let first = true;
    ring.forEach(([lng, lat]) => {
      const [x, y] = project(lng, lat);
      first ? (ctx.moveTo(x, y), first = false) : ctx.lineTo(x, y);
    });
    ctx.closePath();
  });
}

function drawLineString(ctx, coords) {
  let first = true;
  coords.forEach(([lng, lat]) => {
    const [x, y] = project(lng, lat);
    first ? (ctx.moveTo(x, y), first = false) : ctx.lineTo(x, y);
  });
}

/* ════════════════════════════════════════════════════════════
 *  이펙트 생성
 * ════════════════════════════════════════════════════════════ */
function createEffect(eq) {
  const cfg = getMagConfig(eq.magnitude);
  const pTarget = degradeLevel >= 2 ? 0
    : degradeLevel === 1 ? Math.ceil(cfg.pCount / 2)
    : cfg.pCount;

  const particles = [];
  for (let i = 0; i < pTarget; i++) {
    const baseAngle = (i / Math.max(1, cfg.pCount)) * Math.PI * 2;
    particles.push({
      angle:   baseAngle + (Math.random() - 0.5) * 0.8,
      dist:    Math.random() * cfg.maxRipR * 0.25,
      maxDist: cfg.maxRipR * (0.45 + Math.random() * 0.7),
      speed:   12 + Math.random() * 20,
      size:    0.7 + Math.random() * (cfg.level >= 3 ? 2.2 : 1.3),
      alpha:   Math.random(),
    });
  }

  return { phase: Math.random(), rspd: cfg.rspd, cfg, particles };
}

function initAllEffects() {
  effects = earthquakes.map(eq => createEffect(eq));
}

function computePositions() {
  positions = earthquakes.map(eq => {
    const [x, y] = project(eq.lng, eq.lat);
    return { x, y };
  });
}

/* ════════════════════════════════════════════════════════════
 *  프레임 업데이트
 * ════════════════════════════════════════════════════════════ */
function updateEffects(dt) {
  const sec = dt / 1000;
  for (let i = 0; i < effects.length; i++) {
    const eff = effects[i];
    eff.phase = (eff.phase + eff.rspd * sec) % 1;
    for (const p of eff.particles) {
      p.dist += p.speed * sec;
      if (p.dist >= p.maxDist) { p.dist = 0; p.alpha = 1; }
      else p.alpha = 1 - p.dist / p.maxDist;
    }
  }
}

/* ════════════════════════════════════════════════════════════
 *  메인 드로우
 * ════════════════════════════════════════════════════════════ */
function draw() {
  /* 1. 세계지도 배경 */
  if (offCanvas) {
    ctx.drawImage(offCanvas, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#030810';
    ctx.fillRect(0, 0, W, H);
  }

  const N = earthquakes.length;

  /* 2. 파동 링 (ripple rings) */
  for (let i = 0; i < N; i++) {
    const eff = effects[i];
    const pos = positions[i];
    if (!eff || !pos) continue;
    const { x, y } = pos;
    const cfg = eff.cfg;
    const isHov = i === hoveredIdx;
    const numRings = degradeLevel >= 1 ? Math.max(1, Math.ceil(cfg.rings / 2)) : cfg.rings;
    const baseA = isHov ? 0.9 : 0.6;
    const [cr, cg, cb] = hexRgb(cfg.color);

    for (let ri = 0; ri < numRings; ri++) {
      const phase  = (eff.phase + ri / cfg.rings) % 1;
      const radius = phase * cfg.maxRipR;
      if (radius < 0.8) continue;
      const alpha = (1 - phase) * baseA;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha.toFixed(3)})`;
      ctx.lineWidth   = Math.max(0.3, 1.8 - phase * 1.4);
      ctx.stroke();
    }
  }

  /* 3. 파티클 (M3+, degradeLevel < 2) */
  if (degradeLevel < 2) {
    for (let i = 0; i < N; i++) {
      const eff = effects[i];
      const pos = positions[i];
      if (!eff || !pos || eff.cfg.level < 2 || !eff.particles.length) continue;
      const { x, y } = pos;
      const [cr, cg, cb] = hexRgb(eff.cfg.color);
      const mult = i === hoveredIdx ? 1.0 : 0.78;

      ctx.save();
      for (const p of eff.particles) {
        if (p.alpha < 0.03) continue;
        const px = x + Math.cos(p.angle) * p.dist;
        const py = y + Math.sin(p.angle) * p.dist;
        ctx.globalAlpha = p.alpha * mult;
        ctx.fillStyle = `rgba(${cr},${cg},${cb},1)`;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* 4. 글로우 스프라이트 (degradeLevel < 2) */
  if (degradeLevel < 2) {
    for (let i = 0; i < N; i++) {
      const eff = effects[i];
      const pos = positions[i];
      if (!eff || !pos || eff.cfg.level < 1) continue;
      const sprite = glowSprites[eff.cfg.level];
      if (!sprite) continue;
      const { x, y } = pos;
      const sr = sprite.r;
      const sc = i === hoveredIdx ? 1.3 : 1.0;
      ctx.globalAlpha = i === hoveredIdx ? 0.9 : 0.55;
      ctx.drawImage(sprite.canvas, x - sr * sc, y - sr * sc, sr * 2 * sc, sr * 2 * sc);
    }
    ctx.globalAlpha = 1;
  }

  /* 5. 코어 도트 */
  for (let i = 0; i < N; i++) {
    const eff = effects[i];
    const pos = positions[i];
    if (!eff || !pos) continue;
    const cfg  = eff.cfg;
    const { x, y } = pos;
    const isHov = i === hoveredIdx;
    const isSel = i === selectedIdx;
    const cR   = isHov ? cfg.coreR * 1.35 : cfg.coreR;
    const [cr, cg, cb] = hexRgb(cfg.color);

    /* 코어 */
    ctx.beginPath();
    ctx.arc(x, y, cR, 0, Math.PI * 2);
    ctx.fillStyle = cfg.color;
    ctx.fill();

    /* 내부 하이라이트 */
    ctx.beginPath();
    ctx.arc(x, y, cR * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = isHov ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.68)';
    ctx.fill();

    /* 선택 링 */
    if (isSel) {
      ctx.beginPath();
      ctx.arc(x, y, cR + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, cR + 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.45)`;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  }
}

/* ════════════════════════════════════════════════════════════
 *  메인 루프
 * ════════════════════════════════════════════════════════════ */
function loop(now) {
  const dt = Math.min(now - lastTime, 50);
  lastTime = now;

  fpsAccum  += dt;
  fpsFrames ++;
  if (fpsAccum >= 1000) {
    currentFps = Math.round(fpsFrames * 1000 / fpsAccum);
    fpsFrames = fpsAccum = 0;
    updateFpsBadge();
    adjustDegradeLevel();
  }

  updateEffects(dt);
  draw();
  rafId = requestAnimationFrame(loop);
}

function startLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  lastTime = performance.now();
  rafId = requestAnimationFrame(loop);
}

function adjustDegradeLevel() {
  if (currentFps < 20) {
    degradeLevel = 2;
  } else if (currentFps < 35) {
    degradeLevel = Math.max(degradeLevel, 1);
  } else if (currentFps >= 50 && degradeLevel > 0) {
    degradeLevel = Math.max(0, degradeLevel - 1);
    initAllEffects(); // 파티클 복원
  }
}

/* ════════════════════════════════════════════════════════════
 *  HUD
 * ════════════════════════════════════════════════════════════ */
function updateFpsBadge() {
  const el = document.getElementById('fps-badge');
  if (!el) return;
  el.textContent = currentFps + ' FPS';
  el.className = 'logo-badge' + (currentFps < 25 ? ' fps-low' : currentFps < 45 ? ' fps-mid' : '');
}

function updateStats() {
  const total = earthquakes.length;
  const m5 = earthquakes.filter(e => (e.magnitude ?? 0) >= 5).length;
  const m7 = earthquakes.filter(e => (e.magnitude ?? 0) >= 7).length;
  const upd = new Date().toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' });
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('val-total',   total.toLocaleString());
  s('val-m5',      m5.toLocaleString());
  s('val-m7',      m7.toLocaleString());
  s('val-updated', upd);
}

/* ════════════════════════════════════════════════════════════
 *  범례
 * ════════════════════════════════════════════════════════════ */
function buildLegend() {
  const el = document.getElementById('legend-items');
  if (!el) return;
  el.innerHTML = [...MAG_CONFIG].reverse().map(cfg => {
    const sz = 6 + cfg.level * 2;
    return `<div class="legend-item">
      <span class="legend-dot" style="width:${sz}px;height:${sz}px;background:${cfg.color};box-shadow:0 0 7px ${cfg.color}AA"></span>
      <span class="legend-label">${cfg.label}</span>
    </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════════
 *  인터랙션
 * ════════════════════════════════════════════════════════════ */
function getXY(e) {
  const rect = canvas.getBoundingClientRect();
  const src  = e.touches ? e.touches[0] : e;
  return [src.clientX - rect.left, src.clientY - rect.top];
}

function detectEqAt(mx, my) {
  let bestIdx = -1, bestDist = Infinity;
  for (let i = 0; i < positions.length; i++) {
    const { x, y } = positions[i];
    const dx = mx - x, dy = my - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hitR = Math.max((effects[i]?.cfg || MAG_CONFIG[0]).coreR * 2 + 4, 12);
    if (dist < hitR && dist < bestDist) { bestIdx = i; bestDist = dist; }
  }
  return bestIdx;
}

function onMouseMove(e) {
  const [mx, my] = getXY(e);
  const idx = detectEqAt(mx, my);

  if (idx !== hoveredIdx) {
    hoveredIdx = idx;
    canvas.style.cursor = idx >= 0 ? 'pointer' : 'default';
  }

  if (idx >= 0) {
    const eq  = earthquakes[idx];
    const cfg = effects[idx]?.cfg || getMagConfig(eq.magnitude);
    const mag = eq.magnitude != null ? eq.magnitude.toFixed(1) : '--';
    tooltip.innerHTML = `<span class="tt-mag" style="color:${cfg.color}">M ${esc(mag)}</span><span class="tt-place">${esc((eq.place || '').slice(0, 60))}</span>`;
    tooltip.style.left = e.clientX + 'px';
    tooltip.style.top  = e.clientY + 'px';
    tooltip.classList.add('visible');
  } else {
    tooltip.classList.remove('visible');
  }
}

function onMouseClick(e) {
  const [mx, my] = getXY(e);
  const idx = detectEqAt(mx, my);
  if (idx >= 0) {
    selectedIdx = idx;
    showDetail(earthquakes[idx], effects[idx]);
  } else if (dpPanel.classList.contains('visible')) {
    selectedIdx = -1;
    hideDetail();
  }
}

function onMouseLeave() {
  hoveredIdx = -1;
  canvas.style.cursor = 'default';
  tooltip.classList.remove('visible');
}

/* ════════════════════════════════════════════════════════════
 *  상세 패널
 * ════════════════════════════════════════════════════════════ */
function fmtTime(ts) {
  if (!ts) return '--';
  try {
    return new Date(ts).toLocaleString('ko-KR', {
      year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit', timeZone:'UTC',
    });
  } catch(_) { return String(ts); }
}

function fmtCoord(deg, posC, negC) {
  if (deg == null || !isFinite(deg)) return '--';
  return Math.abs(deg).toFixed(3) + '°' + (deg >= 0 ? posC : negC);
}

function showDetail(eq, eff) {
  const cfg   = eff?.cfg || getMagConfig(eq.magnitude);
  const mag   = eq.magnitude != null ? eq.magnitude.toFixed(1) : '--';
  const depth = eq.depth    != null ? eq.depth.toFixed(1)     : '--';
  const lat   = fmtCoord(eq.lat, 'N', 'S');
  const lng   = fmtCoord(eq.lng, 'E', 'W');
  const time  = fmtTime(eq.time);
  const clr   = cfg.color;

  dpContent.innerHTML = `
    <div class="dp-mag-wrap">
      <span class="dp-mag" style="color:${esc(clr)}">M ${esc(mag)}</span>
      <span class="dp-level-badge" style="background:${esc(clr)}22;color:${esc(clr)};border-color:${esc(clr)}55">${esc(cfg.label)}</span>
    </div>
    <h2 class="dp-place">${esc(eq.place || '위치 정보 없음')}</h2>
    <p class="dp-time">${esc(time)} UTC</p>
    <div class="dp-divider"></div>
    <div class="dp-grid">
      <div class="dp-stat">
        <span class="dp-stat-lbl">규모</span>
        <span class="dp-stat-val" style="color:${esc(clr)}">M ${esc(mag)}</span>
      </div>
      <div class="dp-stat">
        <span class="dp-stat-lbl">진원 깊이</span>
        <span class="dp-stat-val">${esc(depth)}<span class="dp-stat-unit"> km</span></span>
      </div>
      <div class="dp-stat">
        <span class="dp-stat-lbl">위도</span>
        <span class="dp-stat-val">${esc(lat)}</span>
      </div>
      <div class="dp-stat">
        <span class="dp-stat-lbl">경도</span>
        <span class="dp-stat-val">${esc(lng)}</span>
      </div>
    </div>
    <div class="dp-detail-row">
      <div class="dp-detail-item">
        <span class="dp-detail-key">발생 시각 (UTC)</span>
        <span class="dp-detail-val">${esc(time)}</span>
      </div>
      <div class="dp-detail-item">
        <span class="dp-detail-key">지진 ID</span>
        <span class="dp-detail-val">${esc(eq.id || '--')}</span>
      </div>
    </div>
    ${eq.url ? `<a class="dp-link" href="${esc(eq.url)}" target="_blank" rel="noopener noreferrer">USGS 상세 정보 보기 →</a>` : ''}
  `;

  dpPanel.classList.add('visible');
  dpPanel.setAttribute('aria-hidden', 'false');
}

function hideDetail() {
  dpPanel.classList.remove('visible');
  dpPanel.setAttribute('aria-hidden', 'true');
}

/* ════════════════════════════════════════════════════════════
 *  세계지도 로드 (TopoJSON CDN)
 * ════════════════════════════════════════════════════════════ */
async function loadWorldMap() {
  if (typeof topojson === 'undefined') {
    console.warn('[EQViz] topojson 미로드 — 격자선만 표시');
    buildOffscreenCanvas();
    return;
  }
  try {
    const res  = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
    const topo = await res.json();
    worldData = {
      land:      topo.objects.land ? topojson.feature(topo, topo.objects.land) : null,
      countries: topojson.feature(topo, topo.objects.countries),
      borders:   topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b),
    };
  } catch (e) {
    console.warn('[EQViz] 세계지도 로드 실패:', e.message);
  }
  buildOffscreenCanvas();
}

/* ════════════════════════════════════════════════════════════
 *  지진 데이터 로드
 * ════════════════════════════════════════════════════════════ */
const MAX_DISPLAY = 700;

async function loadAndDisplay(period) {
  showLoading();
  try {
    const url = period === 'significant'
      ? '/api/earthquakes/significant'
      : `/api/earthquakes?period=${encodeURIComponent(period)}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'API 오류');

    /* 유효 좌표만, 규모 오름차순 (작은 것 먼저 → 큰 것이 위에 렌더링) */
    const all = (data.earthquakes || [])
      .filter(e => e.lat != null && e.lng != null && isFinite(e.lat) && isFinite(e.lng))
      .sort((a, b) => (a.magnitude ?? 0) - (b.magnitude ?? 0));

    /* 성능 캡: M4+ 전부 + 나머지 최신 순 */
    const big   = all.filter(e => (e.magnitude ?? 0) >= 4);
    const small = all.filter(e => (e.magnitude ?? 0) <  4);
    earthquakes = [...small.slice(-(MAX_DISPLAY - big.length)), ...big];

    computePositions();
    initAllEffects();
    updateStats();
    hideLoading();
  } catch (err) {
    console.error('[EQViz] 로드 실패:', err.message);
    hideLoading();
  }
}

function showLoading() { loadingEl?.classList.add('visible'); }
function hideLoading() { loadingEl?.classList.remove('visible'); }

/* ════════════════════════════════════════════════════════════
 *  리사이즈
 * ════════════════════════════════════════════════════════════ */
function onResize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width  = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  computePositions();
  buildOffscreenCanvas();
  buildGlowSprites();
}

/* ════════════════════════════════════════════════════════════
 *  컨트롤 설정
 * ════════════════════════════════════════════════════════════ */
function setupControls() {
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.period;
      if (p === currentPeriod) return;
      currentPeriod = p;
      document.querySelectorAll('.period-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      selectedIdx = -1;
      hideDetail();
      loadAndDisplay(p);
    });
  });

  document.getElementById('dp-close')?.addEventListener('click', () => {
    selectedIdx = -1;
    hideDetail();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { selectedIdx = -1; hideDetail(); }
  });
}

/* ════════════════════════════════════════════════════════════
 *  초기화
 * ════════════════════════════════════════════════════════════ */
async function init() {
  onResize();
  buildGlowSprites();
  buildLegend();
  setupControls();

  canvas.addEventListener('mousemove',  onMouseMove);
  canvas.addEventListener('click',      onMouseClick);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); onMouseClick(e); }, { passive: false });
  window.addEventListener('resize', debounce(onResize, 160));

  startLoop();

  await Promise.all([
    loadWorldMap(),
    loadAndDisplay(currentPeriod),
  ]);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
