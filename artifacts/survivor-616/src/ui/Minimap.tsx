import type { HudSnapshot } from '@/game/types';

interface MinimapProps {
  map: NonNullable<HudSnapshot['endless']>;
}

const MAP_W = 220;
const MAP_H = 140;
const SCALE = 0.19;

export function Minimap({ map }: MinimapProps) {
  const toMap = (x: number, y: number) => ({
    x: MAP_W / 2 + (x - map.playerX) * SCALE,
    y: MAP_H / 2 + (y - map.playerY) * SCALE,
  });

  return (
    <div
      className="pointer-events-none absolute right-3 top-[150px] block w-[42vw] min-w-[158px] max-w-[220px] sm:top-3"
      data-testid="minimap"
      aria-label={`City minimap, current block ${map.currentBlock}`}
    >
      <div className="border border-cyan-200/30 bg-[#050911]/85 p-1 shadow-[0_0_24px_rgba(34,211,238,.12)]">
        <div className="mb-1 flex items-center justify-between px-1 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-100/75">
          <span>Block map</span>
          <span className="text-amber-200/80">{map.currentBlock}</span>
        </div>
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="h-auto w-full" role="img">
          <rect width={MAP_W} height={MAP_H} fill="#08111a" />
          {map.cityBlocks.map((block, index) => {
            const point = toMap(block.x, block.y);
            return (
              <g key={`${block.x}:${block.y}:${index}`}>
                <rect
                  x={point.x - 61}
                  y={point.y - 61}
                  width="122"
                  height="122"
                  fill={block.river ? '#0b2e48' : '#131c27'}
                  stroke={block.river ? '#2dd4bf' : '#64748b'}
                  strokeOpacity=".55"
                  strokeDasharray="4 4"
                />
                <text x={point.x - 56} y={point.y - 50} fill="#cbd5e1" opacity=".55" fontSize="5">
                  {block.kind}
                </text>
              </g>
            );
          })}
          {map.riverSegments.map((river, index) => {
            const point = toMap(river.x, river.y);
            return (
              <g key={`river:${index}`}>
                <rect x={point.x - 61} y={point.y - 12} width="122" height="24" fill="#164e63" opacity=".9" />
                <rect x={toMap(river.crossingX, river.y).x - 5} y={point.y - 12} width="10" height="24" fill="#f59e0b" />
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
        <div className="mt-1 flex items-center justify-between px-1 font-mono text-[8px] uppercase tracking-wider text-white/45">
          <span>● you</span>
          <span>{map.inDungeon ? `room ${map.dungeonRoom}/3` : 'streets'}</span>
        </div>
      </div>
    </div>
  );
}
