import { useCallback, useEffect, useState } from 'react';
import { billingApi } from '../../services/billingApi';
import { notifyToast } from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../config/constants';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatVND } from '../../lib/money';
import { formatDateTime, formatDate } from '../../lib/datetime';

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
const ORDER_COMPLETERS = [ROLES.SERVICE_STAFF, ROLES.SERVICE_MANAGER, ROLES.FRONT_DESK, ROLES.ADMIN];
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
  completeImmediately: true,
};

// Trích xuất & gom nhóm các dịch vụ đặt trước từ specialNotes (gom trùng serviceId để cộng dồn số lượng)
const parseAndGroupPreOrders = (notes) => {
  if (!notes) return [];
  const rawList = notes
    .split('\n')
    .filter((line) => line.includes('[ĐẶT TRƯỚC]'))
    .map((line, idx) => {
      const idMatch = line.match(/Mã DV:\s*(\d+)/);
      const qtyMatch = line.match(/SL:\s*(\d+)/);
      const timeMatch = line.match(/Thời gian:\s*([^|]+)/);
      const detailMatch = line.match(/Chi tiết:\s*(.+)$/);
      const nameMatch = line.match(/\[ĐẶT TRƯỚC\]\s*(.*?)\s*\(Mã DV:/);
      return {
        id: idx,
        serviceName: nameMatch ? nameMatch[1].trim() : 'Dịch vụ đặt trước',
        serviceId: idMatch ? idMatch[1] : '',
        quantity: qtyMatch ? Number(qtyMatch[1]) : 1,
        time: timeMatch ? timeMatch[1].trim() : '',
        detail: detailMatch ? detailMatch[1].trim() : '',
      };
    });

  const map = new Map();
  rawList.forEach((it) => {
    const key = it.serviceId || it.serviceName;
    if (!map.has(key)) {
      map.set(key, { ...it });
    } else {
      const existing = map.get(key);
      existing.quantity = (existing.quantity || 1) + (it.quantity || 1);
      if (it.time && it.time !== 'Không') {
        if (!existing.time || existing.time === 'Không') {
          existing.time = it.time;
        } else if (!existing.time.includes(it.time)) {
          existing.time = `${existing.time}, ${it.time}`;
        }
      }
      if (it.detail && it.detail !== 'Không') {
        if (!existing.detail || existing.detail === 'Không') {
          existing.detail = it.detail;
        } else if (!existing.detail.includes(it.detail)) {
          existing.detail = `${existing.detail}, ${it.detail}`;
        }
      }
    }
  });

  return Array.from(map.values());
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
  const [upcomingPreOrders, setUpcomingPreOrders] = useState([]);

  // Modals state
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE_FORM);
  const [editingId, setEditingId] = useState(null);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER_FORM);
  const [activeStays, setActiveStays] = useState([]);
  const [roomSearchKeyword, setRoomSearchKeyword] = useState('');

  const [voidModalData, setVoidModalData] = useState(null); // { order: ..., reason: '' }
  const [cancelPreOrderModal, setCancelPreOrderModal] = useState(null); // { reservation, item }
  const [confirmActionModal, setConfirmActionModal] = useState(null); // { title, message, details, confirmLabel, onConfirm }
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

  const [preOrderPage, setPreOrderPage] = useState(1);
  const [preOrderPageSize, setPreOrderPageSize] = useState(5);

  const loadServices = useCallback(() => {
    const call = CATALOG_VIEW_ALL.includes(role) ? billingApi.getAllServices : billingApi.getActiveServices;
    return call().then((r) => setServices(r.data || [])).catch(() => { });
  }, [role]);

  const loadOrders = useCallback(() => {
    if (!canViewOrders) return Promise.resolve();
    return billingApi.getServiceOrders().then((r) => setOrders(r.data || [])).catch(() => { });
  }, [canViewOrders]);

  const loadUpcomingPreOrders = useCallback(() => {
    if (!canViewOrders) return Promise.resolve();
    return billingApi.getAllUpcomingPreOrders().then((r) => setUpcomingPreOrders(r.data || [])).catch(() => { });
  }, [canViewOrders]);

  const loadActiveStays = useCallback(() => {
    return billingApi.getActiveStays().then((r) => setActiveStays(r.data || [])).catch(() => { });
  }, []);

  useEffect(() => {
    if (!role) return;
    loadServices();
    loadOrders();
    loadUpcomingPreOrders();
    loadActiveStays();
    if (canViewVouchers) {
      billingApi.getVouchers().then((r) => setVouchers(r.data || [])).catch(() => { });
    }
  }, [role, canViewVouchers, loadServices, loadOrders, loadUpcomingPreOrders, loadActiveStays]);

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
    const shouldComplete = Boolean(orderForm.completeImmediately);
    run(
      async () => {
        const res = await billingApi.createServiceOrder(payload);
        const orderData = res.data?.data || res.data;
        if (shouldComplete && orderData?.serviceOrderId) {
          await billingApi.completeServiceOrder(orderData.serviceOrderId);
        }
        return res;
      },
      shouldComplete
        ? 'Đã nạp dịch vụ vào phòng, hoàn thành đơn và cộng tiền vào Folio thành công!'
        : 'Đã ghi nhận đơn gọi dịch vụ phòng thành công.',
      async () => {
        setShowOrderModal(false);
        setOrderForm(EMPTY_ORDER_FORM);
        await Promise.all([loadOrders(), loadFolios()]);
      }
    );
  };

  // Nạp nhanh 1 dịch vụ đặt trước và tự động hoàn thành để cộng tiền vào Folio ngay
  const handleQuickLoadAndComplete = (matchedStay, item) => {
    if (!matchedStay || !item?.serviceId) return;
    const payload = {
      stayId: Number(matchedStay.stayId),
      serviceId: Number(item.serviceId),
      quantity: Number(item.quantity) || 1,
    };
    run(
      async () => {
        const res = await billingApi.createServiceOrder(payload);
        const orderData = res.data?.data || res.data;
        if (orderData?.serviceOrderId) {
          await billingApi.completeServiceOrder(orderData.serviceOrderId);
        }
        return res;
      },
      `Đã nạp "${item.serviceName}" (SL: ${item.quantity || 1}) vào Phòng ${matchedStay.roomNumber}, hoàn thành đơn và cộng tiền vào Folio!`,
      async () => {
        setShowOrderModal(false);
        await Promise.all([loadOrders(), loadFolios()]);
      }
    );
  };

  // Nạp toàn bộ dịch vụ đặt trước của đơn lưu trú vào Folio trong 1 click
  const handleQuickLoadAllPreOrders = async (reservation, matchedStay, items) => {
    if (!matchedStay || !items || items.length === 0) return;
    const unchargedItems = items.filter((it) => {
      const existing = orders.find(
        (o) => String(o.stayId) === String(matchedStay.stayId) && String(o.serviceId) === String(it.serviceId)
      );
      return !existing;
    });

    if (unchargedItems.length === 0) {
      notifyToast({ type: 'INFO', message: 'Tất cả các dịch vụ đặt trước của khách đã được nạp vào phòng rồi.' });
      return;
    }

    try {
      setBusy(true);
      for (const it of unchargedItems) {
        const res = await billingApi.createServiceOrder({
          stayId: Number(matchedStay.stayId),
          serviceId: Number(it.serviceId),
          quantity: Number(it.quantity) || 1,
        });
        const orderData = res.data?.data || res.data;
        if (orderData?.serviceOrderId) {
          await billingApi.completeServiceOrder(orderData.serviceOrderId);
        }
      }
      notifyToast({
        type: 'SUCCESS',
        message: `Đã nạp thành công ${unchargedItems.length} dịch vụ đặt trước vào Phòng ${matchedStay.roomNumber} và cộng tiền vào Folio!`,
      });
      await Promise.all([loadOrders(), loadFolios()]);
    } catch (err) {
      notifyToast({
        type: 'DANGER',
        message: err.response?.data?.message || 'Có lỗi khi nạp dịch vụ vào phòng.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCancelPreOrder = (reservation, item) => {
    if (!reservation?.reservationId || !item?.serviceId) return;
    setCancelPreOrderModal({ reservation, item });
  };

  const handleConfirmCancelPreOrder = () => {
    if (!cancelPreOrderModal?.reservation?.reservationId || !cancelPreOrderModal?.item?.serviceId) return;
    const { reservation, item } = cancelPreOrderModal;
    run(
      () => billingApi.cancelPreOrder(reservation.reservationId, item.serviceId),
      `Đã hủy thành công dịch vụ đặt trước "${item.serviceName}".`,
      async () => {
        setCancelPreOrderModal(null);
        await Promise.all([loadUpcomingPreOrders(), loadActiveStays()]);
      }
    );
  };

  const handleCancelPreOrderInStay = (stay, item) => {
    if (!stay?.reservationCode || !item?.serviceId) return;
    const res = upcomingPreOrders.find((r) => r.reservationCode === stay.reservationCode);
    if (!res) {
      notifyToast({ type: 'WARNING', message: 'Không tìm thấy thông tin đặt phòng gốc.' });
      return;
    }
    handleCancelPreOrder(res, item);
  };

  const completeOrder = (o) =>
    run(
      () => billingApi.completeServiceOrder(o.serviceOrderId),
      `Đã hoàn thành đơn #${o.serviceOrderId} và ghi nhận vào Folio lưu trú.`,
      async () => {
        await Promise.all([loadOrders(), loadFolios()]);
      }
    );

  // 4. Modal Xác Nhận Hoàn Thành Đơn / Nạp Vào Folio
  const handleOpenCompleteOrderConfirm = (o) => {
    if (!o?.serviceOrderId) return;
    setConfirmActionModal({
      title: 'Xác nhận hoàn thành dịch vụ',
      message: `Bạn có chắc chắn muốn xác nhận hoàn thành đơn dịch vụ #${o.serviceOrderId}?`,
      details: `${o.serviceName || 'Dịch vụ'} (SL: ${o.quantity || 1}) - Phòng ${o.roomNumber || ''}`,
      extra: o.totalAmount ? `Tổng tiền: ${formatVND(o.totalAmount)}` : null,
      confirmLabel: 'Xác nhận hoàn thành & nạp Folio',
      onConfirm: async () => {
        await completeOrder(o);
      },
    });
  };

  const handleOpenQuickLoadAndCompleteConfirm = (matchedStay, item) => {
    if (!matchedStay || !item?.serviceId) return;
    setConfirmActionModal({
      title: 'Xác nhận nạp dịch vụ & tính tiền',
      message: `Bạn có chắc chắn muốn nạp dịch vụ đặt trước vào phòng và hoàn thành ngay?`,
      details: `${item.serviceName} (SL: ${item.quantity || 1}) → Phòng ${matchedStay.roomNumber} (${matchedStay.guestName || ''})`,
      extra: item.unitPrice ? `Đơn giá: ${formatVND(item.unitPrice)}` : null,
      confirmLabel: 'Xác nhận nạp & tính tiền',
      onConfirm: async () => {
        await handleQuickLoadAndComplete(matchedStay, item);
      },
    });
  };

  const handleOpenQuickLoadAllConfirm = (reservation, matchedStay, items) => {
    if (!matchedStay || !items || items.length === 0) return;
    const unchargedItems = items.filter((it) => {
      const existing = orders.find(
        (o) => String(o.stayId) === String(matchedStay.stayId) && String(o.serviceId) === String(it.serviceId)
      );
      return !existing;
    });

    if (unchargedItems.length === 0) {
      notifyToast({ type: 'INFO', message: 'Tất cả các dịch vụ đặt trước của khách đã được nạp vào phòng rồi.' });
      return;
    }

    setConfirmActionModal({
      title: 'Xác nhận nạp tất cả dịch vụ vào phòng',
      message: `Nạp toàn bộ ${unchargedItems.length} dịch vụ đặt trước chưa tính vào Phòng ${matchedStay.roomNumber}?`,
      details: unchargedItems.map((it) => `${it.serviceName} (SL: ${it.quantity || 1})`).join(', '),
      extra: `Khách hàng: ${matchedStay.guestName || reservation?.customerName || ''}`,
      confirmLabel: `Xác nhận nạp ${unchargedItems.length} dịch vụ vào Folio`,
      onConfirm: async () => {
        await handleQuickLoadAllPreOrders(reservation, matchedStay, items);
      },
    });
  };

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

  // Trích xuất danh sách dịch vụ khách đặt trước từ specialNotes (đã gom nhóm) và đối chiếu với các đơn đã tạo
  const preOrdersForSelectedStay = (() => {
    if (!selectedStay?.specialNotes) return [];
    const stayOrders = orders.filter((o) => o.stayId === selectedStay.stayId);
    const grouped = parseAndGroupPreOrders(selectedStay.specialNotes);
    return grouped.map((it) => {
      // Đối chiếu xem dịch vụ này đã được tạo đơn cho phòng chưa và trạng thái hiện tại
      const matchedOrder = stayOrders.find((o) => String(o.serviceId) === String(it.serviceId));
      return {
        ...it,
        scheduledTime: it.time,
        details: it.detail,
        orderStatus: matchedOrder ? matchedOrder.status : 'NOT_CREATED',
        orderId: matchedOrder ? matchedOrder.serviceOrderId : null,
      };
    });
  })();
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

  const totalPreOrderPages = Math.max(1, Math.ceil(upcomingPreOrders.length / preOrderPageSize));
  const paginatedPreOrders = upcomingPreOrders.slice(
    (preOrderPage - 1) * preOrderPageSize,
    preOrderPage * preOrderPageSize
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={{ background: '#fff', padding: 18, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>Dịch Vụ Mở Bán</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0284c7', marginTop: 4 }}>
            {activeServicesCount}{' '}
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 400 }}>/ {services.length}</span>
          </div>
        </div>
        <div style={{ background: '#fff', padding: 18, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>Tổng Đơn Dịch Vụ</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{orders.length}</div>
        </div>
        <div style={{ background: '#fff', padding: 18, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>Chờ Phục Vụ</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#ea580c', marginTop: 4 }}>{pendingOrdersCount}</div>
        </div>
        <div style={{ background: '#fff', padding: 18, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>Đã Hoàn Thành</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>{completedOrdersCount}</div>
        </div>
        <div style={{ background: '#fff', padding: 18, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>✈️ Khách Đặt Trước</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#d97706', marginTop: 4 }}>
            {upcomingPreOrders.length}{' '}
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>chuyến</span>
          </div>
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

        {canViewOrders && (
          <button
            type="button"
            onClick={() => setActiveTab('pre-orders')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'pre-orders' ? '2px solid #0284c7' : '2px solid transparent',
              color: activeTab === 'pre-orders' ? '#0284c7' : '#64748b',
              fontWeight: activeTab === 'pre-orders' ? 700 : 500,
              padding: '10px 18px',
              fontSize: 14,
              cursor: 'pointer',
              marginBottom: -2,
            }}
          >
            3. ✈️ Lịch Đặt Trước Của Khách ({upcomingPreOrders.length})
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
            4. Mã Khuyến Mãi / Voucher ({vouchers.length})
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
                              onClick={() => handleOpenCompleteOrderConfirm(o)}
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

      {/* ======================= TAB 3: LỊCH ĐẶT TRƯỚC DỊCH VỤ ======================= */}
      {activeTab === 'pre-orders' && canViewOrders && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h4 style={{ margin: 0, color: '#0f172a', fontSize: 16, fontWeight: 700 }}>
                ✈️ Lịch Khách Đặt Trước Dịch Vụ (Đón Sân Bay, Buffet, Spa...)
              </h4>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
                Thông tin được khách đặt trước khi nhận phòng. Nhân viên điều phối xe, tài xế và lễ tân theo dõi lịch trình để đón tiếp chu đáo.
              </div>
            </div>
            <button
              type="button"
              onClick={loadUpcomingPreOrders}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              🔄 Làm mới lịch
            </button>
          </div>

          <DataTable
            keyField="reservationId"
            data={paginatedPreOrders}
            emptyMessage="Hiện tại không có lịch đặt trước dịch vụ nào từ khách."
            columns={[
              {
                header: 'Mã Booking & Khách Hàng',
                render: (r) => (
                  <div>
                    <code style={{ color: '#0284c7', fontWeight: 700, fontSize: 13 }}>#{r.reservationCode}</code>
                    <div style={{ fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{r.contactName}</div>
                    {r.contactPhone && (
                      <div style={{ fontSize: 12, color: '#0369a1', marginTop: 2 }}>
                        📞 <a href={`tel:${r.contactPhone}`} style={{ color: '#0369a1', textDecoration: 'none' }}>{r.contactPhone}</a>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                header: 'Ngày Lưu Trú & Hạng Phòng',
                render: (r) => (
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.roomTypeName || 'Phòng tiêu chuẩn'}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Nhận: <strong>{formatDate(r.checkInDate)}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Trả: <strong>{formatDate(r.checkOutDate)}</strong>
                    </div>
                  </div>
                ),
              },
              {
                header: 'Dịch Vụ Khách Đặt Trước',
                render: (r) => {
                  const matchedStay = activeStays.find((s) => s.reservationCode === r.reservationCode);
                  const items = parseAndGroupPreOrders(r.specialNotes);

                  return (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        overflow: 'hidden',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        minWidth: 320,
                        maxWidth: 480,
                      }}
                    >
                      {items.map((it, idx) => {
                        const existingOrder = matchedStay
                          ? orders.find(
                            (o) =>
                              String(o.stayId) === String(matchedStay.stayId) &&
                              String(o.serviceId) === String(it.serviceId)
                          )
                          : null;
                        const isCompleted = existingOrder?.status === 'COMPLETED';
                        const isOrdered = existingOrder?.status === 'ORDERED';

                        return (
                          <div
                            key={idx}
                            style={{
                              padding: '6px 10px',
                              borderTop: idx > 0 ? '1px dashed #e2e8f0' : 'none',
                              fontSize: 12,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <strong style={{ color: '#0f172a' }}>{it.serviceName}</strong>
                                <span style={{ color: '#ea580c', fontWeight: 700, fontSize: 11.5 }}>(SL: {it.quantity})</span>
                                {isCompleted && (
                                  <span
                                    style={{
                                      background: '#dcfce7',
                                      color: '#166534',
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: 4,
                                    }}
                                  >
                                    ✅ Đã tính Folio (#{existingOrder.serviceOrderId})
                                  </span>
                                )}
                                {isOrdered && (
                                  <span
                                    style={{
                                      background: '#fef3c7',
                                      color: '#b45309',
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: 4,
                                    }}
                                  >
                                    ⏳ Đang phục vụ (#{existingOrder.serviceOrderId})
                                  </span>
                                )}
                                {!existingOrder && matchedStay && (
                                  <span
                                    style={{
                                      background: '#fee2e2',
                                      color: '#991b1b',
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: 4,
                                    }}
                                  >
                                    ⚠️ Chưa nạp
                                  </span>
                                )}
                              </div>

                              {/* Nút 1-Click: Tự động nạp vào phòng & hoàn thành để cộng vào Folio hoặc Hủy nếu khách không có nhu cầu */}
                              {!existingOrder && canCreateOrder && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  {matchedStay && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenQuickLoadAndCompleteConfirm(matchedStay, it)}
                                      disabled={busy}
                                      style={{
                                        background: '#16a34a',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '2px 7px',
                                        borderRadius: 4,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 3,
                                        whiteSpace: 'nowrap',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                      }}
                                      title="Nạp vào phòng và tự động hoàn thành đơn để cộng tiền vào Folio ngay"
                                    >
                                      ⚡ Nạp & Hoàn thành
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleCancelPreOrder(r, it)}
                                    disabled={busy}
                                    style={{
                                      background: '#fff',
                                      color: '#dc2626',
                                      border: '1px solid #fca5a5',
                                      padding: '2px 7px',
                                      borderRadius: 4,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title="Khách không có nhu cầu nữa, hủy yêu cầu đặt trước dịch vụ này"
                                  >
                                    ✕ Hủy
                                  </button>
                                </div>
                              )}
                              {isOrdered && canCreateOrder && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCompleteOrderConfirm(existingOrder)}
                                  disabled={busy}
                                  style={{
                                    background: '#15803d',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '2px 7px',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Hoàn thành
                                </button>
                              )}
                            </div>
                            {(it.time || (it.detail && it.detail !== 'Không')) && (
                              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#64748b', marginTop: 2, flexWrap: 'wrap' }}>
                                {it.time && (
                                  <span>
                                    ⏱ Giờ hẹn: <strong style={{ color: '#b45309' }}>{it.time}</strong>
                                  </span>
                                )}
                                {it.detail && it.detail !== 'Không' && (
                                  <span>📍 {it.detail}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                },
              },
              {
                header: 'Trạng Thái & Thao Tác',
                render: (r) => {
                  const matchedStay = activeStays.find((s) => s.reservationCode === r.reservationCode);
                  const items = parseAndGroupPreOrders(r.specialNotes);
                  const hasUncharged =
                    matchedStay &&
                    items.some(
                      (it) =>
                        !orders.some(
                          (o) =>
                            String(o.stayId) === String(matchedStay.stayId) &&
                            String(o.serviceId) === String(it.serviceId)
                        )
                    );

                  return (
                    <div>
                      {matchedStay ? (
                        <div>
                          <span
                            style={{
                              background: '#dcfce7',
                              color: '#166534',
                              fontWeight: 700,
                              fontSize: 12,
                              padding: '3px 8px',
                              borderRadius: 4,
                              display: 'inline-block',
                              marginBottom: 6,
                            }}
                          >
                            🟢 Đã nhận phòng {matchedStay.roomNumber}
                          </span>
                          {canCreateOrder && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {hasUncharged ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenQuickLoadAllConfirm(r, matchedStay, items)}
                                  disabled={busy}
                                  style={{
                                    background: '#15803d',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '5px 10px',
                                    borderRadius: 4,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                  }}
                                  title="Nạp toàn bộ các dịch vụ đặt trước của khách vào Folio cùng một lúc"
                                >
                                  ⚡ Nạp tất cả vào Folio
                                </button>
                              ) : (
                                <span
                                  style={{
                                    background: '#f1f5f9',
                                    color: '#15803d',
                                    border: '1px solid #bbf7d0',
                                    padding: '5px 10px',
                                    borderRadius: 4,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                  }}
                                >
                                  ✅ Đã nạp đủ vào Folio
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span
                            style={{
                              background: '#fef3c7',
                              color: '#b45309',
                              fontWeight: 600,
                              fontSize: 12,
                              padding: '3px 8px',
                              borderRadius: 4,
                              display: 'inline-block',
                            }}
                          >
                            🟡 Chờ khách đến nhận phòng
                          </span>
                          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
                            (Sẵn sàng xe / nhân sự đón)
                          </div>
                        </div>
                      )}
                    </div>
                  );
                },
              },
            ]}
          />
          {renderPagination(
            preOrderPage,
            totalPreOrderPages,
            upcomingPreOrders.length,
            preOrderPageSize,
            setPreOrderPage,
            setPreOrderPageSize
          )}
        </div>
      )}

      {/* ======================= TAB 4: MÃ KHUYẾN MÃI VOUCHER ======================= */}
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
          filteredServices.length,
          servicePageSize,
          setServicePage,
          setServicePageSize
          )
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
                  <>
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

                    {/* Banner Yêu cầu Đặt Trước từ Lịch Trình của Khách */}
                    {preOrdersForSelectedStay.length > 0 && (() => {
                      const allHandled = preOrdersForSelectedStay.every((po) => po.orderStatus === 'COMPLETED' || po.orderStatus === 'ORDERED');
                      return (
                        <div
                          style={{
                            marginTop: 10,
                            background: allHandled ? '#f0fdf4' : '#fffbeb',
                            border: `1px solid ${allHandled ? '#bbf7d0' : '#fde68a'}`,
                            borderRadius: 8,
                            padding: '10px 12px',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              color: allHandled ? '#166534' : '#92400e',
                              fontSize: 12.5,
                              marginBottom: 6,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span>{allHandled ? '✅' : '✈️'}</span>
                            <span>
                              {allHandled
                                ? `Toàn bộ ${preOrdersForSelectedStay.length} dịch vụ đặt trước đã được nạp vào phòng & tính Folio (Đã khóa):`
                                : `Khách có yêu cầu đặt trước dịch vụ (${preOrdersForSelectedStay.length}):`}
                            </span>
                          </div>
                          {preOrdersForSelectedStay.map((po, idx) => {
                            const isCompleted = po.orderStatus === 'COMPLETED';
                            const isOrdered = po.orderStatus === 'ORDERED';
                            const notCreated = po.orderStatus === 'NOT_CREATED';

                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '8px 0',
                                  borderTop: idx > 0 ? `1px dashed ${allHandled ? '#bbf7d0' : '#fcd34d'}` : 'none',
                                  fontSize: 12,
                                }}
                              >
                                <div style={{ flex: 1, marginRight: 8 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <strong style={{ color: allHandled ? '#14532d' : '#78350f' }}>{po.serviceName}</strong>
                                    <span style={{ color: allHandled ? '#166534' : '#92400e', fontWeight: 600 }}>(SL: {po.quantity})</span>
                                    {isCompleted && (
                                      <span
                                        style={{
                                          background: '#dcfce7',
                                          color: '#166534',
                                          fontSize: 11,
                                          fontWeight: 700,
                                          padding: '1px 6px',
                                          borderRadius: 4,
                                        }}
                                      >
                                        ✅ Đã tính Folio (Đơn #{po.orderId})
                                      </span>
                                    )}
                                    {isOrdered && (
                                      <span
                                        style={{
                                          background: '#fef3c7',
                                          color: '#b45309',
                                          fontSize: 11,
                                          fontWeight: 700,
                                          padding: '1px 6px',
                                          borderRadius: 4,
                                        }}
                                      >
                                        ⏳ Đang phục vụ (Đơn #{po.orderId})
                                      </span>
                                    )}
                                    {notCreated && (
                                      <span
                                        style={{
                                          background: '#fee2e2',
                                          color: '#991b1b',
                                          fontSize: 11,
                                          fontWeight: 700,
                                          padding: '1px 6px',
                                          borderRadius: 4,
                                        }}
                                      >
                                        ⚠️ Chưa nạp vào phòng
                                      </span>
                                    )}
                                  </div>
                                  {po.scheduledTime && (
                                    <div style={{ color: '#b45309', fontSize: 11.5, marginTop: 2 }}>
                                      ⏱ Thời gian hẹn: {po.scheduledTime}
                                    </div>
                                  )}
                                  {po.details && po.details !== 'Không' && (
                                    <div style={{ color: '#6b7280', fontStyle: 'italic', fontSize: 11.5 }}>
                                      Chi tiết: {po.details}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  {isCompleted ? (
                                    <span style={{ color: '#16a34a', fontSize: 11.5, fontWeight: 700 }}>
                                      Đã ghi nhận Folio
                                    </span>
                                  ) : isOrdered ? (
                                    <span style={{ color: '#d97706', fontSize: 11.5, fontWeight: 600 }}>
                                      Đang phục vụ
                                    </span>
                                  ) : (
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOpenQuickLoadAndCompleteConfirm(selectedStay, {
                                            serviceId: po.serviceId,
                                            serviceName: po.serviceName,
                                            quantity: po.quantity,
                                          })
                                        }
                                        disabled={busy}
                                        style={{
                                          background: '#16a34a',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: 4,
                                          padding: '4px 8px',
                                          fontSize: 11.5,
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          whiteSpace: 'nowrap',
                                        }}
                                        title="Nạp vào phòng và tự động hoàn thành đơn để cộng tiền vào Folio ngay"
                                      >
                                        ⚡ Nạp & Hoàn thành ngay
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleCancelPreOrderInStay(selectedStay, po)}
                                        disabled={busy}
                                        style={{
                                          background: '#fff',
                                          color: '#dc2626',
                                          border: '1px solid #fca5a5',
                                          borderRadius: 4,
                                          padding: '4px 8px',
                                          fontSize: 11.5,
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          whiteSpace: 'nowrap',
                                        }}
                                        title="Khách không có nhu cầu nữa, hủy dịch vụ đặt trước này"
                                      >
                                        ✕ Hủy hẹn
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </>
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
                            <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                              {s.specialNotes && s.specialNotes.includes('[ĐẶT TRƯỚC]') && (
                                <span
                                  style={{
                                    background: '#fef3c7',
                                    color: '#b45309',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                  }}
                                >
                                  ✈️ Có đặt trước
                                </span>
                              )}
                              <span>{s.reservationCode ? `Mã: ${s.reservationCode}` : `Stay #${s.stayId}`}</span>
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
                      onChange={() => { }}
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

              {/* Tùy chọn tự động hoàn thành và cộng vào Folio ngay */}
              <div style={{ marginBottom: 18, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0, fontSize: 13, color: '#166534', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={orderForm.completeImmediately ?? true}
                    onChange={(e) => setOrderForm({ ...orderForm, completeImmediately: e.target.checked })}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#16a34a' }}
                  />
                  <span>⚡ Tự động xác nhận hoàn thành & cộng tiền vào Folio ngay</span>
                </label>
                <div style={{ fontSize: 11.5, color: '#15803d', marginLeft: 24, marginTop: 2 }}>
                  (Phù hợp cho các dịch vụ đón tiễn sân bay, buffet sáng hoặc tiện ích đã chuẩn bị xong cho khách)
                </div>
              </div>

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

      {/* Modal Xác Nhận Hủy Dịch Vụ Đặt Trước Chuyên Nghiệp (Thay thế window.confirm) */}
      {cancelPreOrderModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1060,
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: '100%',
              maxWidth: 460,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  color: '#dc2626',
                  flexShrink: 0,
                }}
              >
                ⚠️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                  Xác Nhận Hủy Dịch Vụ Đặt Trước
                </h3>
                <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
                  Booking #{cancelPreOrderModal.reservation?.reservationCode} ({cancelPreOrderModal.reservation?.contactName})
                </div>
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: 13,
                color: '#334155',
                marginBottom: 16,
              }}
            >
              <div>
                Bạn có chắc chắn muốn hủy yêu cầu đặt trước:
              </div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginTop: 4 }}>
                {cancelPreOrderModal.item?.serviceName} (SL: {cancelPreOrderModal.item?.quantity || 1})
              </div>
              {cancelPreOrderModal.item?.time && (
                <div style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>
                  ⏱ Thời gian hẹn: {cancelPreOrderModal.item?.time}
                </div>
              )}
            </div>

            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
              ℹ️ Dịch vụ này sẽ được xóa khỏi lịch đón tiếp của khách sạn. Nếu khách có nhu cầu lại, nhân viên có thể nạp lại qua đơn dịch vụ phòng.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setCancelPreOrderModal(null)}
                disabled={busy}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelPreOrder}
                disabled={busy}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                  boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)',
                }}
              >
                {busy ? 'Đang hủy...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Hoàn Thành Đơn / Nạp Vào Folio */}
      {confirmActionModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1060,
          }}
          onClick={() => !busy && setConfirmActionModal(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: 480,
              maxWidth: '92vw',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: '#dcfce7',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 'bold',
                }}
              >
                ✓
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
                  {confirmActionModal.title || 'Xác nhận dịch vụ & tính tiền'}
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Kiểm tra thông tin trước khi ghi nhận vào hóa đơn (Folio) của phòng
                </div>
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 14,
                fontSize: 13,
                color: '#334155',
                marginBottom: 16,
              }}
            >
              <div style={{ marginBottom: 6 }}>
                {confirmActionModal.message}
              </div>
              {confirmActionModal.details && (
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginTop: 4 }}>
                  {confirmActionModal.details}
                </div>
              )}
              {confirmActionModal.extra && (
                <div style={{ fontSize: 12, color: '#0369a1', marginTop: 4, fontWeight: 500 }}>
                  {confirmActionModal.extra}
                </div>
              )}
            </div>

            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
              💡 Khi xác nhận, hệ thống sẽ chuyển trạng thái đơn sang <strong>Đã hoàn thành</strong> và tự động cộng tổng tiền vào Folio phòng.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirmActionModal(null)}
                disabled={busy}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  const action = confirmActionModal.onConfirm;
                  setConfirmActionModal(null);
                  if (action) {
                    await action();
                  }
                }}
                disabled={busy}
                style={{
                  background: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                  boxShadow: '0 1px 2px rgba(22, 163, 74, 0.2)',
                }}
              >
                {busy ? 'Đang xử lý...' : confirmActionModal.confirmLabel || 'Xác nhận hoàn thành'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
