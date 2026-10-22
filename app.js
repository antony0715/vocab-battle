// ==================== 英語單字King app.js (v4) ====================
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeKey = n => String(n).replace(/[.#$\[\]\/]/g, '_');
const mySafeKey = () => safeKey(playerName);
const LEVEL_LABEL = { level4: '4級', level5: '5級', level6: '6級' };
const MANUAL_MARK = '手動標記不熟';

// ---------- 狀態 ----------
let playerName = "帥哥或美女";
let myHp = 100, myCombo = 0;
let currentQuestion = null;
let allVocabPool = [], activePool = [], distractPool = [], practicePool = [];
let gameTimerInterval = null, secondCounterInterval = null;
let survivalSeconds = 0, drainIntervalMs = 500;
let bestSurvivalSeconds = Number(localStorage.getItem('vocab_best_survival')) || 0;
let bestScore = Number(localStorage.getItem('vocab_best_score')) || 0;
let correctCount = 0, wrongCount = 0, score = 0;
let singlePlaying = false;
let currentMode = 'ranked'; // ranked | practice | multi
let wrongQuestionsList = []; // 本局錯題 [{word, correctMeaning, level, userChosenMeaning}]
let isCurrentQuestionMarked = false, markAddedNew = false;
let lastSummaryHtml = '';
let lbTab = 'time';
const lbData = { time: [], score: [] };

// ---------- DOM ----------
const screens = { lobby: $('lobby-screen'), room: $('room-screen'), battle: $('battle-screen'), bank: $('bank-screen') };
function showScreen(n) { Object.entries(screens).forEach(([k, el]) => el && el.classList.toggle('hidden', k !== n)); }

const mainMenuOptions = $('main-menu-options'), singleModeMenu = $('single-mode-menu');
const multiRoomBox = $('multi-room-box'), practiceSetupBox = $('practice-setup-box');
const menus = { main: mainMenuOptions, single: singleModeMenu, multi: multiRoomBox, practice: practiceSetupBox };
function showMenu(n) {
    Object.entries(menus).forEach(([k, el]) => {
        if (!el) return;
        const on = k === n;
        el.classList.toggle('hidden', !on);
        el.style.display = on ? 'flex' : 'none';
    });
}

const playerNameInput = $('player-name'), roomCodeInput = $('room-code-input');
const displayRoomCode = $('display-room-code'), playerListContainer = $('player-list');
const btnCreateRoom = $('btn-create-room'), btnJoinRoom = $('btn-join-room');
const btnStartGame = $('btn-start-game'), btnLeaveRoom = $('btn-leave-room'), btnToggleReady = $('btn-toggle-ready');
const scoreboardEl = $('scoreboard'), currentWordEl = $('current-word');
const optionsContainerEl = $('options-container'), comboDisplayEl = $('combo-display');
const survivalTimerEl = $('survival-timer'), survivalWrap = $('survival-wrap');
const statsDisplay = $('stats-display'), btnFinishPractice = $('btn-finish-practice');
const wrongWordsContainer = $('wrong-words-container'), wrongWordsListEl = $('wrong-words-list');
const btnCloseReview = $('btn-close-review'), btnAddAllWrong = $('btn-add-all-wrong');
const hostSettingsPanel = $('host-settings-panel'), selectVocabLevel = $('select-vocab-level');

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


// ==================== 1. Firebase 與單字庫 ====================
const firebaseConfig = {
    databaseURL: "https://vocab-battle-game-default-rtdb.asia-southeast1.firebasedatabase.app/"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const dbRef = firebase.database().ref('leaderboard');            // 生存秒數榜
const scoreRef = firebase.database().ref('leaderboard_score');   // 分數榜

function getVocabByLevels(levels) {
    const src = {
        level4: typeof level4Vocab !== 'undefined' ? level4Vocab : [],
        level5: typeof level5Vocab !== 'undefined' ? level5Vocab : [],
        level6: typeof level6Vocab !== 'undefined' ? level6Vocab : []
    };
    let out = [];
    levels.forEach(l => {
        if (Array.isArray(src[l])) out = out.concat(src[l].map(v => ({ word: v.word, meaning: v.meaning, level: l })));
    });
    return out;
}

function initVocabPool() {
    allVocabPool = getVocabByLevels(['level4', 'level5', 'level6']);
    if (allVocabPool.length === 0) {
        allVocabPool = [
            { word: "abandon", meaning: "放棄、拋棄", level: 'level4' },
            { word: "absorb", meaning: "吸收、吸引", level: 'level4' },
            { word: "abstract", meaning: "抽象的", level: 'level4' },
            { word: "academic", meaning: "學術的、學院的", level: 'level4' },
            { word: "accelerate", meaning: "加速、促進", level: 'level4' }
        ];
    }
}

// 產生一題（targetPool 出題，distractPool 提供干擾選項）
// 可設定種子的亂數產生器（多人模式用：同一局所有玩家拿到相同題目順序）
function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function makeQuestion(pool, dPool, rng = Math.random) {
    const t = pool[Math.floor(rng() * pool.length)];
    const opts = [t.meaning];
    let guard = 0;
    while (opts.length < 4 && guard++ < 500) {
        const m = dPool[Math.floor(rng() * dPool.length)].meaning;
        if (!opts.includes(m)) opts.push(m);
    }
    for (let i = opts.length - 1; i > 0; i--) { // Fisher-Yates 洗牌
        const j = Math.floor(rng() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return { word: t.word, meaning: t.meaning, level: t.level || 'level4', options: opts, answer: opts.indexOf(t.meaning) };
}

// ==================== 2. 我的錯題庫 (localStorage) ====================
function loadBank() {
    try { const a = JSON.parse(localStorage.getItem('vocab_wrong_bank') || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
}
let wrongBank = loadBank();
const saveBank = () => localStorage.setItem('vocab_wrong_bank', JSON.stringify(wrongBank));
const isInBank = word => wrongBank.some(w => w.word === word);
function addToBank(item) {
    if (isInBank(item.word)) return false;
    wrongBank.push({ word: item.word, meaning: item.correctMeaning, level: item.level || 'level4', addedAt: Date.now() });
    saveBank();
    return true;
}
function removeFromBank(word) { wrongBank = wrongBank.filter(w => w.word !== word); saveBank(); }

let bankFilter = 'all', bankSort = 'time', bankSearch = '';
function renderBank() {
    const listEl = $('bank-list');
    $('bank-count').textContent = `共 ${wrongBank.length} 個單字`;
    document.querySelectorAll('#bank-level-tabs .lb-tab').forEach(b => b.classList.toggle('active', b.dataset.level === bankFilter));

    const q = bankSearch.trim().toLowerCase();
    let items = wrongBank.filter(w =>
        (bankFilter === 'all' || w.level === bankFilter) &&
        (!q || w.word.toLowerCase().includes(q) || (w.meaning || '').includes(q)));

    if (bankSort === 'alpha') items.sort((a, b) => a.word.localeCompare(b.word));
    else if (bankSort === 'level') items.sort((a, b) => a.level.localeCompare(b.level) || a.word.localeCompare(b.word));
    else items.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

    if (!items.length) {
        listEl.innerHTML = `<div class="bank-empty">${wrongBank.length ? '沒有符合條件的單字' : '錯題庫還是空的！<br>遊戲結束後把錯題向右滑動就能加入。'}</div>`;
        return;
    }
    let html = '', lastGroup = null;
    items.forEach(w => {
        let g = null;
        if (bankSort === 'alpha') g = (w.word[0] || '#').toUpperCase();
        else if (bankSort === 'level') g = LEVEL_LABEL[w.level] || w.level;
        if (g !== null && g !== lastGroup) { html += `<div class="bank-group">${esc(g)}</div>`; lastGroup = g; }
        html += `<div class="bank-row">
            <div><div class="bank-word">${esc(w.word)}<span class="lv-badge">${esc(LEVEL_LABEL[w.level] || '')}</span></div>
            <div class="bank-meaning">${esc(w.meaning)}</div></div>
            <button class="bank-remove" data-word="${esc(w.word)}">✓ 我會了</button></div>`;
    });
    listEl.innerHTML = html;
}

$('bank-list').addEventListener('click', e => {
    const b = e.target.closest('.bank-remove');
    if (!b) return;
    playClickSound();
    removeFromBank(b.dataset.word);
    renderBank();
});
document.querySelectorAll('#bank-level-tabs .lb-tab').forEach(b => b.onclick = () => { playClickSound(); bankFilter = b.dataset.level; renderBank(); });
$('bank-sort').onchange = e => { bankSort = e.target.value; renderBank(); };
$('bank-search').oninput = e => { bankSearch = e.target.value; renderBank(); };
$('btn-bank-back').onclick = () => { playClickSound(); showScreen('lobby'); showMenu('main'); };
$('btn-bank-clear').onclick = () => {
    if (!wrongBank.length) return;
    if (confirm('確定要清空整個錯題庫嗎？此動作無法復原。')) { wrongBank = []; saveBank(); renderBank(); }
};
$('btn-bank-practice').onclick = () => {
    playClickSound();
    if (!wrongBank.length) { alert('錯題庫還是空的，先去玩幾局吧！'); return; }
    practicePool = wrongBank.map(w => ({ word: w.word, meaning: w.meaning, level: w.level }));
    currentMode = 'practice';
    launchSingleGame();
};

// ==================== 3. 排行榜 (秒數 / 分數) ====================
function updateBestTimeUI() {
    const el = $('best-record-text');
    if (!el) return;
    el.textContent = lbTab === 'time' ? `我的最高紀錄：${bestSurvivalSeconds} 秒` : `我的最高紀錄：${bestScore} 分`;
}

function renderLeaderboard() {
    const el = $('leaderboard-list');
    if (!el) return;
    const list = lbData[lbTab];
    const unit = lbTab === 'time' ? '秒' : '分';
    if (!list || !list.length) {
        el.innerHTML = '<div style="text-align: center; padding: 8px 0; color: #94a3b8;">載入中...</div>';
        return;
    }
    el.innerHTML = list.map((item, i) => {
        const badge = i === 0 ? '🥇 1.' : i === 1 ? '🥈 2.' : i === 2 ? '🥉 3.' : `${i + 1}.`;
        return `<div style="display: flex; justify-content: space-between; padding: 4px 0; ${i < list.length - 1 ? 'border-bottom: 1px dashed #f1f5f9;' : ''}">
            <span>${badge} ${esc(item.name || '匿名玩家')}</span>
            <span style="font-weight: bold; color: #16a34a;">${item.score || 0} ${unit}</span></div>`;
    }).join('');
}

function listenBoard(ref, key) {
    ref.on('value', snap => {
        const data = snap.val();
        lbData[key] = data ? Object.values(data).sort((a, b) => b.score - a.score) : [];
        renderLeaderboard();
    });
}
listenBoard(dbRef, 'time');
listenBoard(scoreRef, 'score');

document.querySelectorAll('.lb-tabs .lb-tab').forEach(b => b.onclick = () => {
    playClickSound();
    lbTab = b.dataset.tab;
    document.querySelectorAll('.lb-tabs .lb-tab').forEach(x => x.classList.toggle('active', x === b));
    updateBestTimeUI();
    renderLeaderboard();
});

// 只在新成績比雲端高時才寫入
function uploadRecord(ref, name, value) {
    if (!name || !(value > 0)) return;
    ref.child(safeKey(name)).transaction(cur => {
        if (cur && cur.score >= value) return; // 放棄寫入
        return { name: name, score: value, timestamp: firebase.database.ServerValue.TIMESTAMP };
    }, err => { if (err) console.error('成績上傳失敗：', err); });
}

// ==================== 4. 錯題紀錄 / 結算畫面 ====================
function recordWrongItem(word, meaning, level, userChosen) {
    const i = wrongQuestionsList.findIndex(x => x.word === word);
    if (i !== -1) wrongQuestionsList[i].userChosenMeaning = userChosen;
    else wrongQuestionsList.push({ word, correctMeaning: meaning, level: level || 'level4', userChosenMeaning: userChosen });
}

function buildSummary(headline, lines = []) {
    const total = correctCount + wrongCount;
    const rate = total ? (wrongCount / total * 100).toFixed(1) : '0.0';
    return `<div class="summary-box"><div class="summary-title">${headline}</div>
        ${lines.map(l => `<div class="summary-line">${l}</div>`).join('')}
        <div class="summary-grid">
            <div>✅ 答對<b>${correctCount}</b></div><div>❌ 答錯<b>${wrongCount}</b></div>
            <div>📝 總題數<b>${total}</b></div><div>📉 錯誤率<b>${rate}%</b></div>
        </div></div>`;
}

function createReviewCard(item) {
    const wrap = document.createElement('div');
    wrap.className = 'swipe-wrap';
    wrap.innerHTML = `<div class="swipe-bg">➕ 加入錯題庫</div>
        <div class="swipe-card">
            <div>
                <div style="font-weight: bold; color: #0f172a; font-size: 15px;">${esc(item.word)}</div>
                <div style="color: #22c55e; margin-top: 2px;">正解：${esc(item.correctMeaning)}</div>
                <div style="color: #94a3b8; font-size: 12px;">誤選：${esc(item.userChosenMeaning)}</div>
            </div>
            <button class="mini-add-btn"></button>
        </div>`;
    const card = wrap.querySelector('.swipe-card'), btn = wrap.querySelector('.mini-add-btn');
    const refresh = () => {
        const added = isInBank(item.word);
        card.classList.toggle('added', added);
        btn.textContent = added ? '✓ 已加入' : '＋ 加入';
        btn.disabled = added;
    };
    const doAdd = () => { if (addToBank(item)) playCorrectSound(); refresh(); updateAddAllBtn(); };
    btn.onclick = doAdd;
    refresh();

    let startX = null, dx = 0;
    card.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        startX = e.clientX; dx = 0;
        card.style.transition = 'none';
        try { card.setPointerCapture(e.pointerId); } catch (_) { }
    });
    card.addEventListener('pointermove', e => {
        if (startX === null) return;
        dx = Math.max(0, e.clientX - startX);
        card.style.transform = `translateX(${dx}px)`;
    });
    const end = () => {
        if (startX === null) return;
        card.style.transition = 'transform 0.25s';
        card.style.transform = 'translateX(0)';
        if (dx > 80) doAdd();
        startX = null; dx = 0;
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
    return wrap;
}

function updateAddAllBtn() {
    if (!btnAddAllWrong) return;
    const all = wrongQuestionsList.length > 0 && wrongQuestionsList.every(w => isInBank(w.word));
    btnAddAllWrong.textContent = all ? '✓ 已全部加入我的錯題庫' : '全部加入我的錯題庫';
    btnAddAllWrong.disabled = all;
}

function renderWrongWordsReview(summaryHtml) {
    if (!wrongWordsContainer || !wrongWordsListEl) return;
    if (summaryHtml !== undefined) lastSummaryHtml = summaryHtml;
    $('result-summary').innerHTML = lastSummaryHtml;
    wrongWordsListEl.innerHTML = '';

    const has = wrongQuestionsList.length > 0;
    $('review-hint').style.display = has ? '' : 'none';
    btnAddAllWrong.style.display = has ? '' : 'none';
    if (!has) {
        wrongWordsListEl.innerHTML = '<div style="color: #22c55e; font-weight: bold; text-align: center;">太厲害了！本局完全沒有錯題！</div>';
    } else {
        wrongQuestionsList.forEach(item => wrongWordsListEl.appendChild(createReviewCard(item)));
        updateAddAllBtn();
    }
    btnCloseReview.textContent = currentMode === 'multi' ? '🚪 返回房間大廳' : currentMode === 'practice' ? '返回主選單' : '確定並返回大廳';
    wrongWordsContainer.classList.remove('hidden');
}

btnAddAllWrong.onclick = () => {
    playClickSound();
    wrongQuestionsList.forEach(addToBank);
    renderWrongWordsReview();
};
btnCloseReview.onclick = () => {
    playClickSound();
    if (currentMode === 'multi') returnToRoom();
    else returnToLobby(currentMode === 'practice' ? 'main' : 'single');
};

// 點擊題目單字：標記為不熟
window.addEventListener('DOMContentLoaded', () => {
    initVocabPool();
    updateBestTimeUI();
    renderLeaderboard();
    currentWordEl.style.cursor = 'pointer';
    currentWordEl.title = "點擊即可標記/取消標記為不熟單字";
    currentWordEl.onclick = () => {
        if (!currentQuestion || !isPlaying()) return;
        playClickSound();
        isCurrentQuestionMarked = !isCurrentQuestionMarked;
        if (isCurrentQuestionMarked) {
            currentWordEl.style.backgroundColor = '#f7f387';
            markAddedNew = !wrongQuestionsList.some(w => w.word === currentQuestion.word);
            if (markAddedNew) recordWrongItem(currentQuestion.word, currentQuestion.meaning, currentQuestion.level, MANUAL_MARK);
        } else {
            currentWordEl.style.backgroundColor = '';
            if (markAddedNew) wrongQuestionsList = wrongQuestionsList.filter(w => w.word !== currentQuestion.word);
            markAddedNew = false;
        }
    };
});

function isPlaying() { return currentMode === 'multi' ? isMultiplayerActive : singlePlaying; }

// ==================== 5. 共用：出題 / 顯示 ====================
function configureBattleUI(mode) {
    const show = (el, on, d) => { if (el) el.style.display = on ? d : 'none'; };
    show(scoreboardEl, mode !== 'practice', '');
    show(comboDisplayEl, mode !== 'practice', '');
    show(survivalWrap, mode === 'ranked', 'block');
    show(statsDisplay, mode === 'ranked', 'flex');
    show(btnFinishPractice, mode === 'practice', 'block');
}

function updateComboUI() {
    if (comboDisplayEl) comboDisplayEl.textContent = `🔥 連擊：${myCombo} Combo！`;
}

function updateStatsUI() {
    const total = correctCount + wrongCount;
    $('stat-correct').textContent = correctCount;
    $('stat-wrong').textContent = wrongCount;
    $('stat-total').textContent = total;
    $('stat-rate').textContent = (total ? (wrongCount / total * 100).toFixed(1) : '0.0') + '%';
    $('score-display').textContent = Math.round(score * 10) / 10;
}

function loadNextQuestion() {
    if (!activePool.length || !distractPool.length) return;
    isCurrentQuestionMarked = false; markAddedNew = false;
    currentWordEl.style.backgroundColor = '';
    if (currentMode === 'multi') {
        // 以「本局種子 + 第幾題」決定題目，每局不同、同局所有玩家相同
        const qSeed = ((multiSeed % 4294967296) + Math.imul(multiQIndex + 1, 0x9E3779B1)) >>> 0;
        multiQIndex++;
        currentQuestion = makeQuestion(activePool, distractPool, mulberry32(qSeed));
    } else {
        currentQuestion = makeQuestion(activePool, distractPool);
    }
    currentWordEl.textContent = currentQuestion.word;
    renderOptions();
}

function renderOptions() {
    optionsContainerEl.innerHTML = '';
    currentQuestion.options.forEach((optText, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = optText;
        btn.onclick = () => {
            playClickSound();
            if (currentMode === 'multi') handleMultiplayerAnswer(index);
            else handleAnswer(index);
        };
        optionsContainerEl.appendChild(btn);
    });
}

function disableAllOptionButtons() {
    optionsContainerEl.querySelectorAll('button').forEach(b => b.disabled = true);
}

function flashWord(ok) {
    currentWordEl.classList.remove('flash-correct', 'flash-wrong');
    currentWordEl.classList.add(ok ? 'flash-correct' : 'flash-wrong');
    setTimeout(() => currentWordEl.classList.remove('flash-correct', 'flash-wrong'), 300);
}

// ==================== 6. 單人模式 (排位 / 練習) ====================
function startBattleGame() {
    const practice = currentMode === 'practice';
    clearInterval(gameTimerInterval); clearInterval(secondCounterInterval);
    myHp = 100; myCombo = 0; survivalSeconds = 0; drainIntervalMs = 500;
    correctCount = 0; wrongCount = 0; score = 0;
    wrongQuestionsList = [];
    singlePlaying = true; isMultiplayerActive = false;

    if (allVocabPool.length === 0) initVocabPool();
    activePool = practice ? practicePool : allVocabPool;
    distractPool = allVocabPool;

    configureBattleUI(practice ? 'practice' : 'ranked');
    scoreboardEl.innerHTML = '';
    survivalTimerEl.textContent = 0;
    wrongWordsContainer.classList.add('hidden');
    updateComboUI(); updateStatsUI();
    loadNextQuestion();

    if (practice) return; // 練習模式：無血量、計時、連擊、背景音樂

    renderScoreboard();
    startBGM();
    startHealthDrainTimer();
    secondCounterInterval = setInterval(() => {
        if (myHp <= 0 || !singlePlaying) { clearInterval(secondCounterInterval); return; }
        survivalSeconds++;
        survivalTimerEl.textContent = survivalSeconds;
        if (survivalSeconds % 10 === 0 && drainIntervalMs > 100) {
            drainIntervalMs = Math.max(100, Math.floor(drainIntervalMs * 0.85));
            startHealthDrainTimer();
        }
    }, 1000);
}

function startHealthDrainTimer() {
    clearInterval(gameTimerInterval);
    gameTimerInterval = setInterval(() => {
        myHp = Math.max(0, myHp - 1);
        renderScoreboard();
        if (myHp <= 0) handleGameOver(true);
    }, drainIntervalMs);
}

function renderScoreboard() {
    let row = $('player-row-me');
    if (!row) {
        row = document.createElement('div');
        row.id = 'player-row-me';
        row.className = 'battle-player-row';
        scoreboardEl.appendChild(row);
    }
    const pct = Math.max(0, Math.min(100, myHp));
    row.innerHTML = `<span class="player-name-tag">${esc(playerName)}</span>
        <div class="hp-bar-outer"><div class="hp-bar-inner ${myHp <= 30 ? 'low' : ''}" style="width: ${pct}%;"></div></div>
        <span class="status-badge">HP: ${myHp}</span>`;
}

function handleAnswer(selectedIndex) {
    if (!singlePlaying) return;
    const ok = selectedIndex === currentQuestion.answer;
    const practice = currentMode === 'practice';

    if (ok) {
        playCorrectSound();
        correctCount++;
        if (!practice) {
            score += 5 * (1 + myCombo * 0.01); // 每 1 combo，每題多賺 1%
            myCombo++;
            myHp = Math.min(100, myHp + 15);
        }
    } else {
        playWrongSound();
        wrongCount++;
        recordWrongItem(currentQuestion.word, currentQuestion.meaning, currentQuestion.level, currentQuestion.options[selectedIndex]);
        if (!practice) { myCombo = 0; myHp = Math.max(0, myHp - 25); }
    }
    flashWord(ok);
    updateComboUI(); updateStatsUI();
    if (!practice) renderScoreboard();

    if (!practice && myHp <= 0) { handleGameOver(false); return; }
    loadNextQuestion();
}

function handleGameOver(unanswered) {
    if (!singlePlaying) return;
    singlePlaying = false;
    clearInterval(gameTimerInterval); clearInterval(secondCounterInterval);
    stopBGM();
    disableAllOptionButtons();

    if (unanswered && currentQuestion) {
        recordWrongItem(currentQuestion.word, currentQuestion.meaning, currentQuestion.level, '遊戲結束未作答/不確定');
    }

    const finalScore = Math.round(score * 10) / 10;
    const notes = [`⏱️ 生存 ${survivalSeconds} 秒`, `⭐ 分數 ${finalScore}`];
    if (survivalSeconds > bestSurvivalSeconds) {
        bestSurvivalSeconds = survivalSeconds;
        localStorage.setItem('vocab_best_survival', bestSurvivalSeconds);
        uploadRecord(dbRef, playerName, survivalSeconds);
        notes.push('🎉 刷新生存時間紀錄，已登上排行榜！');
    }
    if (finalScore > bestScore) {
        bestScore = finalScore;
        localStorage.setItem('vocab_best_score', bestScore);
        uploadRecord(scoreRef, playerName, finalScore);
        notes.push('🎉 刷新分數紀錄，已登上分數榜！');
    }
    updateBestTimeUI();
    renderWrongWordsReview(buildSummary('💀 遊戲結束', notes));
}

function finishPractice() {
    if (!singlePlaying) return;
    singlePlaying = false;
    disableAllOptionButtons();
    btnFinishPractice.style.display = 'none';
    renderWrongWordsReview(buildSummary('🏁 練習結算'));
}
btnFinishPractice.onclick = () => { playClickSound(); finishPractice(); };

function returnToLobby(menu) {
    stopBGM();
    clearInterval(gameTimerInterval); clearInterval(secondCounterInterval);
    singlePlaying = false;
    wrongWordsContainer.classList.add('hidden');
    showScreen('lobby');
    showMenu(menu || 'main');
    updateBestTimeUI();
}

function launchSingleGame() {
    if (playerNameInput.value.trim()) playerName = playerNameInput.value.trim();
    showScreen('battle');
    initVocabPool();
    startBattleGame();
}

// ==================== 7. 選單按鈕 ====================
$('btn-goto-single').onclick = () => { playClickSound(); showMenu('single'); };
$('btn-goto-multi').onclick = () => { playClickSound(); showMenu('multi'); };
$('btn-back-to-main').onclick = () => { playClickSound(); showMenu('main'); };
$('btn-back-from-multi').onclick = () => { playClickSound(); showMenu('main'); };
$('btn-goto-bank').onclick = () => { playClickSound(); showScreen('bank'); renderBank(); };
$('btn-start-ranked').onclick = () => { playClickSound(); currentMode = 'ranked'; launchSingleGame(); };
$('btn-start-practice').onclick = () => {
    playClickSound();
    $('practice-bank-count').textContent = wrongBank.length;
    showMenu('practice');
};
$('btn-practice-back').onclick = () => { playClickSound(); showMenu('single'); };
$('btn-practice-start').onclick = () => {
    playClickSound();
    const picks = [...document.querySelectorAll('#practice-setup-box input:checked')].map(i => i.value);
    if (!picks.length) { alert('請至少選擇一個題庫！'); return; }
    let pool = getVocabByLevels(picks.filter(p => p !== 'bank'));
    if (picks.includes('bank')) wrongBank.forEach(w => pool.push({ word: w.word, meaning: w.meaning, level: w.level }));
    const seen = new Set();
    pool = pool.filter(w => !seen.has(w.word) && seen.add(w.word));
    if (!pool.length) { alert('你選擇的題庫目前沒有單字（錯題庫可能還是空的）！'); return; }
    practicePool = pool;
    currentMode = 'practice';
    launchSingleGame();
};
$('btn-help').onclick = () => { playClickSound(); $('help-modal').classList.remove('hidden'); };
$('btn-help-close').onclick = () => { playClickSound(); $('help-modal').classList.add('hidden'); };
$('help-modal').addEventListener('click', e => { if (e.target.id === 'help-modal') e.target.classList.add('hidden'); });


// ==================== 8. 多人模式：房間 / 準備狀態 ====================
let currentRoomRef = null;
let isHost = false;
let isMultiplayerActive = false;
let lastSelfActionTime = 0;
let lastRoomStatus = 'waiting';
let currentRound = null, endedRoundHandled = null, endRequestedRound = null;
let multiSeed = 0, multiQIndex = 0; // 多人模式題目種子 / 題號
let multiMaxHp = 100;               // 多人模式血量上限 = (玩家數-1)*100

if (selectVocabLevel) {
    selectVocabLevel.addEventListener('change', () => {
        if (isHost && currentRoomRef) currentRoomRef.child('settings').update({ vocabLevel: selectVocabLevel.value });
    });
}

btnCreateRoom.addEventListener('click', () => {
    playClickSound();
    if (playerNameInput.value.trim()) playerName = playerNameInput.value.trim();
    isHost = true;
    initMultiplayerRoom(Math.floor(1000 + Math.random() * 9000).toString(), true);
});

btnJoinRoom.addEventListener('click', () => {
    playClickSound();
    const code = roomCodeInput.value.trim();
    if (code.length !== 4) { alert('請輸入正確的 4 碼房間代碼！'); return; }
    if (playerNameInput.value.trim()) playerName = playerNameInput.value.trim();
    isHost = false;
    initMultiplayerRoom(code, false);
});

function initMultiplayerRoom(roomCode, isCreating) {
    const key = mySafeKey();
    currentRoomRef = firebase.database().ref('rooms/' + roomCode);

    const onJoined = () => {
        currentRoomRef.child('players/' + key).onDisconnect().remove();
        resetRoundTracking();
        showScreen('room');
        displayRoomCode.textContent = `#${roomCode}`;
        listenRoomData();
    };

    if (isCreating) {
        currentRoomRef.set({
            host: playerName, status: 'waiting',
            players: { [key]: { name: playerName, isHost: true, hp: 100, isDead: false, ready: true } },
            settings: { vocabLevel: 'all' }
        }).then(onJoined).catch(() => alert("建立房間失敗，請檢查網路連線！"));
    } else {
        currentRoomRef.once('value', snap => {
            if (!snap.exists()) { alert('找不到該房間，請確認 4 碼代碼是否正確！'); return; }
            if (snap.val().status === 'playing') { alert('該房間遊戲進行中，請等這局結束再加入！'); return; }
            if (snap.child('players/' + key).exists()) { alert('房間內已有相同暱稱的玩家，請換一個暱稱再加入！'); return; }
            if (snap.child('players').numChildren() >= 6) { alert('房間已滿 (最多 6 人)！'); return; }
            currentRoomRef.child('players/' + key)
                .set({ name: playerName, isHost: false, hp: 100, isDead: false, ready: false })
                .then(onJoined).catch(() => alert("加入房間失敗，請重試！"));
        });
    }
}

function resetRoundTracking() {
    currentRound = null; endedRoundHandled = null; endRequestedRound = null;
    lastRoomStatus = 'waiting';
}

function renderRoomPlayers(room) {
    if (!playerListContainer) return;
    playerListContainer.innerHTML = '';
    Object.values(room.players || {}).forEach(p => {
        let tag;
        if (p.isHost) tag = '<span style="font-size: 12px; color: #d97706;">👑 房主</span>';
        else if (p.ready) tag = '<span style="font-size: 12px; color: #16a34a; font-weight: 700;">✅ 準備就緒</span>';
        else tag = '<span style="font-size: 12px; color: #f59e0b; font-weight: 700;">⏳ 稍等一下</span>';
        const item = document.createElement('div');
        item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #fff; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 6px;";
        item.innerHTML = `<span style="font-weight: 500; color: #1e293b;">${esc(p.name || '未知玩家')}${p.name === playerName ? ' (你)' : ''}</span>${tag}`;
        playerListContainer.appendChild(item);
    });
}

function updateRoomUIByRole(room) {
    if (hostSettingsPanel && selectVocabLevel) {
        selectVocabLevel.disabled = !isHost;
        hostSettingsPanel.style.opacity = isHost ? '1' : '0.8';
    }
    if (room.settings && room.settings.vocabLevel && selectVocabLevel) selectVocabLevel.value = room.settings.vocabLevel;

    const players = Object.values(room.players || {});
    const others = players.filter(p => !p.isHost);
    const readyN = others.filter(p => p.ready).length;
    const allReady = others.length > 0 && readyN === others.length;

    btnStartGame.style.display = isHost ? 'block' : 'none';
    btnStartGame.disabled = !allReady;
    btnStartGame.textContent = others.length === 0 ? '等待其他玩家加入...'
        : allReady ? '開始多人生存戰！' : `等待玩家準備 (${readyN}/${others.length})`;

    btnToggleReady.style.display = isHost ? 'none' : 'block';
    const me = (room.players || {})[mySafeKey()];
    const myReady = !!(me && me.ready);
    btnToggleReady.textContent = myReady ? '⏳ 稍等一下 (取消準備)' : '✅ 準備就緒';
    btnToggleReady.className = 'btn ' + (myReady ? 'btn-secondary' : 'btn-primary');
}

btnToggleReady.addEventListener('click', () => {
    playClickSound();
    if (!currentRoomRef) return;
    currentRoomRef.child('players/' + mySafeKey()).once('value', s => {
        const p = s.val();
        if (p) currentRoomRef.child('players/' + mySafeKey() + '/ready').set(!p.ready);
    });
});

btnStartGame.addEventListener('click', () => { playClickSound(); startMultiplayerRound(); });

btnLeaveRoom.addEventListener('click', () => {
    playClickSound();
    if (currentRoomRef) {
        currentRoomRef.child('players/' + mySafeKey()).remove();
        currentRoomRef.off();
        currentRoomRef = null;
    }
    resetLocalGameState();
    showScreen('lobby');
    showMenu('main');
});

function resetLocalGameState() {
    clearInterval(gameTimerInterval); clearInterval(secondCounterInterval);
    stopBGM();
    isMultiplayerActive = false;
    resetRoundTracking();
    myHp = 100; myCombo = 0; lastSelfActionTime = 0;
    scoreboardEl.innerHTML = '';
}

function startMultiplayerRound() {
    if (!currentRoomRef || !isHost) return;
    currentRoomRef.child('players').once('value', snap => {
        const players = snap.val() || {};
        const keys = Object.keys(players);
        if (keys.length < 2) { alert('至少需要 2 位玩家才能開始多人生存戰！'); return; }
        if (!keys.filter(k => !players[k].isHost).every(k => players[k].ready)) { alert('還有玩家尚未準備就緒！'); return; }

        const updates = {};
        keys.forEach(k => {
            updates[`players/${k}/hp`] = Math.max(1, keys.length - 1) * 100;
            updates[`players/${k}/isDead`] = false;
            updates[`players/${k}/ready`] = !!players[k].isHost;
        });
        updates['status'] = 'playing';
        updates['winner'] = null;
        updates['startCount'] = keys.length;
        updates['maxHp'] = Math.max(1, keys.length - 1) * 100;
        updates['round'] = Date.now();
        currentRoomRef.update(updates);
    });
}

// 每位玩家自行返回房間（不再由房主帶領）
function returnToRoom() {
    playClickSound();
    stopBGM();
    wrongWordsContainer.classList.add('hidden');
    showScreen('room');
    if (!currentRoomRef) return;
    const k = mySafeKey();
    const upd = {};
    upd[`players/${k}/ready`] = false;
    if (lastRoomStatus !== 'playing') { // 比賽已結束才重置血量，避免淘汰者中途復活
        upd[`players/${k}/hp`] = 100;
        upd[`players/${k}/isDead`] = false;
        myHp = 100;
        if (isHost) { upd['status'] = 'waiting'; upd['winner'] = null; }
    }
    currentRoomRef.update(upd);
}

// ==================== 9. 多人模式：戰鬥 ====================
function startMultiplayerGameSession(room) {
    clearInterval(gameTimerInterval); clearInterval(secondCounterInterval);
    currentMode = 'multi';
    singlePlaying = false;
    multiMaxHp = room.maxHp || Math.max(1, (room.startCount || 2) - 1) * 100;
    multiSeed = Number(room.round) || Date.now();
    multiQIndex = 0;
    myHp = multiMaxHp; myCombo = 0;    // ← 每局開始一律滿血
    correctCount = 0; wrongCount = 0;
    wrongQuestionsList = [];
    lastSelfActionTime = Date.now();

    configureBattleUI('multi');
    scoreboardEl.innerHTML = '';
    wrongWordsContainer.classList.add('hidden');
    updateComboUI();
    showScreen('battle');
    startBGM();

    initVocabPool();
    const lvl = (room.settings && room.settings.vocabLevel) || 'all';
    activePool = lvl === 'all' ? allVocabPool : getVocabByLevels([lvl]);
    if (activePool.length < 4) activePool = allVocabPool;
    distractPool = activePool;
    loadNextQuestion();
}

function syncMyHpToFirebase() {
    if (!currentRoomRef) return;
    myHp = Math.max(0, Math.min(multiMaxHp, Math.round(myHp)));
    currentRoomRef.child(`players/${mySafeKey()}`).update({ hp: myHp });
}

function renderMultiplayerScoreboard(playersObj) {
    scoreboardEl.innerHTML = '';
    const arr = Object.values(playersObj);
    arr.sort((a, b) => (a.name === playerName ? 1 : 0) - (b.name === playerName ? 1 : 0));

    arr.forEach(player => {
        const isMe = player.name === playerName;
        const displayHp = isMe ? myHp : (player.hp || 0);
        const isDead = player.isDead || displayHp <= 0;
        const pct = Math.max(0, Math.min(100, displayHp / multiMaxHp * 100));
        const low = pct <= 30;

        const item = document.createElement('div');
        if (isMe) {
            item.id = 'my-multiplayer-row';
            item.style.cssText = `background: #eff6ff; border: 2px solid #3b82f6; padding: 10px 14px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; opacity: ${isDead ? '0.6' : '1'};`;
        } else {
            item.className = 'battle-player-row';
            item.style.cssText = `background: #ffffff; padding: 10px 14px; border-radius: 12px; border: 1px solid ${isDead ? '#fca5a5' : '#cbd5e1'}; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; opacity: ${isDead ? '0.6' : '1'};`;
        }
        item.innerHTML = `
            <span class="player-name-tag" style="font-weight: 600; font-size: 14px; min-width: 70px; color: ${isMe ? '#1d4ed8' : '#334155'};">${esc(player.name)} ${isMe ? '(你)' : ''}</span>
            <div class="hp-bar-outer" style="flex: 1; height: 10px; background: #e2e8f0; border-radius: 5px; margin: 0 12px; overflow: hidden;">
                <div class="hp-bar-inner ${low ? 'low' : ''}" style="height: 100%; width: ${pct}%; background: ${low ? '#ef4444' : '#22c55e'}; border-radius: 5px; transition: width 0.3s ease;"></div>
            </div>
            <span class="status-badge" style="font-size: 13px; font-weight: 700; color: ${isDead ? '#dc2626' : '#64748b'}; min-width: 60px; text-align: right;">${isDead ? '💀 淘汰' : `HP: ${displayHp}`}</span>`;
        scoreboardEl.appendChild(item);
    });
}

function handlePlayerElimination() {
    if (!isMultiplayerActive) return;
    isMultiplayerActive = false;
    myHp = 0;
    stopBGM();
    if (currentRoomRef) currentRoomRef.child(`players/${mySafeKey()}`).update({ hp: 0, isDead: true });

    currentWordEl.textContent = "💀 你已被淘汰！";
    optionsContainerEl.innerHTML = `<div style="text-align: center; padding: 15px 0;">
        <p style="color: #dc2626; font-size: 18px; font-weight: bold; margin-bottom: 6px;">你已被淘汰，進入觀戰模式</p>
        <p style="color: #64748b; font-size: 14px;">可先檢討錯題，並將不熟的單字加入錯題庫</p></div>`;
    renderWrongWordsReview(buildSummary('💀 你已被淘汰'));
}

function declareWinnerIfNeeded(room) {
    if (!currentRoomRef || (room.startCount || 0) < 2 || endRequestedRound === room.round) return;
    const alive = Object.values(room.players || {}).filter(p => !p.isDead && p.hp > 0);
    if (alive.length > 1) return;
    endRequestedRound = room.round;
    currentRoomRef.update({ status: 'ended', winner: alive.length === 1 ? alive[0].name : '' });
}

function showMultiplayerResult(winnerName) {
    clearInterval(gameTimerInterval); clearInterval(secondCounterInterval);
    stopBGM();
    isMultiplayerActive = false;
    const iAmWinner = !!winnerName && winnerName === playerName;

    currentWordEl.textContent = iAmWinner ? '🏆 恭喜你獲得最後勝利！'
        : (winnerName ? `🏁 遊戲結束！勝利者：${winnerName}` : '🏁 遊戲結束！本局平手');
    optionsContainerEl.innerHTML = `<div style="text-align: center; padding: 15px 0;">
        <p style="color: ${iAmWinner ? '#16a34a' : '#64748b'}; font-size: 18px; font-weight: bold;">
        ${iAmWinner ? '🎉 你是最後的生存者，獲得 MVP！' : '比賽已結束，下次再接再厲！'}</p></div>`;
    renderWrongWordsReview(buildSummary(iAmWinner ? '🏆 勝利！' : '🏁 本局結束'));
}

function handleMultiplayerAnswer(selectedIndex) {
    if (myHp <= 0 || !isMultiplayerActive) return;
    const isCorrect = selectedIndex === currentQuestion.answer;
    lastSelfActionTime = Date.now();

    if (isCorrect) {
        playCorrectSound();
        correctCount++;
        myCombo++;
        const mult = 1 + myCombo * 0.01;
        const healAmount = Math.round(10 * mult);
        const damageAmount = Math.round(15 * mult);
        myHp = Math.min(multiMaxHp, Math.max(0, myHp) + healAmount);

        if (currentRoomRef) {
            const me = mySafeKey();
            currentRoomRef.child('players').transaction(players => {
                if (players) {
                    Object.keys(players).forEach(key => {
                        if (key !== me && players[key].hp > 0 && !players[key].isDead) {
                            const n = Math.max(0, players[key].hp - damageAmount);
                            players[key].hp = n;
                            if (n <= 0) players[key].isDead = true;
                        }
                    });
                }
                return players;
            });
        }
    } else {
        playWrongSound();
        wrongCount++;
        myCombo = 0;
        recordWrongItem(currentQuestion.word, currentQuestion.meaning, currentQuestion.level, currentQuestion.options[selectedIndex]);
        myHp = Math.max(0, myHp - 5);
        triggerDamageEffect(5);
    }

    updateComboUI();
    syncMyHpToFirebase();
    if (myHp <= 0) handlePlayerElimination();
    else loadNextQuestion();
}

function listenRoomData() {
    if (!currentRoomRef) return;
    currentRoomRef.on('value', snap => {
        const room = snap.val();
        if (!room) return;
        lastRoomStatus = room.status;

        // 新的一局：優先處理，先把自己設為滿血再畫記分板
        if (room.status === 'playing' && room.round && room.round !== currentRound) {
            currentRound = room.round;
            endedRoundHandled = null;
            isMultiplayerActive = true;
            startMultiplayerGameSession(room);
            if (room.players) renderMultiplayerScoreboard(room.players);
            return;
        }

        renderRoomPlayers(room);
        updateRoomUIByRole(room);

        if (room.players) {
            const meData = room.players[mySafeKey()];
            if (meData && typeof meData.hp === 'number' && isMultiplayerActive && room.round === currentRound) {
                // 超過 1.2 秒沒操作時，血量下降代表被對手攻擊
                if (Date.now() - lastSelfActionTime > 1200 && meData.hp < myHp) {
                    const diff = myHp - meData.hp;
                    myHp = meData.hp;
                    renderMultiplayerScoreboard(room.players);
                    triggerDamageEffect(diff);
                }
                if (myHp <= 0) handlePlayerElimination();
            }
            if (!battleScreenHidden()) renderMultiplayerScoreboard(room.players);
        }

        if (room.status === 'playing' && room.round === currentRound) declareWinnerIfNeeded(room);

        if (room.status === 'ended' && room.round === currentRound && endedRoundHandled !== room.round) {
            endedRoundHandled = room.round;
            showMultiplayerResult(room.winner);
        }
    });
}
function battleScreenHidden() { return screens.battle.classList.contains('hidden'); }

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