import React, { useState, useEffect, useRef } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './lib/supabase';

// Declare globals for the external CDN libraries loaded in index.html
declare global {
  interface Window {
    pdfjsLib?: any;
    St?: any;
    supabase?: any;
  }
}

interface ToastMessage {
  id: string;
  type: 'info' | 'error' | 'success';
  message: string;
}

export default function App() {
  // =========================================================================
  // REDIRECT DESTINATION CONFIGURATION (Website or File)
  // -------------------------------------------------------------------------
  // When you have your external website link, paste it below:
  // Example: const TARGET_REDIRECT_URL = 'https://my-other-website.com';
  //
  // If left empty (''), it defaults to the local dashboard file (dashboard.html).
  // =========================================================================
  const TARGET_REDIRECT_URL = 'https://krishu573.github.io/FlipStudio-Editor/';
  const AUTH_REDIRECT_FILE = 'dashboard.html';
  const AUTH_DESTINATION_VIEW: 'welcome' | 'login' | 'editor' = 'editor';

  // Navigation views: 'welcome' | 'login' | 'consent' | 'editor'
  const [currentView, setCurrentView] = useState<'welcome' | 'login' | 'consent' | 'editor'>('welcome');

  // User state
  const [user, setUser] = useState<{ email: string; name?: string; avatar?: string; id?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const getDestinationUrl = () => {
    let targetUrl = (typeof TARGET_REDIRECT_URL === 'string' && TARGET_REDIRECT_URL.trim() !== '')
      ? TARGET_REDIRECT_URL.trim()
      : (localStorage.getItem('flipstudio_target_website_url') || '');

    if (targetUrl) {
      if (!/^https?:\/\//i.test(targetUrl) && !targetUrl.startsWith('/')) {
        targetUrl = 'https://' + targetUrl;
      }
      return targetUrl;
    }

    if (AUTH_REDIRECT_FILE && AUTH_REDIRECT_FILE.trim() !== '') {
      try {
        return new URL(AUTH_REDIRECT_FILE, window.location.href).href;
      } catch {
        return AUTH_REDIRECT_FILE;
      }
    }
    return '';
  };

  const navigateToDestination = () => {
    const destUrl = getDestinationUrl();
    if (destUrl) {
      window.location.href = destUrl;
    } else {
      setCurrentView(AUTH_DESTINATION_VIEW);
    }
  };

  // When user clicks 'Get Started':
  // If already signed in -> Go directly to destination page (editor / custom page)
  // If not signed in -> Ask to sign in with Google
  const handleGetStarted = () => {
    if (user || localStorage.getItem('flipstudio_auth_user') || localStorage.getItem('flipcraft_google_user')) {
      navigateToDestination();
    } else {
      setCurrentView('login');
    }
  };

  // Editor and Flipbook state
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [loadingStatusText, setLoadingStatusText] = useState('Parsing document pages...');
  const [hasDocument, setHasDocument] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Refs
  const bookContainerRef = useRef<HTMLDivElement>(null);
  const bookElementRef = useRef<HTMLDivElement>(null);
  const fullscreenTargetRef = useRef<HTMLDivElement>(null);
  const pageFlipInstanceRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Safe PDF.js worker initialization
  const initPdfWorker = () => {
    if (window.pdfjsLib) {
      try {
        const workerScriptUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerScriptUrl;
      } catch (e) {
        console.warn('PDF.js worker setup fallback:', e);
      }
    }
  };

  // Store & sync user profile credentials (email, name, profile picture) on Supabase
  const syncUserToSupabase = async (authUser: any) => {
    if (!authUser) return;

    const email = authUser.email || authUser.user_metadata?.email || '';
    const name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.given_name || (email ? email.split('@')[0] : 'User');
    const avatar = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || '';

    // 1. Permanently update user metadata directly in Supabase Auth (auth.users)
    try {
      await supabase.auth.updateUser({
        data: {
          full_name: name,
          name: name,
          avatar_url: avatar,
          picture: avatar,
          email: email
        }
      });
    } catch (authErr) {
      console.log('Supabase auth metadata update notice:', authErr);
    }

    const userPayload = {
      id: authUser.id,
      email: email,
      name: name,
      full_name: name,
      avatar_url: avatar,
      picture: avatar,
      provider: 'google',
      last_sign_in_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 2. Store in Supabase database tables
    try {
      await supabase.from('profiles').upsert(userPayload, { onConflict: 'id' });
    } catch (e) {
      console.log('Supabase profiles sync error:', e);
    }

    try {
      await supabase.from('users').upsert(userPayload, { onConflict: 'id' });
    } catch (e) {
      console.log('Supabase users sync error:', e);
    }

    try {
      await supabase.from('user_profiles').upsert(userPayload, { onConflict: 'id' });
    } catch (e) {
      console.log('Supabase user_profiles sync error:', e);
    }
  };

  useEffect(() => {
    initPdfWorker();

    // Check URL parameters for OAuth errors
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');
      const errorMsg = searchParams.get('error') || hashParams.get('error');

      if (errorDescription || errorMsg) {
        const msg = errorDescription ? decodeURIComponent(errorDescription) : errorMsg;
        showToast(`Google Login: ${msg}`, 'error');
      }

      const codeParam = searchParams.get('code');
      if (codeParam) {
        supabase.auth.exchangeCodeForSession(codeParam).then(({ data }) => {
          if (data?.session?.user) {
            syncUserToSupabase(data.session.user);
            const googleEmail = data.session.user.email || 'Google User';
            const fullName = data.session.user.user_metadata?.full_name || data.session.user.user_metadata?.name;
            const avatar = data.session.user.user_metadata?.avatar_url || data.session.user.user_metadata?.picture;
            const userData = { email: googleEmail, name: fullName, avatar, id: data.session.user.id };
            setUser(userData);
            localStorage.setItem('flipstudio_auth_user', JSON.stringify(userData));
            localStorage.setItem('flipcraft_google_user', JSON.stringify(userData));
            window.history.replaceState(null, '', window.location.pathname);
            navigateToDestination();
          }
        }).catch(() => {});
      }
    } catch {
      // ignore
    }

    // Listen for Google OAuth callback state changes
    const { data: authSubscription } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      if (session?.user) {
        const googleEmail = session.user.email || session.user.user_metadata?.email || 'Google User';
        const fullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name;
        const avatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture;
        const userData = {
          email: googleEmail,
          name: fullName,
          avatar: avatar,
          id: session.user.id,
        };
        setUser(userData);

        // Automatically store user data in Supabase database
        await syncUserToSupabase(session.user);

        try {
          localStorage.setItem('flipstudio_auth_user', JSON.stringify(userData));
          localStorage.setItem('flipcraft_google_user', JSON.stringify(userData));
          if (window.location.search.includes('code=') || window.location.hash.includes('access_token=')) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        } catch {
          // ignore
        }
        navigateToDestination();
        showToast(`Signed in with Google as ${googleEmail}`, 'success');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.removeItem('flipstudio_auth_user');
        localStorage.removeItem('flipcraft_google_user');
        setCurrentView('welcome');
      }
    });

    // Check active session on load
    supabase.auth.getSession().then(async ({ data }: any) => {
      if (data?.session?.user) {
        const googleEmail = data.session.user.email || data.session.user.user_metadata?.email || 'Google User';
        const fullName = data.session.user.user_metadata?.full_name || data.session.user.user_metadata?.name;
        const avatar = data.session.user.user_metadata?.avatar_url || data.session.user.user_metadata?.picture;
        const activeUserData = {
          email: googleEmail,
          name: fullName,
          avatar: avatar,
          id: data.session.user.id,
        };
        setUser(activeUserData);
        await syncUserToSupabase(data.session.user);
        try {
          localStorage.setItem('flipstudio_auth_user', JSON.stringify(activeUserData));
          localStorage.setItem('flipcraft_google_user', JSON.stringify(activeUserData));
        } catch {}
      }
    }).catch(() => {});

    // Check cached session in localStorage
    try {
      const savedUser = localStorage.getItem('flipstudio_auth_user') || localStorage.getItem('flipcraft_google_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch {
      // ignore
    }

    // Check if current URL is the OAuth Authorization / Consent screen
    const pathname = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;
    const isConsentRoute = pathname.includes('oauth/consent') || search.includes('oauth/consent') || hash.includes('oauth/consent') || search.includes('authorization_id=') || search.includes('view=consent');

    if (isConsentRoute) {
      setCurrentView('consent');
    }

    // Listen for fullscreen change
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);

    // Keyboard navigation for flipbook
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentView === 'editor' && pageFlipInstanceRef.current) {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          pageFlipInstanceRef.current.flipNext();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          pageFlipInstanceRef.current.flipPrev();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      authSubscription?.subscription?.unsubscribe();
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
      if (pageFlipInstanceRef.current) {
        try {
          pageFlipInstanceRef.current.destroy();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [currentView]);

  // If user reaches login view while already authenticated, redirect to destination file
  useEffect(() => {
    if (currentView === 'login' && (user || localStorage.getItem('flipcraft_google_user'))) {
      navigateToDestination();
    }
  }, [currentView, user]);

  // Handle Google Sign In and continue to Google Login page
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);

    try {
      const redirectUrl = getDestinationUrl() || (window.location.origin + window.location.pathname);

      // Request Google OAuth URL with skipBrowserRedirect so we can redirect cleanly to Google login
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error('Google OAuth initialization error:', error);
        showToast(`Google Sign-In Error: ${error.message}`, 'error');
        setAuthLoading(false);
        return;
      }

      // Navigate directly to the Google login page
      if (data?.url) {
        try {
          if (window.top && window.top !== window) {
            window.top.location.href = data.url;
          } else {
            window.location.href = data.url;
          }
        } catch {
          window.location.href = data.url;
        }
      } else {
        // Fallback default redirect
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
          },
        });
      }
    } catch (err: any) {
      console.error('Google Sign In exception:', err);
      showToast(err.message || 'Failed to navigate to Google login page', 'error');
      setAuthLoading(false);
    }
  };

  const handleConsentAllow = async () => {
    if (!user) {
      handleGoogleSignIn();
      return;
    }
    setAuthLoading(true);
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const authorizationId = searchParams.get('authorization_id') || searchParams.get('auth_id');
      const redirectUriParam = searchParams.get('redirect_uri');

      if (authorizationId) {
        try {
          const { data } = await (supabase.auth as any).oauth?.consent?.({
            consent: true,
            authorization_id: authorizationId,
          });
          if (data?.redirect_to) {
            window.location.href = data.redirect_to;
            return;
          }
        } catch (e) {
          console.warn('OAuth consent API note:', e);
        }
      }

      if (redirectUriParam && /^https?:\/\//i.test(redirectUriParam)) {
        window.location.href = redirectUriParam;
        return;
      }

      showToast('Authorization approved! Redirecting...', 'success');
      setTimeout(() => {
        navigateToDestination();
      }, 400);
    } catch (err: any) {
      showToast(err.message || 'Authorization error', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleConsentDeny = () => {
    showToast('Authorization was cancelled.', 'info');
    setCurrentView('welcome');
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    try {
      localStorage.removeItem('flipstudio_auth_user');
      localStorage.removeItem('flipcraft_google_user');
    } catch {
      // ignore
    }
    setHasDocument(false);
    if (pageFlipInstanceRef.current) {
      try {
        pageFlipInstanceRef.current.destroy();
        pageFlipInstanceRef.current = null;
      } catch {
        // ignore
      }
    }
    setCurrentView('welcome');
    showToast('Signed out of workspace.', 'info');
  };

  // Initialize PageFlip instance with rendered page image URLs
  const initFlipbook = (images: string[]) => {
    if (!bookElementRef.current) return;

    const bookElem = bookElementRef.current;
    bookElem.innerHTML = '';

    if (pageFlipInstanceRef.current) {
      try {
        pageFlipInstanceRef.current.destroy();
      } catch {
        // ignore
      }
      pageFlipInstanceRef.current = null;
    }

    if (!window.St || !window.St.PageFlip) {
      showToast('PageFlip 3D engine is loading. Please try again.', 'error');
      return;
    }

    try {
      const containerWidth = bookContainerRef.current?.clientWidth || 800;
      const targetWidth = Math.min(Math.max(Math.floor(containerWidth * 0.42), 290), 550);
      const targetHeight = Math.floor(targetWidth * 1.414);

      const pageFlip = new window.St.PageFlip(bookElem, {
        width: targetWidth,
        height: targetHeight,
        size: 'stretch',
        minWidth: 260,
        maxWidth: 750,
        minHeight: 360,
        maxHeight: 1000,
        showCover: true,
        maxShadowOpacity: 0.5,
        mobileScrollSupport: true,
        usePortrait: true,
        startPage: 0,
        drawShadow: true,
      });

      pageFlipInstanceRef.current = pageFlip;
      pageFlip.loadFromImages(images);

      pageFlip.on('flip', (e: any) => {
        const curr = (typeof e.data === 'number' ? e.data : pageFlip.getCurrentPageIndex()) + 1;
        setCurrentPageIndex(curr);
      });

      pageFlip.on('init', () => {
        setTotalPages(pageFlip.getPageCount());
        setCurrentPageIndex(pageFlip.getCurrentPageIndex() + 1);
      });

      setTimeout(() => {
        if (pageFlip) {
          setTotalPages(pageFlip.getPageCount() || images.length);
          setCurrentPageIndex((pageFlip.getCurrentPageIndex?.() || 0) + 1);
        }
      }, 300);

      setHasDocument(true);
      showToast('Flipbook converted! Drag corners or use arrow buttons to flip.', 'success');
    } catch (err: any) {
      console.error('PageFlip initialization error:', err);
      showToast('Failed to initialize 3D flipbook: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  // Upload and convert real PDF file
  const handlePdfFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Please select a valid PDF file.', 'error');
      return;
    }

    setIsLoadingPdf(true);
    setLoadingStatusText('Reading document bytes...');

    // Backup to Supabase storage if authenticated
    if (user?.id) {
      try {
        supabase.storage
          .from('pdf-books')
          .upload(`${user.id}/${Date.now()}_${file.name}`, file)
          .catch((err: any) => console.log('Supabase storage backup notice:', err));
      } catch {
        // non-blocking
      }
    }

    try {
      const arrayBuffer = await file.arrayBuffer();

      if (!window.pdfjsLib) {
        throw new Error('PDF.js library is still loading. Please check your internet connection.');
      }

      setLoadingStatusText('Parsing document structure...');
      const loadingTask = window.pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true,
      });

      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;

      if (numPages === 0) {
        throw new Error('The selected PDF file contains no pages.');
      }

      const images: string[] = [];

      for (let i = 1; i <= numPages; i++) {
        setLoadingStatusText(`Rendering page ${i} of ${numPages}...`);
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.6 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        images.push(canvas.toDataURL('image/jpeg', 0.92));
      }

      setIsLoadingPdf(false);
      initFlipbook(images);
    } catch (error: any) {
      console.error('PDF parsing error:', error);
      setIsLoadingPdf(false);
      showToast('Failed to parse the selected PDF file: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Flip controls
  const handlePrevPage = () => {
    if (pageFlipInstanceRef.current) {
      pageFlipInstanceRef.current.flipPrev();
    }
  };

  const handleNextPage = () => {
    if (pageFlipInstanceRef.current) {
      pageFlipInstanceRef.current.flipNext();
    }
  };

  const toggleFullScreen = () => {
    if (!fullscreenTargetRef.current) return;

    if (!document.fullscreenElement) {
      fullscreenTargetRef.current.requestFullscreen?.().catch((err: any) => {
        showToast(`Fullscreen request error: ${err.message}`, 'error');
      });
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div className="h-full flex flex-col selection:bg-primary selection:text-on-primary font-sans bg-surface text-on-surface">
      {/* Toast Notification Stack */}
      <div className="fixed top-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center space-x-3 px-4 py-3 rounded-lg border shadow-2xl backdrop-blur-md transition transform duration-200 text-xs font-medium ${
              toast.type === 'error'
                ? 'bg-[#2d1519] border-red-500/40 text-red-200'
                : toast.type === 'success'
                ? 'bg-[#102a1d] border-emerald-500/40 text-emerald-200'
                : 'bg-surface-container-high border-outline-variant/50 text-on-surface'
            }`}
          >
            <i
              className={`fa-solid ${
                toast.type === 'error'
                  ? 'fa-circle-exclamation text-red-400'
                  : toast.type === 'success'
                  ? 'fa-circle-check text-emerald-400'
                  : 'fa-circle-info text-primary'
              }`}
            />
            <span className="flex-grow">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* ================= 1. WELCOME PAGE ================= */}
      {currentView === 'welcome' && (
        <div id="view-welcome" className="flex flex-col min-h-screen">
          <header className="flex justify-between items-center px-8 py-6 border-b border-outline-variant/30 bg-surface-container-low">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                <i className="fa-solid fa-book-open-reader text-primary text-lg"></i>
              </div>
              <span className="text-xl font-heading tracking-tight select-none">
                <span className="text-white font-extrabold">Flip</span>
                <span className="text-[#c0c1ff] font-bold">Studio</span>
              </span>
            </div>
            <div className="flex items-center space-x-3">
              {user && (
                <div className="flex items-center space-x-2.5 bg-surface-container-lowest border border-outline-variant/30 px-3 py-1.5 rounded-full">
                  {user.avatar ? (
                    <img src={user.avatar} alt="Profile" className="w-6 h-6 rounded-full object-cover border border-primary/40" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">
                      <i className="fa-solid fa-user"></i>
                    </div>
                  )}
                  <span className="text-xs font-heading font-medium text-on-surface truncate max-w-[140px]">
                    {user.name || user.email.split('@')[0]}
                  </span>
                  <button onClick={handleLogout} className="text-on-surface-variant hover:text-red-400 text-xs ml-1 transition cursor-pointer" title="Sign out">
                    <i className="fa-solid fa-right-from-bracket"></i>
                  </button>
                </div>
              )}
              <button
                onClick={handleGetStarted}
                className="bg-primary hover:bg-primary-container text-on-primary px-5 py-2 rounded-md font-heading font-semibold text-sm transition shadow-lg shadow-primary/10 cursor-pointer flex items-center space-x-1.5"
              >
                <span>{user ? 'Open FlipStudio Editor' : 'Get Started'}</span> <i className="fa-solid fa-arrow-right ml-1"></i>
              </button>
            </div>
          </header>

          <main className="flex-grow flex flex-col items-center justify-center text-center px-4 max-w-4xl mx-auto space-y-6 py-12">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
              Transform any PDF into a{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-container">
                Digital Flipbook
              </span>
            </h1>
            <p className="text-on-surface-variant text-base md:text-lg max-w-2xl font-sans">
              Experience high-performance 3D page-turning rendering locally inside your browser.
            </p>
            <div className="pt-2">
              <button
                onClick={handleGetStarted}
                className="bg-primary hover:bg-primary-container text-on-primary px-8 py-3 rounded-lg font-heading font-semibold text-sm transition shadow-xl shadow-primary/20 transform hover:-translate-y-0.5 cursor-pointer"
              >
                <span>{user ? 'Continue to Studio' : 'Get Started'}</span> <i className="fa-solid fa-arrow-right ml-1"></i>
              </button>
            </div>

            {/* Feature highlights grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-10 text-left w-full max-w-2xl">
              <div className="bg-surface-container/70 border border-outline-variant/30 p-5 rounded-xl">
                <i className="fa-solid fa-cube text-primary mb-3 text-xl"></i>
                <h4 className="font-heading font-semibold text-sm text-on-surface">3D Physics Simulation</h4>
                <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                  StPageFlip dual-spread rendering with shadow gradients and interactive page dragging for a lifelike reading feel.
                </p>
              </div>
              <div className="bg-surface-container/70 border border-outline-variant/30 p-5 rounded-xl">
                <i className="fa-solid fa-bolt text-primary mb-3 text-xl"></i>
                <h4 className="font-heading font-semibold text-sm text-on-surface">Client-Side PDF Engine</h4>
                <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                  High-speed PDF.js rendering directly inside your browser for maximum speed, privacy, and crisp retina resolution.
                </p>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ================= 2. GOOGLE LOGIN PAGE ================= */}
      {currentView === 'login' && (
        <div id="view-login" className="flex-grow flex items-center justify-center px-4 min-h-screen py-10">
          <div className="bg-surface-container border border-outline-variant/30 p-8 rounded-2xl w-full max-w-md shadow-2xl relative text-center">
            <button
              onClick={() => setCurrentView('welcome')}
              className="absolute top-4 left-4 text-on-surface-variant hover:text-on-surface text-xs font-medium flex items-center transition cursor-pointer"
            >
              <i className="fa-solid fa-arrow-left mr-1.5"></i> Back
            </button>

            {/* Card Header */}
            <div className="mt-4 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-inner">
                <svg className="w-7 h-7" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-heading font-bold text-on-surface">Sign in with Google</h2>
              <p className="text-xs text-on-surface-variant mt-2 max-w-xs mx-auto leading-relaxed">
                Click below to continue with your Google account. Your profile and credentials will be securely saved to Supabase.
              </p>
            </div>

            {/* Google-only Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className="w-full bg-surface-container-lowest hover:bg-surface-container-high text-on-surface border border-outline-variant/40 py-3.5 rounded-xl font-heading font-medium text-sm transition flex items-center justify-center space-x-3 shadow-md hover:shadow-lg cursor-pointer disabled:opacity-50"
            >
              {authLoading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin text-primary"></i>
                  <span>Redirecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ================= 2B. OAUTH AUTHORIZATION / CONSENT SCREEN (/oauth/consent) ================= */}
      {currentView === 'consent' && (
        <div id="view-consent" className="flex-grow flex items-center justify-center px-4 min-h-screen py-10">
          <div className="bg-surface-container border border-outline-variant/30 p-8 rounded-2xl w-full max-w-md shadow-2xl relative text-center">
            <button
              onClick={() => setCurrentView('welcome')}
              className="absolute top-4 left-4 text-on-surface-variant hover:text-on-surface text-xs font-medium flex items-center transition cursor-pointer"
            >
              <i className="fa-solid fa-arrow-left mr-1.5"></i> Back
            </button>

            {/* Card Header */}
            <div className="mt-2 mb-6">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                  <i className="fa-solid fa-book-open-reader text-primary text-xl"></i>
                </div>
                <i className="fa-solid fa-arrow-right-arrow-left text-on-surface-variant/40 text-xs"></i>
                <div className="w-12 h-12 rounded-xl bg-[#102a1d] flex items-center justify-center border border-emerald-500/30 shadow-inner">
                  <i className="fa-solid fa-bolt text-emerald-400 text-lg"></i>
                </div>
              </div>
              <h2 className="text-xl font-heading font-bold text-on-surface">Authorize FlipStudio</h2>
              <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                <span className="text-on-surface font-semibold">FlipStudio Editor</span> requests authorization to access your workspace.
              </p>
            </div>

            {/* User Profile display */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3 mb-5 flex items-center space-x-3">
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-9 h-9 rounded-full object-cover border border-primary/40" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm">
                  <i className="fa-solid fa-user"></i>
                </div>
              )}
              <div className="flex-grow min-w-0 text-left">
                <p className="text-xs font-heading font-semibold text-on-surface truncate">
                  {user?.name || user?.email?.split('@')[0] || 'Google User'}
                </p>
                <p className="text-[11px] text-on-surface-variant truncate">
                  {user?.email || 'Sign in with Google to authorize'}
                </p>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                Supabase
              </span>
            </div>

            {/* Scopes */}
            <div className="bg-surface-container-low/60 rounded-xl p-4 border border-outline-variant/20 mb-6 text-left space-y-3">
              <p className="text-[11px] font-heading font-semibold text-on-surface uppercase tracking-wider">This allows FlipStudio to:</p>
              <div className="flex items-start space-x-2.5 text-xs text-on-surface-variant">
                <i className="fa-solid fa-circle-check text-emerald-400 text-xs mt-0.5 flex-shrink-0"></i>
                <span>Access your profile details (name, email, and avatar)</span>
              </div>
              <div className="flex items-start space-x-2.5 text-xs text-on-surface-variant">
                <i className="fa-solid fa-circle-check text-emerald-400 text-xs mt-0.5 flex-shrink-0"></i>
                <span>Create, load, and render 3D PDF digital flipbooks</span>
              </div>
              <div className="flex items-start space-x-2.5 text-xs text-on-surface-variant">
                <i className="fa-solid fa-circle-check text-emerald-400 text-xs mt-0.5 flex-shrink-0"></i>
                <span>Persist session tokens across workspace launches</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-2.5">
              <button
                onClick={handleConsentAllow}
                disabled={authLoading}
                className="w-full bg-primary hover:bg-primary-container text-on-primary py-3 rounded-xl font-heading font-semibold text-xs transition flex items-center justify-center space-x-2 shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50"
              >
                {authLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Authorizing...</span>
                  </>
                ) : (
                  <>
                    <span>{user ? 'Authorize & Continue to FlipStudio Editor' : 'Sign in with Google & Authorize'}</span>
                    <i className="fa-solid fa-arrow-right text-[11px]"></i>
                  </>
                )}
              </button>
              <button
                onClick={handleConsentDeny}
                className="w-full bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface py-2.5 rounded-xl font-heading font-medium text-xs transition border border-outline-variant/30 cursor-pointer"
              >
                Deny &amp; Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 3. EDITOR DASHBOARD ================= */}
      {currentView === 'editor' && (
        <div id="view-editor" className="flex flex-col h-screen overflow-hidden">
          {/* Top Navigation Bar */}
          <header className="bg-surface-container border-b border-outline-variant/30 px-6 py-3 flex justify-between items-center z-10">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20">
                <i className="fa-solid fa-book-open-reader text-primary text-sm"></i>
              </div>
              <span className="font-heading font-bold text-sm text-on-surface tracking-wide">
                FlipCraft Studio Workspace
              </span>
            </div>
            <div className="flex items-center space-x-3">
              {user?.email && (
                <div className="flex items-center space-x-2 bg-surface-container-lowest border border-outline-variant/30 px-2.5 py-1 rounded-full">
                  {user.avatar ? (
                    <img src={user.avatar} alt="Avatar" className="w-4 h-4 rounded-full" />
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  )}
                  <span id="user-email-display" className="text-xs text-on-surface-variant font-medium">
                    {user.email}
                  </span>
                </div>
              )}

              <label className="bg-primary hover:bg-primary-container text-on-primary px-3.5 py-1.5 rounded-md cursor-pointer text-xs font-heading font-semibold transition flex items-center space-x-2 shadow-sm">
                <i className="fa-solid fa-file-arrow-up"></i>
                <span>Upload &amp; Convert PDF</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  id="pdf-file-input"
                  accept=".pdf,application/pdf"
                  onChange={handlePdfFileSelect}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleLogout}
                className="bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface px-3 py-1.5 rounded-md text-xs transition border border-outline-variant/30 cursor-pointer"
                title="Log Out"
              >
                <i className="fa-solid fa-right-from-bracket"></i>
              </button>
            </div>
          </header>

          {/* Main Viewport Canvas */}
          <div className="flex-grow flex flex-col relative overflow-hidden bg-surface-dim items-center justify-center p-4">
            {/* Loading Indicator Overlay */}
            {isLoadingPdf && (
              <div
                id="loading-spinner"
                className="absolute inset-0 bg-surface-dim/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center"
              >
                <i className="fa-solid fa-spinner fa-spin text-primary text-3xl mb-3"></i>
                <p id="loading-text" className="text-xs font-medium text-on-surface-variant tracking-wide">
                  {loadingStatusText}
                </p>
              </div>
            )}

            {/* Empty State Prompt */}
            {!hasDocument && !isLoadingPdf && (
              <div id="empty-state" className="text-center space-y-4 max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center mx-auto border border-outline-variant/30 shadow-lg">
                  <i className="fa-regular fa-file-pdf text-primary text-2xl"></i>
                </div>
                <h3 className="text-base font-heading font-semibold text-on-surface">No Document Loaded</h3>
                <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                  Upload any PDF file using the control above to render your 3D digital flipbook canvas.
                </p>
                <div className="pt-2 flex items-center justify-center">
                  <label className="bg-primary hover:bg-primary-container text-on-primary px-5 py-2.5 rounded-md cursor-pointer text-xs font-heading font-semibold transition flex items-center space-x-2 shadow-sm">
                    <i className="fa-solid fa-upload"></i>
                    <span>Select PDF File</span>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handlePdfFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Fullscreen Target Wrapper */}
            <div
              ref={fullscreenTargetRef}
              id="fullscreen-target"
              className={`flex flex-col items-center justify-center w-full h-full relative bg-surface-dim ${
                hasDocument ? 'flex' : 'hidden'
              }`}
            >
              {/* Floating Control Dock */}
              <div className="absolute top-4 z-20 bg-surface-container-high/90 backdrop-blur-md border border-outline-variant/40 px-4 py-1.5 rounded-full flex items-center space-x-4 shadow-xl">
                <button
                  onClick={handlePrevPage}
                  className="text-on-surface-variant hover:text-on-surface transition text-xs cursor-pointer p-1"
                  title="Previous Spread (or Left Arrow)"
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                <span id="page-indicator" className="text-xs font-mono text-on-surface tracking-wider select-none">
                  Page {currentPageIndex} / {totalPages || 1}
                </span>
                <button
                  onClick={handleNextPage}
                  className="text-on-surface-variant hover:text-on-surface transition text-xs cursor-pointer p-1"
                  title="Next Spread (or Right Arrow)"
                >
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
                <div className="h-3.5 w-[1px] bg-outline-variant/40"></div>
                <button
                  onClick={toggleFullScreen}
                  className="text-on-surface-variant hover:text-on-surface transition text-xs cursor-pointer p-1"
                  title="Toggle Fullscreen"
                >
                  <i id="fs-icon" className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
                </button>
              </div>

              {/* Flipbook Staging Area */}
              <div
                ref={bookContainerRef}
                id="book-container"
                className="flex items-center justify-center w-full h-full pt-12 pb-4 overflow-hidden"
              >
                <div ref={bookElementRef} id="book" className="st-page-flip-container"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
