import React, { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import adminShopService, { type AdminCategory } from '../../../services/adminShopService';
import {
  AdminAlert,
  AdminEmptyState,
  AdminFormLabel,
  AdminGhostButton,
  AdminLoading,
  AdminModal,
  AdminPanel,
  AdminPrimaryButton,
  AdminSecondaryButton,
  AdminTableHead,
  AdminTableRow,
  AdminTableWrap,
  AdminTd,
  AdminTh,
  TA_INPUT,
} from './adminShopUi';
import { AdminCategorySelect } from './AdminCategorySelect';

type CategoryForm = {
  nameEn: string;
  nameAr: string;
  icon: string;
  parentId: string;
  sortOrder: string;
};

const EMPTY_FORM: CategoryForm = {
  nameEn: '',
  nameAr: '',
  icon: '',
  parentId: '',
  sortOrder: '0',
};

function flattenForReorder(cats: AdminCategory[]): AdminCategory[] {
  const out: AdminCategory[] = [];
  const walk = (nodes: AdminCategory[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(cats);
  return out;
}

export const AdminCategoriesPage: React.FC = () => {
  const { t, language } = useI18n();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await adminShopService.getCategories();
    if (res.error) setError(res.error);
    else setCategories(res.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (cat: AdminCategory) => {
    setEditing(cat);
    setForm({
      nameEn: cat.nameEn,
      nameAr: cat.nameAr ?? '',
      icon: cat.icon ?? '',
      parentId: cat.parentId ?? '',
      sortOrder: String(cat.sortOrder ?? 0),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nameEn.trim()) {
      setError(t('adminShop.categories.validation'));
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      nameEn: form.nameEn.trim(),
      nameAr: form.nameAr.trim() || null,
      icon: form.icon.trim() || null,
      parentId: form.parentId || null,
      sortOrder: Number(form.sortOrder) || 0,
    };
    const res = editing
      ? await adminShopService.updateCategory(editing.id, payload)
      : await adminShopService.createCategory(payload);
    setSaving(false);
    if (res.error) setError(res.error);
    else {
      setModalOpen(false);
      load();
    }
  };

  const handleDelete = async (cat: AdminCategory) => {
    if (!window.confirm(t('adminShop.categories.deleteConfirm'))) return;
    const res = await adminShopService.deleteCategory(cat.id);
    if (res.error) setError(res.error);
    else load();
  };

  const moveCategory = async (cat: AdminCategory, direction: -1 | 1) => {
    const flatAll = flattenForReorder(categories);
    const siblings = flatAll.filter((c) => (c.parentId ?? null) === (cat.parentId ?? null));
    const idx = siblings.findIndex((c) => c.id === cat.id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) return;
    const a = siblings[idx];
    const b = siblings[swapIdx];
    const res = await adminShopService.reorderCategories([
      { id: a.id, sortOrder: b.sortOrder ?? swapIdx },
      { id: b.id, sortOrder: a.sortOrder ?? idx },
    ]);
    if (res.error) setError(res.error);
    else load();
  };

  const renderRows = (nodes: AdminCategory[], depth = 0): React.ReactNode =>
    nodes.map((cat) => (
      <React.Fragment key={cat.id}>
        <AdminTableRow>
          <AdminTd style={{ paddingInlineStart: `${20 + depth * 18}px` }}>
            <div className="flex items-center gap-2">
              {cat.icon ? (
                <span className="material-symbols-outlined text-base text-brand-500">{cat.icon}</span>
              ) : (
                <span className="material-symbols-outlined text-base text-gray-400">folder</span>
              )}
              <span className="font-semibold text-gray-900 dark:text-white">{cat.nameEn}</span>
            </div>
          </AdminTd>
          <AdminTd className="font-mono text-theme-xs text-gray-500">{cat.slug}</AdminTd>
          <AdminTd className="tabular-nums">{cat.productCount ?? 0}</AdminTd>
          <AdminTd className="tabular-nums">{cat.sortOrder ?? 0}</AdminTd>
          <AdminTd className="text-right">
            <div className="inline-flex flex-wrap justify-end gap-1">
              <AdminGhostButton onClick={() => moveCategory(cat, -1)}>{t('adminShop.categories.moveUp')}</AdminGhostButton>
              <AdminGhostButton onClick={() => moveCategory(cat, 1)}>{t('adminShop.categories.moveDown')}</AdminGhostButton>
              <AdminGhostButton icon="edit" onClick={() => openEdit(cat)}>{t('adminShop.edit')}</AdminGhostButton>
              <AdminGhostButton className="text-error-500 hover:bg-error-500/10" icon="delete" onClick={() => handleDelete(cat)}>
                {t('adminShop.delete')}
              </AdminGhostButton>
            </div>
          </AdminTd>
        </AdminTableRow>
        {cat.children?.length ? renderRows(cat.children, depth + 1) : null}
      </React.Fragment>
    ));

  return (
    <div className="space-y-6">
      <AdminPanel
        icon="category"
        accent="success"
        title={t('adminShop.nav.categories')}
        subtitle={t('adminShop.categories.manageSub')}
        action={<AdminPrimaryButton icon="add" onClick={openCreate}>{t('adminShop.categories.create')}</AdminPrimaryButton>}
        bodyClassName="space-y-4"
      >
        {error ? <AdminAlert>{error}</AdminAlert> : null}

        {loading ? (
          <AdminLoading label={t('adminShop.loading')} />
        ) : categories.length === 0 ? (
          <AdminEmptyState icon="category" title={t('adminShop.categories.empty')} />
        ) : (
          <AdminTableWrap>
            <AdminTableHead>
              <AdminTableRow>
                <AdminTh>{t('adminShop.categories.colName')}</AdminTh>
                <AdminTh>{t('adminShop.categories.colSlug')}</AdminTh>
                <AdminTh>{t('adminShop.categories.colProducts')}</AdminTh>
                <AdminTh>{t('adminShop.categories.colOrder')}</AdminTh>
                <AdminTh className="text-right">{t('adminShop.categories.colActions')}</AdminTh>
              </AdminTableRow>
            </AdminTableHead>
            <tbody>{renderRows(categories)}</tbody>
          </AdminTableWrap>
        )}
      </AdminPanel>

      {modalOpen ? (
        <AdminModal
          title={editing ? t('adminShop.categories.editTitle') : t('adminShop.categories.createTitle')}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <AdminSecondaryButton onClick={() => setModalOpen(false)}>{t('common.cancel')}</AdminSecondaryButton>
              <AdminPrimaryButton disabled={saving} onClick={handleSave}>
                {saving ? t('adminShop.saving') : t('common.save')}
              </AdminPrimaryButton>
            </>
          }
        >
          <div className="grid gap-4">
            <div>
              <AdminFormLabel>{t('adminShop.categories.fieldNameEn')}</AdminFormLabel>
              <input className={TA_INPUT} value={form.nameEn} onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))} />
            </div>
            <div>
              <AdminFormLabel>{t('adminShop.categories.fieldNameAr')}</AdminFormLabel>
              <input className={TA_INPUT} value={form.nameAr} onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))} />
            </div>
            <div>
              <AdminFormLabel>{t('adminShop.categories.fieldIcon')}</AdminFormLabel>
              <input className={TA_INPUT} value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} />
            </div>
            <div>
              <AdminFormLabel>{t('adminShop.categories.parent')}</AdminFormLabel>
              <AdminCategorySelect
                categories={categories}
                value={form.parentId}
                onChange={(parentId) => setForm((f) => ({ ...f, parentId }))}
                language={language}
                emptyLabel={t('adminShop.categories.noParent')}
                searchPlaceholder={t('adminShop.categories.search')}
                excludeCategory={editing}
              />
            </div>
            <div>
              <AdminFormLabel>{t('adminShop.categories.fieldSortOrder')}</AdminFormLabel>
              <input type="number" className={TA_INPUT} value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} />
            </div>
          </div>
        </AdminModal>
      ) : null}
    </div>
  );
};
