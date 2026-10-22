// ====================  - 錯題回顧與純答題對決版 app.js ====================

let playerName = "帥哥或美女";
let myHp = 100;
let myCombo = 0;
let currentQuestion = null;
let allVocabPool = [];

// 生存模式變數（單人模式使用）
let gameTimerInterval = null;
let secondCounterInterval = null;
let survivalSeconds = 0;
let bestSurvivalSeconds = localStorage.getItem('vocab_best_survival') || 0;

// 動態扣血速度變數（單人模式使用）
let drainIntervalMs = 500;
let drainAmount = 1;

// 錯題紀錄陣列 [{ word, correctMeaning, userChosenMeaning }]
let wrongQuestionsList = [];

// DOM 元素抓取
const lobbyScreen = document.getElementById('lobby-screen');
const roomScreen = document.getElementById('room-screen');
const battleScreen = document.getElementById('battle-screen');

const playerNameInput = document.getElementById('player-name');
const roomCodeInput = document.getElementById('room-code-input');
const displayRoomCode = document.getElementById('display-room-code');
const playerListContainer = document.getElementById('player-list');

const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const btnStartGame = document.getElementById('btn-start-game');
const btnLeaveRoom = document.getElementById('btn-leave-room');

const scoreboardEl = document.getElementById('scoreboard');
const currentWordEl = document.getElementById('current-word');
const optionsContainerEl = document.getElementById('options-container');
const comboDisplayEl = document.getElementById('combo-display');

const survivalTimerEl = document.getElementById('survival-timer');
const bestTimeDisplayEl = document.getElementById('best-time-display');

// 錯題回顧 DOM
const wrongWordsContainer = document.getElementById('wrong-words-container');
const wrongWordsListEl = document.getElementById('wrong-words-list');
const btnCloseReview = document.getElementById('btn-close-review');
let isCurrentQuestionMarked = false; // 記錄當前題目是否被手動標記

// 在 DOM 載入完成後，幫題目元素加上點擊事件與指標樣式
window.addEventListener('DOMContentLoaded', () => {
    initVocabPool();
    updateBestTimeUI();
    renderLeaderboard();

    if (currentWordEl) {
        currentWordEl.style.cursor = 'pointer'; // 讓滑鼠移上去變成手指，提示可點擊
        currentWordEl.title = "點擊即可標記/取消標記為不熟單字";

        currentWordEl.onclick = () => {
            if (!currentQuestion) return;
            playClickSound();
            isCurrentQuestionMarked = !isCurrentQuestionMarked;

            if (isCurrentQuestionMarked) {
                // 標記為黃色背景
                currentWordEl.style.backgroundColor = '#f7f387';
                currentWordEl.style.borderRadius = '8px';
                // 呼叫統一記錄函式
                recordWrongItem(currentQuestion.word, currentQuestion.meaning, currentQuestion.level, '手動標記不熟');
                // 加入錯題庫
                addCustomWrongQuestion(currentQuestion.word, currentQuestion.meaning, currentQuestion.level || 'level4');
            } else {
                // 取消黃色背景
                currentWordEl.style.backgroundColor = '';
                currentWordEl.style.padding = '';
                // 從錯題庫移除
                removeWrongQuestion(currentQuestion.word);
            }
        };
    }
});

// ==================== 0. 音效與背景音樂系統 (Web Audio API) ====================
let audioCtx = null;
let bgmInterval = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// 答對音效
function playCorrectSound() {
    try {
        initAudio();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.1);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.3);
    } catch (e) { }
}

// 答錯音效
function playWrongSound() {
    try {
        initAudio();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.linearRampToValueAtTime(70, now + 0.25);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.25);
    } catch (e) { }
}

// 按鈕點擊音效
function playClickSound() {
    try {
        initAudio();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, now);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.05);
    } catch (e) { }
}

// 緊張背景音樂 (節奏動態加快)
function startBGM() {
    initAudio();
    stopBGM();
    let beat = 0;

    bgmInterval = setInterval(() => {
        try {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'triangle';
            const baseFreq = (beat % 2 === 0) ? 110 : 130.81;
            osc.frequency.setValueAtTime(baseFreq, now);

            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start(now);
            osc.stop(now + 0.25);
            beat++;
        } catch (e) { }
    }, 400);
}

function stopBGM() {
    if (bgmInterval) {
        clearInterval(bgmInterval);
        bgmInterval = null;
    }
}

// ==================== 1. 初始化與紀錄 ====================

const firebaseConfig = {
    databaseURL: "https://vocab-battle-game-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const dbRef = firebase.database().ref('leaderboard');

function initVocabPool() {
    allVocabPool = [];

    if (typeof level4Vocab !== 'undefined' && Array.isArray(level4Vocab)) {
        allVocabPool = allVocabPool.concat(level4Vocab);
    }
    if (typeof level5Vocab !== 'undefined' && Array.isArray(level5Vocab)) {
        allVocabPool = allVocabPool.concat(level5Vocab);
    }
    if (typeof level6Vocab !== 'undefined' && Array.isArray(level6Vocab)) {
        allVocabPool = allVocabPool.concat(level6Vocab);
    }

    if (allVocabPool.length === 0) {
        allVocabPool = [
            { word: "abandon", meaning: "放棄、拋棄" },
            { word: "absorb", meaning: "吸收、吸引" },
            { word: "abstract", meaning: "抽象的" },
            { word: "academic", meaning: "學術的、學院的" },
            { word: "accelerate", meaning: "加速、促進" }
        ];
    }
}

function updateBestTimeUI() {
    if (bestTimeDisplayEl) {
        bestTimeDisplayEl.textContent = bestSurvivalSeconds;
    }
}

function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

const hostSettingsPanel = document.getElementById('host-settings-panel');
const selectVocabLevel = document.getElementById('select-vocab-level');

if (selectVocabLevel) {
    selectVocabLevel.addEventListener('change', () => {
        if (isHost && currentRoomRef) {
            currentRoomRef.child('settings').update({
                vocabLevel: selectVocabLevel.value
            });
        }
    });
}

function updateRoomUIByRole(roomData) {
    if (hostSettingsPanel && selectVocabLevel) {
        if (isHost) {
            selectVocabLevel.disabled = false;
            hostSettingsPanel.style.opacity = '1';
        } else {
            selectVocabLevel.disabled = true;
            hostSettingsPanel.style.opacity = '0.8';
        }
    }

    if (roomData.settings && roomData.settings.vocabLevel && selectVocabLevel) {
        selectVocabLevel.value = roomData.settings.vocabLevel;
    }

    if (typeof btnStartGame !== 'undefined' && btnStartGame) {
        btnStartGame.style.display = isHost ? 'block' : 'none';
    }
}

// ==================== 2. 大廳與按鈕事件 (多人生存戰雲端連線) ====================

let currentRoomRef = null;
let isHost = false;

btnCreateRoom.addEventListener('click', () => {
    playClickSound();
    const inputVal = playerNameInput.value.trim();
    if (inputVal) playerName = inputVal;

    const roomCode = generateRoomCode();
    isHost = true;

    initMultiplayerRoom(roomCode, true);
});

btnJoinRoom.addEventListener('click', () => {
    playClickSound();
    const inputVal = playerNameInput.value.trim();
    const inputCode = roomCodeInput.value.trim();

    if (!inputCode || inputCode.length !== 4) {
        alert('請輸入正確的 4 碼房間代碼！');
        return;
    }

    if (inputVal) playerName = inputVal;
    isHost = false;

    initMultiplayerRoom(inputCode, false);
});

function initMultiplayerRoom(roomCode, isCreating) {
    const safePlayerKey = playerName.replace(/[.#$\[\]]/g, "_");
    currentRoomRef = firebase.database().ref('rooms/' + roomCode);

    if (isCreating) {
        currentRoomRef.set({
            host: playerName,
            status: 'waiting',
            players: {
                [safePlayerKey]: {
                    name: playerName,
                    isHost: true,
                    hp: 100
                }
            },
            settings: {
                vocabLevel: 'all'
            }
        }).then(() => {
            currentRoomRef.child('players/' + safePlayerKey).onDisconnect().remove();
            enterRoomUI(roomCode);
            listenRoomData();
        }).catch((error) => {
            alert("建立房間失敗，請檢查網路連線！");
        });
    } else {
        currentRoomRef.once('value', (snapshot) => {
            if (!snapshot.exists()) {
                alert('找不到該房間，請確認 4 碼代碼是否正確！');
                return;
            }

            const roomVal = snapshot.val();
            if (roomVal.status !== 'waiting') {
                alert('該房間遊戲已開始或尚未重置，請稍後再加入！');
                return;
            }
            if (snapshot.child('players/' + safePlayerKey).exists()) {
                alert('房間內已有相同暱稱的玩家，請換一個暱稱再加入！');
                return;
            }

            currentRoomRef.child('players/' + safePlayerKey).set({
                name: playerName,
                isHost: false,
                hp: 100,
                isDead: false
            }).then(() => {
                currentRoomRef.child('players/' + safePlayerKey).onDisconnect().remove();
                enterRoomUI(roomCode);
                listenRoomData();
            }).catch((error) => {
                alert("加入房間失敗，請重試！");
            });
        });
    }
}

function enterRoomUI(roomCode) {
    if (lobbyScreen) lobbyScreen.classList.add('hidden');
    if (roomScreen) roomScreen.classList.remove('hidden');
    if (displayRoomCode) displayRoomCode.textContent = `#${roomCode}`;
}

function resetRoomToWaiting() {
    if (!currentRoomRef) return;

    currentRoomRef.child('players').once('value', (snapshot) => {
        const players = snapshot.val();
        if (players) {
            const updates = {};
            Object.keys(players).forEach(key => {
                updates[`players/${key}/hp`] = 100;
                updates[`players/${key}/isDead`] = false;
            });
            updates['status'] = 'waiting';
            updates['winner'] = null;

            currentRoomRef.update(updates);
        }
    });
}

// ==================== 多人生存戰專屬戰鬥邏輯 ====================

let isMultiplayerActive = false;
let lastSelfActionTime = 0; // ⏱️ 新增：記錄本地玩家最後一次主動答題的時間戳記

function startMultiplayerGameSession(roomData) {
    if (gameTimerInterval) {
        clearInterval(gameTimerInterval);
        gameTimerInterval = null;
    }
    if (secondCounterInterval) {
        clearInterval(secondCounterInterval);
        secondCounterInterval = null;
    }

    myHp = 100;
    myCombo = 0;
    lastSelfActionTime = Date.now();

    if (comboDisplayEl) comboDisplayEl.textContent = 'Combo: 0';
    
    if (survivalTimerEl && survivalTimerEl.parentElement) {
        survivalTimerEl.parentElement.style.display = 'none';
    }

    startBGM();

    const vocabLevel = (roomData.settings && roomData.settings.vocabLevel) || 'all';
    filterVocabByLevel(vocabLevel);

    nextMultiplayerQuestion();
}

function filterVocabByLevel(level) {
    initVocabPool();
    if (level === 'level4' && typeof level4Vocab !== 'undefined') {
        allVocabPool = level4Vocab;
    } else if (level === 'level5' && typeof level5Vocab !== 'undefined') {
        allVocabPool = level5Vocab;
    } else if (level === 'level6' && typeof level6Vocab !== 'undefined') {
        allVocabPool = level6Vocab;
    }
}

function nextMultiplayerQuestion() {
    if (!isMultiplayerActive) return;
    if (!allVocabPool || allVocabPool.length < 4) return;

    const randomIndex = Math.floor(Math.random() * allVocabPool.length);
    currentQuestion = allVocabPool[randomIndex];

    if (currentWordEl) currentWordEl.textContent = currentQuestion.word;

    const options = [currentQuestion.meaning];
    while (options.length < 4) {
        const randOpt = allVocabPool[Math.floor(Math.random() * allVocabPool.length)].meaning;
        if (!options.includes(randOpt)) options.push(randOpt);
    }
    options.sort(() => Math.random() - 0.5);

    if (!isMultiplayerActive) return;

    if (optionsContainerEl) {
        optionsContainerEl.innerHTML = '';
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-option';
            btn.style.cssText = "width: 100%; padding: 12px; margin-bottom: 8px; font-size: 16px;";
            btn.textContent = opt;
            btn.onclick = () => handleMultiplayerAnswer(opt === currentQuestion.meaning);
            optionsContainerEl.appendChild(btn);
        });
    }
}

function syncMyHpToFirebase() {
    if (currentRoomRef && playerName) {
        const safePlayerKey = playerName.replace(/[.#$\[\]]/g, "_");
        myHp = Math.max(0, Math.min(100, Math.round(myHp)));
        currentRoomRef.child(`players/${safePlayerKey}`).update({
            hp: myHp
        });
    }
}

// 📊 即時渲染多人圖像化血條記分板
function renderMultiplayerScoreboard(playersObj) {
    if (!scoreboardEl) return;
    scoreboardEl.innerHTML = '';

    const playersArray = Object.values(playersObj);

    playersArray.sort((a, b) => {
        const aIsMe = (a.name === playerName);
        const bIsMe = (b.name === playerName);
        if (aIsMe) return 1;  
        if (bIsMe) return -1; 
        return 0;
    });

    playersArray.forEach(player => {
        const isDead = player.isDead || player.hp <= 0;
        const isMe = (player.name === playerName);
        
        // 渲染時如果是自己，以本地最新計算的 myHp 為最高優先
        const displayHp = isMe ? myHp : (player.hp || 0);
        const hpPercent = Math.max(0, Math.min(100, displayHp));

        const item = document.createElement('div');
        if (isMe) {
            item.id = 'my-multiplayer-row'; 
            item.style.cssText = `background: #eff6ff; border: 2px solid #3b82f6; padding: 10px 14px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; opacity: ${isDead ? '0.6' : '1'}; transition: background-color 0.2s;`;
        } else {
            item.className = 'battle-player-row';
            item.style.cssText = `background: #ffffff; padding: 10px 14px; border-radius: 12px; border: 1px solid ${isDead ? '#fca5a5' : '#cbd5e1'}; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; opacity: ${isDead ? '0.6' : '1'}; transition: background-color 0.2s;`;
        }

        item.innerHTML = `
            <span class="player-name-tag" style="font-weight: 600; font-size: 14px; min-width: 70px; color: ${isMe ? '#1d4ed8' : '#334155'};">
                ${player.name} ${isMe ? '(你)' : ''}
            </span>
            <div class="hp-bar-outer" style="flex: 1; height: 10px; background: #e2e8f0; border-radius: 5px; margin: 0 12px; overflow: hidden;">
                <div class="hp-bar-inner ${hpPercent <= 30 ? 'low' : ''}" style="height: 100%; width: ${hpPercent}%; background: ${hpPercent <= 30 ? '#ef4444' : '#22c55e'}; border-radius: 5px; transition: width 0.3s ease;"></div>
            </div>
            <span class="status-badge" style="font-size: 13px; font-weight: 700; color: ${isDead ? '#dc2626' : '#64748b'}; min-width: 60px; text-align: right;">
                ${isDead ? '💀 淘汰' : `HP: ${displayHp}`}
            </span>
        `;
        scoreboardEl.appendChild(item);
    });
}

function handlePlayerElimination() {
    if (!isMultiplayerActive) return;
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (secondCounterInterval) clearInterval(secondCounterInterval);
    stopBGM();

    isMultiplayerActive = false;
    myHp = 0;

    if (currentRoomRef && playerName) {
        const safePlayerKey = playerName.replace(/[.#$\[\]]/g, "_");
        currentRoomRef.child(`players/${safePlayerKey}`).update({
            hp: 0,
            isDead: true
        });
    }

    if (currentWordEl) {
        currentWordEl.textContent = "💀 你已被淘汰！";
    }

    if (optionsContainerEl) {
        optionsContainerEl.innerHTML = `
            <div style="text-align: center; padding: 15px 0;">
                <p style="color: #dc2626; font-size: 18px; font-weight: bold; margin-bottom: 10px;">
                    你已被淘汰，進入觀戰模式
                </p>
                <p style="color: #64748b; font-size: 14px; margin-bottom: 15px;">觀戰中...等待比賽結束</p>
                <button id="btn-return-to-room" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 16px;">
                    🚪 返回房間大廳
                </button>
            </div>
        `;

        const btnReturn = document.getElementById('btn-return-to-room');
        if (btnReturn) {
            btnReturn.onclick = () => {
                playClickSound();
                if (battleScreen) battleScreen.classList.add('hidden');
                if (roomScreen) roomScreen.classList.remove('hidden');
            };
        }
    }
}

if (typeof btnStartGame !== 'undefined' && btnStartGame) {
    btnStartGame.addEventListener('click', () => {
        playClickSound();
        startMultiplayerRound();
    });
}

if (typeof btnLeaveRoom !== 'undefined' && btnLeaveRoom) {
    btnLeaveRoom.addEventListener('click', () => {
        playClickSound();
        if (currentRoomRef) {
            const safePlayerKey = playerName.replace(/[.#$\[\]]/g, "_");
            currentRoomRef.child('players/' + safePlayerKey).remove();
            currentRoomRef.off();
            currentRoomRef = null;
        }
        resetLocalGameState();
        roomScreen.classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
    });
}

// ==================== 3. 戰鬥核心邏輯 (單人模式) ====================

function startBattleGame() {
    myHp = 100;
    myCombo = 0;
    survivalSeconds = 0;
    drainIntervalMs = 500;
    wrongQuestionsList = [];

    if (survivalTimerEl && survivalTimerEl.parentElement) {
        survivalTimerEl.parentElement.style.display = 'block';
    }

    if (wrongWordsContainer) wrongWordsContainer.classList.add('hidden');
    if (allVocabPool.length === 0) initVocabPool();

    updateComboUI();
    renderScoreboard();

    if (typeof loadNextQuestion === 'function') {
        loadNextQuestion();
    }
    startBGM();

    startHealthDrainTimer();

    if (secondCounterInterval) clearInterval(secondCounterInterval);
    secondCounterInterval = setInterval(() => {
        if (myHp <= 0) {
            clearInterval(secondCounterInterval);
            return;
        }
        survivalSeconds++;
        if (survivalTimerEl) survivalTimerEl.textContent = survivalSeconds;

        if (survivalSeconds % 10 === 0 && drainIntervalMs > 100) {
            drainIntervalMs = Math.max(100, Math.floor(drainIntervalMs * 0.85));
            startHealthDrainTimer();
        }
    }, 1000);
}

function startHealthDrainTimer() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);

    gameTimerInterval = setInterval(() => {
        myHp = Math.max(0, myHp - 1);
        renderScoreboard();

        if (myHp <= 0) {
            handleGameOver();
        }
    }, drainIntervalMs);
}

function renderScoreboard() {
    if (!scoreboardEl) return;

    let row = document.getElementById('player-row-me');
    if (!row) {
        row = document.createElement('div');
        row.id = 'player-row-me';
        row.className = 'battle-player-row';
        scoreboardEl.appendChild(row);
    }

    const hpPercent = Math.max(0, Math.min(100, myHp));

    row.innerHTML = `
        <span class="player-name-tag">${playerName}</span>
        <div class="hp-bar-outer">
            <div class="hp-bar-inner ${myHp <= 30 ? 'low' : ''}" style="width: ${hpPercent}%;"></div>
        </div>
        <span class="status-badge">HP: ${myHp}</span>
    `;
}

function loadNextQuestion() {
    if (allVocabPool.length === 0) return;

    isCurrentQuestionMarked = false;
    if (currentWordEl) {
        currentWordEl.style.backgroundColor = '';
        currentWordEl.style.padding = '';
    }

    const targetItem = allVocabPool[Math.floor(Math.random() * allVocabPool.length)];

    const distractors = [];
    while (distractors.length < 3) {
        const randomItem = allVocabPool[Math.floor(Math.random() * allVocabPool.length)];
        if (randomItem.meaning !== targetItem.meaning && !distractors.includes(randomItem.meaning)) {
            distractors.push(randomItem.meaning);
        }
    }

    const options = [targetItem.meaning, ...distractors].sort(() => Math.random() - 0.5);
    const correctIndex = options.indexOf(targetItem.meaning);

    currentQuestion = {
        word: targetItem.word,
        meaning: targetItem.meaning,
        options: options,
        answer: correctIndex,
        level: targetItem.level || 'level4'
    };

    if (currentWordEl) {
        currentWordEl.textContent = currentQuestion.word;
    }

    renderOptions();
}

function renderOptions() {
    if (!optionsContainerEl) return;

    optionsContainerEl.innerHTML = '';
    currentQuestion.options.forEach((optText, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = optText;
        btn.onclick = () => {
            playClickSound();
            handleAnswer(index);
        };
        optionsContainerEl.appendChild(btn);
    });
}

function handleAnswer(selectedIndex) {
    if (!currentWordEl) return;

    currentWordEl.classList.remove('flash-correct', 'flash-wrong');

    if (selectedIndex === currentQuestion.answer) {
        playCorrectSound();
        myCombo++;
        myHp = Math.min(100, myHp + 15);
        updateComboUI();
        renderScoreboard();
        currentWordEl.classList.add('flash-correct');
    } else {
        playWrongSound();
        myCombo = 0;
        myHp = Math.max(0, myHp - 25);
        recordWrongItem(
            currentQuestion.word,
            currentQuestion.meaning,
            currentQuestion.level,
            currentQuestion.options[selectedIndex]
        );
        updateComboUI();
        renderScoreboard();
        currentWordEl.classList.add('flash-wrong');

        if (myHp <= 0) {
            handleGameOver();
            return;
        }
    }

    setTimeout(() => {
        if (currentWordEl) {
            currentWordEl.classList.remove('flash-correct', 'flash-wrong');
        }
    }, 300);

    loadNextQuestion();
}

function updateComboUI() {
    if (comboDisplayEl) {
        comboDisplayEl.textContent = `🔥 連擊：${myCombo} Combo！`;
    }
}

function disableAllOptionButtons() {
    if (optionsContainerEl) {
        const buttons = optionsContainerEl.querySelectorAll('button');
        buttons.forEach(btn => btn.disabled = true);
    }
}

function handleGameOver() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (secondCounterInterval) clearInterval(secondCounterInterval);
    stopBGM();
    disableAllOptionButtons();

    if (currentQuestion) {
        recordWrongItem(
            currentQuestion.word,
            currentQuestion.meaning,
            currentQuestion.level,
            '遊戲結束未作答/不確定'
        );
    }

    let isNewRecord = false;

    if (currentMode === 'ranked') {
        if (survivalSeconds > bestSurvivalSeconds) {
            bestSurvivalSeconds = survivalSeconds;
            localStorage.setItem('vocab_best_survival', bestSurvivalSeconds);
            isNewRecord = true;
            uploadRankedScore(playerName, survivalSeconds);
        }
    } else {
        if (survivalSeconds > bestSurvivalSeconds) {
            bestSurvivalSeconds = survivalSeconds;
            localStorage.setItem('vocab_best_survival', bestSurvivalSeconds);
            isNewRecord = true;
        }
    }

    renderWrongWordsReview();

    setTimeout(() => {
        if (isNewRecord) {
            if (currentMode === 'ranked') {
                alert(`🎉 破紀錄啦！你成功生存了 ${survivalSeconds} 秒！\n🏆 成績已成功登上排行榜！`);
            } else {
                alert(`🎉 破紀錄啦！你成功生存了 ${survivalSeconds} 秒，刷新個人最高紀錄！`);
            }
        } else {
            alert(`💀 遊戲結束！你共生存了 ${survivalSeconds} 秒（最高紀錄：${bestSurvivalSeconds} 秒）。`);
        }
    }, 200);
}

function renderWrongWordsReview() {
    if (!wrongWordsContainer || !wrongWordsListEl) return;

    wrongWordsListEl.innerHTML = '';

    if (wrongQuestionsList.length === 0) {
        wrongWordsListEl.innerHTML = '<div style="color: #22c55e; font-weight: bold; text-align: center;">太厲害了！本局完全沒有錯題！</div>';
    } else {
        wrongQuestionsList.forEach(item => {
            const card = document.createElement('div');
            card.style.cssText = "background: #ffffff; padding: 10px 12px; border-radius: 10px; border-left: 4px solid #ef4444; font-size: 14px;";
            card.innerHTML = `
                <div style="font-weight: bold; color: #0f172a; font-size: 15px;">${item.word}</div>
                <div style="color: #22c55e; margin-top: 2px;">正解：${item.correctMeaning}</div>
                <div style="color: #94a3b8; font-size: 12px; text-decoration:none;">誤選：${item.userChosenMeaning}</div>
            `;
            wrongWordsListEl.appendChild(card);
        });
    }

    wrongWordsContainer.classList.remove('hidden');
}

function returnToLobby() {
    playClickSound();

    const lobbyScreen = document.getElementById('lobby-screen');
    const battleScreen = document.getElementById('battle-screen');
    const roomScreen = document.getElementById('room-screen');
    const globalLeaderboardCard = document.getElementById('global-leaderboard-card');
    const wrongWordsContainer = document.getElementById('wrong-words-container');

    stopBGM();
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (secondCounterInterval) clearInterval(secondCounterInterval);

    if (battleScreen) battleScreen.classList.add('hidden');
    if (roomScreen) roomScreen.classList.add('hidden');
    if (wrongWordsContainer) wrongWordsContainer.classList.add('hidden');

    if (lobbyScreen) lobbyScreen.classList.remove('hidden');
    if (globalLeaderboardCard) globalLeaderboardCard.classList.remove('hidden');

    if (mainMenuOptions) mainMenuOptions.style.display = 'none';
    if (singleModeMenu) {
        singleModeMenu.classList.remove('hidden');
        singleModeMenu.style.display = 'flex';
    }

    updateBestTimeUI();
}

if (btnCloseReview) {
    btnCloseReview.onclick = () => {
        returnToLobby();
    };
}

const mainMenuOptions = document.getElementById('main-menu-options');
const singleModeMenu = document.getElementById('single-mode-menu');
const multiRoomBox = document.getElementById('multi-room-box');

const btnGotoSingle = document.getElementById('btn-goto-single');
const btnGotoMulti = document.getElementById('btn-goto-multi');
const btnBackToMain = document.getElementById('btn-back-to-main');
const btnBackFromMulti = document.getElementById('btn-back-from-multi');

const btnStartRanked = document.getElementById('btn-start-ranked');
const btnStartPractice = document.getElementById('btn-start-practice');

let currentMode = 'ranked';

if (btnGotoSingle) {
    btnGotoSingle.onclick = () => {
        playClickSound();
        mainMenuOptions.style.display = 'none';
        singleModeMenu.classList.remove('hidden');
        singleModeMenu.style.display = 'flex';
    };
}

if (btnGotoMulti) {
    btnGotoMulti.onclick = () => {
        playClickSound();
        mainMenuOptions.style.display = 'none';
        multiRoomBox.classList.remove('hidden');
        multiRoomBox.style.display = 'flex';
    };
}

const handleBackToMain = () => {
    playClickSound();
    singleModeMenu.style.display = 'none';
    singleModeMenu.classList.add('hidden');

    multiRoomBox.style.display = 'none';
    multiRoomBox.classList.add('hidden');

    mainMenuOptions.style.display = 'flex';
};

if (btnBackToMain) btnBackToMain.onclick = handleBackToMain;
if (btnBackFromMulti) btnBackFromMulti.onclick = handleBackToMain;

if (btnStartRanked) {
    btnStartRanked.onclick = () => {
        playClickSound();
        currentMode = 'ranked';
        launchSingleGame();
    };
}

if (btnStartPractice) {
    btnStartPractice.onclick = () => {
        playClickSound();
        currentMode = 'practice';
        launchSingleGame();
    };
}

function launchSingleGame() {
    const nameInput = document.getElementById('player-name');
    if (nameInput && nameInput.value.trim() !== '') {
        playerName = nameInput.value.trim();
    }

    const lobbyScreen = document.getElementById('lobby-screen');
    const globalLeaderboardCard = document.getElementById('global-leaderboard-card');
    const battleScreen = document.getElementById('battle-screen');

    if (lobbyScreen) lobbyScreen.classList.add('hidden');
    if (globalLeaderboardCard) globalLeaderboardCard.classList.add('hidden');

    if (battleScreen) {
        battleScreen.classList.remove('hidden');
    }

    if (typeof initVocabPool === 'function') {
        initVocabPool();
    }

    if (typeof startBattleGame === 'function') {
        startBattleGame();
    }
}

function renderLeaderboard(dataList = []) {
    const leaderboardListEl = document.getElementById('leaderboard-list');
    if (!leaderboardListEl) return;

    if (!dataList || dataList.length === 0) {
        leaderboardListEl.innerHTML = '<div style="text-align: center; padding: 8px 0; color: #94a3b8;">目前尚無排行榜資料</div>';
        return;
    }

    let html = '';
    dataList.forEach((item, index) => {
        let rankBadge = `${index + 1}.`;
        if (index === 0) rankBadge = '🥇 1.';
        else if (index === 1) rankBadge = '🥈 2.';
        else if (index === 2) rankBadge = '🥉 3.';

        const showBorder = index < dataList.length - 1;

        html += `
            <div style="display: flex; justify-content: space-between; padding: 4px 0; ${showBorder ? 'border-bottom: 1px dashed #f1f5f9;' : ''}">
                <span>${rankBadge} ${item.name || '匿名玩家'}</span>
                <span style="font-weight: bold; color: #16a34a;">${item.score || 0} 秒</span>
            </div>
        `;
    });

    leaderboardListEl.innerHTML = html;
}

if (typeof dbRef !== 'undefined') {
    dbRef.on('value', (snapshot) => {
        const data = snapshot.val();
        const dataList = [];

        if (data) {
            Object.keys(data).forEach(key => {
                dataList.push(data[key]);
            });
            dataList.sort((a, b) => b.score - a.score);
        }

        renderLeaderboard(dataList);
    });
}

function uploadRankedScore(name, score) {
    if (currentMode !== 'ranked') return;
    if (!name || score <= 0) return;

    const safeKey = name.replace(/[.$#\[\]\/]/g, "_");

    dbRef.child(safeKey).set({
        name: name,
        score: score,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }, (error) => {
        if (error) {
            console.error("成績上傳失敗：", error);
        } else {
            console.log(`🏆 成功更新 ${name} 的最高紀錄至雲端排行榜：${score} 秒`);
        }
    });
}

function saveWrongQuestionsToStorage() {
    localStorage.setItem('vocab_wrong_pool', JSON.stringify(wrongQuestionsList));
}

function addCustomWrongQuestion(word, meaning, level) {
    const exists = wrongQuestionsList.some(item => item.word === word);
    if (!exists) {
        wrongQuestionsList.push({
            word: word,
            correctMeaning: meaning,
            level: level || 'level4'
        });
        saveWrongQuestionsToStorage();
    }
}

function recordWrongItem(word, meaning, level, userChosen) {
    const existingIndex = wrongQuestionsList.findIndex(item => item.word === word);

    if (existingIndex !== -1) {
        wrongQuestionsList[existingIndex].userChosenMeaning = userChosen || '手動標記不熟';
    } else {
        wrongQuestionsList.push({
            word: word,
            correctMeaning: meaning,
            level: level || 'level4',
            userChosenMeaning: userChosen || '手動標記不熟'
        });
    }
    saveWrongQuestionsToStorage();
}

function removeWrongQuestion(word) {
    wrongQuestionsList = wrongQuestionsList.filter(item => item.word !== word);
    saveWrongQuestionsToStorage();
}

// ==================== 多人模式：回合控制與純答題對決 (含圖像化血條與受傷特效) ====================

let currentRound = null;        
let endedRoundHandled = null;   
let endRequestedRound = null;   

function resetLocalGameState() {
    if (gameTimerInterval) {
        clearInterval(gameTimerInterval);
        gameTimerInterval = null;
    }
    if (secondCounterInterval) {
        clearInterval(secondCounterInterval);
        secondCounterInterval = null;
    }
    stopBGM();
    isMultiplayerActive = false;
    currentRound = null;
    endedRoundHandled = null;
    endRequestedRound = null;
    myHp = 100;
    myCombo = 0;
    lastSelfActionTime = 0;
    
    if (scoreboardEl) scoreboardEl.innerHTML = '';
}

function startMultiplayerRound() {
    if (!currentRoomRef || !isHost) return;

    currentRoomRef.child('players').once('value', (snapshot) => {
        const players = snapshot.val() || {};
        const keys = Object.keys(players);

        if (keys.length < 2) {
            alert('至少需要 2 位玩家才能開始多人生存戰！');
            return;
        }

        const updates = {};
        keys.forEach(k => {
            updates[`players/${k}/hp`] = 100;
            updates[`players/${k}/isDead`] = false;
        });
        updates['status'] = 'playing';
        updates['winner'] = null;
        updates['startCount'] = keys.length; 
        updates['round'] = Date.now();

        currentRoomRef.update(updates);
    });
}

function declareWinnerIfNeeded(roomData) {
    if (!currentRoomRef) return;
    if ((roomData.startCount || 0) < 2) return;
    if (endRequestedRound === roomData.round) return;

    const players = Object.values(roomData.players || {});
    const alive = players.filter(p => !p.isDead && p.hp > 0);
    if (alive.length > 1) return;

    endRequestedRound = roomData.round;
    currentRoomRef.update({
        status: 'ended',
        winner: alive.length === 1 ? alive[0].name : '' 
    });
}

function showMultiplayerResult(winnerName) {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (secondCounterInterval) clearInterval(secondCounterInterval);
    stopBGM();
    isMultiplayerActive = false;

    const iAmWinner = !!winnerName && winnerName === playerName;

    if (currentWordEl) {
        currentWordEl.textContent = iAmWinner
            ? '🏆 恭喜你獲得最後勝利！'
            : (winnerName ? `🏁 遊戲結束！勝利者：${winnerName}` : '🏁 遊戲結束！本局平手');
    }

    if (optionsContainerEl) {
        optionsContainerEl.innerHTML = `
            <div style="text-align: center; padding: 15px 0;">
                <p style="color: ${iAmWinner ? '#16a34a' : '#64748b'}; font-size: 18px; font-weight: bold; margin-bottom: 15px;">
                    ${iAmWinner ? '🎉 你是最後的生存者，獲得 MVP！' : '比賽已結束，下次再接再厲！'}
                </p>
                <button id="btn-return-to-room" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 16px;">
                    🚪 返回房間大廳
                </button>
            </div>
        `;

        const btnReturn = document.getElementById('btn-return-to-room');
        if (btnReturn) {
            btnReturn.onclick = () => {
                playClickSound();
                if (battleScreen) battleScreen.classList.add('hidden');
                if (roomScreen) roomScreen.classList.remove('hidden');
                if (isHost) resetRoomToWaiting();
            };
        }
    }
}

// ⚡ 多人模式答題處理 (含時間戳鎖定，完美允許自我回血)
function handleMultiplayerAnswer(isCorrect) {
    if (myHp <= 0 || !isMultiplayerActive) return;

    // ⏱️ 標記主動操作時間，鎖定 1.2 秒防止被網路延遲覆蓋
    lastSelfActionTime = Date.now();

    if (isCorrect) {
        playCorrectSound();
        myCombo++;

        const comboMultiplier = 1 + (myCombo * 0.01);
        const healAmount = Math.round(10 * comboMultiplier);   
        const damageAmount = Math.round(15 * comboMultiplier); 

        // 🟢 回復自己血量（精確設定 0 ~ 100 邊界）
        myHp = Math.min(100, Math.max(0, myHp) + healAmount); 

        if (currentRoomRef && playerName) {
            const mySafeKey = playerName.replace(/[.#$\[\]]/g, "_");
            
            // 扣除其他對手的血量
            currentRoomRef.child('players').transaction(players => {
                if (players) {
                    Object.keys(players).forEach(key => {
                        if (key !== mySafeKey && players[key].hp > 0 && !players[key].isDead) {
                            const newHp = Math.max(0, (players[key].hp || 100) - damageAmount);
                            players[key].hp = newHp;
                            if (newHp <= 0) {
                                players[key].isDead = true;
                            }
                        }
                    });
                }
                return players;
            });
        }
    } else {
        playWrongSound();
        myCombo = 0; 

        const selfDamageAmount = 5; 
        myHp = Math.max(0, myHp - selfDamageAmount);
        
        triggerDamageEffect(selfDamageAmount);
    }

    if (comboDisplayEl) comboDisplayEl.textContent = `🔥 連擊：${myCombo} Combo！`;

    syncMyHpToFirebase();

    if (myHp <= 0) {
        handlePlayerElimination();
    } else {
        nextMultiplayerQuestion();
    }
}

// 房間即時監聽 (雙向時間戳協調)
function listenRoomData() {
    if (!currentRoomRef) return;

    currentRoomRef.on('value', (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData) return;

        // A. 等待大廳成員清單
        if (playerListContainer && roomData.players && roomData.status === 'waiting') {
            playerListContainer.innerHTML = '';
            Object.values(roomData.players).forEach(player => {
                const item = document.createElement('div');
                item.className = 'player-item';
                item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #fff; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 6px;";
                item.innerHTML = `
                    <span style="font-weight: 500; color: #1e293b;">${player.name || '未知玩家'}</span>
                    <span style="font-size: 12px; color: ${player.isHost ? '#d97706' : '#64748b'};">${player.isHost ? '👑 房主' : '已準備'}</span>
                `;
                playerListContainer.appendChild(item);
            });
        }

        // B. 房主設定 / 權限
        updateRoomUIByRole(roomData);

        // C. 戰鬥記分板與受傷偵測
        if (roomData.players) {
            const mySafeKey = playerName.replace(/[.#$\[\]]/g, "_");
            const meData = roomData.players[mySafeKey];

            if (meData && typeof meData.hp === 'number') {
                // ⏱️ 時間戳防護：如果距離自己上次答題還不到 1.2 秒，代表雲端傳過來的是網路延遲的舊資料，直接忽視！
                const timeSinceLastAction = Date.now() - lastSelfActionTime;

                if (timeSinceLastAction > 1200 && isMultiplayerActive) {
                    // 當前距離答題已經超過 1.2 秒，此時傳過來的血量減少一定是「被敵人打到」
                    if (meData.hp < myHp) {
                        const diff = myHp - meData.hp;
                        myHp = meData.hp; 
                        triggerDamageEffect(diff);
                    }
                }
                
                if (myHp <= 0 && isMultiplayerActive) {
                    handlePlayerElimination();
                }
            }

            // 渲染畫面上所有玩家的血條
            renderMultiplayerScoreboard(roomData.players);
        }

        // D. 新的一局開始（每個 round 編號只會啟動一次）
        if (roomData.status === 'playing' && roomData.round && roomData.round !== currentRound) {
            currentRound = roomData.round;
            isMultiplayerActive = true;

            if (roomScreen) roomScreen.classList.add('hidden');
            if (battleScreen) battleScreen.classList.remove('hidden');

            startMultiplayerGameSession(roomData);
            return;
        }

        // E. 進行中：檢查是否只剩 0~1 人存活
        if (roomData.status === 'playing' && roomData.round === currentRound) {
            declareWinnerIfNeeded(roomData);
        }

        // F. 已結束：所有人顯示結算
        if (roomData.status === 'ended' && roomData.round === currentRound && endedRoundHandled !== roomData.round) {
            endedRoundHandled = roomData.round;
            showMultiplayerResult(roomData.winner);
        }

        // G. 房主重置回 waiting：把還停在戰鬥畫面的人一起帶回等待大廳
        if (roomData.status === 'waiting' && battleScreen && !battleScreen.classList.contains('hidden')) {
            battleScreen.classList.add('hidden');
            if (roomScreen) roomScreen.classList.remove('hidden');
        }
    });
}

// ==================== 💥 血條受傷特效觸發函式 ====================
function triggerDamageEffect(damageNum = 15) {
    const myRow = document.getElementById('my-multiplayer-row');
    if (myRow) {
        myRow.classList.remove('row-flash-damage');
        void myRow.offsetWidth; // 觸發 reflow 重新播放動畫
        myRow.classList.add('row-flash-damage');

        const floatEl = document.createElement('div');
        floatEl.className = 'floating-damage';
        floatEl.textContent = `-${damageNum}`;
        
        const rect = myRow.getBoundingClientRect();
        const randomX = rect.left + rect.width / 2 + (Math.random() * 30 - 15);
        const randomY = rect.top + (Math.random() * 10 - 5);
        
        floatEl.style.left = `${randomX}px`;
        floatEl.style.top = `${randomY}px`;
        
        document.body.appendChild(floatEl);
        setTimeout(() => floatEl.remove(), 600);
    }
}