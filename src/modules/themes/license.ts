/**
 * Verrou de licence injecté dans chaque thème livré.
 *
 * Le thème est lié au domaine permanent `xxx.myshopify.com` de la boutique. La vérification se fait
 * entièrement dans le thème (aucun appel à Webuild), pour qu'une boutique livrée fonctionne à vie :
 * - en Liquid, côté serveur Shopify : `shop.permanent_domain` est comparé à l'empreinte attendue ;
 * - en JavaScript, en complément, à partir de `Shopify.shop`.
 * Sur une autre boutique, la vitrine est remplacée par un écran "thème non licencié".
 */

export type LicenseParams = {
  salt: string;
  hash: string;
  appOrigin: string;
};

const SNIPPET_NAME = "webuild-license";


function escapeLiquidString(value: string) {
  return value.replace(/'/g, "");
}

export function licenseSnippet({ salt, hash, appOrigin }: LicenseParams): string {
  const reversedHash = hash.split("").reverse().join("");
  const encodedSalt = Buffer.from(salt).toString("base64");
  const appUrl = escapeLiquidString(appOrigin);

  return `{%- comment -%}
  Licence Webuild : ce thème est livré pour une seule boutique Shopify.
  Le modifier ou le retirer est contraire aux conditions de la licence.
{%- endcomment -%}
{%- assign wb_actual = shop.permanent_domain | append: ':${escapeLiquidString(salt)}' | sha256 -%}
{%- if part == 'head' -%}
<script>
(function () {
  function block() {
    if (document.getElementById("wb-license")) return;
    document.documentElement.classList.add("wb-unlicensed");
    var el = document.createElement("div");
    el.id = "wb-license";
    el.innerHTML = '<div><p style="font-size:20px;font-weight:600;margin:0 0 12px">Thème non licencié</p>' +
      '<p style="margin:0">Ce thème n\\'est pas licencié pour cette boutique.</p></div>';
    document.body.appendChild(el);
  }
  function check() {
    var shop = window.Shopify && window.Shopify.shop;
    if (!shop || !window.crypto || !crypto.subtle || !window.TextEncoder) return;
    var data = new TextEncoder().encode(shop + ":" + atob("${encodedSalt}"));
    crypto.subtle.digest("SHA-256", data).then(function (buffer) {
      var hex = Array.prototype.map.call(new Uint8Array(buffer), function (b) {
        return ("0" + b.toString(16)).slice(-2);
      }).join("");
      if (hex !== "${reversedHash}".split("").reverse().join("")) block();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", check);
  else check();
})();
</script>
<style>
  html.wb-unlicensed body > *:not(#wb-license) { display: none !important; }
  #wb-license { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center;
    justify-content: center; padding: 24px; background: #fff; color: #111; text-align: center;
    font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  #wb-license a { color: inherit; }
</style>
{%- elsif part == 'body' -%}
  {%- if wb_actual != '${escapeLiquidString(hash)}' -%}
    <style>body > *:not(#wb-license) { display: none !important; }</style>
    <div id="wb-license">
      <div>
        <p style="font-size:20px;font-weight:600;margin:0 0 12px">Thème non licencié</p>
        {%- if request.design_mode -%}
          <p style="margin:0 0 8px">Ce thème Webuild a été livré pour une autre boutique.</p>
          <p style="margin:0">Pour l'utiliser ici, obtiens une licence sur <a href="${appUrl}">${appUrl}</a>.</p>
        {%- else -%}
          <p style="margin:0">Ce thème n'est pas licencié pour cette boutique.</p>
        {%- endif -%}
      </div>
    </div>
  {%- endif -%}
{%- endif -%}
`;
}

/** Ajoute les appels au verrou juste après <head> et <body> d'un layout. */
export function injectLicense(layout: string): string {
  return layout
    .replace(/<head(\s[^>]*)?>/i, (tag) => `${tag}\n    {% render '${SNIPPET_NAME}', part: 'head' %}`)
    .replace(/<body(\s[^>]*)?>/i, (tag) => `${tag}\n    {% render '${SNIPPET_NAME}', part: 'body' %}`);
}

export const LICENSE_SNIPPET_PATH = `snippets/${SNIPPET_NAME}.liquid`;
