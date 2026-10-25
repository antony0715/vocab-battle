// ==================== 個人檔案 / 成就 / 報錯與建議 (profile.js) ====================
// 依賴 app.js 的全域：$, esc, showScreen, showMenu, setPlayerName, playerNameInput, getVocabByLevels, playClickSound
const Profile = (() => {
    const KEY = 'vocab_profile_v1';
    const FEEDBACK_EMAIL = 'olololffee@gmail.com';
    const LV = { level1: '1級', level2: '2級', level3: '3級', level4: '4級', level5: '5級', level6: '6級' };
    const LEVELS = ['level1', 'level2', 'level3', 'level4', 'level5', 'level6'];
    const MODE = { ranked: '排位賽', practice: '練習', multi: '多人' };

    const fresh = () => ({
        name: '請輸入暱稱', avatar: '', createdAt: Date.now(),
        stats: {
            games: 0, ranked: 0, practice: 0, multi: 0, multiWins: 0,
            questions: 0, correct: 0, wrong: 0, maxCombo: 0, playSeconds: 0,
            bestSurvive: 0, bestScore: 0, flawless: 0, bankAdded: 0, bankRemoved: 0, feedbackSent: 0,
            mj: { games: 0, wins: 0, zimo: 0, ron: 0, pong: 0, ting: 0, special: 0, bestTai: 0, longest: 0, soloWins: 0, multiWins: 0 },
            byLevel: Object.fromEntries(['level1', 'level2', 'level3', 'level4', 'level5', 'level6'].map(l => [l, { c: 0, w: 0 }]))
        },
        seen: {},      // 已複習過的不同單字 { word: '1'~'6' }
        days: [],      // 有遊玩的日期 YYYY-MM-DD
        history: [],   // 每局紀錄
        achievements: {} // { id: 解鎖時間 }
    });

    function load() {
        const f = fresh();
        try {
            const d = JSON.parse(localStorage.getItem(KEY));
            if (d && d.stats) {
                const out = { ...f, ...d, stats: { ...f.stats, ...d.stats, byLevel: { ...f.stats.byLevel, ...(d.stats.byLevel || {}) } } };
                return out;
            }
        } catch (e) { }
        // 首次：沿用舊版已存的最高紀錄與暱稱
        f.stats.bestSurvive = Number(localStorage.getItem('vocab_best_survival')) || 0;
        f.stats.bestScore = Number(localStorage.getItem('vocab_best_score')) || 0;
        return f;
    }
    let data = load();

    let saveTimer = null;
    function flush() {
        clearTimeout(saveTimer); saveTimer = null;
        try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.warn('個人檔案儲存失敗', e); }
    }
    const scheduleSave = () => { if (!saveTimer) saveTimer = setTimeout(flush, 500); };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

    // ---------- 日期 / 連續天數 ----------
    const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    function markDay() {
        const t = ymd(new Date());
        if (data.days[data.days.length - 1] !== t) { data.days.push(t); data.days = data.days.slice(-120); }
    }
    function streak() {
        const set = new Set(data.days);
        const d = new Date();
        if (!set.has(ymd(d))) d.setDate(d.getDate() - 1);
        let n = 0;
        while (set.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
        return n;
    }

    // ---------- 成就定義 ----------
    const seenCount = () => Object.keys(data.seen).length;
    const S = () => data.stats;
    const MJ = () => { const s = data.stats; s.mj = { games: 0, wins: 0, zimo: 0, ron: 0, pong: 0, ting: 0, special: 0, bestTai: 0, longest: 0, soloWins: 0, multiWins: 0, ...(s.mj || {}) }; return s.mj; };
    const ACH = [
        { id: 'first_game', icon: '🎮', name: '初次登場', desc: '完成第 1 局遊戲', test: () => S().games >= 1 },
        { id: 'games10', icon: '✋', name: '易如反掌', desc: '累計完成 10 局', test: () => S().games >= 10 },
        { id: 'games50', icon: '🎖️', name: '資深玩家', desc: '累計完成 50 局', test: () => S().games >= 50 },
        { id: 'q100', icon: '✏️', name: '百題斬', desc: '累計答 100 題', test: () => S().questions >= 100 },
        { id: 'q500', icon: '📘', name: '五百題達人', desc: '累計答 500 題', test: () => S().questions >= 500 },
        { id: 'q2000', icon: '📚', name: '千題不倒', desc: '累計答 2000 題', test: () => S().questions >= 2000 },
        { id: 'words100', icon: '🔤', name: '單字收藏家', desc: '複習過 100 個不同單字', test: () => seenCount() >= 100 },
        { id: 'words500', icon: '🗂️', name: '單字博物館', desc: '複習過 500 個不同單字', test: () => seenCount() >= 500 },
        { id: 'words1500', icon: '🧠', name: '活字典', desc: '複習過 1500 個不同單字', test: () => seenCount() >= 1500 },
        { id: 'combo10', icon: '🔥', name: '連擊新手', desc: '單局連擊達 10', test: () => S().maxCombo >= 10 },
        { id: 'combo30', icon: '⚡', name: '連擊高手', desc: '單局連擊達 30', test: () => S().maxCombo >= 30 },
        { id: 'combo60', icon: '🌋', name: '連擊之王', desc: '單局連擊達 60', test: () => S().maxCombo >= 60 },
        { id: 'survive60', icon: '6️⃣7️⃣', name: '陸柒', desc: '排位賽生存 67 秒', test: () => S().bestSurvive >= 67 },
        { id: 'survive180', icon: '🛡️', name: '三分鐘硬漢', desc: '排位賽生存 180 秒', test: () => S().bestSurvive >= 180 },
        { id: 'survive300', icon: '🏔️', name: '五分鐘傳說', desc: '排位賽生存 300 秒', test: () => S().bestSurvive >= 300 },
        { id: 'score100', icon: '💯', name: '百分選手', desc: '排位賽單局 100 分', test: () => S().bestScore >= 100 },
        { id: 'score300', icon: '🌟', name: '三百分大師', desc: '排位賽單局 300 分', test: () => S().bestScore >= 300 },
        { id: 'flawless', icon: '💎', name: '不可能的任務', desc: '一局答 20 題以上且全對', test: () => S().flawless >= 1 },
        { id: 'lv6_50', icon: '🧗', name: '六級挑戰者', desc: '答對 50 題 6 級單字', test: () => S().byLevel.level6.c >= 50 },
        { id: 'multi_play', icon: '👥', name: '初登擂台', desc: '完成 1 場多人對戰', test: () => S().multi >= 1 },
        { id: 'multi_win', icon: '🏆', name: '最後生還者', desc: '贏得 1 場多人對戰', test: () => S().multiWins >= 1 },
        { id: 'multi_win5', icon: '👑', name: '擂台霸主', desc: '贏得 5 場多人對戰', test: () => S().multiWins >= 5 },
        { id: 'bank10', icon: '📝', name: '知錯能改', desc: '累計加入 30 個單字到錯題庫', test: () => S().bankAdded >= 30 },
        { id: 'bank_clear10', icon: '✅', name: '我全都會', desc: '累計從錯題庫移除 30 個單字', test: () => S().bankRemoved >= 30 },
        { id: 'streak3', icon: '📅', name: '三日不輟', desc: '連續 3 天有練習', test: () => streak() >= 3 },
        { id: 'streak7', icon: '🗓️', name: '七步成詩', desc: '連續 7 天有練習', test: () => streak() >= 7 },
        { id: 'streak14', icon: '🗓️', name: '十四吃柿子', desc: '連續 14 天有練習', test: () => streak() >= 14 },
        { id: 'avatar', icon: '🖼️', name: '有頭有臉', desc: '設定個人頭像', test: () => !!data.avatar },
        { id: 'mj_first', icon: '🀄', name: '初試牌桌', desc: '完成 1 場英文麻將', test: () => MJ().games >= 1 },
        { id: 'mj_games10', icon: '🎲', name: '牌桌常客', desc: '累計完成 10 場英文麻將', test: () => MJ().games >= 10 },
        { id: 'mj_win1', icon: '🏁', name: '胡啦!!!', desc: '在英文麻將胡牌 1 次', test: () => MJ().wins >= 1 },
        { id: 'mj_win5', icon: '🏆', name: '手氣不斷', desc: '在英文麻將胡牌 5 次', test: () => MJ().wins >= 5 },
        { id: 'mj_win20', icon: '👑', name: '字母牌神', desc: '在英文麻將胡牌 20 次', test: () => MJ().wins >= 20 },
        { id: 'mj_zimo', icon: '🤲', name: 'touch myself', desc: '在英文麻將自摸 1 次', test: () => MJ().zimo >= 1 },
        { id: 'mj_ron', icon: '🎯', name: '一擊必中', desc: '胡別人打出的牌 1 次', test: () => MJ().ron >= 1 },
        { id: 'mj_pong10', icon: '💥', name: '碰碰車', desc: '累計碰牌成功 10 次', test: () => MJ().pong >= 10 },
        { id: 'mj_ting10', icon: '👂', name: '你說什麼', desc: '累計宣告聽牌 10 次', test: () => MJ().ting >= 10 },
        { id: 'mj_tai10', icon: '💰', name: '大台來了', desc: '英文麻將單局贏 10 台以上', test: () => MJ().bestTai >= 10 },
        { id: 'mj_tai20', icon: '💎', name: '豪華大牌', desc: '英文麻將單局贏 20 台以上', test: () => MJ().bestTai >= 20 },
        { id: 'mj_long7', icon: '📏', name: '火山矽肺病', desc: '胡牌時組出 7 個字母以上的單字', test: () => MJ().longest >= 7 },
        { id: 'mj_special', icon: '🌠', name: '特殊胡法', desc: '以「出牌後（或碰牌後）手牌全成單字」胡牌', test: () => MJ().special >= 1 },
        { id: 'mj_solo_win', icon: '🤖', name: 'AI就這?', desc: '單人練習中胡牌 1 次', test: () => MJ().soloWins >= 1 },
        { id: 'mj_multi_win', icon: '🧑‍🤝‍🧑', name: '麻將擂台', desc: '多人麻將胡牌 1 次', test: () => MJ().multiWins >= 1 },
        { id: 'feedback', icon: '💬', name: '熱心玩家', desc: '送出一則報錯或建議', test: () => S().feedbackSent >= 1 }
    ];

    function toast(a) {
        const root = $('toast-root');
        if (!root) return;
        const el = document.createElement('div');
        el.className = 'toast';
        el.innerHTML = `<span style="font-size:24px">${a.icon}</span><div>🏅 解鎖成就<br><b>${esc(a.name)}</b></div>`;
        root.appendChild(el);
        setTimeout(() => el.remove(), 3600);
    }
    function check() {
        let any = false;
        ACH.forEach(a => {
            if (!data.achievements[a.id] && a.test()) { data.achievements[a.id] = Date.now(); toast(a); any = true; }
        });
        if (any) { scheduleSave(); refreshChip(); }
    }

    // ---------- 供 app.js 呼叫 ----------
    function recordAnswer(q, ok, combo) {
        const s = S();
        s.questions++; ok ? s.correct++ : s.wrong++;
        const lv = s.byLevel[q.level];
        if (lv) ok ? lv.c++ : lv.w++;
        if (q.word) data.seen[q.word] = (q.level || 'level4').slice(-1);
        if (combo > s.maxCombo) s.maxCombo = combo;
        markDay(); scheduleSave(); check();
    }
    function endSession(r) {
        const s = S();
        s.games++; s[r.mode] = (s[r.mode] || 0) + 1;
        if (r.won) s.multiWins++;
        s.playSeconds += r.secs || 0;
        if (r.maxCombo > s.maxCombo) s.maxCombo = r.maxCombo;
        if (r.mode === 'ranked') { s.bestSurvive = Math.max(s.bestSurvive, r.secs); s.bestScore = Math.max(s.bestScore, r.score); }
        const total = r.correct + r.wrong;
        if (total >= 20 && r.wrong === 0) s.flawless++;
        if (total > 0) {
            data.history.push({ t: Date.now(), mode: r.mode, total, correct: r.correct, wrong: r.wrong, score: r.score, secs: r.secs, won: !!r.won });
            data.history = data.history.slice(-60);
        }
        markDay(); flush(); check();
    }
    // 英文麻將：{ type:'end', win, self, ron, tai, longest, special, solo } / { type:'pong' } / { type:'ting' }
    function mjRecord(ev) {
        const m = MJ();
        if (ev.type === 'pong') m.pong++;
        else if (ev.type === 'ting') m.ting++;
        else if (ev.type === 'end') {
            m.games++;
            if (ev.win) {
                m.wins++; if (ev.self) m.zimo++; if (ev.ron) m.ron++; if (ev.special) m.special++;
                m.bestTai = Math.max(m.bestTai, ev.tai || 0); m.longest = Math.max(m.longest, ev.longest || 0);
                ev.solo ? m.soloWins++ : m.multiWins++;
            }
        }
        markDay(); scheduleSave(); check();
    }
    function bankAdded() { S().bankAdded++; scheduleSave(); check(); }
    function bankUndo() { const s = S(); s.bankAdded = Math.max(0, s.bankAdded - 1); scheduleSave(); }
    function bankRemoved() { S().bankRemoved++; scheduleSave(); check(); }

    // ---------- 頭像 / 名稱 ----------
    function paintAvatar(el, size) {
        if (!el) return;
        const fallbackName = (typeof playerNameInput !== 'undefined' && playerNameInput) ? playerNameInput.value : '訪客';
        el.innerHTML = data.avatar ? `<img src="${data.avatar}" alt="avatar">` : esc((data.name || fallbackName || '?').trim().charAt(0).toUpperCase() || '?');
        if (size === 'lg') el.insertAdjacentHTML('beforeend', '<span class="cam">📷</span>');
    }
    function handleAvatarFile(file) {
        if (!file || !file.type.startsWith('image/')) return alert('請選擇圖片檔案！');
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const side = Math.min(img.width, img.height), c = document.createElement('canvas');
                c.width = c.height = 128; // 裁成正方形並壓縮，避免佔用過多儲存空間
                c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 128, 128);
                data.avatar = c.toDataURL('image/jpeg', 0.85);
                flush(); render(); check();
                if (typeof Friends !== 'undefined') Friends.syncName(); // 同步縮圖給好友
            };
            img.onerror = () => alert('無法讀取這張圖片，請換一張試試。');
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    }
    function saveName() {
        const n = $('profile-name-input').value.trim();
        if (!n) return alert('暱稱不能是空白！');
        data.name = n; setPlayerName(n); flush(); render(); refreshChip();
        if (typeof Friends !== 'undefined') Friends.syncName();
    }
    const getName = () => data.name;
    // 64px 小縮圖（約 2KB），上傳給好友看用；原圖不離開這台裝置
    function getThumb() {
        return new Promise(res => {
            if (!data.avatar) return res('');
            const img = new Image();
            img.onload = () => {
                const c = document.createElement('canvas'); c.width = c.height = 64;
                c.getContext('2d').drawImage(img, 0, 0, 64, 64);
                res(c.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = () => res('');
            img.src = data.avatar;
        });
    }

    // ---------- 畫面 ----------
    function refreshChip() {
        paintAvatar($('chip-avatar'));
        const currentInputVal = (typeof playerNameInput !== 'undefined' && playerNameInput) ? playerNameInput.value.trim() : '';
        $('chip-name').textContent = data.name || currentInputVal || '訪客';
        $('chip-sub').textContent = `🏅 ${Object.keys(data.achievements).length} / ${ACH.length} 成就 ・ 複習 ${seenCount()} 字`;
    }

    function trendChart() {
        const pts = data.history.filter(h => h.total >= 3).slice(-20);
        if (pts.length < 2) return '<div class="chart-empty">完成至少 2 局後，這裡會顯示錯誤率的變化曲線 📉</div>';
        const W = 320, H = 150, L = 34, R = 10, T = 12, B = 22;
        const rate = h => h.wrong / h.total * 100;
        const max = Math.max(20, Math.ceil(Math.max(...pts.map(rate)) / 10) * 10);
        const x = i => L + (W - L - R) * (i / (pts.length - 1));
        const y = v => T + (H - T - B) * (1 - v / max);
        const grid = [0, max / 2, max].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)" stroke-dasharray="3 3"/>
            <text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${Math.round(v)}%</text>`).join('');
        const line = pts.map((h, i) => `${x(i)},${y(rate(h))}`).join(' ');
        const area = `${x(0)},${y(0)} ${line} ${x(pts.length - 1)},${y(0)}`;
        const dots = pts.map((h, i) => `<circle cx="${x(i)}" cy="${y(rate(h))}" r="3.5" fill="var(--accent)" stroke="var(--card)" stroke-width="1.5">
            <title>${MODE[h.mode]}・${new Date(h.t).toLocaleDateString()}：錯誤率 ${rate(h).toFixed(1)}%（${h.wrong}/${h.total}）</title></circle>`).join('');
        const first = rate(pts[0]), last = rate(pts[pts.length - 1]);
        const avgA = pts.slice(0, Math.ceil(pts.length / 2)).reduce((a, h) => a + rate(h), 0) / Math.ceil(pts.length / 2);
        const avgB = pts.slice(Math.ceil(pts.length / 2)).reduce((a, h) => a + rate(h), 0) / Math.floor(pts.length / 2);
        const diff = avgB - avgA;
        const msg = Math.abs(diff) < 1 ? '最近表現大致持平' : diff < 0 ? `📉 後半段平均錯誤率下降了 ${Math.abs(diff).toFixed(1)}%，進步中！` : `📈 後半段平均錯誤率上升 ${diff.toFixed(1)}%，可以多複習錯題庫`;
        return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="錯誤率變化">${grid}
            <polygon points="${area}" fill="var(--accent)" opacity="0.12"/>
            <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>${dots}
            <text x="${L}" y="${H - 6}" font-size="10" fill="var(--muted)">較早</text>
            <text x="${W - R}" y="${H - 6}" text-anchor="end" font-size="10" fill="var(--muted)">最近</text></svg>
            <div style="text-align:center;font-size:12px;color:var(--muted);margin-top:4px">${msg}</div>`;
    }

    function render() {
        const s = S(), total = s.questions;
        const rate = total ? (s.wrong / total * 100).toFixed(1) : '0.0';
        const mins = Math.round(s.playSeconds / 60);
        paintAvatar($('profile-avatar'), 'lg');
        const currentInputVal = (typeof playerNameInput !== 'undefined' && playerNameInput) ? playerNameInput.value.trim() : '';
        $('profile-name-input').value = data.name || currentInputVal;
        $('profile-stats').innerHTML = [
            ['遊玩局數', s.games], ['累計答題', total], ['複習單字數', seenCount()],
            ['總錯誤率', rate + '%'], ['最高連擊', s.maxCombo], ['最長生存', s.bestSurvive + ' 秒'],
            ['最高分數', s.bestScore], ['多人勝場', s.multiWins], ['連續天數', streak() + ' 天']
        ].map(([k, v]) => `<div class="stat-card"><b>${v}</b><span>${k}</span></div>`).join('');

        $('profile-chart').innerHTML = trendChart();

        const hist = data.history.slice(-8).reverse();
        $('profile-history').innerHTML = hist.length ? hist.map(h => {
            const d = new Date(h.t);
            const extra = h.mode === 'ranked' ? `${h.secs} 秒 ・ ${h.score} 分` : h.mode === 'multi' ? (h.won ? '🏆 勝利' : '未獲勝') : '';
            return `<div class="hist-row"><div><span class="m">${MODE[h.mode]}</span> ・ 答對 ${h.correct}/${h.total}</div>
                <div class="r">錯誤率 ${(h.wrong / h.total * 100).toFixed(0)}%${extra ? ' ・ ' + extra : ''}<br>${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</div></div>`;
        }).join('') : '<div class="chart-empty">還沒有遊玩紀錄，去玩一局吧！</div>';

        const got = Object.keys(data.achievements).length;
        $('ach-count').textContent = `(${got} / ${ACH.length})`;
        const sorted = [...ACH].sort((a, b) => (!!data.achievements[b.id]) - (!!data.achievements[a.id]));
        $('profile-achievements').innerHTML = sorted.map(a => {
            const t = data.achievements[a.id];
            return `<div class="ach ${t ? 'done' : 'locked'}"><span class="ic">${a.icon}</span>
                <div><div class="nm">${esc(a.name)}</div><div class="ds">${t ? '✔ ' + new Date(t).toLocaleDateString() : esc(a.desc)}</div></div></div>`;
        }).join('');
    }

    function open() { check(); showScreen('profile'); render(); if (typeof initCollapsibles === 'function') initCollapsibles(); }

    // ---------- 回饋 ----------
    function setFbStatus(msg, cls) { const el = $('fb-status'); el.textContent = msg; el.className = 'fb-status ' + (cls || ''); }
    async function sendFeedback() {
        const msg = $('fb-message').value.trim();
        if (msg.length < 5) return setFbStatus('請至少輸入 5 個字再送出喔！', 'err');
        const type = $('fb-type').value, contact = $('fb-contact').value.trim();
        const info = { 玩家暱稱: data.name || playerNameInput.value || '訪客', 聯絡方式: contact || '（未填）', 裝置: navigator.userAgent, 版本: 'app v5', 時間: new Date().toLocaleString() };
        const btn = $('btn-fb-send');
        btn.disabled = true; setFbStatus('送出中...');
        try {
            const res = await fetch(`https://formsubmit.co/ajax/${FEEDBACK_EMAIL}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ _subject: `[單字King] ${type}`, _template: 'table', _captcha: 'false', 類型: type, 內容: msg, ...info })
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok || !(j.success === true || j.success === 'true')) throw new Error(j.message || 'send failed');
            setFbStatus('✅ 已送出，感謝你的回饋！', 'ok');
            S().feedbackSent++; flush(); check();
            $('fb-message').value = '';
            setTimeout(() => { $('feedback-modal').classList.add('hidden'); setFbStatus(''); }, 1400);
        } catch (e) {
            // 備援：用使用者的郵件軟體寄出
            const body = `${msg}\n\n----\n` + Object.entries(info).map(([k, v]) => `${k}：${v}`).join('\n');
            setFbStatus('自動寄送失敗，已改為開啟你的郵件軟體，請按寄出。', 'err');
            window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('[單字King] ' + type)}&body=${encodeURIComponent(body)}`;
        } finally { btn.disabled = false; }
    }

    // ---------- 事件綁定 ----------
    function bind() {
        const click = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { if (typeof playClickSound === 'function') playClickSound(); fn(); }); };
        click('btn-goto-profile', open);
        click('profile-chip', open);
        click('btn-profile-back', () => { showScreen('lobby'); showMenu('main'); refreshChip(); });
        click('btn-profile-close-top', () => { showScreen('lobby'); showMenu('main'); refreshChip(); });
        click('btn-profile-save', saveName);
        click('btn-avatar-pick', () => $('avatar-file').click());
        $('profile-avatar').addEventListener('click', () => $('avatar-file').click());
        $('avatar-file').addEventListener('change', e => { handleAvatarFile(e.target.files[0]); e.target.value = ''; });
        click('btn-avatar-remove', () => { data.avatar = ''; flush(); render(); refreshChip(); if (typeof Friends !== 'undefined') Friends.syncName(); });
        $('profile-name-input').addEventListener('keydown', e => { if (e.key === 'Enter') saveName(); });
        click('btn-profile-reset', () => {
            if (!confirm('確定要清除所有個人紀錄與成就嗎？（暱稱與頭像會保留，錯題庫與排行榜不受影響）')) return;
            const keep = { name: data.name, avatar: data.avatar };
            data = { ...fresh(), ...keep }; flush(); render(); refreshChip();
        });
        // 如果有儲存過名字，確保 profile 的 name 有值
        if (!data.name) {
            data.name = '請輸入暱稱';
        }
        // 回饋
        click('btn-open-feedback', () => { $('btn-settings-close').click(); setFbStatus(''); $('feedback-modal').classList.remove('hidden'); });
        click('btn-fb-send', sendFeedback);
        click('btn-fb-cancel', () => $('feedback-modal').classList.add('hidden'));
        $('feedback-modal').addEventListener('click', e => { if (e.target.id === 'feedback-modal') e.target.classList.add('hidden'); });
        markDay(); check(); refreshChip();
    }
    // app.js 的 DOMContentLoaded 會先呼叫 getName / refreshChip，所以這裡同樣在載入完成後綁定
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();

    const getMjBestTai = () => MJ().bestTai || 0;
    return { recordAnswer, endSession, mjRecord, getMjBestTai, bankAdded, bankUndo, bankRemoved, getName, getThumb, refreshChip, render };
})();
