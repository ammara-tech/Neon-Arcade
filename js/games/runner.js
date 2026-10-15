'use strict';
/* =========================================================
   NEON RUNNER — endless runner. Jump blocks, don't jump into
   drones, grab coins. The city skyline behind scrolls with
   CSS @keyframes; the track and everything on it is canvas.
   Hold jump for a higher leap. Easy allows a double jump.
========================================================= */
(() => {
  const A = Arcade;
  const W = 640, H = 240, GROUND = 206;
  const GRAVITY = 2400, JUMP = 780, JUMP_CUT = 0.45;
  const LEVELS = {
    easy:   { speed: 270, accel: 6,  max: 560, airJumps: 1, drones: 0 },
    normal: { speed: 300, accel: 9,  max: 650, airJumps: 0, drones: 0.18 },
    hard:   { speed: 340, accel: 12, max: 740, airJumps: 0, drones: 0.3 }
  };
  const C = A.COLORS;
  let g = {}, e, ctx, loop;

  A.achievements([
    { id: 'runner_500', game: 'runner', icon: '🏃', name: 'Sprinter', desc: 'Run 500 metres in one go.' },
    { id: 'runner_2000', game: 'runner', icon: '🏅', name: 'Marathon', desc: 'Run 2,000 metres in one go.' },
    { id: 'runner_coins', game: 'runner', icon: '🪙', name: 'Coin Collector', desc: 'Grab 25 coins in one run.' }
  ]);

  const lv = () => LEVELS[A.difficulty('runner')];
  const rand = (a, b) => a + Math.random() * (b - a);

  function reset(){
    if (loop) loop.stop();
    const L = lv();
    g = {
      state: 'ready', t: 0, speed: L.speed, dist: 0, coins: 0, gap: 500, scroll: 0,
      p: { x: 74, y: GROUND - 36, w: 28, h: 36, vy: 0, onGround: true, airJumps: L.airJumps, coyote: 0 },
      held: false, buffer: 0, obstacles: [], coinList: [], floats: [], flash: 0
    };
    e.diff.textContent = A.capitalize(A.difficulty('runner'));
    updateMeta();
    setBg(false);
    overlay('Neon Runner', `Space, ↑ or tap to jump. Hold for a higher jump.<br>Jump over blocks${L.drones ? ', but don\'t jump into drones' : ''}.${L.airJumps ? ' Easy lets you double jump.' : ''}`, 'Run');
    render();
  }

  function overlay(title, html, btn){
    e.overlay.hidden = false;
    e.oTitle.textContent = title;
    e.oText.innerHTML = html;
    e.oBtn.textContent = btn;
  }
  function setBg(running){ e.screen.classList.toggle('running', running); }

  function updateMeta(){
    e.dist.textContent = A.fmt(g.dist) + 'm';
    e.coins.textContent = g.coins;
    const top = A.best('runner');
    e.best.textContent = top ? A.fmt(top.value) + 'm' : '—';
  }

  function begin(){
    if (g.state === 'over') reset();
    g.state = 'play';
    e.overlay.hidden = true;
    setBg(true);
    A.sfx('start');
    loop.start();
  }
  function pause(){
    if (g.state !== 'play') return;
    g.state = 'paused';
    g.held = false;
    loop.stop();
    setBg(false);
    overlay('Paused', 'The track will wait for you.', 'Resume');
  }
  function resume(){
    g.state = 'play';
    e.overlay.hidden = true;
    setBg(true);
    loop.start();
  }

  /* ---------------- input ---------------- */
  function press(){
    if (g.state === 'ready' || g.state === 'over') { begin(); return; }
    if (g.state === 'paused') { resume(); return; }
    g.held = true;
    g.buffer = 0.12; // a press just before landing still counts
  }
  function release(){ g.held = false; }

  /* ---------------- spawning ---------------- */
  function spawn(){
    const L = lv();
    const x = W + 20;
    const r = Math.random();
    if (r < L.drones) {
      // drones fly above head height: running under is safe, jumping into them is not
      g.obstacles.push({ type: 'drone', x, y: rand(118, 136), w: 34, h: 18 });
      if (Math.random() < 0.5) addCoins(x - 10, GROUND - 22, 4, 0);
      return;
    }
    const kind = Math.random();
    if (kind < 0.5) {
      const w = rand(22, 38), h = rand(28, 46);
      g.obstacles.push({ type: 'block', x, y: GROUND - h, w, h });
      if (Math.random() < 0.45) addCoins(x - 30, GROUND - h - 50, 5, 30);
    } else if (kind < 0.78) {
      const h = rand(26, 36);
      g.obstacles.push({ type: 'block', x, y: GROUND - h, w: 22, h });
      g.obstacles.push({ type: 'block', x: x + 28, y: GROUND - h - 10, w: 22, h: h + 10 });
    } else {
      g.obstacles.push({ type: 'tall', x, y: GROUND - 60, w: 18, h: 60 });
      if (Math.random() < 0.5) addCoins(x - 34, GROUND - 120, 5, 26);
    }
  }
  function addCoins(x, y, n, arc){
    for (let i = 0; i < n; i++) {
      const k = n > 1 ? i / (n - 1) : 0;
      g.coinList.push({ x: x + i * 24, y: y - Math.sin(k * Math.PI) * arc, taken: false });
    }
  }

  /* ---------------- update ---------------- */
  const overlap = (a, b, pad) => a.x + pad < b.x + b.w && a.x + a.w - pad > b.x && a.y + pad < b.y + b.h && a.y + a.h - pad > b.y;

  function step(dt){
    if (g.state !== 'play') return;
    const L = lv();
    const p = g.p;
    g.t += dt;
    g.speed = Math.min(L.max, g.speed + L.accel * dt);
    const dx = g.speed * dt;
    g.dist += dx / 30;
    g.scroll += dx;
    g.buffer = Math.max(0, g.buffer - dt);
    p.coyote = p.onGround ? 0.08 : Math.max(0, p.coyote - dt);

    // jumping: ground (or just left it), else an air jump if allowed
    if (g.buffer > 0) {
      if (p.onGround || p.coyote > 0) {
        p.vy = -JUMP; p.onGround = false; p.coyote = 0; g.buffer = 0;
        A.sfx('jump');
      } else if (p.airJumps > 0) {
        p.vy = -JUMP * 0.85; p.airJumps--; g.buffer = 0;
        A.sfx('jump');
      }
    }
    if (!g.held && p.vy < -JUMP * JUMP_CUT) p.vy = -JUMP * JUMP_CUT; // let go early = shorter hop
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y >= GROUND - p.h) {
      if (!p.onGround) { p.airJumps = L.airJumps; }
      p.y = GROUND - p.h; p.vy = 0; p.onGround = true;
    } else {
      p.onGround = false;
    }

    // move the world
    g.gap -= dx;
    if (g.gap <= 0) {
      spawn();
      const min = g.speed * 0.6 + 140;
      g.gap = rand(min, min + 280);
    }
    g.obstacles.forEach(o => { o.x -= dx; });
    g.coinList.forEach(c => { c.x -= dx; });
    g.obstacles = g.obstacles.filter(o => o.x + o.w > -20);
    g.coinList = g.coinList.filter(c => c.x > -20 && !c.taken);
    g.floats.forEach(f => { f.life -= dt; f.y -= dt * 40; f.x -= dx * 0.3; });
    g.floats = g.floats.filter(f => f.life > 0);

    // coins
    g.coinList.forEach(c => {
      if (!c.taken && overlap(p, { x: c.x - 8, y: c.y - 8, w: 16, h: 16 }, 0)) {
        c.taken = true;
        g.coins++;
        A.sfx('coin', 0.04);
        g.floats.push({ x: c.x, y: c.y - 8, text: '+1', life: 0.6 });
        if (g.coins >= 25) A.unlock('runner_coins');
      }
    });
    // obstacles (5px of forgiveness on every side)
    for (const o of g.obstacles) {
      if (overlap(p, o, 5)) { crash(o); return; }
    }
    if (g.dist >= 500) A.unlock('runner_500');
    if (g.dist >= 2000) A.unlock('runner_2000');
    if (Math.floor(g.t * 10) % 2 === 0) updateMeta();
  }

  function crash(o){
    g.state = 'over';
    g.flash = 1;
    loop.stop();
    setBg(false);
    render();
    A.sfx('boom');
    A.fx.shake(e.screen);
    const r = e.canvas.getBoundingClientRect();
    A.fx.burst(r.left + (g.p.x + g.p.w) / W * r.width, r.top + (g.p.y + g.p.h / 2) / H * r.height, { count: 28, colors: [C.pink, C.cyan, C.yellow] });

    const dist = Math.floor(g.dist);
    const diff = A.difficulty('runner');
    const tickets = Math.floor(dist / 80) + Math.floor(g.coins / 4) + (diff === 'hard' ? 2 : 0);
    A.addScore(dist / 5 + g.coins * 2);
    A.payout(tickets);
    if (dist >= 100) A.unlock('first_win');
    updateMeta();
    overlay('Crashed!', `${o.type === 'drone' ? 'You jumped into a drone.' : 'You hit a wall.'}<br>Distance <b>${A.fmt(dist)}m</b> · Coins <b>${g.coins}</b> · Tickets <b>+${tickets}</b>`, 'Run again');
    e.oBtn.focus({ preventScroll: true });
    A.emit('result', { game: 'runner', distance: dist, coins: g.coins });
    A.submitScore('runner', dist).then(updateMeta);
    A.roundOver('runner');
  }

  /* ---------------- drawing ---------------- */
  function render(){
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // track: glowing line, moving dashes for a sense of speed
    ctx.fillStyle = 'rgba(6,4,14,.85)';
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.save();
    ctx.shadowColor = C.pink;
    ctx.shadowBlur = 12;
    ctx.fillStyle = C.pink;
    ctx.fillRect(0, GROUND, W, 3);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,95,168,.35)';
    const off = g.scroll % 48;
    for (let x = -off; x < W; x += 48) ctx.fillRect(x, GROUND + 14, 24, 2);
    ctx.fillStyle = 'rgba(255,95,168,.15)';
    const off2 = (g.scroll * 1.3) % 64;
    for (let x = -off2; x < W; x += 64) ctx.fillRect(x, GROUND + 26, 36, 2);

    // coins
    g.coinList.forEach(c => {
      const squash = Math.abs(Math.cos(g.t * 5 + c.x * 0.05));
      ctx.save();
      ctx.shadowColor = C.yellow;
      ctx.shadowBlur = 10;
      ctx.fillStyle = C.yellow;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 7 * Math.max(0.25, squash), 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // obstacles
    g.obstacles.forEach(o => {
      if (o.type === 'drone') {
        ctx.save();
        ctx.shadowColor = C.violet;
        ctx.shadowBlur = 12;
        ctx.fillStyle = C.violet;
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2 + 2, o.w / 2, o.h / 2 - 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = C.text;
        const spin = Math.sin(g.t * 40) * 9 + 10;
        ctx.fillRect(o.x + 4, o.y - 1, spin, 2);
        ctx.fillRect(o.x + o.w - 4 - spin, o.y - 1, spin, 2);
        ctx.fillStyle = Math.sin(g.t * 8) > 0 ? C.red : '#5a1a14';
        ctx.beginPath();
        ctx.arc(o.x + o.w / 2, o.y + o.h / 2 + 2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const col = o.type === 'tall' ? C.red : C.orange;
        ctx.save();
        ctx.shadowColor = col;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
        ctx.restore();
        ctx.fillStyle = col + '33';
        ctx.fillRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
        ctx.fillStyle = col;
        for (let y = o.y + 8; y < o.y + o.h - 4; y += 10) ctx.fillRect(o.x + 5, y, o.w - 10, 2);
      }
    });

    // the runner: a little robot
    const p = g.p;
    const legPhase = p.onGround && g.state === 'play' ? Math.sin(g.t * 22) * 5 : 3;
    ctx.fillStyle = C.cyan;
    ctx.fillRect(p.x + 6, p.y + p.h - 8, 6, 8 - Math.max(0, legPhase) * 0.6);
    ctx.fillRect(p.x + p.w - 12, p.y + p.h - 8, 6, 8 - Math.max(0, -legPhase) * 0.6);
    ctx.save();
    ctx.shadowColor = C.cyan;
    ctx.shadowBlur = 14;
    ctx.fillStyle = C.cyan;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(p.x, p.y, p.w, p.h - 8, 6) : ctx.rect(p.x, p.y, p.w, p.h - 8);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#0a1418';
    ctx.fillRect(p.x + 9, p.y + 7, p.w - 12, 9);
    ctx.fillStyle = C.pink;
    ctx.fillRect(p.x + p.w - 9, p.y + 9, 4, 4);
    ctx.fillStyle = C.yellow;
    ctx.fillRect(p.x + p.w / 2 - 1, p.y - 6, 2, 6);

    // floating +1s
    ctx.font = '18px VT323, monospace';
    ctx.textAlign = 'center';
    g.floats.forEach(f => {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = C.yellow;
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    // distance readout in the corner
    ctx.font = '22px VT323, monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(244,238,220,.85)';
    ctx.fillText(`${A.fmt(g.dist)} m`, W - 12, 24);

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(255,77,61,${g.flash * 0.3})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  A.registerGame({
    id: 'runner', name: 'NEON RUNNER', title: 'Neon Runner', marquee: 'NEON RUNNER',
    label: 'Endless Dash', color: 'pink', hasDifficulty: true, wide: true,
    blurb: 'Jump the blocks, dodge drones, grab coins.',
    hiscore: { label: 'Longest run', unit: 'm', format: v => A.fmt(v) },
    gauntlet: {
      seconds: 20, goal: 'Survive 20 seconds. Distance and coins both count.',
      go(){ begin(); },
      result: () => ({ points: Math.round(g.dist * 2.6 + g.coins * 25), detail: `${A.fmt(g.dist)}m, ${g.coins} coins` })
    },
    mini: `<div class="mini-runner"><span class="bot"></span><span class="block"></span><span class="ground"></span></div>`,
    build(body){
      body.innerHTML = `
        <div class="game-meta">
          <div class="stat"><span>Difficulty</span><b data-el="diff">Normal</b></div>
          <div class="stat"><span>Distance</span><b data-el="dist">0m</b></div>
          <div class="stat"><span>Coins</span><b data-el="coins">0</b></div>
          <div class="stat"><span>Best</span><b data-el="best">—</b></div>
        </div>
        <div class="screen canvas-screen runner-screen" data-el="screen">
          <div class="runner-sky" aria-hidden="true"><div class="runner-far"></div><div class="runner-near"></div></div>
          <canvas class="game-canvas" data-el="canvas" width="${W}" height="${H}" aria-label="Runner track"></canvas>
          <div class="screen-overlay" data-el="overlay">
            <h3 data-el="oTitle"></h3><p data-el="oText"></p>
            <button class="play-btn small" data-el="oBtn">Run</button>
          </div>
        </div>
        <p class="game-hint"><kbd>Space</kbd> or <kbd>↑</kbd> jump · hold for higher · <kbd>P</kbd> pause · on a phone, tap the track</p>`;
      e = A.els(body);
      ctx = A.setupCanvas(e.canvas, W, H);
      loop = A.createLoop(step, render);
      e.oBtn.addEventListener('click', () => (g.state === 'paused' ? resume() : begin()));
      e.canvas.addEventListener('pointerdown', ev => { ev.preventDefault(); press(); });
      e.canvas.addEventListener('pointerup', release);
      e.canvas.addEventListener('pointercancel', release);
      e.canvas.addEventListener('pointerleave', release);
    },
    start: reset,
    stop(){ if (loop) loop.stop(); setBg(false); if (g.state === 'play') g.state = 'paused'; },
    pause,
    onKey(ev){
      if (ev.key === ' ' || ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') {
        ev.preventDefault();
        if (ev.repeat) return;
        if (document.activeElement === e.oBtn && g.state !== 'play') return; // the button handles it
        press();
        return;
      }
      if (ev.key === 'p' || ev.key === 'P') { g.state === 'play' ? pause() : g.state === 'paused' && resume(); }
      if (ev.key === 'Enter' && g.state !== 'play' && document.activeElement !== e.oBtn) { ev.preventDefault(); press(); }
    },
    onKeyUp(ev){
      if (ev.key === ' ' || ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') release();
    }
  });
})();
