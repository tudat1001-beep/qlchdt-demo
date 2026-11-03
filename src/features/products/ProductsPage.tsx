import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, Edit2, Smartphone, RefreshCw, ArrowUpDown, Layers } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatVND, formatNumber } from '../../lib/formatters';
import { api, ApiClientError } from '../../lib/api-client';
import { ProductModal } from './ProductModal';
import { DevicesModal } from './DevicesModal';
import type { Product, ProductKind } from '../../types/catalog';

type SortField = 'sku' | 'name' | 'sale_price' | 'stock_quantity';
type SortDirection = 'asc' | 'desc';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [selectedKind, setSelectedKind] = useState<ProductKind | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('sku');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Devices inspection modal
  const [deviceModalInfo, setDeviceModalInfo] = useState<{
    isOpen: boolean;
    productId: string | null;
    productName: string | null;
  }>({
    isOpen: false,
    productId: null,
    productName: null,
  });

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearchQuery.trim()) {
        params.set('q', debouncedSearchQuery.trim());
      }
      if (selectedKind !== 'ALL') {
        params.set('kind', selectedKind);
      }

      const qs = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get<{ items: Product[] }>(`/products${qs}`);
      setProducts(response.items || []);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Không thể tải danh sách sản phẩm');
      }
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchQuery, selectedKind]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedProducts = useMemo(() => {
    const list = [...products];
    return list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'sku') {
        cmp = a.sku.localeCompare(b.sku);
      } else if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name, 'vi');
      } else if (sortField === 'sale_price') {
        cmp = (a.sale_price || 0) - (b.sale_price || 0);
      } else if (sortField === 'stock_quantity') {
        cmp = (a.stock_quantity || 0) - (b.stock_quantity || 0);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [products, sortField, sortDirection]);

  const handleCreate = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleEdit = (prod: Product) => {
    setEditingProduct(prod);
    setIsModalOpen(true);
  };

  const handleOpenDevices = (prod?: Product) => {
    if (prod) {
      setDeviceModalInfo({
        isOpen: true,
        productId: prod.id,
        productName: prod.name,
      });
    } else {
      setDeviceModalInfo({
        isOpen: true,
        productId: null,
        productName: 'Tất cả thiết bị',
      });
    }
  };

  return (
    <>
      {/* Action Toolbar */}
      <div className="toolbar-card">
        <div className="toolbar-group">
          {/* Tabs for Kind - simplified labels per UX review */}
          <div className="tabs-container" role="tablist" aria-label="Lọc theo loại hàng hóa">
            <button
              type="button"
              role="tab"
              aria-selected={selectedKind === 'ALL'}
              className={`tab-btn ${selectedKind === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedKind('ALL')}
            >
              Tất cả
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedKind === 'PHONE'}
              className={`tab-btn ${selectedKind === 'PHONE' ? 'active' : ''}`}
              onClick={() => setSelectedKind('PHONE')}
            >
              Điện thoại
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedKind === 'ACCESSORY'}
              className={`tab-btn ${selectedKind === 'ACCESSORY' ? 'active' : ''}`}
              onClick={() => setSelectedKind('ACCESSORY')}
            >
              Phụ kiện
            </button>
          </div>

          {/* Search Box */}
          <div className="search-input-wrapper">
            <Search size={15} />
            <input
              type="search"
              className="search-input"
              placeholder="Tìm theo mã SKU, tên, model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Tìm kiếm sản phẩm"
            />
          </div>
        </div>

        <div className="toolbar-group">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => handleOpenDevices()}
            icon={<Smartphone size={14} />}
          >
            Tra cứu IMEI
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={fetchProducts}
            isLoading={isLoading}
            icon={<RefreshCw size={14} />}
            aria-label="Làm mới danh sách"
          >
            Làm mới
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={handleCreate}
            icon={<Plus size={16} />}
          >
            Thêm sản phẩm
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '6px',
            color: '#b91c1c',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {/* MISA Compact Desktop Table */}
      <div className="table-card">
        {isLoading && products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#64748b' }}>
              <RefreshCw size={16} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Đang tải danh mục hàng hóa...</span>
            </div>
          </div>
        ) : sortedProducts.length === 0 ? (
          <EmptyState
            icon={<Layers size={28} />}
            title="Chưa có dữ liệu hàng hóa"
            description="Danh mục sản phẩm hiện đang trống. Hãy thêm sản phẩm điện thoại hoặc phụ kiện đầu tiên để bắt đầu."
            actionLabel="Thêm sản phẩm mới"
            onAction={handleCreate}
          />
        ) : (
          <div className="table-responsive-wrapper products-table">
            <table className="table-misa" aria-label="Bảng danh mục hàng hóa">
              <thead>
                <tr>
                  <th
                    style={{ width: '130px' }}
                    className="sortable"
                    onClick={() => handleSort('sku')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Mã SKU</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    className="sortable"
                    onClick={() => handleSort('name')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Tên sản phẩm</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th style={{ width: '110px' }} className="col-center">Phân loại</th>
                  <th style={{ width: '130px' }}>Thương hiệu</th>
                  <th style={{ width: '140px' }}>Dòng / Thuộc tính</th>
                  <th
                    style={{ width: '130px' }}
                    className="col-num sortable"
                    onClick={() => handleSort('sale_price')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      <span>Giá bán</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th style={{ width: '90px' }} className="col-num">Tồn tối thiểu</th>
                  <th
                    style={{ width: '90px' }}
                    className="col-num sortable"
                    onClick={() => handleSort('stock_quantity')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      <span>Tồn kho</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th style={{ width: '130px' }} className="col-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((prod) => {
                  const isLowStock =
                    prod.min_stock !== null &&
                    prod.min_stock !== undefined &&
                    (prod.stock_quantity || 0) <= prod.min_stock;

                  return (
                    <tr key={prod.id}>
                      <td className="col-sku" data-label="Mã SKU">{prod.sku}</td>
                      <td data-label="Tên sản phẩm">
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{prod.name}</div>
                        {prod.variant && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Bản: {prod.variant}</div>
                        )}
                      </td>
                      <td className="col-center" data-label="Phân loại">
                        <Badge variant={prod.kind === 'PHONE' ? 'phone' : 'accessory'}>
                          {prod.kind === 'PHONE' ? 'Điện thoại' : 'Phụ kiện'}
                        </Badge>
                      </td>
                      <td data-label="Thương hiệu">{prod.brand || '—'}</td>
                      <td data-label="Dòng / Thuộc tính">
                        <div>{prod.model || '—'}</div>
                        {(prod.color || prod.storage) && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {[prod.storage, prod.color].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </td>
                      <td className="col-money" data-label="Giá bán">{formatVND(prod.sale_price)}</td>
                      <td className="col-num" data-label="Tồn tối thiểu" style={{ color: '#64748b' }}>
                        {formatNumber(prod.min_stock)}
                      </td>
                      <td className="col-num" data-label="Tồn kho">
                        <span
                          style={{
                            fontWeight: 700,
                            color: isLowStock ? '#dc2626' : '#15803d',
                          }}
                        >
                          {formatNumber(prod.stock_quantity || 0)}
                        </span>
                      </td>
                      <td className="col-center" data-label="Thao tác">
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => handleEdit(prod)}
                            title="Sửa thông tin sản phẩm"
                            aria-label={`Sửa sản phẩm ${prod.name}`}
                          >
                            <Edit2 size={13} />
                            <span>Sửa</span>
                          </Button>

                          {prod.kind === 'PHONE' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDevices(prod)}
                              title="Xem danh sách IMEI"
                              aria-label={`Xem IMEI cho ${prod.name}`}
                              style={{ color: '#0f766e', padding: '4px 6px' }}
                            >
                              <Smartphone size={14} />
                              <span>IMEI</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* MISA Table Footer */}
        <div className="table-footer-pagination">
          <span>
            Tổng cộng: <strong>{products.length}</strong> mặt hàng
          </span>
          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
            Sổ danh mục hàng hóa
          </span>
        </div>
      </div>

      {/* Product Create / Edit Modal */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productToEdit={editingProduct}
        onSuccess={fetchProducts}
      />

      {/* Devices inspection modal */}
      <DevicesModal
        isOpen={deviceModalInfo.isOpen}
        onClose={() => setDeviceModalInfo({ isOpen: false, productId: null, productName: null })}
        productId={deviceModalInfo.productId}
        productName={deviceModalInfo.productName}
      />
    </>
  );
};
