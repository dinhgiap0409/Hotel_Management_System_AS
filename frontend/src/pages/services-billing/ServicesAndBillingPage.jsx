import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { billingApi } from '../../services/billingApi';
import { notifyToast } from '../../lib/http';
import { ModuleToastAutoDismiss } from './components/ModuleToastAutoDismiss';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../config/constants';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatVND } from '../../lib/money';
import { formatDateTime, formatDate } from '../../lib/datetime';
import { FolioBillingTab } from './FolioBillingTab';
import { VoucherManagementTab } from './VoucherManagementTab';
import { ServiceCatalogTab } from './components/ServiceCatalogTab';
import { ServiceOrdersTab } from './components/ServiceOrdersTab';
import { UpcomingPreOrdersTab } from './components/UpcomingPreOrdersTab';
import { HotelServiceModal } from './components/HotelServiceModal';
import { StaffCreateOrderModal } from './components/StaffCreateOrderModal';
import { StaffVoidOrderModal } from './components/StaffVoidOrderModal';
import { StaffCancelPreOrderModal } from './components/StaffCancelPreOrderModal';
import { StaffOrderDetailModal } from './components/StaffOrderDetailModal';
import { StaffConfirmActionModal } from './components/StaffConfirmActionModal';
import {
  parseAndGroupPreOrders,
  buildPreOrderNote,
  formatOrderNotes,
  matchPreOrderItemsToStayOrders,
  getUrgentAlerts,
  clearUrgentAlert,
  syncUrgentAlertsWithRealData,
  sortPreOrdersByCheckoutPriority,
  sortOrdersByCheckoutPriority,
  HMS_URGENT_ALERT_KEY,
  HMS_URGENT_ALERT_EVENT,
} from './components/serviceUtils';

// Phân quyền theo ma trận nghiệp vụ SDD/SRS
const CATALOG_MANAGERS = [ROLES.SERVICE_MANAGER, ROLES.ADMIN];
const CATALOG_VIEW_ALL = [ROLES.SERVICE_MANAGER, ROLES.GENERAL_MANAGER, ROLES.ADMIN];
const CATALOG_TAB_VIEWERS = [
  ROLES.SERVICE_STAFF,
  ROLES.SERVICE_MANAGER,
  ROLES.FRONT_DESK,
  ROLES.SALES_MANAGER,
  ROLES.ACCOUNTANT,
  ROLES.GENERAL_MANAGER,
  ROLES.ADMIN,
];
const ORDER_VIEWERS = [
  ROLES.SERVICE_STAFF,
  ROLES.SERVICE_MANAGER,
  ROLES.FRONT_DESK,
  ROLES.ACCOUNTANT,
  ROLES.GENERAL_MANAGER,
  ROLES.ADMIN,
];
const ORDER_CREATORS = [ROLES.SERVICE_STAFF, ROLES.SERVICE_MANAGER, ROLES.FRONT_DESK, ROLES.ADMIN];
const ORDER_CONFIRMERS = [ROLES.FRONT_DESK, ROLES.SERVICE_STAFF, ROLES.SERVICE_MANAGER, ROLES.ADMIN, ROLES.GENERAL_MANAGER];
const ORDER_COMPLETERS = [ROLES.SERVICE_STAFF, ROLES.SERVICE_MANAGER, ROLES.ADMIN, ROLES.GENERAL_MANAGER];
const ORDER_VOIDERS = [
  ROLES.SERVICE_STAFF,
  ROLES.SERVICE_MANAGER,
  ROLES.FRONT_DESK,
  ROLES.ADMIN,
  ROLES.GENERAL_MANAGER,
];
const FOLIO_VIEWERS = [ROLES.FRONT_DESK, ROLES.ACCOUNTANT, ROLES.GENERAL_MANAGER, ROLES.ADMIN];
// Tab 5 Quản lý Khuyến Mãi (Voucher): SALES_MANAGER, ADMIN, GENERAL_MANAGER (Toàn quyền) & ACCOUNTANT (Chỉ xem đối soát)
const VOUCHER_VIEWERS = [ROLES.SALES_MANAGER, ROLES.ACCOUNTANT, ROLES.ADMIN, ROLES.GENERAL_MANAGER];

const EMPTY_SERVICE_FORM = {
  serviceName: '',
  category: 'F&B',
  billingUnit: 'Lượt',
  unitPrice: '',
  description: '',
  imageUrl: '',
};

const EMPTY_ORDER_FORM = {
  stayId: '',
  serviceId: '',
  quantity: 1,
  scheduledTime: '',
  notes: '',
  completeImmediately: true,
};


export const ServicesAndBillingPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const role = user?.role;
  const isServiceRole = [
    ROLES.SERVICE_STAFF,
    ROLES.SERVICE_MANAGER,
    ROLES.FRONT_DESK,
    ROLES.GENERAL_MANAGER,
    ROLES.ADMIN,
  ].includes(role);

  const canViewCatalog = CATALOG_TAB_VIEWERS.includes(role);
  const canManageCatalog = CATALOG_MANAGERS.includes(role);
  const canViewOrders = ORDER_VIEWERS.includes(role);
  const canViewPreOrders = [
    ROLES.SERVICE_STAFF,
    ROLES.SERVICE_MANAGER,
    ROLES.FRONT_DESK,
    ROLES.GENERAL_MANAGER,
    ROLES.ADMIN,
  ].includes(role);
  const canCreateOrder = ORDER_CREATORS.includes(role);
  const canConfirm = ORDER_CONFIRMERS.includes(role);
  const canComplete = ORDER_COMPLETERS.includes(role);
  const canVoid = ORDER_VOIDERS.includes(role);
  const canViewFolios = FOLIO_VIEWERS.includes(role);
  const canViewVouchers = VOUCHER_VIEWERS.includes(role);

  const [activeTab, setActiveTab] = useState(() => {
    if (tabParam === 'folios' && FOLIO_VIEWERS.includes(role)) return 'folios';
    if (role === ROLES.SALES_MANAGER) return 'vouchers';
    if ([ROLES.FRONT_DESK, ROLES.ACCOUNTANT].includes(role)) return 'folios';
    return 'services';
  });

  useEffect(() => {
    if (tabParam === 'folios' && FOLIO_VIEWERS.includes(role)) {
      setActiveTab('folios');
      return;
    }
    if (role === ROLES.SALES_MANAGER) {
      setActiveTab('vouchers');
    } else if ([ROLES.FRONT_DESK, ROLES.ACCOUNTANT].includes(role)) {
      setActiveTab('folios');
    }
  }, [role, tabParam]);
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

  const [urgentAlerts, setUrgentAlerts] = useState(() => (isServiceRole ? getUrgentAlerts() : []));

  useEffect(() => {
    // Chỉ role bên Dịch vụ (SERVICE_STAFF, SERVICE_MANAGER) mới nhận thông báo và theo dõi cảnh báo khẩn cấp này
    if (!isServiceRole) {
      setUrgentAlerts([]);
      return;
    }

    setUrgentAlerts(getUrgentAlerts());

    const handleAlert = (e) => {
      setUrgentAlerts(getUrgentAlerts());
      if (e.detail && !e.detail.cleared && e.detail.roomNumber) {
        const details =
          e.detail.summaryText ||
          (e.detail.orderIds?.length > 0
            ? `Đơn #${e.detail.orderIds.join(', #')}`
            : 'dịch vụ chưa hoàn thành');
        notifyToast({
          type: 'WARNING',
          message: `🔥 [GẤP - CHECK-OUT] Khách phòng P.${e.detail.roomNumber} đang tại quầy Quyết toán! Cần xử lý: ${details}. Vui lòng Hoàn thành hoặc Hủy đơn ngay!`,
        });
      }
    };
    window.addEventListener(HMS_URGENT_ALERT_EVENT, handleAlert);

    const handleStorage = (e) => {
      if (e.key === HMS_URGENT_ALERT_KEY) {
        setUrgentAlerts(getUrgentAlerts());
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(HMS_URGENT_ALERT_EVENT, handleAlert);
      window.removeEventListener('storage', handleStorage);
    };
  }, [isServiceRole]);

  // Tự động rà soát và xóa các cảnh báo khẩn cấp khi các đơn và dịch vụ đặt trước của phòng đã hoàn tất hoặc bị hủy
  useEffect(() => {
    if (isServiceRole && activeStays.length > 0) {
      const synced = syncUrgentAlertsWithRealData(activeStays, orders, upcomingPreOrders);
      setUrgentAlerts(synced);
    }
  }, [isServiceRole, activeStays, orders, upcomingPreOrders]);

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
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Có lỗi xảy ra trong quá trình xử lý.';
      notifyToast({ type: 'ERROR', message: msg });
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
      imageUrl: s.imageUrl || '',
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
        const nextAlerts = clearUrgentAlert(matchedStay.stayId, null, item.serviceName, matchedStay.roomNumber);
        setUrgentAlerts(nextAlerts);
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
      const nextAlerts = clearUrgentAlert(matchedStay.stayId, null, null, matchedStay.roomNumber);
      setUrgentAlerts(nextAlerts);
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
      reason: '',
    });
  };

  const handleConfirmCancelPreOrder = () => {
    if (!cancelPreOrderModal?.reservation?.reservationId || !cancelPreOrderModal?.item?.serviceId) return;
    const { reservation, item, cancelQty, reason } = cancelPreOrderModal;
    if (!reason || !reason.trim()) {
      notifyToast({ type: 'WARNING', message: 'Vui lòng nhập lý do hủy dịch vụ đặt trước.' });
      return;
    }
    const qtyToCancel = Number(cancelQty) || Number(item.quantity) || 1;
    const totalQty = Number(item.quantity) || 1;
    run(
      () =>
        billingApi.cancelPreOrder(
          reservation.reservationId,
          item.serviceId,
          item.itemIndex,
          qtyToCancel,
          reason.trim()
        ),
      qtyToCancel < totalQty
        ? `Đã hủy ${qtyToCancel} suất "${item.serviceName}" (còn lại ${totalQty - qtyToCancel} suất).`
        : `Đã hủy thành công dịch vụ đặt trước "${item.serviceName}".`,
      async () => {
        setCancelPreOrderModal(null);
        const stay = activeStays.find((s) => s.reservationCode === reservation.reservationCode);
        if (stay) {
          const nextAlerts = clearUrgentAlert(stay.stayId, null, item.serviceName, stay.roomNumber);
          setUrgentAlerts(nextAlerts);
        }
        await Promise.all([loadOrders(), loadUpcomingPreOrders(), loadActiveStays()]);
      }
    );
  };

  const handleCancelPreOrderInStay = (stay, item) => {
    if (!stay?.reservationCode || !item?.serviceId) return;
    const res =
      upcomingPreOrders.find((r) => r.reservationCode === stay.reservationCode) ||
      (stay.reservationId
        ? {
            reservationId: stay.reservationId,
            reservationCode: stay.reservationCode,
            contactName: stay.guestName,
            contactPhone: stay.phoneNumber,
          }
        : null);
    if (!res) {
      notifyToast({ type: 'WARNING', message: 'Không tìm thấy thông tin đặt phòng gốc.' });
      return;
    }
    handleCancelPreOrder(res, {
      ...item,
      time: item.time || item.scheduledTime,
      detail: item.detail || item.details,
    });
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
        setOrders((prev) =>
          prev.map((ord) =>
            ord.serviceOrderId === o.serviceOrderId
              ? { ...ord, status: 'COMPLETED', completedAt: new Date().toISOString() }
              : ord
          )
        );
        const nextAlerts = clearUrgentAlert(o.stayId, o.serviceOrderId, o.serviceName, o.roomNumber);
        setUrgentAlerts(nextAlerts);
        await Promise.all([loadOrders(), loadUpcomingPreOrders(), loadActiveStays()]);
      }
    );

  // 4. Modal Xác Nhận Hoàn Thành Đơn / Nạp Vào Hóa Đơn Phòng
  const handleOpenCompleteOrderConfirm = (o) => {
    if (!o?.serviceOrderId) return;
    const stay = activeStays.find((s) => String(s.stayId) === String(o.stayId));
    const isClosedFolio = stay && stay.folioStatus === 'CLOSED';
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
        setOrders((prev) =>
          prev.map((ord) =>
            ord.serviceOrderId === order.serviceOrderId
              ? { ...ord, status: 'VOIDED', cancelReason: reason.trim(), cancelledAt: new Date().toISOString() }
              : ord
          )
        );
        const nextAlerts = clearUrgentAlert(order.stayId, order.serviceOrderId, order.serviceName, order.roomNumber);
        setUrgentAlerts(nextAlerts);
        setVoidModalData(null);
        await Promise.all([loadOrders(), loadUpcomingPreOrders(), loadActiveStays()]);
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

  const activeUrgentRooms = useMemo(() => {
    if (!isServiceRole || !urgentAlerts || urgentAlerts.length === 0) return [];

    return urgentAlerts
      .map((a) => {
        const stayIdStr = String(a.stayId);
        const matchedStay = activeStays.find(
          (s) =>
            String(s.stayId) === stayIdStr ||
            (a.roomNumber && String(s.roomNumber).trim().toLowerCase() === String(a.roomNumber).trim().toLowerCase())
        );

        // Các đơn phòng của phòng này đang ở trạng thái ORDERED
        const roomOrders = orders.filter(
          (o) =>
            (String(o.stayId) === stayIdStr ||
              (a.roomNumber && o.roomNumber && String(o.roomNumber).trim().toLowerCase() === String(a.roomNumber).trim().toLowerCase())) &&
            o.status === 'ORDERED'
        );

        // Nếu alert chỉ định orderIds cụ thể, chỉ giữ các đơn còn dở dang
        const pendingOrders =
          a.orderIds && a.orderIds.length > 0
            ? roomOrders.filter((o) => a.orderIds.includes(String(o.serviceOrderId)))
            : roomOrders;

        // Dịch vụ đặt trước chưa nạp
        let unchargedPreOrders = [];
        if (matchedStay) {
          const reservation = upcomingPreOrders.find(
            (r) =>
              r.reservationCode === matchedStay.reservationCode ||
              (a.reservationCode && r.reservationCode === a.reservationCode)
          );
          if (reservation) {
            const rawItems = parseAndGroupPreOrders(reservation.specialNotes);
            const stayOrders = orders.filter(
              (o) =>
                String(o.stayId) === String(matchedStay.stayId) ||
                (a.roomNumber && o.roomNumber && String(o.roomNumber).trim().toLowerCase() === String(a.roomNumber).trim().toLowerCase())
            );
            const matchedItems = matchPreOrderItemsToStayOrders(rawItems, stayOrders);
            const rawUncharged = matchedItems.filter(
              (it) => !it.matchedOrder || (it.matchedOrder.status !== 'COMPLETED' && it.matchedOrder.status !== 'VOIDED')
            );
            if (a.preOrderNames && a.preOrderNames.length > 0) {
              unchargedPreOrders = rawUncharged.filter((it) =>
                a.preOrderNames.some((name) => name.trim().toLowerCase() === it.serviceName.trim().toLowerCase())
              );
            } else {
              unchargedPreOrders = rawUncharged;
            }
          }
        }

        const totalRemaining = pendingOrders.length + unchargedPreOrders.length;
        if (totalRemaining === 0) {
          return null; // Đã xong hết các đơn khẩn cấp của phòng này!
        }

        return {
          alert: a,
          roomNumber: a.roomNumber || matchedStay?.roomNumber || '—',
          stayId: a.stayId,
          pendingOrders,
          unchargedPreOrders,
          totalRemaining,
        };
      })
      .filter(Boolean);
  }, [isServiceRole, urgentAlerts, orders, upcomingPreOrders, activeStays]);

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
  const sortedOrders = sortOrdersByCheckoutPriority(filteredOrders, urgentAlerts, activeStays);
  const totalOrderPages = Math.max(1, Math.ceil(sortedOrders.length / orderPageSize));
  const paginatedOrders = sortedOrders.slice(
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
    const hasUncharged = matchedItems.some((it) => !it.matchedOrder || it.matchedOrder.status !== 'COMPLETED');

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

  const sortedPreOrders = isServiceRole
    ? sortPreOrdersByCheckoutPriority(
        filteredPreOrders,
        activeStays,
        orders,
        urgentAlerts
      )
    : filteredPreOrders;

  const totalPreOrderPages = Math.max(1, Math.ceil(sortedPreOrders.length / preOrderPageSize));
  const paginatedPreOrders = sortedPreOrders.slice(
    (preOrderPage - 1) * preOrderPageSize,
    preOrderPage * preOrderPageSize
  );

  const activeServicesCount = services.filter((s) => s.status === 'ACTIVE').length;
  const pendingOrdersCount = orders.filter((o) => o.status === 'ORDERED').length;
  const completedOrdersCount = orders.filter((o) => o.status === 'COMPLETED').length;

  const openFoliosCount = (activeStays || []).filter((s) => s?.folioStatus !== 'CLOSED').length;
  const closedFoliosCount = (activeStays || []).filter((s) => s?.folioStatus === 'CLOSED').length;
  const overdueFoliosCount = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return (activeStays || []).filter((s) => {
      if (s?.folioStatus === 'CLOSED') return false;
      const co = typeof s?.checkOutDate === 'string' ? s.checkOutDate.substring(0, 10) : '';
      return co && co < todayStr;
    }).length;
  }, [activeStays]);
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
  const openFoliosTotalBalance = useMemo(() => {
    return (activeStays || [])
      .filter((s) => s?.folioStatus !== 'CLOSED')
      .reduce((sum, s) => sum + (Number(s?.totalAmount) || 0), 0);
  }, [activeStays]);
  const totalVouchersCount = (vouchers || []).length;
  const activeVouchersCount = (vouchers || []).filter((v) => v?.status === 'ACTIVE').length;
  const usedVouchersCount = (vouchers || []).reduce((acc, v) => acc + (v?.usedCount || 0), 0);
  const pausedOrFullVouchersCount = (vouchers || []).filter(
    (v) => v && (v.status !== 'ACTIVE' || (v.usageLimit > 0 && v.usedCount >= v.usageLimit))
  ).length;

  const pageHeaderInfo = useMemo(() => {
    if (role === ROLES.GENERAL_MANAGER || role === ROLES.ADMIN) {
      return {
        title: 'Quản Lý Dịch Vụ, Hóa Đơn Phòng & Khuyến Mãi',
        subtitle:
          'Điều hành toàn diện danh mục dịch vụ phụ trợ, vận hành đơn phục vụ tại phòng, đối soát hóa đơn lưu trú (Folio) và chương trình khuyến mãi.',
      };
    }
    if (role === ROLES.FRONT_DESK) {
      return {
        title: 'Quầy Thu Ngân, Quyết Toán Hóa Đơn & Dịch Vụ Phòng',
        subtitle:
          'Kiểm tra bảng kê chi phí lưu trú (Folio), khấu trừ tiền đặt cọc, áp dụng mã giảm giá, thu tiền quyết toán và hỗ trợ đặt dịch vụ phòng.',
      };
    }
    if (role === ROLES.SALES_MANAGER) {
      return {
        title: 'Quản Lý Chương Trình Khuyến Mãi & Danh Mục Dịch Vụ',
        subtitle:
          'Cấu hình và phát hành mã khuyến mãi ưu đãi, kiểm soát hạn mức ngân sách chiết khấu và tra cứu danh mục dịch vụ đang kinh doanh.',
      };
    }
    if (role === ROLES.ACCOUNTANT) {
      return {
        title: 'Đối Soát Hóa Đơn Lưu Trú, Dịch Vụ & Khuyến Mãi',
        subtitle:
          'Hậu kiểm bảng kê chi phí phòng lưu trú (Folio), đơn dịch vụ phát sinh, phụ thu, khấu trừ tiền đặt cọc và xuất hóa đơn GTGT (VAT).',
      };
    }
    return {
      title: 'Quản Lý Dịch Vụ Khách Sạn & Phục Vụ Tại Phòng',
      subtitle:
        'Quản lý danh mục dịch vụ phụ trợ, tiếp nhận và điều phối đơn gọi dịch vụ tại phòng cùng lịch dịch vụ khách đặt trước.',
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
      <ModuleToastAutoDismiss duration={3500} />
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
      {role === ROLES.GENERAL_MANAGER || role === ROLES.ADMIN ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 24 }}>
          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Hóa Đơn Phòng Chờ Thu</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {openFoliosCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>phòng mở</span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: overdueFoliosCount > 0 ? '#dc2626' : '#16a34a',
                marginTop: 4,
                fontWeight: overdueFoliosCount > 0 ? 600 : 500,
              }}
            >
              {overdueFoliosCount > 0
                ? `⚠️ ${overdueFoliosCount} phòng quá hạn trả • ${closedFoliosCount} đã đóng`
                : `✓ ${closedFoliosCount} phòng đã quyết toán`}
            </div>
          </div>

          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Tổng Dư Nợ Phòng Đang Mở</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0284c7', marginTop: 6 }}>
              {formatVND(openFoliosTotalBalance)}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Đã trừ cọc &amp; cộng 8% thuế GTGT
            </div>
          </div>

          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Danh Mục Dịch Vụ Mở Bán</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {activeServicesCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>/ {(services || []).length} dịch vụ</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Đang kinh doanh phục vụ lưu trú
            </div>
          </div>

          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Vận Hành Đơn Dịch Vụ</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {pendingOrdersCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>chờ phục vụ</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              {completedOrdersCount} đơn hoàn tất • {(upcomingPreOrders || []).length} lịch đặt trước
            </div>
          </div>

          <div style={{ background: '#fff', padding: '16px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Chương Trình Khuyến Mãi</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {activeVouchersCount}{' '}
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>/ {totalVouchersCount} mã mở</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Đã áp dụng {usedVouchersCount} lượt giảm giá
            </div>
          </div>
        </div>
      ) : role === ROLES.FRONT_DESK ? (
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
            <div
              style={{
                fontSize: 12,
                color: overdueFoliosCount > 0 ? '#dc2626' : '#d97706',
                marginTop: 4,
                fontWeight: overdueFoliosCount > 0 ? 600 : 400,
              }}
            >
              {overdueFoliosCount > 0 ? `⚠️ Có ${overdueFoliosCount} phòng quá hạn trả` : 'Chờ thu khi checkout'}
            </div>
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
            Đơn Phục Vụ Tại Phòng ({orders.length})
          </button>
        )}

        {canViewPreOrders && (
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
            Lịch Dịch Vụ Đặt Trước ({upcomingPreOrders.length})
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
            Hóa Đơn &amp; Quyết Toán Phòng ({activeStays.length})
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

      {/* THÔNG BÁO KHẨN CẤP TRÊN DASHBOARD / TRANG QUẢN LÝ DỊCH VỤ - CHỈ HIỂN THỊ KHI CÒN ĐƠN CẦN GIẢI TỎA */}
      {isServiceRole && activeUrgentRooms && activeUrgentRooms.length > 0 && (
        <div
          style={{
            background: '#fef2f2',
            border: '1.5px solid #ef4444',
            borderRadius: 8,
            padding: '14px 18px',
            marginBottom: 16,
            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 280 }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>🔥</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 14 }}>
                CẢNH BÁO CHECK-OUT TẠI QUẦY: CÓ {activeUrgentRooms.length} PHÒNG CẦN XỬ LÝ DỊCH VỤ GẤP!
              </div>
              <div style={{ fontSize: 12.5, color: '#b91c1c', marginTop: 4, lineHeight: 1.5 }}>
                {activeUrgentRooms.map(({ alert: a, roomNumber, stayId, pendingOrders, unchargedPreOrders, totalRemaining }) => (
                  <div
                    key={stayId}
                    style={{
                      background: '#fff',
                      border: '1px solid #fecaca',
                      borderRadius: 6,
                      padding: '6px 10px',
                      marginTop: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                      <div>
                        <strong>• Phòng P.{roomNumber}</strong>{' '}
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>
                          (Còn <strong>{totalRemaining}</strong> mục chưa xử lý)
                        </span>
                        :
                      </div>
                      <span
                        style={{
                          background: '#fee2e2',
                          color: '#991b1b',
                          border: '1px solid #fca5a5',
                          borderRadius: 4,
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        ⚡ Đang chờ bộ phận Dịch vụ giải tỏa
                      </span>
                    </div>
                    <div style={{ marginTop: 3, fontSize: 12, color: '#475569' }}>
                      {pendingOrders.length > 0 && (
                        <span>
                          <strong style={{ color: '#0f172a' }}>Đơn dịch vụ phòng:</strong>{' '}
                          {pendingOrders
                            .map((o) => `${o.serviceName} (#${o.serviceOrderId})`)
                            .join(', ')}
                        </span>
                      )}
                      {pendingOrders.length > 0 && unchargedPreOrders.length > 0 && <span> • </span>}
                      {unchargedPreOrders.length > 0 && (
                        <span>
                          <strong style={{ color: '#0f172a' }}>Dịch vụ đặt trước chưa nạp:</strong>{' '}
                          {unchargedPreOrders.map((it) => it.serviceName).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 6, color: '#7f1d1d', fontStyle: 'italic', fontSize: 11.5 }}>
                  🔒 Thông báo này được ghim cố định và chỉ tự động tắt khi bạn đã xử lý xong toàn bộ các đơn dịch vụ trên (Bấm <strong>[Hoàn thành]</strong> nếu khách đã dùng, hoặc <strong>[Hủy]</strong> nếu chưa xác nhận) để quầy Lễ tân chốt hóa đơn check-out.
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {activeTab !== 'orders' && canViewOrders && (
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  padding: '7px 14px',
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                👉 Sang Tab Đơn Dịch Vụ
              </button>
            )}
          </div>
        </div>
      )}

      {/* ======================= TAB 1: DANH MỤC DỊCH VỤ ======================= */}
      {activeTab === 'services' && (
        <ServiceCatalogTab
          serviceCategoryFilter={serviceCategoryFilter}
          setServiceCategoryFilter={setServiceCategoryFilter}
          setServicePage={setServicePage}
          filteredServices={filteredServices}
          canManageCatalog={canManageCatalog}
          handleOpenCreateService={handleOpenCreateService}
          paginatedServices={paginatedServices}
          busy={busy}
          handleOpenEditService={handleOpenEditService}
          toggleStatus={toggleStatus}
          servicePage={servicePage}
          totalServicePages={totalServicePages}
          servicePageSize={servicePageSize}
          setServicePageSize={setServicePageSize}
        />
      )}

      {/* ======================= TAB 2: ĐƠN GỌI DỊCH VỤ ======================= */}
      {activeTab === 'orders' && canViewOrders && (
        <ServiceOrdersTab
          orderSearchKeyword={orderSearchKeyword}
          setOrderSearchKeyword={setOrderSearchKeyword}
          setOrderPage={setOrderPage}
          orderStatusFilter={orderStatusFilter}
          setOrderStatusFilter={setOrderStatusFilter}
          filteredOrders={sortedOrders}
          orders={orders}
          canCreateOrder={canCreateOrder}
          handleOpenCreateOrder={handleOpenCreateOrder}
          paginatedOrders={paginatedOrders}
          activeStays={activeStays}
          setDetailModalData={setDetailModalData}
          canConfirm={canConfirm}
          handleOpenConfirmOrderModal={handleOpenConfirmOrderModal}
          canComplete={canComplete}
          handleOpenCompleteOrderConfirm={handleOpenCompleteOrderConfirm}
          canVoid={canVoid}
          handleOpenVoidModal={handleOpenVoidModal}
          busy={busy}
          orderPage={orderPage}
          totalOrderPages={totalOrderPages}
          orderPageSize={orderPageSize}
          setOrderPageSize={setOrderPageSize}
          urgentAlerts={isServiceRole ? urgentAlerts : []}
        />
      )}

      {/* ======================= TAB 3: LỊCH ĐẶT TRƯỚC DỊCH VỤ ======================= */}
      {activeTab === 'pre-orders' && canViewOrders && (
        <UpcomingPreOrdersTab
          loadUpcomingPreOrders={loadUpcomingPreOrders}
          preOrderSearchKeyword={preOrderSearchKeyword}
          setPreOrderSearchKeyword={setPreOrderSearchKeyword}
          setPreOrderPage={setPreOrderPage}
          preOrderCheckInFilter={preOrderCheckInFilter}
          setPreOrderCheckInFilter={setPreOrderCheckInFilter}
          preOrderChargeFilter={preOrderChargeFilter}
          setPreOrderChargeFilter={setPreOrderChargeFilter}
          filteredPreOrders={sortedPreOrders}
          upcomingPreOrders={upcomingPreOrders}
          paginatedPreOrders={paginatedPreOrders}
          activeStays={activeStays}
          orders={orders}
          setDetailModalData={setDetailModalData}
          canCreateOrder={canCreateOrder}
          canComplete={canComplete}
          handleOpenQuickLoadAndCompleteConfirm={handleOpenQuickLoadAndCompleteConfirm}
          handleCancelPreOrder={handleCancelPreOrder}
          handleOpenCompleteOrderConfirm={handleOpenCompleteOrderConfirm}
          handleOpenQuickLoadAllConfirm={handleOpenQuickLoadAllConfirm}
          busy={busy}
          preOrderPage={preOrderPage}
          totalPreOrderPages={totalPreOrderPages}
          preOrderPageSize={preOrderPageSize}
          setPreOrderPageSize={setPreOrderPageSize}
          urgentAlerts={isServiceRole ? urgentAlerts : []}
        />
      )}

      {/* ======================= TAB 4: QUYẾT TOÁN & HÓA ĐƠN PHÒNG ======================= */}
      {activeTab === 'folios' && canViewFolios && (
        <FolioBillingTab
          role={role}
          activeStays={activeStays}
          vouchers={vouchers}
          services={services}
          onRefresh={async () => {
            await loadActiveStays();
            await loadOrders();
            await loadUpcomingPreOrders();
            await loadVouchers();
            await loadServices();
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
        <HotelServiceModal
          show={showServiceModal}
          editingId={editingId}
          serviceForm={serviceForm}
          setServiceForm={setServiceForm}
          onSubmit={handleServiceSubmit}
          onClose={() => setShowServiceModal(false)}
          busy={busy}
        />
      )}

      {/* ======================= MODAL: ĐẶT DỊCH VỤ PHÒNG ======================= */}
      {showOrderModal && (
        <StaffCreateOrderModal
          show={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          onSubmit={handleOrderSubmit}
          orderForm={orderForm}
          setOrderForm={setOrderForm}
          selectedStay={selectedStay}
          preOrdersForSelectedStay={preOrdersForSelectedStay}
          setDetailModalData={setDetailModalData}
          canComplete={canComplete}
          handleOpenQuickLoadAndCompleteConfirm={handleOpenQuickLoadAndCompleteConfirm}
          handleCancelPreOrderInStay={handleCancelPreOrderInStay}
          roomSearchKeyword={roomSearchKeyword}
          setRoomSearchKeyword={setRoomSearchKeyword}
          matchingStays={matchingStays}
          activeStays={activeStays}
          services={services}
          selectedServiceForOrder={selectedServiceForOrder}
          estimatedOrderTotal={estimatedOrderTotal}
          busy={busy}
        />
      )}

      {/* ======================= MODAL: HỦY ĐƠN DỊCH VỤ ======================= */}
      {voidModalData && (
        <StaffVoidOrderModal
          voidModalData={voidModalData}
          setVoidModalData={setVoidModalData}
          onConfirmVoid={handleConfirmVoid}
          busy={busy}
        />
      )}

      {/* ======================= MODAL: HỦY DỊCH VỤ ĐẶT TRƯỚC ======================= */}
      {cancelPreOrderModal && (
        <StaffCancelPreOrderModal
          cancelPreOrderModal={cancelPreOrderModal}
          setCancelPreOrderModal={setCancelPreOrderModal}
          onConfirmCancel={handleConfirmCancelPreOrder}
          busy={busy}
        />
      )}

      {/* ======================= MODAL: XEM CHI TIẾT ĐƠN / ĐẶT TRƯỚC ======================= */}
      {detailModalData && (
        <StaffOrderDetailModal
          detailModalData={detailModalData}
          onClose={() => setDetailModalData(null)}
          canConfirm={canConfirm}
          canComplete={canComplete}
          canVoid={canVoid}
          canCreateOrder={canCreateOrder}
          onOpenConfirmOrderModal={handleOpenConfirmOrderModal}
          onOpenCompleteOrderConfirm={handleOpenCompleteOrderConfirm}
          onOpenVoidModal={handleOpenVoidModal}
          onOpenQuickLoadAndCompleteConfirm={handleOpenQuickLoadAndCompleteConfirm}
          onCancelPreOrder={handleCancelPreOrder}
        />
      )}

      {/* ======================= MODAL: XÁC NHẬN NẠP VÀO FOLIO / HOÀN THÀNH ======================= */}
      {confirmActionModal && (
        <StaffConfirmActionModal
          confirmActionModal={confirmActionModal}
          onClose={() => setConfirmActionModal(null)}
          busy={busy}
        />
      )}
    </div>
  );
};
