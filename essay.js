// ==================== ✍️ 英文作文訓練 (essay.js) ====================
// 規則式自我檢查（不是 AI 批改）：字數、句型、用字級別、連接詞、常見錯誤。需放在 app.js 之後載入。
(function () {
    const KEY_H = 'essay_history_v1', KEY_D = 'essay_draft_v1';
    const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
    const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

    const TOPICS = [
        { id: 'l1', type: 'letter', title: '邀請外國朋友來校慶', zh: '寫一封信給外國筆友，介紹你的學校生活，並邀請他來台灣參加校慶。', kw: ['invite', 'campus', 'festival', 'experience', 'look forward to'] },
        { id: 'l2', type: 'letter', title: '推薦一本書', zh: '寫信向朋友推薦一本你最近讀過的書，說明內容與推薦原因。', kw: ['recommend', 'author', 'plot', 'inspire', 'worth'] },
        { id: 'l3', type: 'letter', title: '感謝老師', zh: '寫信給一位老師，感謝他在你學習上的幫助。', kw: ['grateful', 'encourage', 'patient', 'guidance', 'appreciate'] },
        { id: 'l4', type: 'letter', title: '商品有瑕疵', zh: '寫信給網路商店，說明收到的商品有瑕疵，並要求處理方式。', kw: ['damaged', 'refund', 'replace', 'disappointed', 'request'] },
        { id: 'l5', type: 'letter', title: '介紹台灣夜市', zh: '寫信給交換學生，介紹台灣夜市文化並推薦三種小吃。', kw: ['stall', 'flavor', 'local', 'specialty', 'crowded'] },
        { id: 'l6', type: 'letter', title: '暑假計畫', zh: '寫信給朋友，分享你這個暑假的計畫與期待。', kw: ['plan', 'volunteer', 'schedule', 'improve', 'opportunity'] },
        { id: 'g1', type: 'guided', title: '手機讓人更疏遠？', zh: '有人認為手機讓人們彼此更疏遠。你同意嗎？請說明理由並舉例。', kw: ['communicate', 'distance', 'addicted', 'face-to-face', 'relationship'] },
        { id: 'g2', type: 'guided', title: '學生該穿制服嗎？', zh: '你認為學生上學應該穿制服嗎？請寫出你的立場與理由。', kw: ['uniform', 'equality', 'freedom', 'identity', 'expression'] },
        { id: 'g3', type: 'guided', title: '社群媒體的利與弊', zh: '社群媒體對青少年是利大於弊，還是弊大於利？', kw: ['influence', 'privacy', 'distract', 'connect', 'pressure'] },
        { id: 'g4', type: 'guided', title: '在家學習能取代學校嗎？', zh: '你認為線上或在家學習可以完全取代到學校上課嗎？', kw: ['independent', 'interaction', 'flexible', 'discipline', 'effective'] },
        { id: 'g5', type: 'guided', title: '克服困難的經驗', zh: '描述一次你克服困難的經驗，並說明你從中學到什麼。', kw: ['challenge', 'overcome', 'determination', 'lesson', 'confident'] },
        { id: 'g6', type: 'guided', title: '一天的超能力', zh: '如果你能擁有一天的超能力，你會選擇什麼？你會怎麼運用？', kw: ['ability', 'imagine', 'benefit', 'society', 'meaningful'] },
        { id: 'g7', type: 'guided', title: '日常環保行動', zh: '你在日常生活中可以做哪些事來保護地球？請提出具體做法。', kw: ['environment', 'recycle', 'reduce', 'pollution', 'sustainable'] },
        { id: 'g8', type: 'guided', title: '大學前該不該打工？', zh: '你認為高中生應該在大學前打工嗎？請說明你的看法。', kw: ['experience', 'responsibility', 'balance', 'financial', 'independent'] },
        { id: 'g9', type: 'guided', title: '理想的假期', zh: '描述你心目中理想的假期，並說明為什麼。', kw: ['relax', 'destination', 'recharge', 'adventure', 'memorable'] },
        { id: 'g10', type: 'guided', title: '我最敬佩的人', zh: '寫出一位你最敬佩的人，並說明原因。', kw: ['admire', 'role model', 'dedicated', 'achieve', 'influence'] },
        { id: 'g11', type: 'guided', title: '旅行的意義', zh: '你覺得旅行的意義是什麼？在國內探索與出國旅行有何不同？', kw: ['broaden', 'culture', 'perspective', 'explore', 'tradition'] },
        { id: 'g12', type: 'guided', title: 'AI 對學習的影響', zh: '人工智慧工具對學生的學習有什麼影響？請提出你的看法。', kw: ['technology', 'rely on', 'creativity', 'efficient', 'critical thinking'] }
    ];
    // 🤖 AI 批改：填入你部署好的批改服務網址（見 worker.js）。留空＝尚未啟用。
    const AI_ENDPOINT = '';
    const TYPE_LABEL = { letter: '書信', guided: '引導寫作' };

    const STOP = new Set(('a an the and or but if so as of to in on at by for with from about into over after before between through during without within up down out off again further then once here there when where why how all any both each few more most other some such no nor not only own same than too very can will just should now is am are was were be been being have has had having do does did doing i me my myself we our ours you your yours he him his she her hers it its they them their what which who whom this that these those would could might must shall may also because while although though however yet still even ever never always often really much many get got go went gone come came make made say said let lets one two three four five six seven eight nine ten first second third last next new old good bad big small long short high low early late young great little less least well back away around another every something someone anything nothing everything everyone own however whether either neither among upon per via am pm dont doesnt didnt isnt arent wasnt werent cant couldnt wouldnt shouldnt wont im ive id ill youre youve theyre theyve weve were thats whats lets').split(/\s+/));

    const UPGRADES = {
        good: ['excellent', 'beneficial', 'valuable'], bad: ['harmful', 'terrible', 'negative'], important: ['essential', 'crucial', 'significant'],
        very: ['extremely', 'highly', 'quite'], many: ['numerous', 'a variety of', 'plenty of'], think: ['believe', 'consider', 'argue'],
        help: ['assist', 'support', 'benefit'], big: ['huge', 'enormous', 'significant'], happy: ['delighted', 'pleased', 'glad'],
        thing: ['aspect', 'matter', 'factor'], get: ['obtain', 'receive', 'gain'], like: ['enjoy', 'appreciate', 'be fond of'],
        make: ['create', 'produce', 'cause'], people: ['individuals', 'citizens', 'the public'], use: ['apply', 'employ', 'utilize'],
        want: ['wish', 'desire', 'hope'], show: ['demonstrate', 'reveal', 'indicate'], interesting: ['fascinating', 'intriguing', 'engaging'],
        beautiful: ['gorgeous', 'stunning', 'charming'], nice: ['pleasant', 'wonderful', 'kind'], hard: ['challenging', 'demanding', 'difficult'],
        easy: ['effortless', 'straightforward', 'simple'], buy: ['purchase', 'acquire'], tell: ['inform', 'notify', 'explain']
    };

    const TRANS = [
        { name: '列舉順序', ex: 'first / in addition / moreover / finally', re: /\b(first|firstly|second|secondly|third|finally|in addition|moreover|furthermore|besides|to begin with)\b/i },
        { name: '轉折對比', ex: 'however / on the other hand / in contrast', re: /\b(however|on the other hand|nevertheless|in contrast|on the contrary|although|though|whereas)\b/i },
        { name: '因果結果', ex: 'therefore / as a result / thus', re: /\b(therefore|as a result|thus|consequently|because of|due to|owing to)\b/i },
        { name: '舉例說明', ex: 'for example / for instance / such as', re: /\b(for example|for instance|such as|in particular)\b/i },
        { name: '結論總結', ex: 'in conclusion / to sum up / all in all', re: /\b(in conclusion|to sum up|in summary|in short|all in all|to conclude|overall)\b/i }
    ];

    let lastResult = null, sel = null, selType = 'all', target = 120, minutes = 0, topic = null, timerId = null, endAt = 0, fromHistory = false, vocabSet = null;
    const lvNum = l => String(l || '').replace('level', '');
    screens.essay = $('essay-screen');

    // ---------- 工具 ----------
    const tokens = t => (t.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []);
    const sentencesOf = t => (t.match(/[^.!?\n]+[.!?]*/g) || []).map(s => s.trim()).filter(s => /[A-Za-z]/.test(s));
    function findVocab(w) {
        w = w.toLowerCase().replace(/'s$/, '');
        let v = vocabLookup(w); if (v) return v;
        const c = [], n = w.length, dbl = k => n > k + 1 && w[n - k - 1] === w[n - k - 2];
        if (w.endsWith('ies')) c.push(w.slice(0, -3) + 'y');
        if (w.endsWith('ied')) c.push(w.slice(0, -3) + 'y');
        if (w.endsWith('es')) c.push(w.slice(0, -2));
        if (w.endsWith('s')) c.push(w.slice(0, -1));
        if (w.endsWith('ed')) { c.push(w.slice(0, -2), w.slice(0, -1)); if (dbl(2)) c.push(w.slice(0, -3)); }
        if (w.endsWith('ing')) { c.push(w.slice(0, -3), w.slice(0, -3) + 'e'); if (dbl(3)) c.push(w.slice(0, -4)); }
        if (w.endsWith('ly')) c.push(w.slice(0, -2));
        if (w.endsWith('er') || w.endsWith('est')) c.push(w.replace(/(er|est)$/, ''), w.replace(/(er|est)$/, 'e'));
        for (const x of c) if (x.length >= 3 && (v = vocabLookup(x))) return v;
        return null;
    }

    // ---------- 分析 ----------
    function analyze(text) {
        const toks = tokens(text), words = toks.map(w => w.toLowerCase());
        const sents = sentencesOf(text);
        const paras = text.split(/\n+/).filter(p => p.trim()).length;
        const uniq = new Set(words);
        const byLv = {}; ALL_LEVELS.forEach(l => byLv[l] = new Set());
        const outVocab = new Set(), count = {};
        // 句首字（用來略過專有名詞判斷）
        const sentStart = new Set(); sents.forEach(s => { const m = s.match(/[A-Za-z]+/); if (m) sentStart.add(m[0] + '@' + text.indexOf(s)); });
        toks.forEach((raw, i) => {
            const w = raw.toLowerCase().replace(/'s$/, '');
            if (!STOP.has(w) && w.length >= 3) count[w] = (count[w] || 0) + 1;
            const v = findVocab(w);
            if (v) byLv[v.level].add(v.word.toLowerCase());
            else if (!STOP.has(w.replace(/'/g, '')) && !STOP.has(w) && w.length >= 3 && !/^[A-Z]/.test(raw)) outVocab.add(w);
        });
        const repeated = Object.entries(count).filter(([w, c]) => c >= 4).sort((a, b) => b[1] - a[1]).slice(0, 6);
        const upgrades = Object.keys(UPGRADES).filter(w => (count[w] || 0) >= 2 || (w === 'very' && (count[w] || 0) >= 1))
            .map(w => ({ w, c: count[w], alts: UPGRADES[w] })).slice(0, 8);
        const trans = TRANS.map(t => ({ name: t.name, ex: t.ex, used: t.re.test(text) }));

        // 常見問題（規則式，可能誤判）
        const issues = [];
        const add = (tip, ex) => issues.length < 12 && issues.push({ tip, ex });
        sents.forEach(s => {
            const wc = tokens(s).length;
            if (wc >= 2 && /^[a-z]/.test(s)) add('句子開頭要大寫', s.slice(0, 50));
            if (wc > 35) add(`這句有 ${wc} 個字，太長了，建議拆成兩句`, s.slice(0, 60) + '…');
            if (/\bbecause\b/i.test(s) && /\bso\b/i.test(s) && /\bbecause\b[^.!?]*\bso\b/i.test(s)) add('because 與 so 不要同一句並用', s.slice(0, 60));
            if (/\balthough\b[^.!?]*\bbut\b/i.test(s)) add('although 與 but 不要同一句並用', s.slice(0, 60));
        });
        if (/(^|[\s(])i(\s|'m|'ll|'ve|'d)/.test(text)) add('代名詞「I」一定要大寫', '把小寫的 i 改成 I');
        if (/\s[,.!?;:]/.test(text)) add('標點符號前面不要有空格', '例如 "word ," 應寫成 "word,"');
        if (/\bvery very\b/i.test(text)) add('very very 重複，改用 extremely 等更強的字', 'very very');
        if (text.trim() && !/[.!?"')]$/.test(text.trim())) add('文章最後缺少結尾標點', text.trim().slice(-30));
        const checks = [
            [/\bdiscuss about\b/i, 'discuss 後面直接接受詞，不加 about'],
            [/\bI am agree\b/i, '應寫成 I agree'],
            [/\b(more|most) (better|easier|bigger|harder|worse|faster|larger)\b/i, '比較級不要重複加 more'],
            [/\bpeople (is|has)\b/i, 'people 是複數，要用 are / have'],
            [/\baccording to my opinion\b/i, '應寫成 in my opinion'],
            [/\bin my opinion,? I think\b/i, 'in my opinion 與 I think 重複，擇一即可'],
            [/\b(he|she|it) (have|are|were|don't|do)\b/i, '第三人稱單數：應用 has / is / was / doesn\'t / does'],
            [/\b(they|we|you) (is|has|doesn't)\b/i, '主詞與動詞不一致（they/we/you 應搭 are / have / don\'t）'],
            [/\bI (is|are|has|were|doesn't)\b/i, '主詞 I 要搭 am / have / was / don\'t']
        ];
        checks.forEach(([re, tip]) => { const m = text.match(re); if (m) add(tip, m[0]); });
        const vowelSnd = w => (/^[aeiou]/.test(w) && !/^(uni|use|usu|usa|uti|eu|one|once|ubi|uk|ufo)/.test(w)) || /^(hour|honest|honor|honour|heir)/.test(w);
        let m, re = /\b(a|an)\s+([A-Za-z]+)/gi;
        while ((m = re.exec(text))) {
            if (/^[A-Z]{2,}$/.test(m[2])) continue;
            const art = m[1].toLowerCase(), nx = m[2].toLowerCase();
            if (art === 'a' && vowelSnd(nx)) add('母音發音開頭的字前面要用 an', m[0]);
            else if (art === 'an' && !vowelSnd(nx)) add('子音發音開頭的字前面要用 a', m[0]);
        }
        return { text, words: toks.length, sents: sents.length, paras, avg: sents.length ? Math.round(toks.length / sents.length * 10) / 10 : 0, uniq: uniq.size, ratio: toks.length ? Math.round(uniq.size / toks.length * 100) : 0, byLv, outVocab: [...outVocab].slice(0, 20), repeated, upgrades, trans, issues };
    }

    // ---------- 畫面 ----------
    function view(n) { ['setup', 'write', 'result', 'history'].forEach(v => $('es-' + v).classList.toggle('hidden', v !== n)); window.scrollTo(0, 0); }
    function openEssay() { showScreen('essay'); renderSetup(); view('setup'); }

    function renderSetup() {
        const d = load(KEY_D, null);
        $('es-resume').innerHTML = d && d.text && d.text.trim() ? `<button class="btn btn-sky" data-act="resume">📝 繼續上次的草稿（${tokens(d.text).length} 字）</button>` : '';
        $('es-types').innerHTML = [['all', '全部'], ['letter', '✉️ 書信'], ['guided', '💭 引導寫作']].map(([k, t]) => `<button class="es-chip ${selType === k ? 'on' : ''}" data-act="type" data-v="${k}">${t}</button>`).join('');
        $('es-topics').innerHTML = TOPICS.filter(t => selType === 'all' || t.type === selType).map(t =>
            `<div class="es-topic ${sel === t.id ? 'on' : ''}" data-act="topic" data-v="${t.id}"><b>${esc(t.title)}</b><span class="es-tag">${TYPE_LABEL[t.type]}</span><div class="es-zh">${esc(t.zh)}</div></div>`).join('');
        $('es-targets').innerHTML = [80, 120, 150, 200].map(n => `<button class="es-chip ${target === n ? 'on' : ''}" data-act="target" data-v="${n}">${n} 字</button>`).join('');
        $('es-times').innerHTML = [[0, '不限時'], [20, '20 分'], [30, '30 分'], [40, '40 分']].map(([n, t]) => `<button class="es-chip ${minutes === n ? 'on' : ''}" data-act="time" data-v="${n}">${t}</button>`).join('');
    }

    function startWriting(t, text) {
        topic = t; fromHistory = false;
        $('es-ptitle').textContent = t.title;
        $('es-pzh').textContent = t.zh;
        $('es-hints').classList.add('hidden');
        $('es-hints').innerHTML = t.kw && t.kw.length ? '<b>💡 可用字詞</b>' + t.kw.map(k => { const v = vocabLookup(k); return `<span class="es-kw">${esc(k)}${v ? ' <small>' + esc(v.meaning.split(/[，、;；]/)[0]) + '</small>' : ''}</span>`; }).join('') : '';
        $('es-hint-btn').style.display = t.kw && t.kw.length ? '' : 'none';
        $('es-text').value = text || '';
        $('es-lookup-in').value = ''; $('es-lookup-out').textContent = '';
        $('es-msg').textContent = '';
        updateCount();
        clearInterval(timerId); timerId = null;
        if (minutes > 0) { endAt = Date.now() + minutes * 60000; tick(); timerId = setInterval(tick, 1000); } else $('es-timer').textContent = '';
        view('write');
        setTimeout(() => $('es-text').focus(), 50);
    }
    function tick() {
        const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
        const el = $('es-timer'); el.textContent = left > 0 ? `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '⏰ 時間到！';
        el.classList.toggle('es-red', left <= 60);
        if (left <= 0) { clearInterval(timerId); timerId = null; }
    }
    let _sv = 0;
    function updateCount() {
        const n = tokens($('es-text').value).length, el = $('es-count');
        el.textContent = `${n} / ${target} 字`;
        el.className = 'es-count ' + (n >= target ? 'ok' : n >= target * 0.8 ? 'near' : '');
        clearTimeout(_sv); _sv = setTimeout(() => save(KEY_D, { topic, text: $('es-text').value, target, minutes }), 600);
    }

    const bar = (n, max) => `<div class="es-bar"><i style="width:${max ? Math.round(n / max * 100) : 0}%"></i></div>`;
    function renderResult(r, title, isHistory, meta) {
        lastResult = { text: r.text, title, zh: (meta && meta.zh) || (topic && !isHistory ? topic.zh : ''), ts: meta && meta.ts, ai: meta && meta.ai };
        $('es-ai').innerHTML = ''; if (lastResult.ai) renderAI(lastResult.ai);
        $('es-ai-btn').textContent = lastResult.ai ? '🤖 重新 AI 批改' : '🤖 AI 批改';
        const max = Math.max(1, ...ALL_LEVELS.map(l => r.byLv[l].size));
        const hi = [...r.byLv.level4, ...r.byLv.level5, ...r.byLv.level6];
        const lvRows = ALL_LEVELS.map(l => `<div class="es-lvrow"><span>${LEVEL_LABEL[l]}</span>${bar(r.byLv[l].size, max)}<em>${r.byLv[l].size}</em></div>`).join('');
        const chips = l => [...r.byLv[l]].slice(0, 24).map(w => { const v = vocabLookup(w); return `<span class="es-kw" title="${esc(v ? v.meaning : '')}">${esc(w)}</span>`; }).join('');
        const diff = r.words - target;
        const lenMsg = isHistory ? '' : diff >= 0 ? `✅ 已達目標字數（${target} 字）` : `⚠️ 離目標還差 ${-diff} 字`;
        $('es-result-body').innerHTML = `
            <div class="es-title">${esc(title)}</div>
            ${lenMsg ? `<div class="es-note">${lenMsg}</div>` : ''}
            <div class="es-cards">
                <div class="es-card"><b>${r.words}</b><span>字數</span></div>
                <div class="es-card"><b>${r.sents}</b><span>句數</span></div>
                <div class="es-card"><b>${r.avg}</b><span>平均句長</span></div>
                <div class="es-card"><b>${r.ratio}%</b><span>用字不重複</span></div>
                <div class="es-card"><b>${r.paras}</b><span>段落</span></div>
                <div class="es-card"><b>${hi.length}</b><span>4級以上字</span></div>
            </div>
            <h3 class="es-h">📊 用字級別（不重複字數）</h3>
            <div class="es-lv">${lvRows}</div>
            ${r.byLv.level6.size + r.byLv.level5.size ? `<div class="es-chips"><small>5~6 級字：</small>${chips('level5')}${chips('level6')}</div>` : '<div class="es-hint">還沒用到 5~6 級字，試試加入一些進階單字！</div>'}
            <h3 class="es-h">🔗 連接詞</h3>
            <div class="es-trans">${r.trans.map(t => `<div class="${t.used ? 'ok' : 'no'}">${t.used ? '✓' : '✗'} ${t.name}<small>${t.used ? '' : t.ex}</small></div>`).join('')}</div>
            ${r.issues.length ? `<h3 class="es-h">🔍 可能的問題（規則檢查，可能有誤判）</h3>${r.issues.map(i => `<div class="es-issue"><div>${esc(i.tip)}</div><code>${esc(i.ex)}</code></div>`).join('')}` : '<h3 class="es-h">🔍 可能的問題</h3><div class="es-hint">✅ 沒有偵測到常見問題（仍建議自己再檢查文法）</div>'}
            ${r.repeated.length ? `<h3 class="es-h">♻️ 重複太多次的字</h3><div class="es-chips">${r.repeated.map(([w, c]) => `<span class="es-kw">${esc(w)} ×${c}</span>`).join('')}</div>` : ''}
            ${r.upgrades.length ? `<h3 class="es-h">⬆️ 可以升級的基礎字</h3>${r.upgrades.map(u => `<div class="es-up"><b>${esc(u.w)}</b>${u.c ? ` ×${u.c}` : ''} → ${u.alts.map(a => { const v = vocabLookup(a); return `<span class="es-kw">${esc(a)}${v ? ' <small>' + LEVEL_LABEL[v.level] + '</small>' : ''}</span>`; }).join('')}</div>`).join('')}` : ''}
            ${r.outVocab.length ? `<h3 class="es-h">🔤 字庫外的字</h3><div class="es-hint">可能是拼錯、專有名詞或變化形，請自己確認拼字：</div><div class="es-chips">${r.outVocab.map(w => `<span class="es-kw">${esc(w)}</span>`).join('')}</div>` : ''}
            <h3 class="es-h">📄 我的作文</h3><div class="es-text-view">${esc(r.text)}</div>`;
        $('es-result-title').textContent = isHistory ? '📄 作文紀錄' : '📋 作文檢查結果';
        view('result');
    }

    function renderHistory() {
        const list = load(KEY_H, []);
        $('es-hist-list').innerHTML = list.length ? list.map((h, i) => `<div class="es-hrow"><div class="es-hinfo" data-act="hopen" data-v="${i}"><b>${esc(h.title)}</b><small>${new Date(h.ts).toLocaleDateString()} · ${h.words} 字</small></div><button class="es-del" data-act="hdel" data-v="${i}">🗑</button></div>`).join('') : '<div class="es-hint">還沒有作文紀錄</div>';
        view('history');
    }

    function submit() {
        const text = $('es-text').value.trim();
        if (tokens(text).length < 10) { $('es-msg').textContent = '至少寫 10 個字再檢查喔～'; return; }
        clearInterval(timerId); timerId = null;
        const r = analyze(text), h = load(KEY_H, []);
        const ts = Date.now(), zh = topic ? topic.zh : '';
        h.unshift({ ts, title: topic ? topic.title : '自訂題目', zh, words: r.words, text });
        save(KEY_H, h.slice(0, 30)); localStorage.removeItem(KEY_D);
        renderResult(r, topic ? topic.title : '自訂題目', false, { ts, zh });
    }


    // ---------- 🤖 AI 批改 ----------
    const clamp = (n, m) => Math.max(0, Math.min(m, Math.round(Number(n) || 0)));
    const arr = x => (Array.isArray(x) ? x : []).map(s => String(s)).filter(Boolean).slice(0, 8);
    function renderAI(a) {
        const s = a.scores || {}, c = clamp(s.content, 5), o = clamp(s.organization, 5), g = clamp(s.grammar, 5), v = clamp(s.vocabulary, 5);
        const fixes = (Array.isArray(a.corrections) ? a.corrections : []).slice(0, 8);
        $('es-ai').innerHTML = `<div class="ai-box">
            <h3>🤖 AI 批改（仿學測五五五五，僅供參考）</h3>
            <div class="ai-total">${c + o + g + v}<small> / 20</small></div>
            <div class="ai-scores"><div><b>${c}</b>內容</div><div><b>${o}</b>組織</div><div><b>${g}</b>文法句構</div><div><b>${v}</b>用字拼字</div></div>
            ${a.summary ? `<div style="font-size:14px;line-height:1.5">${esc(a.summary)}</div>` : ''}
            ${arr(a.strengths).length ? `<h3>👍 優點</h3><ul>${arr(a.strengths).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
            ${arr(a.improvements).length ? `<h3>🔧 可以改進</h3><ul>${arr(a.improvements).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
            ${fixes.length ? `<h3>✏️ 逐句修正</h3>${fixes.map(f => `<div class="ai-fix"><s>${esc(f.original)}</s><br><b>${esc(f.fixed)}</b>${f.reason ? `<small>${esc(f.reason)}</small>` : ''}</div>`).join('')}` : ''}
            ${a.model ? `<h3>⭐ 參考改寫</h3><div class="ai-model">${esc(a.model)}</div>` : ''}
        </div>`;
    }
    async function runAI() {
        const box = $('es-ai'), btn = $('es-ai-btn');
        if (!lastResult) return;
        if (!AI_ENDPOINT) { box.innerHTML = '<div class="ai-box ai-err">AI 批改還沒啟用：請先部署 worker.js，並把網址填進 essay.js 最上面的 AI_ENDPOINT。</div>'; return; }
        btn.disabled = true; btn.textContent = '🤖 批改中…（約 10~30 秒）';
        box.innerHTML = '<div class="ai-box">AI 老師正在閱讀你的作文…</div>';
        const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 60000);
        try {
            const res = await fetch(AI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal, body: JSON.stringify({ essay: lastResult.text, title: lastResult.title, prompt: lastResult.zh || '', target }) });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data || data.error || !data.scores) throw new Error((data && data.error) || ('HTTP ' + res.status));
            lastResult.ai = data; renderAI(data);
            const h = load(KEY_H, []), it = h.find(x => x.ts === lastResult.ts);
            if (it) { it.ai = data; save(KEY_H, h); }
        } catch (err) {
            box.innerHTML = `<div class="ai-box ai-err">批改失敗：${esc(err.name === 'AbortError' ? '等太久了，請稍後再試' : err.message)}</div>`;
        } finally { clearTimeout(to); btn.disabled = false; btn.textContent = lastResult.ai ? '🤖 重新 AI 批改' : '🤖 AI 批改'; }
    }

    // ---------- 事件 ----------
    $('es-ai-btn').onclick = () => { playClickSound(); runAI(); };
    $('btn-goto-essay').onclick = () => { playClickSound(); openEssay(); };
    $('es-text').addEventListener('input', updateCount);
    $('es-hint-btn').onclick = () => { playClickSound(); $('es-hints').classList.toggle('hidden'); };
    $('es-lookup-btn').onclick = () => {
        const w = $('es-lookup-in').value.trim().toLowerCase(); if (!w) return;
        const v = findVocab(w);
        $('es-lookup-out').textContent = v ? `${v.word}（${LEVEL_LABEL[v.level]}）${posOf(v) ? posOf(v) + ' ' : ''}${v.meaning}` : '字庫裡沒有這個字（可能拼錯或不在 1~6 級）';
    };
    $('es-lookup-in').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('es-lookup-btn').click(); } });
    $('es-submit').onclick = () => { playClickSound(); submit(); };
    $('es-write-back').onclick = () => { playClickSound(); if (confirm('離開後草稿會保留，確定回到題目選擇？')) { clearInterval(timerId); timerId = null; renderSetup(); view('setup'); } };
    $('es-home').onclick = () => { playClickSound(); showScreen('lobby'); showMenu('main'); };
    $('es-hist-btn').onclick = () => { playClickSound(); renderHistory(); };
    $('es-hist-back').onclick = () => { playClickSound(); renderSetup(); view('setup'); };
    $('es-result-back').onclick = () => { playClickSound(); if (fromHistory) renderHistory(); else { renderSetup(); view('setup'); } };
    $('es-copy').onclick = () => { const t = $('es-result-body').querySelector('.es-text-view'); if (t && navigator.clipboard) navigator.clipboard.writeText(t.textContent).then(() => { $('es-copy').textContent = '✓ 已複製'; setTimeout(() => $('es-copy').textContent = '📋 複製作文', 1500); }); };
    $('es-start').onclick = () => {
        playClickSound();
        const custom = $('es-custom').value.trim();
        if (custom) return startWriting({ id: 'custom', type: 'guided', title: '自訂題目', zh: custom, kw: [] }, '');
        const pool = TOPICS.filter(t => selType === 'all' || t.type === selType);
        startWriting(TOPICS.find(t => t.id === sel) || pool[Math.floor(Math.random() * pool.length)], '');
    };
    $('essay-screen').addEventListener('click', e => {
        const el = e.target.closest('[data-act]'); if (!el) return;
        const a = el.dataset.act, v = el.dataset.v;
        if (a === 'type') { selType = v; renderSetup(); }
        else if (a === 'topic') { sel = sel === v ? null : v; renderSetup(); }
        else if (a === 'target') { target = +v; renderSetup(); }
        else if (a === 'time') { minutes = +v; renderSetup(); }
        else if (a === 'resume') { const d = load(KEY_D, null); if (d) { target = d.target || target; minutes = 0; startWriting(d.topic || { id: 'custom', type: 'guided', title: '自訂題目', zh: '', kw: [] }, d.text); } }
        else if (a === 'hopen') { const h = load(KEY_H, [])[+v]; if (h) { fromHistory = true; renderResult(analyze(h.text), h.title, true, { ts: h.ts, zh: h.zh, ai: h.ai }); } }
        else if (a === 'hdel') { if (confirm('刪除這筆作文紀錄？')) { const h = load(KEY_H, []); h.splice(+v, 1); save(KEY_H, h); renderHistory(); } }
        else return;
        if (a !== 'hopen' && a !== 'hdel') playClickSound();
    });
})();
