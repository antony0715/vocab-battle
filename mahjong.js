// ==================== 🀄 英文麻將（測試版）mahjong.js ====================
// 依賴 app.js：$, esc, safeKey, safeAvatar, playerName, playerNameInput, playClickSound, getVocabByLevels,
//   LEVEL_LABEL, ALL_LEVELS, gameSettings, speakWord, initAudio, audioCtx, sfxOut
// 多人：Firebase mj/{房間碼}；單人練習：用 localRef() 模擬同樣結構的房間，並由 3 位 AI 在本機操作。
// 注意：測試版以「各玩家端自行驗證」為主，未做防作弊；房主離線時該局會中止。
const Mahjong = (() => {
    const DIST = { a: 11, b: 2, c: 4, d: 5, e: 17, f: 2, g: 3, h: 4, i: 10, j: 1, k: 1, l: 5, m: 3, n: 9, o: 10, p: 3, q: 1, r: 9, s: 9, t: 10, u: 4, v: 1, w: 2, x: 1, y: 2, z: 1 }; // 共 130 張
    const CLAIM_MS = 6000, QUICK_MS = 1600, EXT_MS = 10000; // 無人碰：6 秒換人；有人碰：總倒數 +10 秒（只加一次）
    const RARE = { j: 2, q: 2, x: 2, z: 2, k: 1 };
    const LVB = { level1: 0, level2: 0, level3: 0, level4: 1, level5: 2, level6: 3 };
    const SAY = { a: 'eigh', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'eff', g: 'jee', h: 'aitch', i: 'eye', j: 'jay', k: 'kay', l: 'el', m: 'em', n: 'en', o: 'oh', p: 'pee', q: 'cue', r: 'are', s: 'ess', t: 'tee', u: 'you', v: 'vee', w: 'double you', x: 'ex', y: 'why', z: 'zee' };
    const AI_NAMES = ['Luna', 'Max', 'Kai', 'Mia', 'Leo', 'Zoe', 'Finn', 'Ivy', 'Jack', 'Nora', 'Owen', 'Ruby', 'Theo', 'Cleo', 'Milo', 'Aria', 'Hugo', 'Lily', 'Ezra', 'Sage', 'Ava', 'Ben', 'Dana', 'Eli', 'Faye', 'Gus', 'Hana', 'Ian', 'June', 'Knox', 'Lola', 'Noel', 'Pia', 'Quinn', 'Rex', 'Tess', 'Uma', 'Vic', 'Wren', 'Yuki'];
    const ABC = 'abcdefghijklmnopqrstuvwxyz'.split('');
    // 電腦難度：trials=拆牌嘗試次數、rnd=亂打牌機率、ting=宣告聽牌機率、win=已成牌時自摸機率、tingWin=聽牌後自摸機率、
    // ron=胡你打出的牌的機率、claim=想碰的機率、minN=前期（出牌總數）不聽牌不胡、maxMeld=最多碰幾次、minLen=碰的單字最短長度
    const AI_CFG = {
        easy: { name: '簡單', trials: 2, rnd: .65, ting: .04, win: .15, tingWin: .3, ron: .15, claim: .02, minN: 28, maxMeld: 1, minLen: 4 },
        normal: { name: '普通', trials: 3, rnd: .5, ting: .08, win: .25, tingWin: .4, ron: .25, claim: .04, minN: 20, maxMeld: 1, minLen: 4 },
        hard: { name: '高手', trials: 8, rnd: .08, ting: .6, win: .9, tingWin: .9, ron: .85, claim: .3, minN: 12, maxMeld: 2, minLen: 3 }
    };
    let aiLevel = localStorage.getItem('mj_ai_level'); if (!AI_CFG[aiLevel]) aiLevel = 'normal';
    const C = () => AI_CFG[aiLevel];
    const db = firebase.database();
    const MAX_P = 6, MIN_P = 2;
    const CHAT = ['快快快我要胡了', '必須得自摸', '手滑啦！', '完了嘛~', '碰一個炸爽', '一切都是昆率','呃...','神操作 漂亮!'];
    // 座位位置（相對於自己，逆時針）：2 人對面；3 人右上/左上；4 人右/對面/左；5 人右/右上/左上/左；6 人平均分配
    const SLOTS = { 2: ['top'], 3: ['tr', 'tl'], 4: ['right', 'top', 'left'], 5: ['right', 'tr', 'tl', 'left'], 6: ['right', 'tr', 'top', 'tl', 'left'] };
    let serverOffset = 0; // 全部玩家共用「伺服器時間」，避免各裝置時鐘不同造成倒數/換人卡住
    db.ref('.info/serverTimeOffset').on('value', sn => { serverOffset = sn.val() || 0; });
    const now = () => Date.now() + serverOffset;
    const safe = f => { try { return f(); } catch (e) { console.warn('mj', e); } };
    const vowel = c => 'aeiou'.includes(c);

    // ---------- 字典：只用 1~6 級單字庫 ----------
    let dict = null, dict2 = null, dictList = [], anaMap = new Map();
    const lvMap = {}, vmap = {};
    function buildDict() {
        if (dict) return;
        dict = new Set(); dict2 = new Set();
        getVocabByLevels(ALL_LEVELS).forEach(v => {
            const w = String(v.word).trim().toLowerCase();
            if (/^[a-z]{3,}$/.test(w)) { dict.add(w); lvMap[w] = v.level; vmap[w] = v; }
            else if (/^[a-z]{2}$/.test(w)) { dict2.add(w); vmap[w] = v; } // 二字母單字：只有「最後剩一張」時才可用
        });
        (typeof mjExtraWords !== 'undefined' ? mjExtraWords : []).forEach(w => { // 麻將專用補充單字（沒有級別，不加級別台數）
            if (w.length >= 3) dict.add(w); else if (w.length === 2) dict2.add(w);
        });
        sharedWords.forEach(w => dict.add(w));
        try { JSON.parse(localStorage.getItem('mjLearned') || '[]').forEach(w => { if (/^[a-z]{3,}$/.test(w)) dict.add(w); }); } catch (e) { }
        dictList = [...dict];
        anaMap = new Map(); // 排序後的字母 → 單字（AI 判斷「差一張就能湊成單字」用）
        [...dict, ...dict2].forEach(w => { if (w.length <= 8) anaMap.set([...w].sort().join(''), w); });
    }
    const isWord = w => !!dict && w.length >= 3 && dict.has(w);
    const allow3 = () => !(room && room.cfg && room.cfg.allow3 === false);
    const allow4 = () => !(room && room.cfg && room.cfg.allow4 === false);
    // 三字母：不允許時只有「最後湊牌胡牌」可用；四字母：不允許時完全不算
    const lenOk = (w, fin) => w.length === 3 ? (allow3() || !!fin) : w.length === 4 ? allow4() : true;
    const isWordG = w => isWord(w) && lenOk(w, false); // 組成綠色組 / 碰牌用
    const isWordF = w => isWord(w) && lenOk(w, true);  // 最後一個單字（胡牌湊牌）用
    let soloCfg = { allow3: true, allow4: true, fun: false };
    const TH = i => (window.Economy && Economy.THROWS[i]) || { e: '🥚', c: '#fde047' };
    const feltId = () => (window.Economy && Economy.equipped('felt')) || 'default';
    const CHAT_PACKS = () => (window.Economy && Economy.CHAT_PACKS) || [];
    const chatAll = () => CHAT.concat(...CHAT_PACKS().map(p => p.list));
    const chatAvail = () => { const o = CHAT.map((_, i) => i); let off = CHAT.length; CHAT_PACKS().forEach(p => { if (Economy.owned(p.id)) p.list.forEach((_, k) => o.push(off + k)); off += p.list.length; }); return o; };
    const funOn = () => !!(room && room.cfg && room.cfg.fun === true && room.gold);
    const sharedWords = new Set(); // 玩家查證過的單字（存在雲端 mjWords，所有玩家共用）
    function learnWord(w) {
        if (!/^[a-z]{3,}$/.test(w)) return;
        sharedWords.add(w);
        if (dict && !dict.has(w)) {
            dict.add(w); dictList.push(w); if (w.length <= 8) anaMap.set([...w].sort().join(''), w);
            waitCache = { k: '', v: [] }; if (room && ref) safe(render);
        }
    }
    try { Object.assign(soloCfg, JSON.parse(localStorage.getItem('mjSoloCfg') || '{}')); } catch (e) { } soloCfg.fun = false;
    const turnSecOf = () => (room && room.cfg && +room.cfg.turnSec) || 0;
    const NP = () => (room && room.np) || 4;
    function zhOf(w) { // 單字的中文意思（從單字庫取第一個含中文的欄位）
        const v = vmap[w]; if (!v) return '';
        const ok = x => { const t = Array.isArray(x) ? x.join('、') : x; return typeof t === 'string' && /[\u4e00-\u9fff]/.test(t) ? t : ''; };
        let t = ''; for (const k of ['zh', 'cn', 'chinese', 'meaning', 'translation', 'def', 'definition']) { if ((t = ok(v[k]))) break; }
        if (!t) for (const x of Object.values(v)) { if ((t = ok(x))) break; }
        return t.length > 18 ? t.slice(0, 18) + '…' : t;
    }
    const cnt = a => { const c = {}; for (const x of a) c[x] = (c[x] || 0) + 1; return c; };
    const fits = (w, c) => { const t = {}; for (const x of w) { t[x] = (t[x] || 0) + 1; if (t[x] > (c[x] || 0)) return false; } return true; };

    // ---------- 音效 ----------
    // 洗牌 m3 / 牌相撞 m1 / 放進手牌區（含發牌）m2 / 擲骰 m4；音檔載入失敗時退回程式合成的音效
    const SAMPLES = { m1: null, m2: null, m3: null, m4: null };
    let samplesLoading = false;
    function loadSamples() {
        if (samplesLoading) return; samplesLoading = true;
        try { initAudio(); } catch (e) { return; }
        Object.keys(SAMPLES).forEach(k => {
            fetch(k + '.mp3').then(r => { if (!r.ok) throw new Error('no file'); return r.arrayBuffer(); })
                .then(b => new Promise((res, rej) => audioCtx.decodeAudioData(b, res, rej)))
                .then(buf => { SAMPLES[k] = buf; }).catch(() => { SAMPLES[k] = null; });
        });
    }
    function playSample(k, vol = 1, rate = 1) {
        const b = SAMPLES[k]; if (!b) return false;
        const s = audioCtx.createBufferSource(), g = audioCtx.createGain();
        s.buffer = b; s.playbackRate.value = rate; g.gain.value = vol;
        s.connect(g); g.connect(sfxOut()); s.start();
        return true;
    }
    let lastSlide = 0;
    function sfx(kind) {
        if (!gameSettings.sound) return;
        try {
            initAudio();
            const now = audioCtx.currentTime, out = sfxOut();
            if (kind === 'slide') { const t = performance.now(); if (t - lastSlide < 70) return; lastSlide = t; if (playSample('m1', 1.35, .92 + Math.random() * .16)) return; }
            else if (kind === 'shuffle' && playSample('m3', .55)) return;
            else if ((kind === 'drop' || kind === 'draw') && playSample('m2', 1.8, .96 + Math.random() * .08)) return;
            else if (kind === 'dice' && playSample('m4', .30)) return;
            const tone = (f, d, type = 'sine', v = .1, at = 0, f2) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = type; o.frequency.setValueAtTime(f, now + at);
                if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + at + d);
                g.gain.setValueAtTime(v, now + at); g.gain.exponentialRampToValueAtTime(.001, now + at + d);
                o.connect(g); g.connect(out); o.start(now + at); o.stop(now + at + d + .02);
            };
            const noise = (len, f, q, v, at, decay = 3) => {
                const n = Math.floor(audioCtx.sampleRate * len), buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate), d = buf.getChannelData(0);
                for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
                const s = audioCtx.createBufferSource(), bp = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
                s.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; g.gain.value = v;
                s.connect(bp); bp.connect(g); g.connect(out); s.start(now + at);
            };
            // 木頭敲擊聲（拿起 / 放下 / 打牌）
            const wood = (f, v = .2, at = 0, len = .07) => { tone(f, len, 'triangle', v, at, f * .55); noise(.03, f * 4, 3, v * 1.6, at); };
            // 麻將牌互相碰撞的「喀」：高頻短噪音 + 硬質牌身共鳴 + 一點低頻悶響
            const clack = (v = .2, at = 0, p = 1) => {
                noise(.035, 2600 * p, 1.1, v * 2.2, at, 4);
                noise(.02, 5200 * p, 1.5, v * 1.1, at, 5);
                tone(1650 * p, .03, 'triangle', v * .5, at, 900 * p);
                tone(230 * p, .05, 'sine', v * .35, at, 150 * p);
            };
            if (kind === 'pick') wood(350, .13, 0, .05);
            else if (kind === 'drop') { wood(330, .24, 0, .08); wood(250, .12, .055, .07); }
            else if (kind === 'discard') { wood(270, .32, 0, .1); wood(200, .16, .05, .08); }
            else if (kind === 'draw') wood(520, .14, 0, .06);
            else if (kind === 'slide') { // 拖曳排開其他牌時：牌與牌輕輕相碰（限速避免連續爆音）
                clack(.1 + Math.random() * .04, 0, .9 + Math.random() * .25);
            }
            else if (kind === 'shuffle') { // 洗牌：大量牌互相碰撞摩擦，疏密不一
                for (let i = 0; i < 46; i++) clack(.07 + Math.random() * .12, Math.random() * 1.5, .75 + Math.random() * .55);
                noise(1.5, 1800, .6, .05, 0, 1);
            }
            else if (kind === 'dice') { for (let i = 0; i < 9; i++) clack(.08 + Math.random() * .08, i * .085 + Math.random() * .03, 1.1 + Math.random() * .4); }
            else if (kind === 'splat') { noise(.14, 900, .8, .35, 0, 2); tone(170, .14, 'sine', .25, 0, 70); }
            else if (kind === 'throw') tone(500, .22, 'sine', .05, 0, 900);
            else if (kind === 'turn') { tone(784, .12, 'sine', .12); tone(1047, .2, 'sine', .12, .1); }
            else if (kind === 'tick') tone(880, .12, 'sine', .12);
            else if (kind === 'go') { tone(1175, .25, 'sine', .13); tone(1568, .3, 'sine', .1, .08); }
            else if (kind === 'group') { tone(660, .1, 'sine', .1); tone(880, .1, 'sine', .1, .09); tone(1320, .16, 'sine', .09, .18); }
            else if (kind === 'claim') { tone(392, .1, 'sawtooth', .06); tone(523, .1, 'sawtooth', .06, .1); tone(784, .22, 'sawtooth', .06, .2); }
            else if (kind === 'ting') { tone(988, .12, 'sine', .1); tone(1318, .22, 'sine', .1, .1); }
            else if (kind === 'win') [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, .26, 'sine', .12, i * .12));
        } catch (e) { }
    }

    // ---------- 狀態 ----------
    let ref = null, room = null, code = '', key = '', mySeat = -1, solo = false;
    let tiles = {}, nextId = 1, hand = [], drawnId = null, drawFly = false, selfDraw = false;
    let cm = null, pending = null, claimBlockedN = 0; // cm：碰牌組牌區 { n, items:[tileId|'D'], sent }
    let introing = false, revealed = new Set(), introToken = 0;
    let curRound = null, resolvedFor = '', lastClaimN = 0, lastSpokenN = 0, winSfxRound = 0, revealSent = false, tingSeen = new Set();
    let cdTimer = null, resolveTimer = null, callouts = {}, waitCache = { k: '', v: [] };
    let aiHands = {}, aiPending = {}, aiTing = {}, aiDone = new Set(), aiTimers = [], aiRevealed = false;
    let lastTurnTok = '', chatSeen = {}, chatMsg = {}, chatTimers = {}, splats = {}, lastEggK = '', lastEggAt = 0;
    let sendTimes = [], coolUntil = 0, lastResolveTry = 0, lastAutoTry = 0;
    const myName = () => (playerNameInput.value || playerName || '訪客').trim();

    const root = document.createElement('div');
    root.id = 'mj-screen'; root.className = 'mj hidden';
    root.innerHTML = '<div class="mj-rot">📱 請將手機橫放，才能玩英文麻將</div><div id="mj-body"></div><div id="mj-toast"></div><div id="mj-hint"></div><div id="mj-myturn">你的回合</div><div id="mj-chatpop" class="hidden"></div><div id="mj-search" class="hidden"></div><div id="mj-settings" class="hidden"></div>';
    document.body.appendChild(root);
    const body = root.querySelector('#mj-body');
    const hint = m => { const h = $('mj-hint'); if (!h) return; h.textContent = m; h.classList.add('on'); clearTimeout(hint.t); hint.t = setTimeout(() => h.classList.remove('on'), 2800); };
    const toast = m => { const t = $('mj-toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); };
    const pl = s => Object.values((room && room.players) || {}).find(x => x.seat === s) || {};
    const seatName = s => pl(s).name || '玩家' + (s + 1);
    const meldsOf = s => Object.values((room && room.melds && room.melds[s]) || {});
    const letterOf = id => id === 'D' ? (room && room.last ? room.last.ch : '?') : tiles[id];
    const wordOf = ids => ids.map(letterOf).join('');
    const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

    // ---------- 本機模擬的房間（單人練習用，介面與 Firebase ref 相同）----------
    function localRef(init) {
        let L = init, ls = [];
        const clone = x => x === undefined ? x : JSON.parse(JSON.stringify(x));
        const notify = () => setTimeout(() => ls.forEach(f => f({ val: () => clone(L) })), 0);
        const setPath = (p, v) => {
            const ks = p.split('/'); let o = L;
            for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
            const k = ks[ks.length - 1]; if (v == null) delete o[k]; else o[k] = v;
        };
        return {
            on: (e, f) => { ls.push(f); notify(); }, off: () => { ls = []; },
            update: u => { Object.entries(u).forEach(([k, v]) => setPath(k, clone(v))); notify(); },
            remove: () => { L = null; notify(); },
            child: p => ({
                set: v => { setPath(p, clone(v)); notify(); return Promise.resolve(); },
                remove: () => { setPath(p, null); notify(); },
                onDisconnect: () => ({ remove() { }, cancel() { } })
            }),
            transaction: (fn, cb) => {
                const r = fn(clone(L)), ok = r !== undefined;
                if (ok) { L = r; notify(); }
                if (cb) cb(null, ok);
            }
        };
    }

    // ---------- 進出 ----------
    let lowerCase = localStorage.getItem('mj_lowercase') === '1';
    const applyCase = () => root.classList.toggle('lc', lowerCase);
    // 進入麻將模式自動全螢幕（瀏覽器規定必須在點擊當下呼叫；iPhone Safari 不支援網頁全螢幕，會自動略過）
    let fsByMj = false;
    function goFull() {
        try {
            const el = document.documentElement;
            if (document.fullscreenElement || document.webkitFullscreenElement) return;
            const f = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen; if (!f) return;
            const lock = () => { fsByMj = true; try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } };
            const r = f.call(el);
            if (r && r.then) r.then(lock).catch(() => { }); else lock();
        } catch (e) { }
    }
    function leaveFull() {
        if (!fsByMj) return; fsByMj = false;
        try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { }
        try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => { }); else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch (e) { }
    }
    function open() { goFull(); root.classList.remove('hidden'); buildDict(); applyCase(); loadSamples(); if (!ref) renderNotice(); }
    function stopTimers() {
        clearInterval(cdTimer); clearTimeout(resolveTimer);
        aiTimers.forEach(clearTimeout); aiTimers = []; aiDone = new Set();
    }
    function cleanup() {
        if (drag) { const d = drag; drag = null; if (d.on) dropGhost(d); }
        introToken++; introing = false; root.querySelectorAll('.mj-intro,.mj-fly').forEach(x => x.remove());
        if (ref) ref.off(); ref = null; room = null; mySeat = -1; curRound = null; solo = false; cm = null; pending = null;
        stopTimers(); chatMsg = {}; splats = {}; lastTurnTok = ''; chatSeen = {}; $('mj-chatpop').classList.add('hidden'); $('mj-search').classList.add('hidden'); $('mj-settings').classList.add('hidden'); root.classList.remove('in-game'); renderMenu();
    }
    function leave() {
        if (ref && room && !solo) {
            if (room.host === key) ref.remove();
            else if (room.status === 'playing') ref.update({ status: 'ended', result: { aborted: true, name: myName() } });
            else ref.child('players/' + key).remove();
        }
        cleanup();
    }
    function close() { if (ref) leave(); leaveFull(); root.classList.add('hidden'); showScreen('lobby'); showMenu('main'); }

    const cdValue = () => { // 倒數秒數；單人組牌不限時顯示 ∞
        const hasClaim = room.claims && Object.keys(room.claims).length;
        const ms = (hasClaim ? room.claimEnd : room.claimBase) - now();
        return ms > 6e5 ? '∞' : Math.max(0, Math.ceil(ms / 1000));
    };
    function startCountdown() { clearInterval(cdTimer); cdTimer = setInterval(heartbeat, 100); }
    function heartbeat() { // 每 0.1 秒：倒數文字、頭像計時圈、保險機制（避免卡住）
        if (!room || !ref) return;
        const el = $('mj-cd'); if (el && room.phase === 'claim') el.textContent = cdValue();
        safe(updateRings);
        if (room.status !== 'playing' || introing) return;
        safe(watchdogs);
    }
    function updateRings() {
        const sec = turnSecOf();
        root.querySelectorAll('.mj-ring[data-s],.mj-sec[data-s]').forEach(el => {
            const s = +el.dataset.s; let p = 100, label = '', red = false;
            if (room.phase === 'discard' && room.turn === s && room.turnEnd && sec) {
                const left = Math.max(0, room.turnEnd - now()); p = Math.min(100, left / (sec * 10)); label = Math.ceil(left / 1000); red = left <= Math.min(5000, sec * 300);
            }
            if (el.classList.contains('mj-ring')) { el.style.setProperty('--p', p + '%'); el.classList.toggle('red', red); }
            else { el.textContent = label; el.classList.toggle('red', red); }
        });
    }
    function watchdogs() {
        const t = now();
        if (room.phase === 'claim' && room.last) { // 不只房主：任何人都能在逾時後結算這一輪（房主分頁被凍結時也不會卡住）
            const cs = Object.values(room.claims || {}), allDone = cs.length > 0 && cs.every(c => c.done);
            const at = !cs.length ? room.claimBase : allDone ? room.claimBase : room.claimEnd;
            const th = solo ? 300 : room.host === key ? 700 : 1800 + mySeat * 350;
            if (t - at > th && t - lastResolveTry > 1500) { lastResolveTry = t; resolve(room.last.n); }
        }
        maybeDraw();
        autoTurn();
    }
    function maybeDraw() {
        if (room.status === 'playing' && room.phase === 'draw' && room.turn === mySeat && !introing && now() >= (room.introEnd || 0))
            draw(mySeat, ch => { addTile(ch); drawnId = nextId - 1; drawFly = true; selfDraw = true; sfx('draw'); render(); if (funOn() && ch === room.gold) { toast(`🌟 摸到金牌字母 ${ch.toUpperCase()}！胡牌有加台`); confetti(['🌟', '✨'], 18); } });
    }
    function autoTurn() { // 每回合限時：時間到自動出牌（優先打剛摸到的牌）
        const sec = turnSecOf();
        if (!sec || room.phase !== 'discard' || room.turn !== mySeat || !room.turnEnd || cm || now() < room.turnEnd || hand.length + meldsOf(mySeat).reduce((a, w) => a + w.length, 0) !== 17) return;
        const t = Date.now(); if (t - lastAutoTry < 1500) return; lastAutoTry = t;
        if (drag) abortDrag();
        const id = drawnId && hand.includes(drawnId) ? drawnId : (split(hand).rest.slice(-1)[0] ?? hand[hand.length - 1]);
        hint('⏰ 時間到，自動出牌'); discardTile(id);
    }
    function enter(c) {
        solo = false; code = c; ref = db.ref('mj/' + c);
        ref.child('players/' + key).onDisconnect().remove();
        ref.on('value', onRoom);
        sendAvatar(); syncCode();
        startCountdown();
    }
    function sendAvatar() {
        if (typeof Profile !== 'undefined' && Profile.getThumb) {
            const r0 = ref;
            Profile.getThumb().then(av => { if (av && r0 === ref) r0.child('players/' + key + '/avatar').set(av); }).catch(() => { });
        }
    }
    const myCode = () => (typeof Friends !== 'undefined' && Friends.getCode && Friends.getCode()) || '';
    function syncCode(n = 0) { // 把自己的好友代碼放進房間資料，別人點頭像才能加好友
        const c = myCode(), r0 = ref; if (!r0 || solo) return;
        if (c) r0.child('players/' + key + '/code').set(c); else if (n < 8) setTimeout(() => { if (r0 === ref) syncCode(n + 1); }, 1500);
    }
    function create() {
        key = safeKey(myName());
        const c = String(Math.floor(1000 + Math.random() * 9000)), r = db.ref('mj/' + c);
        r.transaction(cur => cur ? undefined : { host: key, status: 'lobby', cfg: { allow3: true, allow4: true, fun: false, money: false, turnSec: 30 }, players: { [key]: { name: myName(), seat: 0, ready: true, code: myCode() } } },
            (err, ok) => ok ? enter(c) : toast('建立失敗，請再試一次'));
    }
    function join() { joinCode(($('mj-code').value || '').trim()); }
    function joinByCode(c) { // 好友邀請：直接加入對方的麻將房間
        goFull(); root.classList.remove('hidden'); buildDict(); applyCase(); loadSamples();
        if (ref && room) {
            if (code === c) return;
            if (room.status === 'playing') return toast('你正在麻將對局中，無法加入其他房間');
            if (!confirm('要離開目前的麻將房間並加入好友的房間嗎？')) return;
            leave();
        }
        joinCode(c);
    }
    function joinCode(c) {
        key = safeKey(myName());
        if (c.length !== 4) return toast('請輸入 4 碼房間代碼');
        const r = db.ref('mj/' + c);
        r.once('value', s => {
            if (!s.exists()) return toast('找不到房間');
            const v = s.val(); if (v.status === 'playing') return toast('該房間已開始遊戲');
            r.child('players').transaction(p => {
                p = p || {};
                if (p[key] || Object.keys(p).length >= MAX_P) return;
                const used = Object.values(p).map(x => x.seat);
                let seat = 0; while (used.includes(seat)) seat++;
                p[key] = { name: myName(), seat, ready: false, code: myCode() };
                if (v.status === 'ended') p[key].back = v.round; // 上一局剛結束：直接進入房間畫面
                return p;
            }, (err, ok) => { if (ok) { r.child('kicked/' + key).remove(); enter(c); } else toast('無法加入（房間已滿或暱稱重複）'); });
        });
    }

    // ---------- 開局 ----------
    function makeDeck() {
        const deck = [];
        Object.entries(DIST).forEach(([c, n]) => { for (let i = 0; i < n; i++) deck.push(c); });
        for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[deck[i], deck[j]] = [deck[j], deck[i]]; }
        return deck;
    }
    function rollDice(np = 4) { // 每人擲兩顆骰子，點數最大者先開始；同點者再擲，直到只剩一人（結果事先算好，大家看到的一樣）
        const r6 = () => 1 + Math.floor(Math.random() * 6);
        let con = Array.from({ length: np }, (_, i) => i); const rounds = [];
        for (let k = 0; k < 10; k++) {
            const dice = con.map(() => [r6(), r6()]), sums = dice.map(d => d[0] + d[1]), mx = Math.max(...sums);
            rounds.push({ seats: con.slice(), dice });
            con = con.filter((s, i) => sums[i] === mx);
            if (con.length === 1) break;
        }
        return { rounds, start: con[0] };
    }
    const introLen = n => 2550 + n * 2300 + 1500 + 3150 + 1700; // 開場動畫大約多久（讓首位玩家等大家都播完才摸牌）
    const freshFields = { claims: null, claimed: null, melds: null, result: null, tings: null, reveal: null, last: null, chat: null, egg: null, pile: '', n: 0, claimEnd: 0, claimBase: 0, claimExt: false, turnEnd: 0, startAt: 0, introEnd: 0, shufAt: 0, gold: '', phase: 'draw' };
    function startGame() { // 多人：房主
        const ents = Object.entries(room.players || {}).sort((a, b) => a[1].seat - b[1].seat), np = ents.length;
        if (np < MIN_P || np > MAX_P) return toast('需要 2~6 位玩家才能開始');
        if (ents.some(([k, p]) => k !== room.host && (!p.ready || (room.status === 'ended' && p.back !== room.round)))) return toast('還有玩家沒準備好');
        const deck = makeDeck(), hands = {}, u = {}, gold = room.cfg && room.cfg.fun ? deck[Math.floor(Math.random() * deck.length)] : '';
        for (let s = 0; s < np; s++) hands[s] = deck.splice(0, 16).join('');
        ents.forEach(([k], i) => { u['players/' + k + '/seat'] = i; }); // 座位重新排成 0 ~ np-1
        const startAt = now() + 1500;
        ref.update({ ...u, ...freshFields, np, status: 'playing', round: Date.now(), deck: deck.join(''), hands, counts: Array(np).fill(16), gold, turn: -1, phase: 'dice', dice: { rd: 0, seats: ents.map((_, i) => i), rolls: null, hist: null }, shufAt: 0, startAt, introEnd: 0 });
    }
    function startSolo() { // 單人：我 + 3 位 AI（名字隨機）
        buildDict();
        if (ref) ref.off();
        if (drag) { const d = drag; drag = null; if (d.on) dropGhost(d); }
        stopTimers(); introToken++; aiRevealed = false; chatMsg = {}; splats = {}; lastTurnTok = '';
        key = safeKey(myName());
        const mine = myName().toLowerCase();
        const pool = AI_NAMES.filter(n => n.toLowerCase() !== mine).sort(() => Math.random() - .5).slice(0, 3);
        const deck = makeDeck(), hs = [], d = rollDice(4), gold = soloCfg.fun ? deck[Math.floor(Math.random() * deck.length)] : '';
        for (let s = 0; s < 4; s++) hs.push(deck.splice(0, 16));
        aiHands = { 1: hs[1], 2: hs[2], 3: hs[3] }; aiPending = {}; aiTing = {};
        const players = { [key]: { name: myName(), seat: 0, ready: true } };
        pool.forEach((n, i) => { players['ai' + (i + 1)] = { name: n, seat: i + 1, ai: true, ready: true }; });
        solo = true; code = 'SOLO'; curRound = null;
        ref = localRef({ ...freshFields, host: key, np: 4, cfg: { allow3: soloCfg.allow3, allow4: soloCfg.allow4, turnSec: 0, fun: !!soloCfg.fun }, gold, status: 'playing', round: Date.now(), players, deck: deck.join(''), hands: { 0: hs[0].join('') }, counts: [16, 16, 16, 16], turn: d.start, dice: d.rounds });
        ref.on('value', onRoom);
        sendAvatar();
        startCountdown();
    }

    // ---------- 房間監聽 ----------
    function callout(seat, text, ms = 1500) {
        callouts[seat] = text; render();
        setTimeout(() => { if (callouts[seat] === text) { delete callouts[seat]; render(); } }, ms);
    }
    function endClaimMode(restore) {
        if (cm && restore) cm.items.filter(i => i !== 'D').forEach(i => { if (!hand.includes(i)) hand.push(i); }); // 沒碰成：組牌區的手牌放回手牌區
        cm = null; pending = null;
    }
    function onRoom(snap) {
        room = snap.val();
        if (!room) { toast('房間已關閉'); return cleanup(); }
        const me = room.players && room.players[key];
        if (!me) { toast(room.kicked && room.kicked[key] ? '你被房主請出房間了' : '你已不在房間'); return cleanup(); }
        mySeat = me.seat;
        if (room.status === 'lobby' || (room.status === 'ended' && me.back === room.round)) { root.classList.remove('in-game'); return render(); } // 房間畫面（結束後每位玩家各自按「回到房間」）
        root.classList.add('in-game');
        if (!solo) ref.child('players/' + key).onDisconnect().cancel();

        if (room.round !== curRound && room.status === 'playing') { // 新的一局：領取自己的 16 張
            curRound = room.round; tiles = {}; nextId = 1; hand = []; drawnId = null; drawFly = false; selfDraw = false;
            cm = null; pending = null; claimBlockedN = 0; callouts = {}; tingSeen = new Set(); revealSent = false; waitCache = { k: '', v: [] };
            drawing = false; lastClaimN = 0; resolvedFor = ''; lastSpokenN = 0; chatMsg = {}; chatSeen = {}; splats = {}; lastTurnTok = '';
            const doIntro = !room.n && (room.phase === 'draw' || room.phase === 'dice');
            introToken++; introing = doIntro; // 先標記「開場中」：下面 remove() 會同步觸發本機事件，若沒先標記，輪到的第一位玩家會在開場動畫前就偷摸牌（舊版 bug）
            ((room.hands && room.hands[mySeat]) || '').split('').filter(Boolean).forEach(addTile);
            ref.child('hands/' + mySeat).remove();
            if (doIntro) playIntro();
        }
        safe(() => {
            if (room.last && room.last.n !== lastSpokenN && room.phase === 'claim') { // 打出的牌：音效 + 朗讀字母
                lastSpokenN = room.last.n; sfx('discard'); speakWord(SAY[room.last.ch] || room.last.ch);
                if (funOn() && room.last.n % 8 === 0) { const ev = FUN_EV[(room.last.n / 8) % FUN_EV.length]; hint(`${ev[0]} ${ev[1]}！`); confetti([ev[0]], 24); }
            }
        });
        safe(() => Object.keys(room.tings || {}).forEach(s => { // 有人宣告聽牌
            if (tingSeen.has(s)) return; tingSeen.add(s);
            if (+s !== mySeat) toast(`${seatName(+s)} 聽牌了！`);
            sfx('ting'); speakWord('ready hand');
        }));
        safe(() => {
            if (room.claimed && room.claimed.n !== lastClaimN) { // 碰牌結果
                const cl = room.claimed; lastClaimN = cl.n;
                if (cl.seat === mySeat && pending && pending.n === cl.n) { cm = null; pending = null; drawnId = null; selfDraw = false; toast('✋ 碰成功！請打出一張牌'); if (typeof Profile !== 'undefined' && Profile.mjRecord) Profile.mjRecord({ type: 'pong' }); }
                else { if (cm && cm.n === cl.n) endClaimMode(true); if (cl.seat !== mySeat) toast(`${seatName(cl.seat)} 碰：${cl.word.toUpperCase()}`); }
                sfx('claim'); speakWord('bang'); callout(cl.seat, '碰');
                if (solo && aiPending[cl.seat] && aiPending[cl.seat].n === cl.n) {
                    const h = aiHands[cl.seat]; aiPending[cl.seat].used.forEach(ch => { const k = h.indexOf(ch); if (k >= 0) h.splice(k, 1); });
                }
                aiPending = {};
            }
        });
        if (cm && (room.phase !== 'claim' || !room.last || room.last.n !== cm.n)) endClaimMode(true); // 這一輪碰牌結束（沒碰成）
        if (pending && (!room.last || pending.n !== room.last.n)) pending = null;
        if (diceUI) safe(diceUI.update);
        safe(() => { // 快捷交流 / 丟雞蛋（全部玩家都看得到）
            const ch = room.chat || {};
            Object.keys(ch).forEach(s => { const c = ch[s]; if (!c || chatSeen[s] === c.k) return; chatSeen[s] = c.k; if (now() - (c.ts || 0) < 4000 && chatAll()[c.i]) showChat(+s, chatAll()[c.i]); });
            const e = room.egg; if (e && e.k !== lastEggK) { lastEggK = e.k; if (now() - (e.ts || 0) < 4000 && room.status === 'playing') throwEgg(e.from, e.to, e.e | 0); }
        });

        if (room.status !== 'playing' && drag) { const d = drag; drag = null; if (d.on) dropGhost(d); }
        if (room.status === 'ended') safe(onEnded);
        if (room.status === 'playing') {
            safe(maybeDraw);
            safe(scheduleResolve);
            safe(syncTing);
            safe(showMyTurn);
            if (solo && !introing) safe(aiDrive);
        }
        render();
    }
    let diceUI = null;
    function rollMine() { // 手動擲骰：每位玩家各按一次
        const r6 = () => 1 + Math.floor(Math.random() * 6);
        ref.child('dice').transaction(d => {
            if (!d || !d.seats || !d.seats.includes(mySeat)) return;
            d.rolls = d.rolls || {}; if (d.rolls['s' + mySeat]) return;
            d.rolls['s' + mySeat] = [r6(), r6()]; return d;
        });
    }
    function resolveDice() { // 全部擲完後比大小；同點者再擲，直到只剩一人，才進入洗牌與發牌
        ref.transaction(r => {
            if (!r || r.phase !== 'dice' || !r.dice || !r.dice.rolls) return;
            const d = r.dice; if (!d.seats.every(s => d.rolls['s' + s])) return;
            const sum = s => d.rolls['s' + s][0] + d.rolls['s' + s][1], mx = Math.max(...d.seats.map(sum)), tops = d.seats.filter(s => sum(s) === mx);
            const hist = d.hist || []; hist.push({ seats: d.seats, tops }); d.hist = hist;
            if (tops.length === 1) { r.turn = tops[0]; r.phase = 'draw'; r.shufAt = now() + 1800; r.introEnd = r.shufAt + 3150 + 1700; }
            else { d.seats = tops; d.rolls = null; d.rd = (d.rd || 0) + 1; }
            return r;
        });
    }
    const FUN_EV = [['🍬', '糖果雨'], ['🎈', '氣球派對'], ['🌸', '櫻花紛飛'], ['⭐', '流星雨'], ['🍕', '披薩雨'], ['🐥', '小雞大遊行']];
    function confetti(list, n = 26) { // 娛樂模式：表情雨
        for (let i = 0; i < n; i++) {
            const e = document.createElement('div'); e.className = 'mj-conf'; e.textContent = list[i % list.length];
            e.style.left = (Math.random() * 96) + '%'; e.style.fontSize = (18 + Math.random() * 18) + 'px'; root.appendChild(e);
            const dur = 1800 + Math.random() * 1800, dx = (Math.random() - .5) * 80;
            const a = e.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${dx}px, ${root.clientHeight + 60}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: .9 }], { duration: dur, delay: Math.random() * 500, easing: 'ease-in', fill: 'forwards' });
            a.onfinish = () => e.remove();
        }
    }
    function showMyTurn() { // 輪到自己：畫面中央大字「你的回合」約 2 秒
        if (introing || room.turn !== mySeat || (room.phase !== 'draw' && room.phase !== 'discard')) return;
        const tok = room.round + '|' + room.n + '|' + room.turn; if (tok === lastTurnTok) return; lastTurnTok = tok;
        const el = $('mj-myturn'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); sfx('turn');
        clearTimeout(showMyTurn.t); showMyTurn.t = setTimeout(() => el.classList.remove('on'), 2100);
    }
    function showChat(seat, text) {
        chatMsg[seat] = text; clearTimeout(chatTimers[seat]);
        chatTimers[seat] = setTimeout(() => { delete chatMsg[seat]; render(); }, 2500); render();
    }
    function sendChat(i) { // 5 秒內最多 8 則，超過要冷卻 3 秒
        const t = Date.now();
        if (t < coolUntil) return toast(`發送太快了，請等 ${Math.ceil((coolUntil - t) / 1000)} 秒`);
        sendTimes = sendTimes.filter(x => t - x < 5000);
        if (sendTimes.length >= 8) { coolUntil = t + 3000; sendTimes = []; return toast('發送太快了，冷卻 3 秒'); }
        sendTimes.push(t);
        ref.child('chat/' + mySeat).set({ i, k: key + t, ts: now() });
        $('mj-chatpop').classList.add('hidden');
    }
    function sendEgg(to) {
        if (Date.now() - lastEggAt < 900) return; lastEggAt = Date.now();
        ref.child('egg').set({ from: mySeat, to, e: window.Economy ? Economy.throwIdx() : 0, k: key + Date.now(), ts: now() });
    }
    function throwEgg(from, to, emo) { // 雞蛋從丟的人飛到被丟的人頭像（純娛樂，沒有任何效果）
        const a = root.querySelector(`.mj-avw[data-s="${from}"]`), b = root.querySelector(`.mj-avw[data-s="${to}"]`); if (!a || !b) return;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const sx = ra.left + ra.width / 2, sy = ra.top + ra.height / 2, tx = rb.left + rb.width / 2, ty = rb.top + rb.height / 2;
        const e = document.createElement('div'); const th = TH(emo); e.className = 'mj-egg'; e.textContent = th.e; root.appendChild(e); sfx('throw');
        const pos = (x, y, r) => `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${r}deg)`;
        const an = e.animate([{ transform: pos(sx, sy, 0) }, { transform: pos((sx + tx) / 2, Math.min(sy, ty) - 80, 360) }, { transform: pos(tx, ty, 720) }], { duration: 700, easing: 'ease-in-out', fill: 'forwards' });
        an.onfinish = () => {
            e.remove(); sfx('splat'); splats[to] = th; render();
            setTimeout(() => { delete splats[to]; render(); }, 2600);
        };
    }
    function openSearch() {
        const p = $('mj-search');
        p.innerHTML = `<div class="mj-cp-in"><div class="mj-cp-h">🔍 查單字</div>
            <div class="mj-note-l" style="text-align:center;margin-bottom:6px">拼對了但沒變綠？輸入你拼的單字，確認存在就會加入合法單字</div>
            <div class="mj-sr"><input id="mj-sq" type="text" maxlength="24" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="輸入英文單字"><button class="btn btn-primary" id="mj-sgo">查詢</button></div>
            <div id="mj-smsg" class="mj-smsg"></div></div>`;
        p.classList.remove('hidden');
        const q = $('mj-sq'); setTimeout(() => q.focus(), 50);
        const go = () => lookupWord(q.value);
        $('mj-sgo').onclick = () => { playClickSound(); go(); };
        q.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    }
    async function lookupWord(raw) {
        const m = $('mj-smsg'), w = String(raw || '').trim().toLowerCase();
        if (!/^[a-z]{3,}$/.test(w)) { m.className = 'mj-smsg err'; m.textContent = '請輸入 3 個字母以上的英文單字'; return; }
        if (!lenOk(w, true)) { m.className = 'mj-smsg err'; m.textContent = `這個房間設定不允許 ${w.length} 個字母的單字`; return; }
        if (dict.has(w)) { m.className = 'mj-smsg ok'; m.textContent = `✅ ${w.toUpperCase()} 本來就在單字庫裡了`; return; }
        m.className = 'mj-smsg'; m.textContent = '查詢中…';
        try {
            const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(w));
            if (res.status === 404) { m.className = 'mj-smsg err'; m.textContent = '沒有這個字 你拚對了嗎'; return; }
            if (!res.ok) throw new Error(res.status);
            learnWord(w); if (window.Economy) Economy.onWord();
            let cloud = true;
            try { await db.ref('mjWords/' + w).set({ by: myName(), ts: firebase.database.ServerValue.TIMESTAMP }); } catch (e) { cloud = false; }
            try { const L = JSON.parse(localStorage.getItem('mjLearned') || '[]'); if (!L.includes(w)) { L.push(w); localStorage.setItem('mjLearned', JSON.stringify(L.slice(-300))); } } catch (e) { }
            m.className = 'mj-smsg ok'; m.textContent = cloud ? `✅ ${w.toUpperCase()} 存在！已加入麻將單字庫，所有玩家都能用` : `✅ ${w.toUpperCase()} 存在！已加入你的單字庫（雲端寫入失敗，只有你能用）`;
        } catch (e) { m.className = 'mj-smsg err'; m.textContent = '查詢失敗，請檢查網路連線'; }
    }
    function openSettings() { // 設定彈跳面板：單人練習規則 + 要丟的東西
        const p = $('mj-settings'), E = window.Economy;
        const ths = E ? E.THROWS.map((t, i) => { const have = E.owned(t.id), on = E.equipped('throw') === t.id;
            return `<button class="mj-th ${on ? 'on' : ''} ${have ? '' : 'lock'}" data-th="${t.id}" title="${have ? '' : '到商店購買'}"><span>${t.e}</span><b>${esc(t.name)}</b><i>${on ? '使用中' : have ? '點擊裝備' : '🔒 🪙' + t.price}</i></button>`; }).join('') : '';
        p.innerHTML = `<div class="mj-cp-in mj-set"><div class="mj-cp-h">⚙️ 設定 <button class="mj-set-x" data-x="1">✕</button></div>
            <div class="mj-set-sec"><b>🤖 單人練習規則</b>
                <label class="mj-sw"><input type="checkbox" id="mj-s3" ${soloCfg.allow3 ? 'checked' : ''}><span>允許三個字母的單字</span></label>
                <label class="mj-sw"><input type="checkbox" id="mj-s4" ${soloCfg.allow4 ? 'checked' : ''}><span>允許四個字母的單字</span></label></div>
            <div class="mj-set-sec"><b>🎯 要丟的東西（局內點對手頭像）</b><div class="mj-th-grid">${ths}</div>
                <button class="btn btn-secondary" data-shop="1" style="margin-top:6px">🛒 去商店買更多</button></div>
            <button class="btn btn-primary" data-x="1">完成</button></div>`;
        p.classList.remove('hidden');
    }
    function openChat() {
        const p = $('mj-chatpop');
        p.innerHTML = `<div class="mj-cp-in"><div class="mj-cp-h">💬 快捷交流</div><div class="mj-cp-grid">${chatAvail().map(i => `<button data-chat="${i}">${esc(chatAll()[i])}</button>`).join('')}</div></div>`;
        p.classList.remove('hidden');
    }
    function openPlayerCard(pk) { // 房間裡點頭像 → 加好友
        const p = room && room.players && room.players[pk]; if (!p) return;
        if (pk === key) return toast('這是你自己');
        if (typeof Friends !== 'undefined' && Friends.openCard) Friends.openCard({ code: p.code, name: p.name, avatar: p.avatar });
    }
    function onEnded() {
        const res = room.result || {};
        if (!res.aborted && winSfxRound !== room.round) {
            winSfxRound = room.round;
            if (window.Economy) { const cc = coinCalc(res.draw ? { draw: true } : res); Economy.add(cc.total < 0 ? Math.max(cc.total, -Economy.coins()) : cc.total, '麻將金幣結算'); }
            if (res.draw) { if (typeof Profile !== 'undefined' && Profile.mjRecord) Profile.mjRecord({ type: 'end', win: false }); return finishEnded(); }
            // 贏家聽到 win（自摸則 touch myself），其他玩家聽到 game over
            if (res.seat === mySeat) { speakWord(res.self ? 'touch myself' : 'win'); sfx('win'); }
            else { speakWord('game over'); sfx('ting'); }
            if (funOn()) confetti(res.seat === mySeat ? ['🎉', '🎊', '✨'] : ['🎊'], 40);
            if (typeof Profile !== 'undefined' && Profile.mjRecord) {
                const win = res.seat === mySeat;
                if (win && res.tai > 0 && (!solo || aiLevel !== 'easy') && typeof uploadRecord === 'function' && typeof mjRef !== 'undefined') uploadRecord(mjRef, myName(), res.tai); // 麻將台數榜（單人簡單難度不計）
                Profile.mjRecord({ type: 'end', win, self: win && !!res.self, ron: win && !res.self && res.from != null, special: win && !!res.special, solo, tai: win ? res.tai : 0, longest: win ? Math.max(0, ...(res.words || []).map(w => w.length)) : 0 });
            }
        }
        finishEnded();
    }
    function finishEnded() {
        const res = room.result || {};
        if (cm) endClaimMode(true);
        if (!revealSent && !res.aborted) { // 結算時每位玩家亮出自己的手牌
            revealSent = true; ref.child('reveal/' + mySeat).set(hand.map(i => tiles[i]).join('') || '-');
        }
        if (solo && !aiRevealed && room.host === key) {
            aiRevealed = true; const u = {};
            [1, 2, 3].forEach(s => { u['reveal/' + s] = (aiHands[s] || []).join('') || '-'; }); ref.update(u);
        }
    }
    function scheduleResolve() { // 房主：沒人碰 → 倒數結束換人；有人碰 → 全部送出或時間到才結算
        if (room.phase !== 'claim' || !room.last || room.host !== key) return;
        const cs = Object.values(room.claims || {}), allDone = cs.length > 0 && cs.every(c => c.done);
        const at = !cs.length ? room.claimBase : allDone ? Math.max(room.claimBase, now()) : room.claimEnd;
        const tag = `${room.round}_${room.last.n}_${cs.length}_${allDone ? 1 : 0}_${room.claimEnd}`;
        if (resolvedFor === tag) return;
        resolvedFor = tag; clearTimeout(resolveTimer); const n = room.last.n;
        resolveTimer = setTimeout(() => resolve(n), Math.max(0, at - now()) + (solo ? 100 : 350));
    }

    // ---------- 動作（交易，確保多人同步）----------
    let drawing = false;
    function addTile(ch) { const id = nextId++; tiles[id] = ch; hand.push(id); }
    function draw(seat, cb) {
        if (seat === mySeat) { if (drawing) return; drawing = true; }
        let ch = null;
        ref.transaction(r => {
            ch = null;
            if (!r || r.status !== 'playing' || r.phase !== 'draw' || r.turn !== seat) return;
            const d = r.deck || '';
            if (!d.length) { r.status = 'ended'; r.result = { draw: true }; return r; }
            const sec = (r.cfg && +r.cfg.turnSec) || 0;
            ch = d[0]; r.deck = d.slice(1); r.counts[seat] = 17; r.phase = 'discard'; r.turnEnd = sec ? now() + sec * 1000 : 0; return r;
        }, (err, ok) => { if (seat === mySeat) drawing = false; if (ok && ch) cb(ch); });
    }
    function doDiscard(seat, ch, cb, hold) { // hold：打完牌後自己的手牌已可胡 → 給足時間按胡
        let done = false;
        ref.transaction(r => {
            done = false;
            if (!r || r.phase !== 'discard' || r.turn !== seat) return;
            const base = now() + (!hold && solo && seat === 0 ? QUICK_MS : CLAIM_MS);
            r.n = (r.n || 0) + 1; r.last = { ch, by: seat, n: r.n }; r.pile = (r.pile || '') + seat + ch;
            r.phase = 'claim'; r.claimBase = base; r.claimEnd = base; r.claimExt = false; r.claims = null; r.turnEnd = 0; r.counts[seat] = 16; done = true; return r;
        }, () => { if (cb) cb(done); });
    }
    // 特殊胡：出牌後剩下的手牌全部是合法單字組（或剩兩張剛好是二字母單字，台數大幅降低）→ 可按「胡」
    function specialOf(ids) {
        if (!dict) return null;
        const sp = split(ids);
        if (!sp.rest.length && (sp.segs.length || meldsOf(mySeat).length)) return { words: sp.segs.map(s => s.w), two: false };
        const rw2 = wordOf(sp.rest);
        if (sp.rest.length === 2 && dict2.has(rw2)) return { words: [...sp.segs.map(s => s.w), rw2], two: true };
        return null;
    }
    // 手牌（不含已碰的牌）共 16 張邏輯張數且全是合法單字組 → 隨時（包含別人的回合）都可以按胡
    const specialReady = () => room && room.status === 'playing' && room.phase !== 'dice' && room.counts && room.counts[mySeat] === 16 && !cm && !introing ? specialOf(hand) : null;
    function discardTile(id) {
        if (!room || room.phase !== 'discard' || room.turn !== mySeat || !hand.includes(id)) return false;
        const ch = tiles[id], was = drawnId, wasSelf = selfDraw;
        hand = hand.filter(i => i !== id); drawnId = null; selfDraw = false; // 先從手牌拿掉，避免畫面閃一下
        const hold = !!specialOf(hand); // 不自動胡：只是讓「胡」按鈕亮起、並延長可按的時間
        doDiscard(mySeat, ch, ok => { if (!ok) { hand.push(id); drawnId = was; selfDraw = wasSelf; render(); } }, hold);
        return true;
    }
    function pressFor(seat, cb) { // 按下「碰」：登記進入組牌；第一位按碰的人會讓總倒數 +8 秒（只加一次）
        const n = room.last.n;
        ref.transaction(r => {
            if (!r || r.phase !== 'claim' || !r.last || r.last.n !== n || now() > r.claimBase) return;
            r.claims = r.claims || {};
            if (r.claims[seat]) return;
            r.claims[seat] = { w: '', done: false };
            if (!r.claimExt) { r.claimExt = true; r.claimEnd = r.claimBase + (solo && seat === mySeat ? 36e5 : EXT_MS); } // 單人練習：你組牌不限時（1 小時視為無限）
            return r;
        }, (err, ok) => cb && cb(ok));
    }
    function resolve(n) { // 結算碰牌（最長單字優先；同長則離打牌者最近者優先）。任何玩家都可觸發，交易確保只結算一次
        ref.transaction(r => {
            if (!r || r.phase !== 'claim' || !r.last || r.last.n !== n) return;
            const np = r.np || 4, sec = (r.cfg && +r.cfg.turnSec) || 0;
            let best = null;
            Object.entries(r.claims || {}).forEach(([s, c]) => {
                if (!c || !c.done || !c.w) return;
                s = +s; const d = (s - r.last.by + np) % np;
                if (!best || c.w.length > best.w.length || (c.w.length === best.w.length && d < best.d)) best = { s, w: c.w, d };
            });
            if (best) {
                r.turn = best.s; r.phase = 'discard'; r.pile = r.pile.slice(0, -2); r.counts[best.s] = 17; r.turnEnd = sec ? now() + sec * 1000 : 0;
                const old = Object.values((r.melds && r.melds[best.s]) || {}); old.push(best.w);
                r.melds = r.melds || {}; r.melds[best.s] = old; r.claimed = { seat: best.s, word: best.w, n };
            } else { r.turn = (r.last.by + 1) % np; r.phase = 'draw'; }
            r.claims = null; r.claimExt = false; return r;
        });
    }

    // ---------- 手動碰牌：按「碰」→ 中央組牌區 → 和被打出的牌組成單字 → ✓ 送出 ----------
    const canPress = () => !!room && room.status === 'playing' && room.phase === 'claim' && !!room.last && room.last.by !== mySeat
        && now() < room.claimBase && !cm && claimBlockedN !== room.last.n && !introing;
    function pressClaim() {
        if (!canPress()) return;
        const n = room.last.n;
        pressFor(mySeat, ok => { if (ok) { cm = { n, items: ['D'], sent: false }; sfx('pick'); render(); } else toast('來不及了'); });
    }
    function cancelClaim() { // 取消：把組牌區裡的手牌放回手牌區；這一輪不能再按碰
        if (!cm) return;
        ref.child('claims/' + mySeat).remove();
        claimBlockedN = cm.n; endClaimMode(true); sfx('drop'); render();
    }
    function submitCompose() {
        if (!cm || cm.sent) return;
        const w = wordOf(cm.items);
        if (!isWordG(w)) return toast('還不是合法單字');
        ref.child('claims/' + mySeat).set({ w, done: true });
        cm.sent = true; pending = { n: cm.n, ids: cm.items.filter(i => i !== 'D'), word: w };
        sfx('claim'); toast(`已送出：${w.toUpperCase()}，等待結算…`); render();
    }

    // ---------- 分組 / 胡牌 / 聽牌 ----------
    function segment(ids) { // 連續排列、拼對的單字（≥3 字母）自動成組（綠色）
        const L = ids.map(letterOf), n = L.length, best = [{ cov: 0, k: 0, prev: -1, len: 0 }];
        for (let i = 1; i <= n; i++) {
            let b = { cov: best[i - 1].cov, k: best[i - 1].k, prev: i - 1, len: 0 };
            for (let len = 3; len <= i; len++) {
                const s = i - len;
                if (isWordG(L.slice(s, i).join(''))) {
                    const c = { cov: best[s].cov + len, k: best[s].k + 1, prev: s, len };
                    if (c.cov > b.cov || (c.cov === b.cov && c.k < b.k)) b = c;
                }
            }
            best[i] = b;
        }
        const segs = []; let i = n;
        while (i > 0) { const b = best[i]; if (b.len) segs.push({ s: i - b.len, len: b.len, w: L.slice(i - b.len, i).join('') }); i = b.prev; }
        return segs.reverse();
    }
    function split(ids) { // 綠色單字組 + 沒成組的牌（rest，保持原順序）
        const segs = segment(ids), used = new Set();
        segs.forEach(s => { for (let i = 0; i < s.len; i++) used.add(s.s + i); });
        return { segs, rest: ids.filter((_, i) => !used.has(i)) };
    }
    function winInfo(ids) { // 17 張都成單字？剩下的牌必須自己拼成一個單字（只剩 2 張時可用二字母單字）
        const { segs, rest } = split(ids), words = segs.map(s => s.w);
        if (!rest.length) return words.length || meldsOf(mySeat).length ? { words, two: false } : null;
        const rw = wordOf(rest);
        if (isWordF(rw)) return { words: [...words, rw], two: false };
        if (rw.length === 2 && dict2.has(rw)) return { words: [...words, rw], two: true };
        return null;
    }
    function completeWith(rest, c) { // 剩下的牌 + 一張 c，能拼成哪個單字？（c 可插在任何位置）
        const R = rest.map(letterOf);
        for (let p = 0; p <= R.length; p++) {
            const w = [...R.slice(0, p), c, ...R.slice(p)].join('');
            if (isWordF(w)) return { w, two: false };
            if (w.length === 2 && dict2.has(w)) return { w, two: true };
        }
        return null;
    }
    function currentWaits() { // 聽牌：除了綠色的組以外，剩下的牌只差一張就能湊成單字
        if (!room || room.status !== 'playing' || !dict || introing || cm || room.counts[mySeat] !== 16) return [];
        const k = wordOf(hand) + '|' + meldsOf(mySeat).join(','); if (waitCache.k === k) return waitCache.v;
        const { rest } = split(hand);
        const v = rest.length && rest.length <= 7 ? ABC.filter(c => completeWith(rest, c)) : [];
        waitCache = { k, v }; return v;
    }
    const declared = () => !!(room && room.tings && room.tings[mySeat]);
    function syncTing() { // 聽牌後又把牌排壞、不再聽牌 → 自動取消聽牌
        if (declared() && room.counts[mySeat] === 16 && !introing && !cm && !currentWaits().length) ref.child('tings/' + mySeat).remove();
    }
    function declareTing() {
        const w = currentWaits();
        if (!w.length) return;
        if (declared()) return toast('聽：' + w.map(c => c.toUpperCase()).join(' '));
        ref.child('tings/' + mySeat).set(true);
        if (typeof Profile !== 'undefined' && Profile.mjRecord) Profile.mjRecord({ type: 'ting' });
        toast('聽牌！聽：' + w.map(c => c.toUpperCase()).join(' '));
    }
    const ronReady = () => !!room && room.status === 'playing' && room.phase === 'claim' && !!room.last && room.last.by !== mySeat
        && declared() && !cm && currentWaits().includes(room.last.ch);
    const zimoInfo = () => room && room.status === 'playing' && room.phase === 'discard' && room.turn === mySeat && room.counts[mySeat] === 17 && !introing ? winInfo(hand) : null;
    function score(words, self, two, special) {
        let t = 0; const lines = [];
        words.forEach(w => {
            if (two && w.length === 2) { lines.push(`${w.toUpperCase()}：二字母單字（不計台）`); return; }
            let s = Math.max(1, w.length - 2); const l = [`長度 ${w.length} +${s}`];
            const lv = lvMap[w]; if (lv && LVB[lv]) { s += LVB[lv]; l.push(`${LEVEL_LABEL[lv]}字 +${LVB[lv]}`); }
            let r = 0; for (const c of w) r += RARE[c] || 0; if (r) { s += r; l.push(`稀有字母 +${r}`); }
            t += s; lines.push(`${w.toUpperCase()}：${l.join('，')}（${s} 台）`);
        });
        if (self) { t += 5; lines.push('自摸 +5 台'); }
        if (two) { t = Math.max(1, Math.floor(t / 3)); lines.push('含二字母單字：台數大幅降低'); }
        if (special) { t = Math.max(1, Math.floor(t / 2)); lines.push('特殊胡：台數減半'); }
        return { tai: t, lines };
    }
    function declareWin(seat, words, self, two, from, n, special) {
        const sc = score(words, self, two, special), name = seatName(seat);
        if (special) sc.lines.push('特殊胡：手牌全部是合法單字組（不必等到出牌）');
        if (funOn()) { // 娛樂模式：金牌字母每個 +2 台（最多 +10）
            const g = room.gold, n = words.join('').split(g).length - 1;
            if (n > 0) { const b = Math.min(n * 2, 10); sc.tai += b; sc.lines.push(`🌟 金牌字母 ${g.toUpperCase()} ×${n}：+${b} 台`); }
        }
        if (room && room.cfg && room.cfg.allow3 === false) sc.lines.push('本局不允許三字母單字（僅最後湊牌可用）');
        if (room && room.cfg && room.cfg.allow4 === false) sc.lines.push('本局不允許四字母單字');
        ref.transaction(r => {
            if (!r || r.status !== 'playing') return;
            const okSelf = from == null && r.phase === 'discard' && r.turn === seat;
            const okSp = !!special && from == null && r.phase !== 'dice' && r.counts && r.counts[seat] === 16; // 手牌全成單字（只有 16 張時）
            const okRon = from != null && r.phase === 'claim' && r.last && r.last.n === n && r.last.by === from;
            if (!okSelf && !okRon && !okSp) return;
            r.status = 'ended';
            r.result = { seat, name, from: from == null ? null : from, fromName: from == null ? '' : seatName(from), words, self: !!self, two: !!two, special: !!special, tai: sc.tai, lines: sc.lines };
            return r;
        });
    }
    function winAction() {
        const z = zimoInfo();
        if (z) return declareWin(mySeat, [...z.words, ...meldsOf(mySeat)], selfDraw, z.two, null, undefined, !selfDraw);
        const sp = specialReady();
        if (sp) return declareWin(mySeat, [...sp.words, ...meldsOf(mySeat)], false, sp.two, null, undefined, true);
        if (ronReady()) { // 胡別人打出的牌
            const ch = room.last.ch, { segs, rest } = split(hand), c = completeWith(rest, ch);
            if (!c) return toast('目前的排列還湊不出單字');
            declareWin(mySeat, [...segs.map(s => s.w), c.w, ...meldsOf(mySeat)], false, c.two, room.last.by, room.last.n);
        }
    }
    function sortHand() { // 已成單字的組整組移到最左邊（依首字母排序），其餘的牌接在後面
        const { segs } = split(hand), used = new Set();
        const groups = segs.map(s => { const ids = hand.slice(s.s, s.s + s.len); ids.forEach(i => used.add(i)); return { w: s.w, ids }; }).sort((a, b) => a.w.localeCompare(b.w));
        const rest = hand.filter(i => !used.has(i)).sort((x, y) => tiles[x].localeCompare(tiles[y]));
        hand = [...groups.flatMap(g => g.ids), ...rest]; drawnId = null; sfx('drop');
    }

    // ---------- AI（單人練習）：故意不太聰明 ----------
    const aiLater = (ms, fn) => aiTimers.push(setTimeout(() => { if (solo && ref && room && room.status === 'playing') fn(); }, ms));
    function plan(ls, trials = 8) { // 從一堆字母中，盡量湊出最多張牌的不重疊單字
        const c0 = cnt(ls), cands = dictList.filter(w => w.length <= ls.length && lenOk(w, false) && fits(w, c0));
        let best = null;
        for (let t = 0; t < trials; t++) {
            const order = cands.map(w => ({ w, s: w.length + Math.random() * 2.2 })).sort((a, b) => b.s - a.s);
            const c = { ...c0 }, words = [];
            for (const { w } of order) if (fits(w, c)) { for (const x of w) c[x]--; words.push(w); }
            const used = words.reduce((a, w) => a + w.length, 0);
            if (!best || used > best.used) best = { words, used, c };
        }
        const rest = []; Object.entries(best.c).forEach(([k, v]) => { for (let i = 0; i < v; i++) rest.push(k); });
        return { words: best.words, rest };
    }
    function aiDrive() {
        const tag = s => room.round + '|' + room.n + '|' + room.phase + '|' + s;
        if (room.phase === 'draw' && room.turn !== mySeat) {
            const s = room.turn, t = tag(s); if (aiDone.has(t)) return; aiDone.add(t);
            aiLater(900, () => draw(s, ch => { aiHands[s].push(ch); }));
        } else if (room.phase === 'discard' && room.turn !== mySeat) {
            const s = room.turn, t = tag(s); if (aiDone.has(t)) return; aiDone.add(t);
            aiLater(1100 + Math.random() * 500, () => aiPlay(s));
        } else if (room.phase === 'claim' && room.last) {
            const n = room.last.n, ch = room.last.ch;
            for (let s = 1; s < 4; s++) {
                if (s === mySeat || s === room.last.by) continue;
                const t = tag(s); if (aiDone.has(t)) continue; aiDone.add(t);
                aiLater(300 + Math.random() * 300, () => aiClaim(s, n, ch));
            }
        }
    }
    // 電腦的「聽牌」：先拆出成組的單字，剩下的字母只差一張就能湊成單字（字母順序不拘）
    function aiTryTing(s) {
        if (room.n < C().minN) return; // 前期電腦不會聽牌，避免太快結束
        const p = plan(aiHands[s], C().trials), rest = p.rest;
        if (!rest.length || rest.length > 5) return;
        const waits = ABC.filter(c => anaMap.has([...rest, c].sort().join('')));
        if (!waits.length) return;
        aiTing[s] = { waits, words: p.words, rest };
        ref.child('tings/' + s).set(true);
    }
    function aiPlay(s) { // 故意不太聰明：只試 3 次拆牌、常常亂打；聽牌、胡牌都有機率沒發現
        if (!room || room.phase !== 'discard' || room.turn !== s) return;
        const h = aiHands[s], t = aiTing[s], mine = meldsOf(s);
        const self = !(room.claimed && room.claimed.n === room.n && room.claimed.seat === s);
        if (t) { // 已聽牌：摸到要的牌才可能自摸，否則原牌打出去（維持聽牌）
            const drawn = h[h.length - 1], wd = anaMap.get([...t.rest, drawn].sort().join(''));
            if (wd && room.n >= C().minN && Math.random() < C().tingWin) return declareWin(s, [...t.words, wd, ...mine], self, wd.length === 2, null);
            h.pop(); return doDiscard(s, drawn);
        }
        const p = plan(h, C().trials);
        if (!p.rest.length && room.n >= C().minN && Math.random() < C().win) return declareWin(s, [...p.words, ...mine], self, false, null);
        let ch;
        if (Math.random() < C().rnd || !p.rest.length) ch = h[Math.floor(Math.random() * h.length)];
        else { const pri = x => (RARE[x] || 0) * 2 + Math.random(); ch = [...p.rest].sort((a, b) => pri(b) - pri(a))[0]; }
        h.splice(h.indexOf(ch), 1);
        doDiscard(s, ch, ok => { if (ok && !aiTing[s] && Math.random() < C().ting) aiTryTing(s); });
    }
    function aiClaim(s, n, ch) { // 已聽牌的電腦：有機率胡你打出的牌；沒聽牌的電腦：很少碰（4%、至少 4 個字母、最多碰一次）
        if (!room || room.phase !== 'claim' || !room.last || room.last.n !== n) return;
        const t = aiTing[s];
        if (t) {
            const wd = t.waits.includes(ch) && room.n >= C().minN && Math.random() < C().ron ? anaMap.get([...t.rest, ch].sort().join('')) : null;
            if (wd) declareWin(s, [...t.words, wd, ...meldsOf(s)], false, wd.length === 2, room.last.by, n);
            return;
        }
        if (Math.random() > C().claim || meldsOf(s).length >= C().maxMeld) return;
        const withCh = plan([...aiHands[s], ch], C().trials);
        const w = withCh.words.filter(x => x.includes(ch) && x.length >= C().minLen).sort((a, b) => b.length - a.length)[0];
        if (!w) return;
        pressFor(s, ok => {
            if (!ok) return;
            aiPending[s] = { n, used: [...w.replace(ch, '')] };
            aiLater(500 + Math.random() * 500, () => { if (room.phase === 'claim' && room.last.n === n) ref.child('claims/' + s).set({ w, done: true }); });
        });
    }

    // ---------- 頭像 ----------
    function avHtml(s, size) {
        const p = pl(s), a = safeAvatar(p.avatar), nm = p.name || '?';
        const st = p.ai ? ` style="background:hsl(${hue(nm)} 55% 45%)"` : '';
        const turn = room && room.status === 'playing' && room.phase !== 'claim' && room.turn === s;
        const ting = room && room.tings && room.tings[s];
        const tgt = room && room.status === 'playing' && s !== mySeat && !introing;
        return `<div class="mj-avw ${tgt ? 'tgt' : ''}" data-s="${s}">${turn ? `<span class="mj-ring" data-s="${s}"></span>` : ''}<div class="mj-av ${size} ${turn ? 'turn' : ''}" title="${esc(nm)}"${st}>${a ? `<img src="${esc(a)}" alt="">` : esc(nm.trim().charAt(0).toUpperCase() || '?')}</div>`
            + `${turn ? `<span class="mj-sec" data-s="${s}"></span>` : ''}${splats[s] ? `<span class="mj-splat" style="--sc:${splats[s].c}"></span>` : ''}${ting ? '<span class="mj-ting">聽</span>' : ''}${callouts[s] ? `<span class="mj-callout">${esc(callouts[s])}</span>` : ''}</div>`;
    }

    // ---------- 開場：倒數 3-2-1 → 擲骰決定誰先開始 → 洗牌 → 把牌抽進手牌區 ----------
    function playIntro() {
        const tok = ++introToken; introing = true; revealed = new Set(); render();
        root.querySelectorAll('.mj-intro').forEach(x => x.remove());
        const ov = document.createElement('div'); ov.className = 'mj-intro'; root.appendChild(ov);
        const alive = () => tok === introToken && room && ref;
        const stop = () => { ov.remove(); if (!solo) diceUI = null; };
        const FACE = '⚀⚁⚂⚃⚄⚅', r6 = () => 1 + Math.floor(Math.random() * 6);
        const shuffleHtml = '<div class="mj-shuf">' + Array.from({ length: 16 }, () => `<i style="--dx:${Math.round(Math.random() * 90 - 45)}px;--dy:${Math.round(Math.random() * 50 - 25)}px;--r:${Math.round(Math.random() * 50 - 25)}deg;animation-delay:${(-Math.random() * .6).toFixed(2)}s"></i>`).join('') + '</div><div class="mj-intro-txt">洗牌中…</div>';

        const panel = (R, vals, title, topSeats, msg) => {
            const cards = Array.from({ length: NP() }, (_, s) => s).map(s => {
                const k = R.seats.indexOf(s), d = k >= 0 ? vals[k] : null, sum = d ? d[0] + d[1] : '';
                return `<div class="mj-dc ${k < 0 ? 'out' : ''} ${topSeats && topSeats.includes(s) ? 'top' : ''}">${avHtml(s, 's')}<b>${esc(seatName(s))}</b>
                    <div class="mj-dice">${d ? `<span>${FACE[d[0] - 1]}</span><span>${FACE[d[1] - 1]}</span>` : '—'}</div><div class="mj-dsum">${topSeats ? sum : ''}</div></div>`;
            }).join('');
            return `<div class="mj-dp"><div class="mj-dt">${title}</div><div class="mj-dcs ${NP() > 4 ? 'many' : ''}">${cards}</div><div class="mj-dm">${msg || '&nbsp;'}</div></div>`;
        };
        const diceStage = next => {
            const rounds = room.dice || []; let ri = 0;
            const step = () => {
                if (!alive()) return stop();
                if (ri >= rounds.length) { // 全部擲完：宣布誰先開始
                    const R = rounds[rounds.length - 1] || { seats: Array.from({ length: NP() }, (_, i) => i), dice: Array.from({ length: NP() }, () => [1, 1]) };
                    ov.innerHTML = panel(R, R.dice, '擲骰結果', [room.turn], `🎲 ${esc(seatName(room.turn))} 先開始！`);
                    return setTimeout(next, 1500);
                }
                const R = rounds[ri], title = ri === 0 ? '🎲 擲骰子決定誰先開始' : '同點！同點的人再擲一次';
                sfx('dice');
                const iv = setInterval(() => { if (!alive()) return clearInterval(iv); ov.innerHTML = panel(R, R.seats.map(() => [r6(), r6()]), title); }, 90);
                setTimeout(() => {
                    clearInterval(iv); if (!alive()) return stop();
                    const sums = R.dice.map(d => d[0] + d[1]), mx = Math.max(...sums), tops = R.seats.filter((s, i) => sums[i] === mx);
                    sfx('drop');
                    ov.innerHTML = panel(R, R.dice, title, tops, tops.length > 1 ? '同點，重擲！' : '');
                    ri++; setTimeout(step, 1300);
                }, 1000);
            };
            step();
        };
        const diceStageMulti = next => { // 多人：手動擲骰，狀態由房間資料同步
            const anim = {}, seen = {}; let iv = null, finishing = false, rdKey = -1, resolveT = null, autoT = null;
            ov.classList.add('manual');
            const faces = v => `<span>${FACE[v[0] - 1]}</span><span>${FACE[v[1] - 1]}</span>`;
            const draw = () => {
                const d = room.dice; if (!d || !d.seats) return;
                const decided = !!room.shufAt, t = Date.now();
                const sums = s => d.rolls && d.rolls['s' + s] ? d.rolls['s' + s][0] + d.rolls['s' + s][1] : -1;
                const allIn = d.rolls && d.seats.every(s => sums(s) > 0), mx = allIn ? Math.max(...d.seats.map(sums)) : 0;
                const tops = allIn ? d.seats.filter(s => sums(s) === mx) : null;
                const cards = Array.from({ length: NP() }, (_, s) => s).map(s => {
                    const k = d.seats.indexOf(s), rv = k >= 0 && d.rolls ? d.rolls['s' + s] : null, rolling = rv && anim[s] > t;
                    const btn = k >= 0 && !rv ? (s === mySeat ? '<button class="btn btn-primary mj-rollb" data-a="roll">🎲 擲骰!</button>' : '<div class="mj-dm">等待中…</div>') : '';
                    return `<div class="mj-dc ${k < 0 ? 'out' : ''} ${tops && !rolling && tops.includes(s) ? 'top' : ''}">${avHtml(s, 's')}<b>${esc(seatName(s))}</b>
                        <div class="mj-dice">${rv ? faces(rolling ? [r6(), r6()] : rv) : '—'}</div><div class="mj-dsum">${rv && !rolling ? sums(s) : ''}</div>${btn}</div>`;
                }).join('');
                const title = decided ? '擲骰結果' : (d.rd || 0) === 0 ? '🎲 每位玩家按「擲骰!」，點數最大者先開始' : '同點！同點的人再擲一次';
                const msg = decided ? `🎲 ${esc(seatName(room.turn))} 先開始！` : allIn ? '比較點數中…' : '&nbsp;';
                ov.innerHTML = `<div class="mj-dp"><div class="mj-dt">${title}</div><div class="mj-dcs ${NP() > 4 ? 'many' : ''}">${cards}</div><div class="mj-dm">${msg}</div></div>`;
            };
            const update = () => {
                if (!alive()) { diceUI = null; return stop(); }
                const d = room.dice; if (!d || !d.seats) return;
                const ro = d.rolls || {};
                d.seats.forEach(s => { const v = ro['s' + s], k = (d.rd || 0) + '|' + s; if (v && !seen[k]) { seen[k] = 1; anim[s] = Date.now() + 2000; sfx('dice'); } }); // 有人擲骰就播一次音效
                if (!iv) iv = setInterval(() => { if (!alive() || finishing) return clearInterval(iv); let need = false; Object.keys(anim).forEach(k => { need = true; if (anim[k] <= Date.now()) { delete anim[k]; sfx('drop'); } }); if (need) draw(); }, 90);
                draw();
                if ((d.rd || 0) !== rdKey) { // 新的一輪：重設計時；太久沒按的玩家自動幫他擲
                    rdKey = d.rd || 0; clearTimeout(resolveT); clearTimeout(autoT);
                    autoT = setTimeout(() => { if (alive() && !room.shufAt && room.dice && (room.dice.rd || 0) === rdKey && room.dice.seats.includes(mySeat) && !(room.dice.rolls && room.dice.rolls['s' + mySeat])) rollMine(); }, 20000);
                }
                const allIn = d.rolls && d.seats.every(s => d.rolls['s' + s]);
                if (allIn && !room.shufAt && !resolveT) resolveT = setTimeout(() => { resolveT = null; if (alive()) resolveDice(); }, 3000 + mySeat * 250);
                if (!allIn) { clearTimeout(resolveT); resolveT = null; }
                if (room.shufAt && !finishing) { // 決定了先後：等到大家約定的時間，開始洗牌發牌
                    finishing = true; clearInterval(iv); clearTimeout(autoT); clearTimeout(resolveT);
                    setTimeout(() => { diceUI = null; next(); }, Math.max(0, room.shufAt - now()));
                }
            };
            ov.addEventListener('click', e => { if (e.target.closest('[data-a="roll"]')) rollMine(); });
            diceUI = { update }; update();
        };
        let c = 3;
        const tick = () => {
            if (!alive()) return stop();
            if (c > 0) { ov.innerHTML = `<div class="mj-cd-wrap"><small>即將開始</small><div class="mj-cd-num">${c}</div></div>`; sfx('tick'); c--; setTimeout(tick, 850); }
            else (solo ? diceStage : diceStageMulti)(() => { if (!alive()) return stop(); ov.innerHTML = shuffleHtml; sfx('shuffle'); setTimeout(deal, SAMPLES.m3 ? Math.min(3000, Math.max(1500, Math.round(SAMPLES.m3.duration * 1000) + 150)) : 1500); });
        };
        const deal = () => {
            if (!alive()) return stop();
            ov.innerHTML = ''; sfx('go');
            const felt = body.querySelector('.mj-felt'), fr = felt.getBoundingClientRect(), ids = [...hand];
            ids.forEach((id, i) => setTimeout(() => {
                if (!alive()) return;
                const t = body.querySelector(`#mj-row .mj-t[data-id="${id}"]`); if (!t) return;
                const tr = t.getBoundingClientRect(), f = document.createElement('div');
                f.className = 'mj-fly'; Object.assign(f.style, { width: tr.width + 'px', height: tr.height + 'px', left: (fr.left + fr.width / 2 - tr.width / 2) + 'px', top: (fr.top + fr.height / 2 - tr.height / 2) + 'px' });
                root.appendChild(f); void f.offsetWidth;
                f.style.left = tr.left + 'px'; f.style.top = tr.top + 'px'; sfx('draw');
                setTimeout(() => { f.remove(); revealed.add(id); const cur = body.querySelector(`#mj-row .mj-t[data-id="${id}"]`); if (cur) cur.classList.remove('hide'); }, 340);
            }, i * 80));
            setTimeout(() => { if (!alive()) return stop(); introing = false; stop(); render(); if (room) onRoom({ val: () => room }); }, ids.length * 80 + 420);
        };
        const wait = Math.max(0, (room.startAt || 0) - now()); // 等到大家約定好的開始時間，所有玩家同步播放開場
        if (wait > 300) ov.innerHTML = '<div class="mj-intro-txt">所有玩家準備中…</div>';
        setTimeout(tick, wait);
    }
    // 摸牌動畫：牌從牌桌中央飛到手牌最右邊
    function animateDraw() {
        const t = body.querySelector('#mj-row .mj-t.dr'), cen = $('mj-center'); if (!t || !cen) return;
        const tr = t.getBoundingClientRect(), c = cen.getBoundingClientRect(), f = document.createElement('div');
        t.style.visibility = 'hidden';
        f.className = 'mj-fly'; Object.assign(f.style, { width: tr.width + 'px', height: tr.height + 'px', left: (c.left + c.width / 2 - tr.width / 2) + 'px', top: (c.top + c.height / 2 - tr.height / 2) + 'px' });
        root.appendChild(f); void f.offsetWidth; f.style.left = tr.left + 'px'; f.style.top = tr.top + 'px';
        setTimeout(() => { f.remove(); const cur = body.querySelector('#mj-row .mj-t.dr'); if (cur) cur.style.visibility = ''; }, 360);
    }

    // ---------- 畫面 ----------
    function renderNotice() { // 進入麻將前先提醒轉向
        body.innerHTML = `<div class="mj-lobby mj-notice"><div class="mj-phone">📱</div><h2>請將手機轉為橫向並設定全螢幕</h2>
            <p class="mj-note">英文麻將橫向螢幕才能正常操作並獲得最佳體驗</p>
            <button class="btn btn-primary" data-a="enter">我知道了，進入</button>
            <button class="btn btn-secondary" data-a="exit">返回主選單</button></div>`;
    }
    function renderMenu() {
        body.innerHTML = `<div class="mj-lobby"><div class="mj-update">🆕 更新通知：正確的單字沒變綠？點擊「碰」旁邊的放大鏡 🔍 來搜尋！</div><h2>🀄 英文麻將</h2>
            <p class="mj-note">用字母牌拼出單字，最先把手牌全部拼成單字的人胡牌！<br>請使用橫向全螢幕。目前暱稱：<b>${esc(myName())}</b></p>
            <div class="mj-lv" title="電腦難度">🤖 電腦難度
                ${Object.entries(AI_CFG).map(([k, v]) => `<button class="${k === aiLevel ? 'on' : ''}" data-a="lv:${k}">${v.name}</button>`).join('')}</div>
            <button class="btn btn-primary" data-a="solo">🤖 單人練習（與 3 位 AI 對戰・組牌不限時）</button>
            <button class="btn btn-sky" data-a="multi">👥 多人房間（2~6 位玩家）</button>
            <div class="mj-row2"><button class="btn btn-secondary" data-a="settings">⚙️ 設定</button><button class="btn btn-secondary" data-a="shop">🛒 商店・股票 </button></div>
            <button class="btn btn-secondary" data-a="rules">📖 麻將規則說明</button>
            <button class="btn btn-secondary" data-a="case">牌面字母：${lowerCase ? '小寫 (abc)' : '大寫 (ABC)'}（點擊切換）</button>
            <button class="btn btn-secondary" data-a="exit">返回主選單</button></div>`;
    }
    function renderEntry() {
        body.innerHTML = `<div class="mj-lobby"><h2>👥 多人房間</h2>
            <p class="mj-note">2~6 位玩家即可開始。目前暱稱：<b>${esc(myName())}</b></p>
            <input id="mj-code" maxlength="4" inputmode="numeric" placeholder="加入房間：輸入 4 碼代碼">
            <div class="mj-row2"><button class="btn btn-primary" data-a="create">建立房間</button><button class="btn btn-secondary" data-a="join">加入房間</button></div>
            <button class="btn btn-secondary" data-a="menu">返回</button></div>`;
    }
    function renderRules() {
        body.innerHTML = `<div class="mj-lobby"><h2>📖 英文麻將規則</h2><div class="mj-rules">
            <h3>🎯 目標</h3><p>把手上的字母牌全部組成<b>單字</b>（一般情況每個單字至少3個字母），就可以<b>胡牌</b>！</p>
            <h3>🃏 開局</h3><ul><li>支援 <b>2~6 人</b>（2 人坐對面、5 人左右＋左上右上、6 人平均分配）。</li><li>開局3秒倒數後每人會自動擲骰子，<b>點數最大者先開始</b>，接著洗牌並自動把牌抽進手牌區。</li><li>輪到你時會<b>自動摸牌</b>，摸到的牌加在最右邊且為<b>橘色底</b>；拖曳它或整理手牌，就會回到一般狀態。出牌順序是<b>逆時針</b></li></ul>
            <h3>👆 操作</h3><ul><li><b>拖曳手牌</b>即可自己排列手牌與出牌</li><li>連續排好的字母如果拼成合法單字，會<b>自動靠在一起成為一組(綠色底)</b></li><li><b>把牌拖到牌桌中央</b>就能出牌。</li><li><b>整理(可好好利用)</b>：把單字組整組移到最左邊（依首字母排序），其餘的牌依序接在後面。</li></ul>
            <h3>✋ 碰</h3><ul><li>別人打出一張牌後，其他三位玩家有<b>6 秒</b>可以按「碰」。</li><li>有人按碰時，總倒數會<b>再加 10 秒</b>。</li><li>按下去後會出現<b>組牌區</b>：把手牌拖進去，和被打出的那張牌手動組成單字；組成單字成功時底下會變綠色，記得按右下角的 ✓ 送出。</li><li>組不出單字？再按一次「取消」，牌會放回手牌區，而且這一輪不能再碰。</li><li>所有人都送出或時間到後，<b>單字最長者優先</b>。碰到的單字會公開擺在你前方的牌桌上，然後由你打出一張牌。</li></ul>
            <h3>🎯 聽牌</h3><ul><li>當手牌除了綠色的單字組以外，<b>剩下的牌只差一張就能湊成單字</b>時，「聽」按鈕會亮起。</li><li>按下「聽」會顯示你聽哪些字母，並在你的頭像旁出現「聽」。</li><li>只剩 1 張沒成組時，可以和另一張牌組成<b>二字母單字(特殊情況)</b>，也能胡牌但台數會大幅降低。</li></ul>
            <h3>🀄 胡牌</h3><ul><li>聽牌後，別人打出你聽的那張牌，「胡」按鈕會亮成紅色，按下去就胡啦，打出那張牌的人<b>放槍</b>。</li><li>骰子改成<b>手動擲骰</b>：每位玩家按自己卡片下的「擲骰!」，全部擲完才比大小，同點者再擲。</li><li>輪到自己摸牌，當手牌全部成單字時，按鈕會變成「<b>自摸</b>」，爽。<b>不會自動胡牌</b>，要自己按亮起的按鈕。</li><li><b>特殊胡</b>：只要手牌（不含已碰的牌）只有 16 張、而且<b>全部都是綠色合法單字組</b>（或剛好剩兩張是二字母單字），不管是不是你的回合，「胡」按鈕都會亮起，按下去就胡（台數減半）。</li><li>🔍 放大鏡：拼對了但沒變綠？輸入單字查詢，確認存在就會加入合法單字；不存在會顯示「沒有這個字 你拚對了嗎」。</li><li>結算畫面會公開所有玩家的手牌與碰牌。牌庫摸完仍無人胡牌則為流局。</li></ul>
            <h3>⚙️ 房間設定（房主）</h3><ul><li><b>🎉 娛樂模式</b>：開局隨機抽出一個「金牌字母」🌟（牌面會發光）。胡牌時單字中每有一個金牌字母 +2 台（最多 +10）；摸到金牌字母、每打 8 張牌、遊戲結束都會有表情雨特效。單人練習在選單勾選，多人由房主在房間設定。</li><li><b>💰 玩錢</b>（多人房主可開）：自摸時其他玩家各付贏家金幣，放槍胡則只由放槍的人付；金額依牌型而定，結算畫面會列出。</li><li><b>允許四個字母的單字</b>：關閉後四字母單字完全不算合法單字。單人練習也能在選單設定三、四字母。</li><li><b>允許三個字母的單字</b>：關閉後，三字母單字不算合法單字，只有「最後手牌剩兩張、湊成三字母單字」胡牌時才算數。</li><li><b>每回合限時</b>：輸入秒數（0＝不限時）。輪到的玩家頭像外圈會有<b>黃色倒數圈</b>，快結束時變紅並顯示秒數；時間到會自動出牌。</li></ul>
            <h3>💬 快捷交流與雞蛋</h3><ul><li>多人模式點自己名字旁的 💬 可發快捷訊息（5 秒內最多 8 則，超過冷卻 3 秒）。</li><li>局內點對手頭像可以丟雞蛋 🥚，純屬娛樂，沒有任何效果。</li><li>在房間裡點玩家頭像可以加對方為好友。</li></ul>
            <h3>🔢 計台</h3><ul><li>每個單字：長度−2台；4 級 +1、5 級 +2、6 級 +3；稀有字母 J、Q、X、Z 各+2，K+1；自摸+5台。</li></ul>
            <h3>🔊 小提示</h3><p>打出的牌會朗讀字母；碰（bang）、聽牌（ready hand）、胡牌（win）、自摸（touch myself）也會朗讀。音效與朗讀可在設定中開關並調整音量，深色模式也會套用在麻將桌。</p></div>
            <button class="btn btn-secondary" data-a="menu">返回</button></div>`;
    }

    function applySizes() {
        const g = body.querySelector('.mj-game'), strip = g && g.querySelector('.mj-me'); if (!g) return;
        const cs = getComputedStyle(strip), gap = 2;
        const avail = strip.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const tw = Math.max(22, Math.min(76, Math.floor((avail - 16 * gap - 6) / 17))); // 17 張剛好平分長邊
        const th = Math.min(Math.round(tw * 1.4), Math.round(window.innerHeight * .27));
        const pw = Math.max(16, Math.min(30, Math.round(tw * .5)));
        [['--tw', tw], ['--th', th], ['--g', gap], ['--pw', pw], ['--ph', Math.round(pw * 1.32)], ['--hh', th + 28]].forEach(([k, v]) => g.style.setProperty(k, v + 'px'));
    }
    const ARROWS = (() => { // 逆時針順序箭頭：自己(下) → 右 → 上 → 左
        const R = 74, C = 100; let s = `<svg class="mj-arrows" viewBox="0 0 200 200"><circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="6 9"/>`;
        [45, 135, 225, 315].forEach(deg => {
            const t = deg * Math.PI / 180, px = C + R * Math.cos(t), py = C + R * Math.sin(t);
            const tx = Math.sin(t), ty = -Math.cos(t), nx = -ty, ny = tx; // 逆時針切線 / 法線
            const tip = [px + tx * 9, py + ty * 9], w1 = [px - tx * 6 + nx * 8, py - ty * 6 + ny * 8], w2 = [px - tx * 6 - nx * 8, py - ty * 6 - ny * 8];
            s += `<path d="M${w1[0].toFixed(1)} ${w1[1].toFixed(1)} L${tip[0].toFixed(1)} ${tip[1].toFixed(1)} L${w2[0].toFixed(1)} ${w2[1].toFixed(1)}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
        });
        return s + '</svg>';
    })();
    const tileHtml = (c, cls = '') => `<b class="${vowel(c) ? 'v' : ''} ${cls}">${c.toUpperCase()}</b>`;
    const meldHtml = s => meldsOf(s).map(w => `<div class="mj-meld">${[...w].map(c => tileHtml(c)).join('')}</div>`).join('');

    // 金幣結算：每位玩家各自的金幣變化 + 自己的明細。玩錢：自摸 → 其他人各付；放槍 → 放槍者付
    function coinBox(cc) {
        return `<div class="mj-coins"><div class="mj-coins-h">🪙 本局金幣</div>${cc.mine.map(([l, n]) => `<div class="mj-cl"><span>${l}</span><b class="${n >= 0 ? 'p' : 'n'}">${n >= 0 ? '+' : ''}${n}</b></div>`).join('')}<div class="mj-cl tot"><span>合計</span><b class="${cc.total >= 0 ? 'p' : 'n'}">${cc.total >= 0 ? '+' : ''}${cc.total} 🪙</b></div></div>`;
    }
    function coinCalc(res) {
        const np = NP(), money = !solo && !!(room.cfg && room.cfg.money), t = Math.min(30, res.tai || 0), unit = 10 + t * 5, delta = {}, mine = [];
        for (let s = 0; s < np; s++) {
            const win = !res.draw && s === res.seat; let d = win ? (solo ? 25 : 40) : (solo ? 6 : 12);
            if (s === mySeat) mine.push(win ? ['🏆 胡牌獎勵', d] : ['🎮 參與獎勵', d]);
            if (win) { const b = t * (solo ? 3 : 4); d += b; if (s === mySeat) mine.push(['🧩 牌型加成', b]); }
            delta[s] = d;
        }
        if (money && !res.draw) {
            const payers = res.self ? Array.from({ length: np }, (_, s) => s).filter(s => s !== res.seat) : (res.from != null ? [res.from] : []);
            payers.forEach(s => { delta[s] -= unit; delta[res.seat] += unit; });
            if (res.seat === mySeat) mine.push([res.self ? `💰 玩錢：自摸，${payers.length} 家各付 ${unit}` : `💰 玩錢：${esc(seatName(res.from))} 放槍付 ${unit}`, unit * payers.length]);
            else if (payers.includes(mySeat)) mine.push([res.self ? `💸 玩錢：${esc(seatName(res.seat))} 自摸，你付 ${unit}` : `💸 玩錢：你放槍，付給 ${esc(seatName(res.seat))} ${unit}`, -unit]);
        }
        return { delta, mine, total: delta[mySeat], money };
    }
    function resultHtml() {
        const res = room.result || {};
        if (res.aborted) return `<h2>⚠️ ${esc(res.name)} 離開了遊戲</h2>`;
        if (res.draw) return `<h2>🤝 牌庫已空，流局</h2>${coinBox(coinCalc(res))}`;
        const cdl = coinCalc(res).delta;
        const rows = Array.from({ length: NP() }, (_, s) => s).map(s => {
            const win = s === res.seat, from = !res.self && res.from === s, ms = meldsOf(s);
            let hands;
            if (win) hands = (res.words || []).slice(0, (res.words || []).length - ms.length).map(w => `<span class="mj-rw">${[...w].map(c => tileHtml(c, 'g')).join('')}</span>`).join('');
            else { const h = (room.reveal && room.reveal[s]) || ''; hands = h === '-' ? '' : `<span class="mj-rw">${[...h].map(c => tileHtml(c)).join('')}</span>`; }
            return `<div class="mj-rr ${win ? 'w' : ''}"><div class="mj-rn">${avHtml(s, 's')}<b>${esc(seatName(s))}</b>${win ? '<span class="mj-tag w">🏆 贏家</span>' : ''}${from ? '<span class="mj-tag f">💥 放槍</span>' : ''}${cdl ? `<span class="mj-cd2 ${cdl[s] >= 0 ? 'p' : 'n'}">${cdl[s] >= 0 ? '+' : ''}${cdl[s]} 🪙</span>` : ''}</div>
                <div class="mj-rt">${hands}${ms.length ? `<span class="mj-rw m">${ms.map(w => [...w].map(c => tileHtml(c, 'b')).join('')).join('<i></i>')}</span>` : ''}</div></div>`;
        }).join('');
        const cc = coinCalc(res), fm = n => (n >= 0 ? '+' : '') + n;
        return `<h2>🏆 ${esc(res.name)} ${res.self ? '自摸' : '胡牌'}！</h2>${coinBox(cc)}${rows}`;
    }

    function lobbyHtml() {
        const ents = Object.entries(room.players || {}).sort((a, b) => a[1].seat - b[1].seat), isH = room.host === key, ended = room.status === 'ended';
        const backOk = p => !ended || p.back === room.round;
        const others = ents.filter(([k]) => k !== room.host), readyN = others.filter(([k, p]) => p.ready && backOk(p)).length;
        const allReady = ents.length >= MIN_P && readyN === others.length;
        const me = room.players[key], myReady = !!(me && me.ready);
        const rows = ents.map(([k, p]) => {
            const host = k === room.host, av = safeAvatar(p.avatar);
            const tag = host ? '<span class="tag-host">👑 房主</span>' : !backOk(p) ? '<span class="tag-wait">👀 查看結果中</span>' : p.ready ? '<span class="tag-ready">✅ 準備就緒</span>' : '<span class="tag-wait">⏳ 稍等一下</span>';
            const kick = isH && !host ? `<button class="mj-kick" data-kick="${esc(k)}" title="踢出房間">踢出</button>` : '';
            return `<div class="room-player"><span class="nm" style="display:flex;align-items:center;gap:8px;"><span class="avatar mj-fav" data-pk="${esc(k)}" title="點擊可加好友" style="width:32px;height:32px;font-size:14px;cursor:pointer;">${av ? `<img src="${esc(av)}" alt="">` : esc((p.name || '?').trim().charAt(0).toUpperCase() || '?')}</span>${esc(p.name)}${k === key ? ' (你)' : ''}</span><span style="display:flex;align-items:center;gap:6px">${tag}${kick}</span></div>`;
        }).join('') + (ents.length < MAX_P ? `<div class="room-player"><span class="nm" style="opacity:.5">還可加入 ${MAX_P - ents.length} 位（至少 ${MIN_P} 人才能開始）</span></div>` : '');
        const a3 = room.cfg ? room.cfg.allow3 !== false : true, a4 = room.cfg ? room.cfg.allow4 !== false : true, fn = !!(room.cfg && room.cfg.fun), ts = room.cfg && room.cfg.turnSec != null ? +room.cfg.turnSec : 30, dis = isH ? '' : 'disabled';
        const cfg = `<div class="mj-cfg"><label class="field-label">⚙️ 模式設定${isH ? '' : '（由房主設定）'}</label>
            <label class="mj-sw"><input type="checkbox" id="mj-allow3" ${a3 ? 'checked' : ''} ${dis}><span>允許三個字母的單字</span></label>
            <div class="mj-note-l">${a3 ? '' : '關閉時：三字母單字不算合法單字，只有最後手牌剩兩張、湊成三字母單字胡牌時才算數'}</div>
            <label class="mj-sw"><input type="checkbox" id="mj-allow4" ${a4 ? 'checked' : ''} ${dis}><span>允許四個字母的單字</span></label>
            <label class="mj-sw"><input type="checkbox" id="mj-money" ${room.cfg && room.cfg.money ? 'checked' : ''} ${dis}><span>💰 玩錢（自摸：其他人都付；放槍：放槍者付）</span></label>
            <div class="mj-sw"><span>每回合限時（秒，0＝不限時）</span><input type="number" id="mj-turn-input" min="0" max="600" inputmode="numeric" value="${ts}" ${dis}></div></div>`;
        return `<div class="mj-lobby room-like"><h1>🀄 英文麻將等待大廳</h1>
            <div class="room-header"><span>房間代碼：</span><span class="room-code">#${esc(code)}</span></div>
            <label class="field-label">目前房間內成員（2~6 人）：</label><div class="player-list">${rows}</div><div class="mj-note">點擊玩家頭像可以加為好友</div>${cfg}
            <div class="btn-grid">
            ${isH ? `<button class="btn btn-primary" data-a="start" ${allReady ? '' : 'disabled'}>${ents.length < MIN_P ? `等待玩家加入 (${ents.length}/${MIN_P}~${MAX_P})` : !allReady ? `等待玩家準備 (${readyN}/${others.length})` : `開始英文麻將！（${ents.length} 人）`}</button>`
                : `<button class="btn ${myReady ? 'btn-secondary' : 'btn-primary'}" data-a="ready">${myReady ? '⏳ 稍等一下 (取消準備)' : '✅ 準備就緒'}</button>`}
            <button class="btn btn-sky" data-a="invite">👥 邀請好友</button>
            <button class="btn btn-danger" data-a="leave">離開房間</button></div></div>`;
    }
    const slotOf = s => { const np = NP(), o = (s - mySeat + np) % np; return o === 0 ? 'bot' : (SLOTS[np] || SLOTS[4])[o - 1]; };
    const bubble = s => chatMsg[s] ? `<span class="mj-bub">${esc(chatMsg[s])}</span>` : '';

    function render() {
        if (!room || !ref) return;
        // 手指太久沒動 / 沒收到放開事件時，要把牌收回，不能卡在畫面上
        if (drag && Date.now() - (drag.last || drag.t0) > (drag.on ? 20000 : 3000)) { abortDrag(); return; }
        if (room.status === 'lobby' || (room.status === 'ended' && room.players[key] && room.players[key].back === room.round)) {
            const ae = document.activeElement; if (ae && ae.id === 'mj-turn-input' && body.contains(ae)) return; // 房主正在輸入秒數時不要重繪
            body.innerHTML = lobbyHtml(); return;
        }
        const r = room, myTurn = r.turn === mySeat, last = r.last, playing = r.status === 'playing', np = NP();
        const pairs = [], pile = r.pile || '';
        for (let i = 0; i + 1 < pile.length; i += 2) pairs.push({ s: +pile[i], c: pile[i + 1] });
        const lastIdx = r.phase === 'claim' && pairs.length ? pairs.length - 1 : -1;
        const zone = (s, cls) => `<div class="mj-dz ${cls}">${pairs.map((p, i) => p.s === s ? `<span class="mj-pc ${i === lastIdx ? 'last' : ''} ${funOn() && p.c === r.gold ? 'gold' : ''}">${p.c.toUpperCase()}</span>` : '').join('')}</div>`;
        const opp = s => `<div class="mj-opp ${slotOf(s)}"><div class="mj-oid">${avHtml(s, 's')}<div class="mj-nmw"><b class="mj-nm">${esc(seatName(s))}</b>${bubble(s)}</div></div><div class="mj-melds">${meldHtml(s)}</div></div>`;
        const zones = Array.from({ length: np }, (_, o) => { const s = (mySeat + o) % np; return zone(s, 'z-' + slotOf(s)); }).join('');
        const opps = Array.from({ length: np - 1 }, (_, i) => opp((mySeat + 1 + i) % np)).join('');
        const remain = cdValue;
        let st;
        if (!playing) st = '本局結束';
        else if (r.phase === 'claim' && last) st = cm ? '' : `<div class="mj-ct ${vowel(last.ch) ? 'v' : ''}">${last.ch.toUpperCase()}</div><div class="mj-cdline">${esc(seatName(last.by))} 打出　<b id="mj-cd">${remain()}</b></div>`;
        else st = myTurn ? (r.phase === 'draw' ? '摸牌中…' : '輪到你<br>拖曳一張牌到這裡打出') : `輪到 ${esc(seatName(r.turn))}`;

        const { segs } = split(hand), mark = new Array(hand.length).fill(0);
        segs.forEach(s => { for (let i = 0; i < s.len; i++) mark[s.s + i] = i === 0 ? 1 : 2; });
        const tileCls = id => `mj-t tl ${vowel(letterOf(id)) ? 'v' : ''}`;
        const handTiles = hand.map((id, i) => `<button class="${tileCls(id)} ${mark[i] ? 'g' : ''} ${mark[i] === 2 ? 'gc' : ''} ${id === drawnId && playing ? 'dr' : ''} ${funOn() && tiles[id] === r.gold ? 'gold' : ''} ${introing && !revealed.has(id) ? 'hide' : ''}" data-id="${id}">${tiles[id].toUpperCase()}</button>`).join('');

        let cmHtml = '';
        if (cm && playing) { // 中央組牌區：灰色虛線外框、半透明
            const w = wordOf(cm.items), ok = isWordG(w);
            cmHtml = `<div class="mj-cm ${ok ? 'ok' : ''} ${cm.sent ? 'sent' : ''}" id="mj-cm"><div class="mj-cm-h">拖曳手牌進來，和中間這張牌組成單字 <b id="mj-cd">${remain()}</b></div>
                <div class="mj-cm-row" id="mj-cm-row">${cm.items.map(id => `<button class="${tileCls(id)} ${id === 'D' ? 'cmd' : 'res'} ${ok ? 'g' : ''}" data-id="${id}">${esc(letterOf(id).toUpperCase())}</button>`).join('')}</div>
                <button class="mj-cm-ok" data-a="cmok" ${ok && !cm.sent ? '' : 'disabled'} title="送出">${cm.sent ? '⏳' : '✓'}</button></div>`;
        }
        const waits = currentWaits(), dec = declared(), z = zimoInfo(), ron = ronReady(), sp = specialReady(), huLit = !!z || ron || !!sp;
        const chips = [
            cm && cm.sent ? `<span class="mj-chip">已送出 ${esc(pending ? pending.word.toUpperCase() : '')}…</span>` : '',
            dec && waits.length ? `<span class="mj-chip ten">🎯 聽：${waits.map(c => c.toUpperCase()).join(' ')}</span>` : '',
            sp ? '<span class="mj-chip ten">✨ 手牌已全是單字，可以按胡！（特殊胡・台數減半）</span>' : ''
        ].join('');
        const floats = playing ? `<div class="mj-fl-chips">${chips}</div>
            <div class="mj-fl-row"><button class="btn mj-b ting ${waits.length ? 'lit' : ''}" data-a="ting" ${waits.length ? '' : 'disabled'}>聽${dec ? ' ✓' : ''}</button>
                <button class="btn mj-b hu ${huLit ? 'lit' : ''}" data-a="hu" ${huLit ? '' : 'disabled'}>${z && selfDraw ? '自摸' : '胡'}</button></div>
            <div class="mj-fl-row"><button class="btn mj-b mag" data-a="search" title="查字典">🔍</button>${cm ? '<button class="btn mj-b cancel" data-a="cmcancel">取消</button>' : `<button class="btn mj-b claim" data-a="claim" ${canPress() ? '' : 'disabled'}>碰</button>`}
                <button class="btn mj-b" data-a="sort">整理</button></div>` : '';
        const overlay = !playing ? `<div class="mj-result"><div>${resultHtml()}<div class="mj-res-btns">${solo ? '<button class="btn btn-primary" data-a="again">再來一局</button>' : '<button class="btn btn-primary" data-a="back">🏠 回到房間</button>'}
            <button class="btn btn-secondary" data-a="leave">離開</button></div></div></div>` : '';
        const cfgTag = (turnSecOf() ? `・限時${turnSecOf()}秒` : '') + (allow3() ? '' : '・無三字單字') + (allow4() ? '' : '・無四字單字') + (room.cfg && room.cfg.money ? '・玩錢' : '') + (funOn() ? '・🌟金牌 ' + room.gold.toUpperCase() : '');
        const html = `<div data-felt="${esc(feltId())}" class="mj-game ${myTurn && playing && r.phase === 'discard' && !cm ? 'can-discard' : ''}">
            <div class="mj-felt"></div>
            <button class="btn btn-secondary mj-exit" data-a="leave">離開</button><div class="mj-deck">牌庫 ${(r.deck || '').length}${cfgTag}</div>
            <div class="mj-play np${np}">${ARROWS}${zones}<div class="mj-center" id="mj-center">${st}</div></div>
            ${opps}
            <div class="mj-mymelds">${meldHtml(mySeat)}</div>${cmHtml}
            <div class="mj-me"><div class="mj-mebar">${avHtml(mySeat, 'm')}<div class="mj-nmw"><b>${esc(myName())}</b>${solo ? '' : '<button class="mj-chatb" data-a="chat" title="快捷交流">💬</button>'}${bubble(mySeat)}</div></div>
            <div class="mj-float">${floats}</div>
            <div class="mj-row" id="mj-row">${handTiles}</div></div></div>${overlay}`;
        if (drag) return patchLive(html); // 拖曳中：只更新桌面其他部分，手牌那一排（和手指按住的牌）原封不動
        body.innerHTML = html;
        applySizes();
        if (drawFly) { drawFly = false; animateDraw(); }
    }
    function patchLive(html) {
        const tmp = document.createElement('div'); tmp.innerHTML = html;
        const oldGame = body.querySelector('.mj-game'), newGame = tmp.querySelector('.mj-game');
        if (!oldGame || !newGame) return;
        // 組牌區出現 / 消失（碰牌狀態改變）時，沒辦法繼續這次拖曳 → 放開牌，重新繪製
        if (!!body.querySelector('#mj-cm') !== !!tmp.querySelector('#mj-cm')) return abortDrag();
        ['.mj-deck', '.mj-play', '.mj-mymelds', '.mj-mebar', '.mj-float'].forEach(s => {
            const o = body.querySelector(s), n = tmp.querySelector(s);
            if (o && n) o.replaceWith(n);
        });
        const oo = [...body.querySelectorAll('.mj-opp')], nn = [...tmp.querySelectorAll('.mj-opp')];
        oo.forEach((o, i) => { if (nn[i]) o.replaceWith(nn[i]); });
        oldGame.classList.toggle('can-discard', newGame.classList.contains('can-discard'));
        const nov = tmp.querySelector('.mj-result');
        if (nov && !body.querySelector('.mj-result')) body.appendChild(nov);
    }
    window.addEventListener('resize', () => { if (room && room.status !== 'lobby' && !drag) applySizes(); });

    // ---------- 按鈕 ----------
    const act = a => {
        if (a.startsWith('lv:')) { aiLevel = a.slice(3); localStorage.setItem('mj_ai_level', aiLevel); return renderMenu(); }
        if (a === 'settings') return openSettings(); if (a === 'shop') return window.Economy && Economy.open('shop');
        if (a === 'create') return create(); if (a === 'join') return join(); if (a === 'exit') return close();
        if (a === 'solo') return startSolo(); if (a === 'multi') return renderEntry(); if (a === 'rules') return renderRules();
        if (a === 'enter') goFull();
        if (a === 'menu' || a === 'enter') return renderMenu();
        if (a === 'case') { lowerCase = !lowerCase; localStorage.setItem('mj_lowercase', lowerCase ? '1' : '0'); applyCase(); return renderMenu(); }
        if (a === 'invite') return typeof Friends !== 'undefined' ? Friends.openMjInvite(() => code) : null;
        if (a === 'start') return startGame(); if (a === 'leave') return leave();
        if (!room) return;
        if (a === 'back') { if (room.status !== 'ended') return; return ref.child('players/' + key).update({ back: room.round, ready: false }); } // 每位玩家都能自己回到房間
        if (a === 'chat') return openChat();
        if (a === 'search') return openSearch();
        if (a === 'ready') { const p = room.players[key]; return ref.child('players/' + key + '/ready').set(!(p && p.ready)); }
        if (a === 'again') {
            return startSolo();
        }
        if (room.status !== 'playing') return;
        if (a === 'claim') return pressClaim();
        if (a === 'cmcancel') return cancelClaim();
        if (a === 'cmok') return submitCompose();
        if (a === 'ting') return declareTing();
        if (a === 'hu') return winAction();
        if (a === 'sort') { sortHand(); render(); }
    };
    body.addEventListener('click', e => {
        const kb = e.target.closest('[data-kick]');
        if (kb && room && room.host === key && room.status !== 'playing') { // 房主踢人
            const k = kb.dataset.kick, p = room.players[k]; if (!p || k === key) return;
            if (confirm(`要把「${p.name}」請出房間嗎？`)) { ref.child('kicked/' + k).set(true); ref.child('players/' + k).remove(); }
            return;
        }
        const fav = e.target.closest('.mj-fav'); if (fav) { playClickSound(); return openPlayerCard(fav.dataset.pk); } // 房間裡點頭像：加好友
        const av = e.target.closest('.mj-avw.tgt');
        if (av && room && room.status === 'playing' && !introing && !drag) return sendEgg(+av.dataset.s); // 局內點對手頭像：丟雞蛋
        const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; playClickSound(); act(b.dataset.a);
    });
    try { db.ref('mjWords').on('child_added', sn => learnWord(String(sn.key || '').toLowerCase())); } catch (e) { }
    $('mj-settings').addEventListener('click', e => {
        const p = $('mj-settings');
        if (e.target === p || e.target.closest('[data-x]')) return p.classList.add('hidden');
        if (e.target.closest('[data-shop]')) { p.classList.add('hidden'); return window.Economy && Economy.open('shop'); }
        const th = e.target.closest('[data-th]');
        if (th) { playClickSound(); if (Economy.equip('throw', th.dataset.th)) openSettings(); else toast('還沒購買，到商店買買看吧'); }
    });
    $('mj-settings').addEventListener('change', e => {
        if (e.target.id !== 'mj-s3' && e.target.id !== 'mj-s4') return;
        soloCfg[e.target.id === 'mj-s3' ? 'allow3' : 'allow4'] = !!e.target.checked;
        try { localStorage.setItem('mjSoloCfg', JSON.stringify(soloCfg)); } catch (err) { }
    });
    $('mj-search').addEventListener('click', e => { if (e.target === $('mj-search')) $('mj-search').classList.add('hidden'); });
    $('mj-chatpop').addEventListener('click', e => {
        const b = e.target.closest('[data-chat]');
        if (b) { playClickSound(); if (room && room.status === 'playing') sendChat(+b.dataset.chat); } else if (!e.target.closest('.mj-cp-in')) $('mj-chatpop').classList.add('hidden');
    });
    body.addEventListener('input', e => { // 有輸入房間代碼 → 隱藏「建立房間」，避免點錯
        if (e.target.id !== 'mj-code') return;
        const b = body.querySelector('[data-a="create"]'); if (b) b.style.display = e.target.value.trim() ? 'none' : '';
    });
    body.addEventListener('change', e => {
        if (!room || room.host !== key || room.status === 'playing') return; // 房主的模式設定
        if (e.target.id === 'mj-allow3') ref.child('cfg/allow3').set(!!e.target.checked);
        if (e.target.id === 'mj-allow4') ref.child('cfg/allow4').set(!!e.target.checked);
        if (e.target.id === 'mj-money') ref.child('cfg/money').set(!!e.target.checked);
        if (e.target.id === 'mj-fun') ref.child('cfg/fun').set(!!e.target.checked);
    });
    body.addEventListener('focusout', e => {
        if (e.target.id !== 'mj-turn-input') return;
        if (room && room.host === key && room.status !== 'playing') {
            let v = Math.round(+e.target.value); if (!isFinite(v) || v < 0) v = 0; if (v > 0 && v < 5) v = 5; if (v > 600) v = 600;
            if (!room.cfg || +room.cfg.turnSec !== v) ref.child('cfg/turnSec').set(v);
        }
        setTimeout(render, 0);
    });

    // ---------- 拖曳：一次只能拖一張；排開附近的牌 + 傾斜；手牌區 ⇄ 組牌區；拖到桌中央出牌 ----------
    let drag = null;
    function dropGhost(d) { // 移除浮在手指上的那張牌與拖曳用的計時器 / 提示
        clearInterval(d.decay); if (d.ghost) d.ghost.remove();
        const gm = root.querySelector('.mj-game'); if (gm) gm.classList.remove('dragging');
        const cen = $('mj-center'); if (cen) cen.classList.remove('drop-on');
    }
    function abortDrag() { // 放棄這次拖曳：牌回到原位，畫面重繪
        if (!drag) return;
        const d = drag; drag = null;
        if (d.on) dropGhost(d);
        render();
    }
    window.addEventListener('blur', abortDrag);
    document.addEventListener('visibilitychange', () => { if (document.hidden) abortDrag(); });
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const allTiles = () => [...body.querySelectorAll('.mj-t.tl')];
    const idOf = x => x === 'D' ? 'D' : +x;
    const idsIn = c => c ? [...c.querySelectorAll('.mj-t.tl')].map(x => idOf(x.dataset.id)) : [];
    function flip(els, mutate, ms = .16) { // 先記位置 → 改變 → 用 translate 動畫滑回
        const first = new Map(els.map(e => { const r = e.getBoundingClientRect(); return [e, [r.left, r.top]]; }));
        mutate();
        els.forEach(e => {
            const r = e.getBoundingClientRect(), dx = first.get(e)[0] - r.left, dy = first.get(e)[1] - r.top;
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
            e.style.transition = 'none'; e.style.translate = dx + 'px ' + dy + 'px'; void e.offsetWidth;
            e.style.transition = `translate ${ms}s ease`; e.style.translate = '0 0';
        });
    }
    body.addEventListener('pointerdown', e => {
        const t = e.target.closest('.mj-t.tl');
        if (drag || !t || !room || room.status !== 'playing' || introing) return; // 已經有一根手指在拖牌時，其他手指一律忽略
        if (cm && cm.sent && t.closest('#mj-cm')) return;
        drag = { id: idOf(t.dataset.id), pid: e.pointerId, el: t, sx: e.clientX, sy: e.clientY, lx: e.clientX, on: false, tilt: 0, zone: 'none', t0: Date.now(), cmN: cm ? cm.n : null };
    });
    function startDrag() {
        const el = body.querySelector(`.mj-t.tl[data-id="${drag.id}"]`);
        if (!el) { drag = null; return false; }
        const rc = el.getBoundingClientRect();
        if (drag.id === drawnId) drawnId = null; // 剛摸到的牌一被拖曳就變回一般高度與顏色
        Object.assign(drag, { on: true, last: Date.now(), el, w: rc.width, h: rc.height, ox: drag.sx - rc.left, oy: drag.sy - rc.top, before: [...hand] });
        const gh = el.cloneNode(true);
        gh.className = 'mj-t mj-ghost ' + (vowel(letterOf(drag.id)) ? 'v' : '');
        Object.assign(gh.style, { width: rc.width + 'px', height: rc.height + 'px', fontSize: getComputedStyle(el).fontSize, left: rc.left + 'px', top: rc.top + 'px' });
        root.appendChild(gh); drag.ghost = gh;
        flip(allTiles(), () => { // 拖曳中先取消分組間距與抬高，讓排開的位置一致好判斷
            body.querySelectorAll('#mj-row .mj-t').forEach(x => x.classList.remove('g', 'gc', 'dr'));
            el.classList.add('ph');
        });
        drag.decay = setInterval(() => { if (!drag || !drag.ghost) return; drag.tilt *= .75; drag.ghost.style.transform = `scale(1.14) rotate(${drag.tilt}deg)`; }, 50);
        const gm = root.querySelector('.mj-game'); if (gm) gm.classList.add('dragging');
        sfx('pick');
        return true;
    }
    function reorder(x, cont) {
        const ph = drag.el, others = [...cont.querySelectorAll('.mj-t.tl')].filter(e => e !== ph);
        const px = x - cont.getBoundingClientRect().left;
        let idx = 0; others.forEach(e => { if (px > e.offsetLeft + e.offsetWidth / 2) idx++; });
        const inside = ph.parentElement === cont;
        const cur = inside ? others.filter(e => ph.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING).length : -1;
        if (idx === cur) return;
        if (!drag.slid) { drag.slid = true; sfx('slide'); } // 牌被擠開時的碰撞聲：一次拖曳只播一次
        flip(allTiles().filter(e => e !== ph), () => cont.insertBefore(ph, others[idx] || null));
    }
    window.addEventListener('pointermove', e => {
        if (!drag || e.pointerId !== drag.pid) return;
        if (!drag.on) { if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6 || !startDrag()) return; }
        drag.last = Date.now();
        const gh = drag.ghost;
        gh.style.left = (e.clientX - drag.ox) + 'px'; gh.style.top = (e.clientY - drag.oy) + 'px';
        drag.tilt = clamp(drag.tilt * .6 + (e.clientX - drag.lx) * 1.6 * .4, -18, 18); drag.lx = e.clientX;
        gh.style.transform = `scale(1.14) rotate(${drag.tilt}deg)`;
        const cen = $('mj-center'), c = cen.getBoundingClientRect(), rowH = $('mj-row'), rr = rowH.getBoundingClientRect();
        const cmEl = $('mj-cm'), cr = cmEl && cmEl.getBoundingClientRect();
        const inCm = cr && e.clientX > cr.left - 6 && e.clientX < cr.right + 6 && e.clientY > cr.top - 6 && e.clientY < cr.bottom + 6;
        const inCenter = e.clientX > c.left - 8 && e.clientX < c.right + 8 && e.clientY > c.top - 8 && e.clientY < c.bottom + 8;
        let zone = inCm ? 'cm' : e.clientY > rr.top - 46 ? 'hand' : inCenter ? 'center' : 'none';
        if (drag.id === 'D' && zone !== 'cm') zone = 'none'; // 被打出的那張牌只能在組牌區裡移動
        drag.zone = zone;
        cen.classList.toggle('drop-on', zone === 'center' && room.phase === 'discard' && room.turn === mySeat && !cm);
        if (zone === 'hand') reorder(e.clientX, rowH);
        else if (zone === 'cm') reorder(e.clientX, $('mj-cm-row'));
    });
    const endDrag = cancel => e => {
        if (!drag || (e && e.pointerId !== drag.pid)) return;
        const d = drag; drag = null;
        try { finishDrag(d, cancel); }
        catch (err) { console.warn('拖曳結束時發生錯誤', err); if (d.on) dropGhost(d); render(); } // 出錯也不能讓牌卡在畫面上
    };
    function finishDrag(d, cancel) {
        if (!d.on) { render(); return; }
        clearInterval(d.decay);
        const gm = root.querySelector('.mj-game'); if (gm) gm.classList.remove('dragging');
        const cen = $('mj-center'); if (cen) cen.classList.remove('drop-on');
        const gh = d.ghost, fade = (l, t, ms) => { gh.style.transition = `left ${ms}s, top ${ms}s, transform ${ms}s, opacity ${ms}s`; gh.style.left = l + 'px'; gh.style.top = t + 'px'; gh.style.transform = 'scale(1) rotate(0deg)'; };
        if (cancel || d.cmN !== (cm ? cm.n : null)) { gh.remove(); render(); return; } // 取消，或拖曳途中碰牌狀態已改變
        if (d.zone === 'center') {
            if (room && room.phase === 'discard' && room.turn === mySeat && !cm && typeof d.id === 'number') {
                const c = cen.getBoundingClientRect(); fade(c.left + c.width / 2 - d.w / 2, c.top + c.height / 2 - d.h / 2, .15); gh.style.opacity = '0';
                setTimeout(() => gh.remove(), 170); discardTile(d.id); render(); return;
            }
            toast(room && room.turn === mySeat && room.phase === 'discard' ? '現在還不能打牌' : '還沒輪到你'); // 不播放錯誤音效
        } else if (d.zone === 'hand' || d.zone === 'cm') {
            const pr = d.el.getBoundingClientRect(); fade(pr.left, pr.top, .14);
            const beforeCov = split(d.before).segs.reduce((a, s) => a + s.len, 0), wasOk = cm && isWordG(wordOf(cm.items));
            const inRow = idsIn($('mj-row')).filter(i => i !== 'D'), inCm = cm ? idsIn($('mj-cm-row')) : [];
            const known = new Set([...inRow, ...inCm]);
            const owned = new Set([...hand, ...(cm ? cm.items.filter(i => i !== 'D') : [])]); // 手牌 + 目前放在碰牌區的牌（從碰牌區拖回手牌區時，牌不在 hand 裡，不能被濾掉）
            hand = [...inRow.filter(i => owned.has(i)), ...hand.filter(i => !known.has(i))]; // 拖曳期間才摸到的牌接在最後面
            if (cm) cm.items = inCm;
            const afterCov = split(hand).segs.reduce((a, s) => a + s.len, 0), nowOk = cm && isWordG(wordOf(cm.items));
            const good = afterCov > beforeCov || (nowOk && !wasOk);
            sfx(good ? 'group' : 'drop'); // 沒組成單字也只是普通的放牌聲
            const zw = w => w.toUpperCase() + (zhOf(w) ? ' ' + zhOf(w) : '');
            if (afterCov > beforeCov) { const old = split(d.before).segs.map(s => s.w), all = split(hand).segs.map(s => s.w), nw = all.filter(w => { const i = old.indexOf(w); if (i >= 0) { old.splice(i, 1); return false; } return true; }); hint('🔗 組成單字：' + (nw.length ? nw : all).map(zw).join('　')); }
            else if (nowOk && !wasOk) hint('🔗 組成單字：' + zw(wordOf(cm.items)));
            setTimeout(() => { gh.remove(); render(); }, 150); return;
        }
        gh.remove(); render();
    }
    window.addEventListener('pointerup', endDrag(false));
    window.addEventListener('pointercancel', endDrag(true));

    const btn = $('btn-goto-mj'); if (btn) btn.addEventListener('click', () => { playClickSound(); open(); });
    return { open, joinByCode };
})();
