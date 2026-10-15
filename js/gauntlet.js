'use strict';
/* =========================================================
   THE GAUNTLET — five quick rounds of different games, back to back.
   Each round scores up to 1,000 points; the total goes on its own
   high-score table and pays out once at the end.

   A game joins the Gauntlet by adding a `gauntlet` block to its
   registerGame({...}) definition:
     gauntlet: {
       seconds,          // time limit for the round
       goal,             // one sentence shown before the countdown
       go(),             // start playing (called after 3-2-1)
       result(left)      // → { points, detail } when the round ends
     }
   and by calling Arcade.roundOver(id) when its run ends by itself.
========================================================= */
(() => {
  const A = Arcade;
  const ROUNDS = 5;
  const MAX_ROUND = 1000;
  let run = null;          // the run in progress
  let navigating = false;  // true while the Gauntlet itself is switching screens
  let e;                   // elements on the Gauntlet screen
  const bar = {}, ov = {}; // the bottom bar and the countdown overlay

  A.achievements([
    { id: 'gx_finish', game: 'gauntlet', icon: '🛡️', name: 'Iron Will', desc: 'Finish the Gauntlet.' },
    { id: 'gx_3000', game: 'gauntlet', icon: '⚔️', name: 'Champion', desc: 'Score 3,000 or more in the Gauntlet.' },
    { id: 'gx_allround', game: 'gauntlet', icon: '🎖️', name: 'All-Rounder', desc: 'Score 500+ in every Gauntlet round.' }
  ]);

  const pool = () => A.games.filter(g => g.gauntlet);
  function shuffle(a){
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const clock = s => `0:${String(Math.max(0, Math.ceil(s))).padStart(2, '0')}`;

  /* ---------------- run flow ---------------- */
  function startRun(){
    const lineup = shuffle(pool().map(g => g.id)).slice(0, ROUNDS);
    run = { lineup, i: 0, results: [], total: 0, phase: 'countdown', lock: true, timer: null, endAt: 0, current: null };
    A.setGauntlet(run);
    A.sfx('start');
    bar.el.hidden = false;
    nextRound();
  }

  function nextRound(){
    const id = run.lineup[run.i];
    const g = A.gameById[id];
    run.current = id;
    run.phase = 'countdown';
    run.lock = true;
    go(() => A.play(id, { gauntlet: true }));
    bar.el.style.setProperty('--cab', `var(--${g.color})`);
    updateBar(g.gauntlet.seconds);

    // round card, then 3-2-1
    showOverlay(g, `Round ${run.i + 1} of ${ROUNDS}`, g.title, g.gauntlet.goal, '');
    let n = 3;
    const step = () => {
      if (!run || run.current !== id) return;
      if (n > 0) {
        ov.count.textContent = n;
        A.fx.bump(ov.count);
        A.sfx('tick', 0.1);
        n--;
        run.countTimer = setTimeout(step, 750);
      } else {
        ov.count.textContent = 'GO!';
        A.sfx('start');
        run.countTimer = setTimeout(() => beginRound(id), 450);
      }
    };
    run.countTimer = setTimeout(step, 1300);
  }

  function beginRound(id){
    if (!run || run.current !== id) return;
    const g = A.gameById[id];
    ov.el.hidden = true;
    run.phase = 'play';
    run.lock = false;
    run.endAt = performance.now() + g.gauntlet.seconds * 1000;
    g.gauntlet.go();
    run.timer = setInterval(() => {
      const left = (run.endAt - performance.now()) / 1000;
      updateBar(left);
      if (left <= 0) endRound();
    }, 100);
  }

  function endRound(){
    if (!run || run.phase !== 'play') return;
    run.phase = 'between';
    run.lock = true;
    clearInterval(run.timer);
    const id = run.current;
    const g = A.gameById[id];
    const left = Math.max(0, (run.endAt - performance.now()) / 1000);
    const r = g.gauntlet.result(left) || { points: 0, detail: '' };
    const points = Math.round(A.clamp(r.points || 0, 0, MAX_ROUND));
    if (g.stop) g.stop();
    run.results.push({ id, title: g.title, color: g.color, points, detail: r.detail || '' });
    run.total += points;
    updateBar(0);
    A.sfx(points >= 500 ? 'win' : 'match');
    if (points >= 700) A.fx.confetti();

    const last = run.i === ROUNDS - 1;
    showOverlay(g, `Round ${run.i + 1} complete`, `+${A.fmt(points)}`, r.detail || '', `Total ${A.fmt(run.total)}`);
    ov.count.textContent = '';
    run.countTimer = setTimeout(() => {
      if (!run) return;
      run.i++;
      if (last) finish(); else nextRound();
    }, 2200);
  }

  function finish(){
    const results = run.results;
    const total = run.total;
    clearTimeout(run.countTimer);
    run = null;
    A.setGauntlet(null); // switch scoring back on before paying out
    hideChrome();
    go(() => A.show('gauntlet'));

    const allRound = results.every(r => r.points >= 500);
    const tickets = Math.floor(total / 120) + (allRound ? 5 : 0);
    A.addScore(total / 15);
    A.payout(tickets);
    A.sfx('win');
    A.fx.confetti();
    A.unlock('gx_finish');
    if (total >= 3000) A.unlock('gx_3000');
    if (allRound) A.unlock('gx_allround');
    renderResults(results, total, tickets);
    renderIntro();
    A.emit('result', { game: 'gauntlet', total });
    A.submitScore('gauntlet', total).then(renderIntro);
  }

  function abort(){
    if (!run) return;
    clearInterval(run.timer);
    clearTimeout(run.countTimer);
    const g = A.gameById[run.current];
    run = null;
    A.setGauntlet(null);
    hideChrome();
    if (g && g.stop) g.stop();
    A.toast('🛡️ Gauntlet abandoned. No tickets this time.');
  }

  /* screen switches made by the Gauntlet itself must not count as leaving */
  function go(fn){ navigating = true; try { fn(); } finally { navigating = false; } }
  A.on('screen', () => { if (run && !navigating) abort(); });
  A.on('roundOver', id => { if (run && run.phase === 'play' && run.current === id) setTimeout(endRound, 500); });
  A.on('gauntletHidden', () => { if (run && run.phase === 'play') endRound(); });

  /* ---------------- bar + overlay ---------------- */
  function updateBar(left){
    if (!run) return;
    const g = A.gameById[run.current];
    bar.round.textContent = `Round ${run.i + 1}/${ROUNDS}`;
    bar.game.textContent = g.title;
    bar.time.textContent = clock(left);
    bar.total.textContent = A.fmt(run.total);
    bar.fill.style.width = `${A.clamp(left / g.gauntlet.seconds, 0, 1) * 100}%`;
    bar.el.classList.toggle('urgent', run.phase === 'play' && left <= 5);
  }
  function showOverlay(g, eyebrow, title, text, foot){
    ov.el.style.setProperty('--cab', `var(--${g.color})`);
    ov.eyebrow.textContent = eyebrow;
    ov.title.textContent = title;
    ov.text.textContent = text;
    ov.foot.textContent = foot;
    ov.count.textContent = '';
    ov.el.hidden = false;
  }
  function hideChrome(){ bar.el.hidden = true; ov.el.hidden = true; }

  /* ---------------- the Gauntlet screen ---------------- */
  function renderIntro(){
    if (!e) return;
    e.games.innerHTML = pool().map(g => `<span class="gx-chip" style="--cab:var(--${g.color})">${g.title}</span>`).join('');
    const top = A.best('gauntlet');
    e.best.textContent = top ? `${A.fmt(top.value)} by ${top.name}` : 'No runs yet';
  }
  function renderResults(results, total, tickets){
    e.results.hidden = false;
    e.rows.innerHTML = results.map((r, i) => `
      <li style="--cab:var(--${r.color})">
        <span class="gx-n">${i + 1}</span>
        <span class="gx-game"><b>${r.title}</b><small>${r.detail}</small></span>
        <span class="gx-meter"><i style="width:${r.points / MAX_ROUND * 100}%"></i></span>
        <span class="gx-pts">${A.fmt(r.points)}</span>
      </li>`).join('');
    e.total.textContent = A.fmt(total);
    e.tickets.textContent = `+${tickets} 🎟`;
  }

  A.registerGame({
    id: 'gauntlet', name: 'THE GAUNTLET', title: 'The Gauntlet', marquee: 'THE GAUNTLET',
    label: 'Five-Game Run', color: 'yellow', hasDifficulty: false, plate: '5 rounds · Normal',
    blurb: 'Five random games, back to back. Up to 1,000 points a round.',
    hiscore: { label: 'Best total (out of 5,000)', unit: 'pts' },
    mini: `<div class="mini-gx"><span></span><span></span><span></span><span></span><span></span></div>`,
    build(body){
      body.innerHTML = `
        <div class="screen gx-screen">
          <p class="gx-lead">Five random games, back to back, each a short version played on Normal.
          Every round scores up to <b>1,000</b> points. Quitting mid-run forfeits the tickets.</p>
          <div class="gx-chips" data-el="games"></div>
          <p class="gx-best">Best run: <b data-el="best"></b></p>
          <button class="play-btn" data-el="start">Start the Gauntlet</button>
        </div>
        <div class="gx-results" data-el="results" hidden>
          <h3>Last run</h3>
          <ol class="gx-rows" data-el="rows"></ol>
          <div class="gx-sum">
            <div><span>Total</span><b data-el="total">0</b></div>
            <div><span>Tickets</span><b data-el="tickets">+0</b></div>
          </div>
        </div>`;
      e = A.els(body);
      e.start.addEventListener('click', startRun);

      // the bottom bar and the countdown overlay live outside the screens
      const b = A.$('gxBar');
      Object.assign(bar, { el: b, round: b.querySelector('.gxb-round'), game: b.querySelector('.gxb-game'), time: b.querySelector('.gxb-time'), total: b.querySelector('.gxb-total'), fill: b.querySelector('.gxb-fill') });
      b.querySelector('.gxb-quit').addEventListener('click', () => { go(() => A.show('floor')); abort(); });
      const o = A.$('gxOverlay');
      Object.assign(ov, { el: o, eyebrow: o.querySelector('.gxo-eyebrow'), title: o.querySelector('.gxo-title'), text: o.querySelector('.gxo-text'), foot: o.querySelector('.gxo-foot'), count: o.querySelector('.gxo-count') });
      renderIntro();
    },
    start(){ renderIntro(); },
    stop(){ /* leaving the intro screen; an active run is handled by the 'screen' listener */ },
    onKey(ev){
      if (ev.key === 'Enter' && !run && document.activeElement !== e.start) { ev.preventDefault(); startRun(); }
    }
  });
})();
