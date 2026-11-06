import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Button, Form, Badge, Alert, Spinner, Modal, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { billingApi } from '../../services/billingApi';
import { formatVND } from '../../lib/money';
import { formatDateTime, formatDate } from '../../lib/datetime';
import { notifyToast } from '../../lib/http';

// Helper trích xuất danh sách dịch vụ đặt trước từ specialNotes của Reservation
const parsePreOrders = (notes) => {
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
        raw: line,
        serviceName: nameMatch ? nameMatch[1].trim() : 'Dịch vụ đặt trước',
        serviceId: idMatch ? idMatch[1] : '',
        quantity: qtyMatch ? Number(qtyMatch[1]) : 1,
        scheduledTime: timeMatch ? timeMatch[1].trim() : '',
        details: detailMatch ? detailMatch[1].trim() : '',
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
      if (it.scheduledTime && it.scheduledTime !== 'Không') {
        if (!existing.scheduledTime || existing.scheduledTime === 'Không') {
          existing.scheduledTime = it.scheduledTime;
        } else if (!existing.scheduledTime.includes(it.scheduledTime)) {
          existing.scheduledTime = `${existing.scheduledTime}, ${it.scheduledTime}`;
        }
      }
      if (it.details && it.details !== 'Không') {
        if (!existing.details || existing.details === 'Không') {
          existing.details = it.details;
        } else if (!existing.details.includes(it.details)) {
          existing.details = `${existing.details}, ${it.details}`;
        }
      }
    }
  });

  return Array.from(map.values());
};

export const CustomerServiceOrderPage = () => {
  const { user } = useAuth();

  // Điều hướng thanh công cụ bên trái: 'catalog' (Đặt dịch vụ) | 'pre-orders' (Lịch đặt trước) | 'room-orders' (Đơn tại phòng)
  const [activeNav, setActiveNav] = useState('catalog');

  // Active Stays state (Khách đang lưu trú tại phòng)
  const [activeStays, setActiveStays] = useState([]);
  const [selectedStayId, setSelectedStayId] = useState('');
  const [loadingStays, setLoadingStays] = useState(true);

  // Confirmed Reservations state (Đơn đặt phòng đã xác nhận, chưa check-in)
  const [confirmedReservations, setConfirmedReservations] = useState([]);
  const [selectedReservationId, setSelectedReservationId] = useState('');
  const [filterReservationId, setFilterReservationId] = useState('ALL');
  const [loadingReservations, setLoadingReservations] = useState(true);

  // Services catalog state (Dùng chung cho toàn bộ dịch vụ)
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Service & Order Modal state (Dùng chung một modal đặt dịch vụ thông minh)
  const [selectedService, setSelectedService] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderTargetMode, setOrderTargetMode] = useState('ACTIVE_STAY'); // 'ACTIVE_STAY' | 'PRE_ORDER'
  const [quantity, setQuantity] = useState(1);
  const [roomServiceNotes, setRoomServiceNotes] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [flightDetails, setFlightDetails] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState('');
  const [cancellingPreOrder, setCancellingPreOrder] = useState(null);
  const [cancelModalData, setCancelModalData] = useState(null);

  // Orders in stay tracking state
  const [myOrders, setMyOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Pagination states for all tabs/tables
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPageSize, setCatalogPageSize] = useState(6);

  const [preOrderPage, setPreOrderPage] = useState(1);
  const [preOrderPageSize, setPreOrderPageSize] = useState(5);

  const [roomOrderPage, setRoomOrderPage] = useState(1);
  const [roomOrderPageSize, setRoomOrderPageSize] = useState(5);

  // Load active stays for current customer
  const loadActiveStays = useCallback(async () => {
    setLoadingStays(true);
    try {
      const res = await billingApi.getActiveStays();
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setActiveStays(list);
      if (list.length > 0) {
        setSelectedStayId((prev) => (prev && list.some((s) => String(s.stayId) === String(prev)) ? prev : String(list[0].stayId)));
      } else {
        setSelectedStayId('');
      }
    } catch {
      setActiveStays([]);
    } finally {
      setLoadingStays(false);
    }
  }, []);

  // Load confirmed reservations for current customer
  const loadConfirmedReservations = useCallback(async () => {
    setLoadingReservations(true);
    try {
      const res = await billingApi.getMyConfirmedReservations();
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setConfirmedReservations(list);
      if (list.length > 0) {
        setSelectedReservationId((prev) =>
          prev && list.some((r) => String(r.reservationId) === String(prev)) ? prev : String(list[0].reservationId)
        );
      } else {
        setSelectedReservationId('');
      }
    } catch {
      setConfirmedReservations([]);
    } finally {
      setLoadingReservations(false);
    }
  }, []);

  // Load active services catalog
  const loadServices = useCallback(async () => {
    setLoadingServices(true);
    try {
      const res = await billingApi.getActiveServices();
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setServices(list);
    } catch {
      setServices([]);
    } finally {
      setLoadingServices(false);
    }
  }, []);

  // Load orders for selected stay
  const loadOrders = useCallback(async (stayId) => {
    if (!stayId) {
      setMyOrders([]);
      return;
    }
    setLoadingOrders(true);
    try {
      const res = await billingApi.getServiceOrders(stayId);
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setMyOrders(list);
    } catch {
      setMyOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadActiveStays();
    loadConfirmedReservations();
    loadServices();
  }, [loadActiveStays, loadConfirmedReservations, loadServices]);

  // When selected stay changes, reload orders
  useEffect(() => {
    if (selectedStayId) {
      loadOrders(selectedStayId);
    }
  }, [selectedStayId, loadOrders]);

  // Current active stay object
  const currentStay = useMemo(() => {
    return activeStays.find((s) => String(s.stayId) === String(selectedStayId)) || null;
  }, [activeStays, selectedStayId]);

  // Current selected reservation object for pre-order
  const currentReservation = useMemo(() => {
    return confirmedReservations.find((r) => String(r.reservationId) === String(selectedReservationId)) || null;
  }, [confirmedReservations, selectedReservationId]);

  // Toàn bộ dịch vụ đặt trước từ tất cả các đơn đặt phòng của khách hàng
  const allMyPreOrders = useMemo(() => {
    const list = [];
    confirmedReservations.forEach((r) => {
      const items = parsePreOrders(r.specialNotes);
      items.forEach((item) => {
        list.push({
          ...item,
          reservationCode: r.reservationCode,
          reservationId: r.reservationId,
          roomTypeName: r.roomTypeName,
          checkInDate: r.checkInDate,
        });
      });
    });
    return list;
  }, [confirmedReservations]);

  // Danh sách dịch vụ đặt trước theo bộ lọc
  const displayedPreOrders = useMemo(() => {
    if (filterReservationId === 'ALL') return allMyPreOrders;
    return allMyPreOrders.filter((po) => String(po.reservationId) === String(filterReservationId));
  }, [allMyPreOrders, filterReservationId]);

  // Has active stay / has confirmed booking flags
  const hasActiveStay = activeStays.length > 0;
  const hasConfirmedBooking = confirmedReservations.length > 0;
  const canOrderServices = hasActiveStay || hasConfirmedBooking;

  // Categories list (Dùng chung cho toàn bộ dịch vụ)
  const categories = useMemo(() => {
    const set = new Set();
    services.forEach((s) => {
      if (s.category) set.add(s.category.toUpperCase());
    });
    return ['ALL', ...Array.from(set)];
  }, [services]);

  // Filtered services (Dùng chung cho toàn bộ dịch vụ)
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchCat = categoryFilter === 'ALL' || (s.category && s.category.toUpperCase() === categoryFilter);
      const matchSearch =
        !searchQuery.trim() ||
        s.serviceName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase().trim()));
      return matchCat && matchSearch;
    });
  }, [services, categoryFilter, searchQuery]);

  // Reset pagination on filter change
  useEffect(() => {
    setCatalogPage(1);
  }, [categoryFilter, searchQuery]);

  useEffect(() => {
    setPreOrderPage(1);
  }, [filterReservationId]);

  useEffect(() => {
    setRoomOrderPage(1);
  }, [selectedStayId]);

  // Paginated data calculations
  const totalCatalogPages = Math.max(1, Math.ceil(filteredServices.length / catalogPageSize));
  const paginatedCatalogServices = useMemo(() => {
    return filteredServices.slice((catalogPage - 1) * catalogPageSize, catalogPage * catalogPageSize);
  }, [filteredServices, catalogPage, catalogPageSize]);

  const totalPreOrderPages = Math.max(1, Math.ceil(displayedPreOrders.length / preOrderPageSize));
  const paginatedPreOrders = useMemo(() => {
    return displayedPreOrders.slice((preOrderPage - 1) * preOrderPageSize, preOrderPage * preOrderPageSize);
  }, [displayedPreOrders, preOrderPage, preOrderPageSize]);

  const totalRoomOrderPages = Math.max(1, Math.ceil(myOrders.length / roomOrderPageSize));
  const paginatedRoomOrders = useMemo(() => {
    return myOrders.slice((roomOrderPage - 1) * roomOrderPageSize, roomOrderPage * roomOrderPageSize);
  }, [myOrders, roomOrderPage, roomOrderPageSize]);

  // Helper render pagination cho các mục trong Customer Portal
  const renderCustomerPagination = (
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [6, 12, 24]
  ) => {
    if (totalItems <= 0) return null;
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    const getPageNumbers = () => {
      const delta = 1;
      const range = [];
      const rangeWithDots = [];
      let l;
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
          range.push(i);
        }
      }
      for (const i of range) {
        if (l) {
          if (i - l === 2) {
            rangeWithDots.push(l + 1);
          } else if (i - l !== 1) {
            rangeWithDots.push('...');
          }
        }
        rangeWithDots.push(i);
        l = i;
      }
      return rangeWithDots;
    };

    return (
      <div
        className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3 pt-3 px-1"
        style={{ borderTop: '1px solid #E8E6DC', fontSize: 13 }}
      >
        <div className="d-flex align-items-center gap-2 text-secondary">
          <span>
            Hiển thị <strong>{startItem}</strong> - <strong>{endItem}</strong> trong <strong>{totalItems}</strong> mục
          </span>
          {onPageSizeChange && (
            <div className="d-flex align-items-center gap-1 ms-2">
              <span style={{ fontSize: 12 }}>Mỗi trang:</span>
              <Form.Select
                size="sm"
                value={pageSize}
                onChange={(e) => {
                  onPageSizeChange(Number(e.target.value));
                  onPageChange(1);
                }}
                style={{ width: 'auto', padding: '2px 24px 2px 8px', fontSize: 12, height: 28 }}
              >
                {pageSizeOptions.map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
              </Form.Select>
            </div>
          )}
        </div>

        <div className="d-flex align-items-center gap-1">
          <Button
            size="sm"
            variant="outline-secondary"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            style={{ padding: '2px 8px', fontSize: 12, height: 28, borderRadius: 4 }}
          >
            &laquo; Trước
          </Button>

          {getPageNumbers().map((p, idx) =>
            p === '...' ? (
              <span key={`dots-${idx}`} className="px-1 text-secondary">
                ...
              </span>
            ) : (
              <Button
                key={p}
                size="sm"
                variant={currentPage === p ? 'dark' : 'outline-secondary'}
                onClick={() => onPageChange(p)}
                style={
                  currentPage === p
                    ? {
                        padding: '2px 9px',
                        fontSize: 12,
                        fontWeight: 700,
                        background: '#16233B',
                        borderColor: '#16233B',
                        height: 28,
                        borderRadius: 4,
                      }
                    : { padding: '2px 9px', fontSize: 12, height: 28, borderRadius: 4 }
                }
              >
                {p}
              </Button>
            )
          )}

          <Button
            size="sm"
            variant="outline-secondary"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            style={{ padding: '2px 8px', fontSize: 12, height: 28, borderRadius: 4 }}
          >
            Sau &raquo;
          </Button>
        </div>
      </div>
    );
  };

  // Lấy nhãn phòng hiển thị thân thiện (tránh chữ thô "Chưa gán phòng")
  const friendlyRoomNumber = useMemo(() => {
    if (!currentStay?.roomNumber || currentStay.roomNumber === 'Chưa gán phòng') {
      return 'Đang chuẩn bị phòng';
    }
    return `Phòng ${currentStay.roomNumber}`;
  }, [currentStay]);

  // Mở modal đặt dịch vụ (Tự động nhận diện ngữ cảnh của khách)
  const handleOpenOrder = (svc) => {
    setSelectedService(svc);
    setQuantity(1);
    setRoomServiceNotes('');
    setScheduledTime('');
    setFlightDetails('');
    setOrderError('');
    setOrderSuccess('');

    // Nếu khách đang ở phòng: Mặc định là giao phòng
    // Nếu khách chưa ở phòng nhưng có chuyến sắp tới: Mặc định là đặt trước
    if (hasActiveStay) {
      setOrderTargetMode('ACTIVE_STAY');
    } else if (hasConfirmedBooking) {
      setOrderTargetMode('PRE_ORDER');
    }

    setShowOrderModal(true);
  };

  // Submit service order (Dùng chung xử lý cả giao phòng & đặt trước)
  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setOrderError('');
    setOrderSuccess('');

    if (!selectedService) {
      setOrderError('Vui lòng chọn dịch vụ.');
      return;
    }

    if (quantity < 1) {
      setOrderError('Số lượng phải từ 1 trở lên.');
      return;
    }

    setSubmittingOrder(true);
    try {
      if (orderTargetMode === 'PRE_ORDER') {
        // Luồng đặt trước cho chuyến đi
        if (!selectedReservationId) {
          setOrderError('Vui lòng chọn chuyến đặt phòng cần đặt trước dịch vụ.');
          setSubmittingOrder(false);
          return;
        }

        await billingApi.createPreOrder({
          reservationId: Number(selectedReservationId),
          serviceId: selectedService.serviceId,
          quantity: Number(quantity),
          scheduledTime: scheduledTime ? scheduledTime.trim() : null,
          details: flightDetails ? flightDetails.trim() : null,
        });

        setOrderSuccess('Đã gửi yêu cầu đặt trước dịch vụ thành công! Khách sạn đã tiếp nhận lịch trình của quý khách.');
        await loadConfirmedReservations();

        setTimeout(() => {
          setShowOrderModal(false);
          setActiveNav('pre-orders'); // Chuyển sang xem lịch đặt trước
        }, 1200);
      } else {
        // Luồng giao phòng đang lưu trú
        if (!selectedStayId) {
          setOrderError('Không tìm thấy lượt lưu trú hoạt động để giao dịch vụ.');
          setSubmittingOrder(false);
          return;
        }

        await billingApi.createServiceOrder({
          stayId: Number(selectedStayId),
          serviceId: selectedService.serviceId,
          quantity: Number(quantity),
        });

        setOrderSuccess(`Yêu cầu đã được chuyển tới bộ phận phục vụ phòng ${friendlyRoomNumber}!`);
        await loadOrders(selectedStayId);

        setTimeout(() => {
          setShowOrderModal(false);
          setActiveNav('room-orders'); // Chuyển sang xem đơn phòng
        }, 1000);
      }
    } catch (err) {
      const resp = err.response?.data;
      setOrderError(resp?.message || 'Có lỗi xảy ra khi xử lý yêu cầu dịch vụ.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleOpenCancelModal = (po) => {
    setCancelModalData(po);
  };

  const handleConfirmCancelCustomerPreOrder = async () => {
    if (!cancelModalData?.reservationId || !cancelModalData?.serviceId) return;
    setCancellingPreOrder(cancelModalData.serviceId);
    try {
      await billingApi.cancelPreOrder(cancelModalData.reservationId, cancelModalData.serviceId);
      notifyToast({
        type: 'SUCCESS',
        message: `Đã hủy thành công yêu cầu đặt trước dịch vụ "${cancelModalData.serviceName}".`,
      });
      setCancelModalData(null);
      await loadConfirmedReservations();
    } catch (err) {
      notifyToast({
        type: 'DANGER',
        message: err.response?.data?.message || 'Có lỗi xảy ra khi hủy dịch vụ đặt trước.',
      });
    } finally {
      setCancellingPreOrder(null);
    }
  };

  const lineEstimatedTotal = selectedService ? (Number(selectedService.unitPrice) || 0) * quantity : 0;

  return (
    <div className="container-fluid py-4 px-lg-4" style={{ maxWidth: 1300 }}>
      {/* ========================================================================= */}
      {/* BỐ CỤC 2 CỘT: THANH CÔNG CỤ BÊN TRÁI (SIDEBAR) & NỘI DUNG CHÍNH BÊN PHẢI */}
      {/* ========================================================================= */}
      <div className="row g-4">
        {/* ========================================================================= */}
        {/* CỘT TRÁI: THANH CÔNG CỤ ĐIỀU HƯỚNG (SIDEBAR MENU) */}
        {/* ========================================================================= */}
        <div className="col-12 col-lg-3 col-xl-3">
          <div
            style={{
              position: 'sticky',
              top: 86,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Thẻ Tiêu Đề Sidebar & Tên Khách */}
            <Card className="border-0 shadow-sm rounded-3 overflow-hidden" style={{ background: '#FAF9F5', border: '1px solid #E8E6DC' }}>
              <Card.Body className="p-3">
                <div className="d-flex align-items-center gap-2.5 mb-2">
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: '#16233B',
                      color: '#FAF9F5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                    }}
                  >
                    🛎️
                  </div>
                  <div>
                    <strong style={{ color: '#16233B', fontSize: 15, display: 'block' }}>
                      {user?.fullName || 'Quý Khách Hàng'}
                    </strong>
                    <span style={{ fontSize: 11.5, color: '#64748B' }}>Dịch Vụ Khách Sạn</span>
                  </div>
                </div>

                <hr style={{ borderColor: '#E8E6DC', margin: '10px 0' }} />

                {/* Danh Sách Menu Điều Hướng */}
                <div className="d-flex flex-column gap-1.5">
                  {/* Mục 1: Đặt Dịch Vụ (Dùng Chung) */}
                  <button
                    type="button"
                    onClick={() => setActiveNav('catalog')}
                    style={{
                      background: activeNav === 'catalog' ? '#16233B' : 'transparent',
                      color: activeNav === 'catalog' ? '#FAF9F5' : '#334155',
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 13.5,
                      fontWeight: activeNav === 'catalog' ? 700 : 500,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <span>🍽️</span>
                      <span>Đặt Dịch Vụ (Menu)</span>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        background: activeNav === 'catalog' ? 'rgba(255,255,255,0.2)' : '#E2E8F0',
                        color: activeNav === 'catalog' ? '#FFFFFF' : '#475569',
                        padding: '1px 6px',
                        borderRadius: 10,
                      }}
                    >
                      {services.length}
                    </span>
                  </button>

                  {/* Mục 2: Lịch Đặt Trước Chuyến Đi */}
                  <button
                    type="button"
                    onClick={() => setActiveNav('pre-orders')}
                    style={{
                      background: activeNav === 'pre-orders' ? '#0369A1' : 'transparent',
                      color: activeNav === 'pre-orders' ? '#FAF9F5' : '#334155',
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 13.5,
                      fontWeight: activeNav === 'pre-orders' ? 700 : 500,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <span>✈️</span>
                      <span>Lịch Đặt Trước Chuyến Đi</span>
                    </div>
                    {allMyPreOrders.length > 0 && (
                      <span
                        style={{
                          fontSize: 11,
                          background: activeNav === 'pre-orders' ? '#FFFFFF' : '#0284C7',
                          color: activeNav === 'pre-orders' ? '#0369A1' : '#FFFFFF',
                          padding: '1px 7px',
                          borderRadius: 10,
                          fontWeight: 700,
                        }}
                      >
                        {allMyPreOrders.length}
                      </span>
                    )}
                  </button>

                  {/* Mục 3: Đơn Phục Vụ Tại Phòng */}
                  <button
                    type="button"
                    onClick={() => setActiveNav('room-orders')}
                    style={{
                      background: activeNav === 'room-orders' ? '#166534' : 'transparent',
                      color: activeNav === 'room-orders' ? '#FAF9F5' : '#334155',
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 13.5,
                      fontWeight: activeNav === 'room-orders' ? 700 : 500,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <span>🚪</span>
                      <span>Đơn Phục Vụ Tại Phòng</span>
                    </div>
                    {myOrders.length > 0 && (
                      <span
                        style={{
                          fontSize: 11,
                          background: activeNav === 'room-orders' ? '#FFFFFF' : '#16a34a',
                          color: activeNav === 'room-orders' ? '#166534' : '#FFFFFF',
                          padding: '1px 7px',
                          borderRadius: 10,
                          fontWeight: 700,
                        }}
                      >
                        {myOrders.length}
                      </span>
                    )}
                  </button>
                </div>
              </Card.Body>
            </Card>

            {/* Thẻ Thông Tin Ngữ Cảnh Nhanh Ở Góc Dưới Sidebar */}
            <div className="d-flex flex-column gap-2">
              {/* Thẻ Phòng Đang Ở (nếu có) */}
              {hasActiveStay && (
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #C8E6C9',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 12.5,
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span style={{ color: '#166534', fontWeight: 700 }}>🚪 PHÒNG ĐANG Ở</span>
                    <Badge bg="success" style={{ fontSize: 10 }}>ACTIVE</Badge>
                  </div>
                  <strong style={{ color: '#16233B', fontSize: 14 }}>{friendlyRoomNumber}</strong>
                  {currentStay?.reservationCode && (
                    <div style={{ color: '#64748B', fontSize: 11.5 }}>
                      Mã đặt: #{currentStay.reservationCode}
                    </div>
                  )}
                </div>
              )}

              {/* Thẻ Chuyến Đi Sắp Tới (nếu có) */}
              {hasConfirmedBooking && (
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #BAE6FD',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 12.5,
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span style={{ color: '#0369A1', fontWeight: 700 }}>✈️ CHUYẾN SẮP TỚI</span>
                    <Badge bg="info" text="dark" style={{ fontSize: 10 }}>CONFIRMED</Badge>
                  </div>
                  <strong style={{ color: '#0284C7', fontSize: 13.5 }}>#{currentReservation?.reservationCode}</strong>
                  <div style={{ color: '#64748B', fontSize: 11.5 }}>
                    Nhận phòng: {formatDate(currentReservation?.checkInDate)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CỘT PHẢI: NỘI DUNG CHÍNH (MAIN CONTENT THEO THANH CÔNG CỤ) */}
        {/* ========================================================================= */}
        <div className="col-12 col-lg-9 col-xl-9">
          {/* ========================================================================= */}
          {/* MỤC 1: ĐẶT DỊCH VỤ KHÁCH SẠN (DANH MỤC DÙNG CHUNG) */}
          {/* ========================================================================= */}
          {activeNav === 'catalog' && (
            <div>
              {/* Header Mục Đặt Dịch Vụ */}
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div>
                  <h4 style={{ margin: 0, color: '#16233B', fontSize: 20, fontWeight: 700 }}>
                    🍽️ Danh Mục Dịch Vụ Khách Sạn
                  </h4>
                  <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                    Ẩm thực tại phòng 24/7, xe đưa đón sân bay, buffet sáng, spa trị liệu và các tiện ích cao cấp.
                  </div>
                </div>

                <div style={{ minWidth: 240 }}>
                  <Form.Control
                    type="text"
                    size="sm"
                    placeholder="🔍 Tìm tên dịch vụ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ borderRadius: 20, background: '#FAF9F5', fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Bộ lọc danh mục (Pills dùng chung) */}
              <div className="d-flex gap-1.5 flex-wrap mb-3.5">
                {categories.map((cat) => {
                  const label =
                    cat === 'ALL'
                      ? 'Tất cả'
                      : cat === 'TRANSPORT'
                      ? '🚗 Đưa đón sân bay'
                      : cat === 'F&B'
                      ? '🍽️ Ẩm thực (F&B)'
                      : cat === 'SPA'
                      ? '💆 Spa & Trị liệu'
                      : cat === 'LAUNDRY'
                      ? '👔 Giặt ủi'
                      : cat === 'MINIBAR'
                      ? '🍷 Minibar'
                      : cat;
                  const isSelected = categoryFilter === cat;
                  return (
                    <Button
                      key={cat}
                      size="sm"
                      variant={isSelected ? 'dark' : 'outline-secondary'}
                      onClick={() => setCategoryFilter(cat)}
                      style={
                        isSelected
                          ? { background: '#16233B', borderColor: '#16233B', borderRadius: 20, fontSize: 12.5, fontWeight: 600 }
                          : { borderRadius: 20, background: '#FAF9F5', borderColor: '#E8E6DC', color: '#5E5D59', fontSize: 12.5 }
                      }
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>

              {/* Lưới danh sách dịch vụ dùng chung */}
              {loadingServices ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="secondary" />
                  <div className="text-secondary small mt-2">Đang tải danh mục dịch vụ...</div>
                </div>
              ) : filteredServices.length === 0 ? (
                <Card className="border-0 shadow-sm rounded-3 text-center py-5" style={{ background: '#FAF9F5' }}>
                  <Card.Body>
                    <div className="text-secondary mb-2" style={{ fontSize: 32 }}>🍽️</div>
                    <div className="text-dark fw-semibold">Không tìm thấy dịch vụ nào phù hợp</div>
                    <div className="text-secondary small">Vui lòng thử lại với từ khóa hoặc danh mục khác.</div>
                  </Card.Body>
                </Card>
              ) : (
                <>
                  <div className="row g-3">
                    {paginatedCatalogServices.map((svc) => (
                      <div key={svc.serviceId} className="col-12 col-md-6 col-xl-4">
                        <Card
                          className="h-100 border-0 shadow-sm rounded-3 d-flex flex-column justify-content-between"
                          style={{ background: '#FFFFFF', border: '1px solid #E8E6DC' }}
                        >
                          <Card.Body className="p-3 d-flex flex-column justify-content-between">
                            <div>
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <Badge bg="light" text="dark" style={{ border: '1px solid #E8E6DC', fontWeight: 600, fontSize: 11 }}>
                                  {svc.category || 'DỊCH VỤ'}
                                </Badge>
                                <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: '#C96442', fontSize: 15 }}>
                                  {formatVND(svc.unitPrice)}
                                  <small className="text-muted fw-normal" style={{ fontSize: 11.5 }}> / {svc.unit || svc.billingUnit || 'Lượt'}</small>
                                </span>
                              </div>
                              <h6 className="fw-bold text-dark mb-1" style={{ fontSize: 15.5 }}>
                                {svc.serviceName}
                              </h6>
                              <p className="text-secondary small mb-3" style={{ fontSize: 12.5, minHeight: 38, lineHeight: 1.45 }}>
                                {svc.description || 'Dịch vụ cao cấp phục vụ tận phòng hoặc theo lịch hẹn trước.'}
                              </p>
                            </div>

                            <div className="pt-2 border-top">
                              <Button
                                size="sm"
                                className="w-100"
                                disabled={!canOrderServices}
                                onClick={() => handleOpenOrder(svc)}
                                style={{
                                  background: canOrderServices ? '#16233B' : '#94A3B8',
                                  borderColor: canOrderServices ? '#16233B' : '#94A3B8',
                                  fontWeight: 600,
                                  borderRadius: 6,
                                  padding: '6px 12px',
                                }}
                              >
                                <i className="bi bi-cart-plus me-1"></i> Đặt dịch vụ này
                              </Button>
                            </div>
                          </Card.Body>
                        </Card>
                      </div>
                    ))}
                  </div>

                  {renderCustomerPagination(
                    catalogPage,
                    totalCatalogPages,
                    filteredServices.length,
                    catalogPageSize,
                    setCatalogPage,
                    setCatalogPageSize,
                    [6, 12, 24]
                  )}
                </>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* MỤC 2: LỊCH ĐẶT TRƯỚC CHO CHUYẾN ĐI (PRE-ORDER SCHEDULE) */}
          {/* ========================================================================= */}
          {activeNav === 'pre-orders' && (
            <div>
              {/* Header Mục Lịch Đặt Trước */}
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div>
                  <h4 style={{ margin: 0, color: '#0369A1', fontSize: 20, fontWeight: 700 }}>
                    ✈️ Lịch Dịch Vụ Quý Khách Đã Hẹn Trước
                  </h4>
                  <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                    Danh sách xe đưa đón sân bay, buffet sáng, tiện nghi đã đặt trước cho chuyến đi sắp tới.
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={loadConfirmedReservations}
                    disabled={loadingReservations}
                    style={{ borderRadius: 6, fontSize: 12.5 }}
                  >
                    <i className={`bi bi-arrow-clockwise me-1 ${loadingReservations ? 'spin' : ''}`}></i>
                    Làm mới lịch
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setActiveNav('catalog')}
                    style={{ background: '#0284C7', borderColor: '#0284C7', borderRadius: 6, fontSize: 12.5 }}
                  >
                    + Đặt thêm dịch vụ
                  </Button>
                </div>
              </div>

              {/* Thông tin chuyến đi đang chọn */}
              {hasConfirmedBooking && (
                <Card className="border-0 shadow-sm rounded-3 mb-3.5" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                  <Card.Body className="p-3">
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <strong style={{ color: '#0369A1', fontSize: 15 }}>
                            Chuyến đi: #{currentReservation?.reservationCode} — {currentReservation?.roomTypeName}
                          </strong>
                          <Badge bg="info" text="dark" style={{ fontSize: 10 }}>CONFIRMED</Badge>
                        </div>
                        <div className="small text-secondary mt-0.5">
                          Ngày nhận phòng: <strong className="text-dark">{formatDate(currentReservation?.checkInDate)}</strong> • Ngày trả phòng: <strong className="text-dark">{formatDate(currentReservation?.checkOutDate)}</strong>
                        </div>
                      </div>

                      {confirmedReservations.length > 1 && (
                        <div className="d-flex align-items-center gap-2">
                          <span className="small text-secondary" style={{ fontSize: 12 }}>Đổi chuyến:</span>
                          <Form.Select
                            size="sm"
                            value={selectedReservationId}
                            onChange={(e) => setSelectedReservationId(e.target.value)}
                            style={{ width: 'auto', minWidth: 150, fontSize: 12 }}
                          >
                            {confirmedReservations.map((r) => (
                              <option key={r.reservationId} value={r.reservationId}>
                                {r.reservationCode} ({formatDate(r.checkInDate)})
                              </option>
                            ))}
                          </Form.Select>
                        </div>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              )}

              {/* Bảng Dịch Vụ Đã Đặt Trước */}
              <Card className="border-0 shadow-sm rounded-3 overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8E6DC' }}>
                <Card.Header
                  style={{
                    background: '#FAF9F5',
                    borderBottom: '1px solid #E8E6DC',
                    padding: '10px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <strong style={{ color: '#16233B', fontSize: 14 }}>
                    Dịch Vụ Đã Đặt Trước ({displayedPreOrders.length})
                  </strong>

                  {confirmedReservations.length > 1 && (
                    <div className="d-flex align-items-center gap-2">
                      <span className="small text-secondary" style={{ fontSize: 12 }}>Lọc theo:</span>
                      <Form.Select
                        size="sm"
                        value={filterReservationId}
                        onChange={(e) => setFilterReservationId(e.target.value)}
                        style={{ width: 'auto', minWidth: 150, fontSize: 12 }}
                      >
                        <option value="ALL">Tất cả chuyến đi ({allMyPreOrders.length})</option>
                        {confirmedReservations.map((r) => (
                          <option key={r.reservationId} value={r.reservationId}>
                            {r.reservationCode} ({formatDate(r.checkInDate)})
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                  )}
                </Card.Header>

                <Card.Body className="p-0">
                  {displayedPreOrders.length === 0 ? (
                    <div className="text-center py-5 px-3">
                      <div className="text-secondary mb-2" style={{ fontSize: 32 }}>🚗</div>
                      <div className="text-dark fw-semibold" style={{ fontSize: 14 }}>
                        Quý khách chưa có dịch vụ đặt trước nào
                      </div>
                      <div className="text-secondary small mt-1 mb-3">
                        Quý khách có thể đặt trước xe đón sân bay, buffet sáng hoặc chuẩn bị phòng trước khi đến nhận phòng.
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setActiveNav('catalog')}
                        style={{ background: '#0284C7', borderColor: '#0284C7', borderRadius: 6, fontSize: 12.5 }}
                      >
                        Xem danh mục &amp; Đặt trước ngay
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Table responsive hover className="mb-0 align-middle">
                        <thead style={{ background: '#F8FAFC', fontSize: 12.5, color: '#475569' }}>
                          <tr>
                            <th style={{ width: 45 }}>STT</th>
                            <th>Mã Booking</th>
                            <th>Tên Dịch Vụ</th>
                            <th className="text-center">Số Lượng</th>
                            <th>Thời Gian Dự Kiến</th>
                            <th>Chi Tiết / Chuyến Bay</th>
                            <th className="text-center">Trạng Thái</th>
                            <th className="text-center" style={{ width: 100 }}>Thao Tác</th>
                          </tr>
                        </thead>
                        <tbody style={{ fontSize: 13 }}>
                          {paginatedPreOrders.map((po, idx) => {
                            const stt = (preOrderPage - 1) * preOrderPageSize + idx + 1;
                            return (
                              <tr key={idx}>
                                <td className="text-secondary">{stt}</td>
                                <td>
                                  <code style={{ color: '#0369a1', fontWeight: 600 }}>#{po.reservationCode}</code>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>{po.roomTypeName}</div>
                                </td>
                                <td>
                                  <strong style={{ color: '#16233B' }}>{po.serviceName}</strong>
                                  {po.serviceId && <div style={{ fontSize: 11, color: '#94a3b8' }}>Mã DV: #{po.serviceId}</div>}
                                </td>
                                <td className="text-center fw-semibold">{po.quantity}</td>
                                <td className="text-dark">
                                  <i className="bi bi-clock me-1 text-secondary"></i>
                                  <strong>{po.scheduledTime || 'Trước khi nhận phòng'}</strong>
                                </td>
                                <td className="text-secondary small" style={{ maxWidth: 260 }}>
                                  {po.details || 'Tiêu chuẩn'}
                                </td>
                                <td className="text-center">
                                  <Badge bg="info" text="dark" style={{ fontWeight: 500 }}>
                                    📋 Đã ghi nhận (Chờ check-in)
                                  </Badge>
                                </td>
                                <td className="text-center">
                                  <Button
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() => handleOpenCancelModal(po)}
                                    disabled={cancellingPreOrder === po.serviceId}
                                    style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 4 }}
                                    title="Hủy yêu cầu đặt trước dịch vụ này"
                                  >
                                    ✕ Hủy đặt
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>

                      <div className="p-3 pt-0">
                        {renderCustomerPagination(
                          preOrderPage,
                          totalPreOrderPages,
                          displayedPreOrders.length,
                          preOrderPageSize,
                          setPreOrderPage,
                          setPreOrderPageSize,
                          [5, 10, 20]
                        )}
                      </div>
                    </>
                  )}
                </Card.Body>
              </Card>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MỤC 3: ĐƠN DỊCH VỤ PHỤC VỤ TẠI PHÒNG (ROOM SERVICE IN-STAY ORDERS) */}
          {/* ========================================================================= */}
          {activeNav === 'room-orders' && (
            <div>
              {/* Header Mục Đơn Tại Phòng */}
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div>
                  <h4 style={{ margin: 0, color: '#166534', fontSize: 20, fontWeight: 700 }}>
                    🚪 Đơn Dịch Vụ Phục Vụ Tại Phòng
                  </h4>
                  <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                    Theo dõi trạng thái phục vụ thời gian thực các món ăn, đồ uống, giặt là đang giao tới phòng.
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  {hasActiveStay && (
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => loadOrders(selectedStayId)}
                      disabled={loadingOrders}
                      style={{ borderRadius: 6, fontSize: 12.5 }}
                    >
                      <i className={`bi bi-arrow-clockwise me-1 ${loadingOrders ? 'spin' : ''}`}></i>
                      Cập nhật trạng thái
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="dark"
                    onClick={() => setActiveNav('catalog')}
                    style={{ background: '#16233B', borderColor: '#16233B', borderRadius: 6, fontSize: 12.5 }}
                  >
                    + Gọi thêm món
                  </Button>
                </div>
              </div>

              {!hasActiveStay ? (
                <Alert
                  variant="warning"
                  className="border-0 shadow-sm rounded-3 p-4 text-center"
                  style={{ background: '#FFF8E1', borderLeft: '4px solid #FFA000' }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🚪</div>
                  <h5 className="fw-bold mb-1" style={{ color: '#8D6E63' }}>
                    Quý khách chưa có phòng đang lưu trú
                  </h5>
                  <p className="small text-secondary mb-3 mx-auto" style={{ maxWidth: 480 }}>
                    Chức năng gọi món tận phòng (Room Service 24/7) sẽ tự động mở khi quý khách hoàn tất thủ tục nhận phòng (Check-in) tại quầy lễ tân.
                  </p>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setActiveNav('pre-orders')}
                    style={{ background: '#0284C7', borderColor: '#0284C7' }}
                  >
                    Xem lịch đặt trước cho chuyến đi sắp tới
                  </Button>
                </Alert>
              ) : (
                <>
                  {/* Thẻ Phòng Đang Ở */}
                  <Card className="border-0 shadow-sm rounded-3 mb-3.5" style={{ background: '#FFFFFF', border: '1px solid #C8E6C9' }}>
                    <Card.Body className="p-3">
                      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div className="d-flex align-items-center gap-3">
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 10,
                              background: '#E8F5E9',
                              border: '1px solid #C8E6C9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 22,
                            }}
                          >
                            🚪
                          </div>
                          <div>
                            <div className="d-flex align-items-center gap-2">
                              <strong style={{ color: '#16233B', fontSize: 17 }}>{friendlyRoomNumber}</strong>
                              <Badge bg="success" style={{ fontSize: 10 }}>ĐANG Ở (ACTIVE)</Badge>
                            </div>
                            <div className="small text-secondary mt-0.5">
                              Khách: <strong className="text-dark">{currentStay?.guestName || user?.fullName}</strong> • Mã booking: <strong className="text-dark">{currentStay?.reservationCode}</strong>
                            </div>
                          </div>
                        </div>

                        {activeStays.length > 1 && (
                          <div className="d-flex align-items-center gap-2">
                            <span className="small text-secondary" style={{ fontSize: 12 }}>Đổi phòng:</span>
                            <Form.Select
                              size="sm"
                              value={selectedStayId}
                              onChange={(e) => setSelectedStayId(e.target.value)}
                              style={{ width: 'auto', minWidth: 150, fontSize: 12 }}
                            >
                              {activeStays.map((st) => (
                                <option key={st.stayId} value={st.stayId}>
                                  Phòng {st.roomNumber} ({st.reservationCode})
                                </option>
                              ))}
                            </Form.Select>
                          </div>
                        )}
                      </div>
                    </Card.Body>
                  </Card>

                  {/* Bảng Đơn Dịch Vụ Phòng */}
                  <Card className="border-0 shadow-sm rounded-3 overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8E6DC' }}>
                    <Card.Header style={{ background: '#FAF9F5', borderBottom: '1px solid #E8E6DC', padding: '10px 16px' }}>
                      <strong style={{ color: '#16233B', fontSize: 14 }}>
                        Danh Sách Đơn Phòng ({myOrders.length})
                      </strong>
                    </Card.Header>
                    <Card.Body className="p-0">
                      {loadingOrders ? (
                        <div className="text-center py-4">
                          <Spinner animation="border" variant="secondary" size="sm" />
                          <div className="text-secondary small mt-2">Đang tải danh sách đơn dịch vụ phòng...</div>
                        </div>
                      ) : myOrders.length === 0 ? (
                        <div className="text-center py-5 px-3">
                          <div className="text-secondary mb-2" style={{ fontSize: 32 }}>🍽️</div>
                          <div className="text-dark fw-semibold" style={{ fontSize: 14 }}>
                            Quý khách chưa gọi món hoặc dịch vụ nào lên phòng
                          </div>
                          <div className="text-secondary small mt-1 mb-3">
                            Ẩm thực tươi nóng và giặt là phục vụ tận phòng 24/7.
                          </div>
                          <Button
                            size="sm"
                            variant="dark"
                            onClick={() => setActiveNav('catalog')}
                            style={{ background: '#16233B', borderColor: '#16233B', borderRadius: 6, fontSize: 12.5 }}
                          >
                            Đặt món lên phòng ngay
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Table responsive hover className="mb-0 align-middle">
                            <thead style={{ background: '#F8FAFC', fontSize: 12.5, color: '#475569' }}>
                              <tr>
                                <th>Mã Đơn</th>
                                <th>Thời Gian Gọi</th>
                                <th>Tên Dịch Vụ</th>
                                <th className="text-center">Số Lượng</th>
                                <th className="text-end">Đơn Giá</th>
                                <th className="text-end">Thành Tiền</th>
                                <th className="text-center">Trạng Thái</th>
                              </tr>
                            </thead>
                            <tbody style={{ fontSize: 13 }}>
                              {paginatedRoomOrders.map((ord) => {
                                const statusBg =
                                  ord.status === 'COMPLETED'
                                    ? 'success'
                                    : ord.status === 'ORDERED'
                                    ? 'warning'
                                    : 'secondary';
                                const statusLabel =
                                  ord.status === 'COMPLETED'
                                    ? 'Đã phục vụ (COMPLETED)'
                                    : ord.status === 'ORDERED'
                                    ? 'Đang chuẩn bị (ORDERED)'
                                    : ord.status === 'VOIDED'
                                    ? 'Đã hủy (VOIDED)'
                                    : ord.status;

                                return (
                                  <tr key={ord.serviceOrderId}>
                                    <td className="fw-bold text-dark">#{ord.serviceOrderId}</td>
                                    <td className="text-secondary">{formatDateTime(ord.orderTime)}</td>
                                    <td>
                                      <strong className="text-dark">{ord.serviceName}</strong>
                                      {ord.category && <div className="small text-secondary">{ord.category}</div>}
                                    </td>
                                    <td className="text-center fw-semibold">{ord.quantity}</td>
                                    <td className="text-end text-secondary">{formatVND(ord.unitPrice)}</td>
                                    <td className="text-end fw-bold" style={{ color: '#C96442' }}>
                                      {formatVND(ord.totalAmount || ord.unitPrice * ord.quantity)}
                                    </td>
                                    <td className="text-center">
                                      <Badge bg={statusBg} text={statusBg === 'warning' ? 'dark' : 'white'} style={{ fontWeight: 500 }}>
                                        {statusLabel}
                                      </Badge>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </Table>

                          <div className="p-3 pt-0">
                            {renderCustomerPagination(
                              roomOrderPage,
                              totalRoomOrderPages,
                              myOrders.length,
                              roomOrderPageSize,
                              setRoomOrderPage,
                              setRoomOrderPageSize,
                              [5, 10, 20]
                            )}
                          </div>
                        </>
                      )}
                    </Card.Body>
                  </Card>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL ĐẶT DỊCH VỤ THÔNG MINH (DÙNG CHUNG CHO TOÀN BỘ DANH MỤC) */}
      {/* ========================================================================= */}
      <Modal
        show={showOrderModal}
        onHide={() => !submittingOrder && setShowOrderModal(false)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton={!submittingOrder} style={{ background: '#FAF9F5', borderBottom: '1px solid #E8E6DC' }}>
          <Modal.Title style={{ fontFamily: 'var(--font-display, serif)', fontSize: 18, color: '#16233B' }}>
            🛎️ Xác Nhận Đặt Dịch Vụ Khách Sạn
          </Modal.Title>
        </Modal.Header>

        <Form onSubmit={handleSubmitOrder}>
          <Modal.Body style={{ background: '#FAF9F5', padding: 22 }}>
            {orderError && <Alert variant="danger" className="py-2 px-3 small rounded-3 mb-3">{orderError}</Alert>}
            {orderSuccess && <Alert variant="success" className="py-2 px-3 small rounded-3 mb-3">{orderSuccess}</Alert>}

            {selectedService && (
              <div className="d-flex flex-column gap-3">
                {/* Nút chuyển chế độ nếu khách vừa có phòng đang ở, vừa có chuyến sắp tới */}
                {hasActiveStay && hasConfirmedBooking && (
                  <div style={{ background: '#F1F5F9', borderRadius: 8, padding: 5, display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setOrderTargetMode('ACTIVE_STAY')}
                      className="btn btn-sm flex-fill"
                      style={{
                        background: orderTargetMode === 'ACTIVE_STAY' ? '#16233B' : 'transparent',
                        color: orderTargetMode === 'ACTIVE_STAY' ? '#FAF9F5' : '#475569',
                        fontWeight: 600,
                        border: 'none',
                        fontSize: 12.5,
                      }}
                    >
                      🚪 Giao tới {friendlyRoomNumber}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderTargetMode('PRE_ORDER')}
                      className="btn btn-sm flex-fill"
                      style={{
                        background: orderTargetMode === 'PRE_ORDER' ? '#0284C7' : 'transparent',
                        color: orderTargetMode === 'PRE_ORDER' ? '#FAF9F5' : '#475569',
                        fontWeight: 600,
                        border: 'none',
                        fontSize: 12.5,
                      }}
                    >
                      ✈️ Đặt trước cho chuyến đi #{currentReservation?.reservationCode}
                    </button>
                  </div>
                )}

                {/* Thông tin đối tượng phục vụ */}
                {orderTargetMode === 'PRE_ORDER' ? (
                  <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: '12px 14px' }}>
                    <div className="small text-secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                      ĐẶT TRƯỚC CHO CHUYẾN ĐI SẮP TỚI
                    </div>
                    {confirmedReservations.length > 1 ? (
                      <div className="mt-1">
                        <Form.Select
                          size="sm"
                          value={selectedReservationId}
                          onChange={(e) => setSelectedReservationId(e.target.value)}
                          style={{ fontSize: 12.5 }}
                        >
                          {confirmedReservations.map((r) => (
                            <option key={r.reservationId} value={r.reservationId}>
                              #{r.reservationCode} — {r.roomTypeName} (Nhận phòng: {formatDate(r.checkInDate)})
                            </option>
                          ))}
                        </Form.Select>
                      </div>
                    ) : (
                      <>
                        <div className="fw-bold" style={{ color: '#0369A1', fontSize: 15 }}>
                          Đơn #{currentReservation?.reservationCode} — {currentReservation?.roomTypeName}
                        </div>
                        <div className="text-secondary small">
                          Ngày nhận phòng: {formatDate(currentReservation?.checkInDate)} • Khách: {currentReservation?.contactName || user?.fullName}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DC', borderRadius: 8, padding: '12px 14px' }}>
                    <div className="small text-secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                      GIAO TỚI PHÒNG
                    </div>
                    <div className="fw-bold" style={{ color: '#16233B', fontSize: 16 }}>
                      {friendlyRoomNumber}
                    </div>
                    <div className="text-secondary small">
                      Khách: {currentStay?.guestName || user?.fullName} {currentStay?.reservationCode ? `• Mã booking: ${currentStay.reservationCode}` : ''}
                    </div>
                  </div>
                )}

                {/* Thông tin dịch vụ */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DC', borderRadius: 8, padding: '12px 14px' }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="badge bg-light text-dark border">{selectedService.category}</span>
                    <span className="fw-bold" style={{ color: '#C96442' }}>
                      {formatVND(selectedService.unitPrice)} / {selectedService.unit || selectedService.billingUnit || 'Lượt'}
                    </span>
                  </div>
                  <h6 className="fw-bold text-dark mb-1">{selectedService.serviceName}</h6>
                  <p className="text-secondary small mb-0">{selectedService.description}</p>
                </div>

                {/* Số lượng */}
                <div className="d-flex justify-content-between align-items-center">
                  <Form.Label className="small fw-semibold text-dark mb-0">Số lượng</Form.Label>
                  <div className="d-flex align-items-center gap-2">
                    <Button variant="outline-secondary" size="sm" style={{ width: 32, height: 32, padding: 0 }} onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>-</Button>
                    <Form.Control type="number" min="1" max="99" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} style={{ width: 56, textAlign: 'center', height: 32 }} />
                    <Button variant="outline-secondary" size="sm" style={{ width: 32, height: 32, padding: 0 }} onClick={() => setQuantity((q) => q + 1)}>+</Button>
                  </div>
                </div>

                {/* Trường nhập riêng theo từng chế độ */}
                {orderTargetMode === 'PRE_ORDER' ? (
                  <>
                    <div>
                      <Form.Label className="small fw-semibold text-dark mb-1">
                        Thời gian đón / phục vụ dự kiến <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Ví dụ: 14:00 ngày 15/11/2026 hoặc Khi hạ cánh"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        required
                        style={{ fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <Form.Label className="small fw-semibold text-dark mb-1">
                        Chi tiết hành trình / Yêu cầu riêng
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        placeholder="Ví dụ: Chuyến bay VN214 hạ cánh 13:30 tại ga T2, 4 hành khách, 2 vali to..."
                        value={flightDetails}
                        onChange={(e) => setFlightDetails(e.target.value)}
                        style={{ fontSize: 13 }}
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <Form.Label className="small fw-semibold text-dark mb-1">
                      Ghi chú cho phục vụ <span className="text-secondary fw-normal">(tùy chọn)</span>
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      placeholder="Ví dụ: Ít đá, không đường, mang thêm ly, giao lúc 19:30..."
                      value={roomServiceNotes}
                      onChange={(e) => setRoomServiceNotes(e.target.value)}
                      style={{ fontSize: 13 }}
                    />
                  </div>
                )}

                {/* Tạm tính chi phí */}
                <div style={{ background: '#F5F4ED', border: '1px dashed #D6D3C7', borderRadius: 8, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="small text-secondary">Tạm tính chi phí</div>
                    <div className="text-secondary" style={{ fontSize: 11 }}>
                      {orderTargetMode === 'PRE_ORDER'
                        ? 'Chi phí sẽ được cộng vào hóa đơn phòng sau khi nhận phòng'
                        : 'Được ghi nhận vào hóa đơn phòng khi hoàn tất phục vụ'}
                    </div>
                  </div>
                  <strong style={{ color: '#C96442', fontSize: 18, fontFamily: 'var(--font-mono, monospace)' }}>
                    {formatVND(lineEstimatedTotal)}
                  </strong>
                </div>
              </div>
            )}
          </Modal.Body>

          <Modal.Footer style={{ background: '#FAF9F5', borderTop: '1px solid #E8E6DC' }}>
            <Button variant="outline-secondary" onClick={() => setShowOrderModal(false)} disabled={submittingOrder} style={{ fontSize: 13 }}>
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={
                submittingOrder ||
                !selectedService ||
                (orderTargetMode === 'ACTIVE_STAY' && !selectedStayId) ||
                (orderTargetMode === 'PRE_ORDER' && !selectedReservationId)
              }
              style={{
                background: orderTargetMode === 'PRE_ORDER' ? '#0284C7' : '#16233B',
                borderColor: orderTargetMode === 'PRE_ORDER' ? '#0284C7' : '#16233B',
                color: '#FAF9F5',
                fontWeight: 600,
                padding: '8px 20px',
                fontSize: 13,
              }}
            >
              {submittingOrder ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  Đang ghi nhận...
                </>
              ) : orderTargetMode === 'PRE_ORDER' ? (
                'Xác Nhận Đặt Trước'
              ) : (
                'Gửi Yêu Cầu Phục Vụ'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
      {/* Modal Xác Nhận Hủy Đặt Trước Cho Khách Hàng (Thay thế window.confirm/alert) */}
      <Modal show={!!cancelModalData} onHide={() => !cancellingPreOrder && setCancelModalData(null)} centered>
        <Modal.Header closeButton style={{ borderBottom: '1px solid #F1F5F9' }}>
          <Modal.Title style={{ fontSize: 16, fontWeight: 700, color: '#16233B' }}>
            ⚠️ Xác Nhận Hủy Dịch Vụ Đặt Trước
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <p className="text-secondary mb-2" style={{ fontSize: 13.5 }}>
            Quý khách có chắc chắn muốn hủy yêu cầu đặt trước dịch vụ này cho chuyến đi{' '}
            <strong className="text-dark">#{cancelModalData?.reservationCode}</strong>?
          </p>

          <div
            style={{
              background: '#FFF1F2',
              border: '1px solid #FFE4E6',
              borderRadius: 8,
              padding: '12px 14px',
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            <div className="fw-bold" style={{ color: '#BE123C', fontSize: 14 }}>
              {cancelModalData?.serviceName} (SL: {cancelModalData?.quantity})
            </div>
            {cancelModalData?.scheduledTime && (
              <div className="text-secondary small mt-1">
                ⏱ Thời gian hẹn: <strong className="text-dark">{cancelModalData.scheduledTime}</strong>
              </div>
            )}
            {cancelModalData?.details && cancelModalData.details !== 'Không' && (
              <div className="text-secondary small">
                📍 Chi tiết: {cancelModalData.details}
              </div>
            )}
          </div>

          <div className="text-muted small" style={{ fontSize: 12 }}>
            ℹ️ Sau khi hủy, yêu cầu sẽ được gỡ khỏi lịch trình đón tiếp của khách sạn. Quý khách vẫn có thể đặt lại bất kỳ lúc nào trước khi nhận phòng.
          </div>
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '1px solid #F1F5F9', padding: '10px 16px' }}>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setCancelModalData(null)}
            disabled={!!cancellingPreOrder}
            style={{ fontSize: 12.5, borderRadius: 6 }}
          >
            Giữ lại
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleConfirmCancelCustomerPreOrder}
            disabled={!!cancellingPreOrder}
            style={{ fontSize: 12.5, borderRadius: 6, fontWeight: 600 }}
          >
            {cancellingPreOrder ? (
              <>
                <Spinner size="sm" animation="border" className="me-1" />
                Đang hủy...
              </>
            ) : (
              'Xác nhận hủy'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
