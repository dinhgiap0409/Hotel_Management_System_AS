export function getLocalDateString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateNights(checkInStr, checkOutStr) {
  if (!checkInStr || !checkOutStr) return 0;
  const start = new Date(`${checkInStr}T00:00:00`);
  const end = new Date(`${checkOutStr}T00:00:00`);
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export function formatVietnameseDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function parseAmenities(roomType) {
  if (Array.isArray(roomType?.amenitiesList) && roomType.amenitiesList.length > 0) {
    return roomType.amenitiesList;
  }
  if (typeof roomType?.amenities === 'string' && roomType.amenities.trim()) {
    return roomType.amenities
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function deriveBedLayout(roomType) {
  if (roomType?.bedLayout) return roomType.bedLayout;
  const amenities = parseAmenities(roomType);
  for (const item of amenities) {
    const lower = item.toLowerCase();
    if (lower.includes('bed') || lower.includes('giường')) {
      return item;
    }
  }
  const name = (roomType?.typeName || '').toLowerCase();
  if (name.includes('twin')) return '2 Giường đơn tiêu chuẩn (Twin Beds)';
  if (name.includes('king')) return '1 Giường đôi cỡ lớn (King Bed)';
  if (name.includes('double')) return '1 Giường đôi tiêu chuẩn (Queen/Double Bed)';
  if (name.includes('family')) return '2 Giường lớn gia đình (2 Queen Beds)';
  return `Giường tiêu chuẩn (${roomType?.capacity || 2} khách)`;
}

export function buildDefaultDayOfWeekRates(basePrice) {
  const base = Number(basePrice || 0);
  const labels = [
    { dayOfWeek: 1, dayLabel: 'Thứ Hai' },
    { dayOfWeek: 2, dayLabel: 'Thứ Ba' },
    { dayOfWeek: 3, dayLabel: 'Thứ Tư' },
    { dayOfWeek: 4, dayLabel: 'Thứ Năm' },
    { dayOfWeek: 5, dayLabel: 'Thứ Sáu' },
    { dayOfWeek: 6, dayLabel: 'Thứ Bảy' },
    { dayOfWeek: 7, dayLabel: 'Chủ Nhật' },
  ];
  return labels.map((d) => ({
    ...d,
    price: base,
    isWeekendSurcharge: false,
  }));
}

export function formatReviewTimestamp(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}


