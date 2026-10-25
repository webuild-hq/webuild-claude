/**
 * Interface MCP Apps du catalogue (affichée par Claude sous l'appel à list_themes).
 * Grille de cartes : carrousel de captures, "Voir la démo" (ui/open-link) et "Choisir ce thème" (ui/message).
 * Les captures arrivent par l'outil get_theme_screenshots, réservé à l'interface : elles ne passent jamais
 * dans le contexte du modèle. Protocole : https://modelcontextprotocol.io/docs/extensions/apps
 */
export const THEME_CATALOG_URI = "ui://webuild/theme-catalog.html";

export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";

export const THEME_CATALOG_HTML = /* html */ `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Thèmes Webuild</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: var(--color-background-primary, #ffffff);
    --card: var(--color-background-secondary, #f6f5f4);
    --line: var(--color-border-primary, rgba(0, 0, 0, 0.1));
    --text: var(--color-text-primary, #1c1917);
    --muted: var(--color-text-secondary, #6b6460);
    --radius: var(--border-radius-lg, 14px);
    --font: var(--font-sans, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif);
  }
  html.dark {
    --bg: var(--color-background-primary, #1f1e1d);
    --card: var(--color-background-secondary, #2a2927);
    --line: var(--color-border-primary, rgba(255, 255, 255, 0.12));
    --text: var(--color-text-primary, #f5f4f2);
    --muted: var(--color-text-secondary, #a8a29e);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: transparent; }
  body { font-family: var(--font); color: var(--text); font-size: 14px; line-height: 1.45; padding: 4px; }
  .grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden;
    display: flex; flex-direction: column; }
  .media { position: relative; aspect-ratio: 16 / 10; background: var(--line); overflow: hidden; }
  .slides { display: flex; height: 100%; transition: transform 0.35s ease; }
  .slide { flex: 0 0 100%; height: 100%; }
  .slide img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
  .placeholder { height: 100%; display: flex; align-items: flex-end; padding: 16px; color: #fff;
    font-size: 26px; font-weight: 650; letter-spacing: -0.02em; text-shadow: 0 1px 8px rgba(0, 0, 0, 0.25); }
  .caption { position: absolute; left: 10px; bottom: 10px; padding: 3px 8px; border-radius: 999px; font-size: 12px;
    background: rgba(0, 0, 0, 0.55); color: #fff; }
  .nav { position: absolute; top: 50%; transform: translateY(-50%); width: 30px; height: 30px; border-radius: 50%;
    border: 0; background: rgba(255, 255, 255, 0.9); color: #1c1917; font-size: 16px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2); }
  .nav:disabled { opacity: 0; pointer-events: none; }
  .prev { left: 8px; } .next { right: 8px; }
  .dots { position: absolute; right: 10px; bottom: 12px; display: flex; gap: 5px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255, 255, 255, 0.5); }
  .dot.on { background: #fff; }
  .body { padding: 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
  .title { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .name { font-size: 16px; font-weight: 650; margin: 0; }
  .version { color: var(--muted); font-size: 12px; }
  .tagline { margin: 0; color: var(--muted); }
  .tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .tag { border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; font-size: 12px; color: var(--muted); }
  .actions { display: flex; gap: 8px; margin-top: auto; padding-top: 6px; }
  .btn { flex: 1; border-radius: 10px; padding: 8px 10px; font: inherit; font-weight: 600; cursor: pointer;
    border: 1px solid var(--line); background: var(--bg); color: var(--text); }
  .btn.primary { background: var(--text); color: var(--bg); border-color: var(--text); }
  .btn:disabled { opacity: 0.45; cursor: default; }
  .empty { color: var(--muted); padding: 12px; }
</style>
</head>
<body>
<div id="app" class="empty">Chargement du catalogue...</div>
<script>
(function () {
  var nextId = 1;
  var pending = {};

  function post(message) { window.parent.postMessage(message, "*"); }
  function request(method, params) {
    var id = nextId++;
    post({ jsonrpc: "2.0", id: id, method: method, params: params || {} });
    return new Promise(function (resolve, reject) { pending[id] = { resolve: resolve, reject: reject }; });
  }
  function notify(method, params) { post({ jsonrpc: "2.0", method: method, params: params || {} }); }

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) return;
    var msg = event.data;
    if (!msg || msg.jsonrpc !== "2.0") return;
    if (msg.id != null && pending[msg.id] && (msg.result !== undefined || msg.error)) {
      var waiter = pending[msg.id];
      delete pending[msg.id];
      if (msg.error) waiter.reject(msg.error); else waiter.resolve(msg.result);
      return;
    }
    if (msg.method === "ui/notifications/tool-result") render((msg.params || {}).structuredContent);
    else if (msg.method === "ui/notifications/host-context-changed") applyHostContext(msg.params);
    else if (msg.id != null) post({ jsonrpc: "2.0", id: msg.id, result: {} });
  });

  function applyHostContext(context) {
    if (!context) return;
    if (context.theme) document.documentElement.classList.toggle("dark", context.theme === "dark");
    var vars = context.styles && context.styles.variables;
    if (vars) Object.keys(vars).forEach(function (name) {
      if (vars[name]) document.documentElement.style.setProperty(name, vars[name]);
    });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function render(data) {
    var app = document.getElementById("app");
    var themes = (data && data.themes) || [];
    app.className = themes.length ? "grid" : "empty";
    app.textContent = themes.length ? "" : "Aucun thème dans le catalogue pour l'instant.";
    themes.forEach(function (theme) { app.appendChild(card(theme)); });
  }

  function card(theme) {
    var root = el("article", "card");
    var media = el("div", "media");
    var accent = theme.accent || ["#e7e5e4", "#57534e"];
    var placeholder = el("div", "placeholder", theme.name);
    placeholder.style.background = "linear-gradient(135deg, " + accent[0] + ", " + accent[1] + ")";
    media.appendChild(placeholder);
    root.appendChild(media);

    var body = el("div", "body");
    var title = el("div", "title");
    title.appendChild(el("h3", "name", theme.name));
    title.appendChild(el("span", "version", "v" + theme.version));
    body.appendChild(title);
    if (theme.tagline) body.appendChild(el("p", "tagline", theme.tagline));
    var tags = el("div", "tags");
    (theme.bestFor || []).forEach(function (use) { tags.appendChild(el("span", "tag", use)); });
    body.appendChild(tags);

    var actions = el("div", "actions");
    var demo = el("button", "btn", "Voir la démo");
    if (theme.previewUrl) demo.onclick = function () { request("ui/open-link", { url: theme.previewUrl }); };
    else { demo.disabled = true; demo.title = "Pas encore de boutique de démonstration"; }
    var choose = el("button", "btn primary", "Choisir ce thème");
    choose.onclick = function () {
      choose.disabled = true;
      request("ui/message", {
        role: "user",
        content: [{ type: "text", text: "Je choisis le thème " + theme.name + " (" + theme.slug + ")." }],
      }).then(function () {
        // Claude ne l'envoie pas seul : il le place dans la zone de message, à valider par l'utilisateur.
        choose.textContent = "Valide le message dans Claude";
      }).catch(function () { choose.disabled = false; });
    };
    actions.appendChild(demo);
    actions.appendChild(choose);
    body.appendChild(actions);
    root.appendChild(body);

    request("tools/call", { name: "get_theme_screenshots", arguments: { theme: theme.slug } })
      .then(function (result) {
        var shots = (result && result.structuredContent && result.structuredContent.screenshots) || [];
        if (shots.length) carousel(media, shots);
      })
      .catch(function () {});
    return root;
  }

  function carousel(media, shots) {
    media.textContent = "";
    var track = el("div", "slides");
    shots.forEach(function (shot) {
      var slide = el("div", "slide");
      var img = el("img");
      img.src = shot.src;
      img.alt = shot.label;
      slide.appendChild(img);
      track.appendChild(slide);
    });
    media.appendChild(track);
    var caption = el("span", "caption");
    media.appendChild(caption);
    if (shots.length < 2) { caption.textContent = shots[0].label; return; }

    var index = 0;
    var prev = el("button", "nav prev", "‹");
    var next = el("button", "nav next", "›");
    prev.setAttribute("aria-label", "Capture précédente");
    next.setAttribute("aria-label", "Capture suivante");
    var dots = el("div", "dots");
    shots.forEach(function () { dots.appendChild(el("span", "dot")); });
    function go(to) {
      index = Math.max(0, Math.min(shots.length - 1, to));
      track.style.transform = "translateX(" + (-100 * index) + "%)";
      caption.textContent = shots[index].label;
      prev.disabled = index === 0;
      next.disabled = index === shots.length - 1;
      Array.prototype.forEach.call(dots.children, function (dot, i) { dot.classList.toggle("on", i === index); });
    }
    prev.onclick = function () { go(index - 1); };
    next.onclick = function () { go(index + 1); };
    media.appendChild(prev);
    media.appendChild(next);
    media.appendChild(dots);
    go(0);
  }

  var lastHeight = 0;
  function reportSize() {
    var height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (height === lastHeight) return;
    lastHeight = height;
    notify("ui/notifications/size-changed", { width: Math.ceil(window.innerWidth), height: height });
  }

  request("ui/initialize", {
    protocolVersion: "2026-01-26",
    appInfo: { name: "webuild-theme-catalog", version: "1.0.0" },
    appCapabilities: {},
  }).then(function (result) {
    applyHostContext(result && result.hostContext);
    notify("ui/notifications/initialized");
    if (window.ResizeObserver) new ResizeObserver(reportSize).observe(document.body);
    reportSize();
  });
})();
</script>
</body>
</html>`;
