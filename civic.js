// ==================== 總統選舉 + 合資經營 (civic.js) ====================
// 每週一屆：本週的票數決定「下週」的總統。總統可調 0–10% 的市場交易稅，稅金歸總統（寄到他的信箱）。
// 合資：地主可出讓某塊生產地／商店的 pct% 收益給合夥人，合夥人入股時付錢給地主。
// 資料：world/elect/<週>/cand/<uid> {n,v}、world/elect/<週>/voted/<uid>、world/rate/<週> {u,r}
// Firebase 的 transaction 第一次呼叫時，本機若沒有快取資料會拿到 null；這時若回傳 undefined 就會直接中止，
// 造成「無法開工／掛牌／賣出／建造」。這裡先訂閱該節點把資料抓進快取，交易才會拿到真正的資料。
function wrapRef(r) {
    const orig = r.transaction.bind(r);
    r.transaction = async (fn, cb, apply) => {
        // 每次交易帶一個操作編號 _op；網路中斷後重試時，若發現資料已經帶著這個編號，代表上一次其實已成功寫入，直接當作成功
        const op = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const wrapped = v => { if (v && typeof v === 'object' && v._op === op) return v; const res = fn(v); if (res && typeof res === 'object' && !Array.isArray(res)) res._op = op; return res; };
        let err;
        for (let i = 0; i < 3; i++) {
            const h = () => { }; r.on('value', h);
            try { await r.once('value'); return await orig(wrapped, cb, apply); }
            catch (e) { err = e; await new Promise(k => setTimeout(k, 700 * (i + 1))); }
            finally { r.off('value', h); }
        }
        throw err;
    };
    return r;
}
// ==================== 總統選舉、稅率、政策、演說 + 合資經營 (civic.js) ====================
// 每週一屆：本週的票數決定「下週」的總統。總統每週可設定（存在 world/rate/<週>）：
//   市場交易稅 r、土地交易稅 l、商店營業稅 b（都歸總統）、全體玩家的資產稅倍率 tm、最多 2 項政策 pol、一段演說 sp。
// 合資：地主可出讓某塊生產地／商店的 pct% 收益給合夥人，合夥人入股時付錢給地主。
const Civic = (() => {
    const db = () => ({ ref: p => wrapRef(firebase.database().ref(p)) }), now = () => Date.now(), WEEK = 7 * 864e5, T = () => Math.floor(now() / WEEK);
    const val = p => db().ref('world/' + p).once('value').then(s => s.val());
    const POLS = { farm: ['🌾', '農業補貼', '種植費用 −50%'], mine: ['⛏️', '礦業扶持', '採礦伐木費用 −50%'], build: ['🏗️', '建設獎勵', '蓋房金幣費用 −30%'], shop: ['🏪', '商業振興', '商店營收 +15%'], gov: ['🛒', '平價政府', '政府商店價格 ×2（原 ×3）'] };
    const DEF = () => ({ r: .05, l: .05, b: 0, tm: 1, pol: {}, sp: '' });
    const RANGE = { r: [0, .1, .01], l: [0, .1, .01], b: [0, .15, .01], tm: [0, 2, .25] };
    let M = null, RT = DEF(), CAND = {}, VOTED = null;

    async function load(C) {
        const [prev, cur, voted, rate] = await Promise.all([val('elect/' + (T() - 1) + '/cand'), val('elect/' + T() + '/cand'), val('elect/' + T() + '/voted/' + C.uid), val('rate/' + T())]);
        const w = Object.entries(prev || {}).sort((a, b) => (b[1].v || 0) - (a[1].v || 0))[0];
        M = w ? { u: w[0], n: w[1].n } : null; CAND = cur || {}; VOTED = voted;
        RT = Object.assign(DEF(), M && rate && rate.u === M.u ? rate : {}); RT.pol = RT.pol || {};
        if (typeof Economy !== 'undefined' && Economy.setTaxMult) Economy.setTaxMult(RT.tm);   // 全體玩家的資產稅倍率
    }
    const fee = () => RT.r, landFee = () => RT.l, bizTax = () => RT.b, taxMult = () => RT.tm, pol = k => !!RT.pol[k];
    const speech = () => M && RT.sp ? { n: M.n, t: RT.sp } : null;
    const tax = amt => M && amt > 0 ? db().ref('world/mail/' + M.u).push({ c: amt, t: now() }) : Promise.resolve();
    const pct = v => Math.round(v * 100) + '%';

    function rows(tab, C) {
        if (tab === 'civ') {
            const mine = M && M.u === C.uid, ctl = (k, label) => `<div class="w-row"><div class="lrm"><b>${label[0]}</b><small>${label[1]}</small></div><div class="lrp">${k === 'tm' ? '×' + RT.tm : pct(RT[k])}</div>${mine ? `<span><button data-m="tx:${k}:-1">−</button><button data-m="tx:${k}:1">＋</button></span>` : ''}</div>`;
            let h = `<div class="w-row" style="align-items:flex-start"><div class="lri">${M ? '🧑‍⚖️' : '🏛️'}</div><div class="lrm"><b>${M ? esc(M.n) : '（尚無總統）'}${mine ? '（你）' : ''}</b><small>本週總統　${M ? '' : '還沒有人當選，使用預設稅率'}</small>${RT.sp ? `<div style="margin-top:6px;font-size:13px;line-height:1.6">📣 「${esc(RT.sp)}」</div>` : (M ? '<small>尚未發表演說</small>' : '')}</div>${mine ? '<span><button data-m="sp:0">📣 演說</button></span>' : ''}</div>`;
            h += '<div class="w-sub">💰 稅率（全體玩家適用）</div>' + ctl('r', ['市場交易稅', '玩家市場成交時收取，歸總統']) + ctl('l', ['土地交易稅', '玩家之間買賣掛牌土地時收取，歸總統']) + ctl('b', ['商店營業稅', '商店賣給顧客的營收被抽成，歸總統']) + ctl('tm', ['資產稅倍率', '國稅局每日資產稅 × 此倍率（0 = 免稅）']);
            const act = Object.keys(POLS).filter(k => pol(k));
            h += `<div class="w-sub">📜 本週政策（最多 2 項${mine ? '，點選切換' : ''}）</div><div class="w-chips">` + Object.keys(POLS).map(k => { const P = POLS[k]; return mine ? `<button class="w-chip ${pol(k) ? 'on' : ''}" data-m="pl:${k}:0">${P[0]} ${P[1]}　${P[2]}</button>` : (pol(k) ? `<span class="w-chip on">${P[0]} ${P[1]}　${P[2]}</span>` : ''); }).join('') + (!mine && !act.length ? '<small>目前沒有政策</small>' : '') + '</div>';
            h += '<div class="w-sub">🗳️ 下屆選舉（每週一屆，本週票數最高者下週上任）</div>';
            return h + (CAND[C.uid] ? '' : '<div class="w-row">想當總統？<span><button data-m="r:0">參選（報名費 500🪙）</button></span></div>')
                + (Object.entries(CAND).sort((a, b) => (b[1].v || 0) - (a[1].v || 0)).map(([u, c]) => `<div class="w-row">${esc(c.n)}　${c.v || 0} 票<span>${VOTED ? (VOTED === u ? '✅ 已投' : '') : `<button data-m="v:${u}">投票</button>`}</span></div>`).join('') || '<div class="w-empty">還沒有人參選</div>');
        }
        const all = Object.entries(C.S()), mine = all.filter(([i, x]) => x.s && x.s.u === C.uid), open = all.filter(([i, x]) => x.po && !x.s && x.o !== C.uid);
        return '<div style="font-size:12px;opacity:.7;margin-bottom:6px">入股後，該地每次收成／營業，你按比例分到成果（農作物進背包、營收進信箱）。</div>'
            + mine.map(([i, x]) => `<div class="w-row">🤝 我持有 #${i}（${C.info(i)}）${x.s.pct}%　<small>地主 ${esc(x.n)}</small></div>`).join('')
            + (open.map(([i, x]) => `<div class="w-row">#${i} ${C.info(i)}　出讓 <b>${x.po.pct}%</b>　🪙${x.po.price}<small>　${esc(x.n)}</small><span><button data-m="jb:${i}">入股</button></span></div>`).join('') || '<div class="w-empty">目前沒有合夥機會</div>');
    }

    async function handle(op, a, C, n) {
        const say = C.say, isPres = M && M.u === C.uid;
        const save = async () => { await db().ref('world/rate/' + T()).set({ u: C.uid, r: RT.r, l: RT.l, b: RT.b, tm: RT.tm, pol: RT.pol, sp: RT.sp, spt: now() }); };
        if (op === 'r') {
            if (Economy.coins() < 500) return say('金幣不夠（報名費 500）');
            const r = await db().ref('world/elect/' + T() + '/cand/' + C.uid).transaction(x => x ? undefined : { n: C.name(), v: 0 });
            if (r.committed) { Economy.add(-500, '參選報名費'); say('已報名參選！'); }
        } else if (op === 'v') {
            const r = await db().ref('world/elect/' + T() + '/voted/' + C.uid).transaction(x => x ? undefined : a);
            if (!r.committed) return say('這週你已經投過票了');
            await db().ref('world/elect/' + T() + '/cand/' + a + '/v').transaction(x => (x || 0) + 1); say('投票完成');
        } else if (op === 'tx') {
            if (!isPres) return say('只有本週總統可以調整稅率'); const [lo, hi, st] = RANGE[a]; RT[a] = Math.round(Math.max(lo, Math.min(hi, RT[a] + (+n) * st)) * 100) / 100; await save(); say('稅率已更新，全體玩家適用');
        } else if (op === 'pl') {
            if (!isPres) return say('只有本週總統可以訂政策');
            if (RT.pol[a]) delete RT.pol[a]; else { if (Object.keys(RT.pol).length >= 2) return say('最多同時 2 項政策，先取消一項'); RT.pol[a] = 1; } await save(); say('政策已更新');
        } else if (op === 'sp') {
            if (!isPres) return say('只有本週總統可以發表演說');
            const t = prompt('發表演說／政見（最多 140 字，所有玩家都看得到）', RT.sp || ''); if (t === null) return; RT.sp = t.trim().slice(0, 140); await save(); say(RT.sp ? '📣 演說已發表' : '已清除演說');
        } else if (op === 'jb') {
            const x = C.S()[a]; if (!x || !x.po) return say('這個機會已經沒了'); const po = x.po;
            if (Economy.coins() < po.price) return say('金幣不夠入股');
            const r = await db().ref('world/parcels/' + a).transaction(v => { if (!v || !v.po || v.s || v.o === C.uid) return; const y = Object.assign({}, v, { s: { u: C.uid, n: C.name(), pct: v.po.pct } }); delete y.po; return y; });
            if (!r.committed) return say('已被別人搶先入股');
            Economy.add(-po.price, '合夥入股'); await db().ref('world/mail/' + x.o).push({ c: po.price, t: now() }); C.S()[a] = r.snapshot.val(); say('入股成功！');
        }
        await load(C);
    }
    return { load, fee, landFee, bizTax, taxMult, pol, speech, tax, rows, handle, nextTerm: () => (T() + 1) * WEEK - now() };
})();
