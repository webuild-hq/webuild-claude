/**
 * Dual-handle price slider that drives the two number inputs Dawn already
 * renders, then submits the facet form the same way typing in them does.
 */
class PriceRangeSlider extends HTMLElement {
  constructor() {
    super();

    this.minSlider = this.querySelector('[data-slider-min]');
    this.maxSlider = this.querySelector('[data-slider-max]');
    this.fill = this.querySelector('[data-slider-fill]');
    this.minInput = document.getElementById(this.dataset.minInput);
    this.maxInput = document.getElementById(this.dataset.maxInput);
    this.max = parseFloat(this.dataset.max) || 0;

    if (!this.minSlider || !this.maxSlider || !this.minInput || !this.maxInput || this.max <= 0) return;

    this.minSlider.addEventListener('input', this.onSlide.bind(this, 'min'));
    this.maxSlider.addEventListener('input', this.onSlide.bind(this, 'max'));

    // Committing on change (not input) avoids one request per pixel dragged.
    this.minSlider.addEventListener('change', this.commit.bind(this));
    this.maxSlider.addEventListener('change', this.commit.bind(this));

    // Keep the handles in sync when the merchant types in the fields instead.
    this.minInput.addEventListener('change', this.syncFromInputs.bind(this));
    this.maxInput.addEventListener('change', this.syncFromInputs.bind(this));

    this.paint();
  }

  onSlide(which) {
    let min = parseFloat(this.minSlider.value);
    let max = parseFloat(this.maxSlider.value);

    // Handles must never cross over each other.
    if (min > max) {
      if (which === 'min') {
        min = max;
        this.minSlider.value = min;
      } else {
        max = min;
        this.maxSlider.value = max;
      }
    }

    this.minInput.value = min > 0 ? min : '';
    this.maxInput.value = max < this.max ? max : '';
    this.paint();
  }

  syncFromInputs() {
    const min = parseFloat(this.minInput.value);
    const max = parseFloat(this.maxInput.value);
    this.minSlider.value = Number.isNaN(min) ? 0 : min;
    this.maxSlider.value = Number.isNaN(max) ? this.max : max;
    this.paint();
  }

  paint() {
    const min = parseFloat(this.minSlider.value);
    const max = parseFloat(this.maxSlider.value);
    if (!this.fill) return;
    this.fill.style.left = `${(min / this.max) * 100}%`;
    this.fill.style.width = `${((max - min) / this.max) * 100}%`;
  }

  commit() {
    // Reuses Dawn's own facet handling rather than re-implementing it.
    this.minInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

customElements.define('price-range-slider', PriceRangeSlider);
