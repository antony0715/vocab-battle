// ==================== 好友系統 (friends.js) ====================
// 依賴 app.js 的全域：$, esc, showScreen, showMenu, playClickSound, playerName, playerNameInput,
//   currentRoomRef, lastRoomStatus, singlePlaying, isHost(let), initMultiplayerRoom, joinRoomByCode, leaveRoomNow
// 依賴 profile.js 的 Profile.getName / Profile.refreshChip
//
// Firebase Realtime Database 結構：
//   users/{CODE}            = { name, online, lastSeen, created }   玩家資料與上線狀態
//   friends/{CODE}/{CODE2}  = 加好友的時間戳                          雙向各寫一筆
//   invites/{CODE}/{FROM}   = { name, room, ts }                     房間邀請（被邀請者收到後刪除）
const Friends = (() => {
    const CODE_KEY = 'vocab_player_code_v1';
    const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 去掉易混淆的 I / L / O / 0 / 1
    const CODE_LEN = 6;
    const HEARTBEAT_MS = 60 * 1000;       // 在線時每分鐘更新一次 lastSeen
    const ONLINE_WINDOW_MS = 150 * 1000;  // lastSeen 超過這個時間視為離線（防止瀏覽器異常關閉沒回報）
    const INVITE_TTL_MS = 2 * 60 * 1000;  // 邀請 2 分鐘內有效

    const db = firebase.database();
    let myCode = '';
    try { myCode = localStorage.getItem(CODE_KEY) || ''; } catch (e) { }
    let meRef = null;
    let serverOffset = 0;
    let friends = {};          // { code: addedAt }
    let info = {};             // { code: {name, online, lastSeen} | null }
    const infoRefs = {};       // code -> ref（用來取消監聽）
    let friendsLoaded = false;
    let booted = false;
    let heartbeat = null;

    const myName = () => (typeof Profile !== 'undefined' && Profile.getName()) || playerName || '訪客';
    const serverNow = () => Date.now() + serverOffset;
    const TS = () => firebase.database.ServerValue.TIMESTAMP;
    const normalize = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    function genCode() {
        const buf = new Uint32Array(CODE_LEN);
        (window.crypto || window.msCrypto).getRandomValues(buf);
        return Array.from(buf, n => ALPHABET[n % ALPHABET.length]).join('');
    }

    // ---------- 小提示 ----------
    function notify(msg, icon = 'ℹ️') {
        const root = $('toast-root'); if (!root) return alert(msg);
        const el = document.createElement('div');
        el.className = 'toast';
        el.innerHTML = `<span style="font-size:22px">${icon}</span><div>${esc(msg)}</div>`;
        root.appendChild(el);
        setTimeout(() => el.remove(), 3600);
    }

    // ---------- 玩家代碼 ----------
    async function claimNewCode() {
        for (let i = 0; i < 8; i++) {
            const c = genCode();
            const res = await db.ref('users/' + c).transaction(cur => {
                if (cur) return; // 已被使用 → 放棄，換一組
                return { name: myName(), online: true, lastSeen: TS(), created: TS() };
            });
            if (res.committed) return c;
        }
        return '';
    }

    async function boot() {
        if (booted) return;
        booted = true;
        try {
            if (!myCode) {
                const c = await claimNewCode();
                if (!c) throw new Error('no code');
                myCode = c;
                try { localStorage.setItem(CODE_KEY, myCode); } catch (e) { }
            }
            meRef = db.ref('users/' + myCode);
            startFriendsListener();
            renderCode();
        } catch (e) {
            console.warn('好友系統初始化失敗', e);
            booted = false; // 下次連線時再試
            renderCode();
        }
    }

    // ---------- 上線狀態 ----------
    function goOnline() {
        if (!meRef) return;
        meRef.child('online').onDisconnect().set(false);
        meRef.child('lastSeen').onDisconnect().set(TS());
        meRef.update({ name: myName(), online: document.visibilityState !== 'hidden', lastSeen: TS() });
        syncName();
        clearInterval(heartbeat);
        heartbeat = setInterval(() => {
            if (meRef && document.visibilityState !== 'hidden') meRef.update({ online: true, lastSeen: TS() });
        }, HEARTBEAT_MS);
    }

    db.ref('.info/serverTimeOffset').on('value', s => { serverOffset = s.val() || 0; });
    db.ref('.info/connected').on('value', async s => {
        if (!s.val()) return;
        await boot();
        goOnline();
    });
    document.addEventListener('visibilitychange', () => {
        if (!meRef) return;
        if (document.visibilityState === 'hidden') meRef.update({ online: false, lastSeen: TS() });
        else meRef.update({ online: true, lastSeen: TS() });
    });

    async function syncName() {
        if (!meRef) return;
        let av = '';
        try { if (typeof Profile !== 'undefined') av = await Profile.getThumb(); } catch (e) { }
        meRef.update({ name: myName(), avatar: av || null });
    }
    const safeAvatar = a => (typeof a === 'string' && a.startsWith('data:image/jpeg;base64,') && a.length < 20000) ? a : '';

    // ---------- 好友資料監聽 ----------
    function startFriendsListener() {
        db.ref('friends/' + myCode).on('value', snap => {
            friends = snap.val() || {};
            Object.keys(friends).forEach(c => {
                if (infoRefs[c]) return;
                infoRefs[c] = db.ref('users/' + c);
                infoRefs[c].on('value', s => { info[c] = s.val(); renderAll(); });
            });
            Object.keys(infoRefs).forEach(c => {
                if (friends[c]) return;
                infoRefs[c].off(); delete infoRefs[c]; delete info[c];
            });
            renderAll();
            if (!friendsLoaded) { friendsLoaded = true; startInviteListener(); }
        });
    }

    const isOnline = d => !!(d && d.online === true && (serverNow() - (d.lastSeen || 0)) < ONLINE_WINDOW_MS);

    function statusText(d) {
        if (d === undefined) return { cls: 'off', text: '載入中…' };
        if (!d) return { cls: 'off', text: '⚪ 找不到這位玩家' };
        if (isOnline(d)) return { cls: 'on', text: '🟢 線上' };
        const t = d.lastSeen;
        if (!t) return { cls: 'off', text: '⚪ 尚無上線紀錄' };
        const diff = Math.max(0, serverNow() - t), min = Math.floor(diff / 60000);
        let ago;
        if (min < 1) ago = '剛剛';
        else if (min < 60) ago = `${min} 分鐘前`;
        else if (min < 1440) ago = `${Math.floor(min / 60)} 小時前`;
        else if (min < 10080) ago = `${Math.floor(min / 1440)} 天前`;
        else { const dt = new Date(t); ago = `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`; }
        return { cls: 'off', text: `⚪ 最後上線：${ago}` };
    }

    // ---------- 畫面 ----------
    function sortedFriendCodes() {
        return Object.keys(friends).sort((a, b) => {
            const oa = isOnline(info[a]) ? 1 : 0, ob = isOnline(info[b]) ? 1 : 0;
            if (oa !== ob) return ob - oa;
            return ((info[b] && info[b].lastSeen) || 0) - ((info[a] && info[a].lastSeen) || 0);
        });
    }

    function friendRowsHtml(withDelete) {
        const codes = sortedFriendCodes();
        if (!codes.length) return '<div class="bank-empty">還沒有好友<br>把你的玩家代碼分享給朋友，或輸入朋友的代碼來新增！</div>';
        return codes.map(c => {
            const d = info[c], st = statusText(d), name = (d && d.name) || c;
            const on = isOnline(d);
            return `<div class="friend-row">
                <div class="avatar fr-av ${on ? 'on' : ''}">${safeAvatar(d && d.avatar) ? `<img src="${esc(safeAvatar(d.avatar))}" alt="">` : esc(name.trim().charAt(0).toUpperCase() || '?')}</div>
                <div class="fr-info">
                    <div class="fr-name">${esc(name)}<span class="fr-code">${esc(c)}</span></div>
                    <div class="fr-status ${st.cls}">${esc(st.text)}</div>
                </div>
                <button class="fr-invite" data-code="${esc(c)}" ${on ? '' : 'disabled'} title="${on ? '邀請到多人房間' : '對方不在線'}">🎮 邀請</button>
                ${withDelete ? `<button class="fr-del" data-code="${esc(c)}" title="刪除好友">✕</button>` : ''}
            </div>`;
        }).join('');
    }

    function renderCode() {
        const el = $('my-code-btn'); if (!el) return;
        el.textContent = myCode || '連線中…';
        el.disabled = !myCode;
    }

    function renderBadge() {
        const n = Object.keys(friends).filter(c => isOnline(info[c])).length;
        const b = $('friends-badge'); if (!b) return;
        b.textContent = `${n} 在線`;
        b.classList.toggle('hidden', n === 0);
    }

    function renderAll() {
        renderBadge();
        if ($('friends-screen') && !$('friends-screen').classList.contains('hidden')) {
            $('friend-list').innerHTML = friendRowsHtml(true);
            $('friend-count').textContent = `(${Object.keys(friends).length})`;
        }
        const im = $('invite-modal');
        if (im && !im.classList.contains('hidden')) $('invite-list').innerHTML = friendRowsHtml(false);
    }
    setInterval(renderAll, 30000); // 讓「N 分鐘前」自動更新

    // ---------- 複製代碼 ----------
    async function copyCode() {
        if (!myCode) return;
        let ok = false;
        try { await navigator.clipboard.writeText(myCode); ok = true; }
        catch (e) {
            try {
                const ta = document.createElement('textarea');
                ta.value = myCode; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select();
                ok = document.execCommand('copy'); ta.remove();
            } catch (e2) { }
        }
        const hint = $('code-hint'), old = '把代碼傳給朋友，他輸入後就能加你為好友';
        hint.textContent = ok ? '✅ 已複製玩家代碼！' : `請手動複製：${myCode}`;
        hint.classList.toggle('copied', ok);
        setTimeout(() => { hint.textContent = old; hint.classList.remove('copied'); }, 1800);
    }

    // ---------- 新增 / 刪除好友 ----------
    function setAddStatus(msg, cls) { const el = $('friend-add-status'); el.textContent = msg; el.className = 'fb-status ' + (cls || ''); }

    async function addFriend() {
        const code = normalize($('friend-code-input').value);
        if (!myCode) return setAddStatus('還在連線中，請稍後再試', 'err');
        if (!code) return setAddStatus('請輸入對方的玩家代碼', 'err');
        if (code === myCode) return setAddStatus('這是你自己的代碼喔！', 'err');
        if (friends[code]) return setAddStatus('你們已經是好友了', 'err');
        const btn = $('btn-friend-add');
        btn.disabled = true; setAddStatus('搜尋中…');
        try {
            const snap = await db.ref('users/' + code).once('value');
            if (!snap.exists()) return setAddStatus('找不到這個玩家代碼，請確認是否輸入正確', 'err');
            const ts = TS(), up = {};
            up[`friends/${myCode}/${code}`] = ts;
            up[`friends/${code}/${myCode}`] = ts;
            await db.ref().update(up);
            setAddStatus(`✅ 已加入好友：${snap.val().name || code}`, 'ok');
            $('friend-code-input').value = '';
        } catch (e) {
            console.warn(e);
            setAddStatus('新增失敗，請檢查網路連線', 'err');
        } finally { btn.disabled = false; }
    }

    async function removeFriend(code) {
        const name = (info[code] && info[code].name) || code;
        if (!confirm(`確定要刪除好友「${name}」嗎？對方的好友列表也會移除你。`)) return;
        const up = {};
        up[`friends/${myCode}/${code}`] = null;
        up[`friends/${code}/${myCode}`] = null;
        try { await db.ref().update(up); } catch (e) { notify('刪除失敗，請稍後再試', '⚠️'); }
    }

    // ---------- 邀請好友到房間 ----------
    function sendInvite(code, room) {
        return db.ref(`invites/${code}/${myCode}`).set({ name: myName(), room: String(room), ts: TS() })
            .then(() => notify(`已邀請 ${(info[code] && info[code].name) || code}（房間 #${room}）`, '📨'))
            .catch(() => notify('邀請送出失敗，請稍後再試', '⚠️'));
    }

    function inviteFriend(code) {
        if (!isOnline(info[code])) return notify('對方目前不在線，無法邀請', '⚪');
        if (singlePlaying) return notify('請先結束目前的單人遊戲', '⚠️');
        if (currentRoomRef) {
            if (lastRoomStatus === 'playing') return notify('這局進行中，等結束後再邀請吧', '⏳');
            return sendInvite(code, currentRoomRef.key);
        }
        // 還沒有房間 → 自動建立房間（你是房主），建立完成後送出邀請
        if (playerNameInput.value.trim()) playerName = playerNameInput.value.trim();
        isHost = true;
        const room = Math.floor(1000 + Math.random() * 9000).toString();
        initMultiplayerRoom(room, true, rc => sendInvite(code, rc));
    }

    // ---------- 收到邀請 ----------
    function startInviteListener() {
        const ref = db.ref('invites/' + myCode);
        const handle = snap => {
            const from = snap.key, v = snap.val();
            if (!v || !v.room) return;
            if (!friends[from]) { snap.ref.remove(); return; }              // 非好友的邀請一律忽略
            if (serverNow() - (v.ts || 0) > INVITE_TTL_MS) { snap.ref.remove(); return; } // 過期
            showInvite(from, v);
        };
        ref.on('child_added', handle);
        ref.on('child_changed', handle);
    }

    function showInvite(from, v) {
        const root = $('invite-root'); if (!root) return;
        const old = root.querySelector(`[data-from="${from}"]`); if (old) old.remove();
        const el = document.createElement('div');
        el.className = 'invite-card'; el.dataset.from = from;
        el.innerHTML = `<div class="iv-text">📨 <b>${esc(v.name || from)}</b> 邀請你加入房間 <b>#${esc(v.room)}</b></div>
            <div class="iv-btns"><button class="btn btn-primary btn-sm iv-join">加入</button><button class="btn btn-secondary btn-sm iv-skip">忽略</button></div>`;
        const close = () => { el.remove(); db.ref(`invites/${myCode}/${from}`).remove(); };
        el.querySelector('.iv-skip').onclick = () => { playClickSound(); close(); };
        el.querySelector('.iv-join').onclick = () => { playClickSound(); close(); acceptInvite(v.room); };
        root.appendChild(el);
        setTimeout(() => { if (el.isConnected) close(); }, 60000);
        try { playClickSound(); } catch (e) { }
    }

    function acceptInvite(room) {
        if (singlePlaying) return notify('請先結束目前的單人遊戲再加入房間', '⚠️');
        if (currentRoomRef) {
            if (currentRoomRef.key === String(room)) return notify('你已經在這個房間了', '✅');
            if (!confirm('要離開目前的房間並加入好友的房間嗎？')) return;
            leaveRoomNow();
        }
        joinRoomByCode(room);
    }

    // ---------- 事件綁定 ----------
    function bind() {
        const click = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { if (typeof playClickSound === 'function') playClickSound(); fn(); }); };
        const openScreen = () => { showScreen('friends'); renderCode(); renderAll(); setAddStatus(''); if (!meRef) boot().then(() => { goOnline(); renderCode(); }); };
        const closeScreen = () => { showScreen('lobby'); showMenu('main'); if (typeof Profile !== 'undefined') Profile.refreshChip(); };
        click('btn-goto-friends', openScreen);
        click('btn-friends-back', closeScreen);
        click('btn-friends-close-top', closeScreen);
        click('my-code-btn', copyCode);
        click('btn-friend-add', addFriend);
        $('friend-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') addFriend(); });
        $('friend-code-input').addEventListener('input', e => { e.target.value = normalize(e.target.value); });

        const onList = e => {
            const inv = e.target.closest('.fr-invite'), del = e.target.closest('.fr-del');
            if (inv && !inv.disabled) { playClickSound(); inviteFriend(inv.dataset.code); }
            else if (del) { playClickSound(); removeFriend(del.dataset.code); }
        };
        $('friend-list').addEventListener('click', onList);
        $('invite-list').addEventListener('click', onList);

        click('btn-invite-friends', () => { $('invite-modal').classList.remove('hidden'); renderAll(); });
        click('btn-invite-close', () => $('invite-modal').classList.add('hidden'));
        $('invite-modal').addEventListener('click', e => { if (e.target.id === 'invite-modal') e.target.classList.add('hidden'); });
        renderCode();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();

    return { syncName, getCode: () => myCode };
})();
