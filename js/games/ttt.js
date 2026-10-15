'use strict';
/* =========================================================
   TIC-TAC-TOE — vs CPU (easy / normal / minimax hard) or 2 players
========================================================= */
(() => {
  const A = Arcade;
  const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const g = { board: Array(9).fill(null), turn: 'X', active: false, winLine: null, gen: 0, last: -1 };
  let e, cells = [];

  A.achievements([
    { id: 'ttt_hard_win', game: 'ttt', icon: '🧠', name: 'Unbeatable Mind', desc: 'Beat the CPU at Tic-Tac-Toe on Hard.' },
    { id: 'ttt_5wins', game: 'ttt', icon: '⭕', name: 'Grid Master', desc: 'Win 5 games against the CPU.' },
    { id: 'ttt_pvp', game: 'ttt', icon: '🤝', name: 'Rivals', desc: 'Finish a 2-player game.' }
  ]);

  const mode = () => A.data.modes.ttt || 'cpu';

  function winner(bd){
    for (const [a,b,c] of WINS) if (bd[a] && bd[a] === bd[b] && bd[a] === bd[c]) return { player: bd[a], line: [a,b,c] };
    if (bd.every(v => v)) return { player: 'draw' };
    return null;
  }

  function render(){
    g.board.forEach((val, i) => {
      const cell = cells[i];
      cell.textContent = val || '';
      cell.className = 'ttt-cell' + (val === 'O' ? ' o' : '') +
        (g.winLine && g.winLine.includes(i) ? ' win' : '') + (i === g.last ? ' fresh' : '');
      const cpuTurn = mode() === 'cpu' && g.turn === 'O';
      cell.disabled = !g.active || !!val || cpuTurn;
      cell.setAttribute('aria-label', `Square ${i + 1}${val ? ', ' + val : ''}`);
    });
  }

  function setTurnText(){
    e.turn.textContent = !g.active ? '—' : mode() === 'cpu' && g.turn === 'O' ? 'CPU' : g.turn;
  }

  function start(){
    g.gen++; // cancels a CPU move still pending from the previous round
    g.board = Array(9).fill(null);
    g.turn = 'X';
    g.active = true;
    g.winLine = null;
    g.last = -1;
    const pvp = mode() === 'pvp';
    e.modeBtns.forEach(b => {
      const on = b.dataset.mode === mode();
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    e.diff.textContent = pvp ? '2 players' : A.capitalize(A.difficulty('ttt'));
    e.wins.textContent = A.getStat('tttWins');
    e.status.textContent = pvp ? "X's turn." : 'Your move, X.';
    setTurnText();
    render();
  }

  function place(i){
    if (!g.active || g.board[i]) return;
    if (mode() === 'cpu' && g.turn !== 'X') return;
    g.board[i] = g.turn;
    g.last = i;
    A.sfx('click');
    if (checkEnd()) return;

    if (mode() === 'pvp') {
      g.turn = g.turn === 'X' ? 'O' : 'X';
      e.status.textContent = `${g.turn}'s turn.`;
      setTurnText();
      render();
      return;
    }
    g.turn = 'O';
    setTurnText();
    e.status.textContent = 'CPU thinking...';
    render();
    const gen = g.gen;
    setTimeout(() => {
      if (gen !== g.gen) return; // round was reset or the player left
      g.last = cpuMove();
      A.sfx('flip');
      if (checkEnd()) return;
      g.turn = 'X';
      setTurnText();
      e.status.textContent = 'Your move, X.';
      render();
    }, 450);
  }

  function checkEnd(){
    const res = winner(g.board);
    if (!res) return false;
    g.active = false;
    g.winLine = res.line || null;
    setTurnText();
    render();
    const diff = A.difficulty('ttt');

    if (mode() === 'pvp') {
      A.unlock('ttt_pvp');
      if (res.player === 'draw') { e.status.textContent = "It's a draw."; A.sfx('lose'); }
      else { e.status.textContent = `${res.player} wins!`; A.sfx('win'); A.fx.confetti(); }
      return true;
    }

    A.stat('tttPlayed');
    if (res.player === 'draw') {
      e.status.textContent = 'Draw. +5 pts';
      A.addScore(5);
      A.payout(1);
      A.sfx('match');
    } else if (res.player === 'X') {
      const pts = { easy: 10, normal: 20, hard: 40 }[diff];
      const tickets = { easy: 2, normal: 4, hard: 8 }[diff];
      e.status.textContent = `You win! +${pts} pts`;
      A.addScore(pts);
      A.payout(tickets);
      const wins = A.stat('tttWins');
      e.wins.textContent = wins;
      A.sfx('win');
      A.fx.confetti();
      A.unlock('first_win');
      if (diff === 'hard') A.unlock('ttt_hard_win');
      if (wins >= 5) A.unlock('ttt_5wins');
    } else {
      e.status.textContent = 'CPU wins. Try again!';
      A.sfx('lose');
      A.fx.shake(e.screen);
    }
    A.emit('result', { game: 'ttt', win: res.player === 'X', difficulty: diff, mode: 'cpu' });
    return true;
  }

  function cpuMove(){
    const diff = A.difficulty('ttt');
    const empty = g.board.map((v, i) => v ? null : i).filter(v => v !== null);
    const random = () => empty[Math.floor(Math.random() * empty.length)];
    let move;
    if (diff === 'easy') move = random();
    else if (diff === 'normal') move = Math.random() < 0.5 ? strategicMove(empty) : random();
    // Hard is minimax with an occasional slip, so it can be beaten (perfect minimax never loses)
    else move = Math.random() < 0.12 && empty.length > 2 ? random() : minimaxBest();
    g.board[move] = 'O';
    return move;
  }

  function strategicMove(empty){
    for (const mark of ['O', 'X']) { // win if possible, then block
      for (const i of empty) {
        const copy = [...g.board]; copy[i] = mark;
        if (winner(copy)?.player === mark) return i;
      }
    }
    return empty[Math.floor(Math.random() * empty.length)];
  }

  function minimaxBest(){
    const bd = [...g.board];
    let bestScore = -Infinity, bestMoves = [];
    bd.forEach((v, i) => {
      if (v) return;
      bd[i] = 'O';
      const s = minimax(bd, 0, false);
      bd[i] = null;
      if (s > bestScore) { bestScore = s; bestMoves = [i]; }
      else if (s === bestScore) bestMoves.push(i);
    });
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  function minimax(bd, depth, isMax){
    const res = winner(bd);
    if (res) return res.player === 'O' ? 10 - depth : res.player === 'X' ? depth - 10 : 0;
    let best = isMax ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (bd[i]) continue;
      bd[i] = isMax ? 'O' : 'X';
      const s = minimax(bd, depth + 1, !isMax);
      bd[i] = null;
      best = isMax ? Math.max(best, s) : Math.min(best, s);
    }
    return best;
  }

  A.registerGame({
    id: 'ttt', name: 'TIC-TAC-TOE', title: 'Tic·Tac·Toe', marquee: 'TIC·TAC·TOE',
    label: 'Grid Tactics', color: 'blue', hasDifficulty: true,
    blurb: 'Three in a row. Play the CPU or a friend.',
    mini: `<div class="mini-ttt"><span>X</span><span class="o">O</span><span></span><span></span><span>X</span><span class="o">O</span><span class="o">O</span><span></span><span>X</span></div>`,
    build(body){
      body.innerHTML = `
        <div class="seg" role="group" aria-label="Opponent">
          <button class="seg-opt" data-mode="cpu">vs CPU</button>
          <button class="seg-opt" data-mode="pvp">2 players</button>
        </div>
        <div class="game-meta">
          <div class="stat"><span>Turn</span><b data-el="turn">X</b></div>
          <div class="stat"><span>Opponent</span><b data-el="diff">Normal</b></div>
          <div class="stat"><span>CPU wins</span><b data-el="wins">0</b></div>
        </div>
        <div class="screen" data-el="screen"><div class="ttt-board" data-el="board"></div></div>
        <p class="game-status" data-el="status" aria-live="polite"></p>
        <button class="reset-btn" data-el="reset">New round</button>`;
      e = A.els(body);
      e.modeBtns = [...body.querySelectorAll('.seg-opt')];
      for (let i = 0; i < 9; i++) {
        const cell = document.createElement('button');
        cell.className = 'ttt-cell';
        cell.addEventListener('click', () => place(i));
        e.board.appendChild(cell);
        cells.push(cell);
      }
      e.reset.addEventListener('click', start);
      e.modeBtns.forEach(b => b.addEventListener('click', () => {
        A.data.modes.ttt = b.dataset.mode;
        A.save();
        A.sfx('click');
        start();
      }));
    },
    start(opts = {}){
      if (opts.daily) A.data.modes.ttt = 'cpu';
      start();
    },
    stop(){ g.gen++; },
    onKey(ev){
      // number keys 1-9 map to squares like a phone keypad
      if (/^[1-9]$/.test(ev.key)) place(Number(ev.key) - 1);
    }
  });
})();
