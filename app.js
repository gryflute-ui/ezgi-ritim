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

// Bırakış: susturucu inince sesin sönme hızı (zaman sabiti, sn) ve sesin tamamen
// sönmesi için gereken süre. Mikrofon bu süre kadar bekledikten sonra açılır.
const PIANO_RELEASE = 0.16;
const PIANO_TAIL = PIANO_RELEASE * 6 + 0.1;
// Tuşa basınca notanın çınlama süresi (sn)
const KEY_SUSTAIN = 1.6;

function tone(midi, when, dur = KEY_SUSTAIN, vol = 0.3, dest = audio().destination) {
  const a = audio();
  const { wave, noise } = pianoParts();
  const f = midiToFreq(midi);
  const end = when + Math.max(dur, 0.12);         // susturucunun indiği an
  const decay = 3.2 * Math.pow(261.6 / f, 0.5);   // uzun kuyruk; pes notalar daha uzun çınlar

  const out = a.createGain();
  out.gain.setValueAtTime(0.0001, when);
  out.gain.exponentialRampToValueAtTime(vol, when + 0.004);
  out.gain.setTargetAtTime(vol * 0.5, when + 0.004, 0.12);   // ilk düşüş
  out.gain.setTargetAtTime(0.0001, when + 0.35, decay);       // uzun kuyruk
  out.gain.cancelScheduledValues(end);
  out.gain.setTargetAtTime(0.0001, end, PIANO_RELEASE);       // bırakış (susturucu)
  out.connect(dest);

  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.5;
  lp.frequency.setValueAtTime(Math.min(f * 14, 16000), when);
  lp.frequency.setTargetAtTime(Math.min(f * 3, 8000), when + 0.01, 0.35);
  lp.connect(out);

  const stopAt = end + PIANO_TAIL;
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
// rng: rastgele sayı üreteci (sınavda herkes aynı soruları alsın diye tohumlu olabilir)
const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];

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
function setTab(name) {
  activeTab = name;
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === name));
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

/* =========================================================
   EZGİ TEKRARI
   ========================================================= */
/* ---------------- Müzik kuramı: ölçüler, diziler, tonlar, adlandırma ---------------- */
const NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const LETTERS = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

// Ölçüler. Vuruş (beat) birimi: basit ölçülerde dörtlük, 6/8'de noktalı dörtlük.
// beatQ: bir vuruş kaç dörtlük; barQ: bir ölçü kaç dörtlük. Tempo (BPM) vuruşa göredir.
const METERS = {
  '4/4': { key: '4/4', num: 4, den: 4, beats: 4, beatQ: 1, barQ: 4, compound: false },
  '3/4': { key: '3/4', num: 3, den: 4, beats: 3, beatQ: 1, barQ: 3, compound: false },
  '2/4': { key: '2/4', num: 2, den: 4, beats: 2, beatQ: 1, barQ: 2, compound: false },
  '6/8': { key: '6/8', num: 6, den: 8, beats: 2, beatQ: 1.5, barQ: 3, compound: true }
};
const meterOf = k => METERS[k] || METERS['4/4'];
// Giriş vuruşu: bir ölçü; 2/4 ve 6/8'de iki ölçü (yoksa çok kısa kalır)
const countInBeats = mt => mt.beats >= 3 ? mt.beats : mt.beats * 2;

// Diziler: tondan itibaren yarım ses aralıkları (iv) ve her derecenin harf (nota adı) kayması (let).
// Makamlar 12 eşit perdeye (piyano perdelerine) yaklaştırılmıştır.
const SCALE_DEFS = {
  major:    { label: 'Majör',                 iv: [0, 2, 4, 5, 7, 9, 11], let: [0, 1, 2, 3, 4, 5, 6] },
  pent:     { label: 'Pentatonik',            iv: [0, 2, 4, 7, 9],        let: [0, 1, 2, 4, 5] },
  minor:    { label: 'Doğal minör',           iv: [0, 2, 3, 5, 7, 8, 10], let: [0, 1, 2, 3, 4, 5, 6] },
  harmonic: { label: 'Armonik minör',         iv: [0, 2, 3, 5, 7, 8, 11], let: [0, 1, 2, 3, 4, 5, 6] },
  melodic:  { label: 'Melodik minör (çıkıcı)', iv: [0, 2, 3, 5, 7, 9, 11], let: [0, 1, 2, 3, 4, 5, 6] },
  hicaz:    { label: 'Hicaz (≈)',             iv: [0, 1, 4, 5, 7, 8, 10], let: [0, 1, 2, 3, 4, 5, 6] },
  kurdi:    { label: 'Kürdi (≈)',             iv: [0, 1, 3, 5, 7, 8, 10], let: [0, 1, 2, 3, 4, 5, 6] },
  nihavend: { label: 'Nihavend (≈)',          iv: [0, 2, 3, 5, 7, 8, 11], let: [0, 1, 2, 3, 4, 5, 6] },
  chrom:    { label: 'Kromatik',              iv: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], let: null }
};
// Eski sürümle uyum: SCALES[ad] doğrulama için kullanılır
const SCALES = SCALE_DEFS;

// Ton (dizinin başladığı nota): MIDI, harf, değiştirme
const TONICS = {
  60: { label: 'Do',  letter: 0, acc: 0 },  62: { label: 'Re',  letter: 1, acc: 0 },
  63: { label: 'Mi♭', letter: 2, acc: -1 }, 64: { label: 'Mi',  letter: 2, acc: 0 },
  65: { label: 'Fa',  letter: 3, acc: 0 },  67: { label: 'Sol', letter: 4, acc: 0 },
  69: { label: 'La',  letter: 5, acc: 0 },  70: { label: 'Si♭', letter: 6, acc: -1 }
};

// Bir dizi + ton için "anahtar" (ezgi bağlamı): notalar ve adlandırma bilgisi
function makeKey(scale, tonic) {
  const def = SCALE_DEFS[scale] || SCALE_DEFS.major;
  tonic = TONICS[tonic] ? +tonic : 60;
  const notes = def.iv.map(i => tonic + i).concat(tonic + 12);
  let flats = TONICS[tonic].acc < 0;
  if (def.let) {
    def.iv.forEach((iv, d) => {
      const letter = (TONICS[tonic].letter + def.let[d]) % 7;
      const acc = (((tonic + iv - LETTER_PC[letter]) % 12) + 18) % 12 - 6;
      if (acc < 0) flats = true;
    });
  }
  return { scale: def === SCALE_DEFS[scale] ? scale : 'major', tonic, flats, notes };
}

// Notanın yazımı: harf, değiştirme (−1/0/1), oktav (Do4 = orta Do)
function spell(m, key) {
  let letter, acc;
  const def = key && SCALE_DEFS[key.scale];
  if (def && def.let) {
    const iv = (((m - key.tonic) % 12) + 12) % 12;
    const d = def.iv.indexOf(iv);
    if (d >= 0) {
      letter = (TONICS[key.tonic].letter + def.let[d]) % 7;
      acc = (((m - LETTER_PC[letter]) % 12) + 18) % 12 - 6;
    }
  }
  if (letter === undefined) {
    const pc = ((m % 12) + 12) % 12;
    const useFlat = key && key.flats && !LETTER_PC.includes(pc);
    if (useFlat) { letter = LETTER_PC.indexOf(pc + 1); acc = -1; }
    else { letter = LETTER_PC.lastIndexOf(LETTER_PC.filter(x => x <= pc).pop()); acc = pc - LETTER_PC[letter]; }
  }
  const oct = Math.floor((m - acc) / 12) - 1;
  return { letter, acc, oct };
}
function noteName(m, key) {
  const s = spell(m, key);
  return LETTERS[s.letter] + (s.acc > 0 ? '#'.repeat(s.acc) : '♭'.repeat(-s.acc)) + "'".repeat(Math.max(0, s.oct - 4));
}
// Porte konumu: alt çizgi Mi4 = 0
const staffStep = s => (s.oct - 4) * 7 + s.letter - 2;

// Ritim kalıpları: her hücre tam vuruş(lar)ı doldurur (süreler vuruş cinsinden).
const T = 1 / 3, S6 = 1 / 6;
const RCELLS = {
  even:   [[1]],
  simple: [[1], [1], [0.5, 0.5], [2]],
  dotted: [[1], [0.5, 0.5], [2], [1.5, 0.5], [0.75, 0.25], [0.5, 1, 0.5]],
  mixed:  [[1], [0.5, 0.5], [2], [1.5, 0.5], [0.75, 0.25], [0.5, 1, 0.5],
           [0.25, 0.25, 0.5], [0.5, 0.25, 0.25], [0.25, 0.25, 0.25, 0.25], [T, T, T]]
};
// 6/8 (bileşik ölçü): vuruş = noktalı dörtlük; 1/3 = sekizlik, 2/3 = dörtlük, 1/6 = on altılık
const RCELLS_C = {
  even:   [[1]],
  simple: [[1], [1], [2 / 3, T], [T, T, T], [2]],
  dotted: [[1], [2 / 3, T], [T, T, T], [2], [T, 2 / 3], [0.5, S6, T]],
  mixed:  [[1], [2 / 3, T], [T, T, T], [2], [T, 2 / 3], [0.5, S6, T],
           [S6, S6, T, T], [T, S6, S6, T], [S6, S6, S6, S6, T]]
};
const cellsFor = (style, mt) => ((mt.compound ? RCELLS_C : RCELLS)[style]) || RCELLS.even;
const cellBeats = c => c.reduce((a, b) => a + b, 0);
const EPS = 1e-6;

// n notalık ezgi için süreler. Hücreler ölçü çizgisini aşmaz; son nota ölçünün sonuna kadar sürer.
function genDurations(n, style, rng = Math.random, meter = METERS['4/4']) {
  const cells = cellsFor(style, meter);
  let best = null;
  for (let tries = 0; tries < 30; tries++) {
    const out = [];
    let inBar = 0; // ölçü içindeki konum (vuruş)
    // Son nota hariç hepsini tam hücrelerle doldur (kalıplar yarıda kesilmesin)
    while (out.length < n - 1) {
      const left = meter.beats - inBar;
      const fit = cells.filter(c => c.length <= n - 1 - out.length && cellBeats(c) <= left + EPS);
      const c = pick(fit.length ? fit : [[1]], rng);
      out.push(...c);
      inBar += cellBeats(c);
      if (inBar >= meter.beats - EPS) inBar = 0;
    }
    // Son nota vuruş başında başlar ve ölçüyü tamamlar (ezgi "bitmiş" duyulsun)
    out.push(style === 'even' ? 1 : (inBar ? meter.beats - inBar : meter.beats));
    best = out;
    // Düz olmayan stillerde en az bir farklı süre olsun
    if (style === 'even' || n < 2 || out.slice(0, -1).some(d => Math.abs(d - 1) > EPS)) break;
  }
  return best;
}

// Belirli sayıda ölçüyü tam dolduran ritim (ritim tekrarı / okuma için)
function genRhythmBars(bars, style, rng = Math.random, meter = METERS['4/4']) {
  const cells = cellsFor(style, meter);
  let out;
  for (let tries = 0; tries < 40; tries++) {
    out = [];
    for (let b = 0; b < bars; b++) {
      let inBar = 0;
      while (inBar < meter.beats - EPS) {
        const fit = cells.filter(c => cellBeats(c) <= meter.beats - inBar + EPS);
        const c = pick(fit, rng);
        out.push(...c);
        inBar += cellBeats(c);
      }
    }
    const varied = style === 'even' || out.some(d => Math.abs(d - out[0]) > EPS);
    if (out.length >= Math.min(3, bars * meter.beats) && varied) break;
  }
  return out;
}

// Süre adı (dörtlük, sekizlik …); d vuruş cinsinden
function durName(d, meter = METERS['4/4']) {
  if (!meter.compound && Math.abs(d - T) < 0.01) return 'üçleme sekizlik';
  const q = d * meter.beatQ;
  const names = [[4, 'birlik'], [3, 'noktalı ikilik'], [2, 'ikilik'], [1.5, 'noktalı dörtlük'], [1, 'dörtlük'],
                 [0.75, 'noktalı sekizlik'], [0.5, 'sekizlik'], [0.25, 'on altılık']];
  const f = names.find(([v]) => Math.abs(v - q) < 0.01);
  return f ? f[1] : `${+d.toFixed(2)} vuruş`;
}
const durSet = mt => mt.compound ? [2, 1, 2 / 3, 0.5, T, S6] : [4, 3, 2, 1.5, 1, 0.75, 0.5, T, 0.25];

// Ezgiyi/ritmi porte için hazırla: süreler vuruştan dörtlüğe çevrilir
function toStaff(target, durs, meter, key, colorOf) {
  return durs.map((d, i) => {
    const n = { q: d * meter.beatQ, triplet: !meter.compound && Math.abs(d - T) < 0.01 };
    if (target) { const s = spell(target[i], key); n.step = staffStep(s); n.acc = s.acc; }
    if (colorOf) Object.assign(n, colorOf(i));
    return n;
  });
}
function staffSvg(target, durs, meter, key, colorOf) {
  return Notation.svg({ notes: toStaff(target, durs, meter, key, colorOf), meter, percussion: !target });
}

// Dizi / ton / ölçü açılır listelerini doldur (data-fill="scale|tonic|meter")
(function fillSelects() {
  document.querySelectorAll('select[data-fill]').forEach(sel => {
    const kind = sel.dataset.fill;
    const opts = kind === 'scale' ? Object.entries(SCALE_DEFS).map(([k, d]) => [k, d.label])
      : kind === 'tonic' ? Object.entries(TONICS).map(([k, t]) => [k, t.label])
      : Object.keys(METERS).map(k => [k, k]);
    if (sel.dataset.random) opts.push(['rand', 'Rastgele']);
    sel.innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    sel.value = sel.dataset.default;
  });
})();

// Bilgisayar klavyesi: fiziksel tuş konumuna göre (klavye düzeninden bağımsız).
// A…K bir oktav; Z / X ile bir oktav aşağı/yukarı kaydırılır.
const KEYMAP = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6,
  KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12
};
let kbOctave = 0; // 0: Do4–Do5, 12: Do5–Do6

const mLen = bindRange('mLen');
const mBpm = bindRange('mBpm');
const mMsg = $('mMsg');

const M = {
  target: [], durs: [], input: [], phase: 'idle', revealed: false,
  key: makeKey('major', 60),   // dizi + ton (nota adları için)
  meter: METERS['4/4'],
  times: [],      // cevap notalarının başlama anları (ritim için)
  beat: 0.75,     // çalınan ezginin vuruş süresi (sn)
  rbad: [],       // ritmi hatalı notaların sırası
  score: store.get('mScore', 0), streak: 0, best: store.get('mBest', 0),
  timers: [], bus: null
};

/* =========================================================
   RİTİM DEĞERLENDİRMESİ (söylenen/çalınan ezgi)
   Ardışık iki notanın başlama anları arasındaki süre, ezgideki nota
   süresiyle karşılaştırılır. Öğrencinin kendi temposu bulunur ve ona göre
   ölçülür (biraz hızlı/yavaş söylemek hata değildir). Son notanın süresi
   ölçülemez (ardından nota gelmez), bu yüzden n notalık ezgide n−1 aralık var.
   ========================================================= */
const RHYTHM_TOL = 0.35;                  // log2 cinsinden tolerans (%22 kısa … %27 uzun)
const TEMPO_MIN = 0.67, TEMPO_MAX = 1.5;  // duyulan tempoya göre kabul edilen vuruş süresi aralığı
const nearestDur = (b, mt) => durSet(mt).reduce((best, d) => Math.abs(Math.log2(b / d)) < Math.abs(Math.log2(b / best)) ? d : best);

function rhythmEval(target, durs, answer, times, beatSec) {
  const total = target.length - 1;
  const res = { total, ok: 0, score: total > 0 ? 0 : 1, items: [], tempo: 1 };
  if (total < 1 || !times || times.length < 2) return res;

  // Perde hizalamasından eşleşen nota çiftleri; ardışık eşleşmeler bir aralık verir
  const pairs = align(target, answer).ops.filter(o => o.ti !== undefined && o.aj !== undefined);
  let iv = [];
  for (let k = 1; k < pairs.length; k++) {
    const p = pairs[k - 1], q = pairs[k];
    if (q.ti === p.ti + 1 && q.aj === p.aj + 1) {
      iv.push({ i: p.ti, aj: p.aj, beats: durs[p.ti] || 1, got: times[q.aj] - times[p.aj] });
    }
  }
  iv = iv.filter(x => x.got > 0);
  if (!iv.length) return res;

  // Öğrencinin vuruş süresi: en çok aralığı doğru yapan aday. Duyulan tempodan uzaklaşmanın
  // bir bedeli var: öğrencinin tempoyu değiştirdiği, ancak bu varsayım belirgin biçimde daha çok
  // aralığı açıklıyorsa kabul edilir. Yoksa hata yanlış notalara yüklenebilirdi (ör. üçlemeyi
  // sekizlik söyleyen öğrenci "yavaş söyledi" sanılıp dörtlükleri hatalı görünürdü).
  const TEMPO_PENALTY = 2;
  const clampS = s => Math.min(beatSec * TEMPO_MAX, Math.max(beatSec * TEMPO_MIN, s));
  const okCount = s => iv.filter(x => Math.abs(Math.log2(x.got / (x.beats * s))) <= RHYTHM_TOL).length;
  const fit = s => okCount(s) - TEMPO_PENALTY * Math.abs(Math.log2(s / beatSec));
  let scale = beatSec, bestF = fit(beatSec);
  iv.forEach(x => {
    const s = clampS(x.got / x.beats), f = fit(s);
    if (f > bestF) { scale = s; bestF = f; }
  });
  const bestN = okCount(scale);
  // İnce ayar: doğru aralıkların ortanca temposu (doğru sayısı azalmıyorsa)
  const goodS = iv.filter(x => Math.abs(Math.log2(x.got / (x.beats * scale))) <= RHYTHM_TOL)
                  .map(x => x.got / x.beats).sort((a, b) => a - b);
  if (goodS.length) {
    const refined = clampS(goodS[Math.floor(goodS.length / 2)]);
    if (okCount(refined) >= bestN) scale = refined;
  }

  iv.forEach(x => {
    x.sung = x.got / scale;                 // vuruş cinsinden söylenen süre
    x.err = Math.log2(x.sung / x.beats);    // <0 kısa, >0 uzun
    x.ok = Math.abs(x.err) <= RHYTHM_TOL;
  });
  res.items = iv;
  res.ok = iv.filter(x => x.ok).length;
  res.score = res.ok / total;
  res.tempo = beatSec / scale;              // >1: daha hızlı söyledi
  return res;
}

// Ritim hatalarını okunur metne çevirir
function rhythmText(r, meter = METERS['4/4']) {
  const bad = r.items.filter(x => !x.ok);
  const parts = bad.slice(0, 3).map(x => {
    const near = nearestDur(x.sung, meter);
    const how = x.err < 0 ? 'kısa' : 'uzun';
    return Math.abs(near - x.beats) > EPS
      ? `${x.i + 1}. nota ${how} (${durName(x.beats, meter)} yerine ${durName(near, meter)} gibi)`
      : `${x.i + 1}. nota biraz ${how}`;
  });
  if (bad.length > 3) parts.push(`+${bad.length - 3} hata daha`);
  const missing = r.total - r.items.length;
  if (missing > 0) parts.push(`${missing} aralık değerlendirilemedi`);
  return parts.join('; ');
}
function tempoText(r, verb = 'söyledin') {
  if (!r.items.length) return '';
  if (r.tempo > 1.15) return ` Duyduğundan biraz hızlı ${verb} (ritim senin temponla ölçüldü).`;
  if (r.tempo < 0.87) return ` Duyduğundan biraz yavaş ${verb} (ritim senin temponla ölçüldü).`;
  return '';
}

/* --- Piyanoyu oluştur --- */
const piano = $('piano');
const keyEls = {};
// İki oktav: Do4 (60) – Do6 (84). Beyaz tuşlar eşit genişlikte, siyahlar aralarına.
const PIANO_LO = 60, PIANO_HI = 84;
const WHITES = [], BLACKS = {};
for (let m = PIANO_LO; m <= PIANO_HI; m++) {
  if (LETTER_PC.includes(m % 12)) WHITES.push(m);
  else BLACKS[m] = WHITES.length - 1; // hangi beyaz tuştan sonra
}
const whiteW = 100 / WHITES.length;
WHITES.forEach(m => {
  const k = document.createElement('div');
  k.className = 'key white'; k.dataset.midi = m;
  k.innerHTML = `<span>${noteName(m)}</span>`;
  piano.appendChild(k); keyEls[m] = k;
});
Object.entries(BLACKS).forEach(([m, i]) => {
  const k = document.createElement('div');
  k.className = 'key black'; k.dataset.midi = m;
  k.style.left = `calc(${(i + 1) * whiteW}% - ${whiteW * 0.3}%)`;
  k.style.width = (whiteW * 0.6) + '%';
  k.innerHTML = `<span>${noteName(+m)}</span>`;
  piano.appendChild(k); keyEls[m] = k;
});
// Bilgisayar klavyesinin çaldığı oktavı piyanoda göster
function markKbOctave() {
  Object.entries(keyEls).forEach(([m, k]) => k.classList.toggle('kb', m >= 60 + kbOctave && m <= 72 + kbOctave));
  const o = $('kbOct'); if (o) o.textContent = kbOctave ? 'Do5–Do6' : 'Do4–Do5';
}
markKbOctave();
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
      label = noteName(inp, M.key);
      d.classList.add(inp === t ? 'ok' : 'bad');
    } else if (M.revealed) {
      label = noteName(t, M.key);
      d.classList.add('reveal');
    }
    const name = document.createElement('span');
    name.textContent = label;
    d.appendChild(name);
    // Notanın süresini gösteren çubuk (2 vuruş = tam genişlik).
    // Cevaplanmadan gösterilmez, yoksa ritmi önceden ele verir.
    if (inp !== undefined || M.revealed) {
      const dur = M.durs[i] || 1;
      const bar = document.createElement('i');
      const rb = M.rbad.includes(i);
      bar.className = 'dur' + (rb ? ' rbad' : '');
      bar.style.width = Math.min(100, dur * 50) + '%';
      d.title = durName(dur, M.meter) + (rb ? ' — ritim hatalı' : '');
      d.appendChild(bar);
    }
    box.appendChild(d);
  });
  renderMStaff();
}

// Cevap bitince (ya da doğru ezgi gösterilince) ezgiyi portede göster
const COL = { ok: '#3ecf8e', bad: '#ff5d6c', warn: '#ffb547', muted: '#9097a8' };
function renderMStaff() {
  const box = $('mStaff');
  const done = M.target.length && M.phase === 'idle' && (M.revealed || M.input.length === M.target.length);
  box.hidden = !done;
  if (!done) { box.innerHTML = ''; return; }
  box.innerHTML = '<div class="staff-title">Ezginin notası</div>' + staffSvg(M.target, M.durs, M.meter, M.key, i => {
    const a = M.input[i];
    if (a === undefined) return { color: COL.muted };
    if (a !== M.target[i]) { const s = spell(a, M.key); return { color: COL.warn, ghost: { step: staffStep(s), acc: s.acc, color: COL.bad } }; }
    return { color: M.rbad.includes(i) ? COL.warn : COL.ok };
  });
}

function updateMStats() {
  $('mScore').textContent = M.score;
  $('mStreak').textContent = M.streak;
  $('mBest').textContent = M.best;
  store.set('mScore', M.score);
  store.set('mBest', M.best);
}

function genMelody(n, scale, rng = Math.random) {
  const out = [pick(scale, rng)];
  while (out.length < n) {
    const prev = out[out.length - 1];
    // Çok büyük sıçramaları engelle (en fazla tam beşli)
    out.push(pick(scale.filter(x => Math.abs(x - prev) <= 7), rng));
  }
  return out;
}

/* Bir ezgiyi çalar. Zamanlar (saniye, şimdiden itibaren) döner:
   keysAt: klavyeyle cevabın açılacağı an, micAt: mikrofonun açılacağı an
   (son nota tamamen sönünce, hoparlör sesi algılanmasın),
   notes: [midi, süre(sn), başlama(sn)] — tuş yakmak için. */
function playSeq(target, durs, { bpm, countIn = 0, refDo = false, bus, meter = METERS['4/4'] }) {
  const a = audio();
  const beat = 60 / bpm;
  let lead = 0.15;
  if (refDo) { tone(60, a.currentTime + lead, 1.0, 0.32, bus); lead += 1.0 + PIANO_TAIL; }
  const t0 = a.currentTime + lead + countIn * beat;
  // Giriş: bir ya da iki ölçü metronom (ölçü başı vurgulu), ezgi ondan sonra başlar
  for (let i = 0; i < countIn; i++) {
    click(t0 - (countIn - i) * beat, i % meter.beats === 0 ? 1600 : 1100, 0.08, bus);
  }
  lead += countIn * beat;
  let pos = 0; // vuruş cinsinden konum
  const notes = [];
  target.forEach((m, i) => {
    const d = durs[i] || 1;
    // Legato: nota bir sonrakine biraz taşar (piyanoda pedal gibi); son nota daha uzun çınlar
    const last = i === target.length - 1;
    const len = last ? Math.max(d * beat * 1.3, 1.2) : d * beat + 0.08;
    tone(m, t0 + pos * beat, len, 0.32, bus);
    notes.push([m, d * beat, lead + pos * beat]);
    pos += d;
  });
  const lastD = durs[target.length - 1] || 1;
  const lastStart = lead + (pos - lastD) * beat;
  return {
    keysAt: lead + (pos - lastD * 0.3) * beat,
    // Mikrofon, son notanın sesi tamamen sönünce açılır (hoparlör sesi algılanmasın)
    micAt: lastStart + Math.max(lastD * beat * 1.3, 1.2) + PIANO_TAIL,
    notes
  };
}

function stopMelody() {
  M.timers.forEach(clearTimeout); M.timers = [];
  killBus(M.bus); M.bus = null;
  stopListening();
}

function playMelody() {
  stopMelody();
  M.bus = newBus();
  const countIn = $('mCount').checked ? countInBeats(M.meter) : 0;
  M.phase = 'playing'; M.input = []; M.times = []; M.rbad = []; M.revealed = false;
  M.beat = 60 / +mBpm.value;
  renderSlots();
  setMsg(mMsg, countIn ? `🎧 Dinle… (${countIn} vuruş giriş)` : '🎧 Dinle…');

  const p = playSeq(M.target, M.durs, { bpm: +mBpm.value, countIn, bus: M.bus, meter: M.meter });
  if ($('mShow').checked) {
    p.notes.forEach(([m, len, at]) =>
      M.timers.push(setTimeout(() => flashKey(m, Math.max(120, len * 850)), at * 1000)));
  }
  if (voiceMode()) {
    M.timers.push(setTimeout(startMelodyListening, p.micAt * 1000));
  } else {
    M.timers.push(setTimeout(() => {
      M.phase = 'answering';
      setMsg(mMsg, '🎹 Şimdi sen çal!', 'info');
    }, p.keysAt * 1000));
  }
}

function newMelody() {
  const tv = $('mTonic').value;
  const tonic = tv === 'rand' ? +pick(Object.keys(TONICS)) : +tv;
  M.key = makeKey($('mScale').value, tonic);
  M.meter = meterOf($('mMeter').value);
  M.target = genMelody(+mLen.value, M.key.notes);
  M.durs = genDurations(M.target.length, $('mRhythm').value, Math.random, M.meter);
  $('mKeyInfo').textContent = `${TONICS[M.key.tonic].label} ${SCALE_DEFS[M.key.scale].label} · ${M.meter.key}`;
  $('mReplay').disabled = false;
  playMelody();
}

function pressNote(m) {
  if (activeTab === 'exam') { examKey(m); return; }
  if (M.phase === 'playing') return;
  // Sesle cevap verilirken piyano susar (mikrofon onu da duyardı)
  if (voiceMode() && M.phase === 'answering') return;
  tone(m, audio().currentTime);
  flashKey(m);
  if (M.phase !== 'answering') return;
  answerNote(m, audio().currentTime);
}

// Bir cevap notasını değerlendirir (klavyeden ya da sesten gelir).
// t: notanın başladığı an (ritim değerlendirmesi için)
function answerNote(m, t) {
  const i = M.input.length;
  M.input.push(m);
  M.times.push(t);
  const verb = voiceMode() ? 'söyledin' : 'çaldın';

  if (m !== M.target[i]) {
    M.phase = 'idle';
    stopListening();
    M.streak = 0;
    M.revealed = true;
    renderSlots();
    setMsg(mMsg,
      `✗ ${i + 1}. nota yanlış: ${noteName(m, M.key)} ${verb}, doğrusu ${noteName(M.target[i], M.key)}. ` +
      `“Tekrar dinle / dene” ile yeniden deneyebilirsin.`, 'bad');
    updateMStats();
    return;
  }

  renderSlots();
  if (M.input.length === M.target.length) {
    M.phase = 'idle';
    stopListening();

    // Perdeler doğru; ritim de değerlendirilsin mi?
    let rhythmNote = '';
    if ($('mREval').checked) {
      const r = rhythmEval(M.target, M.durs, M.input, M.times, M.beat);
      if (r.ok < r.total) {
        M.rbad = r.items.filter(x => !x.ok).map(x => x.i);
        M.streak = 0;
        renderSlots();
        setMsg(mMsg, `◐ Perdeler doğru, ama ritimde ${r.total - r.ok} hata var: ${rhythmText(r, M.meter)}.` +
          tempoText(r, verb) + ' Turuncu çubuklar ritmi hatalı notaları gösterir. “Tekrar dinle / dene” ile yeniden dene.', 'bad');
        updateMStats();
        return;
      }
      rhythmNote = ' Perde ve ritim doğru!' + tempoText(r, verb);
    }

    M.score++; M.streak++;
    M.best = Math.max(M.best, M.streak);
    let extra = '';
    if ($('mAuto').checked && M.streak % 3 === 0 && +mLen.value < +mLen.max) {
      mLen.value = +mLen.value + 1;
      mLen.dispatchEvent(new Event('input'));
      extra = ` Seviye atladın: artık ${mLen.value} nota! 🚀`;
    }
    setMsg(mMsg, '✓ Harika, doğru!' + rhythmNote + extra + ' Devam için “Yeni ezgi”.', 'good');
    updateMStats();
  }
}

/* =========================================================
   SESLE CEVAP (mikrofon)
   Öğrenci duyduğu ezgiyi söyler; perde YIN yöntemiyle bulunur,
   sesler notalara bölünür ve sırayla değerlendirilir.
   ========================================================= */
const voiceMode = () => $('mAnswer').value === 'voice';

const V = {
  stream: null, src: null, an: null, buf: null, timer: null,
  // Dinlemeyi kullanan bölüm (Ezgi sekmesi ya da Sınav):
  //   ref(): sıradaki beklenen nota (oktav tahmini için), onNote(m, başlama anı), onTimeout()
  handler: null,
  ui: null,            // { live, note, level } canlı gösterge öğeleri
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

// Mikrofonu açar ve dinlemeye başlar. Mikrofon açılamazsa false döner.
async function startListening(handler, ui) {
  if (!(await openMic())) return false;
  stopListening();
  V.handler = handler; V.ui = ui;
  V.octave = null; V.cur = null; V.cand = null; V.gap = 0; V.prev = null;
  V.lastNoteAt = audio().currentTime;
  ui.live.classList.add('on');
  ui.note.textContent = '–';
  V.timer = setInterval(listenFrame, 20);
  return true;
}

function stopListening() {
  clearInterval(V.timer); V.timer = null;
  V.handler = null;
  if (V.ui) { V.ui.live.classList.remove('on'); V.ui.level.style.width = '0%'; }
}

function listenFrame() {
  if (!V.handler) { stopListening(); return; }
  const a = audio(), now = a.currentTime;
  V.an.getFloatTimeDomainData(V.buf);

  let rms = 0;
  for (let i = 0; i < V.buf.length; i++) rms += V.buf[i] * V.buf[i];
  rms = Math.sqrt(rms / V.buf.length);
  V.ui.level.style.width = Math.min(100, rms * 600) + '%';

  const f = (rms > 0.01 && now >= V.muteUntil) ? yinPitch(V.buf, a.sampleRate) : -1;

  if (f < 0) {
    // Sessizlik: 3 kare (~60 ms) sürerse nota biter, sonraki ses yeni notadır
    if (++V.gap >= 3) {
      closeCand();
      V.cur = null; V.prev = null;
      if (!V.handler) return; // son nota az önce kabul edildi, dinleme bitti
      V.ui.note.textContent = '–';
    }
    if (now - V.lastNoteAt > SILENCE_END) {
      const h = V.handler;
      stopListening();
      h.onTimeout();
    }
    return;
  }
  V.gap = 0;
  const midi = 69 + 12 * Math.log2(f / 440);

  // Canlı gösterge: duyulan nota ve sapması
  const r = Math.round(midi), cents = Math.round((midi - r) * 100);
  V.ui.note.textContent = `${NAMES[((r % 12) + 12) % 12]} ${cents >= 0 ? '+' : '−'}${Math.abs(cents)} sent`;

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
  commitSung(sung, c.start);
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

// onset: notanın başladığı an (ses saatine göre) — ritim değerlendirmesi için
function commitSung(sung, onset) {
  if (!V.handler) return;
  // Oktav: ilk notada öğrencinin hangi oktavda söylediğine bakılır,
  // sonra bütün ezgi o oktava göre değerlendirilir (aralıklar korunur).
  if (V.octave === null) V.octave = Math.round((sung - V.handler.ref()) / 12);
  const m = Math.round(sung - 12 * V.octave);
  flashKey(m, 250);
  V.handler.onNote(m, onset);
}

// Ezgi sekmesinde sesle cevabı başlatır
const melodyMicUI = { live: $('mMic'), note: $('mMicNote'), level: $('mMicLevel') };
async function startMelodyListening() {
  const ok = await startListening({
    ref: () => M.target[Math.min(M.input.length, M.target.length - 1)],
    onNote: answerNote,
    onTimeout: () => {
      M.phase = 'idle';
      M.streak = 0; M.revealed = true;
      renderSlots(); updateMStats();
      const n = M.input.length;
      setMsg(mMsg, n
        ? `⏱ Ezgi yarım kaldı: ${M.target.length} notadan ${n} tanesini söyledin. Doğrusu yukarıda.`
        : '⏱ Ses algılanmadı. Mikrofonu kontrol edip “Tekrar dinle / dene”ye bas.', 'bad');
    }
  }, melodyMicUI);
  if (!ok) {
    M.phase = 'idle';
    setMsg(mMsg, '🎤 Mikrofona erişilemedi. Tarayıcıda mikrofon izni ver ve tekrar dene.', 'bad');
    return;
  }
  M.phase = 'answering';
  setMsg(mMsg, '🎤 Şimdi söyle! (aynı nota tekrar ediyorsa araya kısa bir boşluk bırak)', 'info');
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
  V.muteUntil = audio().currentTime + 0.9 + PIANO_TAIL;
  V.cur = null; V.cand = null;
});

renderSlots();
updateMStats();

/* =========================================================
   RİTİM TEKRARI
   İki alıştırma: 🎧 dinle ve tekrar et · 📖 notadan oku ve çal.
   Ritim, ölçüleri tam dolduran nota süreleri olarak üretilir (vuruş cinsinden).
   ========================================================= */
const rBpm = bindRange('rBpm');
const rLat = bindRange('rLat');
const rMsg = $('rMsg');
const timeline = $('rTimeline');
const head = $('rHead');

const R = {
  durs: [], onsets: [], meter: METERS['4/4'], bars: 2, style: 'dotted', mode: 'listen',
  phase: 'idle', taps: [], attempted: false,
  start: 0, total: 0, totalBeats: 0, beat: 0.75, countIn: 4,
  timer: null, raf: null, bus: null,
  tries: store.get('rTries', 0), perfect: store.get('rPerfect', 0),
  streak: 0, best: store.get('rBest', 0)
};

const onsetsOf = durs => { let t = 0; return durs.map(d => { const o = t; t += d; return o; }); };

// Zaman çizelgesindeki ızgara: vuruş başına bölme sayısı
const gridSub = (style, mt) => style === 'mixed' ? (mt.compound ? 6 : 4) : style === 'dotted' ? (mt.compound ? 3 : 4) : (mt.compound ? 3 : 2);

/* Bir ritmi çalar ya da kayda hazırlar (ortak: Ritim sekmesi ve sınav).
   listen: davul sesiyle ritmi çalar; record: yalnızca giriş + (isteğe bağlı) metronom.
   Dönüş: start (ritmin başladığı an, ses saati), total (sn), countIn (vuruş). */
function playRhythmSeq({ durs, meter, bpm, bus, mode, metro = true }) {
  const a = audio();
  const beat = 60 / bpm;
  const countIn = countInBeats(meter);
  const totalBeats = durs.reduce((x, y) => x + y, 0);
  const t0 = a.currentTime + 0.15;
  const start = t0 + countIn * beat;
  for (let i = 0; i < countIn; i++) click(t0 + i * beat, i % meter.beats === 0 ? 1600 : 1100, 0.12, bus);
  if (metro) {
    for (let b = 0; b < totalBeats - EPS; b++) click(start + b * beat, b % meter.beats === 0 ? 1600 : 1100, 0.05, bus);
  }
  if (mode === 'listen') onsetsOf(durs).forEach(o => drum(start + o * beat, 0.6, 320, bus));
  return { start, total: totalBeats * beat, totalBeats, beat, countIn };
}

/* Vuruşları değerlendirir: her beklenen vuruşa tolerans içindeki en yakın dokunuş eşlenir.
   expected, taps: saniye (ritmin başından); tol: saniye. */
function tapScore(expected, taps, total, tol) {
  taps = taps.filter(t => t >= -tol && t < total);   // giriş sırasındaki vuruşlar sayılmaz
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
  return {
    result, extras, hits: hits.length, misses: expected.length - hits.length,
    acc: expected.length + extras.length ? hits.length / (expected.length + extras.length) : 0,
    avgMs: hits.length ? hits.reduce((s, r) => s + (r.t - r.e), 0) / hits.length * 1000 : 0
  };
}
// Tolerans: en kısa notanın %45'i (en az 60 ms, ama notanın %60'ından fazla değil), en çok 130 ms
const tapTol = (durs, beat) => { const ioi = Math.min(...durs) * beat; return Math.min(0.13, Math.max(Math.min(0.06, ioi * 0.6), ioi * 0.45)); };

function pct(t) { return (t / R.total) * 100; }

function drawTimeline(result = null, extras = []) {
  timeline.querySelectorAll('.grid,.note,.tapmark').forEach(e => e.remove());
  if (!R.durs.length) return;
  const sub = gridSub(R.style, R.meter);
  const n = Math.round(R.totalBeats * sub);
  for (let i = 0; i < n; i++) {
    const g = document.createElement('div');
    g.className = 'grid' + (i % sub === 0 ? ' beat' : '') + (i % (R.meter.beats * sub) === 0 ? ' bar' : '');
    g.style.left = (i / n * 100) + '%';
    timeline.appendChild(g);
  }
  const showNotes = result || (R.mode === 'listen' && $('rShow').checked);
  if (showNotes) {
    R.onsets.forEach((o, k) => {
      const d = document.createElement('div');
      d.className = 'note';
      if (result) d.classList.add(result[k].hit ? 'hit' : 'miss');
      d.style.left = (o / R.totalBeats * 100 + 0.3) + '%';
      d.style.width = (R.durs[k] / R.totalBeats * 100 - 0.6) + '%';
      timeline.appendChild(d);
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

// Ritmin notası: okuma alıştırmasında baştan, dinleme alıştırmasında denemeden sonra gösterilir
function renderRNotation(result = null) {
  const box = $('rNotation');
  const show = R.durs.length && (R.mode === 'read' || R.attempted);
  box.hidden = !show;
  if (!show) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="staff-title">${R.mode === 'read' ? '📖 Bu ritmi oku ve çal' : 'Ritmin notası'}</div>` +
    staffSvg(null, R.durs, R.meter, null, result ? i => ({ color: result[i].hit ? COL.ok : COL.bad }) : null);
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
    const c = Math.floor((now - (R.start - R.countIn * R.beat)) / R.beat) + 1;
    count.textContent = c >= 1 && c <= R.countIn ? c : '';
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

function newRhythm() {
  cancelRhythm();
  R.mode = $('rMode').value;
  R.meter = meterOf($('rMeter').value);
  R.style = $('rLevel').value;
  R.bars = +$('rBars').value;
  R.durs = genRhythmBars(R.bars, R.style, Math.random, R.meter);
  R.onsets = onsetsOf(R.durs);
  R.totalBeats = R.durs.reduce((a, b) => a + b, 0);
  R.total = R.totalBeats * (60 / +rBpm.value);
  R.attempted = false;
  $('rGo').disabled = false;
  $('rReplay').disabled = R.mode === 'read';   // okumada önce öğrenci çalar, sonra dinleyebilir
  drawTimeline();
  renderRNotation();
  if (R.mode === 'listen') runRhythm('listen');
  else setMsg(rMsg, `📖 Notayı oku. Hazır olunca “Sıra bende”ye bas (veya Enter): ${countInBeats(R.meter)} vuruş girişten sonra çal.`, 'info');
}

// mode: 'listen' (ritmi çal) | 'record' (kullanıcıyı kaydet)
function runRhythm(mode) {
  if (!R.durs.length) return;
  cancelRhythm();
  R.bus = newBus();
  const p = playRhythmSeq({ durs: R.durs, meter: R.meter, bpm: +rBpm.value, bus: R.bus, mode, metro: $('rMetro').checked });
  Object.assign(R, { start: p.start, total: p.total, beat: p.beat, countIn: p.countIn });

  R.taps = [];
  R.phase = mode === 'listen' ? 'playing' : 'recording';
  drawTimeline();
  setMsg(rMsg, mode === 'listen'
    ? `🎧 Dinle… (${p.countIn} vuruş giriş)`
    : `⏳ Hazırlan… ${p.countIn} vuruştan sonra çal! (Boşluk veya DOKUN)`, mode === 'record' ? 'info' : '');
  animate();

  const endIn = (R.start + R.total + R.beat * 0.6 - audio().currentTime) * 1000;
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
  const pad = activeTab === 'exam' ? $('exTap') : $('tapPad');
  pad.classList.add('hit');
  setTimeout(() => pad.classList.remove('hit'), 90);
  // Ses çıkış gecikmesi + kullanıcı ayarı kadar düzelt
  const t = a.currentTime - (a.outputLatency || 0) - (+rLat.value) / 1000;
  if (activeTab === 'exam') { examTap(t); return; }
  if (R.phase !== 'recording') return;
  R.taps.push(t - R.start);
  if (t - R.start >= 0) addTapMark(t - R.start, false);
}

function evaluate() {
  R.phase = 'idle';
  R.attempted = true;
  const sc = tapScore(R.onsets.map(o => o * R.beat), R.taps, R.total, tapTol(R.durs, R.beat));
  drawTimeline(sc.result, sc.extras);
  renderRNotation(sc.result);
  $('rReplay').disabled = false;

  R.tries++;
  const perfect = sc.misses === 0 && sc.extras.length === 0;
  if (perfect) { R.perfect++; R.streak++; R.best = Math.max(R.best, R.streak); }
  else R.streak = 0;
  updateRStats();

  const acc = Math.round(100 * sc.acc);
  let tendency = '';
  if (sc.hits && Math.abs(sc.avgMs) > 25) {
    tendency = ` Ortalama ${Math.abs(Math.round(sc.avgMs))} ms ${sc.avgMs < 0 ? 'erken' : 'geç'} vuruyorsun.`;
  }
  const again = R.mode === 'read' ? '“Dinle” ile doğrusunu duyabilir, yeniden deneyebilirsin.' : 'Tekrar dinleyip yeniden dene.';
  if (!R.taps.length) {
    setMsg(rMsg, 'Hiç vuruş algılanmadı. Boşluk tuşuna ya da DOKUN düğmesine bas.', 'bad');
  } else if (perfect) {
    setMsg(rMsg, `✓ Kusursuz! %${acc} doğruluk.${tendency} Devam için “Yeni ritim”.`, 'good');
  } else {
    const parts = [];
    if (sc.misses) parts.push(`${sc.misses} vuruş kaçtı`);
    if (sc.extras.length) parts.push(`${sc.extras.length} fazla vuruş`);
    setMsg(rMsg, `%${acc} doğruluk — ${parts.join(', ')}.${tendency} ${again}`, 'bad');
  }
}

$('rNew').addEventListener('click', newRhythm);
$('rReplay').addEventListener('click', () => runRhythm('listen'));
$('rGo').addEventListener('click', () => runRhythm('record'));
$('rShow').addEventListener('change', () => { if (R.phase === 'idle') drawTimeline(); });
$('rMode').addEventListener('change', () => {
  $('rShow').parentElement.hidden = $('rMode').value === 'read';
  setMsg(rMsg, $('rMode').value === 'read'
    ? '“Yeni ritim”e bas: ritim nota olarak gösterilir, sen okuyup çalarsın.'
    : '“Yeni ritim”e bas. Girişten sonra ritim çalar.');
});
$('tapPad').addEventListener('pointerdown', e => { e.preventDefault(); tap(); });

updateRStats();

/* =========================================================
   SINAV
   - Öğretmen ayarları seçer, bir sınav kodu belirler ve öğrenci bağlantısı oluşturur.
   - Aynı kod + aynı ayarlar → herkes aynı soruları alır (tohumlu rastgele üreteç).
   - Soru türleri: 🎵 ezgi, 🎧 ritim (dinleme), 📖 ritim (okuma); seçilenler sırayla gelir.
   - Sınav sırasında doğru/yanlış gösterilmez; dinleme hakkı sınırlıdır.
   - Öğretmen şifresi oluşturulursa ayarlar ve sonuçlar yalnızca girişle görülür.
   ========================================================= */
const CANON_URL = 'https://gryflute-ui.github.io/ezgi-ritim/';
const exMsg = $('exMsg');
const examMicUI = { live: $('exMic'), note: $('exMicNote'), level: $('exMicLevel') };
const KIND = { m: '🎵 Ezgi', rd: '🎧 Ritim (dinleme)', rr: '📖 Ritim (okuma)' };
const isRhythm = it => it.type === 'rd' || it.type === 'rr';

const E = {
  cfg: null, items: [], i: 0,
  state: 'idle',   // idle | ready | playing | listened | answering | recording | answered
  listens: 0, answer: [], times: [], taps: [], rec: null, raf: null, timers: [], bus: null,
  student: null, locked: false
};

/* --- Tohumlu rastgele sayı üreteci --- */
function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randomCode() {
  const A = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
  return Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join('');
}

/* --- Ayarlar: form ↔ nesne ↔ bağlantı --- */
const clampInt = (v, lo, hi, d) => { v = parseInt(v, 10); return isNaN(v) ? d : Math.max(lo, Math.min(hi, v)); };

function readCfg() {
  let nmin = clampInt($('exNmin').value, 2, 10, 3), nmax = clampInt($('exNmax').value, 2, 10, 6);
  if (nmax < nmin) [nmin, nmax] = [nmax, nmin];
  let code = $('exCode').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) code = randomCode();
  const types = [['m', 'exTypeM'], ['rd', 'exTypeRD'], ['rr', 'exTypeRR']].filter(([, id]) => $(id).checked).map(([t]) => t);
  const tv = $('exTonic').value;
  const c = {
    code,
    types: types.length ? types : ['m'],
    q: clampInt($('exQ').value, 1, 40, 10),
    nmin, nmax,
    scale: SCALE_DEFS[$('exScale').value] ? $('exScale').value : 'major',
    tonic: tv === 'rand' || TONICS[tv] ? tv : '60',
    meter: METERS[$('exMeter').value] ? $('exMeter').value : '4/4',
    rhythm: RCELLS[$('exRhythm').value] ? $('exRhythm').value : 'simple',
    bars: clampInt($('exBars').value, 1, 2, 2),
    bpm: clampInt($('exBpm').value, 50, 160, 80),
    listens: clampInt($('exListens').value, 1, 3, 2),
    answer: $('exAnswer').value === 'keys' ? 'keys' : 'voice',
    refDo: $('exDo').checked,
    countIn: $('exCount').checked,
    rw: [0, 30, 50].includes(+$('exRW').value) ? +$('exRW').value : 30  // ezgide ritmin puandaki payı (%)
  };
  writeCfg(c); // düzeltilmiş değerleri forma geri yaz
  return c;
}

function writeCfg(c) {
  const types = Array.isArray(c.types) ? c.types : String(c.types || 'm').split('.');
  $('exTypeM').checked = types.includes('m'); $('exTypeRD').checked = types.includes('rd'); $('exTypeRR').checked = types.includes('rr');
  $('exCode').value = c.code; $('exQ').value = c.q;
  $('exNmin').value = c.nmin; $('exNmax').value = c.nmax;
  $('exScale').value = c.scale; $('exTonic').value = c.tonic; $('exMeter').value = c.meter;
  $('exRhythm').value = c.rhythm; $('exBars').value = c.bars;
  $('exBpm').value = c.bpm; $('exListens').value = c.listens;
  $('exAnswer').value = c.answer;
  $('exDo').checked = c.refDo; $('exCount').checked = c.countIn;
  $('exRW').value = c.rw;
}

// Bağlantıdaki adlar (Türkçe, kısa)
const QKEYS = { code: 'kod', types: 'tur', q: 'soru', nmin: 'enaz', nmax: 'encok', scale: 'dizi', tonic: 'ton',
                meter: 'olcu', rhythm: 'ritim', bars: 'rolcu', bpm: 'tempo', listens: 'hak', answer: 'cevap',
                refDo: 'do', countIn: 'giris', rw: 'ritimpuan' };

function cfgToQuery(c) {
  const p = new URLSearchParams({ sinav: '1' });
  for (const [k, q] of Object.entries(QKEYS)) {
    const v = c[k];
    p.set(q, typeof v === 'boolean' ? (v ? '1' : '0') : Array.isArray(v) ? v.join('.') : v);
  }
  return p.toString();
}

function cfgFromQuery(search = location.search) {
  const p = new URLSearchParams(search);
  if (!p.has('sinav')) return null;
  const g = (k, d) => p.has(QKEYS[k]) ? p.get(QKEYS[k]) : d;
  return {
    code: g('code', ''), types: g('types', 'm').split('.'), q: g('q', 10), nmin: g('nmin', 3), nmax: g('nmax', 6),
    scale: g('scale', 'major'), tonic: g('tonic', '60'), meter: g('meter', '4/4'),
    rhythm: g('rhythm', 'simple'), bars: g('bars', 2), bpm: g('bpm', 80),
    listens: g('listens', 2), answer: g('answer', 'voice'),
    refDo: g('refDo', '1') === '1', countIn: g('countIn', '1') === '1',
    rw: g('rw', '0')   // ritim puanı eklenmeden önce oluşturulan bağlantılarda ritim puanlanmaz
  };
}

function buildItems(c) {
  // Sorular yalnızca bu ayarlara bağlıdır (tempo ve dinleme hakkı soruları değiştirmez)
  const rng = mulberry32(hashStr(JSON.stringify([c.code, c.q, c.nmin, c.nmax, c.scale, c.rhythm,
    c.tonic, c.meter, c.types, c.bars])));
  const meter = meterOf(c.meter);
  const kinds = Array.from({ length: c.q }, (_, i) => c.types[i % c.types.length]);
  const nMel = kinds.filter(k => k === 'm').length;
  let mi = 0;
  return kinds.map(type => {
    if (type !== 'm') {
      return { type, durs: genRhythmBars(c.bars, c.rhythm, rng, meter), taps: [] };
    }
    // Nota sayısı ezgi soruları boyunca en azdan en çoğa doğru artar
    const n = Math.round(c.nmin + (c.nmax - c.nmin) * (nMel > 1 ? mi / (nMel - 1) : 0));
    mi++;
    const tonic = c.tonic === 'rand' ? +pick(Object.keys(TONICS), rng) : +c.tonic;
    const key = makeKey(c.scale, tonic);
    const target = genMelody(n, key.notes, rng);
    return { type, key, target, durs: genDurations(n, c.rhythm, rng, meter), answer: [], times: [] };
  });
}

/* --- Puanlama: düzeltme uzaklığı (Levenshtein) ve hizalama --- */
function align(t, a) {
  const n = t.length, m = a.length;
  const D = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => i + j));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (t[i - 1] === a[j - 1] ? 0 : 1));
    }
  }
  // Geriye doğru izleyip işlemleri çıkar
  const ops = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (t[i - 1] === a[j - 1] ? 0 : 1)) {
      ops.push({ op: t[i - 1] === a[j - 1] ? 'ok' : 'bad', t: t[i - 1], a: a[j - 1], ti: i - 1, aj: j - 1 }); i--; j--;
    } else if (j > 0 && D[i][j] === D[i][j - 1] + 1) {
      ops.push({ op: 'extra', a: a[j - 1], aj: j - 1 }); j--;
    } else {
      ops.push({ op: 'skip', t: t[i - 1], ti: i - 1 }); i--;
    }
  }
  return { dist: D[n][m], ops: ops.reverse() };
}
// Perde puanı (0–1)
const itemScore = it => Math.max(0, it.target.length - align(it.target, it.answer).dist) / it.target.length;

// Bir sorunun puanları (0–1). Ezgi: perde, ritim, ağırlıklı toplam. Ritim sorusu: vuruş doğruluğu.
function scoreItem(it, cfg) {
  const beat = 60 / cfg.bpm;
  if (isRhythm(it)) {
    const ons = onsetsOf(it.durs).map(o => o * beat);
    const total = it.durs.reduce((a, b) => a + b, 0) * beat;
    const sc = tapScore(ons, it.taps || [], total, tapTol(it.durs, beat));
    return { s: sc.acc, sr: sc.acc, hit: sc.result.map(r => r.hit), extra: sc.extras.length, hits: sc.hits };
  }
  const sp = itemScore(it);
  const r = rhythmEval(it.target, it.durs, it.answer, it.times, beat);
  const w = (cfg.rw || 0) / 100;
  return {
    sp, sr: r.score, s: w ? (1 - w) * sp + w * r.score : sp,
    rbad: r.items.filter(x => !x.ok).map(x => x.aj),   // ritmi hatalı cevap notaları
    tempo: r.tempo
  };
}

/* --- Piyanoyu sınav ekranına taşıma --- */
const pianoBox = $('pianoBox');
const pianoHome = pianoBox.parentNode, pianoNext = pianoBox.nextSibling;
const restorePiano = () => pianoHome.insertBefore(pianoBox, pianoNext);

/* --- Sınav akışı --- */
const exItem = () => E.items[E.i];

function renderExSlots() {
  const box = $('exSlots');
  box.innerHTML = '';
  if (isRhythm(exItem())) return;
  exItem().target.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'slot' + (i < E.answer.length ? ' filled' : '');
    d.textContent = i < E.answer.length ? '●' : '';
    box.appendChild(d);
  });
}

function setPlayBtn() {
  const b = $('exPlay');
  b.textContent = E.listens > 0 ? `▶ Dinle (${E.listens} hak kaldı)` : 'Dinleme hakkın bitti';
  b.disabled = E.listens <= 0 || E.state === 'playing' || E.state === 'recording';
}

function stopExamAudio() {
  E.timers.forEach(clearTimeout); E.timers = [];
  cancelAnimationFrame(E.raf); E.raf = null;
  $('exCount').textContent = '';
  killBus(E.bus); E.bus = null;
  stopListening();
}

async function startExam() {
  const name = $('exName').value.trim();
  if (!name) { setMsg($('exSetupMsg'), 'Lütfen adını ve soyadını yaz.', 'bad'); $('exName').focus(); return; }
  E.cfg = readCfg();
  stopMelody(); cancelRhythm();
  const hasMelody = E.cfg.types.includes('m');

  if (hasMelody && E.cfg.answer === 'voice' && !(await openMic())) {
    setMsg($('exSetupMsg'), '🎤 Mikrofona erişilemedi. Tarayıcıda mikrofon izni verip tekrar dene.', 'bad');
    return;
  }
  setMsg($('exSetupMsg'), '');
  adminLogout(); // öğretmen oturumu sınavla birlikte kapanır
  E.student = { name, no: $('exNo').value.trim() };
  E.items = buildItems(E.cfg);
  E.i = 0;

  // Sınav süresince diğer sekmeler kapalı; sayfadan çıkarken uyarı
  document.querySelectorAll('.tab').forEach(b => { b.disabled = b.dataset.tab !== 'exam'; });
  window.onbeforeunload = e => { e.preventDefault(); return ''; };

  $('exSetup').hidden = true; $('exResult').hidden = true; $('exRun').hidden = false;
  $('exWho').textContent = name + (E.student.no ? ` (${E.student.no})` : '');
  $('exTotal').textContent = E.items.length;
  showQuestion();
}

function showQuestion() {
  stopExamAudio();
  const it = exItem();
  const rhythm = isRhythm(it);
  E.listens = E.cfg.listens; E.answer = []; E.times = []; E.taps = []; E.state = 'ready';
  $('exNum').textContent = E.i + 1;
  $('exKind').textContent = KIND[it.type];
  $('exProg').style.width = (E.i / E.items.length * 100) + '%';
  $('exRedo').disabled = true;
  $('exNext').disabled = true;
  $('exNext').textContent = E.i === E.items.length - 1 ? 'Sınavı bitir ✓' : 'Sonraki soru →';
  $('exPlay').hidden = it.type === 'rr';
  $('exGo').hidden = !rhythm;
  $('exGo').disabled = it.type !== 'rr';
  $('exRhythmBox').hidden = !rhythm;
  $('exSlots').hidden = rhythm;
  // Piyano yalnız piyanoyla cevaplanan ezgi sorularında görünür
  if (!rhythm && E.cfg.answer === 'keys') $('exPianoHost').appendChild(pianoBox);
  else restorePiano();
  const mt = meterOf(E.cfg.meter);
  $('exNotation').innerHTML = it.type === 'rr' ? staffSvg(null, it.durs, mt) : '';
  $('exNotation').hidden = it.type !== 'rr';
  setPlayBtn();
  renderExSlots();
  const cin = countInBeats(mt);
  if (it.type === 'm') {
    setMsg(exMsg, `Hazır olunca “Dinle”ye bas. ${it.target.length} notalık bir ezgi; ` +
      `${E.cfg.listens} kez dinleyebilirsin.` + (E.cfg.refDo ? ' Ezgiden önce Do sesi verilir.' : ''));
  } else if (it.type === 'rd') {
    setMsg(exMsg, `Hazır olunca “Dinle”ye bas; ritmi ${E.cfg.listens} kez dinleyebilirsin. ` +
      `Sonra “Çalmaya başla”ya bas (Enter): ${cin} vuruş girişten sonra Boşluk tuşuyla ya da DOKUN düğmesiyle çal.`);
  } else {
    setMsg(exMsg, `📖 Ritmi notadan oku. Hazır olunca “Çalmaya başla”ya bas (Enter): ` +
      `${cin} vuruş girişten sonra Boşluk tuşuyla ya da DOKUN düğmesiyle çal.`);
  }
}

function examPlay() {
  if (E.listens <= 0 || E.state === 'playing' || E.state === 'recording') return;
  const it = exItem();
  if (it.type === 'rr') return;
  stopExamAudio();
  E.listens--; E.answer = []; E.times = []; E.taps = []; E.state = 'playing';
  setPlayBtn(); renderExSlots();
  $('exRedo').disabled = true; $('exNext').disabled = true; $('exGo').disabled = true;
  E.bus = newBus();
  const mt = meterOf(E.cfg.meter);
  if (it.type === 'rd') {
    setMsg(exMsg, '🎧 Dinle…');
    const p = playRhythmSeq({ durs: it.durs, meter: mt, bpm: E.cfg.bpm, bus: E.bus, mode: 'listen' });
    E.timers.push(setTimeout(() => {
      E.state = 'listened';
      setPlayBtn();
      $('exGo').disabled = false;
      setMsg(exMsg, 'Hazır olunca “Çalmaya başla”ya bas (Enter).', 'info');
    }, (p.start - audio().currentTime + p.total + p.beat * 0.3) * 1000));
    return;
  }
  setMsg(exMsg, E.cfg.refDo ? '🎧 Önce Do sesi, sonra ezgi… Dinle.' : '🎧 Dinle…');
  const p = playSeq(it.target, it.durs, { bpm: E.cfg.bpm, countIn: E.cfg.countIn ? countInBeats(mt) : 0,
    refDo: E.cfg.refDo, bus: E.bus, meter: mt });
  E.timers.push(setTimeout(beginAnswer, (E.cfg.answer === 'voice' ? p.micAt : p.keysAt) * 1000));
}

async function beginAnswer() {
  E.state = 'answering';
  setPlayBtn();
  $('exNext').disabled = false;
  $('exRedo').disabled = E.answer.length === 0;
  if (E.cfg.answer === 'keys') { setMsg(exMsg, '🎹 Şimdi piyanoda çal.', 'info'); return; }
  const it = exItem();
  const ok = await startListening({
    ref: () => it.target[Math.min(E.answer.length, it.target.length - 1)],
    onNote: examNote,
    onTimeout: () => finishAnswer(E.answer.length
      ? `Cevabın kaydedildi (${E.answer.length}/${it.target.length} nota).`
      : 'Ses algılanmadı. “Cevabı sil, yeniden cevapla” ile tekrar söyleyebilirsin.')
  }, examMicUI);
  if (!ok) { E.state = 'answered'; setMsg(exMsg, '🎤 Mikrofona erişilemedi.', 'bad'); return; }
  setMsg(exMsg, '🎤 Şimdi söyle! (aynı nota tekrar ediyorsa araya kısa bir boşluk bırak)', 'info');
}

function examNote(m, t) {
  if (E.state !== 'answering') return;
  E.answer.push(m);
  E.times.push(t);
  renderExSlots();
  $('exRedo').disabled = false;
  if (E.answer.length >= exItem().target.length) finishAnswer('✓ Cevabın kaydedildi.');
}

function finishAnswer(text, good) {
  stopListening();
  E.state = 'answered';
  setPlayBtn();
  $('exRedo').disabled = false;
  $('exNext').disabled = false;
  if (isRhythm(exItem())) $('exGo').disabled = true;
  const last = E.i === E.items.length - 1;
  const ok = good ?? E.answer.length > 0;
  setMsg(exMsg, `${text} ${last ? '“Sınavı bitir”e bas.' : '“Sonraki soru”ya geç.'}`, ok ? 'good' : 'bad');
}

/* --- Ritim sorusu: vuruşları kaydet --- */
function examGo() {
  const it = exItem();
  if (!isRhythm(it) || $('exGo').disabled || E.state === 'playing' || E.state === 'recording') return;
  stopExamAudio();
  E.taps = [];
  E.state = 'recording';
  setPlayBtn();
  $('exGo').disabled = true; $('exRedo').disabled = true; $('exNext').disabled = true;
  E.bus = newBus();
  const p = playRhythmSeq({ durs: it.durs, meter: meterOf(E.cfg.meter), bpm: E.cfg.bpm, bus: E.bus, mode: 'record' });
  E.rec = p;
  setMsg(exMsg, `⏳ Hazırlan… ${p.countIn} vuruştan sonra çal! (Boşluk veya DOKUN)`, 'info');
  const tick = () => {
    const now = audio().currentTime, cnt = $('exCount');
    if (now < p.start) {
      const c = Math.floor((now - (p.start - p.countIn * p.beat)) / p.beat) + 1;
      cnt.textContent = c >= 1 && c <= p.countIn ? c : '';
    } else cnt.textContent = '🥁';
    E.raf = requestAnimationFrame(tick);
  };
  tick();
  E.timers.push(setTimeout(() => {
    cancelAnimationFrame(E.raf); $('exCount').textContent = '';
    finishAnswer(E.taps.length ? `✓ Vuruşların kaydedildi (${E.taps.length} vuruş).`
      : 'Hiç vuruş algılanmadı. “Cevabı sil, yeniden cevapla” ile yeniden çalabilirsin.', E.taps.length > 0);
  }, (p.start - audio().currentTime + p.total + p.beat * 0.6) * 1000));
}
function examTap(t) {
  if (E.state !== 'recording' || !E.rec) return;
  E.taps.push(t - E.rec.start);
}

function examRedo() {
  if (E.state !== 'answering' && E.state !== 'answered') return;
  stopListening();
  E.answer = []; E.times = []; E.taps = [];
  renderExSlots();
  if (isRhythm(exItem())) { $('exGo').disabled = false; examGo(); return; }
  beginAnswer();
}

function examKey(m) {
  if (E.state === 'idle' || E.state === 'playing' || isRhythm(exItem())) return;
  // Sesle cevapta piyano susar (mikrofon onu da duyardı)
  if (E.cfg.answer === 'voice' && E.state === 'answering') return;
  tone(m, audio().currentTime);
  flashKey(m);
  if (E.cfg.answer === 'keys') examNote(m, audio().currentTime);
}

function examNext() {
  if (E.state === 'playing' || E.state === 'recording') return;
  const it = exItem();
  if (isRhythm(it)) {
    if (E.state !== 'answered' && !confirm('Bu ritim sorusunu cevaplamadın. Yine de geçmek istiyor musun?')) return;
    it.taps = E.taps.slice();
  } else {
    if (E.state === 'ready') return;
    const n = it.target.length;
    if (E.answer.length < n &&
        !confirm(`Bu soruda ${n} notadan ${E.answer.length} tanesini cevapladın. Yine de geçmek istiyor musun?`)) return;
    it.answer = E.answer.slice();
    it.times = E.times.slice();
  }
  stopExamAudio();
  E.i++;
  if (E.i >= E.items.length) finishExam();
  else showQuestion();
}

function finishExam() {
  stopExamAudio();
  E.state = 'idle';
  if (!voiceMode()) closeMic(); // tarayıcının "mikrofon açık" işareti sönsün
  restorePiano();
  document.querySelectorAll('.tab').forEach(b => { b.disabled = false; });
  window.onbeforeunload = null;

  const sc = E.items.map(it => scoreItem(it, E.cfg));
  const mean = arr => arr.length ? Math.round(100 * arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const mel = E.items.map((it, i) => [it, sc[i]]).filter(([it]) => !isRhythm(it));
  const rhy = E.items.map((it, i) => [it, sc[i]]).filter(([it]) => isRhythm(it));
  const rec = {
    name: E.student.name, no: E.student.no,
    date: new Date().toISOString(),
    code: E.cfg.code, cfg: E.cfg,
    score: mean(sc.map(x => x.s)),
    pitch: mean(mel.map(([, x]) => x.sp)),
    rhythm: mean([...(E.cfg.rw ? mel.map(([, x]) => x.sr) : []), ...rhy.map(([, x]) => x.s)]),
    items: E.items.map((it, i) => isRhythm(it)
      ? { type: it.type, d: it.durs, s: sc[i].s, sr: sc[i].sr, h: sc[i].hit, x: sc[i].extra, n: (it.taps || []).length }
      : {
          type: 'm', k: it.key, t: it.target, d: it.durs, a: it.answer,
          o: (it.times || []).map(x => Math.round((x - it.times[0]) * 1000)), // başlama anları (ms)
          s: sc[i].s, sp: sc[i].sp, sr: sc[i].sr, rb: sc[i].rbad
        })
  };
  const all = store.get('exams', []);
  all.push(rec);
  store.set('exams', all);
  showResult(rec);
}

/* --- Sonuç ekranı --- */
let shownRec = null;
function showResult(rec) {
  shownRec = rec;
  $('exSetup').hidden = true; $('exRun').hidden = true; $('exResult').hidden = false;
  const cfg = rec.cfg, rw = cfg.rw || 0, mt = meterOf(cfg.meter);
  const kinds = [...new Set(rec.items.map(it => it.type || 'm'))].map(k => KIND[k]).join(', ');
  $('exRName').textContent = rec.name + (rec.no ? ` (${rec.no})` : '');
  $('exRMeta').textContent = `${new Date(rec.date).toLocaleString('tr-TR')} · Sınav kodu ${rec.code} · ` +
    `${rec.items.length} soru (${kinds})` +
    (rec.pitch !== null && rec.pitch !== undefined ? ` · Perde ${rec.pitch}` : '') +
    (rec.rhythm !== null && rec.rhythm !== undefined ? ` · Ritim ${rec.rhythm}` : '') +
    (rec.items.some(it => !it.type || it.type === 'm') ? (rw ? ` · ezgide puanın %${rw}${rw === 50 ? "'si" : "'u"} ritim` : ' · ezgide ritim puanlanmadı') : '');
  $('exRScore').textContent = rec.score;

  const pct = v => v === undefined || v === null ? '—' : Math.round(v * 100) + '%';
  const body = $('exRBody');
  body.innerHTML = '';
  rec.items.forEach((it, i) => {
    const type = it.type || 'm';
    const tr = document.createElement('tr');
    const td = txt => { const c = document.createElement('td'); if (txt !== undefined) c.textContent = txt; tr.appendChild(c); return c; };
    const first = td(i + 1);
    const btn = document.createElement('button');
    btn.className = 'small no-print staff-btn'; btn.textContent = '♪ nota'; btn.title = 'Sorunun notasını göster';
    first.appendChild(btn);

    if (type === 'm') {
      td(it.t.map(m => noteName(m, it.k)).join(' '));
      const ans = td();
      if (!it.a.length) ans.textContent = '—';
      else align(it.t, it.a).ops.forEach(o => {
        const s = document.createElement(o.op === 'skip' ? 's' : 'span');
        const rb = rw && o.aj !== undefined && (it.rb || []).includes(o.aj);
        s.className = 'rn ' + o.op + (rb ? ' rbad' : '');
        s.textContent = noteName(o.op === 'skip' ? o.t : o.a, it.k);
        if (rb) s.title = 'Bu notanın süresi (ritmi) hatalı';
        ans.appendChild(s);
      });
      td(pct(it.sp ?? it.s));
      td(rw ? pct(it.sr) : '—');
    } else {
      td(`${KIND[type]} · ${mt.key} · ${it.d.length} nota`);
      const hits = (it.h || []).filter(Boolean).length;
      td(it.n ? `${hits}/${it.d.length} vuruş yakalandı` + (it.x ? `, ${it.x} fazla` : '') : '— (çalınmadı)');
      td('—');
      td(pct(it.sr));
    }
    td(pct(it.s));
    body.appendChild(tr);

    // Açılır porte satırı
    const detail = document.createElement('tr');
    detail.className = 'staff-row'; detail.hidden = true;
    const cell = document.createElement('td'); cell.colSpan = 6;
    detail.appendChild(cell);
    body.appendChild(detail);
    btn.addEventListener('click', () => {
      if (!cell.innerHTML) {
        if (type === 'm') {
          const ops = align(it.t, it.a).ops;
          const col = {};
          ops.forEach(o => {
            if (o.ti === undefined) return;
            if (o.op === 'skip') col[o.ti] = { color: COL.muted };
            else if (o.op === 'bad') { const s = spell(o.a, it.k); col[o.ti] = { color: COL.warn, ghost: { step: staffStep(s), acc: s.acc, color: COL.bad } }; }
            else col[o.ti] = { color: rw && (it.rb || []).includes(o.aj) ? COL.warn : COL.ok };
          });
          cell.innerHTML = staffSvg(it.t, it.d, mt, it.k, k => col[k] || {});
        } else {
          cell.innerHTML = staffSvg(null, it.d, mt, null, k => ({ color: it.n ? (it.h[k] ? COL.ok : COL.bad) : COL.muted }));
        }
      }
      detail.hidden = !detail.hidden;
    });
  });
}

/* --- CSV (Excel için ; ayraçlı, Türkçe karakterler için BOM'lu) --- */
function csvOf(recs) {
  const maxQ = Math.max(0, ...recs.map(r => r.items.length));
  const esc = v => { v = String(v ?? ''); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const head = ['Ad Soyad', 'Numara', 'Tarih', 'Sınav kodu', 'Cevap', 'Puan (100)',
    'Perde (100)', 'Ritim (100)', 'Ezgide ritim payı (%)',
    ...Array.from({ length: maxQ }, (_, i) => `S${i + 1} (%)`)];
  const rows = recs.map(r => [
    r.name, r.no, new Date(r.date).toLocaleString('tr-TR'), r.code,
    r.cfg.answer === 'voice' ? 'ses' : 'piyano', r.score,
    r.pitch ?? '', r.rhythm ?? '', r.cfg.rw || 0,
    ...r.items.map(it => Math.round(it.s * 100))
  ]);
  return '﻿' + [head, ...rows].map(r => r.map(esc).join(';')).join('\r\n');
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const fileSafe = s => s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

/* --- Kayıtlı sonuçlar listesi --- */
function renderSaved() {
  const all = store.get('exams', []);
  const box = $('exSavedList');
  box.innerHTML = '';
  $('exCsvAll').disabled = $('exClear').disabled = !all.length;
  if (!all.length) { box.innerHTML = '<p class="hint-left">Henüz sonuç yok.</p>'; return; }
  const table = document.createElement('table');
  table.className = 'r-table';
  table.innerHTML = '<thead><tr><th>Ad Soyad</th><th>Numara</th><th>Tarih</th><th>Kod</th><th>Puan</th><th></th></tr></thead>';
  const tb = document.createElement('tbody');
  all.slice().reverse().forEach(r => {
    const tr = document.createElement('tr');
    [r.name, r.no, new Date(r.date).toLocaleString('tr-TR'), r.code, r.score].forEach(v => {
      const td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
    });
    const td = document.createElement('td');
    const b = document.createElement('button');
    b.textContent = 'Göster'; b.className = 'small';
    b.addEventListener('click', () => showResult(r));
    td.appendChild(b); tr.appendChild(td);
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  box.appendChild(table);
}

function backToSetup() {
  $('exResult').hidden = true; $('exRun').hidden = true; $('exSetup').hidden = false;
  $('exName').value = ''; $('exNo').value = '';
  updateAdminUI();
}

/* =========================================================
   ÖĞRETMEN (YÖNETİCİ) GİRİŞİ
   Şifre oluşturulursa sınav ayarları, öğrenci bağlantısı ve sonuçlar yalnızca
   öğretmen girişiyle görülür/değiştirilir. Öğretmenin ayarları bu bilgisayarda
   saklanır; öğrenci bu ayarlarla sınava başlar. Şifre tuzlanıp özetlenerek
   (PBKDF2) saklanır. Not: Koruma bu cihazın tarayıcısındadır; tarayıcı verilerini
   silen biri kilidi kaldırabilir (o zaman sonuçlar da silinir).
   ========================================================= */
const ADM = { logged: false, mode: null };
const hasAdmin = () => !!store.get('admin', null);
const teacherAllowed = () => !hasAdmin() || ADM.logged;

async function pwHash(pw, salt) {
  if (window.crypto && crypto.subtle) {
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 150000, hash: 'SHA-256' }, k, 256);
    return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Güvenli bağlam yoksa (çok nadir) basit özet
  let h = salt + pw; for (let i = 0; i < 5000; i++) h = hashStr(h + i).toString(16) + h.slice(0, 32);
  return h;
}

function updateAdminUI() {
  const has = hasAdmin(), ok = teacherAllowed();
  $('exAdminStatus').textContent = !has
    ? 'Öğretmen şifresi yok: ayarları ve sonuçları bu bilgisayarı kullanan herkes görebilir.'
    : ADM.logged ? '🔓 Öğretmen olarak giriş yapıldı.' : '🔒 Sınav ayarları ve sonuçlar öğretmen şifresiyle korunuyor.';
  $('exAdminCreate').hidden = has;
  $('exAdminLogin').hidden = !has || ADM.logged;
  $('exAdminChange').hidden = !ADM.logged;
  $('exAdminLogout').hidden = !ADM.logged;
  $('exCfg').disabled = E.locked || !ok;
  $('exTeacher').hidden = E.locked || !ok;
  $('exSaved').hidden = !ok || (E.locked && !ADM.logged); // bağlantıyla gelen öğrenci sonuçları görmez
  $('exPasteBox').hidden = E.locked;
  $('exLockedNote').hidden = !(E.locked || !ok);
  if (ok) renderSaved();
}

function openAdminForm(mode) {
  ADM.mode = mode;
  const f = $('exAdminForm');
  f.hidden = false;
  $('exAdminTitle').textContent = { create: 'Yeni öğretmen şifresi:', login: 'Öğretmen şifresi:', change: 'Yeni şifre:' }[mode];
  $('exPw1').value = ''; $('exPw2').value = '';
  $('exPw2').hidden = mode === 'login';
  $('exAdminForgot').hidden = mode !== 'login';
  $('exAdminMsg').textContent = '';
  $('exPw1').focus();
}
function closeAdminForm() { $('exAdminForm').hidden = true; ADM.mode = null; }
function adminLogout() { ADM.logged = false; closeAdminForm(); updateAdminUI(); }

$('exAdminForm').addEventListener('submit', async e => {
  e.preventDefault();
  const p1 = $('exPw1').value, p2 = $('exPw2').value, msg = $('exAdminMsg');
  if (ADM.mode === 'login') {
    const a = store.get('admin', null);
    if (a && await pwHash(p1, a.salt) === a.hash) {
      ADM.logged = true; closeAdminForm(); updateAdminUI();
      setMsg($('exSetupMsg'), '🔓 Öğretmen girişi yapıldı. Ayarlar bu bilgisayarda saklanır; işin bitince “Çıkış”a bas.', 'good');
    } else { msg.textContent = 'Şifre yanlış.'; $('exPw1').select(); }
    return;
  }
  if (p1.length < 4) { msg.textContent = 'Şifre en az 4 karakter olmalı.'; return; }
  if (p1 !== p2) { msg.textContent = 'İki şifre aynı değil.'; return; }
  const salt = randomCode() + randomCode();
  store.set('admin', { salt, hash: await pwHash(p1, salt) });
  const created = ADM.mode === 'create';
  ADM.logged = true; closeAdminForm();
  store.set('teacherCfg', readCfg());
  updateAdminUI();
  setMsg($('exSetupMsg'), created
    ? '🔐 Öğretmen şifresi oluşturuldu. Artık ayarlar ve sonuçlar yalnızca bu şifreyle açılır. Şifreni unutma!'
    : '🔐 Şifre değiştirildi.', 'good');
});
$('exAdminCreate').addEventListener('click', () => openAdminForm('create'));
$('exAdminLogin').addEventListener('click', () => openAdminForm('login'));
$('exAdminChange').addEventListener('click', () => openAdminForm('change'));
$('exAdminLogout').addEventListener('click', () => { adminLogout(); setMsg($('exSetupMsg'), 'Öğretmen oturumu kapatıldı.'); });
$('exAdminCancel').addEventListener('click', closeAdminForm);
$('exAdminForgot').addEventListener('click', () => {
  if (!confirm('Şifreyi sıfırlamak için bu bilgisayardaki BÜTÜN SINAV SONUÇLARI silinecek (öğrencilerin sonuçları görmesini önlemek için). Devam edilsin mi?')) return;
  localStorage.removeItem('ert_admin');
  store.set('exams', []);
  ADM.logged = false; closeAdminForm(); updateAdminUI();
  setMsg($('exSetupMsg'), 'Öğretmen şifresi ve sonuçlar silindi. İstersen yeni şifre oluşturabilirsin.', 'info');
});
// Öğretmenin ayarları bu bilgisayarda saklanır (öğrenci bu ayarlarla başlar)
$('exCfg').addEventListener('change', () => { if (!E.locked && teacherAllowed()) store.set('teacherCfg', readCfg()); });

/* --- Düğmeler --- */
$('exStart').addEventListener('click', startExam);
$('exPlay').addEventListener('click', examPlay);
$('exGo').addEventListener('click', examGo);
$('exRedo').addEventListener('click', examRedo);
$('exNext').addEventListener('click', examNext);
$('exTap').addEventListener('pointerdown', e => { e.preventDefault(); tap(); });
$('exAgain').addEventListener('click', backToSetup);
$('exPrint').addEventListener('click', () => window.print());
$('exCsv').addEventListener('click', () => {
  if (shownRec) download(`sinav-${fileSafe(shownRec.name)}-${shownRec.code}.csv`, csvOf([shownRec]));
});
$('exCsvAll').addEventListener('click', () => download('sinav-sonuclari.csv', csvOf(store.get('exams', []))));
$('exClear').addEventListener('click', () => {
  if (!teacherAllowed()) return;
  if (confirm('Bu bilgisayardaki bütün sınav sonuçları silinsin mi? Bu geri alınamaz.')) {
    store.set('exams', []); renderSaved();
  }
});
$('exLinkBtn').addEventListener('click', async () => {
  const c = readCfg();
  const base = location.protocol.startsWith('http') ? location.origin + location.pathname : CANON_URL;
  const url = base + '?' + cfgToQuery(c);
  $('exLink').value = url;
  try { await navigator.clipboard.writeText(url); setMsg($('exSetupMsg'), '🔗 Bağlantı kopyalandı. Öğrencilerle paylaşabilirsin.', 'good'); }
  catch (_) { $('exLink').select(); setMsg($('exSetupMsg'), 'Bağlantıyı seçip kopyala (Ctrl+C).', 'info'); }
});

/* --- Bağlantıdaki ayarları uygula ve kilitle --- */
function lockToCfg(q) {
  writeCfg({ ...q, code: q.code || randomCode() });
  readCfg(); // değerleri doğrula/düzelt
  E.locked = true;
  updateAdminUI();
  setTab('exam');
}

// Masaüstü uygulamasında bağlantı tıklanarak açılamaz; öğrenci yapıştırır
$('exPasteBtn').addEventListener('click', () => {
  const text = $('exPaste').value.trim();
  const i = text.indexOf('?');
  const q = i >= 0 ? cfgFromQuery(text.slice(i)) : null;
  if (!q) {
    setMsg($('exSetupMsg'), 'Bu bir sınav bağlantısı değil. Öğretmeninin verdiği bağlantının tamamını yapıştır.', 'bad');
    return;
  }
  lockToCfg(q);
  setMsg($('exSetupMsg'), `✓ Sınav ayarları yüklendi (kod ${readCfg().code}). Adını yazıp sınavı başlat.`, 'good');
  $('exName').focus();
});

/* --- Başlangıç: bağlantıyla gelindiyse ayarları kilitle; yoksa öğretmenin kayıtlı ayarları --- */
(function initExam() {
  const q = cfgFromQuery();
  if (q) { lockToCfg(q); return; }
  const saved = store.get('teacherCfg', null);
  if (saved) { writeCfg(saved); readCfg(); }
  else $('exCode').value = randomCode();
  updateAdminUI();
})();

/* =========================================================
   Klavye kısayolları
   ========================================================= */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT') return;
  // Yazı alanlarında (öğrenci adı vb.) yazarken piyano çalmasın
  if (e.target.tagName === 'TEXTAREA' ||
      (e.target.tagName === 'INPUT' && !['range', 'checkbox'].includes(e.target.type))) return;
  if (e.code === 'Space') e.preventDefault();
  if (e.repeat) return;

  // Sınavda ritim sorusu: Boşluk = vuruş, Enter = çalmaya başla
  const examRhythm = activeTab === 'exam' && !$('exRun').hidden && isRhythm(exItem());
  if (activeTab === 'rhythm' || examRhythm) {
    if (e.code === 'Space') tap();
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (examRhythm) examGo();
      else if (R.durs.length && R.phase === 'idle') runRhythm('record');
    }
  } else {
    if (KEYMAP[e.code] !== undefined) pressNote(60 + kbOctave + KEYMAP[e.code]);
    else if (e.code === 'KeyZ' || e.code === 'KeyX') { kbOctave = e.code === 'KeyX' ? 12 : 0; markKbOctave(); }
  }
});
document.addEventListener('keyup', e => { if (e.code === 'Space') e.preventDefault(); });
