// ============================================================================
// CHATVISTA - Control Button Component
// Reusable control button for meeting room controls
// ============================================================================

'use client';

import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface ControlButtonProps {
  icon: LucideIcon | ReactNode;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
  isDestructive?: boolean;
  isDisabled?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  badge?: string | number;
  variant?: 'default' | 'danger' | 'active';
  shortcut?: string;
  className?: string;
}

export function ControlButton({
  icon,
  label,
  onClick,
  isActive = false,
  isDestructive = false,
  isDisabled = false,
  showLabel = true,
  size = 'md',
  badge,
  variant = 'default',
  shortcut: _shortcut,
  className = '',
}: ControlButtonProps) {
  // Derive active/destructive from variant if not explicitly set
  const effectiveIsActive = variant === 'active' || isActive;
  const effectiveIsDestructive = variant === 'danger' || isDestructive;
  const sizeClasses = {
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  // Render icon - either as a component or directly
  const renderIcon = () => {
    if (React.isValidElement(icon)) {
      return icon;
    }
    const IconComponent = icon as LucideIcon;
    return <IconComponent className={iconSizes[size]} />;
  };

  const getButtonClasses = () => {
    const base = `
      relative flex flex-col items-center gap-1.5 rounded-xl transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900
    `;

    if (isDisabled) {
      return `${base} ${sizeClasses[size]} bg-gray-700 text-gray-500 cursor-not-allowed ${className}`;
    }

    if (effectiveIsDestructive) {
      return `${base} ${sizeClasses[size]} bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 ${className}`;
    }

    if (effectiveIsActive) {
      return `${base} ${sizeClasses[size]} bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500 ${className}`;
    }

    return `${base} ${sizeClasses[size]} bg-gray-700/80 text-white hover:bg-gray-600 focus:ring-gray-500 ${className}`;
  };

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={getButtonClasses()}
      title={label}
    >
      <div className="relative">
        {renderIcon()}

        {/* Badge */}
        {badge !== undefined && (
          <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full">
            {badge}
          </span>
        )}
      </div>

      {showLabel && (
        <span className="text-xs font-medium">{label}</span>
      )}
    </button>
  );
}

// Specialized control buttons
export function MuteButton({
  isMuted,
  onClick,
}: {
  isMuted: boolean;
  onClick: () => void;
}) {
  const { Mic, MicOff } = require('lucide-react');
  
  return (
    <ControlButton
      icon={isMuted ? MicOff : Mic}
      label={isMuted ? 'Unmute' : 'Mute'}
      onClick={onClick}
      isActive={!isMuted}
    />
  );
}

export function VideoButton({
  isVideoOff,
  onClick,
}: {
  isVideoOff: boolean;
  onClick: () => void;
}) {
  const { Video, VideoOff } = require('lucide-react');
  
  return (
    <ControlButton
      icon={isVideoOff ? VideoOff : Video}
      label={isVideoOff ? 'Start Video' : 'Stop Video'}
      onClick={onClick}
      isActive={!isVideoOff}
    />
  );
}

export function ScreenShareButton({
  isSharing,
  onClick,
}: {
  isSharing: boolean;
  onClick: () => void;
}) {
  const { Monitor, MonitorOff } = require('lucide-react');
  
  return (
    <ControlButton
      icon={isSharing ? MonitorOff : Monitor}
      label={isSharing ? 'Stop Share' : 'Share Screen'}
      onClick={onClick}
      isActive={isSharing}
    />
  );
}

export function LeaveButton({
  onClick,
}: {
  onClick: () => void;
}) {
  const { PhoneOff } = require('lucide-react');
  
  return (
    <ControlButton
      icon={PhoneOff}
      label="Leave"
      onClick={onClick}
      isDestructive
    />
  );
}
