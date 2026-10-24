/**
 * Premium animation behaviours that Dawn has no equivalent for: revealing
 * images as they finish decoding, and revealing headings one word or one line
 * at a time.
 *
 * Both are progressive enhancements. The hidden state is only ever applied by
 * this script, and the same script always removes it — including on decode
 * errors — so a blocked or failed script can never leave content invisible.
 */
(function () {
  'use strict';

  const body = document.body;
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------------------
     Image load reveal
     --------------------------------------------------------------------- */

  /* Images whose opacity or transform is already spoken for. The showcase
     card's second image in particular sits at opacity 0 by design and is
     driven by the hover crossfade — fading it in on load would make it show
     through the primary image. */
  const IMAGE_DENYLIST = [
    '.showcase-card__media-alt',
    '.header__heading-logo',
    '.cart-item__image',
    '.predictive-search__image',
    '.thumbnail__image',
    '.deferred-media__poster-button img',
    '.placeholder-svg',
  ].join(',');

  /* Content imagery only. Chrome, icons and thumbnails are left alone: they
     are small, usually cached, and animating them reads as jank rather than
     polish. */
  const IMAGE_SCOPE = [
    '.media img',
    '.card__media img',
    '.banner__media img',
    '.showcase-card__media img',
    '.collage__item img',
    '.image-with-text__media img',
    '.multicolumn-card__image-wrapper img',
  ].join(',');

  function skeletonTarget(img) {
    const parent = img.parentElement;
    if (!parent) return null;
    /* Only containers that already reserve space can host the shimmer —
       otherwise it would paint at zero height and never be seen. */
    return parent.classList.contains('media') || parent.classList.contains('showcase-card__media') ? parent : null;
  }

  function settle(img, skeleton) {
    img.classList.remove('img-reveal--pending');
    img.classList.add('img-reveal--done');
    if (skeleton) skeleton.classList.remove('img-skeleton');
    /* Once the entrance has played the compositing layer is dead weight. */
    img.addEventListener(
      'animationend',
      () => {
        img.classList.remove('img-reveal--done');
      },
      { once: true }
    );
  }

  function initImageReveal(root) {
    if (body.dataset.imgReveal === 'none' || REDUCED_MOTION.matches) return;

    const images = root.querySelectorAll(IMAGE_SCOPE);

    images.forEach((img) => {
      if (img.dataset.imgRevealBound) return;
      if (img.matches(IMAGE_DENYLIST) || img.closest(IMAGE_DENYLIST)) return;
      img.dataset.imgRevealBound = 'true';

      /* Already decoded — usually a cache hit or an eager hero image. Leaving
         it alone avoids a pointless flash on repeat visits. */
      if (img.complete && img.naturalWidth > 0) return;

      const skeleton = body.dataset.imgSkeleton === 'true' ? skeletonTarget(img) : null;

      img.classList.add('img-reveal--pending');
      if (skeleton) skeleton.classList.add('img-skeleton');

      const done = () => settle(img, skeleton);
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  }

  /* ---------------------------------------------------------------------
     Heading reveal, word by word or line by line
     --------------------------------------------------------------------- */

  const HEADING_SCOPE = [
    '.section__heading',
    '.banner__heading',
    '.rich-text__heading',
    '.title-wrapper h2',
    '.collection-hero__title',
    '.main-page-title',
  ].join(',');

  const MAX_SPLIT_LENGTH = 240;

  /**
   * Wraps every word found in the element's text nodes, at any depth, so
   * inline markup such as <em> or <strong> keeps both its styling and its
   * place in the reveal order.
   */
  function wrapWords(node, units) {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!child.textContent.trim()) return;

        const fragment = document.createDocumentFragment();
        /* Capturing the separators keeps the original spacing intact, which
           matters for screen readers reading the heading back. */
        child.textContent.split(/(\s+)/).forEach((token) => {
          if (!token) return;
          if (!token.trim()) {
            fragment.appendChild(document.createTextNode(token));
            return;
          }
          const outer = document.createElement('span');
          outer.className = 'anim-split';
          const inner = document.createElement('span');
          inner.className = 'anim-split__inner';
          inner.textContent = token;
          outer.appendChild(inner);
          fragment.appendChild(outer);
          units.push(outer);
        });
        node.replaceChild(fragment, child);
      } else if (child.nodeType === Node.ELEMENT_NODE && !child.classList.contains('anim-split')) {
        wrapWords(child, units);
      }
    });
  }

  /**
   * In "lines" mode every word sharing a visual row gets the same order index,
   * so the row animates as one. Reading offsetTop after wrapping is what makes
   * this reflect real wrapping rather than a guess at where lines break.
   */
  function assignOrder(units, mode) {
    if (mode === 'lines') {
      let line = -1;
      let lastTop = null;
      units.forEach((unit) => {
        const top = unit.offsetTop;
        if (lastTop === null || Math.abs(top - lastTop) > 2) {
          line += 1;
          lastTop = top;
        }
        unit.style.setProperty('--split-order', line);
      });
    } else {
      units.forEach((unit, index) => {
        unit.style.setProperty('--split-order', index);
      });
    }
  }

  function initHeadingReveal(root) {
    const mode = body.dataset.headingReveal;
    if (!mode || mode === 'none' || REDUCED_MOTION.matches) return;

    const headings = root.querySelectorAll(HEADING_SCOPE);
    const pending = [];

    headings.forEach((heading) => {
      if (heading.dataset.splitBound) return;
      const text = heading.textContent.trim();
      if (!text || text.length > MAX_SPLIT_LENGTH) return;
      heading.dataset.splitBound = 'true';

      const units = [];
      wrapWords(heading, units);
      if (!units.length) return;

      heading._animSplitUnits = units;
      assignOrder(units, mode);
      pending.push(heading);
    });

    if (!pending.length) return;

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          /* Re-measure at reveal time: fonts may have swapped in since the
             split ran, changing where the lines break. */
          assignOrder(entry.target._animSplitUnits || [], mode);
          entry.target.classList.add('anim-split-ready');
          obs.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -10% 0px' }
    );

    pending.forEach((heading) => observer.observe(heading));
  }

  /* ---------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */

  function init(root) {
    initImageReveal(root || document);
    initHeadingReveal(root || document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(document));
  } else {
    init(document);
  }

  /* Sections are re-rendered wholesale in the editor and by section rendering
     API calls (filtering, pagination), so newly injected images need binding. */
  document.addEventListener('shopify:section:load', (event) => init(event.target));

  let resizeTimer;
  window.addEventListener(
    'resize',
    () => {
      if (body.dataset.headingReveal !== 'lines') return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        document.querySelectorAll('.anim-split-ready').forEach((heading) => {
          assignOrder(heading._animSplitUnits || [], 'lines');
        });
      }, 200);
    },
    { passive: true }
  );
})();
