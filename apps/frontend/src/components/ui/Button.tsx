// ============================================================================
// CHATVISTA - Button Component
// Reusable button component with variants
// ============================================================================

'use client';

import React from 'react';
import { Loader2, LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = `
    inline-flex items-center justify-center gap-2 font-medium rounded-xl
    transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const variants = {
    primary: `
      bg-gradient-to-r from-blue-500 to-purple-600 text-white
      hover:opacity-90 focus:ring-blue-500 focus:ring-offset-gray-900
    `,
    secondary: `
      bg-gray-700 text-white
      hover:bg-gray-600 focus:ring-gray-500 focus:ring-offset-gray-900
    `,
    outline: `
      bg-transparent border-2 border-gray-600 text-white
      hover:bg-gray-800 focus:ring-gray-500 focus:ring-offset-gray-900
    `,
    ghost: `
      bg-transparent text-gray-300
      hover:bg-gray-800 hover:text-white focus:ring-gray-500 focus:ring-offset-gray-900
    `,
    destructive: `
      bg-red-500 text-white
      hover:bg-red-600 focus:ring-red-500 focus:ring-offset-gray-900
    `,
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <button
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : (
        <>
          {LeftIcon && <LeftIcon className={iconSizes[size]} />}
          {children}
          {RightIcon && <RightIcon className={iconSizes[size]} />}
        </>
      )}
    </button>
  );
}
