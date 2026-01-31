// ============================================================================
// CHATVISTA - Service Worker Registration Component
// Client-side component to register the PWA service worker
// ============================================================================

'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      // Register service worker after page load
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((registration) => {
            console.log('[PWA] Service worker registered:', registration.scope);

            // Check for updates periodically
            setInterval(() => {
              registration.update();
            }, 60 * 60 * 1000); // Check every hour

            // Handle updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New version available - could show notification to user
                    console.log('[PWA] New version available');
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.error('[PWA] Service worker registration failed:', error);
          });
      });

      // Handle controller change (when SW updates)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] New service worker activated');
      });
    }
  }, []);

  // Also handle the beforeinstallprompt event for install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Store the event for later use
      (window as any).deferredPrompt = e;
      console.log('[PWA] Install prompt ready');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  return null; // This component doesn't render anything
}

// Hook to use the install prompt
export function useInstallPrompt() {
  const promptInstall = async () => {
    const deferredPrompt = (window as any).deferredPrompt;
    if (!deferredPrompt) {
      console.log('[PWA] No install prompt available');
      return false;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for user response
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] Install prompt outcome:', outcome);

    // Clear the stored prompt
    (window as any).deferredPrompt = null;

    return outcome === 'accepted';
  };

  return { promptInstall };
}
