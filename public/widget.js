(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf("widget.js") !== -1) {
        script = scripts[i];
        break;
      }
    }
  }
  if (!script) return;

  var token = script.getAttribute("data-token");
  if (!token) {
    console.error("[ReserveEazy] Missing data-token on widget script");
    return;
  }

  var position = script.getAttribute("data-position") || "bottom-right";
  var label = script.getAttribute("data-label") || "Book now";
  var color = script.getAttribute("data-color") || "#cb2030";
  var scriptSrc = script.getAttribute("src") || "";
  var baseUrl = scriptSrc.replace(/\/widget\.js(\?.*)?$/, "");

  var ROOT_ID = "reserveeazy-widget-root";
  var STYLE_ID = "reserveeazy-widget-styles";
  if (document.getElementById(ROOT_ID)) return;

  if (!document.getElementById(STYLE_ID)) {
    var styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    styleEl.textContent =
      "@keyframes reserveeazy-spin{to{transform:rotate(360deg)}}" +
      ".reserveeazy-widget-spinner{width:32px;height:32px;border:3px solid #f0e8e8;border-top-color:" +
      color +
      ";border-radius:50%;animation:reserveeazy-spin .75s linear infinite}";
    document.head.appendChild(styleEl);
  }

  var anchorStyles = {
    "bottom-right": {
      bottom: "24px",
      right: "24px",
      top: "auto",
      left: "auto",
      transform: "none",
    },
    "bottom-left": {
      bottom: "24px",
      left: "24px",
      top: "auto",
      right: "auto",
      transform: "none",
    },
    "bottom-center": {
      bottom: "24px",
      left: "50%",
      top: "auto",
      right: "auto",
      transform: "translateX(-50%)",
    },
    "top-right": {
      top: "24px",
      right: "24px",
      bottom: "auto",
      left: "auto",
      transform: "none",
    },
    "top-left": {
      top: "24px",
      left: "24px",
      bottom: "auto",
      right: "auto",
      transform: "none",
    },
  };

  var anchor = anchorStyles[position] || anchorStyles["bottom-right"];
  var opensAbove = position.indexOf("bottom") === 0;

  var alignItems = "flex-end";
  if (position === "bottom-center") alignItems = "center";
  if (position === "bottom-left" || position === "top-left")
    alignItems = "flex-start";

  function createBrandRow(fontSize) {
    var row = document.createElement("div");
    row.setAttribute("aria-hidden", "true");
    row.style.cssText =
      "display:flex;align-items:center;gap:10px;font-family:system-ui,-apple-system,sans-serif;";

    var dot = document.createElement("span");
    dot.style.cssText =
      "flex-shrink:0;width:10px;height:10px;border-radius:50%;background:" +
      color +
      ";box-shadow:0 2px 6px rgba(203,32,48,0.35);";

    var title = document.createElement("span");
    title.style.cssText =
      "font-size:" +
      fontSize +
      ";font-weight:700;color:#1a1212;letter-spacing:-0.02em;line-height:1.2;";
    title.innerHTML =
      'Reserve<span style="color:' + color + '">Eazy</span>';

    row.appendChild(dot);
    row.appendChild(title);
    return row;
  }

  var root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute("data-reserveeazy-widget", "true");
  root.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "bottom:" + (anchor.bottom === "auto" ? "auto" : anchor.bottom),
    "top:" + (anchor.top === "auto" ? "auto" : anchor.top),
    "left:" + (anchor.left === "auto" ? "auto" : anchor.left),
    "right:" + (anchor.right === "auto" ? "auto" : anchor.right),
    "transform:" + anchor.transform,
    "display:flex",
    "flex-direction:column",
    "align-items:" + alignItems,
    "font-family:system-ui,-apple-system,sans-serif",
    "box-sizing:border-box",
  ].join(";");

  var panel = document.createElement("div");
  panel.id = "reserveeazy-widget-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Book an appointment with ReserveEazy");
  panel.setAttribute("aria-hidden", "true");
  panel.setAttribute("aria-busy", "false");
  panel.style.cssText = [
    "display:none",
    "flex-direction:column",
    "width:min(100vw - 32px, 420px)",
    "height:min(72vh, 640px)",
    "margin-bottom:12px",
    "background:#fff",
    "border-radius:16px",
    "overflow:hidden",
    "box-shadow:0 12px 40px rgba(0,0,0,0.22)",
    "box-sizing:border-box",
  ].join(";");

  if (!opensAbove) {
    panel.style.marginBottom = "0";
    panel.style.marginTop = "12px";
    panel.style.order = "2";
  }

  var header = document.createElement("div");
  header.style.cssText = [
    "flex-shrink:0",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "padding:14px 16px",
    "border-bottom:1px solid #f0e8e8",
    "background:#fff",
  ].join(";");
  header.appendChild(createBrandRow("17px"));

  var body = document.createElement("div");
  body.style.cssText =
    "position:relative;flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow:hidden;";

  var loader = document.createElement("div");
  loader.setAttribute("role", "status");
  loader.setAttribute("aria-live", "polite");
  loader.setAttribute("aria-label", "Loading booking");
  loader.style.cssText = [
    "position:absolute",
    "inset:0",
    "z-index:2",
    "display:none",
    "flex-direction:column",
    "align-items:center",
    "justify-content:center",
    "gap:20px",
    "background:#fff",
  ].join(";");

  var loaderBrand = createBrandRow("20px");
  loaderBrand.setAttribute("aria-hidden", "true");

  var spinner = document.createElement("div");
  spinner.className = "reserveeazy-widget-spinner";
  spinner.setAttribute("aria-hidden", "true");

  var loadingText = document.createElement("p");
  loadingText.textContent = "Loading booking…";
  loadingText.style.cssText =
    "margin:0;font-size:13px;color:#6b5c5c;font-family:system-ui,-apple-system,sans-serif;";

  loader.appendChild(loaderBrand);
  loader.appendChild(spinner);
  loader.appendChild(loadingText);

  var iframe = document.createElement("iframe");
  iframe.title = "Book an appointment";
  iframe.style.cssText =
    "flex:1 1 auto;width:100%;min-height:0;border:none;display:block;background:#fff;opacity:0;transition:opacity .2s ease;";
  iframe.setAttribute("allow", "clipboard-write");

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.setAttribute("aria-label", label);
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-controls", "reserveeazy-widget-panel");
  launcher.textContent = label;

  var launcherBaseStyle = [
    "min-height:44px",
    "min-width:44px",
    "padding:12px 20px",
    "border:none",
    "border-radius:9999px",
    "background:" + color,
    "color:#fff",
    "font-size:15px",
    "font-weight:600",
    "cursor:pointer",
    "box-shadow:0 4px 14px rgba(0,0,0,0.18)",
    "line-height:1.2",
    "flex-shrink:0",
    "order:2",
  ].join(";");

  if (!opensAbove) {
    launcher.style.order = "1";
  }

  launcher.style.cssText = "position:relative;z-index:2;" + launcherBaseStyle;

  var isOpen = false;
  var embedUrl = baseUrl + "/embed/" + encodeURIComponent(token);

  function showLoader() {
    loader.style.display = "flex";
    panel.setAttribute("aria-busy", "true");
    iframe.style.opacity = "0";
  }

  function hideLoader() {
    loader.style.display = "none";
    panel.setAttribute("aria-busy", "false");
    iframe.style.opacity = "1";
  }

  function setLauncherClosed() {
    launcher.textContent = label;
    launcher.setAttribute("aria-label", label);
    launcher.setAttribute("aria-expanded", "false");
    launcher.style.width = "";
    launcher.style.height = "";
    launcher.style.padding = "12px 20px";
    launcher.style.fontSize = "15px";
  }

  function setLauncherOpen() {
    launcher.textContent = "\u00d7";
    launcher.setAttribute("aria-label", "Close booking");
    launcher.setAttribute("aria-expanded", "true");
    launcher.style.width = "48px";
    launcher.style.height = "48px";
    launcher.style.padding = "0";
    launcher.style.fontSize = "26px";
  }

  function openPanel() {
    isOpen = true;
    panel.style.display = "flex";
    panel.setAttribute("aria-hidden", "false");
    showLoader();
    setLauncherOpen();
    iframe.src = embedUrl;
  }

  function closePanel() {
    isOpen = false;
    panel.style.display = "none";
    panel.setAttribute("aria-hidden", "true");
    iframe.src = "about:blank";
    showLoader();
    setLauncherClosed();
  }

  function togglePanel() {
    if (isOpen) closePanel();
    else openPanel();
  }

  iframe.addEventListener("load", function () {
    if (!isOpen || iframe.src === "about:blank") return;
    hideLoader();
  });

  launcher.addEventListener("click", function (e) {
    e.stopPropagation();
    togglePanel();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) closePanel();
  });

  document.addEventListener("click", function (e) {
    if (!isOpen) return;
    if (root.contains(e.target)) return;
    closePanel();
  });

  body.appendChild(loader);
  body.appendChild(iframe);
  panel.appendChild(header);
  panel.appendChild(body);

  if (opensAbove) {
    root.appendChild(panel);
    root.appendChild(launcher);
  } else {
    root.appendChild(launcher);
    root.appendChild(panel);
  }

  document.body.appendChild(root);
})();
