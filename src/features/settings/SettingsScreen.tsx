import { useEffect, useState } from 'react';
import { Spinner } from '../../components/States';
import { useAuth } from '../../hooks/useAuth';
import { useQuery, useStore } from '../../hooks/useStore';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../hooks/useToast';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '../../lib/db/store';

const NOTIFICATION_ROWS: { key: keyof NotificationPrefs; label: string; detail: string }[] = [
  { key: 'likes', label: 'Likes', detail: 'When someone likes your wings' },
  { key: 'comments', label: 'Comments', detail: 'When someone comments on your post' },
  { key: 'follows', label: 'Follows', detail: 'New followers, and accepted requests' },
  { key: 'followRequests', label: 'Follow requests', detail: 'When someone asks to follow you' },
];

export function SettingsScreen() {
  const store = useStore();
  const toast = useToast();
  const { client, user } = useAuth();
  const { theme, toggle } = useTheme();

  const saved = useQuery([], (s) => s.notificationPrefs());
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  useEffect(() => {
    if (saved.data) setPrefs(saved.data);
  }, [saved.data]);

  const set = (key: keyof NotificationPrefs, value: boolean) => {
    const previous = prefs;
    const next = { ...(prefs ?? DEFAULT_NOTIFICATION_PREFS), [key]: value };
    // Optimistic: a switch that waits for a round trip feels broken.
    setPrefs(next);
    void store.setNotificationPrefs(next).catch(() => {
      setPrefs(previous);
      toast('Could not save that setting');
    });
  };

  return (
    <div className="pb-6">
      <header className="px-4 pb-3 pt-4">
        <h1 className="text-[28px] font-black leading-none tracking-tight">Settings</h1>
        {user?.email && <p className="mt-1.5 text-xs text-muted">{user.email}</p>}
      </header>

      <Section title="Notifications">
        {!prefs ? (
          <div className="py-6">
            <Spinner label="Loading settings" />
          </div>
        ) : (
          NOTIFICATION_ROWS.map((row) => (
            <Row key={row.key} label={row.label} detail={row.detail}>
              <Switch checked={prefs[row.key]} label={row.label} onChange={(v) => set(row.key, v)} />
            </Row>
          ))
        )}
        <p className="px-4 pb-3 pt-2 text-[11px] leading-relaxed text-muted">
          These control what appears in your notifications list. WingZ does not send push
          alerts to your phone yet.
        </p>
      </Section>

      <Section title="Appearance">
        <Row label="Dark mode" detail="Follows whatever you pick here">
          <Switch checked={theme === 'dark'} label="Dark mode" onChange={() => toggle()} />
        </Row>
      </Section>

      {client.requiresSignIn && (
        <Section title="Account">
          <button
            onClick={() => void client.signOut()}
            className="w-full px-4 py-3.5 text-left text-[13px] font-extrabold text-danger"
          >
            Sign out
          </button>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h2 className="mb-1.5 px-4 text-[11px] font-black uppercase tracking-[0.09em] text-muted">
        {title}
      </h2>
      <div className="border-y border-line bg-surface">{children}</div>
    </section>
  );
}

function Row({
  label,
  detail,
  children,
}: {
  label: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[13px] font-bold">{label}</p>
        <p className="mt-0.5 text-[11px] text-muted">{detail}</p>
      </div>
      {children}
    </div>
  );
}

function Switch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-orange' : 'border border-line bg-surface2'
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  );
}
