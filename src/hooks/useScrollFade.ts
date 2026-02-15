'use client';

import { useCallback, useEffect, useState } from 'react';

const SELECTOR =
  '.scroll-fade, .scroll-fade-left, .scroll-fade-right, .scroll-fade-scale';

/**
 * Reusable IntersectionObserver hook for scroll-triggered fade-in animations.
 * Add className="scroll-fade" to any child element to animate it on scroll.
 *
 * Optional per-element delay: add `data-delay="100"` (ms) for staggered entries.
 *
 * Uses a callback ref so it works correctly with conditionally-rendered containers
 * (e.g. after an auth check) and a MutationObserver for dynamically added children.
 */
export function useScrollFade<T extends HTMLElement = HTMLDivElement>() {
  const [node, setNode] = useState<T | null>(null);

  // Callback ref — works even when the element mounts later
  const ref = useCallback((el: T | null) => setNode(el), []);

  useEffect(() => {
    if (!node) return;

    const reveal = (target: Element) => {
      const delay = target.getAttribute('data-delay');
      if (delay) {
        setTimeout(() => target.classList.add('scroll-visible'), parseInt(delay, 10));
      } else {
        target.classList.add('scroll-visible');
      }
    };

    const observed = new WeakSet<Element>();

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.01, rootMargin: '0px 0px 0px 0px' }
    );

    /** Observe any new .scroll-fade children that haven't been observed yet */
    function observeAll() {
      if (!node) return;
      node.querySelectorAll(SELECTOR).forEach((child) => {
        if (!observed.has(child) && !child.classList.contains('scroll-visible')) {
          observed.add(child);
          io.observe(child);
        }
      });
    }

    observeAll();

    // Watch for dynamically added scroll-fade elements (e.g. after state change)
    const mo = new MutationObserver(() => observeAll());
    mo.observe(node, { childList: true, subtree: true });

    // Fallback: force-reveal any still-hidden elements after 800ms
    const fallbackTimer = setTimeout(() => {
      node.querySelectorAll(SELECTOR).forEach((child) => {
        if (!child.classList.contains('scroll-visible')) {
          reveal(child);
        }
      });
    }, 800);

    return () => {
      clearTimeout(fallbackTimer);
      io.disconnect();
      mo.disconnect();
    };
  }, [node]);

  return ref;
}
