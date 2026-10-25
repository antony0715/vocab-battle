// ==================== 📲 加入主畫面 / 全螢幕適配 (pwa.js) ====================
// - Android / 桌面 Chrome：用 beforeinstallprompt 直接跳出「安裝」視窗（一鍵加入）
// - iPhone / iPad：Safari 不允許網頁自動加入，所以改跳出圖文步驟
// - 從主畫面開啟（standalone）後就是全螢幕，按鈕會自動隱藏
// - 另外把「真正可視高度」寫進 CSS 變數 --vh，解決手機網址列伸縮造成的 100vh 不準
const PWA = (() => {
    const de = document.documentElement;
    const ua = navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /android/i.test(ua);
    const inApp = /Line\/|FBAN|FBAV|Instagram|MicroMessenger|; wv\)/i.test(ua); // LINE / FB / IG 等內建瀏覽器，沒辦法加入主畫面
    const standalone = () => (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches)) || navigator.standalone === true;
    let deferred = null;

    // ---- 可視高度 / 方向 ----
    const setVh = () => {
        const h = (window.visualViewport ? visualViewport.height : window.innerHeight);
        de.style.setProperty('--vh', (h * 0.01) + 'px');
        de.classList.toggle('landscape', window.innerWidth > window.innerHeight);
        de.classList.toggle('short-screen', window.innerHeight < 480); // 橫放的手機
    };
    setVh();
    ['resize', 'orientationchange', 'fullscreenchange', 'webkitfullscreenchange'].forEach(ev => window.addEventListener(ev, () => { setVh(); setTimeout(setVh, 250); }));
    if (window.visualViewport) visualViewport.addEventListener('resize', setVh);
    if (standalone()) de.classList.add('standalone');

    // ---- 說明視窗 ----
    function guide() {
        if (document.getElementById('pwa-guide')) return;
        let steps;
        if (inApp) steps = ['你現在使用的是 App 內建瀏覽器，無法加入主畫面。', '請點右上角「⋯」或「︙」，選擇<b>用 Safari / Chrome 開啟</b>，再回到這裡加入。'];
        else if (isIOS) steps = ['點瀏覽器下方（或右上角）的<b>「分享」</b>圖示 <span class="pwa-ic">⬆️</span>', '往下滑，選擇<b>「加入主畫面」</b>', '按右上角<b>「新增」</b>，之後就能從主畫面全螢幕開啟'];
        else if (isAndroid) steps = ['點瀏覽器右上角<b>「⋮」</b>選單', '選擇<b>「安裝應用程式」</b>或<b>「加到主畫面」</b>', '按<b>「安裝」</b>，之後就能從主畫面全螢幕開啟'];
        else steps = ['點網址列右側的<b>「安裝」</b>圖示（或瀏覽器選單裡的「安裝應用程式」）', '按下<b>「安裝」</b>即可'];
        const el = document.createElement('div');
        el.id = 'pwa-guide'; el.className = 'modal-overlay';
        el.innerHTML = `<div class="pwa-card"><h3>📲 加入主畫面</h3><ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol>
            <p class="pwa-note">加入後從主畫面開啟，會是沒有網址列的全螢幕，也會自動避開瀏海與手勢列。</p>
            <button class="btn btn-primary" type="button">知道了</button></div>`;
        el.addEventListener('click', e => { if (e.target === el || e.target.tagName === 'BUTTON') el.remove(); });
        document.body.appendChild(el);
    }
    async function install() {
        if (standalone()) return;
        if (deferred) { // Android Chrome：直接跳出系統的安裝視窗
            try { deferred.prompt(); const r = await deferred.userChoice; if (r && r.outcome === 'accepted') hideBtn(); } catch (e) { guide(); }
            deferred = null; return;
        }
        guide();
    }
    const hideBtn = () => { const b = document.getElementById('btn-install'); if (b) b.classList.add('hidden'); };
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
    window.addEventListener('appinstalled', () => { hideBtn(); deferred = null; });
    window.addEventListener('DOMContentLoaded', () => {
        const b = document.getElementById('btn-install'); if (!b) return;
        if (standalone()) hideBtn(); else b.addEventListener('click', install);
    });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
        window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
    }
    return { guide, install, standalone, isIOS };
})();
