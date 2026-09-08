const MARK = `${import.meta.env.BASE_URL}icons/wingz-mark.png`;

/**
 * The official WingZ mark: a chicken wing shaped like a Z.
 * Always the supplied asset — never a redrawn or substituted glyph.
 */
export function WingzMark({ className = 'h-9 w-9' }: { className?: string }) {
  return <img src={MARK} alt="" aria-hidden className={`${className} object-contain`} />;
}

export function Wordmark() {
  return (
    <span className="text-[26px] font-black leading-none tracking-[-0.055em]">
      Wing<span className="text-orange">Z</span>
    </span>
  );
}

export function BrandLockup() {
  return (
    <div className="flex items-center gap-2">
      <WingzMark />
      <Wordmark />
    </div>
  );
}
