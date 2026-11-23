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

/* --- Piyano sesi (sentez) ---
   Ses dosyası kullanmadan, internetsiz çalışır:
   - harmonikleri zengin bir dalga + hafif akortsuz ikinci tel (koro etkisi)
   - zamanla kapanan alçak geçiren süzgeç (ses önce parlak, sonra yumuşar)
   - iki aşamalı sönüm (hızlı ilk düşüş + uzun kuyruk)
   - çekiç vuruşu için kısa bir gürültü patlaması
   - nota bitince "susturucu" (damper) ile kısa bırakış */
let pianoWave = null, noiseBuf = null;
function pianoParts() {
  const a = audio();
  if (!pianoWave) {
    const N = 16, real = new Float32Array(N + 1), imag = new Float32Array(N + 1);
    for (let n = 1; n <= N; n++) {
      // Çekiç teli ~1/7 noktasından vurur: o harmonikler zayıf kalır
      const strike = Math.abs(Math.sin(Math.PI * n / 7)) * 0.8 + 0.2;
      imag[n] = strike / Math.pow(n, 1.1);
    }
    pianoWave = a.createPeriodicWave(real, imag);
    const len = Math.floor(a.sampleRate * 0.05);
    noiseBuf = a.createBuffer(1, len, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return { wave: pianoWave, noise: noiseBuf };
}

function tone(midi, when, dur = 0.45, vol = 0.3, dest = audio().destination) {
  const a = audio();
  const { wave, noise } = pianoParts();
  const f = midiToFreq(midi);
  const end = when + Math.max(dur, 0.12);         // susturucunun indiği an
  const decay = 1.6 * Math.pow(261.6 / f, 0.5);   // pes notalar daha uzun çınlar

  const out = a.createGain();
  out.gain.setValueAtTime(0.0001, when);
  out.gain.exponentialRampToValueAtTime(vol, when + 0.004);
  out.gain.setTargetAtTime(vol * 0.35, when + 0.004, 0.09);  // ilk hızlı düşüş
  out.gain.setTargetAtTime(0.0001, when + 0.3, decay);        // uzun kuyruk
  out.gain.cancelScheduledValues(end);
  out.gain.setTargetAtTime(0.0001, end, 0.07);                // bırakış
  out.connect(dest);

  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.5;
  lp.frequency.setValueAtTime(Math.min(f * 14, 16000), when);
  lp.frequency.setTargetAtTime(Math.min(f * 3, 8000), when + 0.01, 0.35);
  lp.connect(out);

  const stopAt = end + 0.5;
  [-1.5, 1.5].forEach(cents => {
    const o = a.createOscillator();
    o.setPeriodicWave(wave);
    o.frequency.value = f;
    o.detune.value = cents;
    const g = a.createGain(); g.gain.value = 0.5;
    o.connect(g).connect(lp);
    o.start(when); o.stop(stopAt);
  });

  // Çekiç sesi
  const n = a.createBufferSource(); n.buffer = noise;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = Math.min(f * 4, 6000); bp.Q.value = 1.2;
  const ng = a.createGain(); ng.gain.value = vol * 0.25;
  n.connect(bp).connect(ng).connect(dest);
  n.start(when);
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

// Ritim kalıpları: her hücre bir ya da iki vuruşu doldurur (süreler vuruş cinsinden).
// Hücreler hep tam vuruşta biter, böylece ezgi vuruşa oturur.
const T = 1 / 3;
const RCELLS = {
  even:   [[1]],
  simple: [[1], [1], [0.5, 0.5], [2]],
  dotted: [[1], [0.5, 0.5], [2], [1.5, 0.5], [0.75, 0.25], [0.5, 1, 0.5]],
  mixed:  [[1], [0.5, 0.5], [2], [1.5, 0.5], [0.75, 0.25], [0.5, 1, 0.5],
           [0.25, 0.25, 0.5], [0.5, 0.25, 0.25], [0.25, 0.25, 0.25, 0.25], [T, T, T]]
};

function genDurations(n, style) {
  const cells = RCELLS[style] || RCELLS.even;
  let best = null;
  for (let tries = 0; tries < 30; tries++) {
    const out = [];
    // Son nota hariç hepsini tam hücrelerle doldur (kalıplar yarıda kesilmesin)
    while (out.length < n - 1) {
      const fit = cells.filter(c => c.length <= n - 1 - out.length);
      out.push(...pick(fit));
    }
    // Son nota vuruş başında başlar, en az bir vuruş sürer (ezgi "bitmiş" duyulsun)
    out.push(style === 'even' ? 1 : pick([1, 1, 2]));
    best = out;
    // Düz olmayan stillerde en az bir farklı süre olsun
    if (style === 'even' || n < 2 || out.slice(0, -1).some(d => d !== 1)) break;
  }
  return best;
}

function durName(d) {
  if (Math.abs(d - T) < 0.01) return 'üçleme sekizlik';
  return ({ 2: 'ikilik', 1.5: 'noktalı dörtlük', 1: 'dörtlük', 0.75: 'noktalı sekizlik',
            0.5: 'sekizlik', 0.25: 'on altılık' })[d] || `${d} vuruş`;
}

// Fiziksel tuş konumuna göre (klavye düzeninden bağımsız)
const KEYMAP = {
  KeyA: 60, KeyW: 61, KeyS: 62, KeyE: 63, KeyD: 64, KeyF: 65, KeyT: 66,
  KeyG: 67, KeyY: 68, KeyH: 69, KeyU: 70, KeyJ: 71, KeyK: 72
};

const mLen = bindRange('mLen');
const mBpm = bindRange('mBpm');
const mMsg = $('mMsg');

const M = {
  target: [], durs: [], input: [], phase: 'idle', revealed: false,
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
    let label = '?';
    if (inp !== undefined) {
      label = noteName(inp);
      d.classList.add(inp === t ? 'ok' : 'bad');
    } else if (M.revealed) {
      label = noteName(t);
      d.classList.add('reveal');
    }
    const name = document.createElement('span');
    name.textContent = label;
    d.appendChild(name);
    // Notanın süresini gösteren çubuk (2 vuruş = tam genişlik)
    const dur = M.durs[i] || 1;
    const bar = document.createElement('i');
    bar.className = 'dur';
    bar.style.width = Math.min(100, dur * 50) + '%';
    d.title = durName(dur);
    d.appendChild(bar);
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
  stopListening();
}

function playMelody() {
  stopMelody();
  const a = audio();
  M.bus = newBus();
  const beat = 60 / +mBpm.value;
  // Giriş: bir ölçü (4 vuruş) metronom, ezgi ondan sonra başlar
  const countIn = $('mCount').checked ? 4 : 0;
  const lead = 0.15 + countIn * beat;
  const t0 = a.currentTime + lead;
  for (let i = 0; i < countIn; i++) {
    click(t0 - (countIn - i) * beat, i === 0 ? 1600 : 1100, 0.08, M.bus);
  }
  M.phase = 'playing'; M.input = []; M.revealed = false;
  renderSlots();
  setMsg(mMsg, countIn ? '🎧 Dinle… (4 vuruş giriş)' : '🎧 Dinle…');

  let pos = 0; // vuruş cinsinden konum
  M.target.forEach((m, i) => {
    const d = M.durs[i] || 1;
    // Legato: nota bir sonrakine kadar sürer (son nota biraz daha uzun çınlar)
    const len = d * beat * (i === M.target.length - 1 ? 1.3 : 0.98);
    tone(m, t0 + pos * beat, len, 0.32, M.bus);
    if ($('mShow').checked) {
      M.timers.push(setTimeout(() => flashKey(m, Math.max(120, d * beat * 850)), (lead + pos * beat) * 1000));
    }
    pos += d;
  });
  const lastD = M.durs[M.target.length - 1] || 1;
  if (voiceMode()) {
    // Mikrofon, ezginin son notası tamamen sönünce açılır (hoparlör sesi algılanmasın)
    const tMic = lead + (pos + lastD * 0.3) * beat + 0.4;
    M.timers.push(setTimeout(startListening, tMic * 1000));
  } else {
    M.timers.push(setTimeout(() => {
      M.phase = 'answering';
      setMsg(mMsg, '🎹 Şimdi sen çal!', 'info');
    }, (lead + (pos - lastD * 0.3) * beat) * 1000));
  }
}

function newMelody() {
  M.target = genMelody(+mLen.value, SCALES[$('mScale').value]);
  M.durs = genDurations(M.target.length, $('mRhythm').value);
  $('mReplay').disabled = false;
  playMelody();
}

function pressNote(m) {
  if (M.phase === 'playing') return;
  // Sesle cevap verilirken piyano susar (mikrofon onu da duyardı)
  if (voiceMode() && M.phase === 'answering') return;
  tone(m, audio().currentTime);
  flashKey(m);
  if (M.phase !== 'answering') return;
  answerNote(m);
}

// Bir cevap notasını değerlendirir (klavyeden ya da sesten gelir)
function answerNote(m) {
  const i = M.input.length;
  M.input.push(m);
  const verb = voiceMode() ? 'söyledin' : 'çaldın';

  if (m !== M.target[i]) {
    M.phase = 'idle';
    stopListening();
    M.streak = 0;
    M.revealed = true;
    renderSlots();
    setMsg(mMsg,
      `✗ ${i + 1}. nota yanlış: ${noteName(m)} ${verb}, doğrusu ${noteName(M.target[i])}. ` +
      `“Tekrar dinle / dene” ile yeniden deneyebilirsin.`, 'bad');
    updateMStats();
    return;
  }

  renderSlots();
  if (M.input.length === M.target.length) {
    M.phase = 'idle';
    stopListening();
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

/* =========================================================
   SESLE CEVAP (mikrofon)
   Öğrenci duyduğu ezgiyi söyler; perde YIN yöntemiyle bulunur,
   sesler notalara bölünür ve sırayla değerlendirilir.
   ========================================================= */
const voiceMode = () => $('mAnswer').value === 'voice';
const micLive = $('mMic'), micNote = $('mMicNote'), micLevel = $('mMicLevel');

const V = {
  stream: null, src: null, an: null, buf: null, timer: null,
  octave: null,        // öğrencinin oktav kayması (erkek sesi 1 oktav pes söyleyebilir)
  cur: null,           // şu an süren (kabul edilmiş) nota
  cand: null,          // nota olmaya aday ses parçası
  gap: 0,              // art arda sessiz kare sayısı
  prev: null,          // bir önceki karenin perdesi
  lastNoteAt: 0, muteUntil: 0
};
const SHORT_NOTE = 0.05; // bir sesin nota sayılması için en kısa süre (sn); kısa notalar bitince kabul edilir
const LONG_NOTE = 0.2;   // bu kadar süren ses, bitmesi beklenmeden nota olarak kabul edilir
const SILENCE_END = 5;   // bu kadar saniye ses gelmezse cevap bitmiş sayılır

// YIN perde bulma. Sonuç Hz ya da -1 (ses yok / güvenilmez).
function yinPitch(x, sr) {
  const W = 1024;
  const tauMin = Math.floor(sr / 1100), tauMax = Math.min(Math.floor(sr / 65), x.length - W - 1);
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) { const v = x[j] - x[j + tau]; s += v * v; }
    d[tau] = s;
  }
  // Toplamsal ortalamayla normalleştir (YIN'in 3. adımı)
  d[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    run += d[tau];
    d[tau] = run ? d[tau] * tau / run : 1;
  }
  let tau = -1;
  for (let t = tauMin + 1; t < tauMax; t++) {
    if (d[t] < 0.15) {
      while (t + 1 < tauMax && d[t + 1] < d[t]) t++;
      tau = t; break;
    }
  }
  if (tau < 0) return -1;
  const a = d[tau - 1], b = d[tau], c = d[tau + 1];
  const den = a + c - 2 * b;
  const t0 = den ? tau + (a - c) / (2 * den) : tau;
  return sr / t0;
}

async function openMic() {
  if (V.stream) return true;
  try {
    // Tarayıcının ses işlemeleri perdeyi bozmasın diye kapatılır
    V.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
  } catch (_) {
    setMsg(mMsg, '🎤 Mikrofona erişilemedi. Tarayıcıda mikrofon izni ver ve tekrar dene.', 'bad');
    return false;
  }
  const a = audio();
  V.src = a.createMediaStreamSource(V.stream);
  V.an = a.createAnalyser();
  V.an.fftSize = 2048;
  V.buf = new Float32Array(V.an.fftSize);
  V.src.connect(V.an); // hoparlöre bağlanmaz, yalnızca dinlenir
  return true;
}

function closeMic() {
  stopListening();
  if (!V.stream) return;
  V.src.disconnect();
  V.stream.getTracks().forEach(t => t.stop());
  V.stream = null;
}

async function startListening() {
  if (!(await openMic())) { M.phase = 'idle'; return; }
  stopListening();
  M.phase = 'answering';
  V.octave = null; V.cur = null; V.cand = null; V.gap = 0; V.prev = null;
  V.lastNoteAt = audio().currentTime;
  micLive.classList.add('on');
  micNote.textContent = '–';
  setMsg(mMsg, '🎤 Şimdi söyle! (aynı nota tekrar ediyorsa araya kısa bir boşluk bırak)', 'info');
  V.timer = setInterval(listenFrame, 20);
}

function stopListening() {
  clearInterval(V.timer); V.timer = null;
  micLive.classList.remove('on');
  micLevel.style.width = '0%';
}

function listenFrame() {
  if (M.phase !== 'answering') { stopListening(); return; }
  const a = audio(), now = a.currentTime;
  V.an.getFloatTimeDomainData(V.buf);

  let rms = 0;
  for (let i = 0; i < V.buf.length; i++) rms += V.buf[i] * V.buf[i];
  rms = Math.sqrt(rms / V.buf.length);
  micLevel.style.width = Math.min(100, rms * 600) + '%';

  const f = (rms > 0.01 && now >= V.muteUntil) ? yinPitch(V.buf, a.sampleRate) : -1;

  if (f < 0) {
    // Sessizlik: 3 kare (~60 ms) sürerse nota biter, sonraki ses yeni notadır
    if (++V.gap >= 3) {
      closeCand();
      V.cur = null; V.prev = null;
      micNote.textContent = '–';
      if (M.phase !== 'answering') return; // son nota az önce kabul edildi
    }
    if (now - V.lastNoteAt > SILENCE_END) {
      M.phase = 'idle';
      stopListening();
      M.streak = 0; M.revealed = true;
      renderSlots(); updateMStats();
      const n = M.input.length;
      setMsg(mMsg, n
        ? `⏱ Ezgi yarım kaldı: ${M.target.length} notadan ${n} tanesini söyledin. Doğrusu yukarıda.`
        : '⏱ Ses algılanmadı. Mikrofonu kontrol edip “Tekrar dinle / dene”ye bas.', 'bad');
    }
    return;
  }
  V.gap = 0;
  const midi = 69 + 12 * Math.log2(f / 440);

  // Canlı gösterge: duyulan nota ve sapması
  const r = Math.round(midi), cents = Math.round((midi - r) * 100);
  micNote.textContent = `${NAMES[((r % 12) + 12) % 12]} ${cents >= 0 ? '+' : '−'}${Math.abs(cents)} sent`;

  const c = V.cand, cur = V.cur;
  // Ani sıçrama: iki kare arasında ≥0,7 yarım ses → yeni nota başlıyor
  // (vibrato bu kadar hızlı değişmez)
  const jump = V.prev !== null && Math.abs(midi - V.prev) >= 0.7;
  V.prev = midi;
  // Aday notaya uyuyor mu? Aralık 1,6 yarım sese kadar olabilir:
  // vibrato notayı bölmesin, ama kayışlar (glissando) nota sayılmasın.
  const fitsCand = !jump && c && Math.max(c.hi, midi) - Math.min(c.lo, midi) < 1.6;
  // Süren notanın içinde mi? (vibrato, küçük kayma)
  const nearCur = !jump && cur && Math.abs(midi - cur.ref) < 0.85;

  if (fitsCand && (!nearCur || Math.abs(midi - trimMean(c.p)) <= Math.abs(midi - cur.ref))) {
    c.p.push(midi); c.last = now; c.miss = 0;
    c.hi = Math.max(c.hi, midi); c.lo = Math.min(c.lo, midi);
    // Uzun nota: bir vibrato döngüsü kadar dinlendikten sonra hemen kabul edilir
    if (now - c.start >= LONG_NOTE) closeCand();
  } else if (nearCur) {
    cur.p.push(midi);
    if (cur.p.length > 25) cur.p.shift();
    cur.ref = trimMean(cur.p);
    V.lastNoteAt = now;
    if (c && ++c.miss >= 2) closeCand();
  } else {
    closeCand();
    V.cand = { p: [midi], hi: midi, lo: midi, start: now, last: now, miss: 0 };
  }
}

// Aday notayı kapatır: yeterince uzun sürdüyse nota olarak kabul edilir.
function closeCand() {
  const c = V.cand;
  V.cand = null;
  if (!c || c.last - c.start < SHORT_NOTE) return;
  // Kayış (glissando) mı? Perde tek yöne belirgin biçimde değiştiyse nota sayılmaz.
  // (Vibrato bir aşağı bir yukarı gider; toplam eğimi küçüktür.)
  if (Math.abs(drift(c.p)) > 0.9) return;
  const p = c.p.length > 3 ? c.p.slice(1) : c.p; // ilk kare çoğu zaman kaymadır
  const sung = trimMean(p);
  V.lastNoteAt = c.last;
  // Ses kesilmeden aynı perdede devam ediyorsa yeni nota değil, süren notanın devamıdır
  // (aynı notayı tekrar söylemek için araya sessizlik gerekir)
  if (V.cur && Math.abs(sung - V.cur.ref) < 0.5) {
    V.cur.p.push(...p);
    V.cur.p.splice(0, Math.max(0, V.cur.p.length - 25));
    return;
  }
  V.cur = { ref: sung, p };
  commitSung(sung);
}

// Doğrusal eğilim: kareler boyunca perdenin toplam değişimi (yarım ses)
function drift(p) {
  const n = p.length;
  if (n < 3) return 0;
  const mx = (n - 1) / 2, my = p.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  p.forEach((y, x) => { sxy += (x - mx) * (y - my); sxx += (x - mx) * (x - mx); });
  return (sxy / sxx) * (n - 1);
}

// Uç değerleri atıp ortalama al (vibrato simetrik olduğundan merkezi verir)
function trimMean(arr) {
  const s = [...arr].sort((p, q) => p - q);
  const k = Math.floor(s.length / 5);
  const mid = s.slice(k, s.length - k || undefined);
  return mid.reduce((a, b) => a + b, 0) / mid.length;
}

function commitSung(sung) {
  const i = M.input.length;
  // Oktav: ilk notada öğrencinin hangi oktavda söylediğine bakılır,
  // sonra bütün ezgi o oktava göre değerlendirilir (aralıklar korunur).
  if (V.octave === null) V.octave = Math.round((sung - M.target[i]) / 12);
  const m = Math.round(sung - 12 * V.octave);
  flashKey(m, 250);
  answerNote(m);
}

$('mAnswer').addEventListener('change', () => {
  stopMelody();
  if (M.phase === 'answering') M.phase = 'idle';
  $('mVoiceHint').hidden = !voiceMode();
  if (voiceMode()) openMic(); // izni şimdiden iste
  else closeMic();
});
$('mVoiceHint').hidden = !voiceMode();

$('mNew').addEventListener('click', newMelody);
$('mReplay').addEventListener('click', () => { if (M.target.length) playMelody(); });
$('mRef').addEventListener('click', () => {
  tone(60, audio().currentTime, 0.9); flashKey(60, 600);
  // Sesle cevap sırasında referans sesi algılanmasın
  V.muteUntil = audio().currentTime + 1.4;
  V.cur = null; V.cand = null;
});

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
