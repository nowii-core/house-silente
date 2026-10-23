'use strict';
/* HORROR - modelli 3D procedurali: arredi, contenitori, oggetti, mostro, torcia e pistola in prima persona.
   Tutto e' scritto in metri (1 unita' di mondo = 2 m): ogni radice viene scalata a 0.5. */
const Models = (function () {
  const M = function () { return Mats.M; };
  const mx = function (x, y, z, rx, ry, rz) { return M4.fromTRS(new Float32Array(16), x || 0, y || 0, z || 0, rx || 0, ry || 0, rz || 0, 1, 1, 1); };
  const cache = {};

  // elenco di parti -> una mesh per materiale
  function Parts() { this.by = {}; }
  Parts.prototype.box = function (mat, w, h, d, x, y, z, rx, ry, rz, uvs) { (this.by[mat] = this.by[mat] || []).push({ g: Prim.box(w, h, d, uvs || 1), m: mx(x, y, z, rx, ry, rz) }); return this; };
  Parts.prototype.cyl = function (mat, r1, r2, h, x, y, z, rx, ry, rz, seg) { (this.by[mat] = this.by[mat] || []).push({ g: Prim.cyl(r1, r2, h, seg || 12, true, 1), m: mx(x, y, z, rx, ry, rz) }); return this; };
  Parts.prototype.sph = function (mat, r, x, y, z, sx, sy, sz) { const m = M4.fromTRS(new Float32Array(16), x, y, z, 0, 0, 0, sx || 1, sy || 1, sz || 1); (this.by[mat] = this.by[mat] || []).push({ g: Prim.sphere(r, 12, 8), m: m }); return this; };
  Parts.prototype.cap = function (mat, r, h, x, y, z, rx, ry, rz) { (this.by[mat] = this.by[mat] || []).push({ g: Prim.capsule(r, h, 8), m: mx(x, y, z, rx, ry, rz) }); return this; };
  Parts.prototype.plane = function (mat, w, d, x, y, z, ry, uvs) { (this.by[mat] = this.by[mat] || []).push({ g: Prim.plane(w, d, uvs || 1), m: mx(x, y, z, 0, ry || 0, 0) }); return this; };
  Parts.prototype.nodes = function (into) {
    for (const k in this.by) { const n = new Node(GLX.mesh(Prim.merge(this.by[k])), M()[k]); n.cast = !(k === 'rug' || k === 'blood'); into.add(n); }
    return into;
  };
  function root(sc) { const r = new Node(); r.scl = [sc === undefined ? 0.5 : sc, sc === undefined ? 0.5 : sc, sc === undefined ? 0.5 : sc]; return r; }

  /* ----------------------------- arredi ----------------------------- */
  const DEFS = {
    desk: function (p) {
      p.box('furn', 0.72, 0.04, 0.5, 0, 0.74, 0.18).box('metal', 0.04, 0.72, 0.04, -0.3, 0.37, 0.4).box('metal', 0.04, 0.72, 0.04, 0.3, 0.37, 0.4)
        .box('metal', 0.04, 0.72, 0.04, -0.3, 0.37, -0.02).box('metal', 0.04, 0.72, 0.04, 0.3, 0.37, -0.02).box('furn', 0.6, 0.03, 0.4, 0, 0.5, 0.18)
        .box('furn', 0.42, 0.04, 0.42, 0, 0.45, -0.5).box('furn', 0.42, 0.42, 0.04, 0, 0.68, -0.7).box('metal', 0.03, 0.45, 0.03, -0.18, 0.22, -0.3).box('metal', 0.03, 0.45, 0.03, 0.18, 0.22, -0.3)
        .box('metal', 0.03, 0.45, 0.03, -0.18, 0.22, -0.7).box('metal', 0.03, 0.45, 0.03, 0.18, 0.22, -0.7);
    },
    teacher: function (p) {
      p.box('furn', 1.5, 0.05, 0.75, 0, 0.76, -0.55).box('furn', 1.4, 0.7, 0.04, 0, 0.38, -0.2).box('furn', 0.05, 0.72, 0.7, -0.7, 0.38, -0.55).box('furn', 0.05, 0.72, 0.7, 0.7, 0.38, -0.55)
        .box('furn', 0.5, 0.04, 0.5, 0, 0.45, 0.35).box('furn', 0.5, 0.5, 0.04, 0, 0.7, 0.58);
    },
    bookshelf: function (p) {
      p.box('furn', 1.7, 2.0, 0.34, 0, 1.0, -0.78).box('books', 1.56, 1.84, 0.06, 0, 1.0, -0.6, 0, 0, 0, 0.6);
      for (let i = 0; i < 5; i++) p.box('furn', 1.6, 0.03, 0.33, 0, 0.1 + i * 0.4, -0.6);
    },
    sofa: function (p) {
      p.box('sofa', 1.8, 0.4, 0.85, 0, 0.3, -0.5).box('sofa', 1.8, 0.55, 0.2, 0, 0.7, -0.88).box('sofa', 0.2, 0.55, 0.85, -0.9, 0.45, -0.5).box('sofa', 0.2, 0.55, 0.85, 0.9, 0.45, -0.5)
        .box('furn', 1.8, 0.1, 0.8, 0, 0.05, -0.5);
    },
    tv: function (p) {
      p.box('furn', 1.3, 0.5, 0.4, 0, 0.25, -0.8).box('black', 1.0, 0.6, 0.1, 0, 0.84, -0.82).box('screenTV', 0.9, 0.5, 0.01, 0, 0.84, -0.76);
    },
    cabinet: function (p) { p.box('furn', 1.3, 0.9, 0.46, 0, 0.45, -0.77).box('furn', 1.34, 0.04, 0.5, 0, 0.92, -0.77); },
    counter: function (p) { p.box('furn', 1.6, 0.86, 0.6, 0, 0.43, -0.7).box('porcelain', 1.64, 0.05, 0.64, 0, 0.88, -0.7); },
    sink: function (p) { p.box('furn', 1.6, 0.86, 0.6, 0, 0.43, -0.7).box('porcelain', 1.64, 0.05, 0.64, 0, 0.88, -0.7).box('metal', 0.5, 0.01, 0.4, 0, 0.89, -0.7).cyl('metal', 0.02, 0.02, 0.3, 0, 1.05, -0.95).box('metal', 0.04, 0.04, 0.2, 0, 1.2, -0.85); },
    fridge: function (p) { p.box('white', 0.85, 1.85, 0.7, 0, 0.925, -0.65); },
    table: function (p) {
      p.box('furn', 1.3, 0.06, 0.85, 0, 0.75, 0).box('furn', 0.07, 0.72, 0.07, -0.58, 0.36, -0.36).box('furn', 0.07, 0.72, 0.07, 0.58, 0.36, -0.36).box('furn', 0.07, 0.72, 0.07, -0.58, 0.36, 0.36).box('furn', 0.07, 0.72, 0.07, 0.58, 0.36, 0.36);
      [-0.85, 0.85].forEach(function (x) { p.box('furn', 0.4, 0.04, 0.4, x, 0.45, 0).box('furn', 0.04, 0.45, 0.4, x * 1.12, 0.68, 0).box('furn', 0.04, 0.45, 0.04, x - 0.15, 0.22, 0.15).box('furn', 0.04, 0.45, 0.04, x + 0.15, 0.22, -0.15); });
    },
    coffee: function (p) { p.box('furn', 0.95, 0.04, 0.55, 0, 0.42, 0).box('furn', 0.05, 0.4, 0.05, -0.4, 0.2, -0.2).box('furn', 0.05, 0.4, 0.05, 0.4, 0.2, -0.2).box('furn', 0.05, 0.4, 0.05, -0.4, 0.2, 0.2).box('furn', 0.05, 0.4, 0.05, 0.4, 0.2, 0.2); },
    bed: function (p) {
      p.box('furn', 1.5, 0.28, 1.95, 0, 0.2, 0).box('sheet', 1.4, 0.2, 1.85, 0, 0.44, 0.02).box('sheet', 0.5, 0.12, 0.32, -0.3, 0.6, -0.72).box('sheet', 0.5, 0.12, 0.32, 0.3, 0.6, -0.72)
        .box('furn', 1.55, 1.0, 0.07, 0, 0.55, -0.99).box('sheet', 1.42, 0.05, 0.9, 0, 0.55, 0.45);
    },
    wardrobe: function (p) {
      p.box('furn', 0.04, 2.2, 0.62, -0.65, 1.1, -0.68).box('furn', 0.04, 2.2, 0.62, 0.65, 1.1, -0.68).box('furn', 1.34, 0.04, 0.62, 0, 2.18, -0.68).box('furn', 1.34, 0.04, 0.62, 0, 0.06, -0.68)
        .box('black', 1.28, 2.12, 0.02, 0, 1.1, -0.97).box('furn', 1.34, 0.03, 0.55, 0, 1.2, -0.68).box('metal', 0.03, 0.03, 0.4, 0, 1.75, -0.7);
    },
    nightstand: function (p) { p.box('furn', 0.5, 0.5, 0.45, 0, 0.25, -0.75).box('furn', 0.54, 0.03, 0.48, 0, 0.51, -0.75).cyl('brass', 0.07, 0.1, 0.22, 0, 0.64, -0.78); },
    dresser: function (p) { p.box('furn', 1.2, 0.85, 0.5, 0, 0.43, -0.74).box('furn', 1.24, 0.04, 0.54, 0, 0.87, -0.74).box('glass', 0.5, 0.7, 0.02, 0, 1.3, -0.98); },
    tub: function (p) { p.box('porcelain', 0.85, 0.55, 1.75, 0, 0.28, -0.1).box('black', 0.65, 0.05, 1.55, 0, 0.55, -0.1).cyl('metal', 0.02, 0.02, 0.3, 0, 0.7, -0.95); },
    toilet: function (p) { p.box('porcelain', 0.4, 0.4, 0.6, 0, 0.2, -0.5).box('porcelain', 0.45, 0.5, 0.2, 0, 0.6, -0.88).cyl('porcelain', 0.2, 0.17, 0.12, 0, 0.44, -0.45); },
    crate: function (p) { p.box('furn', 0.9, 0.7, 0.8, -0.2, 0.35, -0.55).box('furn', 0.6, 0.5, 0.6, 0.45, 0.25, -0.6).box('furn', 0.5, 0.45, 0.5, -0.1, 0.95, -0.6, 0, 0.3, 0); },
    barrel: function (p) { p.cyl('metal', 0.3, 0.3, 0.9, 0, 0.45, -0.6, 0, 0, 0, 14).cyl('dark', 0.31, 0.31, 0.05, 0, 0.25, -0.6).cyl('dark', 0.31, 0.31, 0.05, 0, 0.65, -0.6); },
    bench: function (p) { p.box('metal', 1.7, 0.06, 0.4, 0, 0.45, -0.7).box('metal', 0.06, 0.45, 0.36, -0.75, 0.22, -0.7).box('metal', 0.06, 0.45, 0.36, 0.75, 0.22, -0.7); },
    rug: function (p) { p.plane('rug', 3.0, 3.0, 0, 0.012, 0, 0, 3); },
    blood: function (p) { p.plane('blood', 1.6, 1.6, 0, 0.014, 0, 0.7, 1.6); },
    none: function () { }
  };
  function prop(t) {
    const r = root();
    if (DEFS[t]) { const p = new Parts(); DEFS[t](p); p.nodes(r); }
    r.radius = 1.3; r.cy = 0.6;
    return r;
  }

  /* contenitori apribili: restituisce {root, hinges:[{node,kind,sign}]} */
  function leafDoor(r, mat, w, h, y, hx, z, sign, handleSide) {
    const hinge = new Node(); hinge.pos = [hx, y, z]; r.add(hinge);
    const leaf = new Node(GLX.mesh(Prim.box(w, h, 0.03, 0.6)), M()[mat]); leaf.pos = [-sign * w / 2, 0, 0]; hinge.add(leaf);
    const hd = new Node(GLX.mesh(Prim.box(0.03, 0.12, 0.04, 1)), M().metal); hd.pos = [-sign * (w - 0.07), 0, 0.03]; hinge.add(hd);
    return { node: hinge, kind: 'swing', sign: sign };
  }
  function container(kind) {
    const r = root(), hinges = [];
    if (kind === 'locker') {
      const p = new Parts();
      p.box('locker', 0.02, 1.9, 0.45, -0.25, 0.95, -0.77).box('locker', 0.02, 1.9, 0.45, 0.25, 0.95, -0.77).box('locker', 0.52, 0.02, 0.45, 0, 1.9, -0.77).box('locker', 0.52, 0.02, 0.45, 0, 0.05, -0.77).box('black', 0.5, 1.84, 0.02, 0, 0.97, -0.98).box('locker', 0.52, 0.03, 0.44, 0, 1.3, -0.77);
      p.nodes(r);
      hinges.push(leafDoor(r, 'locker', 0.5, 1.84, 0.97, -0.25, -0.55, -1));
    } else if (kind === 'cabinet') {
      hinges.push(leafDoor(r, 'furn', 0.6, 0.84, 0.46, -0.64, -0.535, -1)); hinges.push(leafDoor(r, 'furn', 0.6, 0.84, 0.46, 0.64, -0.535, 1));
    } else if (kind === 'wardrobe') {
      hinges.push(leafDoor(r, 'furn', 0.65, 2.1, 1.1, -0.64, -0.37, -1)); hinges.push(leafDoor(r, 'furn', 0.65, 2.1, 1.1, 0.64, -0.37, 1));
    } else if (kind === 'fridge') {
      hinges.push(leafDoor(r, 'white', 0.85, 1.8, 0.93, 0.42, -0.3, 1));
    } else { // nightstand / dresser: cassetto che scorre
      const w = kind === 'dresser' ? 1.1 : 0.45, y = kind === 'dresser' ? 0.55 : 0.3, z = kind === 'dresser' ? -0.49 : -0.5;
      const dr = new Node(); dr.pos = [0, y, z]; r.add(dr);
      dr.add(Object.assign(new Node(GLX.mesh(Prim.box(w, kind === 'dresser' ? 0.3 : 0.2, 0.03, 0.6)), M().furn), {}));
      const bx = new Node(GLX.mesh(Prim.box(w - 0.06, 0.15, 0.42, 1)), M().dark); bx.pos = [0, -0.02, -0.22]; dr.add(bx);
      const kn = new Node(GLX.mesh(Prim.cyl(0.02, 0.02, 0.03, 8, true, 1)), M().brass); kn.pos = [0, 0, 0.03]; kn.rot = [Math.PI / 2, 0, 0]; dr.add(kn);
      hinges.push({ node: dr, kind: 'slide', base: z });
    }
    r.radius = 1.3; r.cy = 0.8;
    return { root: r, hinges: hinges };
  }
  function animateContainer(c) {
    const h = c.model.hinges, o = c.open;
    for (let i = 0; i < h.length; i++) {
      if (h[i].kind === 'swing') h[i].node.rot[1] = h[i].sign * o * 1.75;
      else h[i].node.pos[2] = h[i].base + o * 0.38;
    }
  }

  /* ----------------------------- oggetti trovabili ----------------------------- */
  function item(kind) {
    const r = root(), p = new Parts();
    if (kind === 'key' || kind === 'cellKey') {
      const m = kind === 'key' ? 'glowGold' : 'metal';
      p.cyl(m, 0.05, 0.05, 0.015, 0, 0, 0.0, Math.PI / 2, 0, 0, 14).box(m, 0.02, 0.02, 0.16, 0, 0, 0.12).box(m, 0.02, 0.04, 0.025, 0, -0.025, 0.18).box(m, 0.02, 0.03, 0.025, 0, -0.02, 0.14);
      p.nodes(r); r.scl = [0.9, 0.9, 0.9];
    } else if (kind === 'gun') {
      p.box('gunSteel', 0.035, 0.05, 0.22, 0, 0.05, 0).box('gunPoly', 0.03, 0.11, 0.05, 0, -0.02, -0.08, 0.2, 0, 0).cyl('gunSteel', 0.022, 0.022, 0.05, 0, 0.02, 0.0, Math.PI / 2, 0, 0).box('glowRed', 0.01, 0.01, 0.01, 0, 0.08, 0.1);
      p.nodes(r); r.scl = [1.0, 1.0, 1.0];
    } else if (kind === 'ammo') {
      p.box('brass', 0.14, 0.06, 0.09, 0, 0, 0).box('paper', 0.12, 0.02, 0.07, 0, 0.04, 0);
      p.nodes(r);
    } else if (kind === 'battery') {
      p.cyl('battery', 0.03, 0.03, 0.12, -0.04, 0, 0, Math.PI / 2, 0, 0, 10).cyl('battery', 0.03, 0.03, 0.12, 0.04, 0, 0, Math.PI / 2, 0, 0, 10).cyl('brass', 0.012, 0.012, 0.02, -0.04, 0, 0.07, Math.PI / 2, 0, 0, 8).cyl('brass', 0.012, 0.012, 0.02, 0.04, 0, 0.07, Math.PI / 2, 0, 0, 8);
      p.nodes(r);
    } else { // note
      p.box('paper', 0.2, 0.004, 0.28, 0, 0, 0, 0, 0.3, 0);
      p.nodes(r);
    }
    r.radius = 0.6; r.cy = 0.1;
    return r;
  }

  /* ----------------------------- il mostro ----------------------------- */
  function limbMesh(parts) { return GLX.mesh(Prim.merge(parts)); }
  let MG = null;
  function monster() {
    const m = M();
    if (!MG) {
      MG = {};
      const cp = function (r, len) { return limbMesh([{ g: Prim.capsule(r, Math.max(0.01, len - 2 * r), 8), m: mx(0, -len / 2, 0) }]); };
      MG.thigh = cp(0.085, 0.55); MG.shin = cp(0.065, 0.55);
      MG.foot = limbMesh([{ g: Prim.box(0.12, 0.07, 0.3, 1), m: mx(0, -0.02, 0.08) }]);
      MG.upper = cp(0.06, 0.6); MG.fore = cp(0.05, 0.7);
      MG.hand = limbMesh([0, 1, 2, 3].map(function (i) { return { g: Prim.capsule(0.012, 0.2, 5), m: mx((i - 1.5) * 0.028, -0.17, 0.0, 0, 0, (i - 1.5) * 0.08) }; }).concat([{ g: Prim.box(0.1, 0.07, 0.04, 1), m: mx(0, -0.04, 0) }]));
      MG.torso = limbMesh([{ g: Prim.capsule(0.19, 0.45, 10), m: mx(0, 0.36, 0, 0, 0, 0) }, { g: Prim.box(0.34, 0.2, 0.24, 1), m: mx(0, -0.05, 0) }]);
      MG.coat = limbMesh([{ g: Prim.cyl(0.28, 0.4, 0.95, 12, false, 1), m: mx(0, 0.15, 0) }, { g: Prim.box(0.52, 0.12, 0.35, 1), m: mx(0, 0.62, 0) }]);
      MG.head = limbMesh([{ g: Prim.sphere(0.14, 14, 10), m: M4.fromTRS(new Float32Array(16), 0, 0.16, 0.02, 0, 0, 0, 0.9, 1.25, 1.0) }, { g: Prim.cyl(0.05, 0.06, 0.12, 8, true, 1), m: mx(0, -0.01, 0) }]);
      MG.rope = limbMesh([{ g: Prim.cyl(0.075, 0.075, 0.03, 10, false, 1), m: mx(0, 0.0, 0.01) }]);
      MG.eyes = limbMesh([{ g: Prim.sphere(0.02, 6, 4), m: mx(-0.05, 0.21, 0.125) }, { g: Prim.sphere(0.02, 6, 4), m: mx(0.05, 0.21, 0.125) }]);
      MG.mouth = limbMesh([0, 1, 2, 3, 4].map(function (i) { return { g: Prim.box(0.008, 0.045, 0.01, 1), m: mx(-0.05 + i * 0.025, 0.09, 0.128) }; }));
      MG.sockets = limbMesh([{ g: Prim.sphere(0.036, 6, 4), m: mx(-0.05, 0.21, 0.115) }, { g: Prim.sphere(0.036, 6, 4), m: mx(0.05, 0.21, 0.115) }]);
    }
    const r = root(0.56);
    const hips = r.add(new Node()); hips.pos = [0, 1.08, 0];
    const add = function (par, mesh, mat) { const n = par.add(new Node(mesh, mat)); return n; };
    add(hips, limbMesh([{ g: Prim.box(0.32, 0.18, 0.2, 1), m: mx(0, 0, 0) }]), m.rag);
    const torso = hips.add(new Node()); torso.pos = [0, 0.1, 0];
    add(torso, MG.torso, m.skinDark); add(torso, MG.coat, m.rag);
    const head = torso.add(new Node()); head.pos = [0, 0.86, 0.02];
    add(head, MG.head, m.sack); add(head, MG.rope, m.rope || m.skinDark); add(head, MG.sockets, m.black); add(head, MG.eyes, m.eye); add(head, MG.mouth, m.black);
    const mk = function (sx) {
      const up = torso.add(new Node()); up.pos = [sx * 0.31, 0.72, 0]; add(up, MG.upper, m.skinDark);
      const fo = up.add(new Node()); fo.pos = [0, -0.6, 0]; add(fo, MG.fore, m.skin);
      const hd = fo.add(new Node()); hd.pos = [0, -0.7, 0]; add(hd, MG.hand, m.skin);
      return { up: up, fo: fo, hd: hd };
    };
    const armL = mk(-1), armR = mk(1);
    const mkl = function (sx) {
      const th = hips.add(new Node()); th.pos = [sx * 0.12, -0.05, 0]; add(th, MG.thigh, m.skinDark);
      const sh = th.add(new Node()); sh.pos = [0, -0.55, 0]; add(sh, MG.shin, m.rag);
      const ft = sh.add(new Node()); ft.pos = [0, -0.55, 0]; add(ft, MG.foot, m.black);
      return { th: th, sh: sh, ft: ft };
    };
    const legL = mkl(-1), legR = mkl(1);
    r.radius = 2.2; r.cy = 1.0;
    return { root: r, hips: hips, torso: torso, head: head, armL: armL, armR: armR, legL: legL, legR: legR };
  }

  /* ----------------------------- prima persona: torcia e pistola ----------------------------- */
  function viewmodel() {
    const m = M();
    const vm = new Node();
    // ---- torcia (autorata in metri lungo -Z, scala 0.5 = unita' di mondo) ----
    const torch = new Node(); torch.scl = [0.5, 0.5, 0.5]; vm.add(torch);
    const R = Math.PI / 2, tp = new Parts();
    tp.cyl('metal', 0.03, 0.03, 0.2, 0, 0, 0.12, R, 0, 0, 16);                       // corpo
    for (let i = 0; i < 6; i++) tp.cyl('black', 0.0315, 0.0315, 0.008, 0, 0, 0.06 + i * 0.022, R, 0, 0, 16);   // zigrinatura
    tp.cyl('black', 0.033, 0.033, 0.03, 0, 0, 0.235, R, 0, 0, 16);                    // tappo
    tp.cyl('metal', 0.03, 0.055, 0.075, 0, 0, -0.04, R, 0, 0, 20);                    // testa a cono
    tp.cyl('black', 0.058, 0.058, 0.012, 0, 0, -0.082, R, 0, 0, 20);                  // ghiera
    tp.box('black', 0.016, 0.01, 0.03, 0, 0.034, 0.1);                                  // pulsante
    tp.nodes(torch);
    const lens = new Node(GLX.mesh(Prim.cyl(0.05, 0.05, 0.004, 20, true, 1)), m.lensOff); lens.rot = [R, 0, 0]; lens.pos = [0, 0, -0.087]; lens.cast = false; torch.add(lens);
    const hand = new Parts();
    hand.sph('glove', 0.04, 0.012, -0.03, 0.14, 1.2, 0.9, 1.5);
    [0, 1, 2, 3].forEach(function (i) { hand.cap('glove', 0.0105, 0.05, 0.0, -0.036, 0.095 + i * 0.026, 0, 0, R * 0.55 + 0.1); });
    hand.cap('glove', 0.012, 0.05, -0.028, 0.012, 0.075, R * 0.7, 0, 0.6);
    hand.cap('sleeve', 0.038, 0.34, 0.05, -0.1, 0.3, 1.15, 0, 0.18);
    hand.cap('glove', 0.036, 0.05, 0.035, -0.075, 0.2, 1.15, 0, 0.18);
    hand.nodes(torch);
    // ---- pistola ----
    const gun = new Node(); gun.scl = [0.5, 0.5, 0.5]; vm.add(gun);
    const gp = new Parts();
    gp.box('gunSteel', 0.032, 0.036, 0.2, 0, 0.0, -0.11).box('gunPoly', 0.03, 0.03, 0.17, 0, -0.03, -0.095).box('gunPoly', 0.034, 0.1, 0.05, 0, -0.095, 0.0, 0.18, 0, 0).box('black', 0.012, 0.012, 0.012, 0, 0.026, -0.2)
      .box('glowRed', 0.004, 0.004, 0.004, 0, 0.032, -0.2).box('gunSteel', 0.01, 0.02, 0.02, 0, 0.024, -0.01).box('black', 0.02, 0.016, 0.05, 0, -0.056, -0.07);
    gp.nodes(gun);
    const gm = new Parts();
    gm.sph('glove', 0.042, 0.0, -0.07, 0.02, 1.0, 1.4, 1.2).cap('sleeve', 0.038, 0.34, 0.0, -0.16, 0.2, 1.15, 0, 0.1);
    gm.nodes(gun);
    const muzzle = new Node(); muzzle.pos = [0, 0, -0.22]; gun.add(muzzle);
    gun.visible = false;
    return { root: vm, torch: torch, lens: lens, gun: gun, muzzle: muzzle };
  }

  /* lavagna: pannello con texture canvas dinamica */
  function board(tex) {
    const r = new Node();
    const frame = new Parts();
    frame.box('furn', 4.3, 1.5, 0.05, 0, 0, 0).box('furn', 4.3, 0.06, 0.12, 0, -0.76, 0.04);
    frame.nodes(r);
    const mat = Object.assign({}, m_boardBase(), { tex: tex, uv: [1 / 4.1, 1 / 1.3] });
    const pan = new Node(GLX.mesh(Prim.box(4.1, 1.3, 0.02, 1)), mat); pan.pos = [0, 0, 0.035]; pan.cast = false; r.add(pan);
    r.scl = [0.5, 0.5, 0.5];
    r.radius = 3; r.cy = 0.8;
    return { root: r, mat: mat };
  }
  function m_boardBase() { return { albedo: [1.7, 1.7, 1.7], tex: null, uv: [1, 1], bump: 0, rough: 0.9, metal: 0, rvar: 0, emissive: [0, 0, 0], emMode: 0, unlit: 0, trim: 0, roomLit: 0 }; }

  function lightSwitch() {
    const r = root(1);
    const p = new Parts(); p.box('switchPlate', 0.08, 0.12, 0.012, 0, 0, 0).box('black', 0.02, 0.05, 0.02, 0, 0, 0.01);
    p.nodes(r); r.radius = 0.4; r.cy = 0;
    return r;
  }

  return { prop: prop, container: container, animateContainer: animateContainer, item: item, monster: monster, viewmodel: viewmodel, board: board, lightSwitch: lightSwitch, init: function () { } };
})();
