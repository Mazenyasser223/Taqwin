import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../../../lib/i18n/useI18n';
import { useDebounce } from '../../../lib/hooks/useDebounce';
import { invalidateAdminShopCache } from '../../../lib/adminShopCache';
import { formatAdminPrice } from './adminShopUi';
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
  AdminFilterChip,
  AdminProductThumb,
  StatusBadge,
  TA_INPUT,
} from './adminShopUi';
import { AdminPagination } from './AdminPagination';
import { AdminFilterSelect } from './AdminFilterSelect';
import uploadService from '../../../services/uploadService';
import adminShopService, { type AdminCategory } from '../../../services/adminShopService';
import type { Product } from '../../../types';
import { AdminCategorySelect } from './AdminCategorySelect';

type ProductFormState = {
  name: string;
  nameAr: string;
  brand: string;
  categoryId: string;
  price: string;
  compareAtPrice: string;
  currency: string;
  slug: string;
  stock: string;
  sortOrder: string;
  imageUrl: string;
  description: string;
  descriptionAr: string;
  isFeatured: boolean;
  isActive: boolean;
};

const EMPTY_FORM: ProductFormState = {
  name: '',
  nameAr: '',
  brand: '',
  categoryId: '',
  price: '',
  compareAtPrice: '',
  currency: 'EGP',
  slug: '',
  stock: '0',
  sortOrder: '0',
  imageUrl: '',
  description: '',
  descriptionAr: '',
  isFeatured: false,
  isActive: true,
};

function flattenCategories(nodes: AdminCategory[]): AdminCategory[] {
  const out: AdminCategory[] = [];
  const walk = (list: AdminCategory[]) => {
    for (const n of list) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export const AdminProductsPage: React.FC = () => {
  const { t, language } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [showArchived, setShowArchived] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(searchParams.get('lowStock') === '1');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkValue, setBulkValue] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [prodRes, catRes, brandRes, settingsRes] = await Promise.all([
      adminShopService.getProducts({
        search: debouncedSearch || undefined,
        brand: brandFilter || undefined,
        categoryId: categoryFilter || undefined,
        active: showArchived ? 'false' : 'true',
        lowStock: lowStockOnly || undefined,
        page,
      }),
      adminShopService.getCategories(),
      adminShopService.getProductBrands(),
      adminShopService.getSettings(),
    ]);
    if (prodRes.error) setError(prodRes.error);
    else {
      setProducts(prodRes.data?.items ?? []);
      setTotalPages(prodRes.data?.totalPages ?? 1);
      setTotal(prodRes.data?.total ?? 0);
    }
    if (!catRes.error) setCategories(catRes.data ?? []);
    if (!brandRes.error) setBrands(brandRes.data?.brands ?? []);
    if (!settingsRes.error && settingsRes.data) setLowStockThreshold(settingsRes.data.lowStockThreshold);
    setLoading(false);
    setSelectedIds(new Set());
  }, [debouncedSearch, showArchived, lowStockOnly, brandFilter, categoryFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, showArchived, lowStockOnly, brandFilter, categoryFilter]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (lowStockOnly) next.set('lowStock', '1');
    else next.delete('lowStock');
    setSearchParams(next, { replace: true });
  }, [lowStockOnly, searchParams, setSearchParams]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      nameAr: product.nameAr ?? '',
      brand: product.brand,
      categoryId: product.categoryId ?? '',
      price: String(product.price),
      compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : '',
      currency: product.currency ?? 'EGP',
      slug: product.slug ?? '',
      stock: String(product.stock),
      sortOrder: String(product.sortOrder ?? 0),
      imageUrl: product.imageUrl ?? '',
      description: product.description ?? '',
      descriptionAr: product.descriptionAr ?? '',
      isFeatured: product.isFeatured ?? false,
      isActive: product.isActive,
    });
    setModalOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    const res = await uploadService.uploadImage(file, 'products');
    setUploading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.url) setForm((f) => ({ ...f, imageUrl: res.url! }));
  };

  const handleSave = async () => {
    const price = Number(form.price);
    if (!form.name.trim() || !form.brand.trim() || !Number.isFinite(price) || price <= 0) {
      setError(t('adminShop.products.validation'));
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      nameAr: form.nameAr.trim() || null,
      brand: form.brand.trim(),
      categoryId: form.categoryId || null,
      price,
      compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : null,
      currency: form.currency.trim() || 'EGP',
      slug: form.slug.trim() || null,
      stock: Number(form.stock) || 0,
      sortOrder: Number(form.sortOrder) || 0,
      imageUrl: form.imageUrl || null,
      description: form.description.trim() || null,
      descriptionAr: form.descriptionAr.trim() || null,
      isFeatured: form.isFeatured,
      isActive: form.isActive,
    };
    const res = editing
      ? await adminShopService.updateProduct(editing.id, payload)
      : await adminShopService.createProduct(payload);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setModalOpen(false);
    invalidateAdminShopCache('products');
    void load();
  };

  const patchProductLocal = (id: string, patch: Partial<Product>) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const removeProductsLocal = (ids: Set<string>) => {
    setProducts((prev) => prev.filter((p) => !ids.has(p.id)));
    setTotal((n) => Math.max(0, n - ids.size));
  };

  const handleArchive = async (product: Product) => {
    if (!window.confirm(t('adminShop.products.archiveConfirm'))) return;
    const previous = products;
    removeProductsLocal(new Set([product.id]));

    const res = await adminShopService.archiveProduct(product.id);
    if (res.error) {
      setProducts(previous);
      setError(res.error);
      return;
    }
    invalidateAdminShopCache('products');
  };

  const handleRestore = async (product: Product) => {
    const previous = products;
    if (showArchived) removeProductsLocal(new Set([product.id]));
    else patchProductLocal(product.id, { isActive: true });

    const res = await adminShopService.updateProduct(product.id, { isActive: true });
    if (res.error) {
      setProducts(previous);
      setError(res.error);
      return;
    }
    if (res.data && !showArchived) patchProductLocal(product.id, res.data);
    invalidateAdminShopCache('products');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(products.map((p) => p.id)));
  };

  const runBulk = async (action: 'archive' | 'restore' | 'setStock' | 'setPrice') => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const value = bulkValue ? Number(bulkValue) : undefined;
    if ((action === 'setStock' || action === 'setPrice') && (!value || !Number.isFinite(value))) {
      setError(t('adminShop.products.bulkValueRequired'));
      return;
    }

    const previous = products;
    const idSet = new Set(ids);

    if (action === 'archive') {
      removeProductsLocal(idSet);
    } else if (action === 'restore') {
      if (showArchived) removeProductsLocal(idSet);
      else setProducts((prev) => prev.map((p) => (idSet.has(p.id) ? { ...p, isActive: true } : p)));
    }

    const res = await adminShopService.bulkProducts(ids, action, value);
    if (res.error) {
      setProducts(previous);
      setError(res.error);
      return;
    }

    if (action === 'setStock' && value !== undefined) {
      setProducts((prev) => prev.map((p) => (idSet.has(p.id) ? { ...p, stock: value } : p)));
    } else if (action === 'setPrice' && value !== undefined) {
      setProducts((prev) => prev.map((p) => (idSet.has(p.id) ? { ...p, price: value } : p)));
    }

    setSelectedIds(new Set());
    invalidateAdminShopCache('products');
  };

  const handleExport = async () => {
    setExporting(true);
    const res = await adminShopService.exportProductsCsv({
      search: debouncedSearch || undefined,
      brand: brandFilter || undefined,
      categoryId: categoryFilter || undefined,
      active: showArchived ? 'false' : 'true',
      lowStock: lowStockOnly || undefined,
    });
    setExporting(false);
    if (res.error) setError(res.error);
  };

  return (
    <div className="space-y-6">
      <AdminPanel
        icon="inventory_2"
        accent="info"
        title={t('adminShop.nav.products')}
        subtitle={t('adminShop.products.manageSub')}
        action={
          <div className="flex flex-wrap gap-2">
            <AdminSecondaryButton disabled={exporting} onClick={() => void handleExport()}>
              {exporting ? t('adminShop.exporting') : t('adminShop.exportCsv')}
            </AdminSecondaryButton>
            <AdminPrimaryButton icon="add" onClick={openCreate}>
              {t('adminShop.products.create')}
            </AdminPrimaryButton>
          </div>
        }
        bodyClassName="space-y-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('adminShop.products.searchPlaceholder')}
            className={`${TA_INPUT} max-w-md`}
          />
          <div className="flex flex-wrap gap-2">
            <AdminFilterSelect
              value={brandFilter}
              onChange={setBrandFilter}
              allLabel={t('adminShop.products.allBrands')}
              options={brands.map((b) => ({ value: b, label: b }))}
            />
            <AdminFilterSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              allLabel={t('adminShop.products.allCategories')}
              options={flatCategories.map((c) => ({
                value: c.id,
                label: language === 'ar' && c.nameAr ? c.nameAr : c.nameEn,
              }))}
            />
            <AdminFilterChip active={showArchived} onClick={() => setShowArchived((v) => !v)}>
              {t('adminShop.products.showArchived')}
            </AdminFilterChip>
            <AdminFilterChip active={lowStockOnly} onClick={() => setLowStockOnly((v) => !v)}>
              {t('adminShop.products.lowStockOnly')}
            </AdminFilterChip>
          </div>
        </div>

        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-500/20 bg-brand-500/5 px-3 py-2">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {t('adminShop.products.selected', { count: String(selectedIds.size) })}
            </span>
            <AdminGhostButton icon="archive" onClick={() => void runBulk('archive')}>
              {t('adminShop.archive')}
            </AdminGhostButton>
            <AdminGhostButton icon="unarchive" onClick={() => void runBulk('restore')}>
              {t('adminShop.products.restore')}
            </AdminGhostButton>
            <input
              type="number"
              className={`${TA_INPUT} max-w-[8rem]`}
              placeholder={t('adminShop.products.bulkValue')}
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
            />
            <AdminGhostButton icon="inventory" onClick={() => void runBulk('setStock')}>
              {t('adminShop.products.bulkStock')}
            </AdminGhostButton>
            <AdminGhostButton icon="sell" onClick={() => void runBulk('setPrice')}>
              {t('adminShop.products.bulkPrice')}
            </AdminGhostButton>
          </div>
        ) : null}

        {error ? <AdminAlert>{error}</AdminAlert> : null}

        {loading ? (
          <AdminLoading label={t('adminShop.loading')} />
        ) : products.length === 0 ? (
          <AdminEmptyState icon="inventory_2" title={t('adminShop.products.empty')} />
        ) : (
          <>
            <AdminTableWrap>
              <AdminTableHead>
                <AdminTableRow>
                  <AdminTh className="w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === products.length && products.length > 0}
                      onChange={toggleSelectAll}
                      aria-label={t('adminShop.products.selectAll')}
                    />
                  </AdminTh>
                  <AdminTh>{t('adminShop.products.colName')}</AdminTh>
                  <AdminTh>{t('adminShop.products.colBrand')}</AdminTh>
                  <AdminTh>{t('adminShop.products.colCategory')}</AdminTh>
                  <AdminTh>{t('adminShop.products.colPrice')}</AdminTh>
                  <AdminTh>{t('adminShop.products.colStock')}</AdminTh>
                  <AdminTh>{t('adminShop.products.colStatus')}</AdminTh>
                  <AdminTh className="text-right">{t('adminShop.products.colActions')}</AdminTh>
                </AdminTableRow>
              </AdminTableHead>
              <tbody>
                {products.map((p) => (
                  <AdminTableRow key={p.id}>
                    <AdminTd>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        aria-label={p.name}
                      />
                    </AdminTd>
                    <AdminTd>
                      <div className="flex items-center gap-3">
                        <AdminProductThumb src={p.imageUrl} alt={p.name} />
                        <div className="min-w-0">
                          <span className="font-semibold text-gray-900 dark:text-white">{p.name}</span>
                          {p.isFeatured ? (
                            <span className="ml-2 inline-flex rounded-md bg-warning-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-warning-500">
                              {t('adminShop.products.featured')}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </AdminTd>
                    <AdminTd>{p.brand}</AdminTd>
                    <AdminTd>{p.category?.nameEn ?? '—'}</AdminTd>
                    <AdminTd className="font-semibold tabular-nums">
                      {formatAdminPrice(p.price, language, p.currency)}
                    </AdminTd>
                    <AdminTd>
                      {p.stock < lowStockThreshold ? (
                        <StatusBadge label={String(p.stock)} status="pending" />
                      ) : (
                        <span className="font-semibold tabular-nums">{p.stock}</span>
                      )}
                    </AdminTd>
                    <AdminTd>
                      <StatusBadge
                        label={p.isActive ? t('adminShop.products.active') : t('adminShop.products.archived')}
                        status={p.isActive ? 'confirmed' : 'cancelled'}
                      />
                    </AdminTd>
                    <AdminTd className="text-right">
                      <div className="inline-flex gap-1">
                        <AdminGhostButton icon="edit" onClick={() => openEdit(p)}>
                          {t('adminShop.edit')}
                        </AdminGhostButton>
                        {p.isActive ? (
                          <AdminGhostButton
                            className="text-error-500 hover:bg-error-500/10"
                            icon="archive"
                            onClick={() => void handleArchive(p)}
                          >
                            {t('adminShop.archive')}
                          </AdminGhostButton>
                        ) : (
                          <AdminGhostButton icon="unarchive" onClick={() => void handleRestore(p)}>
                            {t('adminShop.products.restore')}
                          </AdminGhostButton>
                        )}
                      </div>
                    </AdminTd>
                  </AdminTableRow>
                ))}
              </tbody>
            </AdminTableWrap>
            <AdminPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </>
        )}
      </AdminPanel>

      {modalOpen ? (
        <AdminModal
          title={editing ? t('adminShop.products.editTitle') : t('adminShop.products.createTitle')}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <AdminSecondaryButton onClick={() => setModalOpen(false)}>{t('common.cancel')}</AdminSecondaryButton>
              <AdminPrimaryButton disabled={saving} onClick={() => void handleSave()}>
                {saving ? t('adminShop.saving') : t('common.save')}
              </AdminPrimaryButton>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <AdminFormLabel>{t('adminShop.products.fieldName')}</AdminFormLabel>
              <input className={TA_INPUT} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <AdminFormLabel>{t('adminShop.products.fieldNameAr')}</AdminFormLabel>
              <input className={TA_INPUT} value={form.nameAr} onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))} />
            </div>
            <div>
              <AdminFormLabel>{t('adminShop.products.fieldBrand')}</AdminFormLabel>
              <input className={TA_INPUT} value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
            </div>
            <div>
              <AdminFormLabel>{t('adminShop.products.fieldSlug')}</AdminFormLabel>
              <input className={TA_INPUT} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
            </div>
            <div>
              <AdminFormLabel>{t('adminShop.products.fieldCurrency')}</AdminFormLabel>
              <input className={TA_INPUT} value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
            </div>
            <div>
              <AdminFormLabel>{t('adminShop.products.fieldSortOrder')}</AdminFormLabel>
              <input type="number" className={TA_INPUT} value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <AdminFormLabel>{t('adminShop.products.colCategory')}</AdminFormLabel>
              <AdminCategorySelect
                categories={categories}
                value={form.categoryId}
                onChange={(categoryId) => setForm((f) => ({ ...f, categoryId }))}
                language={language}
                emptyLabel={t('adminShop.products.noCategory')}
                searchPlaceholder={t('adminShop.categories.search')}
              />
            </div>
            <div>
              <AdminFormLabel>{t('adminShop.products.fieldPrice')}</AdminFormLabel>
              <input type="number" min="0" step="0.01" className={TA_INPUT} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            </div>
            <div>
              <AdminFormLabel>{t('adminShop.products.fieldComparePrice')}</AdminFormLabel>
              <input type="number" min="0" step="0.01" className={TA_INPUT} value={form.compareAtPrice} onChange={(e) => setForm((f) => ({ ...f, compareAtPrice: e.target.value }))} />
            </div>
            <div>
              <AdminFormLabel>{t('adminShop.products.fieldStock')}</AdminFormLabel>
              <input type="number" min="0" className={TA_INPUT} value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <AdminFormLabel>{t('adminShop.products.fieldDescription')}</AdminFormLabel>
              <textarea className={`${TA_INPUT} min-h-[72px]`} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <AdminFormLabel>{t('adminShop.products.fieldDescriptionAr')}</AdminFormLabel>
              <textarea className={`${TA_INPUT} min-h-[72px]`} value={form.descriptionAr} onChange={(e) => setForm((f) => ({ ...f, descriptionAr: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <AdminFormLabel>{t('adminShop.products.fieldImage')}</AdminFormLabel>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  className="text-sm text-gray-600 dark:text-gray-400"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImageUpload(file);
                  }}
                />
                {uploading ? <span className="text-theme-xs text-gray-500">{t('adminShop.uploading')}</span> : null}
              </div>
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="" className="mt-3 h-24 w-24 rounded-xl object-cover ring-1 ring-gray-200 dark:ring-gray-700" />
              ) : null}
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))} />
              {t('adminShop.products.fieldFeatured')}
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              {t('adminShop.products.fieldActive')}
            </label>
          </div>
        </AdminModal>
      ) : null}
    </div>
  );
};
