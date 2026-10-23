'use strict';
/* SHADOWLINE - audio sintetizzato con WebAudio (nessun file esterno) */
const Sound = (function () {
  let ctx = null, master = null, sfx = null, musBus = null, noiseBuf = null, vol = 0.7, sfxVol = 0.8, musVol = 0.6, ambGain = null, musStarted = false, mus = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended' && ctx.resume) ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = vol;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
      sfx = ctx.createGain(); sfx.gain.value = sfxVol; sfx.connect(master);
      musBus = ctx.createGain(); musBus.gain.value = musVol; musBus.connect(master);
      const len = ctx.sampleRate * 2;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      startAmbient();
      startMusic();
    } catch (e) { ctx = null; }
  }

  function setVolume(v) { vol = v; if (master) master.gain.value = v; }
  function setSfxVolume(v) { sfxVol = v; if (sfx) sfx.gain.value = v; }
  function setMusicVolume(v) { musVol = v; if (musBus) musBus.gain.value = v; }

  function out(pan) {
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      p.connect(sfx);
      return p;
    }
    return sfx;
  }

  function noise(dur, o) {
    if (!ctx) return;
    o = o || {};
    const t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f || 2000, t);
    if (o.fEnd) f.frequency.exponentialRampToValueAtTime(o.fEnd, t + dur);
    f.Q.value = o.q || 0.7;
    const g = ctx.createGain();
    const v = (o.gain === undefined ? 0.5 : o.gain) * (o.v === undefined ? 1 : o.v);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(v, 0.0002), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out(o.pan));
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  function tone(freq, dur, o) {
    if (!ctx) return;
    o = o || {};
    const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    const g = ctx.createGain();
    const v = (o.gain === undefined ? 0.3 : o.gain) * (o.v === undefined ? 1 : o.v);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(v, 0.0002), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(out(o.pan));
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  function startAmbient() {
    ambGain = ctx.createGain();
    ambGain.gain.value = 0.045;
    ambGain.connect(sfx);
    [55, 55.6, 82.4].forEach(function (f, i) {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.25 : 0.5;
      o.connect(g); g.connect(ambGain); o.start();
    });
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 260;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    src.connect(f); f.connect(g); g.connect(ambGain); src.start();
  }

  function setTension(v) { if (ambGain) ambGain.gain.value = 0.045 + v * 0.06; }

  function shot(kind, pan, v) {
    v = v === undefined ? 1 : v; pan = pan || 0;
    if (kind === 'pistol') {
      noise(0.09, { f: 5000, fEnd: 600, gain: 0.45, pan: pan, v: v });
      tone(160, 0.09, { slide: 55, gain: 0.5, pan: pan, v: v });
      noise(0.4, { f: 700, fEnd: 150, gain: 0.1, pan: pan, v: v });
    } else if (kind === 'rifle') {
      noise(0.13, { f: 5500, fEnd: 400, gain: 0.6, pan: pan, v: v });
      tone(120, 0.12, { slide: 45, gain: 0.6, pan: pan, v: v });
      noise(0.5, { f: 800, fEnd: 150, gain: 0.14, pan: pan, v: v });
    } else {
      noise(0.22, { f: 4000, fEnd: 250, gain: 0.85, pan: pan, v: v });
      tone(80, 0.25, { slide: 35, gain: 0.8, pan: pan, v: v });
      noise(0.7, { f: 600, fEnd: 100, gain: 0.18, pan: pan, v: v });
    }
  }
  function enemyShot(pan, v) {
    noise(0.1, { f: 4200, fEnd: 500, gain: 0.5, pan: pan, v: v });
    tone(130, 0.1, { slide: 50, gain: 0.45, pan: pan, v: v });
    noise(0.45, { f: 650, fEnd: 130, gain: 0.1, pan: pan, v: v });
  }
  function reload() {
    noise(0.05, { f: 2500, type: 'highpass', gain: 0.25 });
    tone(900, 0.05, { type: 'square', gain: 0.07 });
    noise(0.06, { f: 1800, type: 'bandpass', gain: 0.3, delay: 0.55 });
    tone(500, 0.07, { type: 'square', gain: 0.08, delay: 0.55 });
    noise(0.05, { f: 3000, type: 'highpass', gain: 0.3, delay: 1.0 });
  }
  function empty() { tone(1400, 0.03, { type: 'square', gain: 0.1 }); noise(0.03, { f: 3000, type: 'highpass', gain: 0.2 }); }
  function hurt() { tone(90, 0.25, { slide: 40, gain: 0.7 }); noise(0.18, { f: 700, gain: 0.35 }); }
  function pickup() { tone(660, 0.08, { type: 'triangle', gain: 0.25 }); tone(990, 0.12, { type: 'triangle', gain: 0.25, delay: 0.08 }); }
  function door() { noise(0.6, { f: 400, fEnd: 120, gain: 0.35 }); tone(70, 0.5, { type: 'sawtooth', gain: 0.12, slide: 50 }); }
  function beep(ok) { tone(ok ? 1200 : 400, 0.08, { type: 'square', gain: 0.12 }); }
  function deny() { tone(220, 0.15, { type: 'square', gain: 0.15 }); tone(180, 0.2, { type: 'square', gain: 0.15, delay: 0.15 }); }
  function step(sprint) { noise(0.06, { f: 380, gain: sprint ? 0.2 : 0.11 }); }
  function hit(head) { tone(head ? 1800 : 1100, 0.05, { type: 'square', gain: 0.12 }); }
  function death(pan, v) { noise(0.35, { f: 500, fEnd: 90, gain: 0.5, pan: pan, v: v }); tone(110, 0.4, { slide: 40, gain: 0.5, pan: pan, v: v }); }
  function explosion() {
    noise(1.2, { f: 900, fEnd: 60, gain: 1.0 });
    tone(55, 0.9, { slide: 25, gain: 1.0 });
    noise(1.8, { f: 300, fEnd: 50, gain: 0.5, delay: 0.1 });
  }
  function heartbeat() { tone(52, 0.14, { gain: 0.5 }); tone(46, 0.16, { gain: 0.4, delay: 0.22 }); }
  function alarm() { for (let i = 0; i < 3; i++) tone(760, 0.18, { type: 'square', gain: 0.1, slide: 520, delay: i * 0.3 }); }
  function click() { tone(800, 0.03, { type: 'square', gain: 0.07 }); }
  function win() { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.3, { type: 'triangle', gain: 0.25, delay: i * 0.14 }); }); }
  function lose() { [330, 262, 196, 147].forEach(function (f, i) { tone(f, 0.45, { type: 'sawtooth', gain: 0.18, delay: i * 0.25 }); }); }


  function creak(pan, v) { noise(0.7, { f: 700, fEnd: 260, type: 'bandpass', q: 9, gain: 0.3, pan: pan, v: v }); tone(180, 0.6, { type: 'sawtooth', slide: 120, gain: 0.05, pan: pan, v: v }); }
  function growl(pan, v) { tone(70, 1.0, { type: 'sawtooth', slide: 38, gain: 0.35, pan: pan, v: v }); noise(1.0, { f: 500, fEnd: 120, type: 'bandpass', q: 3, gain: 0.35, pan: pan, v: v }); tone(95, 0.9, { type: 'square', slide: 50, gain: 0.08, pan: pan, v: v, delay: 0.1 }); }
  function scare() { noise(0.9, { f: 3000, fEnd: 400, gain: 0.9 }); tone(900, 0.7, { type: 'sawtooth', slide: 300, gain: 0.5 }); tone(1230, 0.7, { type: 'sawtooth', slide: 420, gain: 0.4 }); tone(60, 0.9, { type: 'sine', gain: 0.9 }); }
  function thump(pan, v) { tone(60, 0.18, { slide: 30, gain: 0.8, pan: pan, v: v }); noise(0.12, { f: 300, gain: 0.5, pan: pan, v: v }); }
  function monsterStep(pan, v) { tone(48, 0.14, { slide: 30, gain: 0.7, pan: pan, v: v }); noise(0.09, { f: 220, gain: 0.5, pan: pan, v: v }); }
  function torchClick() { noise(0.03, { f: 3200, type: 'highpass', gain: 0.35 }); tone(300, 0.04, { type: 'square', gain: 0.08 }); }
  function switchClick() { noise(0.04, { f: 2200, type: 'highpass', gain: 0.5 }); tone(180, 0.07, { type: 'square', gain: 0.1 }); }
  function bulbPop() { noise(0.12, { f: 6000, type: 'highpass', gain: 0.5 }); tone(1500, 0.05, { type: 'square', gain: 0.1 }); }
  function buzz(v) { tone(100, 0.2, { type: 'sawtooth', gain: 0.05, v: v === undefined ? 1 : v }); noise(0.2, { f: 4000, type: 'highpass', gain: 0.05, v: v === undefined ? 1 : v }); }
  function whisper(pan) { noise(1.4, { f: 2600, fEnd: 1800, type: 'bandpass', q: 6, gain: 0.12, pan: pan }); noise(1.1, { f: 3400, fEnd: 2400, type: 'bandpass', q: 8, gain: 0.07, pan: pan, delay: 0.3 }); }
  function distantBang(pan) { noise(0.5, { f: 260, fEnd: 70, gain: 0.7, pan: pan, v: 0.7 }); tone(55, 0.4, { slide: 30, gain: 0.5, pan: pan, v: 0.7 }); }
  function keyJingle() { [1500, 1900, 1700].forEach(function (f, i) { tone(f, 0.25, { type: 'triangle', gain: 0.18, delay: i * 0.07 }); }); }

  /* ------------------------------------------------------------ musica horror procedurale ------------------------------------------------------------ */
  function startMusic() {
    if (!ctx || musStarted) return;
    musStarted = true;
    const m = mus = { tension: 0, chase: 0, tT: 0, cT: 0 };
    // eco
    const echo = ctx.createDelay(2.0); echo.delayTime.value = 0.62;
    const fb = ctx.createGain(); fb.gain.value = 0.5;
    const wetF = ctx.createBiquadFilter(); wetF.type = 'lowpass'; wetF.frequency.value = 1800;
    echo.connect(wetF); wetF.connect(fb); fb.connect(echo); wetF.connect(musBus);
    m.echo = echo;
    // pad scuro: saw detunati dissonanti (La, Si bemolle, Mi bemolle = tritono)
    const padG = ctx.createGain(); padG.gain.value = 0.0; padG.connect(musBus);
    const padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 180; padF.Q.value = 2.5; padF.connect(padG);
    [55, 58.3, 77.8, 110.4, 116.2].forEach(function (f, i) {
      const o = ctx.createOscillator(); o.type = i < 3 ? 'sawtooth' : 'triangle'; o.frequency.value = f; o.detune.value = (i - 2) * 6;
      const g = ctx.createGain(); g.gain.value = i < 3 ? 0.22 : 0.08; o.connect(g); g.connect(padF); o.start();
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06; const lg = ctx.createGain(); lg.gain.value = 90; lfo.connect(lg); lg.connect(padF.frequency); lfo.start();
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.11; const lg2 = ctx.createGain(); lg2.gain.value = 0.05; lfo2.connect(lg2); lg2.connect(padG.gain); lfo2.start();
    padG.gain.value = 0.12;
    m.padG = padG; m.padF = padF;
    // stridio acuto quasi impercettibile (seconda minore)
    const hi = ctx.createGain(); hi.gain.value = 0.0; hi.connect(musBus); hi.connect(echo);
    [1760, 1864.7].forEach(function (f) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const v = ctx.createOscillator(); v.frequency.value = 5.2; const vg = ctx.createGain(); vg.gain.value = 9; v.connect(vg); vg.connect(o.frequency); v.start();
      const g = ctx.createGain(); g.gain.value = 0.5; o.connect(g); g.connect(hi); o.start();
    });
    m.hi = hi;
    // strato di inseguimento: basso pulsante + cluster
    const chG = ctx.createGain(); chG.gain.value = 0; chG.connect(musBus);
    const chF = ctx.createBiquadFilter(); chF.type = 'lowpass'; chF.frequency.value = 400; chF.connect(chG);
    [55, 58.3, 82.4].forEach(function (f) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(chF); o.start(); });
    const pl = ctx.createOscillator(); pl.type = 'square'; pl.frequency.value = 2.6; const plg = ctx.createGain(); plg.gain.value = 0.5; pl.connect(plg); plg.connect(chG.gain); pl.start();
    m.chG = chG;
    // scheduler: carillon stonato, swell inversi, tonfi lontani
    function box() {
      const scale = [0, 3, 7, 10, 12, 15, 1], base = 220 * Math.pow(2, (Math.random() < 0.5 ? 0 : -5) / 12);
      const n = 3 + Math.floor(Math.random() * 5); let t = ctx.currentTime + 0.1, k = Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        k = Math.max(0, Math.min(scale.length - 1, k + Math.floor(Math.random() * 3) - 1));
        const f = base * Math.pow(2, scale[k] / 12) * (1 + (Math.random() - 0.5) * 0.012);
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.01;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        o.connect(g); o2.connect(g); g.connect(musBus); g.connect(echo); o.start(t); o2.start(t); o.stop(t + 1.7); o2.stop(t + 1.7);
        t += 0.42 + Math.random() * 0.5 + (i === n - 2 ? 0.4 : 0);
      }
    }
    function swell() {
      const t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2600, t + 4);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 3.8); g.gain.linearRampToValueAtTime(0.0001, t + 4.3);
      src.connect(f); f.connect(g); g.connect(musBus); g.connect(echo); src.start(t, 0, 4.4);
    }
    function boom() { const t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(48, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.8); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 2); o.connect(g); g.connect(musBus); o.start(t); o.stop(t + 2.1); }
    m.timer = setInterval(function () {
      if (!ctx || ctx.state !== 'running') return;
      m.tT -= 0.5; m.cT -= 0.5;
      if (m.tT <= 0) { m.tT = 9 + Math.random() * 14 - m.tension * 6; if (Math.random() < 0.6) box(); else if (Math.random() < 0.6) swell(); else boom(); }
      const ct = ctx.currentTime;
      m.padG.gain.setTargetAtTime(0.1 + m.tension * 0.16, ct, 1.5);
      m.padF.Q.setTargetAtTime(2.5 + m.tension * 5, ct, 1);
      m.hi.gain.setTargetAtTime(0.004 + m.tension * 0.03, ct, 1.2);
      m.chG.gain.setTargetAtTime(m.chase ? 0.22 : 0.0, ct, 0.4);
    }, 500);
  }
  function setMusic(tension, chase) { if (mus) { mus.tension = Math.max(0, Math.min(1, tension)); mus.chase = chase ? 1 : 0; } }

  function chalk() { noise(0.12, { f: 6000, type: 'highpass', gain: 0.1 }); }
  function drone(level) { if (ambGain) ambGain.gain.value = 0.05 + (level || 0) * 0.08; }
  return {
    creak: creak, growl: growl, scare: scare, thump: thump, monsterStep: monsterStep, torchClick: torchClick, switchClick: switchClick, bulbPop: bulbPop, buzz: buzz, whisper: whisper, distantBang: distantBang, keyJingle: keyJingle, startMusic: startMusic, setMusic: setMusic, setSfxVolume: setSfxVolume, setMusicVolume: setMusicVolume, chalk: chalk, drone: drone,
    init: init, setVolume: setVolume, shot: shot, enemyShot: enemyShot, reload: reload, empty: empty, hurt: hurt,
    pickup: pickup, door: door, beep: beep, deny: deny, step: step, hit: hit, death: death, explosion: explosion,
    heartbeat: heartbeat, alarm: alarm, click: click, win: win, lose: lose, setTension: setTension
  };
})();
