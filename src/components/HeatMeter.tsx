/**
 * Heat is descriptive metadata, never part of the score.
 * Users pick whole peppers; community averages carry a decimal.
 */
export function HeatMeter({
  value,
  size = 14,
  showValue = true,
}: {
  value: number;
  size?: number;
  showValue?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1" title={`${value.toFixed(1)} out of 5 heat`}>
      <span className="inline-flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => {
          // Partial fill lets an average of 3.7 read honestly.
          const fill = Math.max(0, Math.min(1, value - (i - 1)));
          // The glyph is laid out in its own fixed box with line-height 1 so the
          // clipped overlay reveals a real fraction of a pepper, not a sliver.
          const glyph = {
            fontSize: size,
            lineHeight: 1,
            width: size * 1.2,
            height: size,
            display: 'block' as const,
          };
          return (
            <span
              key={i}
              className="relative inline-block"
              style={{ width: size * 1.2, height: size }}
            >
              <span className="absolute left-0 top-0 opacity-30 grayscale" style={glyph}>
                🌶️
              </span>
              <span
                className="absolute left-0 top-0 overflow-hidden"
                style={{ ...glyph, width: size * 1.2 * fill }}
              >
                <span style={glyph}>🌶️</span>
              </span>
            </span>
          );
        })}
      </span>
      {showValue && (
        <span className="text-[11px] font-bold text-muted tabular-nums">{value.toFixed(1)}</span>
      )}
      <span className="sr-only">{value.toFixed(1)} out of 5 heat</span>
    </span>
  );
}
