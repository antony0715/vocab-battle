// ==================== 懂你意思單字哥 - 錯題回顧與加速扣血版 app.js ====================

let playerName = "單字小高手";
let myHp = 100;
let myCombo = 0;
let currentQuestion = null;
let allVocabPool = [];

// 生存模式變數
let gameTimerInterval = null;
let secondCounterInterval = null;
let survivalSeconds = 0;
let bestSurvivalSeconds = localStorage.getItem('vocab_best_survival') || 0;

// 動態扣血速度變數（初始 500ms 扣一次，隨著時間縮短毫秒數）
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
    } catch (e) {}
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
    } catch (e) {}
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
    } catch (e) {}
}

// 緊張背景音樂 (節奏動態加快)
function startBGM() {
    initAudio();
    stopBGM();
    let beat = 0;
    
    // 每 400ms 發出一次節奏低音
    bgmInterval = setInterval(() => {
        try {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'triangle';
            // 雙音交替律動
            const baseFreq = (beat % 2 === 0) ? 110 : 130.81; 
            osc.frequency.setValueAtTime(baseFreq, now);
            
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start(now);
            osc.stop(now + 0.25);
            beat++;
        } catch (e) {}
    }, 400);
}

function stopBGM() {
    if (bgmInterval) {
        clearInterval(bgmInterval);
        bgmInterval = null;
    }
}

// ==================== 1. 初始化與紀錄 ====================
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

window.addEventListener('DOMContentLoaded', () => {
    initVocabPool();
    updateBestTimeUI();
});

function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// ==================== 2. 大廳與按鈕事件 ====================

btnCreateRoom.addEventListener('click', () => {
    playClickSound();
    const inputVal = playerNameInput.value.trim();
    if (inputVal) playerName = inputVal;
    
    enterRoomUI(generateRoomCode());
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
    enterRoomUI(inputCode);
});

function enterRoomUI(roomCode) {
    lobbyScreen.classList.add('hidden');
    roomScreen.classList.remove('hidden');
    
    if (displayRoomCode) displayRoomCode.textContent = `#${roomCode}`;

    if (playerListContainer) {
        playerListContainer.innerHTML = '';
        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `
            <div class="player-avatar">${playerName.charAt(0)}</div>
            <span>${playerName} (房主)</span>
        `;
        playerListContainer.appendChild(card);
    }
}

btnLeaveRoom.addEventListener('click', () => {
    playClickSound();
    roomScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
    updateBestTimeUI();
});

btnStartGame.addEventListener('click', () => {
    playClickSound();
    // ⚡ 確保播放聲音的權限解鎖
    initAudio();
    
    roomScreen.classList.add('hidden');
    battleScreen.classList.remove('hidden');

    startBattleGame();
});

if (btnCloseReview) {
    btnCloseReview.addEventListener('click', () => {
        playClickSound();
        if (wrongWordsContainer) wrongWordsContainer.classList.add('hidden');
        returnToRoomLobby();
    });
}

// ==================== 3. 戰鬥核心邏輯 (包含動態加速扣血) ====================

function startBattleGame() {
    myHp = 100;
    myCombo = 0;
    survivalSeconds = 0;
    drainIntervalMs = 500; // 初始每 0.5 秒扣 1 HP
    wrongQuestionsList = []; // 清空上一局錯題

    if (wrongWordsContainer) wrongWordsContainer.classList.add('hidden');
    if (allVocabPool.length === 0) initVocabPool();

    updateComboUI();
    renderScoreboard();
    loadNextQuestion();

    // 啟動 BGM
    startBGM();

    // 1. 持續扣血計時器
    startHealthDrainTimer();

    // 2. 生存秒數計時器（每 10 秒加快扣血速度！）
    if (secondCounterInterval) clearInterval(secondCounterInterval);
    secondCounterInterval = setInterval(() => {
        if (myHp <= 0) {
            clearInterval(secondCounterInterval);
            return;
        }
        survivalSeconds++;
        if (survivalTimerEl) survivalTimerEl.textContent = survivalSeconds;

        // ⚡ 每生存 10 秒，扣血頻率加快 15%（最低限制 100ms 扣一次）
        if (survivalSeconds % 10 === 0 && drainIntervalMs > 100) {
            drainIntervalMs = Math.max(100, Math.floor(drainIntervalMs * 0.85));
            console.log(`⚡ 難度提升！目前扣血速度：每 ${drainIntervalMs}ms 扣血`);
            
            // 重啟扣血計時器套用新速度
            startHealthDrainTimer();
        }
    }, 1000);
}

// 動態啟動/重新開啟扣血計時器
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
        answer: correctIndex
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
    if (selectedIndex === currentQuestion.answer) {
        // 答對：補血 +15 HP (上限 100)
        playCorrectSound();
        myCombo++;
        myHp = Math.min(100, myHp + 15);
        updateComboUI();
        renderScoreboard();
    } else {
        // 答錯：重扣 25 HP、並上記記錄錯題
        playWrongSound();
        myCombo = 0;
        myHp = Math.max(0, myHp - 25);
        
        // ⚡ 收集錯題紀錄
        wrongQuestionsList.push({
            word: currentQuestion.word,
            correctMeaning: currentQuestion.meaning,
            userChosenMeaning: currentQuestion.options[selectedIndex]
        });

        updateComboUI();
        renderScoreboard();

        if (myHp <= 0) {
            handleGameOver();
            return;
        }
    }

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

// 遊戲結束處理
function handleGameOver() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (secondCounterInterval) clearInterval(secondCounterInterval);
    stopBGM();
    disableAllOptionButtons();

    // 檢查最高紀錄
    let isNewRecord = false;
    if (survivalSeconds > bestSurvivalSeconds) {
        bestSurvivalSeconds = survivalSeconds;
        localStorage.setItem('vocab_best_survival', bestSurvivalSeconds);
        isNewRecord = true;
    }

    // 顯示錯題檢討
    renderWrongWordsReview();

    setTimeout(() => {
        if (isNewRecord) {
            alert(`🎉 破紀錄啦！你成功生存了 ${survivalSeconds} 秒，刷新最高紀錄！`);
        } else {
            alert(`💀 遊戲結束！你共生存了 ${survivalSeconds} 秒（最高紀錄：${bestSurvivalSeconds} 秒）。`);
        }
    }, 200);
}

// 渲染錯題檢討卡片
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
                <div style="color: #94a3b8; font-size: 12px; text-decoration: line-through;">誤選：${item.userChosenMeaning}</div>
            `;
            wrongWordsListEl.appendChild(card);
        });
    }

    // 顯示錯題視窗
    wrongWordsContainer.classList.remove('hidden');
}

function returnToRoomLobby() {
    stopBGM();
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (secondCounterInterval) clearInterval(secondCounterInterval);
    updateBestTimeUI();
    
    if (battleScreen) battleScreen.classList.add('hidden');
    if (roomScreen) roomScreen.classList.remove('hidden');
}