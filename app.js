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

// ==================== Firebase 雲端排行榜設定 ====================
// 請換成您在 Firebase 專案設定中取得的正確 config
const firebaseConfig = {
    databaseURL: "https://vocab-battle-game-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// 如果尚未初始化，則進行初始化
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
        // ⚡ 請把 returnToLobby(); 加在這邊！
        returnToLobby();
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
   
    // ⚡ 關鍵：這裡必須確實呼叫載入第一道題目！
    if (typeof loadNextQuestion === 'function') {
        loadNextQuestion();
    }
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

    // ⚡ 換題時重置標記狀態與背景
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
        level: targetItem.level || 'level4' // 記錄級數方便分類
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
// 抓取單字題目顯示區

function handleAnswer(selectedIndex) {
    if (!currentWordEl) return;

    // 先移除之前的特效類別
    currentWordEl.classList.remove('flash-correct', 'flash-wrong');

    if (selectedIndex === currentQuestion.answer) {
        playCorrectSound();
        myCombo++;
        myHp = Math.min(100, myHp + 15);
        updateComboUI();
        renderScoreboard();

        // 僅讓題目區閃綠框
        currentWordEl.classList.add('flash-correct');
    } else {
        playWrongSound();
        myCombo = 0;
        myHp = Math.max(0, myHp - 25);
        // ⚡ 這裡改用統一記錄函式，自動防重複並記錄錯選答案
        recordWrongItem(
            currentQuestion.word, 
            currentQuestion.meaning, 
            currentQuestion.level, 
            currentQuestion.options[selectedIndex]
        );

        updateComboUI();
        renderScoreboard();

        // 僅讓題目區閃紅框
        currentWordEl.classList.add('flash-wrong');

        if (myHp <= 0) {
            handleGameOver();
            return;
        }
    }

    // 0.3 秒後自動移除閃爍外框
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

// 遊戲結束處理
function handleGameOver() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (secondCounterInterval) clearInterval(secondCounterInterval);
    stopBGM();
    disableAllOptionButtons();

    // ⚡【新增這段】當遊戲結束時，如果畫面上還有正在顯示的題目，代表這是最後一題（玩家來不及答或時間到），自動將它加入錯題庫！
    if (currentQuestion) {
        recordWrongItem(
            currentQuestion.word, 
            currentQuestion.meaning, 
            currentQuestion.level, 
            '遊戲結束未作答/不確定'
        );
    }

    let isNewRecord = false;

    // 排位賽模式：只有刷新歷史紀錄才觸發雲端上傳
    if (currentMode === 'ranked') {
        if (survivalSeconds > bestSurvivalSeconds) {
            bestSurvivalSeconds = survivalSeconds;
            localStorage.setItem('vocab_best_survival', bestSurvivalSeconds);
            isNewRecord = true;
            
            // 只有突破歷史紀錄才上傳雲端！
            uploadRankedScore(playerName, survivalSeconds);
        }
    } else {
        // 練習模式：只更新本地紀錄不上傳
        if (survivalSeconds > bestSurvivalSeconds) {
            bestSurvivalSeconds = survivalSeconds;
            localStorage.setItem('vocab_best_survival', bestSurvivalSeconds);
            isNewRecord = true;
        }
    }

    renderWrongWordsReview();

    setTimeout(() => {
        if (isNewRecord) {
            // 💡 在這裡加上已上榜的提示！
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
                <div style="color: #94a3b8; font-size: 12px; text-decoration:none;">誤選：${item.userChosenMeaning}</div>
            `;
            wrongWordsListEl.appendChild(card);
        });
    }

    // 顯示錯題視窗
    wrongWordsContainer.classList.remove('hidden');
}

// ==================== 統一返回主頁/大廳邏輯 ====================
function returnToLobby() {
    playClickSound();

    // 1. 抓取所有相關畫面區塊
    const lobbyScreen = document.getElementById('lobby-screen');
    const battleScreen = document.getElementById('battle-screen');
    const roomScreen = document.getElementById('room-screen');
    const globalLeaderboardCard = document.getElementById('global-leaderboard-card');
    const wrongWordsContainer = document.getElementById('wrong-words-container');

    // 2. 停止背景音樂與遊戲計時器
    stopBGM();
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (secondCounterInterval) clearInterval(secondCounterInterval);

    // 3. 隱藏戰鬥畫面、房間等待畫面與錯題回顧
    if (battleScreen) battleScreen.classList.add('hidden');
    if (roomScreen) roomScreen.classList.add('hidden');
    if (wrongWordsContainer) wrongWordsContainer.classList.add('hidden');

    // 4. 重新顯示主大廳與頂部全伺服器排行榜卡片！
    if (lobbyScreen) lobbyScreen.classList.remove('hidden');
    if (globalLeaderboardCard) globalLeaderboardCard.classList.remove('hidden');

    // 展開單人模式選單，隱藏主選單按鈕
    if (mainMenuOptions) mainMenuOptions.style.display = 'none';
    if (singleModeMenu) {
        singleModeMenu.classList.remove('hidden');
        singleModeMenu.style.display = 'flex';
    }

    // 6. 更新最高紀錄 UI
    updateBestTimeUI();
}

// 綁定錯題檢討區的「確定並返回大廳」按鈕
if (btnCloseReview) {
    btnCloseReview.onclick = () => {
        returnToLobby();
    };
}
// ==================== 主頁面切換控制與排位賽/練習模式對接 ====================
const mainMenuOptions = document.getElementById('main-menu-options');
const singleModeMenu = document.getElementById('single-mode-menu');
const multiRoomBox = document.getElementById('multi-room-box');

const btnGotoSingle = document.getElementById('btn-goto-single');
const btnGotoMulti = document.getElementById('btn-goto-multi');
const btnBackToMain = document.getElementById('btn-back-to-main');
const btnBackFromMulti = document.getElementById('btn-back-from-multi');

const btnStartRanked = document.getElementById('btn-start-ranked');
const btnStartPractice = document.getElementById('btn-start-practice');

let currentMode = 'ranked'; // 記錄當前模式：'ranked' (排位賽) 或 'practice' (練習模式)

// 1. 點擊「單人遊戲」：展開單人模式子選單
if (btnGotoSingle) {
    btnGotoSingle.onclick = () => {
        playClickSound();
        mainMenuOptions.style.display = 'none';
        singleModeMenu.classList.remove('hidden');
        singleModeMenu.style.display = 'flex';
    };
}

// 2. 點擊「多人遊戲」：展開多人房輸入區
if (btnGotoMulti) {
    btnGotoMulti.onclick = () => {
        playClickSound();
        mainMenuOptions.style.display = 'none';
        multiRoomBox.classList.remove('hidden');
        multiRoomBox.style.display = 'flex';
    };
}

// 3. 返回主選單按鈕
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

// 4. 點擊「排位賽模式」：設定為排位賽並啟動遊戲
if (btnStartRanked) {
    btnStartRanked.onclick = () => {
        playClickSound();
        currentMode = 'ranked';
        launchSingleGame();
    };
}

// 5. 點擊「練習模式」：設定為練習模式並啟動遊戲
if (btnStartPractice) {
    btnStartPractice.onclick = () => {
        playClickSound();
        currentMode = 'practice';
        launchSingleGame();
    };
}

// 統一的單人遊戲啟動與畫面切換函數
function launchSingleGame() {
    // 取得玩家暱稱
    const nameInput = document.getElementById('player-name');
    if (nameInput && nameInput.value.trim() !== '') {
        playerName = nameInput.value.trim();
    }

    // 隱藏大廳與上方全伺服器排行榜卡片
    const lobbyScreen = document.getElementById('lobby-screen');
    const globalLeaderboardCard = document.getElementById('global-leaderboard-card');
    const battleScreen = document.getElementById('battle-screen');

    if (lobbyScreen) lobbyScreen.classList.add('hidden');
    if (globalLeaderboardCard) globalLeaderboardCard.classList.add('hidden');
    
    // 顯示戰鬥競技場畫面
    if (battleScreen) {
        battleScreen.classList.remove('hidden');
    }

    // 確保題庫已初始化
    if (typeof initVocabPool === 'function') {
        initVocabPool();
    }

    // 呼叫原本遊戲主程式的開始函數
    if (typeof startBattleGame === 'function') {
        startBattleGame();
    }
}

// ==================== 排行榜動態渲染函數 ====================
function renderLeaderboard(dataList = []) {
    const leaderboardListEl = document.getElementById('leaderboard-list');
    if (!leaderboardListEl) return;

    if (!dataList || dataList.length === 0) {
        leaderboardListEl.innerHTML = '<div style="text-align: center; padding: 8px 0; color: #94a3b8;">目前尚無排行榜資料</div>';
        return;
    }

    // 動態拼裝真實排行榜項目
    let html = '';
    dataList.forEach((item, index) => {
        let rankBadge = `${index + 1}.`;
        if (index === 0) rankBadge = '🥇 1.';
        else if (index === 1) rankBadge = '🥈 2.';
        else if (index === 2) rankBadge = '🥉 3.';

        html += `
            <div style="display: flex; justify-content: space-between; padding: 4px 0; ${index < dataList.length - 1 ? 'border-bottom: 1px dashed #f1f5f9;' : ''}">
                <span>${rankBadge} ${item.name || '匿名玩家'}</span>
                <span style="font-weight: bold; color: #16a34a;">${item.score || 0} 秒</span>
            </div>
        `;
    });

    leaderboardListEl.innerHTML = html;
}

// 初始執行一次，顯示無資料狀態
renderLeaderboard([]);
//更新分數
function uploadRankedScore(name, score) {
    if (currentMode !== 'ranked') return;
    if (!name || score <= 0) return;

    // 清除名稱中的非法字元（Firebase key 不支援 . $ # [ ] /）
    const safeKey = name.replace(/[.$#\[\]\/]/g, "_");

    // 直接以名稱做為節點 key，覆蓋原先的紀錄
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
// 儲存錯題庫至 localStorage
function saveWrongQuestionsToStorage() {
    localStorage.setItem('vocab_wrong_pool', JSON.stringify(wrongQuestionsList));
}

// 新增至錯題庫（確保絕對不會重複）
function addCustomWrongQuestion(word, meaning, level) {
    // 檢查錯題庫裡面是否已經存在這個單字
    const exists = wrongQuestionsList.some(item => item.word === word);
    
    // 如果還不存在，才推入陣列並儲存
    if (!exists) {
        wrongQuestionsList.push({ 
            word: word, 
            correctMeaning: meaning, 
            level: level || 'level4' 
        });
        saveWrongQuestionsToStorage();
    }
}

// 從錯題庫移除
function removeWrongQuestion(word) {
    wrongQuestionsList = wrongQuestionsList.filter(item => item.word !== word);
    saveWrongQuestionsToStorage();
}
// 統一管理錯題加入（自動防重複，若已存在則更新最後一次誤選的答案）
function recordWrongItem(word, meaning, level, userChosen) {
    const existingIndex = wrongQuestionsList.findIndex(item => item.word === word);
    
    if (existingIndex !== -1) {
        // 如果錯題庫已經有這個單字，更新它最近一次的誤選記錄
        wrongQuestionsList[existingIndex].userChosenMeaning = userChosen || '手動標記不熟';
    } else {
        // 如果沒有，才新增一筆
        wrongQuestionsList.push({ 
            word: word, 
            correctMeaning: meaning, 
            level: level || 'level4',
            userChosenMeaning: userChosen || '手動標記不熟'
        });
    }
    saveWrongQuestionsToStorage();
}

// 支援手動點擊移除錯題的函式
function removeWrongQuestion(word) {
    wrongQuestionsList = wrongQuestionsList.filter(item => item.word !== word);
    saveWrongQuestionsToStorage();
}