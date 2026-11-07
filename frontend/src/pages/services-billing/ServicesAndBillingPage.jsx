import { useCallback, useEffect, useMemo, useState } from 'react';
import { billingApi } from '../../services/billingApi';
import { notifyToast } from '../../lib/http';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../config/constants';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatVND } from '../../lib/money';
import { formatDateTime, formatDate } from '../../lib/datetime';
import { FolioBillingTab } from './FolioBillingTab';
import { VoucherManagementTab } from './VoucherManagementTab';

// Phân quyền theo ma trận nghiệp vụ SDD/SRS
const CATALOG_MANAGERS = [ROLES.SERVICE_MANAGER, ROLES.ADMIN];
const CATALOG_VIEW_ALL = [ROLES.SERVICE_MANAGER, ROLES.GENERAL_MANAGER, ROLES.ADMIN];
const CATALOG_TAB_VIEWERS = [
  ROLES.SERVICE_STAFF,
  ROLES.SERVICE_MANAGER,
  ROLES.FRONT_DESK,
  ROLES.SALES_MANAGER,
  ROLES.GENERAL_MANAGER,
  ROLES.ADMIN,
];
const ORDER_VIEWERS = [
  ROLES.SERVICE_STAFF,
  ROLES.SERVICE_MANAGER,
  ROLES.FRONT_DESK,
  ROLES.GENERAL_MANAGER,
  ROLES.ADMIN,
];
const ORDER_CREATORS = [ROLES.SERVICE_STAFF, ROLES.SERVICE_MANAGER, ROLES.FRONT_DESK, ROLES.ADMIN];
const ORDER_CONFIRMERS = [ROLES.FRONT_DESK, ROLES.SERVICE_STAFF, ROLES.SERVICE_MANAGER, ROLES.ADMIN, ROLES.GENERAL_MANAGER];
const ORDER_COMPLETERS = [ROLES.SERVICE_STAFF, ROLES.SERVICE_MANAGER, ROLES.ADMIN, ROLES.GENERAL_MANAGER];
const ORDER_VOIDERS = [ROLES.SERVICE_STAFF, ROLES.SERVICE_MANAGER, ROLES.FRONT_DESK, ROLES.ADMIN];
const FOLIO_VIEWERS = [ROLES.FRONT_DESK, ROLES.ACCOUNTANT, ROLES.GENERAL_MANAGER, ROLES.ADMIN];
// Tab 5 Quản lý Khuyến Mãi (Voucher) CHỈ hiển thị cho SALES_MANAGER, ADMIN, GENERAL_MANAGER (ẨN hoàn toàn với FRONT_DESK)
const VOUCHER_VIEWERS = [ROLES.SALES_MANAGER, ROLES.ADMIN, ROLES.GENERAL_MANAGER];

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
  scheduledTime: '',
  notes: '',
  completeImmediately: true,
};

// Trích xuất từng lượt dịch vụ đặt trước độc lập từ specialNotes (KHÔNG gộp cứng để giữ nguyên từng khung giờ & ghi chú riêng, hỗ trợ hủy lẻ)
const parseAndGroupPreOrders = (notes) => {
  if (!notes) return [];
  return notes
    .split('\n')
    .filter((line) => line.includes('[ĐẶT TRƯỚC]'))
    .map((line, idx) => {
      const idMatch = line.match(/Mã DV:\s*(\d+)/);
      const qtyMatch = line.match(/SL:\s*(\d+)/);
      const timeMatch = line.match(/Thời gian:\s*([^|]+)/);
      const detailMatch = line.match(/Chi tiết:\s*(.+)$/);
      const nameMatch = line.match(/\[ĐẶT TRƯỚC\]\s*(.*?)\s*(\(Mã DV:|$|\|)/);
      return {
        id: idx,
        itemIndex: idx,
        serviceName: nameMatch ? nameMatch[1].trim() : 'Dịch vụ đặt trước',
        serviceId: idMatch ? idMatch[1] : '',
        quantity: qtyMatch ? Number(qtyMatch[1]) : 1,
        time: timeMatch ? timeMatch[1].trim() : '',
        detail: detailMatch ? detailMatch[1].trim() : '',
      };
    });
};

// Tạo chuỗi ghi chú chuẩn khi nạp dịch vụ đặt trước sang đơn phòng
const buildPreOrderNote = (item) => {
  if (!item) return null;
  const timeVal = item.time || item.scheduledTime;
  const detailVal = item.detail || item.details;
  const parts = ['[Đặt trước]'];
  if (timeVal && timeVal !== 'Không') {
    parts.push(`Giờ hẹn: ${timeVal}`);
  }
  if (detailVal && detailVal !== 'Không') {
    parts.push(`Yêu cầu: ${detailVal}`);
  }
  return parts.length > 0 ? parts.join(' | ') : null;
};

// Làm sạch emoji và tag [Đặt trước #idx] cũ khi hiển thị trên UI để không bị rối chữ
const formatOrderNotes = (notes) => {
  if (!notes) return '';
  return notes
    .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/\[Đặt trước\s*#\d+\]/gi, '[Đặt trước]')
    .trim();
};

// Đối chiếu 1-1 từng lượt đặt trước với các đơn dịch vụ đã tạo của phòng (tránh 1 đơn match trùng nhiều lượt đặt trước cùng loại)
const matchPreOrderItemsToStayOrders = (items, stayOrders) => {
  if (!items || items.length === 0) return [];
  const activeOrders = (stayOrders || []).filter((o) => o.status !== 'VOIDED');
  const usedOrderIds = new Set();

  const result = items.map((it) => ({ ...it, matchedOrder: null }));

  // Bước 1: Ưu tiên khớp chính xác theo giờ hẹn & ghi chú hoặc thẻ [Đặt trước #idx] cũ trong notes của đơn
  result.forEach((it) => {
    const legacyTag = `[Đặt trước #${it.itemIndex + 1}]`;
    const timeVal = it.time || it.scheduledTime;
    const detailVal = it.detail || it.details;
    const timeTag = timeVal && timeVal !== 'Không' ? `Giờ hẹn: ${timeVal}` : null;
    const detailTag = detailVal && detailVal !== 'Không' ? `Yêu cầu: ${detailVal}` : null;

    const exactMatch = activeOrders.find((o) => {
      if (usedOrderIds.has(o.serviceOrderId)) return false;
      const isSameService =
        (it.serviceId && String(o.serviceId) === String(it.serviceId)) ||
        (o.serviceName && it.serviceName && o.serviceName.trim().toLowerCase() === it.serviceName.trim().toLowerCase());
      if (!isSameService || !o.notes) return false;

      if (o.notes.includes(legacyTag)) return true;
      if (o.notes.includes('[Đặt trước]')) {
        const matchTime = !timeTag || o.notes.includes(timeTag);
        const matchDetail = !detailTag || o.notes.includes(detailTag);
        return matchTime && matchDetail;
      }
      return false;
    });
    if (exactMatch) {
      usedOrderIds.add(exactMatch.serviceOrderId);
      it.matchedOrder = exactMatch;
    }
  });

  // Bước 2: Khớp 1-1 theo thứ tự thời gian cho các đơn chưa có thẻ tag
  const chronologicalOrders = [...activeOrders].sort(
    (a, b) => (a.serviceOrderId || 0) - (b.serviceOrderId || 0)
  );
  result.forEach((it) => {
    if (!it.matchedOrder) {
      const fallbackMatch = chronologicalOrders.find((o) => {
        if (usedOrderIds.has(o.serviceOrderId)) return false;
        const isSameService =
          (it.serviceId && String(o.serviceId) === String(it.serviceId)) ||
          (o.serviceName && it.serviceName && o.serviceName.trim().toLowerCase() === it.serviceName.trim().toLowerCase());
        return isSameService;
      });
      if (fallbackMatch) {
        usedOrderIds.add(fallbackMatch.serviceOrderId);
        it.matchedOrder = fallbackMatch;
      }
    }
  });

  return result;
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

  const canViewCatalog = CATALOG_TAB_VIEWERS.includes(role);
  const canManageCatalog = CATALOG_MANAGERS.includes(role);
  const canViewOrders = ORDER_VIEWERS.includes(role);
  const canCreateOrder = ORDER_CREATORS.includes(role);
  const canConfirm = ORDER_CONFIRMERS.includes(role);
  const canComplete = ORDER_COMPLETERS.includes(role);
  const canVoid = ORDER_VOIDERS.includes(role);
  const canViewFolios = FOLIO_VIEWERS.includes(role);
  const canViewVouchers = VOUCHER_VIEWERS.includes(role);

  const [activeTab, setActiveTab] = useState(() => {
    if (role === ROLES.SALES_MANAGER) return 'vouchers';
    if ([ROLES.FRONT_DESK, ROLES.ACCOUNTANT].includes(role)) return 'folios';
    return 'services';
  });

  useEffect(() => {
    if (role === ROLES.SALES_MANAGER) {
      setActiveTab('vouchers');
    } else if ([ROLES.FRONT_DESK, ROLES.ACCOUNTANT].includes(role)) {
      setActiveTab('folios');
    }
  }, [role]);
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
  const [cancelPreOrderModal, setCancelPreOrderModal] = useState(null); // { reservation, item, cancelQty }
  const [confirmActionModal, setConfirmActionModal] = useState(null); // { title, message, details, confirmLabel, onConfirm }
  const [detailModalData, setDetailModalData] = useState(null); // { type: 'ROOM_ORDER' | 'PRE_ORDER', order, reservation, item, matchedStay, existingOrder }
  const [busy, setBusy] = useState(false);

  // Filters
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderSearchKeyword, setOrderSearchKeyword] = useState('');
  const [preOrderSearchKeyword, setPreOrderSearchKeyword] = useState('');
  const [preOrderCheckInFilter, setPreOrderCheckInFilter] = useState('ALL'); // 'ALL' | 'CHECKED_IN' | 'NOT_CHECKED_IN'
  const [preOrderChargeFilter, setPreOrderChargeFilter] = useState('ALL'); // 'ALL' | 'HAS_UNCHARGED' | 'ALL_CHARGED'

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
    if (!canViewCatalog) return Promise.resolve();
    const call = CATALOG_VIEW_ALL.includes(role) ? billingApi.getAllServices : billingApi.getActiveServices;
    return call().then((r) => setServices(r.data || [])).catch(() => {});
  }, [role, canViewCatalog]);

  const loadOrders = useCallback(() => {
    if (!canViewOrders) return Promise.resolve();
    return billingApi.getServiceOrders().then((r) => setOrders(r.data || [])).catch(() => {});
  }, [canViewOrders]);

  const loadUpcomingPreOrders = useCallback(() => {
    if (!canViewOrders) return Promise.resolve();
    return billingApi.getAllUpcomingPreOrders().then((r) => setUpcomingPreOrders(r.data || [])).catch(() => {});
  }, [canViewOrders]);

  const loadActiveStays = useCallback(() => {
    return billingApi.getActiveStays().then((r) => setActiveStays(r.data || [])).catch(() => {});
  }, []);

  const loadVouchers = useCallback(() => {
    if (!canViewVouchers) return Promise.resolve();
    return billingApi.getVouchers().then((r) => setVouchers(r.data || [])).catch(() => {});
  }, [canViewVouchers]);

  useEffect(() => {
    if (!role) return;
    loadServices();
    loadOrders();
    loadUpcomingPreOrders();
    loadActiveStays();
    loadVouchers();
  }, [role, canViewVouchers, loadServices, loadOrders, loadUpcomingPreOrders, loadActiveStays, loadVouchers]);

  useEffect(() => {
    if (activeTab === 'vouchers') {
      loadVouchers();
    }
  }, [activeTab, loadVouchers]);

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
    setOrderForm({
      ...EMPTY_ORDER_FORM,
      completeImmediately: canComplete,
    });
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
    const noteParts = [];
    if (orderForm.scheduledTime?.trim()) {
      noteParts.push(`Giờ hẹn: ${orderForm.scheduledTime.trim()}`);
    }
    if (orderForm.notes?.trim()) {
      noteParts.push(`Yêu cầu: ${orderForm.notes.trim()}`);
    }
    const payload = {
      stayId: Number(orderForm.stayId),
      serviceId: Number(orderForm.serviceId),
      quantity: Number(orderForm.quantity),
      notes: noteParts.length > 0 ? noteParts.join(' | ') : null,
    };
    const shouldComplete = Boolean(canComplete && orderForm.completeImmediately);
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
        ? 'Đã nạp dịch vụ vào phòng, hoàn thành đơn và cộng tiền vào hóa đơn phòng thành công!'
        : 'Đã tạo đơn dịch vụ cho phòng (Trạng thái: Đã xác nhận - Chờ phục vụ).',
      async () => {
        setShowOrderModal(false);
        setOrderForm(EMPTY_ORDER_FORM);
        await Promise.all([loadOrders(), loadUpcomingPreOrders(), loadActiveStays()]);
      }
    );
  };

  // Hoàn thành 1 dịch vụ đặt trước khi khách đã sử dụng (Tạo đơn và chuyển thẳng sang COMPLETED + cộng tiền phòng ngay)
  const handleQuickLoadAndComplete = (matchedStay, item) => {
    if (!matchedStay) {
      notifyToast({
        type: 'WARNING',
        message: 'Khách hàng chưa làm thủ tục nhận phòng. Vui lòng chờ khách check-in để tạo lượt lưu trú trước khi tính vào tiền phòng.',
      });
      return;
    }
    if (!item?.serviceId || !canComplete) return;
    const payload = {
      stayId: Number(matchedStay.stayId),
      serviceId: Number(item.serviceId),
      quantity: Number(item.quantity) || 1,
      notes: buildPreOrderNote(item),
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
      `Đã hoàn thành dịch vụ đặt trước "${item.serviceName}" (SL: ${item.quantity || 1}) cho Phòng ${matchedStay.roomNumber} và tính vào hóa đơn phòng!`,
      async () => {
        setShowOrderModal(false);
        await Promise.all([loadOrders(), loadUpcomingPreOrders(), loadActiveStays()]);
      }
    );
  };

  // Nạp & hoàn thành toàn bộ dịch vụ đặt trước chưa sử dụng của đơn lưu trú vào hóa đơn phòng trong 1 click
  const handleQuickLoadAllPreOrders = async (reservation, matchedStay, items) => {
    if (!matchedStay || !items || items.length === 0 || !canComplete) return;
    const stayOrders = orders.filter((o) => String(o.stayId) === String(matchedStay.stayId));
    const matchedList = matchPreOrderItemsToStayOrders(items, stayOrders);
    const unchargedItems = matchedList.filter((it) => !it.matchedOrder);

    if (unchargedItems.length === 0) {
      notifyToast({ type: 'INFO', message: 'Tất cả các dịch vụ đặt trước của khách đã được hoàn thành & tính vào tiền phòng rồi.' });
      return;
    }

    try {
      setBusy(true);
      for (const it of unchargedItems) {
        const res = await billingApi.createServiceOrder({
          stayId: Number(matchedStay.stayId),
          serviceId: Number(it.serviceId),
          quantity: Number(it.quantity) || 1,
          notes: buildPreOrderNote(it),
        });
        const orderData = res.data?.data || res.data;
        if (orderData?.serviceOrderId) {
          await billingApi.completeServiceOrder(orderData.serviceOrderId);
        }
      }
      notifyToast({
        type: 'SUCCESS',
        message: `Đã hoàn thành ${unchargedItems.length} lượt dịch vụ đặt trước của Phòng ${matchedStay.roomNumber} và tính vào hóa đơn phòng!`,
      });
      await Promise.all([loadOrders(), loadUpcomingPreOrders(), loadActiveStays()]);
    } catch (err) {
      notifyToast({
        type: 'DANGER',
        message: err.response?.data?.message || 'Có lỗi khi hoàn thành & tính dịch vụ vào hóa đơn phòng.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCancelPreOrder = (reservation, item) => {
    if (!reservation?.reservationId || !item?.serviceId) return;
    setCancelPreOrderModal({
      reservation,
      item,
      cancelQty: Number(item.quantity) || 1,
    });
  };

  const handleConfirmCancelPreOrder = () => {
    if (!cancelPreOrderModal?.reservation?.reservationId || !cancelPreOrderModal?.item?.serviceId) return;
    const { reservation, item, cancelQty } = cancelPreOrderModal;
    const qtyToCancel = Number(cancelQty) || Number(item.quantity) || 1;
    const totalQty = Number(item.quantity) || 1;
    run(
      () =>
        billingApi.cancelPreOrder(
          reservation.reservationId,
          item.serviceId,
          item.itemIndex,
          qtyToCancel
        ),
      qtyToCancel < totalQty
        ? `Đã hủy ${qtyToCancel} suất "${item.serviceName}" (còn lại ${totalQty - qtyToCancel} suất).`
        : `Đã hủy thành công dịch vụ đặt trước "${item.serviceName}".`,
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

  const confirmOrder = (o) =>
    run(
      () => billingApi.confirmServiceOrder(o.serviceOrderId),
      `Đã xác nhận đơn #${o.serviceOrderId} và chuyển sang trạng thái Chờ phục vụ (Đã khóa hủy).`,
      async () => {
        await Promise.all([loadOrders(), loadUpcomingPreOrders(), loadActiveStays()]);
      }
    );

  const handleOpenConfirmOrderModal = (o) => {
    if (!o?.serviceOrderId) return;
    setConfirmActionModal({
      title: 'Xác nhận tiếp nhận đơn dịch vụ',
      message: `Bạn muốn xác nhận đơn gọi dịch vụ #${o.serviceOrderId} để chuyển sang Chờ phục vụ?`,
      details: `${o.serviceName || 'Dịch vụ'} (SL: ${o.quantity || 1}) - Phòng ${o.roomNumber || ''}`,
      extra: `${o.notes ? `Ghi chú khách: ${formatOrderNotes(o.notes)} • ` : ''}Lưu ý: Sau khi xác nhận, đơn sẽ được khóa hủy để bộ phận dịch vụ chuẩn bị.`,
      confirmLabel: 'Xác nhận nhận đơn',
      onConfirm: async () => {
        await confirmOrder(o);
      },
    });
  };

  const completeOrder = (o) =>
    run(
      () => billingApi.completeServiceOrder(o.serviceOrderId),
      `Đã hoàn thành đơn #${o.serviceOrderId} và ghi nhận vào tiền phòng lưu trú.`,
      async () => {
        await Promise.all([loadOrders(), loadUpcomingPreOrders(), loadActiveStays()]);
      }
    );

  // 4. Modal Xác Nhận Hoàn Thành Đơn / Nạp Vào Hóa Đơn Phòng
  const handleOpenCompleteOrderConfirm = (o) => {
    if (!o?.serviceOrderId) return;
    setConfirmActionModal({
      title: 'Xác nhận hoàn thành dịch vụ',
      message: `Bạn có chắc chắn muốn xác nhận hoàn thành đơn dịch vụ #${o.serviceOrderId}?`,
      details: `${o.serviceName || 'Dịch vụ'} (SL: ${o.quantity || 1}) - Phòng ${o.roomNumber || ''}`,
      extra: `${o.totalAmount ? `Tổng tiền: ${formatVND(o.totalAmount)}` : ''}${o.notes ? ` • Ghi chú: ${formatOrderNotes(o.notes)}` : ''}`,
      confirmLabel: 'Xác nhận hoàn thành & tính tiền phòng',
      onConfirm: async () => {
        await completeOrder(o);
      },
    });
  };

  const handleOpenQuickLoadAndCompleteConfirm = (matchedStay, item) => {
    if (!matchedStay) {
      notifyToast({
        type: 'WARNING',
        message: 'Khách hàng chưa làm thủ tục nhận phòng (Check-in). Vui lòng chờ khách đến nhận phòng trước khi tính vào hóa đơn phòng.',
      });
      return;
    }
    if (!item?.serviceId || !canComplete) return;
    const extraParts = [];
    if (item.time && item.time !== 'Không') extraParts.push(`Giờ hẹn: ${item.time}`);
    if (item.detail && item.detail !== 'Không') extraParts.push(`Yêu cầu: ${item.detail}`);
    setConfirmActionModal({
      title: 'Xác nhận hoàn thành & tính tiền phòng',
      message: `Xác nhận hoàn thành dịch vụ đặt trước này cho Phòng ${matchedStay.roomNumber} và tính vào hóa đơn phòng?`,
      details: `${item.serviceName} (SL: ${item.quantity || 1}) → Phòng ${matchedStay.roomNumber} (${matchedStay.guestName || ''})`,
      extra: extraParts.length > 0 ? extraParts.join(' • ') : null,
      confirmLabel: 'Hoàn thành & Tính tiền phòng',
      onConfirm: async () => {
        await handleQuickLoadAndComplete(matchedStay, item);
      },
    });
  };

  const handleOpenQuickLoadAllConfirm = (reservation, matchedStay, items) => {
    if (!matchedStay || !items || items.length === 0 || !canComplete) return;
    const stayOrders = orders.filter((o) => String(o.stayId) === String(matchedStay.stayId));
    const matchedList = matchPreOrderItemsToStayOrders(items, stayOrders);
    const unchargedItems = matchedList.filter((it) => !it.matchedOrder);

    if (unchargedItems.length === 0) {
      notifyToast({ type: 'INFO', message: 'Tất cả các dịch vụ đặt trước của khách đã được hoàn thành & tính vào tiền phòng rồi.' });
      return;
    }

    setConfirmActionModal({
      title: 'Xác nhận hoàn thành tất cả dịch vụ đặt trước',
      message: `Xác nhận hoàn thành toàn bộ ${unchargedItems.length} lượt dịch vụ đặt trước chưa tính vào tiền phòng của Phòng ${matchedStay.roomNumber}?`,
      details: unchargedItems
        .map((it) => `${it.serviceName} (SL: ${it.quantity || 1}${it.time ? `, hẹn ${it.time}` : ''})`)
        .join(' | '),
      extra: `Khách hàng: ${matchedStay.guestName || reservation?.contactName || ''}`,
      confirmLabel: `Hoàn thành & Tính ${unchargedItems.length} lượt vào tiền phòng`,
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

  // Trích xuất danh sách dịch vụ khách đặt trước từ specialNotes (từng lượt độc lập) và đối chiếu 1-1 với các đơn đã tạo
  const preOrdersForSelectedStay = (() => {
    if (!selectedStay?.specialNotes) return [];
    const stayOrders = orders.filter((o) => String(o.stayId) === String(selectedStay.stayId));
    const parsedItems = parseAndGroupPreOrders(selectedStay.specialNotes);
    const matchedList = matchPreOrderItemsToStayOrders(parsedItems, stayOrders);
    return matchedList.map((it) => {
      const matchedOrder = it.matchedOrder;
      return {
        ...it,
        scheduledTime: it.time,
        details: it.detail,
        orderStatus: matchedOrder ? matchedOrder.status : 'NOT_CREATED',
        orderId: matchedOrder ? matchedOrder.serviceOrderId : null,
        matchedOrder,
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

  const filteredOrders = orders.filter((o) => {
    const matchStatus = (() => {
      if (!orderStatusFilter) return true;
      if (orderStatusFilter === 'PENDING_CONFIRM') return o.status === 'ORDERED' && !o.staffConfirmed;
      if (orderStatusFilter === 'WAITING_SERVICE') return o.status === 'ORDERED' && o.staffConfirmed;
      return o.status === orderStatusFilter;
    })();
    if (!matchStatus) return false;

    if (orderSearchKeyword.trim()) {
      const kw = orderSearchKeyword.toLowerCase().trim();
      const matchId = String(o.serviceOrderId).toLowerCase().includes(kw);
      const matchName = o.serviceName && o.serviceName.toLowerCase().includes(kw);
      const matchNotes = o.notes && o.notes.toLowerCase().includes(kw);
      const matchRoom = o.roomNumber && String(o.roomNumber).toLowerCase().includes(kw);
      return matchId || matchName || matchNotes || matchRoom;
    }
    return true;
  });
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

  const filteredPreOrders = upcomingPreOrders.filter((r) => {
    const matchedStay = activeStays.find((s) => s.reservationCode === r.reservationCode);
    const isCheckedIn = Boolean(matchedStay);

    if (preOrderCheckInFilter === 'CHECKED_IN' && !isCheckedIn) return false;
    if (preOrderCheckInFilter === 'NOT_CHECKED_IN' && isCheckedIn) return false;

    const items = parseAndGroupPreOrders(r.specialNotes);
    const stayOrders = matchedStay
      ? orders.filter((o) => String(o.stayId) === String(matchedStay.stayId))
      : [];
    const matchedItems = matchPreOrderItemsToStayOrders(items, stayOrders);
    const hasUncharged = matchedItems.some((it) => !it.matchedOrder);

    if (preOrderChargeFilter === 'HAS_UNCHARGED' && !hasUncharged) return false;
    if (preOrderChargeFilter === 'ALL_CHARGED' && hasUncharged) return false;

    if (preOrderSearchKeyword.trim()) {
      const kw = preOrderSearchKeyword.toLowerCase().trim();
      const matchCode = r.reservationCode && r.reservationCode.toLowerCase().includes(kw);
      const matchContact = r.contactName && r.contactName.toLowerCase().includes(kw);
      const matchPhone = r.contactPhone && r.contactPhone.toLowerCase().includes(kw);
      const matchRoom = matchedStay?.roomNumber && String(matchedStay.roomNumber).toLowerCase().includes(kw);
      const matchType = r.roomTypeName && r.roomTypeName.toLowerCase().includes(kw);
      const matchNotes = r.specialNotes && r.specialNotes.toLowerCase().includes(kw);
      if (!matchCode && !matchContact && !matchPhone && !matchRoom && !matchType && !matchNotes) {
        return false;
      }
    }
    return true;
  });

  const totalPreOrderPages = Math.max(1, Math.ceil(filteredPreOrders.length / preOrderPageSize));
  const paginatedPreOrders = filteredPreOrders.slice(
    (preOrderPage - 1) * preOrderPageSize,
    preOrderPage * preOrderPageSize
  );

  const activeServicesCount = services.filter((s) => s.status === 'ACTIVE').length;
  const pendingOrdersCount = orders.filter((o) => o.status === 'ORDERED').length;
  const completedOrdersCount = orders.filter((o) => o.status === 'COMPLETED').length;

  const openFoliosCount = (activeStays || []).filter((s) => s?.folioStatus !== 'CLOSED').length;
  const closedFoliosCount = (activeStays || []).filter((s) => s?.folioStatus === 'CLOSED').length;
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);
  const currentMonthLabel = useMemo(() => {
    const now = new Date();
    return `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
  }, []);
  const settledFoliosRevenueThisMonth = useMemo(() => {
    return (activeStays || [])
      .filter((s) => {
        if (s?.folioStatus !== 'CLOSED') return false;
        const d = s.actualCheckOut || s.checkOutDate || s.actualCheckIn || s.checkInDate;
        return d && typeof d === 'string' && d.startsWith(currentMonthStr);
      })
      .reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
  }, [activeStays, currentMonthStr]);
  const totalVouchersCount = (vouchers || []).length;
  const activeVouchersCount = (vouchers || []).filter((v) => v?.status === 'ACTIVE').length;
  const usedVouchersCount = (vouchers || []).reduce((acc, v) => acc + (v?.usedCount || 0), 0);
  const pausedOrFullVouchersCount = (vouchers || []).filter(
    (v) => v && (v.status !== 'ACTIVE' || (v.usageLimit > 0 && v.usedCount >= v.usageLimit))
  ).length;

  const pageHeaderInfo = useMemo(() => {
    if (role === ROLES.FRONT_DESK) {
      return {
        title: 'Quầy Thu Ngân, Quyết Toán & Dịch Vụ Khách Sạn',
        subtitle:
          'Kiểm tra Folio phòng lưu trú, khấu trừ tiền cọc, áp mã giảm giá khi khách thanh toán, đóng Folio và hỗ trợ đặt dịch vụ phòng.',
      };
    }
    if (role === ROLES.SALES_MANAGER) {
      return {
        title: 'Chương Trình Khuyến Mãi & Mã Giảm Giá (Vouchers)',
        subtitle:
          'Cấu hình và phát hành mã voucher ưu đãi, tỷ lệ chiết khấu, hạn mức ngân sách và thời hạn sử dụng.',
      };
    }
    if (role === ROLES.ACCOUNTANT) {
      return {
        title: 'Quản Lý Hóa Đơn & Quyết Toán Tiền Phòng',
        subtitle:
          'Đối soát bảng kê chi phí phòng lưu trú, dịch vụ phát sinh, phụ thu, trừ tiền cọc và kiểm tra xuất hóa đơn VAT.',
      };
    }
    return {
      title: 'Dịch Vụ Khách Sạn & Đơn Nội Khu',
      subtitle:
        'Quản lý danh mục dịch vụ tiện ích, đặt dịch vụ cho phòng lưu trú và quyết toán hóa đơn.',
    };
  }, [role]);

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
    <div style={{ width: '100%', maxWidth: '100%', margin: '0 auto', padding: '0 8px' }}>
      {/* 1. Header Trang */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: 24, fontWeight: 700 }}>
            {pageHeaderInfo.title}
          </h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13.5 }}>
            {pageHeaderInfo.subtitle}
          </p>
        </div>
      </div>

      {/* 2. Thẻ KPI Thống Kê Tổng Quan Phân Quyền Theo Role */}
      {role === ROLES.FRONT_DESK ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Phòng Đang Ở</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {(activeStays || []).length}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>phòng</span>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Chờ Quyết Toán</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {openFoliosCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>Folio mở</span>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Đã Quyết Toán</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {closedFoliosCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>đã đóng</span>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Đơn DV Chờ Xử Lý</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {pendingOrdersCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>yêu cầu</span>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Lịch Đón Tiễn / Đặt Trước</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {(upcomingPreOrders || []).length}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>chuyến</span>
            </div>
          </div>
        </div>
      ) : role === ROLES.SALES_MANAGER ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Tổng Mã Khuyến Mãi</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {totalVouchersCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>mã</span>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Đang Hoạt Động</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {activeVouchersCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>khả dụng</span>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Lượt Dùng Thành Công</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {usedVouchersCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>lượt</span>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Hết Lượt / Tạm Dừng</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {pausedOrFullVouchersCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>chương trình</span>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Dịch Vụ Khách Sạn</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {activeServicesCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>/ {(services || []).length} mở bán</span>
            </div>
          </div>
        </div>
      ) : role === ROLES.ACCOUNTANT ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 24 }}>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Hồ Sơ Phòng Lưu Trú</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {(activeStays || []).length}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>phòng</span>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Đang theo dõi chi phí</div>
          </div>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Hóa Đơn Đã Quyết Toán</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {closedFoliosCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>hóa đơn</span>
            </div>
            <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>Đã thu tiền &amp; xuất bill</div>
          </div>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Chưa Quyết Toán (Đang Ở)</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {openFoliosCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>phòng</span>
            </div>
            <div style={{ fontSize: 12, color: '#d97706', marginTop: 4 }}>Chờ thu khi checkout</div>
          </div>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Doanh Thu Thực Thu ({currentMonthLabel})</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 6 }}>
              {formatVND(settledFoliosRevenueThisMonth)}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Từ {closedFoliosCount} hóa đơn đã đóng</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Dịch Vụ Mở Bán</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {activeServicesCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>/ {(services || []).length}</span>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Tổng Đơn Dịch Vụ</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {(orders || []).length}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>đơn</span>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Chờ Phục Vụ</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {pendingOrdersCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>cần giao</span>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Đã Hoàn Thành</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {completedOrdersCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>đã giao</span>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Khách Đặt Trước</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {(upcomingPreOrders || []).length}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>chuyến</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Thanh Chuyển Tab Nghiệp Vụ */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '2px solid #e2e8f0',
          marginBottom: 20,
        }}
      >
        {canViewCatalog && (
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
            Danh Mục Dịch Vụ ({services.length})
          </button>
        )}

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
            Đơn Dịch Vụ Phòng ({orders.length})
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
            Lịch Khách Đặt Trước ({upcomingPreOrders.length})
          </button>
        )}

        {canViewFolios && (
          <button
            type="button"
            onClick={() => setActiveTab('folios')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'folios' ? '2px solid #0284c7' : '2px solid transparent',
              color: activeTab === 'folios' ? '#0284c7' : '#64748b',
              fontWeight: activeTab === 'folios' ? 700 : 500,
              padding: '10px 18px',
              fontSize: 14,
              cursor: 'pointer',
              marginBottom: -2,
            }}
          >
            Hóa Đơn &amp; Quyết Toán Tiền Phòng ({activeStays.length})
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
            Chương Trình Khuyến Mãi ({vouchers.length})
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                Hiển thị <strong>{filteredServices.length}</strong> dịch vụ
              </div>
              {canManageCatalog && (
                <button
                  type="button"
                  onClick={handleOpenCreateService}
                  style={{
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    padding: '7px 14px',
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 13,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 1px 2px rgba(2, 132, 199, 0.2)',
                  }}
                >
                  <span>+</span> Thêm Dịch Vụ Mới
                </button>
              )}
            </div>
          </div>

          <DataTable
            keyField="serviceId"
            data={paginatedServices}
            emptyMessage="Không tìm thấy dịch vụ nào phù hợp."
            columns={[
              {
                header: 'Mã DV',
                width: 90,
                minWidth: 80,
                nowrap: true,
                render: (s) => <code style={{ color: '#0284c7', fontWeight: 600 }}>#{s.serviceId}</code>,
              },
              {
                header: 'Tên Dịch Vụ',
                minWidth: 200,
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
                minWidth: 140,
                nowrap: true,
                render: (s) => (
                  <span
                    style={{
                      background: '#f1f5f9',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#475569',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.category}
                  </span>
                ),
              },
              {
                header: 'Đơn Giá / ĐVT',
                minWidth: 140,
                nowrap: true,
                render: (s) => (
                  <div>
                    <strong style={{ color: '#0f172a' }}>{formatVND(s.unitPrice)}</strong>
                    <span style={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}> / {s.billingUnit}</span>
                  </div>
                ),
              },
              {
                header: 'Trạng Thái',
                minWidth: 120,
                nowrap: true,
                render: (s) => <StatusBadge status={s.status} />,
              },
              ...(canManageCatalog
                ? [
                    {
                      header: 'Thao Tác',
                      minWidth: 180,
                      nowrap: true,
                      render: (s) => (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
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
                              whiteSpace: 'nowrap',
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
                              whiteSpace: 'nowrap',
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
          {/* Bộ lọc đơn dịch vụ phòng */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Tìm mã đơn, phòng, tên món, ghi chú..."
                value={orderSearchKeyword}
                onChange={(e) => {
                  setOrderSearchKeyword(e.target.value);
                  setOrderPage(1);
                }}
                style={{ ...inputStyle, width: 260 }}
              />
              <select
                value={orderStatusFilter}
                onChange={(e) => {
                  setOrderStatusFilter(e.target.value);
                  setOrderPage(1);
                }}
                style={{ ...inputStyle, width: 230 }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="PENDING_CONFIRM">Chờ xác nhận (Khách mới đặt)</option>
                <option value="WAITING_SERVICE">Chờ phục vụ (Đã xác nhận)</option>
                <option value="COMPLETED">COMPLETED (Đã hoàn thành)</option>
                <option value="VOIDED">VOIDED (Đã hủy dịch vụ)</option>
              </select>
              {(orderStatusFilter || orderSearchKeyword) && (
                <button
                  type="button"
                  onClick={() => {
                    setOrderStatusFilter('');
                    setOrderSearchKeyword('');
                    setOrderPage(1);
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12.5,
                    cursor: 'pointer',
                    color: '#475569',
                  }}
                >
                  Xóa lọc
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                Hiển thị <strong>{filteredOrders.length}</strong> / {orders.length} đơn dịch vụ
              </div>
              {canCreateOrder && (
                <button
                  type="button"
                  onClick={handleOpenCreateOrder}
                  style={{
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    padding: '7px 14px',
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 13,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 1px 2px rgba(2, 132, 199, 0.2)',
                  }}
                >
                  <span>+</span> Đặt Dịch Vụ Cho Phòng
                </button>
              )}
            </div>
          </div>

          <DataTable
            keyField="serviceOrderId"
            data={paginatedOrders}
            emptyMessage="Chưa có đơn gọi dịch vụ nào."
            columns={[
              {
                header: 'Mã Đơn',
                width: 90,
                minWidth: 80,
                nowrap: true,
                render: (o) => <span style={{ color: '#64748b', fontWeight: 500 }}>#{o.serviceOrderId}</span>,
              },
              {
                header: 'Phòng & Khách Lưu Trú',
                minWidth: 200,
                render: (o) => (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span
                        style={{
                          fontWeight: 700,
                          background: '#e0e7ff',
                          color: '#3730a3',
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 6,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {o.roomNumber ? `P.${o.roomNumber}` : '—'}
                      </span>
                      <strong style={{ color: '#0f172a' }}>{o.guestName || 'Khách vãng lai'}</strong>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b', whiteSpace: 'nowrap' }}>
                      Stay #{o.stayId} {o.reservationCode ? `• ${o.reservationCode}` : ''}
                    </div>
                  </div>
                ),
              },
              {
                header: 'Dịch Vụ Sử Dụng',
                minWidth: 200,
                render: (o) => (
                  <div>
                    <strong style={{ color: '#0f172a' }}>{o.serviceName}</strong>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Số lượng: <strong>{o.quantity}</strong> {o.billingUnit}
                    </div>
                    {o.notes && (
                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 11.5,
                          color: '#64748b',
                          lineHeight: 1.35,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 4,
                        }}
                      >
                        <span style={{ color: '#94a3b8' }}>↳</span>
                        <span>{formatOrderNotes(o.notes)}</span>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                header: 'Thành Tiền',
                minWidth: 140,
                nowrap: true,
                render: (o) => (
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                      {formatVND(o.totalAmount)}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                      {formatVND(o.unitPrice)} / {o.billingUnit}
                    </div>
                  </div>
                ),
              },
              {
                header: 'Thời Gian',
                minWidth: 140,
                nowrap: true,
                render: (o) => (
                  <div style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
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
                minWidth: 130,
                nowrap: true,
                render: (o) => (
                  <div>
                    {o.status === 'ORDERED' ? (
                      o.staffConfirmed ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 14,
                            fontSize: 12,
                            fontWeight: 600,
                            backgroundColor: '#dbeafe',
                            color: '#1e40af',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Chờ phục vụ
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 14,
                            fontSize: 12,
                            fontWeight: 600,
                            backgroundColor: '#fef9c3',
                            color: '#854d0e',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Chờ xác nhận
                        </span>
                      )
                    ) : (
                      <StatusBadge status={o.status} />
                    )}
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
              {
                header: 'Thao Tác',
                minWidth: 130,
                nowrap: true,
                render: (o) => (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', alignItems: 'center', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const matchedStay = activeStays.find((s) => s.stayId === o.stayId);
                        setDetailModalData({ type: 'ROOM_ORDER', order: o, matchedStay });
                      }}
                      style={{
                        background: '#f8fafc',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        padding: '5px 10px',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                      title="Xem chi tiết lịch hẹn & ghi chú yêu cầu của đơn dịch vụ này"
                    >
                      Chi tiết
                    </button>
                    {o.status === 'ORDERED' && !o.staffConfirmed && canConfirm && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleOpenConfirmOrderModal(o)}
                        style={{
                          background: '#0284c7',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '5px 10px',
                          cursor: 'pointer',
                          fontSize: 12.5,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                        title="Xác nhận tiếp nhận đơn để chuyển sang Chờ phục vụ"
                      >
                        Xác nhận
                      </button>
                    )}
                    {o.status === 'ORDERED' && o.staffConfirmed && canComplete && (
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
                          whiteSpace: 'nowrap',
                        }}
                        title="Xác nhận đã cung cấp dịch vụ cho khách và cộng tiền vào hóa đơn phòng"
                      >
                        Hoàn thành
                      </button>
                    )}
                    {o.status === 'ORDERED' && !o.staffConfirmed && canVoid && (
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
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Hủy đơn
                      </button>
                    )}
                  </div>
                ),
              },
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
                Lịch Khách Đặt Trước Dịch Vụ (Đón Sân Bay, Buffet, Spa...)
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
              Làm mới lịch
            </button>
          </div>

          {/* Bộ lọc lịch đặt trước dịch vụ */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
              flexWrap: 'wrap',
              gap: 10,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '10px 14px',
            }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Tìm mã booking, tên khách, SĐT, dịch vụ..."
                value={preOrderSearchKeyword}
                onChange={(e) => {
                  setPreOrderSearchKeyword(e.target.value);
                  setPreOrderPage(1);
                }}
                style={{ ...inputStyle, width: 270 }}
              />
              <select
                value={preOrderCheckInFilter}
                onChange={(e) => {
                  setPreOrderCheckInFilter(e.target.value);
                  setPreOrderPage(1);
                }}
                style={{ ...inputStyle, width: 200 }}
              >
                <option value="ALL">Tất cả trạng thái lưu trú</option>
                <option value="CHECKED_IN">Đã Check-in (Đã nhận phòng)</option>
                <option value="NOT_CHECKED_IN">Chưa Check-in (Chờ nhận phòng)</option>
              </select>
              <select
                value={preOrderChargeFilter}
                onChange={(e) => {
                  setPreOrderChargeFilter(e.target.value);
                  setPreOrderPage(1);
                }}
                style={{ ...inputStyle, width: 220 }}
              >
                <option value="ALL">Tất cả trạng thái tiền phòng</option>
                <option value="HAS_UNCHARGED">Còn dịch vụ chờ tính tiền phòng</option>
                <option value="ALL_CHARGED">Đã tính hết vào tiền phòng</option>
              </select>
              {(preOrderSearchKeyword || preOrderCheckInFilter !== 'ALL' || preOrderChargeFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setPreOrderSearchKeyword('');
                    setPreOrderCheckInFilter('ALL');
                    setPreOrderChargeFilter('ALL');
                    setPreOrderPage(1);
                  }}
                  style={{
                    background: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12.5,
                    cursor: 'pointer',
                    color: '#475569',
                  }}
                >
                  Xóa lọc
                </button>
              )}
            </div>

            <div style={{ fontSize: 13, color: '#64748b' }}>
              Hiển thị <strong>{filteredPreOrders.length}</strong> / {upcomingPreOrders.length} lịch đặt trước
            </div>
          </div>

          <DataTable
            keyField="reservationId"
            data={paginatedPreOrders}
            emptyMessage="Hiện tại không có lịch đặt trước dịch vụ nào từ khách."
            columns={[
              {
                header: 'Mã Booking & Khách Hàng',
                render: (r) => {
                  const matchedStay = activeStays.find((s) => s.reservationCode === r.reservationCode);
                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <strong style={{ color: '#0f172a', fontSize: 13 }}>#{r.reservationCode}</strong>
                        {matchedStay ? (
                          <span
                            style={{
                              background: '#e0e7ff',
                              color: '#3730a3',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                            }}
                            title={`Khách đã nhận phòng ${matchedStay.roomNumber}`}
                          >
                            P.{matchedStay.roomNumber}
                          </span>
                        ) : (
                          <span
                            style={{
                              background: '#f1f5f9',
                              color: '#64748b',
                              fontSize: 11,
                              fontWeight: 500,
                              padding: '2px 8px',
                              borderRadius: 6,
                            }}
                            title="Khách chưa làm thủ tục nhận phòng tại Lễ tân"
                          >
                            Chưa Check-in
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: 3 }}>{r.contactName}</div>
                      {r.contactPhone && (
                        <div style={{ fontSize: 12, color: '#0369a1', marginTop: 2 }}>
                          SĐT: <a href={`tel:${r.contactPhone}`} style={{ color: '#0369a1', textDecoration: 'none' }}>{r.contactPhone}</a>
                        </div>
                      )}
                    </div>
                  );
                },
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
                  const rawItems = parseAndGroupPreOrders(r.specialNotes);
                  const stayOrders = matchedStay
                    ? orders.filter((o) => String(o.stayId) === String(matchedStay.stayId))
                    : [];
                  const items = matchPreOrderItemsToStayOrders(rawItems, stayOrders);

                  return (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        overflow: 'hidden',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        minWidth: 340,
                        maxWidth: 520,
                      }}
                    >
                      {items.map((it, idx) => {
                        const existingOrder = it.matchedOrder;
                        const isCompleted = existingOrder?.status === 'COMPLETED';
                        const isOrdered = existingOrder?.status === 'ORDERED';

                        return (
                          <div
                            key={idx}
                            style={{
                              padding: '7px 10px',
                              borderTop: idx > 0 ? '1px dashed #e2e8f0' : 'none',
                              fontSize: 12,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>#{idx + 1}.</span>
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
                                    Đã tính vào tiền phòng (#{existingOrder.serviceOrderId})
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
                                    Đang phục vụ (#{existingOrder.serviceOrderId})
                                  </span>
                                )}
                                {!existingOrder && matchedStay && (
                                  <span
                                    style={{
                                      background: '#fef3c7',
                                      color: '#92400e',
                                      border: '1px solid #fde68a',
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                    }}
                                  >
                                    Chờ tính vào tiền phòng
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDetailModalData({
                                      type: 'PRE_ORDER',
                                      reservation: r,
                                      item: it,
                                      matchedStay,
                                      existingOrder,
                                    })
                                  }
                                  style={{
                                    background: '#f1f5f9',
                                    color: '#0f172a',
                                    border: '1px solid #cbd5e1',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title="Xem chi tiết lịch hẹn & yêu cầu của khách cho lượt đặt này"
                                >
                                  Chi tiết
                                </button>
                                {!existingOrder && canCreateOrder && (
                                  <>
                                    {matchedStay && canComplete ? (
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
                                        title="Hoàn thành đơn và cộng tiền vào hóa đơn phòng ngay"
                                      >
                                        Hoàn thành &amp; Tính tiền phòng
                                      </button>
                                    ) : !matchedStay ? (
                                      <span
                                        style={{
                                          background: '#f8fafc',
                                          color: '#64748b',
                                          border: '1px dashed #cbd5e1',
                                          padding: '2px 7px',
                                          borderRadius: 4,
                                          fontSize: 11,
                                          fontWeight: 600,
                                          whiteSpace: 'nowrap',
                                          cursor: 'not-allowed',
                                        }}
                                        title="Khách chưa làm thủ tục nhận phòng. Cần chờ khách check-in trước khi tính vào hóa đơn phòng."
                                      >
                                        Chờ khách nhận phòng để tính tiền
                                      </span>
                                    ) : null}
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
                                      title="Hủy yêu cầu đặt trước dịch vụ này"
                                    >
                                      Hủy
                                    </button>
                                  </>
                                )}
                                {isOrdered && canComplete && (
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
                                    Hoàn thành &amp; Tính tiền phòng
                                  </button>
                                )}
                              </div>
                            </div>
                            {(it.time || (it.detail && it.detail !== 'Không')) && (
                              <div style={{ display: 'flex', gap: 6, fontSize: 11.5, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                {it.time && (
                                  <span
                                    style={{
                                      background: '#fffbeb',
                                      color: '#b45309',
                                      border: '1px solid #fde68a',
                                      padding: '2px 7px',
                                      borderRadius: 4,
                                      fontWeight: 600,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <span style={{ color: '#92400e', fontSize: 10.5, fontWeight: 700 }}>Hẹn:</span>
                                    <strong style={{ color: '#b45309' }}>{it.time}</strong>
                                  </span>
                                )}
                                {it.detail && it.detail !== 'Không' && (
                                  <span
                                    style={{
                                      background: '#f8fafc',
                                      color: '#334155',
                                      border: '1px solid #e2e8f0',
                                      padding: '2px 7px',
                                      borderRadius: 4,
                                      fontWeight: 500,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <span style={{ color: '#64748b', fontSize: 10.5, fontWeight: 700 }}>Ghi chú:</span>
                                    <strong style={{ color: '#0f172a' }}>{it.detail}</strong>
                                  </span>
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
                  const stayOrders = matchedStay
                    ? orders.filter((o) => String(o.stayId) === String(matchedStay.stayId))
                    : [];
                  const matchedItems = matchPreOrderItemsToStayOrders(items, stayOrders);
                  const hasUncharged = matchedStay && matchedItems.some((it) => !it.matchedOrder);

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
                            Đã nhận phòng {matchedStay.roomNumber}
                          </span>
                          {canCreateOrder && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {hasUncharged ? (
                                canComplete ? (
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
                                    title="Hoàn thành toàn bộ các dịch vụ đặt trước của khách và tính vào hóa đơn phòng"
                                  >
                                    Tính tất cả vào tiền phòng
                                  </button>
                                ) : (
                                  <span
                                    style={{
                                      background: '#fef3c7',
                                      color: '#92400e',
                                      border: '1px solid #fde68a',
                                      padding: '4px 8px',
                                      borderRadius: 4,
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      display: 'inline-block',
                                    }}
                                  >
                                    Chờ tính vào tiền phòng
                                  </span>
                                )
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
                                  Đã tính hết vào tiền phòng
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
                            Chờ khách đến nhận phòng
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
            filteredPreOrders.length,
            preOrderPageSize,
            setPreOrderPage,
            setPreOrderPageSize
          )}
        </div>
      )}

      {/* ======================= TAB 4: QUYẾT TOÁN & HÓA ĐƠN PHÒNG ======================= */}
      {activeTab === 'folios' && canViewFolios && (
        <FolioBillingTab
          role={role}
          activeStays={activeStays}
          vouchers={vouchers}
          onRefresh={async () => {
            await loadActiveStays();
            await loadOrders();
            await loadVouchers();
          }}
          busy={busy}
          setBusy={setBusy}
        />
      )}

      {/* ======================= TAB 5: QUẢN LÝ MÃ KHUYẾN MÃI VOUCHER ======================= */}
      {activeTab === 'vouchers' && canViewVouchers && (
        <VoucherManagementTab
          role={role}
          vouchers={vouchers}
          onRefresh={loadVouchers}
          busy={busy}
          setBusy={setBusy}
        />
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
                          <span>
                            {allHandled
                              ? `Toàn bộ ${preOrdersForSelectedStay.length} dịch vụ đặt trước đã được tính vào tiền phòng (Đã hoàn tất):`
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
                                      Đã tính vào tiền phòng (Đơn #{po.orderId})
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
                                      Đang phục vụ (Đơn #{po.orderId})
                                    </span>
                                  )}
                                  {notCreated && (
                                    <span
                                      style={{
                                        background: '#fef3c7',
                                        color: '#92400e',
                                        border: '1px solid #fde68a',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        padding: '1px 6px',
                                        borderRadius: 4,
                                      }}
                                    >
                                      Chờ tính vào tiền phòng
                                    </span>
                                  )}
                                </div>
                                {(po.scheduledTime || (po.details && po.details !== 'Không')) && (
                                  <div style={{ display: 'flex', gap: 6, fontSize: 11.5, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                    {po.scheduledTime && (
                                      <span
                                        style={{
                                          background: '#fffbeb',
                                          color: '#b45309',
                                          border: '1px solid #fde68a',
                                          padding: '1px 6px',
                                          borderRadius: 4,
                                          fontWeight: 600,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 3,
                                        }}
                                      >
                                        <span style={{ color: '#92400e', fontSize: 10.5, fontWeight: 700 }}>Hẹn:</span>
                                        <strong>{po.scheduledTime}</strong>
                                      </span>
                                    )}
                                    {po.details && po.details !== 'Không' && (
                                      <span
                                        style={{
                                          background: '#f8fafc',
                                          color: '#334155',
                                          border: '1px solid #e2e8f0',
                                          padding: '1px 6px',
                                          borderRadius: 4,
                                          fontWeight: 500,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 3,
                                        }}
                                      >
                                        <span style={{ color: '#64748b', fontSize: 10.5, fontWeight: 700 }}>Ghi chú:</span>
                                        <strong style={{ color: '#0f172a' }}>{po.details}</strong>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDetailModalData({
                                      type: 'PRE_ORDER',
                                      reservation: {
                                        reservationId: selectedStay.reservationId,
                                        reservationCode: selectedStay.reservationCode,
                                        contactName: selectedStay.guestName,
                                        contactPhone: selectedStay.phoneNumber,
                                        checkInDate: selectedStay.checkInDate || selectedStay.actualCheckIn,
                                        checkOutDate: selectedStay.checkOutDate || selectedStay.actualCheckOut,
                                      },
                                      item: {
                                        itemIndex: po.itemIndex,
                                        serviceId: po.serviceId,
                                        serviceName: po.serviceName,
                                        quantity: po.quantity,
                                        time: po.scheduledTime,
                                        detail: po.details,
                                      },
                                      matchedStay: selectedStay,
                                      existingOrder: po.matchedOrder || null,
                                    })
                                  }
                                  style={{
                                    background: '#f1f5f9',
                                    color: '#0f172a',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 4,
                                    padding: '4px 8px',
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title="Xem chi tiết lịch hẹn & yêu cầu của khách"
                                >
                                  Chi tiết
                                </button>
                                {isCompleted ? (
                                  <span style={{ color: '#16a34a', fontSize: 11.5, fontWeight: 700 }}>
                                    Đã tính vào tiền phòng
                                  </span>
                                ) : isOrdered ? (
                                  <span style={{ color: '#d97706', fontSize: 11.5, fontWeight: 600 }}>
                                    Đang phục vụ
                                  </span>
                                ) : (
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    {canComplete && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOpenQuickLoadAndCompleteConfirm(selectedStay, {
                                            itemIndex: po.itemIndex,
                                            serviceId: po.serviceId,
                                            serviceName: po.serviceName,
                                            quantity: po.quantity,
                                            time: po.scheduledTime,
                                            detail: po.details,
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
                                        title="Hoàn thành đơn và cộng tiền vào hóa đơn phòng ngay"
                                      >
                                        Hoàn thành &amp; Tính tiền phòng
                                      </button>
                                    )}
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
                                      title="Hủy dịch vụ đặt trước này"
                                    >
                                      Hủy hẹn
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
                          paddingLeft: 12,
                          borderColor: matchingStays.length === 0 && roomSearchKeyword ? '#fca5a5' : '#cbd5e1',
                        }}
                        placeholder="Gõ số phòng (VD: 101, 201...) hoặc tên khách..."
                        value={roomSearchKeyword}
                        onChange={(e) => setRoomSearchKeyword(e.target.value)}
                        autoFocus
                      />
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
                          Hiện tại khách sạn không có phòng nào đang lưu trú (Check-in).
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
                                  Có đặt trước
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

              <div style={{ marginBottom: 14 }}>
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

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Thời gian hẹn nhận / phục vụ tại phòng *</label>
                <input
                  required
                  type="text"
                  style={inputStyle}
                  placeholder="Ví dụ: Giao ngay, 19:30 tối nay, hoặc 07:00 sáng mai..."
                  value={orderForm.scheduledTime || ''}
                  onChange={(e) => setOrderForm({ ...orderForm, scheduledTime: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Yêu cầu / Ghi chú phục vụ (Tùy chọn)</label>
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="Ví dụ: Ít đá, không hành, gọi trước khi mang lên..."
                  value={orderForm.notes || ''}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
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

              {/* Tùy chọn tự động hoàn thành và cộng vào Folio ngay (Chỉ hiện cho NV Dịch vụ, Lễ tân tạo đơn tự động vào Chờ phục vụ) */}
              {canComplete ? (
                <div style={{ marginBottom: 18, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0, fontSize: 13, color: '#166534', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={orderForm.completeImmediately ?? true}
                      onChange={(e) => setOrderForm({ ...orderForm, completeImmediately: e.target.checked })}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#16a34a' }}
                    />
                    <span>Tự động xác nhận hoàn thành &amp; cộng tiền vào hóa đơn phòng ngay</span>
                  </label>
                  <div style={{ fontSize: 11.5, color: '#15803d', marginLeft: 24, marginTop: 2 }}>
                    (Nếu bỏ tích, đơn sẽ được tạo ở trạng thái <strong>Đã xác nhận - Chờ phục vụ</strong> và khóa hủy)
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 18, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '10px 12px', fontSize: 12.5, color: '#1e40af' }}>
                  <strong>Lễ tân đặt hộ khách:</strong> Đơn sẽ tự động được tính là <strong>Đã xác nhận (Chờ phục vụ)</strong> và chuyển thẳng cho bộ phận Dịch vụ thực hiện &amp; hoàn thành.
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
                Hủy Đơn Gọi Dịch Vụ #{voidModalData.order?.serviceOrderId}
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
            <div style={{ marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                Xác Nhận Hủy Dịch Vụ Đặt Trước
              </h3>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
                Booking #{cancelPreOrderModal.reservation?.reservationCode} ({cancelPreOrderModal.reservation?.contactName})
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
                {cancelPreOrderModal.item?.serviceName} (Tổng đặt: {cancelPreOrderModal.item?.quantity || 1} suất)
              </div>
              {cancelPreOrderModal.item?.time && (
                <div style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>
                  Thời gian hẹn: <strong>{cancelPreOrderModal.item?.time}</strong>
                </div>
              )}
              {cancelPreOrderModal.item?.detail && cancelPreOrderModal.item?.detail !== 'Không' && (
                <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>
                  Ghi chú yêu cầu: <strong>{cancelPreOrderModal.item?.detail}</strong>
                </div>
              )}
            </div>

            {Number(cancelPreOrderModal.item?.quantity || 1) > 1 && (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 16,
                }}
              >
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
                  Chọn số lượng suất muốn hủy (Không bắt buộc hủy hết):
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="number"
                    min={1}
                    max={Number(cancelPreOrderModal.item?.quantity || 1)}
                    value={cancelPreOrderModal.cancelQty || 1}
                    onChange={(e) => {
                      const maxQ = Number(cancelPreOrderModal.item?.quantity || 1);
                      const val = Math.max(1, Math.min(maxQ, Number(e.target.value) || 1));
                      setCancelPreOrderModal({ ...cancelPreOrderModal, cancelQty: val });
                    }}
                    style={{ ...inputStyle, width: 90, fontWeight: 700 }}
                  />
                  <span style={{ fontSize: 12.5, color: '#78350f' }}>
                    / {cancelPreOrderModal.item?.quantity} suất đã đặt
                  </span>
                  <button
                    type="button"
                    onClick={() => setCancelPreOrderModal({ ...cancelPreOrderModal, cancelQty: 1 })}
                    style={{
                      background: cancelPreOrderModal.cancelQty === 1 ? '#d97706' : '#fff',
                      color: cancelPreOrderModal.cancelQty === 1 ? '#fff' : '#92400e',
                      border: '1px solid #f59e0b',
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Hủy 1 suất
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCancelPreOrderModal({
                        ...cancelPreOrderModal,
                        cancelQty: Number(cancelPreOrderModal.item?.quantity || 1),
                      })
                    }
                    style={{
                      background:
                        cancelPreOrderModal.cancelQty === Number(cancelPreOrderModal.item?.quantity || 1)
                          ? '#dc2626'
                          : '#fff',
                      color:
                        cancelPreOrderModal.cancelQty === Number(cancelPreOrderModal.item?.quantity || 1)
                          ? '#fff'
                          : '#dc2626',
                      border: '1px solid #fca5a5',
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Hủy tất cả ({cancelPreOrderModal.item?.quantity})
                  </button>
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
              {Number(cancelPreOrderModal.cancelQty || 1) < Number(cancelPreOrderModal.item?.quantity || 1)
                ? `Hệ thống sẽ giảm đi ${cancelPreOrderModal.cancelQty} suất và giữ lại ${Number(cancelPreOrderModal.item?.quantity) - Number(cancelPreOrderModal.cancelQty)} suất cho khách.`
                : 'Lượt đặt trước này sẽ được xóa khỏi lịch đón tiếp của khách sạn (các lượt đặt khác không bị ảnh hưởng).'}
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
                {busy
                  ? 'Đang hủy...'
                  : Number(cancelPreOrderModal.item?.quantity || 1) > 1
                  ? `Xác nhận hủy ${cancelPreOrderModal.cancelQty} suất`
                  : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem Chi Tiết Lịch Đặt Trước / Đơn Dịch Vụ Phòng */}
      {detailModalData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1055,
          }}
          onClick={() => setDetailModalData(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: 520,
              maxWidth: '94vw',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                  {detailModalData.type === 'ROOM_ORDER'
                    ? `Chi Tiết Đơn Dịch Vụ Phòng #${detailModalData.order?.serviceOrderId}`
                    : `Chi Tiết Lịch Dịch Vụ Đặt Trước`}
                </h3>
                <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
                  {detailModalData.type === 'ROOM_ORDER'
                    ? `Phòng ${detailModalData.order?.roomNumber || '—'} • Khách: ${detailModalData.order?.guestName || '—'}`
                    : `Mã Booking: #${detailModalData.reservation?.reservationCode} • Khách: ${detailModalData.reservation?.contactName}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalData(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 18,
                  color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {detailModalData.type === 'ROOM_ORDER' && detailModalData.order && (
              <div style={{ fontSize: 13.5, color: '#334155' }}>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 14,
                    marginBottom: 14,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Phòng lưu trú</div>
                    <strong style={{ color: '#0284c7', fontSize: 15 }}>Phòng {detailModalData.order.roomNumber}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Khách hàng</div>
                    <strong>{detailModalData.order.guestName || '—'}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Tên dịch vụ</div>
                    <strong style={{ color: '#0f172a' }}>{detailModalData.order.serviceName}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Số lượng & Đơn giá</div>
                    <strong>
                      {detailModalData.order.quantity} {detailModalData.order.billingUnit} × {formatVND(detailModalData.order.unitPrice)}
                    </strong>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Thời gian đặt</div>
                    <strong>{formatDateTime(detailModalData.order.orderTime)}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Tổng thành tiền</div>
                    <strong style={{ color: '#16a34a', fontSize: 15 }}>{formatVND(detailModalData.order.totalAmount)}</strong>
                  </div>
                  {detailModalData.matchedStay && (
                    <div style={{ gridColumn: '1 / -1', background: '#f1f5f9', padding: '6px 10px', borderRadius: 6 }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Thời gian lưu trú của phòng:</div>
                      <div style={{ fontSize: 12.5, color: '#0f172a' }}>
                        Nhận phòng: <strong>{formatDate(detailModalData.matchedStay.checkInDate || detailModalData.matchedStay.actualCheckIn)}</strong> • Trả phòng: <strong>{formatDate(detailModalData.matchedStay.checkOutDate || detailModalData.matchedStay.actualCheckOut)}</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Khối hiển thị Ghi chú / Lịch hẹn phục vụ của khách */}
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#92400e', fontSize: 12.5, marginBottom: 4 }}>
                    Ghi chú phục vụ &amp; Thời gian khách yêu cầu:
                  </div>
                  <div style={{ color: '#78350f', fontSize: 13.5 }}>
                    {formatOrderNotes(detailModalData.order.notes) || 'Khách không kèm ghi chú đặc biệt (Phục vụ theo tiêu chuẩn)'}
                  </div>
                </div>

                {detailModalData.order.status === 'VOIDED' && detailModalData.order.cancelReason && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 14,
                      color: '#991b1b',
                    }}
                  >
                    <strong>Lý do hủy đơn:</strong> {detailModalData.order.cancelReason}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                  <div>
                    {detailModalData.order.status === 'ORDERED' ? (
                      detailModalData.order.staffConfirmed ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 9999,
                            fontSize: 12,
                            fontWeight: 600,
                            backgroundColor: '#dbeafe',
                            color: '#1e40af',
                          }}
                        >
                          Chờ phục vụ (Đã xác nhận - Khóa hủy)
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 9999,
                            fontSize: 12,
                            fontWeight: 600,
                            backgroundColor: '#fef9c3',
                            color: '#854d0e',
                          }}
                        >
                          Chờ nhân viên xác nhận
                        </span>
                      )
                    ) : (
                      <StatusBadge status={detailModalData.order.status} />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {detailModalData.order.status === 'ORDERED' && !detailModalData.order.staffConfirmed && canConfirm && (
                      <button
                        type="button"
                        onClick={() => {
                          const ord = detailModalData.order;
                          setDetailModalData(null);
                          handleOpenConfirmOrderModal(ord);
                        }}
                        style={{
                          background: '#0284c7',
                          color: '#fff',
                          border: 'none',
                          padding: '7px 14px',
                          borderRadius: 6,
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        Xác nhận đơn
                      </button>
                    )}
                    {detailModalData.order.status === 'ORDERED' && detailModalData.order.staffConfirmed && canComplete && (
                      <button
                        type="button"
                        onClick={() => {
                          const ord = detailModalData.order;
                          setDetailModalData(null);
                          handleOpenCompleteOrderConfirm(ord);
                        }}
                        style={{
                          background: '#16a34a',
                          color: '#fff',
                          border: 'none',
                          padding: '7px 14px',
                          borderRadius: 6,
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        Xác nhận Hoàn thành
                      </button>
                    )}
                    {detailModalData.order.status === 'ORDERED' && !detailModalData.order.staffConfirmed && canVoid && (
                      <button
                        type="button"
                        onClick={() => {
                          const ord = detailModalData.order;
                          setDetailModalData(null);
                          handleOpenVoidModal(ord);
                        }}
                        style={{
                          background: '#fee2e2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          padding: '7px 14px',
                          borderRadius: 6,
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        Hủy đơn
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDetailModalData(null)}
                      style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        border: 'none',
                        padding: '7px 16px',
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              </div>
            )}

            {detailModalData.type === 'PRE_ORDER' && detailModalData.item && (
              <div style={{ fontSize: 13.5, color: '#334155' }}>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 14,
                    marginBottom: 14,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Khách hàng & Liên hệ</div>
                    <strong>{detailModalData.reservation?.contactName}</strong>
                    <div style={{ fontSize: 12, color: '#64748b' }}>SĐT: {detailModalData.reservation?.contactPhone}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Lịch lưu trú</div>
                    <div>Nhận: <strong>{formatDate(detailModalData.reservation?.checkInDate)}</strong></div>
                    <div>Trả: <strong>{formatDate(detailModalData.reservation?.checkOutDate)}</strong></div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Dịch vụ đặt trước</div>
                    <strong style={{ color: '#0f172a', fontSize: 14.5 }}>{detailModalData.item.serviceName}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Số lượng yêu cầu</div>
                    <strong style={{ color: '#ea580c', fontSize: 14.5 }}>{detailModalData.item.quantity} suất</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Trạng thái nhận phòng</div>
                    {detailModalData.matchedStay ? (
                      <strong style={{ color: '#166534' }}>Đã nhận Phòng {detailModalData.matchedStay.roomNumber}</strong>
                    ) : (
                      <strong style={{ color: '#b45309' }}>Khách chưa nhận phòng</strong>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>Trạng thái phục vụ &amp; Tiền phòng</div>
                    {detailModalData.existingOrder?.status === 'COMPLETED' ? (
                      <strong style={{ color: '#166534' }}>Đã hoàn thành &amp; Tính tiền phòng (#{detailModalData.existingOrder.serviceOrderId})</strong>
                    ) : detailModalData.existingOrder?.status === 'ORDERED' ? (
                      <strong style={{ color: '#b45309' }}>Đang phục vụ (#{detailModalData.existingOrder.serviceOrderId})</strong>
                    ) : detailModalData.matchedStay ? (
                      <strong style={{ color: '#b45309' }}>Chờ tính vào tiền phòng</strong>
                    ) : (
                      <strong style={{ color: '#0369a1' }}>Đã ghi nhận lịch hẹn (Chờ check-in)</strong>
                    )}
                  </div>
                </div>

                {/* Khối Lịch Hẹn & Ghi Chú Chi Tiết */}
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 8,
                    padding: 14,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#92400e', fontWeight: 700, display: 'block' }}>
                      Thời gian khách hẹn nhận dịch vụ:
                    </span>
                    <strong style={{ fontSize: 14.5, color: '#b45309' }}>
                      {detailModalData.item.time || 'Phục vụ trong thời gian lưu trú'}
                    </strong>
                  </div>
                  <div style={{ borderTop: '1px dashed #fcd34d', paddingTop: 8 }}>
                    <span style={{ fontSize: 12, color: '#92400e', fontWeight: 700, display: 'block' }}>
                      Ghi chú &amp; Yêu cầu đặc biệt của khách:
                    </span>
                    <div style={{ fontSize: 13.5, color: '#0f172a', marginTop: 2, fontWeight: 500 }}>
                      {detailModalData.item.detail && detailModalData.item.detail !== 'Không'
                        ? detailModalData.item.detail
                        : 'Không có ghi chú riêng (Chuẩn bị theo tiêu chuẩn)'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {!detailModalData.existingOrder && canComplete && !detailModalData.matchedStay && (
                    <div
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: 6,
                        padding: '7px 12px',
                        fontSize: 12,
                        color: '#1e40af',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>Khách chưa nhận phòng. Cần chờ lễ tân làm thủ tục check-in để tạo mã lưu trú (Stay) trước khi có thể tính vào tiền phòng.</span>
                    </div>
                  )}
                  {!detailModalData.existingOrder && canComplete && detailModalData.matchedStay && (
                    <button
                      type="button"
                      onClick={() => {
                        const { matchedStay, item } = detailModalData;
                        setDetailModalData(null);
                        handleOpenQuickLoadAndCompleteConfirm(matchedStay, item);
                      }}
                      style={{
                        background: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 14px',
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Hoàn thành &amp; Tính tiền phòng
                    </button>
                  )}
                  {detailModalData.existingOrder?.status === 'ORDERED' && canComplete && (
                    <button
                      type="button"
                      onClick={() => {
                        const ord = detailModalData.existingOrder;
                        setDetailModalData(null);
                        handleOpenCompleteOrderConfirm(ord);
                      }}
                      style={{
                        background: '#15803d',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 14px',
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Hoàn thành đơn #{detailModalData.existingOrder.serviceOrderId}
                    </button>
                  )}
                  {!detailModalData.existingOrder && canCreateOrder && (
                    <button
                      type="button"
                      onClick={() => {
                        const { reservation, item } = detailModalData;
                        setDetailModalData(null);
                        handleCancelPreOrder(reservation, item);
                      }}
                      style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        padding: '8px 14px',
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Hủy đặt trước
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetailModalData(null)}
                    style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
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
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
                {confirmActionModal.title || 'Xác nhận dịch vụ & tính tiền'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Kiểm tra thông tin trước khi ghi nhận vào hóa đơn tiền phòng
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
              Khi xác nhận, hệ thống sẽ chuyển trạng thái đơn sang <strong>Đã hoàn thành</strong> và tự động cộng tổng tiền vào hóa đơn phòng.
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
