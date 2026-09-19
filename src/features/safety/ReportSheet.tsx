import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';
import { REPORT_REASONS, type ReportKind, type ReportReason } from '../../lib/db/store';

/**
 * Reporting a post, a comment or a person.
 *
 * The App Store requires a way to report offensive content and to block
 * abusive users. Both live here so the choice is one tap apart: most people
 * reaching for "report" also never want to see that person again.
 */
export function ReportSheet({
  open,
  onClose,
  kind,
  targetId,
  authorId,
  authorName,
}: {
  open: boolean;
  onClose: () => void;
  kind: ReportKind;
  targetId: string;
  /** Null when reporting a profile, where the target is already the person. */
  authorId: string | null;
  authorName: string;
}) {
  const store = useStore();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const person = authorId ?? targetId;

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await store.reportContent(kind, targetId, reason, note);
      toast('Reported. Thank you, we will look at it.');
      onClose();
      setReason(null);
      setNote('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not send that report');
    } finally {
      setBusy(false);
    }
  };

  const block = async () => {
    setBusy(true);
    try {
      await store.blockUser(person);
      toast(`Blocked @${authorName}`);
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not block that account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Report or block">
      <div className="px-1 pb-2">
        <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-muted">
          What is wrong with it?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.id}
              onClick={() => setReason(r.id)}
              aria-pressed={reason === r.id}
              className={`rounded-full px-3 py-1.5 text-[12px] font-extrabold transition-colors ${
                reason === r.id ? 'bg-text text-bg' : 'border border-line bg-surface text-muted'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Anything else we should know? Optional."
          className="mt-3 w-full resize-none rounded-xl2 border border-line bg-surface px-3.5 py-3 text-sm outline-none focus:border-orange"
        />

        <button
          onClick={() => void send()}
          disabled={!reason || busy}
          className="mt-3 w-full rounded-xl bg-gradient-to-br from-orange to-gold py-3 text-sm font-black text-white shadow-glow disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send report'}
        </button>

        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[12px] leading-relaxed text-muted">
            Blocking @{authorName} hides each of you from the other, everywhere, and
            undoes any following between you.
          </p>
          <button
            onClick={() => void block()}
            disabled={busy}
            className="mt-2.5 w-full rounded-xl border border-line bg-surface py-3 text-sm font-extrabold text-danger disabled:opacity-50"
          >
            Block @{authorName}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
