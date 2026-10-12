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

  var theme = script.getAttribute('data-theme') || 'hologram';
  var labelText = script.getAttribute('data-label') || 'LOK SUPPORTERS \u00b7 THANK YOU';
  var THEMES = {
    hologram: '--lok-sb-bg:linear-gradient(90deg,rgba(3,12,24,.9),rgba(5,24,36,.82));--lok-sb-border:rgba(45,212,191,.5);--lok-sb-font:ui-monospace,SFMono-Regular,Menlo,monospace;--lok-sb-scan:1',
    plain: '--lok-sb-bg:rgba(15,23,42,.92);--lok-sb-border:rgba(148,163,184,.4);--lok-sb-font:system-ui,sans-serif;--lok-sb-scan:0',
    retro: '--lok-sb-bg:#12081f;--lok-sb-border:#f0abfc;--lok-sb-font:"Courier New",monospace;--lok-sb-scan:1'
  };
  // Games restyle the bar by setting these on :root: --lok-sb-bg, --lok-sb-border, --lok-sb-font,
  // --lok-sb-height, and the tier colours --lok-sb-pass / --lok-sb-passport / --lok-sb-lifetime.
  var CSS = '.lok-sb{' + (THEMES[theme] || THEMES.hologram) + ';position:' + (position === 'bottom' ? 'fixed;left:0;right:0;bottom:0;z-index:900;pointer-events:none' : 'relative') +
    ';display:flex;align-items:center;height:var(--lok-sb-height,28px);overflow:hidden;background:var(--lok-sb-bg);border-top:1px solid var(--lok-sb-border);font-family:var(--lok-sb-font)}' +
    '.lok-sb:after{content:"";position:absolute;inset:0;opacity:var(--lok-sb-scan,1);background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px);mix-blend-mode:screen;pointer-events:none}' +
    '.lok-sb-label{position:relative;z-index:1;flex:none;padding:0 10px;font-size:9px;font-weight:700;line-height:var(--lok-sb-height,28px);letter-spacing:.18em;color:var(--lok-sb-pass,#5eead4);background:rgba(3,12,24,.95);border-right:1px solid var(--lok-sb-border)}' +
    '.lok-sb-lane{flex:1;overflow:hidden}' +
    '.lok-sb-track{display:inline-flex;white-space:nowrap;width:max-content;animation:lok-sb-scroll linear infinite}' +
    '.lok-sb-item{padding:0 22px;font-size:11px;font-weight:700;line-height:var(--lok-sb-height,28px);letter-spacing:.08em;text-transform:uppercase;color:var(--lok-sb-pass,#5eead4);text-shadow:0 0 8px currentColor}' +
    '.lok-sb-item[data-tier=passport]{color:var(--lok-sb-passport,#38bdf8)}' +
    '.lok-sb-item[data-tier=lifetime]{color:var(--lok-sb-lifetime,#fbbf24)}' +
    '@keyframes lok-sb-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}' +
    '@media (prefers-reduced-motion:reduce){.lok-sb-track{animation:none}}' +
    '@media print{.lok-sb{display:none}}';

  function build(entries) {
    var style = document.createElement('style');
    style.textContent = CSS;
    var bar = document.createElement('div');
    bar.className = 'lok-sb';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Lok supporters');
    var label = document.createElement('span');
    label.className = 'lok-sb-label';
    label.textContent = labelText;
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
          return r && typeof r.display === 'string' && r.display.replace(/[<>]/g, '').trim() && (r.tier === 'pass' || r.tier === 'passport' || r.tier === 'lifetime');
        });
        if (mounted) { mounted.remove(); mounted = null; }
        if (entries.length) mounted = build(entries);
      })
      .catch(function () {});
  }
  load();
  setInterval(load, 10 * 60 * 1000);
})();
