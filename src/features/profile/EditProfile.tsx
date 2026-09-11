import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';
import { IMAGE_WIDTHS, sized } from '../../lib/images';
import { friendlyAuthError, validateUsername } from '../../lib/auth/types';
import type { Profile } from '../../lib/types';
import { AvatarCropper } from './AvatarCropper';

/**
 * Editing your own profile. The username is handled separately from the rest
 * because it is the one field that can be refused by somebody else having
 * taken it first, so it is checked before saving rather than after.
 */
export function EditProfile({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { client, reload } = useAuth();
  const store = useStore();
  const toast = useToast();

  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [isPrivate, setIsPrivate] = useState(profile.isPrivate);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [cropping, setCropping] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const normalized = username.trim().toLowerCase();
  const changedUsername = normalized !== profile.username;
  const formatError = changedUsername && normalized ? validateUsername(normalized) : null;

  // Only check availability for a name that is actually new. Checking your own
  // current username would always come back taken, by you.
  useEffect(() => {
    if (!changedUsername || formatError || !normalized) {
      setAvailable(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const ok = await client.isUsernameAvailable(normalized);
      if (!cancelled) setAvailable(ok);
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [normalized, changedUsername, formatError, client]);

  // Crop first, upload second. Uploading the original and cropping with CSS
  // would mean the avatar looked different everywhere it was shown smaller.
  const pickAvatar = async (file: File) => {
    setCropping(null);
    setUploading(true);
    setError(null);
    try {
      setAvatarUrl(await store.uploadAvatar(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that image.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (formatError || available === false) return;
    setBusy(true);
    setError(null);
    try {
      // Username first: if it fails, nothing else has been written yet, so the
      // profile is never left half-saved.
      if (changedUsername && normalized) await client.claimUsername(normalized);
      await client.updateProfile({ displayName, bio, isPrivate, avatarUrl });
      await reload();
      // The profile on screen is a cached store read, and the write above went
      // through the auth client, which the store never hears about. Without
      // this the save lands in the database and the screen snaps back.
      store.refresh();
      toast('Profile updated');
      onClose();
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const usernameStatus = formatError
    ? { text: formatError, tone: 'text-danger' }
    : !changedUsername
      ? null
      : available === true
        ? { text: `@${normalized} is free`, tone: 'text-green' }
        : available === false
          ? { text: 'That username is taken.', tone: 'text-danger' }
          : { text: 'Checking…', tone: 'text-muted' };

  if (cropping) {
    return (
      <AvatarCropper
        file={cropping}
        onCancel={() => setCropping(null)}
        onDone={(cropped) => void pickAvatar(cropped)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[900] flex flex-col bg-bg">
      <div className="safe-top flex items-center justify-between border-b border-line px-4 pb-3">
        <button onClick={onClose} className="text-[13px] font-bold text-muted">
          Cancel
        </button>
        <h2 className="text-sm font-black">Edit profile</h2>
        <button
          onClick={() => void save()}
          disabled={busy || uploading || Boolean(formatError) || available === false}
          className="text-[13px] font-black text-orange disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="safe-bottom flex-1 overflow-y-auto px-4 pb-10 pt-5">
        <div className="flex flex-col items-center">
          {avatarUrl ? (
            <img
              src={sized(avatarUrl, IMAGE_WIDTHS.thumb)}
              alt=""
              className="h-20 w-20 rounded-full bg-surface2 object-cover"
            />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-full bg-surface2 text-2xl">
              🍗
            </div>
          )}
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="mt-2 text-[12px] font-extrabold text-orange disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Change photo'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setCropping(file);
              e.target.value = '';
            }}
          />
        </div>

        <Field label="Username">
          <div className="flex items-center rounded-xl2 border border-line bg-surface px-3.5 focus-within:border-orange">
            <span className="text-sm font-bold text-muted">@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-transparent py-3 pl-1 text-sm outline-none"
            />
          </div>
          {usernameStatus && (
            <p className={`mt-1.5 text-[11px] font-semibold ${usernameStatus.tone}`}>
              {usernameStatus.text}
            </p>
          )}
        </Field>

        <Field label="Display name">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="What people should call you"
            className="w-full rounded-xl2 border border-line bg-surface px-3.5 py-3 text-sm outline-none focus:border-orange"
          />
        </Field>

        <Field label="Bio">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={160}
            placeholder="Wings you are chasing, sauces you swear by…"
            className="w-full resize-none rounded-xl2 border border-line bg-surface px-3.5 py-3 text-sm outline-none focus:border-orange"
          />
        </Field>

        <div className="mt-5 rounded-xl3 border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-black">Private account</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                {isPrivate
                  ? 'Only followers you approve can see your posts. New followers have to ask first.'
                  : 'Anyone can find you, see your posts and follow you without asking.'}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={isPrivate}
              aria-label="Private account"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                isPrivate ? 'bg-orange' : 'bg-surface2 border border-line'
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  isPrivate ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {error && <p className="mt-4 text-[12px] font-semibold text-danger">{error}</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-1.5 ml-1 text-[11px] font-bold text-muted">{label}</p>
      {children}
    </div>
  );
}
