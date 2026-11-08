import { useState, useMemo, useEffect } from 'react';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatVND } from '../../lib/money';
import { formatDate, formatDateTime } from '../../lib/datetime';
import { billingApi } from '../../services/billingApi';
import { notifyToast } from '../../lib/http';
import { ROLES } from '../../config/constants';
import { FolioSettlementModal } from './components/FolioSettlementModal';
import { ConfirmDeleteChargeModal } from './components/ConfirmDeleteChargeModal';
import { ConfirmSettleModal } from './components/ConfirmSettleModal';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { parseAndGroupPreOrders, matchPreOrderItemsToStayOrders, buildPreOrderNote } from './components/serviceUtils';

const CHARGE_TYPE_LABELS = {
  MINIBAR: 'Minibar / Đồ uống tại phòng',
  DAMAGE: 'Đền bù hư hại / Làm vỡ trang thiết bị',
  LATE_CHECKOUT: 'Phụ thu trả phòng muộn (Late check-out)',
  EXTRA_GUEST: 'Phụ thu thêm người lưu trú',
  OTHER: 'Phụ thu phát sinh khác',
};

export const FolioBillingTab = ({ role, activeStays, vouchers = [], services = [], onRefresh, busy, setBusy }) => {
  const canSettle = [ROLES.FRONT_DESK, ROLES.ACCOUNTANT, ROLES.GENERAL_MANAGER, ROLES.ADMIN].includes(role);
  const canManageCharges = [ROLES.FRONT_DESK, ROLES.ACCOUNTANT, ROLES.ADMIN].includes(role);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'OPEN' | 'CLOSED'
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Folio detail modal state
  const [selectedStay, setSelectedStay] = useState(null);
  const [folioDetail, setFolioDetail] = useState(null);
  const [loadingFolio, setLoadingFolio] = useState(false);

  // New additional charge form
  const [showAddChargeForm, setShowAddChargeForm] = useState(false);
  const [chargeError, setChargeError] = useState(null);
  const [chargeToDelete, setChargeToDelete] = useState(null);
  const [chargeForm, setChargeForm] = useState({
    chargeType: 'MINIBAR',
    description: '',
    amount: '',
  });

  // Voucher validation in Folio modal
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null); // { code, discountAmount, ... }
  const [voucherError, setVoucherError] = useState(null);
  const [validatingVoucher, setValidatingVoucher] = useState(false);

  // Settlement form state
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [settleNotes, setSettleNotes] = useState('');
  const [confirmSettleModal, setConfirmSettleModal] = useState(false);

  // Printable Invoice modal state
  const [printInvoiceData, setPrintInvoiceData] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  // Danh sách đơn dịch vụ phòng chưa hoàn thành của lượt lưu trú này
  const [stayPendingOrders, setStayPendingOrders] = useState([]);
  const [stayOrders, setStayOrders] = useState([]);
  const [internalServices, setInternalServices] = useState([]);

  useEffect(() => {
    if (!services || services.length === 0) {
      billingApi.getActiveServices().then((r) => setInternalServices(r.data || [])).catch(() => {});
    }
  }, [services]);

  const allServicesList = services?.length > 0 ? services : internalServices;

  // Fetch Folio details when selectedStay changes
  const fetchFolioDetail = async (stayId) => {
    try {
      setLoadingFolio(true);
      const [res, ordersRes] = await Promise.all([
        billingApi.getFolioDetail(stayId),
        billingApi.getServiceOrders(stayId).catch(() => ({ data: [] })),
      ]);
      setFolioDetail(res.data);
      const ordersList = Array.isArray(ordersRes.data) ? ordersRes.data : (ordersRes.data?.data || []);
      setStayOrders(ordersList);
      setStayPendingOrders(ordersList.filter((o) => o.status === 'ORDERED'));
      // Reset voucher input for new folio
      setVoucherCodeInput('');
      setAppliedVoucher(null);
      setVoucherError(null);
      setShowAddChargeForm(false);
    } catch {
      // Handled by HTTP interceptor
    } finally {
      setLoadingFolio(false);
    }
  };

  const handleOpenFolio = (stay) => {
    setSelectedStay(stay);
    fetchFolioDetail(stay.stayId);
  };

  const handleOpenPrintInvoice = async (stayId, invoiceId = null) => {
    try {
      setLoadingInvoice(true);
      let res;
      if (invoiceId) {
        res = await billingApi.getInvoiceDetail(invoiceId);
      } else {
        res = await billingApi.getInvoiceByStay(stayId);
      }
      setPrintInvoiceData(res.data);
    } catch {
      // Handled by HTTP interceptor
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleAddCharge = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    if (!folioDetail) return;

    if (!chargeForm.description || !chargeForm.description.trim()) {
      const err = 'Vui lòng nhập diễn giải chi tiết cho khoản phụ thu (VD: 2 lon nước ngọt, ly vỡ...).';
      setChargeError(err);
      notifyToast({ type: 'WARNING', message: err });
      return;
    }

    const amt = Number(chargeForm.amount);
    if (isNaN(amt) || amt < 1000) {
      const err = `Số tiền phụ thu tối thiểu là 1,000 VND (bạn đang nhập ${chargeForm.amount || 0} VND). Vui lòng nhập từ 1,000 VND trở lên.`;
      setChargeError(err);
      notifyToast({ type: 'ERROR', message: err });
      return;
    }

    try {
      setBusy(true);
      setChargeError(null);
      await billingApi.addAdditionalCharge(folioDetail.folioId, {
        chargeType: chargeForm.chargeType,
        description: chargeForm.description.trim(),
        amount: amt,
      });
      notifyToast({ type: 'SUCCESS', message: 'Đã thêm khoản phụ thu vào hóa đơn phòng thành công!' });
      setChargeForm({ chargeType: 'MINIBAR', description: '', amount: '' });
      setChargeError(null);
      setShowAddChargeForm(false);
      await fetchFolioDetail(folioDetail.stayId);
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể thêm phụ thu. Vui lòng thử lại.';
      setChargeError(msg);
      notifyToast({ type: 'ERROR', message: msg });
    } finally {
      setBusy(false);
    }
  };

  const handleQuickAddAmount = (addVal) => {
    setChargeForm((prev) => {
      const current = Number(prev.amount) || 0;
      return { ...prev, amount: String(current + addVal) };
    });
    setChargeError(null);
  };

  const handleResetAmount = () => {
    setChargeForm((prev) => ({ ...prev, amount: '' }));
    setChargeError(null);
  };

  const handleConfirmDeleteCharge = async (chargeId) => {
    if (!chargeId) return;
    try {
      setBusy(true);
      await billingApi.deleteAdditionalCharge(chargeId);
      notifyToast({ type: 'SUCCESS', message: 'Đã xóa khoản phụ thu thành công.' });
      setChargeToDelete(null);
      await fetchFolioDetail(folioDetail.stayId);
      if (onRefresh) onRefresh();
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể xóa phụ thu.';
      notifyToast({ type: 'ERROR', message: msg });
    } finally {
      setBusy(false);
    }
  };

  const handleValidateVoucher = async (codeToValidate = null) => {
    const code = (typeof codeToValidate === 'string' ? codeToValidate : voucherCodeInput).trim().toUpperCase();
    if (!code) {
      setVoucherError('Vui lòng nhập hoặc chọn mã voucher.');
      return;
    }
    try {
      setValidatingVoucher(true);
      setVoucherError(null);
      const subtotalAmt = folioDetail?.subtotal || folioDetail?.roomSubtotal || 0;
      const res = await billingApi.validateVoucher({
        code: code,
        subtotalAmount: subtotalAmt,
      });
      const data = res.data;
      if (data.valid) {
        setAppliedVoucher(data);
        setVoucherCodeInput(data.code);
        notifyToast({
          type: 'SUCCESS',
          message: `Áp dụng mã ${data.code} thành công! Được giảm ${formatVND(data.discountAmount)}.`,
        });
      } else {
        setAppliedVoucher(null);
        const rawMsg = data.message || '';
        let cleanMsg = rawMsg;
        if (!rawMsg || rawMsg.includes('Ã') || rawMsg.includes('áº') || rawMsg.includes('á»') || rawMsg.includes('Ä')) {
          if (rawMsg.toLowerCase().includes('tồn') || rawMsg.toLowerCase().includes('tá»')) {
            cleanMsg = 'Mã khuyến mãi không tồn tại trên hệ thống.';
          } else if (rawMsg.toLowerCase().includes('ngưng') || rawMsg.toLowerCase().includes('ngÆ°ng')) {
            cleanMsg = 'Mã khuyến mãi hiện đang tạm ngưng hoạt động.';
          } else if (rawMsg.toLowerCase().includes('hết hạn') || rawMsg.toLowerCase().includes('háº¿t')) {
            cleanMsg = 'Mã khuyến mãi đã hết hạn sử dụng.';
          } else if (rawMsg.toLowerCase().includes('lượt') || rawMsg.toLowerCase().includes('lÆ°á»£t')) {
            cleanMsg = 'Mã khuyến mãi đã hết lượt sử dụng.';
          } else {
            cleanMsg = 'Mã khuyến mãi không tồn tại trên hệ thống.';
          }
        }
        setVoucherError(cleanMsg);
      }
    } catch (err) {
      setAppliedVoucher(null);
      const rawErr = err.response?.data?.message || '';
      let cleanErr = 'Mã khuyến mãi không tồn tại trên hệ thống.';
      if (rawErr && !rawErr.includes('Ã') && !rawErr.includes('áº') && !rawErr.includes('á»') && !rawErr.includes('Ä')) {
        cleanErr = rawErr;
      }
      setVoucherError(cleanErr);
    } finally {
      setValidatingVoucher(false);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCodeInput('');
    setVoucherError(null);
  };

  // Tính toán số tiền quyết toán tạm tính
  const calculatedFinances = useMemo(() => {
    if (!folioDetail) {
      return {
        subtotal: 0,
        discount: 0,
        taxable: 0,
        tax: 0,
        depositPaid: 0,
        balancePayable: 0,
      };
    }
    const subtotal = folioDetail.subtotal || 0;
    const discount = appliedVoucher ? appliedVoucher.discountAmount : folioDetail.discountAmount || 0;
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * 0.08);
    const gross = taxable + tax;
    const depositPaid = folioDetail.depositPaid || 0;
    const balancePayable = Math.max(0, gross - depositPaid);

    return {
      subtotal,
      discount,
      taxable,
      tax,
      gross,
      depositPaid,
      balancePayable,
    };
  }, [folioDetail, appliedVoucher]);



  // Phân tích toàn bộ dịch vụ đặt trước từ đặt phòng và đối chiếu trạng thái thanh toán
  const stayPreOrderAnalysis = useMemo(() => {
    const notes = folioDetail?.specialNotes || selectedStay?.specialNotes;
    const rawItems = parseAndGroupPreOrders(notes);
    if (!rawItems || rawItems.length === 0) return { items: [], unchargedCount: 0, unchargedAmount: 0 };

    const matched = matchPreOrderItemsToStayOrders(rawItems, stayOrders);
    let unchargedCount = 0;
    let unchargedAmount = 0;

    const enriched = matched.map((it) => {
      const svc = allServicesList.find(
        (s) =>
          String(s.serviceId) === String(it.serviceId) ||
          (s.serviceName && it.serviceName && s.serviceName.trim().toLowerCase() === it.serviceName.trim().toLowerCase())
      );
      const unitPrice = Number(svc?.unitPrice) || Number(it.unitPrice) || 0;
      const totalAmount = unitPrice * (Number(it.quantity) || 1);
      const serviceName = svc?.serviceName || it.serviceName || 'Dịch vụ đặt trước';

      const isUncharged = !it.matchedOrder;
      if (isUncharged) {
        unchargedCount++;
        unchargedAmount += totalAmount;
      }

      return {
        ...it,
        unitPrice,
        totalAmount,
        serviceName,
        isUncharged,
      };
    });

    return {
      items: enriched,
      unchargedCount,
      unchargedAmount,
    };
  }, [folioDetail, selectedStay, stayOrders, allServicesList]);

  // Hoàn thành 1 đơn dịch vụ cụ thể
  const handleCompletePendingOrder = async (ord) => {
    if (!ord?.serviceOrderId || !selectedStay) return;
    try {
      setBusy(true);
      await billingApi.completeServiceOrder(ord.serviceOrderId);
      notifyToast({
        type: 'SUCCESS',
        message: `Đã hoàn thành đơn #${ord.serviceOrderId} và cộng ${formatVND(ord.totalAmount)} vào hóa đơn phòng!`,
      });
      await fetchFolioDetail(selectedStay.stayId);
      if (onRefresh) await onRefresh();
    } catch (err) {
      notifyToast({
        type: 'ERROR',
        message: err?.response?.data?.message || 'Có lỗi khi hoàn thành đơn dịch vụ.',
      });
    } finally {
      setBusy(false);
    }
  };

  // Hủy 1 đơn dịch vụ cụ thể
  const handleVoidPendingOrder = async (ord) => {
    if (!ord?.serviceOrderId || !selectedStay) return;
    try {
      setBusy(true);
      await billingApi.voidServiceOrder(ord.serviceOrderId, 'Khách trả phòng không sử dụng');
      notifyToast({
        type: 'INFO',
        message: `Đã hủy đơn dịch vụ #${ord.serviceOrderId}.`,
      });
      await fetchFolioDetail(selectedStay.stayId);
      if (onRefresh) await onRefresh();
    } catch (err) {
      notifyToast({
        type: 'ERROR',
        message: err?.response?.data?.message || 'Có lỗi khi hủy đơn dịch vụ.',
      });
    } finally {
      setBusy(false);
    }
  };

  // Nạp 1 dịch vụ đặt trước vào hóa đơn và hoàn thành ngay
  const handleChargePreOrder = async (item) => {
    if (!selectedStay || !item?.serviceId) return;
    try {
      setBusy(true);
      const res = await billingApi.createServiceOrder({
        stayId: Number(selectedStay.stayId),
        serviceId: Number(item.serviceId),
        quantity: Number(item.quantity) || 1,
        notes: buildPreOrderNote(item),
      });
      const orderData = res.data?.data || res.data;
      if (orderData?.serviceOrderId) {
        await billingApi.completeServiceOrder(orderData.serviceOrderId);
      }
      notifyToast({
        type: 'SUCCESS',
        message: `Đã nạp và tính tiền dịch vụ "${item.serviceName}" vào hóa đơn phòng thành công!`,
      });
      await fetchFolioDetail(selectedStay.stayId);
      if (onRefresh) await onRefresh();
    } catch (err) {
      notifyToast({
        type: 'ERROR',
        message: err?.response?.data?.message || 'Có lỗi khi nạp dịch vụ đặt trước vào hóa đơn.',
      });
    } finally {
      setBusy(false);
    }
  };

  // Hủy 1 lượt dịch vụ đặt trước
  const handleCancelPreOrderItem = async (item) => {
    const resId = selectedStay?.reservationId || folioDetail?.reservationId;
    if (!resId || !item?.serviceId) return;
    try {
      setBusy(true);
      await billingApi.cancelPreOrder(
        resId,
        Number(item.serviceId),
        item.itemIndex,
        Number(item.quantity),
        'Khách trả phòng không sử dụng'
      );
      notifyToast({
        type: 'INFO',
        message: `Đã hủy dịch vụ đặt trước "${item.serviceName}".`,
      });
      await fetchFolioDetail(selectedStay.stayId);
      if (onRefresh) await onRefresh();
    } catch (err) {
      notifyToast({
        type: 'ERROR',
        message: err?.response?.data?.message || 'Có lỗi khi hủy dịch vụ đặt trước.',
      });
    } finally {
      setBusy(false);
    }
  };

  // Nạp & hoàn thành TẤT CẢ các dịch vụ chưa thanh toán (cả đơn đang dở lẫn đặt trước chưa nạp)
  const handleChargeAllUnsettledServices = async () => {
    if (!selectedStay) return;
    try {
      setBusy(true);
      let count = 0;
      // 1. Hoàn thành các đơn đang dở
      for (const ord of stayPendingOrders) {
        await billingApi.completeServiceOrder(ord.serviceOrderId);
        count++;
      }
      // 2. Nạp và hoàn thành các đặt trước chưa nạp
      for (const po of stayPreOrderAnalysis.items.filter((it) => it.isUncharged)) {
        const res = await billingApi.createServiceOrder({
          stayId: Number(selectedStay.stayId),
          serviceId: Number(po.serviceId),
          quantity: Number(po.quantity) || 1,
          notes: buildPreOrderNote(po),
        });
        const orderData = res.data?.data || res.data;
        if (orderData?.serviceOrderId) {
          await billingApi.completeServiceOrder(orderData.serviceOrderId);
        }
        count++;
      }
      notifyToast({
        type: 'SUCCESS',
        message: `Đã nạp & hoàn thành ${count} dịch vụ vào hóa đơn phòng ${selectedStay.roomNumber} thành công!`,
      });
      await fetchFolioDetail(selectedStay.stayId);
      if (onRefresh) await onRefresh();
    } catch (err) {
      notifyToast({
        type: 'ERROR',
        message: err?.response?.data?.message || 'Có lỗi khi nạp và hoàn thành các dịch vụ.',
      });
    } finally {
      setBusy(false);
    }
  };

  // Hủy TOÀN BỘ dịch vụ chưa thanh toán nếu khách không dùng
  const handleVoidAllUnsettledServices = async () => {
    if (!selectedStay) return;
    try {
      setBusy(true);
      for (const ord of stayPendingOrders) {
        await billingApi.voidServiceOrder(ord.serviceOrderId, 'Khách trả phòng sớm không sử dụng');
      }
      const resId = selectedStay?.reservationId || folioDetail?.reservationId;
      if (resId) {
        for (const po of stayPreOrderAnalysis.items.filter((it) => it.isUncharged)) {
          await billingApi.cancelPreOrder(resId, Number(po.serviceId), po.itemIndex, Number(po.quantity), 'Khách trả phòng sớm không sử dụng').catch(() => {});
        }
      }
      notifyToast({
        type: 'INFO',
        message: `Đã hủy toàn bộ dịch vụ chưa sử dụng của phòng ${selectedStay.roomNumber}.`,
      });
      await fetchFolioDetail(selectedStay.stayId);
      if (onRefresh) await onRefresh();
    } catch (err) {
      notifyToast({
        type: 'ERROR',
        message: err?.response?.data?.message || 'Có lỗi khi hủy các dịch vụ.',
      });
    } finally {
      setBusy(false);
    }
  };

  // Tự động hoàn thành toàn bộ đơn dịch vụ phòng đang dở dang và nạp vào hóa đơn
  const handleQuickCompleteAllPendingOrders = async () => {
    if (!selectedStay || stayPendingOrders.length === 0) return;
    try {
      setBusy(true);
      for (const ord of stayPendingOrders) {
        await billingApi.completeServiceOrder(ord.serviceOrderId);
      }
      notifyToast({
        type: 'SUCCESS',
        message: `Đã hoàn thành ${stayPendingOrders.length} đơn dịch vụ và cộng dồn vào hóa đơn phòng ${selectedStay.roomNumber}!`,
      });
      await fetchFolioDetail(selectedStay.stayId);
      if (onRefresh) await onRefresh();
    } catch (err) {
      notifyToast({
        type: 'ERROR',
        message: err?.response?.data?.message || 'Có lỗi khi hoàn thành các đơn dịch vụ phòng.',
      });
    } finally {
      setBusy(false);
    }
  };

  // Hủy nhanh toàn bộ đơn dịch vụ dở dang nếu khách check-out không sử dụng
  const handleQuickVoidAllPendingOrders = async () => {
    if (!selectedStay || stayPendingOrders.length === 0) return;
    try {
      setBusy(true);
      for (const ord of stayPendingOrders) {
        await billingApi.voidServiceOrder(ord.serviceOrderId, 'Khách trả phòng sớm không sử dụng');
      }
      notifyToast({
        type: 'INFO',
        message: `Đã hủy ${stayPendingOrders.length} đơn dịch vụ chưa sử dụng của phòng ${selectedStay.roomNumber}.`,
      });
      await fetchFolioDetail(selectedStay.stayId);
      if (onRefresh) await onRefresh();
    } catch (err) {
      notifyToast({
        type: 'ERROR',
        message: err?.response?.data?.message || 'Có lỗi khi hủy các đơn dịch vụ phòng.',
      });
    } finally {
      setBusy(false);
    }
  };

  // Hoàn thành đơn và quyết toán ngay trong 1 click
  const handleCompleteOrdersAndSettle = async () => {
    if (!folioDetail) return;
    try {
      setBusy(true);
      if (stayPendingOrders.length > 0) {
        for (const ord of stayPendingOrders) {
          await billingApi.completeServiceOrder(ord.serviceOrderId);
        }
      }
      for (const po of stayPreOrderAnalysis.items.filter((it) => it.isUncharged)) {
        const res = await billingApi.createServiceOrder({
          stayId: Number(selectedStay.stayId),
          serviceId: Number(po.serviceId),
          quantity: Number(po.quantity) || 1,
          notes: buildPreOrderNote(po),
        });
        const orderData = res.data?.data || res.data;
        if (orderData?.serviceOrderId) {
          await billingApi.completeServiceOrder(orderData.serviceOrderId);
        }
      }
      const codeToSend = appliedVoucher ? appliedVoucher.code : (voucherCodeInput.trim() ? voucherCodeInput.trim().toUpperCase() : null);
      const res = await billingApi.settleFolio(folioDetail.stayId, {
        voucherCode: codeToSend,
        paymentMethod: paymentMethod,
        notes: settleNotes.trim() || null,
      });
      notifyToast({
        type: 'SUCCESS',
        message: `Đã nạp ${stayPendingOrders.length} dịch vụ và quyết toán hóa đơn phòng ${folioDetail.roomNumber} thành công! Đã đóng Folio.`,
      });
      setConfirmSettleModal(false);
      setSelectedStay(null);
      setFolioDetail(null);
      setStayPendingOrders([]);
      if (onRefresh) await onRefresh();
      setPrintInvoiceData(res.data);
    } catch (err) {
      notifyToast({
        type: 'ERROR',
        message: err?.response?.data?.message || 'Có lỗi khi hoàn thành dịch vụ và quyết toán.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleExecuteSettlement = async () => {
    if (!folioDetail) return;
    try {
      setBusy(true);
      const codeToSend = appliedVoucher ? appliedVoucher.code : (voucherCodeInput.trim() ? voucherCodeInput.trim().toUpperCase() : null);
      const res = await billingApi.settleFolio(folioDetail.stayId, {
        voucherCode: codeToSend,
        paymentMethod: paymentMethod,
        notes: settleNotes.trim() || null,
      });
      notifyToast({
        type: 'SUCCESS',
        message: `Quyết toán hóa đơn phòng ${folioDetail.roomNumber} thành công! Đã đóng Folio.`,
      });
      setConfirmSettleModal(false);
      setSelectedStay(null);
      setFolioDetail(null);
      if (onRefresh) await onRefresh();
      // Mở ngay modal in hóa đơn
      setPrintInvoiceData(res.data);
    } catch {
      // Handled by HTTP interceptor
    } finally {
      setBusy(false);
    }
  };

  // Kiểm tra thông tin quá hạn trả phòng (Overdue / Late Check-out)
  const getOverdueInfo = (stay) => {
    if (!stay || stay.folioStatus === 'CLOSED') return { isOverdue: false, days: 0 };
    if (!stay.checkOutDate) return { isOverdue: false, days: 0 };
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const checkOutStr = typeof stay.checkOutDate === 'string' ? stay.checkOutDate.substring(0, 10) : '';
    if (checkOutStr && checkOutStr < todayStr) {
      const diffMs = new Date(todayStr).getTime() - new Date(checkOutStr).getTime();
      const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      return { isOverdue: true, days, checkOutStr };
    }
    return { isOverdue: false, days: 0, checkOutStr };
  };

  const overdueStaysCount = useMemo(() => {
    return (activeStays || []).filter((s) => getOverdueInfo(s).isOverdue).length;
  }, [activeStays]);

  // Danh sách các tháng có dữ liệu lưu trú
  const availableMonths = useMemo(() => {
    const set = new Set();
    (activeStays || []).forEach((s) => {
      const d = s.actualCheckOut || s.checkOutDate || s.actualCheckIn || s.checkInDate;
      if (d && typeof d === 'string' && d.length >= 7) {
        set.add(d.substring(0, 7)); // 'YYYY-MM'
      }
    });
    return Array.from(set).sort().reverse();
  }, [activeStays]);

  const filteredStays = useMemo(() => {
    return (activeStays || []).filter((s) => {
      const ov = getOverdueInfo(s);
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'CLOSED' && s.folioStatus !== 'CLOSED') return false;
        if (statusFilter === 'OVERDUE' && (!ov.isOverdue || s.folioStatus === 'CLOSED')) return false;
        if (statusFilter === 'OPEN_NORMAL' && (s.folioStatus === 'CLOSED' || ov.isOverdue)) return false;
      }
      if (monthFilter !== 'ALL') {
        const d = s.actualCheckOut || s.checkOutDate || s.actualCheckIn || s.checkInDate;
        if (!d || !d.startsWith(monthFilter)) return false;
      }
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        const room = (s.roomNumber || '').toLowerCase();
        const name = (s.guestName || '').toLowerCase();
        const code = (s.reservationCode || '').toLowerCase();
        const phone = (s.phoneNumber || '').toLowerCase();
        if (!room.includes(kw) && !name.includes(kw) && !code.includes(kw) && !phone.includes(kw)) {
          return false;
        }
      }
      return true;
    });
  }, [activeStays, keyword, statusFilter, monthFilter]);

  const totalPages = Math.ceil(filteredStays.length / pageSize) || 1;
  const paginatedStays = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStays.slice(start, start + pageSize);
  }, [filteredStays, page, pageSize]);

  return (
    <div>
      {/* Header & Tiêu đề */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0f172a' }}>
            Hóa Đơn &amp; Quyết Toán Tiền Phòng
          </h2>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            Tra cứu bảng kê chi phí phòng, phụ thu phát sinh, áp mã giảm giá, thu tiền quyết toán và xuất hóa đơn VAT chuẩn.
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={busy}
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            color: '#334155',
            padding: '8px 14px',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>↻</span> Làm mới danh sách
        </button>
      </div>

      {/* Thanh Bộ Lọc & Tìm Kiếm */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 14,
          background: '#fff',
          padding: 12,
          borderRadius: 8,
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ flex: '1 1 260px', minWidth: 200 }}>
          <input
            type="text"
            placeholder="Tìm theo số phòng, mã đặt phòng (#BK...), tên khách, SĐT..."
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '7px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '7px 10px',
                borderRadius: 6,
                border: statusFilter === 'OVERDUE' ? '1px solid #f87171' : '1px solid #cbd5e1',
                fontSize: 13,
                background: statusFilter === 'OVERDUE' ? '#fef2f2' : '#fff',
                color: statusFilter === 'OVERDUE' ? '#b91c1c' : '#1e293b',
                fontWeight: statusFilter === 'OVERDUE' ? 700 : 500,
              }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="OPEN_NORMAL">Đang ở đúng hạn</option>
              <option value="OVERDUE">
                ⚠️ Quá hạn trả phòng ({overdueStaysCount})
              </option>
              <option value="CLOSED">Đã quyết toán (Đã thu tiền)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>Kỳ thời gian:</span>
            <select
              value={monthFilter}
              onChange={(e) => {
                setMonthFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '7px 10px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                background: '#fff',
                color: '#1e293b',
              }}
            >
              <option value="ALL">Tất cả các tháng</option>
              {availableMonths.map((m) => {
                const [y, mm] = m.split('-');
                return (
                  <option key={m} value={m}>
                    Tháng {mm}/{y}
                  </option>
                );
              })}
            </select>
          </div>

          {(keyword || statusFilter !== 'ALL' || monthFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setKeyword('');
                setStatusFilter('ALL');
                setMonthFilter('ALL');
                setPage(1);
              }}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#475569',
                padding: '7px 12px',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Bảng Danh Sách Phòng Đang Lưu Trú */}
      <DataTable
        keyField="stayId"
        data={paginatedStays}
        emptyMessage="Không tìm thấy hồ sơ phòng lưu trú nào phù hợp với bộ lọc."
        columns={[
          {
            header: '#Mã Lưu Trú',
            width: 95,
            minWidth: 85,
            nowrap: true,
            render: (s) => <span style={{ color: '#64748b', fontWeight: 500 }}>#{s.stayId}</span>,
          },
          {
            header: 'Mã Đặt Phòng',
            minWidth: 140,
            nowrap: true,
            render: (s) => <strong style={{ color: '#0f172a' }}>{s.reservationCode || 'N/A'}</strong>,
          },
          {
            header: 'Phòng',
            width: 90,
            minWidth: 80,
            nowrap: true,
            render: (s) => (
              <span
                style={{
                  fontWeight: 700,
                  background: '#e0e7ff',
                  color: '#3730a3',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 14,
                  display: 'inline-block',
                }}
              >
                {s.roomNumber || 'N/A'}
              </span>
            ),
          },
          {
            header: 'Khách hàng',
            minWidth: 180,
            render: (s) => (
              <div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{s.guestName}</div>
                {s.phoneNumber && (
                  <div style={{ fontSize: 12, color: '#64748b' }}>SĐT: {s.phoneNumber}</div>
                )}
              </div>
            ),
          },
          {
            header: 'Thời Gian Lưu Trú',
            minWidth: 160,
            nowrap: true,
            render: (s) => {
              const ov = getOverdueInfo(s);
              return (
                <div>
                  <div style={{ color: '#475569', fontSize: 13, whiteSpace: 'nowrap' }}>
                    Vào: {s.actualCheckIn ? formatDateTime(s.actualCheckIn) : (s.checkInDate ? formatDate(s.checkInDate) : 'N/A')}
                  </div>
                  {s.checkOutDate && (
                    <div
                      style={{
                        fontSize: 12,
                        color: ov.isOverdue ? '#dc2626' : '#64748b',
                        fontWeight: ov.isOverdue ? 600 : 400,
                        marginTop: 2,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Dự kiến ra: {formatDate(s.checkOutDate)}
                      {ov.isOverdue && (
                        <span style={{ marginLeft: 4, color: '#dc2626', fontWeight: 700 }}>(Trễ {ov.days}n)</span>
                      )}
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            header: 'Tổng Tiền Hóa Đơn',
            minWidth: 150,
            nowrap: true,
            render: (s) => (
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                  {formatVND(s.totalAmount || 0)}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                  {s.folioStatus === 'CLOSED' ? 'Đã hoàn tất thanh toán' : 'Tạm tính (chưa thu)'}
                </div>
              </div>
            ),
          },
          {
            header: 'Trạng Thái',
            minWidth: 155,
            nowrap: true,
            render: (s) => {
              const ov = getOverdueInfo(s);
              if (s.folioStatus === 'CLOSED') {
                return (
                  <span
                    style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      padding: '4px 10px',
                      borderRadius: 14,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Đã thanh toán
                  </span>
                );
              }
              if (ov.isOverdue) {
                return (
                  <span
                    style={{
                      background: '#fef2f2',
                      color: '#b91c1c',
                      border: '1px solid #fecaca',
                      padding: '4px 10px',
                      borderRadius: 14,
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>⚠️</span> Quá hạn ({ov.days} ngày)
                  </span>
                );
              }
              return (
                <span
                  style={{
                    background: '#dcfce7',
                    color: '#15803d',
                    padding: '4px 10px',
                    borderRadius: 14,
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Chưa thanh toán (Đang ở)
                </span>
              );
            },
          },
          {
            header: 'Thao Tác',
            minWidth: 170,
            nowrap: true,
            render: (s) => {
              const ov = getOverdueInfo(s);
              return (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenFolio(s)}
                    disabled={busy}
                    style={{
                      background: s.folioStatus === 'CLOSED' ? '#0284c7' : (ov.isOverdue ? '#ea580c' : '#dc2626'),
                      color: '#fff',
                      border: 'none',
                      padding: '7px 14px',
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: s.folioStatus === 'CLOSED'
                        ? '0 1px 2px rgba(2, 132, 199, 0.2)'
                        : (ov.isOverdue ? '0 1px 2px rgba(234, 88, 12, 0.3)' : '0 1px 2px rgba(220, 38, 38, 0.2)'),
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>{s.folioStatus === 'CLOSED' ? '📄' : (ov.isOverdue ? '⚠️' : '💳')}</span>
                    {s.folioStatus === 'CLOSED' ? 'Xem Chi Tiết' : (ov.isOverdue ? 'Quyết Toán Trễ' : 'Quyết Toán')}
                  </button>

                  {s.folioStatus === 'CLOSED' && (
                    <button
                      type="button"
                      onClick={() => handleOpenPrintInvoice(s.stayId)}
                      disabled={busy}
                      style={{
                        background: '#fff',
                        border: '1px solid #cbd5e1',
                        color: '#334155',
                        padding: '7px 10px',
                        borderRadius: 6,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        whiteSpace: 'nowrap',
                      }}
                      title="In hóa đơn thanh toán"
                    >
                      <span>🖨️</span> In Bill
                    </button>
                  )}
                </div>
              );
            },
          },
        ]}
      />

      {/* Phân trang */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 13, color: '#64748b' }}>
          Hiển thị{' '}
          <strong>
            {filteredStays.length > 0 ? (page - 1) * pageSize + 1 : 0} -{' '}
            {Math.min(page * pageSize, filteredStays.length)}
          </strong>{' '}
          trong tổng số <strong>{filteredStays.length}</strong> phòng
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            style={{
              padding: '5px 8px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 12,
              background: '#fff',
            }}
          >
            <option value={5}>5 / trang</option>
            <option value={10}>10 / trang</option>
            <option value={20}>20 / trang</option>
          </select>

          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: page <= 1 ? '#f8fafc' : '#fff',
              color: page <= 1 ? '#94a3b8' : '#0f172a',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            « Trước
          </button>
          <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: page >= totalPages ? '#f8fafc' : '#fff',
              color: page >= totalPages ? '#94a3b8' : '#0f172a',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Sau »
          </button>
        </div>
      </div>

      {/* ======================= MODAL: BẢNG KÊ CHI TIẾT FOLIO & QUYẾT TOÁN ======================= */}
      <FolioSettlementModal
        selectedStay={selectedStay}
        loadingFolio={loadingFolio}
        folioDetail={folioDetail}
        onClose={() => {
          setSelectedStay(null);
          setFolioDetail(null);
        }}
        busy={busy}
        canManageCharges={canManageCharges}
        canSettle={canSettle}
        showAddChargeForm={showAddChargeForm}
        setShowAddChargeForm={setShowAddChargeForm}
        chargeForm={chargeForm}
        setChargeForm={setChargeForm}
        chargeError={chargeError}
        setChargeError={setChargeError}
        handleAddCharge={handleAddCharge}
        handleQuickAddAmount={handleQuickAddAmount}
        handleResetAmount={handleResetAmount}
        setChargeToDelete={setChargeToDelete}
        appliedVoucher={appliedVoucher}
        handleRemoveVoucher={handleRemoveVoucher}
        voucherCodeInput={voucherCodeInput}
        setVoucherCodeInput={setVoucherCodeInput}
        voucherError={voucherError}
        validatingVoucher={validatingVoucher}
        handleValidateVoucher={handleValidateVoucher}
        vouchers={vouchers}
        calculatedFinances={calculatedFinances}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        settleNotes={settleNotes}
        setSettleNotes={setSettleNotes}
        setConfirmSettleModal={setConfirmSettleModal}
        handleOpenPrintInvoice={handleOpenPrintInvoice}
        getOverdueInfo={getOverdueInfo}
        stayPendingOrders={stayPendingOrders}
        stayPreOrderAnalysis={stayPreOrderAnalysis}
        handleCompletePendingOrder={handleCompletePendingOrder}
        handleVoidPendingOrder={handleVoidPendingOrder}
        handleChargePreOrder={handleChargePreOrder}
        handleCancelPreOrderItem={handleCancelPreOrderItem}
        handleChargeAllUnsettledServices={handleChargeAllUnsettledServices}
        handleVoidAllUnsettledServices={handleVoidAllUnsettledServices}
        handleQuickCompleteAllPendingOrders={handleQuickCompleteAllPendingOrders}
        handleQuickVoidAllPendingOrders={handleQuickVoidAllPendingOrders}
        onRefreshFolio={async () => {
          if (selectedStay?.stayId) {
            await fetchFolioDetail(selectedStay.stayId);
            if (onRefresh) await onRefresh();
          }
        }}
      />

      {/* ======================= MODAL XÁC NHẬN XÓA PHỤ THU (IN-APP DIALOG) ======================= */}
      <ConfirmDeleteChargeModal
        chargeToDelete={chargeToDelete}
        busy={busy}
        onClose={() => setChargeToDelete(null)}
        onConfirm={handleConfirmDeleteCharge}
      />

      {/* ======================= MODAL XÁC NHẬN QUYẾT TOÁN ======================= */}
      <ConfirmSettleModal
        show={confirmSettleModal}
        folioDetail={folioDetail}
        balancePayable={calculatedFinances.balancePayable}
        paymentMethod={paymentMethod}
        appliedVoucher={appliedVoucher}
        busy={busy}
        onClose={() => setConfirmSettleModal(false)}
        onConfirm={handleExecuteSettlement}
        stayPendingOrders={stayPendingOrders}
        onConfirmWithCompleteOrders={handleCompleteOrdersAndSettle}
        stayPreOrderAnalysis={stayPreOrderAnalysis}
      />

      {/* ======================= MODAL IN HÓA ĐƠN VAT CHUẨN A4 ======================= */}
      <InvoicePrintModal
        printInvoiceData={printInvoiceData}
        onClose={() => setPrintInvoiceData(null)}
      />
    </div>
  );
};
