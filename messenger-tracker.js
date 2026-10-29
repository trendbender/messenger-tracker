/*! messenger-tracker v1.4.1 | MIT | https://github.com/trendbender/messenger-tracker
 * Which messenger button was clicked, where on the page, and on which page.
 * Sends the click to Yandex Metrica (reachGoal + visit params), GA4 (gtag) and GTM (dataLayer).
 * No dependencies, ES5, 6 KB minified (3 KB gzip). Does NOT load any counter itself: if the counter is not
 * on the page (e.g. the visitor declined cookies), nothing is sent.
 */
(function (w, d) {
  'use strict';
  if (w.MessengerTracker && w.MessengerTracker.version) return; // already initialised

  var cfg = w.MessengerTrackerConfig || {};
  // Config can also live on the <script> tag itself: no curly braces, safe inside CMS templates
  // (Fenom, Smarty, Twig, Blade). <script src=".../messenger-tracker.js" data-ym="123" data-goals="a,b_%place%">
  var me = d.currentScript;
  if (me && me.getAttribute('data-ym')) cfg.ym = +me.getAttribute('data-ym');
  if (me && me.getAttribute('data-goals')) cfg.goals = me.getAttribute('data-goals').split(/\s*,\s*/);
  if (me && me.hasAttribute('data-debug')) cfg.debug = true;
  var ATTR = cfg.attr || 'data-mt';

  // [name, test(href)] — order matters: first match wins.
  // Host part accepts http(s)://, protocol-relative // and www. ; paths end at / ? # so vk.com/imperia is not a chat
  var MESSENGERS = [
    ['whatsapp', /^(?:(?:https?:)?\/\/)?(?:www\.)?(?:wa\.me|(?:api|web|chat)\.whatsapp\.com)\/|^whatsapp:/i],
    ['telegram', /^(?:(?:https?:)?\/\/)?(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)\/|^tg:/i],
    ['max', /^(?:(?:https?:)?\/\/)?(?:www\.|web\.)?max\.ru\/|^max:/i],
    ['yandex_messenger', /^(?:(?:https?:)?\/\/)?(?:www\.)?(?:yandex\.ru|ya\.ru)\/chat(?:[\/?#]|$)/i],
    ['vk', /^(?:(?:https?:)?\/\/)?(?:www\.)?(?:vk\.me\/|(?:m\.)?vk\.(?:com|ru)\/(?:im(?:[\/?#]|$)|write-?\d))/i],
    ['viber', /^viber:/i]
  ].concat(cfg.messengers || []);

  // Fallback places by page landmark, when neither data-mt-place nor cfg.places matched.
  // article goes first: <article><header>/<footer> is part of the content, not the site header/footer
  var LANDMARKS = [['article', 'content'], ['header', 'header'], ['footer', 'footer'], ['nav', 'nav'], ['aside', 'aside'], ['main', 'content']];

  function closest(el, sel) {
    for (; el && el.nodeType === 1; el = el.parentNode) {
      if ((el.matches || el.msMatchesSelector || el.webkitMatchesSelector).call(el, sel)) return el;
    }
    return null;
  }

  function messengerOf(href) {
    for (var i = 0; i < MESSENGERS.length; i++) if (MESSENGERS[i][1].test(href)) return MESSENGERS[i][0];
    return null;
  }

  function placeOf(a) {
    var own = closest(a, '[' + ATTR + '-place]:not([' + ATTR + '-place=""])');
    if (own) return own.getAttribute(ATTR + '-place');
    var places = cfg.places || [];
    for (var i = 0; i < places.length; i++) if (closest(a, places[i][0])) return places[i][1];
    for (var j = 0; j < LANDMARKS.length; j++) if (closest(a, LANDMARKS[j][0])) return LANDMARKS[j][1];
    return 'other';
  }

  // Everything we know about one link; null if it is not a messenger link
  function describe(a) {
    var href = (a.getAttribute('href') || '').replace(/^\s+|\s+$/g, ''); // the browser ignores them too
    var messenger = a.getAttribute(ATTR + '-messenger') || messengerOf(href);
    if (!messenger) return null;
    var place = placeOf(a);
    return {
      messenger: messenger,
      place: place,
      id: a.getAttribute(ATTR + '-id') || messenger + '_' + place,
      page: w.location.pathname, // path only: no query string, no personal data
      href: href
    };
  }

  // Metrica ClientID of this visitor: from getClientID once the counter answers, else from its _ym_uid cookie
  var cid = '';
  function askClientId() {
    if (cid || !cfg.ym || typeof w.ym !== 'function') return;
    try { w.ym(cfg.ym, 'getClientID', function (id) { if (id) cid = String(id); }); } catch (e) {}
  }
  function clientId() {
    askClientId();
    var m = /(?:^|;\s*)_ym_uid=(\d+)/.exec(d.cookie || '');
    return cid || (m ? m[1] : '');
  }

  function fill(tpl, info) {
    // {place} or %place% (the latter survives template engines that eat curly braces); %cid% = Metrica ClientID
    var re = /\{(\w+)\}|%(\w+)%/g;
    function val(k) { return k === 'cid' ? clientId() : info[k]; }
    // a (...) group whose placeholder is empty (no ClientID yet) is dropped: 'Hi (code %cid%)' -> 'Hi'
    return String(tpl).replace(/\s*\([^()]*\)/g, function (g) {
      var empty = false;
      g.replace(re, function (m, a, b) { if (val(a || b) === '') empty = true; return m; });
      return empty ? '' : g;
    }).replace(re, function (m, a, b) { var v = val(a || b); return v != null ? v : m; });
  }

  // Check mode (?mt_debug=1 in the address): links do not open, every click shows a toast
  // with what was sent where and whether Metrica acknowledged it. For QA, screen recordings, clients.
  // Toast language: data-lang / cfg.lang / ?mt_lang=en|ru, else by <html lang> (ru* -> ru, other -> en).
  var CHECK = /[?&]mt_debug=1/.test(w.location.search);
  var LANG = (/[?&]mt_lang=(\w+)/.exec(w.location.search) || [])[1] || (me && me.getAttribute('data-lang')) || cfg.lang ||
    (/^ru/i.test(d.documentElement.getAttribute('lang') || '') ? 'ru' : 'en');
  var T = {
    ru: { wait: 'Метрика: ждём счётчик…', sent: 'Метрика %c: отправлено %g, ждём ответ…', ok: '✓ Метрика %c приняла: %g',
          gone: '✗ Метрика: счётчик на странице не появился', ga: '→ GA4 (gtag): событие %g', gtm: '→ dataLayer (GTM): событие %g', text: 'В ссылку добавлено: %g' },
    en: { wait: 'Yandex Metrica: waiting for the counter…', sent: 'Yandex Metrica %c: sent %g, waiting…', ok: '✓ Yandex Metrica %c received: %g',
          gone: '✗ Yandex Metrica: counter did not appear on the page', ga: '→ GA4 (gtag): event %g', gtm: '→ dataLayer (GTM): event %g', text: 'Added to the link: %g' }
  };
  function t(key, c, g) { return (T[LANG] || T.en)[key].replace('%c', function () { return c; }).replace('%g', function () { return g; }); }

  function toast(info) {
    var box = d.getElementById('mt-check');
    if (!box) {
      box = d.createElement('div'); box.id = 'mt-check';
      box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;display:flex;flex-direction:column;gap:6px;' +
        'max-width:min(420px,calc(100vw - 24px));font:13px/1.45 system-ui,-apple-system,Segoe UI,Arial,sans-serif';
      d.body.appendChild(box);
    }
    var el = d.createElement('div'), head = d.createElement('div'), lines = {};
    el.style.cssText = 'background:#111827;color:#fff;padding:10px 12px;border-radius:8px;box-shadow:0 4px 18px rgba(0,0,0,.35)';
    head.style.fontWeight = '600';
    head.textContent = 'messenger-tracker: ' + info.messenger + ' · ' + info.place + ' · ' + info.page;
    el.appendChild(head); box.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 30000);
    // one line per channel (ym, ga, gtm), updated in place
    return function (channel, text, color) {
      if (!lines[channel]) { lines[channel] = d.createElement('div'); el.appendChild(lines[channel]); }
      lines[channel].textContent = text; lines[channel].style.color = color || '#cbd5e1';
    };
  }

  function send(info, done) {
    var pending = 0, finished = false;
    function one() { if (--pending <= 0 && !finished) { finished = true; if (done) done(); } }
    var say = CHECK && d.body ? toast(info) : null;

    // Yandex Metrica: one or more JS goals + nested visit params goal > messenger > place > page
    var ymId = cfg.ym;
    function toMetrica(cb) {
      var goals = cfg.goals || ['messenger_click'];
      var key = cfg.paramsKey || 'messenger_click';
      var params = {}; params[key] = {}; params[key][info.messenger] = {}; params[key][info.messenger][info.place] = info.page;
      var names = [], acked = 0;
      function ack() {
        if (say && ++acked === goals.length) say('ym', t('ok', ymId, names.join(', ')), '#86efac');
        if (cb) cb();
      }
      for (var i = 0; i < goals.length; i++) {
        names.push(fill(goals[i], info));
        w.ym(ymId, 'reachGoal', names[i], i === 0 ? params : undefined, ack);
      }
      if (say) say('ym', t('sent', ymId, names.join(', ')));
      return goals.length;
    }
    if (ymId && typeof w.ym === 'function') {
      pending += toMetrica(one);
    } else if (ymId) {
      // Counter loaded late (GTM on first interaction, consent banner): wait for it, then send.
      // Same-tab navigation waits at most waitNavigate ms, a new tab up to waitCounter ms.
      // If it never shows up (cookies declined), nothing is sent.
      var waited = 0, step = 100;
      var limit = done ? (cfg.waitNavigate != null ? cfg.waitNavigate : 1000) : (cfg.waitCounter != null ? cfg.waitCounter : 5000);
      if (done) pending++; // hold navigation until the counter shows up or we give up
      if (say) say('ym', t('wait'));
      var timer = setInterval(function () {
        waited += step;
        if (typeof w.ym === 'function') { clearInterval(timer); if (done) { pending += toMetrica(one); one(); } else toMetrica(); }
        else if (waited >= limit) {
          clearInterval(timer); if (done) one();
          if (say) say('ym', t('gone'), '#fca5a5');
        }
      }, step);
    }
    // GA4
    if (cfg.gtag !== false && typeof w.gtag === 'function') {
      w.gtag('event', cfg.gaEvent || 'messenger_click', {
        messenger: info.messenger, place: info.place, link_id: info.id, page_path: info.page
      });
      if (say) say('ga', t('ga', '', cfg.gaEvent || 'messenger_click'), '#93c5fd');
    }
    // GTM
    if (cfg.dataLayer !== false && w.dataLayer && typeof w.dataLayer.push === 'function') {
      w.dataLayer.push({ event: cfg.gaEvent || 'messenger_click', mt_messenger: info.messenger, mt_place: info.place, mt_id: info.id, mt_page: info.page });
      if (say) say('gtm', t('gtm', '', cfg.gaEvent || 'messenger_click'), '#93c5fd');
    }
    if (say && info.text) say('text', t('text', '', info.text), '#fde68a');
    // Anyone else on the page
    try { d.dispatchEvent(new CustomEvent('messenger-tracker:click', { detail: info })); } catch (e) {}
    if (cfg.debug || CHECK) {
      if (w.console) console.log('[messenger-tracker]', info);
    }
    if (!pending && done) done();
  }

  function onClick(e) {
    if (e.type === 'auxclick' && e.button !== 1) return; // middle click only
    var a = closest(e.target, 'a[href]');
    if (!a) return;
    var info = describe(a);
    if (!info) return;
    var text = personalize(a, info);
    if (text) info.text = text;
    if (CHECK) { e.preventDefault(); send(info); return; } // check mode: count, but stay on the page

    // Same-tab http(s) navigation would unload the page before the hit leaves: wait for it (max 300 ms)
    var sameTab = e.type === 'click' && !e.defaultPrevented && e.button === 0 &&
      !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) &&
      (!a.target || a.target === '_self') && /^https?:/i.test(a.href);
    if (!sameTab) { send(info); return; }

    // Decide once the page's own handlers have run (bubble phase on window): if one of them cancelled the click
    // (popup, chat widget, onclick="return false"), only count it and do not navigate. A handler that stops
    // propagation keeps the event from reaching window, so we decide right at that call; the timeout is a last resort.
    var decided = false;
    function decide(e2) {
      if (decided || (e2 && e2 !== e)) return;
      decided = true;
      w.removeEventListener('click', decide, false);
      if (!e2 || e.defaultPrevented) { send(info); return; }
      e.preventDefault();
      var gone = false;
      function go() { if (!gone) { gone = true; w.location.href = a.href; } }
      send(info, go);
      // safety net: never hold the visitor longer than this, even if the counter never answers
      var late = cfg.ym && typeof w.ym !== 'function';
      setTimeout(go, (cfg.timeout || 300) + (late ? (cfg.waitNavigate != null ? cfg.waitNavigate : 1000) : 0));
    }
    w.addEventListener('click', decide, false);
    e.stopPropagation = function () { decide(e); return Event.prototype.stopPropagation.call(e); };
    e.stopImmediatePropagation = function () { decide(e); return Event.prototype.stopImmediatePropagation.call(e); };
    setTimeout(decide, 0);
  }

  // Optional offline attribution: the code shows up in the chat itself.
  // Done on page load and again on every click (the ClientID may only be known by then, SPA pages add links later);
  // the original href is kept in data-mt-href. Returns the prefilled text, if any.
  function personalize(a, info) {
    var base = a.getAttribute(ATTR + '-href') || info.href, text;
    if (cfg.whatsappText && info.messenger === 'whatsapp' && /wa\.me\/\d+\/?$/i.test(base)) {
      text = fill(cfg.whatsappText, info);
      a.setAttribute(ATTR + '-href', base);
      a.setAttribute('href', base.replace(/\/$/, '') + '?text=' + encodeURIComponent(text));
    }
    // ?start= works only for bots (username ending in "bot"); Telegram allows A-Z a-z 0-9 _ - and 64 chars
    if (cfg.telegramStart && info.messenger === 'telegram' && /t\.me\/\w*bot\/?$/i.test(base)) {
      text = fill(cfg.telegramStart, info).replace(/[^\w-]/g, '_').slice(0, 64);
      a.setAttribute(ATTR + '-href', base);
      a.setAttribute('href', base.replace(/\/$/, '') + '?start=' + text);
    }
    return text;
  }
  function decorate() {
    var links = d.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) { var info = describe(links[i]); if (info) personalize(links[i], info); }
  }

  // Inventory for audits and debugging: MessengerTracker.scan() in the console
  function scan() {
    var out = [], links = d.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) { var info = describe(links[i]); if (info) out.push(info); }
    return out;
  }

  d.addEventListener('click', onClick, true);
  d.addEventListener('auxclick', onClick, true);
  if (cfg.whatsappText || cfg.telegramStart) {
    askClientId();
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', decorate); else decorate();
  }

  w.MessengerTracker = { version: '1.4.1', config: cfg, scan: scan, describe: describe };
})(window, document);
