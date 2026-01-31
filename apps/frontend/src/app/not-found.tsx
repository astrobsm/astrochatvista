// ============================================================================
// CHATVISTA - 404 Not Found Page
// Custom 404 error page
// ============================================================================

'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Video, Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <Image src="/logo.png" alt="ChatVista" width={40} height={40} className="w-10 h-10 rounded-lg" />
          <span className="text-2xl font-bold text-white">ChatVista</span>
        </Link>

        {/* 404 Text */}
        <div className="mb-8">
          <h1 className="text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
            404
          </h1>
          <h2 className="text-2xl font-bold text-white mt-4 mb-2">
            Page not found
          </h2>
          <p className="text-gray-400">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 transition-colors"
          >
            <Home className="w-5 h-5" />
            Go Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>

        {/* Helpful links */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <p className="text-gray-500 mb-4">Maybe try one of these:</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
              Dashboard
            </Link>
            <span className="text-gray-600">•</span>
            <Link href="/dashboard/meetings" className="text-blue-400 hover:text-blue-300">
              Meetings
            </Link>
            <span className="text-gray-600">•</span>
            <Link href="/dashboard/settings" className="text-blue-400 hover:text-blue-300">
              Settings
            </Link>
            <span className="text-gray-600">•</span>
            <Link href="/help" className="text-blue-400 hover:text-blue-300">
              Help Center
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
