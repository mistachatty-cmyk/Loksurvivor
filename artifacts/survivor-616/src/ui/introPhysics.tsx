import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { motion } from 'framer-motion';

export interface IntroPhysicsProfile {
  gravity: number;
  restitution: number;
  airDrag: number;
  angularDrag: number;
  returnStrength: number;
  returnDamping: number;
}

export const DEFAULT_INTRO_PHYSICS: IntroPhysicsProfile = {
  gravity: 210,
  restitution: 0.72,
  airDrag: 0.992,
  angularDrag: 0.986,
  returnStrength: 23,
  returnDamping: 8.5,
};

interface BodyState {
  id: string;
  order: number;
  element: HTMLDivElement;
  homeLeft: number;
  homeTop: number;
  width: number;
  height: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  dragging: boolean;
  returning: boolean;
  returnAt: number;
  pointerId: number | null;
  lastPointerX: number;
  lastPointerY: number;
  lastPointerAt: number;
}

interface IntroPhysicsContextValue {
  enabled: boolean;
  register: (id: string, element: HTMLDivElement, order: number) => () => void;
  pointerDown: (id: string, event: ReactPointerEvent<HTMLDivElement>) => void;
  pointerMove: (id: string, event: ReactPointerEvent<HTMLDivElement>) => void;
  pointerUp: (id: string, event: ReactPointerEvent<HTMLDivElement>) => void;
  reset: () => void;
  hasMoved: boolean;
}

const IntroPhysicsContext = createContext<IntroPhysicsContextValue | null>(null);

function renderBody(body: BodyState) {
  const scale = body.dragging ? 1.035 : 1;
  body.element.style.transform = `translate3d(${body.x}px, ${body.y}px, 0) rotate(calc(var(--intro-resting-rotation, 0deg) + ${body.angle}deg)) scale(${scale})`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export interface IntroPhysicsProviderProps {
  children: ReactNode;
  enabled: boolean;
  returnDelaySec: number;
  profile?: Partial<IntroPhysicsProfile>;
}

export function IntroPhysicsProvider({ children, enabled, returnDelaySec, profile }: IntroPhysicsProviderProps) {
  const bodies = useRef(new Map<string, BodyState>());
  const frame = useRef<number | null>(null);
  const previousFrame = useRef(0);
  const [hasMoved, setHasMoved] = useState(false);
  const settings = useMemo(() => ({ ...DEFAULT_INTRO_PHYSICS, ...profile }), [profile]);

  const measureHome = useCallback((body: BodyState) => {
    const oldTransform = body.element.style.transform;
    body.element.style.transform = 'none';
    const rect = body.element.getBoundingClientRect();
    body.element.style.transform = oldTransform;
    body.homeLeft = rect.left;
    body.homeTop = rect.top;
    body.width = rect.width;
    body.height = rect.height;
  }, []);

  const register = useCallback((id: string, element: HTMLDivElement, order: number) => {
    const body: BodyState = {
      id, order, element,
      homeLeft: 0, homeTop: 0, width: 0, height: 0,
      x: 0, y: 0, vx: 0, vy: 0, angle: 0, angularVelocity: 0,
      dragging: false, returning: false, returnAt: 0, pointerId: null,
      lastPointerX: 0, lastPointerY: 0, lastPointerAt: 0,
    };
    bodies.current.set(id, body);
    measureHome(body);
    return () => bodies.current.delete(id);
  }, [measureHome]);

  const reset = useCallback(() => {
    const now = performance.now();
    for (const body of bodies.current.values()) {
      body.dragging = false;
      body.pointerId = null;
      body.returning = false;
      body.returnAt = now + body.order * 115;
    }
  }, []);

  const pointerDown = useCallback((id: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || event.button !== 0) return;
    const body = bodies.current.get(id);
    if (!body) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    for (const candidate of bodies.current.values()) {
      if (candidate.returnAt || candidate.dragging || Math.hypot(candidate.x, candidate.y) > 0.1) {
        candidate.returnAt = Number.POSITIVE_INFINITY;
      }
      candidate.returning = false;
    }
    body.dragging = true;
    body.returning = false;
    body.pointerId = event.pointerId;
    body.vx = 0;
    body.vy = 0;
    body.lastPointerX = event.clientX;
    body.lastPointerY = event.clientY;
    body.lastPointerAt = performance.now();
    setHasMoved(true);
  }, [enabled]);

  const pointerMove = useCallback((id: string, event: ReactPointerEvent<HTMLDivElement>) => {
    const body = bodies.current.get(id);
    if (!enabled || !body?.dragging || body.pointerId !== event.pointerId) return;
    const now = performance.now();
    const dt = Math.max(8, now - body.lastPointerAt) / 1000;
    const dx = event.clientX - body.lastPointerX;
    const dy = event.clientY - body.lastPointerY;
    body.x += dx;
    body.y += dy;
    body.vx = clamp(dx / dt, -1900, 1900);
    body.vy = clamp(dy / dt, -1900, 1900);
    body.angularVelocity = clamp(dx * 2.4, -260, 260);
    body.lastPointerX = event.clientX;
    body.lastPointerY = event.clientY;
    body.lastPointerAt = now;
    renderBody(body);
  }, [enabled]);

  const pointerUp = useCallback((id: string, event: ReactPointerEvent<HTMLDivElement>) => {
    const body = bodies.current.get(id);
    if (!body?.dragging || body.pointerId !== event.pointerId) return;
    body.dragging = false;
    body.pointerId = null;
    const returnStart = performance.now() + clamp(returnDelaySec, 1, 12) * 1000;
    for (const candidate of bodies.current.values()) {
      if (candidate.returnAt || candidate.dragging || Math.hypot(candidate.x, candidate.y) > 0.1 || Math.hypot(candidate.vx, candidate.vy) > 0.1 || Math.abs(candidate.angle) > 0.1) {
        candidate.returnAt = returnStart + candidate.order * 115;
      }
    }
  }, [returnDelaySec]);

  useEffect(() => {
    if (!enabled) {
      for (const body of bodies.current.values()) {
        Object.assign(body, { x: 0, y: 0, vx: 0, vy: 0, angle: 0, angularVelocity: 0, dragging: false, returning: false });
        renderBody(body);
      }
      setHasMoved(false);
      return;
    }
    if (!hasMoved) return;

    const tick = (now: number) => {
      const dt = Math.min(0.032, Math.max(0.001, (now - (previousFrame.current || now)) / 1000));
      previousFrame.current = now;
      const list = [...bodies.current.values()];

      for (const body of list) {
        if (body.dragging) continue;
        if (body.returnAt && now >= body.returnAt) body.returning = true;

        if (body.returning) {
          body.vx += (-body.x * settings.returnStrength - body.vx * settings.returnDamping) * dt;
          body.vy += (-body.y * settings.returnStrength - body.vy * settings.returnDamping) * dt;
          body.angularVelocity += (-body.angle * settings.returnStrength - body.angularVelocity * settings.returnDamping) * dt;
        } else if (body.returnAt) {
          body.vy += settings.gravity * dt;
        } else {
          continue;
        }

        body.vx *= Math.pow(settings.airDrag, dt * 60);
        body.vy *= Math.pow(settings.airDrag, dt * 60);
        body.angularVelocity *= Math.pow(settings.angularDrag, dt * 60);
        body.x += body.vx * dt;
        body.y += body.vy * dt;
        body.angle += body.angularVelocity * dt;

        const left = body.homeLeft + body.x;
        const top = body.homeTop + body.y;
        const maxLeft = window.innerWidth - body.width;
        const maxTop = window.innerHeight - body.height;
        if (left < 0 || left > maxLeft) {
          body.x = (left < 0 ? 0 : maxLeft) - body.homeLeft;
          body.vx *= -settings.restitution;
          body.angularVelocity += body.vy * 0.035;
        }
        if (top < 0 || top > maxTop) {
          body.y = (top < 0 ? 0 : maxTop) - body.homeTop;
          body.vy *= -settings.restitution;
          body.angularVelocity -= body.vx * 0.035;
        }

        if (body.returning && Math.hypot(body.x, body.y) < 0.6 && Math.abs(body.angle) < 0.35 && Math.hypot(body.vx, body.vy) < 7) {
          Object.assign(body, { x: 0, y: 0, vx: 0, vy: 0, angle: 0, angularVelocity: 0, returning: false, returnAt: 0 });
        }
      }

      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const a = list[i];
          const b = list[j];
          if (!a.returnAt && !a.dragging && !b.returnAt && !b.dragging) continue;
          const ax = a.homeLeft + a.x;
          const ay = a.homeTop + a.y;
          const bx = b.homeLeft + b.x;
          const by = b.homeTop + b.y;
          const overlapX = Math.min(ax + a.width, bx + b.width) - Math.max(ax, bx);
          const overlapY = Math.min(ay + a.height, by + b.height) - Math.max(ay, by);
          if (overlapX <= 0 || overlapY <= 0) continue;
          const horizontal = overlapX < overlapY;
          const direction = horizontal ? (ax + a.width / 2 < bx + b.width / 2 ? -1 : 1) : (ay + a.height / 2 < by + b.height / 2 ? -1 : 1);
          const overlap = horizontal ? overlapX : overlapY;
          if (!a.dragging) horizontal ? (a.x += direction * overlap * 0.5) : (a.y += direction * overlap * 0.5);
          if (!b.dragging) horizontal ? (b.x -= direction * overlap * 0.5) : (b.y -= direction * overlap * 0.5);
          const av = horizontal ? a.vx : a.vy;
          const bv = horizontal ? b.vx : b.vy;
          const impulse = (bv - av) * settings.restitution;
          if (!a.dragging) horizontal ? (a.vx += impulse) : (a.vy += impulse);
          if (!b.dragging) horizontal ? (b.vx -= impulse) : (b.vy -= impulse);
          a.angularVelocity += impulse * 0.018;
          b.angularVelocity -= impulse * 0.018;
          const sharedReturnAt = Math.max(a.returnAt, b.returnAt) || now + clamp(returnDelaySec, 1, 12) * 1000;
          if (!a.dragging && !a.returnAt) a.returnAt = sharedReturnAt + a.order * 115;
          if (!b.dragging && !b.returnAt) b.returnAt = sharedReturnAt + b.order * 115;
        }
      }

      for (const body of list) renderBody(body);
      if (hasMoved && list.every((body) => !body.returnAt && !body.dragging)) setHasMoved(false);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      previousFrame.current = 0;
    };
  }, [enabled, hasMoved, returnDelaySec, settings]);

  useEffect(() => {
    const remeasure = () => {
      for (const body of bodies.current.values()) if (!body.dragging && !body.returnAt) measureHome(body);
    };
    window.addEventListener('resize', remeasure);
    return () => window.removeEventListener('resize', remeasure);
  }, [measureHome]);

  const value = useMemo<IntroPhysicsContextValue>(() => ({
    enabled, register, pointerDown, pointerMove, pointerUp, reset, hasMoved,
  }), [enabled, register, pointerDown, pointerMove, pointerUp, reset, hasMoved]);

  return <IntroPhysicsContext.Provider value={value}>{children}</IntroPhysicsContext.Provider>;
}

export interface IntroPhysicsBodyProps {
  id: string;
  order: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}

export function IntroPhysicsBody({ id, order, children, className = '', style, testId }: IntroPhysicsBodyProps) {
  const context = useContext(IntroPhysicsContext);
  const register = context?.register;
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current || !register) return;
    return register(id, ref.current, order);
  }, [id, order, register]);

  return (
    <div
      ref={ref}
      className={`${className} ${context?.enabled ? 'intro-physics-body' : ''}`}
      style={style}
      onPointerDown={(event) => context?.pointerDown(id, event)}
      onPointerMove={(event) => context?.pointerMove(id, event)}
      onPointerUp={(event) => context?.pointerUp(id, event)}
      onPointerCancel={(event) => context?.pointerUp(id, event)}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

export function IntroPhysicsReset() {
  const context = useContext(IntroPhysicsContext);
  if (!context?.enabled || !context.hasMoved) return null;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: [0.22, 0.48, 0.22], y: 0 }}
      transition={{ opacity: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }, y: { duration: 0.3 } }}
      whileHover={{ opacity: 0.9 }}
      whileTap={{ scale: 0.96 }}
      onClick={context.reset}
      className="fixed bottom-4 left-4 z-30 border border-white/25 bg-black/55 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/90 backdrop-blur-sm sm:bottom-6 sm:left-6"
      aria-label="Reset intro layout"
      data-testid="button-reset-intro-layout"
    >
      Reset
    </motion.button>
  );
}
