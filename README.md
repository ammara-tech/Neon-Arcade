# Neon Arcade

A retro arcade in the browser. Pick a cabinet from the 3D cover-flow floor, set the difficulty and play any of **10 games**, or take on **the Gauntlet**: five of them back to back. Every game pays out tickets you can spend at the prize counter, and your progress is saved between visits. It can be installed as an app and works offline.

Built with plain **HTML, CSS and JavaScript**: no frameworks, no build step.

---

## How to run

**Quickest:** open `index.html` in a browser (Chrome, Edge, Firefox or Safari). Everything works except installing and offline mode, which need the arcade to be served from a web address.

**Locally with a web address** (needed to test installing/offline): in the project folder run `python -m http.server 8000`, then open http://localhost:8000.

## Put it online with GitHub Pages (free)

1. Create a free account at [github.com](https://github.com) and click **New repository**. Name it, for example, `neon-arcade`, set it to **Public**, and create it.
2. On the new repository page click **uploading an existing file**, drag in *everything inside* the project folder (`index.html`, `style.css`, `games.css`, `sw.js`, `manifest.webmanifest`, `README.md` and the `js` and `icons` folders), then click **Commit changes**.
3. Go to **Settings → Pages**. Under **Build and deployment**, set Source to **Deploy from a branch**, pick the **main** branch and the **/ (root)** folder, and click **Save**.
4. After a minute or two your arcade is live at `https://<your-username>.github.io/neon-arcade/`.

To update it later, upload the changed files again. Players get the new version the next time they open the arcade online.

## Install it as an app

Once it's online, open the link and:

- **Android / Chrome / Edge:** use the **Install** button in Trophies → Settings, or the browser's "Install app" option.
- **iPhone / iPad (Safari):** tap **Share → Add to Home Screen**.

The installed app opens full-screen with its own icon and works offline. The fonts come from Google Fonts and are saved for offline use the first time the arcade loads online.

**Controls on the floor:** `←` `→` browse cabinets · `Enter` play · `Esc` back to the floor. On a phone, swipe the cabinets and tap to play.

---

## The games

**1. Tic-Tac-Toe**
Concepts: an array of 9 squares, turn-based logic, win-condition checking, the Minimax algorithm.

- Gameplay: Get three in a row on a 3x3 grid. Play the CPU (Easy is random, Normal blocks and attacks, Hard uses Minimax) or switch to 2-player mode.

__________________________________________________

**2. Rock, Paper, Scissors**
Concepts: random number generation (`Math.random()`), conditional logic (`if/else`), tracking move history.

- Gameplay: Play against the CPU. Easy repeats itself, Normal is random, and Hard learns your most common moves and counters them. Keys `R` `P` `S` also work.

__________________________________________________

**3. Memory Matrix**
Concepts: array shuffling (Fisher-Yates algorithm), CSS Grid, 3D card flips with `transform: rotateY()`, a countdown timer.

- Gameplay: Flip two cards at a time to find matching pairs before the clock runs out. Time left is added to your score.

__________________________________________________

**4. Idle Core (Clicker / Idle Game)**
Concepts: state management, intervals (`setInterval`), automatic increments, saving progress.

- Gameplay: Click the core to earn energy and buy upgrades that earn it for you. It keeps earning while you are away (up to 8 hours), and you can trade energy for tickets.

__________________________________________________

**5. Whack-a-Mole**
Concepts: `setInterval` and `setTimeout`, clearing timers, random hole selection, CSS clipping and transitions for the rising moles.

- Gameplay: 30-second rounds that get faster. Moles are worth 1, golden moles 3, and bombs cost 5. Hits in a row build a multiplier up to x4. Keys `1`–`9` hit the holes.

__________________________________________________

**6. Hangman**
Concepts: splitting strings into character arrays, validating keyboard input, maximum error thresholds, an SVG figure drawn stroke by stroke.

- Gameplay: Guess the word from its category before the figure is complete. Type letters or use the on-screen keyboard. Keep guessing words in a row to build your streak.

__________________________________________________

**7. Type Racer (Typing Speed Test)**
Concepts: the `input` event, string comparison, calculating words per minute (WPM) and accuracy, countdown timers.

- Gameplay: Type the passage in 30 or 60 seconds. Letters turn green when correct and red when wrong. Easy uses common words, Normal uses sentences, and Hard adds numbers and symbols.

__________________________________________________

**8. Snake**
Concepts: a continuous game loop (`requestAnimationFrame`), the HTML5 `<canvas>`, direction vectors from the arrow keys, head-to-tail collision checks.

- Gameplay: Eat fruit to grow without hitting yourself. Eating quickly builds a combo, and golden fruit is worth extra. Easy wraps around the edges and Hard adds rocks. Use arrows/WASD, swipe, or the on-screen pad.

__________________________________________________

**9. Neon Runner (Endless Runner)**
Concepts: game loop physics (gravity and jumping), collision detection with bounding boxes, an infinite scrolling background made with CSS `@keyframes`.

- Gameplay: Jump over blocks, don't jump into drones, and collect coins. Hold jump for a higher leap. The track speeds up the further you run. Easy allows a double jump.

__________________________________________________

**10. Breakout**
Concepts: ball physics, circle-rectangle collision, angle control based on where the ball hits the paddle, multiple levels.

- Gameplay: Clear 5 different walls of bricks. Tough bricks need two hits. Catch power-ups: wide paddle, multiball, slow ball and extra life. Bricks broken without touching the paddle build a chain bonus.

__________________________________________________

**The Gauntlet**
Concepts: a controller that drives other games through a shared interface, timers, score normalisation, cancelling cleanly when the player leaves.

- Gameplay: Five random games back to back, each a short version played on Normal (for example 15 seconds of Whack-a-Mole or one Hangman word). Every round scores up to 1,000 points, the total goes on its own high-score table, and tickets are paid once at the end. Quitting mid-run forfeits the tickets.

---

## Arcade features

- **Tickets and prize counter:** every game pays out tickets. Spend them on carpets, cabinet trims, marquee lights and titles that change how the arcade looks.
- **High scores:** each game has a top-5 table where you enter 3 initials, and each cabinet shows its best score.
- **Trophies:** 43 achievements across all the games.
- **Player stats:** a Stats tab with your rank progress, games and time played, favourite game, a chart of your recent scores and a table of every game.
- **Daily challenge:** a different game and goal each day, worth 50 bonus tickets.
- **Saved progress:** score, tickets, trophies, prizes and high scores are saved in your browser (`localStorage`). You can reset everything under Trophies → Settings.
- **Sound effects:** retro sounds generated in code with the Web Audio API (no audio files), with a mute button.
- **Difficulty levels:** Easy, Normal and Hard for every game except Idle Core.
- **Works on phones:** touch controls, swipe gestures and layouts that fit small screens.

---

## Project structure

```
index.html          page layout: top bar, floor, menus
manifest.webmanifest  app name, colours and icons for installing
sw.js               service worker: caches the files so the arcade works offline
icons/              app icons
style.css           arcade styles: top bar, floor, cabinets, menus, prize counter
games.css           styles for every game screen
js/core.js          shared code: saving, score, tickets, trophies, sound, high scores, daily challenge
js/games/*.js       one file per game
js/gauntlet.js      the Gauntlet: runs five games in a row
js/stats.js         the Stats tab
js/ui.js            builds the cabinets, menus and prize counter (loaded last)
```

Each game is a self-contained file that registers itself with `Arcade.registerGame({...})`. To add a new game, create a file in `js/games/`, add a `<script>` tag for it in `index.html` before `js/gauntlet.js`, and add it to the `APP_FILES` list in `sw.js`. It gets its own cabinet automatically. Give it a `gauntlet: {...}` block (see the top of `js/gauntlet.js`) and it can appear in the Gauntlet too.

When you change any file, also bump `VERSION` in `sw.js` so installed copies refresh their offline cache.
