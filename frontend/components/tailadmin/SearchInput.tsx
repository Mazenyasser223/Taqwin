import React from 'react';
import { cn } from '../../lib/cn';
import { INPUT_CLASS } from './constants';

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({ className, ...props }) => (
  <div className={cn('relative', className)}>
    <span className="material-symbols-outlined pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-lg text-gray-400">
      search
    </span>
    <input type="search" className={cn(INPUT_CLASS, 'ps-10')} {...props} />
  </div>
);
