'use client';

import { useRef, useCallback, useEffect, useState, type ReactNode, Children } from 'react';

interface MobileCarouselProps {
  children: ReactNode;
  /** Auto-scroll interval in ms (default 3000) */
  interval?: number;
  /** Extra classes on the scroll container */
  className?: string;
  /** Gap between cards in px (default 16) */
  gap?: number;
  /** How much of the next card to peek in px (default 40) */
  peek?: number;
}

export default function MobileCarousel({ children, interval = 3000, className = '', gap = 16, peek = 40 }: MobileCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIndex = useRef(0);
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const childArray = Children.toArray(children);
  const childCount = childArray.length;
  const [cardWidth, setCardWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  /* Measure container and compute card width */
  useEffect(() => {
    const measure = () => {
      const c = scrollRef.current;
      if (!c) return;
      // Card width = container width - peek space
      setCardWidth(c.offsetWidth - peek);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [peek]);

  const scrollToCard = useCallback((idx: number, behavior: ScrollBehavior = 'smooth') => {
    const c = scrollRef.current;
    if (!c || !c.children[idx]) return;
    const card = c.children[idx] as HTMLElement;
    c.scrollTo({ left: card.offsetLeft - (c.offsetWidth - card.offsetWidth) / 2, behavior });
  }, []);

  const syncIndex = useCallback(() => {
    const c = scrollRef.current;
    if (!c) return;
    const center = c.scrollLeft + c.offsetWidth / 2;
    let best = 0, minD = Infinity;
    for (let i = 0; i < c.children.length; i++) {
      const el = c.children[i] as HTMLElement;
      const d = Math.abs(center - (el.offsetLeft + el.offsetWidth / 2));
      if (d < minD) { minD = d; best = i; }
    }
    currentIndex.current = best;
    setActiveIndex(best);
  }, []);

  const startAutoScroll = useCallback(() => {
    if (childCount <= 1) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (isDragging.current) return;
      const wasLast = currentIndex.current === childCount - 1;
      currentIndex.current = (currentIndex.current + 1) % childCount;
      setActiveIndex(currentIndex.current);
      scrollToCard(currentIndex.current, wasLast ? 'instant' : 'smooth');
    }, interval);
  }, [scrollToCard, interval, childCount]);

  const stopAutoScroll = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const scheduleRestart = useCallback(() => {
    if (restartRef.current) clearTimeout(restartRef.current);
    restartRef.current = setTimeout(startAutoScroll, 3000);
  }, [startAutoScroll]);

  /* Touch */
  const onTouchStart = useCallback(() => stopAutoScroll(), [stopAutoScroll]);
  const onTouchEnd = useCallback(() => { syncIndex(); scheduleRestart(); }, [syncIndex, scheduleRestart]);

  /* Mouse drag */
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const c = scrollRef.current;
    if (!c) return;
    isDragging.current = true;
    hasDragged.current = false;
    dragStartX.current = e.pageX - c.offsetLeft;
    dragScrollLeft.current = c.scrollLeft;
    c.style.cursor = 'grabbing';
    c.style.scrollSnapType = 'none';
    stopAutoScroll();
  }, [stopAutoScroll]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const c = scrollRef.current;
    if (!c) return;
    const walk = ((e.pageX - c.offsetLeft) - dragStartX.current) * 1.5;
    if (Math.abs(walk) > 5) hasDragged.current = true;
    c.scrollLeft = dragScrollLeft.current - walk;
  }, []);

  const onMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const c = scrollRef.current;
    if (c) { c.style.cursor = 'grab'; c.style.scrollSnapType = 'x mandatory'; }
    syncIndex();
    scheduleRestart();
  }, [syncIndex, scheduleRestart]);

  const onMouseLeave = useCallback(() => { if (isDragging.current) onMouseUp(); }, [onMouseUp]);

  /* Click to snap a partially visible card into view */
  const onClick = useCallback((e: React.MouseEvent) => {
    if (hasDragged.current) return;
    const c = scrollRef.current;
    if (!c) return;
    const idx = Array.from(c.children).findIndex(ch => ch.contains(e.target as Node));
    if (idx >= 0 && idx !== currentIndex.current) {
      scrollToCard(idx);
      currentIndex.current = idx;
      setActiveIndex(idx);
      stopAutoScroll();
      scheduleRestart();
    }
  }, [scrollToCard, stopAutoScroll, scheduleRestart]);

  /* Wheel → horizontal scroll (native listener to allow preventDefault) */
  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    const h = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      c.scrollLeft += e.deltaY;
      stopAutoScroll();
      syncIndex();
      scheduleRestart();
    };
    c.addEventListener('wheel', h, { passive: false });
    return () => c.removeEventListener('wheel', h);
  }, [stopAutoScroll, syncIndex, scheduleRestart]);

  /* Auto-scroll only on mobile (< 640px) */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = () => {
      if (mq.matches) { currentIndex.current = 0; startAutoScroll(); }
      else stopAutoScroll();
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
      stopAutoScroll();
      if (restartRef.current) clearTimeout(restartRef.current);
    };
  }, [startAutoScroll, stopAutoScroll]);

  /* Dot indicator click */
  const onDotClick = useCallback((idx: number) => {
    scrollToCard(idx);
    currentIndex.current = idx;
    setActiveIndex(idx);
    stopAutoScroll();
    scheduleRestart();
  }, [scrollToCard, stopAutoScroll, scheduleRestart]);

  /* Also sync on native scroll end (for touch swipe) */
  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    let timeout: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        syncIndex();
      }, 100);
    };
    c.addEventListener('scroll', onScroll, { passive: true });
    return () => { c.removeEventListener('scroll', onScroll); clearTimeout(timeout); };
  }, [syncIndex]);

  return (
    <div className="flex flex-col">
      <div
        ref={scrollRef}
        className={`flex overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 select-none ${className}`}
        style={{ WebkitOverflowScrolling: 'touch', cursor: 'grab', gap: `${gap}px` } as React.CSSProperties}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
        {cardWidth > 0 && childArray.map((child, i) => (
          <div
            key={i}
            className="snap-center shrink-0"
            style={{ width: cardWidth, minWidth: cardWidth }}
          >
            {child}
          </div>
        ))}
      </div>

      {/* Dot indicators (mobile only) */}
      {childCount > 1 && (
        <div className="flex sm:hidden items-center justify-center gap-1.5 pt-3 pb-1">
          {childArray.map((_, i) => (
            <button
              key={i}
              aria-label={`Slide ${i + 1}`}
              onClick={() => onDotClick(i)}
              className={`rounded-full transition-all duration-300 ${
                activeIndex === i
                  ? 'w-6 h-2 bg-purple-500'
                  : 'w-2 h-2 bg-gray-600 hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
