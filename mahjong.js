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
    const db = firebase.database();
    const vowel = c => 'aeiou'.includes(c);

    // ---------- 字典：只用 1~6 級單字庫 ----------
    let dict = null, dict2 = null, dictList = [], anaMap = new Map();
    const lvMap = {};
    function buildDict() {
        if (dict) return;
        dict = new Set(); dict2 = new Set();
        getVocabByLevels(ALL_LEVELS).forEach(v => {
            const w = String(v.word).trim().toLowerCase();
            if (/^[a-z]{3,}$/.test(w)) { dict.add(w); lvMap[w] = v.level; }
            else if (/^[a-z]{2}$/.test(w)) dict2.add(w); // 二字母單字：只有「最後剩一張」時才可用
        });
        (typeof mjExtraWords !== 'undefined' ? mjExtraWords : []).forEach(w => { // 麻將專用補充單字（沒有級別，不加級別台數）
            if (w.length >= 3) dict.add(w); else if (w.length === 2) dict2.add(w);
        });
        dictList = [...dict];
        anaMap = new Map(); // 排序後的字母 → 單字（AI 判斷「差一張就能湊成單字」用）
        [...dict, ...dict2].forEach(w => { if (w.length <= 8) anaMap.set([...w].sort().join(''), w); });
    }
    const isWord = w => !!dict && w.length >= 3 && dict.has(w);
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
    const myName = () => (playerNameInput.value || playerName || '訪客').trim();

    const root = document.createElement('div');
    root.id = 'mj-screen'; root.className = 'mj hidden';
    root.innerHTML = '<div class="mj-rot">📱 請將手機橫放，才能玩英文麻將</div><div id="mj-body"></div><div id="mj-toast"></div><div id="mj-hint"></div>';
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
    function open() { root.classList.remove('hidden'); buildDict(); applyCase(); loadSamples(); if (!ref) renderNotice(); }
    function stopTimers() {
        clearInterval(cdTimer); clearTimeout(resolveTimer);
        aiTimers.forEach(clearTimeout); aiTimers = []; aiDone = new Set();
    }
    function cleanup() {
        if (drag) { const d = drag; drag = null; if (d.on) dropGhost(d); }
        introToken++; introing = false; root.querySelectorAll('.mj-intro,.mj-fly').forEach(x => x.remove());
        if (ref) ref.off(); ref = null; room = null; mySeat = -1; curRound = null; solo = false; cm = null; pending = null;
        stopTimers(); root.classList.remove('in-game'); renderMenu();
    }
    function leave() {
        if (ref && room && !solo) {
            if (room.host === key) ref.remove();
            else if (room.status === 'playing') ref.update({ status: 'ended', result: { aborted: true, name: myName() } });
            else ref.child('players/' + key).remove();
        }
        cleanup();
    }
    function close() { if (ref) leave(); root.classList.add('hidden'); showScreen('lobby'); showMenu('main'); }

    function startCountdown() {
        clearInterval(cdTimer);
        cdTimer = setInterval(() => {
            const el = $('mj-cd');
            if (el && room && room.phase === 'claim') {
                const hasClaim = room.claims && Object.keys(room.claims).length;
                el.textContent = Math.max(0, Math.ceil(((hasClaim ? room.claimEnd : room.claimBase) - Date.now()) / 1000));
            }
        }, 250);
    }
    function enter(c) {
        solo = false; code = c; ref = db.ref('mj/' + c);
        ref.child('players/' + key).onDisconnect().remove();
        ref.on('value', onRoom);
        sendAvatar();
        startCountdown();
    }
    function sendAvatar() {
        if (typeof Profile !== 'undefined' && Profile.getThumb) {
            const r0 = ref;
            Profile.getThumb().then(av => { if (av && r0 === ref) r0.child('players/' + key + '/avatar').set(av); }).catch(() => { });
        }
    }
    function create() {
        key = safeKey(myName());
        const c = String(Math.floor(1000 + Math.random() * 9000)), r = db.ref('mj/' + c);
        r.transaction(cur => cur ? undefined : { host: key, status: 'lobby', players: { [key]: { name: myName(), seat: 0, ready: true } } },
            (err, ok) => ok ? enter(c) : toast('建立失敗，請再試一次'));
    }
    function join() { joinCode(($('mj-code').value || '').trim()); }
    function joinByCode(c) { // 好友邀請：直接加入對方的麻將房間
        root.classList.remove('hidden'); buildDict(); applyCase(); loadSamples();
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
            if (s.val().status !== 'lobby') return toast('該房間已開始遊戲');
            r.child('players').transaction(p => {
                p = p || {};
                if (p[key] || Object.keys(p).length >= 4) return;
                const used = Object.values(p).map(x => x.seat);
                let seat = 0; while (used.includes(seat)) seat++;
                p[key] = { name: myName(), seat, ready: false }; return p;
            }, (err, ok) => ok ? enter(c) : toast('無法加入（房間已滿或暱稱重複）'));
        });
    }

    // ---------- 開局 ----------
    function makeDeck() {
        const deck = [];
        Object.entries(DIST).forEach(([c, n]) => { for (let i = 0; i < n; i++) deck.push(c); });
        for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
        return deck;
    }
    function rollDice() { // 每人擲兩顆骰子，點數最大者先開始；同點者再擲，直到只剩一人（結果事先算好，大家看到的一樣）
        const r6 = () => 1 + Math.floor(Math.random() * 6);
        let con = [0, 1, 2, 3]; const rounds = [];
        for (let k = 0; k < 10; k++) {
            const dice = con.map(() => [r6(), r6()]), sums = dice.map(d => d[0] + d[1]), mx = Math.max(...sums);
            rounds.push({ seats: con.slice(), dice });
            con = con.filter((s, i) => sums[i] === mx);
            if (con.length === 1) break;
        }
        return { rounds, start: con[0] };
    }
    const freshFields = { claims: null, claimed: null, melds: null, result: null, tings: null, reveal: null, last: null, pile: '', n: 0, claimEnd: 0, claimBase: 0, claimExt: false, phase: 'draw' };
    function startGame() { // 多人：房主
        const ps = Object.values(room.players || {});
        if (ps.length !== 4) return toast('需要剛好 4 位玩家才能開始');
        const deck = makeDeck(), hands = {}, d = rollDice();
        for (let s = 0; s < 4; s++) hands[s] = deck.splice(0, 16).join('');
        ref.update({ ...freshFields, status: 'playing', round: Date.now(), deck: deck.join(''), hands, counts: [16, 16, 16, 16], turn: d.start, dice: d.rounds });
    }
    function startSolo() { // 單人：我 + 3 位 AI（名字隨機）
        buildDict();
        if (ref) ref.off();
        if (drag) { const d = drag; drag = null; if (d.on) dropGhost(d); }
        stopTimers(); introToken++; aiRevealed = false;
        key = safeKey(myName());
        const mine = myName().toLowerCase();
        const pool = AI_NAMES.filter(n => n.toLowerCase() !== mine).sort(() => Math.random() - .5).slice(0, 3);
        const deck = makeDeck(), hs = [], d = rollDice();
        for (let s = 0; s < 4; s++) hs.push(deck.splice(0, 16));
        aiHands = { 1: hs[1], 2: hs[2], 3: hs[3] }; aiPending = {}; aiTing = {};
        const players = { [key]: { name: myName(), seat: 0, ready: true } };
        pool.forEach((n, i) => { players['ai' + (i + 1)] = { name: n, seat: i + 1, ai: true, ready: true }; });
        solo = true; code = 'SOLO'; curRound = null;
        ref = localRef({ ...freshFields, host: key, status: 'playing', round: Date.now(), players, deck: deck.join(''), hands: { 0: hs[0].join('') }, counts: [16, 16, 16, 16], turn: d.start, dice: d.rounds });
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
        if (!me) { toast('你已不在房間'); return cleanup(); }
        mySeat = me.seat;
        if (room.status === 'lobby') { root.classList.remove('in-game'); curRound = null; return render(); }
        root.classList.add('in-game');
        if (!solo) ref.child('players/' + key).onDisconnect().cancel();

        if (room.round !== curRound && room.status === 'playing') { // 新的一局：領取自己的 16 張
            curRound = room.round; tiles = {}; nextId = 1; hand = []; drawnId = null; drawFly = false; selfDraw = false;
            cm = null; pending = null; claimBlockedN = 0; callouts = {}; tingSeen = new Set(); revealSent = false; waitCache = { k: '', v: [] };
            drawing = false; lastClaimN = 0; resolvedFor = ''; lastSpokenN = 0;
            ((room.hands && room.hands[mySeat]) || '').split('').filter(Boolean).forEach(addTile);
            ref.child('hands/' + mySeat).remove();
            if (!room.n && room.phase === 'draw') playIntro(); else { introToken++; introing = false; }
        }
        if (room.last && room.last.n !== lastSpokenN && room.phase === 'claim') { // 打出的牌：音效 + 朗讀字母
            lastSpokenN = room.last.n; sfx('discard'); speakWord(SAY[room.last.ch] || room.last.ch);
        }
        Object.keys(room.tings || {}).forEach(s => { // 有人宣告聽牌
            if (tingSeen.has(s)) return; tingSeen.add(s);
            if (+s !== mySeat) toast(`${seatName(+s)} 聽牌了！`);
            sfx('ting'); speakWord('ready hand');
        });
        if (room.claimed && room.claimed.n !== lastClaimN) { // 碰牌結果
            const cl = room.claimed; lastClaimN = cl.n;
            if (cl.seat === mySeat && pending && pending.n === cl.n) { cm = null; pending = null; drawnId = null; selfDraw = false; toast('✋ 碰成功！請打出一張牌'); if (typeof Profile !== 'undefined' && Profile.mjRecord) Profile.mjRecord({ type: 'pong' }); claimSpecialWin(); }
            else { if (cm && cm.n === cl.n) endClaimMode(true); if (cl.seat !== mySeat) toast(`${seatName(cl.seat)} 碰：${cl.word.toUpperCase()}`); }
            sfx('claim'); speakWord('bang'); callout(cl.seat, '碰');
            if (solo && aiPending[cl.seat] && aiPending[cl.seat].n === cl.n) {
                const h = aiHands[cl.seat]; aiPending[cl.seat].used.forEach(ch => { const k = h.indexOf(ch); if (k >= 0) h.splice(k, 1); });
            }
            aiPending = {};
        }
        if (cm && (room.phase !== 'claim' || !room.last || room.last.n !== cm.n)) endClaimMode(true); // 這一輪碰牌結束（沒碰成）
        if (pending && (!room.last || pending.n !== room.last.n)) pending = null;

        if (room.status !== 'playing' && drag) { const d = drag; drag = null; if (d.on) dropGhost(d); }
        if (room.status === 'ended') onEnded();
        if (room.status === 'playing') {
            if (room.phase === 'draw' && room.turn === mySeat && !introing) draw(mySeat, ch => { addTile(ch); drawnId = nextId - 1; drawFly = true; selfDraw = true; sfx('draw'); render(); });
            scheduleResolve();
            syncTing();
            if (solo && !introing) aiDrive();
        }
        render();
    }
    function onEnded() {
        const res = room.result || {};
        if (!res.aborted && winSfxRound !== room.round) {
            winSfxRound = room.round;
            if (res.draw) { if (typeof Profile !== 'undefined' && Profile.mjRecord) Profile.mjRecord({ type: 'end', win: false }); return finishEnded(); }
            // 贏家聽到 win（自摸則 touch myself），其他玩家聽到 game over
            if (res.seat === mySeat) { speakWord(res.self ? 'touch myself' : 'win'); sfx('win'); }
            else { speakWord('game over'); sfx('ting'); }
            if (typeof Profile !== 'undefined' && Profile.mjRecord) {
                const win = res.seat === mySeat;
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
        const at = !cs.length ? room.claimBase : allDone ? Math.max(room.claimBase, Date.now()) : room.claimEnd;
        const tag = `${room.round}_${room.last.n}_${cs.length}_${allDone ? 1 : 0}_${room.claimEnd}`;
        if (resolvedFor === tag) return;
        resolvedFor = tag; clearTimeout(resolveTimer); const n = room.last.n;
        resolveTimer = setTimeout(() => resolve(n), Math.max(0, at - Date.now()) + (solo ? 100 : 350));
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
            ch = d[0]; r.deck = d.slice(1); r.counts[seat] = 17; r.phase = 'discard'; return r;
        }, (err, ok) => { if (seat === mySeat) drawing = false; if (ok && ch) cb(ch); });
    }
    function doDiscard(seat, ch, cb) {
        let done = false;
        ref.transaction(r => {
            done = false;
            if (!r || r.phase !== 'discard' || r.turn !== seat) return;
            const base = Date.now() + (solo && seat === 0 ? QUICK_MS : CLAIM_MS);
            r.n = (r.n || 0) + 1; r.last = { ch, by: seat, n: r.n }; r.pile = (r.pile || '') + seat + ch;
            r.phase = 'claim'; r.claimBase = base; r.claimEnd = base; r.claimExt = false; r.claims = null; r.counts[seat] = 16; done = true; return r;
        }, () => { if (cb) cb(done); });
    }
    function discardTile(id) {
        if (!room || room.phase !== 'discard' || room.turn !== mySeat || !hand.includes(id)) return false;
        const ch = tiles[id], was = drawnId, wasSelf = selfDraw;
        // 特殊胡：把這張牌打出去後，剩下的手牌已全部組成合法單字（即使只有 16 張）→ 直接算胡
        const left = hand.filter(i => i !== id), sp = split(left);
        if (!sp.rest.length && (sp.segs.length || meldsOf(mySeat).length)) { declareWin(mySeat, [...sp.segs.map(s => s.w), ...meldsOf(mySeat)], false, false, null, undefined, true); return true; }
        hand = hand.filter(i => i !== id); drawnId = null; selfDraw = false; // 先從手牌拿掉，避免畫面閃一下
        doDiscard(mySeat, ch, ok => { if (!ok) { hand.push(id); drawnId = was; selfDraw = wasSelf; render(); } });
        return true;
    }
    function pressFor(seat, cb) { // 按下「碰」：登記進入組牌；第一位按碰的人會讓總倒數 +8 秒（只加一次）
        const n = room.last.n;
        ref.transaction(r => {
            if (!r || r.phase !== 'claim' || !r.last || r.last.n !== n || Date.now() > r.claimBase) return;
            r.claims = r.claims || {};
            if (r.claims[seat]) return;
            r.claims[seat] = { w: '', done: false };
            if (!r.claimExt) { r.claimExt = true; r.claimEnd = r.claimBase + EXT_MS; }
            return r;
        }, (err, ok) => cb && cb(ok));
    }
    function resolve(n) { // 房主：結算碰牌（最長單字優先；同長則離打牌者最近者優先）
        ref.transaction(r => {
            if (!r || r.phase !== 'claim' || !r.last || r.last.n !== n) return;
            let best = null;
            Object.entries(r.claims || {}).forEach(([s, c]) => {
                if (!c || !c.done || !c.w) return;
                s = +s; const d = (s - r.last.by + 4) % 4;
                if (!best || c.w.length > best.w.length || (c.w.length === best.w.length && d < best.d)) best = { s, w: c.w, d };
            });
            if (best) {
                r.turn = best.s; r.phase = 'discard'; r.pile = r.pile.slice(0, -2); r.counts[best.s] = 17;
                const old = Object.values((r.melds && r.melds[best.s]) || {}); old.push(best.w);
                r.melds = r.melds || {}; r.melds[best.s] = old; r.claimed = { seat: best.s, word: best.w, n };
            } else { r.turn = (r.last.by + 1) % 4; r.phase = 'draw'; }
            r.claims = null; r.claimExt = false; return r;
        });
    }

    // ---------- 手動碰牌：按「碰」→ 中央組牌區 → 和被打出的牌組成單字 → ✓ 送出 ----------
    const canPress = () => !!room && room.status === 'playing' && room.phase === 'claim' && !!room.last && room.last.by !== mySeat
        && Date.now() < room.claimBase && !cm && claimBlockedN !== room.last.n && !introing;
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
        if (!isWord(w)) return toast('還不是合法單字');
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
                if (isWord(L.slice(s, i).join(''))) {
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
        if (isWord(rw)) return { words: [...words, rw], two: false };
        if (rw.length === 2 && dict2.has(rw)) return { words: [...words, rw], two: true };
        return null;
    }
    function completeWith(rest, c) { // 剩下的牌 + 一張 c，能拼成哪個單字？（c 可插在任何位置）
        const R = rest.map(letterOf);
        for (let p = 0; p <= R.length; p++) {
            const w = [...R.slice(0, p), c, ...R.slice(p)].join('');
            if (isWord(w)) return { w, two: false };
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
    function score(words, self, two) {
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
        return { tai: t, lines };
    }
    function declareWin(seat, words, self, two, from, n, special) {
        const sc = score(words, self, two), name = seatName(seat);
        if (special) sc.lines.push('特殊胡：手牌全部組成合法單字');
        ref.transaction(r => {
            if (!r || r.status !== 'playing') return;
            const okSelf = from == null && r.phase === 'discard' && r.turn === seat;
            const okRon = from != null && r.phase === 'claim' && r.last && r.last.n === n && r.last.by === from;
            if (!okSelf && !okRon) return;
            r.status = 'ended';
            r.result = { seat, name, from: from == null ? null : from, fromName: from == null ? '' : seatName(from), words, self: !!self, two: !!two, special: !!special, tai: sc.tai, lines: sc.lines };
            return r;
        });
    }
    function claimSpecialWin() { // 碰牌後，手牌全部成單字（加上碰到的單字）→ 也算胡
        const w = winInfo(hand);
        if (w) declareWin(mySeat, [...w.words, ...meldsOf(mySeat)], false, w.two, null, undefined, true);
    }
    function winAction() {
        const z = zimoInfo();
        if (z) return declareWin(mySeat, [...z.words, ...meldsOf(mySeat)], selfDraw, z.two, null);
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
        const c0 = cnt(ls), cands = dictList.filter(w => w.length <= ls.length && fits(w, c0));
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
        if (room.n < 20) return; // 前期（每人約 5 次出牌內）電腦不會聽牌，避免太快結束
        const p = plan(aiHands[s], 3), rest = p.rest;
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
            if (wd && room.n >= 20 && Math.random() < .4) return declareWin(s, [...t.words, wd, ...mine], self, wd.length === 2, null);
            h.pop(); return doDiscard(s, drawn);
        }
        const p = plan(h, 3);
        if (!p.rest.length && room.n >= 20 && Math.random() < .25) return declareWin(s, [...p.words, ...mine], self, false, null);
        let ch;
        if (Math.random() < .5 || !p.rest.length) ch = h[Math.floor(Math.random() * h.length)];
        else { const pri = x => (RARE[x] || 0) * 2 + Math.random(); ch = [...p.rest].sort((a, b) => pri(b) - pri(a))[0]; }
        h.splice(h.indexOf(ch), 1);
        doDiscard(s, ch, ok => { if (ok && !aiTing[s] && Math.random() < .08) aiTryTing(s); });
    }
    function aiClaim(s, n, ch) { // 已聽牌的電腦：有機率胡你打出的牌；沒聽牌的電腦：很少碰（4%、至少 4 個字母、最多碰一次）
        if (!room || room.phase !== 'claim' || !room.last || room.last.n !== n) return;
        const t = aiTing[s];
        if (t) {
            const wd = t.waits.includes(ch) && room.n >= 20 && Math.random() < .25 ? anaMap.get([...t.rest, ch].sort().join('')) : null;
            if (wd) declareWin(s, [...t.words, wd, ...meldsOf(s)], false, wd.length === 2, room.last.by, n);
            return;
        }
        if (Math.random() > .04 || meldsOf(s).length >= 1) return;
        const withCh = plan([...aiHands[s], ch], 3);
        const w = withCh.words.filter(x => x.includes(ch) && x.length >= 4).sort((a, b) => b.length - a.length)[0];
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
        return `<div class="mj-avw"><div class="mj-av ${size} ${turn ? 'turn' : ''}" title="${esc(nm)}"${st}>${a ? `<img src="${esc(a)}" alt="">` : esc(nm.trim().charAt(0).toUpperCase() || '?')}</div>`
            + `${ting ? '<span class="mj-ting">聽</span>' : ''}${callouts[s] ? `<span class="mj-callout">${esc(callouts[s])}</span>` : ''}</div>`;
    }

    // ---------- 開場：倒數 3-2-1 → 擲骰決定誰先開始 → 洗牌 → 把牌抽進手牌區 ----------
    function playIntro() {
        const tok = ++introToken; introing = true; revealed = new Set(); render();
        root.querySelectorAll('.mj-intro').forEach(x => x.remove());
        const ov = document.createElement('div'); ov.className = 'mj-intro'; root.appendChild(ov);
        const alive = () => tok === introToken && room && ref;
        const stop = () => ov.remove();
        const FACE = '⚀⚁⚂⚃⚄⚅', r6 = () => 1 + Math.floor(Math.random() * 6);
        const shuffleHtml = '<div class="mj-shuf">' + Array.from({ length: 16 }, () => `<i style="--dx:${Math.round(Math.random() * 90 - 45)}px;--dy:${Math.round(Math.random() * 50 - 25)}px;--r:${Math.round(Math.random() * 50 - 25)}deg;animation-delay:${(-Math.random() * .6).toFixed(2)}s"></i>`).join('') + '</div><div class="mj-intro-txt">洗牌中…</div>';

        const panel = (R, vals, title, topSeats, msg) => {
            const cards = [0, 1, 2, 3].map(s => {
                const k = R.seats.indexOf(s), d = k >= 0 ? vals[k] : null, sum = d ? d[0] + d[1] : '';
                return `<div class="mj-dc ${k < 0 ? 'out' : ''} ${topSeats && topSeats.includes(s) ? 'top' : ''}">${avHtml(s, 's')}<b>${esc(seatName(s))}</b>
                    <div class="mj-dice">${d ? `<span>${FACE[d[0] - 1]}</span><span>${FACE[d[1] - 1]}</span>` : '—'}</div><div class="mj-dsum">${topSeats ? sum : ''}</div></div>`;
            }).join('');
            return `<div class="mj-dp"><div class="mj-dt">${title}</div><div class="mj-dcs">${cards}</div><div class="mj-dm">${msg || '&nbsp;'}</div></div>`;
        };
        const diceStage = next => {
            const rounds = room.dice || []; let ri = 0;
            const step = () => {
                if (!alive()) return stop();
                if (ri >= rounds.length) { // 全部擲完：宣布誰先開始
                    const R = rounds[rounds.length - 1] || { seats: [0, 1, 2, 3], dice: [[1, 1], [1, 1], [1, 1], [1, 1]] };
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
        let c = 3;
        const tick = () => {
            if (!alive()) return stop();
            if (c > 0) { ov.innerHTML = `<div class="mj-cd-wrap"><small>即將開始</small><div class="mj-cd-num">${c}</div></div>`; sfx('tick'); c--; setTimeout(tick, 850); }
            else diceStage(() => { if (!alive()) return stop(); ov.innerHTML = shuffleHtml; sfx('shuffle'); setTimeout(deal, SAMPLES.m3 ? Math.round(SAMPLES.m3.duration * 1000) + 150 : 1500); });
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
        tick();
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
        body.innerHTML = `<div class="mj-lobby mj-notice"><div class="mj-phone">📱</div><h2>請將手機轉為橫向</h2>
            <p class="mj-note">英文麻將需要橫向螢幕才能正常操作。<br>(建議使用全螢幕)</p>
            <button class="btn btn-primary" data-a="enter">我知道了，進入</button>
            <button class="btn btn-secondary" data-a="exit">返回主選單</button></div>`;
    }
    function renderMenu() {
        body.innerHTML = `<div class="mj-lobby"><h2>🀄 英文麻將（測試版）</h2>
            <p class="mj-note">用字母牌拼出單字，最先把手牌全部拼成單字的人胡牌！<br>請使用橫向全螢幕。目前暱稱：<b>${esc(myName())}</b></p>
            <button class="btn btn-primary" data-a="solo">🤖 單人練習（與 3 位 AI 對戰）</button>
            <button class="btn btn-sky" data-a="multi">👥 多人房間（需 4 位玩家）</button>
            <button class="btn btn-secondary" data-a="rules">📖 麻將規則說明</button>
            <button class="btn btn-secondary" data-a="case">牌面字母：${lowerCase ? '小寫 (abc)' : '大寫 (ABC)'}（點擊切換）</button>
            <button class="btn btn-secondary" data-a="exit">返回主選單</button></div>`;
    }
    function renderEntry() {
        body.innerHTML = `<div class="mj-lobby"><h2>👥 多人房間</h2>
            <p class="mj-note">需 4 位玩家才能開始。目前暱稱：<b>${esc(myName())}</b></p>
            <input id="mj-code" maxlength="4" inputmode="numeric" placeholder="加入房間：輸入 4 碼代碼">
            <div class="mj-row2"><button class="btn btn-primary" data-a="create">建立房間</button><button class="btn btn-secondary" data-a="join">加入房間</button></div>
            <button class="btn btn-secondary" data-a="menu">返回</button></div>`;
    }
    function renderRules() {
        body.innerHTML = `<div class="mj-lobby"><h2>📖 英文麻將規則</h2><div class="mj-rules">
            <h3>🎯 目標</h3><p>把手上的字母牌全部組成<b>單字</b>（一般情況每個單字至少3個字母），就可以<b>胡牌</b>！</p>
            <h3>🃏 開局</h3><ul><li>開局3秒倒數後每人會自動擲骰子，<b>點數最大者先開始</b>，接著洗牌並自動把牌抽進手牌區。</li><li>輪到你時會<b>自動摸牌</b>，摸到的牌加在最右邊且為<b>橘色底</b>；拖曳它或整理手牌，就會回到一般狀態。出牌順序是<b>逆時針</b></li></ul>
            <h3>👆 操作</h3><ul><li><b>拖曳手牌</b>即可自己排列手牌與出牌</li><li>連續排好的字母如果拼成合法單字，會<b>自動靠在一起成為一組(綠色底)</b></li><li><b>把牌拖到牌桌中央</b>就能出牌。</li><li><b>整理(可好好利用)</b>：把單字組整組移到最左邊（依首字母排序），其餘的牌依序接在後面。</li></ul>
            <h3>✋ 碰</h3><ul><li>別人打出一張牌後，其他三位玩家有<b>6 秒</b>可以按「碰」。</li><li>有人按碰時，總倒數會<b>再加 10 秒</b>。</li><li>按下去後會出現<b>組牌區</b>：把手牌拖進去，和被打出的那張牌手動組成單字；組成單字成功時底下會變綠色，記得按右下角的 ✓ 送出。</li><li>組不出單字？再按一次「取消」，牌會放回手牌區，而且這一輪不能再碰。</li><li>所有人都送出或時間到後，<b>單字最長者優先</b>。碰到的單字會公開擺在你前方的牌桌上，然後由你打出一張牌。</li></ul>
            <h3>🎯 聽牌</h3><ul><li>當手牌除了綠色的單字組以外，<b>剩下的牌只差一張就能湊成單字</b>時，「聽」按鈕會亮起。</li><li>按下「聽」會顯示你聽哪些字母，並在你的頭像旁出現「聽」。</li><li>只剩 1 張沒成組時，可以和另一張牌組成<b>二字母單字(特殊情況)</b>，也能胡牌但台數會大幅降低。</li></ul>
            <h3>🀄 胡牌</h3><ul><li>聽牌後，別人打出你聽的那張牌，「胡」按鈕會亮成紅色，按下去就胡啦，打出那張牌的人<b>放槍</b>。</li><li>輪到自己摸牌，當手牌全部成單字時，按鈕會變成「<b>自摸</b>」，爽。</li><li>結算畫面會公開所有玩家的手牌與碰牌。牌庫摸完仍無人胡牌則為流局。</li></ul>
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

    function resultHtml() {
        const res = room.result || {};
        if (res.aborted) return `<h2>⚠️ ${esc(res.name)} 離開了遊戲</h2>`;
        if (res.draw) return '<h2>🤝 牌庫已空，流局</h2>';
        const rows = [0, 1, 2, 3].map(s => {
            const win = s === res.seat, from = !res.self && res.from === s, ms = meldsOf(s);
            let hands;
            if (win) hands = (res.words || []).slice(0, (res.words || []).length - ms.length).map(w => `<span class="mj-rw">${[...w].map(c => tileHtml(c, 'g')).join('')}</span>`).join('');
            else { const h = (room.reveal && room.reveal[s]) || ''; hands = h === '-' ? '' : `<span class="mj-rw">${[...h].map(c => tileHtml(c)).join('')}</span>`; }
            return `<div class="mj-rr ${win ? 'w' : ''}"><div class="mj-rn">${avHtml(s, 's')}<b>${esc(seatName(s))}</b>${win ? '<span class="mj-tag w">🏆 贏家</span>' : ''}${from ? '<span class="mj-tag f">💥 放槍</span>' : ''}</div>
                <div class="mj-rt">${hands}${ms.length ? `<span class="mj-rw m">${ms.map(w => [...w].map(c => tileHtml(c, 'b')).join('')).join('<i></i>')}</span>` : ''}</div></div>`;
        }).join('');
        return `<h2>🏆 ${esc(res.name)} ${res.self ? '自摸' : '胡牌'}！<span class="mj-tai">${res.tai} 台</span></h2>
            <div class="mj-lines">${(res.lines || []).map(l => `<span>${esc(l)}</span>`).join('')}</div>${rows}`;
    }

    function render() {
        if (!room || !ref) return;
        // 手指太久沒動 / 沒收到放開事件時，要把牌收回，不能卡在畫面上
        if (drag && Date.now() - (drag.last || drag.t0) > (drag.on ? 20000 : 3000)) { abortDrag(); return; }
        if (room.status === 'lobby') {
            const ps = Object.values(room.players || {}).sort((a, b) => a.seat - b.seat), isH = room.host === key;
            const others = ps.filter(p => safeKey(p.name) !== room.host), readyN = others.filter(p => p.ready).length;
            const allReady = ps.length === 4 && readyN === others.length;
            const me = room.players[key], myReady = !!(me && me.ready);
            const rows = [0, 1, 2, 3].map(s => {
                const p = ps.find(x => x.seat === s);
                if (!p) return '<div class="room-player"><span class="nm" style="opacity:.5">座位 ' + (s + 1) + '：等待加入…</span></div>';
                const host = safeKey(p.name) === room.host, av = safeAvatar(p.avatar);
                const tag = host ? '<span class="tag-host">👑 房主</span>' : p.ready ? '<span class="tag-ready">✅ 準備就緒</span>' : '<span class="tag-wait">⏳ 稍等一下</span>';
                return `<div class="room-player"><span class="nm" style="display:flex;align-items:center;gap:8px;"><span class="avatar" style="width:32px;height:32px;font-size:14px;">${av ? `<img src="${esc(av)}" alt="">` : esc((p.name || '?').trim().charAt(0).toUpperCase() || '?')}</span>${esc(p.name)}${safeKey(p.name) === key ? ' (你)' : ''}</span>${tag}</div>`;
            }).join('');
            body.innerHTML = `<div class="mj-lobby room-like"><h1>🀄 英文麻將等待大廳</h1>
                <div class="room-header"><span>房間代碼：</span><span class="room-code">#${esc(code)}</span></div>
                <label class="field-label">目前房間內成員（需 4 人）：</label><div class="player-list">${rows}</div>
                <div class="btn-grid">
                ${isH ? `<button class="btn btn-primary" data-a="start" ${allReady ? '' : 'disabled'}>${ps.length < 4 ? `等待玩家加入 (${ps.length}/4)` : !allReady ? `等待玩家準備 (${readyN}/${others.length})` : '開始英文麻將！'}</button>`
                    : `<button class="btn ${myReady ? 'btn-secondary' : 'btn-primary'}" data-a="ready">${myReady ? '⏳ 稍等一下 (取消準備)' : '✅ 準備就緒'}</button>`}
                <button class="btn btn-sky" data-a="invite">👥 邀請好友</button>
                <button class="btn btn-danger" data-a="leave">離開房間</button></div></div>`;
            return;
        }
        const r = room, myTurn = r.turn === mySeat, last = r.last, playing = r.status === 'playing';
        const pairs = [], pile = r.pile || '';
        for (let i = 0; i + 1 < pile.length; i += 2) pairs.push({ s: +pile[i], c: pile[i + 1] });
        const lastIdx = r.phase === 'claim' && pairs.length ? pairs.length - 1 : -1;
        const zone = (s, cls) => `<div class="mj-dz ${cls}">${pairs.map((p, i) => p.s === s ? `<span class="mj-pc ${i === lastIdx ? 'last' : ''}">${p.c.toUpperCase()}</span>` : '').join('')}</div>`;
        const opp = (o, cls) => { const s = (mySeat + o) % 4; return `<div class="mj-opp ${cls}">${avHtml(s, 's')}<div class="mj-melds">${meldHtml(s)}</div></div>`; };
        const remain = () => Math.max(0, Math.ceil(((r.claims && Object.keys(r.claims).length ? r.claimEnd : r.claimBase) - Date.now()) / 1000));
        let st;
        if (!playing) st = '本局結束';
        else if (r.phase === 'claim' && last) st = cm ? '' : `<div class="mj-ct ${vowel(last.ch) ? 'v' : ''}">${last.ch.toUpperCase()}</div><div class="mj-cdline">${esc(seatName(last.by))} 打出　<b id="mj-cd">${remain()}</b></div>`;
        else st = myTurn ? (r.phase === 'draw' ? '摸牌中…' : '輪到你<br>拖曳一張牌到這裡打出') : `輪到 ${esc(seatName(r.turn))}`;

        const { segs } = split(hand), mark = new Array(hand.length).fill(0);
        segs.forEach(s => { for (let i = 0; i < s.len; i++) mark[s.s + i] = i === 0 ? 1 : 2; });
        const tileCls = id => `mj-t tl ${vowel(letterOf(id)) ? 'v' : ''}`;
        const handTiles = hand.map((id, i) => `<button class="${tileCls(id)} ${mark[i] ? 'g' : ''} ${mark[i] === 2 ? 'gc' : ''} ${id === drawnId && playing ? 'dr' : ''} ${introing && !revealed.has(id) ? 'hide' : ''}" data-id="${id}">${tiles[id].toUpperCase()}</button>`).join('');

        let cmHtml = '';
        if (cm && playing) { // 中央組牌區：灰色虛線外框、半透明
            const w = wordOf(cm.items), ok = isWord(w);
            cmHtml = `<div class="mj-cm ${ok ? 'ok' : ''} ${cm.sent ? 'sent' : ''}" id="mj-cm"><div class="mj-cm-h">拖曳手牌進來，和中間這張牌組成單字 <b id="mj-cd">${remain()}</b></div>
                <div class="mj-cm-row" id="mj-cm-row">${cm.items.map(id => `<button class="${tileCls(id)} ${id === 'D' ? 'cmd' : 'res'} ${ok ? 'g' : ''}" data-id="${id}">${esc(letterOf(id).toUpperCase())}</button>`).join('')}</div>
                <button class="mj-cm-ok" data-a="cmok" ${ok && !cm.sent ? '' : 'disabled'} title="送出">${cm.sent ? '⏳' : '✓'}</button></div>`;
        }
        const waits = currentWaits(), dec = declared(), z = zimoInfo(), ron = ronReady(), huLit = !!z || ron;
        const chips = [
            cm && cm.sent ? `<span class="mj-chip">已送出 ${esc(pending ? pending.word.toUpperCase() : '')}…</span>` : '',
            dec && waits.length ? `<span class="mj-chip ten">🎯 聽：${waits.map(c => c.toUpperCase()).join(' ')}</span>` : ''
        ].join('');
        const floats = playing ? `<div class="mj-fl-chips">${chips}</div>
            <div class="mj-fl-row"><button class="btn mj-b ting ${waits.length ? 'lit' : ''}" data-a="ting" ${waits.length ? '' : 'disabled'}>聽${dec ? ' ✓' : ''}</button>
                <button class="btn mj-b hu ${huLit ? 'lit' : ''}" data-a="hu" ${huLit ? '' : 'disabled'}>${z && selfDraw ? '自摸' : '胡'}</button></div>
            <div class="mj-fl-row">${cm ? '<button class="btn mj-b cancel" data-a="cmcancel">取消</button>' : `<button class="btn mj-b claim" data-a="claim" ${canPress() ? '' : 'disabled'}>碰</button>`}
                <button class="btn mj-b" data-a="sort">整理</button></div>` : '';
        const overlay = !playing ? `<div class="mj-result"><div>${resultHtml()}<div class="mj-res-btns">${solo ? '<button class="btn btn-primary" data-a="again">再來一局</button>' : room.host === key ? '<button class="btn btn-primary" data-a="again">回到房間，再來一局</button>' : '<span class="mj-note">等待房主開始下一局…</span>'}
            <button class="btn btn-secondary" data-a="leave">離開</button></div></div></div>` : '';
        const html = `<div class="mj-game ${myTurn && playing && r.phase === 'discard' && !cm ? 'can-discard' : ''}">
            <div class="mj-felt"></div>
            <button class="btn btn-secondary mj-exit" data-a="leave">離開</button><div class="mj-deck">牌庫 ${(r.deck || '').length}</div>
            <div class="mj-play">${ARROWS}${zone((mySeat + 2) % 4, 'z-top')}${zone((mySeat + 3) % 4, 'z-left')}<div class="mj-center" id="mj-center">${st}</div>${zone((mySeat + 1) % 4, 'z-right')}${zone(mySeat, 'z-bot')}</div>
            ${opp(2, 'top')}${opp(3, 'left')}${opp(1, 'right')}
            <div class="mj-mymelds">${meldHtml(mySeat)}</div>${cmHtml}
            <div class="mj-me"><div class="mj-mebar">${avHtml(mySeat, 'm')}<b>${esc(myName())}</b></div>
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
        ['.mj-deck', '.mj-play', '.mj-opp.top', '.mj-opp.left', '.mj-opp.right', '.mj-mymelds', '.mj-mebar', '.mj-float'].forEach(s => {
            const o = body.querySelector(s), n = tmp.querySelector(s);
            if (o && n) o.replaceWith(n);
        });
        oldGame.classList.toggle('can-discard', newGame.classList.contains('can-discard'));
        const nov = tmp.querySelector('.mj-result');
        if (nov && !body.querySelector('.mj-result')) body.appendChild(nov);
    }
    window.addEventListener('resize', () => { if (room && room.status !== 'lobby' && !drag) applySizes(); });

    // ---------- 按鈕 ----------
    const act = a => {
        if (a === 'create') return create(); if (a === 'join') return join(); if (a === 'exit') return close();
        if (a === 'solo') return startSolo(); if (a === 'multi') return renderEntry(); if (a === 'rules') return renderRules();
        if (a === 'menu' || a === 'enter') return renderMenu();
        if (a === 'case') { lowerCase = !lowerCase; localStorage.setItem('mj_lowercase', lowerCase ? '1' : '0'); applyCase(); return renderMenu(); }
        if (a === 'invite') return typeof Friends !== 'undefined' ? Friends.openMjInvite(() => code) : null;
        if (a === 'start') return startGame(); if (a === 'leave') return leave();
        if (!room) return;
        if (a === 'ready') { const p = room.players[key]; return ref.child('players/' + key + '/ready').set(!(p && p.ready)); }
        if (a === 'again') {
            if (solo) return startSolo();
            const u = { status: 'lobby', result: null, reveal: null, tings: null }; Object.keys(room.players).forEach(k => { if (k !== room.host) u['players/' + k + '/ready'] = false; }); return ref.update(u);
        }
        if (room.status !== 'playing') return;
        if (a === 'claim') return pressClaim();
        if (a === 'cmcancel') return cancelClaim();
        if (a === 'cmok') return submitCompose();
        if (a === 'ting') return declareTing();
        if (a === 'hu') return winAction();
        if (a === 'sort') { sortHand(); render(); }
    };
    body.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; playClickSound(); act(b.dataset.a); });

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
            const beforeCov = split(d.before).segs.reduce((a, s) => a + s.len, 0), wasOk = cm && isWord(wordOf(cm.items));
            const inRow = idsIn($('mj-row')).filter(i => i !== 'D'), inCm = cm ? idsIn($('mj-cm-row')) : [];
            const known = new Set([...inRow, ...inCm]);
            hand = [...inRow.filter(i => hand.includes(i)), ...hand.filter(i => !known.has(i))]; // 拖曳期間才摸到的牌接在最後面
            if (cm) cm.items = inCm;
            const afterCov = split(hand).segs.reduce((a, s) => a + s.len, 0), nowOk = cm && isWord(wordOf(cm.items));
            const good = afterCov > beforeCov || (nowOk && !wasOk);
            sfx(good ? 'group' : 'drop'); // 沒組成單字也只是普通的放牌聲
            if (afterCov > beforeCov) hint('🔗 組成單字：' + split(hand).segs.map(s => s.w.toUpperCase()).join('、'));
            setTimeout(() => { gh.remove(); render(); }, 150); return;
        }
        gh.remove(); render();
    }
    window.addEventListener('pointerup', endDrag(false));
    window.addEventListener('pointercancel', endDrag(true));

    const btn = $('btn-goto-mj'); if (btn) btn.addEventListener('click', () => { playClickSound(); open(); });
    return { open, joinByCode };
})();
