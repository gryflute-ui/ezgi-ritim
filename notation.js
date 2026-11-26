'use strict';

/* =========================================================
   Porte (nota yazısı) çizimi — SVG
   Notation.svg({ notes, meter, percussion }) bir SVG metni döner.

   notes: [{ step, acc, q, triplet, color, ghost }]
     step    : diatonik konum, alt çizgi Mi4 = 0, Do4 = −2, Fa5 = 8 (vurmalıda yok sayılır)
     acc     : −1 bemol, 0 doğal, 1 diyez (null: işaret yok)
     q       : süre, dörtlük cinsinden (1 = dörtlük, 0.5 = sekizlik, 1.5 = noktalı dörtlük …)
     triplet : üçleme notası mı
     color   : nota rengi (yoksa yazı rengi)
     ghost   : { step, acc, color } — aynı yerde soluk ikinci nota (öğrencinin yanlış cevabı)
   meter: { num, den, beatQ, barQ }  (beatQ: vuruş = kaç dörtlük; 6/8'de 1,5)
   ========================================================= */
const Notation = (() => {
  const SP = 5;            // yarım aralık (piksel): çizgi ile boşluk arası
  const STEM = 30;         // sap uzunluğu
  const EPS = 1e-6;

  // Süreyi nota türüne çevir: taban değer (4,2,1,0.5,0.25), nokta, bayrak sayısı
  function typeOf(q, triplet) {
    if (triplet) q = q * 1.5;                       // üçleme sekizliği → sekizlik görünümü
    const bases = [4, 2, 1, 0.5, 0.25];
    for (const b of bases) {
      if (Math.abs(q - b) < EPS) return { base: b, dot: false };
      if (Math.abs(q - b * 1.5) < EPS) return { base: b, dot: true };
    }
    // Bilinmeyen süre: en yakın taban
    const b = bases.reduce((x, y) => Math.abs(Math.log2(q / y)) < Math.abs(Math.log2(q / x)) ? y : x);
    return { base: b, dot: false };
  }
  const flagsOf = base => base === 0.5 ? 1 : base === 0.25 ? 2 : 0;

  function svg({ notes, meter, percussion = false }) {
    const top = percussion ? 34 : 38;                     // en üst çizginin y'si
    const lineY = s => top + (8 - s) * SP;                // step → y (vurmalı: tek çizgi)
    const pY = n => percussion ? top + 20 : lineY(n.step);
    const height = percussion ? 96 : 132;
    const parts = [];
    let x = 8;

    // Anahtar
    if (percussion) {
      parts.push(`<rect x="${x + 4}" y="${top + 12}" width="3" height="16"/><rect x="${x + 10}" y="${top + 12}" width="3" height="16"/>`);
      x += 24;
    } else {
      parts.push(`<text x="${x}" y="${lineY(2) + 14}" font-size="52" class="clef">𝄞</text>`);
      x += 40;
    }
    // Ölçü işareti
    const mid = percussion ? top + 20 : lineY(4);
    parts.push(`<text x="${x + 8}" y="${mid - 3}" class="tsig" text-anchor="middle">${meter.num}</text>`,
               `<text x="${x + 8}" y="${mid + 17}" class="tsig" text-anchor="middle">${meter.den}</text>`);
    x += 28;

    // Notaların yatay yerleşimi, ölçü çizgileri, vuruş grupları
    let cum = 0;
    const laid = [];
    const bars = [];
    let accState = {};   // ölçü içinde hangi harf/oktav hangi işaretle yazıldı
    notes.forEach((n, i) => {
      if (i > 0 && Math.abs(cum / meter.barQ - Math.round(cum / meter.barQ)) < EPS) {
        bars.push(x); x += 14; accState = {};
      }
      const t = typeOf(n.q, n.triplet);
      // Değiştirme işareti gerekiyor mu? (ölçü içinde aynı harfte değişiklik olunca)
      let accMark = null;
      if (!percussion && n.acc !== null && n.acc !== undefined) {
        const key = n.step;
        const prev = accState[key] ?? 0;
        if (n.acc !== prev) accMark = n.acc;
        accState[key] = n.acc;
      }
      const w = 22 + 20 * Math.sqrt(n.q) + (accMark !== null ? 10 : 0) + (t.dot ? 6 : 0);
      const hx = x + (accMark !== null ? 12 : 0) + 6;
      laid.push({ n, t, hx, y: pY(n), accMark, beat: Math.floor(cum / meter.beatQ + EPS), start: cum });
      cum += n.q;
      x += w;
    });
    const endX = x + 4;

    // Porte çizgileri
    const lines = [];
    if (percussion) lines.push(`<line x1="4" x2="${endX}" y1="${top + 20}" y2="${top + 20}"/>`);
    else for (let s = 0; s <= 8; s += 2) lines.push(`<line x1="4" x2="${endX}" y1="${lineY(s)}" y2="${lineY(s)}"/>`);
    const yTop = percussion ? top + 12 : lineY(8), yBot = percussion ? top + 28 : lineY(0);
    bars.forEach(bx => parts.push(`<line x1="${bx}" x2="${bx}" y1="${yTop}" y2="${yBot}" class="bar"/>`));
    parts.push(`<line x1="${endX - 6}" x2="${endX - 6}" y1="${yTop}" y2="${yBot}" class="bar"/>`,
               `<rect x="${endX - 3}" y="${yTop}" width="3.5" height="${yBot - yTop}"/>`);

    // Sap yönü: grup için ortak (ortalama konum orta çizginin altındaysa yukarı)
    const upOf = arr => percussion || arr.reduce((a, l) => a + l.n.step, 0) / arr.length < 4;

    // Çengel bağı grupları: aynı vuruştaki ardışık bayraklı notalar
    const groups = [];
    laid.forEach(l => {
      const f = flagsOf(l.t.base);
      const g = groups[groups.length - 1];
      if (f && g && g.beat === l.beat && g.items[g.items.length - 1].flagged) g.items.push({ ...l, flagged: true });
      else groups.push({ beat: l.beat, items: [{ ...l, flagged: !!f }] });
    });

    const notesSvg = [];
    const head = (l, color, hollow, cls = '') => {
      const c = color ? ` style="color:${color}"` : '';
      notesSvg.push(`<ellipse cx="${l.hx}" cy="${l.y}" rx="5.6" ry="4.1" transform="rotate(-20 ${l.hx} ${l.y})"` +
        ` class="nh${hollow ? ' hollow' : ''} ${cls}"${c}/>`);
    };
    const ledger = (hx, step) => {
      if (percussion) return;
      for (let s = -2; s >= step; s -= 2) notesSvg.push(`<line x1="${hx - 9}" x2="${hx + 9}" y1="${lineY(s)}" y2="${lineY(s)}" class="ledger"/>`);
      for (let s = 10; s <= step; s += 2) notesSvg.push(`<line x1="${hx - 9}" x2="${hx + 9}" y1="${lineY(s)}" y2="${lineY(s)}" class="ledger"/>`);
    };
    // Değiştirme işaretleri vektörle çizilir (yazı tipleri ♯/♭'yi renkli emoji olarak gösterebiliyor).
    // (x, y): işaretin ortası; k: ölçek; style: renk
    const accPath = (a, x, y, k = 1, style = '') => {
      const L = (x1, y1, x2, y2, w) => `<line x1="${x + x1 * k}" y1="${y + y1 * k}" x2="${x + x2 * k}" y2="${y + y2 * k}" stroke-width="${w * k}"/>`;
      let body;
      if (a > 0) body = L(-1.6, -9, -1.6, 9, 1.1) + L(1.6, -10, 1.6, 8, 1.1) + L(-4, -2, 4, -4.5, 2.4) + L(-4, 4.5, 4, 2, 2.4);
      else if (a < 0) body = L(-2.5, -13, -2.5, 4, 1.2) +
        `<path d="M${x - 2.5 * k} ${y + 4 * k} C ${x + 5 * k} ${y - 1 * k}, ${x + 4 * k} ${y - 6 * k}, ${x - 2.5 * k} ${y - 2.5 * k}" fill="none" stroke-width="${1.6 * k}"/>`;
      else body = L(-2, -10, -2, 5, 1.1) + L(2, -5, 2, 10, 1.1) + L(-2, -2, 2, -3.2, 2.4) + L(-2, 3.2, 2, 2, 2.4);
      return `<g class="accp"${style}>${body}</g>`;
    };

    groups.forEach(g => {
      const beamed = g.items.length > 1 && g.items.every(l => l.flagged);
      const up = upOf(g.items);
      const stemX = l => l.hx + (up ? 5.2 : -5.2);
      // Çengel bağı yüksekliği: grubun en uç notasından sap boyu kadar
      const beamY = beamed
        ? (up ? Math.min(...g.items.map(l => l.y)) - STEM : Math.max(...g.items.map(l => l.y)) + STEM)
        : null;

      g.items.forEach((l, k) => {
        const color = l.n.color;
        const style = color ? ` style="color:${color}"` : '';
        ledger(l.hx, l.n.step);
        if (l.n.ghost && !percussion) {
          ledger(l.hx + 12, l.n.ghost.step);
          const gy = lineY(l.n.ghost.step);
          notesSvg.push(`<ellipse cx="${l.hx + 12}" cy="${gy}" rx="5.2" ry="3.8" transform="rotate(-20 ${l.hx + 12} ${gy})" class="ghost" style="color:${l.n.ghost.color}"/>`);
          if (l.n.ghost.acc) notesSvg.push(accPath(l.n.ghost.acc, l.hx + 22, gy, 0.75, ` style="color:${l.n.ghost.color}"`));
        }
        if (l.accMark !== null) notesSvg.push(accPath(l.accMark, l.hx - 13, l.y, 1, style));
        head(l, color, l.t.base >= 2);
        if (l.t.dot) {
          const onLine = !percussion && l.n.step % 2 === 0;
          notesSvg.push(`<circle cx="${l.hx + 10}" cy="${l.y - (onLine ? 3.5 : 0)}" r="1.9" class="dot"${style}/>`);
        }
        if (l.t.base >= 4) return; // birlik: sap yok
        const sx = stemX(l);
        const y2 = beamed ? beamY : (up ? l.y - STEM : l.y + STEM);
        notesSvg.push(`<line x1="${sx}" x2="${sx}" y1="${l.y}" y2="${y2}" class="stem"${style}/>`);
        // Tek bayraklı nota
        if (!beamed && l.flagged) {
          const nf = flagsOf(l.t.base);
          for (let f = 0; f < nf; f++) {
            const fy = y2 + (up ? f * 7 : -f * 7);
            const d = up ? `M${sx} ${fy} c 2 6, 10 8, 8 18 c 0 -6, -4 -10, -8 -12 z`
                         : `M${sx} ${fy} c 2 -6, 10 -8, 8 -18 c 0 6, -4 10, -8 12 z`;
            notesSvg.push(`<path d="${d}" class="flag"${style}/>`);
          }
        }
      });

      if (beamed) {
        const xs = g.items.map(stemX);
        const th = 4.2, dy = up ? 1 : -1;
        notesSvg.push(`<rect x="${xs[0] - 0.6}" y="${up ? beamY : beamY - th}" width="${xs[xs.length - 1] - xs[0] + 1.2}" height="${th}" class="beam"/>`);
        // İkinci çengel (on altılıklar)
        const y2 = up ? beamY + 7 : beamY - 7 - th;
        g.items.forEach((l, k) => {
          if (flagsOf(l.t.base) < 2) return;
          const next = g.items[k + 1], prev = g.items[k - 1];
          if (next && flagsOf(next.t.base) >= 2) {
            notesSvg.push(`<rect x="${xs[k] - 0.6}" y="${y2}" width="${xs[k + 1] - xs[k] + 1.2}" height="${th}" class="beam"/>`);
          } else if (!(prev && flagsOf(prev.t.base) >= 2)) {
            // Yalnız on altılık: kısa çengel, komşusuna doğru
            const toLeft = !next;
            const sx = toLeft ? xs[k] - 9 : xs[k];
            notesSvg.push(`<rect x="${sx - 0.6}" y="${y2}" width="10" height="${th}" class="beam"/>`);
          }
        });
        void dy;
        // Üçleme işareti
        if (g.items.some(l => l.n.triplet)) {
          const cx = (xs[0] + xs[xs.length - 1]) / 2;
          notesSvg.push(`<text x="${cx}" y="${up ? beamY - 5 : beamY + 15}" class="tuplet" text-anchor="middle">3</text>`);
        }
      } else if (g.items.some(l => l.n.triplet)) {
        g.items.filter(l => l.n.triplet).forEach(l =>
          notesSvg.push(`<text x="${l.hx}" y="${l.y - STEM - 6}" class="tuplet" text-anchor="middle">3</text>`));
      }
    });

    return `<svg class="staff" xmlns="http://www.w3.org/2000/svg" width="${endX + 6}" height="${height}" viewBox="0 0 ${endX + 6} ${height}">` +
      `<g class="lines">${lines.join('')}</g>${parts.join('')}${notesSvg.join('')}</svg>`;
  }

  return { svg, typeOf };
})();
