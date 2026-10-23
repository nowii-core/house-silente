'use strict';
/* SHADOWLINE - mondo: fisica su griglia, geometria 3D del livello, lightmap e porte */
const World = (function () {
  const WALLH = 1.5;                 // 1 unita' = 2 metri => soffitto a 3 m
  const SUB = 4;
  let Lv = null, MW = 0, MH = 0, map = null, doorAt = null;
  let chunks = [], doorNodes = [], lamps = [];
  let rmTex = null, lmTex = null, lmData = null, LW = 0, LH = 0;
  const CH = 8;

  /* ---------------- fisica / tracciamento su griglia ---------------- */
  function isWallRaw(x, y) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return true;
    const v = map[y * MW + x];
    if (v === 0) return false;
    if (v >= 6) return doorAt[y * MW + x].open < 0.75;
    return true;
  }
  function solidAt(x, y) { return isWallRaw(Math.floor(x), Math.floor(y)); }
  // distanza orizzontale dal punto (px,py) lungo (dx,dy) al primo ostacolo
  function castDist(px, py, dx, dy, maxd) {
    const len = Math.hypot(dx, dy);
    if (len === 0) return maxd;
    dx /= len; dy /= len;
    let mx = Math.floor(px), my = Math.floor(py);
    const ddx = dx === 0 ? 1e30 : Math.abs(1 / dx), ddy = dy === 0 ? 1e30 : Math.abs(1 / dy);
    let sx, sy, sdx, sdy;
    if (dx < 0) { sx = -1; sdx = (px - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - px) * ddx; }
    if (dy < 0) { sy = -1; sdy = (py - my) * ddy; } else { sy = 1; sdy = (my + 1 - py) * ddy; }
    let d = 0;
    for (let n = 0; n < 100; n++) {
      if (sdx < sdy) { d = sdx; sdx += ddx; mx += sx; } else { d = sdy; sdy += ddy; my += sy; }
      if (d > maxd) return maxd;
      if (isWallRaw(mx, my)) return d;
    }
    return maxd;
  }
  // come castDist ma restituisce anche la normale della faccia colpita (asse dominante)
  function castHit(px, py, dx, dy, maxd) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    let mx = Math.floor(px), my = Math.floor(py);
    const ddx = dx === 0 ? 1e30 : Math.abs(1 / dx), ddy = dy === 0 ? 1e30 : Math.abs(1 / dy);
    let sx, sy, sdx, sdy, side = 0;
    if (dx < 0) { sx = -1; sdx = (px - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - px) * ddx; }
    if (dy < 0) { sy = -1; sdy = (py - my) * ddy; } else { sy = 1; sdy = (my + 1 - py) * ddy; }
    let d = 0;
    for (let n = 0; n < 100; n++) {
      if (sdx < sdy) { d = sdx; sdx += ddx; mx += sx; side = 0; } else { d = sdy; sdy += ddy; my += sy; side = 1; }
      if (d > maxd) return { d: maxd, nx: 0, nz: 0 };
      if (isWallRaw(mx, my)) return { d: d, nx: side === 0 ? -sx : 0, nz: side === 1 ? -sy : 0 };
    }
    return { d: maxd, nx: 0, nz: 0 };
  }
  function los(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
    if (d < 0.01) return true;
    return castDist(x0, y0, dx, dy, d) >= d - 0.02;
  }
  function lightAt(x, z) {
    if (!lmData) return 0.3;
    const ix = Math.floor(x * SUB), iz = Math.floor(z * SUB);
    if (ix < 0 || iz < 0 || ix >= LW || iz >= LH) return 0.1;
    const i = (iz * LW + ix) * 4;
    return (lmData[i] + lmData[i + 1] + lmData[i + 2]) / 765 * 2 + 0.08;
  }
  function lightRGB(x, z, out) {
    const ix = Math.floor(x * SUB), iz = Math.floor(z * SUB);
    if (!lmData || ix < 0 || iz < 0 || ix >= LW || iz >= LH) { out[0] = out[1] = out[2] = 0.1; return out; }
    const i = (iz * LW + ix) * 4;
    out[0] = lmData[i] / 255 * 2 + 0.06; out[1] = lmData[i + 1] / 255 * 2 + 0.06; out[2] = lmData[i + 2] / 255 * 2 + 0.07;
    return out;
  }

  /* ---------------- lightmap ---------------- */
  function roomOf(x, y) {
    for (let i = 0; i < Lv.rooms.length; i++) {
      const r = Lv.rooms[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
    }
    return null;
  }
  function tintFor(room) {
    if (!room) return [1.0, 0.8, 0.55];
    switch (room.style) {
      case 2: return [0.85, 0.95, 0.8];
      case 3: return [0.8, 0.9, 1.0];
      case 4: return [1.0, 0.72, 0.45];
      default: return [1.0, 0.8, 0.55];
    }
  }
  function visSeg(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), n = Math.ceil(d / 0.2);
    for (let i = 1; i < n; i++) {
      const t = i / n, cx = Math.floor(x0 + dx * t), cy = Math.floor(y0 + dy * t);
      const v = map[cy * MW + cx];
      if (v !== 0 && v !== 5 && !(v >= 6)) return false;
    }
    return true;
  }
  function buildLightmap() {
    LW = MW * SUB; LH = MH * SUB;
    const acc = new Float32Array(LW * LH * 3), best = new Float32Array(LW * LH), bid = new Uint8Array(LW * LH);
    const R = 8.0;
    lamps.forEach(function (lp) {
      const tint = lp.tint;
      const x0 = Math.max(0, Math.floor((lp.x - R) * SUB)), x1 = Math.min(LW - 1, Math.ceil((lp.x + R) * SUB));
      const y0 = Math.max(0, Math.floor((lp.y - R) * SUB)), y1 = Math.min(LH - 1, Math.ceil((lp.y + R) * SUB));
      for (let sy = y0; sy <= y1; sy++) for (let sx = x0; sx <= x1; sx++) {
        const wx = (sx + 0.5) / SUB, wy = (sy + 0.5) / SUB;
        const d = Math.hypot(wx - lp.x, wy - lp.y);
        if (d > R) continue;
        const c = map[Math.floor(wy) * MW + Math.floor(wx)];
        if (c !== 0 && c !== 5 && c < 6) continue;
        if (!visSeg(lp.x, lp.y, wx, wy)) continue;
        const t = 1 - d / R;
        // sotto la lampada piu' luce, con caduta morbida
        const k = lp.i * (t * t * 1.05 + 0.5 / (1 + d * d * 1.6) * t);
        const o = (sy * LW + sx) * 3;
        if (k > best[sy * LW + sx]) { best[sy * LW + sx] = k; bid[sy * LW + sx] = lp.rid; }
        acc[o] += tint[0] * k; acc[o + 1] += tint[1] * k; acc[o + 2] += tint[2] * k;
      }
    });
    // distanza dalle pareti per occlusione ambientale
    const ao = new Float32Array(LW * LH).fill(1);
    const rad = 3;
    for (let sy = 0; sy < LH; sy++) for (let sx = 0; sx < LW; sx++) {
      const cx = Math.floor(sx / SUB), cy = Math.floor(sy / SUB);
      const v = map[cy * MW + cx];
      if (v !== 0 && v !== 5 && v < 6) continue;
      let bestD = rad + 1;
      for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) {
        const nx = sx + i, ny = sy + j;
        if (nx < 0 || ny < 0 || nx >= LW || ny >= LH) continue;
        const nv = map[Math.floor(ny / SUB) * MW + Math.floor(nx / SUB)];
        if (nv !== 0 && nv !== 5 && nv < 6) { const d = Math.hypot(i, j); if (d < bestD) bestD = d; }
      }
      ao[sy * LW + sx] = 0.45 + 0.55 * Math.min(1, Math.max(0, (bestD - 0.5) / rad));
    }
    // sfocatura leggera
    const tmp = new Float32Array(acc.length);
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const nx = x + i, ny = y + j;
        if (nx < 0 || ny < 0 || nx >= LW || ny >= LH) continue;
        const o = (ny * LW + nx) * 3; r += acc[o]; g += acc[o + 1]; b += acc[o + 2]; n++;
      }
      const o = (y * LW + x) * 3; tmp[o] = r / n; tmp[o + 1] = g / n; tmp[o + 2] = b / n;
    }
    lmData = new Uint8Array(LW * LH * 4);
    for (let i = 0; i < LW * LH; i++) {
      lmData[i * 4] = Math.min(255, tmp[i * 3] * 127.5); lmData[i * 4 + 1] = Math.min(255, tmp[i * 3 + 1] * 127.5);
      lmData[i * 4 + 2] = Math.min(255, tmp[i * 3 + 2] * 127.5); lmData[i * 4 + 3] = ao[i] * 255;
    }
    const gl = GLX.gl;
    if (lmTex) gl.deleteTexture(lmTex.tex);
    lmTex = GLX.texture(LW, LH, lmData, { srgb: false, mip: false, clamp: true });
    const rd = new Uint8Array(LW * LH * 4);
    for (let i = 0; i < LW * LH; i++) {
      let id = bid[i];
      if (best[i] <= 0) { const r = roomOf(Math.floor((i % LW) / SUB), Math.floor(Math.floor(i / LW) / SUB)); id = r ? r.id : 0; }
      rd[i * 4] = id; rd[i * 4 + 3] = 255;
    }
    if (rmTex) gl.deleteTexture(rmTex.tex);
    rmTex = GLX.texture(LW, LH, rd, { srgb: false, mip: false, clamp: true });
    gl.bindTexture(gl.TEXTURE_2D, rmTex.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  /* ---------------- geometria ---------------- */
  function isOpen(x, y) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return false;
    const v = map[y * MW + x];
    return v === 0 || v === 5 || v >= 6;
  }
  function isSolid(x, y) { return !isOpen(x, y); }

  function build(L) {
    Lv = L; MW = L.W; MH = L.H; map = L.map; doorAt = L.doorAt;
    const gl = GLX.gl;
    chunks.forEach(function (c) { c.parts.forEach(function (p) { gl.deleteVertexArray(p.mesh.vao); }); });
    chunks = []; doorNodes = []; lamps = [];
    const rnd = mulberry32(L.cfg.seed * 7 + 3);
    // lampade con colore in base alla stanza
    L.lamps.forEach(function (lp) { lamps.push({ x: lp.x, y: lp.y, i: lp.i, tint: tintFor(roomOf(Math.floor(lp.x), Math.floor(lp.y))), rid: lp.rid || 0 }); });
    buildLightmap();

    const NCX = Math.ceil(MW / CH), NCY = Math.ceil(MH / CH);
    const groups = [];
    for (let i = 0; i < NCX * NCY; i++) groups.push({});
    const G = function (cx, cy, key) {
      const g = groups[cy * NCX + cx];
      return g[key] || (g[key] = Prim.G());
    };
    const matKeyWall = { 1: 'wallpaper', 2: 'plaster', 3: 'tileWall', 4: 'woodWall' };
    const wallQuad = function (g, p, u0, u1, n) {
      const b = g.p.length / 3;
      for (let k = 0; k < 4; k++) { g.p.push(p[k][0], p[k][1], p[k][2]); g.n.push(n[0], n[1], n[2]); }
      g.u.push(u0, 0, u1, 0, u1, WALLH, u0, WALLH);
      g.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    const flat = function (g, X, Z, y, up) {
      const b = g.p.length / 3, n = up ? [0, 1, 0] : [0, -1, 0];
      const ps = up ? [[X, y, Z + 1], [X + 1, y, Z + 1], [X + 1, y, Z], [X, y, Z]] : [[X, y, Z], [X + 1, y, Z], [X + 1, y, Z + 1], [X, y, Z + 1]];
      for (let k = 0; k < 4; k++) { g.p.push(ps[k][0], ps[k][1], ps[k][2]); g.n.push(n[0], n[1], n[2]); g.u.push(ps[k][0], ps[k][2]); }
      g.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    const tmpM = M4.create();
    const put = function (g, geo, x, y, z, rx, ry, rz) {
      const m = M4.fromTRS(tmpM, x, y, z, rx || 0, ry || 0, rz || 0, 1, 1, 1);
      const merged = Prim.merge([{ g: geo, m: m }]);
      const b = g.p.length / 3;
      for (let i = 0; i < merged.p.length; i++) g.p.push(merged.p[i]);
      for (let i = 0; i < merged.n.length; i++) g.n.push(merged.n[i]);
      for (let i = 0; i < merged.u.length; i++) g.u.push(merged.u[i]);
      for (let i = 0; i < merged.i.length; i++) g.i.push(merged.i[i] + b);
    };

    for (let Z = 0; Z < MH; Z++) for (let X = 0; X < MW; X++) {
      const v = map[Z * MW + X];
      const cx = Math.floor(X / CH), cy = Math.floor(Z / CH);
      if (v === 0 || v === 5 || v >= 6) {
        const i = Z * MW + X;
        flat(G(cx, cy, L.floorTex[i] ? 'floorB' : 'floorA'), X, Z, 0, true);
        flat(G(cx, cy, 'ceil'), X, Z, WALLH, false);
        continue;
      }
      const key = matKeyWall[L.wallStyle ? L.wallStyle[Z * MW + X] || v : v] || 'wallpaper';
      const g = G(cx, cy, key);
      if (isOpen(X + 1, Z)) wallQuad(g, [[X + 1, 0, Z + 1], [X + 1, 0, Z], [X + 1, WALLH, Z], [X + 1, WALLH, Z + 1]], Z + 1, Z, [1, 0, 0]);
      if (isOpen(X - 1, Z)) wallQuad(g, [[X, 0, Z], [X, 0, Z + 1], [X, WALLH, Z + 1], [X, WALLH, Z]], Z, Z + 1, [-1, 0, 0]);
      if (isOpen(X, Z + 1)) wallQuad(g, [[X, 0, Z + 1], [X + 1, 0, Z + 1], [X + 1, WALLH, Z + 1], [X, WALLH, Z + 1]], X, X + 1, [0, 0, 1]);
      if (isOpen(X, Z - 1)) wallQuad(g, [[X + 1, 0, Z], [X, 0, Z], [X, WALLH, Z], [X + 1, WALLH, Z]], X + 1, X, [0, 0, -1]);
    }
    // plafoniere dalle lampade
    lamps.forEach(function (lp) {
      const cx = Math.floor(lp.x / CH), cy = Math.floor(lp.y / CH);
      put(G(cx, cy, 'dark'), Prim.cyl(0.2, 0.2, 0.05, 12, true, 1), lp.x, WALLH - 0.025, lp.y);
      put(G(cx, cy, 'lamp'), Prim.cyl(0.15, 0.13, 0.04, 12, true, 1), lp.x, WALLH - 0.06, lp.y);
    });
    // finestre
    (L.decor || []).forEach(function (d) {
      if (d.t !== 'window') return;
      const cx = Math.floor(d.x / CH), cy = Math.floor(d.z / CH);
      const gl2 = G(cx, cy, 'window'), gd = G(cx, cy, 'dark');
      const nx = Math.sin(d.ry) , nz = Math.cos(d.ry);
      const px = d.x + nx * 0.02, pz = d.z + nz * 0.02;
      put(gl2, Prim.box(0.8, 0.8, 0.02, 1), px, 0.85, pz, 0, d.ry, 0);
      const fx = function (w, h, ox, oy) { put(gd, Prim.box(w, h, 0.05, 1), d.x + nx * 0.05 + Math.cos(d.ry) * ox, oy, d.z + nz * 0.05 - Math.sin(d.ry) * ox, 0, d.ry, 0); };
      fx(0.9, 0.05, 0, 1.27); fx(0.9, 0.05, 0, 0.43); fx(0.05, 0.9, -0.42, 0.85); fx(0.05, 0.9, 0.42, 0.85); fx(0.04, 0.84, 0, 0.85); fx(0.84, 0.04, 0, 0.85);
    });
    (L.decor || []).forEach(function (d) {
      if (d.t !== 'frame') return;
      const cx = Math.floor(d.x / CH), cy = Math.floor(d.z / CH);
      const nx = Math.sin(d.ry), nz = Math.cos(d.ry), gd = G(cx, cy, 'dark');
      put(G(cx, cy, 'painting'), Prim.box(0.5, 0.7, 0.02, 0.5), d.x + nx * 0.03, 0.8, d.z + nz * 0.03, 0, d.ry, 0);
      put(gd, Prim.box(0.62, 0.82, 0.03, 1), d.x + nx * 0.018, 0.8, d.z + nz * 0.018, 0, d.ry, 0);
    });
    // porte: cornici statiche + nodi battenti
    Lv.doorList = [];
    for (let Z = 0; Z < MH; Z++) for (let X = 0; X < MW; X++) {
      const v = map[Z * MW + X];
      if (v < 6) continue;
      const d = doorAt[Z * MW + X];
      const cx = Math.floor(X / CH), cy = Math.floor(Z / CH);
      const wx = isSolid(X - 1, Z) && isSolid(X + 1, Z);
      const gd = G(cx, cy, 'dark');
      const px = X + 0.5, pz = Z + 0.5;
      if (wx) {
        put(gd, Prim.box(1.0, 0.07, 0.22), px, WALLH - 0.035, pz);
        put(gd, Prim.box(0.06, WALLH, 0.22), px - 0.5 + 0.03, WALLH / 2, pz);
        put(gd, Prim.box(0.06, WALLH, 0.22), px + 0.5 - 0.03, WALLH / 2, pz);
      } else {
        put(gd, Prim.box(0.22, 0.07, 1.0), px, WALLH - 0.035, pz);
        put(gd, Prim.box(0.22, WALLH, 0.06), px, WALLH / 2, pz - 0.5 + 0.03);
        put(gd, Prim.box(0.22, WALLH, 0.06), px, WALLH / 2, pz + 0.5 - 0.03);
      }
      const hinge = new Node();
      const leaf = new Node(GLX.mesh(Prim.box(wx ? 0.9 : 0.07, 1.4, wx ? 0.07 : 0.9, 0.9)), v === 7 ? Mats.M.doorIron : Mats.M.door);
      leaf.pos = wx ? [0.45, 0.7, 0] : [0, 0.7, 0.45];
      leaf.cast = true;
      hinge.add(leaf);
      hinge.door = d; hinge.wx = wx; hinge.base = wx ? [X + 0.06, 0, Z + 0.5] : [X + 0.5, 0, Z + 0.06];
      hinge.dir = d.dir || 1;
      hinge.cast = true;
      doorNodes.push(hinge);
      Lv.doorList.push({ d: d, node: hinge });
    }

    // costruisci mesh per chunk
    const keyToMat = function (k) { return Mats.M[k]; };
    for (let cy = 0; cy < NCY; cy++) for (let cx = 0; cx < NCX; cx++) {
      const grp = groups[cy * NCX + cx], parts = [];
      let mn = [1e9, 0, 1e9], mx = [-1e9, WALLH, -1e9];
      for (const key in grp) {
        const g = grp[key];
        if (!g.i.length) continue;
        const mesh = GLX.mesh(g);
        const ck = key;
        const cast = !(key === 'floorA' || key === 'floorB' || key === 'ceil' || key === 'lamp' || key === 'window');
        parts.push({ mesh: mesh, mat: keyToMat(ck), cast: cast });
        mn[0] = Math.min(mn[0], mesh.min[0]); mn[2] = Math.min(mn[2], mesh.min[2]);
        mx[0] = Math.max(mx[0], mesh.max[0]); mx[2] = Math.max(mx[2], mesh.max[2]);
      }
      if (parts.length) chunks.push({ parts: parts, min: mn, max: mx, cx: (mn[0] + mx[0]) / 2, cz: (mn[2] + mx[2]) / 2 });
    }
  }

  function update() {
    doorNodes.forEach(function (n) {
      const o = n.door.open;
      n.pos[0] = n.base[0]; n.pos[1] = 0; n.pos[2] = n.base[2];
      if (n.wx) n.rot[1] = -o * 1.7 * n.dir; else n.rot[1] = o * 1.7 * n.dir;
      n.update(null);
    });
  }

  return {
    WALLH: WALLH, build: build, update: update, isWallRaw: isWallRaw, solidAt: solidAt, castDist: castDist, castHit: castHit, los: los,
    lightAt: lightAt, lightRGB: lightRGB,
    get chunks() { return chunks; }, get doorNodes() { return doorNodes; }, get lightmap() { return lmTex; }, get roomMap() { return rmTex; }, get lamps() { return lamps; },
    get W() { return MW; }, get H() { return MH; }
  };
})();
