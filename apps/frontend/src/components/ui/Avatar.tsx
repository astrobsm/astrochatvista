// ============================================================================
// CHATVISTA - Avatar Component
// User avatar component with fallback to initials
// ============================================================================

'use client';

import React from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  status?: 'online' | 'offline' | 'busy' | 'away';
}

export function Avatar({
  src,
  name,
  size = 'md',
  className = '',
  status,
}: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
  };

  const statusSizes = {
    xs: 'w-2 h-2',
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-3.5 h-3.5',
    xl: 'w-4 h-4',
  };

  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-500',
    busy: 'bg-red-500',
    away: 'bg-yellow-500',
  };

  // Generate a consistent color based on the name
  const getColor = (name: string) => {
    const colors = [
      'from-blue-500 to-purple-600',
      'from-green-500 to-teal-600',
      'from-orange-500 to-red-600',
      'from-pink-500 to-rose-600',
      'from-indigo-500 to-blue-600',
      'from-cyan-500 to-blue-600',
      'from-violet-500 to-purple-600',
      'from-amber-500 to-orange-600',
    ];
    const index =
      name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      colors.length;
    return colors[index];
  };

  return (
    <div className={`relative inline-flex ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizes[size]} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`
            ${sizes[size]}
            rounded-full bg-gradient-to-br ${getColor(name)}
            flex items-center justify-center font-bold text-white
          `}
        >
          {initials}
        </div>
      )}

      {status && (
        <span
          className={`
            absolute bottom-0 right-0 ${statusSizes[size]} ${statusColors[status]}
            rounded-full border-2 border-gray-900
          `}
        />
      )}
    </div>
  );
}

// Avatar group component
interface AvatarGroupProps {
  avatars: Array<{ src?: string | null; name: string }>;
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function AvatarGroup({ avatars, max = 4, size = 'md' }: AvatarGroupProps) {
  const visibleAvatars = avatars.slice(0, max);
  const remainingCount = avatars.length - max;

  const overlapSizes = {
    xs: '-ml-2',
    sm: '-ml-2.5',
    md: '-ml-3',
    lg: '-ml-4',
    xl: '-ml-5',
  };

  return (
    <div className="flex items-center">
      {visibleAvatars.map((avatar, index) => (
        <div
          key={index}
          className={`${index > 0 ? overlapSizes[size] : ''} ring-2 ring-gray-900 rounded-full`}
        >
          <Avatar src={avatar.src} name={avatar.name} size={size} />
        </div>
      ))}

      {remainingCount > 0 && (
        <div
          className={`
            ${overlapSizes[size]} 
            ${size === 'xs' ? 'w-6 h-6 text-xs' : ''}
            ${size === 'sm' ? 'w-8 h-8 text-sm' : ''}
            ${size === 'md' ? 'w-10 h-10 text-sm' : ''}
            ${size === 'lg' ? 'w-12 h-12 text-base' : ''}
            ${size === 'xl' ? 'w-16 h-16 text-lg' : ''}
            rounded-full bg-gray-700 flex items-center justify-center
            text-white font-medium ring-2 ring-gray-900
          `}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
