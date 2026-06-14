import React, { useRef, useEffect } from 'react';
import { useTheme } from './ThemeContext';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────
const NODE_COUNT           = 680;    // Dense — heavily populated
const CONNECTION_DIST      = 140;    // Max px to draw a connection line
const MAX_CONNECTIONS      = 10;     // Max lines per node
const LINE_WIDTH           = 0.35;

// Free-roaming drift — always active, no home position
const DRIFT_MAX_SPEED      = 0.65;   // px/frame top speed (brisk drift)
const DRIFT_STEER_FORCE    = 0.006;  // How gradually direction changes
const BOUNCE_DAMPING       = 0.65;   // Velocity retained after edge bounce

// Mouse attraction
const HERO_Y_LIMIT         = 650;    // Page-Y below which is "hero zone"
const ATTRACT_RADIUS_HERO  = 300;    // Pull range inside hero
const ATTRACT_RADIUS_PAGE  = 160;    // Pull range outside hero
const ATTRACT_STRENGTH_HERO = 0.10;  // Attraction intensity (hero) — fast follow
const ATTRACT_STRENGTH_PAGE = 0.03;  // Attraction intensity (elsewhere)

// Soft repulsion inside clusters
const REPULSE_DIST         = 14;
const REPULSE_STRENGTH     = 0.35;

// Node visual
const NODE_MIN_R           = 0.5;
const NODE_MAX_R           = 1.8;

// Density origin — right-centre of hero
const ORIGIN_X_RATIO       = 0.65;
const ORIGIN_Y_PX          = 290;

// ─────────────────────────────────────────────────────────────────────────────
// Node — purely velocity-driven, no home position
// ─────────────────────────────────────────────────────────────────────────────
class Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  steerAngle: number;
  steerTimer: number;
  radius: number;
  baseAlpha: number;

  constructor(x: number, y: number, originX: number, originY: number) {
    this.x = x;
    this.y = y;

    // Random initial velocity in any direction
    const angle = Math.random() * Math.PI * 2;
    const speed = DRIFT_MAX_SPEED * (0.2 + Math.random() * 0.8);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.steerAngle = angle;
    this.steerTimer = Math.floor(60 + Math.random() * 180);

    // Visual weight by distance from origin
    const dist = Math.hypot(x - originX, y - originY);
    const proxNorm = Math.max(0, 1 - dist / 1600);
    this.radius = NODE_MIN_R + proxNorm * (NODE_MAX_R - NODE_MIN_R);
    this.baseAlpha = 0.15 + proxNorm * 0.52;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Spatial grid — O(1) neighbor lookup
// ─────────────────────────────────────────────────────────────────────────────
class SpatialGrid {
  cellSize: number;
  cols: number;
  rows: number;
  cells: number[][];

  constructor(w: number, h: number, cellSize: number) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(w / cellSize) + 1;
    this.rows = Math.ceil(h / cellSize) + 1;
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
  }

  clear() {
    for (let i = 0; i < this.cells.length; i++) this.cells[i].length = 0;
  }

  private key(cx: number, cy: number) { return cy * this.cols + cx; }

  insert(idx: number, x: number, y: number) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    if (cx >= 0 && cx < this.cols && cy >= 0 && cy < this.rows)
      this.cells[this.key(cx, cy)].push(idx);
  }

  neighbors(x: number, y: number): number[] {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const out: number[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows)
          out.push(...this.cells[this.key(nx, ny)]);
      }
    }
    return out;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Random node placement  — NO geometric pattern
// ─────────────────────────────────────────────────────────────────────────────
function spawnNodes(pageW: number, pageH: number, originX: number, originY: number): Node[] {
  const nodes: Node[] = [];

  // ── Hero cluster (~62%): random positions inside a wide ellipse ───────────
  const heroCount = Math.floor(NODE_COUNT * 0.62);
  for (let i = 0; i < heroCount; i++) {
    // Random polar coords — uniform area distribution
    const angle = Math.random() * Math.PI * 2;
    // sqrt for uniform area; wider horizontal than vertical
    const rw = 620; // wide horizontal spread
    const rh = 380; // moderate vertical spread
    const rn = Math.sqrt(Math.random()); // uniform area
    const x = originX + Math.cos(angle) * rw * rn;
    const y = originY + Math.sin(angle) * rh * rn;
    nodes.push(new Node(
      Math.max(8, Math.min(pageW - 8, x)),
      Math.max(8, Math.min(HERO_Y_LIMIT - 8, Math.abs(y))),
      originX, originY
    ));
  }

  // ── Mid-range spread (~26%): random across wider page area ───────────────
  const midCount = Math.floor(NODE_COUNT * 0.26);
  for (let i = 0; i < midCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Random radius beyond hero zone
    const minR = 400;
    const maxR = Math.hypot(pageW, pageH) * 0.60;
    const r = minR + Math.random() * (maxR - minR);
    const x = originX + Math.cos(angle) * r;
    const y = originY + Math.sin(angle) * r;
    nodes.push(new Node(
      Math.max(8, Math.min(pageW - 8, x)),
      Math.max(8, Math.min(pageH - 8, y)),
      originX, originY
    ));
  }

  // ── Sparse scatter (~12%): uniformly random across full page ─────────────
  const scatterCount = NODE_COUNT - heroCount - midCount;
  for (let i = 0; i < scatterCount; i++) {
    nodes.push(new Node(
      8 + Math.random() * (pageW - 16),
      8 + Math.random() * (pageH - 16),
      originX, originY
    ));
  }

  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const NeuralBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let nodes: Node[] = [];
    let grid: SpatialGrid;
    let rafId: number;
    let mousePageX = -9999;
    let mousePageY = -9999;
    let pageW = 0;
    let pageH = 0;
    let originX = 0;

    const isDark = theme === 'dark';
    const [r, g, b] = isDark ? [255, 255, 255] : [30, 30, 30];

    // ── Resize / rebuild ──────────────────────────────────────────────────
    const rebuild = () => {
      pageW = window.innerWidth;
      pageH = Math.max(container.scrollHeight, window.innerHeight * 3);

      const dpr = window.devicePixelRatio || 1;
      canvas.width  = pageW * dpr;
      canvas.height = pageH * dpr;
      canvas.style.width  = `${pageW}px`;
      canvas.style.height = `${pageH}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      originX = pageW * ORIGIN_X_RATIO;

      nodes = spawnNodes(pageW, pageH, originX, ORIGIN_Y_PX);
      grid  = new SpatialGrid(pageW, pageH, CONNECTION_DIST);
    };

    // ── Animation loop ─────────────────────────────────────────────────────
    const animate = () => {
      ctx.clearRect(0, 0, pageW, pageH);

      // Rebuild spatial grid each frame
      grid.clear();
      for (let i = 0; i < nodes.length; i++)
        grid.insert(i, nodes[i].x, nodes[i].y);

      // ── Update each node ───────────────────────────────────────────────
      for (const node of nodes) {
        // Wander steering — lazy direction change
        node.steerTimer--;
        if (node.steerTimer <= 0) {
          node.steerAngle += (Math.random() - 0.5) * 1.8;
          node.steerTimer = 70 + Math.floor(Math.random() * 160);
        }
        const dvx = Math.cos(node.steerAngle) * DRIFT_MAX_SPEED;
        const dvy = Math.sin(node.steerAngle) * DRIFT_MAX_SPEED;
        node.vx += (dvx - node.vx) * DRIFT_STEER_FORCE;
        node.vy += (dvy - node.vy) * DRIFT_STEER_FORCE;

        // Mouse attraction
        const mdx = mousePageX - node.x;
        const mdy = mousePageY - node.y;
        const md  = Math.sqrt(mdx * mdx + mdy * mdy);
        const inHero = node.y < HERO_Y_LIMIT;
        const aRadius = inHero ? ATTRACT_RADIUS_HERO : ATTRACT_RADIUS_PAGE;
        const aStrength = inHero ? ATTRACT_STRENGTH_HERO : ATTRACT_STRENGTH_PAGE;

        let isAttracted = false;
        if (md < aRadius && md > 1) {
          const n = 1 - md / aRadius;
          const pull = n * n * aStrength;
          node.vx += (mdx / md) * pull * aRadius * 0.045;
          node.vy += (mdy / md) * pull * aRadius * 0.045;
          isAttracted = true;
        }

        // Soft repulsion between nearby nodes
        const nbrs = grid.neighbors(node.x, node.y);
        for (const ni of nbrs) {
          const o = nodes[ni];
          if (o === node) continue;
          const rx = node.x - o.x;
          const ry = node.y - o.y;
          const rd = Math.sqrt(rx * rx + ry * ry);
          if (rd < REPULSE_DIST && rd > 0.1) {
            const pf = (1 - rd / REPULSE_DIST) * REPULSE_STRENGTH;
            node.vx += (rx / rd) * pf;
            node.vy += (ry / rd) * pf;
          }
        }

        // Clamp speed
        const spd = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        const maxSpd = isAttracted ? DRIFT_MAX_SPEED * 6 : DRIFT_MAX_SPEED;
        if (spd > maxSpd) {
          node.vx = (node.vx / spd) * maxSpd;
          node.vy = (node.vy / spd) * maxSpd;
        }

        // Integrate
        node.x += node.vx;
        node.y += node.vy;

        // Gentle friction
        node.vx *= 0.993;
        node.vy *= 0.993;

        // Edge bounce
        if (node.x < 4)         { node.x = 4;         node.vx =  Math.abs(node.vx) * BOUNCE_DAMPING; }
        if (node.x > pageW - 4) { node.x = pageW - 4; node.vx = -Math.abs(node.vx) * BOUNCE_DAMPING; }
        if (node.y < 4)         { node.y = 4;         node.vy =  Math.abs(node.vy) * BOUNCE_DAMPING; }
        if (node.y > pageH - 4) { node.y = pageH - 4; node.vy = -Math.abs(node.vy) * BOUNCE_DAMPING; }
      }

      // ── Draw connections ───────────────────────────────────────────────
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        let cnt = 0;
        const nbrs = grid.neighbors(a.x, a.y);
        for (const j of nbrs) {
          if (j <= i || cnt >= MAX_CONNECTIONS) continue;
          const bn = nodes[j];
          const ddx = a.x - bn.x;
          const ddy = a.y - bn.y;
          const dd = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dd >= CONNECTION_DIST) continue;
          const df = 1 - dd / CONNECTION_DIST;
          const la = (a.baseAlpha + bn.baseAlpha) * 0.5 * df * 0.30;
          if (la < 0.005) continue;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${r},${g},${b},${la})`;
          ctx.lineWidth = LINE_WIDTH;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(bn.x, bn.y);
          ctx.stroke();
          cnt++;
        }
      }

      // ── Draw nodes ────────────────────────────────────────────────────
      for (const node of nodes) {
        // Soft glow on brighter hero nodes
        if (node.baseAlpha > 0.4) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius * 3.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${node.baseAlpha * 0.055})`;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${node.baseAlpha})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(animate);
    };

    // ── Events ─────────────────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => { mousePageX = e.pageX; mousePageY = e.pageY; };
    const onMouseLeave = ()             => { mousePageX = -9999;   mousePageY = -9999;  };

    // ── Boot ───────────────────────────────────────────────────────────────
    rebuild();
    rafId = requestAnimationFrame(animate);
    window.addEventListener('resize', rebuild);
    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', rebuild);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [theme]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 0, pointerEvents: 'none', display: 'block' }}
      />
    </div>
  );
};

export default NeuralBackground;
