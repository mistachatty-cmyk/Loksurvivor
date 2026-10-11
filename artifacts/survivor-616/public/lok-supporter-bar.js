/*!
 * lok-supporter-bar.js — the live Lok supporter hologram bar for any web page.
 *
 *   <script src="https://survivor.gsix.online/lok-supporter-bar.js"
 *           data-supabase-url="https://YOUR.supabase.co"
 *           data-anon-key="YOUR_ANON_KEY"
 *           data-position="bottom"></script>
 *
 * data-position: "bottom" (default, fixed strip) | "inline" (renders where the script tag is).
 * Reads the public `lok_supporter_feed` RPC (08_supporters.sql): display name, tier and founder
 * only. Teal for Lok Pass, blue for Lok Passport, gold + FOUNDER for Lifetime. Renders nothing
 * if the feed is empty or unreachable. No dependencies; all text is set with textContent.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var url = (script.getAttribute('data-supabase-url') || '').replace(/\/+$/, '');
  var key = script.getAttribute('data-anon-key') || '';
  var position = script.getAttribute('data-position') === 'inline' ? 'inline' : 'bottom';
  if (!url || !key) return;

  var CSS = '.lok-sb{position:' + (position === 'bottom' ? 'fixed;left:0;right:0;bottom:0;z-index:2147483000;pointer-events:none' : 'relative') +
    ';display:flex;align-items:center;height:28px;overflow:hidden;background:linear-gradient(90deg,rgba(3,12,24,.9),rgba(5,24,36,.82));border-top:1px solid rgba(45,212,191,.5);box-shadow:0 -2px 14px rgba(45,212,191,.22);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}' +
    '.lok-sb:after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px);mix-blend-mode:screen;pointer-events:none}' +
    '.lok-sb-label{position:relative;z-index:1;flex:none;padding:0 10px;font-size:9px;font-weight:700;line-height:28px;letter-spacing:.18em;color:#5eead4;background:rgba(3,12,24,.95);border-right:1px solid rgba(45,212,191,.5)}' +
    '.lok-sb-lane{flex:1;overflow:hidden}' +
    '.lok-sb-track{display:inline-flex;white-space:nowrap;width:max-content;animation:lok-sb-scroll linear infinite}' +
    '.lok-sb-item{padding:0 22px;font-size:11px;font-weight:700;line-height:28px;letter-spacing:.08em;text-transform:uppercase;color:#5eead4;text-shadow:0 0 8px rgba(45,212,191,.85)}' +
    '.lok-sb-item[data-tier=passport]{color:#38bdf8;text-shadow:0 0 8px rgba(56,189,248,.85)}' +
    '.lok-sb-item[data-tier=lifetime]{color:#fbbf24;text-shadow:0 0 9px rgba(251,191,36,.9)}' +
    '@keyframes lok-sb-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}' +
    '@media (prefers-reduced-motion:reduce){.lok-sb-track{animation:none}}';

  function build(entries) {
    var style = document.createElement('style');
    style.textContent = CSS;
    var bar = document.createElement('div');
    bar.className = 'lok-sb';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Lok supporters');
    var label = document.createElement('span');
    label.className = 'lok-sb-label';
    label.textContent = 'LOK SUPPORTERS · THANK YOU';
    var lane = document.createElement('div');
    lane.className = 'lok-sb-lane';
    var track = document.createElement('div');
    track.className = 'lok-sb-track';
    track.style.animationDuration = Math.max(30, entries.length * 5) + 's';
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var item = document.createElement('span');
        item.className = 'lok-sb-item';
        item.setAttribute('data-tier', e.tier);
        if (pass === 1) item.setAttribute('aria-hidden', 'true');
        item.textContent = (e.founder ? '★ ' : '◆ ') + e.display + (e.founder ? ' · FOUNDER' : '');
        track.appendChild(item);
      }
    }
    lane.appendChild(track);
    bar.appendChild(label);
    bar.appendChild(lane);
    var host = document.createElement('div');
    host.appendChild(style);
    host.appendChild(bar);
    if (position === 'inline' && script.parentNode) script.parentNode.insertBefore(host, script.nextSibling);
    else document.body.appendChild(host);
    return host;
  }

  var mounted = null;
  function load() {
    fetch(url + '/rest/v1/rpc/lok_supporter_feed', {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_limit: 200 }),
    })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var entries = (Array.isArray(rows) ? rows : []).filter(function (r) {
          return r && typeof r.display === 'string' && (r.tier === 'pass' || r.tier === 'passport' || r.tier === 'lifetime');
        });
        if (mounted) { mounted.remove(); mounted = null; }
        if (entries.length) mounted = build(entries);
      })
      .catch(function () {});
  }
  load();
  setInterval(load, 10 * 60 * 1000);
})();
