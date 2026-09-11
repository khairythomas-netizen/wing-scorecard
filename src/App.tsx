import { useCallback, useEffect, useState } from 'react';
import { BottomNav, DEFAULT_TAB, isTabId, type TabId } from './components/BottomNav';

const RESUME_TAB_KEY = 'wingz:resume-tab';
import { BrandLockup } from './components/Brand';
import { MoonIcon, RefreshIcon, SunIcon } from './components/Icons';
import { Spinner } from './components/States';
import { AuthScreen } from './features/auth/AuthScreen';
import { UsernameScreen } from './features/auth/UsernameScreen';
import { DiscoverScreen } from './features/discover/DiscoverScreen';
import { FeedScreen } from './features/feed/FeedScreen';
import { PeopleSearch } from './features/feed/PeopleSearch';
import { PostDetail } from './features/feed/PostDetail';
import { EditPost } from './features/feed/EditPost';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { RankingsScreen } from './features/rankings/RankingsScreen';
import { RateScreen } from './features/rate/RateScreen';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { StoreContext, store } from './hooks/useStore';
import { ToastProvider, useToast } from './hooks/useToast';
import { ThemeProvider, useTheme } from './hooks/useTheme';
import { applyUpdate, onUpdateAvailable } from './lib/pwa';

export function App() {
  return (
    <StoreContext.Provider value={store}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Gate />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </StoreContext.Provider>
  );
}

/**
 * Decides between the auth wall, the username step and the app itself.
 *
 * With no Supabase project attached, `requiresSignIn` is false and this falls
 * straight through to the app on the demo user — the deployed build keeps
 * working without credentials.
 */
function Gate() {
  const { user, profile, loading, client } = useAuth();
  const { theme } = useTheme();

  if (loading) {
    return (
      <div className="min-h-app grid place-items-center">
        <Spinner label="Starting WingZ" />
      </div>
    );
  }

  if (client.requiresSignIn && !user) return <AuthScreen />;
  if (user && profile && !profile.username) return <UsernameScreen />;

  return <Shell theme={theme} />;
}

function Shell({ theme }: { theme: 'dark' | 'light' }) {
  const { toggle } = useTheme();
  const { user, profile, client } = useAuth();
  const toast = useToast();

  // Rate is the landing tab for now, by product decision.
  // Refreshing reloads the page, which used to throw you back to Rate from
  // wherever you were reading. The tab is handed across the reload in session
  // storage, which a genuine cold start does not have, so opening the app
  // still lands on Rate.
  const [tab, setTab] = useState<TabId>(() => {
    try {
      const resume = sessionStorage.getItem(RESUME_TAB_KEY);
      if (isTabId(resume)) return resume;
    } catch {
      /* private mode */
    }
    return DEFAULT_TAB;
  });

  // Clearing belongs here, not in the initializer above. React runs a state
  // initializer twice in development, so reading and clearing together meant
  // the first run consumed the value and the second saw nothing and fell back
  // to Rate. An effect runs after the state is already settled.
  useEffect(() => {
    try {
      sessionStorage.removeItem(RESUME_TAB_KEY);
    } catch {
      /* private mode */
    }
  }, []);
  const [profileId, setProfileId] = useState<string>(user?.id ?? '');
  const [updateReady, setUpdateReady] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  // Which post is open, and which tab to return to when it closes.
  const [openPost, setOpenPost] = useState<{ id: string; from: TabId } | null>(null);
  const [editingPost, setEditingPost] = useState<string | null>(null);

  useEffect(() => onUpdateAvailable(setUpdateReady), []);
  useEffect(() => {
    if (user?.id) setProfileId((current) => current || user.id);
  }, [user?.id]);

  const go = useCallback(
    (next: TabId) => {
      setOpenPost(null);
      setEditingPost(null);
      setTab(next);
      if (next === 'profile' && user?.id) setProfileId(user.id);
      window.scrollTo({ top: 0 });
    },
    [user?.id],
  );

  const openProfile = useCallback((id: string) => {
    setOpenPost(null);
    setProfileId(id);
    setTab('profile');
    window.scrollTo({ top: 0 });
  }, []);

  const refresh = async () => {
    toast(updateReady ? 'Loading the new version…' : 'Checking for updates…');
    try {
      sessionStorage.setItem(RESUME_TAB_KEY, tab);
    } catch {
      /* private mode: worst case the refresh lands on Rate, as it used to */
    }
    await applyUpdate();
  };

  return (
    <div className="min-h-app app-scroll app-content mx-auto w-full max-w-[600px]">
      <header className="app-header fixed left-1/2 top-0 z-40 flex w-full max-w-[600px] -translate-x-1/2 items-center justify-between border-b border-line bg-[var(--glass)] px-4 backdrop-blur-xl">
        <BrandLockup />
        <div className="flex items-center gap-2">
          {client.requiresSignIn && (
            <button
              onClick={() => void client.signOut()}
              className="rounded-full border border-line bg-surface px-3 py-2 text-[11px] font-extrabold text-muted"
            >
              Sign out
            </button>
          )}
          <button
            onClick={() => void refresh()}
            aria-label="Check for updates"
            className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-surface"
          >
            <RefreshIcon className="h-[18px] w-[18px]" />
            {updateReady && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-orange" />
            )}
          </button>
          <button
            onClick={toggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface"
          >
            {theme === 'dark' ? (
              <MoonIcon className="h-[18px] w-[18px]" />
            ) : (
              <SunIcon className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>
      </header>

      <main>
        {editingPost ? (
          <EditPost
            reviewId={editingPost}
            onDone={() => {
              setEditingPost(null);
              window.scrollTo({ top: 0 });
            }}
          />
        ) : openPost ? (
          <PostDetail
            reviewId={openPost.id}
            onBack={() => {
              setOpenPost(null);
              window.scrollTo({ top: 0 });
            }}
            onOpenProfile={openProfile}
            onEdit={setEditingPost}
          />
        ) : (
          <>
        {tab === 'feed' && (
          <FeedScreen
            onOpenProfile={openProfile}
            onFindPeople={() => setPeopleOpen(true)}
            onEdit={setEditingPost}
          />
        )}
        {tab === 'discover' && <DiscoverScreen theme={theme} />}
        {tab === 'rate' && <RateScreen onPublished={() => go('feed')} />}
        {tab === 'rankings' && <RankingsScreen />}
        {tab === 'profile' && profileId && (
          <ProfileScreen
            key={profileId}
            userId={profileId}
            theme={theme}
            onOpenProfile={openProfile}
            onOpenPost={(id) => {
              setOpenPost({ id, from: 'profile' });
              window.scrollTo({ top: 0 });
            }}
          />
        )}
        {tab === 'profile' && !profileId && !profile && (
          <Spinner label="Loading profile" />
        )}
          </>
        )}
      </main>

      <PeopleSearch
        open={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        onOpenProfile={openProfile}
      />

      <BottomNav active={tab} onChange={go} />
    </div>
  );
}
