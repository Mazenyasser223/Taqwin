import React from 'react';
import { cn } from '../../lib/cn';
import { TABLE_HEAD } from './constants';

interface DataTableProps {
  children: React.ReactNode;
  className?: string;
  minWidth?: string;
}

export const DataTable: React.FC<DataTableProps> = ({ children, className, minWidth = '720px' }) => (
  <div className={cn('overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800', className)}>
    <table className="w-full" style={{ minWidth }}>
      {children}
    </table>
  </div>
);

export const DataTableHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead>
    <tr className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-800 dark:bg-white/[0.02]">
      {children}
    </tr>
  </thead>
);

export const DataTableTh: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <th className={cn('px-4 py-3 text-start first:ps-5 last:pe-5', TABLE_HEAD, className)}>{children}</th>
);

export const DataTableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{children}</tbody>
);

export const DataTableRow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <tr className={cn('transition-colors hover:bg-gray-50/60 dark:hover:bg-white/[0.02]', className)}>{children}</tr>
);

export const DataTableTd: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <td className={cn('px-4 py-4 text-theme-sm first:ps-5 last:pe-5', className)}>{children}</td>
);
