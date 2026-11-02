// 金幣・商店・交易市場（全版本存檔自動掃描搶救、高效能隨機遊走、槓桿爆倉、每週配息）
(() => {
    'use strict';
    const KEY = 'vbEco_v3';
    
    // 麻將投擲物
    const THROWS = [
        { id: 'egg', e: '🥚', name: '雞蛋', price: 0, c: '#fde047' },
        { id: 'poop', e: '💩', name: '大便', price: 0, c: '#78350f' },
        { id: 'tomato', e: '🍅', name: '番茄', price: 60, c: '#ef4444' },
        { id: 'banana', e: '🍌', name: '香蕉皮', price: 60, c: '#fde68a' },
        { id: 'cheese', e: '🧀', name: '臭起司', price: 80, c: '#fbbf24' },
        { id: 'shoe', e: '👟', name: '臭鞋', price: 80, c: '#6b7280' },
        { id: 'fish', e: '🐟', name: '鹹魚', price: 120, c: '#60a5fa' },
        { id: 'cake', e: '🎂', name: '奶油蛋糕', price: 150, c: '#f9a8d4' },
        { id: 'bomb', e: '💣', name: '黑煙炸彈', price: 200, c: '#111827' }
    ];
    const FELTS = [
        { id: 'default', name: '經典綠絨', price: 0, sw: 'linear-gradient(#1d5246,#0d2b27)' },
        { id: 'blue', name: '夜空藍', price: 200, sw: 'linear-gradient(#27407a,#0d1a3d)' },
        { id: 'pink', name: '櫻花粉', price: 200, sw: 'linear-gradient(#b8577a,#5c2540)' },
        { id: 'gold', name: '黑金豪華', price: 400, sw: 'linear-gradient(#3a3a3a,#111)' }
    ];
    const CHAT_PACKS = [
        { id: 'chat_trash', name: '嗆聲快捷語包', price: 150, list: ['你這牌也太爛了吧', '我看你怎麼贏', '承讓承讓~', '再來一局！', '不要再碰了啦', '今天手氣真好'] },
        { id: 'chat_cute', name: '可愛快捷語包', price: 150, list: ['謝謝你～', '好險好險', '哇！好厲害', '我只是路過的', '給我一個字母嘛', '加油加油！'] }
    ];

    // 📈 三大市場標的：股票、基金、虛擬貨幣
    const STOCKS = [
        { id: 'KNG', name: '單字King科技', cat: 'stock', base: 150, vol: .35, div: 0.04, desc: '開發英文單字學習遊戲的科技公司，營運穩健並具備定期配息能力。' },
        { id: 'RSA', name: '紅海科技', cat: 'stock', base: 100, vol: .48, div: 0.02, desc: '專門經營錯題庫存放業務，市場波動較大，周邊利潤高。' },
        { id: 'LFK', name: '連發科', cat: 'stock', base: 80, vol: .55, div: 0.03, desc: '全國最大字母麻將連鎖，受連假與娛樂板塊影響深遠。' },
        { id: 'EGG', name: '台雞店', cat: 'stock', base: 30, vol: .70, div: 0.05, desc: '護城河標的，但近期面臨供應鏈成本與原料價格波動危機。' },
        { id: 'POO', name: '肥料公司', cat: 'stock', base: 20, vol: .85, div: 0.01, desc: '極高投機性，受環保法規與突發事件影響大。' },
        { id: 'NVD', name: '草灰達', cat: 'stock', base: 50, vol: .95, div: 0.0, desc: '高風險高報酬AI概念股，隨時可能暴賺或大跌。' },
        { id: 'W50', name: '全球單字50ETF', cat: 'fund', base: 200, vol: .15, div: 0.06, desc: '追蹤全球前50大高頻單字指數，配息穩定，抗跌首選。' },
        { id: 'BND', name: '7000字債券基金', cat: 'fund', base: 120, vol: .08, div: 0.08, desc: '固定收益型資產，幾乎不暴跌，提供穩定現金流。' },
        { id: 'TECH', name: 'AI單字科技基金', cat: 'fund', base: 180, vol: .25, div: 0.03, desc: '結合演算法與記憶曲線，長期成長與配息兼具。' },
        { id: 'BTC', name: '比特幣 (BitWord)', cat: 'crypto', base: 500, vol: 1.4, div: 0.0, desc: '加密貨幣之王，零配息，全憑市場狂熱與大戶信仰支撐。' },
        { id: 'ETH', name: '以太幣 (EthVocab)', cat: 'crypto', base: 300, vol: 1.7, div: 0.0, desc: '智慧合約龍頭，流動性極高，暴跌時常引發連環清算。' },
        { id: 'DOGE', name: '狗狗單字幣', cat: 'crypto', base: 10, vol: 2.5, div: 0.0, desc: '迷因幣極端標的！可能歸零也可能一夕暴富，毫無基本面。' }
    ];

    const FEE = .02;   // 手續費 2%
    // 降溫措施：賣出要繳證交稅與資本利得稅、槓桿上限、日配息 ×0.1（已取消大單滑價，下單一律照市價）
    const STAMP = { stock: .003, fund: .001, crypto: .005 }, CGT = { stock: .25, fund: .15, crypto: .40 };
    // 持倉的「進場均價」與「淨值」：保證金 = 進場價 × 數量 ÷ 槓桿；損益 = (現價 − 進場價) × 數量（全額曝險，不再重複乘槓桿）
    // 舊存檔沒有 ep 欄位時，用保證金成本反推進場價
    const entryOf = h => h.ep > 0 ? h.ep : (h.cost * (h.lev || 1)) / Math.max(1, h.q);
    const equityOf = (h, p) => { const lev = h.lev || 1, ep = entryOf(h); return Math.max(0, h.q * (ep / lev + (p - ep))); };
    // 💎 富豪精品：幾千萬～兩億，買了放收藏櫃，也算資產（以轉售價計入淨值與資產稅），可轉售
    const LUX = [
        { id: 'lux_watch', e: '⌚', name: '限量鑽石腕錶', price: 15000000, desc: '瑞士大師手工鑲鑽，戴出門自帶聚光燈。' },
        { id: 'lux_car', e: '🏎️', name: '全球限量超跑', price: 30000000, desc: '全球只生產 99 台，油門一踩路人全轉頭。' },
        { id: 'lux_art', e: '🖼️', name: '大師真跡畫作', price: 45000000, desc: '拍賣會上搶破頭的傳世名畫。' },
        { id: 'lux_yacht', e: '🛥️', name: '私人豪華遊艇', price: 60000000, desc: '附泳池與直升機停機坪的海上宮殿。' },
        { id: 'lux_space', e: '🚀', name: '太空旅行艙位', price: 80000000, desc: '搭火箭看地球，朋友圈最遠的打卡點。' },
        { id: 'lux_jet', e: '🛩️', name: '私人噴射機', price: 90000000, desc: '想飛哪就飛哪，登機不用排隊。' },
        { id: 'lux_castle', e: '🏰', name: '歐洲古堡莊園', price: 120000000, desc: '中世紀城堡加酒莊，貴族氣場全開。' },
        { id: 'lux_island', e: '🏝️', name: '私人度假島嶼', price: 200000000, desc: '整座島都是你的，連海鷗都要看你臉色。' }
    ];
    const LUX_RESALE = 0.6;
    const luxOwned = () => LUX.filter(l => S.items && S.items[l.id]);
    const luxVal = () => Math.round(luxOwned().reduce((a, l) => a + l.price * LUX_RESALE, 0));
    const maxLev = st => st.cat === 'crypto' ? 3 : st.cat === 'fund' ? 2 : 5;
    // 下單一律照市價成交（已取消大單滑價）。畫面顯示、最多可買、實際下單共用 marginFor，數字永遠一致
    const MAX_QTY = 1e12;
    const qtyOf = v => Math.min(MAX_QTY, Math.max(1, Math.floor(+v) || 1));
    const marginFor = (p, q, lev) => Math.ceil(p * q / lev * (1 + FEE));
    function maxAffordable(p, lev) {   // 二分搜尋：手上金幣最多買得起幾單位
        if (!(S.coins > 0) || !(p > 0)) return 0;
        let lo = 0, hi = MAX_QTY;
        while (lo < hi) { const mid = Math.floor((lo + hi + 1) / 2); if (marginFor(p, mid, lev) <= S.coins) lo = mid; else hi = mid - 1; }
        return lo;
    }
    const def = () => ({ coins: 100, items: {}, equip: { throw: 'egg', felt: 'default' }, stocks: {}, lastDaily: '', lastTax: '', lastDividend: 0, bank: { dep: 0, loan: 0, tick: 0, due: 0 }, inbox: [], log: [], signed: [] });
    
    // ---------- 存檔：載入、修復、備份 ----------
    const LEGACY = ['vbEco_v2', 'vbEco_v1', 'vbEco'], BK_KEY = 'vk_eco_backups', GATE_KEY = 'vk_eco_gate';
    const jparse = raw => { try { const p = JSON.parse(raw); return p && typeof p === 'object' ? p : null; } catch (e) { return null; } };
    const fin = v => (typeof v === 'number' && isFinite(v) ? v : 0);
    const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
    const getGate = () => jparse(localStorage.getItem(GATE_KEY)) || {};      // 「今天領過／扣過了」的紀錄，獨立存放，還原舊存檔也不會讓同一天重複領／扣
    const setGate = g => { try { localStorage.setItem(GATE_KEY, JSON.stringify(g)); } catch (e) { } };
    function sanitize(o) {   // 缺欄位補預設、NaN 變 0（舊存檔的持股沒有 lev 槓桿欄位，會害賣出時金幣變 NaN）
        const s = Object.assign(def(), o || {}); s.equip = Object.assign(def().equip, (o && o.equip) || {}); s.items = s.items && typeof s.items === 'object' ? s.items : {};
        s.coins = Math.round(fin(s.coins)); s.lastRisk = fin(s.lastRisk); s.stocks = s.stocks && typeof s.stocks === 'object' ? s.stocks : {};
        Object.keys(s.stocks).forEach(id => { const h = s.stocks[id]; if (!h || !(h.q > 0)) { delete s.stocks[id]; return; } h.q = Math.floor(fin(h.q)); h.cost = Math.max(0, fin(h.cost)); h.ep = Math.max(0, fin(h.ep)); h.lev = h.lev >= 1 ? h.lev : 1; h.sl = fin(h.sl); if (h.q <= 0) delete s.stocks[id]; });
        s.bank = Object.assign({ dep: 0, loan: 0, tick: 0, due: 0 }, s.bank || {}); ['dep', 'loan', 'tick', 'due'].forEach(k => { s.bank[k] = fin(s.bank[k]); });
        s.inbox = (Array.isArray(s.inbox) ? s.inbox : []).filter(x => x && x.id && fin(x.amt) > 0).map(x => ({ id: String(x.id), type: 'transfer', from: String(x.from || '好友'), amt: Math.floor(x.amt), t: fin(x.t) }));
        s.log = (Array.isArray(s.log) ? s.log : []).filter(x => x && typeof x === 'object').slice(0, 300);
        s.signed = (Array.isArray(s.signed) ? s.signed : []).slice(0, 200);
        return s;
    }
    let S = def(), loadNote = '', lastBk = 0;
    try {
        const raw = localStorage.getItem(KEY), cur = jparse(raw);
        if (cur) {
            if (!Number.isFinite(cur.coins)) { loadNote = 'repaired'; try { localStorage.setItem('vk_eco_corrupt', raw); } catch (e) { } lastBk = Date.now(); }
            S = sanitize(cur);
        } else {   // 目前存檔不存在：才去搶救舊版存檔（挑金幣最多的一份，只做這一次）
            let best = null; LEGACY.forEach(k => { const p = jparse(localStorage.getItem(k)); if (p && Number.isFinite(p.coins) && (!best || p.coins > best.coins)) best = p; });
            if (best) { S = sanitize(best); loadNote = 'migrated'; }
        }
        localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) { }
    const backups = () => { const a = jparse(localStorage.getItem(BK_KEY)); return Array.isArray(a) ? a : []; };
    function backup(why, force) {   // 自動備份：每 15 分鐘最多一份，保留 8 份；資料異常時不備份
        const now = Date.now(); if (!force && now - lastBk < 15 * 60000) return; if (!Number.isFinite(S.coins)) return; lastBk = now;
        try { const a = backups(); a.unshift({ t: now, why: why || '自動備份', d: JSON.stringify(S) }); localStorage.setItem(BK_KEY, JSON.stringify(a.slice(0, 8))); } catch (e) { }
    }

    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } backup(); };
    const subs = [];
    const changed = () => { save(); document.querySelectorAll('.eco-coins').forEach(el => { el.textContent = S.coins; el.style.color = S.coins < 0 ? '#dc2626' : ''; }); updateDot(); subs.forEach(f => { try { f(); } catch (e) { } }); if (ov) refresh(); };
    const logTx = (k, text, a) => { if (!Array.isArray(S.log)) S.log = []; S.log.unshift({ t: Date.now(), k, x: text, a: Math.round(a || 0) }); if (S.log.length > 300) S.log.length = 300; };
    const z2 = n => String(n).padStart(2, '0');
    const fmtHM = t => { const d = new Date(t); return `${z2(d.getHours())}:${z2(d.getMinutes())}`; };
    const fmtDT = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${fmtHM(t)}`; };
    // 通知數量：待簽收的轉帳 + 快到期（24 小時內）或已逾期的貸款
    const loanAlert = () => { const b = bk(), owe = Math.ceil(b.loan); return owe > 0 && b.due && (Date.now() > b.due || b.due - Date.now() < 864e5); };
    const notifCount = () => (S.inbox ? S.inbox.length : 0) + (loanAlert() ? 1 : 0);
    const updateDot = () => { const n = notifCount(); document.querySelectorAll('.eco-fab-dot').forEach(el => { el.textContent = n; el.style.display = n ? 'inline-block' : 'none'; }); };
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // ---------- 互動式商業新聞與深度內容 ----------
    let activeNews = {
        title: "市場運行平穩，暫無重大財經事件。",
        detail: "目前各大板塊多空交錯，流動性維持正常水準。投資人可關注各企業的每週配息與基本面表現，切勿盲目開高槓桿。",
        impact: 0,
        time: "剛剛"
    };
    
    let showNewsModal = false;

    function toast(msg) {
        let t = document.getElementById('eco-toast');
        if (!t) { t = document.createElement('div'); t.id = 'eco-toast'; document.body.appendChild(t); }
        t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200);
    }

    // 總統可調整全體玩家的資產稅倍率（0～2 倍）。存在本機，下次開遊戲就生效
    let taxMult = (() => { const v = localStorage.getItem('vk_taxmult'); return v !== null && !isNaN(+v) ? +v : 1; })();
    function getNextTaxAmount() {
        let invVal = 0;
        Object.keys(S.stocks).forEach(id => {
            const st = STOCKS.find(x => x.id === id);
            if (st) invVal += equityOf(S.stocks[id], price(st));
        });
        const bkn = bk(), netWorth = Math.max(0, S.coins + invVal + luxVal() - Math.ceil(bkn.loan));   // 銀行存款免稅（不計入）；貸款視為負債，可扣除
        let taxRate = 0;
        if (netWorth >= 50000000) taxRate = 0.40;   // 最高累進稅率 40%
        else if (netWorth >= 20000000) taxRate = 0.35;
        else if (netWorth >= 10000000) taxRate = 0.30;
        else if (netWorth >= 2000000) taxRate = 0.20;
        else if (netWorth >= 500000) taxRate = 0.12;
        else if (netWorth >= 100000) taxRate = 0.05;

        return { netWorth, taxRate, taxDue: Math.round(netWorth * taxRate * 0.05 * taxMult) };
    }

    // ---------- 存檔救援 ----------
    function summarize(d) {
        const x = sanitize(d), hv = Object.keys(x.stocks).reduce((a, id) => { const st = STOCKS.find(s => s.id === id); return a + (st ? equityOf(x.stocks[id], price(st)) : 0); }, 0);
        return `金幣 ${x.coins.toLocaleString()}・持股 ${Object.keys(x.stocks).length} 檔（市值約 ${Math.round(hv).toLocaleString()}）・銀行存款 ${Math.floor(x.bank.dep).toLocaleString()}${x.lastTax ? '・稅期 ' + x.lastTax : ''}`;
    }
    function candidates() {
        const out = [], fmt = t => new Date(t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
        backups().forEach(b => { const p = jparse(b.d); if (p) out.push({ src: `自動備份 ${fmt(b.t)}（${b.why}）`, data: p }); });
        LEGACY.forEach(k => { const p = jparse(localStorage.getItem(k)); if (p) out.push({ src: `舊版存檔「${k}」`, data: p }); });
        const bad = jparse(localStorage.getItem('vk_eco_corrupt')); if (bad) out.push({ src: '損毀前的存檔（金幣欄位已遺失，持股還在）', data: bad });
        return out;
    }
    const bkListHtml = () => { const c = candidates(); return c.length ? c.map((x, i) => `<div class="eco-box2" style="margin-top:4px;"><b style="font-size:13px;">${x.src}</b><div class="eco-note">${summarize(x.data)}</div><button class="eco-b" data-bkrestore="${i}" style="padding:6px 12px;">還原這份</button></div>`).join('') : '<div class="eco-note">目前沒有可還原的備份。</div>'; };
    function restoreData(p) {
        backup('還原前', true); const gate = getGate(); S = sanitize(p);
        if (gate.daily) S.lastDaily = gate.daily; if (gate.tax) S.lastTax = gate.tax; if (gate.div) S.lastDivDay = gate.div;
        showBk = false; changed(); toast('✅ 已還原存檔');
    }
    function bkClick(e) {
        const rs = e.target.closest('[data-bkrestore]');
        if (rs) { const c = candidates()[+rs.dataset.bkrestore]; if (c && confirm(`還原「${c.src}」？\n${summarize(c.data)}\n\n（目前的存檔會先自動備份）`)) restoreData(c.data); return true; }
        const b = e.target.closest('[data-bk]'); if (!b) return false;
        if (b.dataset.bk === 'toggle') { showBk = !showBk; refresh(); }
        else if (b.dataset.bk === 'export') { const txt = JSON.stringify(S); try { navigator.clipboard.writeText(txt).then(() => toast('✅ 存檔已複製到剪貼簿'), () => prompt('複製下方存檔文字：', txt)); } catch (err) { prompt('複製下方存檔文字：', txt); } }
        else if (b.dataset.bk === 'import') { const t = prompt('貼上之前匯出的存檔文字：'); if (!t) return true; const p = jparse(t); if (!p || !('coins' in p)) return toast('這不是有效的存檔文字'), true; if (confirm(`匯入這份存檔？\n${summarize(p)}`)) restoreData(p); }
        return true;
    }

    // ==================== 🏦 單字銀行：存款（免資產稅）、提款、貸款 ====================
    const BANK = { dep: .004, loan: .015, late: .04, debt: .03, term: 7, minLimit: 20000, maxLimit: 20000000 };   // debt：手上金幣為負數（負債）的透支日利率 3%   // 日利率：活存 0.4%、貸款 1.5%、逾期 4%；期限 7 天
    const bk = () => { if (!S.bank || typeof S.bank !== 'object') S.bank = { dep: 0, loan: 0, tick: 0, due: 0 }; return S.bank; };
    const holdingsVal = () => Object.keys(S.stocks).reduce((a, id) => { const st = STOCKS.find(x => x.id === id); return a + (st ? equityOf(S.stocks[id], price(st)) : 0); }, 0);
    const creditLimit = () => { const b = bk(); return Math.min(BANK.maxLimit, Math.max(BANK.minLimit, Math.floor(.5 * Math.max(0, S.coins + b.dep + holdingsVal() - Math.ceil(b.loan))))); };   // 總貸款上限 = 淨資產的一半
    const isLate = () => { const b = bk(); return b.loan > 0 && b.due && Date.now() > b.due; };
    function coverOverdraft() {   // 手上金幣變負數時，先用銀行存款自動補
        const b = bk(); if (S.coins >= 0 || b.dep < 1) return false; const cover = Math.min(-S.coins, Math.floor(b.dep));
        b.dep = +(b.dep - cover).toFixed(2); S.coins += cover; setTimeout(() => toast(`🏦 透支保護：自動從存款補上 ${cover.toLocaleString()} 🪙`), 300); return true;
    }
    function bankTick() {
        const b = bk(), now = Date.now(); if (!b.tick) { b.tick = now; save(); return; }
        let days = (now - b.tick) / 864e5; if (days < 1 / 1440) return; days = Math.min(days, 60); b.tick = now;
        let did = coverOverdraft();
        if (S.coins < 0) { S.coins = Math.round(S.coins * Math.pow(1 + BANK.debt, days)); did = true; }   // 負債利息
        if (b.dep <= 0 && b.loan <= 0) { if (did) changed(); else save(); return; }
        if (b.dep > 0) b.dep = +(b.dep * Math.pow(1 + BANK.dep, days)).toFixed(2);
        if (b.loan > 0) b.loan = +(b.loan * Math.pow(1 + (isLate() ? BANK.late : BANK.loan), days)).toFixed(2);
        if (isLate()) {   // 逾期：銀行強制扣款，先扣存款，再扣手上金幣
            let need = Math.ceil(b.loan); const fromDep = Math.min(need, Math.floor(b.dep)); b.dep = +(b.dep - fromDep).toFixed(2); need -= fromDep;
            const fromCoins = Math.min(need, Math.max(0, S.coins)); S.coins -= fromCoins; b.loan = Math.max(0, +(b.loan - fromDep - fromCoins).toFixed(2));
            if (fromDep + fromCoins > 0) setTimeout(() => toast(`🏦 貸款逾期，銀行強制扣款 ${(fromDep + fromCoins).toLocaleString()} 🪙`), 500);
        }
        if (b.loan < 1) { b.loan = 0; b.due = 0; }
        changed();
    }
    function bankAct(kind) {
        const b = bk(), num = id => { const el = ov && ov.querySelector(id); return Math.floor(Number(el ? el.value : 0)) || 0; }, inA = num('#eco-bank-a'), inB = num('#eco-bank-b'); bankTick();
        const dep = Math.floor(b.dep), owe = Math.ceil(b.loan), lim = creditLimit(), room = Math.max(0, lim - owe);
        let amt = 0;
        if (kind === 'dep') amt = inA; else if (kind === 'dep-all') amt = S.coins; else if (kind === 'wd') amt = inA; else if (kind === 'wd-all') amt = dep;
        else if (kind === 'borrow') amt = inB; else if (kind === 'borrow-max') amt = room; else if (kind === 'repay') amt = inB; else if (kind === 'repay-all') amt = Math.min(owe, Math.max(0, Math.floor(S.coins))); else if (kind === 'repay-half') amt = Math.min(Math.ceil(owe / 2), Math.max(0, Math.floor(S.coins)));
        if (amt <= 0) return toast('請輸入有效金額！');
        if (kind === 'dep' || kind === 'dep-all') { if (amt > S.coins) return toast('金幣不足！'); S.coins -= amt; b.dep = +(b.dep + amt).toFixed(2); logTx('🏦 銀行', '存入存款', -amt); changed(); toast(`🏦 已存入 ${amt.toLocaleString()} 🪙（存款不計入資產稅）`); }
        else if (kind === 'wd' || kind === 'wd-all') { if (amt > dep) return toast('存款不足！'); b.dep = +(b.dep - amt).toFixed(2); S.coins += amt; logTx('🏦 銀行', '提領存款', amt); changed(); toast(`🏦 已提領 ${amt.toLocaleString()} 🪙（回到手上就會計入資產稅）`); }
        else if (kind === 'borrow' || kind === 'borrow-max') {
            if (isLate()) return toast('貸款逾期中，還清前不能再借');
            if (amt > room) return toast(`超過可借額度（還能借 ${room.toLocaleString()} 🪙）`);
            if (!b.loan) b.due = Date.now() + BANK.term * 864e5; S.coins += amt; b.loan = +(b.loan + amt).toFixed(2); logTx('🏦 銀行', '借款', amt); changed(); toast(`🏦 已借款 ${amt.toLocaleString()} 🪙，${BANK.term} 天內要還清`);
        } else {
            if (owe <= 0) return toast('你沒有貸款！'); if (amt > owe) amt = owe; if (amt > S.coins) return toast('金幣不足！');
            S.coins -= amt; b.loan = +(b.loan - amt).toFixed(2); if (b.loan < 1) { b.loan = 0; b.due = 0; } logTx('🏦 銀行', '還款', -amt); changed(); toast(`🏦 已還款 ${amt.toLocaleString()} 🪙`);
        }
        refresh();
    }
    function bankHtml() {
        const b = bk(), dep = Math.floor(b.dep), owe = Math.ceil(b.loan), lim = creditLimit(), room = isLate() ? 0 : Math.max(0, lim - owe), late = isLate();
        const due = b.due && owe > 0 ? new Date(b.due).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
        return `<div class="eco-wallet-card">
            <div class="eco-wallet-title">🏦 單字銀行</div>
            <div class="eco-wallet-num">存款 🪙 ${dep.toLocaleString()}</div>
            <div class="eco-wallet-grid">
                <div class="eco-wallet-subbox"><span>手上金幣</span><b>🪙 ${S.coins.toLocaleString()}</b></div>
                <div class="eco-wallet-subbox"><span>貸款餘額</span><b style="color:${late ? '#dc2626' : 'inherit'}">🪙 ${owe.toLocaleString()}</b></div>
            </div>
            <div style="margin-top:6px;font-size:12px;opacity:.85;line-height:1.6">✅ 存款<b>不計入資產稅</b>；貸款可從應稅資產扣除。<br>活存日利率 ${(BANK.dep * 100).toFixed(1)}%　貸款日利率 ${(BANK.loan * 100).toFixed(1)}%（逾期 ${(BANK.late * 100).toFixed(0)}%）</div>
        </div>
        <div class="eco-box2" style="margin-top:6px;">
            <div style="font-weight:800;">💰 存款／提款</div>
            <div class="eco-note">金額輸入後按 Enter＝存入。存款會每天生利息。</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:2px;">
                <input type="number" id="eco-bank-a" placeholder="金額" class="eco-tf" inputmode="numeric" enterkeyhint="done" style="flex:1;min-width:90px;padding:6px 10px;" min="1">
                <button class="eco-b" data-bank="dep" style="padding:6px 12px;">存入</button><button class="eco-b" data-bank="wd" style="padding:6px 12px;">提領</button>
            </div>
            <div style="display:flex;gap:6px;"><button class="eco-b" data-bank="dep-all" style="flex:1;padding:6px;">全部存入</button><button class="eco-b" data-bank="wd-all" style="flex:1;padding:6px;">全部提領</button></div>
        </div>
        <div class="eco-box2" style="margin-top:6px;">
            <div style="font-weight:800;">🏷️ 貸款</div>
            <div class="eco-note">信用額度 🪙 ${lim.toLocaleString()}（依淨資產的一半，最低 ${BANK.minLimit.toLocaleString()}）　目前還能借 🪙 ${room.toLocaleString()}<br>${late ? '<b style="color:#dc2626">⚠️ 貸款已逾期！銀行會強制扣款，還清前不能再借。</b>' : `還款期限：${due}（借款後 ${BANK.term} 天內）`}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:2px;">
                <input type="number" id="eco-bank-b" placeholder="金額" class="eco-tf" inputmode="numeric" enterkeyhint="done" style="flex:1;min-width:90px;padding:6px 10px;" min="1">
                <button class="eco-b" data-bank="borrow" style="padding:6px 12px;">借款</button><button class="eco-b" data-bank="repay" style="padding:6px 12px;">還款</button>
            </div>
            <div style="display:flex;gap:6px;"><button class="eco-b" data-bank="borrow-max" style="flex:1;padding:6px;">借到額度上限</button><button class="eco-b" data-bank="repay-all" style="flex:1;padding:6px;">全額還款</button></div>
        </div>`;
    }

    // add：增減金幣；沒錢會變成負數（負債），不再卡在 0
    const add = (n, why) => { n = Math.round(n); if (!n) return;
        // 其他模組（世界地圖信箱）用 add 入帳「轉帳」時，改成先進通知欄、由玩家簽收
        if (n > 0 && why && /轉帳/.test(why)) return void receiveTransfer((String(why).match(/[「"“]([^」"”]+)[」"”]/) || [])[1] || '好友', n);
        S.coins += n; if (why) logTx(n > 0 ? '🎁 收入' : '💸 支出', why, n); changed(); if (why) toast(`🪙 ${n > 0 ? '+' : ''}${n} ${why}`); };
    
    // 每日配息、資產稅：各一天一次（用獨立的 gate 記錄，還原存檔也不會重複）
    const DIV_X = .1;   // 日配息 = 配息率 × 0.1
    function checkTaxAndDividend() {
        const k = dayKey(), gate = getGate();
        if (S.lastDivDay !== k && gate.div !== k) {
            S.lastDivDay = k; gate.div = k; setGate(gate);
            let totalDiv = 0;
            Object.keys(S.stocks).forEach(id => { const st = STOCKS.find(x => x.id === id), h = S.stocks[id]; if (st && h && st.div > 0) totalDiv += Math.floor(equityOf(h, price(st)) * st.div * DIV_X); });
            if (totalDiv > 0) { S.coins += totalDiv; logTx('💵 配息', '企業現金股利', totalDiv); setTimeout(() => toast(`💵 【企業配息】今日現金股利 +${totalDiv.toLocaleString()} 🪙`), 500); }
            changed();
        }
        if (S.lastTax !== k && gate.tax !== k) {
            S.lastTax = k; gate.tax = k; setGate(gate);
            const taxInfo = getNextTaxAmount();
            if (taxInfo.taxRate > 0 && taxInfo.taxDue > 0) {
                S.coins -= taxInfo.taxDue; logTx('🏛️ 稅金', '資產稅扣繳', -taxInfo.taxDue);
                setTimeout(() => toast(`🏛️ 國稅局通知：應稅資產 ${Math.round(taxInfo.netWorth).toLocaleString()} 🪙，扣繳資產稅 -${taxInfo.taxDue.toLocaleString()} 🪙`), 1000);
            }
            coverOverdraft(); changed();
        }
    }

    const allItems = () => [
        ...THROWS.map(t => ({ id: 'throw_' + t.id, cat: 'throw', icon: t.e, name: t.name, price: t.price, ref: t.id })),
        ...FELTS.map(f => ({ id: 'felt_' + f.id, cat: 'felt', sw: f.sw, name: f.name, price: f.price, ref: f.id })),
        ...CHAT_PACKS.map(p => ({ id: p.id, cat: 'chat', icon: '💬', name: p.name, price: p.price, list: p.list })),
        ...LUX.map(l => ({ id: l.id, cat: 'lux', icon: l.e, name: l.name, price: l.price, ref: l.id }))
    ];
    const owned = id => { const it = allItems().find(x => x.id === id) || allItems().find(x => x.ref === id); return !!it && (it.price === 0 || !!S.items[it.id]); };
    const equipped = slot => S.equip[slot];
    const throwIdx = () => Math.max(0, THROWS.findIndex(t => t.id === S.equip.throw));
    function buy(id) {
        const it = allItems().find(x => x.id === id); if (!it || owned(id)) return;
        if (S.coins < it.price) return toast('金幣不夠喔！');
        if (it.cat === 'lux' && !confirm(`確定花 🪙 ${it.price.toLocaleString()} 購買「${it.name}」嗎？\n（之後轉售只能拿回 ${Math.round(LUX_RESALE * 100)}%）`)) return;
        S.coins -= it.price; S.items[id] = 1;
        if (it.cat !== 'chat' && it.cat !== 'lux') S.equip[it.cat] = it.ref;
        logTx('🛒 購物', it.name, -it.price);
        changed(); toast(`✅ 已購買 ${it.name}`);
    }
    function sellLux(id) {
        const l = LUX.find(x => x.id === id); if (!l || !S.items[id]) return;
        const get = Math.round(l.price * LUX_RESALE);
        if (!confirm(`轉售「${l.name}」？只能拿回 🪙 ${get.toLocaleString()}（原價的 ${Math.round(LUX_RESALE * 100)}%）`)) return;
        delete S.items[id]; S.coins += get; logTx('💎 轉售', l.name, get); changed(); toast(`💰 已轉售 ${l.name}，拿回 ${get.toLocaleString()} 🪙`);
    }
    function equip(cat, ref) { const it = allItems().find(x => x.cat === cat && x.ref === ref); if (!it || !owned(it.id)) return false; S.equip[cat] = ref; changed(); return true; }

    let run = 0;
    const onAnswer = (ok, combo) => { if (ok) { const n = combo >= 10 ? 2 : 1; run += n; add(n); } };
    function onMj(r) {
        const t = Math.min(30, r.tai || 0);
        const n = r.win ? (r.solo ? 25 + t * 3 : 40 + t * 4) : (r.solo ? 6 : 12);
        add(n, r.win ? `麻將胡牌獎勵（${r.tai || 0} 台）` : '麻將參與獎勵');
    }
    const onWord = () => add(5, '你查到的新單字加入了麻將資料庫');
    function daily() {
        const d = new Date(), k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        const gate = getGate();
        if (S.lastDaily !== k && gate.daily !== k) { S.lastDaily = k; gate.daily = k; setGate(gate); add(50, '每日登入獎勵'); }
        checkTaxAndDividend();
    }

    // ---------- 高效能零迴圈隨機遊走引擎 ----------
    const hash = n => { n = n | 0; n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; };
    
    // 📰 商業新聞：每 15 分鐘一則，由「時間」決定（不是由你開遊戲的時間決定）。
    // 新聞會點名影響的標的（ids）、板塊（cats）或全市場（all），數字 = 影響強度（正＝利多、負＝利空）
    const NEWS_EVENTS = [
        { tag: '利多', title: '🔥 央行宣佈降息，市場熱錢湧入！', detail: '央行無預警調降利率半碼，資金面全面寬鬆。分析師認為科技股與高槓桿標的將率先反彈。', tip: '行情熱時最容易追高，開槓桿前先想好停損價。', all: 1 },
        { tag: '利空', title: '🚨 信任危機爆發，大戶恐慌性拋售！', detail: '傳出部分造市商流動性枯竭，引發骨牌效應，多檔熱門標的遭遇融資斷頭與停損賣壓。', tip: '高槓桿部位風險最大，可考慮降低曝險或設定停損。', all: -1 },
        { tag: '利空', title: '⚡ 監管機構突擊檢查虛擬貨幣市場！', detail: '主管機關無預警嚴查加密資產與高風險衍生性商品，幣圈情緒急凍，股市也受到波及。', tip: '幣圈受衝擊最重；債券與基金相對抗跌。', cats: { crypto: -1.5, stock: -0.4, fund: 0.2 } },
        { tag: '利多', title: '💎 龍頭企業財報超預期，法人大舉買超！', detail: '本季科技與基礎建設板塊營收優於市場預期，外資連續買超，帶動個股表現。', tip: '財報行情通常集中在個股，留意配息率高的標的。', cats: { stock: 1, fund: 0.3 } },
        { tag: '利空', title: '📉 市場資金乾涸，量縮下殺壓力升高。', detail: '國際局勢使觀望氣氛濃厚，成交量萎縮，多頭缺乏追價意願，盤勢呈現量縮下行。', tip: '資金退潮時，波動大的標的跌得更深。', all: -0.5 },
        { tag: '中性', title: '📊 多空在關鍵價位拉鋸，盤勢區間震盪。', detail: '多空雙方在目前區間展開拉鋸，沒有明顯單邊趨勢。法人建議區間操作，等待明確訊號。', tip: '沒有方向時，不操作也是一種操作。' },
        { tag: '中性', title: '🧭 市場運行平穩，投資人靜待下一個題材。', detail: '各大板塊多空交錯，流動性維持正常。可多關注企業的每日配息與基本面，切勿盲目開高槓桿。', tip: '穩定配息的基金與債券適合當作壓艙石。' },
        { tag: '利多', title: '📱 單字King 新版本上線，用戶數創新高！', detail: '單字King 科技宣布新版本下載量突破預期，營收展望上修，帶動 AI 單字科技基金同步走強。', tip: '個股利多常伴隨隔日獲利了結賣壓。', ids: { KNG: 1.5, TECH: 0.6 } },
        { tag: '利空', title: '🥚 台雞店遭爆原料成本飆漲、供應鏈斷鏈！', detail: '飼料與運費同步上漲，台雞店毛利率壓縮，公司坦言短期難以轉嫁成本。', tip: '低價股單日波動大，注意停損。', ids: { EGG: -1.5, LFK: -0.3 } },
        { tag: '利空', title: '🌱 肥料公司因環保違規遭重罰！', detail: '環保署查獲肥料公司排放超標，裁罰金額創下紀錄，並要求停工改善。', tip: '投機股遇到利空容易連續下殺。', ids: { POO: -1.5 } },
        { tag: '利多', title: '🧠 草灰達發表新一代 AI 晶片，訂單爆量！', detail: '草灰達新品效能大幅超越競品，雲端大廠搶單，AI 概念股全面受惠。', tip: '高風險高報酬，漲得快、跌得更快。', ids: { NVD: 1.5, TECH: 0.8, KNG: 0.3 } },
        { tag: '利多', title: '🏦 機構資金湧入比特幣，現貨 ETF 買盤強勁！', detail: '大型機構持續買進，BitWord 與 EthVocab 成交量放大，市場情緒轉為樂觀。', tip: '幣圈漲勢常來得快去得也快，槓桿請謹慎。', ids: { BTC: 1.5, ETH: 1 } },
        { tag: '利多', title: '🐶 狗狗單字幣被網紅喊單，迷因狂熱再起！', detail: '社群平台湧現大量喊單貼文，散戶一窩蜂追買。分析師提醒：毫無基本面，隨時可能反轉。', tip: '迷因幣是賭場，只拿輸得起的錢。', ids: { DOGE: 1.5 } },
        { tag: '利空', title: '🔓 加密貨幣交易所疑遭駭客入侵！', detail: '多家交易所暫停提領，市場擔心資產外洩，引發恐慌性賣壓與連環清算。', tip: '幣圈連環清算時，高槓桿會先被掃出場。', cats: { crypto: -1.5 } },
        { tag: '利多', title: '🎉 連假出遊潮來襲，連發科字母麻將訂單暴增！', detail: '連假期間字母麻將連鎖店預約全滿，法人看好娛樂板塊本季營收大幅成長。', tip: '題材通常只持續幾天，注意獲利了結時機。', ids: { LFK: 1.5, KNG: 0.3 } },
        { tag: '利空', title: '🔐 紅海科技爆資安事件，錯題庫資料外洩！', detail: '紅海科技承認部分錯題庫遭未授權存取，主管機關已介入調查，客戶流失疑慮升高。', tip: '資安事件的影響通常持續數日。', ids: { RSA: -1.5 } },
        { tag: '利多', title: '📈 債券殖利率走升，固定收益商品吸引避險資金！', detail: '殖利率上升使債券基金配息更具吸引力，資金從高風險標的轉向穩健收益。', tip: '想要穩定現金流，債券基金與 50ETF 是首選。', ids: { BND: 0.5, W50: 0.5 }, cats: { crypto: -0.2 } }
    ];
    const NEWS_MIN = 15;
    const newsStart = m => Math.floor(m / NEWS_MIN) * NEWS_MIN;
    const newsAtMin = m => NEWS_EVENTS[Math.floor(hash(newsStart(m) * 99) * NEWS_EVENTS.length)];
    const impactOf = (ev, st) => !ev ? 0 : (ev.ids && ev.ids[st.id] !== undefined) ? ev.ids[st.id] : (ev.cats && ev.cats[st.cat] !== undefined) ? ev.cats[st.cat] : (ev.all || 0);
    const newsAffected = ev => STOCKS.map(st => ({ st, v: impactOf(ev, st) })).filter(x => x.v !== 0).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    const tagIcon = ev => ev.tag === '利多' ? '🔴▲' : ev.tag === '利空' ? '🟢▼' : '⚪';
    const newsHistory = n => { const m0 = newsStart(Math.floor(Date.now() / 60000)); return Array.from({ length: n }, (_, i) => ({ t: (m0 - i * NEWS_MIN) * 60000, ev: newsAtMin(m0 - i * NEWS_MIN) })); };
    // 新聞影響在 5 分鐘內逐步反映到價格（以前是一個整點直接跳價）
    const newsImpactAt = (st, m) => { const cur = impactOf(newsAtMin(m), st), prev = impactOf(newsAtMin(m - NEWS_MIN), st), f = Math.min(1, (m - newsStart(m)) / 5); return prev + (cur - prev) * f; };
    function updateMarketNews() {
        const nowMin = Math.floor(Date.now() / 60000), start = newsStart(nowMin);
        if (activeNews.start !== start) { const ev = newsAtMin(nowMin); activeNews = { title: ev.title, detail: ev.detail, impact: ev.all || 0, time: fmtHM(start * 60000), ref: ev, start }; }
    }

    function pAt(st, m) {
        const i = STOCKS.indexOf(st) + 1;
        const t1 = Math.floor(m / 30);
        const t2 = Math.floor(m / 360);
        
        const r1 = hash(t1 * 131 + i * 977) - 0.48;
        const r2 = hash(t2 * 73 + i * 311) - 0.5;
        const noise = (hash(m * 7 + i * 37) - 0.5) * 0.2;
        
        const trend = r2 * 1.5 + r1 * 0.8 + noise + (newsImpactAt(st, m) * 0.12);
        return Math.max(0.05, st.base * Math.exp(trend * st.vol));
    }

    function price(st, tms = Date.now()) { 
        updateMarketNews();
        const m = tms / 60000, a = Math.floor(m), f = m - a; 
        const curP = pAt(st, a) * (1 - f) + pAt(st, a + 1) * f;
        return curP;
    }

    // 平倉結算：回收保證金 + 價差損益，再扣證交稅與資本利得稅（賣出、停損共用）
    function settleCalc(st, h, qty, px) {   // 只計算、不改存檔（給畫面預估用）
        const lev = h.lev || 1, ep = entryOf(h), paid = h.cost * (qty / h.q);
        let gross = Math.max(0, Math.round((ep * qty) / lev + (px - ep) * qty)); if (!isFinite(gross)) gross = 0;
        const cgt = Math.round(Math.max(0, gross - paid) * (CGT[st.cat] || .25)), stamp = Math.round(gross * (STAMP[st.cat] || .003));
        return { ret: Math.max(0, gross - cgt - stamp), cgt, stamp, gross, paid };
    }
    function settle(st, h, qty, px) {
        const r = settleCalc(st, h, qty, px);
        h.q -= qty; h.cost -= r.paid; if (h.q <= 0) delete S.stocks[st.id];
        return r;
    }
    // 強制爆倉／停損：只看「真實時間」的價格（以前連圖表的歷史價格都會觸發）。離線期間每分鐘檢查一次，最多回溯 7 天
    function riskCheck(st, px) {
        const h = S.stocks[st.id]; if (!h) return false;
        const lev = h.lev || 1, ep = entryOf(h);
        if ((ep - px) / ep >= 0.85 / lev) { logTx('💥 爆倉', `${st.name} ${lev}x 槓桿強制爆倉`, -Math.round(h.cost)); delete S.stocks[st.id]; setTimeout(() => toast(`💥 【強制爆倉】${st.name} 價格跌到 ${px.toFixed(2)}，${lev}x 槓桿的保證金歸零！`), 200); return true; }
        if (h.sl > 0 && px <= h.sl) { const r = settle(st, h, h.q, px * (1 - FEE)); S.coins += r.ret; logTx('⚠️ 停損', `${st.name} 停損平倉`, r.ret); setTimeout(() => toast(`⚠️ 【停損觸發】${st.name} 已自動平倉，拿回 ${r.ret} 🪙`), 200); return true; }
        return false;
    }
    function riskScan() {
        const now = Date.now(), ids = Object.keys(S.stocks); let t = S.lastRisk > 0 ? Math.max(S.lastRisk, now - 7 * 864e5) : now, hit = false; S.lastRisk = now;
        for (; ids.length && t <= now; t += 60000) ids.forEach(id => { const st = STOCKS.find(x => x.id === id); if (st && S.stocks[id] && riskCheck(st, price(st, Math.min(t, now)))) hit = true; });
        if (hit) changed(); else save();
    }

    const RANGES = { '1h': [60, '1 小時'], '6h': [360, '6 小時'], '1d': [1440, '1 天'], '7d': [10080, '7 天'] };
    const CAND = { '1h': 30, '6h': 36, '1d': 48, '7d': 42 };
    
    function candles(st) {
        const mins = RANGES[range][0], N = CAND[range], span = mins * 60000 / N, nowT = Date.now(), endT = Math.ceil(nowT / span) * span, out = [];
        for (let i = 0; i < N; i++) {
            const t0 = endT - (N - i) * span; if (t0 > nowT) break;
            const K = 10, pts = []; for (let k = 0; k <= K; k++) pts.push(price(st, Math.min(nowT, t0 + span * k / K)));
            out.push({ t: t0, o: pts[0], c: pts[K], h: Math.max(...pts), l: Math.min(...pts) });
        }
        return out;
    }
    const fmtT = t => { const d = new Date(t), z = n => String(n).padStart(2, '0'); return range === '7d' ? `${d.getMonth() + 1}/${d.getDate()} ${z(d.getHours())}時` : `${z(d.getHours())}:${z(d.getMinutes())}`; };
    
    function bigChart(st) {
        const cs = candles(st), W = 360, H = 200, L = 42, R = 8, T = 10, B = 172, N = CAND[range];
        let hi = Math.max(...cs.map(c => c.h)), lo = Math.min(...cs.map(c => c.l)); const pad = (hi - lo) * .06 || 1; hi += pad; lo -= pad;
        const Y = v => T + (1 - (v - lo) / (hi - lo)) * (B - T), step = (W - L - R) / N, cw = Math.max(2, step * .62), X = i => L + step * (i + .5);
        const sel = cs.find(c => c.t === selT) || cs[cs.length - 1];
        let g = ''; for (let k = 0; k <= 2; k++) { const v = lo + (hi - lo) * k / 2, y = Y(v); g += `<line x1="${L}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#4f6bff" stroke-opacity=".35" stroke-dasharray="3 3"/><text x="${L - 4}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="8.5" fill="#9aa4c0">${v.toFixed(1)}</text>`; }
        const xl = [0, Math.floor(cs.length / 2), cs.length - 1].map((i, k) => cs[i] ? `<text x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="${k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}" font-size="8.5" fill="#9aa4c0">${fmtT(cs[i].t)}</text>` : '').join('');
        let body = '';
        cs.forEach((c, i) => {
            const up = c.c >= c.o, col = up ? '#ef4444' : '#22c55e', x = X(i), yo = Y(c.o), yc = Y(c.c);
            if (c.t === sel.t) body += `<rect x="${(x - step / 2).toFixed(1)}" y="${T}" width="${step.toFixed(1)}" height="${B - T}" fill="#fff" opacity=".12"/>`;
            body += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${Y(c.h).toFixed(1)}" y2="${Y(c.l).toFixed(1)}" stroke="${col}" stroke-width="1.2"/><rect x="${(x - cw / 2).toFixed(1)}" y="${Math.min(yo, yc).toFixed(1)}" width="${cw.toFixed(1)}" height="${Math.max(1.4, Math.abs(yo - yc)).toFixed(1)}" fill="${col}"/>`;
            body += `<rect data-c="${c.t}" x="${(x - step / 2).toFixed(1)}" y="${T}" width="${step.toFixed(1)}" height="${B - T}" fill="transparent"/>`;
        });
        const chg = (sel.c / sel.o - 1) * 100;
        const info = `<div class="eco-ohlc"><b>${fmtT(sel.t)}</b><span>開 ${sel.o.toFixed(1)}</span><span>高 ${sel.h.toFixed(1)}</span><span>低 ${sel.l.toFixed(1)}</span><span>收 ${sel.c.toFixed(1)}</span><span class="${chg >= 0 ? 'eco-up' : 'eco-dn'}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</span></div>`;
        return `<div class="eco-kwrap"><svg viewBox="0 0 ${W} ${H}" class="eco-big">${g}${body}${xl}</svg>${info}</div>`;
    }

    function trade(id, side, qty, leverage = 1, stopLoss = 0) {
        const st = STOCKS.find(s => s.id === id); if (!st) return;
        riskScan();   // 先把爆倉／停損結算到現在，避免對已經被清掉的持倉下單
        qty = qtyOf(qty);
        const baseP = price(st);
        if (side === 'buy') {
            const cur = S.stocks[id];
            if (cur && cur.q > 0 && (cur.lev || 1) !== leverage) { leverage = cur.lev || 1; toast(`已有持倉，槓桿沿用 ${leverage}x（要換槓桿請先全部賣出）`); }
            leverage = Math.max(1, Math.min(Math.floor(leverage) || 1, maxLev(st)));
            stopLoss = stopLoss > 0 && isFinite(stopLoss) ? stopLoss : 0;
            if (stopLoss >= baseP) return toast(`停損價要低於現價（現價 ${baseP.toFixed(2)}），否則買進後會立刻被停損`);
            const entry = baseP, margin = marginFor(baseP, qty, leverage);
            if (!isFinite(margin)) return toast('數量太大了！');
            if (S.coins < margin) return toast(`金幣不足！需要保證金 ${margin.toLocaleString()} 🪙，你只有 ${Math.floor(S.coins).toLocaleString()} 🪙`);
            S.coins -= margin;
            const h = cur || { q: 0, cost: 0, ep: 0, lev: leverage, sl: 0 }, ep0 = h.q > 0 ? entryOf(h) : 0;
            h.ep = (ep0 * h.q + entry * qty) / (h.q + qty); h.q += qty; h.cost += margin; h.lev = leverage; h.sl = stopLoss;
            S.stocks[id] = h; S.lastRisk = Date.now();
            logTx('📈 買進', `${st.name} ${qty.toLocaleString()} 單位（${leverage}x）`, -margin);
            changed(); toast(`📈 [${leverage}x槓桿] 買進 ${st.name} ${qty.toLocaleString()} 單位，進場價約 ${entry.toFixed(2)}，保證金 ${margin.toLocaleString()} 🪙`);
        } else {
            const h = S.stocks[id]; if (!h || h.q <= 0) return toast('你沒有持有此資產');
            qty = Math.min(qty, h.q);
            const r = settle(st, h, qty, baseP);
            S.coins += r.ret; logTx('💵 賣出', `${st.name} ${qty.toLocaleString()} 單位（稅 ${(r.stamp + r.cgt).toLocaleString()}）`, r.ret); changed();
            toast(`💵 賣出 ${st.name} ${qty.toLocaleString()} 單位，拿回 ${r.ret.toLocaleString()} 🪙（證交稅 ${r.stamp.toLocaleString()}、資本利得稅 ${r.cgt.toLocaleString()}）`);
        }
    }

    function spark(st) {
        const now = Date.now(), pts = []; for (let k = 60; k >= 0; k -= 2) pts.push(price(st, now - k * 60000));
        const mn = Math.min(...pts), mx = Math.max(...pts), rg = mx - mn || 1;
        const d = pts.map((v, i) => `${(i / (pts.length - 1) * 100).toFixed(1)},${(22 - (v - mn) / rg * 20).toFixed(1)}`).join(' ');
        const up = pts[pts.length - 1] >= pts[0];
        return `<svg viewBox="0 0 100 24" preserveAspectRatio="none" class="eco-spark"><polyline fill="none" stroke="${up ? '#dc2626' : '#16a34a'}" stroke-width="2" points="${d}"/></svg>`;
    }

    let sliding = false, ov = null, tab = 'shop', marketSubTab = 'stock', detailFrom = 'market', timer = null, sel = null, range = '1d', qty = 1, selT = 0, currentLev = 1, stopLossVal = '', showBk = false;
    const css = `
.eco-ov{position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:10px}
.eco-box{background:var(--card,#fff);color:var(--text,#111);width:min(96vw,680px);height:78vh;max-height:78vh;border-radius:18px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px #0007}
.eco-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:10px 12px;border-bottom:1px solid var(--border,#ddd);flex-shrink:0}
.eco-head .bal{font-weight:900;font-size:16px;white-space:nowrap}
.eco-head .bal{flex:1}.eco-tabs{order:3;flex:1 1 100%;display:flex;gap:4px;justify-content:center;overflow-x:auto;white-space:nowrap;scrollbar-width:none}
.eco-tabs::-webkit-scrollbar{display:none}
.eco-tabs button,.eco-x,.eco-b{border:none;border-radius:10px;padding:5px 10px;font-weight:700;font-size:13px;cursor:pointer;background:var(--surface,#eee);color:var(--text,#111);white-space:nowrap}
.eco-tabs button.on{background:#f59e0b;color:#fff}
.eco-x{padding:5px 10px}
.eco-body{overflow-y:auto;overflow-x:hidden;flex:1;padding:10px 12px;display:flex;flex-direction:column;gap:10px}
.eco-note{font-size:12px;color:var(--muted,#666);line-height:1.5}
.eco-h{font-weight:800;margin-top:6px}
.eco-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
.eco-it{border:1px solid var(--border,#ddd);border-radius:12px;padding:8px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;background:var(--surface,#f7f7f7)}
.eco-it .ic{font-size:30px;line-height:36px;height:36px;display:flex;align-items:center}
.eco-it .sw{width:54px;height:36px;border-radius:8px;border:2px solid #8b5a2b}
.eco-it .nm{font-size:13px;font-weight:700}
.eco-it .pr{font-size:12px;color:var(--muted,#666)}
.eco-b{background:#16a34a;color:#fff;font-size:13px;padding:5px 10px}
.eco-b:disabled{opacity:.45;cursor:default}
.eco-b.alt{background:#64748b}.eco-b.sell{background:#dc2626}.eco-b.on{background:#f59e0b}
.eco-st{border:1px solid var(--border,#ddd);border-radius:12px;padding:8px;display:grid;grid-template-columns:1fr 90px;gap:4px 8px;align-items:center;background:var(--surface,#f7f7f7)}
.eco-st .l b{font-size:14px}.eco-st .l small{color:var(--muted,#666);margin-left:4px}
.eco-spark{width:90px;height:34px}
.eco-up{color:#dc2626;font-weight:800}.eco-dn{color:#16a34a;font-weight:800}
.eco-st .hold{grid-column:1/3;font-size:12px;color:var(--muted,#666);display:flex;justify-content:flex-start;gap:12px;align-items:center;margin-top:2px}
#eco-toast{position:fixed;left:50%;top:14px;transform:translate(-50%,-20px);z-index:2200;background:#111c;color:#fff;padding:8px 16px;border-radius:999px;font-weight:700;font-size:14px;opacity:0;pointer-events:none;transition:.25s;max-width:92vw;text-align:center}
#eco-toast.on{opacity:1;transform:translate(-50%,0)}
.eco-hb{display:grid;grid-template-columns:34px 1fr 52px;gap:6px;align-items:center;font-size:12px}.eco-hb .bar{height:12px;border-radius:6px;background:var(--surface,#e5e7eb);overflow:hidden}.eco-hb .bar i{display:block;height:100%}.eco-hb b{text-align:right}
.eco-st.click{cursor:pointer}
.eco-go{color:#f59e0b;font-weight:800;cursor:pointer;position:relative;z-index:10;pointer-events:auto;}
.eco-kwrap{background:#0b1020;border-radius:12px;padding:6px 6px 8px;display:flex;flex-direction:column;gap:4px}
.eco-big{width:100%;height:auto;display:block}
.eco-ohlc{display:flex;gap:8px;flex-wrap:wrap;font-size:12px;color:#e5e7eb;padding:2px 4px;border-top:1px solid #ffffff22}.eco-ohlc b{color:#fde047}
.eco-price{font-size:18px;font-weight:900}.eco-price small{font-weight:400;color:var(--muted,#666);font-size:11px}
.eco-tabs2{display:flex;gap:6px}.eco-tabs2 button{flex:1;border:none;border-radius:8px;padding:5px 0;font-weight:700;cursor:pointer;background:var(--surface,#eee);color:var(--text,#111)}.eco-tabs2 button.on{background:#f59e0b;color:#fff}
.eco-box2{border:1px solid var(--border,#ddd);border-radius:12px;padding:8px 10px;display:flex;flex-direction:column;gap:6px;font-size:13px}
.eco-qrow{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.eco-qty,.eco-tf{width:80px;text-align:center;padding:5px;border-radius:8px;border:1px solid var(--border,#ccc);font-size:15px}
.eco-news-ticker{background:#1e293b;color:#f8fafc;padding:8px 12px;border-radius:10px;font-size:12px;display:flex;align-items:center;gap:8px;box-shadow:inset 0 1px 3px rgba(0,0,0,0.3);cursor:pointer;transition:background .2s;}
.eco-news-ticker:hover{background:#334155;}
.eco-modal{position:absolute;inset:0;background:rgba(0,0,0,0.6);z-index:2300;display:flex;align-items:center;justify-content:center;padding:20px;}
.eco-modal-box{background:var(--card,#fff);color:var(--text,#111);width:100%;max-width:420px;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 10px 30px rgba(0,0,0,0.5);}
#eco-fab{position:fixed;top:8px;right:8px;z-index:1900;background:#fef3c7;color:#92400e;border:2px solid #f59e0b;border-radius:999px;padding:3px 12px;font-weight:900;font-size:14px;box-shadow:0 2px 8px #0004;cursor:pointer;display:flex;gap:4px;align-items:center}
.eco-subtabs{display:flex;gap:4px;background:var(--surface,#eee);padding:3px;border-radius:10px}
.eco-subtabs button{flex:1;border:none;border-radius:8px;padding:6px 0;font-weight:700;font-size:12px;cursor:pointer;background:transparent;color:var(--text,#111)}
.eco-subtabs button.on{background:var(--card,#fff);color:#f59e0b;box-shadow:0 2px 4px rgba(0,0,0,0.1)}
.eco-wallet-card{background:var(--surface,#f1f5f9);border:1px solid var(--border,#cbd5e1);color:var(--text,#1e293b);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
.eco-wallet-title{font-size:12px;color:var(--muted,#64748b);font-weight:700}
.eco-wallet-num{font-size:24px;font-weight:900;color:var(--heading,#0f172a)}
.eco-wallet-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px}
.eco-wallet-subbox{background:var(--card,#fff);border:1px solid var(--border,#e2e8f0);border-radius:8px;padding:8px;display:flex;flex-direction:column}`;
    const st0 = document.createElement('style'); st0.textContent = css; document.head.appendChild(st0);

    function shopHtml() {
        const sec = (title, cat) => `<div class="eco-h">${title}</div><div class="eco-grid">${allItems().filter(i => i.cat === cat).map(it => {
            const have = owned(it.id), on = cat !== 'chat' && S.equip[cat] === it.ref;
            const btn = !have ? `<button class="eco-b" data-buy="${it.id}" ${S.coins < it.price ? 'disabled' : ''}>購買</button>`
                : cat === 'chat' ? '<button class="eco-b alt" disabled>已擁有</button>'
                    : on ? '<button class="eco-b on" disabled>使用中</button>' : `<button class="eco-b alt" data-eq="${cat}:${it.ref}">裝備</button>`;
            const sub = cat === 'chat' ? `<div class="eco-note">${esc(it.list.join('、'))}</div>` : '';
            return `<div class="eco-it"><div class="ic">${it.sw ? `<span class="sw" style="background:${it.sw}"></span>` : it.icon}</div><div class="nm">${esc(it.name)}</div>${sub}<div class="pr">${it.price ? '🪙 ' + it.price : have ? '免費' : ''}</div>${btn}</div>`;
        }).join('')}</div>`;
        const luxSec = () => `<div class="eco-h">💎 富豪精品（有錢人專屬，一千萬起）</div><div class="eco-note">買了會放進「我的帳戶 → 收藏櫃」展示，也算資產（以轉售價 ${Math.round(LUX_RESALE * 100)}% 計入淨值與資產稅），想換回現金可以轉售。</div><div class="eco-grid">${LUX.map(l => `<div class="eco-it"><div class="ic">${l.e}</div><div class="nm">${esc(l.name)}</div><div class="eco-note">${esc(l.desc)}</div><div class="pr">🪙 ${l.price.toLocaleString()}</div>${S.items[l.id] ? `<button class="eco-b alt" data-sell-lux="${l.id}">已擁有・轉售 ${Math.round(l.price * LUX_RESALE).toLocaleString()}</button>` : `<button class="eco-b" data-buy="${l.id}" ${S.coins < l.price ? 'disabled' : ''}>購買</button>`}</div>`).join('')}</div>`;
        return `<div class="eco-note">💡 地獄難度警示：價格零保底隨機遊走，開高槓桿若遇逆勢將直接「強制爆倉」！</div>
            ${sec('🎯 麻將投擲物', 'throw')}${sec('🪑 牌桌主題', 'felt')}${sec('💬 麻將快捷語包', 'chat')}${luxSec()}`;
    }

    const pct = (a, b) => `<span class="${a >= b ? 'eco-up' : 'eco-dn'}">${a >= b ? '▲' : '▼'} ${Math.abs((a / b - 1) * 100).toFixed(1)}%</span>`;

    function marketHtml() {
        if (sel) return detailHtml(STOCKS.find(x => x.id === sel));
        
        updateMarketNews();
        const ev0 = activeNews.ref, tc = ev0 ? (ev0.tag === '利多' ? '#fca5a5' : ev0.tag === '利空' ? '#86efac' : '#e2e8f0') : '#fde047';
        const ticker = `<div class="eco-news-ticker" data-open-news="1"><span>📰 <b>即時快訊：</b></span><span style="color:${tc}; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ev0 ? tagIcon(ev0) + ' ' : ''}${activeNews.title}</span><span style="opacity:.6;font-size:11px;white-space:nowrap;">詳情 ›</span></div>`;
        
        const subTabs = `<div class="eco-subtabs">
            <button class="${marketSubTab === 'stock' ? 'on' : ''}" data-msub="stock">📊 股票</button>
            <button class="${marketSubTab === 'fund' ? 'on' : ''}" data-msub="fund">🏛️ 基金/配息</button>
            <button class="${marketSubTab === 'crypto' ? 'on' : ''}" data-msub="crypto">🪙 幣圈(高風險)</button>
        </div>`;

        const list = STOCKS.filter(s => s.cat === marketSubTab);
        
        const rows = list.map(st => {
            const p = price(st), p0 = price(st, Date.now() - 3600000), h = S.stocks[st.id];
            const hold = h ? `持有 ${h.q} 單位 (${h.lev}x)・市值 ${Math.floor(equityOf(h, p))} 🪙` : '尚未持有';
            return `<div class="eco-st click" data-sel="${st.id}"><div class="l"><b>${st.id}</b><small>${esc(st.name)}</small>${(() => { const iv = impactOf(activeNews.ref, st); return iv ? `<span style="font-size:11px;font-weight:800;color:${iv > 0 ? '#dc2626' : '#16a34a'}"> 📰${iv > 0 ? '▲' : '▼'}</span>` : ''; })()}<div><b>🪙 ${p.toFixed(1)}</b> ${pct(p, p0)} <small>近 1 小時</small></div></div>${spark(st)}<div class="hold">${hold} <span class="eco-go" data-sel="${st.id}">詳細資料 ›</span></div></div>`;
        }).join('');
        
        let modalHtml = '';
        if (showNewsModal) {
            const ev = activeNews.ref || NEWS_EVENTS[6], aff = newsAffected(ev), tcol = ev.tag === '利多' ? '#dc2626' : ev.tag === '利空' ? '#16a34a' : '#64748b';
            const chips = aff.length ? aff.slice(0, 8).map(x => `<span data-gotosel="${x.st.id}" style="cursor:pointer;font-size:12px;font-weight:800;padding:3px 8px;border-radius:999px;color:#fff;background:${x.v > 0 ? '#dc2626' : '#16a34a'}">${x.v > 0 ? '▲' : '▼'} ${x.st.id}</span>`).join('') + (aff.length > 8 ? `<span class="eco-note">…等 ${aff.length} 檔</span>` : '') : '<span class="eco-note">沒有特別點名的標的</span>';
            const hist = newsHistory(7).slice(1).map(h => `<div style="display:flex;gap:6px;font-size:12px;line-height:1.5;"><span style="color:var(--muted,#666);white-space:nowrap">${fmtHM(h.t)}</span><span style="flex:1">${tagIcon(h.ev)} ${h.ev.title}</span></div>`).join('');
            modalHtml = `<div class="eco-modal" data-close-news="1">
                <div class="eco-modal-box" style="max-height:80%;overflow-y:auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <b style="font-size:16px;">📰 商業焦點新聞</b>
                        <button class="eco-x" data-close-news="1">✕</button>
                    </div>
                    <div><span style="color:#fff;background:${tcol};font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;">${ev.tag}</span> <span style="font-size:11px;color:var(--muted,#666);">${activeNews.time} 發布・每 ${NEWS_MIN} 分鐘更新</span></div>
                    <div style="font-weight:bold; color:#f59e0b; font-size:14px;">${activeNews.title}</div>
                    <div class="eco-note" style="line-height:1.6; font-size:13px;">${activeNews.detail}</div>
                    <div><div class="eco-h" style="margin-top:0;font-size:13px;">受影響標的（點擊直接查看）</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">${chips}</div></div>
                    <div style="background:var(--surface,#f1f5f9);border-radius:8px;padding:8px 10px;font-size:12px;line-height:1.5;">💡 <b>操盤提示：</b>${ev.tip}</div>
                    <div><div class="eco-h" style="margin-top:0;font-size:13px;">近期新聞</div>${hist}</div>
                    <button class="eco-b" data-close-news="1" style="margin-top:4px;">了解，關閉視窗</button>
                </div>
            </div>`;
        }

        return `${ticker}${subTabs}<div class="eco-note">市場波動受新聞影響，買進收 2% 手續費，賣出另扣證交稅與資本利得稅；下單照市價成交，沒有大單滑價。</div>${rows}${modalHtml}`;
    }

    let FOLD = Object.assign({ inbox: 1, log: 0, lux: 1 }, jparse(localStorage.getItem('vk_eco_fold')) || {}), logLimit = 30;
    const saveFold = () => { try { localStorage.setItem('vk_eco_fold', JSON.stringify(FOLD)); } catch (e) { } };
    const foldBox = (key, title, badge, inner) => `<div class="eco-box2" style="margin-top:6px;" data-foldbox="${key}"><div data-fold="${key}" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-weight:800;"><span>${title}${badge ? ` <span style="background:#dc2626;color:#fff;border-radius:999px;padding:0 7px;font-size:11px;">${badge}</span>` : ''}</span><span style="font-size:12px;color:var(--muted,#666);">${FOLD[key] ? '▾ 收合' : '▸ 展開'}</span></div>${FOLD[key] ? inner : ''}</div>`;
    function inboxInner() {
        const parts = [], sum = S.inbox.reduce((a, x) => a + x.amt, 0);
        if (S.inbox.length > 1) parts.push(`<button class="eco-b" data-sign-all="1" style="padding:8px;">全部簽收（${S.inbox.length} 筆，共 🪙 ${sum.toLocaleString()}）</button>`);
        S.inbox.forEach(x => parts.push(`<div class="eco-box2" style="border-color:#16a34a;"><div style="font-weight:800;">📬 收到轉帳　🪙 ${x.amt.toLocaleString()}</div><div class="eco-note">來自「${esc(x.from)}」・${fmtDT(x.t)}</div><button class="eco-b" data-sign="${esc(x.id)}" style="padding:6px 12px;">簽收入帳</button></div>`));
        const b = bk(), owe = Math.ceil(b.loan);
        if (owe > 0) {
            const late = isLate(), left = b.due - Date.now(), d = Math.floor(left / 864e5), h = Math.floor(left % 864e5 / 36e5), urgent = late || left < 864e5;
            parts.push(`<div class="eco-box2" style="border-color:${urgent ? '#dc2626' : '#f59e0b'};"><div style="font-weight:800;color:${urgent ? '#dc2626' : 'inherit'};">🏦 貸款待還　🪙 ${owe.toLocaleString()}</div><div class="eco-note">${late ? '⚠️ 已逾期！銀行會強制扣款，每日利息 ' + (BANK.late * 100).toFixed(0) + '%' : `還款期限 ${fmtDT(b.due)}（剩 ${d} 天 ${h} 小時）`}・手上金幣 🪙 ${Math.floor(S.coins).toLocaleString()}</div><div style="display:flex;gap:6px;"><button class="eco-b" data-bank="repay-all" style="flex:1;padding:6px;">全額還款</button><button class="eco-b alt" data-bank="repay-half" style="flex:1;padding:6px;">還一半</button></div></div>`);
        }
        return parts.length ? `<div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;">${parts.join('')}</div>` : '<div class="eco-note" style="margin-top:6px;">目前沒有新通知。收到好友轉帳、貸款快到期時會顯示在這裡。</div>';
    }
    function logInner() {
        if (!S.log.length) return '<div class="eco-note" style="margin-top:6px;">還沒有交易記錄。</div>';
        const rows = S.log.slice(0, logLimit).map(x => `<div style="display:flex;gap:6px;font-size:12px;align-items:center;border-bottom:1px solid var(--border,#eee);padding:5px 0;"><span style="color:var(--muted,#666);white-space:nowrap;font-size:11px;">${fmtDT(x.t)}</span><span style="flex:1;line-height:1.4;">${esc(x.k)} ${esc(x.x)}</span><b class="${x.a >= 0 ? 'eco-up' : 'eco-dn'}" style="white-space:nowrap;">${x.a > 0 ? '+' : ''}${x.a.toLocaleString()}</b></div>`).join('');
        return `<div style="margin-top:6px;">${rows}</div>${S.log.length > logLimit ? `<button class="eco-b alt" data-logmore="1" style="margin-top:6px;padding:6px;">顯示更多（還有 ${S.log.length - logLimit} 筆）</button>` : ''}`;
    }
    function luxInner() {
        const o = luxOwned();
        return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px;margin-top:6px;">${o.map(l => `<div class="eco-it"><div class="ic">${l.e}</div><div class="nm">${esc(l.name)}</div><div class="pr">價值 ${Math.round(l.price * LUX_RESALE).toLocaleString()}</div></div>`).join('')}</div><div class="eco-note" style="margin-top:4px;">收藏總值（轉售價）🪙 ${luxVal().toLocaleString()}，已計入淨值與資產稅。到商店可轉售。</div>`;
    }
    function accountHtml() {
        let totalInvestment = 0;
        let totalCost = 0;
        
        const categories = [
            { key: 'stock', name: '📈 股票持股明細' },
            { key: 'fund', name: '🏛️ 基金持股明細' },
            { key: 'crypto', name: '🪙 虛擬貨幣持股明細' }
        ];

        let sectionsHtml = '';

        categories.forEach(cat => {
            const catStocks = STOCKS.filter(st => st.cat === cat.key);
            let catRows = '';

            catStocks.forEach(st => {
                const h = S.stocks[st.id];
                if (!h) return;
                const curP = price(st);
                const val = Math.floor(equityOf(h, curP));
                totalInvestment += val;
                totalCost += h.cost;
                const pl = val - h.cost;
                
                catRows += `<div class="eco-st click" data-gotosel="${st.id}">
                    <div class="l" data-gotosel="${st.id}">
                        <b data-gotosel="${st.id}">${st.id}</b><small data-gotosel="${st.id}">${esc(st.name)}</small>
                        <div data-gotosel="${st.id}">持有 ${h.q} 單位 (${h.lev}x)・成本 ${Math.round(h.cost)} ${h.sl ? '・停損: ' + h.sl : ''}</div>
                    </div>
                    <div style="text-align:right;" data-gotosel="${st.id}">
                        <b data-gotosel="${st.id}">🪙 ${val}</b>
                        <div class="${pl >= 0 ? 'eco-up' : 'eco-dn'}" style="font-size:11px;" data-gotosel="${st.id}">${pl >= 0 ? '+' : ''}${Math.round(pl)}</div>
                    </div>
                    <div class="hold" data-gotosel="${st.id}">
                        <span class="eco-go" data-gotosel="${st.id}">查看詳情 ›</span>
                    </div>
                </div>`;
            });

            sectionsHtml += `<div class="eco-h">${cat.name}</div>`;
            if (catRows) {
                sectionsHtml += catRows;
            } else {
                sectionsHtml += `<div class="eco-note">目前未持有此類別資產。</div>`;
            }
        });

        const taxInfo = getNextTaxAmount();
        const bkb2 = bk(), totalNetWorth = S.coins + totalInvestment + luxVal() + Math.floor(bkb2.dep) - Math.ceil(bkb2.loan);
        const totalPL = Math.round(totalInvestment - totalCost);

        const nc = notifCount();
        return `${nc ? `<div class="eco-box2" data-jump="inbox" style="border-color:#f59e0b;background:#fffbeb;color:#92400e;cursor:pointer;margin-bottom:6px;"><b>🔔 你有 ${nc} 則通知</b>（轉帳待簽收／貸款提醒）<span style="float:right;">查看 ›</span></div>` : ''}${S.coins < 0 ? `<div class="eco-box2" style="border-color:#dc2626;background:#fef2f2;color:#991b1b;margin-bottom:6px;"><b>⚠️ 你目前負債 🪙 ${(-S.coins).toLocaleString()}</b><div style="font-size:12px">手上金幣為負數時，每天會加 ${(BANK.debt * 100).toFixed(0)}% 透支利息，而且不能買東西。銀行有存款會自動補上；也可以到「🏦 銀行」借款來還。</div></div>` : ''}<div class="eco-wallet-card">
            <div class="eco-wallet-title">帳戶總資產淨值 (Net Worth)</div>
            <div class="eco-wallet-num">🪙 ${totalNetWorth}</div>
            <div class="eco-wallet-grid">
                <div class="eco-wallet-subbox"><span>可用金幣</span><b>🪙 ${S.coins}</b></div>
                <div class="eco-wallet-subbox"><span>銀行存款（免稅）</span><b>🪙 ${Math.floor(bkb2.dep).toLocaleString()}${bkb2.loan > 0 ? '　貸款 −' + Math.ceil(bkb2.loan).toLocaleString() : ''}</b></div>
                <div class="eco-wallet-subbox"><span>投資總市值</span><b>🪙 ${totalInvestment} (${totalPL >= 0 ? '+' : ''}${totalPL})</b></div>
            </div>
            <div style="margin-top:6px; font-size:12px; color:#dc2626; font-weight:700;">
                🏛️ 下期預估稅額：🪙 ${taxInfo.taxDue.toLocaleString()} (最高累進稅率 ${taxInfo.taxRate * 100}%，總統稅率倍率 ×${taxMult})
            </div>
        </div>

        <div class="eco-box2" style="margin-top:6px;">
            <div style="font-weight:800;">💸 好友轉帳系統</div>
            <div class="eco-note">轉帳給其他線上好友：</div>
            <div style="display:flex; gap:6px; margin-top:2px; flex-wrap:wrap;">
                <input type="text" id="eco-transfer-to" placeholder="好友名稱（對方要設過暱稱）" class="eco-tf" enterkeyhint="next" autocomplete="off" style="flex:1; text-align:left; padding:6px 10px; width:auto;">
                <input type="number" id="eco-transfer-amt" placeholder="金額" class="eco-tf" inputmode="numeric" enterkeyhint="done" style="width:90px; padding:6px 10px;" min="1">
                <button class="eco-b" data-action="transfer" style="padding:6px 14px;">確認轉帳</button>
            </div>
        </div>

        <div class="eco-box2" style="margin-top:6px;">
            <div style="font-weight:800;">💾 存檔備份與救援</div>
            <div class="eco-note">自動備份 ${backups().length} 份（每 15 分鐘一份，最多 8 份）。存檔出問題時可以還原。</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="eco-b" data-bk="toggle" style="padding:6px 12px;">${showBk ? '收起' : '查看／還原舊存檔'}</button>
                <button class="eco-b alt" data-bk="export" style="padding:6px 12px;">匯出存檔</button>
                <button class="eco-b alt" data-bk="import" style="padding:6px 12px;">匯入存檔</button>
            </div>
            ${showBk ? bkListHtml() : ''}
        </div>

        ${sectionsHtml}
        ${luxOwned().length ? foldBox('lux', '💎 收藏櫃（' + luxOwned().length + ' 件）', 0, luxInner()) : ''}
        ${foldBox('inbox', '🔔 通知欄（轉帳簽收・還款提醒）', notifCount(), inboxInner())}
        ${foldBox('log', '🧾 交易記錄', 0, logInner())}`;
    }

    function tradeCalc(st) {   // 畫面上所有買賣數字都從這裡算，和 trade() 用同一套公式
        const p = price(st), h = S.stocks[st.id], q = qtyOf(qty);
        const lev = h ? (h.lev || 1) : Math.max(1, Math.min(currentLev, maxLev(st)));
        const marginCost = marginFor(p, q, lev), maxBuy = maxAffordable(p, lev);
        const sq = h ? Math.min(q, h.q) : 0, get = h ? settleCalc(st, h, sq, p).ret : 0;
        return { p, h, q, lev, marginCost, maxBuy, get };
    }
    function updateTradeBox() {   // 輸入數量／拉槓桿時只更新數字，不重畫整個畫面（重畫會讓按鈕在點擊中途被換掉，造成「按了沒反應」）
        if (!ov || !sel) return;
        const st = STOCKS.find(x => x.id === sel); if (!st) return;
        const c = tradeCalc(st), set = (sl, fn) => { const el = ov.querySelector(sl); if (el) fn(el); };
        set('.eco-lev-val', el => el.textContent = c.lev + 'x');
        set('.eco-margin-val', el => el.textContent = c.marginCost.toLocaleString() + ' 🪙');
        set('.eco-get-val', el => el.textContent = (c.h ? c.get.toLocaleString() : '—') + (c.h ? ' 🪙' : ''));
        set('.eco-maxbuy', el => { el.dataset.qset = c.maxBuy; el.textContent = `最多可買 ${c.maxBuy.toLocaleString()} 單位`; el.disabled = c.maxBuy < 1; });
        set('[data-do="buy"]', el => { el.textContent = `買進 ${c.q.toLocaleString()} 單位`; el.disabled = S.coins < c.marginCost; });
        set('[data-do="sell"]', el => { el.textContent = `賣出 ${c.q.toLocaleString()} 單位`; });
    }

    function detailHtml(st) {
        const { p, h, q, lev, marginCost, maxBuy, get } = tradeCalc(st);
        
        let hold = '<div class="eco-box2"><b>我的持股</b><div class="eco-note">尚未持有</div></div>';
        if (h) {
            const val = equityOf(h, p), mx = Math.max(val, h.cost) || 1, win = val >= h.cost;
            hold = `<div class="eco-box2"><b>我的持股 <small>${h.q} 單位 (${h.lev}x 槓桿)</small></b>
                <div class="eco-hb"><small>成本</small><div class="bar"><i style="width:${(h.cost / mx * 100).toFixed(1)}%;background:#64748b"></i></div><b>${Math.round(h.cost)}</b></div>
                <div class="eco-hb"><small>市值</small><div class="bar"><i style="width:${(val / mx * 100).toFixed(1)}%;background:${win ? '#ef4444' : '#22c55e'}"></i></div><b>${Math.round(val)}</b></div>
                <div class="${win ? 'eco-up' : 'eco-dn'}" style="text-align:right">${win ? '+' : ''}${Math.round(val - h.cost)} 🪙（${((val / h.cost - 1) * 100).toFixed(1)}%）</div>
                ${h.sl ? `<div style="font-size:11px; color:#dc2626; margin-top:2px;">⚠️ 停損價：<b>${h.sl}</b></div>` : ''}${(h.lev || 1) > 1 ? `<div style="font-size:11px; color:#dc2626; margin-top:2px;">💥 爆倉價：<b>${(entryOf(h) * (1 - 0.85 / h.lev)).toFixed(2)}</b>（進場均價 ${entryOf(h).toFixed(2)}）</div>` : ''}</div>`;
        }
        
        return `<button class="eco-b alt" data-back="1" style="align-self:flex-start">‹ 返回股市列表</button>
            <div><b style="font-size:18px">${st.id}</b> <span>${esc(st.name)}</span><div class="eco-note">${esc(st.desc)}</div></div>
            <div class="eco-price">🪙 ${p.toFixed(2)} ${pct(p, price(st, Date.now() - 3600000))}<small> 近 1 小時</small></div>
            <div class="eco-tabs2">${Object.entries(RANGES).map(([k, v]) => `<button class="${k === range ? 'on' : ''}" data-range="${k}">${v[1]}</button>`).join('')}</div>
            ${bigChart(st)}
            ${hold}
            <div class="eco-box2" style="gap:8px;">
                <div style="font-weight:800; display:flex; align-items:center; gap:4px;">💱 槓桿滑桿與停損交易</div>
                
                <div style="display:flex; flex-direction:column; gap:4px; font-size:12px; background:var(--surface,#f1f5f9); padding:8px; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; font-weight:bold;">
                        <span>槓桿倍數：</span>
                        <span style="color:#f59e0b; font-size:14px;" class="eco-lev-val">${lev}x</span>
                    </div>
                    <input type="range" min="1" max="${maxLev(st)}" step="1" value="${lev}" class="eco-lev-slider" ${h ? 'disabled' : ''} style="width:100%; cursor:pointer; accent-color:#f59e0b;">
                    ${h ? '<div class="eco-note">已有持倉，槓桿固定為 ' + lev + 'x（要換槓桿請先全部賣出）</div>' : ''}
                </div>

                <div style="display:flex; gap:6px; align-items:center; font-size:12px;">
                    <span>停損價格：</span>
                    <input class="eco-qty eco-sl-input" type="number" step="0.1" value="${stopLossVal !== '' ? stopLossVal : (h && h.sl ? h.sl : '')}" placeholder="空白不設定" style="flex:1; width:auto;">
                    <button class="eco-b alt" data-sl-clear style="padding:4px 8px; font-size:11px;">清除停損</button>
                </div>
                
                <div class="eco-qrow" style="justify-content:center;">
                    <button style="background:transparent; border:none; font-weight:700; cursor:pointer; padding:6px; flex:1; text-align:center; color:var(--text,#111);" data-q="-10">-10</button>
                    <button style="background:transparent; border:none; font-weight:700; cursor:pointer; padding:6px; flex:1; text-align:center; color:var(--text,#111);" data-q="-1">-1</button>
                    <input class="eco-qty" type="number" min="1" inputmode="numeric" value="${q}" style="width:65px;">
                    <button style="background:transparent; border:none; font-weight:700; cursor:pointer; padding:6px; flex:1; text-align:center; color:var(--text,#111);" data-q="1">+1</button>
                    <button style="background:transparent; border:none; font-weight:700; cursor:pointer; padding:6px; flex:1; text-align:center; color:var(--text,#111);" data-q="10">+10</button>
                </div>

                <div class="eco-qrow">
                    <button class="eco-b alt eco-maxbuy" data-qset="${maxBuy}" ${maxBuy < 1 ? 'disabled' : ''} style="flex:1; padding:6px 4px; font-size:12px;">最多可買 ${maxBuy.toLocaleString()} 單位</button>
                    ${h ? `<button class="eco-b alt" data-qset="${h.q}" style="flex:1; padding:6px 4px; font-size:12px;">全部持股 ${h.q} 單位</button>` : ''}
                </div>

                <div style="font-size:12px; color:var(--muted,#666); background:var(--surface,#f1f5f9); padding:6px 10px; border-radius:8px; line-height:1.4; text-align:center;">
                    <div>🛒 買進保證金（含 2% 手續費）：<b class="eco-margin-val">${marginCost.toLocaleString()} 🪙</b></div>
                    <div>💰 賣出拿回估算（已扣證交稅與資本利得稅）：<b class="eco-get-val">${h ? get.toLocaleString() + ' 🪙' : '—'}</b></div>
                </div>

                <div class="eco-qrow" style="margin-top:2px;">
                    <button class="eco-b" data-do="buy" style="flex:1; padding:8px;" ${S.coins < marginCost ? 'disabled' : ''}>買進 ${q.toLocaleString()} 單位</button>
                    <button class="eco-b sell" data-do="sell" style="flex:1; padding:8px;" ${h ? '' : 'disabled'}>賣出 ${q.toLocaleString()} 單位</button>
                </div>
            </div>`;
    }

    function refresh() {
        if (!ov || sliding) return;
        if (document.activeElement && (document.activeElement.classList.contains('eco-qty') || document.activeElement.classList.contains('eco-tf')) && !document.activeElement.classList.contains('eco-sl-input')) return;
        const body = ov.querySelector('.eco-body'), top = body.scrollTop;
        const balEl = ov.querySelector('.bal span'); balEl.textContent = Math.floor(S.coins).toLocaleString(); balEl.style.color = S.coins < 0 ? '#dc2626' : '';
        ov.querySelectorAll('.eco-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
        const nc0 = notifCount(), td = ov.querySelector('.eco-tabdot'); if (td) td.textContent = nc0 ? ' 🔴' + nc0 : '';
        
        if (tab === 'shop') body.innerHTML = shopHtml();
        else if (tab === 'market') body.innerHTML = marketHtml();
        else if (tab === 'account') body.innerHTML = accountHtml();
        else if (tab === 'bank') body.innerHTML = bankHtml();
        
        body.scrollTop = top;
    }

    // 通知欄：收到的轉帳先放進信箱，玩家簽收才入帳（同一個 id 只會收一次）
    function receiveTransfer(from, amt, id) {
        amt = Math.floor(+amt); if (!(amt > 0)) return false;
        id = id || ('t' + Date.now() + Math.random().toString(36).slice(2, 6));
        if (S.signed.includes(id) || S.inbox.some(x => x.id === id)) return false;
        S.inbox.unshift({ id, type: 'transfer', from: String(from || '好友'), amt, t: Date.now() });
        changed(); toast(`📬 收到「${from || '好友'}」的轉帳 🪙 ${amt.toLocaleString()}，到「我的帳戶」簽收`); return true;
    }
    function signTransfer(id) {
        const i = S.inbox.findIndex(x => x.id === id); if (i < 0) return;
        const x = S.inbox.splice(i, 1)[0]; S.coins += x.amt; S.signed.unshift(x.id); S.signed.length = Math.min(S.signed.length, 200);
        logTx('📬 轉入', `簽收「${x.from}」的轉帳`, x.amt); changed(); toast(`✅ 已簽收 ${x.amt.toLocaleString()} 🪙`);
    }
    function signAll() {
        if (!S.inbox.length) return; let sum = 0, n = S.inbox.length;
        S.inbox.forEach(x => { sum += x.amt; S.signed.unshift(x.id); logTx('📬 轉入', `簽收「${x.from}」的轉帳`, x.amt); });
        S.coins += sum; S.inbox = []; S.signed.length = Math.min(S.signed.length, 200); changed(); toast(`✅ 已簽收 ${n} 筆，共 ${sum.toLocaleString()} 🪙`);
    }
    // 好友轉帳：先找到對方（用世界地圖的玩家名單），扣自己的錢，再把錢寄到對方信箱（對方下次開遊戲就會收到）
    let transferring = false;
    async function doTransfer() {
        if (!ov || transferring) return;
        const toInput = ov.querySelector('#eco-transfer-to'), amtInput = ov.querySelector('#eco-transfer-amt');
        const friendName = toInput ? toInput.value.trim() : '', amt = parseInt(amtInput ? amtInput.value : 0, 10) || 0;
        if (!friendName) return toast('請輸入好友名稱！');
        if (amt <= 0) return toast('請輸入有效金額！');
        if (S.coins < amt) return toast('金幣不足！');
        if (typeof World === 'undefined' || !World.findPlayer) return toast('轉帳需要世界地圖模組（world.js）');
        if (amt >= 1000000 && !confirm(`確定轉 🪙 ${amt.toLocaleString()} 給「${friendName}」？`)) return;
        transferring = true; toast('轉帳中…');
        try {
            const who = await World.findPlayer(friendName);
            if (!who.ok) return toast(who.msg);
            S.coins -= amt; save(); changed();
            try { await World.sendCoins(who.uid, amt); }
            catch (err) { S.coins += amt; save(); changed(); throw err; }
            if (toInput) toInput.value = ''; if (amtInput) amtInput.value = ''; logTx('💸 轉出', `轉帳給「${who.name}」`, -amt);
            toast(`✅ 已轉帳 ${amt.toLocaleString()} 🪙 給「${who.name}」，對方下次開遊戲會收到通知，簽收後入帳`);
            refresh();
        } catch (err) { toast('轉帳失敗：' + (err && err.message ? err.message : err)); }
        finally { transferring = false; }
    }

    function open(t) {
        close(); tab = t || 'shop'; sel = null; currentLev = 1; stopLossVal = ''; showNewsModal = false;
        ov = document.createElement('div'); ov.className = 'eco-ov';
        ov.innerHTML = `<div class="eco-box" style="position:relative;">
            <div class="eco-head">
                <div class="bal">🪙 <span>${Math.floor(S.coins).toLocaleString()}</span></div>
                <div class="eco-tabs">
                    <button data-tab="shop">🛒 商店</button>
                    <button data-tab="market">股市</button>
                    <button data-tab="account">我的帳戶<span class="eco-tabdot"></span></button>
                    <button data-tab="bank">🏦 銀行</button>
                </div>
                <button class="eco-x" data-x="1">✕</button>
            </div>
            <div class="eco-body"></div>
        </div>`;
        document.body.appendChild(ov);
        
        ov.addEventListener('click', e => {
            if (e.target === ov || e.target.closest('[data-x]')) return close();
            
            if (e.target.closest('[data-open-news]')) {
                showNewsModal = true;
                return refresh();
            }
            const cn = e.target.closest('[data-close-news]');
            if (cn && (cn === e.target || cn.tagName === 'BUTTON')) {   // 只有點背景或按鈕才關閉，點到文字或標的不會被吃掉
                showNewsModal = false;
                return refresh();
            }

            const tb = e.target.closest('[data-tab]'); 
            if (tb) { tab = tb.dataset.tab; sel = null; showNewsModal = false; return refresh(); }
            const ms = e.target.closest('[data-msub]'); if (ms) { marketSubTab = ms.dataset.msub; sel = null; return refresh(); }
            
            if (bkClick(e)) return;
            const fd = e.target.closest('[data-fold]'); if (fd) { FOLD[fd.dataset.fold] = FOLD[fd.dataset.fold] ? 0 : 1; saveFold(); return refresh(); }
            const jp = e.target.closest('[data-jump]'); if (jp) { FOLD[jp.dataset.jump] = 1; saveFold(); refresh(); const t = ov.querySelector(`[data-foldbox="${jp.dataset.jump}"]`); if (t) t.scrollIntoView({ block: 'center' }); return; }
            if (e.target.closest('[data-logmore]')) { logLimit += 50; return refresh(); }
            if (e.target.closest('[data-sign-all]')) return signAll();
            const sg = e.target.closest('[data-sign]'); if (sg) return signTransfer(sg.dataset.sign);
            const sll = e.target.closest('[data-sell-lux]'); if (sll) return sellLux(sll.dataset.sellLux);
            if (e.target.closest('[data-action="transfer"]')) return doTransfer();
            const bkb = e.target.closest('[data-bank]'); if (bkb) return bankAct(bkb.dataset.bank);

            if (e.target.closest('[data-sl-clear]')) {
                stopLossVal = '';
                const slInput = ov.querySelector('.eco-sl-input');
                if (slInput) slInput.value = '';
                if (sel && S.stocks[sel]) { S.stocks[sel].sl = 0; save(); }
                toast('已清除停損設定');
                return refresh();
            }
            
            const sl = e.target.closest('[data-sel]'); 
            if (sl) { 
                sel = sl.dataset.sel; 
                detailFrom = 'market'; 
                qty = 1; selT = 0; 
                currentLev = S.stocks[sel]?.lev || 1;
                stopLossVal = S.stocks[sel]?.sl || '';
                ov.querySelector('.eco-body').scrollTop = 0; 
                return refresh(); 
            }

            const gts = e.target.closest('[data-gotosel]');
            if (gts) {
                sel = gts.dataset.gotosel;
                const targetStock = STOCKS.find(x => x.id === sel);
                if (targetStock) marketSubTab = targetStock.cat; showNewsModal = false;
                tab = 'market'; detailFrom = 'market';
                qty = 1; selT = 0;
                currentLev = S.stocks[sel]?.lev || 1;
                stopLossVal = S.stocks[sel]?.sl || '';
                ov.querySelector('.eco-body').scrollTop = 0;
                return refresh();
            }

            if (e.target.closest('[data-back]')) { sel = null; tab = 'market'; return refresh(); }

            const rg = e.target.closest('[data-range]'); if (rg) { range = rg.dataset.range; selT = 0; return refresh(); }
            const cd = e.target.closest('[data-c]'); if (cd) { selT = +cd.dataset.c; return refresh(); }
            const dq = e.target.closest('[data-q]'); if (dq) { qty = qtyOf(qtyOf(qty) + +dq.dataset.q); return refresh(); }
            const sq = e.target.closest('[data-qset]'); if (sq) { if (sq.disabled) return; qty = qtyOf(sq.dataset.qset); return refresh(); }
            
            const dd = e.target.closest('[data-do]'); 
            if (dd && sel) { 
                const slInput = ov.querySelector('.eco-sl-input');
                const slNum = slInput && slInput.value !== '' ? parseFloat(slInput.value) || 0 : 0;
                const qi = ov.querySelector('.eco-qty:not(.eco-sl-input)'); if (qi && qi.value !== '') qty = qtyOf(qi.value);   // 以輸入框現在的內容為準
                const hh = S.stocks[sel];
                return trade(sel, dd.dataset.do, qtyOf(qty), hh ? (hh.lev || 1) : currentLev, slNum); 
            }
            
            const by = e.target.closest('[data-buy]'); if (by) return buy(by.dataset.buy);
            const eq = e.target.closest('[data-eq]'); if (eq) { const [c, r] = eq.dataset.eq.split(':'); return void equip(c, r); }
        });
        
        ov.addEventListener('pointerdown', e => { if (e.target.classList && e.target.classList.contains('eco-lev-slider')) sliding = true; });
        const endSlide = () => { sliding = false; };
        document.addEventListener('pointerup', endSlide); document.addEventListener('pointercancel', endSlide);
        ov.addEventListener('input', e => {
            const c = e.target.classList; if (!c) return;
            if (c.contains('eco-lev-slider')) {
                currentLev = parseInt(e.target.value) || 1;
                updateTradeBox();
            } else if (c.contains('eco-qty') && !c.contains('eco-sl-input')) {
                qty = qtyOf(e.target.value);
                updateTradeBox();   // 打字時就即時更新保證金與買進按鈕
            } else if (c.contains('eco-sl-input')) {
                stopLossVal = e.target.value;
                const slNum = stopLossVal !== '' ? parseFloat(stopLossVal) || 0 : 0;
                if (sel && S.stocks[sel]) { S.stocks[sel].sl = slNum; save(); }
            }
        });
        
        ov.addEventListener('keydown', e => {
            if (e.key !== 'Enter') return; const id = e.target.id;
            if (id === 'eco-transfer-to') { e.preventDefault(); const a = ov.querySelector('#eco-transfer-amt'); if (a) a.focus(); }
            else if (id === 'eco-transfer-amt') { e.preventDefault(); e.target.blur(); doTransfer(); }
            else if (id === 'eco-bank-a') { e.preventDefault(); e.target.blur(); bankAct('dep'); }
            else if (id === 'eco-bank-b') { e.preventDefault(); e.target.blur(); bankAct('borrow'); }
            else if (e.target.classList && e.target.classList.contains('eco-qty')) { e.preventDefault(); e.target.blur(); }
        });
        ov.addEventListener('focusout', e => { if (e.target.classList && e.target.classList.contains('eco-qty') && !e.target.classList.contains('eco-sl-input')) { e.target.value = qtyOf(qty); updateTradeBox(); } });   // 不再整頁重畫：以前手指一離開輸入框就重畫，會吃掉你按『買進』的那一下
        
        refresh(); 
        timer = setInterval(() => { if (tab === 'market' || sel) refresh(); }, 4000);
    }

    function close() { clearInterval(timer); if (ov) { ov.remove(); ov = null; } }

    function fab() {
        const f = document.createElement('div'); f.id = 'eco-fab'; f.title = '開啟金融'; f.innerHTML = '🪙 <b class="eco-coins">0</b><span class="eco-fab-dot" style="display:none;background:#dc2626;color:#fff;border-radius:999px;padding:0 6px;font-size:11px;"></span>';
        f.addEventListener('click', () => open(notifCount() > 0 ? 'account' : 'shop')); document.body.appendChild(f);
        setInterval(() => {
            const bt = document.getElementById('battle-screen'), mj = document.getElementById('mj-screen');
            const inBattle = bt && !bt.classList.contains('hidden'), inMj = mj && !mj.classList.contains('hidden') && mj.classList.contains('in-game');
            f.style.display = inBattle || inMj || ov ? 'none' : 'flex';
        }, 300);
    }

    function init() {
        fab(); updateDot();
        document.querySelectorAll('.eco-coins').forEach(el => { el.textContent = S.coins; el.style.color = S.coins < 0 ? '#dc2626' : ''; });
        if (loadNote === 'repaired') setTimeout(() => toast('⚠️ 偵測到存檔金幣損毀（NaN），已修復為 0。到「我的帳戶 → 存檔備份與救援」可還原舊存檔'), 1500);
        else if (loadNote === 'migrated') setTimeout(() => toast('已從舊版存檔搶救資料'), 1500);
        const b = document.getElementById('btn-goto-eco'); if (b) b.addEventListener('click', () => open('shop'));
        riskScan(); setInterval(riskScan, 15000);   // 爆倉／停損檢查（含離線期間）
        bankTick(); setInterval(bankTick, 60000);
        daily();
    }

    window.Economy = { 
        stocksValue: () => Object.keys(S.stocks).reduce((a, id) => { const st = STOCKS.find(x => x.id === id); return a + (st ? equityOf(S.stocks[id], price(st)) : 0); }, 0), 
        setTaxMult: m => { taxMult = m; try { localStorage.setItem('vk_taxmult', m); } catch (e) { } }, taxMult: () => taxMult,
        stocks: () => STOCKS, 
        stockPrice: st => price(st), 
        run: () => run, 
        runReset: () => { run = 0; }, 
        THROWS, FELTS, CHAT_PACKS, 
        coins: () => S.coins, add, trade, riskScan, restoreData, receiveTransfer, signTransfer, notifications: notifCount, luxuries: () => luxOwned().map(l => Object.assign({}, l)), luxuryValue: luxVal, priceAt: (st, t) => price(st, t), holding: id => S.stocks[id] ? Object.assign({}, S.stocks[id]) : null, candidates, bankAct, bankTick, nextTax: getNextTaxAmount,
        bank: () => { const b = bk(); return { dep: Math.floor(b.dep), loan: Math.ceil(b.loan), limit: creditLimit(), due: b.due, late: isLate() }; },
        bankNet: () => { const b = bk(); return Math.floor(b.dep) - Math.ceil(b.loan); },   // add：增減金幣（買地、生產、轉帳收款等模組要用）
        owned, equipped, equip, throwIdx, onAnswer, onMj, onWord, open, close, 
        onChange: f => subs.push(f), 
        init 
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();