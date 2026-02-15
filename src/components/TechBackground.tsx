'use client';

import { useEffect, useRef, useCallback } from 'react';

/* ── Types ── */
interface Node {
  x: number;
  y: number;
  r: number;
  dx: number;
  dy: number;
  pulse: number;
  pulseSpeed: number;
}

interface DataStream {
  x: number;
  y: number;
  len: number;
  speed: number;
  opacity: number;
  color: string;
}

/* ── TechBackground Component ── */
export default function TechBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const stateRef = useRef<{
    nodes: Node[];
    streams: DataStream[];
    time: number;
    w: number;
    h: number;
    mouse: { x: number; y: number };
  }>({
    nodes: [],
    streams: [],
    time: 0,
    w: 0,
    h: 0,
    mouse: { x: -1000, y: -1000 },
  });

  const GRID_SIZE = 60;
  const NODE_COUNT = 22;
  const STREAM_COUNT = 15;
  const MAX_DIST = 280;

  const colors = {
    purple: 'rgba(108, 92, 231,',
    cyan: 'rgba(0, 206, 201,',
    blue: 'rgba(99, 102, 241,',
    white: 'rgba(255, 255, 255,',
  };

  /* ── Initialize all elements ── */
  const initElements = useCallback((w: number, h: number) => {
    const nodes: Node[] = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 2 + Math.random() * 3,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.02 + Math.random() * 0.03,
    }));

    const streams: DataStream[] = Array.from({ length: STREAM_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      len: 40 + Math.random() * 120,
      speed: 1 + Math.random() * 2.5,
      opacity: 0.03 + Math.random() * 0.08,
      color: Math.random() > 0.5 ? colors.purple : colors.cyan,
    }));

    return { nodes, streams };
  }, []);

  /* ── Draw grid pattern ── */
  const drawGrid = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, time: number) => {
      ctx.strokeStyle = `rgba(108, 92, 231, 0.04)`;
      ctx.lineWidth = 0.5;

      // Vertical lines
      for (let x = 0; x <= w; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      // Horizontal lines
      for (let y = 0; y <= h; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    },
    []
  );

  /* ── Draw data streams (vertical rain effect) ── */
  const drawStreams = useCallback(
    (ctx: CanvasRenderingContext2D, streams: DataStream[], h: number) => {
      for (const s of streams) {
        s.y += s.speed;
        if (s.y - s.len > h) {
          s.y = -s.len;
          s.x = Math.random() * ctx.canvas.width;
        }

        const grad = ctx.createLinearGradient(s.x, s.y - s.len, s.x, s.y);
        grad.addColorStop(0, `${s.color}0)`);
        grad.addColorStop(0.5, `${s.color}${s.opacity.toFixed(3)})`);
        grad.addColorStop(1, `${s.color}${(s.opacity * 0.3).toFixed(3)})`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - s.len);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        // Bright dot at the head
        ctx.fillStyle = `${s.color}${(s.opacity * 5).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    []
  );

  /* ── Draw nodes and connections ── */
  const drawNodes = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      nodes: Node[],
      w: number,
      h: number,
      mouse: { x: number; y: number }
    ) => {
      // Update positions
      for (const n of nodes) {
        n.x += n.dx;
        n.y += n.dy;
        n.pulse += n.pulseSpeed;
        if (n.x < 0 || n.x > w) n.dx *= -1;
        if (n.y < 0 || n.y > h) n.dy *= -1;

        // Mouse repulsion
        const mdx = n.x - mouse.x;
        const mdy = n.y - mouse.y;
        const mdist = Math.hypot(mdx, mdy);
        if (mdist < 150 && mdist > 0) {
          n.x += (mdx / mdist) * 0.8;
          n.y += (mdy / mdist) * 0.8;
        }
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.15;
            const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
            grad.addColorStop(0, `${colors.purple}${alpha.toFixed(3)})`);
            grad.addColorStop(1, `${colors.cyan}${alpha.toFixed(3)})`);
            ctx.strokeStyle = grad;
            ctx.lineWidth = (1 - dist / MAX_DIST) * 1.2;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        const pulseFactor = 0.7 + Math.sin(n.pulse) * 0.3;
        const r = n.r * pulseFactor;

        // Outer glow
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 6);
        glow.addColorStop(0, `${colors.cyan}0.12)`);
        glow.addColorStop(1, `${colors.purple}0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 6, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.fillStyle = `${colors.cyan}${(0.6 + pulseFactor * 0.4).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    []
  );

  /* ── Draw corner HUD brackets ── */
  const drawHUD = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, time: number) => {
      const bracketSize = 40;
      const margin = 30;
      const alpha = 0.08 + Math.sin(time * 0.002) * 0.03;

      ctx.strokeStyle = `${colors.cyan}${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.5;

      // Top-left
      ctx.beginPath();
      ctx.moveTo(margin, margin + bracketSize);
      ctx.lineTo(margin, margin);
      ctx.lineTo(margin + bracketSize, margin);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(w - margin - bracketSize, margin);
      ctx.lineTo(w - margin, margin);
      ctx.lineTo(w - margin, margin + bracketSize);
      ctx.stroke();

      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(margin, h - margin - bracketSize);
      ctx.lineTo(margin, h - margin);
      ctx.lineTo(margin + bracketSize, h - margin);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(w - margin - bracketSize, h - margin);
      ctx.lineTo(w - margin, h - margin);
      ctx.lineTo(w - margin, h - margin - bracketSize);
      ctx.stroke();
    },
    []
  );

  /* ── Main animation loop ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      state.w = window.innerWidth;
      state.h = window.innerHeight;
      canvas.width = state.w * dpr;
      canvas.height = state.h * dpr;
      canvas.style.width = state.w + 'px';
      canvas.style.height = state.h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { nodes, streams } = initElements(state.w, state.h);
      state.nodes = nodes;
      state.streams = streams;
    };

    const onMouseMove = (e: MouseEvent) => {
      state.mouse.x = e.clientX;
      state.mouse.y = e.clientY;
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);

    const tick = (now: number) => {
      state.time = now;
      ctx.clearRect(0, 0, state.w, state.h);
      drawGrid(ctx, state.w, state.h, now);
      drawStreams(ctx, state.streams, state.h);
      drawNodes(ctx, state.nodes, state.w, state.h, state.mouse);
      drawHUD(ctx, state.w, state.h, now);
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(animRef.current);
    };
  }, [initElements, drawGrid, drawStreams, drawNodes, drawHUD]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 1 }}
      aria-hidden="true"
    />
  );
}
