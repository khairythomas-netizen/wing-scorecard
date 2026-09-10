import { IMAGE_WIDTHS, sized } from '../lib/images';

export function Avatar({
  src,
  alt,
  size = 36,
  ring = false,
}: {
  src: string;
  alt: string;
  size?: number;
  ring?: boolean;
}) {
  const img = (
    <img
      src={sized(src, IMAGE_WIDTHS.avatar)}
      alt={alt}
      loading="lazy"
      width={size}
      height={size}
      className="h-full w-full rounded-full object-cover"
      style={ring ? { border: '2.5px solid var(--surface)' } : undefined}
    />
  );

  if (!ring) return <span style={{ width: size, height: size }} className="block shrink-0">{img}</span>;

  return (
    <span
      className="block shrink-0 rounded-full bg-gradient-to-br from-orange to-gold p-[2px]"
      style={{ width: size, height: size }}
    >
      {img}
    </span>
  );
}
