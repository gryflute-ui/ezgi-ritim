'use strict';

/* =========================================================
   Ezgi & Ritim Tekrarı
   Tamamen tarayıcıda çalışır (Web Audio API), kurulum gerekmez.
   ========================================================= */

const $ = id => document.getElementById(id);

/* ---------------- Ses motoru ---------------- */
let ac = null;
function audio() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

// Her çalma için ayrı bir "bus" açıyoruz; iptal edilince bağlantıyı koparıp
// planlanmış sesleri susturuyoruz.
function newBus() {
  const g = audio().createGain();
  g.connect(audio().destination);
  return g;
}
function killBus(bus) { try { bus && bus.disconnect(); } catch (_) {} }

const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);

// Piyano benzeri basit ton
function tone(midi, when, dur = 0.45, vol = 0.3, dest = audio().destination) {
  const a = audio();
  const f = midiToFreq(midi);
  const o1 = a.createOscillator(), o2 = a.createOscillator();
  const g = a.createGain(), g2 = a.createGain();
  o1.type = 'triangle'; o1.frequency.value = f;
  o2.type = 'sine'; o2.frequency.value = f * 2;
  g2.gain.value = 0.15;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o1.connect(g); o2.connect(g2).connect(g); g.connect(dest);
  o1.start(when); o2.start(when);
  o1.stop(when + dur + 0.05); o2.stop(when + dur + 0.05);
}

// Metronom tıkı
function click(when, freq = 1100, vol = 0.1, dest = audio().destination) {
  const a = audio();
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'square'; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
  o.connect(g).connect(dest);
  o.start(when); o.stop(when + 0.05);
}

// Davul / vuruş sesi
function drum(when, vol = 0.6, f0 = 320, dest = audio().destination) {
  const a = audio();
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, when);
  o.frequency.exponentialRampToValueAtTime(90, when + 0.12);
  g.gain.setValueAtTime(vol, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
  o.connect(g).connect(dest);
  o.start(when); o.stop(when + 0.2);
}

/* ---------------- Yardımcılar ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('ert_' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem('ert_' + k, JSON.stringify(v)); } catch (_) {} }
};
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function bindRange(id) {
  const el = $(id), out = $(id + 'Val');
  const upd = () => { out.textContent = el.value; };
  el.addEventListener('input', upd); upd();
  return el;
}
function setMsg(el, text, cls = '') { el.textContent = text; el.className = 'msg ' + cls; }

// Butona fareyle basınca odak kalmasın (yoksa Boşluk tuşu butona tekrar basar)
document.querySelectorAll('button').forEach(b => b.addEventListener('click', () => b.blur()));

/* ---------------- Sekmeler ---------------- */
let activeTab = 'melody';
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
  activeTab = b.dataset.tab;
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === activeTab));
}));

/* =========================================================
   EZGİ TEKRARI
   ========================================================= */
const NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const noteName = m => NAMES[m % 12] + (m >= 72 ? "'" : '');

const SCALES = {
  pent:  [60, 62, 64, 67, 69, 72],
  major: [60, 62, 64, 65, 67, 69, 71, 72],
  chrom: [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72]
};

// Fiziksel tuş konumuna göre (klavye düzeninden bağımsız)
const KEYMAP = {
  KeyA: 60, KeyW: 61, KeyS: 62, KeyE: 63, KeyD: 64, KeyF: 65, KeyT: 66,
  KeyG: 67, KeyY: 68, KeyH: 69, KeyU: 70, KeyJ: 71, KeyK: 72
};

const mLen = bindRange('mLen');
const mBpm = bindRange('mBpm');
const mMsg = $('mMsg');

const M = {
  target: [], input: [], phase: 'idle', revealed: false,
  score: store.get('mScore', 0), streak: 0, best: store.get('mBest', 0),
  timers: [], bus: null
};

/* --- Piyanoyu oluştur --- */
const piano = $('piano');
const keyEls = {};
const WHITES = [60, 62, 64, 65, 67, 69, 71, 72];
const BLACKS = { 61: 0, 63: 1, 66: 3, 68: 4, 70: 5 }; // hangi beyaz tuştan sonra
WHITES.forEach(m => {
  const k = document.createElement('div');
  k.className = 'key white'; k.dataset.midi = m;
  k.innerHTML = `<span>${noteName(m)}</span>`;
  piano.appendChild(k); keyEls[m] = k;
});
Object.entries(BLACKS).forEach(([m, i]) => {
  const k = document.createElement('div');
  k.className = 'key black'; k.dataset.midi = m;
  k.style.left = `calc(${(i + 1) * 12.5}% - 3.75%)`;
  k.innerHTML = `<span>${noteName(+m)}</span>`;
  piano.appendChild(k); keyEls[m] = k;
});
piano.addEventListener('pointerdown', e => {
  const k = e.target.closest('.key');
  if (!k) return;
  e.preventDefault();
  pressNote(+k.dataset.midi);
});

function flashKey(m, ms = 220) {
  const k = keyEls[m]; if (!k) return;
  k.classList.add('down');
  setTimeout(() => k.classList.remove('down'), ms);
}

function renderSlots() {
  const box = $('mSlots');
  box.innerHTML = '';
  M.target.forEach((t, i) => {
    const d = document.createElement('div');
    d.className = 'slot';
    const inp = M.input[i];
    if (inp !== undefined) {
      d.textContent = noteName(inp);
      d.classList.add(inp === t ? 'ok' : 'bad');
    } else if (M.revealed) {
      d.textContent = noteName(t);
      d.classList.add('reveal');
    } else {
      d.textContent = '?';
    }
    box.appendChild(d);
  });
}

function updateMStats() {
  $('mScore').textContent = M.score;
  $('mStreak').textContent = M.streak;
  $('mBest').textContent = M.best;
  store.set('mScore', M.score);
  store.set('mBest', M.best);
}

function genMelody(n, scale) {
  const out = [pick(scale)];
  while (out.length < n) {
    const prev = out[out.length - 1];
    // Çok büyük sıçramaları engelle (en fazla tam beşli)
    out.push(pick(scale.filter(x => Math.abs(x - prev) <= 7)));
  }
  return out;
}

function stopMelody() {
  M.timers.forEach(clearTimeout); M.timers = [];
  killBus(M.bus); M.bus = null;
}

function playMelody() {
  stopMelody();
  const a = audio();
  M.bus = newBus();
  const beat = 60 / +mBpm.value;
  const lead = 0.15;
  const t0 = a.currentTime + lead;
  M.phase = 'playing'; M.input = []; M.revealed = false;
  renderSlots();
  setMsg(mMsg, '🎧 Dinle…');
  M.target.forEach((m, i) => {
    tone(m, t0 + i * beat, Math.min(beat * 0.95, 0.9), 0.3, M.bus);
    if ($('mShow').checked) {
      M.timers.push(setTimeout(() => flashKey(m, beat * 800), (lead + i * beat) * 1000));
    }
  });
  M.timers.push(setTimeout(() => {
    M.phase = 'answering';
    setMsg(mMsg, '🎹 Şimdi sen çal!', 'info');
  }, (lead + (M.target.length - 0.3) * beat) * 1000));
}

function newMelody() {
  M.target = genMelody(+mLen.value, SCALES[$('mScale').value]);
  $('mReplay').disabled = false;
  playMelody();
}

function pressNote(m) {
  if (M.phase === 'playing') return;
  tone(m, audio().currentTime);
  flashKey(m);
  if (M.phase !== 'answering') return;

  const i = M.input.length;
  M.input.push(m);

  if (m !== M.target[i]) {
    M.phase = 'idle';
    M.streak = 0;
    M.revealed = true;
    renderSlots();
    setMsg(mMsg,
      `✗ ${i + 1}. nota yanlış: ${noteName(m)} çaldın, doğrusu ${noteName(M.target[i])}. ` +
      `“Tekrar dinle / dene” ile yeniden deneyebilirsin.`, 'bad');
    updateMStats();
    return;
  }

  renderSlots();
  if (M.input.length === M.target.length) {
    M.phase = 'idle';
    M.score++; M.streak++;
    M.best = Math.max(M.best, M.streak);
    let extra = '';
    if ($('mAuto').checked && M.streak % 3 === 0 && +mLen.value < +mLen.max) {
      mLen.value = +mLen.value + 1;
      mLen.dispatchEvent(new Event('input'));
      extra = ` Seviye atladın: artık ${mLen.value} nota! 🚀`;
    }
    setMsg(mMsg, '✓ Harika, doğru!' + extra + ' Devam için “Yeni ezgi”.', 'good');
    updateMStats();
  }
}

$('mNew').addEventListener('click', newMelody);
$('mReplay').addEventListener('click', () => { if (M.target.length) playMelody(); });
$('mRef').addEventListener('click', () => { tone(60, audio().currentTime, 0.9); flashKey(60, 600); });

renderSlots();
updateMStats();

/* =========================================================
   RİTİM TEKRARI
   ========================================================= */
const rBpm = bindRange('rBpm');
const rLat = bindRange('rLat');
const rMsg = $('rMsg');
const timeline = $('rTimeline');
const head = $('rHead');

// sub = vuruş başına bölme sayısı, p = bir bölmede nota olma olasılığı
const LEVELS = { 1: { sub: 1, p: 0.6 }, 2: { sub: 2, p: 0.5 }, 3: { sub: 4, p: 0.4 } };

const R = {
  slots: [], sub: 2, bars: 1,
  phase: 'idle', taps: [],
  start: 0, total: 0, beat: 0.75, slotDur: 0.375,
  timer: null, raf: null, bus: null,
  tries: store.get('rTries', 0), perfect: store.get('rPerfect', 0),
  streak: 0, best: store.get('rBest', 0)
};

function genRhythm() {
  const lv = LEVELS[$('rLevel').value];
  R.sub = lv.sub;
  R.bars = +$('rBars').value;
  const n = R.bars * 4 * R.sub;
  let arr;
  do {
    arr = Array.from({ length: n }, (_, i) => i === 0 || Math.random() < lv.p);
  } while (arr.filter(Boolean).length < Math.min(3, n));
  R.slots = arr;
}

function pct(t) { return (t / R.total) * 100; }

function drawTimeline(result = null, extras = []) {
  timeline.querySelectorAll('.grid,.note,.tapmark').forEach(e => e.remove());
  const n = R.slots.length;
  if (!n) return;

  for (let i = 0; i < n; i++) {
    const g = document.createElement('div');
    g.className = 'grid' + (i % R.sub === 0 ? ' beat' : '') + (i % (4 * R.sub) === 0 ? ' bar' : '');
    g.style.left = (i / n * 100) + '%';
    timeline.appendChild(g);
  }

  const showNotes = result || $('rShow').checked;
  if (showNotes) {
    let k = 0;
    R.slots.forEach((on, i) => {
      if (!on) return;
      const d = document.createElement('div');
      d.className = 'note';
      if (result) d.classList.add(result[k].hit ? 'hit' : 'miss');
      d.style.left = (i / n * 100 + 0.4) + '%';
      d.style.width = (100 / n - 0.8) + '%';
      timeline.appendChild(d);
      k++;
    });
  }

  if (result) {
    result.filter(r => r.hit).forEach(r => addTapMark(r.t, false));
    extras.forEach(t => addTapMark(t, true));
  }
}

function addTapMark(t, extra) {
  if (t < -0.2 || t > R.total) return;
  const m = document.createElement('div');
  m.className = 'tapmark' + (extra ? ' extra' : '');
  m.style.left = Math.max(0, Math.min(100, pct(t))) + '%';
  timeline.appendChild(m);
}

function updateRStats() {
  $('rTries').textContent = R.tries;
  $('rPerfect').textContent = R.perfect;
  $('rStreak').textContent = R.streak;
  $('rBest').textContent = R.best;
  store.set('rTries', R.tries);
  store.set('rPerfect', R.perfect);
  store.set('rBest', R.best);
}

/* --- İmleç ve geri sayım animasyonu --- */
function animate() {
  const now = audio().currentTime;
  const count = $('rCount');
  if (now < R.start) {
    const c = Math.floor((now - (R.start - 4 * R.beat)) / R.beat) + 1;
    count.textContent = c >= 1 && c <= 4 ? c : '';
    head.style.opacity = 0;
  } else {
    count.textContent = '';
    head.style.opacity = 0.8;
    head.style.left = Math.min(100, pct(now - R.start)) + '%';
  }
  R.raf = requestAnimationFrame(animate);
}
function stopAnim() {
  cancelAnimationFrame(R.raf); R.raf = null;
  head.style.opacity = 0;
  $('rCount').textContent = '';
}

function cancelRhythm() {
  clearTimeout(R.timer);
  stopAnim();
  killBus(R.bus); R.bus = null;
  R.phase = 'idle';
}

// mode: 'listen' (ritmi çal) | 'record' (kullanıcıyı kaydet)
function runRhythm(mode) {
  if (!R.slots.length) return;
  cancelRhythm();
  const a = audio();
  R.bus = newBus();
  R.beat = 60 / +rBpm.value;
  R.slotDur = R.beat / R.sub;
  const nBeats = R.bars * 4;
  const t0 = a.currentTime + 0.15;
  R.start = t0 + 4 * R.beat;
  R.total = nBeats * R.beat;

  // 4 vuruşluk giriş
  for (let i = 0; i < 4; i++) click(t0 + i * R.beat, i === 0 ? 1600 : 1100, 0.12, R.bus);
  // Metronom
  if ($('rMetro').checked) {
    for (let b = 0; b < nBeats; b++) click(R.start + b * R.beat, b % 4 === 0 ? 1600 : 1100, 0.05, R.bus);
  }
  // Ritim
  if (mode === 'listen') {
    R.slots.forEach((on, i) => { if (on) drum(R.start + i * R.slotDur, 0.6, 320, R.bus); });
  }

  R.taps = [];
  R.phase = mode === 'listen' ? 'playing' : 'recording';
  drawTimeline();
  setMsg(rMsg, mode === 'listen'
    ? '🎧 Dinle… (4 vuruş giriş)'
    : '⏳ Hazırlan… 4 vuruştan sonra çal! (Boşluk veya DOKUN)', mode === 'record' ? 'info' : '');
  animate();

  const endIn = (R.start + R.total + R.beat * 0.6 - a.currentTime) * 1000;
  R.timer = setTimeout(() => {
    stopAnim();
    if (mode === 'record') evaluate();
    else {
      R.phase = 'idle';
      setMsg(rMsg, 'Hazır olunca “Sıra bende”ye bas (veya Enter).');
    }
  }, endIn);
}

function tap() {
  const a = audio();
  drum(a.currentTime, 0.3, 520);
  const pad = $('tapPad');
  pad.classList.add('hit');
  setTimeout(() => pad.classList.remove('hit'), 90);

  if (R.phase !== 'recording') return;
  // Ses çıkış gecikmesi + kullanıcı ayarı kadar düzelt
  const lat = (a.outputLatency || 0) + (+rLat.value) / 1000;
  const t = a.currentTime - R.start - lat;
  R.taps.push(t);
  if (t >= 0) addTapMark(t, false);
}

function evaluate() {
  R.phase = 'idle';
  const tol = Math.min(0.13, R.slotDur * 0.45); // tolerans (saniye)
  const expected = [];
  R.slots.forEach((on, i) => { if (on) expected.push(i * R.slotDur); });

  // Giriş sırasında yapılan vuruşları yok say
  const taps = R.taps.filter(t => t >= -tol && t < R.total);
  const used = new Array(taps.length).fill(false);

  const result = expected.map(e => {
    let best = -1, bd = Infinity;
    taps.forEach((t, j) => {
      const d = Math.abs(t - e);
      if (!used[j] && d <= tol && d < bd) { bd = d; best = j; }
    });
    if (best >= 0) { used[best] = true; return { e, t: taps[best], hit: true }; }
    return { e, hit: false };
  });
  const extras = taps.filter((_, j) => !used[j]);
  const hits = result.filter(r => r.hit);
  const misses = expected.length - hits.length;
  const acc = Math.round(100 * hits.length / (expected.length + extras.length));
  const avgMs = hits.length ? hits.reduce((s, r) => s + (r.t - r.e), 0) / hits.length * 1000 : 0;

  drawTimeline(result, extras);

  R.tries++;
  const perfect = misses === 0 && extras.length === 0;
  if (perfect) { R.perfect++; R.streak++; R.best = Math.max(R.best, R.streak); }
  else R.streak = 0;
  updateRStats();

  let tendency = '';
  if (hits.length && Math.abs(avgMs) > 25) {
    tendency = ` Ortalama ${Math.abs(Math.round(avgMs))} ms ${avgMs < 0 ? 'erken' : 'geç'} vuruyorsun.`;
  }

  if (!R.taps.length) {
    setMsg(rMsg, 'Hiç vuruş algılanmadı. Boşluk tuşuna ya da DOKUN düğmesine bas.', 'bad');
  } else if (perfect) {
    setMsg(rMsg, `✓ Kusursuz! %${acc} doğruluk.${tendency} Devam için “Yeni ritim”.`, 'good');
  } else {
    const parts = [];
    if (misses) parts.push(`${misses} vuruş kaçtı`);
    if (extras.length) parts.push(`${extras.length} fazla vuruş`);
    setMsg(rMsg, `%${acc} doğruluk — ${parts.join(', ')}.${tendency} Tekrar dinleyip yeniden dene.`, 'bad');
  }
}

$('rNew').addEventListener('click', () => {
  genRhythm();
  $('rReplay').disabled = false;
  $('rGo').disabled = false;
  runRhythm('listen');
});
$('rReplay').addEventListener('click', () => runRhythm('listen'));
$('rGo').addEventListener('click', () => runRhythm('record'));
$('rShow').addEventListener('change', () => { if (R.phase === 'idle') drawTimeline(); });
$('tapPad').addEventListener('pointerdown', e => { e.preventDefault(); tap(); });

updateRStats();

/* =========================================================
   Klavye kısayolları
   ========================================================= */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT') return;
  if (e.code === 'Space') e.preventDefault();
  if (e.repeat) return;

  if (activeTab === 'melody') {
    if (KEYMAP[e.code] !== undefined) pressNote(KEYMAP[e.code]);
  } else {
    if (e.code === 'Space') tap();
    else if (e.key === 'Enter' && R.slots.length) { e.preventDefault(); runRhythm('record'); }
  }
});
document.addEventListener('keyup', e => { if (e.code === 'Space') e.preventDefault(); });
