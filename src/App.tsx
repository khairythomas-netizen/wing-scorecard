import { useCallback, useEffect, useState } from 'react';
import { BottomNav, type TabId } from './components/BottomNav';
import { BrandLockup } from './components/Brand';
import { MoonIcon, RefreshIcon, SunIcon } from './components/Icons';
import { DiscoverScreen } from './features/discover/DiscoverScreen';
import { FeedScreen } from './features/feed/FeedScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { RankingsScreen } from './features/rankings/RankingsScreen';
import { RateScreen } from './features/rate/RateScreen';
import { StoreContext, store } from './hooks/useStore';
import { ToastProvider, useToast } from './hooks/useToast';
import { useTheme } from './hooks/useTheme';
import { applyUpdate, onUpdateAvailable } from './lib/pwa';

export function App() {
  return (
    <StoreContext.Provider value={store}>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StoreContext.Provider>
  );
}

function Shell() {
  const { theme, toggle } = useTheme();
  const toast = useToast();

  // Rate is the landing tab for now, by product decision.
  const [tab, setTab] = useState<TabId>('rate');
  const [profileId, setProfileId] = useState(store.currentUserId());
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => onUpdateAvailable(setUpdateReady), []);

  const go = useCallback((next: TabId) => {
    setTab(next);
    if (next === 'profile') setProfileId(store.currentUserId());
    window.scrollTo({ top: 0 });
  }, []);

  const openProfile = useCallback((id: string) => {
    setProfileId(id);
    setTab('profile');
    window.scrollTo({ top: 0 });
  }, []);

  const refresh = async () => {
    toast(updateReady ? 'Loading the new version…' : 'Checking for updates…');
    await applyUpdate();
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-[600px] pb-[92px]">
      <header className="safe-top sticky top-0 z-40 flex items-center justify-between border-b border-line bg-[var(--glass)] px-4 pb-2.5 pt-3 backdrop-blur-xl">
        <BrandLockup />
        <div className="flex items-center gap-2">
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
        {tab === 'feed' && <FeedScreen onOpenProfile={openProfile} />}
        {tab === 'discover' && <DiscoverScreen theme={theme} />}
        {tab === 'rate' && <RateScreen onPublished={() => go('feed')} />}
        {tab === 'rankings' && <RankingsScreen />}
        {tab === 'profile' && <ProfileScreen userId={profileId} theme={theme} />}
      </main>

      <BottomNav active={tab} onChange={go} />
    </div>
  );
}
