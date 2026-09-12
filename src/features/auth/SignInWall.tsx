import { endGuest } from '../../lib/guest';

/**
 * Shown where a guest hits something that writes.
 *
 * Explains what the account is for rather than just refusing. The ask lands
 * better at the moment someone wants to post than it does on the front door,
 * which is the whole reason browsing comes first.
 */
export function SignInWall({
  title,
  detail,
  onSignIn,
}: {
  title: string;
  detail: string;
  onSignIn: () => void;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface2 text-2xl">
        🍗
      </div>
      <p className="mt-4 text-sm font-black">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[34ch] text-xs leading-relaxed text-muted">{detail}</p>
      <button
        onClick={() => {
          endGuest();
          onSignIn();
        }}
        className="mt-5 rounded-xl bg-gradient-to-br from-orange to-gold px-5 py-2.5 text-xs font-extrabold text-white shadow-glow"
      >
        Sign in or create an account
      </button>
    </div>
  );
}
