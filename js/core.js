'use strict';
/* =========================================================
   NEON ARCADE — CORE
   Shared services every game uses: saving, score, tickets,
   trophies, high scores, sound, effects, the game loop,
   the daily challenge and the screen router.
   Games talk to the arcade only through the `Arcade` object.
========================================================= */
const Arcade = (() => {
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'neonArcade.save.v1';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COLORS = {
    blue: '#4a8dff', red: '#ff4d3d', yellow: '#ffc93c', green: '#3ddc84',
    pink: '#ff5fa8', orange: '#ff8a3d', violet: '#a77bff', cyan: '#3de0ff',
    lime: '#c6ff4a', text: '#f4eedc', dim: '#a99fc6', ink: '#100c1c'
  };
  const PARTY = [COLORS.yellow, COLORS.pink, COLORS.cyan, COLORS.lime, COLORS.orange, COLORS.violet];

  /* ---------------- Utilities ---------------- */
  const fmt = n => Math.floor(n).toLocaleString('en-US');
  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  /* Collect every [data-el="name"] inside root into { name: element } */
  function els(root){
    const out = {};
    root.querySelectorAll('[data-el]').forEach(el => { out[el.dataset.el] = el; });
    return out;
  }

  /* ---------------- Save data (localStorage) ---------------- */
  function freshData(){
    return {
      version: 1,
      score: 0, tickets: 0, ticketsEarned: 0,
      unlocked: [], stats: {}, difficulty: {}, modes: {},
      highScores: {}, initials: 'AAA',
      owned: ['carpet-classic', 'trim-standard'],
      equipped: { carpet: 'carpet-classic', trim: 'trim-standard', lights: null, title: null },
      sound: true,
      daily: { date: null, done: false, count: 0 },
      games: {}
    };
  }
  function load(){
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return freshData();
      const saved = JSON.parse(raw);
      const base = freshData();
      return Object.assign(base, saved, {
        equipped: Object.assign(base.equipped, saved.equipped || {}),
        daily: Object.assign(base.daily, saved.daily || {})
      });
    } catch (e) {
      return freshData(); // storage blocked or corrupted: play without saving
    }
  }
  const data = load();
  let saveTimer = null;
  let resetting = false;
  function writeNow(){
    if (resetting) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  }
  /* Throttled: many calls in a burst produce one write */
  function save(immediate){
    if (immediate) { clearTimeout(saveTimer); saveTimer = null; writeNow(); return; }
    if (!saveTimer) saveTimer = setTimeout(() => { saveTimer = null; writeNow(); }, 400);
  }
  function resetAll(){
    resetting = true;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
  }
  window.addEventListener('pagehide', () => save(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });

  /* ---------------- Events ---------------- */
  const listeners = {};
  const on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); };
  const emit = (evt, payload) => { (listeners[evt] || []).forEach(fn => fn(payload)); };

  /* ---------------- Stats ---------------- */
  function stat(key, inc = 1){ data.stats[key] = (data.stats[key] || 0) + inc; save(); return data.stats[key]; }
  function statMax(key, v){ if (v > (data.stats[key] || 0)) { data.stats[key] = v; save(); } return data.stats[key] || 0; }
  const getStat = key => data.stats[key] || 0;

  /* ---------------- Score, rank, tickets ---------------- */
  const RANKS = [
    { min: 0, name: 'Rookie' }, { min: 100, name: 'Player' }, { min: 300, name: 'Contender' },
    { min: 700, name: 'Ace' }, { min: 1500, name: 'Legend' }, { min: 3000, name: 'Arcade God' }
  ];
  function rankName(){
    let rank = RANKS[0].name;
    for (const r of RANKS) if (data.score >= r.min) rank = r.name;
    return rank;
  }
  /* ---------------- Gauntlet flag ----------------
     While a Gauntlet run is active, the games inside it play on Normal,
     and their own score / tickets / high scores are switched off:
     the Gauntlet pays out once at the end. */
  let gauntlet = null;
  const setGauntlet = run => { gauntlet = run; document.body.classList.toggle('gauntlet-active', !!run); };
  const inGauntlet = () => !!gauntlet;
  /* games call this when a run ends by itself (crash, time up, word solved...) */
  const roundOver = id => { if (gauntlet) emit('roundOver', id); };

  function addScore(n){
    if (gauntlet) return;
    n = Math.round(n);
    if (n <= 0) return;
    data.score += n;
    emit('hud');
    if (data.score >= 500) unlock('score_500');
    if (data.score >= 3000) unlock('score_3000');
    save();
  }
  function payout(n){
    if (gauntlet) return 0;
    n = Math.max(0, Math.floor(n));
    if (!n) return 0;
    data.tickets += n;
    data.ticketsEarned += n;
    emit('hud');
    emit('tickets', n);
    sfx('coin');
    if (data.ticketsEarned >= 500) unlock('tickets_500');
    save();
    return n;
  }
  function spend(n){
    if (data.tickets < n) return false;
    data.tickets -= n;
    emit('hud');
    save();
    return true;
  }

  /* ---------------- Trophies ---------------- */
  const ACH = [];
  function achievements(list){ ACH.push(...list); }
  function unlock(id){
    if (data.unlocked.includes(id)) return;
    const a = ACH.find(x => x.id === id);
    if (!a) return;
    data.unlocked.push(id);
    toast(`🏆 Trophy unlocked: ${a.name}`);
    sfx('unlock');
    emit('hud');
    emit('trophies');
    save();
  }
  achievements([
    { id: 'first_win', game: 'arcade', icon: '🥇', name: 'First Blood', desc: 'Win any game for the first time.' },
    { id: 'score_500', game: 'arcade', icon: '🏆', name: 'High Roller', desc: 'Reach a total score of 500.' },
    { id: 'score_3000', game: 'arcade', icon: '👑', name: 'Arcade Royalty', desc: 'Reach a total score of 3,000.' },
    { id: 'tickets_500', game: 'arcade', icon: '🎟️', name: 'Ticket Hoarder', desc: 'Earn 500 tickets in total.' },
    { id: 'prize_first', game: 'arcade', icon: '🎁', name: 'Shopper', desc: 'Buy something at the prize counter.' },
    { id: 'daily_1', game: 'arcade', icon: '📅', name: 'Daily Player', desc: 'Complete a daily challenge.' },
    { id: 'daily_5', game: 'arcade', icon: '🗓️', name: 'Regular', desc: 'Complete 5 daily challenges.' }
  ]);

  /* ---------------- Toasts (queued so none get lost) ---------------- */
  const toastQueue = [];
  let toastBusy = false;
  function toast(msg){
    toastQueue.push(msg);
    if (!toastBusy) nextToast();
  }
  function nextToast(){
    const el = $('toast');
    const msg = toastQueue.shift();
    if (!msg) { toastBusy = false; return; }
    toastBusy = true;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(nextToast, 380);
    }, 2400);
  }

  /* ---------------- Sound (synthesised, no audio files) ---------------- */
  // Each preset is a list of notes: [frequency, seconds, waveform, slideTo?]
  const SOUNDS = {
    click:  [[660, .04, 'square']],
    flip:   [[520, .05, 'triangle', 780]],
    match:  [[660, .07, 'square'], [880, .1, 'square']],
    win:    [[523, .08, 'square'], [659, .08, 'square'], [784, .08, 'square'], [1047, .2, 'square']],
    lose:   [[392, .12, 'sawtooth'], [311, .12, 'sawtooth'], [233, .26, 'sawtooth']],
    hit:    [[320, .07, 'square', 140]],
    gold:   [[880, .05, 'square'], [1320, .05, 'square'], [1760, .1, 'square']],
    miss:   [[180, .1, 'sawtooth', 90]],
    boom:   [[120, .25, 'sawtooth', 40]],
    coin:   [[988, .05, 'square'], [1319, .12, 'square']],
    jump:   [[300, .12, 'square', 720]],
    eat:    [[440, .06, 'square', 880]],
    bounce: [[440, .03, 'square']],
    brick:  [[740, .04, 'square']],
    key:    [[1200, .012, 'square']],
    error:  [[150, .09, 'square']],
    power:  [[400, .07, 'triangle', 800], [800, .12, 'triangle', 1600]],
    over:   [[440, .16, 'triangle', 220], [220, .32, 'triangle', 110]],
    unlock: [[784, .08, 'square'], [988, .08, 'square'], [1319, .22, 'square']],
    tick:   [[880, .025, 'square']],
    start:  [[440, .06, 'square'], [660, .06, 'square'], [880, .12, 'square']]
  };
  let audioCtx = null;
  const lastPlayed = {};
  function sfx(name, volume = 0.07){
    if (!data.sound) return;
    const notes = SOUNDS[name];
    if (!notes) return;
    const now = performance.now();
    if (lastPlayed[name] && now - lastPlayed[name] < 30) return; // avoid stacking the same sound
    lastPlayed[name] = now;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      let t = audioCtx.currentTime;
      for (const [freq, dur, type, slide] of notes) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
        t += dur;
      }
    } catch (e) { /* audio unavailable */ }
  }
  function setSound(onOff){ data.sound = onOff; save(); emit('hud'); if (onOff) sfx('click'); }

  /* ---------------- Visual effects ---------------- */
  const fx = (() => {
    const canvas = $('fxCanvas');
    const ctx = canvas.getContext('2d');
    let parts = [];
    let raf = null;
    function resize(){
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);
    function frame(){
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts = parts.filter(p => p.life > 0);
      for (const p of parts) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.life -= 1; p.spin += p.vs;
        ctx.globalAlpha = Math.min(1, p.life / 25);
        ctx.fillStyle = p.c;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * (p.flat ? 0.5 : 1));
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      raf = parts.length ? requestAnimationFrame(frame) : null;
    }
    function burst(x, y, opts = {}){
      if (reducedMotion) return;
      const colors = opts.colors || PARTY;
      const n = opts.count || 22;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (opts.speed || 5) * (0.35 + Math.random());
        parts.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.lift ?? 2),
          g: opts.gravity ?? 0.18, life: 35 + Math.random() * 30,
          s: (opts.size || 5) * (0.6 + Math.random() * 0.8), c: colors[i % colors.length],
          spin: Math.random() * 6, vs: (Math.random() - 0.5) * 0.3, flat: !!opts.flat
        });
      }
      if (!raf) raf = requestAnimationFrame(frame);
    }
    function burstAt(el, opts){
      const r = el.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, opts);
    }
    function confetti(){
      for (let i = 0; i < 7; i++) {
        burst(innerWidth * (0.08 + 0.14 * i), -10, { count: 18, speed: 4, lift: -3, gravity: 0.1, size: 8, flat: true });
      }
    }
    function restartClass(el, cls){ el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
    const shake = el => { if (!reducedMotion) restartClass(el, 'shake'); };
    const bump = el => restartClass(el, 'bump');
    function floatText(host, text, x, y, color){
      const s = document.createElement('span');
      s.className = 'float-text';
      s.textContent = text;
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      if (color) s.style.color = color;
      host.appendChild(s);
      const kill = () => s.remove();
      s.addEventListener('animationend', kill);
      setTimeout(kill, 1200);
    }
    return { burst, burstAt, confetti, shake, bump, floatText };
  })();

  /* ---------------- Game loop + canvas helpers ---------------- */
  /* step(dt) runs every frame with dt in seconds (capped so a lag spike can't teleport things) */
  function createLoop(step, render){
    let raf = null, last = 0, running = false;
    function frame(t){
      if (!running) return;
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      step(dt);
      render();
      raf = requestAnimationFrame(frame);
    }
    return {
      start(){ if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
      stop(){ running = false; cancelAnimationFrame(raf); },
      get running(){ return running; }
    };
  }
  /* Canvas drawn at a fixed logical size (w×h) and scaled sharply for the screen */
  function setupCanvas(canvas, w, h){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.aspectRatio = `${w} / ${h}`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  function canvasPoint(canvas, w, h, clientX, clientY){
    const r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width * w, y: (clientY - r.top) / r.height * h };
  }

  /* ---------------- Seeded randomness (for the daily challenge) ---------------- */
  function hashStr(s){
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  function seeded(str){
    let a = hashStr(str);
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function todayKey(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /* ---------------- Games registry ---------------- */
  const games = [];
  const gameById = {};
  function registerGame(def){ games.push(def); gameById[def.id] = def; }
  const difficulty = id => (gauntlet ? 'normal' : data.difficulty[id] || 'normal');
  function setDifficulty(id, d){ data.difficulty[id] = d; save(); emit('difficulty', id); }

  /* ---------------- Daily challenge ---------------- */
  const DAILY = [
    { game: 'ttt',      text: 'Beat the CPU on Hard',                         check: r => r.win && r.difficulty === 'hard' && r.mode === 'cpu', difficulty: 'hard' },
    { game: 'rps',      text: 'Win 3 rounds in a row',                        check: r => r.streak >= 3 },
    { game: 'memory',   text: "Clear today's board in 16 moves or fewer",     check: r => r.win && r.moves <= 16, difficulty: 'normal' },
    { game: 'whack',    text: 'Score 25 or more in one round',                check: r => r.score >= 25 },
    { game: 'hangman',  text: "Guess today's mystery word",                   check: r => r.win && r.dailyWord },
    { game: 'typing',   text: "Type today's passage at 40+ WPM, 90% accuracy", check: r => r.wpm >= 40 && r.accuracy >= 90 },
    { game: 'snake',    text: 'Grow the snake to length 15',                  check: r => r.length >= 15 },
    { game: 'runner',   text: 'Run 800 metres in one go',                     check: r => r.distance >= 800 },
    { game: 'breakout', text: 'Clear the first wall',                         check: r => r.levelCleared >= 1 }
  ];
  const DAILY_REWARD = 50;
  let dailyActive = null; // id of the game currently being played as the daily challenge

  function dailyToday(){
    const key = todayKey();
    if (data.daily.date !== key) { data.daily.date = key; data.daily.done = false; save(); }
    const pool = DAILY.filter(d => gameById[d.game]);
    const challenge = pool[hashStr('daily:' + key) % pool.length];
    return { ...challenge, done: data.daily.done, reward: DAILY_REWARD };
  }
  function startDaily(){
    const ch = dailyToday();
    dailyActive = ch.game;
    play(ch.game, { daily: true, difficulty: ch.difficulty });
  }
  const isDaily = id => dailyActive === id;
  /* Games use this instead of Math.random for anything that should be the same for everyone today */
  const rngFor = id => (dailyActive === id ? seeded(todayKey() + ':' + id) : Math.random);

  on('result', r => {
    if (!r || gauntlet || dailyActive !== r.game) return;
    const ch = dailyToday();
    if (ch.done || ch.game !== r.game || !ch.check(r)) return;
    data.daily.done = true;
    data.daily.count++;
    save();
    toast(`📅 Daily challenge complete! +${DAILY_REWARD} tickets`);
    payout(DAILY_REWARD);
    fx.confetti();
    unlock('daily_1');
    if (data.daily.count >= 5) unlock('daily_5');
    emit('daily');
  });

  /* ---------------- High scores ---------------- */
  const hiTable = id => data.highScores[id] || [];
  const best = id => hiTable(id)[0] || null;
  function fmtHi(id, v){
    const h = gameById[id] && gameById[id].hiscore;
    return h && h.format ? h.format(v) : fmt(v);
  }
  function qualifies(id, value){
    if (!gameById[id] || !gameById[id].hiscore || !(value > 0)) return false;
    const t = hiTable(id);
    return t.length < 5 || value > t[t.length - 1].value;
  }
  let initialsCallback = null;
  /* Resolves once the player has entered initials (or straight away if the score doesn't make the table) */
  /* the last 30 finished runs per game, for the chart on the stats page */
  function recordHistory(id, value){
    if (!(value >= 0)) return;
    data.history = data.history || {};
    const h = data.history[id] = data.history[id] || [];
    h.push({ v: value, d: todayKey() });
    if (h.length > 30) h.splice(0, h.length - 30);
    save();
  }
  function submitScore(id, value){
    return new Promise(resolve => {
      if (gauntlet && id !== 'gauntlet') { resolve(false); return; }
      recordHistory(id, value);
      if (!qualifies(id, value)) { resolve(false); return; }
      const rankPos = hiTable(id).filter(e => e.value >= value).length + 1;
      $('initialsGame').textContent = `${gameById[id].name} · #${rankPos}`;
      $('initialsScore').textContent = `${fmtHi(id, value)} ${gameById[id].hiscore.unit || ''}`.trim();
      const input = $('initialsInput');
      input.value = data.initials;
      initialsCallback = name => {
        const t = hiTable(id).slice();
        const entry = { name, value, date: todayKey() };
        t.push(entry);
        t.sort((a, b) => b.value - a.value);
        data.highScores[id] = t.slice(0, 5);
        data.initials = name;
        save();
        emit('hiscore', id);
        resolve(entry);
      };
      setTimeout(() => { openModal('initialsModal'); input.select(); sfx('unlock'); }, 500);
    });
  }
  function commitInitials(){
    const raw = $('initialsInput').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const name = (raw || data.initials || 'AAA').slice(0, 3).padEnd(3, '-');
    const cb = initialsCallback;
    initialsCallback = null;
    closeModal();
    if (cb) cb(name);
  }

  /* ---------------- Modals ---------------- */
  let openModalId = null;
  let lastFocus = null;
  function openModal(id){
    if (openModalId) closeModal(true);
    lastFocus = document.activeElement;
    $(id).hidden = false;
    openModalId = id;
    const target = $(id).querySelector('[data-autofocus]') || $(id).querySelector('input, button');
    if (target) target.focus();
    emit('modal', id);
  }
  function closeModal(silent){
    if (!openModalId) return;
    $(openModalId).hidden = true;
    openModalId = null;
    if (!silent && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  const modalOpen = () => openModalId;

  /* ---------------- Screens ---------------- */
  let current = 'floor';
  let screenSince = performance.now();
  /* add the time spent on the current game screen to its "time played" stat */
  function logTime(){
    if (current !== 'floor' && !document.hidden) {
      const secs = (performance.now() - screenSince) / 1000;
      if (secs > 0.5 && secs < 6 * 3600) stat('time_' + current, Math.round(secs));
    }
    screenSince = performance.now();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) logTime(); else screenSince = performance.now(); });
  window.addEventListener('pagehide', logTime);

  function show(id){
    const prev = current;
    logTime();
    if (prev !== 'floor' && prev !== id) {
      if (gameById[prev].stop) gameById[prev].stop();
      if (dailyActive === prev) dailyActive = null;
    }
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $(id === 'floor' ? 'floorScreen' : 'screen-' + id).classList.add('active');
    current = id;
    window.scrollTo(0, 0);
    emit('screen', id);
  }
  /* opts.daily → play as today's challenge; opts.difficulty → force a difficulty */
  function play(id, opts = {}){
    if (!opts.daily && dailyActive === id) dailyActive = null;
    if (opts.difficulty) setDifficulty(id, opts.difficulty);
    show(id);
    stat('plays_' + id);
    emit('play', id);
    const g = gameById[id];
    if (g.start) g.start(opts);
  }

  /* ---------------- Keyboard routing ---------------- */
  document.addEventListener('keydown', e => {
    if (openModalId) {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (openModalId === 'initialsModal') commitInitials(); else closeModal();
      }
      return;
    }
    if (e.key === 'Escape') {
      if (current !== 'floor') { e.preventDefault(); show('floor'); }
      return;
    }
    if (current === 'floor') { emit('floorKey', e); return; }
    if (gauntlet && gauntlet.lock) return; // countdown on screen: ignore game keys
    const g = gameById[current];
    if (g.onKey) g.onKey(e);
  });
  document.addEventListener('keyup', e => {
    if (openModalId || current === 'floor') return;
    const g = gameById[current];
    if (g.onKeyUp) g.onKeyUp(e);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || current === 'floor') return;
    if (gauntlet) { emit('gauntletHidden'); return; } // leaving the tab ends the Gauntlet round
    if (gameById[current].pause) gameById[current].pause();
  });

  return {
    data, save, resetAll, on, emit, $, els, fmt, capitalize, clamp, COLORS, PARTY, reducedMotion,
    stat, statMax, getStat, RANKS, rankName, addScore, payout, spend,
    achievements, get ACH(){ return ACH; }, unlock, toast,
    sfx, setSound, fx, createLoop, setupCanvas, canvasPoint,
    seeded, todayKey, rngFor, isDaily, dailyToday, startDaily,
    registerGame, games, gameById, difficulty, setDifficulty,
    setGauntlet, inGauntlet, roundOver,
    hiTable, best, fmtHi, submitScore, commitInitials,
    openModal, closeModal, modalOpen,
    show, play, get current(){ return current; }
  };
})();
