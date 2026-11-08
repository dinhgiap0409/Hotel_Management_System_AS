import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { billingApi } from '../../services/billingApi';
import { formatVND } from '../../lib/money';
import { PaginationControl } from '../services-billing/components/PaginationControl';

const formatDate = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return String(val);
  }
};

const formatDateTime = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(val);
  }
};

const toIsoDateStr = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const ReportsDashboardPage = () => {
  const { user } = useAuth();
  const role = user?.role || 'GENERAL_MANAGER';

  // Phân quyền đồng nhất theo đúng ma trận SRS (HMS_Analysis_And_Team_Allocation.md):
  // - UC-46 (Báo cáo Doanh thu): GENERAL_MANAGER, ACCOUNTANT, ADMIN
  // - UC-45 (Báo cáo Công suất phòng): GENERAL_MANAGER, SALES_MANAGER, ADMIN
  // - UC-47 (Phân tích Tiêu thụ dịch vụ): GENERAL_MANAGER, ACCOUNTANT, SERVICE_MANAGER, ADMIN
  // - UC-43 (Phản hồi đánh giá): GENERAL_MANAGER, SALES_MANAGER, FRONT_DESK, ADMIN
  // - UC-44 (Kiểm duyệt Ẩn/Hiện đánh giá): GENERAL_MANAGER, SALES_MANAGER, ADMIN
  // - UC-50 (Xuất báo cáo tổng hợp Excel/In): GENERAL_MANAGER, ACCOUNTANT, ADMIN
  const canViewRevenue = ['GENERAL_MANAGER', 'ACCOUNTANT', 'ADMIN'].includes(role);
  const canViewOccupancy = ['GENERAL_MANAGER', 'SALES_MANAGER', 'ADMIN'].includes(role);
  const canViewServices = ['GENERAL_MANAGER', 'ACCOUNTANT', 'SERVICE_MANAGER', 'ADMIN'].includes(role);
  const canViewReviews = ['GENERAL_MANAGER', 'SALES_MANAGER', 'FRONT_DESK', 'ADMIN'].includes(role);
  const canReplyReview = ['GENERAL_MANAGER', 'SALES_MANAGER', 'FRONT_DESK', 'ADMIN'].includes(role);
  const canModerateReview = ['GENERAL_MANAGER', 'SALES_MANAGER', 'ADMIN'].includes(role);
  const canExportSummary = ['GENERAL_MANAGER', 'ACCOUNTANT', 'ADMIN'].includes(role);
  const showDateFilterBar = canViewRevenue || canViewOccupancy || canViewServices;

  const roleHeaderMeta = useMemo(() => {
    switch (role) {
      case 'ACCOUNTANT':
        return {
          badge: 'Phân hệ Kế Toán & Kiểm Toán Tài Chính',
          title: 'Báo Cáo Phân Tích Doanh Thu, Hóa Đơn GTGT & Tiêu Thụ Dịch Vụ',
          subtitle:
            'Đối soát nguồn thu tiền phòng, dịch vụ phụ trợ, phụ thu phát sinh, thuế GTGT 8%, phương thức thanh toán và xuất báo cáo tài chính.',
        };
      case 'SALES_MANAGER':
        return {
          badge: 'Phân hệ Quản Lý Kinh Doanh & Chăm Sóc Khách Hàng',
          title: 'Báo Cáo Công Suất Khai Thác Phòng & Kiểm Duyệt Đánh Giá Khách Sạn',
          subtitle:
            'Theo dõi hiệu suất lấp đầy theo từng hạng phòng, phản hồi khách lưu trú và kiểm duyệt hiển thị đánh giá công khai.',
        };
      case 'SERVICE_MANAGER':
        return {
          badge: 'Phân hệ Quản Lý Vận Hành Dịch Vụ Phụ Trợ',
          title: 'Báo Cáo Phân Tích & Xếp Hạng Tiêu Thụ Dịch Vụ Phụ Trợ',
          subtitle:
            'Thống kê sản lượng tiêu thụ, doanh số đóng góp và tỷ trọng theo từng nhóm dịch vụ (Ẩm thực, Spa, Giặt ủi, Đưa đón, Minibar).',
        };
      case 'FRONT_DESK':
        return {
          badge: 'Phân hệ Lễ Tân & Chăm Sóc Khách Lưu Trú',
          title: 'Tiếp Nhận & Phản Hồi Đánh Giá Của Khách Sau Lưu Trú',
          subtitle:
            'Theo dõi đánh giá thực tế của khách hàng sau khi trả phòng và đăng phản hồi cảm ơn, giải đáp chính thức từ khách sạn.',
        };
      default:
        return {
          badge: 'Phân hệ Ban Giám Đốc & Quản Trị Điều Hành',
          title: 'Báo Cáo Doanh Thu, Công Suất Phòng & Đánh Giá Khách Sạn',
          subtitle:
            'Tổng hợp toàn diện doanh thu thực thu, thuế GTGT 8%, công suất khai thác phòng, hiệu quả kinh doanh dịch vụ phụ trợ và kiểm duyệt đánh giá khách hàng.',
        };
    }
  }, [role]);

  const defaultTab = useMemo(() => {
    if (canViewRevenue) return 'REVENUE';
    if (canViewOccupancy) return 'OCCUPANCY';
    if (canViewServices) return 'SERVICES';
    return 'REVIEWS';
  }, [canViewRevenue, canViewOccupancy, canViewServices]);

  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Date range state (default: last 30 days up to today)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toIsoDateStr(d);
  });
  const [toDate, setToDate] = useState(() => toIsoDateStr(new Date()));
  const [periodPreset, setPeriodPreset] = useState('30D');

  const [report, setReport] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Review filter state (Tab 4)
  const [revStarFilter, setRevStarFilter] = useState('ALL');
  const [revStatusFilter, setRevStatusFilter] = useState('ALL'); // ALL, VISIBLE, HIDDEN, UNREPLIED
  const [revRoomTypeFilter, setRevRoomTypeFilter] = useState('ALL');
  const [revSearch, setRevSearch] = useState('');

  // Service category filter state (Tab 3)
  const [svcCategoryFilter, setSvcCategoryFilter] = useState('ALL');

  // Pagination states across tabs
  const [invPage, setInvPage] = useState(1);
  const [invPageSize, setInvPageSize] = useState(10);

  const [occPage, setOccPage] = useState(1);
  const [occPageSize, setOccPageSize] = useState(5);

  const [svcPage, setSvcPage] = useState(1);
  const [svcPageSize, setSvcPageSize] = useState(5);

  const [revPage, setRevPage] = useState(1);
  const [revPageSize, setRevPageSize] = useState(5);

  // Auto-reset page numbers on filter changes
  useEffect(() => {
    setInvPage(1);
    setOccPage(1);
    setSvcPage(1);
  }, [fromDate, toDate, report]);

  useEffect(() => {
    setSvcPage(1);
  }, [svcCategoryFilter]);

  useEffect(() => {
    setRevPage(1);
  }, [revStarFilter, revStatusFilter, revRoomTypeFilter, revSearch]);

  // Modals for UC-43 (Reply) & UC-44 (Hide/Restore)
  const [replyModalReview, setReplyModalReview] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);

  const [moderateModalReview, setModerateModalReview] = useState(null);
  const [hiddenReasonText, setHiddenReasonText] = useState('');
  const [moderateSaving, setModerateSaving] = useState(false);

  const showNotice = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchDashboardData = async (customFrom = fromDate, customTo = toDate) => {
    setLoading(true);
    try {
      const [analyticsRes, reviewsRes] = await Promise.all([
        billingApi.getManagementAnalytics(customFrom, customTo),
        billingApi.getAllReviewsForModeration(),
      ]);
      setReport(analyticsRes?.data?.data || analyticsRes?.data || null);
      const revList = reviewsRes?.data?.data || reviewsRes?.data || [];
      setReviews(Array.isArray(revList) ? revList : []);
    } catch (err) {
      showNotice(
        'error',
        err?.response?.data?.message || 'Không thể tải dữ liệu báo cáo quản trị.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(fromDate, toDate);
  }, []);

  const handleApplyPreset = (preset) => {
    setPeriodPreset(preset);
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'TODAY') {
      start = now;
    } else if (preset === '7D') {
      start.setDate(now.getDate() - 6);
    } else if (preset === '30D') {
      start.setDate(now.getDate() - 29);
    } else if (preset === 'THIS_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (preset === 'THIS_YEAR') {
      start = new Date(now.getFullYear(), 0, 1);
    } else if (preset === 'ALL') {
      start = new Date(2024, 0, 1);
      end = new Date(now.getFullYear() + 1, 11, 31);
    }

    const fStr = toIsoDateStr(start);
    const tStr = toIsoDateStr(end);
    setFromDate(fStr);
    setToDate(tStr);
    fetchDashboardData(fStr, tStr);
  };

  const handleCustomDateFilter = (e) => {
    e.preventDefault();
    setPeriodPreset('CUSTOM');
    fetchDashboardData(fromDate, toDate);
  };

  // UC-50: Export Management Summary to Excel (.csv UTF-8 with BOM)
  const handleExportExcelCsv = () => {
    if (!report) return;
    const lines = [];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    lines.push([esc('BÁO CÁO QUẢN TRỊ TỔNG HỢP KHÁCH SẠN HMS LUXURY')]);
    lines.push([esc(`Kỳ báo cáo: Từ ${report.fromDate} đến ${report.toDate} (${report.periodDays} ngày)`)]);
    lines.push([esc(`Người xuất báo cáo: ${user?.fullName || 'Quản trị viên'} (${role})`)]);
    lines.push([]);

    // Section 1: KPI Summary
    lines.push([esc('I. TỔNG QUAN CHỈ SỐ VẬN HÀNH & DOANH THU')]);
    lines.push([esc('Chỉ tiêu'), esc('Giá trị')]);
    lines.push([esc('Tổng số phòng hoạt động'), esc(report.totalRooms)]);
    lines.push([esc('Số phòng đang có khách (Occupied)'), esc(report.occupiedRooms)]);
    lines.push([esc('Công suất phòng tức thời (%)'), esc(`${report.currentOccupancyRate}%`)]);
    lines.push([esc('Tổng số đêm phòng đã bán trong kỳ'), esc(report.periodRoomNightsSold)]);
    lines.push([esc('Công suất lấp đầy bình quân trong kỳ (%)'), esc(`${report.periodOccupancyRate}%`)]);
    lines.push([esc('Số hóa đơn đã quyết toán (PAID)'), esc(report.paidInvoicesCount)]);
    lines.push([esc('Doanh thu Tiền phòng (VND)'), esc(report.totalRoomRevenue)]);
    lines.push([esc('Doanh thu Dịch vụ phụ trợ (VND)'), esc(report.totalServiceRevenue)]);
    lines.push([esc('Doanh thu Phụ thu & Bồi thường (VND)'), esc(report.totalAdditionalRevenue)]);
    lines.push([esc('Tổng Giảm giá Voucher (VND)'), esc(report.totalDiscountAmount)]);
    lines.push([esc('Tổng Thuế VAT 8% (VND)'), esc(report.totalTaxAmount)]);
    lines.push([esc('TỔNG THỰC THU ĐÃ QUYẾT TOÁN (VND)'), esc(report.totalNetRevenue)]);
    lines.push([esc('Điểm đánh giá khách sạn trung bình'), esc(`${report.averageRating} / 5.0 (${report.publishedReviewsCount} đánh giá)`)]);
    lines.push([]);

    // Section 2: Occupancy by Room Type
    lines.push([esc('II. BÁO CÁO CÔNG SUẤT THEO HẠNG PHÒNG')]);
    lines.push([
      esc('Hạng phòng'),
      esc('Giá cơ bản (VND)'),
      esc('Tổng số phòng'),
      esc('Đang ở'),
      esc('Phòng trống'),
      esc('Bảo trì'),
      esc('Công suất hiện tại (%)'),
      esc('Số đêm bán trong kỳ'),
      esc('Công suất kỳ (%)'),
      esc('Điểm đánh giá TB'),
    ]);
    (report.occupancyByRoomType || []).forEach((rt) => {
      lines.push([
        esc(rt.roomTypeName),
        esc(rt.basePrice),
        esc(rt.totalRooms),
        esc(rt.occupiedRooms),
        esc(rt.vacantRooms),
        esc(rt.maintenanceRooms),
        esc(`${rt.currentOccupancyPercent}%`),
        esc(rt.nightsSoldInPeriod),
        esc(`${rt.periodOccupancyPercent}%`),
        esc(rt.averageRating ? `${rt.averageRating}/5 (${rt.reviewCount})` : 'Chưa có'),
      ]);
    });
    lines.push([]);

    // Section 3: Service Consumption Ranking
    lines.push([esc('III. BẢNG XẾP HẠNG TIÊU THỤ DỊCH VỤ PHỤ TRỢ')]);
    lines.push([
      esc('Hạng'),
      esc('Tên dịch vụ'),
      esc('Danh mục'),
      esc('Đơn vị tính'),
      esc('Đơn giá (VND)'),
      esc('Số lượt gọi'),
      esc('Tổng sản lượng'),
      esc('Tổng doanh số (VND)'),
      esc('Tỷ trọng (%)'),
    ]);
    (report.serviceConsumptionRanking || []).forEach((svc, idx) => {
      lines.push([
        esc(idx + 1),
        esc(svc.serviceName),
        esc(svc.category),
        esc(svc.billingUnit),
        esc(svc.unitPrice),
        esc(svc.ordersCount),
        esc(svc.totalQuantity),
        esc(svc.totalRevenue),
        esc(`${svc.revenueSharePercent}%`),
      ]);
    });
    lines.push([]);

    // Section 4: Invoices List
    lines.push([esc('IV. DANH SÁCH HÓA ĐƠN ĐÃ QUYẾT TOÁN TRONG KỲ')]);
    lines.push([
      esc('Mã Hóa Đơn'),
      esc('Mã Đặt Phòng'),
      esc('Khách hàng'),
      esc('Phòng'),
      esc('Hạng phòng'),
      esc('Tiền phòng (VND)'),
      esc('Dịch vụ (VND)'),
      esc('Phụ thu (VND)'),
      esc('Giảm giá Voucher (VND)'),
      esc('Thuế VAT 8% (VND)'),
      esc('Tổng thực thu (VND)'),
      esc('Phương thức TT'),
      esc('Ngày phát hành'),
    ]);
    (report.invoices || []).forEach((inv) => {
      lines.push([
        esc(inv.invoiceCode),
        esc(inv.reservationCode),
        esc(inv.customerName),
        esc(inv.roomNumber),
        esc(inv.roomTypeName),
        esc(inv.roomSubtotal),
        esc(inv.serviceSubtotal),
        esc(inv.additionalSubtotal),
        esc(inv.discountAmount),
        esc(inv.taxAmount),
        esc(inv.finalAmount),
        esc(inv.paymentMethod),
        esc(formatDateTime(inv.issueDate)),
      ]);
    });

    const csvContent = '\uFEFF' + lines.map((r) => r.join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bao_Cao_Quan_Tri_HMS_${report.fromDate}_den_${report.toDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotice('success', 'Đã xuất file báo cáo tổng hợp Excel (.csv) thành công!');
  };

  // UC-43: Submit Management Reply
  const handleSaveReply = async (e) => {
    e.preventDefault();
    if (!replyModalReview) return;
    if (!replyText.trim()) {
      showNotice('error', 'Vui lòng nhập nội dung phản hồi của khách sạn.');
      return;
    }
    setReplySaving(true);
    try {
      await billingApi.replyToReview(replyModalReview.reviewId, replyText.trim());
      showNotice(
        'success',
        `Đã đăng phản hồi chính thức cho đánh giá #${replyModalReview.reviewId} thành công!`
      );
      setReplyModalReview(null);
      setReplyText('');
      fetchDashboardData(fromDate, toDate);
    } catch (err) {
      showNotice('error', err?.response?.data?.message || 'Không thể lưu phản hồi.');
    } finally {
      setReplySaving(false);
    }
  };

  // UC-44: Hide or Restore Review Visibility
  const handleSaveModeration = async (e) => {
    e.preventDefault();
    if (!moderateModalReview) return;
    const targetHide = !moderateModalReview.isHidden;
    if (targetHide && !hiddenReasonText.trim()) {
      showNotice('error', 'Bắt buộc nhập lý do ẩn đánh giá để lưu vết kiểm duyệt.');
      return;
    }
    setModerateSaving(true);
    try {
      await billingApi.moderateReviewVisibility(
        moderateModalReview.reviewId,
        targetHide,
        targetHide ? hiddenReasonText.trim() : ''
      );
      showNotice(
        'success',
        targetHide
          ? `Đã ẩn đánh giá #${moderateModalReview.reviewId} khỏi trang công khai.`
          : `Đã khôi phục hiển thị công khai cho đánh giá #${moderateModalReview.reviewId}.`
      );
      setModerateModalReview(null);
      setHiddenReasonText('');
      fetchDashboardData(fromDate, toDate);
    } catch (err) {
      showNotice('error', err?.response?.data?.message || 'Không thể cập nhật trạng thái hiển thị.');
    } finally {
      setModerateSaving(false);
    }
  };

  // Filtered reviews for Tab 4
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (revStarFilter !== 'ALL' && Number(r.rating) !== Number(revStarFilter)) return false;
      if (revStatusFilter === 'VISIBLE' && r.isHidden) return false;
      if (revStatusFilter === 'HIDDEN' && !r.isHidden) return false;
      if (revStatusFilter === 'UNREPLIED' && r.managementReply) return false;
      if (revRoomTypeFilter !== 'ALL' && r.roomTypeName !== revRoomTypeFilter) return false;
      if (revSearch.trim()) {
        const q = revSearch.trim().toLowerCase();
        const hay = `${r.customerName || ''} ${r.roomNumber || ''} ${r.roomTypeName || ''} ${r.reservationCode || ''} ${r.comment || ''} ${r.managementReply || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reviews, revStarFilter, revStatusFilter, revRoomTypeFilter, revSearch]);

  const distinctReviewRoomTypes = useMemo(() => {
    const set = new Set();
    reviews.forEach((r) => {
      if (r.roomTypeName) set.add(r.roomTypeName);
    });
    return Array.from(set);
  }, [reviews]);

  // Filtered services for Tab 3
  const filteredServices = useMemo(() => {
    const list = report?.serviceConsumptionRanking || [];
    if (svcCategoryFilter === 'ALL') return list;
    return list.filter((s) => (s.category || '').toUpperCase() === svcCategoryFilter);
  }, [report, svcCategoryFilter]);

  // Paginated Invoices (Tab 1)
  const invoicesList = report?.invoices || [];
  const totalInvPages = Math.max(1, Math.ceil(invoicesList.length / invPageSize));
  const paginatedInvoices = useMemo(() => {
    const start = (invPage - 1) * invPageSize;
    return invoicesList.slice(start, start + invPageSize);
  }, [invoicesList, invPage, invPageSize]);

  // Paginated Occupancy by Room Type (Tab 2)
  const occupancyList = report?.occupancyByRoomType || [];
  const totalOccPages = Math.max(1, Math.ceil(occupancyList.length / occPageSize));
  const paginatedOccupancy = useMemo(() => {
    const start = (occPage - 1) * occPageSize;
    return occupancyList.slice(start, start + occPageSize);
  }, [occupancyList, occPage, occPageSize]);

  // Paginated Services Ranking (Tab 3)
  const totalSvcPages = Math.max(1, Math.ceil(filteredServices.length / svcPageSize));
  const paginatedServices = useMemo(() => {
    const start = (svcPage - 1) * svcPageSize;
    return filteredServices.slice(start, start + svcPageSize);
  }, [filteredServices, svcPage, svcPageSize]);

  // Paginated Reviews Moderation (Tab 4)
  const totalRevPages = Math.max(1, Math.ceil(filteredReviews.length / revPageSize));
  const paginatedReviews = useMemo(() => {
    const start = (revPage - 1) * revPageSize;
    return filteredReviews.slice(start, start + revPageSize);
  }, [filteredReviews, revPage, revPageSize]);

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto', paddingBottom: 48 }}>
      {/* HEADER & ACTION TOOLBAR */}
      <div
        style={{
          background: 'linear-gradient(135deg, #141413 0%, #252422 100%)',
          borderRadius: 16,
          padding: '24px 28px',
          color: '#FAF9F5',
          marginBottom: 22,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          border: '1px solid rgba(212, 168, 73, 0.25)',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-block',
              background: 'rgba(212, 168, 73, 0.18)',
              color: '#F3D27A',
              padding: '4px 12px',
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            {roleHeaderMeta.badge}
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: '#FAF9F5' }}>
            {roleHeaderMeta.title}
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: '#D5D2C6' }}>
            {roleHeaderMeta.subtitle}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {canExportSummary && (
            <button
              type="button"
              onClick={handleExportExcelCsv}
              disabled={!report}
              style={{
                background: '#10B981',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 16px',
                borderRadius: 10,
                fontSize: 13.5,
                fontWeight: 700,
                cursor: report ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              ⬇ Xuất Excel (.CSV)
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              background: '#C96442',
              color: '#FAF9F5',
              border: 'none',
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            🖨 In Trang Hiện Tại
          </button>
        </div>
      </div>

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 10,
            marginBottom: 18,
            background: toast.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${toast.type === 'success' ? '#10B981' : '#EF4444'}`,
            color: toast.type === 'success' ? '#065F46' : '#991B1B',
            fontWeight: 600,
            fontSize: 13.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      {/* PERIOD FILTER BAR */}
      {showDateFilterBar && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Kỳ báo cáo:</span>
            {[
              { id: 'TODAY', label: 'Hôm nay' },
              { id: '7D', label: '7 ngày qua' },
              { id: '30D', label: '30 ngày qua' },
              { id: 'THIS_MONTH', label: 'Tháng này' },
              { id: 'THIS_YEAR', label: 'Năm nay' },
              { id: 'ALL', label: 'Toàn thời gian' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleApplyPreset(p.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 600,
                  border: periodPreset === p.id ? '1px solid #141413' : '1px solid #CBD5E1',
                  background: periodPreset === p.id ? '#141413' : '#F8FAFC',
                  color: periodPreset === p.id ? '#FAF9F5' : '#334155',
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={handleCustomDateFilter}
            style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
          >
            <span style={{ fontSize: 12.5, color: '#64748B' }}>Từ:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 13,
              }}
            />
            <span style={{ fontSize: 12.5, color: '#64748B' }}>Đến:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 13,
              }}
            />
            <button
              type="submit"
              style={{
                background: '#C96442',
                color: '#FFFFFF',
                border: 'none',
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Lọc dữ liệu
            </button>
          </form>
        </div>
      )}

      {/* TOP KPI SUMMARY CARDS */}
      {report && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
            marginBottom: 22,
          }}
        >
          {canViewRevenue && (
            <div
              style={{
                background: '#FFFFFF',
                padding: '18px 20px',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                borderLeft: '4px solid #16A34A',
              }}
            >
              <div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 600 }}>
                DOANH THU THỰC THU TRONG KỲ
              </div>
              <div style={{ fontSize: 23, fontWeight: 800, color: '#15803D', marginTop: 6 }}>
                {formatVND(report.totalNetRevenue)}
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                {report.paidInvoicesCount} hóa đơn đã quyết toán • VAT 8%: {formatVND(report.totalTaxAmount)}
              </div>
            </div>
          )}

          {canViewOccupancy && (
            <div
              style={{
                background: '#FFFFFF',
                padding: '18px 20px',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                borderLeft: '4px solid #2563EB',
              }}
            >
              <div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 600 }}>
                CÔNG SUẤT KHAI THÁC PHÒNG
              </div>
              <div style={{ fontSize: 23, fontWeight: 800, color: '#1D4ED8', marginTop: 6 }}>
                {report.currentOccupancyRate}%{' '}
                <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>
                  ({report.occupiedRooms}/{report.totalRooms} phòng)
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                Đã bán {report.periodRoomNightsSold} đêm phòng trong kỳ ({report.periodOccupancyRate}%)
              </div>
            </div>
          )}

          {canViewServices && (
            <div
              style={{
                background: '#FFFFFF',
                padding: '18px 20px',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                borderLeft: '4px solid #D97706',
              }}
            >
              <div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 600 }}>
                TIÊU THỤ DỊCH VỤ PHỤ TRỢ
              </div>
              <div style={{ fontSize: 23, fontWeight: 800, color: '#B45309', marginTop: 6 }}>
                {report.totalServiceUnitsSold} đơn vị
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                {report.completedServiceOrdersCount} đơn hoàn thành • {report.activeServicesCount} dịch vụ mở bán
              </div>
            </div>
          )}

          {canViewReviews && (
            <div
              style={{
                background: '#FFFFFF',
                padding: '18px 20px',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                borderLeft: '4px solid #9333EA',
              }}
            >
              <div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 600 }}>
                ĐÁNH GIÁ CHẤT LƯỢNG LƯU TRÚ
              </div>
              <div style={{ fontSize: 23, fontWeight: 800, color: '#7E22CE', marginTop: 6 }}>
                ★ {report.averageRating} / 5.0
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                {report.publishedReviewsCount} hiển thị • {report.hiddenReviewsCount} đã ẩn •{' '}
                {report.repliedReviewsCount} đã phản hồi
              </div>
            </div>
          )}
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '2px solid #E2E8F0',
          marginBottom: 22,
          flexWrap: 'wrap',
        }}
      >
        {canViewRevenue && (
          <button
            type="button"
            onClick={() => setActiveTab('REVENUE')}
            style={{
              padding: '11px 18px',
              border: 'none',
              borderBottom: activeTab === 'REVENUE' ? '3px solid #C96442' : '3px solid transparent',
              background: activeTab === 'REVENUE' ? '#FFFBEB' : 'transparent',
              color: activeTab === 'REVENUE' ? '#141413' : '#64748B',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
            }}
          >
            Doanh Thu &amp; Đối Soát Hóa Đơn
          </button>
        )}
        {canViewOccupancy && (
          <button
            type="button"
            onClick={() => setActiveTab('OCCUPANCY')}
            style={{
              padding: '11px 18px',
              border: 'none',
              borderBottom: activeTab === 'OCCUPANCY' ? '3px solid #C96442' : '3px solid transparent',
              background: activeTab === 'OCCUPANCY' ? '#FFFBEB' : 'transparent',
              color: activeTab === 'OCCUPANCY' ? '#141413' : '#64748B',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
            }}
          >
            Công Suất Khai Thác Phòng
          </button>
        )}
        {canViewServices && (
          <button
            type="button"
            onClick={() => setActiveTab('SERVICES')}
            style={{
              padding: '11px 18px',
              border: 'none',
              borderBottom: activeTab === 'SERVICES' ? '3px solid #C96442' : '3px solid transparent',
              background: activeTab === 'SERVICES' ? '#FFFBEB' : 'transparent',
              color: activeTab === 'SERVICES' ? '#141413' : '#64748B',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
            }}
          >
            Phân Tích Tiêu Thụ Dịch Vụ
          </button>
        )}
        {canViewReviews && (
          <button
            type="button"
            onClick={() => setActiveTab('REVIEWS')}
            style={{
              padding: '11px 18px',
              border: 'none',
              borderBottom: activeTab === 'REVIEWS' ? '3px solid #C96442' : '3px solid transparent',
              background: activeTab === 'REVIEWS' ? '#FFFBEB' : 'transparent',
              color: activeTab === 'REVIEWS' ? '#141413' : '#64748B',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
            }}
          >
            Đánh Giá &amp; Phản Hồi Khách Hàng
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#64748B' }}>
          Đang tổng hợp dữ liệu phân tích...
        </div>
      ) : (
        <>
          {/* =============================================================== */}
          {/* TAB 1: REVENUE ANALYTICS & INVOICE BREAKDOWN                    */}
          {/* =============================================================== */}
          {activeTab === 'REVENUE' && report && canViewRevenue && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {/* Revenue Structure Breakdown */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                  gap: 18,
                }}
              >
                {/* Left Card: Revenue Source Breakdown */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 14,
                    border: '1px solid #E2E8F0',
                    padding: 22,
                  }}
                >
                  <h3 style={{ margin: '0 0 14px', fontSize: 16.5, fontWeight: 700, color: '#1E293B' }}>
                    Cơ Cấu Nguồn Thu Đã Quyết Toán
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      {
                        label: 'Doanh thu Tiền phòng (Room Charges)',
                        value: report.totalRoomRevenue,
                        color: '#2563EB',
                      },
                      {
                        label: 'Doanh thu Dịch vụ phụ trợ (Ancillary Services)',
                        value: report.totalServiceRevenue,
                        color: '#D97706',
                      },
                      {
                        label: 'Phụ thu & Bồi thường (Additional Charges)',
                        value: report.totalAdditionalRevenue,
                        color: '#7C3AED',
                      },
                      {
                        label: 'Thuế GTGT (VAT 8%)',
                        value: report.totalTaxAmount,
                        color: '#0891B2',
                      },
                      {
                        label: 'Khấu trừ Voucher Khuyến mãi (-)',
                        value: report.totalDiscountAmount,
                        color: '#DC2626',
                        isNegative: true,
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: '#F8FAFC',
                          borderRadius: 8,
                          borderLeft: `4px solid ${row.color}`,
                        }}
                      >
                        <span style={{ fontSize: 13.5, color: '#334155', fontWeight: 500 }}>
                          {row.label}
                        </span>
                        <strong
                          style={{
                            fontSize: 14.5,
                            color: row.isNegative ? '#DC2626' : '#0F172A',
                          }}
                        >
                          {row.isNegative ? '- ' : ''}
                          {formatVND(row.value)}
                        </strong>
                      </div>
                    ))}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 16px',
                        background: '#ECFDF5',
                        borderRadius: 10,
                        border: '1px solid #10B981',
                        marginTop: 4,
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 14.5, color: '#065F46', display: 'block' }}>
                          TỔNG THỰC THU (ĐÃ GỒM CỌC &amp; QUYẾT TOÁN)
                        </strong>
                        <span style={{ fontSize: 12, color: '#047857' }}>
                          Trong đó tiền cọc đã thu: {formatVND(report.totalDepositCollected)}
                        </span>
                      </div>
                      <strong style={{ fontSize: 20, color: '#047857' }}>
                        {formatVND(report.totalNetRevenue)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Right Card: Payment Method Breakdown */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 14,
                    border: '1px solid #E2E8F0',
                    padding: 22,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 14px', fontSize: 16.5, fontWeight: 700, color: '#1E293B' }}>
                      Tỷ Trọng Theo Phương Thức Thanh Toán
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {(report.revenueByPaymentMethod || []).map((pm) => (
                        <div key={pm.paymentMethod}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: 13.5,
                              marginBottom: 5,
                            }}
                          >
                            <span style={{ fontWeight: 600, color: '#1E293B' }}>
                              {pm.label}{' '}
                              <span style={{ color: '#64748B', fontWeight: 400 }}>
                                ({pm.transactionCount} hóa đơn)
                              </span>
                            </span>
                            <strong style={{ color: '#0F172A' }}>
                              {formatVND(pm.totalAmount)} ({pm.sharePercent}%)
                            </strong>
                          </div>
                          <div
                            style={{
                              height: 9,
                              background: '#F1F5F9',
                              borderRadius: 999,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, pm.sharePercent || 0)}%`,
                                height: '100%',
                                background:
                                  pm.paymentMethod === 'VNPAY'
                                    ? '#2563EB'
                                    : pm.paymentMethod === 'CASH'
                                    ? '#16A34A'
                                    : pm.paymentMethod === 'BANK_TRANSFER'
                                    ? '#D97706'
                                    : '#7C3AED',
                                borderRadius: 999,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Outstanding Open Folios Warning */}
                  <div
                    style={{
                      marginTop: 18,
                      padding: '12px 16px',
                      background: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      borderRadius: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>
                        Công nợ Folio đang mở (Khách đang lưu trú): {report.openFoliosCount} Folio
                      </div>
                      <div style={{ fontSize: 12, color: '#B45309' }}>
                        Dư nợ tạm tính cần thu khi khách quyết toán (đã gồm 8% VAT &amp; trừ cọc)
                      </div>
                    </div>
                    <strong style={{ fontSize: 16, color: '#B45309' }}>
                      {formatVND(report.outstandingFolioBalance)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Settled Invoices Table */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: 14,
                  border: '1px solid #E2E8F0',
                  padding: 22,
                }}
              >
                <h3 style={{ margin: '0 0 14px', fontSize: 16.5, fontWeight: 700, color: '#1E293B' }}>
                  Danh Sách Hóa Đơn VAT Đã Quyết Toán Trong Kỳ ({(report.invoices || []).length})
                </h3>
                {(report.invoices || []).length === 0 ? (
                  <div style={{ padding: 28, textAlign: 'center', color: '#64748B' }}>
                    Không có hóa đơn quyết toán nào trong khoảng thời gian đã chọn.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 13.2,
                      }}
                    >
                      <thead>
                        <tr style={{ background: '#F8FAFC', textAlign: 'left', color: '#475569' }}>
                          <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                            Mã HĐ
                          </th>
                          <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                            Khách hàng &amp; Phòng
                          </th>
                          <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                            Tiền phòng
                          </th>
                          <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                            Dịch vụ &amp; Phụ thu
                          </th>
                          <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                            Giảm giá
                          </th>
                          <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                            VAT 8%
                          </th>
                          <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                            Tổng thực thu
                          </th>
                          <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                            Phương thức
                          </th>
                          <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                            Ngày quyết toán
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedInvoices.map((inv) => (
                          <tr key={inv.invoiceId} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0F172A' }}>
                              {inv.invoiceCode}
                              <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 400 }}>
                                Đơn: {inv.reservationCode}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <strong style={{ color: '#1E293B' }}>{inv.customerName}</strong>
                              <div style={{ fontSize: 12, color: '#64748B' }}>
                                Phòng {inv.roomNumber} • {inv.roomTypeName}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>{formatVND(inv.roomSubtotal)}</td>
                            <td style={{ padding: '10px 12px' }}>
                              {formatVND(
                                Number(inv.serviceSubtotal || 0) + Number(inv.additionalSubtotal || 0)
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#DC2626' }}>
                              {Number(inv.discountAmount) > 0
                                ? `-${formatVND(inv.discountAmount)}`
                                : '0 ₫'}
                              {inv.voucherCode && (
                                <div style={{ fontSize: 11, color: '#991B1B' }}>
                                  ({inv.voucherCode})
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px' }}>{formatVND(inv.taxAmount)}</td>
                            <td
                              style={{
                                padding: '10px 12px',
                                fontWeight: 700,
                                color: '#15803D',
                              }}
                            >
                              {formatVND(inv.finalAmount)}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  background:
                                    inv.paymentMethod === 'VNPAY' ? '#EFF6FF' : '#F0FDF4',
                                  color: inv.paymentMethod === 'VNPAY' ? '#1D4ED8' : '#15803D',
                                }}
                              >
                                {inv.paymentMethod}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748B', fontSize: 12.5 }}>
                              {formatDateTime(inv.issueDate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {invoicesList.length > 0 && (
                  <PaginationControl
                    currentPage={invPage}
                    totalPages={totalInvPages}
                    totalItems={invoicesList.length}
                    pageSize={invPageSize}
                    onPageChange={setInvPage}
                    onPageSizeChange={setInvPageSize}
                    itemLabel="hóa đơn"
                    pageSizeOptions={[5, 10, 20]}
                    activeColor="#1E293B"
                  />
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 2: ROOM OCCUPANCY ANALYTICS (UC-45)                         */}
          {/* =============================================================== */}
          {activeTab === 'OCCUPANCY' && report && canViewOccupancy && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: 14,
                  border: '1px solid #E2E8F0',
                  padding: 22,
                }}
              >
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
                    <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#1E293B' }}>
                      Báo Cáo Công Suất Lấp Đầy Theo Từng Hạng Phòng
                    </h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
                      So sánh tình trạng lấp đầy tức thời và tổng số đêm phòng khai thác trong kỳ ({report.fromDate} → {report.toDate}).
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 13 }}>
                    <span>
                      🟢 Đang có khách: <strong>{report.occupiedRooms}</strong>
                    </span>
                    <span>
                      ⚪ Phòng trống: <strong>{report.vacantRooms}</strong>
                    </span>
                    <span>
                      🟠 Bảo trì: <strong>{report.maintenanceRooms}</strong>
                    </span>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '11px 12px', borderBottom: '1px solid #E2E8F0' }}>
                          Hạng phòng (Room Category)
                        </th>
                        <th style={{ padding: '11px 12px', borderBottom: '1px solid #E2E8F0' }}>
                          Giá niêm yết
                        </th>
                        <th style={{ padding: '11px 12px', borderBottom: '1px solid #E2E8F0' }}>
                          Tổng phòng
                        </th>
                        <th style={{ padding: '11px 12px', borderBottom: '1px solid #E2E8F0' }}>
                          Đang ở / Trống / Bảo trì
                        </th>
                        <th style={{ padding: '11px 12px', borderBottom: '1px solid #E2E8F0' }}>
                          Công suất hiện tại
                        </th>
                        <th style={{ padding: '11px 12px', borderBottom: '1px solid #E2E8F0' }}>
                          Số đêm đã bán trong kỳ
                        </th>
                        <th style={{ padding: '11px 12px', borderBottom: '1px solid #E2E8F0' }}>
                          Doanh thu phòng ước tính
                        </th>
                        <th style={{ padding: '11px 12px', borderBottom: '1px solid #E2E8F0' }}>
                          Điểm đánh giá
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOccupancy.map((rt) => (
                        <tr key={rt.roomTypeId} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px', fontWeight: 700, color: '#0F172A' }}>
                            {rt.roomTypeName}
                            <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 400 }}>
                              Sức chứa tối đa: {rt.capacity} khách
                            </div>
                          </td>
                          <td style={{ padding: '12px' }}>{formatVND(rt.basePrice)}</td>
                          <td style={{ padding: '12px', fontWeight: 700 }}>{rt.totalRooms} phòng</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ color: '#16A34A', fontWeight: 700 }}>
                              {rt.occupiedRooms} đang ở
                            </span>{' '}
                            / <span>{rt.vacantRooms} trống</span> /{' '}
                            <span style={{ color: '#D97706' }}>{rt.maintenanceRooms} bảo trì</span>
                          </td>
                          <td style={{ padding: '12px', minWidth: 160 }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: 12.5,
                                fontWeight: 700,
                                marginBottom: 4,
                              }}
                            >
                              <span>{rt.currentOccupancyPercent}%</span>
                            </div>
                            <div
                              style={{
                                height: 8,
                                background: '#E2E8F0',
                                borderRadius: 999,
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(100, rt.currentOccupancyPercent || 0)}%`,
                                  height: '100%',
                                  background: '#2563EB',
                                  borderRadius: 999,
                                }}
                              />
                            </div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <strong>{rt.nightsSoldInPeriod} đêm</strong>
                            <div style={{ fontSize: 11.5, color: '#64748B' }}>
                              ({rt.periodOccupancyPercent}% công suất kỳ)
                            </div>
                          </td>
                          <td style={{ padding: '12px', fontWeight: 700, color: '#15803D' }}>
                            {formatVND(rt.estimatedRoomRevenue)}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {rt.averageRating ? (
                              <span
                                style={{
                                  background: '#FEF3C7',
                                  color: '#B45309',
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  fontWeight: 700,
                                  fontSize: 12.5,
                                }}
                              >
                                ★ {rt.averageRating} ({rt.reviewCount})
                              </span>
                            ) : (
                              <span style={{ color: '#94A3B8', fontSize: 12 }}>Chưa có</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {occupancyList.length > 5 && (
                  <PaginationControl
                    currentPage={occPage}
                    totalPages={totalOccPages}
                    totalItems={occupancyList.length}
                    pageSize={occPageSize}
                    onPageChange={setOccPage}
                    onPageSizeChange={setOccPageSize}
                    itemLabel="hạng phòng"
                    pageSizeOptions={[5, 10]}
                    activeColor="#2563EB"
                  />
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 3: SERVICE CONSUMPTION ANALYTICS (UC-47)                    */}
          {/* =============================================================== */}
          {activeTab === 'SERVICES' && report && canViewServices && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Category Breakdown Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                  gap: 14,
                }}
              >
                {(report.serviceByCategory || []).map((cat) => {
                  const isSelected = svcCategoryFilter === cat.category;
                  return (
                    <div
                      key={cat.category}
                      onClick={() => setSvcCategoryFilter(isSelected ? 'ALL' : cat.category)}
                      style={{
                        background: isSelected ? '#FFFBEB' : '#FFFFFF',
                        border: isSelected ? '2px solid #D97706' : '1px solid #E2E8F0',
                        borderRadius: 12,
                        padding: '16px 18px',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 6,
                        }}
                      >
                        <strong style={{ fontSize: 14, color: '#0F172A' }}>{cat.label}</strong>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            background: '#F1F5F9',
                            padding: '2px 8px',
                            borderRadius: 999,
                          }}
                        >
                          {cat.sharePercent}%
                        </span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#B45309' }}>
                        {formatVND(cat.totalRevenue)}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                        {cat.totalQuantity} đơn vị • {cat.ordersCount} lượt gọi hoàn tất
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Service Ranking Table */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: 14,
                  border: '1px solid #E2E8F0',
                  padding: 22,
                }}
              >
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
                    <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#1E293B' }}>
                      Bảng Xếp Hạng Tiêu Thụ Dịch Vụ Phụ Trợ
                    </h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
                      Xếp hạng theo tổng doanh số &amp; sản lượng tiêu thụ từ các đơn dịch vụ đã hoàn tất (COMPLETED).
                    </p>
                  </div>

                  {svcCategoryFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSvcCategoryFilter('ALL')}
                      style={{
                        background: '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ✕ Bỏ lọc danh mục ({svcCategoryFilter})
                    </button>
                  )}
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                          Hạng
                        </th>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                          Tên dịch vụ
                        </th>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                          Nhóm danh mục
                        </th>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                          Đơn giá niêm yết
                        </th>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                          Số đơn hoàn thành
                        </th>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                          Tổng sản lượng
                        </th>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                          Tổng doanh số
                        </th>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
                          Tỷ trọng doanh thu
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedServices.map((svc, idx) => (
                        <tr key={svc.serviceId} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '11px 12px', fontWeight: 800, color: '#64748B' }}>
                            #{(svcPage - 1) * svcPageSize + idx + 1}
                          </td>
                          <td style={{ padding: '11px 12px', fontWeight: 700, color: '#0F172A' }}>
                            {svc.serviceName}
                          </td>
                          <td style={{ padding: '11px 12px' }}>
                            <span
                              style={{
                                background: '#F1F5F9',
                                color: '#334155',
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {svc.category}
                            </span>
                          </td>
                          <td style={{ padding: '11px 12px' }}>
                            {formatVND(svc.unitPrice)} / {svc.billingUnit}
                          </td>
                          <td style={{ padding: '11px 12px' }}>{svc.ordersCount} đơn</td>
                          <td style={{ padding: '11px 12px', fontWeight: 700 }}>
                            {svc.totalQuantity} {svc.billingUnit}
                          </td>
                          <td style={{ padding: '11px 12px', fontWeight: 700, color: '#15803D' }}>
                            {formatVND(svc.totalRevenue)}
                          </td>
                          <td style={{ padding: '11px 12px', minWidth: 140 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: 12.5,
                              }}
                            >
                              <div
                                style={{
                                  flex: 1,
                                  height: 7,
                                  background: '#E2E8F0',
                                  borderRadius: 999,
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.min(100, svc.revenueSharePercent || 0)}%`,
                                    height: '100%',
                                    background: '#D97706',
                                    borderRadius: 999,
                                  }}
                                />
                              </div>
                              <span style={{ fontWeight: 700 }}>{svc.revenueSharePercent}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredServices.length > 0 && (
                  <PaginationControl
                    currentPage={svcPage}
                    totalPages={totalSvcPages}
                    totalItems={filteredServices.length}
                    pageSize={svcPageSize}
                    onPageChange={setSvcPage}
                    onPageSizeChange={setSvcPageSize}
                    itemLabel="dịch vụ"
                    pageSizeOptions={[5, 10, 20]}
                    activeColor="#D97706"
                  />
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 4: HOTEL & ROOM REVIEW MODERATION (UC-42, UC-43, UC-44)     */}
          {/* =============================================================== */}
          {activeTab === 'REVIEWS' && canViewReviews && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Review Moderation Filter Bar */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: 12,
                  border: '1px solid #E2E8F0',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    value={revStatusFilter}
                    onChange={(e) => setRevStatusFilter(e.target.value)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                    }}
                  >
                    <option value="ALL">Tất cả trạng thái ({reviews.length})</option>
                    <option value="VISIBLE">Đang hiển thị công khai</option>
                    <option value="HIDDEN">Đã ẩn (Vi phạm / Kiểm duyệt)</option>
                    <option value="UNREPLIED">Chưa phản hồi</option>
                  </select>

                  <select
                    value={revRoomTypeFilter}
                    onChange={(e) => setRevRoomTypeFilter(e.target.value)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                    }}
                  >
                    <option value="ALL">Tất cả hạng phòng</option>
                    {distinctReviewRoomTypes.map((rt) => (
                      <option key={rt} value={rt}>
                        {rt}
                      </option>
                    ))}
                  </select>

                  <select
                    value={revStarFilter}
                    onChange={(e) => setRevStarFilter(e.target.value)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                    }}
                  >
                    <option value="ALL">Tất cả mức sao</option>
                    {[5, 4, 3, 2, 1].map((s) => (
                      <option key={s} value={s}>
                        {s} sao ({'★'.repeat(s)})
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="text"
                  value={revSearch}
                  onChange={(e) => setRevSearch(e.target.value)}
                  placeholder="Tìm tên khách, số phòng, mã đặt phòng, nội dung..."
                  style={{
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    minWidth: 270,
                  }}
                />
              </div>

              {/* Reviews Moderation Cards */}
              {filteredReviews.length === 0 ? (
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 12,
                    border: '1px solid #E2E8F0',
                    padding: 40,
                    textAlign: 'center',
                    color: '#64748B',
                  }}
                >
                  Không có đánh giá nào khớp với bộ lọc kiểm duyệt hiện tại.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {paginatedReviews.map((rev) => (
                    <div
                      key={rev.reviewId}
                      style={{
                        background: rev.isHidden ? '#FFF1F2' : '#FFFFFF',
                        border: rev.isHidden ? '1px solid #FECDD3' : '1px solid #E2E8F0',
                        borderRadius: 14,
                        padding: '18px 22px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                          gap: 12,
                          marginBottom: 10,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 15.5, color: '#0F172A' }}>
                              #{rev.reviewId} • {rev.customerName}
                            </strong>
                            <span
                              style={{
                                background: '#F1F5F9',
                                color: '#334155',
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              Phòng {rev.roomNumber || 'N/A'} ({rev.roomTypeName})
                            </span>
                            {rev.reservationCode && (
                              <span style={{ fontSize: 12, color: '#64748B' }}>
                                Mã đơn: <strong>{rev.reservationCode}</strong>
                              </span>
                            )}
                            <span
                              style={{
                                padding: '2px 9px',
                                borderRadius: 999,
                                fontSize: 11.5,
                                fontWeight: 700,
                                background: rev.isHidden ? '#FEE2E2' : '#DCFCE7',
                                color: rev.isHidden ? '#991B1B' : '#166534',
                              }}
                            >
                              {rev.isHidden ? '🚫 Đã ẩn khỏi công khai' : '✓ Đang hiển thị công khai'}
                            </span>
                          </div>
                          <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
                            Gửi lúc: {formatDateTime(rev.reviewDate)}
                            {rev.checkInDate && rev.checkOutDate
                              ? ` • Kỳ lưu trú: ${formatDate(rev.checkInDate)} → ${formatDate(rev.checkOutDate)}`
                              : ''}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              fontSize: 16,
                              fontWeight: 800,
                              color: '#F59E0B',
                              background: '#FFFBEB',
                              padding: '4px 10px',
                              borderRadius: 8,
                              border: '1px solid #FDE68A',
                            }}
                          >
                            {'★'.repeat(rev.rating || 5)} ({rev.rating}/5)
                          </span>

                          {canReplyReview && (
                            <button
                              type="button"
                              onClick={() => {
                                setReplyModalReview(rev);
                                setReplyText(rev.managementReply || '');
                              }}
                              style={{
                                background: '#2563EB',
                                color: '#FFFFFF',
                                border: 'none',
                                padding: '7px 13px',
                                borderRadius: 8,
                                fontSize: 12.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {rev.managementReply ? '✎ Sửa phản hồi' : '💬 Phản hồi'}
                            </button>
                          )}

                          {canModerateReview && (
                            <button
                              type="button"
                              onClick={() => {
                                setModerateModalReview(rev);
                                setHiddenReasonText(rev.hiddenReason || '');
                              }}
                              style={{
                                background: rev.isHidden ? '#16A34A' : '#DC2626',
                                color: '#FFFFFF',
                                border: 'none',
                                padding: '7px 13px',
                                borderRadius: 8,
                                fontSize: 12.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {rev.isHidden ? '👁 Khôi phục hiển thị' : '🚫 Ẩn đánh giá'}
                            </button>
                          )}
                        </div>
                      </div>

                      <p
                        style={{
                          margin: '0 0 8px',
                          fontSize: 14,
                          color: '#1E293B',
                          lineHeight: 1.6,
                        }}
                      >
                        {rev.comment}
                      </p>

                      {rev.isHidden && rev.hiddenReason && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: '8px 12px',
                            background: '#FEE2E2',
                            borderRadius: 8,
                            fontSize: 12.5,
                            color: '#991B1B',
                          }}
                        >
                          <strong>Lý do ẩn kiểm duyệt:</strong> {rev.hiddenReason}
                        </div>
                      )}

                      {rev.managementReply && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: '10px 14px',
                            background: '#F8FAFC',
                            borderLeft: '4px solid #2563EB',
                            borderRadius: 8,
                            fontSize: 13,
                          }}
                        >
                          <div style={{ fontWeight: 700, color: '#1E3A8A', marginBottom: 2 }}>
                            Phản hồi chính thức từ Ban Quản lý Khách sạn (
                            {formatDateTime(rev.repliedAt)}):
                          </div>
                          <div style={{ color: '#334155' }}>{rev.managementReply}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {filteredReviews.length > 0 && (
                <PaginationControl
                  currentPage={revPage}
                  totalPages={totalRevPages}
                  totalItems={filteredReviews.length}
                  pageSize={revPageSize}
                  onPageChange={setRevPage}
                  onPageSizeChange={setRevPageSize}
                  itemLabel="đánh giá"
                  pageSizeOptions={[5, 10, 20]}
                  activeColor="#C96442"
                />
              )}
            </div>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* MODAL UC-43: PUBLISH / EDIT OFFICIAL MANAGEMENT REPLY             */}
      {/* ================================================================= */}
      {replyModalReview && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: 16,
          }}
        >
          <form
            onSubmit={handleSaveReply}
            style={{
              background: '#FFFFFF',
              borderRadius: 14,
              maxWidth: 560,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
              Phản Hồi Đánh Giá Của Khách Lưu Trú
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748B' }}>
              Khách hàng: <strong>{replyModalReview.customerName}</strong> • Phòng{' '}
              <strong>{replyModalReview.roomNumber}</strong> ({replyModalReview.roomTypeName}) •{' '}
              <span style={{ color: '#F59E0B', fontWeight: 700 }}>
                {'★'.repeat(replyModalReview.rating || 5)}
              </span>
            </p>
            <div
              style={{
                background: '#F8FAFC',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13.5,
                color: '#334155',
                marginBottom: 14,
                border: '1px solid #E2E8F0',
              }}
            >
              “{replyModalReview.comment}”
            </div>

            <label
              style={{
                display: 'block',
                fontSize: 13.5,
                fontWeight: 700,
                color: '#0F172A',
                marginBottom: 6,
              }}
            >
              Nội dung phản hồi chính thức từ Ban Quản lý Khách sạn HMS Luxury:
            </label>
            <textarea
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Cảm ơn quý khách đã lưu trú tại HMS Luxury Hotel và chia sẻ đánh giá..."
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 13.5,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                marginBottom: 16,
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setReplyModalReview(null)}
                style={{
                  background: '#F1F5F9',
                  color: '#334155',
                  border: '1px solid #CBD5E1',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={replySaving}
                style={{
                  background: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: replySaving ? 'not-allowed' : 'pointer',
                }}
              >
                {replySaving ? 'Đang lưu...' : 'Đăng Phản Hồi Chính Thức'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL UC-44: MODERATE REVIEW VISIBILITY (HIDE / RESTORE)          */}
      {/* ================================================================= */}
      {moderateModalReview && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: 16,
          }}
        >
          <form
            onSubmit={handleSaveModeration}
            style={{
              background: '#FFFFFF',
              borderRadius: 14,
              maxWidth: 520,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
              {moderateModalReview.isHidden
                ? 'Khôi Phục Hiển Thị Đánh Giá Công Khai'
                : 'Ẩn Đánh Giá Vi Phạm Tiêu Chuẩn Cộng Đồng'}
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748B' }}>
              Đánh giá #{moderateModalReview.reviewId} của khách{' '}
              <strong>{moderateModalReview.customerName}</strong> tại Phòng{' '}
              <strong>{moderateModalReview.roomNumber}</strong>.
            </p>

            {!moderateModalReview.isHidden ? (
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: '#991B1B',
                    marginBottom: 6,
                  }}
                >
                  Lý do ẩn đánh giá (Bắt buộc để lưu vết kiểm duyệt):
                </label>
                <textarea
                  rows={3}
                  value={hiddenReasonText}
                  onChange={(e) => setHiddenReasonText(e.target.value)}
                  placeholder="Ví dụ: Ngôn từ không phù hợp, quảng cáo spam, thông tin sai sự thật..."
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #FCA5A5',
                    fontSize: 13.5,
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ) : (
              <p style={{ fontSize: 13.5, color: '#334155', marginBottom: 16 }}>
                Đánh giá này sẽ được hiển thị trở lại trên trang Đánh giá Khách sạn và trang Chi tiết
                Hạng phòng, đồng thời được tính lại vào điểm sao trung bình.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setModerateModalReview(null)}
                style={{
                  background: '#F1F5F9',
                  color: '#334155',
                  border: '1px solid #CBD5E1',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={moderateSaving}
                style={{
                  background: moderateModalReview.isHidden ? '#16A34A' : '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: moderateSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {moderateSaving
                  ? 'Đang xử lý...'
                  : moderateModalReview.isHidden
                  ? 'Xác Nhận Khôi Phục'
                  : 'Xác Nhận Ẩn Đánh Giá'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
