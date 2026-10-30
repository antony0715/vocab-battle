// ==================== 共同世界地圖 (world.js) v2：像素方格版 ====================
// 地形、河流、湖泊、道路、地塊都由固定種子產生（所有人相同）。只有「誰買了、蓋幾層」存在 Firebase: world/parcels/<id>
// 依賴：firebase、Economy、Trade、Civic、esc、Profile
const World = (() => {
    // ---------- 可調整的數值 ----------
    const BASE = [350, 160, 70, 30, 40], CAP = [5, 4, 2, 1, 1], AREA = [4, 8, 14, 24, 40], MAXA = [6, 12, 20, 36, 60];
    const ZN = ['市中心', '市區', '郊區', '鄉村', '山野'];
    const U = ['住宅', '商業', '工業', '農田', '公園', '林地'];
    const UT = ['#f6c85f', '#f28e2b', '#7f8fa6', '#d9e24a', '#3ddc97', '#1f6f43'];   // 用途色（半透明疊在地形上）
    const UF = [1, 1.3, .8, .7, .9, .8];
    const UW = [[.4, .55, 0, 0, .05, 0], [.55, .2, .15, 0, .1, 0], [.35, .05, .2, .3, .1, 0], [.2, 0, .1, .7, 0, 0], [0, 0, 0, 0, 0, 1]];
    const TN = ['深水', '淺水', '沙灘', '草原', '森林', '丘陵', '山地', '雪山', '沙漠', '濕地', '河流'];
    const SELL = .9, BUILD = .45, N = 320;
    const NAMES = ['星港', '青松', '金谷', '白沙', '紅楓', '雲頂', '藍湖', '鐵橋', '綠野', '銀河', '沙丘', '海鷗', '石橋', '晨曦'];

    // ---------- 雜訊 / 亂數 ----------
    const hash = (x, y, s) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const vn = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
    const fbm = (x, y, s, o = 4) => { let t = 0, a = .5, f = 1, n = 0; for (let i = 0; i < o; i++) { t += a * vn(x * f, y * f, s + i * 17); n += a; a *= .5; f *= 2; } return t / n; };
    const mkRng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    let rng = mkRng(20261031);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // ---------- 產生地圖 ----------
    const terr = new Uint8Array(N * N), road = new Uint8Array(N * N), pid = new Int32Array(N * N).fill(-1), elev = new Float32Array(N * N);
    const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N, isW = t => t < 2 || t === 10;
    const towns = [], parcels = [];
    const b64 = a => { let s = ''; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode.apply(null, a.subarray(i, i + 8192)); return btoa(s); };
    const unb64 = (s, a) => { const r = atob(s); for (let i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); };
    const wn = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => inb(x + a, y + b) && terr[(y + b) * N + x + a] < 2);
    function gen() {
        let cached = false;   // 地形、河流、道路、城鎮第一次算完會存在手機裡，之後不用重算
        try { const c = JSON.parse(localStorage.getItem('vk_map2') || 'null'); if (c && c.t) { unb64(c.t, terr); unb64(c.r, road); c.w.forEach(t => towns.push(t)); cached = true; } } catch (e) { }
        if (!cached) {
        // 雜訊先算在一半解析度，再雙線性放大（速度快 4 倍）
        const CW = (N >> 1) + 2, cg = f => { const a = new Float32Array(CW * CW); for (let j = 0; j < CW; j++) for (let i = 0; i < CW; i++) a[j * CW + i] = f(i * 2, j * 2); return a; };
        const sp = (a, x, y) => { const fx = x / 2, fy = y / 2, i = fx | 0, j = fy | 0, u = fx - i, v = fy - j, p = j * CW + i; return a[p] * (1 - u) * (1 - v) + a[p + 1] * u * (1 - v) + a[p + CW] * (1 - u) * v + a[p + CW + 1] * u * v; };
        const GE = cg((x, y) => fbm(x / 46, y / 46, 1)), GM = cg((x, y) => fbm(x / 32, y / 32, 5, 3)), GL = cg((x, y) => fbm(x / 16, y / 16, 9, 2));
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.min(1, Math.hypot((x - N / 2) / (N * .47), (y - N / 2) / (N * .47))); elev[y * N + x] = sp(GE, x, y) * .78 + (1 - Math.pow(d, 2.2)) * .34 - .06 + (hash(x, y, 2) - .5) * .012; }
        const so = Float32Array.from(elev).sort(), q = p => so[Math.floor(p * (N * N - 1))], sea = q(.34), hill = q(.76), mtn = q(.88), snow = q(.975);
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const i = y * N + x, e = elev[i], m = sp(GM, x, y), L = sp(GL, x, y); let t;
            if (e < sea - .045) t = 0; else if (e < sea) t = 1; else if (e >= snow) t = 7; else if (e >= mtn) t = 6; else if (e >= hill) t = 5;
            else { t = m < .36 ? 8 : m > .6 ? 4 : 3; if (L > .74) t = L > .8 ? 0 : 1; else if (m > .58 && e < sea + .05) t = 9; }
            terr[i] = t;
        }
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; if ([3, 4, 8, 9].includes(terr[i]) && elev[i] < sea + .05 && wn(x, y)) terr[i] = 2; }
        for (let s = 0; s < 44; s++) {                       // 河流：從高處往低處流到水域
            let x = 0, y = 0; for (let k = 0; k < 300; k++) { x = rng() * N | 0; y = rng() * N | 0; if (elev[y * N + x] >= hill) break; }
            const seenR = new Set(); let up = 0;
            for (let st = 0; st < 700; st++) {
                const i = y * N + x; if (st > 0 && isW(terr[i])) break; terr[i] = 10; seenR.add(i);
                let bx = -1, by = -1, be = 9;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if ((!dx && !dy) || !inb(x + dx, y + dy) || seenR.has((y + dy) * N + x + dx)) continue; const e2 = elev[(y + dy) * N + x + dx] + (hash(x + dx, y + dy, 77) - .5) * .004; if (e2 < be) { be = e2; bx = x + dx; by = y + dy; } }
                if (bx < 0) break; if (be > elev[i]) { if (++up > 8) { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (inb(x + a, y + b)) terr[(y + b) * N + x + a] = 1; break; } } else up = 0;
                x = bx; y = by; if (x < 1 || y < 1 || x > N - 2 || y > N - 2) break;
            }
        }
        for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) if (terr[y * N + x] === 10 && elev[y * N + x] < hill && hash(x, y, 31) < .5 && [3, 4, 8, 9, 2].includes(terr[y * N + x + 1])) terr[y * N + x + 1] = 10;
        // 城鎮
        for (let k = 0; k < 12000 && towns.length < 14; k++) {
            const x = 24 + rng() * (N - 48) | 0, y = 24 + rng() * (N - 48) | 0, t = terr[y * N + x];
            if (![3, 4].includes(t) || towns.some(o => Math.hypot(o.x - x, o.y - y) < 42)) continue;
            let ok = true; for (let a = 0; a < 8; a++) { const px = x + Math.round(Math.cos(a * .785) * 6), py = y + Math.round(Math.sin(a * .785) * 6); if (!inb(px, py) || isW(terr[py * N + px]) || terr[py * N + px] > 4) ok = false; }
            if (ok) towns.push({ x, y, R: 22 + (rng() * 10 | 0), n: NAMES[towns.length] });
        }
        // 主幹道（寬 2 格）：A* 把城鎮連起來
        const COST = [400, 400, 1.2, 1, 1.5, 3, 6, 12, 1.6, 3, 7];
        function route(a, b) {
            const dist = new Float64Array(N * N).fill(1e9), prev = new Int32Array(N * N).fill(-1), h = [];
            const push = (d, i) => { h.push([d, i]); let k = h.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (h[p][0] <= h[k][0]) break; [h[p], h[k]] = [h[k], h[p]]; k = p; } };
            const pop = () => { const t = h[0], l = h.pop(); if (h.length) { h[0] = l; let k = 0; for (; ;) { const c = 2 * k + 1; let m = k; if (c < h.length && h[c][0] < h[m][0]) m = c; if (c + 1 < h.length && h[c + 1][0] < h[m][0]) m = c + 1; if (m === k) break; [h[m], h[k]] = [h[k], h[m]]; k = m; } } return t; };
            const s = a.y * N + a.x, g = b.y * N + b.x; dist[s] = 0; push(0, s);
            while (h.length) {
                const [d, i] = pop(); if (i === g) break; if (d > dist[i]) continue; const x = i % N, y = i / N | 0;
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = ny * N + nx, nd = d + Math.max(.3, COST[terr[j]] - (road[j] ? .7 : 0)) + hash(nx, ny, 5) * .15;
                    if (nd < dist[j]) { dist[j] = nd; prev[j] = i; push(nd, j); }
                }
            }
            for (let i = g; i >= 0; i = prev[i]) { const x = i % N, y = i / N | 0; road[i] = 2; if (inb(x + 1, y)) road[i + 1] = 2; if (inb(x, y + 1)) road[i + N] = 2; if (i === s) break; }
        }
        const done = new Set(); towns.forEach((t, i) => towns.map((o, j) => [Math.hypot(o.x - t.x, o.y - t.y), j]).filter(a => a[1] !== i).sort((a, b) => a[0] - b[0]).slice(0, 2).forEach(([, j]) => { const key = Math.min(i, j) + '-' + Math.max(i, j); if (!done.has(key)) { done.add(key); route(t, towns[j]); } }));
        // 市區街道 + 鄉間道路
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const i = y * N + x; if (road[i] || isW(terr[i]) || terr[i] === 6 || terr[i] === 7) continue; let r = 0;
            for (const t of towns) { const dx = x - t.x, dy = y - t.y, d = Math.hypot(dx, dy); if (d < t.R) { const near = d < t.R * .7, mx = ((dx % 6) + 6) % 6, my = ((dy % 6) + 6) % 6; if ((mx === 0 && (near || ((dx % 12) + 12) % 12 === 0)) || (my === 0 && (near || ((dy % 12) + 12) % 12 === 0))) r = 1; break; } }
            if (!r) { if (x % 16 === 0 && hash(x / 16 | 0, y / 16 | 0, 11) < .6) r = 1; else if (y % 16 === 0 && hash(x / 16 | 0, y / 16 | 0, 12) < .6) r = 1; }
            if (r) road[i] = 1;
        }
        try { localStorage.setItem('vk_map2', JSON.stringify({ t: b64(terr), r: b64(road), w: towns })); } catch (e) { }
        }
        rng = mkRng(777);   // 地塊用途的亂數獨立，快取與否結果都一樣
        // 切地塊：連通的空地 → 遞迴切成長方形（沿海岸線會貼著水邊）
        const seen = new Uint8Array(N * N), ok = i => !road[i] && !isW(terr[i]);
        const zoneOf = (cx, cy, mt) => { if (mt >= 5 && mt <= 7) return 4; let d = 1e9; towns.forEach(t => d = Math.min(d, Math.hypot(cx - t.x, cy - t.y) / t.R)); return d < .4 ? 0 : d < .8 ? 1 : d < 1.7 ? 2 : 3; };
        function emit(cells, z, mt, cx, cy) {
            const id = parcels.length; let x0 = N, y0 = N, x1 = 0, y1 = 0; cells.forEach(c => { pid[c] = id; const x = c % N, y = c / N | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
            let u = 5; if (z < 4 && mt !== 4) { const w = UW[z], tot = w.reduce((a, b) => a + b, 0); let r = rng() * tot; u = 0; while (u < 5 && r >= w[u]) { r -= w[u]; u++; } if (mt === 8 && u === 3) u = 2; if (mt === 2 && z >= 2) u = rng() < .5 ? 4 : 0; }
            parcels.push({ i: id, x: cx, y: cy, z, u, a: cells.length, t: mt, cells, bb: [x0, y0, x1, y1], nb: [], wf: 0 });
        }
        function split(cells) {
            let sx = 0, sy = 0, x0 = N, y0 = N, x1 = 0, y1 = 0; const cnt = {};
            cells.forEach(c => { const x = c % N, y = c / N | 0; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; cnt[terr[c]] = (cnt[terr[c]] || 0) + 1; });
            const cx = sx / cells.length, cy = sy / cells.length, mt = +Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0], z = zoneOf(cx, cy, mt);
            if (cells.length <= MAXA[z] || (x1 - x0 < 2 && y1 - y0 < 2)) return emit(cells, z, mt, cx, cy);
            const vert = (x1 - x0) >= (y1 - y0), cut = vert ? Math.round(x0 + (x1 - x0 + 1) * (.35 + rng() * .3)) : Math.round(y0 + (y1 - y0 + 1) * (.35 + rng() * .3)), A = [], B = [];
            cells.forEach(c => ((vert ? c % N : c / N | 0) < cut ? A : B).push(c));
            if (!A.length || !B.length) return emit(cells, z, mt, cx, cy); split(A); split(B);
        }
        for (let s = 0; s < N * N; s++) {
            if (seen[s] || !ok(s)) continue; const comp = [], st = [s]; seen[s] = 1;
            while (st.length) { const i = st.pop(); comp.push(i); const x = i % N, y = i / N | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = ny * N + nx; if (!seen[j] && ok(j)) { seen[j] = 1; st.push(j); } } }
            split(comp);
        }
        // 鄰居（隔著 1～3 格道路也算）與臨水
        const nbs = parcels.map(() => new Set());
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const a = pid[y * N + x]; if (a < 0) continue; if (wn(x, y)) parcels[a].wf = 1;
            for (let d = 1; d <= 3; d++) { if (x + d < N) { const b = pid[y * N + x + d]; if (b >= 0 && b !== a) { nbs[a].add(b); nbs[b].add(a); } } if (y + d < N) { const b = pid[(y + d) * N + x]; if (b >= 0 && b !== a) { nbs[a].add(b); nbs[b].add(a); } } }
        }
        parcels.forEach((p, i) => p.nb = [...nbs[i]]);
        // 股票公司總部：每家公司固定一塊市中心地（不會自動買地，也不能買賣）
        const st = typeof Economy !== 'undefined' && Economy.stocks ? Economy.stocks() : [], used = new Set();
        st.forEach((s, n) => { const t = towns[n % towns.length]; if (!t) return; const c = parcels.filter(p => p.z === 0 && !used.has(p.i)).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0]; if (c) { c.hq = n; c.u = 1; used.add(c.i); } });
    }
    let built = false; const ensure = () => { if (!built) { built = true; gen(); } };   // 第一次開地圖才生成（避免拖慢主頁載入）

    // ---------- 狀態 / 價格 / 資產 ----------
    const uid = (() => { let u = localStorage.getItem('vk_uid'); if (!u) { u = 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem('vk_uid', u); } return u; })();
    const myName = () => (typeof Profile !== 'undefined' && Profile.getName()) || '玩家';
    const ref = i => firebase.database().ref('world/parcels/' + (i === undefined ? '' : i));
    let S = {}, sel = null, ov, cv, ctx, W = 0, H = 0, V = { x: 0, y: 0, k: 6 }, loaded = false, landShown = false, clk = 0;
    const price = p => { let f = 1; p.nb.forEach(j => { const s = S[j]; if (s) f += .05 + .025 * (s.b || 0); if (parcels[j].hq !== undefined) f += .12; }); return Math.max(5, Math.round(BASE[p.z] * UF[p.u] * clamp(Math.sqrt(p.a / AREA[p.z]), .6, 1.6) * Math.min(f, 2.5) * (p.wf ? 1.12 : 1))); };
    const buildCost = (p, lv) => Math.round(BASE[p.z] * BUILD * lv);
    const builtValue = p => { let s = 0; for (let k = 1; k <= ((S[p.i] || {}).b || 0); k++) s += buildCost(p, k); return s; };
    const assets = () => { let s = 0; Object.keys(S).forEach(i => { const o = S[i], p = parcels[i]; if (p && o.o === uid) s += price(p) + builtValue(p) + (o.d ? Trade.value(o.d) : 0); }); return Math.round(s + Trade.invValue()); };
    const stocksV = () => Math.round(Economy.stocksValue ? Economy.stocksValue() : 0);
    const wealth = () => Math.round(Economy.coins() + stocksV() + (Number(localStorage.getItem('vk_assets')) || 0));
    function report() { const name = myName(); if (!name || name === '請輸入暱稱') return; try { firebase.database().ref('leaderboard_rich/' + uid).set({ name, score: wealth(), timestamp: firebase.database.ServerValue.TIMESTAMP }); } catch (e) { } }
    const hueOf = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

    // ---------- 繪圖（像素圖層） ----------
    const PAL = {
        light: { t: [[58, 105, 160], [88, 150, 208], [230, 216, 162], [140, 192, 99], [77, 143, 79], [163, 157, 122], [138, 143, 153], [241, 245, 249], [220, 194, 125], [111, 154, 106], [79, 143, 208]], r: [74, 78, 88], m: [46, 49, 56], b: [150, 128, 96] },
        dark: { t: [[18, 38, 66], [28, 64, 104], [120, 108, 76], [52, 84, 48], [34, 66, 40], [84, 80, 64], [74, 78, 88], [150, 160, 175], [110, 92, 56], [48, 72, 52], [30, 72, 120]], r: [22, 24, 29], m: [10, 11, 14], b: [96, 80, 60] }
    };
    const isDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
    let lb, lt, lo;   // 地形/道路圖層、用途色圖層、地主圖層（每格 1 像素，放大時不平滑）
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
    function paintBase() {
        const P = isDark() ? PAL.dark : PAL.light, c = lb.getContext('2d'), img = c.createImageData(N, N);
        for (let i = 0; i < N * N; i++) { const col = road[i] && isW(terr[i]) ? P.b : road[i] === 2 ? P.m : road[i] ? P.r : P.t[terr[i]], j = road[i] ? (hash(i % N, i / N | 0, 4) - .5) * 5 : (hash(i % N, i / N | 0, 3) - .5) * 14; img.data[i * 4] = col[0] + j; img.data[i * 4 + 1] = col[1] + j; img.data[i * 4 + 2] = col[2] + j; img.data[i * 4 + 3] = 255; }
        c.putImageData(img, 0, 0);
    }
    function paintUse() { const c = lt.getContext('2d'); c.clearRect(0, 0, N, N); parcels.forEach(p => { c.fillStyle = UT[p.u] + '5e'; p.cells.forEach(i => c.fillRect(i % N, i / N | 0, 1, 1)); }); }
    function paintOwn() { const c = lo.getContext('2d'); c.clearRect(0, 0, N, N); Object.keys(S).forEach(i => { const p = parcels[i]; if (!p) return; c.fillStyle = S[i].o === uid ? 'rgba(255,204,0,.62)' : `hsla(${hueOf(S[i].o)},75%,55%,.55)`; p.cells.forEach(k => c.fillRect(k % N, k / N | 0, 1, 1)); }); }
    const tx = (x, y) => [x * V.k + V.x, y * V.k + V.y];
    function draw() {
        if (!ctx || !lb) return; const dpr = devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = false;
        [lb, lt, lo].forEach(l => ctx.drawImage(l, 0, 0, N, N, V.x, V.y, N * V.k, N * V.k));
        const x0 = Math.max(0, Math.floor(-V.x / V.k)), y0 = Math.max(0, Math.floor(-V.y / V.k)), x1 = Math.min(N - 1, Math.ceil((W - V.x) / V.k)), y1 = Math.min(N - 1, Math.ceil((H - V.y) / V.k)), dark = isDark();
        if (V.k >= 5) {                                                    // 道路細節：路緣、車道虛線
            const k = V.k, lw = Math.max(1, k * .09), rd = (x, y) => inb(x, y) ? road[y * N + x] : 0;
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
                const r = road[y * N + x]; if (!r) continue; const [sx, sy] = tx(x, y), L = rd(x - 1, y), R = rd(x + 1, y), U2 = rd(x, y - 1), D = rd(x, y + 1);
                ctx.fillStyle = dark ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.55)';
                if (!L) ctx.fillRect(sx, sy, lw, k); if (!R) ctx.fillRect(sx + k - lw, sy, lw, k); if (!U2) ctx.fillRect(sx, sy, k, lw); if (!D) ctx.fillRect(sx, sy + k - lw, k, lw);
                if (r === 1) { ctx.fillStyle = dark ? 'rgba(235,225,170,.8)' : 'rgba(250,246,210,.95)'; if (L && R && !U2 && !D && x % 2 === 0) ctx.fillRect(sx + k * .2, sy + k * .5 - lw / 2, k * .6, lw); else if (U2 && D && !L && !R && y % 2 === 0) ctx.fillRect(sx + k * .5 - lw / 2, sy + k * .2, lw, k * .6); }
                else { ctx.fillStyle = '#f5d142'; if (rd(x, y + 1) === 2 && rd(x, y - 1) !== 2 && L === 2 && R === 2 && x % 2 === 0) ctx.fillRect(sx + k * .15, sy + k - lw / 2, k * .7, lw); else if (R === 2 && L !== 2 && U2 === 2 && D === 2 && y % 2 === 0) ctx.fillRect(sx + k - lw / 2, sy + k * .15, lw, k * .7); }
            }
        }
        if (V.k >= 7) {                                                    // 地塊框線
            ctx.beginPath(); ctx.strokeStyle = dark ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.3)'; ctx.lineWidth = 1;
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
                const a = pid[y * N + x]; if (a < 0) continue; const [sx, sy] = tx(x, y), k = V.k;
                if (x === 0 || pid[y * N + x - 1] !== a) { ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + k); } if (x === N - 1 || pid[y * N + x + 1] !== a) { ctx.moveTo(sx + k, sy); ctx.lineTo(sx + k, sy + k); }
                if (y === 0 || pid[(y - 1) * N + x] !== a) { ctx.moveTo(sx, sy); ctx.lineTo(sx + k, sy); } if (y === N - 1 || pid[(y + 1) * N + x] !== a) { ctx.moveTo(sx, sy + k); ctx.lineTo(sx + k, sy + k); }
            }
            ctx.stroke();
        }
        const vis = parcels.filter(p => (p.bb[2] + 1) * V.k + V.x > 0 && p.bb[0] * V.k + V.x < W && (p.bb[3] + 1) * V.k + V.y > 0 && p.bb[1] * V.k + V.y < H);
        if (V.k >= 3.5) vis.filter(p => p.hq !== undefined || (S[p.i] && S[p.i].b)).sort((a, b) => a.y - b.y).forEach(p => {   // 2.5D 建築
            const o = S[p.i] || {}, hq = p.hq !== undefined, lv = hq ? 6 : o.b, hue = hq ? 220 : hueOf(o.o), w = p.bb[2] - p.bb[0] + 1, h = p.bb[3] - p.bb[1] + 1, m = Math.min(.8, Math.min(w, h) * .2);
            const sx = (p.bb[0] + m) * V.k + V.x, sy = (p.bb[1] + m) * V.k + V.y, sw = (w - 2 * m) * V.k, sh = (h - 2 * m) * V.k, hh = lv * .7 * V.k, mine = o.o === uid;
            ctx.fillStyle = `hsl(${hue},50%,${mine ? 40 : 34}%)`; ctx.fillRect(sx, sy + sh - hh, sw, hh);
            ctx.fillStyle = mine ? '#ffd84d' : `hsl(${hue},62%,64%)`; ctx.fillRect(sx, sy - hh, sw, sh);
            ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.strokeRect(sx, sy - hh, sw, sh + hh);
            if (o.d && V.k > 4) { ctx.font = Math.min(26, V.k * 2.2) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(Trade.emoji(o.d), sx + sw / 2, sy - hh - 2); }
        });
        if (V.k >= 4) {                                                    // 地主名字
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
            vis.forEach(p => { const o = S[p.i]; if (!o) return; const nm = o.o === uid ? '你' : o.n || '?', sw = (p.bb[2] - p.bb[0] + 1) * V.k, fs = Math.min(15, sw / (nm.length * 1.05 + .3)); if (fs < 7) return; ctx.font = `600 ${fs}px system-ui,sans-serif`; const y = p.bb[1] * V.k + V.y - (o.b || 0) * .7 * V.k - fs * .45, x = (p.bb[0] + p.bb[2] + 1) / 2 * V.k + V.x; ctx.lineWidth = 3; ctx.strokeStyle = dark ? 'rgba(0,0,0,.8)' : 'rgba(255,255,255,.9)'; ctx.strokeText(nm, x, y); ctx.fillStyle = dark ? '#fff' : '#1b2330'; ctx.fillText(nm, x, y); });
        }
        if (sel) {                                                         // 選取框
            ctx.beginPath(); ctx.strokeStyle = '#ff3d71'; ctx.lineWidth = 2.5; const k = V.k;
            sel.cells.forEach(c => { const x = c % N, y = c / N | 0, [sx, sy] = tx(x, y); if (pid[c - 1] !== sel.i || x === 0) { ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + k); } if (x === N - 1 || pid[c + 1] !== sel.i) { ctx.moveTo(sx + k, sy); ctx.lineTo(sx + k, sy + k); } if (y === 0 || pid[c - N] !== sel.i) { ctx.moveTo(sx, sy); ctx.lineTo(sx + k, sy); } if (y === N - 1 || pid[c + N] !== sel.i) { ctx.moveTo(sx, sy + k); ctx.lineTo(sx + k, sy + k); } });
            ctx.stroke();
        }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 13px system-ui,sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = dark ? 'rgba(0,0,0,.85)' : 'rgba(255,255,255,.92)';
        towns.forEach(t => { const [a, b] = tx(t.x, t.y); if (a < -50 || a > W + 50 || b < -20 || b > H + 20) return; ctx.strokeText('🏙️ ' + t.n, a, b); ctx.fillStyle = dark ? '#fff' : '#1b2330'; ctx.fillText('🏙️ ' + t.n, a, b); });
    }
    function fit() {
        W = cv.clientWidth; H = cv.clientHeight; const d = devicePixelRatio || 1; cv.width = W * d; cv.height = H * d;
    }
    function center(x, y, fy = .5) { V.x = W / 2 - x * V.k; V.y = H * fy - y * V.k; }
    function zoom(f, cx, cy) { const k = clamp(V.k * f, Math.min(W, H) / N * .9, 48); f = k / V.k; V.x = cx - (cx - V.x) * f; V.y = cy - (cy - V.y) * f; V.k = k; }

    // ---------- 介面 ----------
    const CSS = `<style>
.wv{--card:rgba(255,255,255,.9);--fg:#1c2430;--sub:#667385;--line:rgba(0,0,0,.09);--acc:#2f6fed;--acc2:#7a5cff;--rowbg:rgba(30,50,90,.05);--sh:0 10px 30px rgba(20,30,50,.22)}
@media(prefers-color-scheme:dark){.wv{--card:rgba(24,30,41,.9);--fg:#e8edf4;--sub:#9aa7b6;--line:rgba(255,255,255,.1);--acc:#5b8cff;--acc2:#8b6bff;--rowbg:rgba(255,255,255,.06);--sh:0 10px 30px rgba(0,0,0,.6)}}
.wv .card{position:absolute;background:var(--card);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--line);border-radius:20px;box-shadow:var(--sh);color:var(--fg)}
.wv button{font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}.wv small{color:var(--sub)}
.w-me{top:calc(10px + env(safe-area-inset-top));left:10px;display:flex;align-items:center;gap:10px;padding:8px 14px 8px 8px}
.w-av{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--acc),#2ec4b6);color:#fff;font-weight:700;font-size:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(47,111,237,.4)}
.w-mi{display:flex;flex-direction:column;line-height:1.35;font-size:13px}.w-mi b{font-size:14px}
.w-bd{top:calc(72px + env(safe-area-inset-top));left:10px;padding:10px 14px;font-size:13px;line-height:1.85}
.w-clk{top:calc(10px + env(safe-area-inset-top));right:10px;padding:8px 14px;text-align:right;line-height:1.3}.w-clk b{font-size:20px;display:block;letter-spacing:.5px}.w-clk small{font-size:12px}
.w-cal{top:calc(72px + env(safe-area-inset-top));right:10px;padding:12px;width:232px;font-size:12px}
.w-cal .ct{font-weight:700;margin-bottom:6px;text-align:center}.w-cg{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center}.w-cg i{font-style:normal;padding:4px 0;border-radius:8px}.w-cg .td{background:var(--acc);color:#fff;font-weight:700}
.w-toast{position:absolute;left:10px;top:calc(124px + env(safe-area-inset-top));background:rgba(20,24,32,.92);color:#fff;padding:7px 14px;border-radius:14px;font-size:13px;opacity:0;transition:opacity .25s;pointer-events:none;max-width:70%}
.w-dock{left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));display:flex;justify-content:space-around;padding:6px}
.w-dock button{flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;border:0;background:transparent;color:var(--fg);padding:6px 0;border-radius:15px;font-size:11px;min-width:0;transition:all .18s}.w-dock button span{font-size:21px;line-height:1.2}
.w-dock button.on{background:linear-gradient(135deg,var(--acc),var(--acc2));color:#fff;box-shadow:0 5px 14px rgba(80,100,255,.45);transform:translateY(-3px)}
.w-panel{left:8px;right:8px;bottom:calc(84px + env(safe-area-inset-bottom));padding:14px 16px;font-size:14px;line-height:1.65;max-height:50%;overflow:auto;animation:wup .22s ease-out}
.w-panel .px{position:absolute;top:8px;right:10px;border:0;background:transparent;color:var(--sub);font-size:18px}
.w-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.w-btns button{flex:1 1 42%;padding:11px;border:0;border-radius:14px;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#fff;font-size:14px;font-weight:600;box-shadow:0 3px 10px rgba(80,100,255,.3)}.w-btns button:disabled{opacity:.5;box-shadow:none}
@keyframes wup{from{transform:translateY(18px);opacity:0}to{transform:none;opacity:1}}
.w-sheet{position:absolute;left:8px;right:8px;bottom:calc(84px + env(safe-area-inset-bottom));max-height:64%;overflow:auto;padding:10px 16px 16px;border-radius:22px;background:var(--card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid var(--line);box-shadow:var(--sh);color:var(--fg);font-size:14px;z-index:6;animation:wup .22s ease-out}
.w-sheet::before{content:'';display:block;width:40px;height:4px;border-radius:2px;background:var(--line);margin:0 auto 10px}
.w-hd{display:flex;align-items:center;gap:8px;margin-bottom:10px}.w-hd b{flex:1;font-size:17px}.w-x2{border:0;background:var(--rowbg);color:var(--sub);font-size:15px;width:30px;height:30px;border-radius:50%}
.w-seg{display:flex;gap:4px;padding:4px;border-radius:999px;background:var(--rowbg);margin-bottom:10px}.w-seg .w-tab{flex:1}
.w-tab{padding:7px 13px;border:0;border-radius:999px;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#fff;font-weight:600;font-size:13px}.w-tab.off{background:transparent;color:var(--fg);font-weight:500}
.w-row{display:flex;align-items:center;gap:8px;padding:10px 12px;margin-bottom:8px;border-radius:16px;background:var(--rowbg);border:1px solid var(--line)}.w-row span{margin-left:auto;display:flex;gap:6px}
.w-row button{padding:7px 12px;border:0;border-radius:999px;background:var(--acc);color:#fff;font-weight:600;font-size:13px}
.lri{font-size:26px}.lrm{display:flex;flex-direction:column;flex:1;min-width:0;line-height:1.4}.lrm small{font-size:12px}.lrp{font-weight:700;white-space:nowrap;color:var(--acc)}
.ld{margin:-4px 4px 10px;padding:10px 12px;border-radius:14px;background:var(--rowbg);font-size:13px;line-height:1.8}
.w-sub{font-size:12px;font-weight:700;color:var(--sub);margin:12px 2px 6px;letter-spacing:.5px}
.w-chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 6px;align-items:center;font-size:12px;color:var(--sub)}.w-chip{padding:5px 12px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--fg);font-size:12px}.w-chip.on{background:var(--acc);color:#fff;border-color:transparent}
.w-search{display:flex;gap:8px;margin-bottom:10px}.w-search input{flex:1;min-width:0;padding:11px 14px;border-radius:14px;border:1px solid var(--line);background:var(--rowbg);color:var(--fg);font-size:14px;outline:none}.w-go{padding:0 18px;border:0;border-radius:14px;background:var(--acc);color:#fff;font-weight:600}
.w-empty{padding:18px 8px;text-align:center;color:var(--sub);font-size:13px}
.w-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}.w-sum div{padding:10px;border-radius:14px;background:var(--rowbg);text-align:center;line-height:1.4}.w-sum b{display:block;font-size:15px}
</style>`;
    const say = m => { const t = ov.querySelector('.w-toast'); t.textContent = m; t.style.opacity = 1; clearTimeout(say.t); say.t = setTimeout(() => t.style.opacity = 0, 2200); };
    const $q = s => ov.querySelector(s);
    function panel() {
        const el = $q('.w-panel'); el.hidden = !landShown; if (!landShown) return;
        let h = '<button class="px" data-a="hide">✕</button>';
        if (!sel) { el.innerHTML = h + '<div style="opacity:.7;padding-right:24px">點地圖上的一塊地看看。可拖曳移動、雙指縮放；放大後會顯示地主名字。</div>'; return; }
        if (sel.hq !== undefined) { const st = Economy.stocks()[sel.hq]; el.innerHTML = h + `<div><b>🏢 ${esc(st.name)} 總部</b>　${ZN[sel.z]}</div><div>現價 🪙${Economy.stockPrice(st).toFixed(1)}　・　公司用地不能買賣，周圍地價 +12%</div><div class="w-btns"><button data-a="stk">📈 查看股票</button></div>`; return; }
        const o = S[sel.i], pr = price(sel), b = o ? (o.b || 0) : 0, cap = CAP[sel.z];
        h += `<div><b>#${sel.i}　${U[sel.u]}用地</b>　${ZN[sel.z]}・${TN[sel.t]}</div><div><small>面積 ${sel.a} 格　樓層 ${b}/${cap}${sel.wf ? '　🌊 臨水' : ''}</small></div><div>地主：${o ? (o.o === uid ? '你' : esc(o.n)) : '無主'}　・　地價 🪙${pr}</div>${o && o.d ? `<div>🖼️ 展示中：${Trade.label(o.d)}</div>` : ''}${o && o.ls ? `<div>🏷️ 掛牌價 🪙${o.ls}</div>` : ''}<div class="w-btns">`;
        if (!o) h += `<button data-a="buy">買地 🪙${pr}</button>`;
        else if (o.o === uid) { if (b < cap) h += `<button data-a="up">${b ? '加蓋一層' : '蓋房子'} 🪙${buildCost(sel, b + 1)} ${Trade.needText(Trade.need(b + 1))}</button>`; h += `<button data-a="sell">賣出 🪙${Math.round(pr * SELL + builtValue(sel) * .5)}</button>`; h += `<button data-a="${o.ls ? 'unlist' : 'list'}">${o.ls ? '取消掛牌 🪙' + o.ls : '🏷️ 掛牌出售'}</button>` + Trade.buttons(sel, o); } else if (o.ls) h += `<button data-a="buyls">買下 🪙${o.ls}</button>`;
        el.innerHTML = h + '</div>';
    }
    function profile() {
        const w = wealth(); $q('.w-av').textContent = (myName() || '玩').slice(0, 1); $q('.w-nm').textContent = myName();
        $q('.w-cn').innerHTML = `🪙 ${Economy.coins()}　<small>總資產 💰 ${w}</small>`;
        $q('.w-bd').innerHTML = `🪙 現金　${Economy.coins()}<br>📈 股票　${stocksV()}<br>🏠 地產・背包　${Number(localStorage.getItem('vk_assets')) || 0}<br><b>💰 總資產　${w}</b>`;
    }
    const refreshAll = () => { if (!ov) return; if (loaded) localStorage.setItem('vk_assets', assets()); paintOwn(); profile(); panel(); if (LS) renderLand(); draw(); };
    const tick = () => { if (!ov) return; const d = new Date(); $q('.w-clk b').textContent = d.toTimeString().slice(0, 5); $q('.w-clk small').textContent = `${d.getMonth() + 1}/${d.getDate()} 週${'日一二三四五六'[d.getDay()]}`; };
    function calHtml() {
        const d = new Date(), y = d.getFullYear(), m = d.getMonth(), first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), ms = typeof Civic !== 'undefined' ? Civic.nextTerm() : 0;
        let h = `<div class="ct">${y} 年 ${m + 1} 月</div><div class="w-cg">` + [...'日一二三四五六'].map(x => `<i><small>${x}</small></i>`).join('') + '<i></i>'.repeat(first);
        for (let i = 1; i <= days; i++) h += `<i class="${i === d.getDate() ? 'td' : ''}">${i}</i>`;
        return h + `</div><div style="margin-top:8px"><small>🏛️ 下屆總統上任倒數 ${Math.floor(ms / 864e5)} 天 ${Math.floor(ms % 864e5 / 36e5)} 小時</small></div>`;
    }
    const DK = { bag: ['🎒', '背包', 'sell'], market: ['🛒', '市場', 'buy'], land: ['🗺️', '土地'], pres: ['🏛️', '總統', 'civ'], jv: ['🤝', '合夥', 'jv'], job: ['👷', '人力', 'job'], exit: ['🚪', '離開'] };
    function syncDock() { if (!ov) return; const cur = Trade.current(); ov.querySelectorAll('.w-dock button').forEach(b => { const d = DK[b.dataset.d]; b.classList.toggle('on', d[2] ? d[2] === cur : b.dataset.d === 'land' && !!LS); }); }
    const showLand = v => { landShown = v; if (v) { Trade.close(); closeLand(); } panel(); syncDock(); };
    const tctx = () => ({ uid, say, refresh: refreshAll, name: myName, root: ov, S: () => S, info: i => parcels[i] ? U[parcels[i].u] + '・' + ZN[parcels[i].z] : '?', use: i => parcels[i] ? parcels[i].u : 3, sync: syncDock });

    // ---------- 土地：搜尋 / 房地產市場 / 我的土地 ----------
    let LS = null, LT = 'search', fz = -1, fu = -1, srt = 'p', ex = -1, qv = '';
    const UI = ['🏠', '🏬', '🏭', '🌾', '🌳', '⛰️'];
    const closeLand = () => { if (LS) { LS.remove(); LS = null; } syncDock(); };
    function openLand() { if (LS) return closeLand(); Trade.close(); landShown = false; panel(); LS = document.createElement('div'); LS.className = 'w-sheet'; ov.appendChild(LS); LS.onclick = landClick; renderLand(); syncDock(); }
    const priceOf = p => { const o = S[p.i]; return o && o.ls ? o.ls : price(p); };
    function rowHtml(p) {
        const o = S[p.i], st = o ? Trade.status(o) : '';
        const d = ex === p.i ? `<div class="ld">地主：${o ? (o.o === uid ? '你' : esc(o.n)) : '無主'}　樓層 ${o ? o.b || 0 : 0}/${CAP[p.z]}<br>${p.wf ? '🌊 臨水　' : ''}鄰地 ${p.nb.length} 塊　系統估價 🪙${price(p)}${o && o.ls ? '　🏷️ 掛牌 🪙' + o.ls : ''}${st ? '<br>' + st : ''}<div class="w-btns"><button data-l="go:${p.i}">📍 定位並開啟土地面板</button></div></div>` : '';
        return `<div class="w-row"><div class="lri">${UI[p.u]}</div><div class="lrm"><b>#${p.i} ${U[p.u]}</b><small>${ZN[p.z]}・${TN[p.t]}・${p.a} 格${o ? '・' + (o.o === uid ? '你的' : esc(o.n)) : ''}</small>${st ? `<small>${st}</small>` : ''}</div><div class="lrp">🪙${priceOf(p)}</div><span><button data-l="ex:${p.i}">詳情</button><button data-l="go:${p.i}">📍</button></span></div>` + d;
    }
    function renderLand() {
        if (!LS) return; const st = LS.scrollTop, chip = (on, l, n) => `<button class="w-chip ${on ? 'on' : ''}" data-l="${l}">${n}</button>`;
        let h = `<div class="w-hd"><b>🗺️ 土地</b><button class="w-x2" data-l="x">✕</button></div><div class="w-seg">${[['search', '🔍 搜尋'], ['market', '🏘️ 房地產'], ['mine', '📋 我的土地']].map(([k, n]) => `<button class="w-tab ${LT === k ? '' : 'off'}" data-l="t:${k}">${n}</button>`).join('')}</div>`;
        if (LT === 'search') {
            const q = qv.trim(); let res = [];
            if (/^#?\d+$/.test(q)) { const p = parcels[+q.replace('#', '')]; if (p) res = [p]; }
            else if (q) { const lq = q.toLowerCase(); res = Object.keys(S).filter(i => parcels[i] && (S[i].n || '').toLowerCase().includes(lq)).slice(0, 25).map(i => parcels[i]); }
            h += `<div class="w-search"><input id="w-q" placeholder="土地編號（0～${parcels.length - 1}）或地主名稱" value="${esc(qv)}"><button class="w-go" data-l="q">搜尋</button></div>`;
            h += q ? (res.map(rowHtml).join('') || '<div class="w-empty">找不到符合的土地</div>') : `<div class="w-empty">全圖共 ${parcels.length} 塊地，輸入編號或地主名字就能找</div>`;
            h += `<div class="w-sub">🏙️ 城鎮快速前往</div><div class="w-chips">${towns.map((t, i) => chip(false, 'tw:' + i, t.n)).join('')}</div>`;
        } else if (LT === 'market') {
            h += `<div class="w-sub">分區</div><div class="w-chips">${['全部', ...ZN].map((n, i) => chip(fz === i - 1, 'fz:' + (i - 1), n)).join('')}</div><div class="w-sub">用途</div><div class="w-chips">${['全部', ...U].map((n, i) => chip(fu === i - 1, 'fu:' + (i - 1), n)).join('')}</div><div class="w-chips">排序　${chip(srt === 'p', 's:p', '價格低→高')}${chip(srt === 'a', 's:a', '面積大→小')}</div>`;
            const ok = p => (fz < 0 || p.z === fz) && (fu < 0 || p.u === fu);
            const lst = Object.keys(S).filter(i => parcels[i] && S[i].ls && S[i].o !== uid).map(i => parcels[i]).filter(ok).sort((a, b) => S[a.i].ls - S[b.i].ls).slice(0, 15);
            h += `<div class="w-sub">🏷️ 玩家掛牌出售（${lst.length}）</div>` + (lst.map(rowHtml).join('') || '<div class="w-empty">目前沒有符合的掛牌</div>');
            const pr = new Map(), free = parcels.filter(p => !S[p.i] && p.hq === undefined && ok(p)); free.forEach(p => pr.set(p, price(p)));
            free.sort(srt === 'a' ? (a, b) => b.a - a.a : (a, b) => pr.get(a) - pr.get(b));
            h += `<div class="w-sub">🌱 無主土地（共 ${free.length} 塊，顯示前 25）</div>` + (free.slice(0, 25).map(rowHtml).join('') || '<div class="w-empty">沒有符合條件的無主土地</div>');
        } else {
            const mine = Object.keys(S).filter(i => parcels[i] && S[i].o === uid).map(i => parcels[i]).sort((a, b) => price(b) - price(a));
            h += `<div class="w-sum"><div><small>持有</small><b>${mine.length} 塊</b></div><div><small>地價總值</small><b>🪙${mine.reduce((s, p) => s + price(p), 0)}</b></div><div><small>建築投入</small><b>🪙${mine.reduce((s, p) => s + builtValue(p), 0)}</b></div></div>` + (mine.map(rowHtml).join('') || '<div class="w-empty">還沒有土地，去「房地產」買一塊吧</div>');
        }
        LS.innerHTML = h; LS.scrollTop = st; const inp = LS.querySelector('#w-q'); if (inp) inp.onkeydown = e => { if (e.key === 'Enter') { qv = inp.value.trim(); renderLand(); } };
    }
    function landClick(e) {
        const b = e.target.closest('[data-l]'); if (!b) return; const [op, a] = b.dataset.l.split(':');
        if (op === 'x') return closeLand();
        if (op === 't') { LT = a; ex = -1; LS.scrollTop = 0; } else if (op === 'q') { const i = LS.querySelector('#w-q'); qv = i ? i.value.trim() : ''; ex = -1; }
        else if (op === 'fz') fz = +a; else if (op === 'fu') fu = +a; else if (op === 's') srt = a; else if (op === 'ex') ex = ex === +a ? -1 : +a;
        else if (op === 'go') return goto(parcels[+a]);
        else if (op === 'tw') { const t = towns[+a]; closeLand(); sel = null; panel(); V.k = 9; center(t.x, t.y); return draw(); }
        renderLand();
    }
    function goto(p) { closeLand(); sel = p; const w = p.bb[2] - p.bb[0] + 1, h = p.bb[3] - p.bb[1] + 1; V.k = clamp(Math.min(W * .6 / w, H * .3 / h), 10, 26); center((p.bb[0] + p.bb[2] + 1) / 2, (p.bb[1] + p.bb[3] + 1) / 2, .32); showLand(true); draw(); }

    // ---------- 操作 ----------
    async function act(a) {
        const p = sel; if (!p || p.hq !== undefined) return; const pr = price(p);
        try {
            if (a === 'buy') {
                if (Economy.coins() < pr) return say('金幣不夠喔！');
                const r = await ref(p.i).transaction(v => v ? undefined : { o: uid, n: myName(), b: 0, t: pr });
                if (!r.committed) { say('被別人搶先買走了！'); return load(); }
                Economy.add(-pr, '買地'); S[p.i] = r.snapshot.val(); say('🏞️ 買到了！');
            } else if (a === 'up') {
                const b = (S[p.i] || {}).b || 0, c = buildCost(p, b + 1);
                if (Economy.coins() < c) return say('金幣不夠喔！');
                const need = Trade.need(b + 1); if (!Trade.has(need)) return say('建材不夠：' + Trade.needText(need));
                const r = await ref(p.i).transaction(v => v && v.o === uid && (v.b || 0) < CAP[p.z] ? Object.assign({}, v, { b: (v.b || 0) + 1 }) : undefined);
                if (!r.committed) return say('無法建造');
                Economy.add(-c, '建造'); Trade.use(need); S[p.i] = r.snapshot.val(); say('🏗️ 蓋好了！');
            } else if (a === 'list') {
                const x = S[p.i] || {}; if (x.s || x.d || x.e) return say('有合夥人、展品或員工，不能掛牌（先處理掉）');
                const v = parseInt(prompt(`掛牌價多少金幣？（系統估價 ${pr}）`), 10); if (!(v > 0)) return;
                const r = await ref(p.i).transaction(y => y && y.o === uid && !y.s && !y.d && !y.e ? Object.assign({}, y, { ls: v }) : undefined);
                if (!r.committed) return say('無法掛牌'); S[p.i] = r.snapshot.val(); say('🏷️ 已掛牌出售');
            } else if (a === 'unlist') {
                const r = await ref(p.i).transaction(y => { if (!y || y.o !== uid) return; const z = Object.assign({}, y); delete z.ls; return z; });
                if (r.committed) { S[p.i] = r.snapshot.val(); say('已取消掛牌'); }
            } else if (a === 'buyls') {
                const x = S[p.i]; if (!x || !x.ls || x.o === uid) return; const cost = x.ls, seller = x.o;
                if (Economy.coins() < cost) return say('金幣不夠喔！');
                const r = await ref(p.i).transaction(y => { if (!y || y.ls !== cost || y.o === uid || y.s || y.d || y.e) return; const z = Object.assign({}, y, { o: uid, n: myName(), t: cost }); delete z.ls; delete z.j; delete z.po; return z; });
                if (!r.committed) { say('已被買走或價格變了'); return load(); }
                Economy.add(-cost, '購買掛牌土地'); const tax = Math.floor(cost * Civic.fee());
                firebase.database().ref('world/mail/' + seller).push({ c: cost - tax, t: Date.now() }); Civic.tax(tax); S[p.i] = r.snapshot.val(); say('🏠 成交！');
            } else if (a === 'sell') {
                if ((S[p.i] || {}).s || (S[p.i] || {}).d) return say('有合夥人或展品，不能直接賣出（先收回展品）');
                const get = Math.round(pr * SELL + builtValue(p) * .5);
                const r = await ref(p.i).transaction(v => v && v.o === uid ? null : undefined);
                if (!r.committed) return say('無法賣出');
                delete S[p.i]; Economy.add(get, '賣地');
            }
        } catch (e) { say('連線失敗，請稍後再試'); }
        refreshAll();
    }
    const tctxLoad = () => Trade.load(tctx()).then(refreshAll).catch(() => { });
    function load() { tctxLoad(); return ref().once('value').then(s => { S = s.val() || {}; loaded = true; refreshAll(); }).catch(() => say('讀取世界資料失敗')); }
    function close() { if (!ov) return; if (loaded) localStorage.setItem('vk_assets', assets()); Trade.close(); closeLand(); clearInterval(clk); removeEventListener('resize', onResize); ov.remove(); ov = null; ctx = null; report(); }
    const onResize = () => { if (ov) { fit(); draw(); } };

    function open() {
        if (ov) return;
        ov = document.createElement('div'); ov.className = 'wv';
        ov.style.cssText = 'position:fixed;inset:0;z-index:2000;background:#0b1220;touch-action:none;font-family:system-ui,-apple-system,"PingFang TC","Noto Sans TC",sans-serif;-webkit-user-select:none;user-select:none';
        ov.innerHTML = CSS + '<canvas style="position:absolute;inset:0;width:100%;height:100%"></canvas>'
            + '<div class="card w-me"><div class="w-av"></div><div class="w-mi"><b class="w-nm"></b><span class="w-cn"></span></div></div><div class="card w-bd" hidden></div>'
            + '<div class="card w-clk"><b>--:--</b><small></small></div><div class="card w-cal" hidden></div><div class="w-toast"></div>'
            + '<div class="card w-panel" hidden></div>'
            + '<div class="card w-dock">' + Object.keys(DK).map(k => `<button data-d="${k}"><span>${DK[k][0]}</span>${DK[k][1]}</button>`).join('') + '</div>';
        document.body.appendChild(ov); cv = $q('canvas'); ctx = cv.getContext('2d');
        fit(); sel = null; landShown = false; addEventListener('resize', onResize); tick(); clk = setInterval(tick, 20000); syncDock();
        say('🗺️ 地圖生成中…第一次需要幾秒，之後會記住');
        setTimeout(() => {
            if (!ov) return; ensure(); lb = lb || mk(); lt = lt || mk(); lo = lo || mk(); paintBase(); paintUse();
            const big = towns[0]; V.k = 6; center(big ? big.x : N / 2, big ? big.y : N / 2); refreshAll(); load();
        }, 50);
        $q('.w-me').onclick = () => { const b = $q('.w-bd'); b.hidden = !b.hidden; };
        $q('.w-clk').onclick = () => { const c = $q('.w-cal'); c.hidden = !c.hidden; if (!c.hidden) c.innerHTML = calHtml(); };
        $q('.w-dock').onclick = e => {
            const b = e.target.closest('button'); if (!b) return; const k = b.dataset.d;
            if (k === 'exit') return close(); if (k === 'land') return openLand();
            closeLand(); landShown = false; panel(); Trade.market(tctx(), DK[k][2]); syncDock();
        };
        $q('.w-panel').onclick = e => { const a = e.target.dataset && e.target.dataset.a; if (a === 'hide') showLand(false); else if (a === 'stk') Economy.open('stock'); else if (a) a.startsWith('t:') ? Trade.act(a, sel, S, tctx()) : act(a); };
        const ptr = new Map(); let moved = 0, d0 = 0;
        cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; if (ptr.size === 2) { const [a, b] = [...ptr.values()]; d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); } };
        cv.onpointermove = e => {
            if (!ptr.has(e.pointerId)) return; const o = ptr.get(e.pointerId);
            if (ptr.size === 1) { V.x += e.clientX - o[0]; V.y += e.clientY - o[1]; moved += Math.abs(e.clientX - o[0]) + Math.abs(e.clientY - o[1]); }
            else { ptr.set(e.pointerId, [e.clientX, e.clientY]); const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom(d / d0, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); d0 = d; moved = 99; }
            ptr.set(e.pointerId, [e.clientX, e.clientY]); draw();
        };
        cv.onpointerup = cv.onpointercancel = e => {
            if (ptr.size === 1 && moved < 6) {
                const x = Math.floor((e.clientX - V.x) / V.k), y = Math.floor((e.clientY - V.y) / V.k), c = inb(x, y) ? y * N + x : -1;
                if (c >= 0 && pid[c] >= 0) { sel = parcels[pid[c]]; Trade.close(); showLand(true); } else { sel = null; if (c >= 0) say(road[c] ? (road[c] === 2 ? '🛣️ 主幹道' : '🛣️ 道路') : TN[terr[c]]); panel(); }
                $q('.w-cal').hidden = true; draw();
            }
            ptr.delete(e.pointerId);
        };
        cv.onwheel = e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); draw(); };
    }
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (ov) { paintBase(); draw(); } });
    const btn = document.getElementById('btn-goto-world'); if (btn) btn.onclick = open;
    setTimeout(report, 5000);
    return { wealth, report, open, parcels: () => parcels.length, stats: () => ({ towns: towns.length, parcels: parcels.length }) };
})();
