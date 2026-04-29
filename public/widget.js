(function () {
  if (window.__agentRagWidgetLoaded) return;
  window.__agentRagWidgetLoaded = true;

  var config = window.RagChatbotConfig || {};
  var script = document.currentScript;
  var scriptUrl = script && script.src ? new URL(script.src) : null;
  var baseUrl = (config.baseUrl || (scriptUrl && scriptUrl.origin) || "").replace(/\/$/, "");
  var domain = config.domain || window.location.hostname;
  var tenantId = config.tenantId || domain;
  var brandColor = config.brandColor || "";
  var position = config.position === "left" ? "left" : "right";

  if (!baseUrl) return;

  var iframe = document.createElement("iframe");
  var params = new URLSearchParams({
    embed: "1",
    domain: domain,
    tenantId: tenantId
  });

  if (/^#[0-9a-f]{6}$/i.test(brandColor)) {
    params.set("brandColor", brandColor);
  }

  iframe.src = baseUrl + "/chat?" + params.toString();
  iframe.title = "AI chat assistant";
  iframe.allow = "clipboard-write; microphone";
  iframe.style.position = "fixed";
  iframe.style.bottom = "20px";
  iframe.style[position] = "20px";
  iframe.style.width = "96px";
  iframe.style.height = "96px";
  iframe.style.border = "0";
  iframe.style.zIndex = String(config.zIndex || 2147483000);
  iframe.style.background = "transparent";
  iframe.style.colorScheme = "light";
  iframe.style.overflow = "hidden";

  function resize(open) {
    var isMobile = window.matchMedia("(max-width: 520px)").matches;
    if (open && isMobile) {
      iframe.style.width = "100vw";
      iframe.style.height = "100vh";
      iframe.style.bottom = "0";
      iframe.style[position] = "0";
      iframe.style.borderRadius = "0";
      return;
    }

    iframe.style.borderRadius = "16px";
    iframe.style.bottom = "20px";
    iframe.style[position] = "20px";
    iframe.style.width = open ? "420px" : "96px";
    iframe.style.height = open ? "700px" : "96px";
    iframe.style.maxWidth = "calc(100vw - 40px)";
    iframe.style.maxHeight = "calc(100vh - 40px)";
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== baseUrl) return;
    if (!event.data || event.data.type !== "rag-widget:size") return;
    resize(Boolean(event.data.open));
  });

  window.addEventListener("resize", function () {
    resize(iframe.style.width !== "96px");
  });

  document.body.appendChild(iframe);
})();
