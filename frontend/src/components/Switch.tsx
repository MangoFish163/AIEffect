import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Switch: React.FC<SwitchProps> = ({ 
  checked, 
  onChange, 
  disabled = false,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'w-10 h-5',
    md: 'w-12 h-6',
    lg: 'w-14 h-7',
  };

  const dotSizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const dotPositionClasses = {
    sm: { on: 'translate-x-5', off: 'translate-x-0.5' },
    md: { on: 'translate-x-6', off: 'translate-x-0.5' },
    lg: { on: 'translate-x-7', off: 'translate-x-0.5' },
  };

  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative rounded-full transition-all duration-300 ease-out flex items-center p-0.5',
        sizeClasses[size],
        checked 
          ? 'bg-gradient-to-r from-indigo-500 to-purple-500' 
          : 'bg-gray-300',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'cursor-pointer hover:brightness-105'
      )}
    >
      <div
        className={cn(
          'bg-white rounded-full shadow-md transition-all duration-300 ease-out',
          dotSizeClasses[size],
          checked ? dotPositionClasses[size].on : dotPositionClasses[size].off
        )}
      />
    </button>
  );
};
