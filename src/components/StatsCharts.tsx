"use client";

type ByMonth = { month: string; episodes: number; hours: number };
type ByYear = { year: number; episodes: number; hours: number };

export default function StatsCharts({
  byMonth,
  byYear,
}: {
  byMonth: ByMonth[];
  byYear: ByYear[];
}) {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold mb-3">Activité mensuelle (épisodes)</h3>
        <BarMini data={byMonth.map((m) => ({ label: m.month.slice(5), value: m.episodes }))} />
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-3">Activité annuelle (heures)</h3>
        <LineMini data={byYear.map((y) => ({ label: String(y.year), value: y.hours }))} />
      </section>
    </div>
  );
}

function BarMini({ data }: { data: { label: string; value: number }[] }) {
  const width = 640;
  const height = 160;
  const padding = 24;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (width - padding * 2) / data.length;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="rounded-md bg-zinc-900">
      {/* axes */}
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#444" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#444" />
      {/* bars */}
      {data.map((d, i) => {
        const h = ((d.value / max) * (height - padding * 2)) | 0;
        const x = padding + i * bw + 4;
        const y = height - padding - h;
        return <rect key={i} x={x} y={y} width={bw - 8} height={h} fill="#6ee7b7" />;
      })}
      {/* labels */}
      {data.map((d, i) => {
        const x = padding + i * bw + bw / 2;
        return (
          <text key={i} x={x} y={height - 6} textAnchor="middle" fontSize="10" fill="#aaa">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

function LineMini({ data }: { data: { label: string; value: number }[] }) {
  const width = 640;
  const height = 160;
  const padding = 24;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = (width - padding * 2) / Math.max(1, data.length - 1);

  const points = data.map((d, i) => {
    const x = padding + i * step;
    const y = height - padding - (d.value / max) * (height - padding * 2);
    return [x, y] as const;
  });

  const path = points
    .map((p, i) => (i === 0 ? `M ${p[0]},${p[1]}` : `L ${p[0]},${p[1]}`))
    .join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="rounded-md bg-zinc-900">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#444" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#444" />
      <path d={path} fill="none" stroke="#60a5fa" strokeWidth={2} />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="#60a5fa" />
      ))}
      {data.map((d, i) => {
        const x = padding + i * step;
        return (
          <text key={i} x={x} y={height - 6} textAnchor="middle" fontSize="10" fill="#aaa">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
