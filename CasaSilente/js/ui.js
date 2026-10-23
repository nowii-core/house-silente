'use strict';
/* HORROR - interfaccia: input, menu, HUD, ciclo principale */
const Input = { keys: {}, edge: {}, mdx: 0, mdy: 0, mouseDown: false, mouseUsed: false, down: function (c) { return !!this.keys[c]; }, pressed: function (c) { const e = this.edge[c]; this.edge[c] = false; return !!e; } };
const Settings = { quality: 'high', vol: 0.7, sens: 1, bright: 1 };
(function () {
  const $ = function (id) { return document.getElementById(id); };
  const q = new URLSearchParams(location.search);
  const NOLOCK = q.has('nolock');
  try { const s = JSON.parse(localStorage.getItem('casa-silente-settings') || '{}'); Object.assign(Settings, s); } catch (e) { }
  if (q.get('quality')) Settings.quality = q.get('quality');
  function saveSettings() { try { localStorage.setItem('casa-silente-settings', JSON.stringify(Settings)); } catch (e) { } }

  let state = 'boot', ready = false, last = 0, noteOpen = false, fps = 0, fpsT = 0, fpsN = 0, prevScreen = 'menu';
  const canvas = $('gl');
  const screens = ['boot', 'menu', 'controls', 'options', 'pause', 'end', 'note'];
  function show(id) { screens.forEach(function (s) { $(s).classList.toggle('hidden', s !== id); }); }
  function hideAll() { screens.forEach(function (s) { $(s).classList.add('hidden'); }); }

  /* ---------------- pointer lock ---------------- */
  function lock() { if (NOLOCK) return; try { const p = canvas.requestPointerLock && canvas.requestPointerLock(); if (p && p.catch) p.catch(function () { }); } catch (e) { } }
  document.addEventListener('pointerlockchange', function () {
    if (NOLOCK) return;
    const locked = document.pointerLockElement === canvas;
    if (state === 'play' && !locked && !noteOpen) pause();
  });
  document.addEventListener('mousemove', function (e) {
    if (state !== 'play' || noteOpen) return;
    if (NOLOCK || document.pointerLockElement === canvas) { Input.mdx += e.movementX || 0; Input.mdy += e.movementY || 0; }
  });
  document.addEventListener('mousedown', function (e) { if (e.button === 0 && state === 'play') { Input.mouseDown = true; Input.mouseUsed = false; } });
  document.addEventListener('mouseup', function (e) { if (e.button === 0) Input.mouseDown = false; });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Tab') e.preventDefault();
    if (!Input.keys[e.code]) Input.edge[e.code] = true;
    Input.keys[e.code] = true;
    if (e.code === 'Escape' && noteOpen) { closeNote(); return; }
    if (e.code === 'KeyE' && noteOpen) { closeNote(); Input.edge.KeyE = false; return; }
    if (e.code === 'Escape' && state === 'play') { pause(); }
    else if (e.code === 'Escape' && state === 'pause') resume();
    if (e.code === 'Tab' && state === 'play') $('objectives').classList.toggle('faded');
  });
  document.addEventListener('keyup', function (e) { Input.keys[e.code] = false; });
  window.addEventListener('blur', function () { Input.keys = {}; if (state === 'play') pause(); });
  window.addEventListener('resize', function () { if (ready) Renderer.resize(); });

  /* ---------------- HUD e hook ---------------- */
  let toastTimer = 0;
  Game.Hooks.toast = function (txt, kind) {
    if (kind === 'chase') { return; }
    if (kind === 'hunt') { toast('Le luci tremano… ti stanno cercando.', 'warn'); return; }
    if (!txt) return;
    toast(txt, kind);
  };
  function toast(txt, kind) {
    const box = $('toast');
    const d = document.createElement('div'); d.className = 'toast ' + (kind || ''); d.textContent = txt; box.appendChild(d);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 4200);
  }
  Game.Hooks.note = function (text, title, kind) {
    noteOpen = true; $('note-t').textContent = title; $('note-x').textContent = text;
    $('paper').className = 'paper' + (kind === 'board' ? ' board' : '');
    $('note').classList.remove('hidden');
    if (document.exitPointerLock && !NOLOCK) { document.exitPointerLock(); }
  };
  function closeNote() { noteOpen = false; $('note').classList.add('hidden'); Input.keys = {}; lock(); }
  Game.Hooks.banner = function (t, s) {
    $('bn-t').textContent = t; $('bn-s').textContent = s || '';
    const b = $('banner'); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  };
  Game.Hooks.fade = function (v) { $('fade').style.opacity = v ? 1 : 0; };
  Game.Hooks.hurt = function () { };
  Game.Hooks.end = function (kind) {
    state = 'end'; if (document.exitPointerLock) document.exitPointerLock();
    const t = $('end-t'), s = $('end-s');
    if (kind === 'escape') { t.textContent = 'SEI FUGGITO'; s.textContent = 'La porta si richiude alle tue spalle. Il silenzio dura poco… ma sei vivo. Giorno ' + Game.S.day + ' di ' + Game.MAXDAY + '.'; t.style.color = '#d6c58a'; }
    else if (kind === 'kill') { t.textContent = 'L\'HAI UCCISO'; s.textContent = 'Il mostro cade e non si rialza. La casa torna silenziosa. Per ora.'; t.style.color = '#d6c58a'; }
    else { t.textContent = 'HAI PERSO'; s.textContent = 'Cinque giorni sono passati. La casa ti ha preso per sempre. Ricomincia da capo: ogni volta la casa è diversa.'; t.style.color = '#9b1c14'; }
    const G = Game.S, tt = Math.floor(G.time || 0);
    $('end-stats').innerHTML = '<span>Tempo di gioco</span><b>' + Math.floor(tt / 60) + ' min ' + (tt % 60) + ' s</b><span>Giorno raggiunto</span><b>' + G.day + ' / ' + Game.MAXDAY + '</b><span>Catture subite</span><b>' + Math.max(0, G.day - 1) + '</b><span>Difficoltà</span><b>' + ['Facile', 'Normale', 'Incubo'][Settings.diff] + '</b>';
    $('fade').style.opacity = 0;
    show('end'); $('hud').classList.add('hidden');
  };

  function updateHud() {
    const S = Game.S;
    $('day-label').textContent = 'GIORNO ' + S.day + ' / ' + Game.MAXDAY;
    const pips = $('day-pips').children;
    for (let i = 0; i < pips.length; i++) pips[i].className = i + 1 < S.day ? 'on' : (i + 1 === S.day ? 'cur' : '');
    $('bat-bar').style.width = S.battery + '%'; $('bat-bar').className = S.battery < 20 ? 'low' : '';
    $('bat-n').textContent = Math.ceil(S.battery) + '%';
    $('sta-bar').style.width = (S.stamina * 100) + '%';
    const pr = $('prompt'); pr.textContent = S.prompt; pr.classList.toggle('on', !!S.prompt);
    const ul = $('obj-list');
    if (ul._k !== S.objectives.map(function (o) { return o.txt + o.done; }).join('|')) {
      ul._k = S.objectives.map(function (o) { return o.txt + o.done; }).join('|');
      ul.innerHTML = '';
      S.objectives.forEach(function (o) { const li = document.createElement('li'); li.textContent = (o.done ? '✓ ' : '• ') + o.txt; if (o.done) li.className = 'done'; ul.appendChild(li); });
    }
    $('weapon').classList.toggle('hidden', !S.hasGun); $('ammo-n').textContent = S.ammo;
    $('hide-tag').classList.toggle('hidden', !S.hidden);
    $('chase-vig').classList.toggle('on', S.chase || S.hunt);
    $('crosshair').style.display = S.hidden ? 'none' : '';
  }

  /* ---------------- flusso ---------------- */
  function startGame() {
    Sound.init(); applySettings();
    const seed = q.get('seed') ? parseInt(q.get('seed'), 10) : undefined;
    Game.start(seed);
    hideAll(); $('hud').classList.remove('hidden'); $('fade').style.opacity = 0;
    $('objectives').classList.remove('faded');
    state = 'play'; noteOpen = false; Input.keys = {};
    Input.edge = {};
    lock();
    setTimeout(function () { if (state === 'play') $('objectives').classList.add('faded'); }, 14000);
  }
  function pause() { if (state !== 'play') return; state = 'pause'; show('pause'); if (document.exitPointerLock) document.exitPointerLock(); }
  function resume() { state = 'play'; hideAll(); Input.keys = {}; lock(); }
  function toMenu() { state = 'menu'; $('hud').classList.add('hidden'); show('menu'); if (document.exitPointerLock) document.exitPointerLock(); }

  $('b-play').onclick = startGame;
  $('b-again').onclick = startGame;
  $('b-menu').onclick = toMenu;
  $('b-resume').onclick = resume;
  $('b-quit').onclick = toMenu;
  $('b-controls').onclick = function () { prevScreen = 'menu'; show('controls'); };
  $('b-options').onclick = function () { prevScreen = 'menu'; show('options'); };
  $('b-controls2').onclick = function () { prevScreen = 'pause'; show('controls'); };
  $('b-options2').onclick = function () { prevScreen = 'pause'; show('options'); };
  Array.prototype.forEach.call(document.querySelectorAll('.back'), function (b) { b.onclick = function () { show(prevScreen); }; });
  $('lockhint').onclick = lock;

  const DEF = { quality: 'high', vol: 0.7, music: 0.6, sfx: 0.8, sens: 1, bright: 1, fov: 72, scale: 1, grain: 0.35, bloom: true, fps: false, diff: 1, invertY: false, bob: 1, hints: true };
  Object.keys(DEF).forEach(function (k) { if (Settings[k] === undefined) Settings[k] = DEF[k]; });
  const pct = function (v) { return Math.round(v * 100) + '%'; };
  const sliders = [['o-vol', 'vol', 100, pct], ['o-mus', 'music', 100, pct], ['o-sfx', 'sfx', 100, pct], ['o-sens', 'sens', 100, pct], ['o-bright', 'bright', 100, pct],
    ['o-scale', 'scale', 100, pct], ['o-grain', 'grain', 100, pct], ['o-bob', 'bob', 100, pct], ['o-fov', 'fov', 1, function (v) { return v + '°'; }]];
  const checks = [['o-bloom', 'bloom'], ['o-fps', 'fps'], ['o-inv', 'invertY'], ['o-hints', 'hints']];
  function applySettings() {
    Sound.setVolume(Settings.vol); Sound.setMusicVolume(Settings.music); Sound.setSfxVolume(Settings.sfx);
    if (ready || Renderer.setOpts) { try { Renderer.setOpts({ scale: Settings.scale, bloom: Settings.bloom, grain: Settings.grain * 0.1 }); } catch (e) { } }
    $('fpsc').style.display = Settings.fps ? '' : 'none';
    document.body.classList.toggle('nohints', !Settings.hints);
  }
  function syncOptions() {
    $('o-quality').value = Settings.quality; $('o-diff').value = Settings.diff;
    sliders.forEach(function (r) { const el = $(r[0]); el.value = Settings[r[1]] * r[2]; $(r[0].replace('o-', 'v-')).textContent = r[3](Settings[r[1]]); });
    checks.forEach(function (r) { $(r[0]).checked = !!Settings[r[1]]; });
    ['o-quality', 'o-diff'].forEach(function (i) { if ($(i)._refresh) $(i)._refresh(); });
  }

  /* ---------------- menu a tendina personalizzato (stesso stile del gioco) ---------------- */
  function skinSelect(sel) {
    sel.style.display = 'none';
    const dd = document.createElement('div'); dd.className = 'dd';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'dd-btn';
    const list = document.createElement('div'); list.className = 'dd-list';
    dd.appendChild(btn); dd.appendChild(list); sel.parentNode.appendChild(dd);
    function refresh() {
      const cur = sel.options[sel.selectedIndex]; btn.textContent = cur ? cur.textContent : '';
      Array.prototype.forEach.call(list.children, function (c, i) { c.classList.toggle('sel', i === sel.selectedIndex); });
    }
    Array.prototype.forEach.call(sel.options, function (o, i) {
      const it = document.createElement('div'); it.className = 'dd-item'; it.textContent = o.textContent;
      it.onclick = function (e) { e.stopPropagation(); sel.selectedIndex = i; sel.dispatchEvent(new Event('change')); dd.classList.remove('open'); refresh(); };
      list.appendChild(it);
    });
    btn.onclick = function (e) { e.preventDefault(); e.stopPropagation(); const o = !dd.classList.contains('open'); closeDD(); if (o) dd.classList.add('open'); };
    sel._refresh = refresh; refresh();
  }
  function closeDD() { Array.prototype.forEach.call(document.querySelectorAll('.dd.open'), function (d) { d.classList.remove('open'); }); }
  document.addEventListener('click', closeDD);
  Array.prototype.forEach.call(document.querySelectorAll('#options select'), skinSelect);
  $('o-quality').onchange = function () { Settings.quality = this.value; if (ready) Renderer.setQuality(Settings.quality); saveSettings(); };
  $('o-diff').onchange = function () { Settings.diff = parseInt(this.value, 10); saveSettings(); };
  sliders.forEach(function (r) {
    $(r[0]).oninput = function () { Settings[r[1]] = this.value / r[2]; $(r[0].replace('o-', 'v-')).textContent = r[3](Settings[r[1]]); applySettings(); saveSettings(); };
  });
  checks.forEach(function (r) { $(r[0]).onchange = function () { Settings[r[1]] = this.checked; applySettings(); saveSettings(); }; });
  Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (b) {
    b.onclick = function () {
      Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (x) { x.classList.toggle('on', x === b); });
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) { t.classList.toggle('hidden', t.id !== b.dataset.tab); });
    };
  });
  $('o-reset').onclick = function () { Object.assign(Settings, DEF); syncOptions(); applySettings(); if (ready) Renderer.setQuality(Settings.quality); saveSettings(); };
  // la musica parte al primo gesto dell'utente (anche dal menu)
  function firstGesture() { Sound.init(); applySettings(); window.removeEventListener('pointerdown', firstGesture); window.removeEventListener('keydown', firstGesture); }
  window.addEventListener('pointerdown', firstGesture); window.addEventListener('keydown', firstGesture);
  const TIPS = ['Le luci spente attirano il mostro meno di quelle accese… ma nel buio non vedi.', 'Correre fa rumore. Abbassati con C per passare inosservato.', 'Nell\'armadio puoi nasconderti: premi E e trattieni il respiro.', 'Gli appunti sparsi per la casa indicano dove cercare la chiave e l\'arma.', 'Risparmia le batterie: spegni la torcia nelle stanze illuminate.', 'La chiave della cella è nascosta negli armadietti.'];
  let fpsEl = document.createElement('div'); fpsEl.id = 'fpsc'; fpsEl.style.display = 'none'; document.body.appendChild(fpsEl);
  let tipEl = document.createElement('div'); tipEl.id = 'tip'; tipEl.textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; $('boot').appendChild(tipEl);

  /* ---------------- ciclo principale ---------------- */
  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    if (!ready) return;
    if (state === 'play' && !noteOpen) { Game.update(dt); updateHud(); }
    if (state === 'play' || state === 'pause' || state === 'end') Game.render();
    else { Renderer.clearBatches(); }
    fpsT += dt; fpsN++; if (fpsT > 1) { fps = Math.round(fpsN / fpsT); fpsT = 0; fpsN = 0; fpsEl.textContent = fps + ' FPS'; }
  }

  /* ---------------- avvio: carica texture e materiali con barra ---------------- */
  function boot() {
    const bar = $('boot-bar'), msg = $('boot-msg');
    syncOptions();
    if (!Renderer.init(canvas)) { msg.textContent = 'Il tuo browser non supporta WebGL2. Prova Chrome, Edge o Firefox aggiornati.'; return; }
    Renderer.setQuality(Settings.quality);
    bar.style.width = '10%';
    setTimeout(function () {
      msg.textContent = 'Dipingo i muri…'; bar.style.width = '30%';
      setTimeout(function () {
        try { Tex.make(); Mats.make(); Models.init(); } catch (e) { msg.textContent = 'Errore: ' + e.message; console.error(e); return; }
        bar.style.width = '100%'; msg.textContent = 'Pronto.';
        ready = true; applySettings();
        setTimeout(function () { if (q.has('play')) startGame(); else { state = 'menu'; show('menu'); } }, 250);
      }, 60);
    }, 60);
  }
  window.HORROR = { Game: Game, Renderer: Renderer, World: World, Input: Input, state: function () { return state; }, fps: function () { return fps; }, startGame: startGame };
  requestAnimationFrame(loop);
  boot();
})();
