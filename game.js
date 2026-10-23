'use strict';
/* HORROR - logica di gioco: giocatore, mostro, luci, contenitori, oggetti, giorni 1-5, finali */
const Game = (function () {
  const WALK = 1.45, SPRINT = 2.75, CROUCH = 0.7, RAD = 0.22, EYE = 0.82, EYE_C = 0.5;
  const MAXDAY = 5;
  const Hooks = { toast: function () { }, note: function () { }, banner: function () { }, end: function () { }, fade: function () { }, hurt: function () { } };
  const S = { phase: 'none', day: 1, torchOn: false, battery: 100, stamina: 1, prompt: '', objectives: [], hunt: false, hidden: false, fear: 0, hasKey: false, hasGun: false, ammo: 0, notes: 0, monsterHp: 100, time: 0, seed: 1, crouch: false, sprint: false, canSprint: true, chase: false };
  const P = { x: 0, y: 0, yaw: 0, pitch: 0, vx: 0, vy: 0, bob: 0, eye: EYE, stepT: 0, kick: 0, shake: 0, hideYaw: 0 };
  let L = null, rnd = Math.random, propNodes = [], extraNodes = [], containers = [], doors = [], switches = [], items = [], roomLight = [], boardNode = null, boardTex = null, tvList = [];
  let mon = null, monM = null, noises = [], flow = null, flowKey = '', flowT = 0, hid = null;
  let vmo = null, torchK = 1, hbT = 0, eventT = 20, huntT = 60, huntLeft = 0, gunCd = 0, capT = 0, introT = 0, time = 0, flash = 0;
  let notesRead = [], cellKeyFound = false;

  const idx = function (x, y) { return y * L.W + x; };
  const passM = function (x, y) { if (x < 0 || y < 0 || x >= L.W || y >= L.H) return false; const v = L.map[idx(x, y)]; return v === 0 || v === 6; };
  function roomAt(x, y) { const cx = Math.floor(x), cy = Math.floor(y); for (let i = 0; i < L.rooms.length; i++) { const r = L.rooms[i]; if (cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h) return r; } return null; }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  const DIFFS = [
    { name: 'Facile', spd: 0.85, hear: 0.7, see: 0.8, huntLen: 0.75, huntGap: 1.4, drain: 0.75, bats: 10, ammo: 8 },
    { name: 'Normale', spd: 1, hear: 1, see: 1, huntLen: 1, huntGap: 1, drain: 1, bats: 8, ammo: 6 },
    { name: 'Incubo', spd: 1.18, hear: 1.4, see: 1.25, huntLen: 1.35, huntGap: 0.65, drain: 1.3, bats: 5, ammo: 4 }];
  function D() { return DIFFS[Settings.diff === undefined ? 1 : Settings.diff] || DIFFS[1]; }
  function emitNoise(x, y, r) { noises.push({ x: x, y: y, r: r, t: 0 }); }
  const ITEMS = { key: 'Chiave d\'ingresso', cellKey: 'Chiave della cella', gun: 'Pistola', ammo: 'Munizioni', battery: 'Batterie', note: 'Appunto' };

  /* ------------------------------------------------------------ avvio partita ------------------------------------------------------------ */
  function newRun(seed) {
    S.seed = seed || (Math.floor(Math.random() * 1e6) + 1);
    rnd = mulberry32(S.seed * 31 + 5);
    S.day = 1; S.hasKey = false; S.hasGun = false; S.ammo = 0; S.notes = 0; S.battery = 100; S.monsterHp = 100; cellKeyFound = false; notesRead = []; hid = null; S.hidden = false;
    noises = []; items = []; flow = null; flowKey = '';
    FX.clear();
    L = House.build(S.seed);
    World.build(L);
    buildScene();
    placeItems();
    startDay(true);
    updateBoard();
    S.phase = 'play';
    introT = 4;
  }

  function buildScene() {
    propNodes = []; extraNodes = []; containers = L.containers; doors = []; switches = []; items = []; tvList = [];
    L.props.forEach(function (p) {
      if (p.t === 'none' || p.t === 'lockerBank') return;
      const n = Models.prop(p.t); n.pos = [p.x, 0, p.z]; n.rot = [0, p.ry, 0]; n.update(null); propNodes.push(n);
      if (p.t === 'tv') tvList.push({ x: p.x - Math.sin(p.ry) * 0.2, z: p.z - Math.cos(p.ry) * 0.2, ry: p.ry, ph: Math.random() * 10 });
    });
    L.decor.forEach(function (d) {
      if (d.t === 'rug' || d.t === 'blood') {
        const n = Models.prop(d.t); n.pos = [d.x, 0, d.z]; n.rot = [0, rnd() * 6.28, 0]; n.update(null); extraNodes.push(n);
      }
    });
    containers.forEach(function (c) {
      c.model = Models.container(c.kind);
      c.node = c.model.root; c.node.pos = [c.x, 0, c.z]; c.node.rot = [0, c.prop.ry, 0]; c.node.update(null);
      c.open = 0; c.target = 0; c.opened = false; c.item = null; c.itemNode = null;
      c.ix = c.x - c.fx * 0.38; c.iz = c.z - c.fz * 0.38;
      c.ih = { locker: 0.62, wardrobe: 0.6, cabinet: 0.3, dresser: 0.3, nightstand: 0.3, fridge: 0.5 }[c.kind] || 0.4;
      c.iw = { locker: 0.2, wardrobe: 0.6, cabinet: 0.55, dresser: 0.55, nightstand: 0.3, fridge: 0.4 }[c.kind] || 0.4;
    });
    L.switches.forEach(function (s) {
      const n = Models.lightSwitch(); n.pos = [s.x, 0.55, s.z]; n.rot = [0, s.ry, 0]; n.update(null); s.node = n; switches.push(s);
    });
    L.doorList.forEach(function (d) { doors.push(d.d); });
    const bd = L.decor.filter(function (d) { return d.t === 'board'; })[0];
    if (boardTex) GLX.gl.deleteTexture(boardTex.tex);
    boardTex = makeBoardTexture();
    const b = Models.board(boardTex);
    b.root.pos = [bd.x, 0.8, bd.z + 0.04]; b.root.update(null);
    boardNode = b; boardNode.pos = [bd.x, bd.z];
    monM = Models.monster();
    vmo = Models.viewmodel();
    roomLight = [];
    L.rooms.forEach(function () { roomLight.push({ on: false, k: 0, target: 0, fl: 0, buzz: 0, cur: 1 }); });
  }

  function placeItems() {
    containers.forEach(function (c) { c.item = null; c.itemNode = null; c.opened = false; c.open = 0; c.target = 0; });
    const cand = containers.filter(function (c) { return c.rtype !== 'cell'; });
    shuffle(cand);
    const take = function (pred) { for (let i = 0; i < cand.length; i++) { if (!pred || pred(cand[i])) return cand.splice(i, 1)[0]; } return null; };
    const keyC = take(function (c) { return c.rtype !== 'class'; });
    const gunC = take(function (c) { return c.room !== keyC.room && c.rtype !== 'class'; });
    keyC.item = { kind: 'key' }; gunC.item = { kind: 'gun' };
    L.keyC = keyC; L.gunC = gunC;
    const ammoC = take(function (c) { return c.rtype !== 'class'; }); ammoC.item = { kind: 'ammo' };
    const texts = [
      'Ho nascosto la chiave d\'ingresso nella stanza: ' + House.NAMES[keyC.rtype] + '. Lui non la tocca mai.',
      'La pistola è in un contenitore della stanza: ' + House.NAMES[gunC.rtype] + '. Sono pochi colpi. Mira alla testa.',
      'Si ferma quando non fai rumore. Se lo senti arrivare, spegni la torcia e nasconditi in un armadio finché i passi si allontanano.',
      'Ogni volta che mi prende finisco nella cella. La chiave per uscire è in uno degli armadietti. Provali tutti, in fretta.'
    ];
    for (let i = 0; i < 4; i++) { const c = take(); if (c) c.item = { kind: 'note', text: texts[i], idx: i }; }
    for (let i = 0; i < D().bats; i++) { const c = take(); if (c) c.item = { kind: 'battery' }; }
    rollCell();
  }
  function rollCell() {
    const cc = containers.filter(function (c) { return c.rtype === 'cell'; });
    shuffle(cc);
    cc.forEach(function (c) { c.item = null; c.itemNode = null; c.opened = false; c.open = 0; c.target = 0; Models.animateContainer(c); c.node.update(null); });
    items = items.filter(function (i) { return !i.c || i.c.rtype !== 'cell'; });
    if (!cellKeyFound && cc.length) { cc[0].item = { kind: 'cellKey' }; if (cc[1]) cc[1].item = { kind: 'battery' }; if (cc[2]) cc[2].item = { kind: 'battery' }; }
  }

  function startDay(first) {
    const d = S.day;
    roomLight.forEach(function (rl, i) {
      const r = L.rooms[i];
      rl.on = r.type === 'cell' ? true : (r.type === 'class' && first) ? true : rnd() < (r.type === 'hall' ? 0.45 : 0.4) - (d - 1) * 0.08;
      rl.target = rl.on ? 1 : 0; rl.fl = 0; if (first) rl.k = rl.target;
    });
    doors.forEach(function (dr) { if (!dr.locked) dr.target = 0; });
    const far = L.houseRooms.filter(function (r) { return r.type !== 'cell' && r.type !== 'class'; });
    const r = far[Math.floor(rnd() * far.length)];
    mon = { x: r.cx, y: r.cy, yaw: Math.PI / 2, state: 'patrol', tx: 0, ty: 0, wait: 0, lost: 0, lastX: 0, lastY: 0, search: 0, stun: 0, step: 0, look: 0, hp: S.monsterHp, hideTarget: null, dead: false, stateT: 0, anim: 0, grab: 0, walkSpeed: 0, room: null, hideCheck: 0, deadT: 0 };
    if (!passM(Math.floor(mon.x), Math.floor(mon.y))) { const c = nearestPass(mon.x, mon.y); mon.x = c[0] + 0.5; mon.y = c[1] + 0.5; }
    pickPatrol();
    S.hunt = false; huntLeft = 0; huntT = (70 - d * 6 + rnd() * 30) * D().huntGap;
    eventT = 15 + rnd() * 20;
  }

  function placePlayerStart() { P.x = L.start.x; P.y = L.start.y; P.yaw = L.start.a; P.pitch = 0; hid = null; S.hidden = false; P.vx = P.vy = 0; }

  /* ------------------------------------------------------------ BFS del mostro ------------------------------------------------------------ */
  function computeFlow(tx, ty) {
    const W = L.W, H = L.H;
    if (!flow) flow = new Int16Array(W * H);
    flow.fill(-1);
    const q = [idx(tx, ty)]; flow[q[0]] = 0; let n = 0;
    while (n < q.length) {
      const c = q[n++], cx = c % W, cy = (c / W) | 0, dv = flow[c];
      for (let k = 0; k < 4; k++) {
        const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (!passM(nx, ny)) continue;
        const i = idx(nx, ny); if (flow[i] >= 0) continue;
        flow[i] = dv + 1; q.push(i);
      }
    }
    flowKey = tx + ',' + ty;
  }
  function flowDist(x, y) { if (!flow) return 999; const v = flow[idx(Math.floor(x), Math.floor(y))]; return v < 0 ? 999 : v; }
  function nearestPass(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (passM(x, y)) return [x, y];
    for (let r = 1; r < 6; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (passM(x + i, y + j)) return [x + i, y + j];
    return [x, y];
  }
  function setTarget(x, y) { const c = nearestPass(x, y); mon.tx = c[0] + 0.5; mon.ty = c[1] + 0.5; if (flowKey !== c[0] + ',' + c[1]) computeFlow(c[0], c[1]); }
  function pickPatrol() {
    const rs = L.houseRooms.filter(function (r) { return r.type !== 'cell'; });
    let r;
    if (rnd() < 0.35) { const pr = roomAt(P.x, P.y); r = pr && pr.type !== 'hall' && pr.type !== 'cell' ? pr : rs[Math.floor(rnd() * rs.length)]; }
    else r = rs[Math.floor(rnd() * rs.length)];
    const px = r.x + 1 + Math.floor(rnd() * Math.max(1, r.w - 2)), py = r.y + 1 + Math.floor(rnd() * Math.max(1, r.h - 2));
    setTarget(px + 0.5, py + 0.5);
    mon.state = 'patrol'; mon.wait = 0;
  }

  /* ------------------------------------------------------------ interazioni ------------------------------------------------------------ */
  function findInteract() {
    const dx = Math.cos(P.yaw), dy = Math.sin(P.yaw), reach = 1.7;
    const tanp = Math.tan(P.pitch);
    const wallD = World.castDist(P.x, P.y, dx, dy, reach + 1);
    let best = null, bt = 1e9;
    const test = function (px, py, perpMax, yy, yTol, blockSlack, obj, type, label) {
      const vx = px - P.x, vy = py - P.y, t = vx * dx + vy * dy;
      if (t < 0.1 || t > reach) return;
      const perp = Math.abs(vx * dy - vy * dx);
      if (perp > perpMax) return;
      if (Math.abs(P.eye + tanp * t - yy) > yTol) return;
      if (wallD < t - blockSlack) return;
      const score = t + perp * 2;
      if (score < bt) { bt = score; best = { type: type, obj: obj, label: label }; }
    };
    doors.forEach(function (d) {
      if (d.kind === 'front' && d.open > 0.9) return;
      test(d.x + 0.5, d.y + 0.5, 0.5, 0.7, 0.75, 0.9, d, 'door', d.locked ? (((d.kind === 'front' && S.hasKey) || (d.kind === 'cell' && cellKeyFound)) ? 'Apri con la chiave' : 'Porta chiusa a chiave') : (d.target > 0.5 ? 'Chiudi la porta' : 'Apri la porta'));
    });
    containers.forEach(function (c) {
      if (hid && hid !== c) return;
      let lab;
      if (c.kind === 'wardrobe' && c.opened && !c.item && c.open > 0.6) lab = 'Nasconditi nell\'armadio';
      else lab = c.opened ? (c.item ? 'Cerca' : 'Chiudi') : 'Apri: ' + c.label.toLowerCase();
      test(c.ix, c.iz, c.iw, c.ih, 0.7, 1.0, c, 'container', lab);
    });
    switches.forEach(function (s) { test(s.x, s.z, 0.35, 0.55, 0.5, 0.25, s, 'switch', 'Interruttore luce'); });
    items.forEach(function (it) { test(it.x, it.z, 0.3, it.y, 0.5, 1.5, it, 'item', 'Prendi: ' + ITEMS[it.kind]); });
    if (boardNode) test(boardNode.pos[0], boardNode.pos[1] + 0.1, 1.9, 0.75, 0.8, 0.9, boardNode, 'board', 'Leggi la lavagna');
    return best;
  }

  function useInteract(h) {
    if (!h) return;
    if (h.type === 'door') {
      const d = h.obj;
      if (d.locked) {
        if (d.kind === 'front' && S.hasKey) { d.locked = false; L.map[idx(d.x, d.y)] = 6; d.target = 1; Sound.keyJingle(); Hooks.toast('Porta d\'ingresso aperta! Corri fuori!', 'good'); emitNoise(d.x + 0.5, d.y + 0.5, 6); return; }
        if (d.kind === 'cell' && cellKeyFound) { d.locked = false; L.map[idx(d.x, d.y)] = 6; d.target = 1; Sound.keyJingle(); Hooks.toast('La cella è aperta. Esci piano.', 'good'); return; }
        Sound.deny(); Hooks.toast(d.kind === 'front' ? 'Serve la chiave d\'ingresso.' : 'Serve la chiave della cella. Cerca negli armadietti.', 'warn'); return;
      }
      d.target = d.target > 0.5 ? 0 : 1; Sound.creak(0, 0.7); emitNoise(d.x + 0.5, d.y + 0.5, 5);
    } else if (h.type === 'container') {
      const c = h.obj;
      if (c.kind === 'wardrobe' && c.opened && !c.item && c.open > 0.6 && !hid) { enterHide(c); return; }
      if (c.opened && !c.item) { c.target = 0; c.opened = false; Sound.creak(0, 0.5); return; }
      if (!c.opened) {
        c.opened = true; c.target = 1; Sound.creak(0, 0.9); emitNoise(c.ix, c.iz, 5.5);
        if (c.item) {
          const n = Models.item(c.item.kind);
          const it = { kind: c.item.kind, text: c.item.text, idx: c.item.idx, node: n, x: c.x + c.fx * 0.22, z: c.z + c.fz * 0.22, y: c.kind === 'locker' ? 0.62 : (c.kind === 'wardrobe' ? 0.6 : 0.38), c: c, ph: rnd() * 6 };
          n.pos = [it.x, it.y, it.z]; n.update(null);
          c.itemNode = it; items.push(it);
        } else Hooks.toast('Vuoto.', 'dim');
      }
    } else if (h.type === 'switch') {
      const rl = roomLight[h.obj.room];
      rl.on = !rl.on; rl.target = rl.on ? 1 : 0; rl.fl = rl.on ? 0.5 : 0;
      Sound.switchClick(); emitNoise(h.obj.x, h.obj.z, 2.5);
    } else if (h.type === 'item') pickItem(h.obj);
    else if (h.type === 'board') Hooks.note(boardText(), 'LAVAGNA', 'board');
  }

  function pickItem(it) {
    const k = it.kind;
    if (k === 'key') { S.hasKey = true; Sound.keyJingle(); Hooks.toast('Hai trovato la CHIAVE D\'INGRESSO! Raggiungi la porta a ovest del corridoio.', 'good'); }
    else if (k === 'cellKey') { cellKeyFound = true; Sound.keyJingle(); Hooks.toast('Hai la chiave della cella. Apri la porta!', 'good'); }
    else if (k === 'gun') { S.hasGun = true; S.ammo += D().ammo; Sound.pickup(); Hooks.toast('Hai trovato una PISTOLA (' + D().ammo + ' colpi). Clic sinistro per sparare.', 'good'); }
    else if (k === 'ammo') { S.ammo += D().ammo; Sound.pickup(); Hooks.toast('+' + D().ammo + ' munizioni.', 'good'); }
    else if (k === 'battery') { S.battery = Math.min(100, S.battery + 55); Sound.pickup(); Hooks.toast('Batterie: la torcia si ricarica.', 'good'); }
    else if (k === 'note') {
      if (notesRead.indexOf(it.idx) < 0) { notesRead.push(it.idx); S.notes = notesRead.length; }
      Sound.chalk(); Hooks.note(it.text, 'APPUNTO ' + (it.idx + 1) + ' / 4', 'note');
    }
    items.splice(items.indexOf(it), 1); if (it.c) { it.c.itemNode = null; it.c.item = null; }
  }

  function enterHide(c) {
    hid = c; S.hidden = true;
    P.x = c.x - c.fx * 0.1; P.y = c.z - c.fz * 0.1; P.yaw = Math.atan2(c.fz, c.fx); P.hideYaw = P.yaw; P.pitch = 0;
    c.target = 0.14; Sound.thump(0, 0.3);
    S.torchOn = false;
    if (mon && mon.state === 'chase' && Math.hypot(mon.x - c.x, mon.y - c.z) < 6 && World.los(mon.x, mon.y, c.x, c.z)) mon.hideTarget = c;
  }
  function exitHide() {
    const c = hid; hid = null; S.hidden = false;
    c.target = 1;
    P.x = c.x + c.fx * 0.6; P.y = c.z + c.fz * 0.6; P.yaw = Math.atan2(c.fz, c.fx);
    Sound.creak(0, 0.6);
  }

  function updateObjectives() {
    S.objectives = [
      { txt: 'FUGA: trova la chiave d\'ingresso', done: S.hasKey },
      { txt: 'FUGA: apri la porta a ovest ed esci', done: false },
      { txt: 'CACCIA: trova la pistola', done: S.hasGun },
      { txt: 'CACCIA: uccidi il mostro (' + Math.max(0, Math.ceil(S.monsterHp)) + '%)', done: S.monsterHp <= 0 },
      { txt: 'Appunti trovati ' + S.notes + ' / 4', done: S.notes >= 4 }
    ];
  }
  function boardText() {
    return 'GIORNO ' + S.day + ' / ' + MAXDAY + '\n\nSOPRAVVIVI ALLA CASA.\n\nOBIETTIVO A: FUGA\n  1. Trova la chiave d\'ingresso (nascosta in un contenitore a caso)\n  2. Apri la porta a OVEST del corridoio e scappa\n\nOBIETTIVO B: CACCIA\n  1. Trova la pistola (nascosta)\n  2. Uccidi il mostro: pochi colpi, mira alla testa\n\nREGOLE\n  • Se ti cattura finisci nella cella e passa un giorno\n  • Dopo il giorno 5 hai perso e ricominci da capo\n  • Il mostro sente la corsa, le porte e i contenitori\n  • Spegni la torcia e nasconditi negli armadi\n  • Gli appunti indicano dove cercare';
  }
  function makeBoardTexture() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 320; const g = c.getContext('2d');
    g.fillStyle = '#16231d'; g.fillRect(0, 0, 1024, 320);
    for (let i = 0; i < 2500; i++) { g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.04) + ')'; g.fillRect(Math.random() * 1024, Math.random() * 320, Math.random() * 40, 1 + Math.random() * 2); }
    const font = '"Segoe Print","Comic Sans MS","Bradley Hand",cursive';
    g.fillStyle = 'rgba(230,235,225,0.9)'; g.font = 'bold 46px ' + font; g.textBaseline = 'top';
    g.fillText('GIORNO ' + S.day + ' / ' + MAXDAY, 40, 24);
    g.font = '28px ' + font;
    g.fillText('A) trova la CHIAVE ed esci a OVEST', 40, 96);
    g.fillText('B) trova la PISTOLA e uccidi il mostro', 40, 138);
    g.fillStyle = 'rgba(230,200,120,0.85)'; g.fillText('cerca negli armadi - leggi gli appunti', 40, 196);
    g.fillStyle = 'rgba(210,90,80,0.9)'; g.fillText('se corri, lui ti sente...', 40, 246);
    g.fillStyle = 'rgba(230,235,225,0.55)';
    for (let i = 0; i < Math.min(4, S.day); i++) g.fillRect(700 + i * 38, 40, 6, 60);
    if (S.day >= 5) { g.strokeStyle = 'rgba(230,235,225,0.55)'; g.lineWidth = 5; g.beginPath(); g.moveTo(690, 100); g.lineTo(850, 40); g.stroke(); }
    const d = g.getImageData(0, 0, 1024, 320).data;
    return GLX.texture(1024, 320, new Uint8Array(d.buffer), { srgb: true });
  }
  function updateBoard() {
    if (!boardNode) return;
    const old = boardTex, nt = makeBoardTexture();
    boardNode.mat.tex = nt; boardTex = nt;
    if (old) GLX.gl.deleteTexture(old.tex);
  }

  /* ------------------------------------------------------------ movimento giocatore ------------------------------------------------------------ */
  function moveCircle(nx, ny) {
    const ok = function (x, y) { return !(World.solidAt(x - RAD, y - RAD) || World.solidAt(x + RAD, y - RAD) || World.solidAt(x - RAD, y + RAD) || World.solidAt(x + RAD, y + RAD)); };
    if (ok(nx, P.y)) P.x = nx;
    if (ok(P.x, ny)) P.y = ny;
  }

  function updatePlayer(dt) {
    const I = Input;
    const sens = (Settings.sens || 1) * 0.0022;
    const dyaw = I.mdx * sens, dp = I.mdy * sens * (Settings.invertY ? -1 : 1); I.mdx = 0; I.mdy = 0;
    if (S.phase === 'caught') return;
    if (hid) { P.yaw += dyaw; P.yaw = P.hideYaw + clamp(angDiff(P.yaw, P.hideYaw), -0.9, 0.9); P.pitch = clamp(P.pitch + dp, -0.5, 0.5); }
    else { P.yaw += dyaw; P.pitch = clamp(P.pitch + dp, -1.35, 1.35); }
    if (S.phase !== 'play' || hid) { P.vx = P.vy = 0; return; }
    let mvx = 0, mvy = 0;
    const fx = Math.cos(P.yaw), fy = Math.sin(P.yaw), rx = -fy, ry = fx;
    if (I.down('KeyW') || I.down('ArrowUp')) { mvx += fx; mvy += fy; }
    if (I.down('KeyS') || I.down('ArrowDown')) { mvx -= fx; mvy -= fy; }
    if (I.down('KeyD') || I.down('ArrowRight')) { mvx += rx; mvy += ry; }
    if (I.down('KeyA') || I.down('ArrowLeft')) { mvx -= rx; mvy -= ry; }
    const ml = Math.hypot(mvx, mvy), moving = ml > 0.01;
    if (moving) { mvx /= ml; mvy /= ml; }
    S.crouch = I.down('KeyC') || I.down('ControlLeft');
    const wantSprint = (I.down('ShiftLeft') || I.down('ShiftRight')) && moving && !S.crouch && S.canSprint;
    S.sprint = wantSprint;
    if (wantSprint) { S.stamina -= dt / 7; if (S.stamina <= 0) { S.stamina = 0; S.canSprint = false; } }
    else { S.stamina = Math.min(1, S.stamina + dt / (moving ? 8 : 4)); if (!S.canSprint && S.stamina > 0.3) S.canSprint = true; }
    const spd = S.crouch ? CROUCH : (wantSprint ? SPRINT : WALK);
    const k = Math.min(1, dt * 11);
    P.vx += (mvx * spd - P.vx) * k; P.vy += (mvy * spd - P.vy) * k;
    moveCircle(P.x + P.vx * dt, P.y + P.vy * dt);
    const sp = Math.hypot(P.vx, P.vy);
    P.bob += sp * dt * (wantSprint ? 3.6 : 3.0);
    P.eye += ((S.crouch ? EYE_C : EYE) - P.eye) * Math.min(1, dt * 9);
    if (sp > 0.3) {
      P.stepT -= dt * sp;
      if (P.stepT <= 0) { P.stepT = 0.85; Sound.step(wantSprint); emitNoise(P.x, P.y, S.crouch ? 1.2 : (wantSprint ? 8 : 3.6)); }
    }
  }

  /* ------------------------------------------------------------ mostro ------------------------------------------------------------ */
  function monSpeed() {
    return monSpeed0() * D().spd;
  }
  function monSpeed0() {
    const d = S.day;
    if (mon.stun > 0) return 0;
    if (mon.state === 'chase') return 2.0 + d * 0.18;
    if (S.hunt) return 1.9 + d * 0.15;
    if (mon.state === 'investigate') return 1.55 + d * 0.08;
    return 1.15 + d * 0.07;
  }
  function canSee() {
    if (S.hidden) return false;
    const dx = P.x - mon.x, dy = P.y - mon.y, d = Math.hypot(dx, dy);
    if (d < 1.1) return World.los(mon.x, mon.y, P.x, P.y);
    const pr = roomAt(P.x, P.y);
    const lit = pr ? roomLight[pr.id].k > 0.55 : false;
    const range = 5 + (S.torchOn ? 8 : 0) + (lit ? 4 : 0) + (S.sprint ? 3 : 0) - (S.crouch ? 2 : 0);
    if (d > range * D().see) return false;
    if (Math.abs(angDiff(Math.atan2(dy, dx), mon.yaw)) > 1.15) return false;
    return World.los(mon.x, mon.y, P.x, P.y);
  }
  function hearNoises() {
    if (mon.state === 'chase' || mon.state === 'grab' || mon.dead || mon.stun > 0) return;
    for (let i = 0; i < noises.length; i++) {
      const n = noises[i]; if (n.t > 0.05) continue;
      const d = Math.hypot(n.x - mon.x, n.y - mon.y);
      if (d > n.r * D().hear) continue;
      if (mon.state === 'investigate' && mon.stateT < 3 && d > 3) continue;
      setTarget(n.x, n.y); mon.state = 'investigate'; mon.stateT = 0; mon.wait = 0;
    }
  }
  function startChase() {
    if (mon.state === 'chase') return;
    mon.state = 'chase'; mon.stateT = 0; mon.lost = 0;
    Sound.growl(clamp(Math.sin(angDiff(Math.atan2(mon.y - P.y, mon.x - P.x), P.yaw)), -1, 1), 0.9);
    Hooks.toast('', 'chase');
  }

  function updateMonster(dt) {
    if (!mon || mon.dead) return;
    mon.stateT += dt; mon.anim += dt;
    if (mon.stun > 0) { mon.stun -= dt; mon.walkSpeed = 0; return; }
    const dP = Math.hypot(P.x - mon.x, P.y - mon.y);
    huntT -= dt;
    if (huntT <= 0 && !S.hunt && mon.state !== 'chase') { S.hunt = true; huntLeft = (26 + S.day * 2) * D().huntLen; Sound.distantBang(0); Hooks.toast('', 'hunt'); }
    if (S.hunt) {
      huntLeft -= dt;
      if (huntLeft <= 0) { S.hunt = false; huntT = (Math.max(25, 90 - S.day * 8) + rnd() * 30) * D().huntGap; }
      else if (mon.state !== 'chase') { flowT -= dt; if (flowT <= 0) { flowT = 1.2; setTarget(P.x + (rnd() - 0.5) * 3, P.y + (rnd() - 0.5) * 3); if (mon.state !== 'investigate') { mon.state = 'investigate'; mon.stateT = 0; } } }
    }
    const sees = canSee();
    if (sees) { startChase(); mon.lastX = P.x; mon.lastY = P.y; mon.lost = 0; }
    hearNoises();
    if (mon.state === 'chase') {
      if (mon.hideTarget) setTarget(mon.hideTarget.x, mon.hideTarget.z);
      else if (sees) { flowT -= dt; if (flowT <= 0) { flowT = 0.25; setTarget(P.x, P.y); } }
      else {
        mon.lost += dt;
        if (flowKey !== Math.floor(mon.lastX) + ',' + Math.floor(mon.lastY)) setTarget(mon.lastX, mon.lastY);
        if (mon.lost > 5 + S.day * 0.5) { mon.state = 'search'; mon.search = 10 + S.day; mon.stateT = 0; mon.wait = 0; }
      }
    }
    let spd = monSpeed();
    mon.walkSpeed = 0;
    const cx = Math.floor(mon.x), cy = Math.floor(mon.y);
    const arrived = Math.hypot(mon.tx - mon.x, mon.ty - mon.y) < 0.5 || flowDist(mon.x, mon.y) === 0;
    if (arrived) {
      mon.wait += dt;
      if (mon.state === 'patrol' && mon.wait > 1.5 + rnd() * 2) pickPatrol();
      else if (mon.state === 'investigate' && mon.wait > 3.5) { mon.state = 'search'; mon.search = 5; mon.stateT = 0; mon.wait = 0; }
      else if (mon.state === 'search') {
        mon.search -= dt; mon.look = Math.sin(mon.anim * 1.5) * 1.2;
        if (mon.search <= 0) pickPatrol();
        else if (mon.wait > 1.8) { mon.wait = 0; const a = rnd() * 6.28, r = 2 + rnd() * 4; setTarget(mon.x + Math.cos(a) * r, mon.y + Math.sin(a) * r); }
      } else if (mon.state === 'chase' && mon.hideTarget) {
        if (S.hidden && hid === mon.hideTarget) { beginCapture(); return; }
        mon.hideTarget = null; mon.state = 'search'; mon.search = 8; mon.stateT = 0;
      }
    } else {
      let best = null, bd = flow && flow[idx(cx, cy)] >= 0 ? flow[idx(cx, cy)] : 9999;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        if (!i && !j) continue;
        const nx = cx + i, ny = cy + j;
        if (!passM(nx, ny)) continue;
        if (i && j && (!passM(cx + i, cy) || !passM(cx, cy + j))) continue;
        const v = flow[idx(nx, ny)]; if (v < 0) continue;
        if (v < bd) { bd = v; best = [nx, ny]; }
      }
      let tx = mon.tx, ty = mon.ty;
      if (best) { tx = best[0] + 0.5; ty = best[1] + 0.5; }
      if (best && L.map[idx(best[0], best[1])] === 6) {
        const d = L.doorAt[idx(best[0], best[1])];
        if (d.open < 0.8) { if (d.target < 0.5) { d.target = 1; Sound.creak(0, 0.8); } spd = 0.0; }
      }
      const ddx = tx - mon.x, ddy = ty - mon.y, dl = Math.hypot(ddx, ddy) || 1;
      mon.yaw += angDiff(Math.atan2(ddy, ddx), mon.yaw) * Math.min(1, dt * 7);
      mon.x += ddx / dl * spd * dt; mon.y += ddy / dl * spd * dt;
      mon.walkSpeed = spd;
      const rr = roomAt(mon.x, mon.y);
      if (rr && rr !== mon.room) {
        mon.room = rr;
        if (rr.type !== 'hall' && roomLight[rr.id].on && rnd() < 0.55) { const rl = roomLight[rr.id]; rl.on = false; rl.target = 0; rl.fl = 0.6; Sound.bulbPop(); }
      }
      mon.step -= dt * spd;
      if (mon.step <= 0) { mon.step = 0.95; if (dP < 16) Sound.monsterStep(clamp(Math.sin(angDiff(Math.atan2(mon.y - P.y, mon.x - P.x), P.yaw)) * 0.8, -1, 1), clamp(1 - dP / 16, 0.05, 1)); }
    }
    // controlla armadio vicino
    if (S.hidden && hid && dP < 2.3 && mon.state !== 'chase') {
      mon.hideCheck += dt;
      if (mon.hideCheck > 3.2 && rnd() < dt * 1.5) { beginCapture(); return; }
    } else mon.hideCheck = 0;
    if (dP < 0.8 && !S.hidden && World.los(mon.x, mon.y, P.x, P.y)) beginCapture();
    if (mon.state === 'search' && mon.stateT > 25) pickPatrol();
  }

  /* ------------------------------------------------------------ cattura, giorni, finali ------------------------------------------------------------ */
  function beginCapture() {
    if (S.phase !== 'play') return;
    S.phase = 'caught'; capT = 0; mon.state = 'grab'; mon.grab = 0;
    if (hid) hid.target = 1;
    hid = null; S.hidden = false; S.hunt = false; S.torchOn = false;
    Sound.scare(); flash = 1; Hooks.hurt();
  }
  function updateCapture(dt) {
    capT += dt;
    const dx = mon.x - P.x, dy = mon.y - P.y, d = Math.hypot(dx, dy);
    P.yaw += angDiff(Math.atan2(dy, dx), P.yaw) * Math.min(1, dt * 8);
    P.pitch += (0.15 - P.pitch) * Math.min(1, dt * 4);
    if (d > 0.62) { const s = 3.5 * dt; mon.x -= dx / d * s; mon.y -= dy / d * s; }
    mon.yaw = Math.atan2(-dy, -dx);
    mon.grab = Math.min(1, capT / 0.7);
    mon.anim += dt;
    P.shake = 0.8;
    if (capT > 1.3 && capT < 1.4) Hooks.fade(1);
    if (capT > 2.3) {
      if (S.day >= MAXDAY) { S.phase = 'lose'; Sound.lose(); Hooks.end('lose'); return; }
      S.day++;
      placeInCell();
    }
  }
  function placeInCell() {
    rollCell();
    P.x = L.cellSpawn.x; P.y = L.cellSpawn.y; P.yaw = -Math.PI / 2; P.pitch = 0; P.vx = P.vy = 0; P.shake = 0;
    if (!cellKeyFound) { L.cellDoor.locked = true; L.map[idx(L.cellDoor.x, L.cellDoor.y)] = 7; }
    L.cellDoor.open = 0; L.cellDoor.target = 0;
    S.battery = Math.min(100, S.battery + 25);
    startDay(false);
    updateBoard();
    Hooks.banner('GIORNO ' + S.day + ' / ' + MAXDAY, S.day >= MAXDAY ? 'Ultima possibilità' : 'Il mostro è più veloce');
    Hooks.fade(0);
    S.phase = 'play'; flash = 0;
  }
  function winEscape() { if (S.phase !== 'play') return; S.phase = 'win'; Sound.win(); Hooks.end('escape'); }
  function winKill() { if (S.phase !== 'play') return; S.phase = 'win'; Sound.win(); Hooks.end('kill'); }

  /* ------------------------------------------------------------ arma ------------------------------------------------------------ */
  function fire() {
    if (S.phase !== 'play' || !S.hasGun || gunCd > 0 || hid) return;
    if (S.ammo <= 0) { Sound.empty(); gunCd = 0.3; return; }
    S.ammo--; gunCd = 0.55; Sound.shot('pistol', 0, 1); P.kick = 1; flash = 0.12;
    emitNoise(P.x, P.y, 22);
    const dx = Math.cos(P.yaw), dy = Math.sin(P.yaw);
    const wallD = World.castDist(P.x, P.y, dx, dy, 30);
    let hit = false;
    if (mon && !mon.dead) {
      const vx = mon.x - P.x, vy = mon.y - P.y, t = vx * dx + vy * dy;
      const perp = Math.abs(vx * dy - vy * dx);
      if (t > 0 && t < wallD && perp < 0.3) {
        const yy = P.eye + Math.tan(P.pitch) * t;
        if (yy > 0 && yy < 1.2) {
          const head = yy > 0.9;
          mon.hp -= head ? 42 : 17; S.monsterHp = mon.hp; hit = true;
          Sound.hit(head); mon.stun = head ? 2.2 : 1.1;
          FX.blood(mon.x, head ? 1.0 : 0.6, mon.y, dx, dy, 14, head);
          startChase();
          if (mon.hp <= 0) { mon.dead = true; mon.state = 'dead'; mon.deadT = 0; Sound.growl(0, 1); setTimeout(winKill, 2800); }
        }
      }
    }
    if (!hit) {
      const tt = Math.min(wallD, 30), hx = P.x + dx * tt, hz = P.y + dy * tt, hy = P.eye + Math.tan(P.pitch) * tt;
      if (hy > 0 && hy < 1.5) { FX.sparks(hx, hy, hz, -dx, 0, -dy, 8); FX.smoke(hx, hy, hz, 2, 0.2, 1.2, [0.5, 0.5, 0.5]); }
    }
    const tl = Math.min(wallD, 12);
    FX.tracer(P.x + dx * 0.4, P.eye - 0.08, P.y + dy * 0.4, P.x + dx * tl, P.eye + Math.tan(P.pitch) * tl, P.y + dy * tl, [3, 2.4, 1.2], 0.05);
  }

  /* ------------------------------------------------------------ luci, eventi, ambiente ------------------------------------------------------------ */
  function updateLights(dt) {
    for (let i = 0; i < roomLight.length; i++) {
      const rl = roomLight[i];
      if (rl.fl > 0) { rl.fl -= dt; rl.k = Math.random() < 0.5 ? 0.05 : (rl.on ? 1 : 0.0); if (rl.fl <= 0) rl.k = rl.target; continue; }
      let flick = 0;
      if (mon && !mon.dead && rl.on) {
        const r = L.rooms[i], d = Math.hypot(r.cx - mon.x, r.cy - mon.y);
        if (d < 7) flick = 1 - d / 7;
        if (S.hunt) flick = Math.max(flick, 0.45);
      }
      let tk = rl.target;
      if (flick > 0 && rl.on) { rl.buzz -= dt; if (rl.buzz <= 0) { rl.buzz = 0.04 + Math.random() * 0.14; rl.cur = Math.random() < flick * 0.75 ? 0.08 + Math.random() * 0.3 : 1; } tk = rl.cur; }
      rl.k += (tk - rl.k) * Math.min(1, dt * (flick > 0 ? 40 : 6));
    }
    if (S.torchOn) {
      S.battery -= dt * 0.28 * D().drain;
      if (S.battery <= 0) { S.battery = 0; S.torchOn = false; Sound.torchClick(); Hooks.toast('Batteria scarica!', 'warn'); }
    }
    torchK = 1;
    if (S.torchOn) {
      if (S.battery < 25) torchK *= 0.55 + 0.45 * (S.battery / 25);
      if (S.battery < 15 && Math.random() < 0.08) torchK = 0.1;
      const dm = mon ? Math.hypot(mon.x - P.x, mon.y - P.y) : 99;
      if (!mon.dead && dm < 7 && Math.random() < 0.12 * (1 - dm / 7)) torchK = 0.05;
    }
  }
  function updateAmbience(dt) {
    const d = mon && !mon.dead ? Math.hypot(mon.x - P.x, mon.y - P.y) : 99;
    let fear = clamp(1 - d / 11, 0, 1) * (World.los(mon.x, mon.y, P.x, P.y) ? 1 : 0.6);
    if (mon.state === 'chase' && !mon.dead) fear = Math.max(fear, 0.75);
    if (S.hunt) fear = Math.max(fear, 0.35);
    S.fear += (fear - S.fear) * Math.min(1, dt * 2);
    S.chase = mon.state === 'chase' && !mon.dead;
    if (S.fear > 0.3) { hbT -= dt; if (hbT <= 0) { hbT = 1.2 - S.fear * 0.7; Sound.heartbeat(); } }
    Sound.drone(S.fear); Sound.setMusic(S.fear, S.chase || S.hunt);
    eventT -= dt;
    if (eventT <= 0) {
      eventT = 18 + rnd() * 35;
      const r = rnd(), pan = rnd() * 2 - 1;
      if (r < 0.35) Sound.distantBang(pan); else if (r < 0.65) Sound.whisper(pan); else if (r < 0.85) Sound.creak(pan, 0.5);
      else { const rl = roomLight[Math.floor(rnd() * roomLight.length)]; if (rl.on) { rl.fl = 0.7; Sound.buzz(0.6); } }
    }
    for (let i = noises.length - 1; i >= 0; i--) { noises[i].t += dt; if (noises[i].t > 0.2) noises.splice(i, 1); }
  }

  /* ------------------------------------------------------------ aggiornamento ------------------------------------------------------------ */
  function update(dt) {
    dt = Math.min(dt, 0.05);
    if (!L || (S.phase !== 'play' && S.phase !== 'caught')) { Input.pressed('KeyE'); Input.pressed('KeyF'); Input.pressed('KeyG'); return; }
    time += dt; S.time = time;
    const I = Input;
    if (introT > 0) introT -= dt;
    if (gunCd > 0) gunCd -= dt;
    if (flash > 0) flash = Math.max(0, flash - dt * (S.phase === 'caught' ? 0.5 : 4));
    P.shake *= Math.exp(-dt * 6); P.kick *= Math.exp(-dt * 10);
    updatePlayer(dt);
    if (S.phase === 'play') {
      if (I.pressed('KeyF')) { if (!S.torchOn && S.battery <= 0) { Sound.deny(); Hooks.toast('Niente batteria.', 'warn'); } else if (!hid) { S.torchOn = !S.torchOn; Sound.torchClick(); emitNoise(P.x, P.y, 1.5); } }
      if (I.pressed('KeyE')) { if (hid) exitHide(); else useInteract(findInteract()); }
      if (I.mouseDown && !I.mouseUsed) { I.mouseUsed = true; fire(); }
      if (I.pressed('KeyG')) Hooks.note(boardText(), 'PROMEMORIA', 'board');
      if (!L.frontDoor.locked && P.x < 1.1 && Math.abs(P.y - 9.5) < 1.6) winEscape();
      const h = hid ? { label: 'Esci dall\'armadio' } : findInteract();
      S.prompt = h ? h.label : '';
    } else S.prompt = '';
    doors.forEach(function (d) { if (d.open !== d.target) { const s = 2.4 * dt; d.open = d.open < d.target ? Math.min(d.target, d.open + s) : Math.max(d.target, d.open - s); } });
    containers.forEach(function (c) { if (c.open !== c.target) { const s = 2.2 * dt; c.open = c.open < c.target ? Math.min(c.target, c.open + s) : Math.max(c.target, c.open - s); Models.animateContainer(c); c.node.update(null); } });
    items.forEach(function (it) { it.ph += dt * 2; it.node.pos[1] = it.y + Math.sin(it.ph) * 0.02; it.node.rot[1] += dt * 1.2; it.node.update(null); });
    World.update();
    if (S.phase === 'play') updateMonster(dt); else updateCapture(dt);
    updateLights(dt); updateAmbience(dt);
    FX.update(dt);
    updateObjectives();
  }

  /* ------------------------------------------------------------ disegno ------------------------------------------------------------ */
  let swX = 0, swY = 0, lastYaw = 0, lastPitch = 0;
  const camPos = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fov: 72 };
  const roomK = new Float32Array(64);
  function animateMonster() {
    const M = monM, t = mon.anim, ws = mon.walkSpeed || 0, run = mon.state === 'chase' || S.hunt;
    const sp = ws > 0.01 ? 1 : 0, ph = t * (run ? 6.2 : 3.4);
    const sw = Math.sin(ph) * (run ? 0.9 : 0.55) * sp;
    M.hips.pos[1] = 1.06 + Math.abs(Math.sin(ph)) * 0.04 * sp - (mon.dead ? 0.9 : 0);
    M.legL.th.rot[0] = sw; M.legR.th.rot[0] = -sw;
    M.legL.sh.rot[0] = Math.max(0, -sw) * 0.9 + 0.1; M.legR.sh.rot[0] = Math.max(0, sw) * 0.9 + 0.1;
    const lean = run ? 0.45 : 0.22;
    M.torso.rot[0] = lean + (mon.grab > 0 ? 0.2 : 0);
    M.head.rot[0] = -lean * 0.6 + 0.12; M.head.rot[1] = mon.state === 'search' ? mon.look : Math.sin(t * 0.7) * 0.15;
    M.head.rot[2] = Math.sin(t * 1.3) * 0.12;
    const arm = mon.grab > 0 ? -1.5 * mon.grab : (run ? -0.9 : 0.15);
    M.armL.up.rot[0] = arm + (mon.grab > 0 ? 0 : -sw * 0.5); M.armR.up.rot[0] = arm + (mon.grab > 0 ? 0 : sw * 0.5);
    M.armL.fo.rot[0] = mon.grab > 0 ? -0.5 : -0.25; M.armR.fo.rot[0] = mon.grab > 0 ? -0.5 : -0.25;
    M.armL.up.rot[2] = 0.12; M.armR.up.rot[2] = -0.12;
    M.root.pos = [mon.x, 0, mon.y];
    M.root.rot = [0, Math.PI / 2 - mon.yaw, 0];
    if (mon.dead) { mon.deadT += 0.016; M.root.rot[0] = Math.min(1.5, mon.deadT * 1.6); }
    if (mon.stun > 0) { M.torso.rot[0] += 0.4; M.head.rot[0] = 0.5; }
    M.root.update(null);
  }

  function frame() {
    const spd = Math.min(1, Math.hypot(P.vx, P.vy) / 1.5);
    const bb = Settings.bob === undefined ? 1 : Settings.bob;
    const bobY = Math.sin(P.bob * 2) * 0.012 * spd * bb * (S.sprint ? 1.5 : 1), bobX = Math.sin(P.bob) * 0.008 * spd * bb;
    const sh = P.shake;
    camPos.x = P.x - bobX * Math.sin(P.yaw) + (Math.random() - 0.5) * sh * 0.04; camPos.z = P.y + bobX * Math.cos(P.yaw) + (Math.random() - 0.5) * sh * 0.04;
    camPos.y = P.eye + bobY;
    camPos.yaw = P.yaw + (Math.random() - 0.5) * sh * 0.02;
    camPos.pitch = P.pitch - P.kick * 0.04;
    camPos.fov = (Settings.fov || 72) + (S.sprint ? 5 : 0) - (S.fear > 0.6 ? 4 * (S.fear - 0.6) : 0);
    animateMonster();
    const dyn = propNodes.concat(extraNodes);
    containers.forEach(function (c) { dyn.push(c.node); });
    switches.forEach(function (s) { dyn.push(s.node); });
    items.forEach(function (it) { dyn.push(it.node); });
    dyn.push(boardNode.root); dyn.push(monM.root);
    const vm = vmo, gunOut = S.hasGun && !hid;
    vm.gun.visible = gunOut; vm.torch.visible = !hid; vm.root.visible = true;
    const dyw = clamp(angDiff(P.yaw, lastYaw), -0.25, 0.25), dpt = clamp(P.pitch - lastPitch, -0.25, 0.25); lastYaw = P.yaw; lastPitch = P.pitch;
    swX += (clamp(-dyw * 0.5, -0.07, 0.07) - swX) * 0.12; swY += (clamp(dpt * 0.5, -0.05, 0.05) - swY) * 0.12;
    const br = Math.sin(time * 1.4) * 0.002, bx = Math.sin(P.bob) * 0.007 + swX, by = Math.abs(Math.sin(P.bob)) * -0.007 + swY + br;
    vm.torch.pos = gunOut ? [-0.19 + bx, -0.17 + by, -0.36] : [0.17 + bx, -0.16 + by, -0.34];
    vm.torch.rot = [0.06 + swY * 1.5, gunOut ? -0.08 + swX * 2 : 0.1 + swX * 2, swX * 0.8];
    vm.lens.mat = S.torchOn ? Mats.M.lensOn : Mats.M.lensOff;
    vm.gun.pos = [0.14 + bx, -0.15 + by + P.kick * 0.02, -0.33 + P.kick * 0.05];
    vm.gun.rot = [P.kick * 0.2 + swY * 1.5, swX * 2, 0];
    const lights = [];
    tvList.forEach(function (tv) {
      if (Math.hypot(tv.x - P.x, tv.z - P.y) > 14) return;
      const f = 0.6 + 0.4 * Math.sin(time * 9 + tv.ph) * Math.sin(time * 3.7 + tv.ph * 2);
      lights.push({ x: tv.x + Math.sin(tv.ry) * 0.3, y: 0.45, z: tv.z + Math.cos(tv.ry) * 0.3, r: 4.2, cr: 0.35 * f, cg: 0.5 * f, cb: 0.65 * f, spec: 0 });
    });
    if (flash > 0.02 && S.phase === 'play') lights.push({ x: P.x + Math.cos(P.yaw) * 0.5, y: P.eye, z: P.y + Math.sin(P.yaw) * 0.5, r: 6, cr: 4 * flash, cg: 3 * flash, cb: 1.6 * flash, spec: 1 });
    for (let i = 0; i < 64; i++) roomK[i] = i < roomLight.length ? roomLight[i].k : 1;
    Renderer.clearBatches();
    items.forEach(function (it) { FX.glowSprite(Renderer.cam, it.x, it.node.pos[1] + 0.02, it.z, 0.5, it.kind === 'key' ? [1, 0.8, 0.3] : [0.4, 0.8, 1], 0.5); });
    if (!L.frontDoor.locked) FX.floorGlow(0.7, 9.5, 1.3, [0.5, 0.9, 1], 0.6);
    if (S.torchOn && !hid && torchK > 0.2) FX.torchAtmos(Renderer.cam, time, torchK);
    FX.emit(Renderer.cam, time);
    return {
      cam: camPos, dyn: dyn, vm: vm.root, lights: lights, roomK: roomK,
      torch: { on: S.torchOn && !hid, k: torchK }, amb: [0.006, 0.0065, 0.009], fog: 0.05, exposure: 1.25 * (Settings.bright || 1), time: time,
      post: { vign: 0.25 + S.fear * 0.5, hurt: S.phase === 'caught' ? 0.9 : 0, low: S.fear * 0.7, flashW: S.phase === 'caught' ? Math.max(0, 0.7 - capT) * 0.4 : flash * 0.12 },
      alarm: S.hunt ? 0.25 + 0.15 * Math.sin(time * 4) : 0
    };
  }
  function render() { if (!L) return; Renderer.render(frame()); }

  function start(seed) {
    Sound.init(); newRun(seed); placePlayerStart();
    S.torchOn = false; S.stamina = 1; S.canSprint = true; S.fear = 0; time = 0; flash = 0; capT = 0;
    updateObjectives();
    Hooks.banner('GIORNO 1 / ' + MAXDAY, 'Sopravvivi alla casa');
  }
  return {
    S: S, P: P, Hooks: Hooks, start: start, update: update, render: render, fire: fire, boardText: boardText, MAXDAY: MAXDAY,
    get level() { return L; }, get monster() { return mon; }, get roomLight() { return roomLight; }, get containers() { return containers; }
  };
})();
