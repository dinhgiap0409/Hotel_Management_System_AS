export const parseAndGroupPreOrders = (notes) => {
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

export const buildPreOrderNote = (item) => {
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

export const formatOrderNotes = (notes) => {
  if (!notes) return '';
  return notes
    .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/\[Đặt trước\s*#\d+\]/gi, '[Đặt trước]')
    .trim();
};

// Đối chiếu 1-1 từng lượt đặt trước với các đơn dịch vụ đã tạo của phòng
// CHÚ Ý QUAN TRỌNG: Chỉ khớp với các đơn có đánh dấu [Đặt trước] trong ghi chú.
// Đơn gọi tại phòng thông thường (không có thẻ [Đặt trước]) là dịch vụ phát sinh riêng biệt, KHÔNG ĐƯỢC nuốt dịch vụ đặt trước lúc cọc phòng!
export const matchPreOrderItemsToStayOrders = (items, stayOrders) => {
  if (!items || items.length === 0) return [];
  const activeOrders = (stayOrders || []).filter((o) => o.status !== 'VOIDED');
  const usedOrderIds = new Set();

  const result = items.map((it) => ({ ...it, matchedOrder: null }));

  // Lọc chỉ những đơn thực sự được nạp/tạo từ dịch vụ đặt trước
  const preOrderMatchedOrders = activeOrders.filter((o) => {
    if (!o.notes) return false;
    const lower = o.notes.toLowerCase();
    return lower.includes('[đặt trước') || lower.includes('[dat truoc');
  });

  // Bước 1: Khớp chính xác theo giờ hẹn & ghi chú hoặc thẻ [Đặt trước #idx]
  result.forEach((it) => {
    const legacyTag = `[Đặt trước #${it.itemIndex + 1}]`;
    const timeVal = it.time || it.scheduledTime;
    const detailVal = it.detail || it.details;
    const timeTag = timeVal && timeVal !== 'Không' ? `Giờ hẹn: ${timeVal}` : null;
    const detailTag = detailVal && detailVal !== 'Không' ? `Yêu cầu: ${detailVal}` : null;

    const exactMatch = preOrderMatchedOrders.find((o) => {
      if (usedOrderIds.has(o.serviceOrderId)) return false;
      const isSameService =
        (it.serviceId && String(o.serviceId) === String(it.serviceId)) ||
        (o.serviceName && it.serviceName && o.serviceName.trim().toLowerCase() === it.serviceName.trim().toLowerCase());
      if (!isSameService) return false;

      if (o.notes.includes(legacyTag)) return true;
      const matchTime = !timeTag || o.notes.includes(timeTag);
      const matchDetail = !detailTag || o.notes.includes(detailTag);
      return matchTime && matchDetail;
    });

    if (exactMatch) {
      usedOrderIds.add(exactMatch.serviceOrderId);
      it.matchedOrder = exactMatch;
    }
  });

  // Bước 2: Khớp dự phòng theo thứ tự cho các đơn có [Đặt trước]
  const chronologicalPreOrders = [...preOrderMatchedOrders].sort(
    (a, b) => (a.serviceOrderId || 0) - (b.serviceOrderId || 0)
  );
  result.forEach((it) => {
    if (!it.matchedOrder) {
      const fallbackMatch = chronologicalPreOrders.find((o) => {
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

export const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  fontSize: 13.5,
  boxSizing: 'border-box',
};

export const labelStyle = {
  display: 'block',
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 600,
  color: '#334155',
};

// ==========================================
// CƠ CHẾ THÔNG BÁO KHẨN CẤP ĐẾN BỘ PHẬN DỊCH VỤ
// ==========================================
export const HMS_URGENT_ALERT_KEY = 'hms_service_urgent_alerts';
export const HMS_URGENT_ALERT_EVENT = 'hms-service-urgent-alert';

export const getUrgentAlerts = () => {
  try {
    const raw = localStorage.getItem(HMS_URGENT_ALERT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Tự động dọn dẹp các cảnh báo đã quá 4 tiếng
    const now = Date.now();
    const valid = parsed.filter((a) => a.timestamp && now - a.timestamp < 4 * 60 * 60 * 1000);
    if (valid.length !== parsed.length) {
      localStorage.setItem(HMS_URGENT_ALERT_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch (e) {
    return [];
  }
};

export const triggerUrgentCheckoutAlert = ({ stayId, roomNumber, reservationCode = '', orderIds = [], preOrderNames = [], summaryText = '' }) => {
  try {
    const current = getUrgentAlerts();
    // Loại bỏ alert cũ của stay này (nếu có) để cập nhật mới
    const filtered = current.filter((a) => String(a.stayId) !== String(stayId));
    const newAlert = {
      stayId: String(stayId),
      roomNumber: String(roomNumber || ''),
      reservationCode: String(reservationCode || ''),
      orderIds: (orderIds || []).map(String),
      preOrderNames: preOrderNames || [],
      summaryText: summaryText || '',
      timestamp: Date.now(),
    };
    filtered.push(newAlert);
    localStorage.setItem(HMS_URGENT_ALERT_KEY, JSON.stringify(filtered));

    // Phát custom event cho cùng tab hoặc cùng cửa sổ
    window.dispatchEvent(
      new CustomEvent(HMS_URGENT_ALERT_EVENT, {
        detail: newAlert,
      })
    );
    return true;
  } catch (e) {
    console.error('Lỗi khi kích hoạt thông báo khẩn:', e);
    return false;
  }
};

export const clearUrgentAlert = (stayId, orderId = null, preOrderName = null) => {
  try {
    const current = getUrgentAlerts();
    let updated;
    if (orderId || preOrderName) {
      updated = current
        .map((a) => {
          if (String(a.stayId) === String(stayId)) {
            const nextOrderIds = orderId
              ? (a.orderIds || []).filter((id) => String(id) !== String(orderId))
              : (a.orderIds || []);
            const nextPreOrders = preOrderName
              ? (a.preOrderNames || []).filter(
                  (name) => name.trim().toLowerCase() !== preOrderName.trim().toLowerCase()
                )
              : (a.preOrderNames || []);
            return {
              ...a,
              orderIds: nextOrderIds,
              preOrderNames: nextPreOrders,
            };
          }
          return a;
        })
        .filter((a) => (a.orderIds && a.orderIds.length > 0) || (a.preOrderNames && a.preOrderNames.length > 0));
    } else {
      updated = current.filter((a) => String(a.stayId) !== String(stayId));
    }
    localStorage.setItem(HMS_URGENT_ALERT_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent(HMS_URGENT_ALERT_EVENT, {
        detail: { cleared: true, stayId, orderId, preOrderName },
      })
    );
    return updated;
  } catch (e) {
    console.error('Lỗi khi xóa thông báo khẩn:', e);
    return [];
  }
};

export const syncUrgentAlertsWithRealData = (activeStays = [], orders = [], upcomingPreOrders = []) => {
  try {
    const current = getUrgentAlerts();
    if (!current || current.length === 0) return [];

    const updated = current.filter((alert) => {
      const stayIdStr = String(alert.stayId);
      const matchedStay = activeStays.find(
        (s) => String(s.stayId) === stayIdStr || (alert.roomNumber && String(s.roomNumber) === String(alert.roomNumber))
      );

      // Nếu không tìm thấy stay trong activeStays (khách đã checkout và đóng folio), xóa alert
      if (!matchedStay) return false;

      // Kiểm tra xem phòng này còn đơn dịch vụ nào đang dở dang (ORDERED) không
      const pendingRoomOrders = orders.filter(
        (o) => String(o.stayId) === String(matchedStay.stayId) && o.status === 'ORDERED'
      );

      // Kiểm tra xem phòng này còn dịch vụ đặt trước nào chưa nạp/hoàn thành không
      const reservation = upcomingPreOrders.find(
        (r) => r.reservationCode === matchedStay.reservationCode || (alert.reservationCode && r.reservationCode === alert.reservationCode)
      );
      let unchargedPreOrders = [];
      if (reservation) {
        const rawItems = parseAndGroupPreOrders(reservation.specialNotes);
        const stayOrders = orders.filter((o) => String(o.stayId) === String(matchedStay.stayId));
        const matchedItems = matchPreOrderItemsToStayOrders(rawItems, stayOrders);
        unchargedPreOrders = matchedItems.filter((it) => !it.matchedOrder || it.matchedOrder.status !== 'COMPLETED');
      }

      // Còn đơn phòng dở dang HOẶC còn dịch vụ đặt trước chưa nạp thì mới giữ cảnh báo
      return pendingRoomOrders.length > 0 || unchargedPreOrders.length > 0;
    });

    if (updated.length !== current.length) {
      localStorage.setItem(HMS_URGENT_ALERT_KEY, JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent(HMS_URGENT_ALERT_EVENT, {
          detail: { synced: true, count: updated.length },
        })
      );
    }
    return updated;
  } catch (e) {
    console.error('Lỗi đồng bộ urgent alerts:', e);
    return getUrgentAlerts();
  }
};

export const toDateStr = (val) => {
  if (!val) return '';
  if (Array.isArray(val)) {
    const [y, m, d] = val;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const str = String(val).trim();
  if (str.includes('T')) return str.split('T')[0];
  return str;
};

export const parseDateToMs = (d) => {
  if (!d) return Infinity;
  const s = toDateStr(d);
  if (!s) return Infinity;
  const time = new Date(s).getTime();
  return isNaN(time) ? Infinity : time;
};

export const isReservationUrgent = (r, urgentAlerts = [], activeStays = []) => {
  if (!urgentAlerts || urgentAlerts.length === 0 || !r) return false;
  const matchedStay = (activeStays || []).find(
    (s) => s.reservationCode === r.reservationCode || (s.roomNumber && s.roomNumber === r.roomNumber)
  );

  return urgentAlerts.some((a) => {
    if (a.reservationCode && r.reservationCode && String(a.reservationCode).trim().toLowerCase() === String(r.reservationCode).trim().toLowerCase()) {
      return true;
    }
    if (matchedStay && String(a.stayId) === String(matchedStay.stayId)) {
      return true;
    }
    if (a.roomNumber && matchedStay?.roomNumber && String(a.roomNumber).trim() === String(matchedStay.roomNumber).trim()) {
      return true;
    }
    return false;
  });
};

export const getPreOrderPriorityScore = (r, activeStays = [], orders = [], urgentAlerts = []) => {
  const matchedStay = (activeStays || []).find(
    (s) => s.reservationCode === r.reservationCode || (s.roomNumber && s.roomNumber === r.roomNumber)
  );
  const urgent = isReservationUrgent(r, urgentAlerts, activeStays);
  const isCheckedIn = Boolean(matchedStay);

  let hasUncharged = false;
  if (matchedStay) {
    const rawItems = parseAndGroupPreOrders(r.specialNotes);
    const stayOrders = orders ? orders.filter((o) => String(o.stayId) === String(matchedStay.stayId)) : [];
    const matchedItems = matchPreOrderItemsToStayOrders(rawItems, stayOrders);
    hasUncharged = matchedItems.some((it) => !it.matchedOrder || it.matchedOrder.status !== 'COMPLETED');
  }

  // Tier 0: Khách đang tại quầy thu ngân chờ check-out (Cảnh báo khẩn cấp và còn dịch vụ chưa hoàn tất)
  if (urgent && hasUncharged) {
    return {
      tier: 0,
      sortKey: parseDateToMs(matchedStay?.checkOutDate || r.checkOutDate),
    };
  }

  // Tier 1: Khách đã nhận phòng, còn dịch vụ đặt trước chưa nạp/chưa xong, ưu tiên checkout sớm nhất
  if (isCheckedIn && hasUncharged) {
    return {
      tier: 1,
      sortKey: parseDateToMs(matchedStay?.checkOutDate || r.checkOutDate),
    };
  }

  // Tier 2: Khách đã nhận phòng, đã nạp/xong hết dịch vụ đặt trước, ưu tiên checkout sớm nhất
  if (isCheckedIn && !hasUncharged) {
    return {
      tier: 2,
      sortKey: parseDateToMs(matchedStay?.checkOutDate || r.checkOutDate),
    };
  }

  // Tier 3: Khách chưa nhận phòng (chờ check-in), ưu tiên ngày đến nhận phòng sớm nhất
  if (!isCheckedIn) {
    return {
      tier: 3,
      sortKey: parseDateToMs(r.checkInDate),
    };
  }

  return {
    tier: 4,
    sortKey: parseDateToMs(r.checkInDate),
  };
};

export const sortPreOrdersByCheckoutPriority = (list = [], activeStays = [], orders = [], urgentAlerts = []) => {
  return [...list].sort((a, b) => {
    const pA = getPreOrderPriorityScore(a, activeStays, orders, urgentAlerts);
    const pB = getPreOrderPriorityScore(b, activeStays, orders, urgentAlerts);

    if (pA.tier !== pB.tier) {
      return pA.tier - pB.tier;
    }

    if (pA.sortKey !== pB.sortKey) {
      return pA.sortKey - pB.sortKey;
    }

    return (b.reservationId || 0) - (a.reservationId || 0);
  });
};


