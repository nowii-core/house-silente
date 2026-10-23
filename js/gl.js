'use strict';
/* SHADOWLINE - mini motore WebGL2 (nessuna libreria): matematica, shader, mesh, texture, primitive */

const M4 = (function () {
  function create() { const o = new Float32Array(16); o[0] = o[5] = o[10] = o[15] = 1; return o; }
  function identity(o) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; }
  function copy(o, a) { for (let i = 0; i < 16; i++) o[i] = a[i]; return o; }
  function mul(out, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30; out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32; out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30; out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32; out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30; out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32; out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30; out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32; out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    return out;
  }
  function perspective(o, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    o.fill(0);
    o[0] = f / aspect; o[5] = f; o[10] = (far + near) / (near - far); o[11] = -1; o[14] = 2 * far * near / (near - far);
    return o;
  }
  // M = T * Ry * Rx * Rz * S
  function fromTRS(o, px, py, pz, rx, ry, rz, sx, sy, sz) {
    const cx = Math.cos(rx), sxn = Math.sin(rx), cy = Math.cos(ry), syn = Math.sin(ry), cz = Math.cos(rz), szn = Math.sin(rz);
    const r00 = cy * cz + syn * sxn * szn, r01 = -cy * szn + syn * sxn * cz, r02 = syn * cx;
    const r10 = cx * szn, r11 = cx * cz, r12 = -sxn;
    const r20 = -syn * cz + cy * sxn * szn, r21 = syn * szn + cy * sxn * cz, r22 = cy * cx;
    o[0] = r00 * sx; o[1] = r10 * sx; o[2] = r20 * sx; o[3] = 0;
    o[4] = r01 * sy; o[5] = r11 * sy; o[6] = r21 * sy; o[7] = 0;
    o[8] = r02 * sz; o[9] = r12 * sz; o[10] = r22 * sz; o[11] = 0;
    o[12] = px; o[13] = py; o[14] = pz; o[15] = 1;
    return o;
  }
  function invert(out, a) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
      b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
      b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  }
  // inversa trasposta della parte 3x3 (matrice normali)
  function normal3(out, m) {
    const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
    const c00 = e * i - h * f, c01 = -(b * i - h * c), c02 = b * f - e * c;
    const c10 = -(d * i - g * f), c11 = a * i - g * c, c12 = -(a * f - d * c);
    const c20 = d * h - g * e, c21 = -(a * h - g * b), c22 = a * e - d * b;
    let det = a * c00 + d * c01 + g * c02;
    det = det ? 1 / det : 1;
    out[0] = c00 * det; out[1] = c10 * det; out[2] = c20 * det;
    out[3] = c01 * det; out[4] = c11 * det; out[5] = c21 * det;
    out[6] = c02 * det; out[7] = c12 * det; out[8] = c22 * det;
    return out;
  }
  // vista da posizione, yaw e pitch (stessa convenzione della logica di gioco: avanti = (cos a, 0, sin a))
  function view(o, x, y, z, yaw, pitch) {
    const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
    // asse avanti f, destra r, su u
    const fx = cp * cy, fy = sp, fz = cp * sy;
    let rx = -sy, ry = 0, rz = cy;                     // destra = f x up(0,1,0) normalizzato
    const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
    // r = f x worldUp : (fx,fy,fz)x(0,1,0) = (-fz, 0, fx) -> normalizza
    const rl = Math.hypot(fz, fx) || 1; rx = -fz / rl; ry = 0; rz = fx / rl;
    const u2x = ry * fz - rz * fy, u2y = rz * fx - rx * fz, u2z = rx * fy - ry * fx;
    void ux; void uy; void uz;
    o[0] = rx; o[1] = u2x; o[2] = -fx; o[3] = 0;
    o[4] = ry; o[5] = u2y; o[6] = -fy; o[7] = 0;
    o[8] = rz; o[9] = u2z; o[10] = -fz; o[11] = 0;
    o[12] = -(rx * x + ry * y + rz * z); o[13] = -(u2x * x + u2y * y + u2z * z); o[14] = (fx * x + fy * y + fz * z); o[15] = 1;
    return o;
  }
  function lookAt(o, ex, ey, ez, tx, ty, tz, ux, uy, uz) {
    let fx = tx - ex, fy = ty - ey, fz = tz - ez;
    let l = Math.hypot(fx, fy, fz) || 1; fx /= l; fy /= l; fz /= l;
    let sx = fy * uz - fz * uy, sy = fz * ux - fx * uz, sz = fx * uy - fy * ux;
    l = Math.hypot(sx, sy, sz) || 1; sx /= l; sy /= l; sz /= l;
    const vx = sy * fz - sz * fy, vy = sz * fx - sx * fz, vz = sx * fy - sy * fx;
    o[0] = sx; o[1] = vx; o[2] = -fx; o[3] = 0;
    o[4] = sy; o[5] = vy; o[6] = -fy; o[7] = 0;
    o[8] = sz; o[9] = vz; o[10] = -fz; o[11] = 0;
    o[12] = -(sx * ex + sy * ey + sz * ez); o[13] = -(vx * ex + vy * ey + vz * ez); o[14] = (fx * ex + fy * ey + fz * ez); o[15] = 1;
    return o;
  }
  return { create: create, identity: identity, copy: copy, mul: mul, perspective: perspective, fromTRS: fromTRS, invert: invert, normal3: normal3, view: view, lookAt: lookAt };
})();

/* ===================== primitive geometriche ===================== */
const Prim = (function () {
  function G() { return { p: [], n: [], u: [], i: [] }; }
  function quad(g, o, u, v, n, uvw, uvh) {
    const b = g.p.length / 3;
    const ps = [[o[0], o[1], o[2]], [o[0] + u[0], o[1] + u[1], o[2] + u[2]], [o[0] + u[0] + v[0], o[1] + u[1] + v[1], o[2] + u[2] + v[2]], [o[0] + v[0], o[1] + v[1], o[2] + v[2]]];
    const uvs = [[0, 0], [uvw, 0], [uvw, uvh], [0, uvh]];
    for (let k = 0; k < 4; k++) { g.p.push(ps[k][0], ps[k][1], ps[k][2]); g.n.push(n[0], n[1], n[2]); g.u.push(uvs[k][0], uvs[k][1]); }
    g.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  function box(w, h, d, uvs) {
    uvs = uvs || 1;
    const g = G(), x = w / 2, y = h / 2, z = d / 2;
    quad(g, [x, -y, z], [0, 0, -d], [0, h, 0], [1, 0, 0], d / uvs, h / uvs);
    quad(g, [-x, -y, -z], [0, 0, d], [0, h, 0], [-1, 0, 0], d / uvs, h / uvs);
    quad(g, [-x, y, z], [w, 0, 0], [0, 0, -d], [0, 1, 0], w / uvs, d / uvs);
    quad(g, [-x, -y, -z], [w, 0, 0], [0, 0, d], [0, -1, 0], w / uvs, d / uvs);
    quad(g, [-x, -y, z], [w, 0, 0], [0, h, 0], [0, 0, 1], w / uvs, h / uvs);
    quad(g, [x, -y, -z], [-w, 0, 0], [0, h, 0], [0, 0, -1], w / uvs, h / uvs);
    return g;
  }
  // solido di rivoluzione attorno a Y; profilo dall'alto al basso: {r,y,nr,ny}
  function lathe(profile, seg, uvs) {
    uvs = uvs || 1;
    const g = G();
    let acc = 0;
    const lens = [0];
    for (let k = 1; k < profile.length; k++) { acc += Math.hypot(profile[k].r - profile[k - 1].r, profile[k].y - profile[k - 1].y); lens.push(acc); }
    for (let k = 0; k < profile.length; k++) {
      const pf = profile[k];
      for (let i = 0; i <= seg; i++) {
        const t = i / seg * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
        g.p.push(pf.r * c, pf.y, pf.r * s); g.n.push(pf.nr * c, pf.ny, pf.nr * s);
        g.u.push(i / seg * Math.max(pf.r, 0.0001) * 6.2832 / uvs, lens[k] / uvs);
      }
    }
    for (let k = 0; k < profile.length - 1; k++) for (let i = 0; i < seg; i++) {
      const a = k * (seg + 1) + i, b = a + 1, c = a + (seg + 1), d = c + 1;
      g.i.push(a, b, c, b, d, c);
    }
    return g;
  }
  function sphere(r, seg, rings) {
    seg = seg || 14; rings = rings || 9;
    const pr = [];
    for (let j = 0; j <= rings; j++) { const ph = Math.PI * j / rings; pr.push({ r: r * Math.sin(ph), y: r * Math.cos(ph), nr: Math.sin(ph), ny: Math.cos(ph) }); }
    return lathe(pr, seg);
  }
  function cyl(rt, rb, h, seg, caps, uvs) {
    seg = seg || 14;
    const y = h / 2, sl = (rb - rt) / h, nl = Math.hypot(1, sl), nr = 1 / nl, ny = sl / nl;
    const pr = [];
    if (caps !== false) pr.push({ r: 0, y: y, nr: 0, ny: 1 }, { r: rt, y: y, nr: 0, ny: 1 });
    pr.push({ r: rt, y: y, nr: nr, ny: ny }, { r: rb, y: -y, nr: nr, ny: ny });
    if (caps !== false) pr.push({ r: rb, y: -y, nr: 0, ny: -1 }, { r: 0, y: -y, nr: 0, ny: -1 });
    return lathe(pr, seg, uvs);
  }
  function capsule(r, h, seg) {
    seg = seg || 10;
    const pr = [], H = 4;
    for (let t = 0; t <= H; t++) { const ph = Math.PI / 2 * t / H; pr.push({ r: r * Math.sin(ph), y: h / 2 + r * Math.cos(ph), nr: Math.sin(ph), ny: Math.cos(ph) }); }
    for (let t = 0; t <= H; t++) { const ph = Math.PI / 2 + Math.PI / 2 * t / H; pr.push({ r: r * Math.sin(ph), y: -h / 2 + r * Math.cos(ph), nr: Math.sin(ph), ny: Math.cos(ph) }); }
    return lathe(pr, seg);
  }
  function plane(w, d, uvs) {
    const g = G();
    quad(g, [-w / 2, 0, d / 2], [w, 0, 0], [0, 0, -d], [0, 1, 0], w / (uvs || 1), d / (uvs || 1));
    return g;
  }
  // unisce piu' geometrie con una matrice ciascuna
  function merge(list) {
    const g = G();
    const nm = new Float32Array(9);
    list.forEach(function (it) {
      const base = g.p.length / 3, m = it.m, s = it.g;
      const hasM = !!m;
      if (hasM) M4.normal3(nm, m);
      for (let k = 0; k < s.p.length; k += 3) {
        const x = s.p[k], y = s.p[k + 1], z = s.p[k + 2];
        const nx = s.n[k], ny = s.n[k + 1], nz = s.n[k + 2];
        if (hasM) {
          g.p.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
          let tx = nm[0] * nx + nm[3] * ny + nm[6] * nz, ty = nm[1] * nx + nm[4] * ny + nm[7] * nz, tz = nm[2] * nx + nm[5] * ny + nm[8] * nz;
          const l = Math.hypot(tx, ty, tz) || 1; g.n.push(tx / l, ty / l, tz / l);
        } else { g.p.push(x, y, z); g.n.push(nx, ny, nz); }
      }
      for (let k = 0; k < s.u.length; k++) g.u.push(s.u[k]);
      for (let k = 0; k < s.i.length; k++) g.i.push(s.i[k] + base);
    });
    return g;
  }
  return { G: G, quad: quad, box: box, lathe: lathe, sphere: sphere, cyl: cyl, capsule: capsule, plane: plane, merge: merge };
})();

/* ===================== contesto GL, shader, mesh, texture ===================== */
const GLX = (function () {
  let gl = null, canvas = null;
  const ext = {};
  let maxAniso = 1;

  function init(c, opts) {
    canvas = c;
    gl = c.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!(opts && opts.preserve) });
    if (!gl) return null;
    ext.cbf = gl.getExtension('EXT_color_buffer_float');
    ext.cbh = gl.getExtension('EXT_color_buffer_half_float');
    ext.lin = gl.getExtension('OES_texture_float_linear');
    ext.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext.aniso) maxAniso = Math.min(8, gl.getParameter(ext.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT));
    return gl;
  }

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      throw new Error('Shader: ' + log + '\n' + src.split('\n').map(function (l, i) { return (i + 1) + ': ' + l; }).join('\n').slice(0, 6000));
    }
    return s;
  }
  function program(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(p, info.name);
    }
    return { p: p, u: u };
  }

  function mesh(g, dynamic) {
    const n = g.p.length / 3;
    const data = new Float32Array(n * 8);
    for (let i = 0; i < n; i++) {
      data[i * 8] = g.p[i * 3]; data[i * 8 + 1] = g.p[i * 3 + 1]; data[i * 8 + 2] = g.p[i * 3 + 2];
      data[i * 8 + 3] = g.n[i * 3]; data[i * 8 + 4] = g.n[i * 3 + 1]; data[i * 8 + 5] = g.n[i * 3 + 2];
      data[i * 8 + 6] = g.u[i * 2]; data[i * 8 + 7] = g.u[i * 2 + 1];
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    const idx = n > 65535 ? new Uint32Array(g.i) : new Uint16Array(g.i);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    // bounding box
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (let i = 0; i < n; i++) {
      const x = g.p[i * 3], y = g.p[i * 3 + 1], z = g.p[i * 3 + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    return { vao: vao, count: g.i.length, type: n > 65535 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, min: [x0, y0, z0], max: [x1, y1, z1] };
  }

  function texture(w, h, data, o) {
    o = o || {};
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, o.srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    const mip = o.mip !== false;
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = o.clamp ? gl.CLAMP_TO_EDGE : gl.REPEAT;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    if (ext.aniso && mip && o.aniso !== false) gl.texParameterf(gl.TEXTURE_2D, ext.aniso.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
    return { tex: t, w: w, h: h };
  }

  function colorTarget(w, h, fmt) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    const hdr = fmt !== 'ldr';
    if (hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { fb: fb, tex: t, w: w, h: h };
  }

  function depthTarget(size) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    return { fb: fb, tex: t, size: size };
  }

  return {
    init: init, program: program, mesh: mesh, texture: texture, colorTarget: colorTarget, depthTarget: depthTarget,
    get gl() { return gl; }, get ext() { return ext; }, get canvas() { return canvas; }
  };
})();

/* ===================== nodi di scena ===================== */
function Node(mesh, mat) {
  this.mesh = mesh || null; this.mat = mat || null;
  this.pos = [0, 0, 0]; this.rot = [0, 0, 0]; this.scl = [1, 1, 1];
  this.children = []; this.visible = true; this.cast = true;
  this.local = M4.create(); this.world = M4.create();
  this.normalM = new Float32Array(9);
}
Node.prototype.add = function (c) { this.children.push(c); return c; };
Node.prototype.update = function (pw) {
  M4.fromTRS(this.local, this.pos[0], this.pos[1], this.pos[2], this.rot[0], this.rot[1], this.rot[2], this.scl[0], this.scl[1], this.scl[2]);
  if (pw) M4.mul(this.world, pw, this.local); else M4.copy(this.world, this.local);
  for (let i = 0; i < this.children.length; i++) this.children[i].update(this.world);
};
