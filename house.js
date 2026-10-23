'use strict';
/* HORROR - generatore della casa: stanze, corridoio, aula, cella, arredamento, contenitori */
const House = (function () {
  const W = 62, H = 19;
  const TOP_Y0 = 1, TOP_Y1 = 6, WALL_T = 7, HALL_Y0 = 8, HALL_Y1 = 10, WALL_B = 11, BOT_Y0 = 12, BOT_Y1 = 17;

  const NAMES = { class: 'aula', living: 'soggiorno', kitchen: 'cucina', bedroom: 'camera da letto', bath: 'bagno', library: 'biblioteca', dining: 'sala da pranzo', storage: 'ripostiglio', office: 'studio', cell: 'cella', hall: 'corridoio' };
  const STYLE = { class: 2, living: 1, kitchen: 3, bedroom: 1, bath: 3, library: 4, dining: 1, storage: 2, office: 4, cell: 3, hall: 1 };
  const TILE = { class: 1, kitchen: 1, bath: 1, cell: 1 };

  function build(seed) {
    const rnd = mulberry32(seed * 7919 + 13);
    const R = function (a, b) { return a + Math.floor(rnd() * (b - a + 1)); };
    const pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
    const map = new Uint8Array(W * H).fill(1);
    const floorTex = new Uint8Array(W * H), ceilTex = new Uint8Array(W * H), wallStyle = new Uint8Array(W * H);
    const doorAt = new Array(W * H).fill(null);
    const rooms = [], lamps = [], decor = [], props = [], containers = [], switches = [];
    const L = { cfg: { seed: seed }, W: W, H: H, map: map, floorTex: floorTex, ceilTex: ceilTex, wallStyle: wallStyle, doorAt: doorAt, rooms: rooms, lamps: lamps, decor: decor, props: props, containers: containers, switches: switches, name: 'Casa' };
    const at = function (x, y) { return y * W + x; };

    function addRoom(type, x, y, w, h) {
      const r = { id: rooms.length, type: type, name: NAMES[type], x: x, y: y, w: w, h: h, cx: x + w / 2, cy: y + h / 2, style: STYLE[type], doors: [] };
      rooms.push(r);
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { map[at(i, j)] = 0; if (TILE[type]) floorTex[at(i, j)] = 1; }
      for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) {
        if (i < 0 || j < 0 || i >= W || j >= H) continue;
        if (map[at(i, j)] === 1) wallStyle[at(i, j)] = r.type === 'hall' ? 0 : STYLE[type];
      }
      return r;
    }
    // corridoio centrale in segmenti (ognuno con la sua luce)
    let hx = 1;
    while (hx < W - 1) {
      let w = Math.min(R(7, 9), W - 1 - hx); if (W - 1 - (hx + w) < 4) w = W - 1 - hx;
      const r = addRoom('hall', hx, HALL_Y0, w, 3);
      lamps.push({ x: hx + w / 2, y: 9.5, i: 0.7, rid: r.id });
      hx += w;
    }
    const hallCount = rooms.length;
    // fila superiore e inferiore
    const pool = ['living', 'kitchen', 'bedroom', 'bedroom', 'bath', 'library', 'dining', 'storage', 'office', 'bedroom', 'living', 'office'];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    let pi = 0;
    function row(top, forced) {
      const y0 = top ? TOP_Y0 : BOT_Y0, h = 6;
      const list = [];
      let x = 1, idx = 0;
      while (x < W - 5) {
        let w = R(6, 8);
        if (forced && forced[idx] && forced[idx].w) w = forced[idx].w;
        if (W - 1 - (x + w + 1) < 5) w = W - 1 - x;
        let type = forced && forced[idx] && forced[idx].t ? forced[idx].t : pool[pi++ % pool.length];
        list.push(addRoom(type, x, y0, w, h));
        x += w + 1; idx++;
      }
      return list;
    }
    const top = row(true, [{ t: 'class', w: 10 }]);
    // la cella e' l'ultima stanza in basso
    const botTmp = row(false, []);
    const last = botTmp[botTmp.length - 1];
    last.type = 'cell'; last.name = NAMES.cell; last.style = 3;
    for (let j = last.y; j < last.y + last.h; j++) for (let i = last.x; i < last.x + last.w; i++) floorTex[at(i, j)] = 1;
    for (let j = last.y - 1; j <= last.y + last.h; j++) for (let i = last.x - 1; i <= last.x + last.w; i++) if (i >= 0 && j >= 0 && i < W && j < H && map[at(i, j)] === 1) wallStyle[at(i, j)] = 3;
    const bottom = botTmp;
    const all = top.concat(bottom);

    // porte verso il corridoio
    function door(x, y, kind, locked) {
      map[at(x, y)] = locked ? 7 : 6;
      doorAt[at(x, y)] = { x: x, y: y, open: 0, target: 0, locked: !!locked, kind: kind, dir: rnd() < 0.5 ? 1 : -1, speed: 0, id: 0 };
      return doorAt[at(x, y)];
    }
    all.forEach(function (r) {
      const isTop = r.y === TOP_Y0;
      const dx = R(r.x + 1, r.x + r.w - 2), dy = isTop ? WALL_T : WALL_B;
      r.door = door(dx, dy, r.type === 'cell' ? 'cell' : 'house', r.type === 'cell');
      r.doorCell = { x: dx, y: dy };
      r.doors.push(r.door);
      // interruttore luce accanto alla porta (dentro la stanza)
      const sx = dx + 1 <= r.x + r.w - 1 ? dx + 1 : dx - 1;
      if (r.type !== 'cell') switches.push({ x: sx + 0.5, y: 1.1, z: isTop ? WALL_T - 0.03 : WALL_B + 1 + 0.03, ry: isTop ? Math.PI : 0, room: r.id, label: 'Luce' });
    });
    // porte tra stanze adiacenti (anelli per il mostro)
    [top, bottom].forEach(function (rowList, ri) {
      for (let i = 0; i < rowList.length - 1; i++) {
        const a = rowList[i], b = rowList[i + 1];
        if (a.type === 'cell' || b.type === 'cell' || rnd() < 0.4) continue;
        const wx = a.x + a.w, y = a.y + R(1, a.h - 2);
        const d = door(wx, y, 'house', false);
        a.doors.push(d); b.doors.push(d);
      }
    });
    // porta d'ingresso bloccata
    const front = door(0, 9, 'front', true);
    front.dir = 1;
    L.front = { x: 0, y: 9 };
    L.frontDoor = front;

    // lampade delle stanze + finestre
    all.forEach(function (r) {
      const big = r.w * r.h >= 40;
      const pts = big ? [[r.x + r.w * 0.3, r.cy], [r.x + r.w * 0.7, r.cy]] : [[r.cx, r.cy]];
      pts.forEach(function (p) { lamps.push({ x: p[0], y: p[1], i: r.type === 'cell' ? 0.55 : (r.type === 'class' ? 0.85 : 0.75), rid: r.id }); });
      if (rnd() < 0.7 && r.type !== 'cell') {
        const isTop = r.y === TOP_Y0;
        decor.push({ t: 'window', x: r.x + r.w * (0.3 + rnd() * 0.4), z: isTop ? 1.0 : H - 1, ry: isTop ? 0 : Math.PI });
      }
    });

    all.forEach(function (r) {
      if (r.type === 'cell' || r.type === 'class') return;
      const isTop = r.y === TOP_Y0, n = 1 + (rnd() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) decor.push({ t: 'frame', x: r.x + 1.3 + (i ? r.w - 2.6 : 0), z: isTop ? 1.0 : H - 1, ry: isTop ? 0 : Math.PI });
    });
    /* ---------------- arredamento ---------------- */
    const occ = new Uint8Array(W * H);          // celle riservate (porte, passaggi)
    all.forEach(function (r) {
      const dy = r.doorCell.y, inner = r.y === TOP_Y0 ? dy - 1 : dy + 1;
      occ[at(r.doorCell.x, inner)] = 1; occ[at(r.doorCell.x, dy)] = 1;
      // celle davanti alle porte laterali
      r.doors.forEach(function (d) { if (d !== r.door) { occ[at(d.x - 1, d.y)] = 1; occ[at(d.x + 1, d.y)] = 1; } });
    });
    const cls = top[0];
    const spawn = { x: cls.x + 4 + 0.5, y: 4 + 0.5, a: -Math.PI / 2 };
    occ[at(cls.x + 4, 4)] = 1;
    L.start = spawn;

    let ctx = { sx: Math.floor(spawn.x), sy: Math.floor(spawn.y), p7: false };
    function passable(v, p7) { return v === 0 || v === 6 || (p7 && v === 7); }
    function reachFrom(sx, sy, p7) {
      const seen = new Uint8Array(W * H), q = [at(sx, sy)];
      seen[q[0]] = 1; let n = 0;
      while (n < q.length) {
        const c = q[n++], cx = c % W, cy = (c / W) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          const nx = cx + d[0], ny = cy + d[1];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
          const i = at(nx, ny);
          if (seen[i] || !passable(map[i], p7)) return;
          seen[i] = 1; q.push(i);
        });
      }
      return { seen: seen, n: q.length };
    }
    let baseline = reachFrom(ctx.sx, ctx.sy, false).n;
    function canBlock(cells) {
      const saved = cells.map(function (c) { return map[at(c[0], c[1])]; });
      for (let k = 0; k < cells.length; k++) {
        const i = at(cells[k][0], cells[k][1]);
        if (map[i] !== 0 || occ[i]) { for (let j = 0; j < k; j++) map[at(cells[j][0], cells[j][1])] = saved[j]; return false; }
        map[i] = 5;
      }
      const n = reachFrom(ctx.sx, ctx.sy, ctx.p7).n;
      const ok = n === baseline - cells.length;
      if (!ok) for (let k = 0; k < cells.length; k++) map[at(cells[k][0], cells[k][1])] = saved[k];
      else baseline = n;
      return ok;
    }
    function faceAngle(fx, fy) { return Math.atan2(fx, fy); }   // fronte (+z locale) verso (fx,fy)
    function ringCells(r) {
      const out = [];
      for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) {
        const wl = map[at(i - 1, j)] === 1, wr = map[at(i + 1, j)] === 1, wu = map[at(i, j - 1)] === 1, wd = map[at(i, j + 1)] === 1;
        if (!(wl || wr || wu || wd)) continue;
        if (map[at(i, j)] !== 0 || occ[at(i, j)]) continue;
        let fx = 0, fy = 0;
        if (wl) fx = 1; else if (wr) fx = -1; else if (wu) fy = 1; else fy = -1;
        if ((wl || wr) && (wu || wd) && rnd() < 0.5) { fx = 0; fy = wu ? 1 : -1; }
        out.push({ x: i, y: j, fx: fx, fy: fy });
      }
      for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = out[i]; out[i] = out[j]; out[j] = t; }
      return out;
    }
    function addProp(t, cx, cy, fx, fy, extra) {
      const p = Object.assign({ t: t, x: cx + 0.5, z: cy + 0.5, ry: faceAngle(fx, fy), cx: cx, cy: cy }, extra || {});
      props.push(p); return p;
    }
    function addContainer(p, kind, label, off) {
      const wx = p.x + (off ? off[0] : 0), wz = p.z + (off ? off[1] : 0);
      const c = { kind: kind, label: label, x: wx, z: wz, y: kind === 'cabinet' || kind === 'dresser' || kind === 'nightstand' ? 0.5 : 0.8, prop: p, open: 0, opened: false, item: null, room: p.room, rtype: p.rtype, fx: Math.sin(p.ry), fz: Math.cos(p.ry) };
      containers.push(c); p.container = c; return c;
    }
    function placeRing(r, t, opts) {
      opts = opts || {};
      const cells = ringCells(r);
      for (let k = 0; k < cells.length; k++) {
        const c = cells[k];
        if (!canBlock([[c.x, c.y]])) continue;
        const p = addProp(t, c.x, c.y, c.fx, c.fy, { room: r.id, rtype: r.type });
        if (opts.container) addContainer(p, opts.container, opts.label);
        return p;
      }
      return null;
    }
    function placeCenter(r, t, ox, oy, fx, fy, container, label) {
      const cx = Math.floor(r.cx) + (ox || 0), cy = Math.floor(r.cy) + (oy || 0);
      if (!canBlock([[cx, cy]])) return null;
      const p = addProp(t, cx, cy, fx || 0, fy || 1, { room: r.id, rtype: r.type });
      if (container) addContainer(p, container, label);
      return p;
    }
    function lockerBank(r, c) {
      // tre armadietti affiancati in una cella
      const p = addProp('lockerBank', c.x, c.y, c.fx, c.fy, { room: r.id, rtype: r.type });
      const sx = Math.cos(p.ry), sz = -Math.sin(p.ry);
      [-0.6, 0, 0.6].forEach(function (o, i) {
        const lp = { t: 'none', x: p.x + sx * o * 0.5 * 2 / 2 * 1, z: p.z + sz * o * 0.5 * 2 / 2 * 1, ry: p.ry, room: r.id, rtype: r.type, cx: c.x, cy: c.y };
        lp.x = p.x + sx * o; lp.z = p.z + sz * o;
        addContainer(lp, 'locker', 'Armadietto');
        containers[containers.length - 1].lockerIndex = i;
      });
      return p;
    }
    function placeLockers(r) {
      const cells = ringCells(r);
      for (let k = 0; k < cells.length; k++) { const c = cells[k]; if (canBlock([[c.x, c.y]])) { lockerBank(r, c); return true; } }
      return false;
    }

    all.forEach(function (r) {
      const t = r.type;
      if (t === 'class') {
        // lavagna, banchi in file, cattedra, armadietti
        decor.push({ t: 'board', x: r.x + r.w / 2, z: 1.0, ry: 0 });
        props.push({ t: 'teacher', x: Math.floor(r.cx) + 0.5, z: 1.5, ry: Math.PI, room: r.id, rtype: t, cx: Math.floor(r.cx), cy: 1 });
        map[at(Math.floor(r.cx), 1)] = 5;
        baseline--;
        for (let rowY = 3; rowY <= 5; rowY += 2) for (let col = r.x + 1; col <= r.x + 8; col += 2) {
          if (col === r.x + 4 && rowY === 5 && false) continue;
          if (canBlock([[col, rowY]])) addProp('desk', col, rowY, 0, -1, { room: r.id, rtype: t });
        }
        placeLockers(r); placeRing(r, 'bookshelf');
        return;
      }
      if (t === 'cell') {
        const sv = { ctx: ctx, base: baseline };
        ctx = { sx: Math.floor(r.cx), sy: Math.floor(r.cy), p7: true };
        occ[at(ctx.sx, ctx.sy)] = 1;
        baseline = reachFrom(ctx.sx, ctx.sy, true).n;
        placeLockers(r); placeLockers(r); placeLockers(r);
        placeRing(r, 'bench');
        decor.push({ t: 'blood', x: r.cx, z: r.cy });
        ctx = sv.ctx; baseline = sv.base;
        return;
      }
      if (t === 'living') {
        placeRing(r, 'sofa'); placeRing(r, 'tv'); placeRing(r, 'bookshelf'); placeRing(r, 'cabinet', { container: 'cabinet', label: 'Mobile' }); placeRing(r, 'cabinet', { container: 'cabinet', label: 'Mobile' });
        placeCenter(r, 'coffee', 0, 0, 0, 1); decor.push({ t: 'rug', x: r.cx, z: r.cy });
      } else if (t === 'kitchen') {
        placeRing(r, 'fridge', { container: 'fridge', label: 'Frigorifero' });
        placeRing(r, 'counter', { container: 'cabinet', label: 'Credenza' }); placeRing(r, 'counter', { container: 'cabinet', label: 'Credenza' }); placeRing(r, 'counter'); placeRing(r, 'sink');
        placeCenter(r, 'table', 0, 0, 0, 1);
      } else if (t === 'bedroom') {
        placeRing(r, 'bed'); placeRing(r, 'wardrobe', { container: 'wardrobe', label: 'Armadio' });
        placeRing(r, 'nightstand', { container: 'nightstand', label: 'Comodino' }); placeRing(r, 'dresser', { container: 'dresser', label: 'Cassettiera' });
        decor.push({ t: 'rug', x: r.cx, z: r.cy });
      } else if (t === 'bath') {
        placeRing(r, 'tub'); placeRing(r, 'toilet'); placeRing(r, 'sink');
        placeRing(r, 'cabinet', { container: 'cabinet', label: 'Mobiletto' }); placeRing(r, 'cabinet', { container: 'cabinet', label: 'Mobiletto' });
        decor.push({ t: 'blood', x: r.cx - 1, z: r.cy });
      } else if (t === 'library') {
        placeRing(r, 'bookshelf'); placeRing(r, 'bookshelf'); placeRing(r, 'bookshelf'); placeRing(r, 'bookshelf');
        placeRing(r, 'cabinet', { container: 'cabinet', label: 'Mobile' }); placeRing(r, 'dresser', { container: 'dresser', label: 'Cassettiera' });
        placeCenter(r, 'table', 0, 0, 0, 1);
      } else if (t === 'dining') {
        placeCenter(r, 'table', 0, 0, 0, 1);
        placeRing(r, 'cabinet', { container: 'cabinet', label: 'Credenza' }); placeRing(r, 'cabinet', { container: 'cabinet', label: 'Credenza' }); placeRing(r, 'dresser', { container: 'dresser', label: 'Cassettiera' });
        decor.push({ t: 'rug', x: r.cx, z: r.cy });
      } else if (t === 'storage') {
        placeLockers(r); placeRing(r, 'crate'); placeRing(r, 'crate'); placeRing(r, 'crate'); placeRing(r, 'barrel');
        placeRing(r, 'cabinet', { container: 'cabinet', label: 'Scaffale' });
      } else if (t === 'office') {
        placeRing(r, 'teacher'); placeRing(r, 'bookshelf'); placeRing(r, 'bookshelf');
        placeRing(r, 'dresser', { container: 'dresser', label: 'Cassettiera' }); placeRing(r, 'cabinet', { container: 'cabinet', label: 'Schedario' });
      }
    });

    // verifica che la cella sia percorribile dalla porta al centro
    const cr = bottom[bottom.length - 1];
    L.cell = { room: cr, x: cr.cx, y: cr.cy };
    // posizione di partenza nella cella: cella libera piu' vicina al centro
    let best = null, bd = 1e9;
    for (let j = cr.y; j < cr.y + cr.h; j++) for (let i = cr.x; i < cr.x + cr.w; i++) {
      if (map[at(i, j)] !== 0) continue;
      const d = Math.hypot(i + 0.5 - cr.cx, j + 0.5 - cr.cy); if (d < bd) { bd = d; best = { x: i + 0.5, y: j + 0.5 }; }
    }
    L.cellSpawn = best;
    L.cellDoor = cr.door;
    // garantisce che gli armadietti della cella siano raggiungibili dal centro
    const cellDoorInner = { x: cr.doorCell.x, y: cr.doorCell.y + 1 };
    const rch = (function () {
      const seen = new Uint8Array(W * H), q = [at(Math.floor(best.x), Math.floor(best.y))]; seen[q[0]] = 1; let n = 0;
      while (n < q.length) { const c = q[n++], cx = c % W, cy = (c / W) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { const nx = cx + d[0], ny = cy + d[1]; const i = at(nx, ny); if (seen[i] || map[i] !== 0 && map[i] !== 7) return; seen[i] = 1; q.push(i); }); }
      return seen;
    })();
    L.cellOk = !!rch[at(cellDoorInner.x, cellDoorInner.y)];
    L.hallRooms = rooms.slice(0, hallCount);
    L.houseRooms = all;
    L.roomsAll = rooms;
    L.mustReach = baseline;
    // ceilTex non usato; luci gestite da lamps
    L.W = W; L.H = H;
    return L;
  }
  return { build: build, W: W, H: H, NAMES: NAMES };
})();
