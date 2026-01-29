// ============================================================================
// CHATVISTA - Global Error Page
// Custom error page for runtime errors
// ============================================================================

'use client';

import React, { useEffect } from 'react';
import { Video, RefreshCw, Home, AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <a href="/" className="inline-flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Video className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">ChatVista</span>
        </a>

        {/* Error Icon */}
        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>

        {/* Error Message */}
        <h1 className="text-2xl font-bold text-white mb-2">
          Oops! Something went wrong
        </h1>
        <p className="text-gray-400 mb-6">
          We encountered an unexpected error. Don't worry, our team has been notified.
        </p>

        {/* Error Details (dev only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 p-4 bg-gray-800 border border-gray-700 rounded-xl text-left">
            <p className="text-red-400 font-mono text-sm">{error.message}</p>
            {error.digest && (
              <p className="text-gray-500 text-xs mt-2">Digest: {error.digest}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>
          <a
            href="/"
            className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-700 transition-colors"
          >
            <Home className="w-5 h-5" />
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
