import React, { useState, useRef, useEffect } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChevronDown, Check } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options?: SelectOption[];
  placeholder?: string;
  className?: string;
  placement?: 'auto' | 'top' | 'bottom';
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  className,
  placement = 'auto',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPlacement, setDropdownPlacement] = useState<'top' | 'bottom'>('bottom');
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options?.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && placement === 'auto' && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const dropdownHeight = dropdownRef.current?.offsetHeight || 200;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setDropdownPlacement('top');
      } else {
        setDropdownPlacement('bottom');
      }
    } else if (placement !== 'auto') {
      setDropdownPlacement(placement);
    }
  }, [isOpen, placement]);

  const finalPlacement = placement === 'auto' ? dropdownPlacement : placement;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-2.5 bg-white border rounded-xl text-sm transition-all duration-200',
          isOpen
            ? 'border-[#6366f1] ring-2 ring-[#6366f1]/10 shadow-sm'
            : 'border-[#e2e8f0] hover:border-[#94a3b8]'
        )}
      >
        <span className={selectedOption ? 'text-[#334155]' : 'text-[#94a3b8]'}>
          {selectedOption?.label || placeholder || '请选择'}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-[#64748b] transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            'absolute z-50 w-full bg-white border border-[#e2e8f0] rounded-xl shadow-lg overflow-hidden',
            finalPlacement === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1'
          )}
        >
          <div className="py-1">
            {options?.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange?.(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full px-4 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between',
                  value === option.value
                    ? 'bg-[#f0f4ff] text-[#6366f1] font-medium'
                    : 'text-[#334155] hover:bg-[#f8fafc]'
                )}
              >
                {option.label}
                {value === option.value && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
