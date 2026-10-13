/*! messenger-tracker v1.3.0 | MIT | https://github.com/trendbender/messenger-tracker
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

  // [name, test(href)] — order matters: first match wins
  var MESSENGERS = [
    ['whatsapp', /^(?:https?:\/\/)?(?:wa\.me|(?:api|web|chat)\.whatsapp\.com)\/|^whatsapp:/i],
    ['telegram', /^(?:https?:\/\/)?(?:t\.me|telegram\.me|telegram\.dog)\/|^tg:/i],
    ['max', /^(?:https?:\/\/)?(?:www\.)?max\.ru\/|^max:/i],
    ['yandex_messenger', /^(?:https?:\/\/)?(?:yandex\.ru|ya\.ru)\/chat/i],
    ['vk', /^(?:https?:\/\/)?(?:vk\.me\/|(?:m\.)?vk\.(?:com|ru)\/(?:im|write))/i],
    ['viber', /^viber:/i]
  ].concat(cfg.messengers || []);

  // Fallback places by page landmark, when neither data-mt-place nor cfg.places matched
  var LANDMARKS = [['header', 'header'], ['footer', 'footer'], ['nav', 'nav'], ['aside', 'aside'], ['main,article', 'content']];

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
    var own = closest(a, '[' + ATTR + '-place]');
    if (own) return own.getAttribute(ATTR + '-place');
    var places = cfg.places || [];
    for (var i = 0; i < places.length; i++) if (closest(a, places[i][0])) return places[i][1];
    for (var j = 0; j < LANDMARKS.length; j++) if (closest(a, LANDMARKS[j][0])) return LANDMARKS[j][1];
    return 'other';
  }

  // Everything we know about one link; null if it is not a messenger link
  function describe(a) {
    var href = a.getAttribute('href') || '';
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

  function fill(tpl, info) {
    // {place} or %place% (the latter survives template engines that eat curly braces)
    return String(tpl).replace(/\{(\w+)\}|%(\w+)%/g, function (m, a, b) { var k = a || b; return info[k] != null ? info[k] : m; });
  }

  // Check mode (?mt_debug=1 in the address): links do not open, every click shows a toast
  // with what was sent and whether Metrica acknowledged it. For QA, screen recordings, clients.
  var CHECK = /[?&]mt_debug=1/.test(w.location.search);

  function toast(info) {
    var box = d.getElementById('mt-check');
    if (!box) {
      box = d.createElement('div'); box.id = 'mt-check';
      box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;display:flex;flex-direction:column;gap:6px;' +
        'max-width:min(400px,calc(100vw - 24px));font:13px/1.45 system-ui,-apple-system,Segoe UI,Arial,sans-serif';
      d.body.appendChild(box);
    }
    var el = d.createElement('div'), head = d.createElement('div'), line = d.createElement('div');
    el.style.cssText = 'background:#111827;color:#fff;padding:10px 12px;border-radius:8px;box-shadow:0 4px 18px rgba(0,0,0,.35)';
    head.style.fontWeight = '600';
    head.textContent = 'messenger-tracker: ' + info.messenger + ' · ' + info.place + ' · ' + info.page;
    el.appendChild(head); el.appendChild(line); box.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 30000);
    return function (text, color) { line.textContent = text; line.style.color = color || '#cbd5e1'; };
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
        if (say && ++acked === goals.length) say('✓ Метрика ' + ymId + ' приняла: ' + names.join(', '), '#86efac');
        if (cb) cb();
      }
      for (var i = 0; i < goals.length; i++) {
        names.push(fill(goals[i], info));
        w.ym(ymId, 'reachGoal', names[i], i === 0 ? params : undefined, ack);
      }
      if (say) say('Метрика ' + ymId + ': отправлено ' + names.join(', ') + ', ждём ответ…');
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
      if (say) say('ждём счётчик Метрики…');
      var timer = setInterval(function () {
        waited += step;
        if (typeof w.ym === 'function') { clearInterval(timer); if (done) { pending += toMetrica(one); one(); } else toMetrica(); }
        else if (waited >= limit) {
          clearInterval(timer); if (done) one();
          if (say) say('✗ счётчик Метрики на странице не появился', '#fca5a5');
        }
      }, step);
    } else if (say) {
      say('Метрика не настроена (data-ym)', '#fca5a5');
    }
    // GA4
    if (cfg.gtag !== false && typeof w.gtag === 'function') {
      w.gtag('event', cfg.gaEvent || 'messenger_click', {
        messenger: info.messenger, place: info.place, link_id: info.id, page_path: info.page
      });
    }
    // GTM
    if (cfg.dataLayer !== false && w.dataLayer && typeof w.dataLayer.push === 'function') {
      w.dataLayer.push({ event: cfg.gaEvent || 'messenger_click', mt_messenger: info.messenger, mt_place: info.place, mt_id: info.id, mt_page: info.page });
    }
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
    if (CHECK) { e.preventDefault(); send(info); return; } // check mode: count, but stay on the page

    // Same-tab http(s) navigation would unload the page before the hit leaves: wait for it (max 300 ms)
    var sameTab = e.type === 'click' && !e.defaultPrevented && e.button === 0 &&
      !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) &&
      (!a.target || a.target === '_self') && /^https?:/i.test(a.href);
    if (!sameTab) { send(info); return; }

    e.preventDefault();
    var gone = false;
    function go() { if (!gone) { gone = true; w.location.href = a.href; } }
    send(info, go);
    // safety net: never hold the visitor longer than this, even if the counter never answers
    var late = cfg.ym && typeof w.ym !== 'function';
    setTimeout(go, (cfg.timeout || 300) + (late ? (cfg.waitNavigate != null ? cfg.waitNavigate : 1000) : 0));
  }

  // Optional offline attribution: the code shows up in the chat itself
  function decorate() {
    var links = d.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], info = describe(a);
      if (!info) continue;
      if (cfg.whatsappText && info.messenger === 'whatsapp' && /wa\.me\/\d+\/?$/i.test(info.href)) {
        a.setAttribute('href', info.href.replace(/\/$/, '') + '?text=' + encodeURIComponent(fill(cfg.whatsappText, info)));
      }
      // ?start= works only for bots (username ending in "bot")
      if (cfg.telegramStart && info.messenger === 'telegram' && /t\.me\/\w*bot\/?$/i.test(info.href)) {
        a.setAttribute('href', info.href.replace(/\/$/, '') + '?start=' + encodeURIComponent(fill(cfg.telegramStart, info)).slice(0, 64));
      }
    }
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
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', decorate); else decorate();
  }

  w.MessengerTracker = { version: '1.3.0', config: cfg, scan: scan, describe: describe };
})(window, document);
