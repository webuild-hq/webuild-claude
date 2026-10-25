/**
 * Interface MCP Apps de dépôt d'images (affichée par Claude sous l'appel à upload_client_images).
 * Claude ne peut pas transmettre à Shopify une image jointe à la conversation : l'utilisateur dépose donc ses
 * images ici. Le navigateur les envoie directement dans Supabase Storage avec un lien signé (outil
 * create_image_upload), ou, si l'hôte bloque cette connexion, par l'outil upload_client_image après
 * compression. "Utiliser ces images" propose à l'utilisateur un message pour Claude (ui/message, qu'il valide)
 * et met les URL publiques dans le contexte du modèle ; Claude les importe avec fileCreate. Protocole : https://modelcontextprotocol.io/docs/extensions/apps
 */
export const IMAGE_UPLOAD_URI = "ui://webuild/image-upload.html";

export const IMAGE_UPLOAD_HTML = /* html */ `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Images Webuild</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: var(--color-background-primary, #ffffff);
    --card: var(--color-background-secondary, #f6f5f4);
    --line: var(--color-border-primary, rgba(0, 0, 0, 0.1));
    --text: var(--color-text-primary, #1c1917);
    --muted: var(--color-text-secondary, #6b6460);
    --danger: #b42318;
    --radius: var(--border-radius-lg, 14px);
    --font: var(--font-sans, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif);
  }
  html.dark {
    --bg: var(--color-background-primary, #1f1e1d);
    --card: var(--color-background-secondary, #2a2927);
    --line: var(--color-border-primary, rgba(255, 255, 255, 0.12));
    --text: var(--color-text-primary, #f5f4f2);
    --muted: var(--color-text-secondary, #a8a29e);
    --danger: #f97066;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: transparent; }
  body { font-family: var(--font); color: var(--text); font-size: 14px; line-height: 1.45; padding: 4px; }
  .zone { border: 1.5px dashed var(--line); border-radius: var(--radius); background: var(--card); padding: 22px 16px;
    display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; transition: border-color 0.15s; }
  .zone.over { border-color: var(--text); }
  .zone.off { opacity: 0.55; pointer-events: none; }
  .zone strong { font-size: 15px; }
  .hint { color: var(--muted); font-size: 12px; margin: 0; }
  .btn { border-radius: 10px; padding: 8px 14px; font: inherit; font-weight: 600; cursor: pointer;
    border: 1px solid var(--line); background: var(--bg); color: var(--text); }
  .btn.primary { background: var(--text); color: var(--bg); border-color: var(--text); }
  .btn:disabled { opacity: 0.45; cursor: default; }
  .list { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); margin-top: 12px; }
  .item { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--card); }
  .thumb { aspect-ratio: 1; background: var(--line); }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .meta { padding: 6px 8px; font-size: 12px; }
  .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .status { color: var(--muted); }
  .status.error { color: var(--danger); }
  .footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
  .footer[hidden] { display: none; }
</style>
</head>
<body>
<div id="zone" class="zone off">
  <strong>Dépose tes images ici</strong>
  <p class="hint">Photos de marque, de produits ou de tes clients. JPG, PNG, WebP, GIF ou AVIF, 20 Mo au plus par image.</p>
  <button id="pick" class="btn" type="button">Choisir des images</button>
  <input id="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple hidden>
</div>
<div id="list" class="list"></div>
<div id="footer" class="footer" hidden>
  <span id="summary" class="hint"></span>
  <button id="send" class="btn primary" type="button" disabled>Utiliser ces images</button>
</div>
<script>
(function () {
  var TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
  var MAX_BYTES = 20 * 1024 * 1024;
  // Corps d'une requête Vercel : 4,5 Mo au plus, base64 compris.
  var FALLBACK_MAX_BYTES = 3 * 1024 * 1024;
  var nextId = 1;
  var pending = {};
  var agency = null;
  var items = [];

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
    if (msg.method === "ui/notifications/tool-result") ready((msg.params || {}).structuredContent);
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

  var zone = document.getElementById("zone");
  var input = document.getElementById("input");
  var list = document.getElementById("list");
  var footer = document.getElementById("footer");
  var summary = document.getElementById("summary");
  var send = document.getElementById("send");

  function ready(data) {
    if (!data || !data.agency) return;
    agency = data.agency;
    zone.classList.remove("off");
  }

  document.getElementById("pick").onclick = function () { input.click(); };
  input.onchange = function () { addFiles(input.files); input.value = ""; };
  zone.addEventListener("dragover", function (event) { event.preventDefault(); zone.classList.add("over"); });
  zone.addEventListener("dragleave", function () { zone.classList.remove("over"); });
  zone.addEventListener("drop", function (event) {
    event.preventDefault();
    zone.classList.remove("over");
    if (agency) addFiles(event.dataTransfer && event.dataTransfer.files);
  });

  function addFiles(files) {
    Array.prototype.forEach.call(files || [], function (file) {
      var item = { file: file, image: null, node: el("div", "item") };
      var thumb = el("div", "thumb");
      var meta = el("div", "meta");
      meta.appendChild(el("div", "name", file.name));
      item.status = el("div", "status", "Envoi...");
      meta.appendChild(item.status);
      item.node.appendChild(thumb);
      item.node.appendChild(meta);
      list.appendChild(item.node);
      items.push(item);
      preview(file).then(function (src) {
        if (!src) return;
        var img = el("img");
        img.src = src;
        img.alt = file.name;
        thumb.appendChild(img);
      });
      upload(item);
    });
    refresh();
  }

  function setStatus(item, text, isError) {
    item.status.textContent = text;
    item.status.className = "status" + (isError ? " error" : "");
    refresh();
  }

  function refresh() {
    var done = items.filter(function (item) { return item.image; }).length;
    var busy = items.filter(function (item) { return !item.image && !item.failed; }).length;
    footer.hidden = items.length === 0;
    summary.textContent = done + " image(s) prête(s)" + (busy ? ", " + busy + " en cours" : "");
    if (!send.dataset.sent) send.disabled = done === 0 || busy > 0;
  }

  function upload(item) {
    var file = item.file;
    if (TYPES.indexOf(file.type) === -1) return fail(item, "Format non accepté");
    if (file.size > MAX_BYTES) return fail(item, "Plus de 20 Mo");
    request("tools/call", {
      name: "create_image_upload",
      arguments: { agency: agency, name: file.name, content_type: file.type, size: file.size },
    })
      .then(function (result) {
        var data = toolData(result);
        var body = new FormData();
        body.append("cacheControl", "3600");
        body.append("", file);
        return fetch(data.uploadUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: body })
          .then(function (response) {
            if (!response.ok) throw new Error("upload " + response.status);
            return data.image;
          })
          // Connexion directe bloquée par l'hôte ou refusée : on passe par le serveur.
          .catch(function () { return uploadThroughServer(file); });
      })
      .then(function (image) { item.image = image; setStatus(item, "Prête"); })
      .catch(function (error) { fail(item, (error && error.message) || "Échec de l'envoi"); });
  }

  function fail(item, message) {
    item.failed = true;
    setStatus(item, message, true);
  }

  function toolData(result) {
    if (!result || result.isError) {
      var text = result && result.content && result.content[0] && result.content[0].text;
      throw new Error(text || "Échec de l'envoi");
    }
    return result.structuredContent || {};
  }

  // Secours : l'image passe par le serveur Webuild, compressée pour tenir dans une requête.
  function uploadThroughServer(file) {
    return encode(file).then(function (encoded) {
      return request("tools/call", {
        name: "upload_client_image",
        arguments: { agency: agency, name: file.name, content_type: encoded.type, data: encoded.data },
      });
    }).then(function (result) { return toolData(result).image; });
  }

  function encode(file) {
    if (file.size <= FALLBACK_MAX_BYTES) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve({ type: file.type, data: String(reader.result).split(",")[1] }); };
        reader.onerror = function () { reject(new Error("Lecture impossible")); };
        reader.readAsDataURL(file);
      });
    }
    return draw(file, 2400).then(function (canvas) {
      var quality = 0.85;
      var url = canvas.toDataURL("image/jpeg", quality);
      while (url.length * 0.75 > FALLBACK_MAX_BYTES && quality > 0.45) {
        quality -= 0.1;
        url = canvas.toDataURL("image/jpeg", quality);
      }
      return { type: "image/jpeg", data: url.split(",")[1] };
    });
  }

  function draw(file, maxSide) {
    return createImageBitmap(file).then(function (bitmap) {
      var scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas;
    });
  }

  // Vignette en data URL : ne dépend pas de la politique de sécurité de l'hôte pour les images.
  function preview(file) {
    return draw(file, 240).then(function (canvas) { return canvas.toDataURL("image/jpeg", 0.8); }).catch(function () { return null; });
  }

  send.onclick = function () {
    var done = items.filter(function (item) { return item.image; });
    if (!done.length) return;
    send.disabled = true;
    send.dataset.sent = "1";
    var names = done.map(function (item) { return item.image.filename; });
    var links = done.map(function (item) { return "- " + item.image.filename + " : " + item.image.url; });
    // Les URL vont dans le contexte du modèle quand l'hôte le permet ; le message reste court, car Claude le
    // propose à l'utilisateur avec un avertissement avant envoi. Sans ce contexte, list_client_images les retrouve.
    request("ui/update-model-context", {
      content: [{ type: "text", text: "Images déposées par l'utilisateur dans Webuild :\\n" + links.join("\\n") }],
    }).catch(function () {});
    request("ui/message", {
      role: "user",
      content: [{
        type: "text",
        text: "J'ai déposé " + names.length + " image(s) dans Webuild (" + names.join(", ") + "). Utilise-les dans la boutique.",
      }],
    }).then(function () {
      send.textContent = "Valide le message dans Claude";
      summary.textContent = "Appuie sur Entrée dans la zone de message de Claude pour lui transmettre les images.";
    }).catch(function () { delete send.dataset.sent; refresh(); });
  };

  var lastHeight = 0;
  function reportSize() {
    var height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (height === lastHeight) return;
    lastHeight = height;
    notify("ui/notifications/size-changed", { width: Math.ceil(window.innerWidth), height: height });
  }

  request("ui/initialize", {
    protocolVersion: "2026-01-26",
    appInfo: { name: "webuild-image-upload", version: "1.0.0" },
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
