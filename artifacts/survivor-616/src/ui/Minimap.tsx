import { Maximize2, Minimize2, Move } from 'lucide-react';
import { useEffect, useRef, type PointerEvent } from 'react';

import type { HudSnapshot } from '@/game/types';

interface MinimapProps {
  map: NonNullable<HudSnapshot['endless']>;
  expanded: boolean;
  position: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  onToggleExpanded: () => void;
}

const MAP_W = 220;
const MAP_H = 140;
const SCALE = 0.19;

export function Minimap({
  map,
  expanded,
  position,
  onPositionChange,
  onToggleExpanded,
}: MinimapProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const toMap = (x: number, y: number) => ({
    x: MAP_W / 2 + (x - map.playerX) * SCALE,
    y: MAP_H / 2 + (y - map.playerY) * SCALE,
  });

  const handleDragStart = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const rect = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const width = window.innerWidth;
    const height = window.innerHeight;
    const widget = event.currentTarget.parentElement?.parentElement;
    if (!widget || width <= 0 || height <= 0) return;
    const rect = widget.getBoundingClientRect();
    const nextX = (event.clientX - drag.offsetX) / width;
    const nextY = (event.clientY - drag.offsetY) / height;
    const maxX = Math.max(0, (width - rect.width) / width);
    const maxY = Math.max(0, (height - rect.height) / height);
    onPositionChange({
      x: Math.min(maxX, Math.max(0, nextX)),
      y: Math.min(maxY, Math.max(0, nextY)),
    });
  };

  const handleDragEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const stopInteraction = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  useEffect(() => {
    const clampToViewport = () => {
      const element = rootRef.current;
      if (!element || window.innerWidth <= 0 || window.innerHeight <= 0) return;
      const rect = element.getBoundingClientRect();
      const maxX = Math.max(0, (window.innerWidth - rect.width) / window.innerWidth);
      const maxY = Math.max(0, (window.innerHeight - rect.height) / window.innerHeight);
      const next = {
        x: Math.min(maxX, Math.max(0, position.x)),
        y: Math.min(maxY, Math.max(0, position.y)),
      };
      if (next.x !== position.x || next.y !== position.y) onPositionChange(next);
    };

    clampToViewport();
    window.addEventListener('resize', clampToViewport);
    return () => window.removeEventListener('resize', clampToViewport);
  }, [onPositionChange, position.x, position.y, expanded]);

  return (
    <div
      ref={rootRef}
      className={`pointer-events-auto absolute z-30 block ${
        expanded ? 'w-[min(86vw,360px)]' : 'w-[min(62vw,220px)]'
      }`}
      style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
      data-testid="minimap"
      aria-label={`City minimap, current block ${map.currentBlock}`}
    >
      <div className="border border-cyan-200/30 bg-[#050911]/85 p-1 shadow-[0_0_24px_rgba(34,211,238,.12)]">
        <div
          className="mb-1 flex cursor-grab touch-none items-center justify-between gap-2 px-1 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-100/75 active:cursor-grabbing"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          data-testid="minimap-drag-handle"
          title="Drag to move minimap"
        >
          <span className="flex min-w-0 items-center gap-1 truncate" style={{ color: map.currentBandAccent }}>
            <Move className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{map.currentBandLabel}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-amber-200/80">
            {map.blocksWalked} blk
            <button
              type="button"
              onPointerDown={stopInteraction}
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpanded();
              }}
              className="pointer-events-auto border border-cyan-200/30 p-1 text-cyan-100 hover:border-cyan-100/70"
              aria-label={expanded ? 'Minimize minimap' : 'Expand minimap'}
              data-testid="button-toggle-minimap-size"
            >
              {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </button>
          </span>
        </div>
        {expanded ? (
          <>
            <div className="mb-1 flex items-center justify-between px-1 font-mono text-[8px] uppercase tracking-wider text-white/50">
              <span className="truncate">{map.currentDistrict} · {map.currentBlock}</span>
              <span className="shrink-0">{map.riskLabel}</span>
            </div>
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="h-auto w-full" role="img">
          <rect width={MAP_W} height={MAP_H} fill="#08111a" />
          {map.cityBlocks.map((block, index) => {
            const point = toMap(block.x, block.y);
            const isBridge = block.kind === 'bridge' && block.crossing;
            const isRiverEdge = block.river && !block.crossing;
            const blockColor = isBridge
              ? '#164e63'
              : isRiverEdge
                ? '#10283a'
                : block.landmark
                  ? '#2a1e3d'
                  : '#131c27';
            const blockStroke = isBridge
              ? '#fbbf24'
              : isRiverEdge
                ? '#fb7185'
                : block.landmark?.accent ?? '#64748b';
            return (
              <g key={`${block.x}:${block.y}:${index}`}>
                <rect
                  x={point.x - 61}
                  y={point.y - 61}
                  width="122"
                  height="122"
                  fill={blockColor}
                  stroke={block.bandAccent ?? blockStroke}
                  strokeOpacity=".55"
                  strokeDasharray="4 4"
                />
                {isBridge ? (
                  <path d={`M ${point.x - 8} ${point.y - 27} h 16 M ${point.x - 8} ${point.y + 27} h 16 M ${point.x} ${point.y - 27} v 54`} stroke="#fbbf24" strokeWidth="4" opacity=".9" />
                ) : block.landmark ? (
                  <path d={`M ${point.x} ${point.y - 12} l 12 12 -12 12 -12 -12 z`} fill={block.landmark.accent} opacity=".85" />
                ) : null}
                <text x={point.x - 56} y={point.y - 50} fill={block.bandAccent ?? block.landmark?.accent ?? '#cbd5e1'} opacity=".75" fontSize="5">
                  {block.landmark?.name ?? block.kind}
                </text>
              </g>
            );
          })}
          {map.routeEvent?.phase === 'available' ? (() => {
            const point = toMap(map.routeEvent.x, map.routeEvent.y);
            return (
              <g>
                <circle cx={point.x} cy={point.y} r="7" fill="none" stroke={map.currentBandAccent} strokeWidth="2" strokeDasharray="3 2" />
                <path d={`M ${point.x} ${point.y - 5} v 10 M ${point.x - 5} ${point.y} h 10`} stroke="#fff" strokeWidth="1.5" />
              </g>
            );
          })() : null}
          {map.riverSegments.map((river, index) => {
            const point = toMap(river.x, river.y);
            return (
              <g key={`river:${index}`}>
                <rect x={point.x - 61} y={point.y - 12} width="122" height="24" fill="#164e63" opacity=".9" />
                {river.crossingX !== null ? (
                  <rect x={toMap(river.crossingX, river.y).x - 5} y={point.y - 12} width="10" height="24" fill="#f59e0b" />
                ) : (
                  <path d={`M ${point.x - 55} ${point.y - 9} h 110 M ${point.x - 55} ${point.y + 9} h 110`} stroke="#fb7185" strokeWidth="2" strokeDasharray="4 4" opacity=".9" />
                )}
              </g>
            );
          })}
          {map.buildings.map((building) => {
            const point = toMap(building.x, building.y);
            const width = Math.max(5, building.w * SCALE);
            const height = Math.max(4, building.h * SCALE);
            return (
              <g key={`building:${building.id}`}>
                <rect
                  x={point.x - width / 2}
                  y={point.y - height / 2}
                  width={width}
                  height={height}
                  fill={`${building.accent}55`}
                  stroke={building.accent}
                  strokeWidth="1"
                />
                <circle cx={point.x} cy={point.y} r="1.5" fill="#fff3b0" />
              </g>
            );
          })}
          {map.buildingEntrances.map((door, index) => {
            const point = toMap(door.x, door.y);
            return <circle key={`door:${index}`} cx={point.x} cy={point.y} r="3" fill="#fbbf24" />;
          })}
          <circle cx={MAP_W / 2} cy={MAP_H / 2} r="4" fill="#f8fafc" stroke="#22d3ee" strokeWidth="2" />
          <path d={`M ${MAP_W / 2} 8 v 7 M ${MAP_W / 2} ${MAP_H - 8} v -7 M 8 ${MAP_H / 2} h 7 M ${MAP_W - 8} ${MAP_H / 2} h -7`} stroke="#e2e8f0" opacity=".4" />
            </svg>
            <div className="mt-1 flex items-center justify-between gap-2 px-1 font-mono text-[8px] uppercase tracking-wider text-white/45">
              <span>● you</span>
              <span>{map.inBuilding ? `inside · ${map.buildingLabel}` : map.inDungeon ? `room ${map.dungeonRoom}/3` : map.hazardLabel}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 px-1 font-mono text-[7px] uppercase tracking-wide text-white/55">
              <span className="text-amber-300">■ bridge</span>
              <span className="text-rose-300">┄ river edge</span>
              <span className="text-amber-100">□ building</span>
              <span className="text-fuchsia-200">◆ landmark</span>
              <span style={{ color: map.currentBandAccent }}>✦ beacon</span>
            </div>
          </>
        ) : (
          <p className="px-1 pb-1 font-mono text-[8px] uppercase tracking-wider text-white/45">
            Map minimized · drag header to move
          </p>
        )}
      </div>
    </div>
  );
}
