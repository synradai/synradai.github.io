/* SwingTrack — all data stays on-device (IndexedDB + localStorage).
   Only network call: Open Food Facts barcode lookups (cached for offline). */

'use strict';

const $ = (id) => document.getElementById(id);

/* ---------------- constants ---------------- */

const METRIC = {
  water: '#3987e5',
  food: '#c98500',
  move: '#e66767',
  steps: '#008300',
  sleep: '#9085e9',
};

const ALLERGENS = [
  { id: 'gluten', label: 'Gluten', tags: ['en:gluten'] },
  { id: 'milk', label: 'Dairy / lactose', tags: ['en:milk'] },
  { id: 'nuts', label: 'Tree nuts', tags: ['en:nuts'] },
  { id: 'peanuts', label: 'Peanuts', tags: ['en:peanuts'] },
  { id: 'eggs', label: 'Eggs', tags: ['en:eggs'] },
  { id: 'soy', label: 'Soy', tags: ['en:soybeans'] },
  { id: 'fish', label: 'Fish', tags: ['en:fish'] },
  { id: 'shellfish', label: 'Shellfish', tags: ['en:crustaceans', 'en:molluscs'] },
  { id: 'sesame', label: 'Sesame', tags: ['en:sesame-seeds'] },
];

const MEAL_TYPES = ['Breakfast', 'Crib', 'Dinner', 'Snack'];

const DEFAULTS = {
  swingStart: null, // set at first run
  swingLen: 20,
  startWeight: 100,
  goalWeight: null,
  kcalBudget: 2200,
  waterTarget: 3000,
  stepTarget: 10000,
  sleepTarget: 7.5,
  allergens: [],
  customAllergens: '',
};

/* ---------------- state ---------------- */

let db = null;
let settings = null;
let activeDate = null;
let cachedToday = null;
let trendRange = 'swing';
let pendingPhoto = null;
let exType = 'Gym';
let sleepQuality = 0;
let scan = { stream: null, reader: null, timer: null, active: false };
const mealURLs = new Map();

/* ---------------- date helpers ---------------- */

function ds(d) {
  const y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}
const todayDs = () => ds(new Date());
const parseDs = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDs(s); d.setDate(d.getDate() + n); return ds(d); };
const diffDays = (a, b) => Math.round((parseDs(b) - parseDs(a)) / 86400000);
const human = (s) => parseDs(s).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
const shortDate = (s) => { const d = parseDs(s); return `${d.getDate()}/${d.getMonth() + 1}`; };
const nowTime = () => new Date().toTimeString().slice(0, 5);

/* ---------------- formatting ---------------- */

const nfmt = (n) => Math.round(n).toLocaleString('en-AU');
const fmtL = (ml) => `${Math.round(ml / 10) / 100} L`;
const fmtH = (v) => `${Math.round(v * 10) / 10} h`;
const fmtKg = (v) => `${Math.round(v * 10) / 10} kg`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function hexLerp(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/* ---------------- IndexedDB ---------------- */

function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('swingtrack', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('days', { keyPath: 'date' });
      const m = d.createObjectStore('meals', { keyPath: 'id' });
      m.createIndex('date', 'date');
      d.createObjectStore('products', { keyPath: 'code' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const store = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name);
const req = (q) => new Promise((res, rej) => { q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
const dbGet = (s, k) => req(store(s).get(k));
const dbPut = (s, v) => req(store(s, 'readwrite').put(v));
const dbDel = (s, k) => req(store(s, 'readwrite').delete(k));
const dbAll = (s) => req(store(s).getAll());
const dbClear = (s) => req(store(s, 'readwrite').clear());
const mealsFor = (date) => req(store('meals').index('date').getAll(IDBKeyRange.only(date)));

async function getDay(date) {
  const d = (await dbGet('days', date)) || {};
  return { date, water: 0, steps: null, weight: null, sleep: null, exercises: [], ...d };
}

/* ---------------- settings ---------------- */

function loadSettings() {
  try {
    const raw = localStorage.getItem('swingtrack-settings');
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) { /* fall through */ }
  return null;
}
function saveSettings() {
  localStorage.setItem('swingtrack-settings', JSON.stringify(settings));
}

/* ---------------- sheets & toast ---------------- */

function openSheet(id) {
  $('backdrop').classList.add('open');
  $(id).classList.add('open');
}
function closeSheets() {
  stopScan();
  $('backdrop').classList.remove('open');
  document.querySelectorAll('.sheet.open').forEach((s) => s.classList.remove('open'));
}
let toastTimer = null;
function showToast(msg, ms = 1900) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/* ---------------- pager & tabs ---------------- */

function gotoPanel(i) {
  const p = $('pager');
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  p.scrollTo({ left: i * p.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
}
function bindPager() {
  const p = $('pager');
  const tabs = [...document.querySelectorAll('#tabbar button')];
  tabs.forEach((b) => b.addEventListener('click', () => gotoPanel(+b.dataset.i)));
  let st = null;
  p.addEventListener('scroll', () => {
    clearTimeout(st);
    st = setTimeout(() => {
      const i = Math.round(p.scrollLeft / p.clientWidth);
      tabs.forEach((b) => b.classList.toggle('on', +b.dataset.i === i));
    }, 60);
  }, { passive: true });
}

/* ---------------- swing helpers ---------------- */

const swingDay = (date) => diffDays(settings.swingStart, date) + 1;
const inSwing = (date) => { const n = swingDay(date); return n >= 1 && n <= settings.swingLen; };

/* ================= RENDERING ================= */

async function renderAll() {
  renderTopbar();
  renderStrip();
  const [day, meals] = await Promise.all([getDay(activeDate), mealsFor(activeDate)]);
  const kcal = meals.reduce((a, m) => a + (m.kcal || 0), 0);
  renderToday(day, meals, kcal);
  renderFood(day, meals, kcal);
  renderMove(day);
  await renderSleep(day);
  await renderTrends();
}

function renderTopbar() {
  $('dateLabel').textContent = activeDate === cachedToday ? 'Today' : human(activeDate);
  $('nextDay').disabled = activeDate >= cachedToday;
}

function renderStrip() {
  const wrap = $('swingStrip');
  wrap.innerHTML = '';
  const len = settings.swingLen;
  for (let i = 0; i < len; i++) {
    const date = addDays(settings.swingStart, i);
    const b = document.createElement('button');
    b.className = 'blk';
    b.setAttribute('aria-label', `Day ${i + 1} — ${human(date)}`);
    if (date === cachedToday) b.classList.add('today');
    else if (date < cachedToday) {
      b.classList.add('done');
      b.style.setProperty('--blkc', hexLerp('#7c5cfc', '#38bdf8', len > 1 ? i / (len - 1) : 0));
    }
    if (date === activeDate && date !== cachedToday) b.classList.add('sel');
    if (date > cachedToday) b.disabled = true;
    else b.addEventListener('click', () => { activeDate = date; renderAll(); });
    wrap.appendChild(b);
  }
  const n = swingDay(activeDate);
  if (inSwing(activeDate)) {
    $('dayTitle').textContent = `Day ${n} of ${settings.swingLen}`;
    $('daySub').textContent = human(activeDate) + (activeDate === cachedToday ? '' : ' — viewing a past day');
  } else if (activeDate < settings.swingStart) {
    $('dayTitle').textContent = human(activeDate);
    $('daySub').textContent = `Swing starts ${human(settings.swingStart)}`;
  } else {
    $('dayTitle').textContent = human(activeDate);
    $('daySub').textContent = 'Past the end of this swing — update it in settings';
  }
}

function meterFill(el, value, target, overIsBad = false) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  el.style.width = pct + '%';
  el.classList.toggle('over', overIsBad && value > target);
}

async function lastKnownWeight(before) {
  const days = await dbAll('days');
  const w = days.filter((d) => d.weight != null && d.date <= before).sort((a, b) => a.date < b.date ? -1 : 1);
  return w.length ? w[w.length - 1].weight : null;
}

async function renderToday(day, meals, kcal) {
  // weight
  const w = day.weight ?? await lastKnownWeight(activeDate);
  $('weightBig').textContent = w != null ? (Math.round(w * 10) / 10) : '—';
  $('weightHeadVal').innerHTML = `<small>start</small> ${fmtKg(settings.startWeight)}`;
  const dEl = $('weightDelta');
  if (w != null && settings.startWeight) {
    const diff = w - settings.startWeight;
    dEl.textContent = `${diff <= 0 ? '' : '+'}${Math.round(diff * 10) / 10} kg`;
    dEl.classList.toggle('good', diff < 0);
    dEl.textContent += diff < 0 ? ' down' : diff === 0 ? '' : ' up';
  } else dEl.textContent = '';
  $('weightInput').value = '';
  $('weightInput').placeholder = day.weight != null ? `Logged: ${day.weight} kg` : 'Morning weigh-in';

  // kcal
  const budget = settings.kcalBudget;
  $('kcalHeadVal').innerHTML = `${nfmt(kcal)} <small>/ ${nfmt(budget)} kcal</small>`;
  meterFill($('kcalMeter'), kcal, budget, true);
  $('kcalSub').textContent = kcal <= budget
    ? `${nfmt(budget - kcal)} kcal left today`
    : `${nfmt(kcal - budget)} kcal over budget`;

  // water
  $('waterHeadVal').innerHTML = `${fmtL(day.water)} <small>/ ${fmtL(settings.waterTarget)}</small>`;
  meterFill($('waterMeter'), day.water, settings.waterTarget);

  // steps
  $('stepsHeadVal').innerHTML = `${nfmt(day.steps ?? 0)} <small>/ ${nfmt(settings.stepTarget)}</small>`;
  meterFill($('stepsMeter'), day.steps ?? 0, settings.stepTarget);
  $('stepsInput').value = '';
  $('stepsInput').placeholder = day.steps != null ? `Logged: ${nfmt(day.steps)}` : 'From your watch or phone';

  // sleep
  if (day.sleep) {
    $('sleepHeadVal').textContent = fmtH(day.sleep.hours);
    $('sleepSubToday').textContent = `Lights out ${day.sleep.bed} → up ${day.sleep.wake} · quality ${day.sleep.quality}/5`;
  } else {
    $('sleepHeadVal').textContent = '—';
    $('sleepSubToday').textContent = 'Tap to log last night';
  }
}

const THUMB_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 2.5v6a2.5 2.5 0 0 0 5 0v-6"/><path d="M6.5 2.5V22"/><path d="M20 15.5V2.5a4.5 4.5 0 0 0-4 4.5v6.5h4z"/><path d="M20 15.5V22"/></svg>';
const X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function renderFood(day, meals, kcal) {
  const budget = settings.kcalBudget;
  $('foodHeadVal').innerHTML = `${nfmt(kcal)} <small>/ ${nfmt(budget)} kcal</small>`;
  meterFill($('foodMeter'), kcal, budget, true);
  $('foodSub').textContent = kcal <= budget
    ? `${nfmt(budget - kcal)} kcal left`
    : `${nfmt(kcal - budget)} kcal over`;

  for (const u of mealURLs.values()) URL.revokeObjectURL(u);
  mealURLs.clear();

  const list = $('mealList');
  list.innerHTML = '';
  if (!meals.length) {
    list.innerHTML = '<div class="empty">Nothing logged yet.<br>Photo it, scan it, or quick-add it.</div>';
    return;
  }
  meals.sort((a, b) => (a.time || '') < (b.time || '') ? -1 : 1);
  for (const type of MEAL_TYPES) {
    const group = meals.filter((m) => m.type === type);
    if (!group.length) continue;
    const sum = group.reduce((a, m) => a + (m.kcal || 0), 0);
    const gh = document.createElement('div');
    gh.className = 'grouphead';
    gh.innerHTML = `<h3>${type}</h3><span>${nfmt(sum)} kcal</span>`;
    list.appendChild(gh);
    for (const m of group) {
      const row = document.createElement('div');
      row.className = 'row';
      let thumb;
      if (m.photo) {
        const u = URL.createObjectURL(m.photo);
        mealURLs.set(m.id, u);
        thumb = `<img class="thumb" src="${u}" alt="">`;
      } else {
        thumb = `<div class="thumb">${THUMB_SVG}</div>`;
      }
      const src = m.source === 'scan' ? ' · scanned' : m.photo ? ' · photo' : '';
      row.innerHTML = `${thumb}
        <div class="rowmain">
          <div class="rowname">${esc(m.name || type)}</div>
          <div class="rowsub">${m.time || ''}${src}</div>
        </div>
        <div class="rowval">${nfmt(m.kcal || 0)} <small>kcal</small></div>
        <button class="rowdel" aria-label="Delete">${X_SVG}</button>`;
      row.querySelector('.rowdel').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete "${m.name || type}"?`)) return;
        await dbDel('meals', m.id);
        renderAll();
      });
      row.addEventListener('click', () => openMealSheet(null, m));
      list.appendChild(row);
    }
  }
}

async function renderMove(day) {
  $('stepsHeadVal2').innerHTML = `${nfmt(day.steps ?? 0)} <small>/ ${nfmt(settings.stepTarget)}</small>`;
  meterFill($('stepsMeter2'), day.steps ?? 0, settings.stepTarget);
  $('stepsInput2').value = '';
  $('stepsInput2').placeholder = day.steps != null ? `Logged: ${nfmt(day.steps)}` : 'From your watch or phone';

  const mins = day.exercises.reduce((a, e) => a + e.mins, 0);
  $('exHeadVal').textContent = mins ? `${mins} min` : '';
  document.querySelectorAll('#exChips .chip').forEach((c) =>
    c.classList.toggle('on', c.dataset.type === exType));

  const list = $('exList');
  list.innerHTML = '';
  if (!day.exercises.length) {
    list.innerHTML = '<div class="empty">No sessions yet today.</div>';
  }
  for (const e of day.exercises) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div class="thumb" style="color:var(--c-move)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="9" width="3.5" height="6" rx="1"/><rect x="18.5" y="9" width="3.5" height="6" rx="1"/><line x1="5.5" y1="12" x2="18.5" y2="12"/></svg>
      </div>
      <div class="rowmain"><div class="rowname">${esc(e.type)}</div><div class="rowsub">${e.time || ''}</div></div>
      <div class="rowval">${e.mins} <small>min</small></div>
      <button class="rowdel" aria-label="Delete">${X_SVG}</button>`;
    row.querySelector('.rowdel').addEventListener('click', async () => {
      if (!confirm(`Delete ${e.type} · ${e.mins} min?`)) return;
      const d = await getDay(activeDate);
      d.exercises = d.exercises.filter((x) => x.id !== e.id);
      await dbPut('days', d);
      renderAll();
    });
    list.appendChild(row);
  }

  // swing summary
  const days = await dbAll('days');
  const swingDates = new Set(Array.from({ length: settings.swingLen }, (_, i) => addDays(settings.swingStart, i)));
  let totMins = 0, totSessions = 0;
  for (const d of days) {
    if (!swingDates.has(d.date) || !d.exercises) continue;
    totSessions += d.exercises.length;
    totMins += d.exercises.reduce((a, e) => a + e.mins, 0);
  }
  const sum = $('exSummary');
  if (totSessions) {
    sum.style.display = '';
    sum.innerHTML = `<div class="cardhead" style="margin:0"><span class="dot" style="--c:var(--c-move)"></span><span class="eyebrow">This swing</span><span class="headval">${totSessions} sessions · ${totMins} min</span></div>`;
  } else sum.style.display = 'none';
}

function calcSleepHours() {
  const bed = $('bedTime').value, wake = $('wakeTime').value;
  if (!bed || !wake) return null;
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  const mins = ((wh * 60 + wm) - (bh * 60 + bm) + 1440) % 1440;
  return Math.round((mins / 60) * 10) / 10;
}

async function renderSleep(day) {
  const s = day.sleep;
  $('bedTime').value = s ? s.bed : '';
  $('wakeTime').value = s ? s.wake : '';
  sleepQuality = s ? s.quality : 0;
  $('sleepHoursHead').textContent = s ? fmtH(s.hours) : '';
  $('sleepHoursBig').textContent = s ? (Math.round(s.hours * 10) / 10) : '—';
  document.querySelectorAll('#qualityRow button').forEach((b) =>
    b.classList.toggle('on', +b.dataset.q <= sleepQuality));

  // last 7 nights ending on activeDate
  const series = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(activeDate, -i);
    const d = await dbGet('days', date);
    series.push({ d: date, v: d && d.sleep ? d.sleep.hours : null });
  }
  barChart('ch-sleepmini', 'ro-sleepmini', series, {
    color: METRIC.sleep, target: settings.sleepTarget, fmt: fmtH,
  });
}

/* ---------------- trends ---------------- */

function rangeDates() {
  if (trendRange === 'swing') {
    const out = [];
    for (let i = 0; i < settings.swingLen; i++) {
      const date = addDays(settings.swingStart, i);
      if (date > cachedToday) break;
      out.push(date);
    }
    return out.length ? out : [cachedToday];
  }
  if (trendRange === '7') {
    return Array.from({ length: 7 }, (_, i) => addDays(cachedToday, i - 6));
  }
  return null; // all
}

async function renderTrends() {
  const [days, meals] = await Promise.all([dbAll('days'), dbAll('meals')]);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const kcalBy = new Map();
  for (const m of meals) kcalBy.set(m.date, (kcalBy.get(m.date) || 0) + (m.kcal || 0));

  let dates = rangeDates();
  if (!dates) {
    const all = new Set([...byDate.keys(), ...kcalBy.keys()]);
    if (!all.size) dates = [cachedToday];
    else {
      const sorted = [...all].sort();
      dates = [];
      let d = sorted[0];
      const end = cachedToday;
      while (d <= end && dates.length < 90) { dates.push(d); d = addDays(d, 1); }
    }
  }

  const wSeries = dates.map((d) => ({ d, v: byDate.get(d)?.weight ?? null }));
  const kSeries = dates.map((d) => ({ d, v: kcalBy.has(d) ? kcalBy.get(d) : null }));
  const sSeries = dates.map((d) => ({ d, v: byDate.get(d)?.steps ?? null }));
  const waSeries = dates.map((d) => ({ d, v: byDate.get(d)?.water ? byDate.get(d).water / 1000 : null }));
  const slSeries = dates.map((d) => ({ d, v: byDate.get(d)?.sleep?.hours ?? null }));

  // stat tiles
  const avg = (arr) => { const v = arr.filter((x) => x.v != null).map((x) => x.v); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const wVals = wSeries.filter((x) => x.v != null);
  const wDelta = wVals.length >= 2 ? wVals[wVals.length - 1].v - wVals[0].v : null;
  const stats = [
    { val: wDelta != null ? `${wDelta <= 0 ? '' : '+'}${Math.round(wDelta * 10) / 10} kg` : '—', lab: 'Weight change' },
    { val: avg(kSeries) != null ? nfmt(avg(kSeries)) : '—', lab: 'Avg kcal / day' },
    { val: avg(sSeries) != null ? nfmt(avg(sSeries)) : '—', lab: 'Avg steps' },
    { val: avg(slSeries) != null ? fmtH(avg(slSeries)) : '—', lab: 'Avg sleep' },
  ];
  $('statRow').innerHTML = stats.map((s) =>
    `<div class="stat"><div class="statval">${s.val}</div><div class="statlab">${s.lab}</div></div>`).join('');

  lineChart('ch-weight', 'ro-weight', wSeries, { color: '#f5f5f7', goal: settings.goalWeight, fmt: fmtKg });
  barChart('ch-kcal', 'ro-kcal', kSeries, { color: METRIC.food, target: settings.kcalBudget, fmt: (v) => `${nfmt(v)} kcal`, targetLabel: 'budget' });
  barChart('ch-steps', 'ro-steps', sSeries, { color: METRIC.steps, target: settings.stepTarget, fmt: (v) => `${nfmt(v)} steps` });
  barChart('ch-water', 'ro-water', waSeries, { color: METRIC.water, target: settings.waterTarget / 1000, fmt: (v) => `${Math.round(v * 100) / 100} L` });
  barChart('ch-sleep', 'ro-sleep', slSeries, { color: METRIC.sleep, target: settings.sleepTarget, fmt: fmtH });
}

/* ---------------- charts (inline SVG) ---------------- */

const CW = 340, CH = 150, PL = 8, PR = 8, PT = 22, PB = 20;

function chartFrame(inner, extra = '') {
  return `<svg viewBox="0 0 ${CW} ${CH}" role="img">${extra}
    <line class="axis" x1="${PL}" y1="${CH - PB}" x2="${CW - PR}" y2="${CH - PB}"/>
    ${inner}</svg>`;
}

function barChart(boxId, roId, series, opts) {
  const box = $(boxId), ro = $(roId);
  const vals = series.filter((s) => s.v != null);
  if (!vals.length) {
    box.innerHTML = '<div class="empty" style="padding:14px">No data yet.</div>';
    ro.textContent = '';
    return;
  }
  const n = series.length;
  const plotW = CW - PL - PR, plotH = CH - PT - PB;
  const vmax = Math.max(...vals.map((s) => s.v), opts.target || 0) * 1.06 || 1;
  const slot = plotW / n;
  const bw = Math.max(2, Math.min(slot * 0.72, 26));
  const y = (v) => CH - PB - (v / vmax) * plotH;

  let bars = '', labels = '';
  const latestIdx = series.map((s) => s.v != null).lastIndexOf(true);
  let maxIdx = -1, maxV = -Infinity;
  series.forEach((s, i) => { if (s.v != null && s.v > maxV) { maxV = s.v; maxIdx = i; } });

  series.forEach((s, i) => {
    if (s.v == null) return;
    const x = PL + i * slot + (slot - bw) / 2;
    const h = Math.max(1, (s.v / vmax) * plotH);
    const r = Math.min(3, bw / 2, h);
    const top = CH - PB - h;
    bars += `<path fill="${opts.color}" d="M${x} ${CH - PB} v${-(h - r)} q0 ${-r} ${r} ${-r} h${bw - 2 * r} q${r} 0 ${r} ${r} v${h - r} z"/>`;
    if (i === latestIdx || i === maxIdx) {
      const lv = opts.fmt(s.v).replace(/ (kcal|steps)$/, '');
      const tx = Math.min(Math.max(x + bw / 2, 14), CW - 20);
      labels += `<text class="vlab" x="${tx}" y="${top - 5}" text-anchor="middle">${lv}</text>`;
    }
  });

  let target = '';
  if (opts.target) {
    const ty = y(opts.target);
    target = `<line class="tgt" x1="${PL}" y1="${ty}" x2="${CW - PR}" y2="${ty}"/>
      <text x="${CW - PR}" y="${ty - 4}" text-anchor="end">${opts.targetLabel || 'goal'}</text>`;
  }
  const grid = `<line class="gridline" x1="${PL}" y1="${y(vmax / 2)}" x2="${CW - PR}" y2="${y(vmax / 2)}"/>`;
  const xlabs = `<text x="${PL}" y="${CH - 6}">${shortDate(series[0].d)}</text>
    <text x="${CW - PR}" y="${CH - 6}" text-anchor="end">${shortDate(series[n - 1].d)}</text>`;
  const hits = series.map((s, i) =>
    s.v == null ? '' : `<rect class="hit" data-i="${i}" x="${PL + i * slot}" y="${PT}" width="${slot}" height="${plotH}"/>`).join('');

  box.innerHTML = chartFrame(grid + target + bars + labels + xlabs + hits);
  const latest = series[latestIdx];
  ro.textContent = `${human(latest.d)} — ${opts.fmt(latest.v)}`;
  box.onclick = (e) => {
    const hit = e.target.closest('.hit');
    if (!hit) return;
    const s = series[+hit.dataset.i];
    ro.textContent = `${human(s.d)} — ${opts.fmt(s.v)}`;
  };
}

function lineChart(boxId, roId, series, opts) {
  const box = $(boxId), ro = $(roId);
  const pts = series.map((s, i) => ({ ...s, i })).filter((s) => s.v != null);
  if (!pts.length) {
    box.innerHTML = '<div class="empty" style="padding:14px">No weigh-ins yet — log one on the Today screen.</div>';
    ro.textContent = '';
    return;
  }
  const n = series.length;
  const plotW = CW - PL - PR - 12, plotH = CH - PT - PB;
  const xs = (i) => PL + 6 + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const vs = pts.map((p) => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (opts.goal) { lo = Math.min(lo, opts.goal); hi = Math.max(hi, opts.goal); }
  const pad = Math.max((hi - lo) * 0.15, 0.5);
  lo -= pad; hi += pad;
  const y = (v) => CH - PB - ((v - lo) / (hi - lo)) * plotH;

  const path = pts.map((p, k) => `${k ? 'L' : 'M'}${xs(p.i)} ${y(p.v)}`).join(' ');
  const dots = pts.map((p) =>
    `<circle cx="${xs(p.i)}" cy="${y(p.v)}" r="3.5" fill="${opts.color}"/>`).join('');
  const hits = pts.map((p) =>
    `<circle class="hit" data-i="${p.i}" cx="${xs(p.i)}" cy="${y(p.v)}" r="13"/>`).join('');

  const first = pts[0], last = pts[pts.length - 1];
  let labels = `<text class="vlab" x="${Math.min(Math.max(xs(last.i), 18), CW - 18)}" y="${y(last.v) - 8}" text-anchor="middle">${Math.round(last.v * 10) / 10}</text>`;
  if (last.i !== first.i) {
    labels += `<text class="vlab" x="${Math.max(xs(first.i), 18)}" y="${y(first.v) - 8}" text-anchor="middle">${Math.round(first.v * 10) / 10}</text>`;
  }
  let goal = '';
  if (opts.goal) {
    goal = `<line class="tgt" x1="${PL}" y1="${y(opts.goal)}" x2="${CW - PR}" y2="${y(opts.goal)}"/>
      <text x="${CW - PR}" y="${y(opts.goal) - 4}" text-anchor="end">goal ${opts.goal}</text>`;
  }
  const xlabs = `<text x="${PL}" y="${CH - 6}">${shortDate(series[0].d)}</text>
    <text x="${CW - PR}" y="${CH - 6}" text-anchor="end">${shortDate(series[n - 1].d)}</text>`;

  box.innerHTML = chartFrame(
    `${goal}<path d="${path}" fill="none" stroke="${opts.color}" stroke-width="2" stroke-linejoin="round"/>${dots}${labels}${xlabs}${hits}`);
  ro.textContent = `${human(last.d)} — ${opts.fmt(last.v)}`;
  box.onclick = (e) => {
    const hit = e.target.closest('.hit');
    if (!hit) return;
    const s = series[+hit.dataset.i];
    ro.textContent = `${human(s.d)} — ${opts.fmt(s.v)}`;
  };
}

/* ================= ACTIONS ================= */

async function mutateDay(fn) {
  const d = await getDay(activeDate);
  fn(d);
  await dbPut('days', d);
  await renderAll();
}

function bindToday() {
  $('weightSave').addEventListener('click', async () => {
    const v = parseFloat($('weightInput').value);
    if (!(v >= 30 && v <= 250)) { showToast('Enter a weight in kg, e.g. 99.4'); return; }
    await mutateDay((d) => { d.weight = Math.round(v * 10) / 10; });
    showToast('Weigh-in logged');
  });
  document.querySelectorAll('.waterAdd').forEach((b) =>
    b.addEventListener('click', () => mutateDay((d) => { d.water += +b.dataset.ml; })));
  $('waterUndo').addEventListener('click', () =>
    mutateDay((d) => { d.water = Math.max(0, d.water - 250); }));

  const saveSteps = (inputId) => async () => {
    const v = parseInt($(inputId).value, 10);
    if (!(v >= 0)) { showToast('Enter today’s step count'); return; }
    await mutateDay((d) => { d.steps = v; });
    showToast('Steps logged');
  };
  $('stepsSave').addEventListener('click', saveSteps('stepsInput'));
  $('stepsSave2').addEventListener('click', saveSteps('stepsInput2'));

  $('cardSleepToday').addEventListener('click', () => gotoPanel(3));
  $('goFoodPhoto').addEventListener('click', () => { gotoPanel(1); $('photoInput').click(); });
  $('goFoodScan').addEventListener('click', () => { gotoPanel(1); startScan(); });
}

/* ---------------- meals ---------------- */

let mealType = 'Crib';
let editingMealId = null;
let thumbURL = null;

function defaultMealType() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (activeDate !== cachedToday) return 'Crib';
  if (h < 10.5) return 'Breakfast';
  if (h < 14.5) return 'Crib';
  if (h < 20.5) return 'Dinner';
  return 'Snack';
}

function openMealSheet(photoBlob, meal) {
  pendingPhoto = photoBlob || null;
  editingMealId = meal ? meal.id : null;
  mealType = meal ? meal.type : defaultMealType();
  $('mealSheetTitle').textContent = meal ? 'Edit meal' : photoBlob ? 'Photo meal' : 'Quick add';
  $('mealName').value = meal && meal.name !== meal.type ? meal.name : '';
  $('mealKcal').value = meal ? meal.kcal : '';
  document.querySelectorAll('#kcalChips .chip').forEach((c) => c.classList.remove('on'));
  document.querySelectorAll('#mealTypeChips .chip').forEach((c) =>
    c.classList.toggle('on', c.dataset.mt === mealType));
  const wrap = $('mealThumbWrap');
  if (thumbURL) { URL.revokeObjectURL(thumbURL); thumbURL = null; }
  const shot = photoBlob || (meal && meal.photo);
  if (shot) {
    thumbURL = URL.createObjectURL(shot);
    $('mealThumb').src = thumbURL;
    wrap.classList.add('show');
  } else wrap.classList.remove('show');
  openSheet('sheetMeal');
}

function bindMeals() {
  $('btnPhoto').addEventListener('click', () => $('photoInput').click());
  $('btnQuick').addEventListener('click', () => openMealSheet(null));
  $('btnScan').addEventListener('click', startScan);

  $('photoInput').addEventListener('change', async () => {
    const f = $('photoInput').files[0];
    $('photoInput').value = '';
    if (!f) return;
    try {
      const blob = await compressImage(f);
      openMealSheet(blob);
    } catch (e) {
      showToast('Couldn’t read that photo — try again');
    }
  });

  $('mealTypeChips').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    mealType = c.dataset.mt;
    document.querySelectorAll('#mealTypeChips .chip').forEach((x) =>
      x.classList.toggle('on', x === c));
  });
  $('kcalChips').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    $('mealKcal').value = c.dataset.kcal;
    document.querySelectorAll('#kcalChips .chip').forEach((x) =>
      x.classList.toggle('on', x === c));
  });

  $('mealCancel').addEventListener('click', closeSheets);
  $('mealSave').addEventListener('click', async () => {
    const kcal = parseInt($('mealKcal').value, 10);
    if (!(kcal >= 0)) { showToast('Add calories — tap a size button if unsure'); return; }
    const name = $('mealName').value.trim() || mealType;
    if (editingMealId) {
      const existing = await dbGet('meals', editingMealId);
      if (existing) {
        existing.name = name;
        existing.kcal = kcal;
        existing.type = mealType;
        await dbPut('meals', existing);
      }
      editingMealId = null;
      closeSheets();
      showToast('Meal updated');
      renderAll();
      return;
    }
    const meal = {
      id: (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random()),
      date: activeDate,
      time: activeDate === cachedToday ? nowTime() : '12:00',
      type: mealType,
      name,
      kcal,
      source: pendingPhoto ? 'photo' : 'manual',
    };
    if (pendingPhoto) meal.photo = pendingPhoto;
    await dbPut('meals', meal);
    pendingPhoto = null;
    closeSheets();
    showToast(`Logged ${nfmt(kcal)} kcal`);
    renderAll();
  });
}

function compressImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1200;
      let { width: w, height: h } = img;
      if (w > max || h > max) {
        const k = max / Math.max(w, h);
        w = Math.round(w * k); h = Math.round(h * k);
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob((b) => b ? res(b) : rej(new Error('encode failed')), 'image/jpeg', 0.72);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('load failed')); };
    img.src = url;
  });
}

/* ---------------- exercise ---------------- */

function bindMove() {
  $('exChips').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    exType = c.dataset.type;
    document.querySelectorAll('#exChips .chip').forEach((x) =>
      x.classList.toggle('on', x === c));
  });
  $('exMinsMinus').addEventListener('click', () => {
    $('exMins').value = Math.max(5, (parseInt($('exMins').value, 10) || 30) - 5);
  });
  $('exMinsPlus').addEventListener('click', () => {
    $('exMins').value = Math.min(600, (parseInt($('exMins').value, 10) || 30) + 5);
  });
  $('exAdd').addEventListener('click', async () => {
    const mins = parseInt($('exMins').value, 10);
    if (!(mins > 0)) { showToast('Set the minutes first'); return; }
    await mutateDay((d) => {
      d.exercises.push({
        id: Date.now() + '-' + Math.random(),
        type: exType, mins,
        time: activeDate === cachedToday ? nowTime() : '',
      });
    });
    showToast(`${exType} · ${mins} min logged`);
  });
}

/* ---------------- sleep ---------------- */

function bindSleep() {
  const upd = () => {
    const h = calcSleepHours();
    $('sleepHoursBig').textContent = h != null && h > 0 ? h : '—';
  };
  $('bedTime').addEventListener('change', upd);
  $('wakeTime').addEventListener('change', upd);
  $('qualityRow').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    sleepQuality = +b.dataset.q;
    document.querySelectorAll('#qualityRow button').forEach((x) =>
      x.classList.toggle('on', +x.dataset.q <= sleepQuality));
  });
  $('sleepSave').addEventListener('click', async () => {
    const bed = $('bedTime').value, wake = $('wakeTime').value;
    const hours = calcSleepHours();
    if (!bed || !wake || !hours) { showToast('Set lights-out and wake-up times'); return; }
    await mutateDay((d) => {
      d.sleep = { bed, wake, hours, quality: sleepQuality || 3 };
    });
    showToast('Sleep logged');
  });
}

/* ---------------- barcode scanning ---------------- */

async function startScan() {
  openSheet('sheetScan');
  $('scanHint').textContent = 'Point the camera at the barcode';
  $('scanManual').value = '';
  scan.active = true;
  try {
    scan.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 } },
      audio: false,
    });
    const video = $('scanVideo');
    video.srcObject = scan.stream;
    await video.play();

    if ('BarcodeDetector' in window) {
      const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
      scan.timer = setInterval(async () => {
        if (!scan.active) return;
        try {
          const codes = await det.detect(video);
          if (codes.length) foundCode(codes[0].rawValue);
        } catch (e) { /* frame not ready */ }
      }, 350);
    } else if (window.ZXing) {
      scan.reader = new ZXing.BrowserMultiFormatReader();
      scan.reader.decodeFromStream(scan.stream, video, (result) => {
        if (result && scan.active) foundCode(result.getText());
      });
    } else {
      $('scanHint').textContent = 'Scanner unavailable — type the numbers below';
    }
  } catch (e) {
    $('scanHint').textContent = 'Camera blocked — type the numbers below instead';
  }
}

function stopScan() {
  scan.active = false;
  clearInterval(scan.timer);
  scan.timer = null;
  try { scan.reader && scan.reader.reset(); } catch (e) { /* ignore */ }
  scan.reader = null;
  if (scan.stream) {
    scan.stream.getTracks().forEach((t) => t.stop());
    scan.stream = null;
  }
  const v = $('scanVideo');
  if (v) v.srcObject = null;
}

function foundCode(code) {
  if (!scan.active) return;
  scan.active = false;
  if (navigator.vibrate) navigator.vibrate(60);
  closeSheets();
  lookupProduct(String(code).trim());
}

function bindScan() {
  $('scanCancel').addEventListener('click', closeSheets);
  $('scanGo').addEventListener('click', () => {
    const code = $('scanManual').value.trim();
    if (code.length < 6) { showToast('That barcode looks too short'); return; }
    closeSheets();
    lookupProduct(code);
  });
}

/* ---------------- Open Food Facts ---------------- */

async function lookupProduct(code) {
  $('productBody').innerHTML = '<div class="empty">Looking up product…</div>';
  openSheet('sheetProduct');

  let prod = await dbGet('products', code).catch(() => null);
  if (!prod) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json` +
        '?fields=product_name,brands,allergens_tags,traces_tags,ingredients_text,nutriments,serving_quantity',
        { signal: ctrl.signal });
      clearTimeout(to);
      const j = await r.json();
      if (j.status !== 1 || !j.product) {
        productMessage(`Barcode ${esc(code)} isn’t in the food database.`, true);
        return;
      }
      const p = j.product;
      const nut = p.nutriments || {};
      const kcal100 = nut['energy-kcal_100g'] ?? (nut['energy_100g'] ? nut['energy_100g'] / 4.184 : null);
      prod = {
        code,
        name: p.product_name || 'Unnamed product',
        brand: p.brands || '',
        kcal100: kcal100 != null ? Math.round(kcal100) : null,
        prot: nut['proteins_100g'] ?? null,
        carb: nut['carbohydrates_100g'] ?? null,
        sug: nut['sugars_100g'] ?? null,
        fat: nut['fat_100g'] ?? null,
        salt: nut['salt_100g'] ?? null,
        allergens: p.allergens_tags || [],
        traces: p.traces_tags || [],
        ingredients: p.ingredients_text || '',
        servingG: Number(p.serving_quantity) || null,
      };
      await dbPut('products', prod);
    } catch (e) {
      productMessage(
        navigator.onLine === false
          ? 'No signal — lookups need a connection the first time. Once scanned, products work offline.'
          : 'Lookup failed — check the signal and try again.', true);
      return;
    }
  }
  showProduct(prod);
}

function productMessage(msg, offerManual) {
  $('productBody').innerHTML = `
    <h2>No luck</h2>
    <div class="empty" style="text-align:left;padding:4px 0 14px">${msg}</div>
    <div class="sheetbtns">
      <button class="btn ghost" id="prodClose">Close</button>
      ${offerManual ? '<button class="btn" id="prodManual">Add meal manually</button>' : ''}
    </div>`;
  $('prodClose').addEventListener('click', closeSheets);
  const m = $('prodManual');
  if (m) m.addEventListener('click', () => { closeSheets(); openMealSheet(null); });
}

const OK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="m8 12.5 2.6 2.6L16 9.5"/></svg>';
const WARN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19z"/><path d="M12 9.5V14"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/></svg>';

function verdictFor(prod) {
  const mine = ALLERGENS.filter((a) => settings.allergens.includes(a.id));
  const hit = (tags) => mine.filter((a) => a.tags.some((t) => tags.includes(t))).map((a) => a.label);
  const contains = hit(prod.allergens);
  const traces = hit(prod.traces);
  const custom = (settings.customAllergens || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    .filter((w) => (prod.ingredients || '').toLowerCase().includes(w));

  if (contains.length || custom.length) {
    return { cls: 'danger', icon: WARN_ICON, head: `Contains: ${[...contains, ...custom].join(', ')}`, sub: 'Listed on the label — give it a miss.' };
  }
  if (traces.length) {
    return { cls: 'warn', icon: WARN_ICON, head: `May contain traces: ${traces.join(', ')}`, sub: 'Made on shared lines — your call.' };
  }
  if (!prod.allergens.length && !prod.ingredients) {
    return { cls: 'warn', icon: WARN_ICON, head: 'No ingredient data listed', sub: 'Database entry is incomplete — check the packet.' };
  }
  return { cls: 'ok', icon: OK_ICON, head: mine.length || (settings.customAllergens || '').trim() ? 'Nothing you avoid is listed' : 'No dietary flags set', sub: 'Based on label data — double-check if it’s a severe allergy.' };
}

function showProduct(prod) {
  const v = verdictFor(prod);
  const g0 = prod.servingG || 100;
  const rows = [
    ['Energy', prod.kcal100 != null ? `${prod.kcal100} kcal` : '—'],
    ['Protein', prod.prot != null ? `${prod.prot} g` : '—'],
    ['Carbs', prod.carb != null ? `${prod.carb} g` : '—'],
    [' of which sugars', prod.sug != null ? `${prod.sug} g` : '—'],
    ['Fat', prod.fat != null ? `${prod.fat} g` : '—'],
    ['Salt', prod.salt != null ? `${prod.salt} g` : '—'],
  ];
  $('productBody').innerHTML = `
    <h2 style="margin-bottom:2px">${esc(prod.name)}</h2>
    <div class="cardsub" style="margin-bottom:12px">${esc(prod.brand)}</div>
    <div class="verdict ${v.cls}">${v.icon}<div>${v.head}<span class="vsub">${v.sub}</span></div></div>
    <div class="eyebrow" style="margin-bottom:2px">Per 100 g</div>
    <table class="nutri">${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>
    ${prod.kcal100 != null ? `
    <label class="flabel" for="prodGrams">How much are you having? (grams)</label>
    <div class="formrow" style="align-items:center">
      <input type="number" id="prodGrams" inputmode="numeric" min="1" max="2000" value="${g0}">
      ${prod.servingG ? `<button class="chip" id="prodServe" style="flex:0 0 auto">1 serve · ${prod.servingG} g</button>` : ''}
    </div>
    <div class="cardsub" style="margin-top:8px">= <b id="prodKcal" style="color:var(--ink)">${Math.round(prod.kcal100 * g0 / 100)}</b> kcal</div>` : `
    <div class="cardsub" style="margin-top:8px">No calorie data — you can still add it manually.</div>`}
    <div class="sheetbtns">
      <button class="btn ghost" id="prodClose">Close</button>
      <button class="btn" id="prodAdd">${prod.kcal100 != null ? 'Add to log' : 'Add manually'}</button>
    </div>`;

  $('prodClose').addEventListener('click', closeSheets);
  const grams = $('prodGrams');
  const upd = () => {
    const g = parseInt(grams.value, 10) || 0;
    $('prodKcal').textContent = Math.round((prod.kcal100 || 0) * g / 100);
  };
  if (grams) grams.addEventListener('input', upd);
  const serveBtn = $('prodServe');
  if (serveBtn) serveBtn.addEventListener('click', () => { grams.value = prod.servingG; upd(); });

  $('prodAdd').addEventListener('click', async () => {
    if (prod.kcal100 == null) { closeSheets(); openMealSheet(null); return; }
    const g = parseInt(grams.value, 10);
    if (!(g > 0)) { showToast('Set the grams first'); return; }
    const kcal = Math.round(prod.kcal100 * g / 100);
    await dbPut('meals', {
      id: (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random()),
      date: activeDate,
      time: activeDate === cachedToday ? nowTime() : '12:00',
      type: defaultMealType(),
      name: prod.name.slice(0, 60),
      kcal,
      source: 'scan',
      code: prod.code,
    });
    closeSheets();
    showToast(`Logged ${prod.name.slice(0, 24)} · ${kcal} kcal`);
    renderAll();
  });
}

/* ---------------- settings ---------------- */

function buildAllergenBoxes() {
  const wrap = $('allergenBoxes');
  wrap.innerHTML = '';
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5 10-11"/></svg>';
  for (const a of ALLERGENS) {
    const b = document.createElement('button');
    b.className = 'abox';
    b.dataset.id = a.id;
    b.innerHTML = `<span class="box">${CHECK}</span>${a.label}`;
    b.addEventListener('click', () => b.classList.toggle('on'));
    wrap.appendChild(b);
  }
}

function openSettings(firstRun) {
  $('settingsIntro').classList.toggle('show', !!firstRun);
  $('setSwingStart').value = settings.swingStart;
  $('setSwingLen').value = settings.swingLen;
  $('setStartWeight').value = settings.startWeight ?? '';
  $('setGoalWeight').value = settings.goalWeight ?? '';
  $('setKcal').value = settings.kcalBudget;
  $('setWater').value = settings.waterTarget;
  $('setSteps').value = settings.stepTarget;
  $('setSleep').value = settings.sleepTarget;
  $('setCustomAllergens').value = settings.customAllergens || '';
  document.querySelectorAll('#allergenBoxes .abox').forEach((b) =>
    b.classList.toggle('on', settings.allergens.includes(b.dataset.id)));
  openSheet('sheetSettings');
}

function bindSettings() {
  $('settingsBtn').addEventListener('click', () => openSettings(false));
  $('settingsSave').addEventListener('click', () => {
    const num = (id, fb, lo, hi) => {
      const v = parseFloat($(id).value);
      return v >= lo && v <= hi ? v : fb;
    };
    settings.swingStart = $('setSwingStart').value || settings.swingStart || cachedToday;
    settings.swingLen = Math.round(num('setSwingLen', 20, 1, 60));
    settings.startWeight = num('setStartWeight', settings.startWeight || 100, 30, 250);
    const gw = parseFloat($('setGoalWeight').value);
    settings.goalWeight = gw >= 30 && gw <= 250 ? gw : null;
    settings.kcalBudget = Math.round(num('setKcal', 2200, 1000, 6000));
    settings.waterTarget = Math.round(num('setWater', 3000, 500, 10000));
    settings.stepTarget = Math.round(num('setSteps', 10000, 1000, 50000));
    settings.sleepTarget = num('setSleep', 7.5, 4, 12);
    settings.allergens = [...document.querySelectorAll('#allergenBoxes .abox.on')].map((b) => b.dataset.id);
    settings.customAllergens = $('setCustomAllergens').value.trim();
    saveSettings();
    closeSheets();
    showToast('Saved. Have a good swing.');
    renderAll();
  });

  $('wipeBtn').addEventListener('click', async () => {
    if (!confirm('Erase ALL SwingTrack data on this phone — every log, photo and setting? This can’t be undone.')) return;
    await Promise.all([dbClear('days'), dbClear('meals'), dbClear('products')]);
    localStorage.removeItem('swingtrack-settings');
    location.reload();
  });

  $('exportBtn').addEventListener('click', async () => {
    const [days, meals] = await Promise.all([dbAll('days'), dbAll('meals')]);
    const data = {
      app: 'SwingTrack',
      exported: new Date().toISOString(),
      settings,
      days,
      meals: meals.map(({ photo, ...m }) => ({ ...m, hadPhoto: !!photo })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `swingtrack-export-${cachedToday}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    showToast('Export downloaded');
  });
}

/* ---------------- date nav ---------------- */

function bindDateNav() {
  $('prevDay').addEventListener('click', () => { activeDate = addDays(activeDate, -1); renderAll(); });
  $('nextDay').addEventListener('click', () => {
    if (activeDate < cachedToday) { activeDate = addDays(activeDate, 1); renderAll(); }
  });
  $('dateLabel').addEventListener('click', () => { activeDate = cachedToday; renderAll(); });
  $('rangeBar').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    trendRange = b.dataset.range;
    document.querySelectorAll('#rangeBar button').forEach((x) =>
      x.classList.toggle('on', x === b));
    renderTrends();
  });
}

/* ---------------- init ---------------- */

async function init() {
  cachedToday = todayDs();
  activeDate = cachedToday;
  db = await openDb();

  buildAllergenBoxes();
  bindPager();
  bindDateNav();
  bindToday();
  bindMeals();
  bindMove();
  bindSleep();
  bindScan();
  bindSettings();
  $('backdrop').addEventListener('click', closeSheets);

  const stored = loadSettings();
  if (stored) {
    settings = stored;
    if (!settings.swingStart) settings.swingStart = cachedToday;
  } else {
    settings = { ...DEFAULTS, swingStart: cachedToday };
  }

  await renderAll();
  if (!stored) openSettings(true);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && todayDs() !== cachedToday) {
      cachedToday = todayDs();
      activeDate = cachedToday;
      renderAll();
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline still fine on 2nd load */ });
  }
}

init();
