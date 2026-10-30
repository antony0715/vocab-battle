// ==================== 世界地圖第二階段 (trade.js)：生產 / 商店 / 玩家市場 ====================
// 依賴：firebase、Economy、esc；由 world.js 傳入 ctx = {uid, say, refresh, name, root}
// 背包 world/inv/<uid>/<item>、市場掛單 world/market/<id>、賣家收入信箱 world/mail/<uid>/<id>
const Trade = (() => {
    const IT = { // [圖示, 名稱, 參考價]
        rice: ['🌾', '稻米', 8], wheat: ['🌿', '小麥', 10], veg: ['🥬', '蔬菜', 12], tea: ['🍃', '茶葉', 20], fruit: ['🍎', '水果', 40], cotton: ['☁️', '棉花', 18], coffee: ['☕', '咖啡豆', 28], milk: ['🥛', '牛奶', 22], grape: ['🍇', '葡萄', 35],
        sand: ['⛏️', '砂石', 6], ore: ['🪨', '礦石', 14], wood: ['🪵', '木材', 9], coal: ['⚫', '煤炭', 11], goldore: ['🥇', '金礦', 45],
        cement: ['🧱', '水泥', 15], steel: ['🔩', '鋼筋', 35], glass: ['🪟', '玻璃', 30], furniture: ['🪑', '家具', 70], book: ['📚', '書本', 55], clothes: ['👕', '衣服', 75],
        bread: ['🍞', '麵包', 30], bento: ['🍱', '便當', 40], cake: ['🎂', '蛋糕', 85], tdrink: ['🧋', '茶飲', 60], juice: ['🥤', '果汁', 130], latte: ['🍵', '拿鐵', 90], wine: ['🍷', '紅酒', 200],
        watch: ['⌚', '手錶', 250], gem: ['💎', '鑽石', 500], ring: ['💍', '金戒指', 650], car: ['🏎️', '跑車', 900] };
    const WORK = { // [名稱, 分鐘, 基本產量, 金幣費用, 需要的原料]
        rice: ['種稻米', 3, 3, 8], wheat: ['種小麥', 4, 3, 8], veg: ['種蔬菜', 5, 3, 10], tea: ['種茶葉', 10, 4, 30], fruit: ['種水果', 20, 5, 70], cotton: ['種棉花', 8, 3, 18], coffee: ['種咖啡', 12, 3, 35], milk: ['養乳牛', 10, 3, 28], grape: ['種葡萄', 18, 4, 60],
        sand: ['採砂石', 4, 4, 5], ore: ['採礦石', 10, 3, 15], wood: ['伐木', 6, 4, 8], coal: ['採煤', 8, 4, 12], goldore: ['採金礦', 25, 2, 70],
        cement: ['燒水泥', 5, 4, 10, { sand: 2, coal: 1 }], steel: ['煉鋼筋', 15, 4, 25, { ore: 3, coal: 1 }], glass: ['燒玻璃', 8, 3, 15, { sand: 3, coal: 1 }],
        furniture: ['做家具', 12, 2, 25, { wood: 3 }], book: ['印書', 10, 3, 20, { wood: 2 }], clothes: ['製衣服', 14, 2, 25, { cotton: 3 }],
        bread: ['烤麵包', 4, 2, 10, { wheat: 2 }], bento: ['做便當', 6, 2, 12, { rice: 2, veg: 1 }], cake: ['烘蛋糕', 10, 2, 25, { wheat: 2, milk: 1 }], tdrink: ['做茶飲', 8, 2, 20, { tea: 2 }], juice: ['榨果汁', 15, 2, 40, { fruit: 2 }], latte: ['煮拿鐵', 12, 2, 30, { coffee: 2, milk: 1 }], wine: ['釀紅酒', 30, 2, 60, { grape: 4 }],
        watch: ['製手錶', 20, 1, 40, { steel: 2, goldore: 1 }], gem: ['琢磨鑽石', 30, 1, 60, { ore: 6, steel: 1 }], ring: ['打造金戒指', 25, 1, 50, { goldore: 2, gem: 1 }], car: ['組裝跑車', 40, 1, 120, { steel: 5, glass: 2 }] };
    const USEW = { 3: ['rice', 'wheat', 'veg', 'tea', 'fruit', 'cotton', 'coffee', 'milk', 'grape'], 5: ['sand', 'ore', 'wood', 'coal', 'goldore'],
        2: ['cement', 'steel', 'glass', 'furniture', 'book', 'clothes', 'bread', 'bento', 'cake', 'tdrink', 'juice', 'latte', 'wine', 'watch', 'gem', 'ring', 'car'] };   // 農田 / 林地(礦山) / 工業
    const LUX = ['car', 'ring', 'gem', 'watch', 'wine'], GOODS = ['cake', 'latte', 'bento', 'bread', 'juice', 'tdrink', 'clothes', 'furniture', 'book', 'milk', 'fruit', 'coffee', 'grape', 'tea', 'veg', 'rice'], ZM = [1.5, 1.25, 1, .8, .8], FEE = .05;
    let INV = {}, MK = {}, SK = {}, C = null;
    const ROLE = { 1: ['🧑‍💼', '店員', 'clerk'], 2: ['🧑‍🏭', '技師', 'tech'], 3: ['🧑‍🌾', '農夫', 'farm'], 5: ['⛏️', '礦工', 'mine'] };
    const roleKey = u => ROLE[u][2], roleLbl = u => ROLE[u][0] + ROLE[u][1], lvOf = r => Math.min(10, Math.floor((SK[r] || 0) / 5));
    const db = () => firebase.database(), now = () => Date.now();
    const invRef = k => db().ref('world/inv/' + C.uid + (k ? '/' + k : ''));
    const label = k => IT[k][0] + IT[k][1];
    const mail = (u, c) => db().ref('world/mail/' + u).push({ c, t: now() });
    const addInv = (k, n) => invRef(k).transaction(x => (x || 0) + n).then(() => { INV[k] = (INV[k] || 0) + n; });
    const subInv = (k, n) => invRef(k).transaction(x => (x || 0) >= n ? x - n : undefined).then(r => { if (r.committed) INV[k] -= n; return r.committed; });

    // ----- 建材需求（給 world.js 蓋房子用）-----
    const inText = k => WORK[k][4] ? ' +' + Object.keys(WORK[k][4]).map(i => IT[i][0] + WORK[k][4][i]).join('') : '';
    const need = lv => ({ cement: lv, steel: Math.max(0, lv - 2), glass: Math.max(0, lv - 3) });   // 4 層以上要玻璃帷幕
    const has = n => Object.keys(n).every(k => (INV[k] || 0) >= n[k]);
    const needText = n => Object.keys(n).filter(k => n[k] > 0).map(k => IT[k][0] + n[k]).join(' ');
    const use = n => Promise.all(Object.keys(n).filter(k => n[k] > 0).map(k => subInv(k, n[k])));
    const invHtml = () => `<div style="margin-top:6px;font-size:13px;opacity:.8">🎒 ${Object.keys(IT).filter(k => INV[k] > 0).map(k => IT[k][0] + INV[k]).join('　') || '（空）'}</div>`;

    // ----- 載入背包 + 領取市場收入 -----
    async function load(ctx) {
        C = ctx; Civic.load(ctx).catch(() => { });
        const s = await invRef().once('value'); INV = s.val() || {}; SK = (await db().ref('world/skill/' + C.uid).once('value')).val() || {};
        let got = null; await db().ref('world/mail/' + C.uid).transaction(v => { got = v; return null; });
        const sum = got ? Object.values(got).reduce((a, m) => a + (m.c || 0), 0) : 0;
        if (sum > 0) { Economy.add(sum, '收入（市場成交／薪水）'); }
    }

    // ----- 地塊面板按鈕 -----
    function buttons(p, v) {
        const b = v.b || 0; let h = '';
        if (USEW[p.u]) {
            if (v.w) {
                const k = v.w.k, left = v.w.s + WORK[k][1] * 60000 - now();
                h += left > 0 ? `<button disabled>⏳ ${WORK[k][0]} 還要 ${Math.ceil(left / 60000)} 分</button>` : `<button data-a="t:h">收成 ${IT[k][0]}×${Math.round(WORK[k][2] * (1 + .5 * b) * (v.e ? 1.5 + .05 * (v.e.lv || 0) : 1))}</button>`;
            } else h += `<button data-a="t:m">🛠️ 選擇生產項目（${USEW[p.u].length} 種）</button>`;
        } else if (p.u === 1) {
            if (!v.c) h += '<button data-a="t:o">🏪 開張營業</button>';
            else {
                const n = custs(v); h += `<button data-a="t:s">賣給顧客（${n} 位在等）</button>`;
                h += v.d ? `<button data-a="t:ud">🖼️ 收回展品 ${IT[v.d][0]}</button>` : LUX.filter(k => INV[k] > 0).map(k => `<button data-a="t:d:${k}">🖼️ 展示${IT[k][0]}${IT[k][1]}</button>`).join('');
            }
        }
        if (USEW[p.u] || p.u === 1) h += !v.j ? '<button data-a="t:j">📢 徵人</button>' : !v.e ? `<button data-a="t:cj">取消徵人（薪水 ${v.j}）</button>` : `<button data-a="t:f">解雇 ${esc(v.e.n)} Lv${v.e.lv || 0}（薪水 ${v.j}）</button>`;
        if (USEW[p.u] || p.u === 1) h += v.s ? `<button disabled>🤝 ${esc(v.s.n)} 佔 ${v.s.pct}%</button>` : v.po ? `<button data-a="t:cpo">取消招募（${v.po.pct}% 要價 ${v.po.price}）</button>` : '<button data-a="t:po">🤝 招募合夥人</button>';
        return h;
    }
    // 員工：每次收成／結算，雇主付薪水並供 1 個稻米當伙食；付得出來才有 ×1.5 的產量／營收
    async function staff(v, say) {
        if (!v.e) return 1;
        const meal = ['rice', 'bread', 'bento'].find(k => INV[k] >= 1);
        if (Economy.coins() < v.j || !meal || !(await subInv(meal, 1))) { say('付不出薪水或沒有伙食（稻米、麵包或便當），員工沒幹活'); return 1; }
        Economy.add(-v.j, '員工薪水'); await db().ref('world/mail/' + v.e.u).push({ c: v.j, t: now() });
        if (v.e.r) db().ref('world/skill/' + v.e.u + '/' + v.e.r).transaction(x => (x || 0) + 1);   // 員工累積熟練度
        return 1.5 + .05 * (v.e.lv || 0);
    }
    const rate = v => ((v.b || 0) + 1) * 2 * (1 + (v.d ? IT[v.d][2] / 1000 : 0));   // 展示奢侈品會吸引更多客人
    const custs = v => Math.min(((v.b || 0) + 1) * 20, Math.floor((now() - v.c) / 60000 * rate(v)));

    // ----- 生產項目選單 -----
    function menu(p, v, S, ctx) {
        C = ctx; const b = v.b || 0, el = document.createElement('div');
        el.className = 'w-sheet'; el.style.zIndex = 7;
        el.innerHTML = '<div class="w-hd"><b>選擇生產項目</b><button class="w-x2" data-k="">✕</button></div>'
            + USEW[p.u].map(k => { const w = WORK[k], ok = has(w[4] || {}) && Economy.coins() >= w[3]; return `<div class="w-row">${IT[k][0]} <div><b>${IT[k][1]}</b><br><small>${w[1]}分 ×${Math.round(w[2] * (1 + .5 * b))}　參考價 ${IT[k][2]}　🪙${w[3]}${inText(k)}</small></div><span><button data-k="${k}" style="opacity:${ok ? 1 : .4}">開工</button></span></div>`; }).join('');
        el.onclick = e => { const k = e.target.dataset && e.target.dataset.k; if (k === undefined) return; el.remove(); if (k) act('t:p:' + k, p, S, C); };
        C.root.appendChild(el);
    }

    // ----- 地塊動作 -----
    async function act(a, p, S, ctx) {
        C = ctx; const [, op, arg] = a.split(':'), v = S[p.i], b = (v && v.b) || 0, say = C.say;
        const upd = fn => db().ref('world/parcels/' + p.i).transaction(x => x && x.o === C.uid ? fn(x) : undefined);
        try {
            if (op === 'm') return menu(p, v, S, C);
            if (op === 'p') {
                const cost = WORK[arg][3], inp = WORK[arg][4] || {}; if (Economy.coins() < cost) return say('金幣不夠買種子／原料');
                if (!has(inp)) return say('原料不夠：' + needText(inp) + '（去市場買或自己生產）');
                const r = await upd(x => x.w ? undefined : Object.assign({}, x, { w: { k: arg, s: now() } }));
                if (!r.committed) return say('現在不能開工'); S[p.i] = r.snapshot.val(); Economy.add(-cost, '購買種子／原料'); await use(inp); say('開工了！');
            } else if (op === 'h') {
                const k = v.w.k;
                const r = await upd(x => { if (!x.w || x.w.s + WORK[x.w.k][1] * 60000 > now()) return; const y = Object.assign({}, x); delete y.w; return y; });
                if (!r.committed) return say('還沒好喔'); S[p.i] = r.snapshot.val(); const n = Math.round(WORK[k][2] * (1 + .5 * b) * await staff(v, say)); let g = 0; if (v.s) { g = Math.floor(n * v.s.pct / 100); if (g) await db().ref('world/inv/' + v.s.u + '/' + k).transaction(x => (x || 0) + g); } await addInv(k, n - g); say(`收成 ${IT[k][0]}×${n}`);
            } else if (op === 'j') {
                const w = parseInt(prompt('開出的薪水？（每次收成／營業結算付一次，員工每次要吃 1 份稻米、麵包或便當；有員工產量、營收 ×1.5）'), 10); if (!(w > 0)) return;
                const r = await upd(x => Object.assign({}, x, { j: w })); if (r.committed) { S[p.i] = r.snapshot.val(); say('已張貼徵人啟事'); }
            } else if (op === 'd') {
                if (v.d) return say('先收回現有展品'); if (!(await subInv(arg, 1))) return say('背包沒有這件商品');
                const r = await upd(x => x.d ? undefined : Object.assign({}, x, { d: arg })); if (!r.committed) { await addInv(arg, 1); return say('無法展示'); }
                S[p.i] = r.snapshot.val(); say('已展示，吸引更多顧客！');
            } else if (op === 'ud') {
                let got; const r = await upd(x => { if (!x.d) return; got = x.d; const y = Object.assign({}, x); delete y.d; return y; });
                if (r.committed && got) { S[p.i] = r.snapshot.val(); await addInv(got, 1); say('已收回展品'); }
            } else if (op === 'po') {
                const pct = parseInt(prompt('出讓幾 % 的收益給合夥人？（1–49）'), 10), price = parseInt(prompt('合夥人入股要付你多少金幣？'), 10);
                if (!(pct >= 1 && pct <= 49 && price > 0)) return say('數字不正確');
                const r = await upd(x => x.s || x.po ? undefined : Object.assign({}, x, { po: { pct, price } })); if (r.committed) { S[p.i] = r.snapshot.val(); say('已張貼招募合夥人'); }
            } else if (op === 'cpo') {
                const r = await upd(x => { const y = Object.assign({}, x); if (y.s) return; delete y.po; return y; }); if (r.committed) S[p.i] = r.snapshot.val();
            } else if (op === 'cj' || op === 'f') {
                const r = await upd(x => { const y = Object.assign({}, x); if (op === 'cj' && y.e) return; delete y.j; delete y.e; return y; }); if (r.committed) S[p.i] = r.snapshot.val();
            } else if (op === 'o') {
                const r = await upd(x => Object.assign({}, x, { c: now() })); if (r.committed) { S[p.i] = r.snapshot.val(); say('開張了！過一會兒客人就會上門'); }
            } else if (op === 's') {
                let n = custs(v); if (n < 1) return say('還沒有客人上門');
                const plan = []; let rev = 0, sold = 0;
                GOODS.concat(LUX).filter(k => !LUX.includes(k) || p.z <= 1).sort((x, y) => IT[y][2] - IT[x][2]).forEach(k => { const q = Math.min(INV[k] || 0, n - sold); if (q > 0) { plan.push([k, q]); sold += q; rev += q * IT[k][2] * ZM[p.z] * (1 + .2 * b); } });
                if (!sold) return say('背包沒有商品可賣！');
                rev *= 1 + Math.min(.4, .05 * (plan.length - 1));   // 貨色越多樣，顧客越願意買
                for (const [k, q] of plan) if (!(await subInv(k, q))) return say('庫存不足');
                const avail = custs(v), r = await upd(x => Object.assign({}, x, { c: now() - (avail - sold) / rate(v) * 60000 }));
                if (r.committed) S[p.i] = r.snapshot.val(); rev *= await staff(v, say); if (v.s) { const g = Math.floor(rev * v.s.pct / 100); rev -= g; if (g) await mail(v.s.u, g); } Economy.add(Math.round(rev), `賣出 ${sold} 件商品`);
            }
        } catch (e) { say('連線失敗，請稍後再試'); }
        C.refresh();
    }

    // ----- 玩家市場 -----
    let SHEET = null;
    const close = () => { if (SHEET) { SHEET.el.remove(); SHEET = null; } if (C && C.sync) C.sync(); };
    const TITLES = { buy: '🛒 市場', sell: '🎒 背包（可掛單）', civ: '🏛️ 總統', jv: '🤝 合夥', job: '👷 人力' };
    async function market(ctx, start) {
        C = ctx; start = start || 'buy'; if (SHEET && SHEET.key === start) return close(); close(); let tab = start;
        const el = document.createElement('div'); el.className = 'w-sheet';
        C.root.appendChild(el); SHEET = { el, key: start };
        const pull = async () => { MK = (await db().ref('world/market').once('value')).val() || {}; draw(); };
        const jobRows = () => {
            const all = Object.entries(C.S()), mine = all.filter(([i, x]) => x.e && x.e.u === C.uid), open = all.filter(([i, x]) => x.j && !x.e && x.o !== C.uid);
            return '<div style="font-size:12px;opacity:.7;margin-bottom:6px">🎓 熟練度：' + Object.values(ROLE).map(r => r[0] + r[1] + ' Lv' + lvOf(r[2])).join('　') + '（每領 5 次薪水升 1 級，每級產量加成 +5%）</div>' + mine.map(([i, x]) => `<div class="w-row">${roleLbl(C.use(i))} 我在 #${i}（${C.info(i)}）打工　薪水 ${x.j}/次<span><button data-m="q:${i}">辭職</button></span></div>`).join('') + (open.map(([i, x]) => `<div class="w-row">${roleLbl(C.use(i))} #${i} ${C.info(i)}　薪水 <b>${x.j}</b>/次　<small>${esc(x.n)}</small><span><button data-m="j:${i}">應徵</button></span></div>`).join('') || '<div style="opacity:.6">目前沒有職缺</div>');
        };
        const draw = () => {
            const rows = tab === 'civ' || tab === 'jv' ? Civic.rows(tab, C) : tab === 'job' ? jobRows() : tab === 'buy'
                ? Object.entries(MK).sort((x, y) => x[1].p - y[1].p).map(([id, m]) => `<div class="w-row">${IT[m.i][0]} ${IT[m.i][1]} ×${m.q}　<b>${m.p}</b>🪙/個　<small>${esc(m.n)}</small><span>${m.u === C.uid ? `<button data-m="x:${id}">下架</button>` : `<button data-m="b:${id}:1">買1</button><button data-m="b:${id}:${m.q}">全買</button>`}</span></div>`).join('') || '<div style="opacity:.6">目前沒有掛單</div>'
                : Object.keys(IT).filter(k => INV[k] > 0).map(k => `<div class="w-row">${IT[k][0]} ${IT[k][1]} ×${INV[k]}　<small>參考價 ${IT[k][2]}</small><span><button data-m="l:${k}">掛單</button></span></div>`).join('') || '<div style="opacity:.6">背包是空的，去農田或工廠生產吧</div>';
            el.innerHTML = `<div class="w-hd"><b>${TITLES[start]}</b>${start === 'buy' || start === 'sell' ? `<button class="w-tab ${tab === 'buy' ? '' : 'off'}" data-m="t:buy">買</button><button class="w-tab ${tab === 'sell' ? '' : 'off'}" data-m="t:sell">賣</button>` : ''}<button class="w-x2" data-m="close">✕</button></div>${rows}<div style="font-size:12px;opacity:.6;margin-top:8px">成交時收 ${Math.round(Civic.fee() * 100)}% 交易稅（歸總統），賣家下次進入地圖時收到金幣</div>`;
        };
        el.onclick = async e => {
            const m = e.target.dataset && e.target.dataset.m; if (!m) return; const [op, a, n] = m.split(':');
            try {
                if (op === 'close') return close();
                if (['v', 'r', 'rt', 'jb'].includes(op)) { await Civic.handle(op, a, C); return draw(); }
                if (op === 'j' || op === 'q') {
                    const hire = op === 'j', me = Object.values(C.S()).some(x => x.e && x.e.u === C.uid);
                    if (hire && me) return C.say('你已經有工作了，先辭職才能換');
                    const r = await db().ref('world/parcels/' + a).transaction(x => { if (!x) return; if (hire) return x.j && !x.e && x.o !== C.uid ? Object.assign({}, x, { e: { u: C.uid, n: C.name(), r: roleKey(C.use(a)), lv: lvOf(roleKey(C.use(a))) } }) : undefined; if (x.e && x.e.u === C.uid) { const y = Object.assign({}, x); delete y.e; return y; } });
                    if (r.committed) { C.S()[a] = r.snapshot.val(); C.say(hire ? '應徵成功！每次雇主收成／結算你就領薪水' : '已辭職'); } else C.say('這份工作已被搶走');
                    return draw();
                }
                if (op === 't') { tab = a; return draw(); }
                if (op === 'b') {
                    const q = +n, l = MK[a]; if (!l) return pull(); const cost = l.p * q;
                    if (Economy.coins() < cost) return C.say('金幣不夠喔！');
                    const r = await db().ref('world/market/' + a).transaction(x => x && x.q >= q ? (x.q === q ? null : Object.assign({}, x, { q: x.q - q })) : undefined);
                    if (!r.committed) { C.say('已被買走或數量不足'); return pull(); }
                    Economy.add(-cost, `買入 ${IT[l.i][1]}×${q}`); await addInv(l.i, q);
                    const tx = Math.floor(cost * Civic.fee()); await mail(l.u, cost - tx); await Civic.tax(tx); pull();
                } else if (op === 'x') {
                    let got; const r = await db().ref('world/market/' + a).transaction(x => { if (x && x.u === C.uid) { got = x; return null; } });
                    if (r.committed && got) { await addInv(got.i, got.q); C.say('已下架'); } pull();
                } else if (op === 'l') {
                    const q = parseInt(prompt(`掛幾個${IT[a][1]}？（持有 ${INV[a]}）`), 10); if (!(q > 0) || q > INV[a]) return;
                    const p = parseInt(prompt(`每個賣幾金幣？（參考價 ${IT[a][2]}）`), 10); if (!(p > 0)) return;
                    if (!(await subInv(a, q))) return C.say('庫存不足');
                    await db().ref('world/market').push({ u: C.uid, n: C.name(), i: a, q, p }); C.say('掛單成功'); tab = 'buy'; pull();
                }
            } catch (err) { C.say('連線失敗，請稍後再試'); }
            C.refresh();
        };
        await pull();
    }
    const status = v => { const o = []; if (v.w) { const k = v.w.k, left = v.w.s + WORK[k][1] * 60000 - now(); o.push(left > 0 ? `⏳${IT[k][0]}${Math.ceil(left / 60000)}分` : `✅${IT[k][0]}可收成`); } if (v.c) o.push(`🏪${custs(v)}位客人`); if (v.d) o.push(`🖼️${IT[v.d][0]}`); if (v.s) o.push('🤝合夥'); if (v.e) o.push('👷員工'); if (v.j && !v.e) o.push('📢徵人'); if (v.ls) o.push('🏷️掛牌'); return o.join(' '); };
    const value = k => IT[k][2], emoji = k => IT[k][0], invValue = () => Object.keys(IT).reduce((a, k) => a + (INV[k] > 0 ? INV[k] * IT[k][2] : 0), 0);
    return { status, value, emoji, label, invValue, need, has, needText, use, invHtml, load, buttons, act, market, close, current: () => SHEET && SHEET.key };
})();
