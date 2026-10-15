'use strict';
/* =========================================================
   BREAKOUT — clear the wall, level after level.
   Where the ball hits the paddle sets its angle.
   Bricks hit without touching the paddle build a chain bonus.
   Power-ups: W wide paddle · M multiball · S slow ball · + extra life
========================================================= */
(() => {
  const A = Arcade;
  const W = 480, H = 560;
  const PADDLE_Y = H - 42, PADDLE_H = 12, BALL_R = 6;
  const COLS = 8, MARGIN = 16, GAP = 6, TOP = 74, BRICK_H = 18;
  const BRICK_W = (W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
  const LEVELS = {
    easy:   { paddle: 104, speed: 280, lives: 5 },
    normal: { paddle: 84,  speed: 320, lives: 3 },
    hard:   { paddle: 68,  speed: 360, lives: 2 }
  };
  // '.' empty · '1' normal brick · '2' tough brick (two hits)
  const LAYOUTS = [
    ['11111111', '11111111', '11111111', '11111111', '11111111'],
    ['...11...', '..1111..', '.111111.', '11111111', '22222222'],
    ['2.2.2.2.', '.1.1.1.1', '2.2.2.2.', '.1.1.1.1', '11111111', '22222222'],
    ['22222222', '21111112', '21.22.12', '21111112', '22222222'],
    ['1.1..1.1', '22222222', '.1.11.1.', '22222222', '11111111', '2......2']
  ];
  const C = A.COLORS;
  const ROW_COLORS = [C.red, C.orange, C.yellow, C.lime, C.cyan, C.blue, C.violet];
  const POWERS = [
    { type: 'wide', label: 'W', color: C.cyan, odds: 0.4 },
    { type: 'multi', label: 'M', color: C.pink, odds: 0.3 },
    { type: 'slow', label: 'S', color: C.lime, odds: 0.2 },
    { type: 'life', label: '+', color: C.red, odds: 0.1 }
  ];
  let g = {}, e, ctx, loop;
  const keys = { left: false, right: false };

  A.achievements([
    { id: 'brk_clear', game: 'breakout', icon: '🧱', name: 'Wall Breaker', desc: 'Clear a Breakout wall.' },
    { id: 'brk_level3', game: 'breakout', icon: '🏗️', name: 'Demolition Crew', desc: 'Clear 3 walls in one game.' },
    { id: 'brk_chain', game: 'breakout', icon: '⛓️', name: 'Chain Reaction', desc: 'Break 8 bricks without touching the paddle.' }
  ]);

  const lv = () => LEVELS[A.difficulty('breakout')];
  const ballSpeed = () => lv().speed * (1 + 0.08 * (g.level - 1)) * (1 + Math.min(g.hits, 30) * 0.012) * (g.slow > 0 ? 0.7 : 1);
  const paddleW = () => lv().paddle * (g.wide > 0 ? 1.45 : 1);

  function buildWall(){
    const layout = LAYOUTS[(g.level - 1) % LAYOUTS.length];
    const toughBoost = g.level > LAYOUTS.length; // second time round, every brick is tough
    g.bricks = [];
    layout.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      const hp = ch === '2' || toughBoost ? 2 : 1;
      g.bricks.push({ x: MARGIN + c * (BRICK_W + GAP), y: TOP + r * (BRICK_H + GAP), w: BRICK_W, h: BRICK_H, hp, max: hp, color: ROW_COLORS[r % ROW_COLORS.length] });
    }));
  }

  function newBall(){ return { x: g.px, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, stuck: true }; }

  function reset(){
    if (loop) loop.stop();
    g = { state: 'ready', level: 1, cleared: 0, score: 0, lives: lv().lives, px: W / 2, balls: [], powers: [], wide: 0, slow: 0, hits: 0, chain: 0, bestChain: 0, banner: null, floats: [], t: 0, flash: 0 };
    buildWall();
    g.balls = [newBall()];
    g.banner = { text: 'CLICK, TAP OR SPACE TO LAUNCH', t: 99 };
    e.diff.textContent = A.capitalize(A.difficulty('breakout'));
    updateMeta();
    overlay('Breakout', 'Move with the mouse, your finger, or ← →.<br>Click, tap or press Space to launch the ball.', 'Start');
    render();
  }

  function overlay(title, html, btn){
    e.overlay.hidden = false;
    e.oTitle.textContent = title;
    e.oText.innerHTML = html;
    e.oBtn.textContent = btn;
  }

  function updateMeta(){
    e.score.textContent = A.fmt(g.score);
    e.lives.textContent = '♥'.repeat(Math.min(g.lives, 6)) || '0';
    e.level.textContent = g.level;
  }

  function begin(){
    if (g.state === 'over') reset();
    g.state = 'play';
    e.overlay.hidden = true;
    A.sfx('start');
    loop.start();
  }
  function pause(){
    if (g.state !== 'play') return;
    g.state = 'paused';
    loop.stop();
    overlay('Paused', 'The ball is frozen mid-air.', 'Resume');
  }
  function resume(){ g.state = 'play'; e.overlay.hidden = true; loop.start(); }

  function launch(){
    if (g.state === 'ready' || g.state === 'over') { begin(); return; }
    if (g.state === 'paused') { resume(); return; }
    g.balls.forEach(b => {
      if (!b.stuck) return;
      b.stuck = false;
      const a = (Math.random() * 0.6 - 0.3);
      const s = ballSpeed();
      b.vx = Math.sin(a) * s;
      b.vy = -Math.cos(a) * s;
      A.sfx('bounce');
    });
    g.banner = null;
  }

  /* ---------------- update ---------------- */
  function step(dt){
    if (g.state !== 'play') return;
    g.t += dt;
    g.wide = Math.max(0, g.wide - dt);
    g.slow = Math.max(0, g.slow - dt);
    g.flash = Math.max(0, g.flash - dt * 3);
    if (g.banner) { g.banner.t -= dt; if (g.banner.t <= 0) g.banner = null; }
    g.floats.forEach(f => { f.life -= dt; f.y -= dt * 40; });
    g.floats = g.floats.filter(f => f.life > 0);

    // paddle from keys (mouse/touch set g.px directly)
    const pw = paddleW();
    if (keys.left) g.px -= 520 * dt;
    if (keys.right) g.px += 520 * dt;
    g.px = A.clamp(g.px, pw / 2, W - pw / 2);

    // balls, moved in small sub-steps so they can't tunnel through bricks
    for (const b of g.balls) {
      if (b.stuck) { b.x = g.px; b.y = PADDLE_Y - BALL_R - 1; continue; }
      // keep speed in sync with slow-mo / level / rally speed-ups
      const sp = Math.hypot(b.vx, b.vy) || 1, want = ballSpeed();
      b.vx *= want / sp; b.vy *= want / sp;
      const steps = Math.ceil(want * dt / 4);
      for (let i = 0; i < steps && !b.dead; i++) moveBall(b, dt / steps, pw);
    }
    g.balls = g.balls.filter(b => !b.dead);
    if (!g.balls.length) return loseLife();

    // power-ups falling
    for (const p of g.powers) {
      p.y += 140 * dt;
      if (p.y + 9 >= PADDLE_Y && p.y - 9 <= PADDLE_Y + PADDLE_H && Math.abs(p.x - g.px) <= pw / 2 + 9) { p.taken = true; collect(p); }
    }
    g.powers = g.powers.filter(p => !p.taken && p.y < H + 20);

    if (!g.bricks.some(b => b.hp > 0)) levelClear();
  }

  function moveBall(b, dt, pw){
    const px = b.x, py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // walls
    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); A.sfx('bounce', 0.03); }
    if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); A.sfx('bounce', 0.03); }
    if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); A.sfx('bounce', 0.03); }
    if (b.y > H + BALL_R) { b.dead = true; return; }

    // paddle: the further from centre, the steeper the bounce (up to 60°)
    if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && py + BALL_R <= PADDLE_Y + 4 && Math.abs(b.x - g.px) <= pw / 2 + BALL_R) {
      const rel = A.clamp((b.x - g.px) / (pw / 2), -1, 1);
      const a = rel * Math.PI / 3;
      const s = ballSpeed();
      b.vx = Math.sin(a) * s;
      b.vy = -Math.cos(a) * s;
      b.y = PADDLE_Y - BALL_R;
      g.hits++;
      g.chain = 0;
      A.sfx('bounce');
      return;
    }

    // bricks: one hit per sub-step
    for (const br of g.bricks) {
      if (br.hp <= 0) continue;
      const cx = A.clamp(b.x, br.x, br.x + br.w), cy = A.clamp(b.y, br.y, br.y + br.h);
      if ((b.x - cx) ** 2 + (b.y - cy) ** 2 > BALL_R * BALL_R) continue;
      // came in from the side → flip x, otherwise flip y
      const fromSide = px < br.x || px > br.x + br.w;
      if (fromSide) { b.vx = -b.vx; b.x = px; } else { b.vy = -b.vy; b.y = py; }
      hitBrick(br);
      break;
    }
  }

  function hitBrick(br){
    br.hp--;
    if (br.hp > 0) { A.sfx('bounce'); return; }
    g.chain++;
    g.bestChain = Math.max(g.bestChain, g.chain);
    if (g.chain >= 8) A.unlock('brk_chain');
    const pts = (br.max === 2 ? 25 : 10) + 5 * (Math.min(g.chain, 10) - 1);
    g.score += pts;
    g.floats.push({ x: br.x + br.w / 2, y: br.y + 4, text: '+' + pts, life: 0.7, color: g.chain >= 4 ? C.yellow : C.text });
    A.sfx('brick');
    const r = e.canvas.getBoundingClientRect();
    A.fx.burst(r.left + (br.x + br.w / 2) / W * r.width, r.top + (br.y + br.h / 2) / H * r.height, { count: 8, colors: [br.color, C.text], speed: 3, size: 4 });
    if (Math.random() < 0.12) {
      let roll = Math.random(), pick = POWERS[0];
      for (const p of POWERS) { if (roll < p.odds) { pick = p; break; } roll -= p.odds; }
      g.powers.push({ ...pick, x: br.x + br.w / 2, y: br.y + br.h / 2 });
    }
    updateMeta();
  }

  function collect(p){
    A.sfx('power');
    if (p.type === 'wide') g.wide = 12;
    if (p.type === 'slow') g.slow = 8;
    if (p.type === 'life') { g.lives++; }
    if (p.type === 'multi') {
      const src = g.balls.find(b => !b.stuck) || g.balls[0];
      const s = ballSpeed();
      [-0.5, 0.5].forEach(a => {
        const base = Math.atan2(src.vx, -src.vy) + a;
        g.balls.push({ x: src.x, y: src.y, vx: Math.sin(base) * s, vy: -Math.abs(Math.cos(base) * s), stuck: src.stuck });
      });
    }
    g.banner = { text: { wide: 'WIDE PADDLE', multi: 'MULTIBALL', slow: 'SLOW-MO', life: 'EXTRA LIFE' }[p.type], t: 1.2 };
    updateMeta();
  }

  function loseLife(){
    g.lives--;
    g.chain = 0;
    g.flash = 1;
    g.wide = g.slow = 0;
    g.powers = [];
    A.fx.shake(e.screen);
    updateMeta();
    if (g.lives <= 0) return gameOver();
    A.sfx('miss');
    g.balls = [newBall()];
    g.banner = { text: 'BALL LOST · TAP TO LAUNCH', t: 99 };
  }

  function levelClear(){
    g.cleared++;
    const bonus = 100 * g.level;
    g.score += bonus;
    A.payout(4 + g.level);
    A.sfx('win');
    A.fx.confetti();
    A.unlock('first_win');
    A.unlock('brk_clear');
    if (g.cleared >= 3) A.unlock('brk_level3');
    A.emit('result', { game: 'breakout', levelCleared: g.cleared, score: g.score });
    g.level++;
    g.hits = 0;
    g.powers = [];
    buildWall();
    g.balls = [newBall()];
    g.banner = { text: `WALL ${g.level} · +${bonus} · TAP TO LAUNCH`, t: 99 };
    updateMeta();
  }

  function gameOver(){
    g.state = 'over';
    loop.stop();
    render();
    A.sfx('over');
    const tickets = Math.floor(g.score / 60) + (A.difficulty('breakout') === 'hard' ? 2 : 0);
    A.addScore(g.score / 10);
    A.payout(tickets);
    overlay('Game over', `Score <b>${A.fmt(g.score)}</b> · Walls cleared <b>${g.cleared}</b> · Best chain <b>${g.bestChain}</b> · Tickets <b>+${tickets}</b>`, 'Play again');
    e.oBtn.focus({ preventScroll: true });
    A.emit('result', { game: 'breakout', levelCleared: g.cleared, score: g.score });
    A.submitScore('breakout', g.score);
    A.roundOver('breakout');
  }

  /* ---------------- drawing ---------------- */
  function rr(x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function render(){
    if (!ctx) return;
    ctx.fillStyle = '#07060f';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(167,123,255,.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 32) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }

    // bricks
    g.bricks.forEach(b => {
      if (b.hp <= 0) return;
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.color;
      rr(b.x, b.y, b.w, b.h, 4);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(b.x + 3, b.y + 2, b.w - 6, 3);
      if (b.max === 2) {
        ctx.strokeStyle = C.text;
        ctx.lineWidth = 2;
        rr(b.x + 1, b.y + 1, b.w - 2, b.h - 2, 3);
        ctx.stroke();
        if (b.hp === 1) { // cracked
          ctx.strokeStyle = 'rgba(7,6,15,.8)';
          ctx.beginPath();
          ctx.moveTo(b.x + b.w * 0.3, b.y);
          ctx.lineTo(b.x + b.w * 0.45, b.y + b.h * 0.55);
          ctx.lineTo(b.x + b.w * 0.6, b.y + b.h);
          ctx.stroke();
        }
      }
    });

    // power-ups
    ctx.font = '18px VT323, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    g.powers.forEach(p => {
      ctx.fillStyle = p.color;
      rr(p.x - 14, p.y - 9, 28, 18, 9);
      ctx.fill();
      ctx.fillStyle = '#07060f';
      ctx.fillText(p.label, p.x, p.y + 1);
    });

    // paddle
    const pw = paddleW();
    ctx.save();
    ctx.shadowColor = C.cyan;
    ctx.shadowBlur = 16;
    ctx.fillStyle = g.wide > 0 ? C.cyan : C.text;
    rr(g.px - pw / 2, PADDLE_Y, pw, PADDLE_H, 6);
    ctx.fill();
    ctx.restore();

    // balls
    g.balls.forEach(b => {
      ctx.save();
      ctx.shadowColor = C.yellow;
      ctx.shadowBlur = 14;
      ctx.fillStyle = g.slow > 0 ? C.lime : C.yellow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // floating points
    ctx.font = '20px VT323, monospace';
    g.floats.forEach(f => {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    if (g.banner) {
      ctx.font = '26px VT323, monospace';
      ctx.fillStyle = C.yellow;
      ctx.fillText(g.banner.text, W / 2, H * 0.62);
    }
    if (g.chain >= 3) {
      ctx.font = '20px VT323, monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = C.yellow;
      ctx.fillText(`CHAIN x${g.chain}`, 12, 24);
      ctx.textAlign = 'center';
    }
    ctx.textBaseline = 'alphabetic';
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(255,77,61,${g.flash * 0.3})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  A.registerGame({
    id: 'breakout', name: 'BREAKOUT', title: 'Breakout', marquee: 'BREAKOUT',
    label: 'Brick Smasher', color: 'red', hasDifficulty: true,
    blurb: 'Five walls, power-ups and chain bonuses.',
    hiscore: { label: 'Best score', unit: 'pts' },
    gauntlet: {
      seconds: 25, goal: 'Break as many bricks as you can in 25 seconds.',
      go(){ begin(); launch(); },
      result: () => ({ points: Math.round(g.score * 1.6), detail: `${A.fmt(g.score)} pts` })
    },
    mini: `<div class="mini-brk"><span></span><span></span><span></span><span></span><span></span><span></span><i class="ball"></i><i class="pad"></i></div>`,
    build(body){
      body.innerHTML = `
        <div class="game-meta">
          <div class="stat"><span>Difficulty</span><b data-el="diff">Normal</b></div>
          <div class="stat"><span>Score</span><b data-el="score">0</b></div>
          <div class="stat"><span>Lives</span><b data-el="lives">♥♥♥</b></div>
          <div class="stat"><span>Wall</span><b data-el="level">1</b></div>
        </div>
        <div class="screen canvas-screen brk-screen" data-el="screen">
          <canvas class="game-canvas" data-el="canvas" width="${W}" height="${H}" aria-label="Breakout board"></canvas>
          <div class="screen-overlay" data-el="overlay">
            <h3 data-el="oTitle"></h3><p data-el="oText"></p>
            <button class="play-btn small" data-el="oBtn">Start</button>
          </div>
        </div>
        <p class="game-hint">Power-ups: <b>W</b> wide · <b>M</b> multiball · <b>S</b> slow · <b>+</b> life · <kbd>P</kbd> pause</p>`;
      e = A.els(body);
      ctx = A.setupCanvas(e.canvas, W, H);
      loop = A.createLoop(step, render);
      e.oBtn.addEventListener('click', () => (g.state === 'paused' ? resume() : begin()));
      const follow = ev => {
        if (g.state !== 'play') return;
        g.px = A.canvasPoint(e.canvas, W, H, ev.clientX, ev.clientY).x;
      };
      e.canvas.addEventListener('pointermove', follow);
      e.canvas.addEventListener('pointerdown', ev => { follow(ev); launch(); });
    },
    start: reset,
    stop(){ if (loop) loop.stop(); keys.left = keys.right = false; if (g.state === 'play') g.state = 'paused'; },
    pause,
    onKey(ev){
      if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') { ev.preventDefault(); keys.left = true; }
      if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') { ev.preventDefault(); keys.right = true; }
      if (ev.key === ' ') { ev.preventDefault(); if (document.activeElement !== e.oBtn || g.state === 'play') launch(); }
      if (ev.key === 'p' || ev.key === 'P') { g.state === 'play' ? pause() : g.state === 'paused' && resume(); }
      if (ev.key === 'Enter' && g.state !== 'play' && document.activeElement !== e.oBtn) { ev.preventDefault(); launch(); }
    },
    onKeyUp(ev){
      if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') keys.left = false;
      if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') keys.right = false;
    }
  });
})();
