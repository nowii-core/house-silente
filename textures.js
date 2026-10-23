'use strict';
/* SHADOWLINE - texture procedurali (colore + rilievo nel canale alpha). Nessun file esterno. */
const Tex = (function () {
  const lib = {};

  function ph(x, y, s) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // rumore di valore periodico (tileabile): px,py = periodo in celle del reticolo
  function tn(x, y, px, py, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
    const a = ph(x0, y0, s), b = ph(x1, y0, s), c = ph(x0, y1, s), d = ph(x1, y1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(u, v, fx, fy, oct, s) {
    let a = 0.5, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) { sum += a * tn(u * fx, v * fy, fx, fy, s + o * 17); norm += a; fx *= 2; fy *= 2; a *= 0.5; }
    return sum / norm;
  }
  const cl = function (v) { return v < 0 ? 0 : (v > 1 ? 1 : v); };
  const sm = function (a, b, x) { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mix = function (a, b, t) { return a + (b - a) * t; };

  function build(w, h, fn) {
    const d = new Uint8Array(w * h * 4);
    const out = [0, 0, 0, 0];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      fn(x, y, x / w, y / h, out);
      const i = (y * w + x) * 4;
      d[i] = cl(out[0]) * 255; d[i + 1] = cl(out[1]) * 255; d[i + 2] = cl(out[2]) * 255; d[i + 3] = cl(out[3]) * 255;
    }
    return { w: w, h: h, data: d };
  }
  function textMask(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    draw(g, w, h);
    const id = g.getImageData(0, 0, w, h).data;
    const m = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) m[i] = id[i * 4 + 3] / 255;
    return m;
  }
  // pennello per graffi
  function scratches(t, n, seed, light) {
    const w = t.w, h = t.h, d = t.data;
    let r = mulberry32(seed);
    for (let k = 0; k < n; k++) {
      let x = r() * w, y = r() * h;
      const a = r() * Math.PI, len = 8 + r() * 60, dx = Math.cos(a), dy = Math.sin(a), amt = 20 + r() * 40;
      for (let s = 0; s < len; s++) {
        const xi = ((x | 0) + w) % w, yi = ((y | 0) + h) % h, i = (yi * w + xi) * 4;
        d[i] = Math.min(255, d[i] + amt * light); d[i + 1] = Math.min(255, d[i + 1] + amt * light); d[i + 2] = Math.min(255, d[i + 2] + amt * light);
        d[i + 3] = Math.max(0, d[i + 3] - 25);
        x += dx; y += dy;
      }
    }
  }

  /* -------------------------------- calcestruzzo -------------------------------- */
  function concrete() {
    const W = 512;
    return build(W, W, function (x, y, u, v, o) {
      const n1 = fbm(u, v, 4, 4, 4, 3), n2 = fbm(u, v, 24, 24, 3, 9), st = fbm(u, v, 7, 2, 3, 21);
      let b = 0.46 + (n1 - 0.5) * 0.30 + (n2 - 0.5) * 0.14;
      b *= 1 - 0.38 * sm(0.55, 0.85, st);
      let hgt = 0.55 + (n2 - 0.5) * 0.5;
      if (ph(x, y, 5) > 0.992) { b *= 0.55; hgt -= 0.3; }
      const ex = Math.min(x, W - 1 - x), ey = Math.min(y, W - 1 - y), e = Math.min(ex, ey);
      if (e < 2) { b *= 0.5; hgt = 0.05; } else if (e < 5) { b *= 1.08; hgt = 0.7; }
      // fori dei casseri
      [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].forEach(function (c) {
        const d = Math.hypot(x - c[0] * W, y - c[1] * W);
        if (d < 7) { b *= 0.35; hgt = 0.1; } else if (d < 10) { b *= 0.8; hgt = 0.8; }
      });
      o[0] = b * 1.0; o[1] = b * 0.985; o[2] = b * 0.95; o[3] = hgt;
    });
  }

  /* -------------------------------- mattoni -------------------------------- */
  function brick() {
    const W = 512, H = 500, bw = 64, bh = 20;
    return build(W, H, function (x, y, u, v, o) {
      const row = (y / bh) | 0, off = (row & 1) ? bw / 2 : 0;
      const bx = (x + off) % bw, by = y % bh;
      const id = ph(((x + off) / bw) | 0, row, 7);
      const mortar = bx < 3 || by < 3;
      const grime = fbm(u, v, 5, 5, 4, 31), fine = fbm(u, v, 40, 40, 2, 11);
      if (mortar) {
        const m = 0.50 + fine * 0.15;
        o[0] = m; o[1] = m * 0.97; o[2] = m * 0.9; o[3] = 0.15;
      } else {
        const rr = 0.46 + id * 0.20 + (fine - 0.5) * 0.14;
        o[0] = rr; o[1] = rr * (0.36 + id * 0.08); o[2] = rr * (0.27 + id * 0.05);
        const edge = Math.min(bx - 3, bw - 1 - bx, by - 3, bh - 1 - by);
        o[3] = 0.62 + (fine - 0.5) * 0.35 + (edge < 2 ? -0.1 : 0);
        if (ph(x, y, 13) > 0.995) { o[0] *= 0.6; o[1] *= 0.6; o[2] *= 0.6; }
      }
      const dirt = 1 - 0.38 * sm(0.5, 0.85, grime) - 0.25 * sm(0.7, 1, v);
      o[0] *= dirt; o[1] *= dirt; o[2] *= dirt;
    });
  }

  /* -------------------------------- lamiera -------------------------------- */
  function metal() {
    const W = 512, P = 256;
    const t = build(W, W, function (x, y, u, v, o) {
      const px = x % P, py = y % P;
      const e = Math.min(px, P - 1 - px, py, P - 1 - py);
      const n = fbm(u, v, 5, 5, 4, 41), f = fbm(u, v, 48, 48, 2, 7);
      let r = 0.20 + (n - 0.5) * 0.10, g = 0.235 + (n - 0.5) * 0.10, b = 0.27 + (n - 0.5) * 0.10, hgt = 0.6;
      if (e < 3) { r = g = b = 0.04; hgt = 0.0; }
      else if (e < 6) { r *= 1.7; g *= 1.7; b *= 1.7; hgt = 0.8; }
      // rivetti
      const rx = Math.abs((px % 32) - 16), ry = Math.abs(py - 16), ry2 = Math.abs(py - (P - 17));
      const rxx = Math.abs(px - 16), rxx2 = Math.abs(px - (P - 17)), ryy = Math.abs((py % 32) - 16);
      const rv = Math.min(Math.hypot(rx, ry), Math.hypot(rx, ry2), Math.hypot(rxx, ryy), Math.hypot(rxx2, ryy));
      if (rv < 4.5) { r = g = b = 0.33; hgt = 1; } else if (rv < 6.5) { r *= 0.5; g *= 0.5; b *= 0.5; hgt = 0.3; }
      // ruggine ai bordi e macchie
      const rust = sm(0.58, 0.82, fbm(u, v, 7, 7, 4, 77) + (e < 14 ? (14 - e) * 0.012 : 0));
      r = mix(r, 0.36, rust * 0.7); g = mix(g, 0.18, rust * 0.7); b = mix(b, 0.08, rust * 0.7);
      const dirt = 1 - 0.25 * sm(0.55, 0.9, f);
      o[0] = r * dirt; o[1] = g * dirt; o[2] = b * dirt; o[3] = hgt + (f - 0.5) * 0.1 - rust * 0.1;
    });
    scratches(t, 90, 5, 0.9);
    return t;
  }

  /* -------------------------------- pannelli tecnici -------------------------------- */
  function tech() {
    const W = 512, P = 128;
    return build(W, W, function (x, y, u, v, o) {
      const px = x % P, py = y % P, e = Math.min(px, P - 1 - px, py, P - 1 - py);
      const pid = ((x / P) | 0) + ((y / P) | 0) * 4;
      const n = fbm(u, v, 6, 6, 3, 55), f = fbm(u, v, 50, 50, 2, 3);
      let r = 0.075 + n * 0.05, g = 0.09 + n * 0.05, b = 0.105 + n * 0.055, hgt = 0.6 + (f - 0.5) * 0.1;
      if (e < 2) { r = g = b = 0.015; hgt = 0; } else if (e < 4) { r *= 1.9; g *= 1.9; b *= 1.9; hgt = 0.8; }
      if ((pid % 3) === 1 && e > 10 && py > 20 && py < 108) { // feritoie
        if ((py % 8) < 4) { r = g = b = 0.01; hgt = 0.05; } else { hgt = 0.9; }
      }
      if (pid === 5 || pid === 10) { // strisce luminose
        if (py > 60 && py < 68 && px > 8 && px < 120) { r = 0.35; g = 1.0; b = 1.0; hgt = 0.5; }
      }
      if (pid === 6 && px > 20 && px < 36 && py > 20 && py < 30) { r = 1.0; g = 0.45; b = 0.08; }
      if (pid === 9 && px > 92 && px < 106 && py > 90 && py < 100) { r = 0.2; g = 1.0; b = 0.4; }
      o[0] = r; o[1] = g; o[2] = b; o[3] = hgt;
    });
  }

  /* -------------------------------- cassa di legno -------------------------------- */
  function crate() {
    const W = 512;
    const mask = textMask(W, W, function (g, w, h) {
      g.fillStyle = '#fff'; g.font = 'bold 74px Arial Narrow, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('VOLKOV', w / 2, h * 0.5);
      g.font = 'bold 34px Arial'; g.fillText('▲  FRAGILE  ▲', w / 2, h * 0.64);
    });
    return build(W, W, function (x, y, u, v, o) {
      const pl = (x / 64) | 0, px = x % 64;
      const gid = ph(pl, 0, 15);
      const grain = fbm(u, v, 64, 3, 3, 33 + pl), fine = fbm(u, v, 128, 12, 2, 5);
      let r = 0.42 + gid * 0.12 + (grain - 0.5) * 0.28, g = r * 0.72, b = r * 0.45;
      let hgt = 0.55 + (grain - 0.5) * 0.4;
      if (px < 2) { r *= 0.4; g *= 0.4; b *= 0.4; hgt = 0; }
      // nodi
      const kx = ((pl * 97) % 40) + 12, ky = 80 + ((pl * 211) % 340);
      const kd = Math.hypot(px - kx, (y - ky) * 0.6);
      if (kd < 9) { const k = 0.45 + kd / 18; r *= k; g *= k; b *= k; hgt -= 0.15; }
      // fasce metalliche
      const band = y < 42 || y > W - 43;
      if (band) {
        const m = 0.14 + fine * 0.06; r = m; g = m * 1.02; b = m * 1.08; hgt = 0.9;
        const bx = Math.abs((x % 96) - 48), by = Math.abs((y < 42 ? 21 : W - 22) - y);
        if (Math.hypot(bx, by) < 5) { r = g = b = 0.35; hgt = 1; }
      }
      // diagonale
      if (!band && Math.abs((x - 0) - (y - 42) * (W - 4) / (W - 86)) < 22 && Math.abs(x - y) < 400) { /* travi */ }
      const m = mask[y * W + x];
      if (m > 0 && !band) { r = mix(r, 0.06, m * 0.85); g = mix(g, 0.07, m * 0.85); b = mix(b, 0.05, m * 0.85); }
      const dirt = 1 - 0.3 * sm(0.55, 0.9, fbm(u, v, 5, 5, 3, 91));
      o[0] = r * dirt; o[1] = g * dirt; o[2] = b * dirt; o[3] = hgt;
    });
  }

  /* -------------------------------- porte -------------------------------- */
  function door(red) {
    const W = 512, H = 720;
    const mask = textMask(W, H, function (g, w, h) {
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 40px Arial'; g.fillText(red ? 'ACCESSO LIMITATO' : 'SETTORE', w / 2, h * 0.34);
      if (red) { g.font = 'bold 60px Arial'; g.fillText('⚠', w / 2, h * 0.43); }
    });
    return build(W, H, function (x, y, u, v, o) {
      const n = fbm(u, v, 5, 7, 4, red ? 61 : 62), f = fbm(u, v, 40, 56, 2, 8);
      let r, g, b;
      if (red) { r = 0.36 + n * 0.12; g = 0.055 + n * 0.02; b = 0.05 + n * 0.02; }
      else { r = 0.20 + n * 0.08; g = 0.235 + n * 0.08; b = 0.26 + n * 0.08; }
      let hgt = 0.6;
      const cx = Math.abs(x - W / 2);
      if (y < 70) { // fascia di pericolo
        const d = ((x + y) >> 5) & 1;
        r = d ? 0.9 : 0.04; g = d ? 0.7 : 0.04; b = d ? 0.05 : 0.04; hgt = 0.4;
        if (y > 62) { r *= 0.3; g *= 0.3; b *= 0.3; hgt = 0.1; }
      } else {
        if (cx < 3) { r = g = b = 0.01; hgt = 0; }
        // pannelli incassati
        const inset = (px, py, w, h) => px > w[0] && px < w[1] && py > h[0] && py < h[1];
        const panels = [[30, 232, 100, 330], [280, 482, 100, 330], [30, 232, 390, 680], [280, 482, 390, 680]];
        for (let k = 0; k < 4; k++) {
          const p = panels[k];
          if (inset(x, y, [p[0], p[1]], [p[2], p[3]])) {
            const ed = Math.min(x - p[0], p[1] - x, y - p[2], p[3] - y);
            if (ed < 4) { r *= 0.45; g *= 0.45; b *= 0.45; hgt = 0.1; } else if (ed < 8) { r *= 1.5; g *= 1.5; b *= 1.5; hgt = 0.85; } else hgt = 0.5;
          }
        }
        // nervature
        if (Math.abs(y - 360) < 6) { r *= 0.5; g *= 0.5; b *= 0.5; hgt = 0.15; }
        // finestrella (porta normale)
        if (!red && x > 200 && x < 312 && y > 150 && y < 200) { r = 0.02; g = 0.05; b = 0.07; hgt = 0.3; }
        // lettore tessera / tastierino
        if (x > 392 && x < 470 && y > 330 && y < 440) {
          r = g = b = 0.03; hgt = 0.7;
          if (red && x > 424 && x < 438 && y > 350 && y < 362) { r = 1.0; g = 0.08; b = 0.04; hgt = 1; }
          if (!red && x > 424 && x < 438 && y > 350 && y < 362) { r = 0.15; g = 1.0; b = 0.35; hgt = 1; }
          if (y > 380 && y < 430 && ((x - 395) % 20) < 14 && ((y - 380) % 16) < 11) { r = g = b = 0.12; }
        }
      }
      const m = mask[y * W + x];
      if (m > 0) { r = mix(r, red ? 0.9 : 0.8, m * 0.8); g = mix(g, red ? 0.75 : 0.7, m * 0.8); b = mix(b, red ? 0.1 : 0.15, m * 0.8); }
      const dirt = 1 - 0.3 * sm(0.55, 0.9, fbm(u, v, 6, 8, 3, 19)) - 0.18 * sm(0.75, 1, v);
      o[0] = r * dirt; o[1] = g * dirt; o[2] = b * dirt; o[3] = hgt + (f - 0.5) * 0.06;
    });
  }

  /* -------------------------------- pavimenti -------------------------------- */
  function floorA() {
    const W = 512, T = 256;
    const t = build(W, W, function (x, y, u, v, o) {
      const tx = x % T, ty = y % T, e = Math.min(tx, T - 1 - tx, ty, T - 1 - ty);
      const tid = ph((x / T) | 0, (y / T) | 0, 3);
      const n = fbm(u, v, 4, 4, 4, 23 + ((tid * 3) | 0)), f = fbm(u, v, 30, 30, 3, 6), stain = fbm(u, v, 6, 6, 4, 88);
      let b = 0.30 + (n - 0.5) * 0.18 + (f - 0.5) * 0.08 + tid * 0.04;
      b *= 1 - 0.45 * sm(0.58, 0.8, stain);
      let hgt = 0.5 + (f - 0.5) * 0.25;
      if (e < 3) { b *= 0.35; hgt = 0.05; } else if (e < 5) { b *= 1.15; hgt = 0.7; }
      o[0] = b * 0.98; o[1] = b; o[2] = b * 1.02; o[3] = hgt;
    });
    scratches(t, 140, 11, 0.5);
    return t;
  }
  function floorB() {
    const W = 512, C = 32;
    return build(W, W, function (x, y, u, v, o) {
      const cx = (x % C) / C, cy = (y % C) / C;
      const a = Math.abs(cx + cy - 1) * 1.414, b = Math.abs(cx - cy) * 1.414;
      const bar1 = 1 - cl(a / 0.17), bar2 = 1 - cl(b / 0.17);
      let hgt = Math.max(bar1, bar2);
      // le barre sono alternate (rombi inclinati) come lamiera mandorlata
      const odd = (((x / C) | 0) + ((y / C) | 0)) & 1;
      if (odd) hgt = Math.max(1 - cl(Math.abs(cx - 0.5) / 0.13) * (cy > 0.1 && cy < 0.9 ? 1 : 9), 1 - cl(Math.abs(cy - 0.5) / 0.13) * (cx > 0.1 && cx < 0.9 ? 1 : 9)) * 0.9;
      hgt = Math.max(hgt, 0);
      const n = fbm(u, v, 5, 5, 4, 14), f = fbm(u, v, 60, 60, 2, 2);
      let base = 0.13 + (n - 0.5) * 0.06 + hgt * 0.07;
      base *= 1 - 0.4 * sm(0.6, 0.85, fbm(u, v, 6, 6, 3, 77));
      o[0] = base * 0.95; o[1] = base * 0.98; o[2] = base * 1.05; o[3] = 0.25 + hgt * 0.6 + (f - 0.5) * 0.05;
    });
  }
  function ceil() {
    const W = 512, T = 128;
    return build(W, W, function (x, y, u, v, o) {
      const tx = x % T, ty = y % T, e = Math.min(tx, T - 1 - tx, ty, T - 1 - ty);
      const f = fbm(u, v, 60, 60, 2, 4), n = fbm(u, v, 4, 4, 3, 40);
      let b = 0.40 + (f - 0.5) * 0.12 + (n - 0.5) * 0.12;
      let hgt = 0.55 + (f - 0.5) * 0.4;
      if (ph(x >> 1, y >> 1, 9) > 0.93) { b *= 0.55; hgt -= 0.3; }
      if (e < 3) { b = 0.1; hgt = 0; } else if (e < 5) { b *= 1.25; hgt = 0.8; }
      b *= 1 - 0.3 * sm(0.6, 0.85, fbm(u, v, 5, 5, 3, 51));
      o[0] = b; o[1] = b * 0.99; o[2] = b * 0.95; o[3] = hgt;
    });
  }

  /* -------------------------------- mimetiche e stoffa -------------------------------- */
  function camo(kind) {
    const W = 256;
    const pal = kind === 'A'
      ? [[0.05, 0.075, 0.04], [0.13, 0.17, 0.08], [0.24, 0.22, 0.12], [0.07, 0.06, 0.04]]
      : [[0.045, 0.047, 0.05], [0.10, 0.105, 0.115], [0.16, 0.165, 0.175], [0.03, 0.03, 0.035]];
    return build(W, W, function (x, y, u, v, o) {
      const a = fbm(u, v, 3, 3, 3, 71), b = fbm(u, v, 4, 4, 3, 83);
      let c;
      if (a > 0.58) c = pal[1]; else if (a < 0.40) c = pal[0]; else c = pal[2];
      if (b > 0.62) c = pal[3];
      const w1 = 0.9 + 0.1 * Math.sin(x * 1.57) * Math.sin(y * 1.57), f = ph(x, y, 4) * 0.06;
      o[0] = c[0] * w1 + f * 0.3; o[1] = c[1] * w1 + f * 0.3; o[2] = c[2] * w1 + f * 0.3; o[3] = 0.5 + 0.35 * Math.sin(x * 1.57) * Math.sin(y * 1.57) * 0.5 + f;
    });
  }
  function cloth() {
    const W = 128;
    return build(W, W, function (x, y, u, v, o) {
      const w = 0.5 + 0.5 * Math.sin(x * 1.57) * Math.sin(y * 1.57), f = ph(x, y, 2) * 0.2;
      const b = 0.055 + w * 0.02 + f * 0.02;
      o[0] = b; o[1] = b * 1.02; o[2] = b * 1.06; o[3] = 0.4 + w * 0.4 + f;
    });
  }

  /* -------------------------------- oggetti -------------------------------- */
  function barrel() {
    const W = 256;
    const mask = textMask(W, W, function (g, w, h) {
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.beginPath(); g.moveTo(w * 0.5, h * 0.3); g.lineTo(w * 0.62, h * 0.52); g.lineTo(w * 0.38, h * 0.52); g.closePath(); g.fill();
      g.fillStyle = '#000'; g.font = 'bold 26px Arial'; g.fillText('!', w * 0.5, h * 0.46);
      g.fillStyle = '#fff'; g.font = 'bold 20px Arial'; g.fillText('INFIAMMABILE', w * 0.5, h * 0.6);
    });
    return build(W, W, function (x, y, u, v, o) {
      const n = fbm(u, v, 4, 6, 4, 13), rust = sm(0.55, 0.8, fbm(u, v, 5, 7, 4, 91));
      let r = 0.38 + (n - 0.5) * 0.12, g = 0.045, b = 0.035, hgt = 0.6;
      const ring = (y < 12 || y > 243 || Math.abs(y - 64) < 3 || Math.abs(y - 192) < 3);
      if (ring) { r *= 0.5; g *= 0.5; b *= 0.5; hgt = 0.9; }
      if ((x < 3 || x > 252) && false) { hgt = 0.2; }
      r = mix(r, 0.3, rust * 0.6); g = mix(g, 0.14, rust * 0.6); b = mix(b, 0.06, rust * 0.6);
      const m = mask[y * W + x];
      if (m > 0) {
        const yellow = (y < h2(W, 0.54));
        const gg = yellow ? 0.8 : 0.9;
        r = mix(r, 0.9, m); g = mix(g, gg * 0.75, m); b = mix(b, yellow ? 0.05 : 0.9, m);
      }
      o[0] = r; o[1] = g; o[2] = b; o[3] = hgt - rust * 0.1;
    });
  }
  function h2(W, f) { return W * f; }

  function medkit() {
    const W = 128;
    return build(W, W, function (x, y, u, v, o) {
      let r = 0.8, g = 0.8, b = 0.78, hgt = 0.5;
      const e = Math.min(x, y, W - 1 - x, W - 1 - y);
      if (e < 3) { r = g = b = 0.4; }
      const cx = Math.abs(x - 64), cy = Math.abs(y - 64);
      if ((cx < 10 && cy < 34) || (cy < 10 && cx < 34)) { r = 0.8; g = 0.05; b = 0.05; hgt = 0.7; }
      o[0] = r; o[1] = g; o[2] = b; o[3] = hgt;
    });
  }
  function ammo() {
    const W = 128;
    const mask = textMask(W, W, function (g, w, h) {
      g.fillStyle = '#fff'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MUNIZIONI', w / 2, 40);
      for (let i = 0; i < 6; i++) { g.fillRect(24 + i * 14, 62, 8, 30); g.beginPath(); g.arc(28 + i * 14, 62, 4, Math.PI, 0); g.fill(); }
    });
    return build(W, W, function (x, y, u, v, o) {
      const n = fbm(u, v, 6, 6, 3, 17);
      let r = 0.13 + n * 0.05, g = 0.16 + n * 0.05, b = 0.07 + n * 0.03, hgt = 0.5;
      const e = Math.min(x, y, W - 1 - x, W - 1 - y);
      if (e < 4) { r *= 0.5; g *= 0.5; b *= 0.5; }
      const m = mask[y * W + x];
      if (m > 0) { r = mix(r, 0.85, m); g = mix(g, 0.7, m); b = mix(b, 0.1, m); }
      o[0] = r; o[1] = g; o[2] = b; o[3] = hgt;
    });
  }
  function screen(done) {
    const W = 256;
    const mask = textMask(W, W, function (g, w, h) {
      g.fillStyle = '#fff'; g.font = '16px monospace'; g.textAlign = 'left'; g.textBaseline = 'top';
      if (done) { g.font = 'bold 46px Arial'; g.textAlign = 'center'; g.fillText('✔', w / 2, 70); g.font = 'bold 20px monospace'; g.fillText('ACCESSO OK', w / 2, 150); }
      else {
        const lines = ['> SYS.BREACH', '> auth ..... FAIL', '> bypass -f 0x4F2A', '> decrypt ##########', '> uplink: LOCKED', '> ', '[E] HACK', ''];
        lines.forEach(function (s, i) { g.fillText(s, 14, 18 + i * 26); });
      }
    });
    return build(W, W, function (x, y, u, v, o) {
      const scan = 0.85 + 0.15 * Math.sin(y * 3.14);
      const base = done ? [0.0, 0.10, 0.04] : [0.0, 0.06, 0.09];
      const m = mask[y * W + x];
      const c = done ? [0.2, 1.0, 0.45] : [0.35, 0.95, 1.0];
      o[0] = mix(base[0], c[0], m) * scan; o[1] = mix(base[1], c[1], m) * scan; o[2] = mix(base[2], c[2], m) * scan; o[3] = 0.5;
    });
  }
  function card() {
    const W = 128;
    return build(W, W, function (x, y, u, v, o) {
      let r = 0.65, g = 0.04, b = 0.04, hgt = 0.5;
      if (y > 20 && y < 38) { r = g = b = 0.05; }
      if (x > 20 && x < 46 && y > 56 && y < 82) { r = 0.9; g = 0.75; b = 0.25; hgt = 0.8; }
      if (y > 100 && y < 108) { r = 0.95; g = 0.95; b = 0.95; }
      o[0] = r; o[1] = g; o[2] = b; o[3] = hgt;
    });
  }
  function hazard() {
    return build(128, 128, function (x, y, u, v, o) {
      const d = ((x + y) >> 4) & 1;
      o[0] = d ? 0.85 : 0.04; o[1] = d ? 0.65 : 0.04; o[2] = d ? 0.04 : 0.04; o[3] = 0.5;
    });
  }

  /* -------------------------------- atlante particelle e decalcomanie -------------------------------- */
  function atlas() {
    const S = 512, T = 128;
    const d = new Uint8Array(S * S * 4);
    function put(tile, fn) {
      const ox = (tile % 4) * T, oy = ((tile / 4) | 0) * T;
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const r = fn(x / T, y / T, x, y);
        const i = ((oy + y) * S + ox + x) * 4;
        d[i] = cl(r[0]) * 255; d[i + 1] = cl(r[1]) * 255; d[i + 2] = cl(r[2]) * 255; d[i + 3] = cl(r[3]) * 255;
      }
    }
    // 0 fumo
    put(0, function (u, v, x, y) {
      const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy) * 2;
      const n = tn(u * 6, v * 6, 6, 6, 3) * 0.6 + tn(u * 12, v * 12, 12, 12, 5) * 0.4;
      const a = cl(1 - r) * cl(1.15 - r * 0.9) * (0.45 + n * 0.8);
      return [1, 1, 1, cl(a * a * 2.2)];
    });
    // 1 stella del lampo di bocca
    put(1, function (u, v) {
      const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy) * 2, an = Math.atan2(dy, dx);
      const spikes = 0.45 + 0.55 * Math.pow(Math.abs(Math.cos(an * 3.5)), 5) + 0.25 * Math.pow(Math.abs(Math.cos(an * 7 + 1)), 8);
      const a = cl(1 - r / spikes);
      return [1, 0.85 + 0.15 * a, 0.5 + 0.5 * a * a, cl(a * 1.6)];
    });
    // 2 scintilla
    put(2, function (u, v) {
      const r = Math.hypot(u - 0.5, v - 0.5) * 2;
      const a = Math.pow(cl(1 - r), 2.2);
      return [1, 0.8, 0.4, a];
    });
    // 3 nube di sangue
    put(3, function (u, v) {
      const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy) * 2;
      const n = tn(u * 8, v * 8, 8, 8, 7);
      const a = cl((1 - r * (0.75 + n * 0.6)) * 2);
      return [0.55, 0.02, 0.02, a];
    });
    // 4 foro di proiettile
    put(4, function (u, v) {
      const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy) * 2;
      const n = tn(u * 10, v * 10, 10, 10, 9);
      const core = cl((0.24 - r) * 12);
      const ring = cl(1 - Math.abs(r - 0.42 - n * 0.12) * 9) * 0.55;
      const crack = Math.pow(Math.abs(Math.cos(Math.atan2(dy, dx) * 3)), 18) * cl(1 - r) * 0.5;
      const a = cl(core + ring + crack) * cl(1.2 - r);
      return [0.03 + ring * 0.12, 0.03 + ring * 0.12, 0.03 + ring * 0.12, a];
    });
    // 5 pozza di sangue
    put(5, function (u, v) {
      const dx = u - 0.5, dy = v - 0.5, an = Math.atan2(dy, dx), r = Math.hypot(dx, dy) * 2;
      const wob = 0.62 + 0.16 * Math.sin(an * 3 + 1) + 0.1 * Math.sin(an * 5 + 2) + tn(u * 6, v * 6, 6, 6, 11) * 0.12;
      const a = cl((wob - r) * 6);
      return [0.22 + a * 0.05, 0.01, 0.01, a * 0.92];
    });
    // 6 fuoco
    put(6, function (u, v) {
      const dx = u - 0.5, dy = v - 0.55, r = Math.hypot(dx, dy) * 2;
      const n = tn(u * 7, v * 7, 7, 7, 13) * 0.55 + tn(u * 14, v * 14, 14, 14, 15) * 0.45;
      const a = cl((1 - r) * 1.8 * (0.5 + n));
      return [1, 0.45 + a * 0.5, 0.08 + a * a * 0.5, cl(a * 1.4)];
    });
    // 7 alone soffuso
    put(7, function (u, v) {
      const r = Math.hypot(u - 0.5, v - 0.5) * 2;
      const a = Math.pow(cl(1 - r), 1.6);
      return [1, 1, 1, a];
    });
    // 8 pezzetto di detrito
    put(8, function (u, v) {
      const inside = Math.abs(u - 0.5) < 0.3 && Math.abs(v - 0.5) < 0.3;
      return inside ? [0.35, 0.33, 0.3, 1] : [0, 0, 0, 0];
    });
    // 9 striscia per tracciante
    put(9, function (u, v) {
      const a = Math.pow(cl(1 - Math.abs(v - 0.5) * 2), 1.5) * Math.pow(cl(1 - Math.abs(u - 0.5) * 2), 0.5);
      return [1, 0.9, 0.55, a];
    });
    return { w: S, h: S, data: d };
  }


  /* =============================== HORROR: casa e scuola =============================== */
  function wallpaper() {
    const S = 256;
    return build(S, S, function (x, y, u, v, o) {
      const sw = 32, sx = x % sw, band = ((x / sw) | 0) & 1;
      const cx = sx - 16, cy = (y % 64) - 32;
      const d = Math.abs(cx) * 1.1 + Math.abs(cy) * 0.55;
      const motif = d < 8 ? 1 : (d < 10.5 ? 0.5 : 0);
      let r = band ? 0.30 : 0.26, g = band ? 0.33 : 0.29, b = band ? 0.25 : 0.22;
      if (sx < 2 || sx >= sw - 2) { r *= 0.8; g *= 0.8; b *= 0.8; }
      r = mix(r, 0.44, motif * 0.6); g = mix(g, 0.40, motif * 0.6); b = mix(b, 0.27, motif * 0.6);
      const gr = fbm(u, v, 4, 4, 4, 91), fine = fbm(u, v, 40, 40, 2, 3), st = fbm(u, v, 3, 9, 3, 71);
      const dirt = 1 - 0.5 * sm(0.5, 0.85, gr) - 0.3 * sm(0.62, 0.9, st);
      const k = dirt * (0.9 + fine * 0.2);
      o[0] = r * k; o[1] = g * k; o[2] = b * k; o[3] = 0.5 + motif * 0.25 + (fine - 0.5) * 0.2;
    });
  }
  function plaster() {
    const S = 256;
    return build(S, S, function (x, y, u, v, o) {
      const n = fbm(u, v, 4, 4, 4, 5), f = fbm(u, v, 48, 48, 2, 8), st = fbm(u, v, 3, 7, 4, 17);
      let b = 0.5 + (n - 0.5) * 0.25 + (f - 0.5) * 0.1;
      b *= 1 - 0.55 * sm(0.55, 0.85, st);
      let hgt = 0.5 + (f - 0.5) * 0.5;
      if (fbm(u, v, 9, 9, 3, 33) > 0.78) { b *= 1.18; hgt = 0.3; }     // intonaco scrostato
      o[0] = b * 0.62; o[1] = b * 0.78; o[2] = b * 0.64; o[3] = hgt;
    });
  }
  function tileWall() {
    const S = 256, T = 32;
    return build(S, S, function (x, y, u, v, o) {
      const tx = x % T, ty = y % T, e = Math.min(tx, T - 1 - tx, ty, T - 1 - ty);
      const id = ph((x / T) | 0, (y / T) | 0, 4), n = fbm(u, v, 5, 5, 4, 12), st = fbm(u, v, 3, 6, 4, 77);
      let b = 0.62 + (id - 0.5) * 0.1 + (n - 0.5) * 0.2;
      b *= 1 - 0.65 * sm(0.5, 0.82, st);
      let r = b, g = b * 0.98, bl = b * 0.9, hgt = 0.6;
      if (e < 1.5) { r = 0.12; g = 0.11; bl = 0.1; hgt = 0.05; }
      if (st > 0.72 && ph(x, y, 2) > 0.5) { r *= 0.55; g *= 0.4; bl *= 0.3; }
      o[0] = r; o[1] = g; o[2] = bl; o[3] = hgt;
    });
  }
  function woodWall() {
    const S = 256;
    return build(S, S, function (x, y, u, v, o) {
      const pw = 32, px = x % pw, id = ph((x / pw) | 0, 0, 6);
      const gr = fbm(u + id, v, 3, 40, 3, (id * 9) | 0), n = fbm(u, v, 5, 5, 3, 3);
      let b = 0.20 + id * 0.05 + (gr - 0.5) * 0.12 + (n - 0.5) * 0.06;
      let hgt = 0.5 + (gr - 0.5) * 0.3;
      if (px < 2 || px >= pw - 1) { b *= 0.35; hgt = 0.05; }
      o[0] = b * 1.15; o[1] = b * 0.78; o[2] = b * 0.5; o[3] = hgt;
    });
  }
  function floorWood() {
    const S = 512;
    return build(S, S, function (x, y, u, v, o) {
      const ph0 = 64, py = (y / ph0) | 0, off = ph(py, 1, 2) * 300, lx = (x + off) % S, seg = 170;
      const bid = ph(py, ((lx + 0) / seg) | 0, 7), by = y % ph0, bx = lx % seg;
      const gr = fbm(u, v + bid, 5, 90, 3, (bid * 20) | 0), n = fbm(u, v, 4, 4, 4, 31), st = fbm(u, v, 5, 5, 4, 66);
      let b = 0.22 + bid * 0.08 + (gr - 0.5) * 0.14 + (n - 0.5) * 0.1;
      b *= 1 - 0.55 * sm(0.55, 0.85, st);
      let hgt = 0.5 + (gr - 0.5) * 0.3;
      if (by < 2 || bx < 2) { b *= 0.3; hgt = 0.05; }
      o[0] = b * 1.1; o[1] = b * 0.76; o[2] = b * 0.5; o[3] = hgt;
    });
  }
  function floorTile() {
    const S = 256, T = 64;
    return build(S, S, function (x, y, u, v, o) {
      const tx = x % T, ty = y % T, e = Math.min(tx, T - 1 - tx, ty, T - 1 - ty);
      const chk = (((x / T) | 0) + ((y / T) | 0)) & 1;
      const n = fbm(u, v, 4, 4, 4, 52), f = fbm(u, v, 40, 40, 2, 9), st = fbm(u, v, 4, 4, 4, 19);
      let b = (chk ? 0.12 : 0.55) + (n - 0.5) * 0.14 + (f - 0.5) * 0.06;
      b *= 1 - 0.6 * sm(0.52, 0.82, st);
      let hgt = 0.55;
      if (e < 2) { b *= 0.25; hgt = 0.05; }
      o[0] = b; o[1] = b * 0.98; o[2] = b * 0.92; o[3] = hgt;
    });
  }
  function ceilPlaster() {
    const S = 256;
    return build(S, S, function (x, y, u, v, o) {
      const n = fbm(u, v, 4, 4, 4, 41), f = fbm(u, v, 50, 50, 2, 4), st = fbm(u, v, 3, 3, 4, 28);
      let b = 0.34 + (n - 0.5) * 0.12 + (f - 0.5) * 0.08;
      b *= 1 - 0.45 * sm(0.5, 0.8, st);
      o[0] = b; o[1] = b * 0.96; o[2] = b * 0.86; o[3] = 0.5 + (f - 0.5) * 0.4;
    });
  }
  function doorWood() {
    const W = 256, H = 364;
    return build(W, H, function (x, y, u, v, o) {
      const gr = fbm(u, v, 4, 36, 3, 8), n = fbm(u, v, 5, 5, 3, 3);
      let b = 0.2 + (gr - 0.5) * 0.12 + (n - 0.5) * 0.06, hgt = 0.5;
      const inP = function (x0, y0, x1, y1) { return x > x0 && x < x1 && y > y0 && y < y1; };
      const edgeP = function (x0, y0, x1, y1) { return Math.min(x - x0, x1 - x, y - y0, y1 - y); };
      [[34, 30, 222, 160], [34, 190, 222, 334]].forEach(function (p) {
        if (inP(p[0], p[1], p[2], p[3])) { const e = edgeP(p[0], p[1], p[2], p[3]); hgt = e < 5 ? 0.15 : 0.62; b *= e < 5 ? 0.6 : 1.1; }
      });
      if (Math.hypot(x - 214, y - 190) < 9) { b = 0.62; hgt = 0.95; o[0] = b; o[1] = b * 0.8; o[2] = b * 0.4; o[3] = hgt; return; }
      o[0] = b * 1.15; o[1] = b * 0.78; o[2] = b * 0.5; o[3] = hgt;
    });
  }
  function doorIron() {
    const W = 256, H = 364;
    return build(W, H, function (x, y, u, v, o) {
      const n = fbm(u, v, 6, 6, 4, 14), f = fbm(u, v, 60, 60, 2, 3);
      let b = 0.15 + (n - 0.5) * 0.08 + (f - 0.5) * 0.03, hgt = 0.5;
      if (x % 64 < 3 || y % 91 < 3) { b *= 0.6; hgt = 0.1; }
      if ((x % 64 < 12 && x % 64 > 6 && (y % 91 < 12) && (y % 91 > 6))) { b = 0.3; hgt = 0.9; }
      const rust = sm(0.55, 0.8, fbm(u, v, 5, 5, 4, 66));
      o[0] = b + rust * 0.12; o[1] = b * (1 - rust * 0.3); o[2] = b * (1 - rust * 0.6); o[3] = hgt;
    });
  }
  function furnWood() {
    const S = 128;
    return build(S, S, function (x, y, u, v, o) {
      const gr = fbm(u, v, 3, 30, 3, 5), n = fbm(u, v, 6, 6, 3, 9);
      const b = 0.17 + (gr - 0.5) * 0.12 + (n - 0.5) * 0.05;
      o[0] = b * 1.2; o[1] = b * 0.8; o[2] = b * 0.52; o[3] = 0.5 + (gr - 0.5) * 0.3;
    });
  }
  function fabric(kind) {
    const S = 128;
    const c = kind === 'sofa' ? [0.28, 0.07, 0.06] : (kind === 'bed' ? [0.55, 0.52, 0.42] : [0.2, 0.17, 0.1]);
    return build(S, S, function (x, y, u, v, o) {
      const w = (((x >> 1) + (y >> 1)) & 1) * 0.08, n = fbm(u, v, 5, 5, 3, 4), st = fbm(u, v, 4, 4, 4, 88);
      let b = 0.8 + w + (n - 0.5) * 0.3; b *= 1 - 0.5 * sm(0.6, 0.85, st);
      o[0] = c[0] * b * 1.6; o[1] = c[1] * b * 1.6; o[2] = c[2] * b * 1.6; o[3] = 0.5 + w;
    });
  }
  function locker() {
    const S = 128;
    return build(S, S, function (x, y, u, v, o) {
      const n = fbm(u, v, 4, 4, 4, 22), f = fbm(u, v, 60, 60, 2, 1);
      let b = 0.3 + (n - 0.5) * 0.12 + (f - 0.5) * 0.04, hgt = 0.5;
      // feritoie di aerazione
      if (x > 24 && x < 104 && y > 14 && y < 40 && ((y - 14) % 7) < 3) { b = 0.03; hgt = 0.05; }
      if (x > 24 && x < 104 && y > 80 && y < 106 && ((y - 80) % 7) < 3) { b = 0.03; hgt = 0.05; }
      const rust = sm(0.55, 0.8, fbm(u, v, 6, 6, 4, 61));
      o[0] = b * (0.55 + rust * 0.8); o[1] = b * (0.8 - rust * 0.1); o[2] = b * (0.65 - rust * 0.35); o[3] = hgt;
    });
  }
  function books() {
    const S = 128;
    return build(S, S, function (x, y, u, v, o) {
      const bw = 7, id = ph((x / bw) | 0, (y / 32) | 0, 3), bx = x % bw;
      const hue = id * 6.28;
      let r = 0.22 + 0.16 * Math.sin(hue), g = 0.14 + 0.1 * Math.sin(hue + 2), b = 0.1 + 0.1 * Math.sin(hue + 4);
      const sh = (y % 32);
      if (bx < 1 || sh < 2) { r = g = b = 0.02; }
      if (sh > 6 && sh < 9) { r += 0.2; g += 0.17; b += 0.08; }
      o[0] = r; o[1] = g; o[2] = b; o[3] = bx < 1 ? 0.1 : 0.6;
    });
  }
  function rug() {
    const S = 256;
    return build(S, S, function (x, y, u, v, o) {
      const cx = u - 0.5, cy = v - 0.5, d = Math.max(Math.abs(cx), Math.abs(cy));
      let r = 0.28, g = 0.04, b = 0.05;
      if (d > 0.44) { r = 0.05; g = 0.04; b = 0.04; } else if (d > 0.4) { r = 0.5; g = 0.38; b = 0.15; }
      else if (Math.abs(((x % 32) - 16)) + Math.abs(((y % 32) - 16)) < 9) { r = 0.4; g = 0.28; b = 0.1; }
      const n = fbm(u, v, 30, 30, 2, 6), st = fbm(u, v, 4, 4, 4, 91);
      const k = (0.8 + n * 0.4) * (1 - 0.5 * sm(0.55, 0.85, st));
      o[0] = r * k; o[1] = g * k; o[2] = b * k; o[3] = 0.5 + n * 0.3;
    });
  }
  function paper() {
    return build(64, 64, function (x, y, u, v, o) {
      const n = fbm(u, v, 6, 6, 3, 3);
      const b = 0.72 + (n - 0.5) * 0.2;
      let r = b, g = b * 0.93, bl = b * 0.72;
      if (y % 9 === 5 && x > 7 && x < 56) { r *= 0.4; g *= 0.4; bl *= 0.45; }
      o[0] = r; o[1] = g; o[2] = bl; o[3] = 0.5;
    });
  }
  function bloodTex() {
    return build(128, 128, function (x, y, u, v, o) {
      const n = fbm(u, v, 5, 5, 4, 12);
      o[0] = 0.25 + n * 0.1; o[1] = 0.01; o[2] = 0.01; o[3] = 0.5;
    });
  }


  function painting() {
    const W = 128, H = 180;
    return build(W, H, function (x, y, u, v, o) {
      const n = fbm(u, v, 5, 5, 4, 7), f = fbm(u, v, 40, 40, 2, 5);
      let b = 0.22 + (n - 0.5) * 0.12 - v * 0.05;
      let r = b * 1.2, g = b * 0.95, bl = b * 0.7;
      const cx = (u - 0.5) / 0.2, cy = (v - 0.36) / 0.15;
      const head = cx * cx + cy * cy;
      if (head < 1) { const s = 0.34 - head * 0.1; r = s * 1.1; g = s * 0.85; bl = s * 0.65; }
      const sx = (u - 0.5) / 0.38, sy = (v - 0.95) / 0.35;
      if (sx * sx + sy * sy < 1 && v > 0.52) { r = 0.07; g = 0.065; bl = 0.06; }
      const ex = Math.abs(u - 0.5) - 0.07, ey = v - 0.34;
      if (ex * ex * 900 + ey * ey * 1600 < 1) { r = 0.02; g = 0.02; bl = 0.02; }
      const st = fbm(u, v, 3, 5, 4, 66);
      const k = 1 - 0.5 * sm(0.6, 0.85, st);
      o[0] = r * k; o[1] = g * k; o[2] = bl * k; o[3] = 0.5 + (f - 0.5) * 0.3;
    });
  }

  function makeAll() {
    const defs = {
      wallpaper: wallpaper, plaster: plaster, tileWall: tileWall, woodWall: woodWall,
      floorA: floorWood, floorB: floorTile, ceil: ceilPlaster,
      doorWood: doorWood, doorIron: doorIron, furnWood: furnWood,
      sofa: function () { return fabric('sofa'); }, sheet: function () { return fabric('bed'); },
      locker: locker, painting: painting, books: books, rug: rug, paper: paper, blood: bloodTex
    };
    for (const k in defs) {
      const t = defs[k]();
      lib[k] = GLX.texture(t.w, t.h, t.data, { srgb: true });
    }
    const a = atlas();
    lib.atlas = GLX.texture(a.w, a.h, a.data, { srgb: false, clamp: true, aniso: false });
    // texture bianca di default
    lib.white = GLX.texture(2, 2, new Uint8Array([255, 255, 255, 128, 255, 255, 255, 128, 255, 255, 255, 128, 255, 255, 255, 128]), { srgb: true });
  }

  return { make: makeAll, get: function (n) { return lib[n] || lib.white; }, lib: lib };
})();
