'use strict';
/* =========================================================
   WHACK-A-MOLE — 30-second rounds that speed up.
   Moles +1, golden moles +3, bombs cost 5 and break your combo.
   Every 5 hits in a row raises the multiplier (max x4).
========================================================= */
(() => {
  const A = Arcade;
  let ROUND = 30; // seconds (15 in the Gauntlet)
  const LEVELS = {
    //        how long a mole stays up (start→end ms), gap between spawns, extra moles at once, odds
    easy:   { holes: 9,  cols: 3, show: [1300, 800], gap: [900, 500], extra: 1, bomb: 0.06, gold: 0.08 },
    normal: { holes: 9,  cols: 3, show: [1050, 620], gap: [750, 380], extra: 2, bomb: 0.10, gold: 0.08 },
    hard:   { holes: 12, cols: 4, show: [850, 480],  gap: [600, 280], extra: 3, bomb: 0.14, gold: 0.10 }
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  let g = { running: false };
  let holes = [];
  let e;

  A.achievements([
    { id: 'whack_30', game: 'whack', icon: '🔨', name: 'Pest Control', desc: 'Score 30 or more in one round.' },
    { id: 'whack_combo', game: 'whack', icon: '💥', name: 'Combo King', desc: 'Reach the x4 multiplier.' },
    { id: 'whack_gold', game: 'whack', icon: '🌟', name: 'Gold Rush', desc: 'Hit 5 golden moles in one round.' }
  ]);

  function buildHoles(){
    const lv = LEVELS[A.difficulty('whack')];
    e.field.style.setProperty('--cols', lv.cols);
    e.field.innerHTML = '';
    holes = [];
    for (let i = 0; i < lv.holes; i++) {
      const h = document.createElement('button');
      h.className = 'hole';
      h.setAttribute('aria-label', `Hole ${i + 1}`);
      h.innerHTML = `
        <span class="hole-pit"></span>
        <span class="mole-clip"><span class="mole">
          <i class="eye l"></i><i class="eye r"></i><i class="nose"></i><i class="bomb">💣</i>
        </span></span>
        <span class="hole-rim"></span>`;
      h.addEventListener('pointerdown', ev => { ev.preventDefault(); whack(i, ev); });
      h.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); whack(i); } });
      e.field.appendChild(h);
      holes.push({ el: h, type: null, timer: null, hit: false });
    }
  }

  function updateMeta(){
    e.score.textContent = g.score;
    e.time.textContent = Math.ceil(g.left) + 's';
    e.mult.textContent = 'x' + g.mult;
    e.multStat.classList.toggle('hot', g.mult > 1);
  }

  function ready(){
    stop();
    buildHoles();
    g = { running: false, score: 0, combo: 0, mult: 1, bestCombo: 0, gold: 0, left: ROUND };
    e.diff.textContent = A.capitalize(A.difficulty('whack'));
    updateMeta();
    e.overlay.hidden = false;
    e.overlayTitle.textContent = 'Whack-a-Mole';
    e.overlayText.innerHTML = 'Hit moles <b>+1</b> · Golden moles <b>+3</b> · Avoid bombs <b>−5</b><br>5 hits in a row raises your multiplier.';
    e.overlayBtn.textContent = 'Start round';
    e.status.textContent = `${ROUND} seconds on the clock.`;
  }

  function begin(){
    e.overlay.hidden = true;
    g.running = true;
    g.endAt = performance.now() + ROUND * 1000;
    A.sfx('start');
    g.clock = setInterval(() => {
      g.left = Math.max(0, (g.endAt - performance.now()) / 1000);
      updateMeta();
      e.timeStat.classList.toggle('urgent', g.left <= 5);
      if (g.left <= 0) end();
    }, 100);
    scheduleSpawn(400);
  }

  const progress = () => 1 - g.left / ROUND; // 0 at the start → 1 at the end

  function scheduleSpawn(delay){
    clearTimeout(g.spawnTimer);
    g.spawnTimer = setTimeout(() => {
      if (!g.running) return;
      spawn();
      const lv = LEVELS[A.difficulty('whack')];
      scheduleSpawn(lerp(lv.gap[0], lv.gap[1], progress()) * (0.75 + Math.random() * 0.5));
    }, delay);
  }

  function spawn(){
    const lv = LEVELS[A.difficulty('whack')];
    const maxUp = 1 + Math.floor(progress() * lv.extra + 0.3);
    const up = holes.filter(h => h.type).length;
    if (up >= maxUp) return;
    const free = holes.map((h, i) => h.type ? -1 : i).filter(i => i >= 0);
    if (!free.length) return;
    const i = free[Math.floor(Math.random() * free.length)];
    const r = Math.random();
    const type = r < lv.bomb ? 'bomb' : r < lv.bomb + lv.gold ? 'gold' : 'mole';
    const h = holes[i];
    h.type = type;
    h.hit = false;
    h.el.classList.remove('bonk');
    h.el.classList.add('up', 'is-' + type);
    const stay = lerp(lv.show[0], lv.show[1], progress()) * (type === 'gold' ? 0.7 : type === 'bomb' ? 1.2 : 1);
    h.timer = setTimeout(() => hide(i, true), stay);
  }

  function hide(i, escaped){
    const h = holes[i];
    clearTimeout(h.timer);
    if (escaped && g.running && h.type && h.type !== 'bomb' && !h.hit) breakCombo(); // a mole got away
    h.el.classList.remove('up');
    const type = h.type;
    setTimeout(() => { h.el.classList.remove('is-' + type, 'bonk'); }, 160);
    h.type = null;
  }

  function breakCombo(){
    g.combo = 0;
    g.mult = 1;
    updateMeta();
  }

  function whack(i, ev){
    if (!g.running) return;
    const h = holes[i];
    const r = h.el.getBoundingClientRect();
    const fr = e.field.getBoundingClientRect();
    const fx = r.left - fr.left + r.width / 2 - 12;
    const fy = r.top - fr.top + 4;
    if (!h.type || h.hit) { // swung at an empty hole
      breakCombo();
      A.sfx('miss', 0.04);
      return;
    }
    h.hit = true;
    if (h.type === 'bomb') {
      g.score = Math.max(0, g.score - 5);
      breakCombo();
      A.sfx('boom');
      A.fx.shake(e.screen);
      A.fx.floatText(e.field, '−5', fx, fy, A.COLORS.red);
      A.fx.burstAt(h.el, { count: 26, colors: [A.COLORS.red, A.COLORS.orange, A.COLORS.yellow], speed: 7 });
    } else {
      g.combo++;
      g.bestCombo = Math.max(g.bestCombo, g.combo);
      g.mult = Math.min(4, 1 + Math.floor(g.combo / 5));
      const pts = (h.type === 'gold' ? 3 : 1) * g.mult;
      g.score += pts;
      if (h.type === 'gold') { g.gold++; A.sfx('gold'); } else A.sfx('hit');
      A.fx.floatText(e.field, '+' + pts, fx, fy, h.type === 'gold' ? A.COLORS.yellow : A.COLORS.text);
      A.fx.burstAt(h.el, { count: h.type === 'gold' ? 20 : 8, colors: h.type === 'gold' ? [A.COLORS.yellow, A.COLORS.text] : [A.COLORS.orange, A.COLORS.text], speed: 4 });
      if (g.mult === 4) A.unlock('whack_combo');
    }
    h.el.classList.add('bonk');
    updateMeta();
    setTimeout(() => hide(i, false), 140);
  }

  function end(){
    if (!g.running) return;
    g.running = false;
    clearInterval(g.clock);
    clearTimeout(g.spawnTimer);
    holes.forEach((h, i) => { if (h.type) hide(i, false); });
    const diff = A.difficulty('whack');
    const tickets = Math.floor(g.score / 4) + (diff === 'hard' ? 2 : 0);
    A.addScore(g.score * 2);
    A.payout(tickets);
    A.sfx(g.score > 0 ? 'win' : 'over');
    if (g.score >= 20) A.fx.confetti();
    if (g.score > 0) A.unlock('first_win');
    if (g.score >= 30) A.unlock('whack_30');
    if (g.gold >= 5) A.unlock('whack_gold');
    e.overlay.hidden = false;
    e.overlayTitle.textContent = `${g.score} points`;
    e.overlayText.innerHTML = `Best combo <b>${g.bestCombo}</b> · Golden moles <b>${g.gold}</b> · Tickets <b>+${tickets}</b>`;
    e.overlayBtn.textContent = 'Play again';
    e.status.textContent = 'Round over.';
    A.emit('result', { game: 'whack', score: g.score });
    A.submitScore('whack', g.score);
    A.roundOver('whack');
  }

  function stop(){
    g.running = false;
    clearInterval(g.clock);
    clearTimeout(g.spawnTimer);
    holes.forEach(h => clearTimeout(h.timer));
  }

  A.registerGame({
    id: 'whack', name: 'WHACK-A-MOLE', title: 'Whack-a-Mole', marquee: 'WHACK-A-MOLE',
    label: 'Reflex Test', color: 'orange', hasDifficulty: true,
    blurb: '30 seconds. Hit moles, dodge bombs, build combos.',
    hiscore: { label: 'Best round score', unit: 'pts' },
    gauntlet: {
      seconds: 16, goal: 'Whack as many moles as you can in 15 seconds. Avoid bombs.',
      go(){ begin(); },
      result: () => ({ points: g.score * 40, detail: `${g.score} points` })
    },
    mini: `<div class="mini-whack"><span></span><span class="up"></span><span></span></div>`,
    build(body){
      body.innerHTML = `
        <div class="game-meta">
          <div class="stat"><span>Difficulty</span><b data-el="diff">Normal</b></div>
          <div class="stat"><span>Score</span><b data-el="score">0</b></div>
          <div class="stat" data-el="multStat"><span>Multiplier</span><b data-el="mult">x1</b></div>
          <div class="stat" data-el="timeStat"><span>Time</span><b data-el="time">30s</b></div>
        </div>
        <div class="screen whack-screen" data-el="screen">
          <div class="whack-field" data-el="field"></div>
          <div class="screen-overlay" data-el="overlay">
            <h3 data-el="overlayTitle"></h3>
            <p data-el="overlayText"></p>
            <button class="play-btn small" data-el="overlayBtn">Start round</button>
          </div>
        </div>
        <p class="game-status" data-el="status" aria-live="polite"></p>`;
      e = A.els(body);
      e.overlayBtn.addEventListener('click', () => { if (g.score !== undefined && !g.running && e.overlayBtn.textContent === 'Play again') { ready(); } begin(); });
    },
    start(opts = {}){ ROUND = opts.gauntlet ? 15 : 30; ready(); },
    stop,
    pause(){ /* a 30s round is short; leaving the tab just lets it finish */ },
    onKey(ev){
      if ((ev.key === 'Enter' || ev.key === ' ') && !g.running && !e.overlay.hidden && document.activeElement === document.body) {
        ev.preventDefault();
        e.overlayBtn.click();
      }
      // number keys 1-9 hit holes on a keypad layout
      if (g.running && /^[1-9]$/.test(ev.key)) {
        const i = Number(ev.key) - 1;
        if (holes[i]) whack(i);
      }
    }
  });
})();
