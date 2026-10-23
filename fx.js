'use strict';
/* SHADOWLINE - effetti: particelle, decalcomanie, traccianti, esplosioni */
const FX = (function () {
  const parts = [];            // particelle dinamiche
  const decals = [];           // fori di proiettile e pozze
  const tracers = [];
  const flares = [];           // aloni additivi a vita breve (non nelle luci)
  const MAXP = 700;
  const TILE = { smoke: 0, flash: 1, spark: 2, blood: 3, hole: 4, pool: 5, fire: 6, glow: 7, chip: 8, streak: 9 };

  function tileUV(t) { return [(t % 4) * 0.25, Math.floor(t / 4) * 0.25]; }

  function add(p) {
    if (parts.length >= MAXP) parts.shift();
    parts.push(p);
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function smoke(x, y, z, n, size, life, col) {
    for (let i = 0; i < n; i++) add({ x: x + rnd(-0.03, 0.03), y: y, z: z + rnd(-0.03, 0.03), vx: rnd(-0.08, 0.08), vy: rnd(0.05, 0.25), vz: rnd(-0.08, 0.08), life: life * rnd(0.7, 1.2), t: 0, s0: size * 0.5, s1: size * rnd(1.2, 2.2), tile: TILE.smoke, c: col || [0.6, 0.6, 0.6], a: 0.32, add: false, grav: -0.02, drag: 0.8, rot: rnd(0, 6.28), vr: rnd(-1, 1) });
  }
  function sparks(x, y, z, nx, ny, nz, n) {
    for (let i = 0; i < n; i++) {
      const sp = rnd(0.8, 3.2);
      add({ x: x, y: y, z: z, vx: nx * sp + rnd(-1.2, 1.2), vy: ny * sp + rnd(-0.2, 1.6), vz: nz * sp + rnd(-1.2, 1.2), life: rnd(0.15, 0.45), t: 0, s0: 0.022, s1: 0.008, tile: TILE.spark, c: [4, 2.6, 1.1], a: 1, add: true, grav: 7, drag: 0.4, rot: 0, vr: 0 });
    }
  }
  function chips(x, y, z, nx, ny, nz, n, col) {
    for (let i = 0; i < n; i++) {
      const sp = rnd(0.5, 2.2);
      add({ x: x, y: y, z: z, vx: nx * sp + rnd(-0.8, 0.8), vy: ny * sp + rnd(0.2, 1.4), vz: nz * sp + rnd(-0.8, 0.8), life: rnd(0.4, 0.9), t: 0, s0: 0.02, s1: 0.016, tile: TILE.chip, c: col || [0.5, 0.48, 0.45], a: 1, add: false, grav: 7, drag: 0.1, rot: rnd(0, 6), vr: rnd(-8, 8), lit: true });
    }
  }
  function blood(x, y, z, dx, dz, n, big) {
    for (let i = 0; i < n; i++) {
      add({ x: x, y: y, z: z, vx: dx * rnd(0.5, 2.2) + rnd(-0.7, 0.7), vy: rnd(-0.1, 1.5), vz: dz * rnd(0.5, 2.2) + rnd(-0.7, 0.7), life: rnd(0.25, 0.6), t: 0, s0: rnd(0.03, 0.07) * (big ? 1.5 : 1), s1: 0.05 * (big ? 1.6 : 1), tile: TILE.blood, c: [0.42, 0.02, 0.02], a: 0.9, add: false, grav: 5, drag: 0.5, rot: rnd(0, 6), vr: rnd(-2, 2), lit: true });
    }
  }
  function muzzle(x, y, z, vm, size) {
    // lampo di bocca (stella) + fumo
    add({ x: x, y: y, z: z, vx: 0, vy: 0, vz: 0, life: 0.05, t: 0, s0: size, s1: size * 1.25, tile: TILE.flash, c: [5, 3.6, 1.8], a: 1, add: true, grav: 0, drag: 0, rot: rnd(0, 6.28), vr: 0, vm: vm });
    add({ x: x, y: y, z: z, vx: 0, vy: 0, vz: 0, life: 0.06, t: 0, s0: size * 1.7, s1: size * 1.7, tile: TILE.glow, c: [2.5, 1.5, 0.6], a: 0.8, add: true, grav: 0, drag: 0, rot: 0, vr: 0, vm: vm });
  }
  function explosion(x, y, z) {
    for (let i = 0; i < 16; i++) add({ x: x + rnd(-0.18, 0.18), y: y + rnd(0, 0.3), z: z + rnd(-0.18, 0.18), vx: rnd(-1.2, 1.2), vy: rnd(0.2, 2.2), vz: rnd(-1.2, 1.2), life: rnd(0.5, 0.95), t: 0, s0: 0.35, s1: rnd(0.9, 1.6), tile: TILE.fire, c: [3.2, 1.5, 0.4], a: 1, add: true, grav: -0.6, drag: 1.6, rot: rnd(0, 6), vr: rnd(-2, 2) });
    for (let i = 0; i < 14; i++) add({ x: x + rnd(-0.2, 0.2), y: y + rnd(0.1, 0.5), z: z + rnd(-0.2, 0.2), vx: rnd(-0.8, 0.8), vy: rnd(0.4, 1.4), vz: rnd(-0.8, 0.8), life: rnd(1.5, 3.2), t: 0, s0: 0.5, s1: rnd(1.4, 2.4), tile: TILE.smoke, c: [0.15, 0.14, 0.13], a: 0.6, add: false, grav: -0.1, drag: 0.7, rot: rnd(0, 6), vr: rnd(-0.6, 0.6) });
    sparks(x, y + 0.2, z, 0, 1, 0, 26);
    chips(x, y + 0.2, z, 0, 1, 0, 14, [0.12, 0.1, 0.08]);
  }
  function decal(x, y, z, nx, ny, nz, size, tile, col, life) {
    if (decals.length > 110) decals.shift();
    decals.push({ x: x + nx * 0.004, y: y + ny * 0.004, z: z + nz * 0.004, nx: nx, ny: ny, nz: nz, s: size, tile: tile, c: col, t: 0, life: life || 9999 });
  }
  function bulletHole(x, y, z, nx, ny, nz) { decal(x, y, z, nx, ny, nz, 0.07 + Math.random() * 0.03, TILE.hole, [1, 1, 1], 9999); }
  function bloodPool(x, z) { decal(x, 0.003, z, 0, 1, 0, 0.5 + Math.random() * 0.2, TILE.pool, [1, 1, 1], 9999); }
  function bloodSplat(x, y, z, nx, ny, nz) { decal(x, y, z, nx, ny, nz, 0.14 + Math.random() * 0.1, TILE.pool, [1, 1, 1], 9999); }
  function tracer(x0, y0, z0, x1, y1, z1, col, life) { tracers.push({ x0: x0, y0: y0, z0: z0, x1: x1, y1: y1, z1: z1, t: 0, life: life || 0.07, c: col || [4, 3, 1.4] }); }
  function clear() { parts.length = 0; decals.length = 0; tracers.length = 0; }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vz *= k; p.vy = p.vy * k - p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.vr * dt;
      if (p.y < 0.01 && p.grav > 0) { p.y = 0.01; p.vy *= -0.3; p.vx *= 0.5; p.vz *= 0.5; p.vr *= 0.5; }
      if (World.solidAt(p.x, p.z) && p.grav > 0) { p.vx *= -0.3; p.vz *= -0.3; p.x += p.vx * dt * 2; p.z += p.vz * dt * 2; }
    }
    for (let i = tracers.length - 1; i >= 0; i--) { tracers[i].t += dt; if (tracers[i].t >= tracers[i].life) tracers.splice(i, 1); }
  }

  const lc = [0, 0, 0];
  function emit(cam, time) {
    const B = Renderer.Batches;
    const rx = cam.rx, ry = cam.ry, rz = cam.rz, ux = cam.ux, uy = cam.uy, uz = cam.uz;
    // decalcomanie (nella batch alpha, prima delle particelle)
    for (let i = 0; i < decals.length; i++) {
      const d = decals[i];
      let tx, ty, tz;
      if (Math.abs(d.ny) > 0.9) { tx = 1; ty = 0; tz = 0; } else { const l = Math.hypot(d.nx, d.nz) || 1; tx = -d.nz / l; ty = 0; tz = d.nx / l; }
      const bx = d.ny * tz - d.nz * ty, by = d.nz * tx - d.nx * tz, bz = d.nx * ty - d.ny * tx;
      const s = d.s, uv = tileUV(d.tile), L = World.lightRGB(d.x, d.z, lc);
      const r = d.c[0] * (L[0] * 0.9 + 0.05), g = d.c[1] * (L[1] * 0.9 + 0.05), b = d.c[2] * (L[2] * 0.9 + 0.05);
      const a = d.tile === TILE.pool ? 0.95 : 0.95;
      B.alpha.v(d.x - tx * s - bx * s, d.y - ty * s - by * s, d.z - tz * s - bz * s, uv[0], uv[1] + 0.25, r, g, b, a);
      B.alpha.v(d.x + tx * s - bx * s, d.y + ty * s - by * s, d.z + tz * s - bz * s, uv[0] + 0.25, uv[1] + 0.25, r, g, b, a);
      B.alpha.v(d.x + tx * s + bx * s, d.y + ty * s + by * s, d.z + tz * s + bz * s, uv[0] + 0.25, uv[1], r, g, b, a);
      B.alpha.v(d.x - tx * s + bx * s, d.y - ty * s + by * s, d.z - tz * s + bz * s, uv[0], uv[1], r, g, b, a);
    }
    // particelle billboard
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const k = p.t / p.life;
      const s = (p.s0 + (p.s1 - p.s0) * k) * 0.5;
      const cs = Math.cos(p.rot) * s, sn = Math.sin(p.rot) * s;
      const ax = rx * cs + ux * sn, ay = ry * cs + uy * sn, az = rz * cs + uz * sn;
      const bx = -rx * sn + ux * cs, by = -ry * sn + uy * cs, bz = -rz * sn + uz * cs;
      let a = p.a * (1 - k * k);
      if (p.tile === TILE.flash || p.tile === TILE.glow) a = p.a * (1 - k);
      let r = p.c[0], g = p.c[1], b = p.c[2];
      if (!p.add) { const L = World.lightRGB(p.x, p.z, lc); r *= L[0] * 0.8 + 0.05; g *= L[1] * 0.8 + 0.05; b *= L[2] * 0.8 + 0.05; }
      const uv = tileUV(p.tile);
      const batch = p.vm ? B.vmAdd : (p.add ? B.add : B.alpha);
      batch.v(p.x - ax - bx, p.y - ay - by, p.z - az - bz, uv[0], uv[1] + 0.25, r, g, b, a);
      batch.v(p.x + ax - bx, p.y + ay - by, p.z + az - bz, uv[0] + 0.25, uv[1] + 0.25, r, g, b, a);
      batch.v(p.x + ax + bx, p.y + ay + by, p.z + az + bz, uv[0] + 0.25, uv[1], r, g, b, a);
      batch.v(p.x - ax + bx, p.y - ay + by, p.z - az + bz, uv[0], uv[1], r, g, b, a);
    }
    // traccianti (nastri orientati)
    for (let i = 0; i < tracers.length; i++) {
      const t = tracers[i];
      const dx = t.x1 - t.x0, dy = t.y1 - t.y0, dz = t.z1 - t.z0, len = Math.hypot(dx, dy, dz) || 1;
      const mx = (t.x0 + t.x1) / 2 - cam.x, my = (t.y0 + t.y1) / 2 - cam.y, mz = (t.z0 + t.z1) / 2 - cam.z;
      let sx = (dy / len) * mz - (dz / len) * my, sy = (dz / len) * mx - (dx / len) * mz, sz = (dx / len) * my - (dy / len) * mx;
      const sl = Math.hypot(sx, sy, sz) || 1; const w = 0.006;
      sx = sx / sl * w; sy = sy / sl * w; sz = sz / sl * w;
      const a = 1 - t.t / t.life, uv = tileUV(TILE.streak);
      B.add.v(t.x0 - sx, t.y0 - sy, t.z0 - sz, uv[0], uv[1] + 0.25, t.c[0], t.c[1], t.c[2], a);
      B.add.v(t.x1 - sx, t.y1 - sy, t.z1 - sz, uv[0] + 0.25, uv[1] + 0.25, t.c[0], t.c[1], t.c[2], a);
      B.add.v(t.x1 + sx, t.y1 + sy, t.z1 + sz, uv[0] + 0.25, uv[1], t.c[0], t.c[1], t.c[2], a);
      B.add.v(t.x0 + sx, t.y0 + sy, t.z0 + sz, uv[0], uv[1], t.c[0], t.c[1], t.c[2], a);
    }
    void time;
  }

  // alone verticale + anelli a terra per il punto di estrazione e gli oggetti luminosi
  function beam(cam, x, z, h, w, col, a) {
    const B = Renderer.Batches.add, uv = tileUV(TILE.glow);
    // piano verticale che guarda la camera (solo asse Y)
    let rx = cam.rx, rz = cam.rz; const l = Math.hypot(rx, rz) || 1; rx = rx / l * w; rz = rz / l * w;
    for (let k = 0; k < 2; k++) {
      const s = k ? 0.6 : 1;
      B.v(x - rx * s, 0, z - rz * s, uv[0], uv[1] + 0.25, col[0], col[1], col[2], a);
      B.v(x + rx * s, 0, z + rz * s, uv[0] + 0.25, uv[1] + 0.25, col[0], col[1], col[2], a);
      B.v(x + rx * s, h, z + rz * s, uv[0] + 0.25, uv[1], col[0], col[1], col[2], 0);
      B.v(x - rx * s, h, z - rz * s, uv[0], uv[1], col[0], col[1], col[2], 0);
    }
  }
  function floorGlow(x, z, r, col, a) {
    const B = Renderer.Batches.add, uv = tileUV(TILE.glow);
    B.v(x - r, 0.012, z + r, uv[0], uv[1] + 0.25, col[0], col[1], col[2], a);
    B.v(x + r, 0.012, z + r, uv[0] + 0.25, uv[1] + 0.25, col[0], col[1], col[2], a);
    B.v(x + r, 0.012, z - r, uv[0] + 0.25, uv[1], col[0], col[1], col[2], a);
    B.v(x - r, 0.012, z - r, uv[0], uv[1], col[0], col[1], col[2], a);
  }
  function glowSprite(cam, x, y, z, s, col, a) {
    const B = Renderer.Batches.add, uv = tileUV(TILE.glow), h = s * 0.5;
    const ax = cam.rx * h, ay = cam.ry * h, az = cam.rz * h, bx = cam.ux * h, by = cam.uy * h, bz = cam.uz * h;
    B.v(x - ax - bx, y - ay - by, z - az - bz, uv[0], uv[1] + 0.25, col[0], col[1], col[2], a);
    B.v(x + ax - bx, y + ay - by, z + az - bz, uv[0] + 0.25, uv[1] + 0.25, col[0], col[1], col[2], a);
    B.v(x + ax + bx, y + ay + by, z + az + bz, uv[0] + 0.25, uv[1], col[0], col[1], col[2], a);
    B.v(x - ax + bx, y - ay + by, z - az + bz, uv[0], uv[1], col[0], col[1], col[2], a);
  }


  // pulviscolo illuminato dal fascio della torcia + alone volumetrico morbido
  function torchAtmos(cam, time, k) {
    const B = Renderer.Batches.add, uv = tileUV(TILE.glow);
    const fx = cam.fx, fy = cam.fy, fz = cam.fz;
    const ox = cam.x + cam.rx * 0.18 - cam.ux * 0.12, oy = cam.y + cam.ry * 0.18 - cam.uy * 0.12, oz = cam.z + cam.rz * 0.18 - cam.uz * 0.12;
    const quad = function (x, y, z, s, r, g, b, a) {
      const h = s * 0.5, ax = cam.rx * h, ay = cam.ry * h, az = cam.rz * h, bx = cam.ux * h, by = cam.uy * h, bz = cam.uz * h;
      B.v(x - ax - bx, y - ay - by, z - az - bz, uv[0], uv[1] + 0.25, r, g, b, a);
      B.v(x + ax - bx, y + ay - by, z + az - bz, uv[0] + 0.25, uv[1] + 0.25, r, g, b, a);
      B.v(x + ax + bx, y + ay + by, z + az + bz, uv[0] + 0.25, uv[1], r, g, b, a);
      B.v(x - ax + bx, y - ay + by, z - az + bz, uv[0], uv[1], r, g, b, a);
    };
    // distanza dal muro davanti: il fascio non attraversa le pareti
    const wd = World.castDist(cam.x, cam.z, fx, fz, 11) / Math.max(0.2, Math.hypot(fx, fz));
    const maxD = Math.min(9, wd);
    for (let i = 1; i <= 9; i++) {
      const d = i * 0.9; if (d > maxD) break;
      const a = 0.028 * k * (1 - d / 10) * Math.min(1, d / 2.5);
      quad(ox + fx * d, oy + fy * d, oz + fz * d, 0.4 + d * 0.5, 1.0, 0.92, 0.75, a);
    }
    for (let i = 0; i < 70; i++) {
      const h1 = ph(i, 1), h2 = ph(i, 2), h3 = ph(i, 3), h4 = ph(i, 4);
      const d = 0.7 + h1 * Math.min(8.5, maxD - 0.2); if (d < 0.7) continue;
      const rr = d * 0.42 * Math.sqrt(h2), an = h3 * 6.283 + time * (0.05 + h4 * 0.1);
      const dx = Math.cos(an) * rr, dy = Math.sin(an) * rr;
      const x = ox + fx * d + cam.rx * dx + cam.ux * dy + Math.sin(time * 0.4 + i) * 0.06;
      const y = oy + fy * d + cam.ry * dx + cam.uy * dy + Math.sin(time * 0.3 + i * 2) * 0.04 + Math.sin(time * 0.15 + i) * 0.05;
      const z = oz + fz * d + cam.rz * dx + cam.uz * dy + Math.cos(time * 0.35 + i) * 0.06;
      const tw = 0.5 + 0.5 * Math.sin(time * (1.2 + h4 * 2) + i * 7);
      quad(x, y, z, 0.008 + h2 * 0.012, 1.4, 1.3, 1.1, (0.5 * tw + 0.12) * k * (1 - d / 10) * Math.min(1, (d - 0.7) / 1.5));
    }
  }
  function ph(i, s) { let h = Math.imul(i * 374761393 + s * 668265263, 1274126177); h ^= h >>> 15; return ((h >>> 0) % 100000) / 100000; }

  return {
    torchAtmos: torchAtmos, TILE: TILE, update: update, emit: emit, clear: clear, smoke: smoke, sparks: sparks, chips: chips, blood: blood, muzzle: muzzle, explosion: explosion,
    bulletHole: bulletHole, bloodPool: bloodPool, bloodSplat: bloodSplat, tracer: tracer, beam: beam, floorGlow: floorGlow, glowSprite: glowSprite
  };
})();
