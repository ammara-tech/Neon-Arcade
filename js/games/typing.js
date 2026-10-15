'use strict';
/* =========================================================
   TYPING SPEED TEST — type the passage before the clock runs out.
   Letters turn green when right and red when wrong.
   WPM counts correct characters only (5 characters = 1 word).
========================================================= */
(() => {
  const A = Arcade;

  const COMMON = ('the of and to in is you that it he was for on are as with his they at be this have from or one had by ' +
    'word but not what all were we when your can said there use an each which she do how their if will up other about out ' +
    'many then them these so some her would make like him into time has look two more write go see number no way could ' +
    'people my than first water been call who oil its now find long down day did get come made may part over new sound ' +
    'take only little work know place year live me back give most very after thing our just name good sentence man think ' +
    'say great where help through much before line right too mean old any same tell boy follow came want show also around ' +
    'form three small set put end does another well large must big even such because turn here why ask went men read need ' +
    'land different home us move try kind hand picture again change off play spell air away animal house point page letter ' +
    'mother answer found study still learn should world high every near add food between own below country plant last school ' +
    'father keep tree never start city earth eye light thought head under story saw left few while along might close something').split(' ');

  const PASSAGES = [
    'The arcade hums after dark. Rows of cabinets glow in red, blue and gold, and every machine plays its own little tune while it waits for someone to step up and press start.',
    'A good high score takes patience. You learn the patterns, you lose a few lives, and slowly the game starts to feel like a song you already know the words to.',
    'Typing fast is mostly about rhythm. Keep your eyes on the words ahead, let your fingers find their own way, and do not stop to fix every small mistake.',
    'The snake grows longer with every piece of fruit it eats. Soon the screen feels crowded, and one wrong turn is enough to end the run.',
    'Somewhere a pinball machine rattles and a bell rings. Two friends argue over whose turn it is, and the prize counter smells like plastic toys and popcorn.',
    'Practice a little every day. Speed comes from accuracy, and accuracy comes from staying calm when the clock starts to count down.',
    'The robot runner never stops. It jumps over walls, dodges drones and collects coins, and the city behind it keeps scrolling past in bright neon colours.',
    'Every brick in the wall has a weak spot. Bounce the ball at the right angle and watch the whole row break apart in a shower of sparks.',
    'Good games are easy to learn and hard to master. The rules fit on a single card, but you can spend years trying to play them perfectly.',
    'When the lights go out and the music fades, the last player standing types three letters into the high score table and walks home smiling.'
  ];

  const HARD = [
    'On level 3, a single gold coin is worth 5,000 points; by level 12, the board holds 13,000 sparks and 2 extra lives!',
    'Press [Enter] to continue, or hold {Shift} + Tab to go back. Score: 98,765 points (rank #4), time left: 0:42.',
    'Rule #1: never trust a "free" extra life. Rule #2: always check the corners. Rule #3? Read rules #1 and #2 again.',
    'The high-score table read: AAA 12,450; BOB 9,870; ZED 7,305. Nobody knew who "ZED" was, but everyone wanted to beat them.',
    'Combo x4 = 4 points per hit; golden moles x3 on top of that. Do the maths: 12 points for a single, perfect swing!',
    'Set the timer to 60s, keep accuracy above 95%, and aim for 50+ WPM; anything over 80 is world-class (or close to it).'
  ];

  const LEVELS = { easy: 'words', normal: 'passages', hard: 'symbols' };
  const DURATIONS = [30, 60];
  let g = { text: '', typed: '', started: false, over: false, left: 60, total: 0, correct: 0, timer: null, startAt: 0, prevLen: 0 };
  let e, spans = [];

  A.achievements([
    { id: 'type_40', game: 'typing', icon: '⌨️', name: 'Quick Fingers', desc: 'Type at 40 WPM or faster.' },
    { id: 'type_70', game: 'typing', icon: '🚀', name: 'Keyboard Warrior', desc: 'Type at 70 WPM or faster.' },
    { id: 'type_acc', game: 'typing', icon: '🎯', name: 'Precision', desc: 'Finish a test at 30+ WPM with 100% accuracy.' }
  ]);

  let quick = false; // the Gauntlet's 20-second version
  const duration = () => (quick ? 20 : A.data.modes.typingTime || 60);

  function generate(rand, minChars){
    const diff = A.difficulty('typing');
    let out = '';
    if (LEVELS[diff] === 'words') {
      while (out.length < minChars) out += (out ? ' ' : '') + COMMON[Math.floor(rand() * COMMON.length)];
      return out;
    }
    const pool = LEVELS[diff] === 'symbols' ? HARD.concat(PASSAGES.slice(0, 4)) : PASSAGES;
    const order = pool.map((p, i) => [rand(), i]).sort((a, b) => a[0] - b[0]).map(x => pool[x[1]]);
    let i = 0;
    while (out.length < minChars) { out += (out ? ' ' : '') + order[i % order.length]; i++; }
    return out;
  }

  function renderText(){
    e.text.innerHTML = '';
    spans = [...g.text].map(ch => {
      const s = document.createElement('span');
      s.textContent = ch;
      e.text.appendChild(s);
      return s;
    });
    paint(0, spans.length);
  }

  /* recolour only the characters between `from` and `to` */
  function paint(from, to){
    for (let i = Math.max(0, from); i < Math.min(spans.length, to); i++) {
      const typedCh = g.typed[i];
      spans[i].className = typedCh === undefined ? '' : typedCh === g.text[i] ? 'ok' : 'bad' + (g.text[i] === ' ' ? ' space' : '');
    }
    spans.forEach(s => s.classList.remove('cur'));
    const cur = spans[g.typed.length];
    if (cur) cur.classList.add('cur');
    scrollToCaret();
  }

  /* keep the current line as the second visible line */
  function scrollToCaret(){
    const cur = spans[g.typed.length] || spans[spans.length - 1];
    if (!cur) return;
    const lh = parseFloat(getComputedStyle(e.text).lineHeight) || 36;
    const y = Math.max(0, cur.offsetTop - lh);
    e.text.style.transform = `translateY(${-y}px)`;
  }

  const correctChars = () => { let n = 0; for (let i = 0; i < g.typed.length; i++) if (g.typed[i] === g.text[i]) n++; return n; };
  const elapsedMin = () => Math.max((performance.now() - g.startAt) / 60000, 5 / 60);
  const wpm = () => g.started ? Math.round(correctChars() / 5 / elapsedMin()) : 0;
  const accuracy = () => g.total ? Math.round(g.correct / g.total * 100) : 100;

  function updateMeta(){
    e.time.textContent = Math.ceil(g.left) + 's';
    e.wpm.textContent = wpm();
    e.acc.textContent = accuracy() + '%';
    e.timeStat.classList.toggle('urgent', g.started && g.left <= 5);
  }

  function reset(){
    stop();
    const rand = A.rngFor('typing');
    g = { text: generate(rand, 900), typed: '', started: false, over: false, left: duration(), total: 0, correct: 0, timer: null, startAt: 0 };
    e.diff.textContent = A.capitalize(A.difficulty('typing'));
    e.input.value = '';
    e.input.disabled = false;
    e.result.hidden = true;
    e.box.classList.remove('done');
    e.durBtns.forEach(b => {
      const on = Number(b.dataset.dur) === duration();
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    e.status.textContent = 'Start typing to begin the clock. Mistakes stay red; fix them or keep going.';
    renderText();
    updateMeta();
    focusInput();
  }

  function focusInput(){ if (!g.over) e.input.focus({ preventScroll: true }); }

  function begin(){
    g.started = true;
    g.startAt = performance.now();
    const endAt = g.startAt + duration() * 1000;
    A.sfx('start');
    g.timer = setInterval(() => {
      g.left = Math.max(0, (endAt - performance.now()) / 1000);
      updateMeta();
      if (g.left <= 0) finish();
    }, 100);
  }

  function onInput(){
    if (g.over) return;
    const val = e.input.value.replace(/\n/g, ' ');
    if (!g.started && val.length) begin();
    const prev = g.typed;
    // count each newly typed character once (backspacing is free)
    if (val.length > prev.length) {
      for (let i = prev.length; i < val.length; i++) {
        g.total++;
        if (val[i] === g.text[i]) { g.correct++; } else { A.sfx('error', 0.03); }
      }
      if (val[val.length - 1] === g.text[val.length - 1]) A.sfx('key', 0.03);
    }
    g.typed = val.slice(0, g.text.length);
    paint(Math.min(prev.length, g.typed.length) - 1, Math.max(prev.length, g.typed.length) + 1);
    updateMeta();
    // ran out of passage: add more
    if (g.text.length - g.typed.length < 120) {
      const more = ' ' + generate(Math.random, 400);
      g.text += more;
      [...more].forEach(ch => { const s = document.createElement('span'); s.textContent = ch; e.text.appendChild(s); spans.push(s); });
    }
  }

  function finish(){
    if (g.over) return;
    g.over = true;
    clearInterval(g.timer);
    e.input.disabled = true;
    e.box.classList.add('done');
    const minutes = duration() / 60;
    const net = Math.round(correctChars() / 5 / minutes);
    const raw = Math.round(g.typed.length / 5 / minutes);
    const acc = accuracy();
    g.left = 0;
    updateMeta();
    e.wpm.textContent = net;

    const diff = A.difficulty('typing');
    const tickets = Math.floor(net / 8) + (acc >= 95 && net >= 20 ? 2 : 0) + (diff === 'hard' ? 2 : 0);
    A.addScore(net * 2);
    A.payout(tickets);
    A.sfx(net > 0 ? 'win' : 'over');
    if (net >= 40) { A.unlock('type_40'); A.fx.confetti(); }
    if (net >= 70) A.unlock('type_70');
    if (net >= 30 && acc === 100) A.unlock('type_acc');
    if (net > 0) A.unlock('first_win');

    e.rWpm.textContent = net;
    e.rAcc.textContent = acc + '%';
    e.rRaw.textContent = raw;
    e.rChars.textContent = `${correctChars()} / ${g.typed.length}`;
    e.rTickets.textContent = '+' + tickets;
    e.result.hidden = false;
    e.again.focus({ preventScroll: true });
    e.status.textContent = net >= 40 ? 'Great speed.' : 'Keep practising; accuracy first, speed follows.';
    g.net = net;
    g.acc = acc;
    A.emit('result', { game: 'typing', wpm: net, accuracy: acc });
    A.submitScore('typing', net);
    A.roundOver('typing');
  }

  function stop(){ clearInterval(g.timer); g.timer = null; }

  A.registerGame({
    id: 'typing', name: 'TYPING TEST', title: 'Type Racer', marquee: 'TYPE RACER',
    label: 'Speed Test', color: 'cyan', hasDifficulty: true,
    blurb: 'Easy: common words. Normal: sentences. Hard: numbers and symbols.',
    hiscore: { label: 'Best words per minute', unit: 'WPM' },
    gauntlet: {
      seconds: 21, goal: 'Type as fast and accurately as you can for 20 seconds.',
      go(){ begin(); focusInput(); },
      result(){
        const net = g.net ?? Math.round(correctChars() / 5 / elapsedMin());
        const acc = g.acc ?? accuracy();
        return { points: Math.round(net * 14 * acc / 100), detail: `${net} WPM, ${acc}% accuracy` };
      }
    },
    mini: `<div class="mini-type"><span class="ok">neon</span> <span class="ok">arc</span><span class="cur">a</span>de</div>`,
    build(body){
      body.innerHTML = `
        <div class="seg" role="group" aria-label="Test length">
          ${DURATIONS.map(d => `<button class="seg-opt" data-dur="${d}">${d} seconds</button>`).join('')}
        </div>
        <div class="game-meta">
          <div class="stat"><span>Difficulty</span><b data-el="diff">Normal</b></div>
          <div class="stat" data-el="timeStat"><span>Time</span><b data-el="time">60s</b></div>
          <div class="stat"><span>WPM</span><b data-el="wpm">0</b></div>
          <div class="stat"><span>Accuracy</span><b data-el="acc">100%</b></div>
        </div>
        <div class="screen type-screen" data-el="screen">
          <div class="type-box" data-el="box">
            <div class="type-text" data-el="text" aria-hidden="true"></div>
            <textarea class="type-input" data-el="input" aria-label="Type the passage here" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
          </div>
          <div class="screen-overlay type-result" data-el="result" hidden>
            <h3>Time!</h3>
            <div class="result-grid">
              <div><b data-el="rWpm">0</b><span>WPM</span></div>
              <div><b data-el="rAcc">0%</b><span>Accuracy</span></div>
              <div><b data-el="rRaw">0</b><span>Raw WPM</span></div>
              <div><b data-el="rChars">0</b><span>Correct chars</span></div>
              <div><b data-el="rTickets">+0</b><span>Tickets</span></div>
            </div>
            <button class="play-btn small" data-el="again">New passage</button>
          </div>
        </div>
        <p class="game-status" data-el="status" aria-live="polite"></p>
        <button class="reset-btn" data-el="reset">Restart</button>`;
      e = A.els(body);
      e.durBtns = [...body.querySelectorAll('.seg-opt')];
      e.input.addEventListener('input', onInput);
      e.input.addEventListener('paste', ev => ev.preventDefault());
      e.input.addEventListener('keydown', ev => { if (ev.key === 'Enter') ev.preventDefault(); });
      e.box.addEventListener('click', focusInput);
      e.reset.addEventListener('click', reset);
      e.again.addEventListener('click', reset);
      e.durBtns.forEach(b => b.addEventListener('click', () => {
        A.data.modes.typingTime = Number(b.dataset.dur);
        A.save();
        A.sfx('click');
        reset();
      }));
    },
    start(opts = {}){ quick = !!opts.gauntlet; reset(); },
    stop,
    onKey(ev){
      if (ev.key === 'Enter' && g.over && document.activeElement !== e.again) { ev.preventDefault(); reset(); }
    }
  });
})();
