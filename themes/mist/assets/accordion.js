/**
 * Accordion behaviour, shared by any section that needs disclosure rows.
 *
 * Progressive enhancement over native <details>: without this script the
 * accordion still opens and closes, it just does so instantly. Everything here
 * is layered on top — height animation, single-open mode, search and deep
 * links — and each piece is opt-in through data attributes written by the
 * section, so a merchant who turns a feature off pays nothing for it.
 *
 * Deliberately class-agnostic: rows are :scope > details and the animated panel
 * is marked with [data-accordion-panel], so any section can reuse it with its
 * own BEM names and no CSS bleeds between them.
 */
class AccordionRows extends HTMLElement {
  connectedCallback() {
    this.items = Array.from(this.querySelectorAll(':scope > details'));
    if (!this.items.length) return;

    this.singleOpen = this.dataset.singleOpen === 'true';
    this.speed = parseInt(this.dataset.speed, 10) || 300;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.items.forEach((item) => this.bindItem(item));

    this.initSearch();
    this.initDeepLink();
  }

  bindItem(item) {
    const summary = item.querySelector(':scope > summary');
    const wrap = item.querySelector(':scope > [data-accordion-panel]');
    if (!summary || !wrap) return;

    summary.addEventListener('click', (event) => {
      // The native toggle would jump straight to the end state, so it is taken
      // over here and the open attribute is set manually around the animation.
      event.preventDefault();
      if (item.open) {
        this.close(item, wrap);
      } else {
        this.open(item, wrap);
      }
    });

    // An item rendered open by the merchant must not start at height 0.
    if (item.open) wrap.style.height = 'auto';
  }

  open(item, wrap) {
    if (this.singleOpen) {
      this.items.forEach((other) => {
        if (other === item || !other.open) return;
        const otherWrap = other.querySelector(':scope > [data-accordion-panel]');
        if (otherWrap) this.close(other, otherWrap);
      });
    }

    item.open = true;

    if (this.reduceMotion) {
      wrap.style.height = 'auto';
      return;
    }

    const target = wrap.scrollHeight;
    wrap.style.height = '0px';
    // Forces the browser to register the start height before the transition,
    // otherwise both values land in the same frame and nothing animates.
    wrap.offsetHeight;
    wrap.style.transition = `height ${this.speed}ms ease`;
    wrap.style.height = `${target}px`;

    this.afterTransition(wrap, () => {
      // Back to auto so the panel can still reflow if its content changes.
      wrap.style.height = 'auto';
      wrap.style.transition = '';
    });
  }

  close(item, wrap) {
    if (this.reduceMotion) {
      item.open = false;
      wrap.style.height = '';
      return;
    }

    wrap.style.height = `${wrap.scrollHeight}px`;
    wrap.offsetHeight;
    wrap.style.transition = `height ${this.speed}ms ease`;
    wrap.style.height = '0px';

    this.afterTransition(wrap, () => {
      // The attribute is only dropped once the panel has finished collapsing,
      // which is the whole reason the native toggle is intercepted.
      item.open = false;
      wrap.style.height = '';
      wrap.style.transition = '';
    });
  }

  /** Runs once, whether or not the transition actually fires. */
  afterTransition(wrap, done) {
    if (wrap._faqTimer) clearTimeout(wrap._faqTimer);
    if (wrap._faqHandler) wrap.removeEventListener('transitionend', wrap._faqHandler);

    const finish = () => {
      clearTimeout(wrap._faqTimer);
      wrap.removeEventListener('transitionend', wrap._faqHandler);
      wrap._faqHandler = null;
      wrap._faqTimer = null;
      done();
    };

    wrap._faqHandler = (event) => {
      if (event.target === wrap && event.propertyName === 'height') finish();
    };
    wrap.addEventListener('transitionend', wrap._faqHandler);
    // Safety net: transitionend never fires if the panel is hidden mid-animation.
    wrap._faqTimer = setTimeout(finish, this.speed + 60);
  }

  initSearch() {
    const input = this.querySelector('[data-accordion-search]');
    if (!input) return;
    const empty = this.querySelector('[data-accordion-empty]');

    input.addEventListener('input', () => {
      const term = input.value.trim().toLowerCase();
      let matches = 0;

      this.items.forEach((item) => {
        const hit = !term || (item.textContent || '').toLowerCase().includes(term);
        item.classList.toggle('is-filtered', !hit);
        if (hit) matches += 1;
      });

      if (empty) empty.hidden = matches !== 0;
    });
  }

  /**
   * Opens and scrolls to the question named in the URL fragment, so a support
   * reply can link straight to a specific answer.
   */
  initDeepLink() {
    if (this.dataset.deepLinks !== 'true') return;

    const reveal = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash) return;

      const item = this.items.find((el) => el.id === hash);
      if (!item) return;

      const wrap = item.querySelector(':scope > [data-accordion-panel]');
      if (wrap && !item.open) this.open(item, wrap);
      item.scrollIntoView({ behavior: this.reduceMotion ? 'auto' : 'smooth', block: 'center' });
    };

    reveal();
    window.addEventListener('hashchange', reveal);
  }
}

customElements.define('accordion-rows', AccordionRows);
