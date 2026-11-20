import {
  CRITERIA_BUCKET,
  DAYS_SINCE_LAST_ORDER_BUCKETS,
  DEFAULT_CRITERIA,
} from "@/demo/wizard-fixture";

/**
 * Dot chart of frequent customers by days since the last order (hero of the home screen).
 * Geometry copied from design/templates/source/home.dc.html (desktop) and mobile-home.dc.html.
 */

const GEOMETRY = {
  desktop: {
    viewBox: "0 0 560 220",
    x0: 30.4,
    dx: 12.8,
    y0: 176,
    dy: 7,
    r: 3,
    area: { x: 152, y: 8, width: 388, height: 176, rx: 6 },
    axis: { x1: 24, x2: 536, y: 184 },
    label: { x: 160, y: 24, size: 13 },
    ticks: [24, 152, 280, 408, 536],
    tickY: 204,
  },
  mobile: {
    viewBox: "0 0 320 196",
    x0: 15.7,
    dx: 7.4,
    y0: 150,
    dy: 5.4,
    r: 2.4,
    area: { x: 86, y: 4, width: 226, height: 150, rx: 5 },
    axis: { x1: 12, x2: 308, y: 154 },
    label: { x: 92, y: 18, size: 12 },
    ticks: [16, 86, 160, 234, 294],
    tickY: 174,
  },
} as const;

const TICK_LABELS = ["0", "30", "60", "90", "120 dias"];

export function DotChart({
  variant,
  total,
  opportunity,
}: {
  variant: "desktop" | "mobile";
  total: number;
  opportunity: number;
}) {
  const g = GEOMETRY[variant];
  const days = DEFAULT_CRITERIA.minDaysSinceLastOrder;
  const recent = total - opportunity;

  return (
    <svg
      role="img"
      aria-label={`Distribuição de ${total} clientes frequentes por dias desde o último pedido. ${recent} compraram nos últimos ${days} dias; ${opportunity} estão além da linha de ${days} dias.`}
      viewBox={g.viewBox}
      className="block h-auto w-full font-sans"
    >
      <rect {...g.area} className="fill-sprout" fillOpacity={0.07} />
      {DAYS_SINCE_LAST_ORDER_BUCKETS.map((count, bucket) =>
        Array.from({ length: count }, (_, k) => (
          <circle
            key={`${bucket}-${k}`}
            cx={g.x0 + g.dx * bucket}
            cy={g.y0 - g.dy * k}
            r={g.r}
            className={bucket >= CRITERIA_BUCKET ? "fill-sprout" : "fill-white"}
            fillOpacity={bucket >= CRITERIA_BUCKET ? 1 : 0.38}
          />
        )),
      )}
      <line
        x1={g.area.x}
        y1={g.area.y}
        x2={g.area.x}
        y2={g.axis.y}
        className="stroke-sprout"
        strokeWidth={2}
        strokeDasharray="4 4"
      />
      <text
        x={g.label.x}
        y={g.label.y}
        className="fill-sprout"
        fontSize={g.label.size}
        fontWeight={600}
      >
        Seu critério: {days} dias
      </text>
      <line
        x1={g.axis.x1}
        y1={g.axis.y}
        x2={g.axis.x2}
        y2={g.axis.y}
        className="stroke-white"
        strokeOpacity={0.25}
      />
      <g className="fill-white" fillOpacity={0.7} fontSize={12} textAnchor="middle">
        {g.ticks.map((x, index) => (
          <text key={x} x={x} y={g.tickY}>
            {TICK_LABELS[index]}
          </text>
        ))}
      </g>
    </svg>
  );
}
