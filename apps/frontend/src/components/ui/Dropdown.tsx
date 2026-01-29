// ============================================================================
// CHATVISTA - Dropdown Component
// Reusable dropdown menu component
// ============================================================================

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface DropdownItem {
  value: string;
  label: string;
  icon?: React.ElementType;
  disabled?: boolean;
}

interface DropdownProps {
  items: DropdownItem[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  fullWidth?: boolean;
}

export function Dropdown({
  items,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  error,
  disabled = false,
  fullWidth = false,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((item) => item.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: DropdownItem) => {
    if (!item.disabled) {
      onChange(item.value);
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      )}

      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          flex items-center justify-between gap-2 w-full px-4 py-3
          bg-gray-900 border rounded-xl text-left transition-colors
          ${error ? 'border-red-500' : 'border-gray-700 hover:border-gray-600'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isOpen ? 'ring-2 ring-blue-500' : ''}
        `}
        disabled={disabled}
      >
        <span className={selectedItem ? 'text-white' : 'text-gray-500'}>
          {selectedItem ? (
            <span className="flex items-center gap-2">
              {selectedItem.icon && <selectedItem.icon className="w-4 h-4" />}
              {selectedItem.label}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-lg overflow-hidden">
          {items.map((item) => (
            <button
              key={item.value}
              onClick={() => handleSelect(item)}
              className={`
                flex items-center justify-between w-full px-4 py-3 text-left transition-colors
                ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'}
                ${item.value === value ? 'bg-blue-500/20 text-blue-400' : 'text-white'}
              `}
              disabled={item.disabled}
            >
              <span className="flex items-center gap-2">
                {item.icon && <item.icon className="w-4 h-4" />}
                {item.label}
              </span>
              {item.value === value && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
