/**
 * Single-series bar chart "Pedidos com o cupom por dia". Geometry mirrors the SVG in
 * design/templates/source/results.dc.html (desktop) and mobile-results.dc.html (compact).
 */

type Day = { short: string; date: string; long: string; count: number };

const LAYOUT = {
  desktop: {
    width: 560,
    height: 220,
    base: 176,
    unit: 34,
    gridX: 40,
    tickX: 30,
    slotStart: 48,
    slotEnd: 548,
    slotTop: 8,
    bar: 40,
    labelY: 194,
    labelFont: 12,
    peakFont: 13,
  },
  mobile: {
    width: 320,
    height: 176,
    base: 150,
    unit: 30,
    gridX: 24,
    tickX: 16,
    slotStart: 28,
    slotEnd: 316,
    slotTop: 0,
    bar: 24,
    labelY: 168,
    labelFont: 12,
    peakFont: 12,
  },
} as const;

function barPath(x: number, top: number, width: number, base: number) {
  const r = 4;
  return `M${x} ${base} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + width - r} Q${x + width} ${top} ${x + width} ${top + r} V${base} Z`;
}

function ordersLabel(count: number) {
  return `${count} ${count === 1 ? "pedido" : "pedidos"} com o cupom`;
}

export function UsesPerDayChart({
  days,
  compact = false,
  className,
}: {
  days: readonly Day[];
  compact?: boolean;
  className?: string;
}) {
  const l = compact ? LAYOUT.mobile : LAYOUT.desktop;
  const slot = (l.slotEnd - l.slotStart) / days.length;
  const peak = Math.max(...days.map((d) => d.count));
  const ariaLabel = `Pedidos com o cupom por dia: ${days
    .map((d) => `${d.long.split(",")[0]} ${d.count}`)
    .join(", ")}.`;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${l.width} ${l.height}`}
      className={className}
    >
      {[0, 2, 4].map((tick) => {
        const y = l.base - tick * l.unit;
        return (
          <g key={tick}>
            <line
              x1={l.gridX}
              y1={y}
              x2={l.slotEnd}
              y2={y}
              className="stroke-ink"
              strokeOpacity={tick === 0 ? 0.35 : 0.1}
            />
            <text x={l.tickX} y={y + 4} textAnchor="end" fontSize="12" className="fill-graphite">
              {tick}
            </text>
          </g>
        );
      })}
      {days.map((day, index) => {
        const slotX = l.slotStart + index * slot;
        const center = slotX + slot / 2;
        const top = l.base - day.count * l.unit;
        return (
          <g key={day.date}>
            <g>
              <title>{`${day.long}: ${ordersLabel(day.count)}`}</title>
              <rect
                x={slotX}
                y={l.slotTop}
                width={slot}
                height={l.base - l.slotTop}
                fill="transparent"
              />
              <path
                d={barPath(center - l.bar / 2, top, l.bar, l.base)}
                className="fill-chart-primary"
              />
            </g>
            {day.count === peak && (
              <text
                x={center}
                y={top - 8}
                textAnchor="middle"
                fontSize={l.peakFont}
                fontWeight="600"
                className="fill-ink"
              >
                {day.count}
              </text>
            )}
            <text
              x={center}
              y={l.labelY}
              textAnchor="middle"
              fontSize={l.labelFont}
              className="fill-graphite"
            >
              {compact ? day.short : `${day.short}.`}
            </text>
            {!compact && (
              <text
                x={center}
                y={l.labelY + 15}
                textAnchor="middle"
                fontSize="11"
                className="fill-graphite"
              >
                {day.date}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
