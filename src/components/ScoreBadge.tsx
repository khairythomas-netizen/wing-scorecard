import { scoreGradient } from '../lib/scoreColor';
import { formatScore } from '../lib/scoring';

/**
 * The score is always shown over 10, even at 10.5. An extraordinary card is
 * allowed to beat a perfect 10, and normalising it back down would erase
 * exactly the thing the bonus exists to record.
 *
 * The background carries the score too, red through amber to green, so a
 * feed reads at a glance without anyone parsing decimals.
 */
export function ScoreBadge({
  score,
  size = 'md',
  onClick,
  showScale = false,
}: {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  /**
   * Whether to print "/10" after the number. Off while browsing, where the
   * scale is obvious from every other score on screen and the suffix is just
   * noise. On while composing a score, where the ceiling is the point.
   */
  showScale?: boolean;
}) {
  const sizes = {
    sm: 'text-sm px-2 py-1 rounded-lg',
    md: 'text-lg px-2.5 py-1 rounded-xl',
    lg: 'text-3xl px-3.5 py-1.5 rounded-xl2',
  }[size];

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      style={{ background: scoreGradient(score) }}
      className={`inline-flex items-baseline gap-1 font-black text-white ${sizes} ${
        onClick ? 'active:scale-95 transition-transform' : ''
      }`}
      {...(onClick ? { 'aria-label': `Score ${formatScore(score)} out of 10. Show breakdown.` } : {})}
    >
      <span className="tabular-nums leading-none">{formatScore(score)}</span>
      {showScale && <span className="text-[0.55em] font-bold opacity-80">/10</span>}
    </Tag>
  );
}
