/*! messenger-tracker v1.0.0 | MIT | https://github.com/trendbender/messenger-tracker
 * Which messenger button was clicked, where on the page, and on which page.
 * Sends the click to Yandex Metrica (reachGoal + visit params), GA4 (gtag) and GTM (dataLayer).
 * No dependencies, ES5, 4 KB minified (2 KB gzip). Does NOT load any counter itself: if the counter is not
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

  function send(info, done) {
    var pending = 0, finished = false;
    function one() { if (--pending <= 0 && !finished) { finished = true; if (done) done(); } }

    // Yandex Metrica: one or more JS goals + nested visit params goal > messenger > place > page
    var ymId = cfg.ym;
    if (ymId && typeof w.ym === 'function') {
      var goals = cfg.goals || ['messenger_click'];
      var key = cfg.paramsKey || 'messenger_click';
      var params = {}; params[key] = {}; params[key][info.messenger] = {}; params[key][info.messenger][info.place] = info.page;
      for (var i = 0; i < goals.length; i++) {
        pending++;
        w.ym(ymId, 'reachGoal', fill(goals[i], info), i === 0 ? params : undefined, one);
      }
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
    if (cfg.debug || /[?&]mt_debug=1/.test(w.location.search)) {
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

    // Same-tab http(s) navigation would unload the page before the hit leaves: wait for it (max 300 ms)
    var sameTab = e.type === 'click' && !e.defaultPrevented && e.button === 0 &&
      !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) &&
      (!a.target || a.target === '_self') && /^https?:/i.test(a.href);
    if (!sameTab) { send(info); return; }

    e.preventDefault();
    var gone = false;
    function go() { if (!gone) { gone = true; w.location.href = a.href; } }
    send(info, go);
    setTimeout(go, cfg.timeout || 300);
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

  w.MessengerTracker = { version: '1.0.0', config: cfg, scan: scan, describe: describe };
})(window, document);
