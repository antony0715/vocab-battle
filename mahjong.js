// ==================== 🀄 英文麻將（測試版）mahjong.js ====================
// 依賴 app.js：$, esc, safeKey, playerName, playerNameInput, playClickSound, getVocabByLevels, LEVEL_LABEL
// Firebase：mj/{房間碼} = { host, status:'lobby'|'playing'|'ended', players:{key:{name,seat}},
//   deck, hands(開局暫存), counts[4], turn, phase:'draw'|'discard'|'claim', pile, last:{ch,by,n}, claimEnd,
//   claims:{seat:{w}}, claimed:{seat,word,n}, melds:{seat:[word]}, result }
// 注意：測試版以「各玩家端自行驗證」為主，未做防作弊；房主離線時該局會中止。
const Mahjong = (() => {
    const DIST = { a: 11, b: 2, c: 4, d: 5, e: 17, f: 2, g: 3, h: 4, i: 10, j: 1, k: 1, l: 5, m: 3, n: 9, o: 10, p: 3, q: 1, r: 9, s: 9, t: 10, u: 4, v: 1, w: 2, x: 1, y: 2, z: 1 }; // 共 130 張
    const CLAIM_MS = 6000, RARE = { j: 2, q: 2, x: 2, z: 2, k: 1 }, LVB = { level4: 1, level5: 2, level6: 3 };
    const db = firebase.database();
    let dict = null, dictPromise = null, dictBig = false;
    const lvMap = {};

    // ---------- 字典：vocab 4~6 級 + 線上英文字表（失敗則只用 vocab）----------
    function loadDict() {
        if (dictPromise) return dictPromise;
        const set = new Set();
        getVocabByLevels(['level4', 'level5', 'level6']).forEach(v => {
            const w = String(v.word).trim().toLowerCase();
            if (/^[a-z]{2,}$/.test(w)) { set.add(w); lvMap[w] = v.level; }
        });
        dictPromise = (async () => {
            try {
                const r = await fetch('https://cdn.jsdelivr.net/gh/dwyl/english-words@master/words_alpha.txt');
                if (r.ok) { (await r.text()).split(/\s+/).forEach(w => { if (w.length >= 3 && w.length <= 14) set.add(w); }); dictBig = true; }
            } catch (e) { }
            dict = set;
            const el = $('mj-dict'); if (el) el.textContent = dictBig ? `✅ 字典已載入（${set.size} 字）` : '⚠️ 線上字典載入失敗，目前只能使用 4~6 級單字庫判定';
            render();
            return set;
        })();
        return dictPromise;
    }
    const isWord = w => !!dict && w.length >= 3 && dict.has(w);

    // ---------- 狀態 ----------
    let ref = null, room = null, code = '', key = '', mySeat = -1;
    let tiles = {}, nextId = 1, loose = [], groups = [], sel = [];
    let drewSelf = false, drawing = false, claimMode = false, pending = null;
    let curRound = null, resolvedFor = '', lastClaimN = 0, cdTimer = null;
    const myName = () => (playerNameInput.value || playerName || '訪客').trim();

    const root = document.createElement('div');
    root.id = 'mj-screen'; root.className = 'mj hidden';
    root.innerHTML = '<div class="mj-rot">📱 請將手機橫放，才能玩英文麻將</div><div id="mj-body"></div><div id="mj-toast"></div>';
    document.body.appendChild(root);
    const body = root.querySelector('#mj-body');
    const toast = m => { const t = $('mj-toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2400); };
    const seatName = s => { const p = Object.values((room && room.players) || {}).find(x => x.seat === s); return p ? p.name : '玩家' + (s + 1); };
    const meldsOf = s => Object.values((room && room.melds && room.melds[s]) || {});
    const wordOf = ids => ids.map(i => tiles[i]).join('');

    // ---------- 進出 ----------
    function open() { root.classList.remove('hidden'); loadDict(); if (!ref) renderEntry(); }
    function cleanup() {
        if (ref) ref.off(); ref = null; room = null; mySeat = -1; curRound = null;
        clearInterval(cdTimer); root.classList.remove('in-game'); renderEntry();
    }
    function leave() {
        if (ref && room) {
            if (room.host === key) ref.remove();
            else if (room.status === 'playing') ref.update({ status: 'ended', result: { aborted: true, name: myName() } });
            else ref.child('players/' + key).remove();
        }
        cleanup();
    }
    function close() { if (ref) leave(); root.classList.add('hidden'); showScreen('lobby'); showMenu('main'); }

    function enter(c) {
        code = c; ref = db.ref('mj/' + c);
        ref.child('players/' + key).onDisconnect().remove();
        ref.on('value', onRoom);
        if (typeof Profile !== 'undefined' && Profile.getThumb) { // 頭像縮圖寫進房間
            const r0 = ref;
            Profile.getThumb().then(av => { if (av && r0 === ref) r0.child('players/' + key + '/avatar').set(av); }).catch(() => { });
        }
        clearInterval(cdTimer);
        cdTimer = setInterval(() => {
            const el = $('mj-cd');
            if (el && room && room.claimEnd) el.textContent = Math.max(0, Math.ceil((room.claimEnd - Date.now()) / 1000));
        }, 250);
    }
    function create() {
        key = safeKey(myName());
        const c = String(Math.floor(1000 + Math.random() * 9000)), r = db.ref('mj/' + c);
        r.transaction(cur => cur ? undefined : { host: key, status: 'lobby', players: { [key]: { name: myName(), seat: 0, ready: true } } },
            (err, ok) => ok ? enter(c) : toast('建立失敗，請再試一次'));
    }
    function join() {
        key = safeKey(myName());
        const c = ($('mj-code').value || '').trim();
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

    // ---------- 開局（房主）----------
    function startGame() {
        const ps = Object.values(room.players || {});
        if (ps.length !== 4) return toast('需要剛好 4 位玩家才能開始');
        const deck = [];
        Object.entries(DIST).forEach(([c, n]) => { for (let i = 0; i < n; i++) deck.push(c); });
        for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
        const hands = {};
        for (let s = 0; s < 4; s++) hands[s] = deck.splice(0, 16).join('');
        ref.update({
            status: 'playing', round: Date.now(), deck: deck.join(''), hands, counts: [16, 16, 16, 16],
            turn: 0, phase: 'draw', pile: '', last: null, claims: null, claimed: null, melds: null, result: null, n: 0, claimEnd: 0
        });
    }

    // ---------- 房間監聽 ----------
    function onRoom(snap) {
        room = snap.val();
        if (!room) { toast('房間已關閉'); return cleanup(); }
        const me = room.players && room.players[key];
        if (!me) { toast('你已不在房間'); return cleanup(); }
        mySeat = me.seat;
        if (room.status === 'lobby') { root.classList.remove('in-game'); curRound = null; return render(); }
        root.classList.add('in-game');
        ref.child('players/' + key).onDisconnect().cancel();

        if (room.round !== curRound && room.status === 'playing') { // 新的一局：領取自己的 16 張
            curRound = room.round; tiles = {}; nextId = 1; loose = []; groups = []; sel = [];
            drewSelf = false; drawing = false; claimMode = false; pending = null; lastClaimN = 0; resolvedFor = '';
            ((room.hands && room.hands[mySeat]) || '').split('').forEach(addTile);
            ref.child('hands/' + mySeat).remove();
        }
        if (room.phase !== 'claim') { claimMode = false; }
        if (room.claimed && room.claimed.n !== lastClaimN) { // 搶牌結果
            lastClaimN = room.claimed.n;
            if (room.claimed.seat === mySeat && pending && pending.n === room.claimed.n) {
                loose = loose.filter(i => !pending.ids.includes(i)); sel = []; drewSelf = false; toast('✋ 搶牌成功！請打出一張牌');
            } else if (room.claimed.seat !== mySeat) toast(`${seatName(room.claimed.seat)} 搶牌：${room.claimed.word.toUpperCase()}`);
            pending = null;
        }
        if (room.status === 'playing') {
            if (room.phase === 'draw' && room.turn === mySeat) draw();
            if (room.phase === 'claim' && room.last && room.host === key) {
                const tag = room.round + '_' + room.last.n;
                if (resolvedFor !== tag) { resolvedFor = tag; const n = room.last.n; setTimeout(() => resolve(n), Math.max(0, room.claimEnd - Date.now()) + 400); }
            }
        }
        render();
    }

    // ---------- 動作（交易，確保多人同步）----------
    function addTile(ch) { const id = nextId++; tiles[id] = ch; loose.push(id); }
    function draw() {
        if (drawing) return; drawing = true; let ch = null;
        ref.transaction(r => {
            ch = null;
            if (!r || r.status !== 'playing' || r.phase !== 'draw' || r.turn !== mySeat) return;
            const d = r.deck || '';
            if (!d.length) { r.status = 'ended'; r.result = { draw: true }; return r; }
            ch = d[0]; r.deck = d.slice(1); r.counts[mySeat] = 17; r.phase = 'discard'; return r;
        }, (err, ok) => { drawing = false; if (ok && ch) { addTile(ch); drewSelf = true; render(); } });
    }
    function discard() {
        if (sel.length !== 1 || !room || room.phase !== 'discard' || room.turn !== mySeat) return;
        const id = sel[0]; if (!loose.includes(id)) return; const ch = tiles[id]; let done = false;
        ref.transaction(r => {
            done = false;
            if (!r || r.phase !== 'discard' || r.turn !== mySeat) return;
            r.n = (r.n || 0) + 1; r.last = { ch, by: mySeat, n: r.n }; r.pile = (r.pile || '') + mySeat + ch;
            r.phase = 'claim'; r.claimEnd = Date.now() + CLAIM_MS; r.claims = null; r.counts[mySeat] = 16; done = true; return r;
        }, () => { if (done) { loose = loose.filter(i => i !== id); sel = []; render(); } });
    }
    function resolve(n) { // 房主：結算搶牌（最長單字優先；同長則離打牌者最近者優先）
        ref.transaction(r => {
            if (!r || r.phase !== 'claim' || !r.last || r.last.n !== n) return;
            let best = null;
            Object.entries(r.claims || {}).forEach(([s, c]) => {
                s = +s; const d = (s - r.last.by + 4) % 4;
                if (!best || c.w.length > best.w.length || (c.w.length === best.w.length && d < best.d)) best = { s, w: c.w, d };
            });
            if (best) {
                r.turn = best.s; r.phase = 'discard'; r.pile = r.pile.slice(0, -2); r.counts[best.s] = 17;
                const old = Object.values((r.melds && r.melds[best.s]) || {}); old.push(best.w);
                r.melds = r.melds || {}; r.melds[best.s] = old; r.claimed = { seat: best.s, word: best.w, n };
            } else { r.turn = (r.last.by + 1) % 4; r.phase = 'draw'; }
            r.claims = null; return r;
        });
    }
    function submitClaim() {
        const ch = room.last.ch, ids = [...sel];
        if (ids.length < 2) return toast('請依序點選手牌，湊成含有該張牌的單字（至少再 2 張）');
        const letters = ids.map(i => tiles[i]); let found = '';
        for (let p = 0; p <= letters.length && !found; p++) { // 對方的牌可插在任何位置
            const w = [...letters.slice(0, p), ch, ...letters.slice(p)].join(''); if (isWord(w)) found = w;
        }
        if (!found) return toast(`「${letters.join('').toUpperCase()}」加上 ${ch.toUpperCase()} 拼不出合法單字`);
        pending = { n: room.last.n, ids, word: found };
        ref.child('claims/' + mySeat).set({ w: found }); claimMode = false;
        toast(`已喊搶牌：${found.toUpperCase()}，等待結算…`); render();
    }

    // ---------- 胡牌 / 計台 ----------
    const groupOk = g => isWord(wordOf(g));
    function canWin() {
        if (!room || room.phase !== 'discard' || room.turn !== mySeat || room.counts[mySeat] !== 17) return false;
        return !loose.length && groups.length > 0 && groups.every(groupOk);
    }
    function score(words, self) {
        let t = 0; const lines = [];
        words.forEach(w => {
            let s = Math.max(1, w.length - 2); const l = [`長度 ${w.length} +${s}`];
            const lv = lvMap[w]; if (lv) { s += LVB[lv]; l.push(`${LEVEL_LABEL[lv]}字 +${LVB[lv]}`); }
            let r = 0; for (const c of w) r += RARE[c] || 0; if (r) { s += r; l.push(`稀有字母 +${r}`); }
            t += s; lines.push(`${w.toUpperCase()}：${l.join('，')}（${s} 台）`);
        });
        if (self) { t += 2; lines.push('自摸 +2 台'); }
        return { tai: t, lines };
    }
    function win() {
        if (!canWin()) return toast('還有單字不合法或手牌沒有全部組成單字');
        const words = [...groups.map(wordOf), ...meldsOf(mySeat)], sc = score(words, drewSelf);
        ref.transaction(r => {
            if (!r || r.status !== 'playing' || r.turn !== mySeat || r.phase !== 'discard') return;
            r.status = 'ended'; r.result = { seat: mySeat, name: myName(), words, self: drewSelf, tai: sc.tai, lines: sc.lines }; return r;
        });
    }

    // ---------- 畫面 ----------
    function renderEntry() {
        body.innerHTML = `<div class="mj-lobby"><h2>🀄 英文麻將（測試版）</h2>
            <p class="mj-note">需 4 位玩家才能開始。請使用橫向螢幕。目前暱稱：<b>${esc(myName())}</b></p>
            <input id="mj-code" maxlength="4" inputmode="numeric" placeholder="加入房間：輸入 4 碼代碼">
            <div class="mj-row"><button class="btn btn-primary" data-a="create">建立房間</button><button class="btn btn-secondary" data-a="join">加入房間</button></div>
            <button class="btn btn-secondary" data-a="exit">返回主選單</button><div id="mj-dict" class="mj-note">${dict ? '' : '字典載入中…'}</div></div>`;
    }
    function render() {
        if (!room || !ref) return;
        if (drag && drag.on) return; // 拖曳中不重繪，放開後會自動重繪
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
                ${isH ? `<button class="btn btn-primary" data-a="start" ${allReady && dict ? '' : 'disabled'}>${ps.length < 4 ? `等待玩家加入 (${ps.length}/4)` : !allReady ? `等待玩家準備 (${readyN}/${others.length})` : dict ? '開始英文麻將！' : '字典載入中…'}</button>`
                    : `<button class="btn ${myReady ? 'btn-secondary' : 'btn-primary'}" data-a="ready">${myReady ? '⏳ 稍等一下 (取消準備)' : '✅ 準備就緒'}</button>`}
                <button class="btn btn-danger" data-a="leave">離開房間</button></div><div id="mj-dict" class="mj-note"></div></div>`;
            return;
        }
        const r = room, myTurn = r.turn === mySeat, last = r.last, playing = r.status === 'playing';
        const pl = s => Object.values(room.players || {}).find(x => x.seat === s) || {};
        const avatar = (s, size) => { const p = pl(s), av = safeAvatar(p.avatar), nm = p.name || '?';
            return `<div class="mj-av ${size} ${playing && r.turn === s ? 'turn' : ''}">${av ? `<img src="${esc(av)}" alt="">` : esc(nm.trim().charAt(0).toUpperCase() || '?')}</div>`; };
        const pairs = [], pile = r.pile || '';
        for (let i = 0; i + 1 < pile.length; i += 2) pairs.push({ s: +pile[i], c: pile[i + 1] });
        const lastIdx = r.phase === 'claim' && pairs.length ? pairs.length - 1 : -1;
        const zone = (s, cls) => `<div class="mj-dz ${cls}">${pairs.map((p, i) => p.s === s ? `<span class="mj-pc ${i === lastIdx ? 'last' : ''}">${p.c.toUpperCase()}</span>` : '').join('')}</div>`;
        const melds = s => `<div class="mj-melds">${meldsOf(s).map(w => `<i class="mj-meld">${esc(w.toUpperCase())}</i>`).join('')}</div>`;
        const backs = s => `<div class="mj-backs">${'<i></i>'.repeat(Math.max(0, (r.counts ? r.counts[s] : 0) - meldsOf(s).join('').length))}</div>`;
        const opp = (o, cls) => { const s = (mySeat + o) % 4; return `<div class="mj-opp ${cls}"><div class="mj-who">${avatar(s, 'l')}<div class="mj-nm">${esc(seatName(s))}</div></div>${melds(s)}${backs(s)}</div>`; };
        let st;
        if (!playing) st = '本局結束';
        else if (r.phase === 'claim') st = `${esc(seatName(last.by))} 打出 <b class="mj-big">${last.ch.toUpperCase()}</b><br>✋ 搶牌倒數 <b id="mj-cd">${Math.max(0, Math.ceil((r.claimEnd - Date.now()) / 1000))}</b>`;
        else st = myTurn ? (r.phase === 'draw' ? '摸牌中…' : '輪到你：打出一張牌<br>或組好單字胡牌') : `輪到 ${esc(seatName(r.turn))}`;
        const tileBtn = (id, a, extra = '') => { const k = sel.indexOf(id), v = 'aeiou'.includes(tiles[id]) ? 'v' : ''; return `<button class="mj-t ${v} ${k >= 0 ? 'sel' : ''}" data-a="${a}" data-id="${id}" ${extra}>${tiles[id].toUpperCase()}${k >= 0 && sel.length > 1 ? `<span class="no">${k + 1}</span>` : ''}</button>`; };
        const gHtml = groups.map((g, gi) => { const w = wordOf(g), ok = groupOk(g);
            return `<div class="mj-g ${ok ? 'ok' : 'bad'}"><span class="mj-gw">${w.toUpperCase()} ${ok ? '✓' : '✗'}</span>
                <button class="mj-att" data-a="attl" data-g="${gi}" title="把選取的牌接在前面">＋</button>
                ${g.map(id => tileBtn(id, 'gtile', `data-g="${gi}"`)).join('')}
                <button class="mj-att" data-a="attr" data-g="${gi}" title="把選取的牌接在後面">＋</button>
                <button class="mj-un" data-a="ungroup" data-g="${gi}" title="拆開">✕</button></div>`; }).join('');
        const mm = meldsOf(mySeat).map(w => `<div class="mj-g lock ok"><span class="mj-gw">🔒 ${esc(w.toUpperCase())}</span>${w.split('').map(c => `<button class="mj-t ${'aeiou'.includes(c) ? 'v' : ''}" disabled>${c.toUpperCase()}</button>`).join('')}</div>`).join('');
        const canClaim = playing && r.phase === 'claim' && last && last.by !== mySeat && !pending;
        const acts = [
            `<button class="btn btn-secondary" data-a="form" ${sel.length < 2 || claimMode ? 'disabled' : ''}>🔗 組成單字</button>`,
            `<button class="btn btn-secondary" data-a="sort">🔤 整理</button>`,
            `<button class="btn btn-primary" data-a="discard" ${myTurn && r.phase === 'discard' && sel.length === 1 && loose.includes(sel[0]) ? '' : 'disabled'}>🗑 打出</button>`,
            canClaim ? (claimMode ? `<button class="btn btn-sky" data-a="claimgo">✅ 確認搶牌（${last.ch.toUpperCase()} + 已選）</button><button class="btn btn-secondary" data-a="claimcancel">取消</button>` : `<button class="btn btn-sky" data-a="claim">✋ 搶牌</button>`) : '',
            myTurn && r.phase === 'discard' ? `<button class="btn btn-danger" data-a="win" ${canWin() ? '' : 'disabled'}>🀄 胡牌！</button>` : '',
        ].join('');
        let overlay = '';
        if (!playing) {
            const res = r.result || {};
            overlay = `<div class="mj-result"><div>${res.aborted ? `<h2>⚠️ ${esc(res.name)} 離開了遊戲</h2>` : res.draw ? '<h2>🤝 牌庫已空，流局</h2>' :
                `<h2>🏆 ${esc(res.name)} ${res.self ? '自摸' : '胡牌'}！共 ${res.tai} 台</h2>${(res.lines || []).map(l => `<div>${esc(l)}</div>`).join('')}`}
                ${room.host === key ? '<button class="btn btn-primary" data-a="again">回到房間，再來一局</button>' : '<div class="mj-note">等待房主開始下一局…</div>'}
                <button class="btn btn-secondary" data-a="leave">離開房間</button></div></div>`;
        }
        body.innerHTML = `<div class="mj-game">
            <button class="btn btn-secondary mj-exit" data-a="leave">離開</button><div class="mj-deck">牌庫 ${(r.deck || '').length}</div>
            <div class="mj-c-top">${opp(2, 'top')}</div><div class="mj-c-left">${opp(3, 'side')}</div><div class="mj-c-right">${opp(1, 'side')}</div>
            <div class="mj-table">${zone((mySeat + 2) % 4, 'z-top')}${zone((mySeat + 3) % 4, 'z-left')}<div class="mj-center">${st}</div>${zone((mySeat + 1) % 4, 'z-right')}${zone(mySeat, 'z-bot')}</div>
            <div class="mj-me ${myTurn && playing ? 'turn' : ''}"><div class="mj-mebar">${avatar(mySeat, 'm')}<b>${esc(myName())}</b></div>
            <div class="mj-hand"><div class="mj-rack">${mm}${gHtml}</div>
            <div class="mj-rack mj-loose">${loose.map(id => tileBtn(id, 'tile')).join('') || '<span class="mj-note">（沒有未組合的牌）</span>'}</div></div>
            <div class="mj-acts">${acts}</div></div></div>${overlay}`;
    }

    // ---------- 互動 ----------
    const act = (a, d) => {
        if (a === 'create') return create(); if (a === 'join') return join(); if (a === 'exit') return close();
        if (a === 'start') return startGame(); if (a === 'leave') return leave();
        if (a === 'ready') { const p = room.players[key]; return ref.child('players/' + key + '/ready').set(!(p && p.ready)); }
        if (a === 'again') { const u = { status: 'lobby', result: null }; Object.keys(room.players).forEach(k => { if (k !== room.host) u['players/' + k + '/ready'] = false; }); return ref.update(u); }
        if (!room || room.status !== 'playing') return;
        const id = +d.id, gi = +d.g;
        if (a === 'tile') sel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id];
        else if (a === 'gtile') { // 單字最前／最後一張可抽出，其餘不動
            const g = groups[gi]; if (!g) return;
            if (g[0] === id || g[g.length - 1] === id) { g.splice(g.indexOf(id), 1); loose.push(id); if (g.length < 2) { loose.push(...g); groups.splice(gi, 1); } }
        }
        else if (a === 'ungroup') { loose.push(...groups[gi]); groups.splice(gi, 1); }
        else if (a === 'form') { if (sel.length >= 2) { groups.push([...sel]); loose = loose.filter(i => !sel.includes(i)); sel = []; } }
        else if (a === 'attl' || a === 'attr') {
            if (!sel.length) return toast('先點選要接上去的手牌');
            const g = groups[gi]; groups[gi] = a === 'attl' ? [...sel, ...g] : [...g, ...sel];
            loose = loose.filter(i => !sel.includes(i)); sel = [];
        }
        else if (a === 'sort') loose.sort((x, y) => tiles[x].localeCompare(tiles[y]));
        else if (a === 'discard') return discard();
        else if (a === 'claim') { claimMode = true; sel = []; toast('依序點選手牌，湊出含有該張牌的單字，再按「確認搶牌」'); }
        else if (a === 'claimcancel') { claimMode = false; sel = []; }
        else if (a === 'claimgo') return submitClaim();
        else if (a === 'win') return win();
        render();
    };
    body.addEventListener('click', e => { if (Date.now() < suppressUntil) return; const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; playClickSound(); act(b.dataset.a, b.dataset); });

    // ---------- 拖曳整理手牌（可在散牌／單字之間拖；散牌排成合法單字時自動吸成一組）----------
    let drag = null, suppressUntil = 0;
    const isTileEl = el => el && (el.dataset.a === 'tile' || el.dataset.a === 'gtile');
    function snap(id) { // 以被拖的牌為中心，找相鄰散牌中最長的合法單字（≥3 字母）
        const pos = loose.indexOf(id); if (pos < 0) return;
        let best = null;
        for (let i = Math.max(0, pos - 13); i <= pos; i++) for (let j = pos; j < Math.min(loose.length, i + 14); j++) {
            const len = j - i + 1; if (len < 3) continue;
            const w = loose.slice(i, j + 1).map(x => tiles[x]).join('');
            if (isWord(w) && (!best || len > best.len)) best = { i, len, w };
        }
        if (best) { groups.push(loose.splice(best.i, best.len)); sel = []; toast('🔗 自動組成單字：' + best.w.toUpperCase()); }
    }
    function moveTile(id, tgt, side) {
        const gi = groups.findIndex(g => g.includes(id));
        if (gi >= 0) { groups[gi] = groups[gi].filter(x => x !== id); if (groups[gi].length < 2) { loose.push(...groups[gi]); groups.splice(gi, 1); } }
        else loose = loose.filter(x => x !== id);
        sel = sel.filter(x => x !== id);
        const off = side === 'r' ? 1 : 0;
        if (tgt.end) { loose.push(id); return snap(id); }
        const tg = groups.findIndex(g => g.includes(tgt.id));
        if (tg >= 0) { const g = groups[tg]; g.splice(g.indexOf(tgt.id) + off, 0, id); return; }
        const k = loose.indexOf(tgt.id);
        if (k < 0) loose.push(id); else loose.splice(k + off, 0, id);
        snap(id);
    }
    const clearMark = () => root.querySelectorAll('.drop-l,.drop-r,.drop-end').forEach(el => el.classList.remove('drop-l', 'drop-r', 'drop-end'));
    body.addEventListener('pointerdown', e => {
        const t = e.target.closest('.mj-t[data-id]');
        if (!t || t.disabled || !isTileEl(t) || !room || room.status !== 'playing') return;
        drag = { id: +t.dataset.id, el: t, sx: e.clientX, sy: e.clientY, on: false, ghost: null, tgt: null, side: 'l' };
    });
    window.addEventListener('pointermove', e => {
        if (!drag) return;
        if (!drag.on) {
            if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return;
            drag.on = true; drag.ghost = drag.el.cloneNode(true); drag.ghost.className = 'mj-t mj-ghost ' + (drag.el.classList.contains('v') ? 'v' : '');
            root.appendChild(drag.ghost); drag.el.classList.add('dragsrc');
        }
        drag.ghost.style.left = (e.clientX - 17) + 'px'; drag.ghost.style.top = (e.clientY - 34) + 'px';
        clearMark(); drag.tgt = null;
        const under = document.elementFromPoint(e.clientX, e.clientY), tt = under && under.closest('.mj-t[data-id]');
        if (tt && tt !== drag.el && isTileEl(tt)) {
            const rc = tt.getBoundingClientRect(); drag.side = e.clientX < rc.left + rc.width / 2 ? 'l' : 'r';
            drag.tgt = { id: +tt.dataset.id }; tt.classList.add('drop-' + drag.side);
        } else if (under && under.closest('.mj-loose')) { drag.tgt = { end: true }; under.closest('.mj-loose').classList.add('drop-end'); }
    });
    const endDrag = cancel => () => {
        if (!drag) return; const d = drag; drag = null;
        if (!d.on) return;
        d.ghost.remove(); clearMark(); suppressUntil = Date.now() + 250;
        if (!cancel && d.tgt) moveTile(d.id, d.tgt, d.side);
        render();
    };
    window.addEventListener('pointerup', endDrag(false)); window.addEventListener('pointercancel', endDrag(true));

    const btn = $('btn-goto-mj'); if (btn) btn.addEventListener('click', () => { playClickSound(); open(); });
    return { open };
})();
