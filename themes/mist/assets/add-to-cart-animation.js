/**
 * Add-to-cart feedback: a clone of the product image flies to the cart icon,
 * then the icon reacts.
 *
 * Dawn broadcasts cart activity through its own pub/sub module rather than DOM
 * events, so this hooks subscribe(PUB_SUB_EVENTS.cartUpdate) — a
 * document.addEventListener('cart-update') would never fire. Requires
 * constants.js and pubsub.js to have loaded first.
 *
 * Purely decorative: it never touches the request, so a failure here cannot
 * block an add. The clone is fixed-position and pointer-events:none, so it can
 * neither intercept clicks nor shift layout while in flight.
 */
(function () {
  'use strict';

  if (typeof subscribe !== 'function' || typeof PUB_SUB_EVENTS === 'undefined') return;

  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
  let lastTrigger = null;

  function cartTarget() {
    return (
      document.querySelector('#cart-icon-bubble') ||
      document.querySelector('.header__icon--cart') ||
      document.querySelector('[href$="/cart"]')
    );
  }

  /** The image nearest the pressed button, so the right one flies. */
  function sourceImage(trigger) {
    const scopes = [
      trigger && trigger.closest('.cart-upsell__item'),
      trigger && trigger.closest('.card-wrapper'),
      trigger && trigger.closest('.grid__item'),
      trigger && trigger.closest('.product'),
      document,
    ];

    for (const scope of scopes) {
      if (!scope) continue;
      const img = scope.querySelector(
        '.cart-upsell__media img, .product__media img, .showcase-card__media img, .card__media img, img'
      );
      if (img && img.getBoundingClientRect().width > 0) return img;
    }
    return null;
  }

  function pulse(target) {
    if (!target) return;
    target.classList.remove('cart-icon--bump');
    // Reading offsetWidth restarts the animation when adds land back to back.
    target.offsetWidth;
    target.classList.add('cart-icon--bump');
    target.addEventListener('animationend', () => target.classList.remove('cart-icon--bump'), { once: true });
  }

  function fly(trigger) {
    const target = cartTarget();
    if (!target) return;

    const img = REDUCED_MOTION.matches ? null : sourceImage(trigger);
    if (!img) {
      pulse(target);
      return;
    }

    const from = img.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    if (!from.width || !to.width) {
      pulse(target);
      return;
    }

    const clone = document.createElement('img');
    clone.src = img.currentSrc || img.src;
    clone.className = 'cart-fly';
    clone.setAttribute('aria-hidden', 'true');
    clone.style.left = `${from.left}px`;
    clone.style.top = `${from.top}px`;
    clone.style.width = `${from.width}px`;
    clone.style.height = `${from.height}px`;
    document.body.appendChild(clone);

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);

    const animation = clone.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
        // Lifts before travelling so the path arcs, rather than cutting a flat
        // diagonal across the page.
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(0.6)`, opacity: 0.9, offset: 0.6 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.15)`, opacity: 0, offset: 1 },
      ],
      { duration: 750, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
    );

    animation.onfinish = () => {
      clone.remove();
      pulse(target);
    };
    // Never leave an orphan clone if the animation is interrupted.
    animation.oncancel = () => clone.remove();
  }

  // Captured, so the button is recorded before the response replaces the markup.
  document.addEventListener(
    'click',
    (event) => {
      const button = event.target.closest('[name="add"], .cart-upsell__button');
      if (button) lastTrigger = button;
    },
    true
  );

  subscribe(PUB_SUB_EVENTS.cartUpdate, (data) => {
    // Quantity changes inside the cart republish the same event; only a genuine
    // add should fly.
    if (!data || data.source !== 'product-form') return;
    fly(lastTrigger);
    lastTrigger = null;
  });
})();
