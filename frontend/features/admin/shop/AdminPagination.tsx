import React from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import { AdminGhostButton } from './adminShopUi';

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export const AdminPagination: React.FC<AdminPaginationProps> = ({
  page,
  totalPages,
  total,
  onPageChange,
}) => {
  const { t } = useI18n();
  if (totalPages <= 1 && total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
      <p className="text-theme-xs font-medium text-gray-500">
        {t('adminShop.pagination.summary', {
          page: String(page),
          totalPages: String(totalPages),
          total: String(total),
        })}
      </p>
      <div className="inline-flex items-center gap-2">
        <AdminGhostButton
          icon="chevron_left"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t('adminShop.pagination.prev')}
        </AdminGhostButton>
        <span className="min-w-[4rem] text-center text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-200">
          {page} / {totalPages}
        </span>
        <AdminGhostButton
          icon="chevron_right"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t('adminShop.pagination.next')}
        </AdminGhostButton>
      </div>
    </div>
  );
};
