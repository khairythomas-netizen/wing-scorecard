import { formatScore } from '../lib/scoring';

/**
 * The score is always shown over 10, even at 10.5. An extraordinary card is
 * allowed to beat a perfect 10, and normalising it back down would erase
 * exactly the thing the bonus exists to record.
 */
export function ScoreBadge({
  score,
  size = 'md',
  onClick,
}: {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
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
      className={`inline-flex items-baseline gap-1 bg-gradient-to-br from-orange to-gold font-black text-white ${sizes} ${
        onClick ? 'active:scale-95 transition-transform' : ''
      }`}
      {...(onClick ? { 'aria-label': `Score ${formatScore(score)} out of 10. Show breakdown.` } : {})}
    >
      <span className="tabular-nums leading-none">{formatScore(score)}</span>
      <span className="text-[0.55em] font-bold opacity-80">/10</span>
    </Tag>
  );
}
