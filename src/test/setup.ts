import '@testing-library/jest-dom/vitest';

// JSDOM has no native top layer. Browser tests must verify actual modal inertness.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ??= function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function () {
    this.open = false;
  };
}
