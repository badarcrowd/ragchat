(function () {
  if (window.__leadBotLoaded) return;
  window.__leadBotLoaded = true;

  /* ── CONFIG ─────────────────────────────────────────────────────────── */
  var cfg      = window.LeadBotConfig || {};
  var BASE_URL = (cfg.baseUrl || "").replace(/\/$/, "");
  var BRAND    = cfg.brandColor || "#6366f1";
  var POS      = cfg.position === "right" ? "right" : "left";
  var BOT_NAME = cfg.botName  || "Aria";
  var TENANT   = cfg.tenantId || cfg.domain || window.location.hostname;

  if (!BASE_URL) { console.warn("[Bot] baseUrl missing"); return; }
  try {
    var preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = BASE_URL;
    document.head.appendChild(preconnect);
  } catch {}

  /* ── STATE ───────────────────────────────────────────────────────────── */
  var S = {
    phase: "idle",   // idle | greeting | listening | processing | speaking | done
    started:   false,
    voiceOn:   true,
    messages:  [],
    leadData:  {},
    filled:    [],
    sessionId: "bot-" + Date.now() + "-" + Math.random().toString(36).slice(2,8),
    recognition: null,
    audio: null,
    audioUnlocked: false
  };

  /* ── FORM FIELDS ─────────────────────────────────────────────────────── */
  var FIELDS = ["first_name","last_name","email","phone","company",
                "sector","website","location","business","success",
                "cost","start","rfp"];

  /* ── CSS ─────────────────────────────────────────────────────────────── */
  var css = document.createElement("style");
  css.textContent = "\
#lb-root{position:fixed;bottom:24px;" + POS + ":24px;z-index:2147483000;display:flex;flex-direction:column;align-items:" + (POS==="right"?"flex-end":"flex-start") + ";gap:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}\
\
/* Panel */\
#lb-panel{width:340px;background:#fff;border-radius:20px;box-shadow:0 12px 48px rgba(0,0,0,.18);display:none;flex-direction:column;max-height:580px;overflow:hidden;opacity:0;transform:translateY(12px);transition:opacity .28s,transform .28s;}\
#lb-panel.open{display:flex;opacity:1;transform:translateY(0);}\
\
/* Header */\
#lb-hdr{background:" + BRAND + ";padding:13px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;}\
#lb-hdr-av{width:36px;height:36px;border-radius:50%;background:transparent;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;}\
#lb-hdr-name{color:#fff;font-weight:700;font-size:14px;}\
#lb-hdr-sub{color:rgba(255,255,255,.8);font-size:11px;display:flex;align-items:center;gap:5px;}\
#lb-hdr-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;animation:lb-ping 2s infinite;}\
#lb-hdr-btns{margin-left:auto;display:flex;gap:4px;}\
.lb-hbtn{cursor:pointer;color:rgba(255,255,255,.7);background:none;border:none;font-size:16px;padding:4px 6px;border-radius:6px;transition:all .15s;line-height:1;}\
.lb-hbtn:hover{color:#fff;background:rgba(255,255,255,.18);}\
\
/* Progress */\
#lb-prog{padding:7px 14px 5px;background:#fafafa;border-bottom:1px solid #f1f5f9;flex-shrink:0;}\
#lb-prog-bar{height:4px;background:#e2e8f0;border-radius:99px;overflow:hidden;}\
#lb-prog-fill{height:100%;background:linear-gradient(90deg," + BRAND + ",#8b5cf6);width:0%;transition:width .6s ease;border-radius:99px;}\
#lb-prog-lbl{font-size:10px;color:#94a3b8;margin-top:3px;text-align:right;}\
\
/* Start screen */\
#lb-start{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 20px;gap:12px;text-align:center;}\
#lb-start-lottie{width:120px;height:120px;flex-shrink:0;}\
#lb-start-title{font-size:16px;font-weight:700;color:#1e293b;margin:0;}\
#lb-start-sub{font-size:13px;color:#64748b;margin:0;line-height:1.5;}\
#lb-start-btn{width:80px;height:80px;border-radius:50%;background:" + BRAND + ";border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px " + BRAND + "55;transition:transform .2s,box-shadow .2s;animation:lb-pulse 2.5s ease-in-out infinite;}\
#lb-start-btn:hover{transform:scale(1.06);box-shadow:0 8px 32px " + BRAND + "77;}\
#lb-start-btn svg{width:34px;height:34px;}\
#lb-start-or{font-size:12px;color:#94a3b8;}\
#lb-start-text-btn{background:none;border:1.5px solid #e2e8f0;color:#64748b;border-radius:10px;padding:8px 20px;font-size:13px;cursor:pointer;transition:all .18s;}\
#lb-start-text-btn:hover{border-color:" + BRAND + ";color:" + BRAND + ";}\
\
/* Voice status bar */\
#lb-status{padding:10px 14px;background:#f8fafc;border-bottom:1px solid #f1f5f9;display:none;align-items:center;gap:10px;flex-shrink:0;}\
#lb-status.show{display:flex;}\
#lb-status-icon{font-size:18px;animation:lb-bounce-s 1s infinite;}\
#lb-status-txt{font-size:12px;color:#64748b;font-weight:500;flex:1;}\
#lb-stop-btn{background:none;border:1.5px solid #fca5a5;color:#ef4444;border-radius:8px;font-size:11px;padding:4px 10px;cursor:pointer;}\
\
/* Messages */\
#lb-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px;scroll-behavior:smooth;}\
.lb-m{max-width:87%;padding:10px 14px;border-radius:16px;font-size:13px;line-height:1.55;word-break:break-word;animation:lb-pop .2s ease;}\
.lb-m.bot{background:#f1f5f9;color:#1e293b;border-bottom-left-radius:4px;align-self:flex-start;}\
.lb-m.user{background:" + BRAND + ";color:#fff;border-bottom-right-radius:4px;align-self:flex-end;}\
.lb-m.warn{background:#fef9c3;border:1px solid #fde047;color:#713f12;align-self:flex-start;border-bottom-left-radius:4px;font-size:12px;}\
.lb-m.audit{background:#f0fdf4;border:1px solid #bbf7d0;color:#14532d;align-self:flex-start;border-bottom-left-radius:4px;}\
.lb-typing{display:flex;gap:5px;align-items:center;}\
.lb-dot{width:7px;height:7px;border-radius:50%;background:#94a3b8;animation:lb-bounce .85s infinite;}\
.lb-dot:nth-child(2){animation-delay:.15s;}.lb-dot:nth-child(3){animation-delay:.3s;}\
\
/* Chips */\
.lb-chips{display:flex;flex-wrap:wrap;gap:6px;padding:2px 0;}\
.lb-chip{padding:6px 13px;border-radius:20px;border:1.5px solid " + BRAND + ";color:" + BRAND + ";background:#fff;font-size:12px;font-weight:500;cursor:pointer;transition:all .16s;}\
.lb-chip:hover,.lb-chip.sel{background:" + BRAND + ";color:#fff;}\
.lb-chip:disabled{opacity:.45;cursor:default;}\
\
/* Input row */\
#lb-inp-row{border-top:1px solid #f1f5f9;padding:10px 12px;display:flex;gap:8px;align-items:flex-end;background:#fff;flex-shrink:0;}\
#lb-inp{flex:1;border:1.5px solid #e2e8f0;border-radius:12px;padding:9px 12px;font-size:13px;color:#1e293b;resize:none;outline:none;max-height:90px;min-height:38px;line-height:1.45;font-family:inherit;transition:border-color .18s;}\
#lb-inp:focus{border-color:" + BRAND + ";}\
#lb-mic-btn{width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .18s;background:#f1f5f9;}\
#lb-mic-btn.listening{background:#ef4444;animation:lb-pulse 1.2s infinite;}\
#lb-mic-btn svg{width:16px;height:16px;}\
#lb-send{width:36px;height:36px;border-radius:50%;background:" + BRAND + ";border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .15s,transform .15s;}\
#lb-send:hover:not(:disabled){opacity:.88;transform:scale(1.06);}\
#lb-send:disabled{opacity:.45;cursor:default;}\
#lb-send svg{width:15px;height:15px;}\
\
/* Toast */\
#lb-toast{position:fixed;bottom:96px;" + POS + ":24px;z-index:2147483001;background:#1e293b;color:#fff;font-size:12px;padding:8px 14px;border-radius:10px;display:none;align-items:center;gap:7px;box-shadow:0 4px 16px rgba(0,0,0,.2);font-family:inherit;}\
#lb-toast.show{display:flex;animation:lb-pop .25s ease;}\
\
/* Avatar */\
#lb-av-wrap{position:relative;width:110px;height:110px;cursor:pointer;}\
#lb-av{width:110px;height:110px;background:transparent;border-radius:0;box-shadow:none;overflow:visible;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 8px 20px rgba(0,0,0,.22));transition:transform .2s,filter .2s;animation:lb-float 3.2s ease-in-out infinite;}\
#lb-av:hover{transform:scale(1.1);filter:drop-shadow(0 12px 28px rgba(0,0,0,.3));animation:none;}\
#lb-badge{position:absolute;bottom:14px;" + (POS==="right"?"right":"left") + ":2px;width:14px;height:14px;background:#4ade80;border:2.5px solid #fff;border-radius:50%;animation:lb-ping 2s infinite;}\
#lb-notif{position:absolute;top:6px;" + (POS==="right"?"right":"left") + ":2px;width:18px;height:18px;background:#ef4444;border:2px solid #fff;border-radius:50%;font-size:10px;font-weight:700;color:#fff;display:none;align-items:center;justify-content:center;}\
#lb-notif.show{display:flex;animation:lb-pop .2s ease;}\
\
@keyframes lb-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}\
@keyframes lb-ping{0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,.5)}70%{box-shadow:0 0 0 8px rgba(74,222,128,0)}}\
@keyframes lb-pulse{0%,100%{box-shadow:0 0 0 0 " + BRAND + "55}70%{box-shadow:0 0 0 12px " + BRAND + "00}}\
@keyframes lb-pop{from{opacity:0;transform:scale(.94) translateY(4px)}to{opacity:1;transform:none}}\
@keyframes lb-bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}\
@keyframes lb-bounce-s{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}\
";
  document.head.appendChild(css);

  /* ── DOM ─────────────────────────────────────────────────────────────── */
  function el(tag, id, html) {
    var e = document.createElement(tag);
    if (id)   e.id = id;
    if (html) e.innerHTML = html;
    return e;
  }

  var root  = el("div","lb-root");
  var panel = el("div","lb-panel");
  var toast = el("div","lb-toast");

  // Header
  var hdr = el("div","lb-hdr");
  hdr.innerHTML =
    '<div id="lb-hdr-av"><div id="lb-hdr-lottie" style="width:100%;height:100%;"></div></div>' +
    '<div><div id="lb-hdr-name">' + BOT_NAME + ' · Crowd Guide</div>' +
    '<div id="lb-hdr-sub"><div id="lb-hdr-dot"></div><span id="lb-hdr-phase">Tap mic to begin</span></div></div>' +
    '<div id="lb-hdr-btns">' +
      '<button class="lb-hbtn" id="lb-voice-btn" title="Mute voice">🔊</button>' +
      '<button class="lb-hbtn" id="lb-close-btn" title="Close">✕</button>' +
    '</div>';

  // Progress
  var prog = el("div","lb-prog");
  prog.innerHTML = '<div id="lb-prog-bar"><div id="lb-prog-fill"></div></div><div id="lb-prog-lbl">0 of ' + FIELDS.length + ' fields</div>';

  // Start screen
  var startScreen = el("div","lb-start");
  startScreen.innerHTML =
    '<div id="lb-start-lottie" style="width:120px;height:120px;"></div>' +
    '<p id="lb-start-title">Hi! I\'m ' + BOT_NAME + ' 👋</p>' +
    '<p id="lb-start-sub">I\'ll guide you through this form by voice — just tap the mic and talk naturally.</p>' +
    '<button id="lb-start-btn" aria-label="Start voice chat">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>' +
        '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>' +
      '</svg>' +
    '</button>' +
    '<span id="lb-start-or">or</span>' +
    '<button id="lb-start-text-btn">Type instead</button>';

  // Voice status bar
  var statusBar = el("div","lb-status");
  statusBar.innerHTML =
    '<span id="lb-status-icon">🎤</span>' +
    '<span id="lb-status-txt">Listening…</span>' +
    '<button id="lb-stop-btn">Stop</button>';

  // Messages
  var msgs = el("div","lb-msgs");

  // Input row
  var inpRow = el("div","lb-inp-row");
  var inp = document.createElement("textarea");
  inp.id = "lb-inp"; inp.rows = 1; inp.placeholder = "Type your reply…";

  var micBtn = el("button","lb-mic-btn");
  micBtn.title = "Hold to speak";
  micBtn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>' +
      '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>' +
    '</svg>';

  var sendBtn = el("button","lb-send");
  sendBtn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>' +
    '</svg>';

  inpRow.append(inp, micBtn, sendBtn);

  // Avatar
  var avWrap = el("div","lb-av-wrap");
  var av     = el("div","lb-av");
  var badge = el("div","lb-badge");
  var notif = el("div","lb-notif");
  avWrap.append(av, badge, notif);

  panel.append(hdr, prog, startScreen, statusBar, msgs, inpRow);
  root.append(panel, avWrap);
  document.body.append(toast, root);

  // Show msgs/input only after started
  msgs.style.display    = "none";
  inpRow.style.display  = "none";

  /* ── LOTTIE ANIMATION (data embedded — no extra network request) ─────── */
  var ANIM_DATA = {"nm":"Comp 1","ddd":0,"h":1080,"w":1080,"meta":{"g":"@lottiefiles/toolkit-js 0.33.2"},"layers":[{"ty":0,"nm":"Pre-comp 1","sr":0.9,"st":0,"op":81,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[540,540,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":0,"k":[568,540,0],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"ef":[],"w":1080,"h":1080,"refId":"comp_0","ind":1}],"v":"5.7.0","fr":30,"op":81,"ip":0,"assets":[{"nm":"","id":"comp_0","layers":[{"ty":4,"nm":"layer 2","sr":1,"st":0,"op":300,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[-221.715,95.051,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[180.285,91.051,0],"t":0,"ti":[-0.167,0.333,0],"to":[-0.5,2.333,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[177.285,105.051,0],"t":28,"ti":[-0.667,4,0],"to":[0.167,-0.333,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[181.285,89.051,0],"t":49,"ti":[0.167,-0.333,0],"to":[0.667,-4,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[181.285,81.051,0],"t":67,"ti":[0.167,-1.667,0],"to":[-0.167,0.333,0]},{"s":[180.285,91.051,0],"t":89}],"ix":2},"r":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[190],"t":7},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1.019},"s":[191],"t":28},{"o":{"x":0.333,"y":0.034},"i":{"x":0.667,"y":1},"s":[198.741],"t":45},{"s":[190],"t":79}],"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"ef":[],"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Shape 1","ix":1,"cix":2,"np":3,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"Path 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[4.87,-6.025],[-8,-27],[-10.721,6.14],[-0.455,5.253],[-4,11],[8.822,3.516]],"o":[[-59,73],[4.497,15.177],[8.352,-4.783],[9,-104],[1.863,-5.123],[-10.121,-4.034]],"v":[[-242.5,83.5],[-273,271],[-238.265,285.283],[-229,261],[-201,97],[-210.355,75.636]]},"ix":2}},{"ty":"st","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Stroke","nm":"Stroke 1","lc":1,"lj":1,"ml":4,"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":0,"ix":5},"c":{"a":0,"k":[1,1,1],"ix":3}},{"ty":"gf","bm":0,"hd":false,"mn":"ADBE Vector Graphic - G-Fill","nm":"Gradient Fill 1","e":{"a":0,"k":[-283.121,160.699],"ix":6},"g":{"p":3,"k":{"a":0,"k":[0,0.9215686274509803,0.9568627450980393,0.9882352941176471,0.655,0.8666666666666667,0.8823529411764706,0.9019607843137255,1,0.8117647058823529,0.8117647058823529,0.8117647058823529],"ix":9}},"t":1,"a":{"a":0,"k":0},"h":{"a":0,"k":0},"s":{"a":0,"k":[-235.688,173.874],"ix":5},"r":1,"o":{"a":0,"k":100,"ix":10}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[0,0],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":1,"parent":7},{"ty":4,"nm":"layer 1","sr":1,"st":0,"op":300,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[-223.715,93.051,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[-223.715,93.051,0],"t":3,"ti":[0,0,0],"to":[0,4.333,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[-223.715,119.051,0],"t":31,"ti":[0,4.333,0],"to":[0,0,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[-223.715,93.051,0],"t":52,"ti":[0,0,0],"to":[0,0,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[-223.715,76.051,0],"t":70,"ti":[0,0,0],"to":[0,0,0]},{"s":[-223.715,93.051,0],"t":89}],"ix":2},"r":{"a":1,"k":[{"o":{"x":0.167,"y":0.167},"i":{"x":0.667,"y":1},"s":[0],"t":3},{"o":{"x":0.296,"y":0},"i":{"x":0.665,"y":0.832},"s":[-11],"t":40},{"o":{"x":0.428,"y":-0.7},"i":{"x":0.811,"y":1.256},"s":[3.659],"t":67},{"s":[0],"t":89}],"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"ef":[],"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Shape 1","ix":1,"cix":2,"np":3,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"Path 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[4.87,-6.025],[-8,-27],[-10.721,6.14],[-0.455,5.253],[-4,11],[8.822,3.516]],"o":[[-59,73],[4.497,15.177],[8.352,-4.783],[9,-104],[1.863,-5.123],[-10.121,-4.034]],"v":[[-242.5,83.5],[-273,271],[-238.265,285.283],[-229,261],[-201,97],[-210.355,75.636]]},"ix":2}},{"ty":"st","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Stroke","nm":"Stroke 1","lc":1,"lj":1,"ml":4,"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":0,"ix":5},"c":{"a":0,"k":[1,1,1],"ix":3}},{"ty":"gf","bm":0,"hd":false,"mn":"ADBE Vector Graphic - G-Fill","nm":"Gradient Fill 1","e":{"a":0,"k":[-227.438,178.621],"ix":6},"g":{"p":3,"k":{"a":0,"k":[0,0.9215686274509803,0.9568627450980393,0.9882352941176471,0.655,0.8666666666666667,0.8823529411764706,0.9019607843137255,1,0.8117647058823529,0.8117647058823529,0.8117647058823529],"ix":9}},"t":1,"a":{"a":0,"k":0},"h":{"a":0,"k":0},"s":{"a":0,"k":[-271.536,175.151],"ix":5},"r":1,"o":{"a":0,"k":100,"ix":10}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[0,0],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":2,"parent":7},{"ty":4,"nm":"eye 2","sr":1,"st":0,"op":300,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[-158,-120.5,0],"ix":1},"s":{"a":1,"k":[{"o":{"x":0.167,"y":0.167},"i":{"x":0.667,"y":1},"s":[100,100,100],"t":36},{"o":{"x":0.333,"y":0},"i":{"x":0.833,"y":0.833},"s":[100,0,100],"t":41},{"s":[100,100,100],"t":46}],"ix":6},"sk":{"a":0,"k":0},"p":{"a":0,"k":[120,-120.5,0],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"ef":[],"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Rectangle 1","ix":1,"cix":2,"np":3,"it":[{"ty":"rc","bm":0,"hd":false,"mn":"ADBE Vector Shape - Rect","nm":"Rectangle Path 1","d":1,"p":{"a":0,"k":[0,0],"ix":3},"r":{"a":0,"k":20,"ix":4},"s":{"a":0,"k":[36,93],"ix":2}},{"ty":"st","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Stroke","nm":"Stroke 1","lc":1,"lj":1,"ml":4,"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":0,"ix":5},"c":{"a":0,"k":[1,1,1],"ix":3}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fill 1","c":{"a":0,"k":[0.4941,0.5412,1],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[-158,-120.5],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":3,"parent":5},{"ty":4,"nm":"eye 1","sr":1,"st":0,"op":300,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[-158,-120.5,0],"ix":1},"s":{"a":1,"k":[{"o":{"x":0.167,"y":0.167},"i":{"x":0.667,"y":1},"s":[100,100,100],"t":36},{"o":{"x":0.333,"y":0},"i":{"x":0.833,"y":0.833},"s":[100,0,100],"t":41},{"s":[100,100,100],"t":46}],"ix":6},"sk":{"a":0,"k":0},"p":{"a":0,"k":[-158,-120.5,0],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"ef":[],"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Rectangle 1","ix":1,"cix":2,"np":3,"it":[{"ty":"rc","bm":0,"hd":false,"mn":"ADBE Vector Shape - Rect","nm":"Rectangle Path 1","d":1,"p":{"a":0,"k":[0,0],"ix":3},"r":{"a":0,"k":20,"ix":4},"s":{"a":0,"k":[36,93],"ix":2}},{"ty":"st","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Stroke","nm":"Stroke 1","lc":1,"lj":1,"ml":4,"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":0,"ix":5},"c":{"a":0,"k":[1,1,1],"ix":3}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fill 1","c":{"a":0,"k":[0.4941,0.5412,1],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[-158,-120.5],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":4,"parent":5},{"ty":4,"nm":"visor","sr":1,"st":0,"op":300,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[-16.492,-119,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[-16.492,-119,0],"t":7,"ti":[-6.794,3.569,0],"to":[6.794,-3.569,0]},{"o":{"x":0.167,"y":0.167},"i":{"x":0.833,"y":0.833},"s":[24.269,-140.413,0],"t":45,"ti":[0,0,0],"to":[0,0,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[24.269,-140.413,0],"t":53,"ti":[6.794,-3.569,0],"to":[-6.794,3.569,0]},{"s":[-16.492,-119,0],"t":79}],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"ef":[],"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Shape 2","ix":1,"cix":2,"np":3,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"Path 1","ix":1,"d":1,"ks":{"a":1,"k":[{"o":{"x":0.167,"y":0.167},"i":{"x":0.667,"y":1},"s":[{"c":true,"i":[[0,0.5],[80.5,-54],[0,0],[-3,82.5],[43.5,1]],"o":[[-1.383,5.531],[0,0],[0,0],[1.508,-41.476],[-43.5,-1]],"v":[[9,-199.75],[-65,-40.5],[158,-40.5],[210,-121],[152.25,-199.5]]}],"t":7},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[{"c":true,"i":[[0,0.5],[80.5,-54],[0,0],[-3,82.5],[43.5,1]],"o":[[-1.383,5.531],[0,0],[0,0],[1.508,-41.476],[-43.5,-1]],"v":[[31.083,-199.182],[-42.917,-39.932],[158,-40.5],[210,-121],[152.25,-199.5]]}],"t":45},{"o":{"x":0.333,"y":0},"i":{"x":0.833,"y":0.833},"s":[{"c":true,"i":[[0,0.5],[80.5,-54],[0,0],[-3,82.5],[43.5,1]],"o":[[-1.383,5.531],[0,0],[0,0],[1.508,-41.476],[-43.5,-1]],"v":[[31.083,-199.182],[-42.917,-39.932],[158,-40.5],[210,-121],[152.25,-199.5]]}],"t":53},{"s":[{"c":true,"i":[[0,0.5],[80.5,-54],[0,0],[-3,82.5],[43.5,1]],"o":[[-1.383,5.531],[0,0],[0,0],[1.508,-41.476],[-43.5,-1]],"v":[[9,-199.75],[-65,-40.5],[158,-40.5],[210,-121],[152.25,-199.5]]}],"t":79}],"ix":2}},{"ty":"st","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Stroke","nm":"Stroke 1","lc":1,"lj":1,"ml":4,"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":0,"ix":5},"c":{"a":0,"k":[1,1,1],"ix":3}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fill 1","c":{"a":0,"k":[0.2275,0.2275,0.2275],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[0,0],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]},{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Rectangle 1","ix":2,"cix":2,"np":3,"it":[{"ty":"rc","bm":0,"hd":false,"mn":"ADBE Vector Shape - Rect","nm":"Rectangle Path 1","d":1,"p":{"a":0,"k":[0,0],"ix":3},"r":{"a":0,"k":64,"ix":4},"s":{"a":0,"k":[441,162],"ix":2}},{"ty":"st","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Stroke","nm":"Stroke 1","lc":1,"lj":1,"ml":4,"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":0,"ix":5},"c":{"a":0,"k":[1,1,1],"ix":3}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fill 1","c":{"a":0,"k":[0.1333,0.1333,0.1333],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[102.759,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[-16.5,-119],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":5,"parent":6},{"ty":4,"nm":"head","sr":1,"st":0,"op":300,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[-19.719,9.59,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[-19.719,9.59,0],"t":7,"ti":[0,0,0],"to":[0,0,0]},{"o":{"x":0.167,"y":0.167},"i":{"x":0.833,"y":0.833},"s":[-19.719,45.59,0],"t":47,"ti":[0,0,0],"to":[0,0,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[-19.719,45.59,0],"t":53,"ti":[0,0,0],"to":[0,0,0]},{"s":[-19.719,9.59,0],"t":79}],"ix":2},"r":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[0],"t":7},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[-9],"t":28},{"s":[0],"t":79}],"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"ef":[],"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Shape 1","ix":3,"cix":2,"np":3,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"Path 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[42.021,64.812],[78,-156],[-182,-20],[0,0],[-35.843,52.428]],"o":[[-118,-182],[-28.425,56.851],[34.319,3.771],[0,0],[26.995,-39.487]],"v":[[242,-226],[-284,-218],[-178,14],[140,16],[250.406,-40.457]]},"ix":2}},{"ty":"st","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Stroke","nm":"Stroke 1","lc":1,"lj":1,"ml":4,"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":0,"ix":5},"c":{"a":0,"k":[1,1,1],"ix":3}},{"ty":"gf","bm":0,"hd":false,"mn":"ADBE Vector Graphic - G-Fill","nm":"Gradient Fill 1","e":{"a":0,"k":[198,-58],"ix":6},"g":{"p":3,"k":{"a":0,"k":[0,0.9215686274509803,0.9568627450980393,0.9882352941176471,0.655,0.8666666666666667,0.8823529411764706,0.9019607843137255,1,0.8117647058823529,0.8117647058823529,0.8117647058823529],"ix":9}},"t":1,"a":{"a":0,"k":0},"h":{"a":0,"k":0},"s":{"a":0,"k":[-296,-60],"ix":5},"r":1,"o":{"a":0,"k":100,"ix":10}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[0,0],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":6,"parent":7},{"ty":4,"nm":"body","sr":1,"st":0,"op":300,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[-20.704,175.322,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[519.296,715.322,0],"t":0,"ti":[0,0,0],"to":[0,0,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[519.296,635.322,0],"t":45,"ti":[0,0,0],"to":[0,0,0]},{"s":[519.296,715.322,0],"t":90}],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"ef":[],"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Ellipse 1","ix":1,"cix":2,"np":3,"it":[{"ty":"el","bm":0,"hd":false,"mn":"ADBE Vector Shape - Ellipse","nm":"Ellipse Path 1","d":1,"p":{"a":0,"k":[0,0],"ix":3},"s":{"a":0,"k":[227,65],"ix":2}},{"ty":"st","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Stroke","nm":"Stroke 1","lc":1,"lj":1,"ml":4,"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":1,"ix":5},"c":{"a":0,"k":[0.5765,0.5765,0.5765],"ix":3}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fill 1","c":{"a":0,"k":[0.8196,0.8196,0.8196],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[-23.5,68.5],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]},{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Shape 1","ix":2,"cix":2,"np":3,"it":[{"ty":"sh","bm":0,"hd":false,"mn":"ADBE Vector Shape - Group","nm":"Path 1","ix":1,"d":1,"ks":{"a":0,"k":{"c":true,"i":[[51,0],[15.678,-82.948],[-49.731,-49.359],[-13.15,-0.292],[-37.729,38.101],[10.258,44.845]],"o":[[-12.374,0],[-8.179,43.273],[38.555,38.266],[13.544,0.301],[45.84,-46.291],[-15.181,-66.366]],"v":[[-27,31],[-179.678,102.948],[-132.269,283.359],[-25,320],[91.483,284.497],[137.742,101.155]]},"ix":2}},{"ty":"st","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Stroke","nm":"Stroke 1","lc":1,"lj":1,"ml":4,"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":0,"ix":5},"c":{"a":0,"k":[1,1,1],"ix":3}},{"ty":"gf","bm":0,"hd":false,"mn":"ADBE Vector Graphic - G-Fill","nm":"Gradient Fill 1","e":{"a":0,"k":[86,146],"ix":6},"g":{"p":3,"k":{"a":0,"k":[0,0.9215686274509803,0.9568627450980393,0.9882352941176471,0.655,0.8666666666666667,0.8823529411764706,0.9019607843137255,1,0.8117647058823529,0.8117647058823529,0.8117647058823529],"ix":9}},"t":1,"a":{"a":0,"k":0},"h":{"a":0,"k":0},"s":{"a":0,"k":[-166,148],"ix":5},"r":1,"o":{"a":0,"k":100,"ix":10}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[0,0],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":7},{"ty":4,"nm":"ear 2","sr":1,"st":0,"op":300,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[-305.5,-118,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[263.5,-118,0],"t":7,"ti":[0,0,0],"to":[0,0,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[247.381,-117.593,0],"t":49,"ti":[0,0,0],"to":[0,0,0]},{"s":[263.5,-118,0],"t":79}],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"ef":[],"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Ellipse 1","ix":1,"cix":2,"np":3,"it":[{"ty":"el","bm":0,"hd":false,"mn":"ADBE Vector Shape - Ellipse","nm":"Ellipse Path 1","d":1,"p":{"a":0,"k":[0,0],"ix":3},"s":{"a":0,"k":[111,138],"ix":2}},{"ty":"st","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Stroke","nm":"Stroke 1","lc":1,"lj":1,"ml":4,"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":0,"ix":5},"c":{"a":0,"k":[1,1,1],"ix":3}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fill 1","c":{"a":0,"k":[0.8824,0.8824,0.8824],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[-305.5,-118],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":8,"parent":6},{"ty":4,"nm":"ear 1","sr":1,"st":0,"op":300,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[-305.5,-118,0],"ix":1},"s":{"a":0,"k":[100,100,100],"ix":6},"sk":{"a":0,"k":0},"p":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[-305.5,-118,0],"t":7,"ti":[0,0,0],"to":[0,0,0]},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[-321.619,-117.593,0],"t":49,"ti":[0,0,0],"to":[0,0,0]},{"s":[-305.5,-118,0],"t":79}],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":100,"ix":11}},"ef":[],"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Ellipse 1","ix":1,"cix":2,"np":3,"it":[{"ty":"el","bm":0,"hd":false,"mn":"ADBE Vector Shape - Ellipse","nm":"Ellipse Path 1","d":1,"p":{"a":0,"k":[0,0],"ix":3},"s":{"a":0,"k":[111,138],"ix":2}},{"ty":"st","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Stroke","nm":"Stroke 1","lc":1,"lj":1,"ml":4,"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":0,"ix":5},"c":{"a":0,"k":[1,1,1],"ix":3}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fill 1","c":{"a":0,"k":[0.8824,0.8824,0.8824],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[-305.5,-118],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":9,"parent":6},{"ty":4,"nm":"shadow","sr":1,"st":0,"op":300,"ip":0,"hd":false,"ddd":0,"bm":0,"hasMask":false,"ao":0,"ks":{"a":{"a":0,"k":[-17.5,380.5,0],"ix":1},"s":{"a":1,"k":[{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[100,100,100],"t":0},{"o":{"x":0.333,"y":0},"i":{"x":0.667,"y":1},"s":[108,108,100],"t":45},{"s":[100,100,100],"t":90}],"ix":6},"sk":{"a":0,"k":0},"p":{"a":0,"k":[523.5,919.5,0],"ix":2},"r":{"a":0,"k":0,"ix":10},"sa":{"a":0,"k":0},"o":{"a":0,"k":60,"ix":11}},"ef":[],"shapes":[{"ty":"gr","bm":0,"hd":false,"mn":"ADBE Vector Group","nm":"Ellipse 1","ix":1,"cix":2,"np":3,"it":[{"ty":"el","bm":0,"hd":false,"mn":"ADBE Vector Shape - Ellipse","nm":"Ellipse Path 1","d":1,"p":{"a":0,"k":[0,0],"ix":3},"s":{"a":0,"k":[249,59],"ix":2}},{"ty":"st","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Stroke","nm":"Stroke 1","lc":1,"lj":1,"ml":4,"o":{"a":0,"k":100,"ix":4},"w":{"a":0,"k":0,"ix":5},"c":{"a":0,"k":[1,1,1],"ix":3}},{"ty":"fl","bm":0,"hd":false,"mn":"ADBE Vector Graphic - Fill","nm":"Fill 1","c":{"a":0,"k":[0.7686,0.7686,0.7686],"ix":4},"r":1,"o":{"a":0,"k":100,"ix":5}},{"ty":"tr","a":{"a":0,"k":[0,0],"ix":1},"s":{"a":0,"k":[100,100],"ix":3},"sk":{"a":0,"k":0,"ix":4},"p":{"a":0,"k":[-17.5,380.5],"ix":2},"r":{"a":0,"k":0,"ix":6},"sa":{"a":0,"k":0,"ix":5},"o":{"a":0,"k":100,"ix":7}}]}],"ind":10}]}]};

  function lbInitAnim(container) {
    lottie.loadAnimation({
      container:     container,
      renderer:      "svg",
      loop:          true,
      autoplay:      true,
      animationData: JSON.parse(JSON.stringify(ANIM_DATA))
    });
  }

  function initLottie() {
    lbInitAnim(av);
    var startEl = document.getElementById("lb-start-lottie");
    if (startEl) lbInitAnim(startEl);
    var hdrEl = document.getElementById("lb-hdr-lottie");
    if (hdrEl) lbInitAnim(hdrEl);
  }

  (function loadLottieLib() {
    if (window.lottie) { initLottie(); return; }
    var s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js";
    s.onload = initLottie;
    s.onerror = function() { console.warn("[Bot] lottie failed to load"); };
    document.head.appendChild(s);
  })();

  /* ── REFS ────────────────────────────────────────────────────────────── */
  var progFill  = document.getElementById("lb-prog-fill");
  var progLbl   = document.getElementById("lb-prog-lbl");
  var phaseSpan = document.getElementById("lb-hdr-phase");
  var statusIcon = document.getElementById("lb-status-icon");
  var statusTxt  = document.getElementById("lb-status-txt");
  var voiceToggle = document.getElementById("lb-voice-btn");

  /* ── PHASE MANAGEMENT ────────────────────────────────────────────────── */
  var PHASE_LABELS = {
    idle:       "Tap mic to begin",
    greeting:   "Speaking…",
    listening:  "🎤 Listening…",
    processing: "Thinking…",
    speaking:   "Speaking…",
    done:       "All done! ✅"
  };

  function setPhase(phase) {
    S.phase = phase;
    if (phaseSpan) phaseSpan.textContent = PHASE_LABELS[phase] || phase;

    // Status bar
    var showStatus = (phase === "listening" || phase === "speaking" || phase === "processing");
    statusBar.classList.toggle("show", showStatus);
    if (phase === "listening") {
      statusIcon.textContent = "🎤";
      statusTxt.textContent  = "Listening — speak now…";
      micBtn.classList.add("listening");
    } else if (phase === "speaking") {
      statusIcon.textContent = "🔊";
      statusTxt.textContent  = BOT_NAME + " is speaking…";
      micBtn.classList.remove("listening");
    } else if (phase === "processing") {
      statusIcon.textContent = "💭";
      statusTxt.textContent  = "Processing…";
      micBtn.classList.remove("listening");
    } else {
      micBtn.classList.remove("listening");
    }
  }

  /* ── AUDIO: TTS via OpenAI speak API ─────────────────────────────────── */
  function speak(text, onDone) {
    if (!S.voiceOn) { if (onDone) onDone(); return; }
    var clean = text
      .replace(/<[^>]+>/g, " ")
      .replace(/&[^;]+;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) { if (onDone) onDone(); return; }

    setPhase("speaking");

    fetch(BASE_URL + "/api/voice/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean })
    })
    .then(function(r) {
      if (!r.ok) throw new Error("TTS failed");
      return r.blob();
    })
    .then(function(blob) {
      var url  = URL.createObjectURL(blob);
      S.audio  = new Audio(url);
      S.audio.onended = function() {
        URL.revokeObjectURL(url);
        S.audio = null;
        if (onDone) onDone();
      };
      S.audio.onerror = function() { if (onDone) onDone(); };
      S.audio.play().catch(function() {
        // Autoplay blocked — speak via browser synth as fallback
        browserSpeak(clean, onDone);
      });
    })
    .catch(function() { browserSpeak(clean, onDone); });
  }

  function browserSpeak(text, onDone) {
    var synth = window.speechSynthesis;
    if (!synth) { if (onDone) onDone(); return; }
    synth.cancel();
    var utt = new SpeechSynthesisUtterance(text);
    utt.rate  = 1.05;
    utt.pitch = 1.0;
    var voices = synth.getVoices();
    var pick = voices.find(function(v) {
      return /Samantha|Victoria|Karen|Google UK English Female|Microsoft Zira/i.test(v.name);
    }) || voices.find(function(v) { return v.lang.startsWith("en"); }) || voices[0];
    if (pick) utt.voice = pick;
    utt.onend   = function() { if (onDone) onDone(); };
    utt.onerror = function() { if (onDone) onDone(); };
    synth.speak(utt);
  }

  function stopSpeaking() {
    if (S.audio) { S.audio.pause(); S.audio = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  /* ── STT: Web Speech Recognition (Auto-listening) ──────────────────────── */
  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  var hasSpeechRec = !!SpeechRec;
  var listeningTimer = null;

  function requestMicrophonePermission() {
    return navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function(stream) {
        stream.getTracks().forEach(function(track) { track.stop(); });
        console.log("[Bot] ✅ Microphone permission granted");
        return true;
      })
      .catch(function(error) {
        console.error("[Bot] ❌ Microphone permission error:", error.name, error.message);
        var msg = "🔒 Microphone access denied. ";

        if (error.name === "NotAllowedError") {
          msg += "Please check your browser settings and enable microphone permissions for this site.";
        } else if (error.name === "NotFoundError" || error.name === "EnumerateDevicesNotAllowedError") {
          msg += "No microphone device found. Please check your system settings.";
        } else if (error.name === "NotReadableError") {
          msg += "Your microphone is in use by another application. Please close other apps and try again.";
        } else if (error.name === "SecurityError") {
          msg += "Microphone access requires a secure connection (HTTPS). Please ensure you're on an HTTPS page.";
        } else {
          msg += "Please enable microphone permissions and try again.";
        }

        addMsg(msg, "bot");
        setPhase("idle");
        return false;
      });
  }

  function startListening() {
    if (!hasSpeechRec || !S.voiceOn) return;
    if (S.recognition) { try { S.recognition.abort(); } catch(e) {} }

    console.log("[Bot] Starting voice recognition with VAD...");

    // Request microphone permission and stream for VAD
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      requestMicrophonePermission().then(function(granted) {
        if (!granted) return;
        // Now get the actual stream for VAD
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
          initializeRecognition(stream);
        }).catch(function(e) {
          console.error("[Bot] Failed to get audio stream for VAD:", e);
          initializeRecognition(null);
        });
      });
    } else {
      initializeRecognition(null);
    }

    function initializeRecognition(stream) {
      var rec = new SpeechRec();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.continuous = false;

      var hasStarted = false;
      var VAD_SILENCE_MS = 1500;
      var VAD_THRESHOLD = 8;
      var silenceStartTime = null;
      var audioContext = null;
      var analyser = null;
      var rafId = null;

      // Setup VAD if stream is available
      if (stream) {
        try {
          var AudioCtx = window.AudioContext || window.webkitAudioContext;
          audioContext = new AudioCtx();
          var source = audioContext.createMediaStreamSource(stream);
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          console.log("[Bot] VAD setup: AudioContext created, monitoring RMS energy");
        } catch(e) {
          console.error("[Bot] Failed to setup VAD:", e);
          if (stream) stream.getTracks().forEach(function(t) { t.stop(); });
          stream = null;
        }
      }

      rec.onstart = function() {
        console.log("[Bot] 🎤 Microphone opened, listening...");
        hasStarted = true;
        setPhase("listening");

        // Start VAD monitoring if analyser is available
        if (analyser) {
          console.log("[Bot] Starting VAD monitor loop");
          silenceStartTime = null;
          var monitorVAD = function() {
            var dataArray = new Uint8Array(analyser.fftSize);
            analyser.getByteTimeDomainData(dataArray);

            // Calculate RMS (root mean square) energy
            var sum = 0;
            for (var i = 0; i < dataArray.length; i++) {
              var normalized = (dataArray[i] - 128) / 128;
              sum += normalized * normalized;
            }
            var rms = Math.sqrt(sum / dataArray.length);

            // Convert RMS to a simpler scale (0-100)
            var energy = rms * 100;

            // Check for silence
            if (energy < VAD_THRESHOLD) {
              if (silenceStartTime === null) {
                silenceStartTime = Date.now();
                console.log("[Bot] Silence detected, waiting " + VAD_SILENCE_MS + "ms before auto-stop");
              } else if (Date.now() - silenceStartTime > VAD_SILENCE_MS) {
                console.log("[Bot] ⏹ Auto-stopping due to " + VAD_SILENCE_MS + "ms silence (RMS: " + energy.toFixed(1) + ")");
                if (rec && rec.state !== "inactive") {
                  try { rec.stop(); } catch(e) {}
                }
                return; // Stop monitoring
              }
            } else {
              if (silenceStartTime !== null) {
                console.log("[Bot] Speech detected, resetting silence timer (RMS: " + energy.toFixed(1) + ")");
              }
              silenceStartTime = null;
            }

            rafId = requestAnimationFrame(monitorVAD);
          };
          monitorVAD();
        }
      };

      rec.onresult = function(e) {
        // Reset silence timer on speech
        if (analyser) silenceStartTime = null;

        var transcript = "";
        for (var i = e.resultIndex; i < e.results.length; i++) {
          transcript += e.results[i][0].transcript;
        }
        console.log("[Bot] Interim:", transcript, "isFinal:", e.results[e.results.length - 1].isFinal);

        if (e.results[e.results.length - 1].isFinal) {
          var finalText = transcript.trim();
          if (!finalText) {
            console.log("[Bot] Empty transcript, restarting...");
            startListening();
            return;
          }
          console.log("[Bot] ✅ Final transcript:", finalText);
          stopListening();
          handleUserInput(finalText);
        }
      };

      rec.onerror = function(e) {
        console.error("[Bot] Speech recognition error:", e.error, "phase:", S.phase);

        if (e.error === "not-allowed") {
          console.error("[Bot] Microphone permission denied.");
          addMsg("🔒 Microphone access required. Please check your browser's microphone permissions for this site and try again.", "bot");
          setPhase("idle");
          return;
        }

        if (e.error === "no-speech") {
          console.log("[Bot] No speech detected, restarting...");
          if (S.phase === "listening") {
            startListening();
          }
          return;
        }

        if (e.error === "network") {
          console.error("[Bot] Network error in speech recognition");
          addMsg("Network error — please check your connection and try again.", "bot");
          setPhase("idle");
          return;
        }

        if (e.error === "aborted") return;

        console.error("[Bot] Other error:", e.error);
        if (hasStarted) setPhase("idle");
      };

      rec.onend = function() {
        console.log("[Bot] Recognition ended, phase:", S.phase);
        // Cleanup
        if (rafId) cancelAnimationFrame(rafId);
        if (analyser) {
          try { analyser.context.close(); } catch(e) {}
        }
        if (stream) {
          stream.getTracks().forEach(function(t) { t.stop(); });
        }
        // Auto-restart if still in listening phase
        if (S.phase === "listening" && hasStarted) {
          setTimeout(startListening, 300);
        }
      };

      S.recognition = rec;
      try {
        console.log("[Bot] Calling rec.start()");
        rec.start();
      } catch(e) {
        console.error("[Bot] Failed to start recognition:", e);
        if (rafId) cancelAnimationFrame(rafId);
        if (analyser) { try { analyser.context.close(); } catch(e) {} }
        if (stream) { stream.getTracks().forEach(function(t) { t.stop(); }); }
        setPhase("idle");
      }
    }
  }

  function stopListening() {
    console.log("[Bot] Stopping listening");
    setPhase("idle");
    if (listeningTimer) {
      clearInterval(listeningTimer);
      listeningTimer = null;
    }
    if (S.recognition) {
      try {
        S.recognition.abort();
        console.log("[Bot] Recognition aborted");
      } catch(e) {
        console.error("[Bot] Error aborting recognition:", e);
      }
      S.recognition = null;
    }
  }

  /* ── MESSAGES UI ─────────────────────────────────────────────────────── */
  function addMsg(text, role, extra) {
    var m = document.createElement("div");
    m.className = "lb-m " + (role || "bot") + (extra ? " " + extra : "");
    m.innerHTML = text;
    msgs.appendChild(m);
    msgs.scrollTop = msgs.scrollHeight;
    return m;
  }

  function addTyping() {
    var m = document.createElement("div");
    m.className = "lb-m bot lb-typing";
    m.innerHTML = '<div class="lb-dot"></div><div class="lb-dot"></div><div class="lb-dot"></div>';
    msgs.appendChild(m);
    msgs.scrollTop = msgs.scrollHeight;
    return m;
  }

  function addChips(options, onPick) {
    var wrap = document.createElement("div");
    wrap.className = "lb-chips";
    options.forEach(function(opt) {
      var chip = document.createElement("button");
      chip.className = "lb-chip";
      chip.type = "button";
      chip.textContent = opt;
      chip.addEventListener("click", function() {
        wrap.querySelectorAll(".lb-chip").forEach(function(c) { c.disabled = true; });
        chip.classList.add("sel");
        onPick(opt);
      });
      wrap.appendChild(chip);
    });
    var wrapper = document.createElement("div");
    wrapper.className = "lb-m bot";
    wrapper.style.cssText = "background:transparent;padding:0;";
    wrapper.appendChild(wrap);
    msgs.appendChild(wrapper);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function formatText(t) {
    return t
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br>");
  }

  /* ── PROGRESS ────────────────────────────────────────────────────────── */
  function updateProgress() {
    var n = FIELDS.filter(function(f) { return !!S.leadData[f]; }).length;
    var pct = Math.round((n / FIELDS.length) * 100);
    progFill.style.width = pct + "%";
    progLbl.textContent  = n + " of " + FIELDS.length + " fields filled";
  }

  /* ── CF7 FORM FILL ───────────────────────────────────────────────────── */
  function fillCF7(fields) {
    var filled = [];
    Object.keys(fields).forEach(function(name) {
      var val = fields[name]; if (!val) return;
      var field = document.querySelector(
        'input[name="' + name + '"],select[name="' + name + '"],textarea[name="' + name + '"]'
      );
      if (!field) return;
      var proto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value");
      if (proto && proto.set) proto.set.call(field, val);
      else field.value = val;
      field.dispatchEvent(new Event("input",  { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      field.style.cssText += ";transition:border-color .4s,box-shadow .4s;border-color:" + BRAND + ";box-shadow:0 0 0 3px " + BRAND + "28;";
      setTimeout(function() { field.style.borderColor = ""; field.style.boxShadow = ""; }, 2200);
      S.leadData[name] = val;
      if (S.filled.indexOf(name) === -1) {
        S.filled.push(name);
        filled.push(name.replace(/_/g, " "));
      }
    });

    // Privacy checkbox
    if (S.leadData.first_name && S.leadData.email) {
      var cb = document.querySelector('input[name="acceptance-privacy_policy"]');
      if (cb && !cb.checked) {
        cb.checked = true;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    if (filled.length) {
      showToast("Filled: " + filled.join(", ") + " ✓");
      updateProgress();
    }

    advanceCF7Step();
  }

  /* ── CF7 STEP NAVIGATION ─────────────────────────────────────────────── */
  function getVisibleStep() {
    var steps = document.querySelectorAll(".uacf7-step");
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      var style = window.getComputedStyle(s);
      if (style.display !== "none" && style.visibility !== "hidden" && s.offsetParent !== null) {
        return s;
      }
    }
    return null;
  }

  function fieldFilled(name) {
    var f = document.querySelector('input[name="' + name + '"],select[name="' + name + '"],textarea[name="' + name + '"]');
    return f && f.value && f.value.trim().length > 0;
  }

  function advanceCF7Step() {
    var step = getVisibleStep();
    if (!step) return;
    var stepId = parseInt(step.getAttribute("step-id") || "1", 10);

    var canNext = false;
    if (stepId === 1) {
      canNext = fieldFilled("first_name") && fieldFilled("email");
    } else if (stepId === 2) {
      canNext = fieldFilled("company") || fieldFilled("sector") || fieldFilled("website");
    }

    if (canNext) {
      var nextBtn = step.querySelector(".uacf7-next");
      if (nextBtn) setTimeout(function() { nextBtn.click(); }, 700);
    }
  }

  /* ── TOAST ───────────────────────────────────────────────────────────── */
  function showToast(text) {
    toast.innerHTML = "✅ " + text;
    toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function() { toast.classList.remove("show"); }, 3000);
  }

  /* ── MAIN: SEND TO AI ────────────────────────────────────────────────── */
  function handleUserInput(text, isInternal) {
    if (S.phase === "processing" || S.phase === "speaking") return;
    stopListening();
    stopSpeaking();

    S.messages.push({ role: "user", content: text });
    if (!isInternal) addMsg(text, "user");

    setPhase("processing");
    inp.disabled = true;
    sendBtn.disabled = true;

    var typingEl = addTyping();
    var ctrl  = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, 28000);

    fetch(BASE_URL + "/api/agent/bot-chat", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages:  S.messages,
        leadData:  S.leadData,
        sessionId: S.sessionId,
        tenantId:  TENANT
      })
    })
    .then(function(r) {
      clearTimeout(timer);
      if (!r.ok) return r.json().then(function(e) { throw new Error(e.detail || "HTTP " + r.status); });
      return r.json();
    })
    .then(function(data) {
      typingEl.remove();
      inp.disabled = false;
      sendBtn.disabled = false;

      if (!data.text) {
        addMsg("I didn't catch that — could you try again?", "bot");
        if (S.voiceOn) startListening();
        else setPhase("idle");
        return;
      }

      // Show bot message
      addMsg(formatText(data.text), "bot");

      // Fill form fields
      if (data.cf7Fields) fillCF7(data.cf7Fields);
      if (data.leadData)  Object.assign(S.leadData, data.leadData);

      // Show audit card
      if (data.audit) {
        setTimeout(function() {
          var score = data.audit.mobileScore;
          var dot   = score >= 80 ? "🟢" : score >= 50 ? "🟡" : "🔴";
          addMsg(dot + " <b>Site report</b> — Mobile: " + score + "/100 · Desktop: " + data.audit.desktopScore + "/100<br><small>" + data.audit.summary + "</small>", "bot", "audit");
        }, 400);
      }

      S.messages.push({ role: "assistant", content: data.text });
      updateProgress();

      // Show chips if AI mentions sector/location/budget
      showContextChips(data.text);

      // Speak the reply, then listen again
      speak(data.text, function() {
        if (S.phase === "done") return;
        if (S.voiceOn && hasSpeechRec) {
          setTimeout(startListening, 400);
        } else {
          setPhase("idle");
        }
      });
    })
    .catch(function(err) {
      clearTimeout(timer);
      typingEl.remove();
      inp.disabled = false;
      sendBtn.disabled = false;
      var isTimeout = err && err.name === "AbortError";
      var msg = isTimeout ? "That took too long — please try again." : "Something went wrong: " + (err ? err.message : "");
      addMsg(msg, "bot", "warn");
      setPhase("idle");
      console.error("[Bot]", err);
    });
  }

  function showContextChips(text) {
    if (/sector|industry/i.test(text) && !S.leadData.sector) {
      setTimeout(function() {
        addChips(
          ["Consumer Goods","Corporate & Business","Education","Entertainment",
           "Health & Wellness","Real Estate","Retail","Technology","Travel & Tourism","Others"],
          function(v) { handleUserInput(v); }
        );
      }, 300);
    } else if (/office|UAE|USA|Europe|China/i.test(text) && !S.leadData.location) {
      setTimeout(function() {
        addChips(["UAE 🇦🇪","USA 🇺🇸","Europe 🇪🇺","China 🇨🇳"],
          function(v) { handleUserInput(v); }
        );
      }, 300);
    } else if (/budget/i.test(text) && !S.leadData.cost) {
      setTimeout(function() {
        addChips(["< $5,000","$5k–$25k","$25k–$50k","$50k–$100k","+$100k"],
          function(v) { handleUserInput(v); }
        );
      }, 300);
    }
  }

  /* ── START CONVERSATION ──────────────────────────────────────────────── */
  function unlockAudioContext() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var buf = ctx.createBuffer(1, 1, 22050);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      ctx.close();
    } catch(e) {}
  }

  function startConversation(voiceMode) {
    unlockAudioContext();  // must be called inside user-gesture handler
    startScreen.style.display = "none";
    msgs.style.display        = "flex";
    inpRow.style.display      = "flex";
    S.started    = true;
    S.voiceOn    = voiceMode;
    S.audioUnlocked = true;
    voiceToggle.innerHTML = voiceMode ? "🔊" : "🔇";

    // Begin with greeting from AI
    handleUserInput("hello", true);
  }

  /* ── PANEL OPEN / CLOSE ──────────────────────────────────────────────── */
  function openPanel() {
    panel.classList.add("open");
    clearNotif();
    if (!S.started) {
      // Show start screen
    } else {
      msgs.scrollTop = msgs.scrollHeight;
    }
  }

  function closePanel() {
    panel.classList.remove("open");
    stopListening();
  }

  function clearNotif() {
    notif.textContent = "";
    notif.classList.remove("show");
  }

  /* ── EVENTS ──────────────────────────────────────────────────────────── */
  av.addEventListener("click", function() {
    panel.classList.contains("open") ? closePanel() : openPanel();
  });

  document.getElementById("lb-close-btn").addEventListener("click", closePanel);

  document.getElementById("lb-start-btn").addEventListener("click", function() {
    startConversation(true);
  });

  document.getElementById("lb-start-text-btn").addEventListener("click", function() {
    startConversation(false);
  });

  document.getElementById("lb-stop-btn").addEventListener("click", function() {
    stopListening();
    stopSpeaking();
    setPhase("idle");
  });

  voiceToggle.addEventListener("click", function() {
    S.voiceOn = !S.voiceOn;
    voiceToggle.innerHTML = S.voiceOn ? "🔊" : "🔇";
    if (!S.voiceOn) { stopSpeaking(); stopListening(); setPhase("idle"); }
  });

  micBtn.addEventListener("click", function() {
    if (S.phase === "listening") { stopListening(); setPhase("idle"); }
    else if (S.phase === "idle" && S.started) { startListening(); }
  });

  sendBtn.addEventListener("click", submit);
  inp.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  inp.addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 90) + "px";
  });

  function submit() {
    var text = inp.value.trim();
    if (!text || S.phase === "processing") return;
    stopSpeaking();
    stopListening();
    inp.value = "";
    inp.style.height = "";
    handleUserInput(text);
  }

  /* ── MONITOR MANUAL FORM FILLS ───────────────────────────────────────── */
  function setupFormMonitor() {
    var form = document.querySelector(".wpcf7-form,.gform_wrapper form,.wpforms-form,form");
    if (!form) return;
    var known = { first_name:1,last_name:1,email:1,phone:1,company:1,
                  sector:1,website:1,location:1,business:1,success:1,cost:1,start:1,rfp:1 };
    form.querySelectorAll("input,textarea,select").forEach(function(f) {
      f.addEventListener("blur", function() {
        var n = f.name, v = f.value.trim();
        if (!n || !v || !known[n] || S.leadData[n]) return;
        S.leadData[n] = v;
        updateProgress();
        if (S.started && S.phase === "idle") {
          handleUserInput("I filled in " + n.replace(/_/g," ") + ": " + v);
        }
      });
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupFormMonitor);
  } else {
    setupFormMonitor();
  }

  /* ── AUTO-OPEN ───────────────────────────────────────────────────────── */
  function autoOpen() { if (!S.started) openPanel(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() { setTimeout(autoOpen, 1500); });
  } else {
    setTimeout(autoOpen, 1500);
  }

  /* ── IDLE NOTIF ──────────────────────────────────────────────────────── */
  setTimeout(function() {
    if (!panel.classList.contains("open")) {
      notif.textContent = "1";
      notif.classList.add("show");
    }
  }, 8000);

})();
