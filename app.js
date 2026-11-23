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

function genDurations(n, style, rng = Math.random) {
  const cells = RCELLS[style] || RCELLS.even;
  let best = null;
  for (let tries = 0; tries < 30; tries++) {
    const out = [];
    // Son nota hariç hepsini tam hücrelerle doldur (kalıplar yarıda kesilmesin)
    while (out.length < n - 1) {
      const fit = cells.filter(c => c.length <= n - 1 - out.length);
      out.push(...pick(fit, rng));
    }
    // Son nota vuruş başında başlar, en az bir vuruş sürer (ezgi "bitmiş" duyulsun)
    out.push(style === 'even' ? 1 : pick([1, 1, 2], rng));
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
const DUR_SET = [2, 1.5, 1, 0.75, 0.5, T, 0.25];
const nearestDur = b => DUR_SET.reduce((best, d) => Math.abs(Math.log2(b / d)) < Math.abs(Math.log2(b / best)) ? d : best);

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
function rhythmText(r) {
  const bad = r.items.filter(x => !x.ok);
  const parts = bad.slice(0, 3).map(x => {
    const near = nearestDur(x.sung);
    const how = x.err < 0 ? 'kısa' : 'uzun';
    return near !== x.beats
      ? `${x.i + 1}. nota ${how} (${durName(x.beats)} yerine ${durName(near)} gibi)`
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
    // Notanın süresini gösteren çubuk (2 vuruş = tam genişlik).
    // Cevaplanmadan gösterilmez, yoksa ritmi önceden ele verir.
    if (inp !== undefined || M.revealed) {
      const dur = M.durs[i] || 1;
      const bar = document.createElement('i');
      const rb = M.rbad.includes(i);
      bar.className = 'dur' + (rb ? ' rbad' : '');
      bar.style.width = Math.min(100, dur * 50) + '%';
      d.title = durName(dur) + (rb ? ' — ritim hatalı' : '');
      d.appendChild(bar);
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
function playSeq(target, durs, { bpm, countIn = 0, refDo = false, bus }) {
  const a = audio();
  const beat = 60 / bpm;
  let lead = 0.15;
  if (refDo) { tone(60, a.currentTime + lead, 1.0, 0.32, bus); lead += 1.8; }
  const t0 = a.currentTime + lead + countIn * beat;
  // Giriş: bir ölçü (4 vuruş) metronom, ezgi ondan sonra başlar
  for (let i = 0; i < countIn; i++) {
    click(t0 - (countIn - i) * beat, i === 0 ? 1600 : 1100, 0.08, bus);
  }
  lead += countIn * beat;
  let pos = 0; // vuruş cinsinden konum
  const notes = [];
  target.forEach((m, i) => {
    const d = durs[i] || 1;
    // Legato: nota bir sonrakine kadar sürer (son nota biraz daha uzun çınlar)
    const len = d * beat * (i === target.length - 1 ? 1.3 : 0.98);
    tone(m, t0 + pos * beat, len, 0.32, bus);
    notes.push([m, d * beat, lead + pos * beat]);
    pos += d;
  });
  const lastD = durs[target.length - 1] || 1;
  return {
    keysAt: lead + (pos - lastD * 0.3) * beat,
    micAt: lead + (pos + lastD * 0.3) * beat + 0.4,
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
  const countIn = $('mCount').checked ? 4 : 0;
  M.phase = 'playing'; M.input = []; M.times = []; M.rbad = []; M.revealed = false;
  M.beat = 60 / +mBpm.value;
  renderSlots();
  setMsg(mMsg, countIn ? '🎧 Dinle… (4 vuruş giriş)' : '🎧 Dinle…');

  const p = playSeq(M.target, M.durs, { bpm: +mBpm.value, countIn, bus: M.bus });
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
  M.target = genMelody(+mLen.value, SCALES[$('mScale').value]);
  M.durs = genDurations(M.target.length, $('mRhythm').value);
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
      `✗ ${i + 1}. nota yanlış: ${noteName(m)} ${verb}, doğrusu ${noteName(M.target[i])}. ` +
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
        setMsg(mMsg, `◐ Perdeler doğru, ama ritimde ${r.total - r.ok} hata var: ${rhythmText(r)}.` +
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
   SINAV
   - Öğretmen ayarları seçer, bir sınav kodu belirler ve öğrenci bağlantısı oluşturur.
   - Aynı kod + aynı ayarlar → herkes aynı soruları alır (tohumlu rastgele üreteç).
   - Sınav sırasında doğru/yanlış gösterilmez; dinleme hakkı sınırlıdır.
   - Puan: her soruda (nota sayısı − düzeltme uzaklığı) / nota sayısı.
   ========================================================= */
const CANON_URL = 'https://gryflute-ui.github.io/ezgi-ritim/';
const exMsg = $('exMsg');
const examMicUI = { live: $('exMic'), note: $('exMicNote'), level: $('exMicLevel') };

const E = {
  cfg: null, items: [], i: 0,
  state: 'idle',   // idle | ready | playing | answering | answered
  listens: 0, answer: [], timers: [], bus: null,
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
  const c = {
    code,
    q: clampInt($('exQ').value, 1, 40, 10),
    nmin, nmax,
    scale: SCALES[$('exScale').value] ? $('exScale').value : 'major',
    rhythm: RCELLS[$('exRhythm').value] ? $('exRhythm').value : 'simple',
    bpm: clampInt($('exBpm').value, 50, 160, 80),
    listens: clampInt($('exListens').value, 1, 3, 2),
    answer: $('exAnswer').value === 'keys' ? 'keys' : 'voice',
    refDo: $('exDo').checked,
    countIn: $('exCount').checked,
    rw: [0, 30, 50].includes(+$('exRW').value) ? +$('exRW').value : 30  // ritmin puandaki payı (%)
  };
  writeCfg(c); // düzeltilmiş değerleri forma geri yaz
  return c;
}

function writeCfg(c) {
  $('exCode').value = c.code; $('exQ').value = c.q;
  $('exNmin').value = c.nmin; $('exNmax').value = c.nmax;
  $('exScale').value = c.scale; $('exRhythm').value = c.rhythm;
  $('exBpm').value = c.bpm; $('exListens').value = c.listens;
  $('exAnswer').value = c.answer;
  $('exDo').checked = c.refDo; $('exCount').checked = c.countIn;
  $('exRW').value = c.rw;
}

// Bağlantıdaki adlar (Türkçe, kısa)
const QKEYS = { code: 'kod', q: 'soru', nmin: 'enaz', nmax: 'encok', scale: 'dizi', rhythm: 'ritim',
                bpm: 'tempo', listens: 'hak', answer: 'cevap', refDo: 'do', countIn: 'giris', rw: 'ritimpuan' };

function cfgToQuery(c) {
  const p = new URLSearchParams({ sinav: '1' });
  for (const [k, q] of Object.entries(QKEYS)) p.set(q, typeof c[k] === 'boolean' ? (c[k] ? '1' : '0') : c[k]);
  return p.toString();
}

function cfgFromQuery() {
  const p = new URLSearchParams(location.search);
  if (!p.has('sinav')) return null;
  const g = (k, d) => p.has(QKEYS[k]) ? p.get(QKEYS[k]) : d;
  return {
    code: g('code', ''), q: g('q', 10), nmin: g('nmin', 3), nmax: g('nmax', 6),
    scale: g('scale', 'major'), rhythm: g('rhythm', 'simple'), bpm: g('bpm', 80),
    listens: g('listens', 2), answer: g('answer', 'voice'),
    refDo: g('refDo', '1') === '1', countIn: g('countIn', '1') === '1',
    rw: g('rw', '0')   // ritim puanı eklenmeden önce oluşturulan bağlantılarda ritim puanlanmaz
  };
}

function buildItems(c) {
  // Sorular yalnızca bu ayarlara bağlıdır (tempo ve dinleme hakkı soruları değiştirmez)
  const rng = mulberry32(hashStr(JSON.stringify([c.code, c.q, c.nmin, c.nmax, c.scale, c.rhythm])));
  return Array.from({ length: c.q }, (_, i) => {
    // Nota sayısı sorular boyunca en azdan en çoğa doğru artar
    const n = Math.round(c.nmin + (c.nmax - c.nmin) * (c.q > 1 ? i / (c.q - 1) : 0));
    const target = genMelody(n, SCALES[c.scale], rng);
    return { target, durs: genDurations(n, c.rhythm, rng), answer: [] };
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

// Bir sorunun bütün puanları: perde, ritim ve ağırlıklı toplam (0–1)
function scoreItem(it, cfg) {
  const sp = itemScore(it);
  const r = rhythmEval(it.target, it.durs, it.answer, it.times, 60 / cfg.bpm);
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
  b.disabled = E.listens <= 0 || E.state === 'playing';
}

function stopExamAudio() {
  E.timers.forEach(clearTimeout); E.timers = [];
  killBus(E.bus); E.bus = null;
  stopListening();
}

async function startExam() {
  const name = $('exName').value.trim();
  if (!name) { setMsg($('exSetupMsg'), 'Lütfen adını ve soyadını yaz.', 'bad'); $('exName').focus(); return; }
  E.cfg = readCfg();
  stopMelody(); cancelRhythm();

  if (E.cfg.answer === 'voice' && !(await openMic())) {
    setMsg($('exSetupMsg'), '🎤 Mikrofona erişilemedi. Tarayıcıda mikrofon izni verip tekrar dene.', 'bad');
    return;
  }
  setMsg($('exSetupMsg'), '');
  E.student = { name, no: $('exNo').value.trim() };
  E.items = buildItems(E.cfg);
  E.i = 0;

  // Sınav süresince diğer sekmeler kapalı; sayfadan çıkarken uyarı
  document.querySelectorAll('.tab').forEach(b => { b.disabled = b.dataset.tab !== 'exam'; });
  window.onbeforeunload = e => { e.preventDefault(); return ''; };
  if (E.cfg.answer === 'keys') $('exPianoHost').appendChild(pianoBox);

  $('exSetup').hidden = true; $('exResult').hidden = true; $('exRun').hidden = false;
  $('exWho').textContent = name + (E.student.no ? ` (${E.student.no})` : '');
  $('exTotal').textContent = E.items.length;
  showQuestion();
}

function showQuestion() {
  stopExamAudio();
  E.listens = E.cfg.listens; E.answer = []; E.times = []; E.state = 'ready';
  $('exNum').textContent = E.i + 1;
  $('exProg').style.width = (E.i / E.items.length * 100) + '%';
  $('exRedo').disabled = true;
  $('exNext').disabled = true;
  $('exNext').textContent = E.i === E.items.length - 1 ? 'Sınavı bitir ✓' : 'Sonraki soru →';
  setPlayBtn();
  renderExSlots();
  setMsg(exMsg, `Hazır olunca “Dinle”ye bas. ${exItem().target.length} notalık bir ezgi; ` +
    `${E.cfg.listens} kez dinleyebilirsin.` + (E.cfg.refDo ? ' Ezgiden önce Do sesi verilir.' : ''));
}

function examPlay() {
  if (E.listens <= 0 || E.state === 'playing') return;
  stopExamAudio();
  E.listens--; E.answer = []; E.times = []; E.state = 'playing';
  setPlayBtn(); renderExSlots();
  $('exRedo').disabled = true; $('exNext').disabled = true;
  setMsg(exMsg, E.cfg.refDo ? '🎧 Önce Do sesi, sonra ezgi… Dinle.' : '🎧 Dinle…');
  E.bus = newBus();
  const it = exItem();
  const p = playSeq(it.target, it.durs, { bpm: E.cfg.bpm, countIn: E.cfg.countIn ? 4 : 0, refDo: E.cfg.refDo, bus: E.bus });
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

function finishAnswer(text) {
  stopListening();
  E.state = 'answered';
  setPlayBtn();
  $('exRedo').disabled = false;
  $('exNext').disabled = false;
  const last = E.i === E.items.length - 1;
  setMsg(exMsg, `${text} ${last ? '“Sınavı bitir”e bas.' : '“Sonraki soru”ya geç.'}`, E.answer.length ? 'good' : 'bad');
}

function examRedo() {
  if (E.state !== 'answering' && E.state !== 'answered') return;
  stopListening();
  E.answer = []; E.times = [];
  renderExSlots();
  beginAnswer();
}

function examKey(m) {
  if (E.state === 'idle' || E.state === 'playing') return;
  // Sesle cevapta piyano susar (mikrofon onu da duyardı)
  if (E.cfg.answer === 'voice' && E.state === 'answering') return;
  tone(m, audio().currentTime);
  flashKey(m);
  if (E.cfg.answer === 'keys') examNote(m, audio().currentTime);
}

function examNext() {
  if (E.state === 'playing' || E.state === 'ready') return;
  const n = exItem().target.length;
  if (E.answer.length < n &&
      !confirm(`Bu soruda ${n} notadan ${E.answer.length} tanesini cevapladın. Yine de geçmek istiyor musun?`)) return;
  stopExamAudio();
  exItem().answer = E.answer.slice();
  exItem().times = E.times.slice();
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
  const avg = k => Math.round(100 * sc.reduce((a, x) => a + x[k], 0) / sc.length);
  const rec = {
    name: E.student.name, no: E.student.no,
    date: new Date().toISOString(),
    code: E.cfg.code, cfg: E.cfg,
    score: avg('s'), pitch: avg('sp'), rhythm: avg('sr'),
    items: E.items.map((it, i) => ({
      t: it.target, d: it.durs, a: it.answer,
      o: (it.times || []).map(x => Math.round((x - it.times[0]) * 1000)), // başlama anları (ms)
      s: sc[i].s, sp: sc[i].sp, sr: sc[i].sr, rb: sc[i].rbad
    }))
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
  $('exRName').textContent = rec.name + (rec.no ? ` (${rec.no})` : '');
  const rw = rec.cfg.rw || 0;
  $('exRMeta').textContent = `${new Date(rec.date).toLocaleString('tr-TR')} · Sınav kodu ${rec.code} · ` +
    `${rec.items.length} soru · ${rec.cfg.answer === 'voice' ? 'sesle cevap' : 'piyanoyla cevap'}` +
    (rw ? ` · Perde ${rec.pitch} · Ritim ${rec.rhythm} (puanın %${rw}${rw === 50 ? "'si" : "'u"} ritim)` : ' · Ritim puanlanmadı');
  $('exRScore').textContent = rec.score;

  const pct = v => v === undefined ? '—' : Math.round(v * 100) + '%';
  const body = $('exRBody');
  body.innerHTML = '';
  rec.items.forEach((it, i) => {
    const tr = document.createElement('tr');
    const td = txt => { const c = document.createElement('td'); if (txt !== undefined) c.textContent = txt; tr.appendChild(c); return c; };
    td(i + 1);
    td(it.t.map(noteName).join(' '));
    const ans = td();
    if (!it.a.length) ans.textContent = '—';
    else align(it.t, it.a).ops.forEach(o => {
      const s = document.createElement(o.op === 'skip' ? 's' : 'span');
      const rb = rw && o.aj !== undefined && (it.rb || []).includes(o.aj);
      s.className = 'rn ' + o.op + (rb ? ' rbad' : '');
      s.textContent = noteName(o.op === 'skip' ? o.t : o.a);
      if (rb) s.title = 'Bu notanın süresi (ritmi) hatalı';
      ans.appendChild(s);
    });
    td(pct(it.sp ?? it.s));
    td(rw ? pct(it.sr) : '—');
    td(pct(it.s));
    body.appendChild(tr);
  });
}

/* --- CSV (Excel için ; ayraçlı, Türkçe karakterler için BOM'lu) --- */
function csvOf(recs) {
  const maxQ = Math.max(0, ...recs.map(r => r.items.length));
  const esc = v => { v = String(v ?? ''); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const head = ['Ad Soyad', 'Numara', 'Tarih', 'Sınav kodu', 'Cevap', 'Puan (100)',
    'Perde (100)', 'Ritim (100)', 'Ritim payı (%)',
    ...Array.from({ length: maxQ }, (_, i) => `S${i + 1} (%)`)];
  const rows = recs.map(r => [
    r.name, r.no, new Date(r.date).toLocaleString('tr-TR'), r.code,
    r.cfg.answer === 'voice' ? 'ses' : 'piyano', r.score,
    r.pitch ?? r.score, r.cfg.rw ? r.rhythm : '', r.cfg.rw || 0,
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
  renderSaved();
}

/* --- Düğmeler --- */
$('exStart').addEventListener('click', startExam);
$('exPlay').addEventListener('click', examPlay);
$('exRedo').addEventListener('click', examRedo);
$('exNext').addEventListener('click', examNext);
$('exAgain').addEventListener('click', backToSetup);
$('exPrint').addEventListener('click', () => window.print());
$('exCsv').addEventListener('click', () => {
  if (shownRec) download(`sinav-${fileSafe(shownRec.name)}-${shownRec.code}.csv`, csvOf([shownRec]));
});
$('exCsvAll').addEventListener('click', () => download('sinav-sonuclari.csv', csvOf(store.get('exams', []))));
$('exClear').addEventListener('click', () => {
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

/* --- Başlangıç: bağlantıyla gelindiyse ayarları kilitle --- */
(function initExam() {
  const q = cfgFromQuery();
  if (q) {
    writeCfg({ ...q, code: q.code || randomCode() });
    readCfg(); // değerleri doğrula/düzelt
    $('exCfg').disabled = true;
    $('exLockedNote').hidden = false;
    $('exTeacher').hidden = true;
    $('exSaved').hidden = true;
    E.locked = true;
    setTab('exam');
  } else {
    $('exCode').value = randomCode();
  }
  renderSaved();
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

  if (activeTab === 'melody' || activeTab === 'exam') {
    if (KEYMAP[e.code] !== undefined) pressNote(KEYMAP[e.code]);
  } else {
    if (e.code === 'Space') tap();
    else if (e.key === 'Enter' && R.slots.length) { e.preventDefault(); runRhythm('record'); }
  }
});
document.addEventListener('keyup', e => { if (e.code === 'Space') e.preventDefault(); });
