/**
 * Section scrolling for the landing page.
 *
 * The nav links are real anchors, so they work with no JavaScript at all. When
 * JavaScript is present the scroll is smooth, unless the visitor has asked for
 * reduced motion, in which case it jumps straight there.
 */

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Scrolls a landing section into view. Returns false when there is no target. */
export function scrollToLandingSection(id: string): boolean {
  if (typeof document === 'undefined') return false;
  const target = document.getElementById(id);
  if (!target) return false;
  target.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  });
  return true;
}

/** The click handler for a landing nav anchor. */
export function landingNavClickHandler(id: string) {
  return (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;
    if (!scrollToLandingSection(id)) return;
    event.preventDefault();
  };
}

/**
 * The fragment every back to top anchor uses.
 *
 * `#top` is the one fragment browsers understand on their own: when no element
 * carries that id they scroll to the top of the document. So the footer links
 * work with no JavaScript at all, exactly like the nav anchors.
 */
export const LANDING_TOP_FRAGMENT = '#top';

/** Scrolls to the top of the page. Returns false where there is no window. */
export function scrollToLandingTop(): boolean {
  if (typeof window === 'undefined') return false;
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
  return true;
}

/** The click handler for a back to top anchor. */
export function landingTopClickHandler() {
  return (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;
    if (!scrollToLandingTop()) return;
    event.preventDefault();
  };
}
