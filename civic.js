// ==================== 總統選舉 + 合資經營 (civic.js) ====================
// 每週一屆：本週的票數決定「下週」的總統。總統可調 0–10% 的市場交易稅，稅金歸總統（寄到他的信箱）。
// 合資：地主可出讓某塊生產地／商店的 pct% 收益給合夥人，合夥人入股時付錢給地主。
// 資料：world/elect/<週>/cand/<uid> {n,v}、world/elect/<週>/voted/<uid>、world/rate/<週> {u,r}
const Civic = (() => {
    const db = () => firebase.database(), now = () => Date.now(), WEEK = 7 * 864e5, T = () => Math.floor(now() / WEEK);
    const val = p => db().ref('world/' + p).once('value').then(s => s.val());
    let M = null, RATE = .05, CAND = {}, VOTED = null;

    async function load(C) {
        const [prev, cur, voted, rate] = await Promise.all([val('elect/' + (T() - 1) + '/cand'), val('elect/' + T() + '/cand'), val('elect/' + T() + '/voted/' + C.uid), val('rate/' + T())]);
        const w = Object.entries(prev || {}).sort((a, b) => (b[1].v || 0) - (a[1].v || 0))[0];
        M = w ? { u: w[0], n: w[1].n } : null; CAND = cur || {}; VOTED = voted;
        RATE = M && rate && rate.u === M.u ? rate.r : .05;
    }
    const fee = () => RATE;
    const tax = amt => M && amt > 0 ? db().ref('world/mail/' + M.u).push({ c: amt, t: now() }) : Promise.resolve();

    function rows(tab, C) {
        if (tab === 'civ') {
            const mine = M && M.u === C.uid;
            return `<div><b>🏛️ 本週總統：</b>${M ? esc(M.n) : '（尚無）'}　交易稅率 <b>${Math.round(RATE * 100)}%</b></div>`
                + (mine ? '<div class="w-row">你是總統！<span><button data-m="rt:0">調整稅率</button></span></div>' : '')
                + '<div style="font-size:12px;opacity:.7;margin:4px 0 8px">每週一屆；總統收全國市場交易稅。下面是「下一屆」選舉，本週得票最高者下週上任。</div>'
                + (CAND[C.uid] ? '' : '<div class="w-row">想當總統？<span><button data-m="r:0">參選（報名費 50🪙）</button></span></div>')
                + (Object.entries(CAND).sort((a, b) => (b[1].v || 0) - (a[1].v || 0)).map(([u, c]) => `<div class="w-row">${esc(c.n)}　${c.v || 0} 票<span>${VOTED ? (VOTED === u ? '✅ 已投' : '') : `<button data-m="v:${u}">投票</button>`}</span></div>`).join('') || '<div style="opacity:.6">還沒有人參選</div>');
        }
        const all = Object.entries(C.S()), mine = all.filter(([i, x]) => x.s && x.s.u === C.uid), open = all.filter(([i, x]) => x.po && !x.s && x.o !== C.uid);
        return '<div style="font-size:12px;opacity:.7;margin-bottom:6px">入股後，該地每次收成／營業，你按比例分到成果（農作物進背包、營收進信箱）。</div>'
            + mine.map(([i, x]) => `<div class="w-row">🤝 我持有 #${i}（${C.info(i)}）${x.s.pct}%　<small>地主 ${esc(x.n)}</small></div>`).join('')
            + (open.map(([i, x]) => `<div class="w-row">#${i} ${C.info(i)}　出讓 <b>${x.po.pct}%</b>　🪙${x.po.price}<small>　${esc(x.n)}</small><span><button data-m="jb:${i}">入股</button></span></div>`).join('') || '<div style="opacity:.6">目前沒有合夥機會</div>');
    }

    async function handle(op, a, C) {
        const say = C.say;
        if (op === 'r') {
            if (Economy.coins() < 50) return say('金幣不夠（報名費 50）');
            const r = await db().ref('world/elect/' + T() + '/cand/' + C.uid).transaction(x => x ? undefined : { n: C.name(), v: 0 });
            if (r.committed) { Economy.add(-50, '參選報名費'); say('已報名參選！'); }
        } else if (op === 'v') {
            const r = await db().ref('world/elect/' + T() + '/voted/' + C.uid).transaction(x => x ? undefined : a);
            if (!r.committed) return say('這週你已經投過票了');
            await db().ref('world/elect/' + T() + '/cand/' + a + '/v').transaction(x => (x || 0) + 1); say('投票完成');
        } else if (op === 'rt') {
            if (!M || M.u !== C.uid) return;
            const r = parseFloat(prompt('設定交易稅率（0–10 %）')) / 100; if (!(r >= 0 && r <= .1)) return say('稅率要在 0–10% 之間');
            await db().ref('world/rate/' + T()).set({ u: C.uid, r }); say('稅率已更新');
        } else if (op === 'jb') {
            const x = C.S()[a]; if (!x || !x.po) return say('這個機會已經沒了'); const po = x.po;
            if (Economy.coins() < po.price) return say('金幣不夠入股');
            const r = await db().ref('world/parcels/' + a).transaction(v => { if (!v || !v.po || v.s || v.o === C.uid) return; const y = Object.assign({}, v, { s: { u: C.uid, n: C.name(), pct: v.po.pct } }); delete y.po; return y; });
            if (!r.committed) return say('已被別人搶先入股');
            Economy.add(-po.price, '合夥入股'); await db().ref('world/mail/' + x.o).push({ c: po.price, t: now() }); C.S()[a] = r.snapshot.val(); say('入股成功！');
        }
        await load(C);
    }
    return { load, fee, tax, rows, handle, nextTerm: () => (T() + 1) * WEEK - now() };
})();
