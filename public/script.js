    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
    import { getDatabase, ref, set, update, onValue, get, child, push, onChildAdded } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

    // --- SETTINGS STATE ---
    const settings = {
      interestAlerts: false,
      loanAlerts: false
    };
    // load any saved settings
    try {
      const saved = JSON.parse(localStorage.getItem('rtbSettings'));
      Object.assign(settings, saved);
    } catch (e) { }

    // toggle the modal
    const settingsBtn   = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    settingsBtn.onclick = () => settingsModal.classList.remove('hidden');
    closeSettingsBtn.addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });
    document.getElementById('saveSettings').onclick = () => {
      settings.interestAlerts = document.getElementById('toggleInterest').checked;
      settings.loanAlerts     = document.getElementById('toggleLoan').checked;
      localStorage.setItem('rtbSettings', JSON.stringify(settings));
      settingsModal.classList.add('hidden');
    };
    // initialize the checkbox states
    document.getElementById('toggleInterest').checked = settings.interestAlerts;
    document.getElementById('toggleLoan').checked     = settings.loanAlerts;

    const firebaseConfig = {
      apiKey: "AIzaSyD5Zu_Qsv3reVuB6PrombL954zSKHWPewY",
      authDomain: "ride-the-bus-d9f3f.firebaseapp.com",
      projectId: "ride-the-bus-d9f3f",
      storageBucket: "ride-the-bus-d9f3f.firebasestorage.app",
      messagingSenderId: "1213292677",
      appId: "1:1213292677:web:123df0546c297f03fb49ec",
      measurementId: "G-X9VK7R0RQE"
    };

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);
  // Multiplier bonuses per stage (modifiable later)
  const multipliers = {
    1: 2,
    2: 3,
    3: 4,
    4: 20,
    5: 500
  };
  
  let soloMode = false;


async function displayMultipliers() {
  const list = document.getElementById("multiplierBonuses");
  if (!list || !playerRef) return;

  const snap = await get(playerRef);
  const player = snap.val();
  const mults = player?.multipliers || {};

  // build the <li> entries for each stage
    const items = Object.entries(mults).map(
    ([stage, mult]) => `<li>Stage ${stage}: ${mult}x</li>`
  );

  // if Power Rush is active, append its info
  const roundsLeft = player.powerRushRoundsLeft || 0;
  if (roundsLeft > 0) {
    items.push(
      `<li>🔥 Power Rush: +3 for ${roundsLeft} round${roundsLeft>1?'s':''}</li>`
    );
  }

  const gratLeft = player.instantGratRoundsLeft || 0;
  if (gratLeft > 0) {
    items.push(`
      <li>✨ Instant Gratification: 1.25x for ${gratLeft} round${gratLeft>1?'s':''}</li>`
    );
  }

  list.innerHTML = items.join("");
}


// Ensure createLobby is hooked up after everything is defined
window.addEventListener("DOMContentLoaded", () => {
  const createGameBtn = document.getElementById("createGameBtn");
  const joinGameBtn = document.getElementById("joinGameBtn");
  const startGameBtn = document.getElementById("startGameBtn");
  const startTurnBtn = document.getElementById("startTurnBtn");
  const resetGameBtn = document.querySelector(".controls button");

  /* ─── Mode‑select handlers ───────────────────────── */
  const modeDiv       = document.getElementById('modeSelect');
  const lobbyDiv      = document.getElementById('lobby');

  const singleBtn     = document.getElementById('singlePlayerBtn');
  const multiBtn      = document.getElementById('multiPlayerBtn');

  /* Multiplayer: reveal the normal lobby UI */
  multiBtn.addEventListener('click', () => {
    modeDiv.remove();                       
    lobbyDiv.classList.remove('hidden');

    // show lobby‑code + join/create buttons
    document.getElementById('lobbyCode')  .classList.remove('hidden');
    document.getElementById('joinGameBtn').classList.remove('hidden');
    document.getElementById('createGameBtn').classList.remove('hidden');
    document.getElementById('startGameBtn').classList.add   ('hidden');
  });

  /* Single‑player: auto‑create a private lobby and jump in */
  singleBtn.addEventListener('click', async () => {
    modeDiv.remove();
    lobbyDiv.classList.remove('hidden');

    // 1) trim the lobby UI down to “name + Start Game”
    document.getElementById('lobbyCode')  .classList.add   ('hidden');
    document.getElementById('joinGameBtn').classList.add   ('hidden');
    document.getElementById('createGameBtn').classList.add ('hidden');
    const soloStart = document.getElementById('startGameBtn');
    soloStart.classList.remove('hidden');
    soloMode = true;                         // global flag already used later

    /* 2) When the player clicks Start Game:
          • silently spin up a random lobby
          • join it as host
          • immediately launch the game          */
    soloStart.onclick = async () => {
      const name = document.getElementById('playerName').value.trim();
      if(!name) return alert('Enter your name first!');
      const code = generateLobbyCode();
      document.getElementById('lobbyCode').value = code;  // invisible but needed
      isHost = true;

      // joinLobby() sets up DB refs, then we can auto‑start
      await joinLobby();           // << existing function
      await startGame();           // << your normal startGame – detects solo mode
    };
  });


  if (createGameBtn) createGameBtn.addEventListener("click", () => {
    const generatedCode = generateLobbyCode();
    document.getElementById('lobbyCode').value = generatedCode;
    isHost = true;
    joinLobby();
  });

  if (joinGameBtn) joinGameBtn.addEventListener("click", () => {
    isHost = false;
    joinLobby();
  });
  const viewBtn  = document.getElementById('viewDeckBtn');
  const closeBtn = document.getElementById('closeDeckBtn');
  const modal    = document.getElementById('deckModal');

  if (!viewBtn)  return console.warn("♠️ viewDeckBtn not found");
  if (!closeBtn) return console.warn("♠️ closeDeckBtn not found");
  if (!modal)    return console.warn("♠️ deckModal not found");

  viewBtn.addEventListener('click', showDeck);
  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  if (startGameBtn) startGameBtn.addEventListener("click", startGame);

  if (startTurnBtn) startTurnBtn.addEventListener("click", async () => {
    const stateSnapPre = await get(stateRef);
    const statePre = stateSnapPre.val();
    if (statePre.currentStage !== 0) {
      alert("You already started your turn.");
      return;
    }
    
    correctGuessCount = 0
    endTurnAlreadyCalled = false;
    clearCountdown(); // clear the pre-turn timer

    const stateSnap = await get(stateRef);
    const state = stateSnap.val();
    if (state.currentPlayer !== playerId) return alert("It's not your turn.");

    // Only declare playerSnap once
    const playerSnap = await get(playerRef);
    const bet = parseInt(document.getElementById('betAmount').value);
    // ─── Snow‑baller support ───────────────────────────
    const prevBalance = playerSnap.val().balance;
    // ─────────────────────────────────────────────────────
    
    if (bet > playerSnap.val().balance || bet <= 0) return alert('Invalid bet amount.');
    
    const newBalance = playerSnap.val().balance - bet;
    
    const isAllIn = bet === playerSnap.val().balance;
    await update(playerRef, {
      balance: newBalance,
      isAllIn,
      lastBalanceBeforeBet: prevBalance    // ← store for Snow‑baller
    });

    localPlayer.balance = newBalance;

    await update(stateRef, {
      currentPlayer: playerId,
      currentStage: 1,
      drawnCards: [],
      bet,
      status: `${localPlayer.name} - Stage 1: Red or Black?`
    });

    //if (!soloMode) startCountdown(20, () => {
    //  endTurn("Ran out of time! You lose.", 0);
    //});
    
  });

  if (resetGameBtn) resetGameBtn.addEventListener("click", resetGame);
});

    let lobbyCode, playerId, playerRef, stateRef, deckRef;
    let localPlayer = {};
    // Each player’s personal shoe.  When it empties we auto‑refill.
    let personalDeck = null;
    let isHost = false;
    let drawnCards = [];
    let lastKnownCurrentPlayer = null;
    let countdownInterval = null;
    let countdownTimeout = null;
    let maxBetsPerPlayer = 10;
    let correctGuessCount = 0;
    let guessLock = false;
    const CURSED_LOAN_INC = 0.25;
    // ─── Token interest helper ──────────────────────────────────────────
    const MAX_TOKEN_INTEREST = 5;
    function tokenInterest(tokensHeld) {
      /* +1 token for every full 5 you already own, to a max of +5 */
      return Math.min(Math.floor(tokensHeld / 4), MAX_TOKEN_INTEREST);
    }


    
    function generateLobbyCode() {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    window.createLobby = () => {
      const generatedCode = generateLobbyCode();
      document.getElementById('lobbyCode').value = generatedCode;
      isHost = true;
      joinLobby();
    };
    
    let joiningInProgress = false;
    window.joinLobby = async () => {
      if (joiningInProgress) return; // prevent double joins
      joiningInProgress = true;

      if (playerId) {
        joiningInProgress = false;
        return alert('You have already joined this lobby.');
      }

      lobbyCode = document.getElementById('lobbyCode').value.trim().toUpperCase();
      const name = document.getElementById('playerName').value.trim();
      if (!name || lobbyCode.length !== 4) {
        joiningInProgress = false;
        return alert('Please enter a name and valid 4-char lobby code.');
      }

      const playersSnap = await get(ref(db, `games/${lobbyCode}/players`));
      const players = playersSnap.val() || {};

      const nameTaken = Object.values(players).some(p => p.name === name);
      if (nameTaken) {
        joiningInProgress = false;
        return alert('That name is already taken in this lobby.');
      }

      const alreadyJoined = Object.entries(players).some(([_, p]) => p.name === name && p.id === playerId);
      if (alreadyJoined) {
        joiningInProgress = false;
        return alert('You have already joined this lobby.');
      }

      playerId = `player_${Math.floor(Math.random() * 100000)}`;
      playerRef = ref(db, `games/${lobbyCode}/players/${playerId}`);
      stateRef = ref(db, `games/${lobbyCode}/state`);
      deckRef = ref(db, `games/${lobbyCode}/deck`);

      localPlayer = {
        name,
        balance: 100,
        highestBalance: 100,
        roundsWon: 0,
        betsMade: 0,
        eliminated: false,
        purchaseTokens: 0,
        cardUpgrades: [],
        multipliers: {
          1: 2,
          2: 3,
          3: 4,
          4: 20,
          5: 500
        },
        startBalanceOps: [], 
      };
      personalDeck = buildPlayerDeck(localPlayer);           // utility you already have
      await update(playerRef, { personalDeck });

      await set(playerRef, localPlayer);

      const lobbyList = document.getElementById('lobbyPlayers');
      lobbyList.classList.remove('hidden');
      if (isHost) document.getElementById('startGameBtn').classList.remove('hidden');

      onValue(ref(db, `games/${lobbyCode}/players`), (snapshot) => {
        const playersRef = ref(db, `games/${lobbyCode}/players`);
        onValue(playersRef, (snapshot) => {
          const players = snapshot.val();
          if (!players) return;

          get(stateRef).then(stateSnap => {
            const state = stateSnap.val();
            const currentId = state?.currentPlayer;

            updatePlayerStats(Object.entries(players).map(([id, data]) => ({
              id,
              ...data,
              isCurrent: id === currentId
            })));
          });
        });
        const players = snapshot.val();
        soloMode = Object.keys(players).length === 1;

        if (!players) return;
        lobbyList.innerHTML = '<h3>Players in Lobby:</h3>' +
          Object.values(players).map(p => `<div>${p.name}</div>`).join('');

        get(stateRef).then(stateSnap => {
          const state = stateSnap.val();
          const currentId = state?.currentPlayer;
          updatePlayerStats(Object.entries(players).map(([id, data]) => ({
            id,
            ...data,
            isCurrent: id === currentId
          })));
        });
      }
    );

      onValue(stateRef, async (snapshot) => {
        
        const state = snapshot.val();
        if (state) {
          if (state.gameStarted) {
            document.getElementById('lobby').classList.add('hidden');
            document.getElementById('gameUI').classList.remove('hidden');
          }
          if (state.maxBetsPerPlayer) {
            maxBetsPerPlayer = state.maxBetsPerPlayer;
          }

          updateGameDOM(state);

          const playersSnap = await get(ref(db, `games/${lobbyCode}/players`));
          const players = playersSnap.val();
          const currentId = state?.currentPlayer;

          updatePlayerStats(Object.entries(players).map(([id, data]) => ({
            id,
            ...data,
            isCurrent: id === currentId
          })));

          if (!window.playedToneIds) window.playedToneIds = new Set();

          (state.successTones || []).forEach(tone => {
            if (!window.playedToneIds.has(tone.id)) {
              window.playedToneIds.add(tone.id);
              correctGuessCount = tone.count;
              playSuccessTone();
            }
          });

          if (!window.playedFailToneIds) window.playedFailToneIds = new Set();
          (snapshot.val().failureTones || []).forEach(tone => {
            if (!window.playedFailToneIds.has(tone.id)) {
              window.playedFailToneIds.add(tone.id);
              playFailureTone();
            }
          });

          if (currentId !== lastKnownCurrentPlayer && currentId === playerId) {
            correctGuessCount = 0;
            const playerSnap = await get(playerRef);
            const playerData = playerSnap.val();

            // const interestPercent = playerData.interestPercent       || 0;
            // const alreadyApplied  = playerData.interestAppliedForRound;
            // if (interestPercent > 0 && !alreadyApplied) {
            //   const interest   = Math.floor(playerData.balance * (interestPercent / 100));
            //   const newBalance = playerData.balance + interest;
            //   await update(playerRef, {
            //     balance:                 newBalance,
            //     interestAppliedForRound: true
            //   });
            //   localPlayer.balance = newBalance;
            //   alert(`💰 ${playerData.name}, you earned $${interest} in interest (${interestPercent}%)!`);
            // }
            // if (playerData.cursedLoan) {
            //   const penalty = Math.floor(playerData.balance * 0.20);
            //   const newBalance = playerData.balance - penalty;
            //   await update(playerRef, { balance: newBalance });
            //   localPlayer.balance = newBalance;
            //   alert(`💸 You lost $${penalty} due to the Cursed Loan (-20%).`);
            // }

            playTurnSound();
            //if (!soloMode) startCountdown(20, () => {
            //  endTurn("Ran out of time! You lose.", 0);
            //});
            //}
          }
          lastKnownCurrentPlayer = currentId;

          if (state.currentStage === 0) {
            const playerSnap = await get(playerRef);
            const playerData = playerSnap.val();

            if (playerData.showShop && (playerData.purchaseTokens || 0) > 0) {
              showShopOptions(playerData.isRoundWinner);
              await update(playerRef, { showShop: false });
            }
          }
        }
      });

      joiningInProgress = false;
    };

    window.startGame = async () => {
      // 1) Build & shuffle the full deck
      const fullDeck = [];
      const suits = ['♠', '♥', '♦', '♣'];
      const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
      for (const suit of suits) {
        for (const val of values) {
          fullDeck.push({
            text: val + suit,
            suit,
            value:
              val === 'A' ? 14 :
              val === 'K' ? 13 :
              val === 'Q' ? 12 :
              val === 'J' ? 11 :
              parseInt(val, 10)
          });
        }
      }
      fullDeck.sort(() => Math.random() - 0.5);
      await set(deckRef, fullDeck);

      // 2) Fetch players and count them
      const playersSnap = await get(ref(db, `games/${lobbyCode}/players`));
      const players     = playersSnap.val() || {};
      const playerCount = Object.keys(players).length;

      // ───── SOLO MODE ─────
      // If only one player, give 8 bets and set threshold
      if (playerCount === 1) {
        soloMode = true;
        maxBetsPerPlayer = 10;
        // initialize threshold at $100
        await set(stateRef, {
          gameStarted:      true,
          currentPlayer:    playerId,
          currentStage:     0,
          drawnCards:       [],
          threshold:        100,                                 
          status:           `Survive the round! Beat $100`,
          maxBetsPerPlayer
        });
        return;
      }

      // ───── MULTIPLAYER FALLBACK ─────
      if (playerCount >= 6)         maxBetsPerPlayer = 3;
      else if (playerCount >= 5)    maxBetsPerPlayer = 4;
      else if (playerCount >= 4)    maxBetsPerPlayer = 5;
      else if (playerCount >= 3)    maxBetsPerPlayer = 6;
      else                          maxBetsPerPlayer = 7;

      const firstPlayerId = Object.keys(players)[0];
      await update(stateRef, {
        gameStarted:      true,
        currentPlayer:    firstPlayerId,
        currentStage:     0,
        drawnCards:       [],
        status:           `Waiting for ${players[firstPlayerId].name} to start their turn.`,
        maxBetsPerPlayer
      });
    };



async function applyCardUpgradeBonus(card) {
  const snap = await get(playerRef);
  const playerData = snap.val();
  const match = (playerData.cardUpgrades || []).find(up => up.text === card.text);


  if (!match) return;

  if (match.effect === 'Gain 25% of bet') {
    const stateSnap = await get(stateRef);
    const state = stateSnap.val();
    const bet = state.bet || 0;
    const bonus = Math.floor(bet * 0.25);

    localPlayer.balance += bonus;
    await update(playerRef, {
      balance: localPlayer.balance
    });

    console.log(`Upgrade applied for ${card.text}: gained $${bonus}`);
  }

  // ─── New: +1‑bet card upgrade ───────────────────────────────
  if (match.effect === '+1 bet') {
    // set a one‑time flag so cash‑out logic knows to give +1 bet
    await update(playerRef, { bonusPlusOneActive: true });
    console.log(`+1-bet card "${card.text}" drawn: bonus armed`);
  }
  
  if (match.effect === 'remove_card') {
    console.log(`Upgrade applied for ${card.text}: card removed from deck`);
    // No effect to apply at draw time, since card should be filtered from deck
  }

  // ─── New: 10% of current balance on draw ─────────────────────────────────
  if (match.effect === 'Gain 10% of Balance') {
    // fetch fresh balance
    const snap = await get(playerRef);
    const pdata = snap.val() || {};
    const bonus = Math.floor(pdata.balance * 0.10);

    localPlayer.balance += bonus;
    await update(playerRef, { balance: localPlayer.balance });
    console.log(`Upgrade applied for ${card.text}: gained $${bonus} (10% of balance)`);
  }
  // ─── new: +3 boost on next Cash‑Out ──────────────────────────
  if (match.effect === '+3 Mult') {
    await update(playerRef, { bonusPlus3Active: true });
    console.log(`+3 Mult drawn: will apply +3 on next cash-out`);
  }
  // ─── new: one‐time 1.25× boost for any cash‑out this round ─────────────────
  if (match.effect === '1.25x Mult') {
    // mark that future Cash Outs this round get +25%
    await update(playerRef, { bonusMult1_25Active: true });
    console.log(`1.25x card drawn: next cash-out this bet will be boosted`);
  }
  
  displayMultipliers();
}

function createCardDisplay(card, effect = null) {
  const el = document.createElement('div');
  // new: red for ♥♦, blue for ☾★, else black
  let colorClass;
  if (card.suit === '♥' || card.suit === '♦')      colorClass = 'red';
  else if (card.suit === '☾' || card.suit === '★') colorClass = 'blue';
  else                                             colorClass = 'black';
  el.className = `card ${colorClass}`;

  if (effect === '+1 bet') {
    el.style.boxShadow = '0 0 12px 4px limegreen'; // green glow
  } else if (effect === 'Gain 25% of bet') {
    el.style.boxShadow = '0 0 12px 4px gold'; // yellow
  // } else if (effect === 'remove_card') {
    // el.style.boxShadow = '0 0 12px 4px red'; // red glow
  } else if (effect === 'Gain 10% of Balance') {
    el.style.boxShadow = '0 0 12px 4px orange'; // orange glow for 10% balance
  } else if (effect === '+3 Mult') {
    el.style.boxShadow = '0 0 12px 4px cyan';
  } else if (effect === '1.25x Mult') {
    el.style.boxShadow = '0 0 12px 4px magenta';
  } else if (effect === 'bonusToken') {
    el.style.boxShadow = '0 0 12px 4px #ff00ff';  // bright purple
  }


  el.textContent = card.text;
  return el;
}


// ─────────────────────────────────────────────────────────────────────────────
// drawUniqueCard
//   • Each player keeps a personalDeck (“shoe”) in their player doc.
//   • A card drawn once is removed from that sho e and can’t return until the
//     shoe is empty, at which point it is rebuilt from the player’s full deck
//     (minus any cards currently face‑up on the table = drawnCards[]).
// ─────────────────────────────────────────────────────────────────────────────
async function drawUniqueCard(drawnCards = [], excludeSameValue = false) {

  /* 1️⃣  Load player data (includes any existing shoe) */
  const pSnap      = await get(playerRef);
  const data       = pSnap.val() || {};
  let   personal   = data.personalDeck || [];          // the shoe

  /* 2️⃣  Rebuild the shoe if missing or empty ─────────────────────────── */
  if (personal.length === 0) {

    // 2a.  Start from the player’s *full* customised deck
    let pool = buildPlayerDeck(data)
                .filter(c => !drawnCards.some(d => d.text === c.text)); // skip in‑play

    // 2b.  Duplicate‑card stacking
    const dupCounts = data.duplicateCounts || {};
    Object.entries(dupCounts).forEach(([text, count]) => {
      const template = pool.find(c => c.text === text);
      if (!template) return;
      for (let i = 0; i < count; i++) pool.push({ ...template, _isDup: true });
    });

    // 2c.  Optional blue suits
    if (data.addBlueSuits) {
      const blueSuits = ['☾', '★'];
      const values    = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
      for (const suit of blueSuits) {
        for (const v of values) {
          const num = v==='A'?14:v==='K'?13:v==='Q'?12:v==='J'?11:parseInt(v,10);
          pool.push({ text: v + suit, suit, value: num, _isBlue: true });
        }
      }
    }

    // 2d.  Ace & Two boost stacks
    const boostCount = data.aceTwoBoostCount || 0;
    if (boostCount > 0) {
      let suits = ['♠','♥','♦','♣'];
      if (data.addBlueSuits)        suits.push('☾','★');
      if (data.removeDiamondsClubs) suits = suits.filter(s => s!=='♦' && s!=='♣');

      for (let i = 0; i < boostCount; i++) {
        for (const suit of suits) {
          pool.push({ text: 'A'+suit, suit, value: 14, _isDup: true });
          pool.push({ text: '2'+suit, suit, value: 2,  _isDup: true });
        }
      }
    }

    personal = pool;                               // finished shoe
    await update(playerRef, { personalDeck: personal });
  }

  /* 3️⃣  Draw until something passes every filter ─────────────────────── */
  const {
    facelessCount      = 0,
    remove2to4Count    = 0,
    remove7and8Count   = 0,
    removeDiamondsClubs
  } = data;

  let card  = null;
  let tries = personal.length;

  while (tries-- && !card) {
    const idx     = Math.floor(Math.random() * personal.length);
    const attempt = personal[idx];                // don’t pop yet

    // ── Witch’s Cauldron mapping (if any) ────────────────────────────
    if (data.witchCauldronMap?.[attempt.text]) {
      const { value: mv, suit: ms } = data.witchCauldronMap[attempt.text];
      attempt.value = mv;
      attempt.suit  = ms;
      attempt.text  = (mv===14?'A':mv===13?'K':mv===12?'Q':mv===11?'J':mv) + ms;
      attempt._cauldron = true;
    }

    // ── Existing filters ─────────────────────────────────────────────
    const dupCard   = drawnCards.some(c => c.text  === attempt.text);
    const dupValue  = excludeSameValue && drawnCards.some(c => c.value === attempt.value);
    const removeSuit = removeDiamondsClubs && (attempt.suit==='♦' || attempt.suit==='♣');
    const removeFace = facelessCount > 0 && [11,12,13].includes(attempt.value);
    const removeLow  = remove2to4Count > 0 && [2,3,4].includes(attempt.value);
    const remove78   = remove7and8Count > 0 && [7,8].includes(attempt.value);

    if (dupCard || dupValue || removeSuit || removeFace || removeLow || remove78) {
      continue;                                   // pick again
    }

    // ── Accept this card and remove it from the shoe ────────────────
    card = attempt;
    personal.splice(idx, 1);
  }

  /* 4️⃣  Persist the shoe’s new state and return the draw ─────────────── */
  await update(playerRef, { personalDeck: personal });
  return card;
}


async function applyOneBetBonus() {
  const snap = await get(playerRef);
  const p    = snap.val() || {};
  if (!p.bonusPlusOneActive) return;
  const rb = p.roundBetBonus || 0;
  if (rb < 4) {
    await update(playerRef, {
      roundBetBonus:      rb + 1,
      bonusPlusOneActive: false
    });
    console.log(`Applied +1-bet (roundBonus now ${rb + 1})`);
  } else {
    await update(playerRef, { bonusPlusOneActive: false });
    console.log("+1-bet drawn but already at cap");
  }
}



async function handleGuess(guess, state) {
  const stage = state.currentStage;
  const bet   = state.bet;

  // Helper: emit a success tone
  async function emitSuccess() {
    correctGuessCount++;
    const toneId = Date.now();
    const snap   = await get(stateRef);
    const curr   = snap.val() || {};
    await update(stateRef, {
      successTones: [...(curr.successTones || []), { id: toneId, count: correctGuessCount }]
    });
  }

  // Helper: emit a failure tone
  async function emitFailure() {
    const toneId = Date.now();
    const snap   = await get(stateRef);
    const curr   = snap.val() || {};
    await update(stateRef, {
      failureTones: [...(curr.failureTones || []), { id: toneId }]
    });
  }

  // ─── Stage 1 ────────────────────────────────────────────────────────────────
  if (stage === 1) {
    await reshuffleDeck();
    const card = await drawUniqueCard([], false);
    if (!card) return endTurn('Deck is empty. Round ending early.', 0);
    await applyCardUpgradeBonus(card);

    const isRed   = card.suit === '♥' || card.suit === '♦';
    const isBlack = card.suit === '♠' || card.suit === '♣';
    const isBlue  = card.suit === '☾' || card.suit === '★';

    await update(stateRef, { drawnCards: [card] });

    if ((guess === 'Red'   && isRed) ||
        (guess === 'Black' && isBlack) ||
        (guess === 'Blue'  && isBlue)) {
      state.currentStage = 2;
      state.status       = 'Correct! Cash out 2x or pick Higher/Lower';
      await update(stateRef, state);
      await emitSuccess();
    } else {
      await emitFailure();
      // before ending turn, check for Stage 1 Fright
      const psnap = await get(playerRef);
      const pdata = psnap.val() || {};
      if (pdata.stage1Fright) {
        const roundBonus = pdata.roundBetBonus || 0;
        const triggerCount = pdata.stage1FrightTriggers || 0;

        if (triggerCount < 3) {
          const alreadyArmed = pdata.stage1FrightArmed;

          await update(playerRef, {
            roundBetBonus: roundBonus + 1,
            stage1FrightTriggers: triggerCount + 1,
            ...(alreadyArmed ? {} : { stage1FrightArmed: true })
          });

          console.log(`Stage 1 Fright triggered (${triggerCount + 1}/3): +1 bet granted` +
                      (alreadyArmed ? '' : ', penalty armed'));
        } else {
          console.log("Stage 1 Fright limit reached for this round");
        }
      }


      return endTurn('Wrong guess. You lose.', 0);
    }

    return;
  }

  // ─── Stage 2 ────────────────────────────────────────────────────────────────
  if (stage === 2) {
    if (guess === 'Cash Out') {
      // fetch player data so pdata is defined
      const psnap = await get(playerRef);
      const pdata = psnap.val() || {};

      const hadKing = pdata.kingpinCount > 0 && state.drawnCards.some(c => c.value === 13);

      // remove first card then compute payout
      const deckSnap = await get(deckRef);
      let deck = deckSnap.val() || [];
      deck = deck.filter(c => c.text !== state.drawnCards[0].text);
      await set(deckRef, deck);
      state.drawnCards = [];
      await update(stateRef, state);

      // 1) Base multiplier from card‑upgraded array
      let multiplier = pdata.multipliers?.[1] || multipliers[1];
      // 2) Card modifier “burn” effects (run before any bet‑mods)
      // ─── one‑time +3 Mult burn ─────────────────────────────
      if (pdata.bonusPlus3Active) {
        multiplier += 3;
        await update(playerRef, { bonusPlus3Active: false });
        console.log('Applied +3 mult on Stage 2 cash-out');
      }
      //    e.g. one‑time 1.25× boost
      if (pdata.bonusMult1_25Active) {
        multiplier = Math.round(multiplier * 1.25);
        await update(playerRef, { bonusMult1_25Active: false });
        console.log('Applied 1.25x mult on Stage 2 cash-out');
      }

      // (If you had any other “once‑per‑draw” flags, handle them here…)
      // ─── Power Rush support ─────────────────────────────────────
      if (pdata.powerRushRoundsLeft > 0) {
        multiplier += 3;
        console.log(`Power Rush applied: +3 mult (rounds left: ${pdata.powerRushRoundsLeft})`);
      }

      // ─── Instant Gratification support ───────────────────────────
      if (pdata.instantGratRoundsLeft > 0) {
        /* multiplicative, because the upgrade says “1.25x” */
        multiplier = Math.round(multiplier * 1.25);
        console.log(
          `Instant Gratification applied: ×1.25 (rounds left: ${pdata.instantGratRoundsLeft})`
        );
      }

      // 3) Now apply your bet modifiers in order
      // Clutch King (if you’ve passed halfway)
      if (
        pdata.clutchKingCount > 0 &&
        pdata.betsMade > maxBetsPerPlayer / 2
      ) {
        multiplier += pdata.clutchKingCount;
      }
      if (pdata.snowballer && pdata.lastBalanceBeforeBet) {
        multiplier = multiplier + (bet / pdata.lastBalanceBeforeBet);
      }
      if (pdata.allInBonus && pdata.isAllIn) {
        multiplier *= 2;
      }

      // ─── New: grant +1 bet here if you own the '+1 bet' upgrade ────
      await applyOneBetBonus();

      // ─── New: +1 token on cash-out (max 3 per round) ───
      const gotCount     = pdata.tokenGrantCount || 0;
      const hasUpgrade   = (pdata.cardUpgrades || [])
                            .some(u => u.effect === 'bonusToken');
      if (hasUpgrade && gotCount < 3) {
        await update(playerRef, {
          purchaseTokens:    (pdata.purchaseTokens || 0) + 1,
          tokenGrantCount:   gotCount + 1
        });
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens + 1}`;
        console.log(`Granted +1 token on cash-out (${gotCount + 1}/3)`);
      } else if (hasUpgrade) {
        // still clear nothing else—just skip if cap reached
        console.log('Token-grant upgrade drawn but already at 3 this round');
      }


      // Stage 1 Fright penalty?
      if (pdata.stage1FrightArmed) {
        multiplier  = multiplier / 3;
        // clear the flag so it only applies once
        await update(playerRef, {
          stage1FrightArmed: false
        });
        console.log("Stage 1 Fright penalty applied: lose 3x on this bet");
      }

      
      const payout = Math.floor(bet * multiplier);

      // 💰 Update balance and end turn
      await endTurn(`Cashed out $${payout}`, payout);

      /* ── Kingpin: +0.1 on cash-out if a King was part of the hand ── */
      if (hadKing) {
        const inc      = 0.1 * pdata.kingpinCount;          // stackable
        const oldMults = pdata.multipliers || {};
        const newMults = {};

        for (const [stage, m] of Object.entries(oldMults)) {
          newMults[stage] = +(m + inc).toFixed(2);           // keep it tidy
        }

        await update(playerRef, { multipliers: newMults });
        console.log(`👑 Kingpin: cashed a King → +${inc.toFixed(2)} on every stage`);
        displayMultipliers();
      }

      // 💀 Cursed Loan logic (apply AFTER payout)
      if (pdata.cursedLoan) {
        const stageNum = 2;
        const oldMults = pdata.multipliers || {};
        const boosted = (oldMults[stageNum] || multipliers[stageNum]) + CURSED_LOAN_INC;
        const newMults = { ...oldMults, [stageNum]: boosted };
        await update(playerRef, { multipliers: newMults });
        console.log(`💀 Cursed Loan: Stage ${stageNum} multiplier increased to ${boosted}x`);
        displayMultipliers();
      }

      return;

    }

    const prevValue = state.drawnCards[0].value;
    const card2     = await drawUniqueCard(state.drawnCards, true);
    if (!card2) return endTurn('Deck is empty. Round ending early.', 0);

    await applyCardUpgradeBonus(card2);
    state.drawnCards.push(card2);

    const curr = card2.value;
    if ((guess === 'Higher' && curr > prevValue) ||
        (guess === 'Lower'  && curr < prevValue)) {
      state.currentStage = 3;
      state.status       = 'Correct! Cash out 3x or pick In-Between/Outside';
      await update(stateRef, state);
      await emitSuccess();
    } else {
      await update(stateRef, { drawnCards: state.drawnCards });
      await emitFailure();
      return endTurn('Wrong guess. You lose.', 0);
    }
    return;
  }

  // ─── Stage 3 ────────────────────────────────────────────────────────────────
  if (stage === 3) {
    if (guess === 'Cash Out') {
      // fetch player data so pdata is defined
      const psnap = await get(playerRef);
      const pdata = psnap.val() || {};

      const hadKing = pdata.kingpinCount > 0 && state.drawnCards.some(c => c.value === 13);

      // 1) Remove the first drawn card
      const deckSnap = await get(deckRef);
      let deck = deckSnap.val() || [];
      deck = deck.filter(c => c.text !== state.drawnCards[0].text);
      await set(deckRef, deck);

      // 2) Clear drawn cards and persist
      state.drawnCards = [];
      await update(stateRef, state);

      // 3) Base multiplier for Stage 3 cash‑out (3×)
      let multiplier = pdata.multipliers?.[2] || multipliers[2];

      // 4) Burn “one‑off” card modifiers first
      if (pdata.bonusPlus3Active) {
        multiplier += 3;
        await update(playerRef, { bonusPlus3Active: false });
      }
      if (pdata.bonusMult1_25Active) {
        multiplier = Math.round(multiplier * 1.25);
        await update(playerRef, { bonusMult1_25Active: false });
      }

      // ─── Power Rush support ─────────────────────────────────────
      if (pdata.powerRushRoundsLeft > 0) {
        multiplier += 3;
        console.log(`Power Rush applied: +3 mult (rounds left: ${pdata.powerRushRoundsLeft})`);
      }

      // ─── Instant Gratification support ───────────────────────────
      if (pdata.instantGratRoundsLeft > 0) {
        /* multiplicative, because the upgrade says “1.25x” */
        multiplier = Math.round(multiplier * 1.25);
        console.log(
          `Instant Gratification applied: ×1.25 (rounds left: ${pdata.instantGratRoundsLeft})`
        );
      }

      // 5) Now apply bet‑modifiers in order
      if (pdata.clutchKingCount > 0 && pdata.betsMade > maxBetsPerPlayer / 2) {
        multiplier += pdata.clutchKingCount;
      }
      if (pdata.snowballer && pdata.lastBalanceBeforeBet) {
        multiplier += bet / pdata.lastBalanceBeforeBet;
      }
      if (pdata.allInBonus && pdata.isAllIn) {
        multiplier *= 2;
      }
      // ─── New: grant +1 bet here if you own the '+1 bet' upgrade ────
      await applyOneBetBonus();

      // ─── New: +1 token on cash-out (max 3 per round) ───
      const gotCount     = pdata.tokenGrantCount || 0;
      const hasUpgrade   = (pdata.cardUpgrades || [])
                            .some(u => u.effect === 'bonusToken');
      if (hasUpgrade && gotCount < 3) {
        await update(playerRef, {
          purchaseTokens:    (pdata.purchaseTokens || 0) + 1,
          tokenGrantCount:   gotCount + 1
        });
        console.log(`Granted +1 token on cash-out (${gotCount + 1}/3)`);
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens + 1}`;

      } else if (hasUpgrade) {
        // still clear nothing else—just skip if cap reached
        console.log('Token-grant upgrade drawn but already at 3 this round');
      }


      // Stage 1 Fright penalty?
      if (pdata.stage1FrightArmed) {
        multiplier = multiplier / 3;
        // clear the flag so it only applies once
        await update(playerRef, {
          stage1FrightArmed: false
        });
        console.log("Stage 1 Fright penalty applied: lose 3x on this bet");
      }


      const payout = Math.floor(bet * multiplier);

      // 💰 Update balance and end turn
      await endTurn(`Cashed out $${payout}`, payout);

      /* ── Kingpin: +0.1 on cash-out if a King was part of the hand ── */
      if (hadKing) {
        const inc      = 0.1 * pdata.kingpinCount;          // stackable
        const oldMults = pdata.multipliers || {};
        const newMults = {};

        for (const [stage, m] of Object.entries(oldMults)) {
          newMults[stage] = +(m + inc).toFixed(2);           // keep it tidy
        }

        await update(playerRef, { multipliers: newMults });
        console.log(`👑 Kingpin: cashed a King → +${inc.toFixed(2)} on every stage`);
        displayMultipliers();
      }

      // 💀 Cursed Loan logic (apply AFTER payout)
      if (pdata.cursedLoan) {
        const stageNum = 3;
        const oldMults = pdata.multipliers || {};
        const boosted = (oldMults[stageNum] || multipliers[stageNum]) + CURSED_LOAN_INC ;
        const newMults = { ...oldMults, [stageNum]: boosted };
        await update(playerRef, { multipliers: newMults });
        console.log(`💀 Cursed Loan: Stage ${stageNum} multiplier increased to ${boosted}x`);
        displayMultipliers();
      }

      return;
    }

    const card3 = await drawUniqueCard(state.drawnCards, true);
    if (!card3) return endTurn('Deck is empty. Round ending early.', 0);

    await applyCardUpgradeBonus(card3);
    state.drawnCards.push(card3);

    const [v1, v2]   = [state.drawnCards[0].value, state.drawnCards[1].value];
    const inBetween  = card3.value > Math.min(v1, v2) && card3.value < Math.max(v1, v2);

    if ((guess === 'In-Between' && inBetween) ||
        (guess === 'Outside'    && !inBetween)) {
      state.currentStage = 4;
      state.status       = 'Correct! Cash out 4x or pick Suit';
      await update(stateRef, state);
      await emitSuccess();
    } else {
      await update(stateRef, { drawnCards: state.drawnCards });
      await emitFailure();
      return endTurn('Wrong guess. You lose.', 0);
    }
    return;
  }

  // ─── Stage 4 ────────────────────────────────────────────────────────────────
  if (stage === 4) {
    if (guess === 'Cash Out') {
      // fetch player data so pdata is defined
      const psnap = await get(playerRef);
      const pdata = psnap.val() || {};

      const hadKing = pdata.kingpinCount > 0 && state.drawnCards.some(c => c.value === 13);

      // 1) Remove the first drawn card
      const deckSnap = await get(deckRef);
      let deck = deckSnap.val() || [];
      deck = deck.filter(c => c.text !== state.drawnCards[0].text);
      await set(deckRef, deck);

      // 2) Clear drawn cards and persist
      state.drawnCards = [];
      await update(stateRef, state);

      // 3) Base multiplier for Stage 4 cash‑out (4×)
      let multiplier = pdata.multipliers?.[3] || multipliers[3];

      // 4) Burn card modifiers
      if (pdata.bonusPlus3Active) {
        multiplier += 3;
        await update(playerRef, { bonusPlus3Active: false });
      }
      if (pdata.bonusMult1_25Active) {
        multiplier = Math.round(multiplier * 1.25);
        await update(playerRef, { bonusMult1_25Active: false });
      }

      // ─── Power Rush support ─────────────────────────────────────
      if (pdata.powerRushRoundsLeft > 0) {
        multiplier += 3;
        console.log(`Power Rush applied: +3 mult (rounds left: ${pdata.powerRushRoundsLeft})`);
      }
      // ─── Instant Gratification support ───────────────────────────
      if (pdata.instantGratRoundsLeft > 0) {
        /* multiplicative, because the upgrade says “1.25x” */
        multiplier = Math.round(multiplier * 1.25);
        console.log(
          `Instant Gratification applied: ×1.25 (rounds left: ${pdata.instantGratRoundsLeft})`
        );
      }

      // 5) Bet‑modifiers
      if (pdata.clutchKingCount > 0 && pdata.betsMade > maxBetsPerPlayer / 2) {
        multiplier += pdata.clutchKingCount;
      }
      if (pdata.snowballer && pdata.lastBalanceBeforeBet) {
        multiplier += bet / pdata.lastBalanceBeforeBet;
      }
      if (pdata.allInBonus && pdata.isAllIn) {
        multiplier *= 2;
      }
      // ─── New: grant +1 bet here if you own the '+1 bet' upgrade ────
      await applyOneBetBonus();

      // ─── New: +1 token on cash-out (max 3 per round) ───
      const gotCount     = pdata.tokenGrantCount || 0;
      const hasUpgrade   = (pdata.cardUpgrades || [])
                            .some(u => u.effect === 'bonusToken');
      if (hasUpgrade && gotCount < 3) {
        await update(playerRef, {
          purchaseTokens:    (pdata.purchaseTokens || 0) + 1,
          tokenGrantCount:   gotCount + 1
        });
        console.log(`Granted +1 token on cash-out (${gotCount + 1}/3)`);
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens + 1}`;

      } else if (hasUpgrade) {
        // still clear nothing else—just skip if cap reached
        console.log('Token-grant upgrade drawn but already at 3 this round');
      }


      // Stage 1 Fright penalty?
      if (pdata.stage1FrightArmed) {
        multiplier = multiplier / 3;
        // clear the flag so it only applies once
        await update(playerRef, {
          stage1FrightArmed: false
        });
        console.log("Stage 1 Fright penalty applied: lose 3x on this bet");
      }


      const payout = Math.floor(bet * multiplier);

      // 💰 Update balance and end turn
      await endTurn(`Cashed out $${payout}`, payout);

      /* ── Kingpin: +0.1 on cash-out if a King was part of the hand ── */
      if (hadKing) {
        const inc      = 0.1 * pdata.kingpinCount;          // stackable
        const oldMults = pdata.multipliers || {};
        const newMults = {};

        for (const [stage, m] of Object.entries(oldMults)) {
          newMults[stage] = +(m + inc).toFixed(2);           // keep it tidy
        }

        await update(playerRef, { multipliers: newMults });
        console.log(`👑 Kingpin: cashed a King → +${inc.toFixed(2)} on every stage`);
        displayMultipliers();
      }

      // 💀 Cursed Loan logic (apply AFTER payout)
      if (pdata.cursedLoan) {
        const stageNum = 4;
        const oldMults = pdata.multipliers || {};
        const boosted = (oldMults[stageNum] || multipliers[stageNum]) + CURSED_LOAN_INC ;
        const newMults = { ...oldMults, [stageNum]: boosted };
        await update(playerRef, { multipliers: newMults });
        console.log(`💀 Cursed Loan: Stage ${stageNum} multiplier increased to ${boosted}x`);
        displayMultipliers();
      }

      return;
    }


    const card4 = await drawUniqueCard(state.drawnCards, true);
    if (!card4) return endTurn('Deck is empty. Round ending early.', 0);

    await applyCardUpgradeBonus(card4);
    state.drawnCards.push(card4);

    if (guess === card4.suit) {
      state.currentStage = 5;
      state.status       = 'Final Stage! Guess the exact card value!';
      await update(stateRef, state);
      await emitSuccess();
    } else {
      await update(stateRef, { drawnCards: state.drawnCards });
      await emitFailure();
      return endTurn('Wrong suit. You lose.', 0);
    }
    return;
  }

  // ─── Stage 5 ────────────────────────────────────────────────────────────────
  if (stage === 5) {
    if (guess === 'Cash Out') {

      // fetch player data so pdata is defined
      const psnap = await get(playerRef);
      const pdata = psnap.val() || {};

      const hadKing = pdata.kingpinCount > 0 && state.drawnCards.some(c => c.value === 13);

      // 1) Remove the first drawn card
      const deckSnap = await get(deckRef);
      let deck = deckSnap.val() || [];
      deck = deck.filter(c => c.text !== state.drawnCards[0].text);
      await set(deckRef, deck);

      // 2) Clear drawn cards and persist
      state.drawnCards = [];
      await update(stateRef, state);

      // 3) Base multiplier for Stage 5 cash‑out (20×)
      let multiplier = pdata.multipliers?.[4] || multipliers[4];

      // 4) Burn card modifiers
      if (pdata.bonusPlus3Active) {
        multiplier += 3;
        await update(playerRef, { bonusPlus3Active: false });
      }
      if (pdata.bonusMult1_25Active) {
        multiplier = Math.round(multiplier * 1.25);
        await update(playerRef, { bonusMult1_25Active: false });
      }

      // ─── Power Rush support ─────────────────────────────────────
      if (pdata.powerRushRoundsLeft > 0) {
        multiplier += 3;
        console.log(`Power Rush applied: +3 mult (rounds left: ${pdata.powerRushRoundsLeft})`);
      }
      // ─── Instant Gratification support ───────────────────────────
      if (pdata.instantGratRoundsLeft > 0) {
        /* multiplicative, because the upgrade says “1.25x” */
        multiplier = Math.round(multiplier * 1.25);
        console.log(
          `Instant Gratification applied: ×1.25 (rounds left: ${pdata.instantGratRoundsLeft})`
        );
      }

      // 5) Bet‑modifiers
      if (pdata.clutchKingCount > 0 && pdata.betsMade > maxBetsPerPlayer / 2) {
        multiplier += pdata.clutchKingCount;
      }
      if (pdata.snowballer && pdata.lastBalanceBeforeBet) {
        multiplier += bet / pdata.lastBalanceBeforeBet;
      }
      if (pdata.allInBonus && pdata.isAllIn) {
        multiplier *= 2;
      }
      // ─── New: grant +1 bet here if you own the '+1 bet' upgrade ────
      await applyOneBetBonus();

      // ─── New: +1 token on cash-out (max 3 per round) ───
      const gotCount     = pdata.tokenGrantCount || 0;
      const hasUpgrade   = (pdata.cardUpgrades || [])
                            .some(u => u.effect === 'bonusToken');
      if (hasUpgrade && gotCount < 3) {
        await update(playerRef, {
          purchaseTokens:    (pdata.purchaseTokens || 0) + 1,
          tokenGrantCount:   gotCount + 1
        });
        console.log(`Granted +1 token on cash-out (${gotCount + 1}/3)`);
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens + 1}`;

      } else if (hasUpgrade) {
        // still clear nothing else—just skip if cap reached
        console.log('Token-grant upgrade drawn but already at 3 this round');
      }


      // Stage 1 Fright penalty?
      if (pdata.stage1FrightArmed) {
        multiplier = multiplier / 3;
        // clear the flag so it only applies once
        await update(playerRef, {
          stage1FrightArmed: false
        });
        console.log("Stage 1 Fright penalty applied: lose 3x on this bet");
      }


      const payout = Math.floor(bet * multiplier);

      // 💰 Update balance and end turn
      await endTurn(`Cashed out $${payout}`, payout);

      /* ── Kingpin: +0.1 on cash-out if a King was part of the hand ── */
      if (hadKing) {
        const inc      = 0.1 * pdata.kingpinCount;          // stackable
        const oldMults = pdata.multipliers || {};
        const newMults = {};

        for (const [stage, m] of Object.entries(oldMults)) {
          newMults[stage] = +(m + inc).toFixed(2);           // keep it tidy
        }

        await update(playerRef, { multipliers: newMults });
        console.log(`👑 Kingpin: cashed a King → +${inc.toFixed(2)} on every stage`);
        displayMultipliers();
      }

      // 💀 Cursed Loan logic (apply AFTER payout)
      if (pdata.cursedLoan) {
        const stageNum = 5;
        const oldMults = pdata.multipliers || {};
        const boosted = (oldMults[stageNum] || multipliers[stageNum]) + CURSED_LOAN_INC ;
        const newMults = { ...oldMults, [stageNum]: boosted };
        await update(playerRef, { multipliers: newMults });
        console.log(`💀 Cursed Loan: Stage ${stageNum} multiplier increased to ${boosted}x`);
        displayMultipliers();
      }

      return;
    }


    const card5 = await drawUniqueCard(state.drawnCards, true);
    if (!card5) return endTurn('Deck is empty. Round ending early.', 0);

    await applyCardUpgradeBonus(card5);
    state.drawnCards.push(card5);

    const guessVal =
      guess === 'J' ? 11 :
      guess === 'Q' ? 12 :
      guess === 'K' ? 13 :
      guess === 'A' ? 14 :
      parseInt(guess, 10);

    if (card5.value === guessVal) {
      await update(stateRef, { drawnCards: state.drawnCards });
      await emitSuccess();

      const psnap = await get(playerRef);
      const pdata = psnap.val() || {};
      let multiplier = pdata.snowballer && pdata.lastBalanceBeforeBet
        ? (pdata.multipliers?.[5] || multipliers[5] || 500) + (bet / pdata.lastBalanceBeforeBet)
        : (pdata.multipliers?.[5] || multipliers[5] || 500);
      if (pdata.allInBonus && pdata.isAllIn) multiplier *= 3;

      const payout = Math.floor(bet * multiplier);

      // 💰 Update balance and end turn
      await endTurn(
        `Unbelievable! Exact match! You win $${payout}`,
        payout
      );

      // 💀 Cursed Loan logic (apply AFTER payout)
      if (pdata.cursedLoan) {
        const stageNum = 2;
        const oldMults = pdata.multipliers || {};
        const boosted = (oldMults[stageNum] || multipliers[stageNum]) + CURSED_LOAN_INC ;
        const newMults = { ...oldMults, [stageNum]: boosted };
        await update(playerRef, { multipliers: newMults });
        console.log(`💀 Cursed Loan: Stage ${stageNum} multiplier increased to ${boosted}x`);
      }
    } else {
      await update(stateRef, { drawnCards: state.drawnCards });
      await emitFailure();
      return endTurn(`Wrong! The card was ${card5.text}. You lose.`, 0);
    }
  }
}


let endTurnAlreadyCalled = false; // global scope

async function endTurn(message, payout) {
  if (endTurnAlreadyCalled) return;
  endTurnAlreadyCalled = true;

  // ⏳ Get the latest player data from Firebase
  const playerSnap = await get(playerRef);
  const playerData = playerSnap.val();
  const prevBets = playerData?.betsMade || 0;

  // 🧮 Clamp increment to maxBetsPerPlayer
  const permBonus  = playerData.betModifierBonus  || 0; // shop modifiers
  const roundBonus = playerData.roundBetBonus     || 0; // card upgrades
  const effectiveMax = maxBetsPerPlayer + permBonus + roundBonus;
  const newBets = Math.min(prevBets + 1, effectiveMax);
  correctGuessCount = 0;

  if (payout === 0 && stateRef) {
    const stateSnap = await get(stateRef);
    const state = stateSnap.val();
    const failedStage = state?.currentStage;

    if (failedStage && failedStage >= 1 && failedStage <= 5) {
      const shields = playerData.shields || {};
      const recoveryPercent = shields[failedStage];
      if (recoveryPercent) {
        const recovered = Math.floor(state.bet * (recoveryPercent / 100));
        localPlayer.balance += recovered;
        await update(playerRef, { balance: localPlayer.balance });
        console.log(`Shield activated: recovered $${recovered} from failed Stage ${failedStage}`);
      }
    }
  }
  // 🤑 Update balance if payout > 0
  if (payout > 0) {
    localPlayer.balance += payout;
    await update(playerRef, { balance: localPlayer.balance });
  }

  // fetch fresh player data
  const pdata = (await get(playerRef)).val() || {};
  const prevHigh = pdata.highestBalance ?? localPlayer.balance;
  if (localPlayer.balance > prevHigh) {
    await update(playerRef, { highestBalance: localPlayer.balance });
  }


  // ✅ Only update betsMade if we're still below the max
  if (prevBets < effectiveMax) {
    localPlayer.betsMade = newBets;
    await update(playerRef, {
      betsMade: newBets,
      balance: localPlayer.balance
    });
  }

  // Reset All In flag
  await update(playerRef, { isAllIn: false });

  // 💀 Eliminate if balance drops to 0
  if (localPlayer.balance <= 0) {
    localPlayer.eliminated = true;
    await update(playerRef, { eliminated: true });
  }

  // 🧼 Clean up visuals:
  // Always stop the timer…
  clearCountdown();
  // …but only clear the card display & buttons if it was a payout (i.e. a correct cash‑out or win).
  if (payout > 0) {
    document.getElementById('cardArea').innerHTML = '';
    document.getElementById('guessButtons').innerHTML = '';
  }

  // 📝 Update status
  await update(stateRef, {
    status: `${localPlayer.name}: ${message}`,
    currentStage: 0
  });

  // ── SOLO MODE: apply interest & Cursed Loan AFTER each bet ends ──
  // if (soloMode) {
    const psnap2 = await get(playerRef);
    const pdata2 = psnap2.val() || {};
    // 1) Interest
    if (pdata2.interestPercent > 0) {
      const interest = Math.floor(pdata2.balance * (pdata2.interestPercent / 100));
      const bal1     = pdata2.balance + interest;
      await update(playerRef, { balance: bal1 });
      localPlayer.balance = bal1;
      if (settings.interestAlerts) {
        alert(`💰 You earned $${interest} interest (${pdata2.interestPercent}%)!`);
      }
    }
    // 2) Cursed Loan penalty
    if (pdata2.cursedLoan) {
      const penalty = Math.floor(localPlayer.balance * 0.20);
      const bal2    = localPlayer.balance - penalty;
      await update(playerRef, { balance: bal2 });
      localPlayer.balance = bal2;
      if (settings.interestAlerts) {
        alert(`💸 You lost $${penalty} due to the Cursed Loan (-20%).`);
      }
    }
  // }

  // 👥 Refresh player UI
  const playersSnap = await get(ref(db, `games/${lobbyCode}/players`));
  const players = playersSnap.val();
  updatePlayerStats(Object.entries(players).map(([id, data]) => ({
    id,
    ...data,
    isCurrent: id === playerId
  })));
  // 🃏 Refill deck if it's empty
  const deckSnap = await get(deckRef);
  const currentDeck = deckSnap.val() || [];
  if (currentDeck.length === 0) {
    const fullDeck = [];
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    for (const suit of suits) {
      for (const val of values) {
        fullDeck.push({
          text: val + suit,
          suit,
          value: val === 'A' ? 14 : val === 'K' ? 13 : val === 'Q' ? 12 : val === 'J' ? 11 : parseInt(val)
        });
      }
    }
    fullDeck.sort(() => Math.random() - 0.5);
    await set(deckRef, fullDeck);
  }
  // 🔁 Check if round is complete
  checkRoundCompletion();
}





async function updateGameDOM(state) {
  // 1) Update the status line
  document.getElementById('status').textContent = state.status || '';
  // show/hide targetThreshold
  const threshEl = document.getElementById('targetThreshold');
  if (soloMode && (state.threshold)) {
    // always overwrite whatever's in the box
    threshEl.textContent = `Target to beat: $${state.threshold}`;
  } else {
    // optionally clear it if you ever leave solo mode
    threshEl.textContent = '';
  }


  // 2) Fetch the *current* player's data (so everyone sees THEIR upgrades glowing)
  const currentPlayerId   = state.currentPlayer;
  const playerSnap        = await get(ref(db, `games/${lobbyCode}/players/${currentPlayerId}`));
  const currentPlayerData = playerSnap.val() || {};

  // 3) Redraw the card play area, using their cardUpgrades for the glow
  const cardArea = document.getElementById('cardArea');
  cardArea.innerHTML = '';
  (state.drawnCards || []).forEach(card => {
    // find if *they* bought an upgrade for this card
    const match = (currentPlayerData.cardUpgrades || []).find(up => up.text === card.text);
    // pass that effect into createCardDisplay
    const cardEl = createCardDisplay(card, match?.effect);
    cardArea.appendChild(cardEl);
  });

  const ui = document.getElementById('gameUI');
  if (state.currentPlayer === playerId && !soloMode) {
    ui.classList.add('my-turn');
  } else {
    ui.classList.remove('my-turn');
  }


  // 4) Rebuild the guess buttons for *your* turn
  const guessArea = document.getElementById('guessButtons');
  guessArea.innerHTML = '';
  if (state.currentPlayer === playerId && state.currentStage > 0) {
    // we still need *your* own data for multipliers & flags
    const snap = await get(playerRef);
    const pdata = snap.val() || {};
    const bet   = state.bet || 0;
    const stage = state.currentStage;

    // build options
    let options = [];
    if (stage === 1) {
      options = ['Red','Black'];
      if (pdata.addBlueSuits) options.push('Blue');
    } else if (stage === 4) {
      const suits = ['♠','♥','♦','♣'];
      if (pdata.addBlueSuits) suits.push('☾','★');
      options = ['Cash Out', ...suits];
    } else {
      options = getOptionsForStage(stage);
    }

    // render
    options.forEach(opt => {
      const btn = document.createElement('button');
      if (opt === 'Cash Out') {
        const baseKey  = stage - 1;
        const baseMult = pdata.multipliers?.[baseKey] ?? multipliers[baseKey];

        let actualMult = baseMult;

        // ─── card‑burn modifiers ───────────────────────────
        if (pdata.bonusPlus3Active) {
          actualMult += 3;
        }
        if (pdata.bonusMult1_25Active) {
          actualMult = Math.round(actualMult * 1.25);
        }

        // ─── your existing bet‑modifiers ───────────────────
        if (pdata.snowballer && pdata.lastBalanceBeforeBet) {
          actualMult += bet / pdata.lastBalanceBeforeBet;
        }
        if (pdata.allInBonus && pdata.isAllIn) {
          actualMult *= 2;
        }
        if (
          pdata.clutchKingCount > 0 &&
          pdata.betsMade > maxBetsPerPlayer / 2
        ) {
          actualMult += pdata.clutchKingCount;
        }
        if (pdata.stage1FrightArmed) {
          actualMult = actualMult / 3;
        }

        btn.textContent = `Cash Out (${actualMult.toFixed(2)}x)`;
      } else {
        // show the guess option text for everything else
        btn.textContent = opt;
      }
      btn.addEventListener('click', async () => {
        if (guessLock) return;           // already handling a guess?
        guessLock = true;                // lock out further clicks
        clearCountdown();
        // disable all guess buttons immediately
        guessArea.querySelectorAll('button').forEach(b => b.disabled = true);
        try {
          await handleGuess(opt, state); // wait until the guess logic completes
        } finally {
          guessLock = false;             // unlock for the next round
        }
      });

      guessArea.appendChild(btn);
    });


    //if (!soloMode) startCountdown(20, () => {
    //  endTurn("Ran out of time! You lose.", 0);
    //});
  }

  // 5) Finally, update the multiplier list
  displayMultipliers();
}




    function getOptionsForStage(stage) {
      if (stage === 1) return ['Red', 'Black'];
      if (stage === 2) return ['Cash Out', 'Higher', 'Lower'];
      if (stage === 3) return ['Cash Out', 'In-Between', 'Outside'];
      if (stage === 4) return ['Cash Out','♠', '♥', '♦', '♣'];
      if (stage === 5) return ['Cash Out', '2','3','4','5','6','7','8','9','10','J','Q','K','A'];
      return [];
    }


function updatePlayerStats(players) {
  const container = document.getElementById('playerStats');
  container.innerHTML = '';
  const upgradeSummary = [];
  const maxRounds = Math.max(...players.map(p => p.roundsWon || 0));
players.forEach((p) => {
  const isLeader = (p.roundsWon || 0) === maxRounds && maxRounds > 0;

    const box = document.createElement('div');
    box.className = 'player-box' + (p.isCurrent ? ' active' : '') + (p.eliminated ? ' eliminated' : '');
    const permBonus  = p.betModifierBonus  || 0;
    const roundBonus = p.roundBetBonus     || 0;
    box.innerHTML = `
    <strong>${p.name} ${isLeader ? '👑' : ''}</strong><br>
    Balance: $${p.balance}<br>
    Rounds Won: ${p.roundsWon}<br>
    Bets Made: ${p.betsMade || 0}/${maxBetsPerPlayer + permBonus + roundBonus}
    ${p.eliminated ? '<em>Eliminated</em>' : ''}
    `;
    container.appendChild(box);
    const shieldStages = Object.keys(p.shields || {}).join(', ') || 'None';
    const cardUps = (p.cardUpgrades || []).map(c => `${c.text} (${c.effect})`).join(', ') || 'None';

    upgradeSummary.push(`
      <strong>${p.name}</strong>: 
      Bet Modifiers: ${p.betModifierBonus || 0}, 
      Interest: ${p.interestPercent || 0}%, 
      Shields: ${shieldStages}, 
      Card Upgrades: ${cardUps}
    `);
  });
  const upgradesDiv = document.getElementById('playerUpgrades');
  if (upgradesDiv) {
    upgradesDiv.innerHTML = `<h3>Player Modifiers & Upgrades</h3>` + 
      players.map(p => {
        const history = p.modifierHistory || [];
        const listItems = history.map(item => `<li>${item}</li>`).join('');
        return `<strong>${p.name}</strong><ul style="margin-top: 0.25rem; margin-bottom: 1rem;">${listItems || '<li>None</li>'}</ul>`;
      }).join('');
  }
}


async function advanceToNextPlayer() {
  const playersSnap = await get(ref(db, `games/${lobbyCode}/players`));
  const players = playersSnap.val();
  if (!players) return;

  const ids = Object.keys(players);
  const stateSnap = await get(stateRef);
  const currentId = stateSnap.val()?.currentPlayer;
  const currentIndex = ids.indexOf(currentId);

  let nextPlayerId = null;

  for (let i = 1; i <= ids.length; i++) {
    const candidateIndex = (currentIndex + i) % ids.length;
    const candidateId = ids[candidateIndex];
    const staticPlayer = players[candidateId]; // from cache
    const playerSnap = await get(ref(db, `games/${lobbyCode}/players/${candidateId}`));
    const dynamicPlayer = playerSnap.val(); // fresh from Firebase
    const effectiveMax = maxBetsPerPlayer + (dynamicPlayer.betModifierBonus || 0) + (dynamicPlayer.roundBetBonus    || 0);
    if (dynamicPlayer && !dynamicPlayer.eliminated && dynamicPlayer.betsMade < effectiveMax) {
      nextPlayerId = candidateId;
      break;
    }
  }

  if (nextPlayerId) {
    await update(stateRef, { currentPlayer: nextPlayerId });

    // 🔥 Update the player stats UI right away with new current player
    updatePlayerStats(Object.entries(players).map(([id, data]) => ({
      id,
      ...data,
      isCurrent: id === nextPlayerId
    })));
  }
}


function playTurnSound() {
  const sound = document.getElementById('turnSound');
  if (sound) {
    sound.currentTime = 0;
    sound.play().catch(e => console.warn("Sound playback failed:", e));
  }
}

function startCountdown(seconds, onExpire) {
  clearCountdown();

  const bar = document.getElementById("timerBar");
  const container = document.getElementById("timerBarContainer");

  bar.style.width = "100%";
  container.style.display = "block";

  let timeLeft = seconds;
  const total = seconds;

  countdownInterval = setInterval(() => {
    timeLeft--;
    const percent = (timeLeft / total) * 100;
    bar.style.width = percent + "%";
  }, 1000);

  countdownTimeout = setTimeout(() => {
    clearCountdown();
    onExpire();
  }, seconds * 1000);
}

let lastCardOffered = null;

// Build the array of every card instance in *this* player's deck
function buildPlayerDeck(playerData) {
  const baseSuits = ['♠','♥','♦','♣'];
  const values    = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  let deck = [];

  // 1) One of each base card
  for (const suit of baseSuits) {
    for (const v of values) {
      const num = v==='A'?14:v==='K'?13:v==='Q'?12:v==='J'?11:parseInt(v,10);
      deck.push({ text: v + suit, suit, value: num });
    }
  }

  // 2) Blue suits if owned
  if (playerData.addBlueSuits) {
    for (const suit of ['☾','★']) {
      for (const v of values) {
        const num = v==='A'?14:v==='K'?13:v==='Q'?12:v==='J'?11:parseInt(v,10);
        deck.push({ text: v + suit, suit, value: num });
      }
    }
  }

  // 3) Ace & Two boosts (one extra per purchase)
  const boostCount = playerData.aceTwoBoostCount || 0;
  if (boostCount > 0) {
    let suits = [...baseSuits];
    if (playerData.addBlueSuits)      suits.push('☾','★');
    if (playerData.removeDiamondsClubs)
      suits = suits.filter(s => s!=='♦' && s!=='♣');
    for (let i = 0; i < boostCount; i++) {
      for (const s of suits) {
        deck.push({ text:'A'+s, suit:s, value:14 });
        deck.push({ text:'2'+s, suit:s, value:2  });
      }
    }
  }

  // 4) Removals: diamonds & clubs, faceless, remove2-4
  const facelessCount   = playerData.facelessCount   || 0;
  const remove2to4Count = playerData.remove2to4Count || 0;
  const remove7and8Count = playerData.remove7and8Count || 0;
  deck = deck.filter(c => {
    if (playerData.removeDiamondsClubs && (c.suit==='♦'||c.suit==='♣')) return false;
    if (facelessCount   > 0 && [11,12,13].includes(c.value)) return false;
    if (remove2to4Count > 0 && [2,3,4].includes(c.value))       return false;
    if (remove7and8Count > 0 && [7,8].includes(c.value))         return false;
    return true;
  });

  // ─── Remove any cards that the player has “removed” ───────────────
  const removed = (playerData.cardUpgrades || [])
    .filter(u => u.effect === 'remove_card')
    .map(u => u.text);
  deck = deck.filter(c => !removed.includes(c.text));

  return deck;
}


async function showShopOptions(isWinner) {
  // 1) Fetch the latest player data (so tokens are always up‑to‑date)
  const snap        = await get(playerRef);
  const playerData  = snap.val() || {};

  // 2) Reveal the shop UI and display fresh token count
  const shop        = document.getElementById('shopSection');
  shop.classList.remove('hidden');
  const tokenDisplay = document.getElementById('playerTokens');
  tokenDisplay.innerHTML =
    `Tokens: <strong>${playerData.purchaseTokens || 0}</strong>` +
    `<br><span style="font-size:0.8rem; opacity:0.8;">` +
    `💡 Every 4 you're holding earns +1 extra at round&nbsp;end &nbsp;(max&nbsp;+5)` +
    `</span>`;

  // ▶️ Reshuffle button (1 token)
  let reshuffleBtn = document.getElementById('reshuffleShopBtn');
  if (!reshuffleBtn) {
    reshuffleBtn = document.createElement('button');
    reshuffleBtn.id = 'reshuffleShopBtn';
    reshuffleBtn.textContent = '🔄 Reshuffle Shop (1 token)';
    reshuffleBtn.style.margin = '0.5rem 0';
    shop.insertBefore(reshuffleBtn, tokenDisplay.nextSibling);
  }

  reshuffleBtn.onclick = async () => {
    // 1) Fetch fresh player data & token count
    const psnap   = await get(playerRef);
    const pd      = psnap.val() || {};
    const tokens  = pd.purchaseTokens || 0;
    if (tokens < 1) return alert("🛑 You don't have enough tokens to reshuffle.");

    // 2) Deduct one token and update both Firebase & on‑screen counter
    await update(playerRef, { purchaseTokens: tokens - 1 });
    const tokenDisplay = document.getElementById('playerTokens');
    tokenDisplay.textContent = `Tokens: ${tokens - 1}`;

    // 3) Build a fresh sharedBetModifiers list
    const allKeys = [
      "Bonus Bets","Super Multiplier","Bonus Interest",
      "Stage 1 Boost","Stage 2 Boost","Stage 3 Boost","Stage 4 Boost", "Stage 5 Boost",
      "Stage 1 Shield","Stage 2 Shield","Stage 3 Shield","Stage 4 Shield","Stage 5 Shield",
      "Hail Mary","Blue Suits & Boost","Snow-baller", "Summon Kings",
      "Ace & Two","Faceless","Remove 2-4","Quick Start","Humble Beginnings",
      "Clutch King","Kingpin","Two-edged","Witch's Cauldron","Stage 1 Fright",
      "Cursed Loan","Remove 2 Clubs", "Remove 2 Spades", "Remove 2 Hearts", "Remove 2 Diamonds",
      "Power Rush", "Decay", "Card Factory","Deck Power", "Deck Stash"
    ];

    // 2) Build a fresh card upgrade offer
    const fullDeck = buildPlayerDeck(playerData);
    const newCard  = fullDeck[Math.floor(Math.random() * fullDeck.length)];

    // 3) Pick 2 (or 3 if winner) random effects
    const allEffects = [
      '+1 bet',
      'Gain 25% of bet',
      'remove_card',
      'Gain 10% of Balance',
      'duplicate_card',
      '+3 Mult',
      '1.25x Mult',
      'bonusToken',            
    ];


    // shuffle and take the same count as before
    // 3) Shuffle the current shared bet‑modifiers (preserving count)
    // Make a copy and shuffle it in place
    const stateSnap = await get(stateRef);
    const oldShared = stateSnap.val()?.sharedBetModifiers || [];
    // sample brand-new modifiers (same count as before)
    const newShared = allKeys
      .sort(() => Math.random() - 0.5)
      .slice(0, oldShared.length);

    const count = playerData.isRoundWinner ? 3 : 2;
    const newEffects = allEffects
      .sort(() => Math.random() - 0.5)
      .slice(0, count);

    // 4) Persist the new shared list so showShopOptions re‑reads it
    await update(stateRef, { sharedBetModifiers: newShared});
    await update(playerRef, {offeredCard: newCard, offeredEffects: newEffects })

    // 5) Re‑call showShopOptions with the newly updated playerData
    const psnap2 = await get(playerRef);
    const pd2    = psnap2.val() || {};
    showShopOptions(pd2.isRoundWinner);
  };
  shop.insertBefore(reshuffleBtn, tokenDisplay.nextSibling);




  // 2) Fetch the shared modifier list from state
  const stateSnap   = await get(stateRef);
  const state       = stateSnap.val() || {};
  const sharedNames = state.sharedBetModifiers || [];

  // 3) Determine how many mods to show (winners see all)
  const limit      = isWinner ? sharedNames.length : sharedNames.length - 1;
  const shownNames = sharedNames.slice(0, limit);

  // 🎯 Logic map
  const betModifiersMap = {
    "Bonus Bets": {
      name: "Bonus Bets",
      // show the dynamic cost in the description if you like:
      desc: "+2 bets per round (cost ↑ by 2 each time)",
      apply: async () => {
        const snap = await get(playerRef);
        const data = snap.val() || {};

        // 1) how many times you've already bought it
        const count = data.bonusBetsCount || 0;
        // 2) cost = 3 + 2×count
        const cost  = 3 + (count * 2);
        const tokens = data.purchaseTokens || 0;
        if (tokens < cost) {
          return alert(`You need ${cost} tokens to buy Bonus Bets.`);
        }

        // 3) apply the +2 bets
        const newBonus = (data.betModifierBonus || 0) + 2;
        // 4) bump the purchase count
        const newCount = count + 1;
        // 5) record history
        const history = [...(data.modifierHistory||[]), `+2 bets per round (#${newCount})`];

        await update(playerRef, {
          betModifierBonus:  newBonus,
          purchaseTokens:    tokens - cost,
          bonusBetsCount:    newCount,
          modifierHistory:   history
        });

        alert(`Bonus Bets purchased (#${newCount})! +2 bets per round.`);
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - cost}`;
        displayMultipliers();
      }
    },

    "Super Multiplier": {
      name: "Super Multiplier",
      desc: "Increase all win multipliers by 1.25x, -2 bets",
      apply: async () => {
        const snap = await get(playerRef);
        const data = snap.val();
        const tokens = data.purchaseTokens || 0;
        if (tokens < 3) return alert("You don't have enough tokens.");
        const oldMultipliers = data.multipliers || { 1: 2, 2: 3, 3: 4, 4: 20, 5: 500 };
        const newMultipliers = {};
        for (const [stage, mult] of Object.entries(oldMultipliers)) {
          newMultipliers[stage] = Math.round(mult * 1.25);
        }
        const currentBonus = data.betModifierBonus || 0;
        
        alert("Multipliers increased by 1.25x! You lose 2 bets.");

        const history = data.modifierHistory || [];
        history.push("Increase all win multipliers by 1.25x, -2 bets");

        await update(playerRef, {
          multipliers: newMultipliers,
          betModifierBonus: currentBonus - 2,
          purchaseTokens: tokens - 3,
          modifierHistory: history
        });
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 3}`;
        displayMultipliers();
      }
    },
    "Hail Mary": {
      name: "Hail Mary",
      desc: "Going all-in doubles your multiplier for that bet",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;

        if (data.allInBonus) {
          return alert("⚠️ You already have Hail Mary and cannot purchase it again.");
        }
        if (tokens < 3) {
          return alert("You don't have enough tokens.");
        }

        const history = data.modifierHistory || [];
        history.push("Hail Mary: double on all-in");

        await update(playerRef, {
          allInBonus:      true,
          purchaseTokens:  tokens - 3,
          modifierHistory: history
        });

        alert("🎉 Hail Mary unlocked! If you go all-in, your multiplier will be doubled.");
        document.getElementById('playerTokens')
                .textContent = `Tokens: ${tokens - 3}`;
      }
    },

    "Blue Suits & Boost": {
      name: "Blue Suits & Boost",
      desc: "Add two new suits (☾ & ★) and multiply your win multipliers by 2x",
      apply: async () => {
        // 1️⃣ fetch latest player data
        const snap = await get(playerRef);
        const data = snap.val() || {};

        // ——— if already owned, block and inform ———
        if (data.addBlueSuits) {
          return alert("⚠️ You already have Blue Suits & Boost and cannot purchase it again.");
        }

        // 2️⃣ token check
        const tokens = data.purchaseTokens || 0;
        if (tokens < 2) return alert("You don't have enough tokens.");

        // 3️⃣ deduct token & flag
        const newTokens = tokens - 2;
        await update(playerRef, {
          addBlueSuits: true,
          purchaseTokens: newTokens
        });
        // mirror in-memory
        localPlayer.addBlueSuits = true;
        localPlayer.purchaseTokens = newTokens;

        // 4️⃣ record history
        const history = data.modifierHistory || [];
        history.push("Added Blue Suits & 2x multipliers");
        await update(playerRef, { modifierHistory: history });

        // 5️⃣ bump up multipliers
        const oldMults = data.multipliers || {1:2,2:3,3:4,4:20,5:500};
        const newMults = {};
        for (const [stage, m] of Object.entries(oldMults)) {
          newMults[stage] = Math.round(m * 2);
        }
        await update(playerRef, { multipliers: newMults });


        alert("🎉 You've unlocked the Blue Suits and your multipliers are now 2x higher!");
        document.getElementById('playerTokens').textContent = `Tokens: ${newTokens}`;
        displayMultipliers();
      }
    },
    // "Remove Diamonds & Clubs": {
    //   name: "Remove Diamonds & Clubs",
    //   desc: "Skip all ♦ and ♣ when drawing cards",
    //   apply: async () => {
    //     const snap   = await get(playerRef);
    //     const data   = snap.val() || {};
    //     const tokens = data.purchaseTokens || 0;
    //     if (tokens < 4) return alert("You don't have enough tokens.");

    //     // Mark this player as “removing” those suits
    //     await update(playerRef, {
    //       removeDiamondsClubs: true,
    //       purchaseTokens:      tokens - 4
    //     });

    //     // Record in history
    //     const history = data.modifierHistory || [];
    //     history.push("Remove all diamonds and clubs");
    //     await update(playerRef, { modifierHistory: history });

    //     alert("All ♦ and ♣ will now be skipped in your draws!");
    //     document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 4}`;
    //   }
    // },
    "Remove 2 Clubs": {
      name: "Remove 2 Clubs",
      desc: "Permanently remove 2 random ♣ from your deck",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;
        if (tokens < 4) return alert("You need 4 tokens to buy this.");   
        // Build your deck, filter for clubs, pick 2 at random
        let clubCards = buildPlayerDeck(data).filter(c => c.suit === '♣');
        const toRemove = [];
        for (let i = 0; i < 2 && clubCards.length; i++) {
          const idx = Math.floor(Math.random() * clubCards.length);
          toRemove.push(clubCards.splice(idx, 1)[0].text);
        }   
        // Persist removal: add each to cardUpgrades with effect remove_card
        const upgrades = data.cardUpgrades || [];
        toRemove.forEach(text => upgrades.push({ text, effect: 'remove_card' }));   
        const history = data.modifierHistory || [];
        history.push(`Removed 2 clubs: ${toRemove.join(', ')}`);    
        await update(playerRef, {
          cardUpgrades:     upgrades,
          purchaseTokens:   tokens - 4,
          modifierHistory:  history
        });
        alert(`🗑️ Removed 2 clubs: ${toRemove.join(', ')}`);
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 4}`;
      }
    },    
    "Remove 2 Spades": {
      name: "Remove 2 Spades",
      desc: "Permanently remove 2 random ♠ from your deck",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;
        if (tokens < 4) return alert("You need 4 tokens to buy this.");   
        let pool = buildPlayerDeck(data).filter(c => c.suit === '♠');
        const toRemove = [];
        for (let i = 0; i < 2 && pool.length; i++) {
          const idx = Math.floor(Math.random() * pool.length);
          toRemove.push(pool.splice(idx, 1)[0].text);
        }   
        const upgrades = data.cardUpgrades || [];
        toRemove.forEach(text => upgrades.push({ text, effect: 'remove_card' }));   
        const history = data.modifierHistory || [];
        history.push(`Removed 2 spades: ${toRemove.join(', ')}`);   
        await update(playerRef, {
          cardUpgrades:     upgrades,
          purchaseTokens:   tokens - 4,
          modifierHistory:  history
        });
        alert(`🗑️ Removed 2 spades: ${toRemove.join(', ')}`);
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 4}`;
      }
    },    
    "Remove 2 Hearts": {
      name: "Remove 2 Hearts",
      desc: "Permanently remove 2 random ♥ from your deck",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;
        if (tokens < 4) return alert("You need 4 tokens to buy this.");   
        let pool = buildPlayerDeck(data).filter(c => c.suit === '♥');
        const toRemove = [];
        for (let i = 0; i < 2 && pool.length; i++) {
          const idx = Math.floor(Math.random() * pool.length);
          toRemove.push(pool.splice(idx, 1)[0].text);
        }   
        const upgrades = data.cardUpgrades || [];
        toRemove.forEach(text => upgrades.push({ text, effect: 'remove_card' }));   
        const history = data.modifierHistory || [];
        history.push(`Removed 2 hearts: ${toRemove.join(', ')}`);   
        await update(playerRef, {
          cardUpgrades:     upgrades,
          purchaseTokens:   tokens - 4,
          modifierHistory:  history
        });
        alert(`🗑️ Removed 2 hearts: ${toRemove.join(', ')}`);
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 4}`;
      }
    },    
    "Remove 2 Diamonds": {
      name: "Remove 2 Diamonds",
      desc: "Permanently remove 2 random ♦ from your deck",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;
        if (tokens < 4) return alert("You need 4 tokens to buy this.");   
        let pool = buildPlayerDeck(data).filter(c => c.suit === '♦');
        const toRemove = [];
        for (let i = 0; i < 2 && pool.length; i++) {
          const idx = Math.floor(Math.random() * pool.length);
          toRemove.push(pool.splice(idx, 1)[0].text);
        }   
        const upgrades = data.cardUpgrades || [];
        toRemove.forEach(text => upgrades.push({ text, effect: 'remove_card' }));   
        const history = data.modifierHistory || [];
        history.push(`Removed 2 diamonds: ${toRemove.join(', ')}`);   
        await update(playerRef, {
          cardUpgrades:     upgrades,
          purchaseTokens:   tokens - 4,
          modifierHistory:  history
        });
        alert(`🗑️ Removed 2 diamonds: ${toRemove.join(', ')}`);
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 4}`;
      }
    },


    "Remove 2-4": {
      name: "Remove 2-4",
      desc: "Skip all 2s, 3s & 4s in your draws",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;
        if (tokens < 2) return alert("You don't have enough tokens.");

        // bump the count
        const newCount = (data.remove2to4Count || 0) + 1;
        await update(playerRef, {
          remove2to4Count:   newCount,
          purchaseTokens:    tokens - 2,
          modifierHistory: [
            ...(data.modifierHistory || []),
            `Remove 2-4 x${newCount}`
          ]
        });

        alert(`🚫 Cards 2, 3 & 4 will now be removed from your draws (purchased ${newCount}x).`);
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 2}`;
      }
    },
    "Snow-baller": {
      name: "Snow-baller",
      desc: "Win multiplier = multiplier + (bet / balance) for your next bet",
      apply: async () => {
        const snap = await get(playerRef);
        const data = snap.val() || {};
        const tokens = data.purchaseTokens || 0;
        if (data.snowballer) return alert("⚠️ You already have Snow-baller.");
        if (tokens < 2)       return alert("Not enough tokens.");

        // mark as owned
        await update(playerRef, {
          snowballer: true,
          purchaseTokens: tokens - 2
        });

        // record history
        const history = data.modifierHistory || [];
        history.push("Snow-baller: dynamic multiplier by % bet");
        await update(playerRef, { modifierHistory: history });

        alert("❄️ Snow-baller unlocked! Your next bet's multiplier will be multiplier + (bet / balance).");
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 2}`;
      }
    },
    "Ace & Two": {
      name: "Ace & Two",
      desc: "Add 1 Ace and 1 '2' for each suit you have per purchase",
      apply: async () => {
        const data   = (await get(playerRef)).val() || {};
        const tokens = data.purchaseTokens || 0;
        if (tokens < 2) return alert("You don't have enough tokens.");

        const newCount = (data.aceTwoBoostCount || 0) + 1;
        await update(playerRef, {
          aceTwoBoostCount: newCount,
          purchaseTokens:   tokens - 2,
          modifierHistory: [
            ...(data.modifierHistory || []),
            `Ace & Two x${newCount}`
          ]
        });

        alert(`🎉 Ace & Two purchased! You now get +${newCount} Aces & 2s per suit.`);
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 2}`;
      }
    },
    "Faceless": {
      name: "Faceless",
      desc: "Remove all J/Q/K from your draws",
      apply: async () => {
        const data   = (await get(playerRef)).val() || {};
        const tokens = data.purchaseTokens || 0;
        if (tokens < 2) return alert("You don't have enough tokens.");

        const newCount = (data.facelessCount || 0) + 1;
        await update(playerRef, {
          facelessCount:   newCount,
          purchaseTokens:  tokens - 2,
          modifierHistory: [
            ...(data.modifierHistory || []),
            `Faceless x${newCount}`
          ]
        });

        alert(`🆓 Faceless purchased! J/Q/K will be removed from your draws.`);
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 2}`;
      }
    },
    "Quick Start": {
      name: "Quick Start",
      desc: "Next round's starting balance +50 (cost ↑ each time)",
      apply: async () => {
      const snap   = await get(playerRef);
      const data   = snap.val() || {};
      const count  = data.quickStartCount || 0;
      const cost   = 3 + count;                     // base 3, +1 per prior purchase
      const tokens = data.purchaseTokens || 0;
      if (tokens < cost) {
          return alert(`🛑 You need ${cost} tokens to buy Quick Start.`);
        }

      // record the boost op
      const ops = data.startBalanceOps || [];
      ops.push({ type: 'boost', value: 50 });

      // increment purchase count
      const newCount = count + 1;

      const history = data.modifierHistory || [];
      history.push(`Quick Start #${newCount}: +50 starting balance`);

          
      await update(playerRef, {
          startBalanceOps:  ops,
          quickStartCount:  newCount,
          purchaseTokens:   tokens - cost,
          modifierHistory:  history
        });

        alert(`🚀 Quick Start purchased (#${newCount})! Next round you start with +50 bonus.`);
         document.getElementById('playerTokens')
                 .textContent = `Tokens: ${tokens - cost}`;

      }
    },

    "Humble Beginnings": {
      name: "Humble beginnings",
      desc: "Halve your next round's starting balance and increase all win multipliers by 1.25x",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;
        if (tokens < 2) return alert("🛑 You need 2 tokens to buy Humble Beginnings.");

        const ops = data.startBalanceOps || [];
        ops.push({ type: 'mult', value: 0.5 });

        // 2) Also boost all existing stage multipliers by 1.25×
        const oldMults = data.multipliers || {1:2,2:3,3:4,4:20,5:500};
        const boostedMults = {};
        for (const [stage, m] of Object.entries(oldMults)) {
          boostedMults[stage] = Math.round(m * 1.25);
        }

        const history = data.modifierHistory || [];
        history.push(`Humble Beginnings: halve starting balance  & 1.25x multiplier`);      
        
        await update(playerRef, {
          startBalanceOps:  ops,
          multipliers:      boostedMults,
          purchaseTokens:   tokens - 2,
          modifierHistory:  history
        });

        alert("🌱 Humble Beginnings purchased! Next round's start will be halved.");
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 2}`;
        displayMultipliers();
      }
    },

    "Clutch King": {
      name: "Clutch King",
      desc: "Gain +1 multiplier on bets once you're past halfway through your max bets",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;
        if (tokens < 2) return alert("You don't have enough tokens.");

        // stack count
        const newCount = (data.clutchKingCount || 0) + 1;

        // record in history
        const history = data.modifierHistory || [];
        history.push(`Clutch King x${newCount}`);

        // persist
        await update(playerRef, {
          clutchKingCount:  newCount,
          purchaseTokens:   tokens - 2,
          modifierHistory:  history
        });

        alert(`🏆 Clutch King purchased! On late bets you now get +${newCount} to your multiplier.`);
        document.getElementById('playerTokens')
                .textContent = `Tokens: ${tokens - 2}`;
      }
    },
    "Summon Kings": {
      name: "Summon Kings",
      desc: "Add 1 King of each suit to your deck (includes blue suits if owned)",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;

        if (tokens < 2) return alert("You don't have enough tokens.");

        const suits = ['♠', '♥', '♦', '♣'];
        if (data.addBlueSuits) suits.push('☾', '★');

        const dupCounts = data.duplicateCounts || {};

        for (const suit of suits) {
          const cardText = 'K' + suit;
          dupCounts[cardText] = (dupCounts[cardText] || 0) + 1;
        }

        const history = data.modifierHistory || [];
        history.push("Summon Kings: Added 1 King of each suit");

        await update(playerRef, {
          duplicateCounts: dupCounts,
          purchaseTokens: tokens - 2,
          modifierHistory: history
        });

        alert("🃏 You summoned the Kings! One King of each suit has been added to your deck.");
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 2}`;
      }
    },

    "Kingpin": {
      name: "Kingpin",
      desc: "Whenever you cash-out a King, permanently add +0.1 to all multipliers (stackable)",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;
        if (tokens < 2) return alert("You don't have enough tokens.");
        // stack one more Kingpin
        const newCount = (data.kingpinCount || 0) + 1;
        const history  = data.modifierHistory || [];
        history.push(`Kingpin x${newCount}`);
        await update(playerRef, {
          kingpinCount:      newCount,
          purchaseTokens:    tokens - 2,
          modifierHistory:   history
        });
        alert(`🃏 Kingpin purchased! From now on, each King drawn gives you +0.1 to your multiplier.`);
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 2}`;
      }
    },
    "Stage 1 Fright": {
      name: "Stage 1 Fright",
      desc: "If you fail Stage 1: gain +1 bet and lose 3x penalty on your next bet",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;

        if (data.stage1Fright) return alert("⚠️ You already have Stage 1 Fright and cannot purchase it again.");

        if (tokens < 4) return alert("You don't have enough tokens.");

        const history = data.modifierHistory || [];
        history.push("Stage 1 Fright purchased: next Stage 1 fail → +1 bet, lose 3x on next bet (max 3 times)");

        await update(playerRef, {
          purchaseTokens: tokens - 4,
          modifierHistory: history,
          stage1Fright: true    // flag that you own it
        });

        alert("Stage 1 Fright unlocked! If you fail Stage 1, you'll get +1 bet but your next Cash Out multiplier is reduced by 3x (max 3 times).");
        document.getElementById('playerTokens')
                .textContent = `Tokens: ${tokens - 4}`;
      }
    },
    "Witch's Cauldron": {
      name: "Witch's Cauldron",
      desc: "7 random cards will now share the same random number",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;
        if (tokens < 3) return alert("You don't have enough tokens.");

        const fullDeck = buildPlayerDeck(data);
        const shuffled = [...fullDeck].sort(() => Math.random() - 0.5);
        const prevMap = data.witchCauldronMap || {};
        const alreadyUsed = Object.keys(prevMap); // card.text values already affected

        // You can re-affect cards already in the map
        const available = shuffled.slice(0, 7);

        const newMap = {};
        const suits = data.addBlueSuits
          ? ['♠', '♥', '♦', '♣', '☾', '★']
          : ['♠', '♥', '♦', '♣'];
        const sharedSuit = suits[Math.floor(Math.random() * suits.length)];        
        const sharedValue = Math.floor(Math.random() * 13) + 2; // 2–14

        available.forEach(c => {
          newMap[c.text] = { value: sharedValue, suit: sharedSuit };
        });

        // Merge with previous cauldronMap
        const mergedMap = { ...prevMap, ...newMap };



        await update(playerRef, {
          witchCauldronMap: mergedMap,
          purchaseTokens: tokens - 3,
          modifierHistory: [
            ...(data.modifierHistory || []),
            `Witch's Cauldron: 7 cards now act as ${sharedValue} of ${sharedSuit}`
          ]
        });

        alert("🧪 Witch's Cauldron is bubbling! Those 7 cards now share the same number.");
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 3}`;
      }
    },
    "Cursed Loan": {
      name: "Cursed Loan",
      desc: "Start of turn: lose 20% of your balance. Cash out: +0.25 multiplier for next stage (permanent)",
      apply: async () => {
        const snap = await get(playerRef);
        const data = snap.val() || {};
        const tokens = data.purchaseTokens || 0;

        if (data.cursedLoan) return alert("💀 You already have Cursed Loan and cannot purchase it again.");

        if (tokens < 4) return alert("You don't have enough tokens.");

        // Mark the player as cursed
        await update(playerRef, {
          cursedLoan: true,
          purchaseTokens: tokens - 4,
          modifierHistory: [
            ...(data.modifierHistory || []),
            "Cursed Loan: -20% balance at start, +0.25 multiplier on cash out"
          ]
        });

        alert("💀 You've taken the Cursed Loan! Each turn will cost you 20%, but your multipliers will grow.");
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 4}`;

      }
    },


    "Bonus Interest": {
      name: "Bonus Interest",
      desc: "Earn +5% of your balance at the start of your turn (cost ↑ by 1 each time)",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;
        const count  = data.bonusInterestCount  || 0;
        const cost   = count + 2;

        if (tokens < cost) {
          return alert(`You need ${cost} tokens to buy this.`);
        }

        const newCount      = count + 1;
        const currentInterest = data.interestPercent || 0;
        const newInterest     = currentInterest + 5;

        // Record in history
        const history = data.modifierHistory || [];
        history.push(`+5% Bonus interest (#${newCount})`);

        // Persist all updates in one go
        await update(playerRef, {
          interestPercent:     newInterest,
          purchaseTokens:      tokens - cost,
          modifierHistory:     history,
          bonusInterestCount:  newCount
        });

        alert(`You will now earn +${newInterest}% interest at the start of each turn!`);
        document.getElementById('playerTokens')
                .textContent = `Tokens: ${tokens - cost}`;
      }
    },
    "Two-edged": {
      name: "Two-edged",
      desc: "Skip all 7s & 8s in your draws",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;
        if (tokens < 3) return alert("You don't have enough tokens.");

        const newCount = (data.remove7and8Count || 0) + 1;
        const history  = data.modifierHistory || [];
        history.push(`Remove 7s & 8s x${newCount}`);

        await update(playerRef, {
          remove7and8Count:   newCount,
          purchaseTokens:     tokens - 3,
          modifierHistory:    history
        });

        alert(`🚫 All 7s and 8s will now be skipped in your draws (purchased ${newCount}x).`);
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 3}`;
      }
    },
    "Power Rush": {
      name: "Power Rush",
      desc: "For 3 rounds, get +3 to all multipliers",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;
        const cost = 3;

        if (tokens < cost) return alert("You don't have enough tokens.");

        // Increment or initialize the rounds‑left counter
        const newRounds = (data.powerRushRoundsLeft || 0) + 3;
        const history   = data.modifierHistory || [];
        history.push(`Power Rush: +3 mult for ${newRounds} rounds total`);

        await update(playerRef, {
          powerRushRoundsLeft: newRounds,
          purchaseTokens:      tokens - cost,
          modifierHistory:     history
        });

        alert(`🔥 Power Rush! +3 multipliers for the next ${newRounds} rounds.`);
        document.getElementById('playerTokens')
                .textContent = `Tokens: ${tokens - cost}`;
        displayMultipliers();
      }
    },
    "Instant Gratification": {
      name: "Instant Gratification",
      desc: "For 3 rounds, all win multipliers 1.25x",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;

        const cost = 4;
        if (tokens < cost) return alert("You don't have enough tokens.");

        // add 3 rounds of ×1.25; stackable with previous leftovers
        const newRounds = (data.instantGratRoundsLeft || 0) + 3;

        await update(playerRef, {
          instantGratRoundsLeft: newRounds,
          purchaseTokens:        tokens - cost,
          modifierHistory: [
            ...(data.modifierHistory || []),
            `Instant Gratification: 1.25x for ${newRounds} rounds`
          ]
        });

        alert(`Instant Gratification purchased! Multipliers 1.25x for ${newRounds} rounds.`);
        document.getElementById('playerTokens').textContent = `Tokens: ${tokens - cost}`;
        displayMultipliers();
      }
    },



    "Decay": {
      name: "Decay",
      desc: "Each round: destroy 1 random card & +0.5 to a random stage multiplier",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;

        if (data.hasDecay)  return alert("You already own Decay.");
        if (tokens < 4)     return alert("You need 4 tokens to buy Decay.");

        await update(playerRef, {
          hasDecay: true,                           // flag so we know you own it
          purchaseTokens: tokens - 4,
          modifierHistory: [
            ...(data.modifierHistory || []),
            "Decay: delete 1 card & +0.5 random mult each round"
          ]
        });

        alert("☠️  Decay acquired! One card will rot away every round…");
        document.getElementById("playerTokens").textContent = `Tokens: ${tokens - 4}`;
      }
    },

    "Card Factory": {
      name: "Card Factory",
      desc: "Instantly create 5 random cards of any suit/value",
      apply: async () => {
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;
        const cost   = 3;                         // match the cost you set above

        if (tokens < cost) return alert("You don't have enough tokens.");

        /* 1️⃣  Decide the suit pool */
        const suits = ['♠','♥','♦','♣'];
        if (data.addBlueSuits) suits.push('☾','★');

        /* 2️⃣  Generate five random card texts */
        const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        const picks  = [];
        for (let i = 0; i < 5; i++) {
          const v   = values[Math.floor(Math.random()*values.length)];
          const s   = suits[Math.floor(Math.random()*suits.length)];
          picks.push(v + s);
        }

        /* 3️⃣  Fold them into duplicateCounts so they’re permanent */
        const dup   = data.duplicateCounts || {};
        picks.forEach(text => {
          dup[text] = (dup[text] || 0) + 1;
        });

        /* 4️⃣  Persist & log */
        await update(playerRef, {
          duplicateCounts: dup,
          purchaseTokens:  tokens - cost,
          modifierHistory: [
            ...(data.modifierHistory || []),
            `Card Factory: added ${picks.join(', ')}`
          ]
        });

        alert(`🃏 Card Factory produced: ${picks.join(', ')}`);
        document.getElementById('playerTokens').textContent =
          `Tokens: ${tokens - cost}`;
      }
    },
    "Deck Power": {
      name: "Deck Power",
      desc: "Multiply all win multipliers by (|Deck Size| / 52)",
      apply: async () => {
        /* 1) Grab freshest player data */
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;

        /* 2) Set cost (BASE_PRICE_BUMP is added later) */
        const cost = 4;   // change here if you want it cheaper / dearer
        if (tokens < cost) return alert("You don't have enough tokens.");

        /* 3) Build the REAL deck to get its current length */
        const deckSize = buildPlayerDeck(data).length;   // includes dup. cards, blue suits, removals, etc.

        /* 4) Factor = |deck| / 52 (cap at e.g. 3x if you ever want) */
        const factor = deckSize / 52;

        /* 5) Apply the factor to every stage multiplier */
        const base = { 1:2, 2:3, 3:4, 4:20, 5:500 };
        const oldM = { ...base, ...(data.multipliers || {}) };
        const newM = {};
        for (const [stage, m] of Object.entries(oldM)) {
          newM[stage] = +(m * factor).toFixed(2);        // keep two decimals
        }

        /* 6) Persist changes */
        await update(playerRef, {
          multipliers:     newM,
          purchaseTokens:  tokens - cost,
          modifierHistory: [
            ...(data.modifierHistory || []),
            `Deck Power: ${factor.toFixed(2)}x (deck size: ${deckSize})`
          ]
        });

        /* 7) UI refresh */
        alert(`Deck Power purchased! All multipliers ${factor.toFixed(2)}x.`);
        document.getElementById('playerTokens')
                .textContent = `Tokens: ${tokens - cost}`;
        displayMultipliers();
      }
    },
    "Deck Stash": {
      name: "Deck Stash",
      desc: "Next round's starting balance + |Deck Size|",
      apply: async () => {
        /* 1️⃣  Fetch freshest data */
        const snap   = await get(playerRef);
        const data   = snap.val() || {};
        const tokens = data.purchaseTokens || 0;

        const cost = 4;                         // change if you want it cheaper/dearer
        if (tokens < cost) return alert("You don't have enough tokens.");

        /* 3️⃣  Figure out deck size right now */
        const deckSize = buildPlayerDeck(data).length;   // counts duplicates & blue suits

        /* 4️⃣  Record a ‘boost’ op for the next reset */
        const ops = data.startBalanceOps || [];
        ops.push({ type: "boost", value: deckSize });

        /* 5️⃣  Persist changes */
        await update(playerRef, {
          startBalanceOps: ops,
          purchaseTokens:  tokens - cost,
          modifierHistory: [
            ...(data.modifierHistory || []),
            `Deck Stash: +${deckSize} start balance next round`
          ]
        });

        /* 6️⃣  UI feedback */
        alert(`Deck Stash purchased! Next round you'll start with +${deckSize} cash.`);
        document.getElementById("playerTokens").textContent = `Tokens: ${tokens - cost}`;
      }
    },






    ...[1,2,3,4,5].reduce((map, stage) => {
      const key       = `Stage ${stage} Boost`;
      const countKey  = `stage${stage}BoostCount`;

      map[key] = {
        name: key,
        // desc is just a fallback; we'll compute the real one in the UI
        desc: `Increase Stage ${stage} multiplier by +${stage}`,
        apply: async () => {
          const snap   = await get(playerRef);
          const data   = snap.val() || {};
          const tokens = data.purchaseTokens || 0;
          const already = data[countKey] || 0;
          const cost    = already + 2;

          if (tokens < cost) return alert(`You need ${cost} tokens to buy this.`);

          const count = already + 1;

          // rebuild multipliers from whatever's in the DB (with sane defaults)
          const base    = {1:2,2:3,3:4,4:20,5:500};
          const oldMult = { ...base, ...(data.multipliers||{}) };
          const newMult = { ...oldMult, [stage]: oldMult[stage] + stage };

          // persist everything in one go
          await update(playerRef, {
            multipliers:       newMult,
            purchaseTokens:    tokens - cost,
            [countKey]:        count,
            modifierHistory:   [...(data.modifierHistory||[]), `Stage ${stage} Boost +${stage}`]
          });

          alert(`Stage ${stage} multiplier increased by +${stage} (now ${newMult[stage]}x)!`);
          document.getElementById('playerTokens').textContent = `Tokens: ${tokens - cost}`;
          displayMultipliers();
        }
      };
      return map;
    }, {}),



    ...Object.fromEntries([1,2,3,4,5].map(stage => {
      return [`Stage ${stage} Shield`, {
        name: `Stage ${stage} Shield`,
        desc: `Retain 25% of your bet if you fail on Stage ${stage}`,
        apply: async () => {
          const snap = await get(playerRef);
          const data = snap.val();
          const tokens = data.purchaseTokens || 0;

          // ↪— block if they already own this stage‑shield
          if (data.shields && data.shields[stage]) {
            return alert(`⚠️ You already have Stage ${stage} Shield.`);
          }

          if (tokens < 3) return alert("You don't have enough tokens.");

          const shields = data.shields || {};
          shields[stage] = 25; // percent

          alert(`You are now protected on Stage ${stage}. You will recover 25% of your bet if you fail.`);

          const history = data.modifierHistory || [];
          history.push(`Retain 25% of your bet if you fail on Stage ${stage}`);

          await update(playerRef, {
            shields,
            purchaseTokens: tokens - 3,
            modifierHistory: history
          });
          document.getElementById('playerTokens').textContent = `Tokens: ${tokens - 3}`;

        }
      }];
    })),

  };

  // ─── Card Upgrade Section ────────────────────────────────────────────

  // 4) Render the Bet Modifiers (uses betModifiersMap defined elsewhere)
  const betDiv = document.getElementById('betModifiers');
  betDiv.innerHTML = '<div style="width:100%;text-align:center;font-weight:bold;margin-bottom:0.5rem;">Bet Modifiers</div>';
  shownNames.forEach(name => {
    const mod = betModifiersMap[name];
    if (!mod) {
      console.warn(`Skipping unknown modifier "${name}"`);
      return;
    }
    const box = document.createElement('div');
    box.className = 'shop-item';

    // calculate cost:
    let cost = 2; 
    // if (name === "Remove Diamonds & Clubs") cost = 4;
    if (name === "Quick Start") {
       const count = playerData.quickStartCount || 0;
       cost = count + 3;
     }
    if (name === "Bonus Bets") {
      const count = playerData.bonusBetsCount || 0;
      cost = 3 + (count * 2);
    }
    if (name === "Bonus Interest") {
      const count = playerData.bonusInterestCount || 0;
      cost = count + 2;
    }
    if ([
      "Stage 1 Shield","Stage 2 Shield","Stage 3 Shield",
      "Stage 4 Shield","Stage 5 Shield",
      "Hail Mary","Two-edged", "Super Multiplier",
      "Witch's Cauldron", "Card Factory","Power Rush",
    ].includes(name)) {
      cost = 3;
    }
    if ([
      "Stage 1 Fright", "Cursed Loan", "Remove 2 Clubs", "Remove 2 Spades",
      "Remove 2 Hearts", "Remove 2 Diamonds", "Decay", "Deck Power", "Deck Stash",
      "Instant Gratification",
    ].includes(name)) {
      cost = 4;
    }

    // compute dynamic desc for Stage 1 Boost
    let desc = mod.desc;
    const boostMatch = name.match(/^Stage (\d) Boost$/);
    if (boostMatch) {
      const stg  = boostMatch[1];
      const prev = playerData[`stage${stg}BoostCount`] || 0;
      cost = prev + 2;
      desc = `Increase Stage ${stg} multiplier by +${stg}`;
    }


    box.innerHTML = `
      <h4>🛠️ ${mod.name}</h4>
      <p>${desc}</p>
      <p style="font-weight:bold; margin-top:0.5rem;">
        Cost: ${cost} token${cost>1?'s':''}
      </p>
    `;

    const btn = document.createElement('button');
    btn.innerText = playerData.purchaseTokens >= cost ? 'Purchase' : 'Insufficient Tokens';
    btn.disabled = playerData.purchaseTokens < cost;
    btn.onclick = async () => {
    // 1) Fetch freshest player data & token count
    const psnapFresh = await get(playerRef);
    const fresh     = psnapFresh.val() || {};
    const tokens    = fresh.purchaseTokens || 0;
    if (tokens < cost) {
      return alert(`🛑 You need ${cost} token${cost>1?'s':''} to buy this.`);
    }   
    // 2) Apply the modifier (mod.apply will deduct tokens & update the display)
    await mod.apply();    
    // 3) Disable the button & mark purchased
    btn.disabled   = true;
    btn.textContent = 'Purchased';    
    // 4) (Optional) re‑render the shop so any new costs/availability update
    // showShopOptions(fresh.isRoundWinner);


    };

    box.appendChild(btn);
    betDiv.appendChild(box);
  });


  // ─── Card Upgrade Section ────────────────────────────────────────────

  // Pick one random card instance from their deck
  const fullDeck    = buildPlayerDeck(playerData);
  const upgradeCard = fullDeck[Math.floor(Math.random() * fullDeck.length)];

  // Decide which card‐upgrade effects to show
  const allEffects = [
  '+1 bet',
  'Gain 25% of bet',
  'remove_card',
  'Gain 10% of Balance',
  'duplicate_card',
  '+3 Mult',
  '1.25x Mult',
  'bonusToken',
  ];
  const effectsToShow = playerData.offeredEffects 
                      || allEffects.sort(() => Math.random() - 0.5)
                                   .slice(isWinner ? 3 : 2);

  // Render the Card Upgrade shop
  const cardDiv = document.getElementById('cardUpgradeArea');
  cardDiv.innerHTML =
    '<div style="width:100%;text-align:center;font-weight:bold;margin-bottom:0.5rem;">' +
    'Card Upgrade <em>(cost 2 tokens)</em></div>';


  const upgradeFlex = document.createElement('div');
  upgradeFlex.style.display = 'flex';
  upgradeFlex.style.flexWrap = 'wrap';
  upgradeFlex.style.justifyContent = 'center';
  upgradeFlex.style.gap = '1rem';
  upgradeFlex.style.marginTop = '0.5rem';

  // find any existing upgrade on this card
  const existing = (playerData.cardUpgrades || [])
                   .find(u => u.text === upgradeCard.text)?.effect;

  effectsToShow.forEach(effectText => {
    const box = document.createElement('div');
    box.className = 'shop-item';
    box.style.flex = '1 1 120px';

    // show glow only if the card already has an upgrade
    const cardEl = createCardDisplay(upgradeCard, existing);
    cardEl.style.margin = '0 auto';
    box.appendChild(cardEl);

    // Human‐readable description of the offered upgrade
    const desc = document.createElement('p');
    if (effectText === '+1 bet')             desc.textContent = '+1 bet if cashed-out (max 4 per round)';
    else if (effectText === 'Gain 25% of bet') desc.textContent = 'Gain 25% of your bet';
    else if (effectText === 'Gain 10% of Balance') desc.textContent = 'Gain 10% of your balance';
    else if (effectText === 'remove_card')   desc.textContent = 'Remove this card from your deck';
    else if (effectText === 'duplicate_card')desc.textContent = 'Duplicate this card into your deck';
    else if (effectText === '+3 Mult')  desc.textContent = '+3 multiplier when drawn';
    else if (effectText === '1.25x Mult') desc.textContent = '1.25x multiplier when drawn';
    else if (effectText === 'bonusToken') desc.textContent = '+1 token on cash-out';

    box.appendChild(desc);

    // Purchase button
    const UPGRADE_COST = 2;                     // new

    const btn = document.createElement('button');
    btn.textContent = 'Upgrade (Cost: ' + UPGRADE_COST +')';
    btn.disabled    = (playerData.purchaseTokens || 0) < UPGRADE_COST;

    if ((playerData.purchaseTokens || 0) <= 0) btn.disabled = true;

    btn.onclick = async () => {
      // 1️⃣ Fetch freshest player data
      const snap   = await get(playerRef);
      const latest = snap.val() || {};
      const tokens = latest.purchaseTokens || 0;
      if (tokens < UPGRADE_COST) return alert("You need 2 tokens for a card upgrade.");

      // 2️⃣ Map effect‐codes → human descriptions
      const mapDesc = {
        '+1 bet':          `+1 bet if cashed-out (max 4 per round)`,
        'Gain 25% of bet':   `Gain 25% of your bet`,
        'Gain 10% of Balance':   `Gain 10% of your balance`,
        'remove_card':     `Remove this card from your deck`,
        'duplicate_card':  `Duplicate this card into your deck`,
        '+3 Mult':    `+3 multiplier when drawn`,
        '1.25x Mult': `1.25x multiplier when drawn`,
        'bonusToken': '+1 token on cash-out'
      };

      // 3️⃣ Prepare history & upgrade arrays
      const history      = latest.modifierHistory || [];
      const cardUpgrades = latest.cardUpgrades   || [];
      const dupCounts    = latest.duplicateCounts || {};

      // 4️⃣ Check for an existing upgrade on this card
      const oldIdx = cardUpgrades.findIndex(u => u.text === upgradeCard.text);
      let entryText;

      if (oldIdx !== -1) {
        // Replacing an old effect
        const oldCode = cardUpgrades[oldIdx].effect;
        const oldDesc = mapDesc[oldCode] || oldCode;
        const newDesc = mapDesc[effectText];
        entryText = `${upgradeCard.text}: Replaced with ${newDesc}`;
        cardUpgrades.splice(oldIdx, 1);
      } else {
        // First‐time upgrade
        const newDesc = mapDesc[effectText];
        entryText = `${upgradeCard.text}: ${newDesc}`;
      }

      // 5️⃣ Apply the new effect
      const prevUpgrade = (latest.cardUpgrades || []).find(u => u.text === upgradeCard.text);

      if (effectText === 'duplicate_card') {
        const newCount = (dupCounts[upgradeCard.text] || 0) + 1;
        dupCounts[upgradeCard.text] = newCount;
        history.push(`Duplicate ${upgradeCard.text} (x${newCount})`);

        if (prevUpgrade) cardUpgrades.push(prevUpgrade);

        // Also preserve any existing upgrade on this card
        const existingUpgrade = (latest.cardUpgrades || []).find(u => u.text === upgradeCard.text);
        if (existingUpgrade) {
          // Just re-add the same upgrade (duplicates are okay since they're all applied at draw)
          cardUpgrades.push({ text: upgradeCard.text, effect: existingUpgrade.effect });
        }
      } else {
              // all other card‐upgrades go here
        cardUpgrades.push({ text: upgradeCard.text, effect: effectText });
        history.push(entryText);
      }

      // 6️⃣ Build update payload
      const updates = {
        purchaseTokens:   tokens - UPGRADE_COST,
        modifierHistory:  history,
        duplicateCounts:  dupCounts,
        cardUpgrades
      };

      // 7️⃣ Persist and update UI
      await update(playerRef, updates);
      btn.disabled = true;
      btn.textContent = oldIdx === -1 ? 'Upgraded' : 'Replaced';
      document.getElementById('playerTokens').textContent =
        `Tokens: ${tokens - UPGRADE_COST}`;


    };

    box.appendChild(btn);
    upgradeFlex.appendChild(box);
  });

  cardDiv.appendChild(upgradeFlex);
}


// Utility for drawing a random card from the full deck
function getRandomCardFromDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const suit = suits[Math.floor(Math.random() * suits.length)];
  const value = values[Math.floor(Math.random() * values.length)];
  const numeric = value === 'A' ? 14 : value === 'K' ? 13 : value === 'Q' ? 12 : value === 'J' ? 11 : parseInt(value);
  return { text: value + suit, suit, value: numeric };
}

function clearCountdown() {
  clearInterval(countdownInterval);
  clearTimeout(countdownTimeout);
  const bar = document.getElementById("timerBar");
  const container = document.getElementById("timerBarContainer");
  bar.style.width = "0%";
  container.style.display = "none";
}

function playSuccessTone() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  const melody = [329.63, 369.99, 392.00, 440.00, 659.25, 783.99]; // E F# G A E5 G5
  const notesToPlay = melody.slice(0, Math.min(correctGuessCount, melody.length));
  const duration = 0.18;

  notesToPlay.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * duration);
    osc.type = 'triangle';

    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime + i * duration);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (i + 1) * duration);

    osc.connect(gainNode).connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + i * duration);
    osc.stop(audioCtx.currentTime + (i + 1) * duration);
  });
}

function playFailureTone() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // A simple descending 3‐note “sad” motif
  const melody = [220, 196, 164.81];  // A3 → G3 → E3
  const duration = 0.3;

  melody.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * duration);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime + i * duration);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (i + 1) * duration);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + i * duration);
    osc.stop(audioCtx.currentTime + (i + 1) * duration);
  });
}

// ─── Decide who (if anyone) won the round ────────────────────────────
async function decideRoundWinner(players, roundTarget) {

  // 1️⃣  Pick only those who survived AND reached the goal
  const qualified = Object.entries(players)          // [id, pdata]
    .filter(([, p]) => !p.eliminated && p.balance >= roundTarget);

  let winnerId = null;

  if (qualified.length) {
    // 2️⃣  Highest balance among the qualified players
    qualified.sort((a, b) => b[1].balance - a[1].balance);
    winnerId = qualified[0][0];
  }
  // else {
  //   // OPTIONAL: pick top balance even if nobody hit the goal
  //   winnerId = Object.entries(players)
  //                   .sort((a, b) => b[1].balance - a[1].balance)[0][0];
  // }

  // 3️⃣  Update each player’s state atomically
  const updates = {};
  Object.keys(players).forEach(pid => {
    updates[`${pid}/isRoundWinner`] = (pid === winnerId);
    if (pid === winnerId) {
      updates[`${pid}/roundsWon`]   = (players[pid].roundsWon || 0) + 1;
    }
  });
  await update(ref(db, `games/${lobbyCode}/players`), updates);

  return winnerId;           // for any post‑win UI / logic you have
}



async function resetAllPlayers(players) {
  for (const id of Object.keys(players)) {
    const pRef   = ref(db, `games/${lobbyCode}/players/${id}`);
    const snap   = await get(pRef);
    const pdata  = snap.val() || {};

    /* ── NEW ── Reset the personal shoe so every card is drawable again */
    // 1️⃣  Start from the player’s full customised deck
    const baseDeck = buildPlayerDeck(pdata);
    let   personal = [...baseDeck];
    
    // 2️⃣  Add any duplicate‑card purchases
    const dupCounts = pdata.duplicateCounts || {};
    Object.entries(dupCounts).forEach(([text, count]) => {
      const template = baseDeck.find(c => c.text === text);
      if (!template) return;
      for (let i = 0; i < count; i++) personal.push({ ...template, _isDup: true });
    });
    
    // 3️⃣  (Optional) you could shuffle here if you like:
    // personal.sort(() => Math.random() - 0.5);

    const left = Math.max((pdata.powerRushRoundsLeft || 0) - 1, 0);
    const gratLeft = Math.max((pdata.instantGratRoundsLeft || 0) - 1, 0);

    /* ───── Decay: kill a random card & boost a random stage ───── */
    if (pdata.hasDecay) {
      // 1️⃣ build THIS player’s current deck (after previous removals)
      const liveDeck = buildPlayerDeck(pdata);
      if (liveDeck.length > 0) {
        // pick a random survivor
        const deadCard = liveDeck[Math.floor(Math.random() * liveDeck.length)];

        // flag it for permanent removal
        const upgrades = pdata.cardUpgrades || [];
        upgrades.push({ text: deadCard.text, effect: "remove_card" });

        // 2️⃣ pick a random stage 1-5 and add +1
        const stage     = Math.floor(Math.random() * 5) + 1;
        const base      = {1:2, 2:3, 3:4, 4:20, 5:500};
        const oldMults  = { ...base, ...(pdata.multipliers || {}) };
        const newMults  = { ...oldMults, [stage]: oldMults[stage] + 0.5 };

        // record it
        const history = pdata.modifierHistory || [];
        history.push(`Decay: removed ${deadCard.text}, +0.5 to Stage ${stage}`);

        await update(pRef, {
          cardUpgrades:    upgrades,
          multipliers:     newMults,
          modifierHistory: history
        });

        displayMultipliers();
      }
    }


    let amt = 100;
    (pdata.startBalanceOps || []).forEach(op => {
      if (op.type === 'boost') {
        amt += op.value;
      } else if (op.type === 'mult') {
        amt *= op.value;
      }
    });
    
    const startAmt = Math.floor(amt);

    await update(pRef, {
      balance:      startAmt,
      betsMade:     0,
      eliminated:   false,
      isRoundWinner: false,
      roundBetBonus: 0,
      stage1FrightTriggers: 0,
      stage1FrightArmed:    false,
      powerRushRoundsLeft:   left,
      instantGratRoundsLeft: gratLeft,
      tokenGrantCount: 0,
      personalDeck: personal,
    });

    if (id === playerId) localPlayer.personalDeck = personal;
  }

  // sync local copy for this client
  if (players[playerId]) {
    const me  = players[playerId];
    const m   = me.startBalanceMultiplier || 1;
    localPlayer.balance  = Math.floor(100 * m);
    localPlayer.betsMade = 0;
    localPlayer.eliminated = false;
  }
}


async function reshuffleDeck() {
  const fullDeck = [];
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  for (const suit of suits) {
    for (const val of values) {
      fullDeck.push({
        text: val + suit,
        suit,
        value: val === 'A' ? 14 : val === 'K' ? 13 : val === 'Q' ? 12 : val === 'J' ? 11 : parseInt(val)
      });
    }
  }
  fullDeck.sort(() => Math.random() - 0.5);
  await set(deckRef, fullDeck);
}

async function grantTokenAndShowShop(winners) {
  const playersSnap = await get(ref(db, `games/${lobbyCode}/players`));
  const players = playersSnap.val();

  // 🧠 Generate shared random modifiers for this shop session
  const activeModifierKeys = [
  "Bonus Bets", "Super Multiplier", "Bonus Interest",
  "Stage 1 Boost", "Stage 2 Boost", "Stage 3 Boost", "Stage 4 Boost", "Stage 5 Boost",
  "Stage 1 Shield", "Stage 2 Shield", "Stage 3 Shield", "Stage 4 Shield", "Stage 5 Shield",
  "Hail Mary","Blue Suits & Boost","Snow-baller","Ace & Two","Faceless",
  "Remove 2-4","Quick Start","Humble Beginnings","Clutch King","Kingpin","Two-edged","Witch's Cauldron","Stage 1 Fright",
  "Cursed Loan", "Summon Kings", "Remove 2 Clubs", "Remove 2 Spades", "Remove 2 Hearts", "Remove 2 Diamonds",
  "Power Rush","Instant Gratification","Decay","Card Factory",
];

  const shuffled = activeModifierKeys.sort(() => Math.random() - 0.5);
  const sharedBetModifiers = shuffled.slice(0, 4); // Change to 4+ if you want more choices

  await update(stateRef, { sharedBetModifiers }); // 🔐 Save in Firebase so all players use same base


  for (const [id, data] of Object.entries(players)) {
    const isWinner = winners.some(([winnerId]) => winnerId === id);
    const oldTokens = data.purchaseTokens || 0;   // what the player had
    const baseEarn  = 3;                          // flat round-reward
    const bonus     = tokenInterest(oldTokens);   // new interest
    const newTokens = oldTokens + baseEarn + bonus;

    const upgradeCard = getRandomCardFromDeck();
    const possibleEffects = [
      '+1 bet',
      'Gain 25% of bet',
      'remove_card',
      'Gain 10% of Balance',
      'duplicate_card',
      '+3 Mult',
      '1.25x Mult',
    ];
    const effectsToShow = isWinner ? 3 : 2;
    const randomEffects = [...possibleEffects].sort(() => Math.random() - 0.5).slice(0, effectsToShow);

    await update(ref(db, `games/${lobbyCode}/players/${id}`), {
      purchaseTokens: newTokens,
      showShop: true,
      isRoundWinner: isWinner,
      offeredCard: upgradeCard,
      offeredEffects: randomEffects
    });
  }
}

async function checkRoundCompletion() {
  
  const playersSnap = await get(ref(db, `games/${lobbyCode}/players`));
  const players = playersSnap.val();
  const activePlayers = Object.values(players).filter(p => !p.eliminated);
  const isSoloMode = Object.keys(players).length === 1;

  const finished = activePlayers.filter(p => {
    const cap = maxBetsPerPlayer
              + (p.betModifierBonus || 0)  // any shop modifiers that add bets
              + (p.roundBetBonus    || 0); // any +1-bets from card upgrades
    return (p.betsMade || 0) >= cap;
  });

  const unfinished = activePlayers.filter(p => {
    const cap = maxBetsPerPlayer
              + (p.betModifierBonus || 0)
              + (p.roundBetBonus    || 0);
    return (p.betsMade || 0) < cap;
  });


  const currentStateSnap = await get(stateRef);
  const currentState = currentStateSnap.val();
  const currentMaxBets = currentState?.maxBetsPerPlayer || 10;
  const currentThresh   = Math.floor(currentState.threshold || 100);

  // If solo and eliminated, show stats instead of looping rounds
  if (isSoloMode) {
    const solo = players[playerId] || {};
    if (solo.eliminated) {
      showGameOverScreen();
      return;
    }
  }
  // SOLO MODE
  if (isSoloMode) {
    const solo          = Object.values(players)[0];
    const bonus         = solo.betModifierBonus    || 0;
    const roundBonus    = solo.roundBetBonus       || 0;
    const permBonus     = solo.betModifierBonus    || 0;
    const effectiveMax  = maxBetsPerPlayer + permBonus + roundBonus;
    const remainingBets = effectiveMax - (solo.betsMade || 0);

    // auto‑win early
    if (remainingBets > 0 && solo.balance > currentThresh) {
      const psnap      = await get(playerRef);
      const pdata      = psnap.val() || {};
      let amt = 100;
       (pdata.startBalanceOps || []).forEach(op => {
         if (op.type === 'boost') amt += op.value;
         else if (op.type === 'mult')  amt *= op.value;
       });
       const newBalance = Math.floor(amt);

      await update(playerRef, {
        roundsWon:           (pdata.roundsWon || 0) + 1,
        balance:             newBalance,
        betsMade:            0,
        roundBetBonus:       0,
        stage1FrightTriggers: 0
      });

      await resetAllPlayers(players);        

      const nextThresh = Math.floor(currentThresh * 1.15);
      await set(stateRef, {
        gameStarted:      true,
        currentPlayer:    playerId,
        currentStage:     0,
        drawnCards:       [],
        threshold:        nextThresh,
        status:           `Next round! Beat $${nextThresh}`,
        maxBetsPerPlayer
      });
      await update(playerRef, { interestAppliedForRound: false });

      await reshuffleDeck();
      await grantTokenAndShowShop([[playerId, solo]]);

      // apply bonus interest (once per round)
      {
        const snap2  = await get(playerRef);
        const pd2    = snap2.val() || {};
        if (pd2.interestPercent > 0 && !pd2.interestAppliedForRound) {
          const amt      = Math.floor(pd2.balance * (pd2.interestPercent/100));
          const balAfter = pd2.balance + amt;
          await update(playerRef, {
            balance: balAfter,
            interestAppliedForRound: true
          });
          localPlayer.balance = balAfter;
          alert(`💰 You earned $${amt} interest (${pd2.interestPercent}%)!`);
        }
      }

      // apply Cursed Loan penalty
      {
        const snap3  = await get(playerRef);
        const pd3    = snap3.val() || {};
        if (pd3.cursedLoan) {
          const pen      = Math.floor(pd3.balance * 0.20);
          const balAfter = pd3.balance - pen;
          await update(playerRef, { balance: balAfter });
          localPlayer.balance = balAfter;
          alert(`💸 You lost $${pen} due to Cursed Loan (-20%).`);
        }
      }


      // force a second stateRef change so onValue() sees showShop
      const s2 = (await get(stateRef)).val() || {};
      await update(stateRef, { status: s2.status + ' ' });

      return;
    }

    // Still playing this round?
    if (solo.betsMade < effectiveMax) {
      return;
    }

    // End‑of‑round: did they meet threshold?
    if (solo.balance > currentThresh) {
      const psnap      = await get(playerRef);
      const pdata      = psnap.val() || {};
      const startMult  = pdata.startBalanceMultiplier || 1;
      const newBalance = Math.floor(100 * startMult);

      await update(playerRef, {
        roundsWon:           (pdata.roundsWon || 0) + 1,
        balance:             newBalance,
        betsMade:            0,
        roundBetBonus:       0,
        stage1FrightTriggers: 0
      });

      await resetAllPlayers(players);        

      const nextThresh = Math.floor(currentThresh * 1.15);
      await set(stateRef, {
        gameStarted:      true,
        currentPlayer:    playerId,
        currentStage:     0,
        drawnCards:       [],
        threshold:        nextThresh,
        status:           `Next round! Beat $${nextThresh}`,
        maxBetsPerPlayer
      });

      await reshuffleDeck();
      await grantTokenAndShowShop([[playerId, solo]]);

      // apply bonus interest (once per round)
      {
        const snap2  = await get(playerRef);
        const pd2    = snap2.val() || {};
        if (pd2.interestPercent > 0 && !pd2.interestAppliedForRound) {
          const amt      = Math.floor(pd2.balance * (pd2.interestPercent/100));
          const balAfter = pd2.balance + amt;
          await update(playerRef, {
            balance: balAfter,
            interestAppliedForRound: true
          });
          localPlayer.balance = balAfter;
          alert(`💰 You earned $${amt} interest (${pd2.interestPercent}%)!`);
        }
      }

      // apply Cursed Loan penalty
      {
        const snap3  = await get(playerRef);
        const pd3    = snap3.val() || {};
        if (pd3.cursedLoan) {
          const pen      = Math.floor(pd3.balance * 0.20);
          const balAfter = pd3.balance - pen;
          await update(playerRef, { balance: balAfter });
          localPlayer.balance = balAfter;
          alert(`💸 You lost $${pen} due to Cursed Loan (-20%).`);
        }
      }

      // again bump the status so our stateRef listener opens the shop
      const s3 = (await get(stateRef)).val() || {};
      await update(stateRef, { status: s3.status + ' ' });

    } else {
      showGameOverScreen();
    }
    return;
  }



// CONTINUE IF ANYONE HAS BETS LEFT
const allDone = activePlayers.every(p => {
  const permBonus = p.betModifierBonus || 0;
  const roundBonus = p.roundBetBonus || 0;
  const effectiveMax = maxBetsPerPlayer + permBonus + roundBonus;
  return (p.betsMade || 0) >= effectiveMax;
});


if (!allDone) {

  /* ── NEW DEFAULT‑END RULE ────────────────────────────────────────
   * If exactly one player is still allowed to bet AND that player
   * already has the highest balance at this moment, we short‑circuit
   * the rest of the round and treat it as finished.
   */
  const unfinished = activePlayers.filter(p => {
    const perm = p.betModifierBonus || 0;
    const rnd  = p.roundBetBonus    || 0;
    const max  = maxBetsPerPlayer + perm + rnd;
    return (p.betsMade || 0) < max;
  });

  const richestBal = Math.max(...activePlayers.map(p => p.balance));
  const isDefaultEnd = unfinished.length === 1
                    && unfinished[0].balance === richestBal;

  if (!isDefaultEnd) return advanceToNextPlayer();
}

/* 1️⃣  Players who actually reached / passed the target */
const qualified = activePlayers.filter(p => p.balance >= currentThresh);

/* 2️⃣  Decide which list to rank:   qualified ▸ else everyone */
const pool = qualified.length ? qualified : activePlayers;

/* 3️⃣  Highest balance in that pool becomes winner(s) */
const topBal  = Math.max(...pool.map(p => p.balance));
const winners = Object.entries(players)
                 .filter(([_, p]) => pool.includes(p) && p.balance === topBal);



  for (const [id, p] of winners) {
    await update(ref(db, `games/${lobbyCode}/players/${id}`), {
      roundsWon: (p.roundsWon || 0) + 1
    });
  }

  await resetAllPlayers(players);
  await reshuffleDeck();
  await grantTokenAndShowShop(winners);
  const currentStateSnap2 = await get(stateRef);
  const stateObj = currentStateSnap2.val() || {};
  await update(stateRef, { status: stateObj.status + ' ' });

  const firstPlayerId = Object.keys(players)[0];
  await update(stateRef, {
    gameStarted: true,
    currentPlayer: firstPlayerId,
    currentStage: 0,
    drawnCards: [],
    status: `Waiting for ${players[firstPlayerId].name} to start their turn.`,
    maxBetsPerPlayer: currentMaxBets
  });
}

async function showDeck() {
  // 1) fetch your player data
  const snap = await get(playerRef);
  const playerData = snap.val() || {};

  // 2) rebuild your actual deck and get your upgrades
  let deck     = buildPlayerDeck(playerData);  const dupCounts  = playerData.duplicateCounts || {};
  for (const [text, count] of Object.entries(dupCounts)) {
    const template = deck.find(c => c.text === text);
    if (!template) continue;
    // push N extra visual copies
    for (let i = 0; i < count; i++) {
      deck.push({ ...template });
    }
  }
    // ─── new: sort by suit then value ───────────────────────────
  const suitOrder = ['♥','♦','♠','♣','☾','★'];
  deck.sort((a, b) => {
    const s = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    return s !== 0 ? s : a.value - b.value;
  });
module

  const upgrades = playerData.cardUpgrades || [];
  const remaining = new Set(playerData.personalDeck?.map(c => c.text) || []);
  
  // 3) render into the modal
  const container = document.getElementById('deckContent');
  container.innerHTML = '';  // clear previous

  // create a flex grid
  const grid = document.createElement('div');
  grid.style.display      = 'flex';
  grid.style.flexWrap     = 'wrap';
  grid.style.gap          = '0.5rem';
  grid.style.justifyContent = 'flex-start';

  deck.forEach(card => {

    // override suit/value if Witch’s Cauldron applies
    if (playerData.witchCauldronMap?.[card.text]) {
      const { value, suit } = playerData.witchCauldronMap[card.text];
      card.suit = suit;
      card.value = value;
      card.text = (value === 14 ? 'A' :
                  value === 13 ? 'K' :
                  value === 12 ? 'Q' :
                  value === 11 ? 'J' : value.toString()) + suit;
      card._cauldron = true;
    }

    // find if this exact card has an upgrade
    const match = upgrades.find(u => u.text === card.text);

    // create the card element (this applies color + glow)
    const cardEl = createCardDisplay(card, match?.effect);

    // optionally add a tooltip/title if they have an upgrade
    if (match) {
      cardEl.title = match.effect.replace(/_/g, ' ');
    }

    if (!remaining.has(card.text)) cardEl.classList.add('grayed');
    grid.appendChild(cardEl);
  });

  container.appendChild(grid);

  // 4) show the modal
  document.getElementById('deckModal').classList.remove('hidden');
}

async function showGameOverScreen() {
  // fetch final stats
  const snap = await get(playerRef);
  const p    = snap.val() || {};

  const content = document.getElementById('gameOverContent');
  content.innerHTML = `
    <p><strong>Rounds survived:</strong> ${p.roundsWon || 0}</p>
    <p><strong>Bets played:</strong> ${p.betsMade || 0}</p>
    <p><strong>Highest Balance Reached:</strong> $${p.highestBalance ?? p.balance}</p>
    <h3>Purchased Modifiers</h3>
    <ul>${(p.modifierHistory || []).map(m => `<li>${m}</li>`).join('') || '<li>None</li>'}</ul>
    <h3>Card Upgrades</h3>
    <ul>${(p.cardUpgrades || []).map(u => `<li>${u.text}: ${u.effect}</li>`).join('') || '<li>None</li>'}</ul>
    <button id="viewDeckFromOver" style="margin-top:1rem; padding:0.5rem 1rem;">View Deck</button>
  `;

  // wire up “View Deck” to reuse your showDeck()
  document.getElementById('viewDeckFromOver').onclick = showDeck;

  document.getElementById('gameOverModal').classList.remove('hidden');
}

// Play Again just reloads the page (or you can fully reset state)
document.getElementById('playAgainBtn').addEventListener('click', () => {
  location.reload();
});

