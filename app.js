// ====================  - 錯題回顧與加速扣血版 app.js ====================

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
// 在 listenRoomData 或進入房間時，控制房主面板的互動權限
const hostSettingsPanel = document.getElementById('host-settings-panel');
const selectVocabLevel = document.getElementById('select-vocab-level');

// 當房主切換設定時，同步更新到 Firebase 房間節點
if (selectVocabLevel) {
    selectVocabLevel.addEventListener('change', () => {
        if (isHost && currentRoomRef) {
            currentRoomRef.child('settings').update({
                vocabLevel: selectVocabLevel.value
            });
        }
    });
}

// 在監聽房間資料的函式中（listenRoomData），加入這一段權限與設定同步：
function updateRoomUIByRole(roomData) {
    // 1. 控制房主面板是否可操作
    if (hostSettingsPanel && selectVocabLevel) {
        if (isHost) {
            selectVocabLevel.disabled = false; // 房主可以調整
            hostSettingsPanel.style.opacity = '1';
        } else {
            selectVocabLevel.disabled = true;  // 成員只能看，不能改
            hostSettingsPanel.style.opacity = '0.8';
        }
    }

    // 2. 同步房主選的設定到所有人的畫面上
    if (roomData.settings && roomData.settings.vocabLevel && selectVocabLevel) {
        selectVocabLevel.value = roomData.settings.vocabLevel;
    }

    // 3. 控制開始按鈕僅房主可見
    if (typeof btnStartGame !== 'undefined' && btnStartGame) {
        btnStartGame.style.display = isHost ? 'block' : 'none';
    }
}
// ==================== 2. 大廳與按鈕事件 (多人生存戰雲端連線) ====================

let currentRoomRef = null;
let isHost = false;

// 產生 4 碼隨機房間代碼
function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// 1. 點擊「創建房間」
btnCreateRoom.addEventListener('click', () => {
    playClickSound();
    const inputVal = playerNameInput.value.trim();
    if (inputVal) playerName = inputVal;

    const roomCode = generateRoomCode();
    isHost = true;

    // 真正寫入 Firebase 建立房間
    initMultiplayerRoom(roomCode, true);
});

// 2. 點擊「加入房間」
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

    // 真正寫入 Firebase 加入房間
    initMultiplayerRoom(inputCode, false);
});

// 3. Firebase 房間初始化與成員寫入核心函式
function initMultiplayerRoom(roomCode, isCreating) {
    const safePlayerKey = playerName.replace(/[.#$\[\]]/g, "_");
    currentRoomRef = firebase.database().ref('rooms/' + roomCode);
    console.log("正在嘗試連線房間：", roomCode, "是否為房主：", isCreating);

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
            console.log("房主建立成功，準備切換畫面");
            enterRoomUI(roomCode);
            listenRoomData();
        }).catch((error) => {
            console.error("建立房間失敗：", error);
            alert("建立房間失敗，請檢查網路連線！");
        });
    } else {
        currentRoomRef.once('value', (snapshot) => {
            console.log("查詢房間快照是否存在：", snapshot.exists());
            if (!snapshot.exists()) {
                alert('找不到該房間，請確認 4 碼代碼是否正確！');
                return;
            }

            currentRoomRef.child('players/' + safePlayerKey).set({
                name: playerName,
                isHost: false,
                hp: 100
            }).then(() => {
                console.log("成員寫入成功，準備切換畫面");
                enterRoomUI(roomCode);
                listenRoomData();
            }).catch((error) => {
                console.error("加入房間失敗：", error);
                alert("加入房間失敗，請重試！");
            });
        });
    }
}

// 4. 切換至房間等待大廳 UI
function enterRoomUI(roomCode) {
    console.log("執行 enterRoomUI，roomCode =", roomCode);
    if (lobbyScreen) {
        lobbyScreen.classList.add('hidden');
    } else {
        console.error("找不到 lobbyScreen DOM！");
    }

    if (roomScreen) {
        roomScreen.classList.remove('hidden');
    } else {
        console.error("找不到 roomScreen DOM！");
    }

    if (displayRoomCode) displayRoomCode.textContent = `#${roomCode}`;
}
// 5. 即時監聽房間資料變動（包含成員清單渲染與設定同步）
// 2. 房間即時監聽中加入「最後存活者判定」
// 5. 即時監聽房間資料變動（包含最後存活者勝利判定）
function listenRoomData() {
    if (!currentRoomRef) return;

    currentRoomRef.on('value', (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData) return;

        // A. 渲染等待大廳成員清單
        if (playerListContainer && roomData.players && roomData.status === 'waiting') {
            playerListContainer.innerHTML = '';
            Object.values(roomData.players).forEach(player => {
                const item = document.createElement('div');
                item.className = 'player-item';
                item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #fff; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 6px;";
                item.innerHTML = `
                    <span style="font-weight: 500; color: #1e293b;">${player.name}</span>
                    <span style="font-size: 12px; color: ${player.isHost ? '#d97706' : '#64748b'};">${player.isHost ? '👑 房主' : '已準備'}</span>
                `;
                playerListContainer.appendChild(item);
            });
        }

        // B. 更新房主面板權限與設定
        updateRoomUIByRole(roomData);

        // C. 即時更新記分板與「最後存活者」勝利判定
        if (roomData.players) {
            renderMultiplayerScoreboard(roomData.players);

            // ⚡ 核心修復：遊戲進行中且自己還活著時，檢查是否只剩自己
            if (roomData.status === 'playing' && isMultiplayerActive) {
                const entries = Object.entries(roomData.players);
                
                if (entries.length > 1) {
                    const mySafeKey = playerName ? playerName.replace(/[.#$\[\]]/g, "_") : "";
                    const otherPlayers = entries.filter(([key, p]) => key !== mySafeKey);
                    
                    // 檢查是不是「其他人全部都死亡 (isDead 為 true 或 hp <= 0)」
                    const allOthersDead = otherPlayers.length > 0 && otherPlayers.every(([key, p]) => p.isDead === true || (p.hp !== undefined && p.hp <= 0));

                    if (allOthersDead) {
                        handleVictory();
      // 監聽雲端房間狀態與全體同步
function listenRoomData() {
    if (!currentRoomRef) return;

    currentRoomRef.on('value', (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData) return;

        // A. 等待大廳階段 (waiting)
        if (roomData.status === 'waiting') {
            isMultiplayerActive = false; // 確保遊戲狀態關閉
            
            // 畫面切換：顯示大廳，隱藏戰鬥畫面
            if (roomScreen) roomScreen.classList.remove('hidden');
            if (battleScreen) battleScreen.classList.add('hidden');

            // 渲染大廳成員清單
            if (playerListContainer && roomData.players) {
                playerListContainer.innerHTML = '';
                Object.values(roomData.players).forEach(player => {
                    const item = document.createElement('div');
                    item.className = 'player-item';
                    item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #fff; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 6px;";
                    item.innerHTML = `
                        <span style="font-weight: 500; color: #1e293b;">${player.name}</span>
                        <span style="font-size: 12px; color: ${player.isHost ? '#d97706' : '#64748b'};">${player.isHost ? '👑 房主' : '已準備'}</span>
                    `;
                    playerListContainer.appendChild(item);
                });
            }
            updateRoomUIByRole(roomData);
        }

        // B. 戰鬥進行中 (playing)
        if (roomData.status === 'playing') {
            if (!isMultiplayerActive) {
                isMultiplayerActive = true;
                if (roomScreen) roomScreen.classList.add('hidden');
                if (battleScreen) battleScreen.classList.remove('hidden');
                startMultiplayerGameSession(roomData);
            }

            if (roomData.players) {
                renderMultiplayerScoreboard(roomData.players);

                // ⚡ 檢查勝利條件：多人遊玩時，若只剩一人活著，主動向雲端宣告結束
                const playersArray = Object.values(roomData.players);
                if (playersArray.length > 1) {
                    const alivePlayers = playersArray.filter(p => p.hp > 0 && !p.isDead);
                    
                    // 只剩一個存活者，且那個存活者剛好是「我」
                    if (alivePlayers.length === 1 && alivePlayers[0].name === playerName) {
                        currentRoomRef.update({
                            status: 'ended',
                            winner: playerName
                        });
                    }
                }
            }
        }

        // C. ⚡【全體同步結束】遊戲結束階段 (ended)
        if (roomData.status === 'ended') {
            // 1. 強制徹底停止一切計時器與音樂，鎖定答題
            if (gameTimerInterval) clearInterval(gameTimerInterval);
            if (secondCounterInterval) clearInterval(secondCounterInterval);
            stopBGM();
            isMultiplayerActive = false;

            const winnerName = roomData.winner || "未知玩家";

            // 2. 判斷自己是獲勝者還是被淘汰者
            if (playerName === winnerName) {
                // 獲勝者的畫面：顯示勝利訊息 + 「返回房間頁面」按鈕
                if (currentWordEl) currentWordEl.textContent = "🏆 恭喜你獲得最後勝利！";
                if (optionsContainerEl) {
                    optionsContainerEl.innerHTML = `
                        <div style="text-align: center; padding: 15px 0;">
                            <p style="color: #16a34a; font-size: 20px; font-weight: bold; margin-bottom: 15px;">
                                你是最後的生存者！堅持了 ${survivalSeconds} 秒
                            </p>
                            <button id="btn-winner-return" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 16px; font-weight: bold;">
                                🚪 結束遊戲並返回房間
                            </button>
                        </div>
                    `;
                    const btnWinnerReturn = document.getElementById('btn-winner-return');
                    if (btnWinnerReturn) {
                        btnWinnerReturn.onclick = () => {
                            playClickSound();
                            // 獲勝者點擊後，重置雲端所有玩家 HP 並改回 waiting，帶領所有人一起回大廳！
                            resetRoomToWaiting();
                        };
                    }
                }
            } else {
                // 其他被淘汰者的畫面：提示遊戲結束，等待獲勝者帶大家回大廳
                if (currentWordEl) currentWordEl.textContent = "💀 遊戲結束！";
                if (optionsContainerEl) {
                    optionsContainerEl.innerHTML = `
                        <div style="text-align: center; padding: 15px 0;">
                            <p style="color: #64748b; font-size: 16px; font-weight: bold; margin-bottom: 10px;">
                                獲勝者是：<span style="color: #16a34a; font-size: 18px;">${winnerName}</span>
                            </p>
                            <p style="color: #94a3b8; font-size: 14px;">等待獲勝者返回房間大廳中...</p>
                        </div>
                    `;
                }
            }
        }
    });
}              }
                }
            }
        }

        // D. 當房主按下開始， status 變為 'playing' 時啟動多人戰鬥
        if (roomData.status === 'playing' && !isMultiplayerActive) {
            isMultiplayerActive = true;
            
            if (roomScreen) roomScreen.classList.add('hidden');
            if (typeof battleScreen !== 'undefined' && battleScreen) {
                battleScreen.classList.remove('hidden');
            }

            startMultiplayerGameSession(roomData);
        }
    });
}

// 獲勝者重置房間（全體重置準備下一局）
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

            // 一次寫入 Firebase，瞬間觸發全體所有人回到等待大廳！
            currentRoomRef.update(updates);
        }
    });
}
// ==================== 多人生存戰專屬戰鬥邏輯 ====================

let isMultiplayerActive = false;

// 初始化多人遊戲
// 1. 多人遊戲初始化時，確保計時器變數乾淨並正確啟動
function startMultiplayerGameSession(roomData) {
    myHp = 100;
    myCombo = 0;
    survivalSeconds = 0;
    drainIntervalMs = 500;
    drainAmount = 1;

    if (comboDisplayEl) comboDisplayEl.textContent = 'Combo: 0';
    startBGM();

    const vocabLevel = (roomData.settings && roomData.settings.vocabLevel) || 'all';
    filterVocabByLevel(vocabLevel);

    nextMultiplayerQuestion();
    startMultiplayerHpDrain();

    // ⚡ 確保正確啟動生存秒數計時器
    if (secondCounterInterval) clearInterval(secondCounterInterval);
    secondCounterInterval = setInterval(() => {
        if (!isMultiplayerActive) return; // 如果已經死掉就不繼續累加
        survivalSeconds++;
        if (survivalTimerEl) {
            survivalTimerEl.textContent = `${survivalSeconds} 秒`;
        }
    }, 1000);
}

// 4. 【新增】當自己是最後存活者時的勝利處理函式
// 勝利結算處理
function handleVictory() {
    if (!isMultiplayerActive) return;
    
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (secondCounterInterval) clearInterval(secondCounterInterval);
    stopBGM();

    isMultiplayerActive = false;

    if (currentWordEl) {
        currentWordEl.textContent = "🏆 恭喜你獲得最後勝利！";
    }

    if (optionsContainerEl) {
        optionsContainerEl.innerHTML = `
            <div style="text-align: center; padding: 15px 0;">
                <p style="color: #16a34a; font-size: 20px; font-weight: bold; margin-bottom: 15px;">
                    你是最後的生存者！總共撐了 ${survivalSeconds} 秒
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
                if (currentRoomRef && isHost) {
                    currentRoomRef.update({ status: 'waiting' });
                }
            };
        }
    }
}

// 根據選定難度篩選單字
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

// 多人出題與選項渲染
// 多人模式出題與選項渲染（加入嚴格防呆鎖）
function nextMultiplayerQuestion() {
    // ⚡ 關鍵防呆：如果遊戲已經不在活躍狀態，直接強制退出，絕不換題！
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

    // 再次檢查，確保渲染前依然在遊戲中
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

// 多人模式答題處理
function handleMultiplayerAnswer(isCorrect) {
    if (myHp <= 0 || !isMultiplayerActive) return;

    if (isCorrect) {
        playCorrectSound();
        myCombo++;
        myHp = Math.min(100, myHp + 10);
    } else {
        playWrongSound();
        myCombo = 0;
        myHp = Math.max(0, myHp - 15);
    }

    if (comboDisplayEl) comboDisplayEl.textContent = `Combo: ${myCombo}`;
    
    syncMyHpToFirebase();

    if (myHp <= 0) {
        handlePlayerElimination();
    } else {
        // ⚡ 必須再次確認遊戲依然活躍，才出下一題
        if (isMultiplayerActive) {
            nextMultiplayerQuestion();
        }
    }
}

// 多人持續扣血
function startMultiplayerHpDrain() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);

    gameTimerInterval = setInterval(() => {
        myHp -= drainAmount;
        syncMyHpToFirebase();

        if (myHp <= 0) {
            handlePlayerElimination();
        }
    }, drainIntervalMs);
}

// 同步我的血量至 Firebase
function syncMyHpToFirebase() {
    if (currentRoomRef && playerName) {
        const safePlayerKey = playerName.replace(/[.#$\[\]]/g, "_");
        currentRoomRef.child(`players/${safePlayerKey}`).update({
            hp: Math.max(0, myHp)
        });
    }
}

// 即時渲染戰鬥畫面記分板 (#scoreboard)
function renderMultiplayerScoreboard(playersObj) {
    if (!scoreboardEl) return;
    scoreboardEl.innerHTML = '';

    Object.values(playersObj).forEach(player => {
        const isDead = player.isDead || player.hp <= 0;
        const item = document.createElement('div');
        item.style.cssText = `background: #ffffff; padding: 8px 12px; border-radius: 6px; border: 1px solid ${isDead ? '#fca5a5' : '#cbd5e1'}; display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; opacity: ${isDead ? '0.6' : '1'};`;

        item.innerHTML = `
            <span style="font-weight: 600; color: #334155;">${player.name} ${player.name === playerName ? '(你)' : ''}</span>
            <span style="font-weight: bold; color: ${isDead ? '#dc2626' : (player.hp > 30 ? '#2563eb' : '#d97706')};">
                ${isDead ? '💀 已淘汰' : `HP: ${player.hp}`}
            </span>
        `;
        scoreboardEl.appendChild(item);
    });
}

// 3. 玩家淘汰處理（修正秒數顯示與狀態清除）
// 玩家淘汰處理
function handlePlayerElimination() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (secondCounterInterval) clearInterval(secondCounterInterval);
    stopBGM();

    myHp = 0;

    // 將自己的死亡狀態寫入 Firebase
    if (currentRoomRef && playerName) {
        const safePlayerKey = playerName.replace(/[.#$\[\]]/g, "_");
        currentRoomRef.child(`players/${safePlayerKey}`).update({
            hp: 0,
            isDead: true
        });
    }

    if (currentWordEl) currentWordEl.textContent = "💀 你已被淘汰！";
    if (optionsContainerEl) {
        optionsContainerEl.innerHTML = `
            <div style="text-align: center; padding: 15px 0;">
                <p style="color: #dc2626; font-size: 18px; font-weight: bold; margin-bottom: 10px;">
                    你在這場生存戰中堅持了 ${survivalSeconds} 秒
                </p>
                <p style="color: #64748b; font-size: 14px;">觀戰中...等待比賽產生最終獲勝者</p>
            </div>
        `;
    }
}
// 2. 答題防呆保護（死後禁止點擊）
function handleMultiplayerAnswer(isCorrect) {
    // 雙重防呆：如果血量已經 <= 0 或已淘汰，直接不執行
    if (myHp <= 0 || !isMultiplayerActive) return;

    if (isCorrect) {
        playCorrectSound();
        myCombo++;
        myHp = Math.min(100, myHp + 10);
    } else {
        playWrongSound();
        myCombo = 0;
        myHp = Math.max(0, myHp - 15);
    }

    if (comboDisplayEl) comboDisplayEl.textContent = `Combo: ${myCombo}`;

    // 即時寫入雲端
    syncMyHpToFirebase();

    // 判斷死亡或跳下一題
    if (myHp <= 0) {
        handlePlayerElimination();
    } else {
        nextMultiplayerQuestion();
    }
}
// 6. 房主按下「開始大逃殺！」按鈕
if (typeof btnStartGame !== 'undefined' && btnStartGame) {
    btnStartGame.addEventListener('click', () => {
        playClickSound();
        if (currentRoomRef && isHost) {
            currentRoomRef.update({ status: 'playing' });
        }
    });
}

// 7. 離開房間按鈕邏輯
if (typeof btnLeaveRoom !== 'undefined' && btnLeaveRoom) {
    btnLeaveRoom.addEventListener('click', () => {
        playClickSound();
        if (currentRoomRef) {
            const safePlayerKey = playerName.replace(/[.#$\[\]]/g, "_");
            currentRoomRef.child('players/' + safePlayerKey).remove(); // 從雲端移除自己
            currentRoomRef.off(); // 斷開監聽
            currentRoomRef = null;
        }
        roomScreen.classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
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

// ==================== 排行榜動態渲染函數與監聽 ====================
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

        // 修正原本這裡的語法錯誤
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

// 🌐 自動從 Firebase 即時監聽並更新排行榜
if (typeof dbRef !== 'undefined') {
    dbRef.on('value', (snapshot) => {
        const data = snapshot.val();
        const dataList = [];

        if (data) {
            Object.keys(data).forEach(key => {
                dataList.push(data[key]);
            });
            // 依分數高低排序（最高分排最前面）
            dataList.sort((a, b) => b.score - a.score);
        }

        renderLeaderboard(dataList);
    });
}

// 更新分數函式維持不變
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

// 1. 修正多人答題處理：答對/答錯後，先檢查是否勝利或結束，才決定要不要出下一題
function handleMultiplayerAnswer(isCorrect) {
    // 防呆：如果已經不在遊戲中或自己死了，直接退出
    if (myHp <= 0 || !isMultiplayerActive) return;

    if (isCorrect) {
        playCorrectSound();
        myCombo++;
        myHp = Math.min(100, myHp + 10);
    } else {
        playWrongSound();
        myCombo = 0;
        myHp = Math.max(0, myHp - 15);
    }

    if (comboDisplayEl) comboDisplayEl.textContent = `Combo: ${myCombo}`;

    // 即時寫入雲端
    syncMyHpToFirebase();

    if (myHp <= 0) {
        handlePlayerElimination();
    } else {
        // 答題後，再次確認遊戲是否依然活躍（防止剛好在這一題達成最後一人存活）
        if (isMultiplayerActive) {
            nextMultiplayerQuestion();
        }
    }
}

// 2. 修正房間即時監聽的「最後存活者判定」
function listenRoomData() {
    if (!currentRoomRef) return;

    currentRoomRef.on('value', (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData) return;

        // A. 渲染等待大廳成員清單
        if (playerListContainer && roomData.players && roomData.status === 'waiting') {
            playerListContainer.innerHTML = '';
            Object.values(roomData.players).forEach(player => {
                const item = document.createElement('div');
                item.className = 'player-item';
                item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #fff; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 6px;";
                item.innerHTML = `
                    <span style="font-weight: 500; color: #1e293b;">${player.name}</span>
                    <span style="font-size: 12px; color: ${player.isHost ? '#d97706' : '#64748b'};">${player.isHost ? '👑 房主' : '已準備'}</span>
                `;
                playerListContainer.appendChild(item);
            });
        }

        // B. 更新設定與權限
        updateRoomUIByRole(roomData);

        // C. 即時更新記分板與勝利判定
        if (roomData.players) {
            renderMultiplayerScoreboard(roomData.players);

            // ⚡ 【嚴格判定】遊戲進行中且自己還活著時，檢查是否只剩自己
            if (roomData.status === 'playing' && isMultiplayerActive) {
                const playersArray = Object.values(roomData.players);

                // 計算「明確死亡 (isDead === true 或 hp <= 0)」的人數
                const deadPlayers = playersArray.filter(p => p.isDead || p.hp <= 0);
                const alivePlayers = playersArray.filter(p => !p.isDead && p.hp > 0);

                // 條件：房間內總人數 > 1 且 其他人都死光了（活著的只剩「我」一個）
                if (playersArray.length > 1 && deadPlayers.length >= playersArray.length - 1 && alivePlayers.length === 1 && alivePlayers[0].name === playerName) {
                    handleVictory();
                }
            }
        }

        // D. 遊戲開始觸發
        if (roomData.status === 'playing' && !isMultiplayerActive) {
            isMultiplayerActive = true;

            if (roomScreen) roomScreen.classList.add('hidden');
            if (typeof battleScreen !== 'undefined' && battleScreen) {
                battleScreen.classList.remove('hidden');
            }

            startMultiplayerGameSession(roomData);
        }
    });
}

// 3. 確保 handleVictory 能夠徹底停止一切並切換畫面
function handleVictory() {
    if (!isMultiplayerActive) return; // 防止重複觸發

    if (gameTimerInterval) clearInterval(gameTimerInterval);
    if (secondCounterInterval) clearInterval(secondCounterInterval);
    stopBGM();

    isMultiplayerActive = false; // 封鎖所有後續答題與計時

    if (currentWordEl) {
        currentWordEl.textContent = "🏆 恭喜你獲得最後勝利！";
    }

    if (optionsContainerEl) {
        optionsContainerEl.innerHTML = `
            <div style="text-align: center; padding: 15px 0;">
                <p style="color: #16a34a; font-size: 20px; font-weight: bold; margin-bottom: 15px;">
                    你是最後的生存者！總共撐了 ${survivalSeconds} 秒
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

                // 如果是房主，將房間狀態重置回 waiting
                if (currentRoomRef && isHost) {
                    currentRoomRef.update({ status: 'waiting' });
                }
            };
        }
    }
}