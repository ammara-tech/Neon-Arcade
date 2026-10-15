'use strict';
/* =========================================================
   MEMORY MATRIX — flip pairs against a countdown
========================================================= */
(() => {
  const A = Arcade;
  const ICONS = ['🍀','🔥','🌙','⚡','💎','🎯','🪐','🎲','🦋','🧿'];
  const LAYOUT = {
    easy:   { pairs: 6,  cols: 4, time: 75 },
    normal: { pairs: 8,  cols: 4, time: 90 },
    hard:   { pairs: 10, cols: 5, time: 100 }
  };
  let g = { cards: [], flipped: [], matched: 0, moves: 0, lock: false, timer: null, left: 0, pairs: 8, started: false, over: false, gen: 0 };
  let e;

  A.achievements([
    { id: 'mem_win', game: 'memory', icon: '🧩', name: 'Sharp Eye', desc: 'Complete a Memory Matrix board.' },
    { id: 'mem_perfect', game: 'memory', icon: '💎', name: 'Perfect Recall', desc: 'Clear a board in the minimum possible moves.' },
    { id: 'mem_hard_win', game: 'memory', icon: '🌀', name: 'Photographic', desc: 'Clear a board on Hard.' },
    { id: 'mem_speed', game: 'memory', icon: '⏱️', name: 'Lightning Recall', desc: 'Clear a board with 45 seconds or more left.' }
  ]);

  function shuffle(arr, rand){
    for (let i = arr.length - 1; i > 0; i--) { // Fisher-Yates
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function stop(){
    clearInterval(g.timer);
    g.timer = null;
    g.gen++; // cancels a pending "flip back"
  }

  let quick = false; // the Gauntlet's small board
  function start(opts){
    if (opts && !(opts instanceof Event)) quick = !!opts.gauntlet;
    stop();
    const diff = A.difficulty('memory');
    const { pairs, cols } = LAYOUT[quick ? 'easy' : diff];
    const time = quick ? 30 : LAYOUT[diff].time;
    const rand = A.rngFor('memory'); // same board for everyone during the daily challenge
    const icons = ICONS.slice(0, pairs);
    const deck = shuffle([...icons, ...icons].map(icon => ({ icon, flipped: false, matched: false, el: null })), rand);
    g = { cards: deck, flipped: [], matched: 0, moves: 0, lock: false, timer: null, left: time, pairs, started: false, over: false, gen: g.gen };

    e.diff.textContent = A.capitalize(diff);
    e.total.textContent = pairs;
    e.pairs.textContent = 0;
    e.moves.textContent = 0;
    e.time.textContent = time + 's';
    e.timeStat.classList.remove('urgent');
    e.status.textContent = 'Flip two cards to find a pair. The clock starts on your first flip.';

    e.grid.style.setProperty('--cols', cols);
    e.grid.innerHTML = '';
    deck.forEach((card, i) => {
      const el = document.createElement('button');
      el.className = 'mem-card';
      el.setAttribute('aria-label', `Card ${i + 1}, face down`);
      el.innerHTML = `<span class="mem-face mem-back">?</span><span class="mem-face mem-front">${card.icon}</span>`;
      el.addEventListener('click', () => flip(i));
      card.el = el;
      e.grid.appendChild(el);
    });
  }

  function setFace(card, up){
    card.flipped = up;
    card.el.classList.toggle('flipped', up || card.matched);
    card.el.setAttribute('aria-label', up || card.matched ? `Card, ${card.icon}` : 'Card, face down');
  }

  function flip(i){
    const card = g.cards[i];
    if (g.over || g.lock || card.flipped || card.matched) return;
    if (!g.started) {
      g.started = true;
      g.timer = setInterval(() => {
        g.left--;
        e.time.textContent = g.left + 's';
        e.timeStat.classList.toggle('urgent', g.left <= 10);
        if (g.left <= 10 && g.left > 0) A.sfx('tick');
        if (g.left <= 0) timeUp();
      }, 1000);
    }
    setFace(card, true);
    A.sfx('flip');
    g.flipped.push(i);
    if (g.flipped.length < 2) return;

    g.moves++;
    e.moves.textContent = g.moves;
    const [a, b] = g.flipped.map(k => g.cards[k]);
    g.flipped = [];

    if (a.icon === b.icon) {
      a.matched = b.matched = true;
      a.el.classList.add('matched');
      b.el.classList.add('matched');
      g.matched++;
      e.pairs.textContent = g.matched;
      A.sfx('match');
      A.fx.burstAt(b.el, { count: 12, colors: [A.COLORS.yellow, A.COLORS.text] });
      if (g.matched === g.pairs) win();
    } else {
      g.lock = true;
      const gen = g.gen;
      setTimeout(() => {
        if (gen !== g.gen) return;
        setFace(a, false);
        setFace(b, false);
        g.lock = false;
      }, 750);
    }
  }

  function win(){
    clearInterval(g.timer);
    g.over = true;
    const diff = A.difficulty('memory');
    const pts = { easy: 30, normal: 60, hard: 100 }[diff] + g.left; // seconds left are a bonus
    const perfect = g.moves === g.pairs;
    A.addScore(pts);
    A.payout({ easy: 3, normal: 6, hard: 10 }[diff] + Math.floor(g.left / 15) + (perfect ? 10 : 0));
    e.status.textContent = `Cleared in ${g.moves} moves with ${g.left}s left. +${pts} pts`;
    A.sfx('win');
    A.fx.confetti();
    A.stat('memWins');
    A.unlock('first_win');
    A.unlock('mem_win');
    if (diff === 'hard') A.unlock('mem_hard_win');
    if (perfect) A.unlock('mem_perfect');
    if (g.left >= 45) A.unlock('mem_speed');
    A.emit('result', { game: 'memory', win: true, moves: g.moves, difficulty: diff });
    A.submitScore('memory', pts);
    A.roundOver('memory');
  }

  function timeUp(){
    clearInterval(g.timer);
    g.over = true;
    g.cards.forEach(c => { if (!c.matched) c.el.classList.add('flipped', 'missed'); });
    e.status.textContent = `Time's up! You found ${g.matched} of ${g.pairs} pairs.`;
    A.sfx('over');
    A.fx.shake(e.screen);
    A.emit('result', { game: 'memory', win: false, moves: g.moves });
    A.roundOver('memory');
  }

  A.registerGame({
    id: 'memory', name: 'MEMORY MATRIX', title: 'Memory Matrix', marquee: 'MEMORY MATRIX',
    label: 'Flip & Match', color: 'yellow', hasDifficulty: true,
    blurb: 'Find every pair before the clock runs out.',
    hiscore: { label: 'Best score (time left is a bonus)', unit: 'pts' },
    gauntlet: {
      seconds: 32, goal: 'Clear 6 pairs. Time left on the 30-second clock is a bonus.',
      go(){},
      result: () => ({ points: g.matched * 110 + (g.matched === g.pairs ? g.left * 8 : 0), detail: `${g.matched}/${g.pairs} pairs` })
    },
    mini: `<div class="mini-mem"><span class="on">★</span><span></span><span></span><span></span><span class="on">★</span><span></span></div>`,
    build(body){
      body.innerHTML = `
        <div class="game-meta">
          <div class="stat"><span>Difficulty</span><b data-el="diff">Normal</b></div>
          <div class="stat"><span>Moves</span><b data-el="moves">0</b></div>
          <div class="stat"><span>Pairs</span><b><span data-el="pairs">0</span>/<span data-el="total">8</span></b></div>
          <div class="stat" data-el="timeStat"><span>Time left</span><b data-el="time">0s</b></div>
        </div>
        <div class="screen" data-el="screen"><div class="mem-grid" data-el="grid"></div></div>
        <p class="game-status" data-el="status" aria-live="polite"></p>
        <button class="reset-btn" data-el="reset">Shuffle &amp; restart</button>`;
      e = A.els(body);
      e.reset.addEventListener('click', start);
    },
    start,
    stop
  });
})();
