// ==================== 英語單字King app.js (v5) ====================
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeKey = n => String(n).replace(/[.#$\[\]\/]/g, '_');
const mySafeKey = () => safeKey(playerName);
const ALL_LEVELS = ['level1', 'level2', 'level3', 'level4', 'level5', 'level6'];
const LEVEL_LABEL = { level1: '1級', level2: '2級', level3: '3級', level4: '4級', level5: '5級', level6: '6級' };
const MANUAL_MARK = '手動標記不熟';

// ---------- 狀態 ----------
// 讀取設定LocalStorage
let gameSettings = JSON.parse(localStorage.getItem('vocab_game_settings')) || {
    speech: true,
    sound: true,
    volume: 1.0,
    sfxVolume: 1.0, // 遊戲音效音量
    music: true,     // 背景音樂開關（和「遊戲音效」分開）
    bgmVolume: 0.6,  // 背景音樂音量
    bgmTrack: 1,     // 背景音樂曲目：1~N = bgm1.mp3 ~ bgmN.mp3
    voiceURI: '', // 空字串 = 自動使用 David（找不到則用英文預設聲線）
    darkMode: false // 預設關閉深色模式
};

// 舊版設定沒有「背景音樂」欄位：沿用原本的音效開關當作預設
if (typeof gameSettings.music !== 'boolean') gameSettings.music = gameSettings.sound !== false;
if (typeof gameSettings.bgmVolume !== 'number') gameSettings.bgmVolume = 0.6;
if (typeof gameSettings.bgmTrack !== 'number' || gameSettings.bgmTrack < 1) gameSettings.bgmTrack = 1;

function saveGameSettings() {
    localStorage.setItem('vocab_game_settings', JSON.stringify(gameSettings));
}
// 👈 加上這段切換深色模式的函式
function applyDarkMode(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
}
let playerName = "請輸入暱稱";
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
const lbData = { time: [], score: [], mj: [] };
let sessionRecorded = false, sessionStart = 0, sessionMaxCombo = 0; // 個人檔案紀錄用
let scoreboardFrozen = false, lastPlayersSnapshot = null;           // 多人結算後凍結計分板
const hasProfile = () => typeof Profile !== 'undefined';
function setPlayerName(n) {
    playerName = n;
    if (typeof playerNameInput !== 'undefined' && playerNameInput) {
        playerNameInput.value = n;
    }
}
function recordSession(mode, won = false) {
    if (sessionRecorded) return;
    sessionRecorded = true;
    if (!hasProfile()) return;
    Profile.endSession({
        mode, correct: correctCount, wrong: wrongCount, won,
        score: Math.round(score * 10) / 10,
        secs: mode === 'ranked' ? survivalSeconds : Math.round((Date.now() - sessionStart) / 1000),
        maxCombo: sessionMaxCombo
    });
}

// ---------- DOM ----------
const screens = { lobby: $('lobby-screen'), room: $('room-screen'), battle: $('battle-screen'), bank: $('bank-screen'), profile: $('profile-screen'), friends: $('friends-screen'), word: $('word-screen') };
function showScreen(n) { Object.entries(screens).forEach(([k, el]) => el && el.classList.toggle('hidden', k !== n)); if (typeof initCollapsibles === 'function') initCollapsibles(); }

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
    const lb = $('global-leaderboard-card'), ft = $('lobby-footer');
    if (lb) lb.style.display = n === 'main' ? '' : 'none';
    if (ft) ft.style.display = n === 'main' ? '' : 'none';
}

// 安全防護：避免大廳輸入框刪除後其他程式碼讀取 .value 報錯
const roomCodeInput = $('room-code-input');
const playerNameInput = {
    get value() { return (typeof Profile !== 'undefined' && Profile.getName()) ? Profile.getName() : playerName; },
    set value(v) { playerName = v; }
};
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

let masterGain = null;
// 所有遊戲音效都經過這個總音量節點（設定中的「音效音量」）；背景音樂另外走 bgmOut()
function sfxOut() {
    initAudio();
    if (!masterGain) { masterGain = audioCtx.createGain(); masterGain.connect(audioCtx.destination); }
    masterGain.gain.value = typeof gameSettings.sfxVolume === 'number' ? gameSettings.sfxVolume : 1;
    return masterGain;
}
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}
// 英文單字語音朗讀函式
let availableVoices = [];

// 決定要用的聲線：使用者選的 → David → 其他美式英文 → 系統預設
function resolveVoice() {
    if (!availableVoices.length && 'speechSynthesis' in window) availableVoices = window.speechSynthesis.getVoices();
    let v = gameSettings.voiceURI && availableVoices.find(x => x.voiceURI === gameSettings.voiceURI);
    if (!v) v = availableVoices.find(x => /david/i.test(x.name) && x.lang.toLowerCase().startsWith('en'));
    if (!v) v = availableVoices.find(x => x.lang === 'en-US') || null;
    return v;
}

function speakWord(word) {
    if (!gameSettings.speech) return;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.volume = typeof gameSettings.volume === 'number' ? gameSettings.volume : 1.0;
        const voice = resolveVoice();
        if (voice) utterance.voice = voice;
        window.speechSynthesis.speak(utterance);
    }
}

function populateVoiceList() {
    if (!('speechSynthesis' in window)) return;
    availableVoices = window.speechSynthesis.getVoices();
    const voiceSelect = $('setting-speech-voice');
    if (!voiceSelect) return;

    voiceSelect.innerHTML = '<option value="">預設 </option>';
    availableVoices.forEach(voice => {
        if (!voice.lang.toLowerCase().startsWith('en')) return;
        const opt = document.createElement('option');
        opt.value = voice.voiceURI;
        const cleanName = voice.name
            .replace(/ - English \(United States\)/gi, ' (美)')
            .replace(/ - English \(United Kingdom\)/gi, ' (英)')
            .replace(/English \(United States\)/gi, '美式')
            .replace(/English \(United Kingdom\)/gi, '英式');
        const n = voice.name.toLowerCase();
        let prefix = '◎ ';
        if (/female|zira|aria|jenny|susan|catherine|hazel/.test(n)) prefix = '女: ';
        else if (/male|david|mark|george/.test(n)) prefix = '男: ';
        opt.textContent = prefix + cleanName;
        voiceSelect.appendChild(opt);
    });

    // 已存的聲線若已不存在（例如舊版存的 'Microsoft David'），視為未設定
    if (gameSettings.voiceURI && !availableVoices.some(v => v.voiceURI === gameSettings.voiceURI)) {
        gameSettings.voiceURI = '';
        saveGameSettings();
    }
    const cur = resolveVoice();
    voiceSelect.value = gameSettings.voiceURI || (cur ? cur.voiceURI : '');
}

if ('speechSynthesis' in window) {
    populateVoiceList();
    window.speechSynthesis.onvoiceschanged = populateVoiceList;
}
// 答對音效
function playCorrectSound() {
    if (!gameSettings.sound) return;
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
        gain.connect(sfxOut());

        osc.start(now);
        osc.stop(now + 0.3);
    } catch (e) { }
}

// 答錯音效
function playWrongSound() {
    if (!gameSettings.sound) return;
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
        gain.connect(sfxOut());

        osc.start(now);
        osc.stop(now + 0.25);
    } catch (e) { }
}

// 按鈕點擊音效
function playClickSound() {
    if (!gameSettings.sound) return;
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
        gain.connect(sfxOut());

        osc.start(now);
        osc.stop(now + 0.05);
    } catch (e) { }
}

// ==================== 背景音樂（全域：所有畫面都會播放）====================
// 曲目檔案：bgm1.mp3、bgm2.mp3、bgm3.mp3 …（放在和 index.html 同一個資料夾）。
// 要加更多首：把 bgmN.mp3 放進資料夾，並把下面的 BGM_MAX 改成最大編號即可。
// 找不到的檔案不會出現在選單；一首都沒有時就不播放背景音樂。
// 瀏覽器規定要「使用者第一次點擊 / 觸碰」之後才能出聲，所以會在第一次操作時自動開始播放。
const BGM_MAX = 3;
const bgmAvail = {}; // { 1: true/false }
let bgmWanted = false;   // 已經有過使用者操作（可以播放了）
let bgmPreview = false;  // 設定視窗開著時，即使還沒開始也試聽
let bgmEl = null, bgmGain = null, bgmPlaying = null; // bgmPlaying：目前播放的曲目編號
const bgmVol = () => typeof gameSettings.bgmVolume === 'number' ? gameSettings.bgmVolume : 0.6;
function bgmOut() { // 背景音樂專用的音量節點（和音效音量分開）
    initAudio();
    if (!bgmGain) { bgmGain = audioCtx.createGain(); bgmGain.connect(audioCtx.destination); }
    bgmGain.gain.value = bgmVol();
    return bgmGain;
}
function setBgmVolume() {
    if (bgmGain) bgmGain.gain.value = bgmVol();
    if (bgmEl && bgmEl._direct) bgmEl.volume = Math.min(1, bgmVol());
}
function probeBGM() { // 檢查哪些 bgmN.mp3 真的存在
    for (let n = 1; n <= BGM_MAX; n++) {
        const t = new Audio(); t.preload = 'metadata';
        t.onloadedmetadata = () => { bgmAvail[n] = true; if (typeof refreshBgmSelect === 'function') refreshBgmSelect(); applyBGM(); };
        t.onerror = () => { bgmAvail[n] = false; if (typeof refreshBgmSelect === 'function') refreshBgmSelect(); applyBGM(); };
        t.src = `bgm${n}.mp3`;
    }
}
function haltBGM() { if (bgmEl) { try { bgmEl.pause(); } catch (e) { } } bgmPlaying = null; }
function pickBGMTrack() { // 選到的那首；不存在就改播第一首找得到的；都沒有則 null
    const want = gameSettings.bgmTrack;
    if (want >= 1 && want <= BGM_MAX && bgmAvail[want] !== false) return want;
    for (let n = 1; n <= BGM_MAX; n++) if (bgmAvail[n]) return n;
    return null;
}
function playBGMFile(t) {
    initAudio();
    const out = bgmOut();
    if (!bgmEl) {
        bgmEl = new Audio(); bgmEl.loop = true; bgmEl.preload = 'auto';
        // 走 Web Audio 才能在 iPhone 上調整音量；不支援時退回直接設定 audio.volume
        try { audioCtx.createMediaElementSource(bgmEl).connect(out); } catch (e) { bgmEl._direct = true; bgmEl.volume = Math.min(1, bgmVol()); }
    }
    bgmEl.onerror = () => { bgmAvail[t] = false; if (typeof refreshBgmSelect === 'function') refreshBgmSelect(); if (bgmPlaying === t) { bgmPlaying = null; applyBGM(); } };
    bgmEl.src = `bgm${t}.mp3`;
    bgmPlaying = t;
    const p = bgmEl.play(); if (p && p.catch) p.catch(() => { }); // 還沒有使用者操作時會被瀏覽器擋下，之後第一次操作會再試
}
function applyBGM() { // 依目前的設定與狀態，決定要播哪一首（或停止）
    if (!gameSettings.music || !(bgmWanted || bgmPreview) || document.hidden) return haltBGM();
    const t = pickBGMTrack();
    if (t == null) return haltBGM();
    if (bgmPlaying === t && bgmEl) { if (bgmEl.paused) { const p = bgmEl.play(); if (p && p.catch) p.catch(() => { }); } return; }
    haltBGM(); playBGMFile(t);
}
function startBGM() { bgmWanted = true; applyBGM(); }
function stopBGM() { /* 背景音樂是全域的：答題 / 遊戲結束都不再停止，想關閉請到設定 */ }
document.addEventListener('visibilitychange', applyBGM); // 切到別的分頁 / App 時暫停，回來繼續
['pointerdown', 'keydown', 'touchend'].forEach(ev => window.addEventListener(ev, startBGM, { once: true, capture: true })); // 第一次操作後開始播放
probeBGM();
// ==================== 1. Firebase 與單字庫 ====================
const firebaseConfig = {
    databaseURL: "https://vocab-battle-game-default-rtdb.asia-southeast1.firebasedatabase.app/"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const dbRef = firebase.database().ref('leaderboard');            // 生存秒數榜
const scoreRef = firebase.database().ref('leaderboard_score');   // 分數榜
const mjRef = firebase.database().ref('leaderboard_mj');         // 麻將台數榜（單局最高台數）

// 💡 新增：自動監聽分頁切換，切到背景時中斷 Firebase 連線，切回時重新連線
function manageFirebaseVisibility() {
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            // 玩家切換到別的分頁或最小化，主動斷開資料庫連線
            firebase.database().goOffline();
        } else {
            // 玩家切回遊戲分頁，自動恢復連線
            firebase.database().goOnline();
        }
    });
}

function getVocabByLevels(levels) {
    const src = {
        level1: typeof level1Vocab !== 'undefined' ? level1Vocab : [],
        level2: typeof level2Vocab !== 'undefined' ? level2Vocab : [],
        level3: typeof level3Vocab !== 'undefined' ? level3Vocab : [],
        level4: typeof level4Vocab !== 'undefined' ? level4Vocab : [],
        level5: typeof level5Vocab !== 'undefined' ? level5Vocab : [],
        level6: typeof level6Vocab !== 'undefined' ? level6Vocab : []
    };
    // 依 1→6 順序去重：同一個字只算在最低的級別，並略過空白字
    const seen = new Set(), byLevel = {};
    ALL_LEVELS.forEach(l => {
        byLevel[l] = [];
        (Array.isArray(src[l]) ? src[l] : []).forEach(v => {
            const k = String(v.word || '').trim().toLowerCase();
            if (!k || seen.has(k)) return;
            seen.add(k);
            byLevel[l].push({ word: v.word, meaning: v.meaning, level: l, pos: v.pos || '' });
        });
    });
    let out = [];
    levels.forEach(l => { if (byLevel[l]) out = out.concat(byLevel[l]); });
    return out;
}
// 單字查詢表（詞性 / 中文意思），第一次用到才建立
let _vocabMap = null;
function vocabLookup(word) {
    if (!_vocabMap) {
        _vocabMap = new Map();
        getVocabByLevels(ALL_LEVELS).forEach(v => _vocabMap.set(String(v.word).trim().toLowerCase(), v));
    }
    return _vocabMap.get(String(word || '').trim().toLowerCase()) || null;
}

function initVocabPool() {
    allVocabPool = getVocabByLevels(ALL_LEVELS);
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

// ==================== 1-1. 可收合區塊（記住展開 / 收合狀態）====================
const collapseState = (() => { try { return JSON.parse(localStorage.getItem('vocab_collapse_v1')) || {}; } catch (e) { return {}; } })();
function isOpen(h) {
    const v = collapseState[h.dataset.collapse];
    return v === undefined ? h.dataset.cdefault !== 'closed' : v !== false;
}
function applyCollapse(h) {
    const body = h.nextElementSibling; if (!body) return;
    const open = isOpen(h); // 預設展開（data-cdefault="closed" 的區塊預設收合）
    h.classList.add('collapsible'); h.classList.toggle('closed', !open);
    h.setAttribute('role', 'button'); h.setAttribute('aria-expanded', String(open));
    body.classList.toggle('c-hidden', !open);
    body.style.display = open ? '' : 'none'; // 直接設定 display，不依賴 CSS
}
function initCollapsibles() { document.querySelectorAll('[data-collapse]').forEach(applyCollapse); }
document.addEventListener('click', e => {
    const h = e.target.closest && e.target.closest('[data-collapse]'); if (!h) return;
    playClickSound();
    const k = h.dataset.collapse;
    collapseState[k] = !isOpen(h); // 展開 ↔ 收合，並記住玩家的選擇
    try { localStorage.setItem('vocab_collapse_v1', JSON.stringify(collapseState)); } catch (err) { }
    applyCollapse(h);
});
window.addEventListener('DOMContentLoaded', initCollapsibles);

// ==================== 1-2. 單字詞性查詢 ====================
// 1~3 級題庫本身有詞性；4~6 級沒有，所以詞性改用 Datamuse（免費、免金鑰）線上查詢，結果存在 localStorage，查過的字下次不用再連線。
const WordInfo = (() => {
    const KEY = 'vocab_wordinfo_v1', POS = { n: 'n.', v: 'v.', adj: 'adj.', adv: 'adv.' };
    const SKIP = new Set('the a an and or but it its he she they we you i that this these those was is are be been were has have had will would can could not my your his her our their as to of'.split(' '));
    let cache = {}; try { cache = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { }
    const save = () => {
        const ks = Object.keys(cache);
        if (ks.length > 700) ks.slice(0, ks.length - 700).forEach(k => delete cache[k]);
        try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { }
    };
    const get = (q) => fetch('https://api.datamuse.com/words?' + q).then(r => r.ok ? r.json() : null).catch(() => null);
    const enc = encodeURIComponent;
    const clean = w => /^[a-z][a-z' -]*$/i.test(w);
    async function pos(word) {
        const c = cache[word]; if (c && c.pos) return c.pos;
        const r = await get(`sp=${enc(word)}&md=p&max=1`);
        if (!r) return null;
        const hit = r.find(x => x.word.toLowerCase() === word.toLowerCase());
        const p = hit && hit.tags ? [...new Set(hit.tags.map(t => POS[t]).filter(Boolean))] : [];
        cache[word] = { ...(cache[word] || {}), pos: p }; save();
        return p;
    }
    let q = 0;
    async function fillPos(words, onEach) {
        const id = ++q;
        for (const w of words) {
            if (id !== q) return;
            const p = await pos(w);
            if (id !== q) return;
            if (p && p.length) onEach(w, p.join('/'));
            await new Promise(r => setTimeout(r, 120));
        }
    }
    return { pos, fillPos, cached: w => cache[w] || null };
})();
// 錯題庫單字的詞性字串：存檔值 → 題庫(1~3級) → 線上查詢快取
function posOf(w) {
    if (w.pos) return w.pos;
    const v = vocabLookup(w.word); if (v && v.pos) return v.pos;
    const c = WordInfo.cached(w.word); return c && c.pos && c.pos.length ? c.pos.join('/') : '';
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
    const v = vocabLookup(item.word);
    wrongBank.push({ word: item.word, meaning: item.correctMeaning, level: item.level || 'level4', pos: (v && v.pos) || '', addedAt: Date.now() });
    saveBank();
    if (hasProfile()) Profile.bankAdded();
    return true;
}
// 記錄「錯題庫內單字」在任何模式被作答的結果（供單字詳情的複習時間 / 記憶曲線使用）
function recordBankReview(word, ok) {
    const w = wrongBank.find(x => x.word === word);
    if (!w) return;
    if (!Array.isArray(w.reviews)) w.reviews = [];
    w.reviews.push({ t: Date.now(), ok: !!ok });
    if (w.reviews.length > 60) w.reviews = w.reviews.slice(-60);
    saveBank();
}
// 在檢討畫面「向左滑取消」：不算作「我會了」，也扣回加入次數
function cancelAdd(word) {
    if (!isInBank(word)) return false;
    wrongBank = wrongBank.filter(w => w.word !== word); saveBank();
    if (hasProfile() && Profile.bankUndo) Profile.bankUndo();
    return true;
}
function removeFromBank(word) { wrongBank = wrongBank.filter(w => w.word !== word); saveBank(); if (hasProfile()) Profile.bankRemoved(); }

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
    else if (bankSort === 'mem-asc' || bankSort === 'mem-desc') {
        const m = new Map(items.map(w => [w, memoryModel(w).retNow]));
        const dir = bankSort === 'mem-asc' ? 1 : -1;
        items.sort((x, y) => dir * (m.get(x) - m.get(y)) || x.word.localeCompare(y.word));
    }
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
        const ret = Math.round(memoryModel(w).retNow * 100);
        const retCls = ret >= 70 ? 'ok' : ret >= 40 ? 'mid' : 'low';
        html += `<div class="bank-row">
            <div class="bank-info" data-word="${esc(w.word)}" title="點擊查看單字詳情與記憶曲線"><div class="bank-word">${esc(w.word)}<span class="lv-badge">${esc(LEVEL_LABEL[w.level] || '')}</span>
            <span class="ret-badge ${retCls}" title="估算的目前記憶保留率">🧠 ${ret}%</span>
            ${(() => { const p = posOf(w); return `<span class="pos-badge" data-posw="${esc(w.word)}">${esc(p)}</span>`; })()}
            </div>
            <div class="bank-meaning">${esc(w.meaning)}</div></div>
            <button class="bank-remove" data-word="${esc(w.word)}">✓ 我會了</button></div>`;
    });
    listEl.innerHTML = html;
    // 4~6 級沒有內建詞性：背景補查（一次最多 60 個），查到會順便存進錯題庫
    const missing = items.filter(w => !posOf(w)).slice(0, 60).map(w => w.word);
    if (missing.length) WordInfo.fillPos(missing, (word, p) => {
        const b = wrongBank.find(x => x.word === word); if (b) { b.pos = p; saveBank(); }
        listEl.querySelectorAll('[data-posw]').forEach(el => { if (el.dataset.posw === word) el.textContent = p; });
    });
}

$('bank-list').addEventListener('click', e => {

    const info = e.target.closest('.bank-info');
    if (info && !e.target.closest('.bank-remove')) {
        playClickSound();
        openWordDetail(info.dataset.word);
        return;
    }

    const b = e.target.closest('.bank-remove');
    if (!b) return;
    playClickSound();
    removeFromBank(b.dataset.word);
    renderBank();
});

// ==================== 2-1. 單字詳情 / 記憶曲線 ====================
// 記憶模型（艾賓浩斯式估算）：保留率 R = e^(-經過時間 / 穩定度 S)
//  - 加入錯題庫時 S = 2 天；每次「間隔夠久」的答對，S × 2.2；答錯 S × 0.6（最少 0.5 天）
//  - 10 分鐘內連續重複的答對只算複習紀錄，不增加穩定度（避免短時間刷題把記憶高估）
//  - 保留率降到 70% 以下就建議複習
const MEM_DAY = 86400000, MEM_S0 = 2, MEM_GROW = 2.2, MEM_SHRINK = 0.6, MEM_MIN_GAP = 10 * 60000, MEM_THRESHOLD = 0.7;
function memoryModel(w, now = Date.now()) {
    const start = w.addedAt || now;
    const events = (w.reviews || []).filter(r => r.t >= start).sort((a, b) => a.t - b.t);
    // nodes: 每個節點 = 一次「看到單字」的時間點，從此刻起以該 S 衰減
    const nodes = [{ t: start, S: MEM_S0, kind: 'add' }];
    events.forEach(r => {
        const prev = nodes[nodes.length - 1];
        let S = prev.S;
        if (r.ok) { if (r.t - prev.t >= MEM_MIN_GAP) S = S * MEM_GROW; }
        else S = Math.max(0.5, S * MEM_SHRINK);
        nodes.push({ t: r.t, S, kind: r.ok ? 'ok' : 'bad' });
    });
    const last = nodes[nodes.length - 1];
    const retAt = t => Math.exp(-Math.max(0, t - last.t) / MEM_DAY / last.S);
    const nextT = last.t + Math.round(-Math.log(MEM_THRESHOLD) * last.S * MEM_DAY);
    return { nodes, last, retNow: retAt(now), retAt, nextT, events };
}

const fmtDateTime = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function fmtSpan(ms) {
    ms = Math.abs(ms);
    if (ms < 60000) return '不到 1 分鐘';
    if (ms < 3600000) return Math.round(ms / 60000) + ' 分鐘';
    if (ms < MEM_DAY) return Math.round(ms / 3600000 * 10) / 10 + ' 小時';
    return Math.round(ms / MEM_DAY * 10) / 10 + ' 天';
}

function memoryChart(w) {
    const now = Date.now(), m = memoryModel(w, now);
    const t0 = m.nodes[0].t;
    const tEnd = Math.max(now, m.last.t) + Math.max(2 * MEM_DAY, m.last.S * MEM_DAY * 1.2);
    const span = tEnd - t0;
    const W = 320, H = 170, L = 34, R = 10, T = 14, B = 26;
    const x = t => L + (W - L - R) * ((t - t0) / span);
    const y = v => T + (H - T - B) * (1 - v);
    // 每個節點到下一個節點（或終點）之間，取樣畫出衰減線
    const past = [], future = [];
    m.nodes.forEach((n, i) => {
        const segEnd = i < m.nodes.length - 1 ? m.nodes[i + 1].t : tEnd;
        const steps = 40;
        for (let k = 0; k <= steps; k++) {
            const t = n.t + (segEnd - n.t) * k / steps;
            const r = Math.exp(-(t - n.t) / MEM_DAY / n.S);
            const pt = `${x(t).toFixed(1)},${y(r).toFixed(1)}`;
            if (t <= now) past.push(pt);
            if (t >= now) {
                if (t > now && !future.length) future.push(`${x(now).toFixed(1)},${y(m.retAt(now)).toFixed(1)}`);
                future.push(pt);
            }
        }
        // 讓節點之間的鋸齒垂直拉回 100%（上一段結尾 → 下一段起點）
        if (i < m.nodes.length - 1) past.push(`${x(segEnd).toFixed(1)},${y(1).toFixed(1)}`);
    });
    if (!future.length) future.push(`${x(now).toFixed(1)},${y(m.retAt(now)).toFixed(1)}`, `${x(tEnd).toFixed(1)},${y(m.retAt(tEnd)).toFixed(1)}`);

    const grid = [0, 0.5, 1].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)" stroke-dasharray="3 3"/>
        <text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${Math.round(v * 100)}%</text>`).join('');
    const th = `<line x1="${L}" x2="${W - R}" y1="${y(MEM_THRESHOLD)}" y2="${y(MEM_THRESHOLD)}" stroke="var(--warn)" stroke-dasharray="5 3" opacity="0.9"/>
        <text x="${W - R}" y="${y(MEM_THRESHOLD) - 3}" text-anchor="end" font-size="9" fill="var(--warn)">70% 建議複習線</text>`;
    const dots = m.nodes.map(n => {
        const col = n.kind === 'add' ? 'var(--warn)' : n.kind === 'ok' ? 'var(--ok)' : 'var(--bad)';
        const label = n.kind === 'add' ? '加入錯題庫' : n.kind === 'ok' ? '答對' : '答錯';
        return `<circle cx="${x(n.t).toFixed(1)}" cy="${y(1)}" r="4" fill="${col}" stroke="var(--card)" stroke-width="1.5"><title>${label}・${fmtDateTime(n.t)}</title></circle>`;
    }).join('');
    const nowX = x(now);
    const nowLine = `<line x1="${nowX}" x2="${nowX}" y1="${T}" y2="${H - B}" stroke="var(--accent)" stroke-dasharray="2 3"/>
        <circle cx="${nowX}" cy="${y(m.retNow)}" r="4" fill="var(--accent)" stroke="var(--card)" stroke-width="1.5"/>
        <text x="${Math.min(nowX, W - R - 14)}" y="${H - B + 12}" text-anchor="middle" font-size="10" fill="var(--accent-text)">現在</text>`;
    const nextMark = m.nextT > now && m.nextT < tEnd
        ? `<line x1="${x(m.nextT)}" x2="${x(m.nextT)}" y1="${y(MEM_THRESHOLD)}" y2="${H - B}" stroke="var(--warn)" stroke-dasharray="2 3"/>
           <text x="${Math.min(x(m.nextT), W - R - 22)}" y="${H - B + 22}" text-anchor="middle" font-size="9" fill="var(--warn)">建議複習</text>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="記憶曲線">${grid}${th}
        <polyline points="${past.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round"/>
        <polyline points="${future.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5 4" opacity="0.7"/>
        ${nextMark}${nowLine}${dots}
        <text x="${L}" y="${H - B + 12}" font-size="10" fill="var(--muted)">${fmtDateTime(t0)}</text></svg>
        <div class="chart-legend"><span><i style="background:var(--warn)"></i>加入</span><span><i style="background:var(--ok)"></i>答對</span><span><i style="background:var(--bad)"></i>答錯</span></div>`;
}

let currentDetailWord = null;
function openWordDetail(word) {
    const w = wrongBank.find(x => x.word === word);
    if (!w) return;
    currentDetailWord = word;
    renderWordDetail();
    showScreen('word');
}
function renderWordDetail() {
    const w = wrongBank.find(x => x.word === currentDetailWord);
    if (!w) { showScreen('bank'); renderBank(); return; }
    const now = Date.now(), m = memoryModel(w, now);
    const okN = m.events.filter(r => r.ok).length, badN = m.events.length - okN;
    const ret = Math.round(m.retNow * 100);

    $('wd-word').textContent = w.word;
    $('wd-meaning').textContent = w.meaning || '';
    $('wd-level').textContent = LEVEL_LABEL[w.level] || '';
    $('wd-pos').textContent = posOf(w);
    $('wd-stats').innerHTML = [
        ['目前保留率', ret + '%'], ['答對次數', okN], ['答錯次數', badN],
        ['記憶穩定度', (Math.round(m.last.S * 10) / 10) + ' 天'], ['加入時間', fmtDateTime(w.addedAt || now)], ['最近複習', m.events.length ? fmtDateTime(m.events[m.events.length - 1].t) : '尚未複習']
    ].map(([k, v]) => `<div class="stat-card"><b style="font-size:${String(v).length > 7 ? 14 : 18}px">${esc(v)}</b><span>${k}</span></div>`).join('');

    const due = m.nextT <= now;
    $('wd-next').className = 'wd-next ' + (due ? 'due' : 'ok');
    $('wd-next').innerHTML = due
        ? `⚠️ 已到複習時間（已超過 ${fmtSpan(now - m.nextT)}）！記憶保留率約 ${ret}%，建議現在到練習模式複習。`
        : `✅ 記憶還算穩固。建議在 <b>${fmtDateTime(m.nextT)}</b>（約 ${fmtSpan(m.nextT - now)}後）再複習。`;

    $('wd-chart').innerHTML = memoryChart(w);

    const rows = [...m.nodes].reverse().map(n => {
        const tag = n.kind === 'add' ? '📌 加入錯題庫' : n.kind === 'ok' ? '✅ 答對' : '❌ 答錯';
        const note = n.kind === 'add' ? '' : `穩定度 → ${Math.round(n.S * 10) / 10} 天`;
        return `<div class="hist-row"><div><span class="m">${tag}</span></div><div class="r">${fmtDateTime(n.t)}${note ? '<br>' + note : ''}</div></div>`;
    });
    $('wd-history').innerHTML = rows.join('') + (m.events.length ? '' : '<div class="chart-empty" style="padding:10px 0">還沒有複習紀錄，去練習模式複習這個字吧！</div>');

    $('wd-google').href = 'https://www.google.com/search?q=' + encodeURIComponent(w.word + ' 意思');
    $('wd-cambridge').href = 'https://dictionary.cambridge.org/search/english-chinese-traditional/direct/?q=' + encodeURIComponent(w.word);
}
const closeWordDetail = () => { playClickSound(); currentDetailWord = null; showScreen('bank'); renderBank(); };
$('btn-word-back').onclick = closeWordDetail;
$('btn-word-back-top').onclick = closeWordDetail;
$('btn-word-speak').onclick = () => { playClickSound(); if (currentDetailWord) speakWord(currentDetailWord); };
$('btn-word-known').onclick = () => {
    if (!currentDetailWord) return;
    if (!confirm(`確定要把「${currentDetailWord}」移出錯題庫嗎？`)) return;
    playClickSound();
    removeFromBank(currentDetailWord);
    closeWordDetail();
};
document.querySelectorAll('#bank-level-tabs .lb-tab').forEach(b => b.onclick = () => { playClickSound(); bankFilter = b.dataset.level; renderBank(); });
$('bank-sort').onchange = e => { bankSort = e.target.value; renderBank(); };
$('bank-search').oninput = e => { bankSearch = e.target.value; renderBank(); };
$('btn-bank-back').onclick = () => { playClickSound(); showScreen('lobby'); showMenu('main'); };
$('btn-bank-clear').onclick = () => {
    if (!wrongBank.length) return;
    if (confirm('確定要清空整個錯題庫嗎？此動作無法復原。')) { wrongBank = []; saveBank(); renderBank(); }
};
let practiceOrigin = ''; // '' | 'menu' | 'bank'
const bpModal = $('bank-practice-modal');
$('btn-bank-practice').onclick = () => {
    playClickSound();
    if (!wrongBank.length) { alert('錯題庫還是空的，先去玩幾局吧！'); return; }
    const cnt = l => wrongBank.filter(w => w.level === l).length;
    $('bank-practice-opts').innerHTML =
        `<label class="check-row"><input type="checkbox" id="bp-all" checked> 全部 (${wrongBank.length} 字)</label>` +
        ALL_LEVELS.map(l => `<label class="check-row"><input type="checkbox" class="bp-lv" value="${l}" ${cnt(l) ? 'checked' : 'disabled'}> ${LEVEL_LABEL[l]}錯題字 (${cnt(l)} 字)</label>`).join('');
    bpModal.classList.remove('hidden');
};
bpModal.addEventListener('change', e => {
    const lv = [...bpModal.querySelectorAll('.bp-lv:not(:disabled)')];
    if (e.target.id === 'bp-all') lv.forEach(c => c.checked = e.target.checked);
    else $('bp-all').checked = lv.every(c => c.checked);
});
$('btn-bp-cancel').onclick = () => { playClickSound(); bpModal.classList.add('hidden'); };
$('btn-bp-start').onclick = () => {
    playClickSound();
    const lv = [...bpModal.querySelectorAll('.bp-lv:checked')].map(c => c.value);
    if (!lv.length) { alert('請至少選擇一個級別！'); return; }
    practicePool = wrongBank.filter(w => lv.includes(w.level)).map(w => ({ word: w.word, meaning: w.meaning, level: w.level }));
    if (!practicePool.length) { alert('這些級別沒有錯題字！'); return; }
    bpModal.classList.add('hidden');
    practiceOrigin = 'bank';
    currentMode = 'practice';
    launchSingleGame();
};
$('btn-back-bank').onclick = () => {
    playClickSound();
    returnToLobby('main');
    showScreen('bank'); renderBank();
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
    const unit = lbTab === 'time' ? '秒' : lbTab === 'mj' ? '台' : '分';
    if (!list || !list.length) {
        el.innerHTML = '<div class="lb-empty">載入中...</div>';
        return;
    }
    el.innerHTML = list.map((item, i) => {
        const badge = i === 0 ? '🥇 1.' : i === 1 ? '🥈 2.' : i === 2 ? '🥉 3.' : `${i + 1}.`;
        return `<div class="lb-row"><span>${badge} ${esc(item.name || '匿名玩家')}</span>
            <span class="lb-score">${item.score || 0} ${unit}</span></div>`;
    }).join('');
}

// 排行榜只在進入網頁時讀取一次（once），之後要按「🔄」才會重新抓，不持續監聽，避免佔用資源
let lbLoaded = { time: false, score: false, mj: false }, lbRefreshing = false;
const lbRefs = () => ({ time: dbRef, score: scoreRef, mj: mjRef });
function loadBoard(ref, key) {
    return ref.once('value').then(snap => {
        const data = snap.val();
        lbData[key] = data ? Object.values(data).sort((a, b) => b.score - a.score) : [];
        lbLoaded[key] = true;
        renderLeaderboard();
    }).catch(() => {
        if (!lbData[key].length) { const el = $('leaderboard-list'); if (el && lbTab === key) el.innerHTML = '<div class="lb-empty">載入失敗，請按上方 🔄 重試</div>'; }
    });
}
loadBoard(dbRef, 'time');
loadBoard(scoreRef, 'score');
// 手動重新載入：按了才會向雲端抓最新榜單（轉圈期間不能連按）
(() => {
    const btn = $('btn-lb-refresh'); if (!btn) return;
    btn.onclick = async e => {
        e.stopPropagation(); playClickSound();
        if (lbRefreshing) return;
        lbRefreshing = true; btn.classList.add('spin'); btn.disabled = true;
        await Promise.all(Object.entries(lbRefs()).filter(([k]) => k === 'time' || k === 'score' || lbLoaded[k] || lbTab === k).map(([k, r]) => loadBoard(r, k)));
        setTimeout(() => { lbRefreshing = false; btn.classList.remove('spin'); btn.disabled = false; }, 1200);
    };
})();

document.querySelectorAll('.lb-tabs .lb-tab').forEach(b => b.onclick = () => {
    playClickSound();
    lbTab = b.dataset.tab;
    if (!lbLoaded[lbTab]) loadBoard(lbRefs()[lbTab], lbTab); // 還沒讀過（例如麻將台數榜）才讀一次
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
    }, (err, committed) => {
        if (err) return console.error('成績上傳失敗：', err);
        if (!committed) return;
        // 不再監聽，所以自己把新成績更新到本機榜單
        const k = ref === dbRef ? 'time' : ref === mjRef ? 'mj' : 'score';
        lbData[k] = (lbData[k] || []).filter(x => x.name !== name).concat({ name, score: value }).sort((a, b) => b.score - a.score);
        renderLeaderboard();
    });
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
    wrap.innerHTML = `<div class="swipe-bg add">➕ 加入錯題庫</div><div class="swipe-bg undo">↩ 取消加入</div>
        <div class="swipe-card">
            <div>
                <div class="rv-word">${esc(item.word)}</div>
                <div class="rv-correct">正解：${esc(item.correctMeaning)}</div>
                <div class="rv-wrong">誤選：${esc(item.userChosenMeaning)}</div>
            </div>
            <span class="rv-added"></span>
        </div>`;
    const card = wrap.querySelector('.swipe-card'), tag = wrap.querySelector('.rv-added');
    const bgAdd = wrap.querySelector('.swipe-bg.add'), bgUndo = wrap.querySelector('.swipe-bg.undo');
    const refresh = () => {
        const added = isInBank(item.word);
        card.classList.toggle('added', added);
        tag.textContent = added ? '✓ 已加入' : ''; // 只顯示狀態，加入 / 取消都用左右滑動
    };
    const doAdd = () => { if (addToBank(item)) playCorrectSound(); refresh(); updateAddAllBtn(); };
    const doUndo = () => { if (cancelAdd(item.word)) playClickSound(); refresh(); updateAddAllBtn(); };
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
        dx = e.clientX - startX;
        // 只露出「目前這個方向有效」的背景：未加入 → 右滑加入；已加入 → 左滑取消
        const added = isInBank(item.word);
        bgAdd.style.opacity = dx > 0 && !added ? 1 : 0;
        bgUndo.style.opacity = dx < 0 && added ? 1 : 0;
        card.style.transform = `translateX(${(dx > 0 && added) || (dx < 0 && !added) ? dx * 0.25 : dx}px)`; // 無效方向有阻力感
    });
    const end = () => {
        if (startX === null) return;
        card.style.transition = 'transform 0.25s';
        card.style.transform = 'translateX(0)';
        bgAdd.style.opacity = 0; bgUndo.style.opacity = 0;
        if (dx > 80) doAdd(); else if (dx < -80) doUndo();
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
        wrongWordsListEl.innerHTML = '<div class="rv-perfect">太厲害了！本局完全沒有錯題！</div>';
    } else {
        wrongQuestionsList.forEach(item => wrongWordsListEl.appendChild(createReviewCard(item)));
        updateAddAllBtn();
    }
    const bb = $('btn-back-bank');
    if (bb) bb.style.display = (currentMode === 'practice' && practiceOrigin === 'bank') ? '' : 'none';
    if (btnPlayAgain) btnPlayAgain.style.display = currentMode === 'multi' ? 'none' : '';
    btnCloseReview.textContent = currentMode === 'multi' ? '🚪 返回房間大廳' : currentMode === 'practice' ? '返回主選單' : '確定並返回大廳';
    wrongWordsContainer.classList.remove('hidden');
}

btnAddAllWrong.onclick = () => {
    playClickSound();
    wrongQuestionsList.forEach(addToBank);
    renderWrongWordsReview();
};
const btnPlayAgain = $('btn-play-again');
btnPlayAgain.onclick = () => {
    playClickSound();
    if (currentMode === 'multi') return;
    launchSingleGame(); // 沿用同一模式（排位 / 同一組練習題庫）直接重開
};
btnCloseReview.onclick = () => {
    playClickSound();
    if (currentMode === 'multi') returnToRoom();
    else returnToLobby(currentMode === 'practice' ? 'main' : 'single');
};

// 點擊題目單字：標記為不熟
window.addEventListener('DOMContentLoaded', () => {
    // 💡 啟用分頁可見性監聽 (自動斷連 / 重連)
    manageFirebaseVisibility();
    // 初始化時套用儲存的深色模式
    applyDarkMode(gameSettings.darkMode);
    if (hasProfile()) { const pn = Profile.getName(); if (pn) setPlayerName(pn); Profile.refreshChip(); }
    // ⚙️ 懸浮設定球事件與拖曳吸附綁定
    const floatBtn = $('btn-floating-settings');

    // 初始化勾選框狀態
    $('setting-speech').checked = gameSettings.speech;
    $('setting-sound').checked = gameSettings.sound;
    const volInput = $('setting-speech-volume');
    const volText = $('volume-val');
    if (volInput && volText) {
        const curVolPercent = Math.round((gameSettings.volume !== undefined ? gameSettings.volume : 1.0) * 100);
        volInput.value = curVolPercent;
        volText.textContent = curVolPercent;
        volInput.oninput = () => { volText.textContent = volInput.value; };
    }

    const sfxInput = $('setting-sfx-volume'), sfxText = $('sfx-volume-val');
    if (sfxInput && sfxText) {
        const p0 = Math.round((typeof gameSettings.sfxVolume === 'number' ? gameSettings.sfxVolume : 1) * 100);
        sfxInput.value = p0; sfxText.textContent = p0;
        sfxInput.oninput = () => { sfxText.textContent = sfxInput.value; gameSettings.sfxVolume = Number(sfxInput.value) / 100; if (masterGain) masterGain.gain.value = gameSettings.sfxVolume; };
        sfxInput.onchange = () => playClickSound(); // 放開滑桿時播一聲試聽
    }

    // ---- 懸浮球位置：預設在螢幕左側，並記住玩家最後放的位置 ----
    const POS_KEY = 'vocab_float_pos', FM = 10;
    const clampY = y => Math.max(FM, Math.min(window.innerHeight - floatBtn.offsetHeight - FM, y));
    const placeFloat = () => {
        let pos = null;
        try { pos = JSON.parse(localStorage.getItem(POS_KEY)); } catch (e) { }
        const right = pos && pos.side === 'right';
        const yr = pos && typeof pos.y === 'number' ? pos.y : 0.55;
        floatBtn.style.right = 'auto'; floatBtn.style.bottom = 'auto';
        floatBtn.style.left = (right ? window.innerWidth - floatBtn.offsetWidth - FM : FM) + 'px';
        floatBtn.style.top = clampY(yr * window.innerHeight) + 'px';
    };
    placeFloat();
    window.addEventListener('resize', placeFloat);

    // ---- 拖曳（Pointer Events：滑鼠與觸控只走一條路，不會重複觸發）----
    let drag = null, suppressClick = false, settingsOpenedAt = 0;
    floatBtn.addEventListener('pointerdown', e => {
        const r = floatBtn.getBoundingClientRect();
        drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
        try { floatBtn.setPointerCapture(e.pointerId); } catch (_) { }
    });
    floatBtn.addEventListener('pointermove', e => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
        if (!drag.moved && Math.hypot(dx, dy) < 10) return;
        drag.moved = true;
        floatBtn.classList.add('dragging');
        floatBtn.style.left = Math.max(FM, Math.min(window.innerWidth - floatBtn.offsetWidth - FM, drag.ox + dx)) + 'px';
        floatBtn.style.top = clampY(drag.oy + dy) + 'px';
    });
    const endDrag = e => {
        if (!drag || e.pointerId !== drag.id) return;
        const moved = drag.moved; drag = null;
        floatBtn.classList.remove('dragging');
        if (!moved) return;
        suppressClick = true; setTimeout(() => suppressClick = false, 80);
        const r = floatBtn.getBoundingClientRect();
        const side = r.left + r.width / 2 < window.innerWidth / 2 ? 'left' : 'right';
        try { localStorage.setItem(POS_KEY, JSON.stringify({ side, y: r.top / window.innerHeight })); } catch (_) { }
        placeFloat(); // 吸附到左／右邊緣
    };
    floatBtn.addEventListener('pointerup', endDrag);
    floatBtn.addEventListener('pointercancel', endDrag);

    // ---- 開啟設定：改用 click 事件（不是 pointerup），並在剛開啟的 0.5 秒內擋掉彈窗內的點擊，避免誤觸裡面的按鈕 ----
    floatBtn.addEventListener('click', () => {
        if (suppressClick || !$('settings-modal').classList.contains('hidden')) return;
        playClickSound();
        $('setting-darkmode').checked = !!gameSettings.darkMode;
        $('setting-speech').checked = gameSettings.speech;
        $('setting-sound').checked = gameSettings.sound;
        syncMusicUI();
        populateVoiceList();
        const voiceSelect = $('setting-speech-voice');
        if (voiceSelect) voiceSelect.value = gameSettings.voiceURI || '';
        if (volInput && volText) {
            const p = Math.round((gameSettings.volume !== undefined ? gameSettings.volume : 1.0) * 100);
            volInput.value = p; volText.textContent = p;
        }
        if (sfxInput && sfxText) { const p = Math.round((typeof gameSettings.sfxVolume === 'number' ? gameSettings.sfxVolume : 1) * 100); sfxInput.value = p; sfxText.textContent = p; }
        settingsOpenedAt = Date.now();
        $('settings-modal').classList.remove('hidden');
    });
    $('settings-modal').addEventListener('click', e => {
        if (Date.now() - settingsOpenedAt < 500) { e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);

    // ---- 背景音樂設定：開關 / 音量 / 換首（設定視窗開著時會試聽） ----
    const musicChk = $('setting-music'), bgmVolInput = $('setting-bgm-volume'), bgmVolText = $('bgm-volume-val');
    const bgmSel = $('setting-bgm-track'), bgmNext = $('btn-bgm-next');
    window.refreshBgmSelect = () => { // 只列出存在的曲目
        if (!bgmSel) return;
        let h = '';
        for (let n = 1; n <= BGM_MAX; n++) if (bgmAvail[n]) h += `<option value="${n}">背景音樂 ${n}</option>`;
        bgmSel.innerHTML = h || '<option value="">（找不到 bgm1.mp3 ~ bgm' + BGM_MAX + '.mp3）</option>';
        bgmSel.disabled = !h;
        if (h) bgmSel.value = String(pickBGMTrack() || '');
        if (bgmNext) bgmNext.disabled = bgmSel.options.length < 2 || !h;
    };
    window.syncMusicUI = () => {
        if (musicChk) musicChk.checked = gameSettings.music;
        if (bgmVolInput && bgmVolText) { const p = Math.round(bgmVol() * 100); bgmVolInput.value = p; bgmVolText.textContent = p; }
        refreshBgmSelect();
    };
    const previewBGM = () => { bgmPreview = !$('settings-modal').classList.contains('hidden'); applyBGM(); };
    if (musicChk) musicChk.onchange = () => { gameSettings.music = musicChk.checked; previewBGM(); };
    if (bgmVolInput && bgmVolText) bgmVolInput.oninput = () => { bgmVolText.textContent = bgmVolInput.value; gameSettings.bgmVolume = Number(bgmVolInput.value) / 100; setBgmVolume(); if (gameSettings.music) previewBGM(); };
    if (bgmSel) bgmSel.onchange = () => { if (!bgmSel.value) return; gameSettings.bgmTrack = Number(bgmSel.value); haltBGM(); previewBGM(); };
    if (bgmNext) bgmNext.onclick = () => { // 換下一首（循環）
        playClickSound();
        const vals = [...bgmSel.options].map(o => o.value), i = vals.indexOf(bgmSel.value);
        bgmSel.value = vals[(i + 1) % vals.length];
        bgmSel.onchange();
    };

    // ---- 儲存並關閉設定（按鈕 / 點背景遮罩共用） ----
    const saveSettingsFromUI = () => {
        gameSettings.darkMode = $('setting-darkmode').checked;
        applyDarkMode(gameSettings.darkMode); // 即時套用
        gameSettings.speech = $('setting-speech').checked;
        gameSettings.sound = $('setting-sound').checked;
        const voiceSelect = $('setting-speech-voice');
        if (voiceSelect) gameSettings.voiceURI = voiceSelect.value;
        if (volInput) gameSettings.volume = Number(volInput.value) / 100; // 將 0~100 轉為 0.0~1.0
        if (sfxInput) gameSettings.sfxVolume = Number(sfxInput.value) / 100;
        if (musicChk) gameSettings.music = musicChk.checked;
        if (bgmVolInput) gameSettings.bgmVolume = Number(bgmVolInput.value) / 100;
        if (bgmSel && bgmSel.value) gameSettings.bgmTrack = Number(bgmSel.value);
        saveGameSettings();
        $('settings-modal').classList.add('hidden');
        bgmPreview = false; applyBGM(); // 結束試聽（遊戲進行中則繼續播放選好的那首）
    };
    $('btn-settings-close').onclick = saveSettingsFromUI;
    $('settings-modal').addEventListener('click', e => { if (e.target.id === 'settings-modal') saveSettingsFromUI(); });

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
            currentWordEl.classList.add('marked');
            markAddedNew = !wrongQuestionsList.some(w => w.word === currentQuestion.word);
            if (markAddedNew) recordWrongItem(currentQuestion.word, currentQuestion.meaning, currentQuestion.level, MANUAL_MARK);
        } else {
            currentWordEl.classList.remove('marked');
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
    if (currentMode === 'multi' && !isMultiplayerActive) return; // 遊戲已結束/淘汰，不要覆蓋結算畫面
    if (!activePool.length || !distractPool.length) return;
    isCurrentQuestionMarked = false; markAddedNew = false;
    currentWordEl.classList.remove('marked');
    if (currentMode === 'multi') {
        // 以「本局種子 + 第幾題」決定題目，每局不同、同局所有玩家相同
        const qSeed = ((multiSeed % 4294967296) + Math.imul(multiQIndex + 1, 0x9E3779B1)) >>> 0;
        multiQIndex++;
        currentQuestion = makeQuestion(activePool, distractPool, mulberry32(qSeed));
    } else {
        currentQuestion = makeQuestion(activePool, distractPool);
    }
    currentWordEl.textContent = currentQuestion.word;
    // 每次換新題目時，自動朗讀英文單字
    speakWord(currentQuestion.word);
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
    sessionRecorded = false; sessionStart = Date.now(); sessionMaxCombo = 0;

    if (allVocabPool.length === 0) initVocabPool();
    const rankedPool = getVocabByLevels(['level4', 'level5']); // 排位賽：只出 4、5 級字
    activePool = practice ? practicePool : (rankedPool.length >= 4 ? rankedPool : allVocabPool);
    distractPool = practice ? allVocabPool : activePool;

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
    sessionMaxCombo = Math.max(sessionMaxCombo, myCombo);
    recordBankReview(currentQuestion.word, ok);
    if (hasProfile()) Profile.recordAnswer(currentQuestion, ok, myCombo);
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
    recordSession('ranked');
    renderWrongWordsReview(buildSummary('💀 遊戲結束', notes));
}

function finishPractice() {
    if (!singlePlaying) return;
    singlePlaying = false;
    disableAllOptionButtons();
    btnFinishPractice.style.display = 'none';
    recordSession('practice');
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
const globalLeaderboardCard = $('global-leaderboard-card');

$('btn-goto-single').onclick = () => { 
    playClickSound(); 
    showMenu('single'); 
    if(globalLeaderboardCard) globalLeaderboardCard.style.display = 'none'; // 隱藏排行榜
};

$('btn-goto-multi').onclick = () => { 
    playClickSound(); 
    showMenu('multi'); 
    if(globalLeaderboardCard) globalLeaderboardCard.style.display = 'none'; // 隱藏排行榜
};

$('btn-back-to-main').onclick = () => { 
    playClickSound(); 
    showMenu('main'); 
    if(globalLeaderboardCard) globalLeaderboardCard.style.display = 'block'; // 返回主頁時顯示排行榜
};

$('btn-back-from-multi').onclick = () => { 
    playClickSound(); 
    showMenu('main'); 
    if(globalLeaderboardCard) globalLeaderboardCard.style.display = 'block'; // 返回主頁時顯示排行榜
};
$('btn-goto-bank').onclick = () => { playClickSound(); showScreen('bank'); renderBank(); };
$('btn-start-ranked').onclick = () => { playClickSound(); currentMode = 'ranked'; practiceOrigin = ''; launchSingleGame(); };
$('btn-start-practice').onclick = () => {
    playClickSound();
    $('practice-bank-count').textContent = wrongBank.length;
    showMenu('practice');
};
$('btn-practice-back').onclick = () => { playClickSound(); showMenu('single'); };
$('btn-practice-start').onclick = () => {
    playClickSound();
    const picks = [...document.querySelectorAll('#practice-setup-box input[value]:not([data-bl]):checked')].map(i => i.value);
    if (!picks.length) { alert('請至少選擇一個題庫！'); return; }
    let pool = getVocabByLevels(picks.filter(p => p !== 'bank'));
    if (picks.includes('bank')) {
        const bl = [...document.querySelectorAll('#practice-bank-levels input:checked')].map(i => i.value);
        if (!bl.length) { alert('請至少選擇一個錯題庫級別！'); return; }
        wrongBank.filter(w => bl.includes(w.level)).forEach(w => pool.push({ word: w.word, meaning: w.meaning, level: w.level }));
    }
    const seen = new Set();
    pool = pool.filter(w => !seen.has(w.word) && seen.add(w.word));
    if (!pool.length) { alert('你選擇的題庫目前沒有單字（錯題庫可能還是空的）！'); return; }
    practicePool = pool;
    practiceOrigin = 'menu';
    currentMode = 'practice';
    launchSingleGame();
};
document.querySelector('#practice-setup-box input[value="bank"]').addEventListener('change', e => {
    $('practice-bank-levels').classList.toggle('hidden', !e.target.checked);
});
// 💡 請在此定義你當前「最新的使用說明內容版本號」（每次更新使用說明時，只要把版號改大即可）
const CURRENT_HELP_VERSION = '20261024_v1';

// 檢查並更新紅點顯示狀態
function checkHelpBadge() {
    const lastReadVersion = localStorage.getItem('vocab_help_version');
    const badge = $('help-badge');
    if (badge) {
        // 如果瀏覽器儲存的版本跟目前最新版本不同，就顯示紅點
        badge.classList.toggle('hidden', lastReadVersion === CURRENT_HELP_VERSION);
    }
}

$('btn-help').onclick = () => {
    playClickSound();
    $('help-modal').classList.remove('hidden');

    // 💡 當使用者點擊打開說明時，立即記錄為「已讀最新版本」，並隱藏紅點
    localStorage.setItem('vocab_help_version', CURRENT_HELP_VERSION);
    const badge = $('help-badge');
    if (badge) badge.classList.add('hidden');
};

// 網頁載入完成時執行檢查
document.addEventListener('DOMContentLoaded', () => {
    checkHelpBadge();
});
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

function joinRoomByCode(code) {
    if (String(code).length !== 4) { alert('請輸入正確的 4 碼房間代碼！'); return; }
    if (playerNameInput.value.trim()) playerName = playerNameInput.value.trim();
    isHost = false;
    initMultiplayerRoom(String(code), false);
}
btnJoinRoom.addEventListener('click', () => {
    playClickSound();
    joinRoomByCode(roomCodeInput.value.trim());
});

// onReady：房間建立 / 加入成功後呼叫（好友邀請用）
function initMultiplayerRoom(roomCode, isCreating, onReady) {
    const key = mySafeKey();
    currentRoomRef = firebase.database().ref('rooms/' + roomCode);

    const onJoined = () => {
        currentRoomRef.child('players/' + key).onDisconnect().remove();
        resetRoundTracking();
        showScreen('room');
        displayRoomCode.textContent = `#${roomCode}`;
        listenRoomData();
        syncRoomAvatar();
        if (typeof onReady === 'function') onReady(roomCode);
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

// 把自己的頭像縮圖寫進房間，讓房內玩家都看得到
function syncRoomAvatar() {
    if (!currentRoomRef || !hasProfile() || !Profile.getThumb) return;
    const ref = currentRoomRef;
    Profile.getThumb().then(av => { if (av && ref === currentRoomRef) ref.child('players/' + mySafeKey() + '/avatar').set(av); }).catch(() => { });
}
const safeAvatar = a => (typeof a === 'string' && a.startsWith('data:image/jpeg;base64,') && a.length < 20000) ? a : '';

function resetRoundTracking() {
    currentRound = null; endedRoundHandled = null; endRequestedRound = null;
    lastRoomStatus = 'waiting';
}

function renderRoomPlayers(room) {
    if (!playerListContainer) return;
    playerListContainer.innerHTML = '';
    Object.values(room.players || {}).forEach(p => {
        let tag;
        if (p.isHost) tag = '<span class="tag-host">👑 房主</span>';
        else if (p.ready) tag = '<span class="tag-ready">✅ 準備就緒</span>';
        else tag = '<span class="tag-wait">⏳ 稍等一下</span>';
        const item = document.createElement('div');
        item.className = 'room-player';
        const nm = p.name || '未知玩家', av = safeAvatar(p.avatar);
        item.innerHTML = `<span class="nm" style="display:flex;align-items:center;gap:8px;"><span class="avatar" style="width:32px;height:32px;font-size:14px;">${av ? `<img src="${esc(av)}" alt="">` : esc(nm.trim().charAt(0).toUpperCase() || '?')}</span>${esc(nm)}${p.name === playerName ? ' (你)' : ''}</span>${tag}`;
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

btnLeaveRoom.addEventListener('click', () => { playClickSound(); leaveRoomNow(); });
function leaveRoomNow() {
    if (currentRoomRef) {
        currentRoomRef.child('players/' + mySafeKey()).remove();
        currentRoomRef.off();
        currentRoomRef = null;
    }
    resetLocalGameState();
    showScreen('lobby');
    showMenu('main');
}

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
    myHp = multiMaxHp; myCombo = 0;
    correctCount = 0; wrongCount = 0; score = 0;
    wrongQuestionsList = [];
    lastSelfActionTime = Date.now();
    scoreboardFrozen = false; lastPlayersSnapshot = null;
    sessionRecorded = false; sessionStart = Date.now(); sessionMaxCombo = 0;

    configureBattleUI('multi');
    scoreboardEl.innerHTML = '';
    wrongWordsContainer.classList.add('hidden');
    currentWordEl.classList.remove('marked', 'flash-correct', 'flash-wrong');
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

// 自己的血量一律用 transaction 修改（Firebase 才是唯一真相，避免覆蓋對手的攻擊）
function adjustMyHp(delta) {
    if (!currentRoomRef) return;
    currentRoomRef.child(`players/${mySafeKey()}`).transaction(p => {
        if (!p || p.isDead) return p;
        const hp = Math.max(0, Math.min(multiMaxHp, Math.round((p.hp || 0) + delta)));
        p.hp = hp;
        if (hp <= 0) p.isDead = true;
        return p;
    });
}

function renderMultiplayerScoreboard(playersObj, winnerName) {
    scoreboardEl.innerHTML = '';
    const arr = Object.values(playersObj);
    arr.sort((a, b) => (a.name === playerName ? 1 : 0) - (b.name === playerName ? 1 : 0));

    arr.forEach(player => {
        const isMe = player.name === playerName;
        const hp = Math.max(0, Math.min(multiMaxHp, player.hp || 0));
        const isDead = !!player.isDead || hp <= 0;
        const isWinner = !!winnerName && player.name === winnerName;
        const pct = hp / multiMaxHp * 100;

        const item = document.createElement('div');
        item.className = 'mp-row' + (isMe ? ' me' : '') + (isDead && !isWinner ? ' dead' : '') + (isWinner ? ' winner' : '');
        if (isMe) item.id = 'my-multiplayer-row';
        item.innerHTML = `
            <span class="player-name-tag"><span class="avatar" style="width:20px;height:20px;font-size:11px;display:inline-flex;vertical-align:middle;margin-right:5px;">${safeAvatar(player.avatar) ? `<img src="${esc(safeAvatar(player.avatar))}" alt="">` : esc((player.name || '?').trim().charAt(0).toUpperCase() || '?')}</span>${isWinner ? '👑 ' : ''}${esc(player.name)}${isMe ? ' (你)' : ''}</span>
            <div class="hp-bar-outer"><div class="hp-bar-inner ${pct <= 30 ? 'low' : ''}" style="width: ${pct}%;"></div></div>
            <span class="status-badge ${isDead && !isWinner ? 'dead' : ''}">${isDead && !isWinner ? '💀 淘汰' : `HP: ${hp}`}</span>`;
        scoreboardEl.appendChild(item);
    });
}

function handlePlayerElimination() {
    if (!isMultiplayerActive) return;
    isMultiplayerActive = false;
    myHp = 0;
    stopBGM();
    if (currentRoomRef) currentRoomRef.child(`players/${mySafeKey()}`).update({ hp: 0, isDead: true });
    recordSession('multi', false);

    currentWordEl.textContent = "💀 你已被淘汰！";
    optionsContainerEl.innerHTML = `<div class="mp-result"><div class="mp-crown">💀</div>
        <div class="mp-winner" style="color: var(--bad-text);">你已被淘汰，進入觀戰模式</div>
        <div class="mp-sub">可先檢討錯題，並將不熟的單字加入錯題庫</div></div>`;
    renderWrongWordsReview(buildSummary('💀 你已被淘汰'));
}

function declareWinnerIfNeeded(room) {
    if (!currentRoomRef || (room.startCount || 0) < 2 || endRequestedRound === room.round) return;
    const alive = Object.values(room.players || {}).filter(p => !p.isDead && p.hp > 0);
    if (alive.length > 1) return;
    endRequestedRound = room.round;
    currentRoomRef.update({ status: 'ended', winner: alive.length === 1 ? alive[0].name : '' });
}

// 每位玩家（包含贏家與已淘汰者）都會看到：勝利者是誰 + 最終排名
function showMultiplayerResult(winnerName, players) {
    clearInterval(gameTimerInterval); clearInterval(secondCounterInterval);
    stopBGM();
    isMultiplayerActive = false;
    if (players) lastPlayersSnapshot = players;
    scoreboardFrozen = true; // 之後別人返回房間重置血量，也不會影響這個畫面
    if (lastPlayersSnapshot) renderMultiplayerScoreboard(lastPlayersSnapshot, winnerName);

    const iAmWinner = !!winnerName && winnerName === playerName;
    const ranking = Object.values(lastPlayersSnapshot || {}).map(p => ({
        name: p.name, hp: Math.max(0, p.hp || 0), alive: !p.isDead && (p.hp || 0) > 0
    })).sort((a, b) => (b.name === winnerName) - (a.name === winnerName) || b.alive - a.alive || b.hp - a.hp);

    currentWordEl.textContent = iAmWinner ? '🏆 恭喜你獲得最後勝利！'
        : (winnerName ? `🏁 遊戲結束！勝利者：${winnerName}` : '🏁 遊戲結束！本局平手');
    optionsContainerEl.innerHTML = `<div class="mp-result ${iAmWinner ? 'win' : ''}">
        <div class="mp-crown">${winnerName ? '👑' : '🤝'}</div>
        <div class="mp-winner">${winnerName ? esc(winnerName) + ' 獲勝！' : '本局平手'}</div>
        <div class="mp-sub">${iAmWinner ? '🎉 你是最後的生存者，獲得 MVP！' : '比賽已結束，下次再接再厲！'}</div>
        <div class="mp-rank">${ranking.map((p, i) => `<div class="mp-rank-row ${i === 0 && winnerName ? 'first' : ''}">
            <span>${i === 0 && winnerName ? '🥇' : i + 1 + '.'} ${esc(p.name)}${p.name === playerName ? ' (你)' : ''}</span>
            <span class="hp">${p.alive ? 'HP ' + p.hp : '💀 淘汰'}</span></div>`).join('')}</div></div>`;
    recordSession('multi', iAmWinner);
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
        adjustMyHp(healAmount); // 先回血，再攻擊，確保最終結算時自己的血量是最新的

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
        adjustMyHp(-5); // 扣血特效由房間監聽偵測到血量下降時觸發
    }

    sessionMaxCombo = Math.max(sessionMaxCombo, myCombo);
    recordBankReview(currentQuestion.word, isCorrect);
    if (hasProfile()) Profile.recordAnswer(currentQuestion, isCorrect, myCombo);
    flashWord(isCorrect);   // 與單人模式相同的綠框 / 紅框特效
    updateComboUI();
    if (!isMultiplayerActive) return; // 剛好這一擊結束了遊戲（贏家）或自己被淘汰：不要再出新題蓋掉結算畫面
    loadNextQuestion();
}

function listenRoomData() {
    if (!currentRoomRef) return;
    currentRoomRef.on('value', snap => {
        const room = snap.val();
        if (!room) return;
        lastRoomStatus = room.status;

        // 新的一局
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

        const inThisRound = room.round === currentRound;
        if (room.players) {
            const meData = room.players[mySafeKey()];
            if (meData && typeof meData.hp === 'number' && isMultiplayerActive && inThisRound) {
                // Firebase 為準：血量變化就同步，並依方向播放特效
                const prev = myHp;
                myHp = meData.hp;
                if (!scoreboardFrozen && !battleScreenHidden()) renderMultiplayerScoreboard(room.players);
                if (meData.hp < prev) triggerDamageEffect(prev - meData.hp);
                else if (meData.hp > prev) triggerHealEffect(meData.hp - prev);
                if (meData.isDead || meData.hp <= 0) handlePlayerElimination();
            } else if (!scoreboardFrozen && !battleScreenHidden() && inThisRound && room.status === 'playing') {
                renderMultiplayerScoreboard(room.players); // 已淘汰的觀戰者也要看到即時血量
            }
        }

        if (room.status === 'playing' && inThisRound) declareWinnerIfNeeded(room);

        if (room.status === 'ended' && inThisRound && endedRoundHandled !== room.round) {
            endedRoundHandled = room.round;
            showMultiplayerResult(room.winner, room.players);
        }
    });
}
function battleScreenHidden() { return screens.battle.classList.contains('hidden'); }

// ==================== 💥 血條特效 ====================
function floatText(text, cls, rowFlashCls) {
    const myRow = document.getElementById('my-multiplayer-row');
    if (!myRow) return;
    myRow.classList.remove('row-flash-damage', 'row-flash-heal');
    void myRow.offsetWidth; // 重新播放動畫
    myRow.classList.add(rowFlashCls);

    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    const rect = myRow.getBoundingClientRect();
    el.style.left = `${rect.left + rect.width / 2 + (Math.random() * 30 - 15)}px`;
    el.style.top = `${rect.top + (Math.random() * 10 - 5)}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
}
function triggerDamageEffect(n = 15) { floatText(`-${n}`, 'floating-damage', 'row-flash-damage'); }
function triggerHealEffect(n = 10) { floatText(`+${n}`, 'floating-heal', 'row-flash-heal'); }

// ℹ️ 關於我們與隱私權說明彈窗事件綁定
    const btnAbout = $('btn-about');
    if (btnAbout) {
        btnAbout.onclick = () => {
            playClickSound();
            $('about-modal').classList.remove('hidden');
        };
    }
    const btnAboutClose = $('btn-about-close');
    if (btnAboutClose) {
        btnAboutClose.onclick = () => {
            playClickSound();
            $('about-modal').classList.add('hidden');
        };
    }
    const aboutModal = $('about-modal');
    if (aboutModal) {
        aboutModal.addEventListener('click', e => {
            if (e.target.id === 'about-modal') {
                aboutModal.classList.add('hidden');
            }
        });
    }

// ==================== ⛶ 全螢幕（設定內）====================
// Android / 桌面：用瀏覽器的全螢幕 API；iPhone Safari 沒有網頁全螢幕 API，改引導「加入主畫面」（從主畫面開啟就是全螢幕）。
// 進入 / 離開全螢幕、轉向後，會重新計算可視高度（pwa.js 的 --vh），所有畫面（含麻將）會跟著調整。
(function () {
    const btn = $('btn-fullscreen'); if (!btn) return;
    const de = document.documentElement;
    const req = de.requestFullscreen || de.webkitRequestFullscreen;
    const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
    const standalone = () => typeof PWA !== 'undefined' && PWA.standalone();
    const refresh = () => {
        if (standalone()) { btn.textContent = '⛶ 已是全螢幕（主畫面模式）'; btn.disabled = true; return; }
        if (!req) { btn.textContent = '⛶ 全螢幕（加入主畫面）'; return; }
        btn.textContent = isFs() ? '⛶ 離開全螢幕' : '⛶ 進入全螢幕';
    };
    btn.onclick = () => {
        playClickSound();
        if (standalone()) return;
        if (!req) { if (typeof PWA !== 'undefined') PWA.guide(); return; } // iPhone：引導加入主畫面
        if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else {
            const p = req.call(de, { navigationUI: 'hide' });
            if (p && p.catch) p.catch(() => { if (typeof PWA !== 'undefined') PWA.guide(); });
            // Android：全螢幕後鎖定成目前的方向可避免誤轉（不支援的瀏覽器會忽略）
        }
    };
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => { refresh(); window.dispatchEvent(new Event('resize')); }));
    refresh();
})();
