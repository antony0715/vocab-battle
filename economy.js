// 金幣・商店・交易市場（股票/基金/幣圈）・我的錢包系統
(() => {
    'use strict';
    const KEY = 'vbEco_v1';
    
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
        // --- 股票 (Stock) ---
        { id: 'KNG', name: '單字King科技', cat: 'stock', base: 150, vol: .28, p1: 130, p2: 47, desc: '開發英文單字學習遊戲的科技公司，業績穩健、波動相對較小。' },
        { id: 'RSA', name: '紅海科技', cat: 'stock', base: 100, vol: .38, p1: 97, p2: 41, desc: '專門經營「錯題庫」存放業務，答錯的人越多越賺錢。' },
        { id: 'LFK', name: '連發科', cat: 'stock', base: 80, vol: .45, p1: 71, p2: 29, desc: '全國最大字母麻將連鎖，週末與連假常有大行情。' },
        { id: 'EGG', name: '台雞店', cat: 'stock', base: 30, vol: .6, p1: 53, p2: 23, desc: '供應麻將桌上最常被丟的東西，雞蛋價格說漲就漲。' },
        { id: 'POO', name: '肥料公司', cat: 'stock', base: 20, vol: .68, p1: 61, p2: 19, desc: '看似不起眼，但馬桶堵塞時股價會暴衝。' },
        { id: 'NVD', name: '草灰達', cat: 'stock', base: 50, vol: .7, p1: 43, p2: 17, desc: '高風險高報酬的投機股，一天內暴漲暴跌都不稀奇。' },

        // --- 基金 / ETF (Fund) ---
        { id: 'W50', name: '全球單字50ETF', cat: 'fund', base: 200, vol: .08, p1: 220, p2: 83, desc: '追蹤全球前50大高頻單字的指數型基金，波動極低，適合定存型玩家。' },
        { id: 'BND', name: '7000字債券基金', cat: 'fund', base: 120, vol: .05, p1: 310, p2: 120, desc: '投資學測高頻單字資產，走勢平緩，幾乎不暴跌的避險選擇。' },
        { id: 'TECH', name: 'AI單字科技基金', cat: 'fund', base: 180, vol: .15, p1: 180, p2: 65, desc: '結合人工智慧演算法與記憶曲線，長期成長趨勢明確。' },

        // --- 虛擬貨幣 (Crypto) ---
        { id: 'BTC', name: '比特幣 (BitWord)', cat: 'crypto', base: 500, vol: 1.3, p1: 35, p2: 13, desc: '加密貨幣之王，市場熱度極高，隨時可能暴漲或大瀑布。' },
        { id: 'ETH', name: '以太幣 (EthVocab)', cat: 'crypto', base: 300, vol: 1.6, p1: 28, p2: 11, desc: '智慧合約龍頭幣，暴跌時是抄底機會，暴漲時能讓你一夕致富。' },
        { id: 'DOGE', name: '狗狗單字幣', cat: 'crypto', base: 10, vol: 2.2, p1: 15, p2: 7, desc: '迷因幣之王！沒有基本面，全憑市場情緒與社群炒作，波動極度瘋狂。' }
    ];

    const FEE = .01;
    const def = () => ({ coins: 100, items: {}, equip: { throw: 'egg', felt: 'default' }, stocks: {}, lastDaily: '' });
    let S = def();
    try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && typeof o.coins === 'number') S = Object.assign(def(), o, { equip: Object.assign(def().equip, o.equip || {}) }); } catch (e) { }
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
    const subs = [];
    const changed = () => { save(); document.querySelectorAll('.eco-coins').forEach(el => { el.textContent = S.coins; }); subs.forEach(f => { try { f(); } catch (e) { } }); if (ov) refresh(); };
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // ---------- 提示 ----------
    function toast(msg) {
        let t = document.getElementById('eco-toast');
        if (!t) { t = document.createElement('div'); t.id = 'eco-toast'; document.body.appendChild(t); }
        t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200);
    }

    // ---------- 金幣 ----------
    const add = (n, why) => { n = Math.round(n); if (!n) return; S.coins = Math.max(0, S.coins + n); changed(); if (why) toast(`🪙 ${n > 0 ? '+' : ''}${n} ${why}`); };
    const allItems = () => [
        ...THROWS.map(t => ({ id: 'throw_' + t.id, cat: 'throw', icon: t.e, name: t.name, price: t.price, ref: t.id })),
        ...FELTS.map(f => ({ id: 'felt_' + f.id, cat: 'felt', sw: f.sw, name: f.name, price: f.price, ref: f.id })),
        ...CHAT_PACKS.map(p => ({ id: p.id, cat: 'chat', icon: '💬', name: p.name, price: p.price, list: p.list }))
    ];
    const owned = id => { const it = allItems().find(x => x.id === id) || allItems().find(x => x.ref === id); return !!it && (it.price === 0 || !!S.items[it.id]); };
    const equipped = slot => S.equip[slot];
    const throwIdx = () => Math.max(0, THROWS.findIndex(t => t.id === S.equip.throw));
    function buy(id) {
        const it = allItems().find(x => x.id === id); if (!it || owned(id)) return;
        if (S.coins < it.price) return toast('金幣不夠喔！去賺點金幣或炒股吧');
        S.coins -= it.price; S.items[id] = 1;
        if (it.cat !== 'chat') S.equip[it.cat] = it.ref;
        changed(); toast(`✅ 已購買 ${it.name}`);
    }
    function equip(cat, ref) { const it = allItems().find(x => x.cat === cat && x.ref === ref); if (!it || !owned(it.id)) return false; S.equip[cat] = ref; changed(); return true; }

    // ---------- 賺金幣 ----------
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
        if (S.lastDaily === k) return; S.lastDaily = k; add(50, '每日登入獎勵');
    }

    // ---------- 價格計算演算法 ----------
    const hash = n => { n = n | 0; n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; };
    function pAt(st, m) {
        const i = STOCKS.indexOf(st) + 1, w = Math.floor(m / 20), f = (m % 20) / 20;
        const sh = (hash(w * 131 + i * 977) - .5) * (1 - f) + (hash((w + 1) * 131 + i * 977) - .5) * f;
        const x = st.vol * (.9 * Math.sin(m / st.p1 + i) + .5 * Math.sin(m / st.p2 + i * 2) + 1.7 * sh) + st.vol * .18 * (hash(m * 7 + i * 31) - .5);
        return Math.max(0.1, st.base * Math.exp(x));
    }
    function price(st, tms = Date.now()) { const m = tms / 60000, a = Math.floor(m), f = m - a; return pAt(st, a) * (1 - f) + pAt(st, a + 1) * f; }
    
    const NEWS_UP = ['發表亮眼財報，市場看好', '獲得巨額資金注入，行情暴衝', '社群熱度大增，買盤強勁湧入', '分析師給出極高評等','市場需求暴增，價格創下新高', '大戶持續吃貨，價格節節攀升'];
    const NEWS_DN = ['財報或數據不如預期，賣壓湧現', '遭監管機構關切，市場觀望恐慌', '主力大戶獲利了結，短線走低', '遭分析師調降評等','市場資金撤出，價格大幅承壓','傳出負面新聞，投資人拋售離場'];
    function news(st) {
        const i = STOCKS.indexOf(st) + 1, w0 = Math.floor(Date.now() / 1200000), out = [];
        for (let w = w0; w > w0 - 14 && out.length < 5; w--) {
            const d = hash(w * 131 + i * 977) - .5; if (Math.abs(d) < .2) continue;
            const L = d > 0 ? NEWS_UP : NEWS_DN, ago = Math.max(0, Math.round((Date.now() - w * 1200000) / 60000));
            out.push({ up: d > 0, text: L[Math.floor(hash(w * 7 + i) * L.length)], ago });
        }
        return out;
    }
    const RANGES = { '1h': [60, '1 小時'], '6h': [360, '6 小時'], '1d': [1440, '1 天'], '7d': [10080, '7 天'] };
    function series(st, mins, n = 60) { const now = Date.now(), a = []; for (let k = n; k >= 0; k--) a.push(price(st, now - k * mins * 60000 / n)); return a; }
    const stat = a => ({ hi: Math.max(...a), lo: Math.min(...a), avg: a.reduce((x, y) => x + y, 0) / a.length });
    
    // ---------- K 線圖 ----------
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

    function trade(id, side, qty) {
        const st = STOCKS.find(s => s.id === id); if (!st) return;
        const p = price(st), h = S.stocks[id] || { q: 0, cost: 0 };
        if (side === 'buy') {
            const cost = Math.ceil(p * qty * (1 + FEE));
            if (S.coins < cost) return toast('金幣不夠買這麼多');
            S.coins -= cost; h.q += qty; h.cost += cost; S.stocks[id] = h; changed(); toast(`📈 買進 ${st.name} ${qty} 單位，花費 ${cost} 🪙`);
        } else {
            qty = Math.min(qty, h.q); if (qty <= 0) return toast('你沒有持有此資產');
            const get = Math.floor(p * qty * (1 - FEE)), part = h.cost * qty / h.q;
            S.coins += get; h.q -= qty; h.cost -= part; if (h.q <= 0) delete S.stocks[id]; else S.stocks[id] = h;
            changed(); const pl = Math.round(get - part); toast(`💵 賣出 ${st.name} ${qty} 單位，拿回 ${get} 🪙（${pl >= 0 ? '賺' : '賠'} ${Math.abs(pl)}）`);
        }
    }

    function spark(st) {
        const now = Date.now(), pts = []; for (let k = 60; k >= 0; k -= 2) pts.push(price(st, now - k * 60000));
        const mn = Math.min(...pts), mx = Math.max(...pts), rg = mx - mn || 1;
        const d = pts.map((v, i) => `${(i / (pts.length - 1) * 100).toFixed(1)},${(22 - (v - mn) / rg * 20).toFixed(1)}`).join(' ');
        const up = pts[pts.length - 1] >= pts[0];
        return `<svg viewBox="0 0 100 24" preserveAspectRatio="none" class="eco-spark"><polyline fill="none" stroke="${up ? '#dc2626' : '#16a34a'}" stroke-width="2" points="${d}"/></svg>`;
    }

    // ---------- 介面與樣式控制 ----------
    let ov = null, tab = 'shop', marketSubTab = 'stock', timer = null, sel = null, range = '1d', qty = 1, selT = 0;
    const css = `
.eco-ov{position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:10px}
.eco-box{background:var(--card,#fff);color:var(--text,#111);width:min(96vw,680px);height:72vh;max-height:72vh;border-radius:18px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px #0007}
.eco-head{display:flex;align-items:center;gap:6px;padding:10px 12px;border-bottom:1px solid var(--border,#ddd);flex-shrink:0}
.eco-head .bal{font-weight:900;font-size:16px;white-space:nowrap}
.eco-tabs{display:flex;gap:4px;flex:1;justify-content:center;overflow-x:auto;white-space:nowrap;scrollbar-width:none}
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
.eco-sum{display:flex;justify-content:space-between;background:var(--surface,#f3f3f3);border-radius:12px;padding:8px 12px;font-size:14px;font-weight:700}
.eco-st{border:1px solid var(--border,#ddd);border-radius:12px;padding:8px;display:grid;grid-template-columns:1fr 90px;gap:4px 8px;align-items:center;background:var(--surface,#f7f7f7)}
.eco-st .l b{font-size:14px}.eco-st .l small{color:var(--muted,#666);margin-left:4px}
.eco-spark{width:90px;height:34px}
.eco-up{color:#dc2626;font-weight:800}.eco-dn{color:#16a34a;font-weight:800}
.eco-st .hold{grid-column:1/3;font-size:12px;color:var(--muted,#666)}
#eco-toast{position:fixed;left:50%;top:14px;transform:translate(-50%,-20px);z-index:2200;background:#111c;color:#fff;padding:8px 16px;border-radius:999px;font-weight:700;font-size:14px;opacity:0;pointer-events:none;transition:.25s;max-width:92vw;text-align:center}
#eco-toast.on{opacity:1;transform:translate(-50%,0)}
.eco-hb{display:grid;grid-template-columns:34px 1fr 52px;gap:6px;align-items:center;font-size:12px}.eco-hb .bar{height:12px;border-radius:6px;background:var(--surface,#e5e7eb);overflow:hidden}.eco-hb .bar i{display:block;height:100%}.eco-hb b{text-align:right}
.eco-st.click{cursor:pointer}.eco-go{color:#f59e0b;font-weight:800}
.eco-kwrap{background:#0b1020;border-radius:12px;padding:6px 6px 8px;display:flex;flex-direction:column;gap:4px}
.eco-big{width:100%;height:auto;display:block}
.eco-ohlc{display:flex;gap:8px;flex-wrap:wrap;font-size:12px;color:#e5e7eb;padding:2px 4px;border-top:1px solid #ffffff22}.eco-ohlc b{color:#fde047}
.eco-price{font-size:18px;font-weight:900}.eco-price small{font-weight:400;color:var(--muted,#666);font-size:11px}
.eco-tabs2{display:flex;gap:6px}.eco-tabs2 button{flex:1;border:none;border-radius:8px;padding:5px 0;font-weight:700;cursor:pointer;background:var(--surface,#eee);color:var(--text,#111)}.eco-tabs2 button.on{background:#f59e0b;color:#fff}
.eco-box2{border:1px solid var(--border,#ddd);border-radius:12px;padding:8px 10px;display:flex;flex-direction:column;gap:6px;font-size:13px}
.eco-qrow{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.eco-qty{width:80px;text-align:center;padding:5px;border-radius:8px;border:1px solid var(--border,#ccc);font-size:15px}
.eco-news{border-left:4px solid;border-radius:6px;padding:6px 8px;background:var(--surface,#f3f3f3);font-size:13px;display:flex;flex-direction:column}.eco-news.up{border-color:#16a34a}.eco-news.dn{border-color:#dc2626}.eco-news small{color:var(--muted,#666)}
#eco-fab{position:fixed;top:8px;right:8px;z-index:1900;background:#fef3c7;color:#92400e;border:2px solid #f59e0b;border-radius:999px;padding:3px 12px;font-weight:900;font-size:14px;box-shadow:0 2px 8px #0004;cursor:pointer;display:flex;gap:4px;align-items:center}
.eco-coinchip{margin-left:6px;background:#fef3c7;color:#92400e;border-radius:999px;padding:1px 8px;font-size:12px;font-weight:800}
.eco-subtabs{display:flex;gap:4px;background:var(--surface,#eee);padding:3px;border-radius:10px}
.eco-subtabs button{flex:1;border:none;border-radius:8px;padding:6px 0;font-weight:700;font-size:12px;cursor:pointer;background:transparent;color:var(--text,#111)}
.eco-subtabs button.on{background:var(--card,#fff);color:#f59e0b;box-shadow:0 2px 4px rgba(0,0,0,0.1)}
/* 灰色底的錢包總覽卡片 */
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
        return `<div class="eco-note">賺金幣：答對題目 +1（連擊 10 以上 +2）・麻將每局都有獎勵・每日登入 +50・查字典加入新單字 +5！</div>
            ${sec('🎯 麻將投擲物（局內點對手頭像丟出）', 'throw')}${sec('🪑 牌桌主題', 'felt')}${sec('💬 麻將快捷語包', 'chat')}`;
    }

    const pct = (a, b) => `<span class="${a >= b ? 'eco-up' : 'eco-dn'}">${a >= b ? '▲' : '▼'} ${Math.abs((a / b - 1) * 100).toFixed(1)}%</span>`;

    // 💱 交易市場
    function marketHtml() {
        if (sel) return detailHtml(STOCKS.find(x => x.id === sel));
        
        const subTabs = `<div class="eco-subtabs">
            <button class="${marketSubTab === 'stock' ? 'on' : ''}" data-msub="stock">📊 股票</button>
            <button class="${marketSubTab === 'fund' ? 'on' : ''}" data-msub="fund">🏛️ 基金</button>
            <button class="${marketSubTab === 'crypto' ? 'on' : ''}" data-msub="crypto">🪙 幣圈</button>
        </div>`;

        const list = STOCKS.filter(s => s.cat === marketSubTab);
        
        const rows = list.map(st => {
            const p = price(st), p0 = price(st, Date.now() - 3600000), h = S.stocks[st.id];
            const hold = h ? `持有 ${h.q} 單位・市值 ${Math.floor(p * h.q)} 🪙（${p * h.q - h.cost >= 0 ? '+' : ''}${Math.round(p * h.q - h.cost)}）` : '尚未持有';
            return `<div class="eco-st click" data-sel="${st.id}"><div class="l"><b>${st.id}</b><small>${esc(st.name)}</small><div><b>🪙 ${p.toFixed(1)}</b> ${pct(p, p0)} <small>近 1 小時</small></div></div>${spark(st)}<div class="hold">${hold} <span class="eco-go">詳細資料 ›</span></div></div>`;
        }).join('');
        
        const tips = {
            stock: '股票市場：中等風險與報酬，每分鐘價格隨全伺服器變動。',
            fund: '基金 / ETF：低風險穩健型，波動極小，適合長期定存資產。',
            crypto: '虛擬貨幣：超高風險超高暴利！價格波動瘋狂，請謹慎投資！'
        };

        return `${subTabs}<div class="eco-note">${tips[marketSubTab]}（買賣均收 1% 手續費）</div>${rows}`;
    }

    // 👛 我的錢包（灰底，持股明細依「股票、基金、虛擬貨幣」三類分開）
    function walletHtml() {
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
                const val = Math.floor(curP * h.q);
                totalInvestment += val;
                totalCost += h.cost;
                const pl = val - h.cost;
                catRows += `<div class="eco-st">
                    <div class="l">
                        <b>${st.id}</b><small>${esc(st.name)}</small>
                        <div>持有 ${h.q} 股・均價 ${(h.cost / h.q).toFixed(1)}</div>
                    </div>
                    <div style="text-align:right;">
                        <b>🪙 ${val}</b>
                        <div class="${pl >= 0 ? 'eco-up' : 'eco-dn'}" style="font-size:11px;">${pl >= 0 ? '+' : ''}${Math.round(pl)}</div>
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

        const totalNetWorth = S.coins + totalInvestment;
        const totalPL = Math.round(totalInvestment - totalCost);

        return `<div class="eco-wallet-card">
            <div class="eco-wallet-title">總資產淨值 (Net Worth)</div>
            <div class="eco-wallet-num">🪙 ${totalNetWorth}</div>
            <div class="eco-wallet-grid">
                <div class="eco-wallet-subbox"><span>可用金幣</span><b>🪙 ${S.coins}</b></div>
                <div class="eco-wallet-subbox"><span>投資總市值</span><b>🪙 ${totalInvestment} (${totalPL >= 0 ? '+' : ''}${totalPL})</b></div>
            </div>
        </div>

        ${sectionsHtml}`;
    }

    // 詳細交易頁面
    function detailHtml(st) {
        const p = price(st), h = S.stocks[st.id], mins = RANGES[range][0];
        const maxBuy = Math.floor(S.coins / (p * (1 + FEE))), q = Math.max(1, qty | 0), est = Math.ceil(p * q * (1 + FEE)), get = Math.floor(p * q * (1 - FEE));
        let hold = '<div class="eco-box2"><b>我的持股</b><div class="eco-note">尚未持有</div></div>';
        if (h) {
            const val = p * h.q, mx = Math.max(val, h.cost) || 1, win = val >= h.cost;
            hold = `<div class="eco-box2"><b>我的持股 <small>${h.q} 單位・均價 ${(h.cost / h.q).toFixed(1)}</small></b>
                <div class="eco-hb"><small>成本</small><div class="bar"><i style="width:${(h.cost / mx * 100).toFixed(1)}%;background:#64748b"></i></div><b>${Math.round(h.cost)}</b></div>
                <div class="eco-hb"><small>市值</small><div class="bar"><i style="width:${(val / mx * 100).toFixed(1)}%;background:${win ? '#ef4444' : '#22c55e'}"></i></div><b>${Math.round(val)}</b></div>
                <div class="${win ? 'eco-up' : 'eco-dn'}" style="text-align:right">${win ? '+' : ''}${Math.round(val - h.cost)} 🪙（${((val / h.cost - 1) * 100).toFixed(1)}%）</div></div>`;
        }
        const nw = news(st), newsH = nw.length ? nw.map(n => `<div class="eco-news ${n.up ? 'up' : 'dn'}">${n.up ? '📈 利多' : '📉 利空'} ${esc(st.name)}${esc(n.text)}<small>${n.ago < 1 ? '剛剛' : n.ago + ' 分鐘前'}</small></div>`).join('') : '<div class="eco-note">最近沒有重大消息。</div>';
        
        return `<button class="eco-b alt" data-back="1" style="align-self:flex-start">‹ 返回列表</button>
            <div><b style="font-size:18px">${st.id}</b> <span>${esc(st.name)}</span><div class="eco-note">${esc(st.desc)}</div></div>
            <div class="eco-price">🪙 ${p.toFixed(2)} ${pct(p, price(st, Date.now() - 3600000))}<small> 近 1 小時</small> ${pct(p, price(st, Date.now() - 86400000))}<small> 近 24 小時</small></div>
            <div class="eco-tabs2">${Object.entries(RANGES).map(([k, v]) => `<button class="${k === range ? 'on' : ''}" data-range="${k}">${v[1]}</button>`).join('')}</div>
            ${bigChart(st)}
            ${hold}
            <div class="eco-box2" style="gap:8px;">
                <div style="font-weight:800; display:flex; align-items:center; gap:4px;">💱 資產交易</div>
                
                <div class="eco-qrow" style="justify-content:center;">
                    <button style="background:transparent; border:none; font-weight:700; cursor:pointer; padding:6px; flex:1; text-align:center; color:var(--text,#111);" data-q="-10">-10</button>
                    <button style="background:transparent; border:none; font-weight:700; cursor:pointer; padding:6px; flex:1; text-align:center; color:var(--text,#111);" data-q="-1">-1</button>
                    <input class="eco-qty" type="number" min="1" inputmode="numeric" value="${q}" style="width:65px;">
                    <button style="background:transparent; border:none; font-weight:700; cursor:pointer; padding:6px; flex:1; text-align:center; color:var(--text,#111);" data-q="1">+1</button>
                    <button style="background:transparent; border:none; font-weight:700; cursor:pointer; padding:6px; flex:1; text-align:center; color:var(--text,#111);" data-q="10">+10</button>
                </div>

                <div class="eco-qrow">
                    <button class="eco-b alt" data-qset="${Math.max(1, maxBuy)}" style="flex:1; padding:6px 4px; font-size:12px;">最多可買 ${maxBuy} 單位</button>
                    ${h ? `<button class="eco-b alt" data-qset="${h.q}" style="flex:1; padding:6px 4px; font-size:12px;">全部持股 ${h.q} 單位</button>` : ''}
                </div>

                <div style="font-size:12px; color:var(--muted,#666); background:var(--surface,#f1f5f9); padding:6px 10px; border-radius:8px; line-height:1.4; text-align:center;">
                    <div>🛒 買進預估：<b>${est} 🪙</b> (含1%手續費)</div>
                    <div>💰 賣出預估：<b>${get} 🪙</b> (扣1%手續費)</div>
                </div>

                <div class="eco-qrow" style="margin-top:2px;">
                    <button class="eco-b" data-do="buy" style="flex:1; padding:8px;" ${S.coins < est ? 'disabled' : ''}>買進 ${q} 單位</button>
                    <button class="eco-b sell" data-do="sell" style="flex:1; padding:8px;" ${h ? '' : 'disabled'}>賣出 ${q} 單位</button>
                </div>
            </div>
            <div class="eco-h">📰 最新消息</div>${newsH}`;
    }

    function refresh() {
        if (!ov) return;
        if (document.activeElement && document.activeElement.classList.contains('eco-qty')) return;
        const body = ov.querySelector('.eco-body'), top = body.scrollTop;
        ov.querySelector('.bal span').textContent = S.coins;
        ov.querySelectorAll('.eco-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
        
        if (tab === 'shop') body.innerHTML = shopHtml();
        else if (tab === 'market') body.innerHTML = marketHtml();
        else if (tab === 'wallet') body.innerHTML = walletHtml();
        
        body.scrollTop = top;
    }

    function open(t) {
        close(); tab = t || 'shop'; sel = null;
        ov = document.createElement('div'); ov.className = 'eco-ov';
        ov.innerHTML = `<div class="eco-box">
            <div class="eco-head">
                <div class="bal">🪙 <span>${S.coins}</span></div>
                <div class="eco-tabs">
                    <button data-tab="shop">🛒 商店</button>
                    <button data-tab="market">股市</button>
                    <button data-tab="wallet">我的錢包</button>
                </div>
                <button class="eco-x" data-x="1">✕</button>
            </div>
            <div class="eco-body"></div>
        </div>`;
        document.body.appendChild(ov);
        
        ov.addEventListener('click', e => {
            if (e.target === ov || e.target.closest('[data-x]')) return close();
            const tb = e.target.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; sel = null; return refresh(); }
            const ms = e.target.closest('[data-msub]'); if (ms) { marketSubTab = ms.dataset.msub; sel = null; return refresh(); }
            const sl = e.target.closest('[data-sel]'); if (sl) { sel = sl.dataset.sel; qty = 1; selT = 0; ov.querySelector('.eco-body').scrollTop = 0; return refresh(); }
            if (e.target.closest('[data-back]')) { sel = null; return refresh(); }
            const rg = e.target.closest('[data-range]'); if (rg) { range = rg.dataset.range; selT = 0; return refresh(); }
            const cd = e.target.closest('[data-c]'); if (cd) { selT = +cd.dataset.c; return refresh(); }
            const dq = e.target.closest('[data-q]'); if (dq) { qty = Math.max(1, (qty | 0) + +dq.dataset.q); return refresh(); }
            const sq = e.target.closest('[data-qset]'); if (sq) { qty = Math.max(1, +sq.dataset.qset); return refresh(); }
            const dd = e.target.closest('[data-do]'); if (dd && sel) { return trade(sel, dd.dataset.do, Math.max(1, qty | 0)); }
            const by = e.target.closest('[data-buy]'); if (by) return buy(by.dataset.buy);
            const eq = e.target.closest('[data-eq]'); if (eq) { const [c, r] = eq.dataset.eq.split(':'); return void equip(c, r); }
        });
        
        ov.addEventListener('input', e => { if (e.target.classList.contains('eco-qty')) qty = Math.max(1, Math.floor(+e.target.value) || 1); });
        ov.addEventListener('focusout', e => { if (e.target.classList && e.target.classList.contains('eco-qty')) refresh(); });
        
        refresh(); 
        timer = setInterval(() => { if (tab === 'market') refresh(); }, 4000);
    }

    function close() { clearInterval(timer); if (ov) { ov.remove(); ov = null; } }

    function fab() {
        const f = document.createElement('div'); f.id = 'eco-fab'; f.title = '開啟金融'; f.innerHTML = '🪙 <b class="eco-coins">0</b>';
        f.addEventListener('click', () => open('shop')); document.body.appendChild(f);
        setInterval(() => {
            const bt = document.getElementById('battle-screen'), mj = document.getElementById('mj-screen');
            const inBattle = bt && !bt.classList.contains('hidden'), inMj = mj && !mj.classList.contains('hidden') && mj.classList.contains('in-game');
            f.style.display = inBattle || inMj || ov ? 'none' : 'flex';
        }, 300);
    }

    function init() {
        fab();
        document.querySelectorAll('.eco-coins').forEach(el => { el.textContent = S.coins; });
        const b = document.getElementById('btn-goto-eco'); if (b) b.addEventListener('click', () => open('shop'));
        daily();
    }

    window.Economy = { 
        stocksValue: () => Object.keys(S.stocks).reduce((a, id) => { const st = STOCKS.find(x => x.id === id); return a + (st ? price(st) * S.stocks[id].q : 0); }, 0), 
        stocks: () => STOCKS, 
        stockPrice: st => price(st), 
        run: () => run, 
        runReset: () => { run = 0; }, 
        THROWS, FELTS, CHAT_PACKS, 
        coins: () => S.coins, 
        add, owned, equipped, equip, throwIdx, onAnswer, onMj, onWord, open, close, 
        onChange: f => subs.push(f), 
        init 
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();