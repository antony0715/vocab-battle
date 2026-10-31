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

    // 📈 三大市場標的：股票, 基金, 虛擬貨幣
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

    const FEE = .01;
    const def = () => ({ coins: 100, items: {}, equip: { throw: 'egg', felt: 'default' }, stocks: {}, lastDaily: '', lastTax: '', lastDividend: 0 });

    let S = def();

    // 💡 必須先定義好 save 函數，後續清洗與寫入才不會報錯！
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };

    // 🔍 智慧自動掃描與搶救所有舊存檔
    try {
        const possibleKeys = [KEY, 'vbEco_v2', 'vbEco_v1', 'vbEco'];
        let bestData = null;
        let maxCoins = -1;

        possibleKeys.forEach(k => {
            const raw = localStorage.getItem(k);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed.coins === 'number' && !isNaN(parsed.coins) && parsed.coins >= maxCoins) {
                        maxCoins = parsed.coins;
                        bestData = parsed;
                    }
                } catch (e) { }
            }
        });

        if (bestData) {
            S = Object.assign(def(), bestData, { equip: Object.assign(def().equip, bestData.equip || {}) });
        }
    } catch (e) { }

    // 🛡️【智慧救援防呆】如果金幣變成 NaN 或異常，嘗試從持股市值救援
    if (typeof S.coins !== 'number' || isNaN(S.coins)) {
        let rescueCoins = 100;
        if (S.stocks && typeof S.stocks === 'object') {
            let stockVal = 0;
            Object.keys(S.stocks).forEach(id => {
                const h = S.stocks[id];
                if (h && typeof h.cost === 'number' && !isNaN(h.cost)) {
                    stockVal += h.cost;
                }
            });
            if (stockVal > 0) {
                rescueCoins = Math.max(100, Math.floor(stockVal * 0.5));
            }
        }
        S.coins = rescueCoins;
    }

    if (!S.stocks || typeof S.stocks !== 'object') {
        S.stocks = {};
    } else {
        Object.keys(S.stocks).forEach(id => {
            const h = S.stocks[id];
            if (h) {
                if (typeof h.lev !== 'number' || isNaN(h.lev)) h.lev = 1;
                if (typeof h.q !== 'number' || isNaN(h.q)) h.q = 0;
                if (typeof h.cost !== 'number' || isNaN(h.cost)) h.cost = 0;
            }
        });
    }

    // 清洗完畢後安全寫回存檔
    save();

    const subs = [];
    const changed = () => { save(); document.querySelectorAll('.eco-coins').forEach(el => { el.textContent = S.coins; }); subs.forEach(f => { try { f(); } catch (e) { } }); if (ov) refresh(); };
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

    let taxMult = (() => { const v = localStorage.getItem('vk_taxmult'); return v !== null && !isNaN(+v) ? +v : 1; })();
    function getNextTaxAmount() {
        let invVal = 0;
        Object.keys(S.stocks).forEach(id => {
            const st = STOCKS.find(x => x.id === id);
            if (st) invVal += price(st) * S.stocks[id].q;
        });
        const netWorth = S.coins + invVal;
        let taxRate = 0;
        if (netWorth >= 50000000) taxRate = 0.50;
        else if (netWorth >= 20000000) taxRate = 0.40;
        else if (netWorth >= 10000000) taxRate = 0.30;
        else if (netWorth >= 2000000) taxRate = 0.20;
        else if (netWorth >= 500000) taxRate = 0.12;
        else if (netWorth >= 100000) taxRate = 0.05;

        return { netWorth, taxRate, taxDue: Math.round(netWorth * taxRate * 0.05 * taxMult) };
    }

    const add = (n, why) => { n = Math.round(n); if (!n) return; S.coins = Math.max(0, S.coins + n); changed(); if (why) toast(`🪙 ${n > 0 ? '+' : ''}${n} ${why}`); };

    function checkTaxAndDividend() {
        const now = Date.now();
        if (!S.lastDividend || now - S.lastDividend > 180000) {
            S.lastDividend = now;
            let totalDiv = 0;
            Object.keys(S.stocks).forEach(id => {
                const st = STOCKS.find(x => x.id === id);
                const h = S.stocks[id];
                if (st && h && st.div > 0) {
                    totalDiv += Math.floor(price(st) * h.q * st.div);
                }
            });
            if (totalDiv > 0) {
                S.coins += totalDiv;
                save();
                setTimeout(() => toast(`💵 【企業配息】獲得現金股利 +${totalDiv.toLocaleString()} 🪙`), 500);
            }
        }

        const d = new Date(), k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        if (S.lastTax === k) return;
        S.lastTax = k;

        const taxInfo = getNextTaxAmount();
        if (taxInfo.taxRate > 0) {
            S.coins = Math.max(0, S.coins - taxInfo.taxDue);
            save();
            setTimeout(() => {
                toast(`🏛️ 國稅局通知：總資產 ${Math.round(taxInfo.netWorth).toLocaleString()} 🪙，扣繳最高稅率資產稅 -${taxInfo.taxDue.toLocaleString()} 🪙`);
            }, 1000);
        }
    }

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
        if (S.coins < it.price) return toast('金幣不夠喔！');
        S.coins -= it.price; S.items[id] = 1;
        if (it.cat !== 'chat') S.equip[it.cat] = it.ref;
        changed(); toast(`✅ 已購買 ${it.name}`);
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
        if (S.lastDaily === k) return; S.lastDaily = k; add(50, '每日登入獎勵');
        checkTaxAndDividend();
    }

    // ---------- 高效能零迴圈隨機遊走引擎 ----------
    const hash = n => { n = n | 0; n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; };

    function updateMarketNews() {
        const nowMin = Math.floor(Date.now() / 60000);
        if (nowMin % 3 === 0) {
            const events = [
                {
                    title: "🔥 【突發利多】央行宣佈降息釋放資金，股市全面噴出！",
                    detail: "央行無預警宣佈調降利率半碼，市場熱錢湧入。分析師指出，科技股與高槓桿標的將迎來強勁反彈，但同時須提防短線過熱後的泡沫風險。",
                    impact: 1
                },
                {
                    title: "🚨 【重大利空】爆發信任危機，主力大戶集體恐慌性拋售！",
                    detail: "市場傳出部分造市商流動性枯竭，引發骨牌效應。多檔熱門標的遭到融資斷頭與停損賣壓夾擊，短線建議保守觀望，嚴控部位。",
                    impact: -1
                },
                {
                    title: "⚡ 【行業黑天鵝】監管機構突擊檢查，市場面臨劇烈震盪！",
                    detail: "相關主管機關無預警針對虛擬貨幣與高風險衍生性金融商品展開嚴查，市場恐慌情緒急速升溫，短線多空交戰異常激烈。",
                    impact: -1
                },
                {
                    title: "💎 【財報大捷】各大龍頭企業營收超預期，買盤強勢湧入！",
                    detail: "本季財報表現亮眼，特別是科技與基礎建設板塊營收超越市場預期。法人機構持續買超，帶動整體大盤向上突破。",
                    impact: 1
                },
                {
                    title: "📉 【流動性危機】市場資金乾涸，短線面臨持續下殺壓力。",
                    detail: "受到國際政經局勢影響，市場觀望氣氛濃厚，成交量持續萎縮。多頭缺乏追價意願，盤勢呈現量縮震盪下行格局。",
                    impact: -1
                },
                {
                    title: "📊 市場震盪整理，多空雙方在關鍵技術位激烈拉鋸。",
                    detail: "多空雙方於目前價位區間展開拉鋸戰，無明顯單邊趨勢。法人建議採取區間操作，並隨時關注最新財經動向。",
                    impact: 0
                }
            ];
            const ev = events[Math.floor(hash(nowMin * 99) * events.length)];
            activeNews = { title: ev.title, detail: ev.detail, impact: ev.impact, time: "剛剛更新" };
        }
    }

    function pAt(st, m) {
        const i = STOCKS.indexOf(st) + 1;
        const t1 = Math.floor(m / 30);
        const t2 = Math.floor(m / 360);

        const r1 = hash(t1 * 131 + i * 977) - 0.48;
        const r2 = hash(t2 * 73 + i * 311) - 0.5;
        const noise = (hash(m * 7 + i * 37) - 0.5) * 0.2;

        const trend = r2 * 1.5 + r1 * 0.8 + noise + (activeNews.impact * 0.12);
        return Math.max(0.05, st.base * Math.exp(trend * st.vol));
    }

    function price(st, tms = Date.now()) {
        updateMarketNews();
        const m = tms / 60000, a = Math.floor(m), f = m - a;
        const curP = pAt(st, a) * (1 - f) + pAt(st, a + 1) * f;
        checkLiquidationAndStopLoss(st, curP);
        return curP;
    }

    function checkLiquidationAndStopLoss(st, curP) {
        const h = S.stocks[st.id];
        if (!h) return;

        const avgBuyPrice = h.cost / h.q;
        const lev = h.lev || 1;
        const lossRatio = (avgBuyPrice - curP) / avgBuyPrice;
        const liquidationThreshold = 0.85 / lev;

        if (lossRatio >= liquidationThreshold) {
            delete S.stocks[st.id];
            save();
            setTimeout(() => {
                toast(`💥 【強制爆倉】${st.name} 觸發 ${lev}x 槓桿平倉線，保證金歸零！`);
            }, 200);
            return;
        }

        if (h.sl && h.sl > 0 && curP <= h.sl) {
            const get = Math.floor(curP * h.q * (1 - FEE));
            S.coins += get;
            delete S.stocks[st.id];
            save();
            setTimeout(() => {
                toast(`⚠️ 【停損觸發】${st.name} 已自動平倉！拿回 ${get} 🪙`);
            }, 200);
        }
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
        const baseP = price(st);

        if (side === 'buy') {
            const slippageP = baseP * (1 + (qty * 0.0005));
            const totalValue = slippageP * qty;
            const marginCost = Math.ceil((totalValue / leverage) * (1 + FEE));

            if (S.coins < marginCost) return toast('金幣不足以支付保證金！');

            S.coins -= marginCost;
            const curH = S.stocks[id] || { q: 0, cost: 0, lev: leverage, sl: 0 };
            curH.q += qty;
            curH.cost += marginCost;
            curH.lev = leverage;
            curH.sl = stopLoss;
            S.stocks[id] = curH;
            changed();
            toast(`📈 [${leverage}x槓桿] 買進 ${st.name} ${qty} 單位，支付保證金 ${marginCost} 🪙`);
        } else {
            const curH = S.stocks[id];
            if (!curH || curH.q <= 0) return toast('你沒有持有此資產');
            qty = Math.min(qty, curH.q);

            const sellSlippage = Math.max(0.7, 1 - (qty * 0.001));
            const actualSellPrice = baseP * sellSlippage;

            const costPortion = curH.cost * (qty / curH.q);
            const avgBuyPrice = (curH.cost / curH.q);
            const profitLoss = (actualSellPrice - avgBuyPrice) * qty * curH.lev;
            const finalReturn = Math.max(0, Math.round(costPortion + profitLoss));

            S.coins += finalReturn;
            curH.q -= qty;
            curH.cost -= costPortion;

            if (curH.q <= 0) delete S.stocks[id];
            else S.stocks[id] = curH;

            changed();
            toast(`💵 賣出 ${st.name} ${qty} 單位，拿回 ${finalReturn} 🪙`);
        }
    }

    function spark(st) {
        const now = Date.now(), pts = []; for (let k = 60; k >= 0; k -= 2) pts.push(price(st, now - k * 60000));
        const mn = Math.min(...pts), mx = Math.max(...pts), rg = mx - mn || 1;
        const d = pts.map((v, i) => `${(i / (pts.length - 1) * 100).toFixed(1)},${(22 - (v - mn) / rg * 20).toFixed(1)}`).join(' ');
        const up = pts[pts.length - 1] >= pts[0];
        return `<svg viewBox="0 0 100 24" preserveAspectRatio="none" class="eco-spark"><polyline fill="none" stroke="${up ? '#dc2626' : '#16a34a'}" stroke-width="2" points="${d}"/></svg>`;
    }

    let ov = null, tab = 'shop', marketSubTab = 'stock', detailFrom = 'market', timer = null, sel = null, range = '1d', qty = 1, selT = 0, currentLev = 1, stopLossVal = '';
    const css = `
.eco-ov{position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:10px}
.eco-box{background:var(--card,#fff);color:var(--text,#111);width:min(96vw,680px);height:78vh;max-height:78vh;border-radius:18px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px #0007}
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
        return `<div class="eco-note">💡 地獄難度警示：價格零保底隨機遊走，開高槓桿若遇逆勢將直接「強制爆倉」！</div>
            ${sec('🎯 麻將投擲物', 'throw')}${sec('🪑 牌桌主題', 'felt')}${sec('💬 麻將快捷語包', 'chat')}`;
    }

    const pct = (a, b) => `<span class="${a >= b ? 'eco-up' : 'eco-dn'}">${a >= b ? '▲' : '▼'} ${Math.abs((a / b - 1) * 100).toFixed(1)}%</span>`;

    function marketHtml() {
        if (sel) return detailHtml(STOCKS.find(x => x.id === sel));

        const ticker = `<div class="eco-news-ticker" data-open-news="1"><span>📰 <b>即時商業快訊 (點擊看詳情)：</b></span><span style="color:#fde047; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${activeNews.title}</span></div>`;

        const subTabs = `<div class="eco-subtabs">
            <button class="${marketSubTab === 'stock' ? 'on' : ''}" data-msub="stock">📊 股票</button>
            <button class="${marketSubTab === 'fund' ? 'on' : ''}" data-msub="fund">🏛️ 基金/配息</button>
            <button class="${marketSubTab === 'crypto' ? 'on' : ''}" data-msub="crypto">🪙 幣圈(高風險)</button>
        </div>`;

        const list = STOCKS.filter(s => s.cat === marketSubTab);

        const rows = list.map(st => {
            const p = price(st), p0 = price(st, Date.now() - 3600000), h = S.stocks[st.id];
            const hold = h ? `持有 ${h.q} 單位 (${h.lev}x)・市值 ${Math.floor(p * h.q)} 🪙` : '尚未持有';
            return `<div class="eco-st click" data-sel="${st.id}"><div class="l"><b>${st.id}</b><small>${esc(st.name)}</small><div><b>🪙 ${p.toFixed(1)}</b> ${pct(p, p0)} <small>近 1 小時</small></div></div>${spark(st)}<div class="hold">${hold} <span class="eco-go" data-sel="${st.id}">詳細資料 ›</span></div></div>`;
        }).join('');

        let modalHtml = '';
        if (showNewsModal) {
            modalHtml = `<div class="eco-modal" data-close-news="1">
                <div class="eco-modal-box">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <b style="font-size:16px;">📰 商業焦點新聞深度解析</b>
                        <button class="eco-x" data-close-news="1">✕</button>
                    </div>
                    <div style="font-weight:bold; color:#f59e0b; font-size:14px;">${activeNews.title}</div>
                    <div class="eco-note" style="line-height:1.6; font-size:13px;">${activeNews.detail}</div>
                    <div style="font-size:11px; color:var(--muted,#666); text-align:right;">發布時間：${activeNews.time}</div>
                    <button class="eco-b" data-close-news="1" style="margin-top:4px;">了解，關閉視窗</button>
                </div>
            </div>`;
        }

        return `${ticker}${subTabs}<div class="eco-note">市場波動受新聞影響，買賣均收 1% 手續費與滑價懲罰。</div>${rows}${modalHtml}`;
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
                const val = Math.floor(curP * h.q);
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
        const totalNetWorth = S.coins + totalInvestment;
        const totalPL = Math.round(totalInvestment - totalCost);

        return `<div class="eco-wallet-card">
            <div class="eco-wallet-title">帳戶總資產淨值 (Net Worth)</div>
            <div class="eco-wallet-num">🪙 ${totalNetWorth}</div>
            <div class="eco-wallet-grid">
                <div class="eco-wallet-subbox"><span>可用金幣</span><b>🪙 ${S.coins}</b></div>
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

        ${sectionsHtml}`;
    }

    function detailHtml(st) {
        const p = price(st), h = S.stocks[st.id], mins = RANGES[range][0];
        const q = Math.max(1, qty | 0);

        const totalValue = p * q;
        const marginCost = Math.ceil((totalValue / currentLev) * (1 + FEE));
        const maxBuy = Math.max(1, Math.floor((S.coins * currentLev) / (p * (1 + FEE))));
        const get = Math.floor(p * q * (1 - FEE));

        let hold = '<div class="eco-box2"><b>我的持股</b><div class="eco-note">尚未持有</div></div>';
        if (h) {
            const val = p * h.q, mx = Math.max(val, h.cost) || 1, win = val >= h.cost;
            hold = `<div class="eco-box2"><b>我的持股 <small>${h.q} 單位 (${h.lev}x 槓桿)</small></b>
                <div class="eco-hb"><small>成本</small><div class="bar"><i style="width:${(h.cost / mx * 100).toFixed(1)}%;background:#64748b"></i></div><b>${Math.round(h.cost)}</b></div>
                <div class="eco-hb"><small>市值</small><div class="bar"><i style="width:${(val / mx * 100).toFixed(1)}%;background:${win ? '#ef4444' : '#22c55e'}"></i></div><b>${Math.round(val)}</b></div>
                <div class="${win ? 'eco-up' : 'eco-dn'}" style="text-align:right">${win ? '+' : ''}${Math.round(val - h.cost)} 🪙（${((val / h.cost - 1) * 100).toFixed(1)}%）</div>
                ${h.sl ? `<div style="font-size:11px; color:#dc2626; margin-top:2px;">⚠️ 停損價：<b>${h.sl}</b></div>` : ''}</div>`;
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
                        <span style="color:#f59e0b; font-size:14px;" class="eco-lev-val">${currentLev}x</span>
                    </div>
                    <input type="range" min="1" max="20" step="1" value="${currentLev}" class="eco-lev-slider" style="width:100%; cursor:pointer; accent-color:#f59e0b;">
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
                    <button class="eco-b alt" data-qset="${maxBuy}" style="flex:1; padding:6px 4px; font-size:12px;">最多可買 ${maxBuy} 單位</button>
                    ${h ? `<button class="eco-b alt" data-qset="${h.q}" style="flex:1; padding:6px 4px; font-size:12px;">全部持股 ${h.q} 單位</button>` : ''}
                </div>

                <div style="font-size:12px; color:var(--muted,#666); background:var(--surface,#f1f5f9); padding:6px 10px; border-radius:8px; line-height:1.4; text-align:center;">
                    <div>🛒 買進保證金：<b>${marginCost} 🪙</b></div>
                    <div>💰 賣出拿回估算：<b>${get} 🪙</b></div>
                </div>

                <div class="eco-qrow" style="margin-top:2px;">
                    <button class="eco-b" data-do="buy" style="flex:1; padding:8px;" ${S.coins < marginCost ? 'disabled' : ''}>買進 ${q} 單位</button>
                    <button class="eco-b sell" data-do="sell" style="flex:1; padding:8px;" ${h ? '' : 'disabled'}>賣出 ${q} 單位</button>
                </div>
            </div>`;
    }

    function refresh() {
        if (!ov) return;
        if (document.activeElement && document.activeElement.classList.contains('eco-qty') && !document.activeElement.classList.contains('eco-sl-input')) return;
        const body = ov.querySelector('.eco-body'), top = body.scrollTop;
        ov.querySelector('.bal span').textContent = S.coins;
        ov.querySelectorAll('.eco-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));

        if (tab === 'shop') body.innerHTML = shopHtml();
        else if (tab === 'market') body.innerHTML = marketHtml();
        else if (tab === 'account') body.innerHTML = accountHtml();

        body.scrollTop = top;
    }

    let transferring = false;
    async function doTransfer() {
        if (!ov || transferring) return;
        const toInput = ov.querySelector('#eco-transfer-to'), amtInput = ov.querySelector('#eco-transfer-amt');
        const friendName = toInput ? toInput.value.trim() : '', amt = parseInt(amtInput ? amtInput.value : 0, 10) || 0;
        if (!friendName) return toast('請輸入好友名稱！');
        if (amt <= 0) return toast('請輸入有效金額！');
        if (S.coins < amt) return toast('金幣不足！');
        if (typeof World === 'undefined' || !World.findPlayer) return toast('轉帳需要世界地圖模組（world.js）');
        transferring = true; toast('轉帳中…');
        try {
            const who = await World.findPlayer(friendName);
            if (!who.ok) return toast(who.msg);
            S.coins -= amt; save(); changed();
            try { await World.sendCoins(who.uid, amt); }
            catch (err) { S.coins += amt; save(); changed(); throw err; }
            if (toInput) toInput.value = ''; if (amtInput) amtInput.value = '';
            toast(`✅ 已轉帳 ${amt.toLocaleString()} 🪙 給「${who.name}」，對方下次開遊戲就會收到`);
            refresh();
        } catch (err) { toast('轉帳失敗：' + (err && err.message ? err.message : err)); }
        finally { transferring = false; }
    }

    function open(t) {
        close(); tab = t || 'shop'; sel = null; currentLev = 1; stopLossVal = ''; showNewsModal = false;
        ov = document.createElement('div'); ov.className = 'eco-ov';
        ov.innerHTML = `<div class="eco-box" style="position:relative;">
            <div class="eco-head">
                <div class="bal">🪙 <span>${S.coins}</span></div>
                <div class="eco-tabs">
                    <button data-tab="shop">🛒 商店</button>
                    <button data-tab="market">股市</button>
                    <button data-tab="account">我的帳戶</button>
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
            if (e.target.closest('[data-close-news]')) {
                showNewsModal = false;
                return refresh();
            }

            const tb = e.target.closest('[data-tab]');
            if (tb) { tab = tb.dataset.tab; sel = null; showNewsModal = false; return refresh(); }
            const ms = e.target.closest('[data-msub]'); if (ms) { marketSubTab = ms.dataset.msub; sel = null; return refresh(); }

            if (e.target.closest('[data-action="transfer"]')) return doTransfer();

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
                if (targetStock) marketSubTab = targetStock.cat;
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
            const dq = e.target.closest('[data-q]'); if (dq) { qty = Math.max(1, (qty | 0) + +dq.dataset.q); return refresh(); }
            const sq = e.target.closest('[data-qset]'); if (sq) { qty = Math.max(1, +sq.dataset.qset); return refresh(); }

            const dd = e.target.closest('[data-do]');
            if (dd && sel) {
                const slInput = ov.querySelector('.eco-sl-input');
                const slNum = slInput && slInput.value !== '' ? parseFloat(slInput.value) || 0 : 0;
                return trade(sel, dd.dataset.do, Math.max(1, qty | 0), currentLev, slNum);
            }

            const by = e.target.closest('[data-buy]'); if (by) return buy(by.dataset.buy);
            const eq = e.target.closest('[data-eq]'); if (eq) { const [c, r] = eq.dataset.eq.split(':'); return void equip(c, r); }
        });

        ov.addEventListener('input', e => {
            if (e.target.classList.contains('eco-lev-slider')) {
                currentLev = parseInt(e.target.value) || 1;
                const levText = ov.querySelector('.eco-lev-val');
                if (levText) levText.textContent = currentLev + 'x';

                const p = price(STOCKS.find(x => x.id === sel));
                const totalValue = p * Math.max(1, qty | 0);
                const marginCost = Math.ceil((totalValue / currentLev) * (1 + FEE));
                const maxBuyVal = Math.max(1, Math.floor((S.coins * currentLev) / (p * (1 + FEE))));

                const marginEl = ov.querySelector('.eco-box2 div:nth-last-child(2) div:nth-child(1) b');
                if (marginEl) marginEl.textContent = marginCost + ' 🪙';

                const maxBuyBtn = ov.querySelector('[data-qset]');
                if (maxBuyBtn && maxBuyBtn.dataset.qset !== undefined) {
                    maxBuyBtn.dataset.qset = maxBuyVal;
                    maxBuyBtn.textContent = `最多可買 ${maxBuyVal} 單位`;
                }
            } else if (e.target.classList.contains('eco-qty') && !e.target.classList.contains('eco-sl-input')) {
                qty = Math.max(1, Math.floor(+e.target.value) || 1);
            } else if (e.target.classList.contains('eco-sl-input')) {
                stopLossVal = e.target.value;
                const slNum = stopLossVal !== '' ? parseFloat(stopLossVal) || 0 : 0;
                if (sel && S.stocks[sel]) { S.stocks[sel].sl = slNum; save(); }
            }
        });

        ov.addEventListener('keydown', e => {
            if (e.key !== 'Enter') return; const id = e.target.id;
            if (id === 'eco-transfer-to') { e.preventDefault(); const a = ov.querySelector('#eco-transfer-amt'); if (a) a.focus(); }
            else if (id === 'eco-transfer-amt') { e.preventDefault(); e.target.blur(); doTransfer(); }
            else if (e.target.classList && e.target.classList.contains('eco-qty')) { e.preventDefault(); e.target.blur(); }
        });
        ov.addEventListener('focusout', e => { if (e.target.classList && e.target.classList.contains('eco-qty') && !e.target.classList.contains('eco-sl-input')) refresh(); });

        refresh();
        timer = setInterval(() => { if (tab === 'market' || sel) refresh(); }, 4000);
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
        setTaxMult: m => { taxMult = m; try { localStorage.setItem('vk_taxmult', m); } catch (e) { } }, taxMult: () => taxMult,
        stocks: () => STOCKS,
        stockPrice: st => price(st),
        run: () => run,
        runReset: () => { run = 0; },
        THROWS, FELTS, CHAT_PACKS,
        coins: () => S.coins, add,
        owned, equipped, equip, throwIdx, onAnswer, onMj, onWord, open, close,
        onChange: f => subs.push(f),
        init
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();