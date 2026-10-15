'use strict';
/* =========================================================
   ROCK PAPER SCISSORS — the CPU only learns from past rounds,
   it never sees your current pick.
========================================================= */
(() => {
  const A = Arcade;
  const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };
  const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  const COUNTER = { rock: 'paper', paper: 'scissors', scissors: 'rock' }; // the move that beats the key
  const OPTIONS = ['rock', 'paper', 'scissors'];
  const g = { history: [], lastCpu: null, lock: false };
  let e;

  A.achievements([
    { id: 'rps_streak3', game: 'rps', icon: '🔥', name: 'Hot Streak', desc: 'Win 3 rounds in a row.' },
    { id: 'rps_streak5', game: 'rps', icon: '⚡', name: 'On Fire', desc: 'Win 5 rounds in a row.' },
    { id: 'rps_25wins', game: 'rps', icon: '✊', name: 'Hand Master', desc: 'Win 25 rounds in total.' }
  ]);

  function record(){
    e.streak.textContent = A.getStat('rpsStreak');
    e.record.textContent = `${A.getStat('rpsW')}-${A.getStat('rpsL')}-${A.getStat('rpsD')}`;
  }

  function cpuChoice(){
    const diff = A.difficulty('rps');
    const random = () => OPTIONS[Math.floor(Math.random() * 3)];
    if (diff === 'easy') {
      // predictable: repeats its own last move half the time
      if (g.lastCpu && Math.random() < 0.5) return g.lastCpu;
      return random();
    }
    if (diff === 'hard' && g.history.length >= 3 && Math.random() < 0.6) {
      // counters your most frequent move over the last 10 rounds
      const counts = { rock: 0, paper: 0, scissors: 0 };
      g.history.slice(-10).forEach(m => counts[m]++);
      const likely = OPTIONS.reduce((a, b) => counts[b] > counts[a] ? b : a);
      return COUNTER[likely];
    }
    return random();
  }

  function play(choice){
    if (g.lock) return;
    g.lock = true;
    e.choices.forEach(b => b.disabled = true);
    const cpu = cpuChoice();
    g.lastCpu = cpu;
    g.history.push(choice);
    A.sfx('click');

    [e.you, e.cpu].forEach(h => {
      h.classList.remove('win');
      h.textContent = '?';
      h.classList.remove('shake-hand');
      void h.offsetWidth;
      h.classList.add('shake-hand');
    });

    setTimeout(() => {
      e.you.textContent = EMOJI[choice];
      e.cpu.textContent = EMOJI[cpu];
      e.you.classList.remove('shake-hand');
      e.cpu.classList.remove('shake-hand');
      const diff = A.difficulty('rps');

      if (choice === cpu) {
        A.stat('rpsD');
        e.status.textContent = 'Draw. Go again.';
        A.sfx('bounce');
      } else if (BEATS[choice] === cpu) {
        A.stat('rpsW');
        const streak = A.stat('rpsStreak');
        A.statMax('rpsStreakBest', streak);
        const pts = { easy: 5, normal: 10, hard: 18 }[diff];
        A.addScore(pts);
        A.payout(1 + (streak >= 3 ? 1 : 0) + (diff === 'hard' ? 1 : 0));
        e.you.classList.add('win');
        e.status.textContent = `${A.capitalize(choice)} beats ${cpu}. +${pts} pts`;
        A.sfx('match');
        A.fx.burstAt(e.you, { count: 16 });
        A.unlock('first_win');
        if (streak >= 3) A.unlock('rps_streak3');
        if (streak >= 5) A.unlock('rps_streak5');
        if (A.getStat('rpsW') >= 25) A.unlock('rps_25wins');
      } else {
        A.stat('rpsL');
        const lost = A.getStat('rpsStreak');
        A.data.stats.rpsStreak = 0;
        A.save();
        e.cpu.classList.add('win');
        e.status.textContent = `${A.capitalize(cpu)} beats ${choice}. CPU wins.`;
        A.sfx('lose');
        A.fx.shake(e.screen);
        if (lost > 0) A.submitScore('rps', lost); // a broken streak can make the table
      }
      record();
      A.emit('result', { game: 'rps', streak: A.getStat('rpsStreak') });
      e.choices.forEach(b => b.disabled = false);
      g.lock = false;
    }, 450);
  }

  A.registerGame({
    id: 'rps', name: 'ROCK PAPER SCISSORS', title: 'Rock·Paper·Scissors', marquee: 'ROCK·PAPER·SCISSORS',
    label: 'Duel vs CPU', color: 'red', hasDifficulty: true,
    blurb: 'Hard mode learns your habits.',
    hiscore: { label: 'Longest winning streak', unit: 'wins' },
    mini: `<div class="mini-rps"><span>✊</span><span>✋</span><span>✌️</span></div>`,
    build(body){
      body.innerHTML = `
        <div class="game-meta">
          <div class="stat"><span>Difficulty</span><b data-el="diff">Normal</b></div>
          <div class="stat"><span>Streak</span><b data-el="streak">0</b></div>
          <div class="stat"><span>W-L-D</span><b data-el="record">0-0-0</b></div>
        </div>
        <div class="screen" data-el="screen">
          <div class="rps-arena">
            <div class="rps-side"><span class="rps-tag">You</span><div class="rps-hand" data-el="you">?</div></div>
            <div class="rps-vs">VS</div>
            <div class="rps-side"><span class="rps-tag">CPU</span><div class="rps-hand" data-el="cpu">?</div></div>
          </div>
        </div>
        <p class="game-status" data-el="status" aria-live="polite"></p>
        <div class="rps-choices">
          <button class="rps-choice" data-choice="rock">✊<span>Rock <kbd>R</kbd></span></button>
          <button class="rps-choice" data-choice="paper">✋<span>Paper <kbd>P</kbd></span></button>
          <button class="rps-choice" data-choice="scissors">✌️<span>Scissors <kbd>S</kbd></span></button>
        </div>`;
      e = A.els(body);
      e.choices = [...body.querySelectorAll('.rps-choice')];
      e.choices.forEach(b => b.addEventListener('click', () => play(b.dataset.choice)));
    },
    start(){
      e.diff.textContent = A.capitalize(A.difficulty('rps'));
      e.status.textContent = 'Make your move.';
      e.you.textContent = '?';
      e.cpu.textContent = '?';
      e.you.classList.remove('win');
      e.cpu.classList.remove('win');
      record();
    },
    onKey(ev){
      const map = { r: 'rock', p: 'paper', s: 'scissors' };
      const k = ev.key.toLowerCase();
      if (map[k] && !ev.ctrlKey && !ev.metaKey) play(map[k]);
    }
  });
})();
