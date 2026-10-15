'use strict';
/* =========================================================
   SNAKE — eat, grow, don't bite yourself.
   Eating again within 4 seconds raises the combo (max x3).
   Golden fruit is worth 5 and vanishes after 5 seconds.
   Easy wraps around the edges; Hard adds rocks.
========================================================= */
(() => {
  const A = Arcade;
  const N = 20, CELL = 20, W = N * CELL, H = N * CELL;
  const LEVELS = {
    easy:   { tick: 0.15,  min: 0.085, accel: 0.003,  wrap: true,  rocks: 0 },
    normal: { tick: 0.125, min: 0.065, accel: 0.003,  wrap: false, rocks: 0 },
    hard:   { tick: 0.1,   min: 0.05,  accel: 0.0025, wrap: false, rocks: 7 }
  };
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const COMBO_WINDOW = 4; // seconds
  const C = A.COLORS;
  let g = {}, e, ctx, loop;

  A.achievements([
    { id: 'snake_15', game: 'snake', icon: '🐍', name: 'Growth Spurt', desc: 'Grow the snake to length 15.' },
    { id: 'snake_30', game: 'snake', icon: '🐉', name: 'Anaconda', desc: 'Grow the snake to length 30.' },
    { id: 'snake_gold', game: 'snake', icon: '🍯', name: 'Gourmet', desc: 'Eat 3 golden fruit in one game.' }
  ]);

  const lv = () => LEVELS[A.difficulty('snake')];
  const at = (list, x, y) => list.some(p => p.x === x && p.y === y);

  function isFree(x, y){
    return !at(g.snake, x, y) && !at(g.rocks, x, y) &&
      !(g.food && g.food.x === x && g.food.y === y) && !(g.gold && g.gold.x === x && g.gold.y === y);
  }
  function randomFree(){
    for (let i = 0; i < 400; i++) {
      const x = Math.floor(Math.random() * N), y = Math.floor(Math.random() * N);
      if (isFree(x, y)) return { x, y };
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (isFree(x, y)) return { x, y };
    return null;
  }

  function reset(){
    if (loop) loop.stop();
    const L = lv();
    g = {
      snake: [{ x: 7, y: 10 }, { x: 6, y: 10 }, { x: 5, y: 10 }],
      dir: 'right', queue: [], food: null, gold: null, goldLeft: 0, rocks: [],
      score: 0, golds: 0, mult: 1, lastEat: -99, t: 0, acc: 0, tick: L.tick,
      state: 'ready', flash: 0, floats: []
    };
    // rocks stay away from the starting row so the first seconds are safe
    while (g.rocks.length < L.rocks) {
      const p = randomFree();
      if (p && Math.abs(p.y - 10) > 2) g.rocks.push(p);
    }
    g.food = randomFree();
    e.diff.textContent = A.capitalize(A.difficulty('snake'));
    e.screen.classList.toggle('walls', !L.wrap);
    updateMeta();
    overlay('Snake', `Arrow keys or WASD to steer, or swipe on the board.<br>${L.wrap ? 'Edges wrap around on Easy.' : 'Hitting a wall ends the run.'} Space pauses.`, 'Start');
    render();
  }

  function overlay(title, html, btn){
    e.overlay.hidden = false;
    e.oTitle.textContent = title;
    e.oText.innerHTML = html;
    e.oBtn.textContent = btn;
  }

  function updateMeta(){
    e.length.textContent = g.snake.length;
    e.score.textContent = g.score;
    e.mult.textContent = 'x' + g.mult;
    e.multStat.classList.toggle('hot', g.mult > 1);
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
    overlay('Paused', 'Take a breather.', 'Resume');
  }
  function resume(){
    g.state = 'play';
    e.overlay.hidden = true;
    loop.start();
  }

  function steer(d){
    if (g.state === 'ready') begin();
    if (g.state === 'paused') resume();
    if (g.state !== 'play') return;
    const last = g.queue.length ? g.queue[g.queue.length - 1] : g.dir;
    if (d === last || d === OPPOSITE[last]) return; // no reversing into yourself
    if (g.queue.length < 3) g.queue.push(d);
  }

  function step(dt){
    if (g.state !== 'play') return;
    g.t += dt;
    g.acc += dt;
    g.flash = Math.max(0, g.flash - dt * 3);
    g.floats.forEach(f => { f.life -= dt; f.y -= dt * 30; });
    g.floats = g.floats.filter(f => f.life > 0);
    if (g.gold) {
      g.goldLeft -= dt;
      if (g.goldLeft <= 0) g.gold = null;
    }
    if (g.mult > 1 && g.t - g.lastEat > COMBO_WINDOW) { g.mult = 1; updateMeta(); }
    while (g.acc >= g.tick && g.state === 'play') {
      g.acc -= g.tick;
      advance();
    }
  }

  function advance(){
    if (g.queue.length) g.dir = g.queue.shift();
    const [dx, dy] = DIRS[g.dir];
    const head = g.snake[0];
    let x = head.x + dx, y = head.y + dy;
    if (lv().wrap) { x = (x + N) % N; y = (y + N) % N; }
    else if (x < 0 || y < 0 || x >= N || y >= N) return die('You hit the wall.');
    if (at(g.rocks, x, y)) return die('You hit a rock.');

    const eatFood = g.food && g.food.x === x && g.food.y === y;
    const eatGold = g.gold && g.gold.x === x && g.gold.y === y;
    const body = eatFood || eatGold ? g.snake : g.snake.slice(0, -1); // the tail moves out of the way
    if (at(body, x, y)) return die('You bit your own tail.');

    g.snake.unshift({ x, y });
    if (!eatFood && !eatGold) { g.snake.pop(); return; }

    g.mult = g.t - g.lastEat <= COMBO_WINDOW ? Math.min(3, g.mult + 1) : 1;
    g.lastEat = g.t;
    const pts = (eatGold ? 5 : 1) * g.mult;
    g.score += pts;
    g.floats.push({ x: x * CELL + CELL / 2, y: y * CELL, text: '+' + pts, life: 0.8, color: eatGold ? C.yellow : C.text });
    g.tick = Math.max(lv().min, g.tick - lv().accel);
    if (eatGold) {
      g.gold = null;
      g.golds++;
      A.sfx('gold');
      if (g.golds >= 3) A.unlock('snake_gold');
    } else {
      A.sfx('eat');
      g.food = randomFree();
      if (!g.gold && Math.random() < 0.18) { g.gold = randomFree(); g.goldLeft = 5; }
    }
    if (g.snake.length >= 15) A.unlock('snake_15');
    if (g.snake.length >= 30) A.unlock('snake_30');
    updateMeta();
  }

  function die(reason){
    g.state = 'over';
    g.flash = 1;
    loop.stop();
    render();
    A.sfx('over');
    A.fx.shake(e.screen);
    const r = e.canvas.getBoundingClientRect();
    const h = g.snake[0];
    A.fx.burst(r.left + (h.x + 0.5) / N * r.width, r.top + (h.y + 0.5) / N * r.height, { count: 24, colors: [C.lime, C.green, C.red] });

    const diff = A.difficulty('snake');
    const tickets = Math.floor(g.score / 3) + (diff === 'hard' ? 2 : 0);
    A.addScore(g.score * 3);
    A.payout(tickets);
    if (g.score > 0) A.unlock('first_win');
    overlay('Game over', `${reason}<br>Length <b>${g.snake.length}</b> · Score <b>${g.score}</b> · Tickets <b>+${tickets}</b>`, 'Play again');
    e.oBtn.focus({ preventScroll: true });
    A.emit('result', { game: 'snake', length: g.snake.length, score: g.score });
    A.submitScore('snake', g.score);
    A.roundOver('snake');
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
    const t = g.t || 0;
    ctx.fillStyle = '#06100d';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(198,255,74,.08)';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);

    // rocks
    g.rocks.forEach(p => {
      ctx.fillStyle = C.violet;
      rr(p.x * CELL + 2, p.y * CELL + 2, CELL - 4, CELL - 4, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.fillRect(p.x * CELL + 5, p.y * CELL + 11, CELL - 10, 3);
    });

    // food with a pulsing glow
    if (g.food) {
      const pulse = 1 + Math.sin(t * 6) * 0.12;
      ctx.save();
      ctx.shadowColor = C.pink;
      ctx.shadowBlur = 14;
      ctx.fillStyle = C.pink;
      ctx.beginPath();
      ctx.arc(g.food.x * CELL + CELL / 2, g.food.y * CELL + CELL / 2, 6.5 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = C.lime;
      ctx.fillRect(g.food.x * CELL + CELL / 2, g.food.y * CELL + 3, 2, 4);
    }
    // golden fruit with a shrinking timer ring
    if (g.gold) {
      const cx = g.gold.x * CELL + CELL / 2, cy = g.gold.y * CELL + CELL / 2;
      ctx.save();
      ctx.shadowColor = C.yellow;
      ctx.shadowBlur = 18;
      ctx.fillStyle = C.yellow;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5 + t;
        const rad = i % 2 ? 3.5 : 8.5;
        ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,201,60,.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (g.goldLeft / 5));
      ctx.stroke();
    }

    // snake: bright head fading to a darker tail
    const n = g.snake.length;
    for (let i = n - 1; i >= 0; i--) {
      const s = g.snake[i];
      const k = i / Math.max(1, n - 1);
      ctx.fillStyle = i === 0 ? C.lime : `hsl(${95 - k * 25}, 85%, ${58 - k * 22}%)`;
      const inset = i === 0 ? 1 : 2;
      rr(s.x * CELL + inset, s.y * CELL + inset, CELL - inset * 2, CELL - inset * 2, i === 0 ? 6 : 4);
      ctx.fill();
    }
    // eyes look where the snake is going
    const h = g.snake[0];
    const [dx, dy] = DIRS[g.dir];
    const ex = h.x * CELL + CELL / 2, ey = h.y * CELL + CELL / 2;
    ctx.fillStyle = '#06100d';
    [[-1, 1], [1, 1]].forEach(([sx]) => {
      const px = ex + dx * 4 + (dy ? sx * 4 : 0);
      const py = ey + dy * 4 + (dx ? sx * 4 : 0);
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // floating points
    ctx.font = '20px VT323, monospace';
    ctx.textAlign = 'center';
    g.floats.forEach(f => {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(255,77,61,${g.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  A.registerGame({
    id: 'snake', name: 'SNAKE', title: 'Snake', marquee: 'SNAKE',
    label: 'Grow & Survive', color: 'lime', hasDifficulty: true,
    blurb: 'Easy wraps the edges. Hard adds rocks.',
    hiscore: { label: 'Best score', unit: 'pts' },
    gauntlet: {
      seconds: 25, goal: 'Eat as much as you can in 25 seconds. Walls are deadly.',
      go(){ begin(); },
      result: () => ({ points: g.score * 45 + g.snake.length * 10, detail: `length ${g.snake.length}, ${g.score} pts` })
    },
    mini: `<div class="mini-snake"><span></span><span></span><span></span><span></span><span class="head"></span><span class="food"></span></div>`,
    build(body){
      body.innerHTML = `
        <div class="game-meta">
          <div class="stat"><span>Difficulty</span><b data-el="diff">Normal</b></div>
          <div class="stat"><span>Length</span><b data-el="length">3</b></div>
          <div class="stat"><span>Score</span><b data-el="score">0</b></div>
          <div class="stat" data-el="multStat"><span>Combo</span><b data-el="mult">x1</b></div>
        </div>
        <div class="screen canvas-screen snake-screen" data-el="screen">
          <canvas class="game-canvas" data-el="canvas" width="${W}" height="${H}" aria-label="Snake board"></canvas>
          <div class="screen-overlay" data-el="overlay">
            <h3 data-el="oTitle"></h3><p data-el="oText"></p>
            <button class="play-btn small" data-el="oBtn">Start</button>
          </div>
        </div>
        <div class="dpad" aria-label="Direction pad">
          <button class="dpad-btn up" data-dir="up" aria-label="Up">▲</button>
          <button class="dpad-btn left" data-dir="left" aria-label="Left">◀</button>
          <button class="dpad-btn right" data-dir="right" aria-label="Right">▶</button>
          <button class="dpad-btn down" data-dir="down" aria-label="Down">▼</button>
        </div>`;
      e = A.els(body);
      ctx = A.setupCanvas(e.canvas, W, H);
      loop = A.createLoop(step, render);
      e.oBtn.addEventListener('click', () => (g.state === 'paused' ? resume() : begin()));
      body.querySelectorAll('.dpad-btn').forEach(b => b.addEventListener('pointerdown', ev => { ev.preventDefault(); steer(b.dataset.dir); }));
      // swipe to steer
      let sx = null, sy = null;
      e.canvas.addEventListener('pointerdown', ev => { sx = ev.clientX; sy = ev.clientY; });
      e.canvas.addEventListener('pointerup', ev => {
        if (sx === null) return;
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        sx = sy = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      });
    },
    start: reset,
    stop(){ if (loop) loop.stop(); if (g.state === 'play') g.state = 'paused'; },
    pause,
    onKey(ev){
      const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
      if (map[ev.key]) { ev.preventDefault(); steer(map[ev.key]); return; }
      if (ev.key === ' ' || ev.key === 'p' || ev.key === 'P') {
        ev.preventDefault();
        if (g.state === 'play') pause();
        else if (g.state === 'paused') resume();
        else if (document.activeElement !== e.oBtn) begin();
        return;
      }
      if (ev.key === 'Enter' && g.state !== 'play' && document.activeElement !== e.oBtn) {
        ev.preventDefault();
        g.state === 'paused' ? resume() : begin();
      }
    }
  });
})();
