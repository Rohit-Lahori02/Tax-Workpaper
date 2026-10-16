/**
 * Tiny area chart for a handful of points, rendered on the server as inline SVG.
 * Uses currentColor so it follows the text tone it sits in.
 */
export function Sparkline({
  values,
  width = 96,
  height = 36,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [pad + i * step, height - pad - ((v - min) / span) * (height - pad * 2)] as const);
  const line = pts.map(([x, y], i) => (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1)).join(" ");
  const area = line + " L" + pts[pts.length - 1][0].toFixed(1) + " " + (height - pad) + " L" + pad + " " + (height - pad) + " Z";
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={"0 0 " + width + " " + height} width={width} height={height} className={className} aria-hidden="true">
      <path d={area} fill="currentColor" fillOpacity="0.12" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="currentColor" />
    </svg>
  );
}
