// ============================================================================
// CHATVISTA - Input Component
// Reusable input component with validation
// ============================================================================

'use client';

import React, { forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  onRightIconClick?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      onRightIconClick,
      className = '',
      ...props
    },
    ref
  ) => {
    const inputId = props.id || props.name || Math.random().toString(36);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {LeftIcon && (
            <LeftIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          )}

          <input
            ref={ref}
            id={inputId}
            className={`
              w-full px-4 py-3 bg-gray-900 border rounded-xl text-white
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent
              transition-colors
              ${LeftIcon ? 'pl-12' : ''}
              ${RightIcon ? 'pr-12' : ''}
              ${error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-700 focus:ring-blue-500'
              }
              ${className}
            `}
            {...props}
          />

          {RightIcon && (
            <button
              type="button"
              onClick={onRightIconClick}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              <RightIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
        {hint && !error && <p className="mt-1 text-sm text-gray-500">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
