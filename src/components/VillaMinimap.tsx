import React from 'react';
import type { DropPhase, HouseFootprint, MinimapBlip } from '../shared/types';

interface VillaMinimapProps {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  currentFloor: 1 | 2;
  zoneRadius: number;
  dropPhase: DropPhase;
  inVehicle: boolean;
  planeStartX: number;
  planeStartZ: number;
  planeEndX: number;
  planeEndZ: number;
  houses: HouseFootprint[];
  blips: MinimapBlip[];
}

export const VillaMinimap: React.FC<VillaMinimapProps> = ({
  playerX,
  playerZ,
  playerYaw,
  currentFloor,
  zoneRadius,
  dropPhase,
  inVehicle,
  planeStartX,
  planeStartZ,
  planeEndX,
  planeEndZ,
  houses,
  blips,
}) => {
  const size = 148;
  const cx = size / 2;
  const cy = size / 2;
  // Wide map overview while flying/parachuting; medium while driving; tactical on foot
  const scale = dropPhase !== 'ground' ? 0.24 : inVehicle ? 0.44 : 0.72;
  const rotDeg = (playerYaw * 180) / Math.PI;

  const badgeLabel =
    dropPhase === 'plane'
      ? 'UÇAK'
      : dropPhase === 'parachute'
        ? 'PARAŞÜT'
        : inVehicle
          ? 'ARAÇ'
          : `${currentFloor}. KAT`;

  return (
    <div className="pointer-events-none flex flex-col items-start gap-1">
      <div
        className="relative overflow-hidden rounded-full border-2 border-amber-500/50 bg-slate-950/90 shadow-lg"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <clipPath id="radar-clip">
              <circle cx={cx} cy={cy} r={size / 2 - 2} />
            </clipPath>
          </defs>
          <g clipPath="url(#radar-clip)">
            <g
              transform={`translate(${cx}, ${cy}) rotate(${rotDeg}) translate(${-playerX * scale}, ${-playerZ * scale})`}
            >
              {/* Huge 560x560m Island Ground */}
              <rect
                x={-275 * scale}
                y={-275 * scale}
                width={550 * scale}
                height={550 * scale}
                fill="#14231a"
                stroke="#334155"
                strokeWidth={1.2}
              />

              {/* Main Asphalt Cross Roads & Outer Ring Road */}
              <line
                x1={0}
                y1={-260 * scale}
                x2={0}
                y2={260 * scale}
                stroke="#475569"
                strokeWidth={Math.max(1.5, 8 * scale)}
              />
              <line
                x1={-260 * scale}
                y1={0}
                x2={260 * scale}
                y2={0}
                stroke="#475569"
                strokeWidth={Math.max(1.5, 8 * scale)}
              />
              <circle
                cx={0}
                cy={0}
                r={154 * scale}
                fill="none"
                stroke="#475569"
                strokeWidth={Math.max(1.2, 6 * scale)}
              />

              {/* Central Villa + Pool */}
              <rect
                x={-34 * scale}
                y={-34 * scale}
                width={68 * scale}
                height={68 * scale}
                fill="#1b2c20"
                stroke="#475569"
                strokeWidth={0.8}
              />
              <rect
                x={-8.5 * scale}
                y={15.5 * scale}
                width={17 * scale}
                height={9 * scale}
                fill="#0284c7"
                opacity={0.75}
              />
              <rect
                x={-18 * scale}
                y={-14 * scale}
                width={36 * scale}
                height={24 * scale}
                fill={currentFloor === 2 ? '#293548' : '#1e293b'}
                stroke="#cbd5e1"
                strokeWidth={1}
              />

              {/* 18 Independent Houses */}
              {houses.map((h) => (
                <rect
                  key={h.name}
                  x={(h.x - h.w / 2) * scale}
                  y={(h.z - h.d / 2) * scale}
                  width={Math.max(3, h.w * scale)}
                  height={Math.max(3, h.d * scale)}
                  fill="#64748b"
                  stroke="#e2e8f0"
                  strokeWidth={0.6}
                />
              ))}

              {/* Airplane Flight Path while dropping */}
              {dropPhase !== 'ground' && (
                <line
                  x1={planeStartX * scale}
                  y1={planeStartZ * scale}
                  x2={planeEndX * scale}
                  y2={planeEndZ * scale}
                  stroke="#f59e0b"
                  strokeWidth={1.6}
                  strokeDasharray="4 3"
                />
              )}

              {/* Shrinking Zone Circle */}
              <circle
                cx={0}
                cy={0}
                r={zoneRadius * scale}
                fill="none"
                stroke="#22d3ee"
                strokeWidth={1.6}
                strokeDasharray="4 3"
              />

              {/* Cars, Crates & Bots */}
              {blips.map((b, idx) =>
                b.kind === 'car' ? (
                  <rect
                    key={idx}
                    x={b.x * scale - 2.2}
                    y={b.z * scale - 2.2}
                    width={4.4}
                    height={4.4}
                    rx={0.8}
                    fill="#38bdf8"
                    stroke="#0f172a"
                    strokeWidth={0.6}
                  />
                ) : (
                  <circle
                    key={idx}
                    cx={b.x * scale}
                    cy={b.z * scale}
                    r={b.kind === 'crate' ? 1.8 : 2.3}
                    fill={b.kind === 'crate' ? '#fbbf24' : '#ef4444'}
                    opacity={b.floor === currentFloor ? 0.95 : 0.45}
                  />
                )
              )}
            </g>

            {/* Fixed Player Center Arrow */}
            <polygon
              points={`${cx},${cy - 6} ${cx - 4.5},${cy + 5} ${cx},${cy + 2.5} ${cx + 4.5},${cy + 5}`}
              fill="#f8fafc"
              stroke="#0f172a"
              strokeWidth={1}
            />
          </g>
        </svg>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 tabular-nums whitespace-nowrap">
          {badgeLabel}
        </span>
      </div>
    </div>
  );
};
