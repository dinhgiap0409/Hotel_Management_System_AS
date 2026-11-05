import { useCallback, useEffect, useState } from 'react';
import { billingApi } from '../../services/billingApi';
import { notifyToast } from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../config/constants';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatVND } from '../../lib/money';
import { formatDateTime } from '../../lib/datetime';

// Phân quyền theo ma trận nghiệp vụ SDD/SRS
const CATALOG_MANAGERS = [ROLES.SERVICE_MANAGER, ROLES.ADMIN];
const CATALOG_VIEW_ALL = [ROLES.SERVICE_MANAGER, ROLES.GENERAL_MANAGER, ROLES.ADMIN];
const ORDER_VIEWERS = [
  ROLES.SERVICE_STAFF,
  ROLES.SERVICE_MANAGER,
  ROLES.FRONT_DESK,
  ROLES.ACCOUNTANT,
  ROLES.GENERAL_MANAGER,
  ROLES.ADMIN,
];
const ORDER_CREATORS = [ROLES.SERVICE_STAFF, ROLES.SERVICE_MANAGER, ROLES.FRONT_DESK, ROLES.ADMIN];
const ORDER_COMPLETERS = [ROLES.SERVICE_STAFF, ROLES.SERVICE_MANAGER, ROLES.ADMIN];
const ORDER_VOIDERS = [ROLES.SERVICE_STAFF, ROLES.SERVICE_MANAGER, ROLES.FRONT_DESK, ROLES.ADMIN];
const VOUCHER_VIEWERS = [ROLES.SALES_MANAGER, ROLES.FRONT_DESK, ROLES.ACCOUNTANT, ROLES.GENERAL_MANAGER, ROLES.ADMIN];

const EMPTY_SERVICE_FORM = {
  serviceName: '',
  category: 'F&B',
  billingUnit: 'Lượt',
  unitPrice: '',
  description: '',
};

const EMPTY_ORDER_FORM = {
  stayId: '',
  serviceId: '',
  quantity: 1,
};

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  fontSize: 13.5,
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 600,
  color: '#334155',
};

export const ServicesAndBillingPage = () => {
  const { user } = useAuth();
  const role = user?.role;

  const canManageCatalog = CATALOG_MANAGERS.includes(role);
  const canViewOrders = ORDER_VIEWERS.includes(role);
  const canCreateOrder = ORDER_CREATORS.includes(role);
  const canComplete = ORDER_COMPLETERS.includes(role);
  const canVoid = ORDER_VOIDERS.includes(role);
  const canViewVouchers = VOUCHER_VIEWERS.includes(role);

  const [activeTab, setActiveTab] = useState('services'); // 'services' | 'orders' | 'vouchers'
  const [services, setServices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vouchers, setVouchers] = useState([]);

  // Modals state
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE_FORM);
  const [editingId, setEditingId] = useState(null);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER_FORM);
  const [activeStays, setActiveStays] = useState([]);
  const [roomSearchKeyword, setRoomSearchKeyword] = useState('');

  const [voidModalData, setVoidModalData] = useState(null); // { order: ..., reason: '' }
  const [busy, setBusy] = useState(false);

  // Filters
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');

  // Pagination states
  const [servicePage, setServicePage] = useState(1);
  const [servicePageSize, setServicePageSize] = useState(5);

  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(5);

  const [voucherPage, setVoucherPage] = useState(1);
  const [voucherPageSize, setVoucherPageSize] = useState(5);

  const loadServices = useCallback(() => {
    const call = CATALOG_VIEW_ALL.includes(role) ? billingApi.getAllServices : billingApi.getActiveServices;
    return call().then((r) => setServices(r.data || [])).catch(() => {});
  }, [role]);

  const loadOrders = useCallback(() => {
    if (!canViewOrders) return Promise.resolve();
    return billingApi.getServiceOrders().then((r) => setOrders(r.data || [])).catch(() => {});
  }, [canViewOrders]);

  useEffect(() => {
    if (!role) return;
    loadServices();
    loadOrders();
    if (canViewVouchers) {
      billingApi.getVouchers().then((r) => setVouchers(r.data || [])).catch(() => {});
    }
  }, [role, canViewVouchers, loadServices, loadOrders]);

  const run = async (action, successMessage, after) => {
    setBusy(true);
    try {
      await action();
      notifyToast({ type: 'SUCCESS', message: successMessage });
      if (after) await after();
    } catch {
      // Toast lỗi đã được bắt tự động bởi http interceptor
    } finally {
      setBusy(false);
    }
  };

  // 1. Quản lý Dịch vụ
  const handleOpenCreateService = () => {
    setEditingId(null);
    setServiceForm(EMPTY_SERVICE_FORM);
    setShowServiceModal(true);
  };

  const handleOpenEditService = (s) => {
    setEditingId(s.serviceId);
    setServiceForm({
      serviceName: s.serviceName,
      category: s.category,
      billingUnit: s.billingUnit,
      unitPrice: s.unitPrice,
      description: s.description || '',
    });
    setShowServiceModal(true);
  };

  const handleServiceSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...serviceForm,
      unitPrice: Number(serviceForm.unitPrice),
    };
    const action = editingId
      ? () => billingApi.updateService(editingId, payload)
      : () => billingApi.createService(payload);

    run(action, editingId ? 'Đã cập nhật dịch vụ thành công.' : 'Đã tạo dịch vụ mới thành công.', async () => {
      setShowServiceModal(false);
      setServiceForm(EMPTY_SERVICE_FORM);
      setEditingId(null);
      await loadServices();
    });
  };

  const toggleStatus = (s) => {
    const next = s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    run(
      () => billingApi.toggleServiceStatus(s.serviceId, next),
      next === 'ACTIVE' ? `Đã mở lại dịch vụ "${s.serviceName}".` : `Đã ngừng cung cấp dịch vụ "${s.serviceName}".`,
      loadServices
    );
  };

  // 2. Quản lý Đơn Dịch Vụ
  const handleOpenCreateOrder = () => {
    setOrderForm(EMPTY_ORDER_FORM);
    setRoomSearchKeyword('');
    billingApi.getActiveStays().then((res) => {
      setActiveStays(res.data || []);
      setShowOrderModal(true);
    }).catch(() => {
      setShowOrderModal(true);
    });
  };

  const handleOrderSubmit = (e) => {
    e.preventDefault();
    const payload = {
      stayId: Number(orderForm.stayId),
      serviceId: Number(orderForm.serviceId),
      quantity: Number(orderForm.quantity),
    };
    run(() => billingApi.createServiceOrder(payload), 'Đã ghi nhận đơn gọi dịch vụ phòng thành công.', async () => {
      setShowOrderModal(false);
      setOrderForm(EMPTY_ORDER_FORM);
      await loadOrders();
    });
  };

  const completeOrder = (o) =>
    run(
      () => billingApi.completeServiceOrder(o.serviceOrderId),
      `Đã hoàn thành đơn #${o.serviceOrderId} và ghi nhận vào Folio lưu trú.`,
      loadOrders
    );

  // 3. Modal Hủy Đơn Chuyên Nghiệp (Thay thế window.prompt)
  const handleOpenVoidModal = (order) => {
    setVoidModalData({ order, reason: '' });
  };

  const handleConfirmVoid = (e) => {
    e.preventDefault();
    if (!voidModalData?.reason?.trim()) {
      notifyToast({ type: 'WARNING', message: 'Vui lòng nhập lý do hủy dịch vụ.' });
      return;
    }
    const { order, reason } = voidModalData;
    run(
      () => billingApi.voidServiceOrder(order.serviceOrderId, reason.trim()),
      `Đã hủy đơn dịch vụ #${order.serviceOrderId}.`,
      async () => {
        setVoidModalData(null);
        await loadOrders();
      }
    );
  };

  // Tính nhẩm tiền cho Order Modal
  const selectedServiceForOrder = services.find((s) => s.serviceId === Number(orderForm.serviceId));
  const estimatedOrderTotal = selectedServiceForOrder
    ? selectedServiceForOrder.unitPrice * (Number(orderForm.quantity) || 1)
    : 0;

  // Lấy thông tin phòng đang chọn và danh sách phòng lọc theo từ khóa tìm kiếm
  const selectedStay = activeStays.find((s) => s.stayId === Number(orderForm.stayId));
  const matchingStays = activeStays.filter((s) => {
    if (!roomSearchKeyword.trim()) return true;
    const kw = roomSearchKeyword.toLowerCase().trim();
    return (
      (s.roomNumber && s.roomNumber.toLowerCase().includes(kw)) ||
      (s.guestName && s.guestName.toLowerCase().includes(kw)) ||
      (s.reservationCode && s.reservationCode.toLowerCase().includes(kw))
    );
  });

  // Dữ liệu hiển thị & Lọc
  const filteredServices = services.filter(
    (s) => !serviceCategoryFilter || s.category.toLowerCase() === serviceCategoryFilter.toLowerCase()
  );
  const totalServicePages = Math.max(1, Math.ceil(filteredServices.length / servicePageSize));
  const paginatedServices = filteredServices.slice(
    (servicePage - 1) * servicePageSize,
    servicePage * servicePageSize
  );

  const filteredOrders = orders.filter((o) => !orderStatusFilter || o.status === orderStatusFilter);
  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));
  const paginatedOrders = filteredOrders.slice(
    (orderPage - 1) * orderPageSize,
    orderPage * orderPageSize
  );

  const totalVoucherPages = Math.max(1, Math.ceil(vouchers.length / voucherPageSize));
  const paginatedVouchers = vouchers.slice(
    (voucherPage - 1) * voucherPageSize,
    voucherPage * voucherPageSize
  );

  const activeServicesCount = services.filter((s) => s.status === 'ACTIVE').length;
  const pendingOrdersCount = orders.filter((o) => o.status === 'ORDERED').length;
  const completedOrdersCount = orders.filter((o) => o.status === 'COMPLETED').length;

  // Component thanh phân trang dùng chung
  const renderPagination = (currentPage, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange) => {
    if (totalItems === 0) return null;
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    const getPageNumbers = () => {
      const pages = [];
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
          pages.push(i);
        } else if (pages[pages.length - 1] !== '...') {
          pages.push('...');
        }
      }
      return pages;
    };

    const paginationBtnStyle = (isActive, isDisabled) => ({
      padding: '5px 10px',
      fontSize: 12.5,
      fontWeight: isActive ? 700 : 500,
      border: '1px solid #cbd5e1',
      borderRadius: 6,
      background: isActive ? '#0284c7' : '#fff',
      color: isActive ? '#fff' : isDisabled ? '#94a3b8' : '#334155',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      opacity: isDisabled ? 0.6 : 1,
    });

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
          padding: '8px 4px',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#64748b' }}>
          <span>
            Hiển thị <strong>{startItem} - {endItem}</strong> trên tổng số <strong>{totalItems}</strong> dòng
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Số dòng:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              style={{
                padding: '4px 8px',
                borderRadius: 5,
                border: '1px solid #cbd5e1',
                fontSize: 12.5,
                background: '#fff',
              }}
            >
              <option value={5}>5 dòng</option>
              <option value={10}>10 dòng</option>
              <option value={20}>20 dòng</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => onPageChange(1)}
            style={paginationBtnStyle(false, currentPage === 1)}
          >
            &laquo; Đầu
          </button>
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            style={paginationBtnStyle(false, currentPage === 1)}
          >
            &lsaquo; Trước
          </button>

          {getPageNumbers().map((p, idx) =>
            p === '...' ? (
              <span key={`dots-${idx}`} style={{ padding: '0 4px', color: '#94a3b8' }}>
                ...
              </span>
            ) : (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(p)}
                style={paginationBtnStyle(currentPage === p, false)}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            style={paginationBtnStyle(false, currentPage === totalPages)}
          >
            Sau &rsaquo;
          </button>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(totalPages)}
            style={paginationBtnStyle(false, currentPage === totalPages)}
          >
            Cuối &raquo;
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      {/* 1. Header Trang */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: 24, fontWeight: 700 }}>
            Dịch Vụ Khách Sạn &amp; Đơn Nội Khu
          </h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13.5 }}>
            Quản lý danh mục dịch vụ tiện ích, đặt dịch vụ cho phòng lưu trú và kiểm tra khuyến mãi.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {canManageCatalog && (
            <button
              onClick={handleOpenCreateService}
              style={{
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                padding: '9px 16px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13.5,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              + Thêm Dịch Vụ Mới
            </button>
          )}
          {canCreateOrder && (
            <button
              onClick={handleOpenCreateOrder}
              style={{
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                padding: '9px 16px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13.5,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              + Đặt Dịch Vụ Cho Phòng
            </button>
          )}
        </div>
      </div>

      {/* 2. Thẻ KPI Thống Kê Tổng Quan (Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <div style={{ background: '#fff', padding: 18, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>Dịch Vụ Đang Mở Bán</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0284c7', marginTop: 4 }}>
            {activeServicesCount}{' '}
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 400 }}>/ {services.length} tổng</span>
          </div>
        </div>
        <div style={{ background: '#fff', padding: 18, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>Tổng Đơn Dịch Vụ</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{orders.length}</div>
        </div>
        <div style={{ background: '#fff', padding: 18, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>Chờ Phục Vụ (ORDERED)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#ea580c', marginTop: 4 }}>{pendingOrdersCount}</div>
        </div>
        <div style={{ background: '#fff', padding: 18, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>Đã Hoàn Thành (COMPLETED)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>{completedOrdersCount}</div>
        </div>
      </div>

      {/* 3. Thanh Chuyển Tab Nghiệp Vụ */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '2px solid #e2e8f0',
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('services')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'services' ? '2px solid #0284c7' : '2px solid transparent',
            color: activeTab === 'services' ? '#0284c7' : '#64748b',
            fontWeight: activeTab === 'services' ? 700 : 500,
            padding: '10px 18px',
            fontSize: 14,
            cursor: 'pointer',
            marginBottom: -2,
          }}
        >
          1. Danh Mục Dịch Vụ ({services.length})
        </button>

        {canViewOrders && (
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'orders' ? '2px solid #0284c7' : '2px solid transparent',
              color: activeTab === 'orders' ? '#0284c7' : '#64748b',
              fontWeight: activeTab === 'orders' ? 700 : 500,
              padding: '10px 18px',
              fontSize: 14,
              cursor: 'pointer',
              marginBottom: -2,
            }}
          >
            2. Đơn Gọi Dịch Vụ Phòng ({orders.length})
          </button>
        )}

        {canViewVouchers && (
          <button
            type="button"
            onClick={() => setActiveTab('vouchers')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'vouchers' ? '2px solid #0284c7' : '2px solid transparent',
              color: activeTab === 'vouchers' ? '#0284c7' : '#64748b',
              fontWeight: activeTab === 'vouchers' ? 700 : 500,
              padding: '10px 18px',
              fontSize: 14,
              cursor: 'pointer',
              marginBottom: -2,
            }}
          >
            3. Mã Khuyến Mãi / Voucher ({vouchers.length})
          </button>
        )}
      </div>

      {/* ======================= TAB 1: DANH MỤC DỊCH VỤ ======================= */}
      {activeTab === 'services' && (
        <div>
          {/* Bộ lọc loại dịch vụ */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Lọc theo nhóm:</span>
              <select
                value={serviceCategoryFilter}
                onChange={(e) => {
                  setServiceCategoryFilter(e.target.value);
                  setServicePage(1);
                }}
                style={{ ...inputStyle, width: 180 }}
              >
                <option value="">Tất cả các nhóm</option>
                <option value="F&B">F&B (Ẩm thực &amp; Bar)</option>
                <option value="SPA">SPA &amp; Massage</option>
                <option value="LAUNDRY">LAUNDRY (Giặt là)</option>
                <option value="TRANSPORT">TRANSPORT (Đưa đón)</option>
                <option value="MINIBAR">MINIBAR (Đồ uống phòng)</option>
              </select>
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Hiển thị <strong>{filteredServices.length}</strong> dịch vụ
            </div>
          </div>

          <DataTable
            keyField="serviceId"
            data={paginatedServices}
            emptyMessage="Không tìm thấy dịch vụ nào phù hợp."
            columns={[
              {
                header: 'Mã DV',
                render: (s) => <code style={{ color: '#0284c7', fontWeight: 600 }}>#{s.serviceId}</code>,
              },
              {
                header: 'Tên Dịch Vụ',
                render: (s) => (
                  <div>
                    <strong style={{ color: '#0f172a' }}>{s.serviceName}</strong>
                    {s.description && (
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.description}</div>
                    )}
                  </div>
                ),
              },
              {
                header: 'Nhóm Dịch Vụ',
                render: (s) => (
                  <span
                    style={{
                      background: '#f1f5f9',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#475569',
                    }}
                  >
                    {s.category}
                  </span>
                ),
              },
              {
                header: 'Đơn Giá / ĐVT',
                render: (s) => (
                  <div>
                    <strong style={{ color: '#0f172a' }}>{formatVND(s.unitPrice)}</strong>
                    <span style={{ color: '#64748b', fontSize: 12 }}> / {s.billingUnit}</span>
                  </div>
                ),
              },
              {
                header: 'Trạng Thái',
                render: (s) => <StatusBadge status={s.status} />,
              },
              ...(canManageCatalog
                ? [
                    {
                      header: 'Hành Động',
                      render: (s) => (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleOpenEditService(s)}
                            style={{
                              background: '#f8fafc',
                              color: '#0284c7',
                              border: '1px solid #cbd5e1',
                              borderRadius: 6,
                              padding: '5px 10px',
                              cursor: 'pointer',
                              fontSize: 12.5,
                              fontWeight: 600,
                            }}
                          >
                            Chỉnh sửa
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => toggleStatus(s)}
                            style={{
                              background: s.status === 'ACTIVE' ? '#fee2e2' : '#dcfce7',
                              color: s.status === 'ACTIVE' ? '#dc2626' : '#166534',
                              border: 'none',
                              borderRadius: 6,
                              padding: '5px 10px',
                              cursor: 'pointer',
                              fontSize: 12.5,
                              fontWeight: 600,
                            }}
                          >
                            {s.status === 'ACTIVE' ? 'Ngừng bán' : 'Mở bán lại'}
                          </button>
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          {renderPagination(
            servicePage,
            totalServicePages,
            filteredServices.length,
            servicePageSize,
            setServicePage,
            setServicePageSize
          )}
        </div>
      )}

      {/* ======================= TAB 2: ĐƠN GỌI DỊCH VỤ ======================= */}
      {activeTab === 'orders' && canViewOrders && (
        <div>
          {/* Bộ lọc trạng thái đơn */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Lọc trạng thái:</span>
              <select
                value={orderStatusFilter}
                onChange={(e) => {
                  setOrderStatusFilter(e.target.value);
                  setOrderPage(1);
                }}
                style={{ ...inputStyle, width: 200 }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ORDERED">ORDERED (Chờ phục vụ)</option>
                <option value="COMPLETED">COMPLETED (Đã cung cấp)</option>
                <option value="VOIDED">VOIDED (Đã hủy dịch vụ)</option>
              </select>
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Hiển thị <strong>{filteredOrders.length}</strong> đơn dịch vụ
            </div>
          </div>

          <DataTable
            keyField="serviceOrderId"
            data={paginatedOrders}
            emptyMessage="Chưa có đơn gọi dịch vụ nào."
            columns={[
              {
                header: 'Mã Đơn',
                render: (o) => <code style={{ color: '#0284c7', fontWeight: 600 }}>#{o.serviceOrderId}</code>,
              },
              {
                header: 'Phòng & Khách Lưu Trú',
                render: (o) => (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          background: '#0284c7',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        Phòng {o.roomNumber || '—'}
                      </span>
                      <strong style={{ color: '#0f172a' }}>{o.guestName || 'Khách vãng lai'}</strong>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
                      Stay #{o.stayId} {o.reservationCode ? `• Mã đặt: ${o.reservationCode}` : ''}
                    </div>
                  </div>
                ),
              },
              {
                header: 'Dịch Vụ Sử Dụng',
                render: (o) => (
                  <div>
                    <strong style={{ color: '#0f172a' }}>{o.serviceName}</strong>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Số lượng: <strong>{o.quantity}</strong> {o.billingUnit}
                    </div>
                  </div>
                ),
              },
              {
                header: 'Đơn Giá & Thành Tiền',
                render: (o) => (
                  <div>
                    <strong style={{ color: '#16a34a' }}>{formatVND(o.totalAmount)}</strong>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      ({formatVND(o.unitPrice)} / {o.billingUnit})
                    </div>
                  </div>
                ),
              },
              {
                header: 'Thời Gian',
                render: (o) => (
                  <div style={{ fontSize: 12.5 }}>
                    <div>{formatDateTime(o.orderTime)}</div>
                    {o.completedAt && (
                      <div style={{ color: '#16a34a', fontSize: 11, marginTop: 2 }}>
                        Xong: {formatDateTime(o.completedAt)}
                      </div>
                    )}
                    {o.cancelledAt && (
                      <div style={{ color: '#dc2626', fontSize: 11, marginTop: 2 }}>
                        Hủy: {formatDateTime(o.cancelledAt)}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                header: 'Trạng Thái',
                render: (o) => (
                  <div>
                    <StatusBadge status={o.status} />
                    {o.status === 'VOIDED' && o.cancelReason && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11.5,
                          color: '#991b1b',
                          background: '#fef2f2',
                          padding: '3px 6px',
                          borderRadius: 4,
                          maxWidth: 220,
                          lineHeight: 1.3,
                          border: '1px solid #fee2e2',
                        }}
                      >
                        <strong>Lý do:</strong> {o.cancelReason}
                      </div>
                    )}
                  </div>
                ),
              },
              ...(canComplete || canVoid
                ? [
                    {
                      header: 'Hành Động',
                      render: (o) =>
                        o.status === 'ORDERED' ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {canComplete && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => completeOrder(o)}
                                style={{
                                  background: '#16a34a',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '5px 10px',
                                  cursor: 'pointer',
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                }}
                              >
                                Hoàn thành
                              </button>
                            )}
                            {canVoid && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleOpenVoidModal(o)}
                                style={{
                                  background: '#fee2e2',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca',
                                  borderRadius: 6,
                                  padding: '5px 10px',
                                  cursor: 'pointer',
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                }}
                              >
                                Hủy đơn
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12.5 }}>Đã xử lý</span>
                        ),
                    },
                  ]
                : []),
            ]}
          />
          {renderPagination(
            orderPage,
            totalOrderPages,
            filteredOrders.length,
            orderPageSize,
            setOrderPage,
            setOrderPageSize
          )}
        </div>
      )}

      {/* ======================= TAB 3: MÃ KHUYẾN MÃI VOUCHER ======================= */}
      {activeTab === 'vouchers' && canViewVouchers && (
        <div>
          <div style={{ marginBottom: 12, color: '#64748b', fontSize: 13 }}>
            Danh sách các mã ưu đãi giảm giá đang có trong hệ thống (Hỗ trợ cấu hình bởi Sales Manager).
          </div>
          <DataTable
            keyField="voucherId"
            data={paginatedVouchers}
            emptyMessage="Không có mã khuyến mãi nào."
            columns={[
              {
                header: 'Mã Voucher',
                render: (v) => (
                  <code style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: 4, fontWeight: 700, color: '#0f172a' }}>
                    {v.code}
                  </code>
                ),
              },
              {
                header: 'Loại Ưu Đãi',
                render: (v) => (v.discountType === 'PERCENTAGE' ? 'Giảm theo phần trăm (%)' : 'Giảm số tiền cố định (VND)'),
              },
              {
                header: 'Giá Trị Giảm',
                render: (v) => (
                  <strong style={{ color: '#0284c7' }}>
                    {v.discountType === 'PERCENTAGE' ? `${v.discountValue}%` : formatVND(v.discountValue)}
                  </strong>
                ),
              },
              {
                header: 'Điều Kiện Đơn Tối Thiểu',
                render: (v) => formatVND(v.minSpend),
              },
              {
                header: 'Lượt Sử Dụng',
                render: (v) => (
                  <span>
                    <strong>{v.usedCount}</strong> / {v.usageLimit}
                  </span>
                ),
              },
              {
                header: 'Trạng Thái',
                render: (v) => <StatusBadge status={v.status} />,
              },
            ]}
          />
          {renderPagination(
            voucherPage,
            totalVoucherPages,
            vouchers.length,
            voucherPageSize,
            setVoucherPage,
            setVoucherPageSize
          )}
        </div>
      )}

      {/* ======================= MODAL: THÊM / SỬA DỊCH VỤ ======================= */}
      {showServiceModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 12,
              width: '100%',
              maxWidth: 520,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: 18 }}>
                {editingId ? 'Cập Nhật Thông Tin Dịch Vụ' : 'Thêm Dịch Vụ Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowServiceModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleServiceSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Tên dịch vụ *</label>
                <input
                  required
                  style={inputStyle}
                  placeholder="Ví dụ: Buffet Sáng Quốc Tế, Giặt Là..."
                  value={serviceForm.serviceName}
                  onChange={(e) => setServiceForm({ ...serviceForm, serviceName: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Nhóm dịch vụ *</label>
                  <select
                    style={inputStyle}
                    value={serviceForm.category}
                    onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                  >
                    <option value="F&B">F&B (Ẩm thực &amp; Đồ uống)</option>
                    <option value="SPA">SPA &amp; Massage</option>
                    <option value="LAUNDRY">LAUNDRY (Giặt là)</option>
                    <option value="TRANSPORT">TRANSPORT (Vận chuyển)</option>
                    <option value="MINIBAR">MINIBAR (Đồ phòng)</option>
                    <option value="OTHER">Dịch vụ khác</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Đơn vị tính *</label>
                  <input
                    required
                    style={inputStyle}
                    placeholder="Lượt, Suất, Vé, KG, Set..."
                    value={serviceForm.billingUnit}
                    onChange={(e) => setServiceForm({ ...serviceForm, billingUnit: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Đơn giá (VND) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  style={inputStyle}
                  placeholder="Nhập giá tiền, ví dụ: 250000"
                  value={serviceForm.unitPrice}
                  onChange={(e) => setServiceForm({ ...serviceForm, unitPrice: e.target.value })}
                />
                {serviceForm.unitPrice > 0 && (
                  <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>
                    Đơn giá hiển thị: <strong>{formatVND(serviceForm.unitPrice)}</strong> / {serviceForm.billingUnit}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Mô tả chi tiết</label>
                <textarea
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="Mô tả quyền lợi, thời gian phục vụ, lưu ý..."
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowServiceModal(false)}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {editingId ? 'Cập Nhật' : 'Lưu Dịch Vụ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: ĐẶT DỊCH VỤ PHÒNG ======================= */}
      {showOrderModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 12,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: 18 }}>Ghi Nhận Đơn Gọi Dịch Vụ Phòng</h3>
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleOrderSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Phòng Đang Lưu Trú Của Khách *</label>

                {/* Nếu đã chọn phòng: Hiển thị Thẻ Xác Nhận */}
                {selectedStay ? (
                  <div
                    style={{
                      background: '#f0f9ff',
                      border: '1.5px solid #0284c7',
                      borderRadius: 8,
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            background: '#0284c7',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 13,
                            padding: '3px 8px',
                            borderRadius: 4,
                          }}
                        >
                          Phòng {selectedStay.roomNumber}
                        </span>
                        <strong style={{ color: '#0f172a', fontSize: 14 }}>
                          {selectedStay.guestName}
                        </strong>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        Mã đặt: <code>{selectedStay.reservationCode || 'N/A'}</code> • Stay #{selectedStay.stayId}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOrderForm({ ...orderForm, stayId: '' })}
                      style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: 6,
                        padding: '5px 10px',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      ✕ Đổi phòng
                    </button>
                  </div>
                ) : (
                  /* Nếu chưa chọn: Hộp Tìm Kiếm Nhanh */
                  <div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        style={{
                          ...inputStyle,
                          paddingLeft: 34,
                          borderColor: matchingStays.length === 0 && roomSearchKeyword ? '#fca5a5' : '#cbd5e1',
                        }}
                        placeholder="Gõ số phòng (VD: 101, 201...) hoặc tên khách..."
                        value={roomSearchKeyword}
                        onChange={(e) => setRoomSearchKeyword(e.target.value)}
                        autoFocus
                      />
                      <span
                        style={{
                          position: 'absolute',
                          left: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: 15,
                          color: '#94a3b8',
                        }}
                      >
                        🔍
                      </span>
                      {roomSearchKeyword && (
                        <button
                          type="button"
                          onClick={() => setRoomSearchKeyword('')}
                          style={{
                            position: 'absolute',
                            right: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: 14,
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Danh sách kết quả gợi ý */}
                    <div
                      style={{
                        marginTop: 6,
                        maxHeight: 180,
                        overflowY: 'auto',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        background: '#fff',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                      }}
                    >
                      {activeStays.length === 0 ? (
                        <div style={{ padding: 12, textAlign: 'center', fontSize: 13, color: '#dc2626' }}>
                          ⚠️ Hiện tại khách sạn không có phòng nào đang lưu trú (Check-in).
                        </div>
                      ) : matchingStays.length === 0 ? (
                        <div style={{ padding: 12, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
                          Không tìm thấy phòng nào khớp với "{roomSearchKeyword}".
                        </div>
                      ) : (
                        matchingStays.map((s) => (
                          <div
                            key={s.stayId}
                            onClick={() => {
                              setOrderForm({ ...orderForm, stayId: s.stayId });
                              setRoomSearchKeyword('');
                            }}
                            style={{
                              padding: '8px 12px',
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                style={{
                                  background: '#e0f2fe',
                                  color: '#0369a1',
                                  fontWeight: 700,
                                  fontSize: 12,
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                }}
                              >
                                Phòng {s.roomNumber}
                              </span>
                              <span style={{ fontSize: 13.5, color: '#0f172a', fontWeight: 500 }}>
                                {s.guestName}
                              </span>
                            </div>
                            <span style={{ fontSize: 12, color: '#64748b' }}>
                              {s.reservationCode ? `Mã: ${s.reservationCode}` : `Stay #${s.stayId}`}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    {/* Thẻ input ẩn để form HTML5 bắt validate required */}
                    <input
                      tabIndex={-1}
                      required
                      style={{ opacity: 0, height: 0, width: 0, position: 'absolute' }}
                      value={orderForm.stayId}
                      onChange={() => {}}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Chọn Dịch Vụ Cần Dùng *</label>
                <select
                  required
                  style={inputStyle}
                  value={orderForm.serviceId}
                  onChange={(e) => setOrderForm({ ...orderForm, serviceId: e.target.value })}
                >
                  <option value="">— Vui lòng chọn dịch vụ —</option>
                  {services
                    .filter((s) => s.status === 'ACTIVE')
                    .map((s) => (
                      <option key={s.serviceId} value={s.serviceId}>
                        [{s.category}] {s.serviceName} — {formatVND(s.unitPrice)} / {s.billingUnit}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Số lượng *</label>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  style={inputStyle}
                  value={orderForm.quantity}
                  onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                />
              </div>

              {selectedServiceForOrder && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b' }}>
                    <span>Đơn giá dịch vụ:</span>
                    <span>{formatVND(selectedServiceForOrder.unitPrice)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 6 }}>
                    <span>Tạm tính thành tiền:</span>
                    <span style={{ color: '#16a34a' }}>{formatVND(estimatedOrderTotal)}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Xác Nhận Đặt Đơn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: HỦY ĐƠN DỊCH VỤ CHUYÊN DỤNG (THAY WINDOW.PROMPT) ======================= */}
      {voidModalData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 12,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              borderTop: '4px solid #dc2626',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: '#991b1b', fontSize: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⚠️</span> Hủy Đơn Gọi Dịch Vụ #{voidModalData.order?.serviceOrderId}
              </h3>
              <button
                type="button"
                onClick={() => setVoidModalData(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}
              >
                &times;
              </button>
            </div>

            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                borderRadius: 8,
                padding: 12,
                fontSize: 13,
                color: '#7f1d1d',
                marginBottom: 16,
              }}
            >
              <div>
                <strong>Dịch vụ:</strong> {voidModalData.order?.serviceName} (Số lượng: {voidModalData.order?.quantity})
              </div>
              <div>
                <strong>Lượt lưu trú:</strong> Stay #{voidModalData.order?.stayId}
                {voidModalData.order?.guestName && ` - ${voidModalData.order.guestName}`}
              </div>
              <div style={{ marginTop: 4 }}>
                <strong>Tổng số tiền:</strong> {formatVND(voidModalData.order?.totalAmount)}
              </div>
            </div>

            <form onSubmit={handleConfirmVoid}>
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>
                  Lý do hủy dịch vụ <span style={{ color: '#dc2626' }}>* (Bắt buộc)</span>
                </label>
                <textarea
                  required
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="Nhập nguyên nhân hủy (Ví dụ: Khách đổi ý, bộ phận nhà bếp hết nguyên liệu...)"
                  value={voidModalData.reason}
                  onChange={(e) => setVoidModalData({ ...voidModalData, reason: e.target.value })}
                />
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                  Lý do này sẽ được lưu vào biên bản kiểm toán hệ thống để phục vụ đối soát.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setVoidModalData(null)}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Xác Nhận Hủy Đơn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
