'use strict';
/* =========================================================
   HANGMAN — guess the word by category. The neon figure
   draws itself one stroke per wrong guess.
========================================================= */
(() => {
  const A = Arcade;
  const WORDS = {
    Animals: ['PENGUIN','GIRAFFE','OCTOPUS','CHEETAH','FLAMINGO','PANTHER','HEDGEHOG','KANGAROO','PLATYPUS','CHAMELEON','BUFFALO','MEERKAT','PORCUPINE','RHINOCEROS','PANGOLIN'],
    Space: ['GALAXY','NEBULA','ASTEROID','SATELLITE','ECLIPSE','COMET','METEOR','SUPERNOVA','GRAVITY','ORBIT','TELESCOPE','ASTRONAUT','QUASAR','CONSTELLATION','JUPITER'],
    Food: ['PANCAKE','BURRITO','LASAGNA','AVOCADO','PRETZEL','DUMPLING','MACARONI','BISCUIT','CROISSANT','PINEAPPLE','BROCCOLI','CHEESECAKE','BILTONG','BOBOTIE','KOEKSISTER'],
    Countries: ['BRAZIL','NORWAY','KENYA','VIETNAM','MOROCCO','ARGENTINA','PORTUGAL','ICELAND','NAMIBIA','INDONESIA','SWITZERLAND','BOTSWANA','JAMAICA','MONGOLIA','MADAGASCAR'],
    Arcade: ['JOYSTICK','PINBALL','HIGHSCORE','JACKPOT','CABINET','TOKEN','CONSOLE','PIXEL','POWERUP','CONTINUE','MULTIPLAYER','LEADERBOARD','CHECKPOINT','GAMEPAD','SPRITE'],
    Music: ['GUITAR','TRUMPET','MELODY','RHYTHM','ORCHESTRA','SAXOPHONE','TAMBOURINE','KEYBOARD','VIOLIN','HARMONICA','XYLOPHONE','ACCORDION','DRUMMER','SYMPHONY','MARIMBA']
  };
  const LEVELS = {
    easy:   { lives: 8, reveal: 1, minLen: 0 },
    normal: { lives: 6, reveal: 0, minLen: 0 },
    hard:   { lives: 5, reveal: 0, minLen: 8 }
  };
  const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  const PARTS = 8; // rope, head, body, arm, arm, leg, leg, face
  let g = { word: '', category: '', guessed: new Set(), wrong: 0, lives: 6, over: true, streak: 0, points: 0 };
  let e, keys = {}, parts = [];

  A.achievements([
    { id: 'hang_win', game: 'hangman', icon: '🔤', name: 'Wordsmith', desc: 'Guess a word in Hangman.' },
    { id: 'hang_streak5', game: 'hangman', icon: '📚', name: 'Lexicon', desc: 'Guess 5 words in a row.' },
    { id: 'hang_flawless', game: 'hangman', icon: '😇', name: 'Untouchable', desc: 'Guess a word with no wrong letters.' }
  ]);

  function pickWord(rand){
    const lv = LEVELS[A.difficulty('hangman')];
    const cats = Object.keys(WORDS);
    let category, word, guard = 0;
    do {
      category = cats[Math.floor(rand() * cats.length)];
      const list = WORDS[category];
      word = list[Math.floor(rand() * list.length)];
    } while (word.length < lv.minLen && ++guard < 50);
    return { category, word };
  }

  function newWord(){
    const lv = LEVELS[A.difficulty('hangman')];
    // during the daily challenge the first word is today's shared word; later ones are random
    g.isDailyWord = A.isDaily('hangman') && !g.dailyUsed;
    if (g.isDailyWord) g.dailyUsed = true;
    const { category, word } = pickWord(g.isDailyWord ? A.rngFor('hangman') : Math.random);
    g.word = word;
    g.category = category;
    g.guessed = new Set();
    g.wrong = 0;
    g.lives = lv.lives;
    g.over = false;
    g.won = false;
    // Easy mode gives one letter for free
    if (lv.reveal) {
      const letters = [...new Set(word)];
      g.guessed.add(letters[Math.floor(Math.random() * letters.length)]);
    }
    Object.values(keys).forEach(k => { k.disabled = false; k.className = 'key'; });
    g.guessed.forEach(l => { keys[l].disabled = true; keys[l].classList.add('hit'); });
    parts.forEach(p => p.classList.remove('show'));
    e.gallows.classList.remove('lost', 'won');
    e.category.textContent = category;
    e.next.hidden = true;
    e.status.textContent = 'Pick a letter. Type on your keyboard or tap below.';
    render();
  }

  function render(){
    e.word.innerHTML = [...g.word].map(ch => {
      const shown = g.guessed.has(ch) || g.over;
      const missed = g.over && !g.guessed.has(ch);
      return `<span class="slot${shown ? ' filled' : ''}${missed ? ' missed' : ''}">${shown ? ch : ''}</span>`;
    }).join('');
    e.lives.textContent = g.lives - g.wrong;
    e.streak.textContent = g.streak;
    e.points.textContent = A.fmt(g.points);
    e.diff.textContent = A.capitalize(A.difficulty('hangman'));
    // show figure parts in proportion to lives used, so every difficulty ends on a full figure
    const show = Math.ceil(g.wrong * PARTS / g.lives);
    parts.forEach((p, i) => p.classList.toggle('show', i < show));
  }

  function guess(letter){
    if (g.over || g.guessed.has(letter)) return;
    g.guessed.add(letter);
    const key = keys[letter];
    key.disabled = true;
    if (g.word.includes(letter)) {
      key.classList.add('hit');
      A.sfx('match');
      if ([...g.word].every(ch => g.guessed.has(ch))) return win();
    } else {
      key.classList.add('miss');
      g.wrong++;
      A.sfx('error');
      A.fx.shake(e.gallows);
      if (g.wrong >= g.lives) return lose();
    }
    render();
  }

  function win(){
    g.over = true;
    g.won = true;
    g.streak++;
    const diff = A.difficulty('hangman');
    const livesLeft = g.lives - g.wrong;
    const pts = { easy: 10, normal: 20, hard: 35 }[diff] + livesLeft * 3;
    g.points += pts;
    A.addScore(pts);
    A.payout(2 + (diff === 'hard' ? 2 : 0) + (g.streak >= 3 ? 1 : 0));
    e.gallows.classList.add('won');
    e.status.textContent = `Got it! +${pts} pts. Streak: ${g.streak}`;
    e.next.textContent = 'Next word';
    e.next.hidden = false;
    e.next.focus({ preventScroll: true });
    A.sfx('win');
    A.fx.burstAt(e.word, { count: 30 });
    A.unlock('first_win');
    A.unlock('hang_win');
    if (g.wrong === 0) A.unlock('hang_flawless');
    if (g.streak >= 5) A.unlock('hang_streak5');
    A.emit('result', { game: 'hangman', win: true, streak: g.streak, dailyWord: g.isDailyWord });
    render();
    A.roundOver('hangman');
  }

  function lose(){
    g.over = true;
    const streak = g.streak;
    e.gallows.classList.add('lost');
    e.status.textContent = `Out of lives. The word was ${g.word}.`;
    e.next.textContent = 'New game';
    e.next.hidden = false;
    e.next.focus({ preventScroll: true });
    A.sfx('over');
    A.emit('result', { game: 'hangman', win: false, streak, dailyWord: g.isDailyWord });
    render();
    if (streak > 0) A.submitScore('hangman', streak);
    A.roundOver('hangman');
    g.streak = 0;
    g.points = 0;
  }

  function next(){ newWord(); }

  A.registerGame({
    id: 'hangman', name: 'HANGMAN', title: 'Hangman', marquee: 'HANGMAN',
    label: 'Word Hunt', color: 'violet', hasDifficulty: true,
    blurb: 'Guess the word before the figure is complete.',
    hiscore: { label: 'Most words in a row', unit: 'words' },
    gauntlet: {
      seconds: 30, goal: 'Guess one word. The faster you get it, with fewer wrong letters, the more it scores.',
      go(){},
      result(left){
        const found = [...new Set(g.word)].filter(l => g.guessed.has(l)).length;
        const lives = g.lives - g.wrong;
        return g.won
          ? { points: 400 + lives * 60 + Math.round(left) * 8, detail: `${g.word} in ${30 - Math.round(left)}s` }
          : { points: found * 45, detail: `${found} letters of ${g.word}` };
      }
    },
    mini: `<svg class="mini-hang" viewBox="0 0 60 60" aria-hidden="true"><path d="M8 54h30M16 54V8h22v8"/><circle cx="38" cy="22" r="6"/><path d="M38 28v14M38 32l-7 6M38 32l7 6M38 42l-6 9M38 42l6 9"/></svg>`,
    build(body){
      body.innerHTML = `
        <div class="game-meta">
          <div class="stat"><span>Difficulty</span><b data-el="diff">Normal</b></div>
          <div class="stat"><span>Lives</span><b data-el="lives">6</b></div>
          <div class="stat"><span>Streak</span><b data-el="streak">0</b></div>
          <div class="stat"><span>Points</span><b data-el="points">0</b></div>
        </div>
        <div class="screen hang-screen">
          <svg class="gallows" data-el="gallows" viewBox="0 0 200 200" aria-hidden="true">
            <path class="frame" d="M20 188h110M50 188V16h90M50 50l34-34"/>
            <path class="part" pathLength="1" d="M140 16v26"/>
            <circle class="part" pathLength="1" cx="140" cy="58" r="16"/>
            <path class="part" pathLength="1" d="M140 74v52"/>
            <path class="part" pathLength="1" d="M140 88l-24 22"/>
            <path class="part" pathLength="1" d="M140 88l24 22"/>
            <path class="part" pathLength="1" d="M140 126l-20 34"/>
            <path class="part" pathLength="1" d="M140 126l20 34"/>
            <path class="part face" pathLength="1" d="M132 52l5 5m0-5l-5 5M143 52l5 5m0-5l-5 5"/>
          </svg>
          <div class="hang-side">
            <p class="hang-cat">Category: <b data-el="category"></b></p>
            <div class="hang-word" data-el="word" aria-live="polite"></div>
          </div>
        </div>
        <p class="game-status" data-el="status" aria-live="polite"></p>
        <button class="play-btn small" data-el="next" hidden>Next word</button>
        <div class="keyboard" data-el="keyboard"></div>`;
      e = A.els(body);
      parts = [...e.gallows.querySelectorAll('.part')];
      ROWS.forEach(row => {
        const r = document.createElement('div');
        r.className = 'key-row';
        [...row].forEach(l => {
          const k = document.createElement('button');
          k.className = 'key';
          k.textContent = l;
          k.addEventListener('click', () => guess(l));
          keys[l] = k;
          r.appendChild(k);
        });
        e.keyboard.appendChild(r);
      });
      e.next.addEventListener('click', next);
    },
    start(){
      g.dailyUsed = false;
      g.streak = 0;
      g.points = 0;
      newWord();
    },
    onKey(ev){
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (/^[a-z]$/i.test(ev.key)) { guess(ev.key.toUpperCase()); return; }
      if (ev.key === 'Enter' && g.over && document.activeElement !== e.next) { ev.preventDefault(); next(); }
    }
  });
})();
