import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { billingApi } from '../../services/billingApi';
import { PaginationControl } from '../services-billing/components/PaginationControl';

const STAR_LABELS = {
  1: 'Rất tệ — Cần cải thiện nhiều',
  2: 'Chưa hài lòng — Dưới kỳ vọng',
  3: 'Bình thường — Tạm ổn',
  4: 'Hài lòng — Kỳ nghỉ tốt đẹp',
  5: 'Tuyệt vời — Trải nghiệm hoàn hảo!',
};

const QUICK_REVIEW_TAGS = [
  'Phòng ốc sạch sẽ, nội thất sang trọng',
  'Giường ngủ êm ái, cách âm tốt',
  'Nhân viên lễ tân & buồng phòng chu đáo',
  'Không gian khách sạn yên tĩnh, thư giãn',
  'Thủ tục nhận & trả phòng nhanh gọn',
  'Đáng giá tiền, chắc chắn sẽ quay lại',
];

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

export const CustomerReviewsPage = () => {
  const { isAuthenticated, user } = useAuth();
  const isCustomer = isAuthenticated && user?.role === 'CUSTOMER';

  const [publishedReviews, setPublishedReviews] = useState([]);
  const [myStays, setMyStays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myStaysLoading, setMyStaysLoading] = useState(false);

  // Filters for UC-42
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState('ALL');
  const [selectedStar, setSelectedStar] = useState('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');

  // Pagination states
  const [stayPage, setStayPage] = useState(1);
  const [stayPageSize, setStayPageSize] = useState(3);

  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPageSize, setReviewPageSize] = useState(5);

  // Auto-reset review page when filter changes
  useEffect(() => {
    setReviewPage(1);
  }, [selectedRoomTypeId, selectedStar, searchKeyword]);

  // Review Form State for UC-41
  const [activeReviewStayId, setActiveReviewStayId] = useState(null);
  const [ratingInput, setRatingInput] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [commentInput, setCommentInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const loadPublishedReviews = async () => {
    setLoading(true);
    try {
      const res = await billingApi.getPublishedReviews();
      const list = res?.data?.data || res?.data || [];
      setPublishedReviews(Array.isArray(list) ? list : []);
    } catch {
      setPublishedReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMyStays = async () => {
    if (!isCustomer) {
      setMyStays([]);
      return;
    }
    setMyStaysLoading(true);
    try {
      const res = await billingApi.getMyStaysForReview();
      const list = res?.data?.data || res?.data || [];
      const arr = Array.isArray(list) ? list : [];

      // Sắp xếp ưu tiên:
      // 1. Kỳ lưu trú có thể đánh giá (canReview = true) lên trên cùng
      // 2. Chưa gửi đánh giá trước kỳ đã gửi
      // 3. Thời gian trả phòng / nhận phòng mới nhất trước
      const sortedStays = [...arr].sort((a, b) => {
        const canA = Boolean(a.canReview);
        const canB = Boolean(b.canReview);
        if (canA && !canB) return -1;
        if (!canA && canB) return 1;

        const revA = Boolean(a.existingReview);
        const revB = Boolean(b.existingReview);
        if (!revA && revB) return -1;
        if (revA && !revB) return 1;

        const dateA = new Date(a.actualCheckOut || a.checkOutDate || a.actualCheckIn || a.checkInDate || 0).getTime();
        const dateB = new Date(b.actualCheckOut || b.checkOutDate || b.actualCheckIn || b.checkInDate || 0).getTime();
        return dateB - dateA;
      });

      setMyStays(sortedStays);
      // Auto-select first reviewable stay if not yet selected
      const firstReviewable = sortedStays.find((s) => s.canReview);
      if (firstReviewable && !activeReviewStayId) {
        setActiveReviewStayId(firstReviewable.stayId);
      }
    } catch {
      setMyStays([]);
    } finally {
      setMyStaysLoading(false);
    }
  };

  useEffect(() => {
    loadPublishedReviews();
  }, []);

  useEffect(() => {
    loadMyStays();
  }, [isCustomer]);

  // Aggregate hotel stats & room type stats
  const stats = useMemo(() => {
    const total = publishedReviews.length;
    const sum = publishedReviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    const avg = total > 0 ? (sum / total).toFixed(1) : '0.0';

    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const byRoomTypeMap = new Map();

    publishedReviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Number(r.rating) || 5));
      dist[star] = (dist[star] || 0) + 1;

      const rtKey = r.roomTypeId || r.roomTypeName || 'DEFAULT';
      if (!byRoomTypeMap.has(rtKey)) {
        byRoomTypeMap.set(rtKey, {
          roomTypeId: r.roomTypeId,
          roomTypeName: r.roomTypeName || 'Phòng tiêu chuẩn HMS',
          roomImageUrl: r.roomImageUrl,
          count: 0,
          sumRating: 0,
        });
      }
      const rtObj = byRoomTypeMap.get(rtKey);
      rtObj.count += 1;
      rtObj.sumRating += star;
    });

    const roomTypeStats = Array.from(byRoomTypeMap.values()).map((item) => ({
      ...item,
      avgRating: item.count > 0 ? (item.sumRating / item.count).toFixed(1) : '5.0',
    }));

    return { total, avg, dist, roomTypeStats };
  }, [publishedReviews]);

  const filteredReviews = useMemo(() => {
    return publishedReviews.filter((r) => {
      if (selectedRoomTypeId !== 'ALL') {
        const matchId = String(r.roomTypeId) === String(selectedRoomTypeId);
        const matchName = r.roomTypeName === selectedRoomTypeId;
        if (!matchId && !matchName) return false;
      }
      if (selectedStar !== 'ALL' && Number(r.rating) !== Number(selectedStar)) {
        return false;
      }
      if (searchKeyword.trim()) {
        const q = searchKeyword.trim().toLowerCase();
        const text = `${r.customerName || ''} ${r.roomTypeName || ''} ${r.roomNumber || ''} ${r.comment || ''} ${r.managementReply || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [publishedReviews, selectedRoomTypeId, selectedStar, searchKeyword]);

  // Paginated stays & published reviews
  const totalStayPages = Math.max(1, Math.ceil(myStays.length / stayPageSize));
  const paginatedStays = useMemo(() => {
    const start = (stayPage - 1) * stayPageSize;
    return myStays.slice(start, start + stayPageSize);
  }, [myStays, stayPage, stayPageSize]);

  const totalReviewPages = Math.max(1, Math.ceil(filteredReviews.length / reviewPageSize));
  const paginatedReviews = useMemo(() => {
    const start = (reviewPage - 1) * reviewPageSize;
    return filteredReviews.slice(start, start + reviewPageSize);
  }, [filteredReviews, reviewPage, reviewPageSize]);

  const handleOpenReviewForm = (stay) => {
    setActiveReviewStayId(stay.stayId);
    setRatingInput(5);
    setCommentInput('');
    setFeedbackMsg(null);
  };

  const handleAddQuickTag = (tag) => {
    setCommentInput((prev) => {
      if (!prev.trim()) return `${tag}. `;
      if (prev.includes(tag)) return prev;
      return `${prev.trim()} ${tag}. `;
    });
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!activeReviewStayId) return;
    if (!commentInput.trim() || commentInput.trim().length < 5) {
      setFeedbackMsg({
        type: 'error',
        text: 'Vui lòng nhập nhận xét tối thiểu 5 ký tự về phòng và kỳ lưu trú của bạn.',
      });
      return;
    }

    setSubmitting(true);
    setFeedbackMsg(null);
    try {
      await billingApi.submitReview({
        stayId: activeReviewStayId,
        rating: ratingInput,
        comment: commentInput.trim(),
      });
      setFeedbackMsg({
        type: 'success',
        text: 'Cảm ơn quý khách! Đánh giá về phòng và kỳ nghỉ tại HMS Luxury Hotel đã được đăng tải thành công.',
      });
      setActiveReviewStayId(null);
      setCommentInput('');
      await Promise.all([loadPublishedReviews(), loadMyStays()]);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        'Không thể gửi đánh giá lúc này. Vui lòng kiểm tra lại trạng thái kỳ lưu trú.';
      setFeedbackMsg({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const reviewableCount = myStays.filter((s) => s.canReview).length;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 0 48px' }}>
      {/* HERO BANNER — HOTEL REPUTATION & ROOM REVIEWS */}
      <div
        style={{
          background: 'linear-gradient(135deg, #141413 0%, #262522 100%)',
          borderRadius: 18,
          padding: '32px 36px',
          color: '#FAF9F5',
          marginBottom: 28,
          border: '1px solid rgba(212, 168, 73, 0.28)',
          boxShadow: '0 16px 36px rgba(20, 20, 19, 0.14)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 28,
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(212, 168, 73, 0.16)',
                color: '#F3D27A',
                padding: '5px 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              ★ Đánh Giá Xác Thực Từ Khách Lưu Trú
            </div>
            <h1
              style={{
                margin: '0 0 10px',
                fontSize: 30,
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: '#FAF9F5',
              }}
            >
              Đánh Giá Phòng &amp; Trải Nghiệm Khách Sạn HMS Luxury
            </h1>
            <p style={{ margin: 0, color: '#D5D2C6', fontSize: 14.5, lineHeight: 1.6 }}>
              100% nhận xét dưới đây được gửi từ những vị khách đã hoàn tất thủ tục lưu trú thực tế
              (Verified Completed Stays) tại các hạng phòng của HMS Luxury Hotel.
            </p>
          </div>

          {/* Score & Star Distribution Box */}
          <div
            style={{
              background: 'rgba(250, 249, 245, 0.06)',
              border: '1px solid rgba(232, 230, 220, 0.16)',
              borderRadius: 14,
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ textAlign: 'center', minWidth: 115 }}>
              <div style={{ fontSize: 42, fontWeight: 800, color: '#F3D27A', lineHeight: 1 }}>
                {stats.avg}
                <span style={{ fontSize: 18, color: '#9C9A92', fontWeight: 500 }}>/5</span>
              </div>
              <div style={{ color: '#F3D27A', fontSize: 16, margin: '6px 0 4px', letterSpacing: 2 }}>
                {'★'.repeat(Math.round(Number(stats.avg) || 5))}
              </div>
              <div style={{ fontSize: 12, color: '#D5D2C6' }}>
                {stats.total} lượt đánh giá xác thực
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats.dist[star] || 0;
                const pct = stats.total > 0 ? Math.round((count * 100) / stats.total) : 0;
                return (
                  <div
                    key={star}
                    onClick={() => setSelectedStar(selectedStar === star ? 'ALL' : star)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12.5,
                      cursor: 'pointer',
                    }}
                    title={`Lọc đánh giá ${star} sao`}
                  >
                    <span style={{ width: 38, color: '#F3D27A', fontWeight: 600 }}>{star} ★</span>
                    <div
                      style={{
                        flex: 1,
                        height: 7,
                        background: 'rgba(255,255,255,0.12)',
                        borderRadius: 999,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: '#D4A849',
                          borderRadius: 999,
                        }}
                      />
                    </div>
                    <span style={{ width: 32, textAlign: 'right', color: '#D5D2C6' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK ALERT */}
      {feedbackMsg && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 12,
            marginBottom: 22,
            background: feedbackMsg.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${feedbackMsg.type === 'success' ? '#10B981' : '#EF4444'}`,
            color: feedbackMsg.type === 'success' ? '#065F46' : '#991B1B',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 500,
            fontSize: 14,
          }}
        >
          <span>
            {feedbackMsg.type === 'success' ? '✓ ' : '⚠ '}
            {feedbackMsg.text}
          </span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* UC-41: CUSTOMER'S COMPLETED STAYS & SUBMIT HOTEL/ROOM REVIEW */}
      {isCustomer ? (
        <div
          style={{
            background: '#FAF9F5',
            border: '1px solid #E2DFD3',
            borderRadius: 16,
            padding: 24,
            marginBottom: 28,
            boxShadow: '0 6px 20px rgba(20, 20, 19, 0.05)',
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
              <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#141413' }}>
                Kỳ Lưu Trú Của Tôi Tại Khách Sạn
              </h2>
              <p style={{ margin: 0, fontSize: 13.5, color: '#5E5D59' }}>
                Sau khi hoàn tất thủ tục trả phòng (Check-out), quý khách có thể chấm sao và đánh giá
                chất lượng phòng nghỉ cùng dịch vụ khách sạn tại đây.
              </p>
            </div>
            {reviewableCount > 0 && (
              <span
                style={{
                  background: '#FEF3C7',
                  color: '#92400E',
                  border: '1px solid #F59E0B',
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                ★ Bạn có {reviewableCount} kỳ lưu trú đã hoàn tất chờ đánh giá
              </span>
            )}
          </div>

          {myStaysLoading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#64748B' }}>
              Đang tải lịch sử lưu trú của quý khách...
            </div>
          ) : myStays.length === 0 ? (
            <div
              style={{
                padding: '22px 20px',
                background: '#F5F4ED',
                borderRadius: 12,
                border: '1px dashed #D5D2C6',
                textAlign: 'center',
                color: '#5E5D59',
                fontSize: 14,
              }}
            >
              Quý khách chưa có kỳ lưu trú nào tại khách sạn. Hãy{' '}
              <Link to="/rooms" style={{ color: '#C96442', fontWeight: 700 }}>
                Khám phá các hạng phòng
              </Link>{' '}
              để trải nghiệm kỳ nghỉ tại HMS Luxury Hotel!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {paginatedStays.map((stay) => {
                const isSelectedForReview = activeReviewStayId === stay.stayId;
                const rev = stay.existingReview;
                const isCompleted =
                  stay.stayStatus === 'COMPLETED' || stay.stayStatus === 'CHECKED_OUT';

                return (
                  <div
                    key={stay.stayId}
                    style={{
                      background: '#FFFFFF',
                      border: isSelectedForReview ? '2px solid #C96442' : '1px solid #E8E6DC',
                      borderRadius: 14,
                      padding: 18,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 14,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <img
                          src={stay.roomImageUrl || '/images/hotel-bg.jpg'}
                          alt={stay.roomTypeName}
                          style={{
                            width: 72,
                            height: 56,
                            borderRadius: 10,
                            objectFit: 'cover',
                            border: '1px solid #E8E6DC',
                          }}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 15.5, color: '#141413' }}>
                              {stay.roomTypeName}
                            </strong>
                            <span
                              style={{
                                background: '#F5F4ED',
                                color: '#3D3D3A',
                                padding: '2px 9px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                                border: '1px solid #D5D2C6',
                              }}
                            >
                              Phòng {stay.roomNumber}
                            </span>
                            <span style={{ fontSize: 12.5, color: '#64748B' }}>
                              Mã đặt phòng: <strong>{stay.reservationCode}</strong>
                            </span>
                            {stay.canReview && (
                              <span
                                style={{
                                  background: '#FEF3C7',
                                  color: '#B45309',
                                  padding: '2px 9px',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  border: '1px solid #FCD34D',
                                }}
                              >
                                ★ Chờ quý khách đánh giá
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 13, color: '#5E5D59', marginTop: 4 }}>
                            Ngày lưu trú: <strong>{formatDate(stay.checkInDate)}</strong> →{' '}
                            <strong>{formatDate(stay.checkOutDate)}</strong> ({stay.nights} đêm)
                          </div>
                        </div>
                      </div>

                      <div>
                        {rev ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: '#ECFDF5',
                              color: '#047857',
                              border: '1px solid #A7F3D0',
                              padding: '6px 12px',
                              borderRadius: 8,
                              fontSize: 12.5,
                              fontWeight: 700,
                            }}
                          >
                            ✓ Đã gửi đánh giá ({rev.rating} ★)
                          </span>
                        ) : stay.canReview ? (
                          <button
                            type="button"
                            onClick={() =>
                              isSelectedForReview
                                ? setActiveReviewStayId(null)
                                : handleOpenReviewForm(stay)
                            }
                            style={{
                              background: isSelectedForReview ? '#3D3D3A' : '#C96442',
                              color: '#FAF9F5',
                              border: 'none',
                              padding: '9px 16px',
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {isSelectedForReview ? 'Đóng khung đánh giá' : '★ Viết Đánh Giá Khách Sạn'}
                          </button>
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              background: '#EFF6FF',
                              color: '#1D4ED8',
                              border: '1px solid #BFDBFE',
                              padding: '6px 12px',
                              borderRadius: 8,
                              fontSize: 12.5,
                              fontWeight: 600,
                            }}
                          >
                            {isCompleted
                              ? 'Đã hoàn tất lưu trú'
                              : 'Đang lưu trú — Đánh giá mở sau khi Check-out'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Existing Review Preview for this Stay */}
                    {rev && (
                      <div
                        style={{
                          marginTop: 14,
                          padding: '12px 16px',
                          background: '#FAF9F5',
                          borderRadius: 10,
                          border: '1px solid #E8E6DC',
                          fontSize: 13.5,
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
                          <span style={{ color: '#D97706', fontWeight: 700 }}>
                            {'★'.repeat(rev.rating || 5)} — Đánh giá của bạn
                          </span>
                          <span style={{ fontSize: 12, color: '#64748B' }}>
                            Gửi lúc {formatDateTime(rev.reviewDate)}
                          </span>
                        </div>
                        <p style={{ margin: 0, color: '#1E293B', lineHeight: 1.5 }}>{rev.comment}</p>
                        {rev.managementReply && (
                          <div
                            style={{
                              marginTop: 10,
                              padding: '10px 14px',
                              background: '#FFFBEB',
                              borderLeft: '3px solid #D97706',
                              borderRadius: 6,
                              fontSize: 13,
                            }}
                          >
                            <strong style={{ color: '#92400E', display: 'block', marginBottom: 2 }}>
                              Phản hồi từ Ban Quản lý Khách sạn HMS Luxury:
                            </strong>
                            <span style={{ color: '#3D3D3A' }}>{rev.managementReply}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Interactive Review Form (UC-41) */}
                    {isSelectedForReview && stay.canReview && (
                      <form
                        onSubmit={handleSubmitReview}
                        style={{
                          marginTop: 16,
                          paddingTop: 16,
                          borderTop: '1px solid #E8E6DC',
                        }}
                      >
                        <div style={{ marginBottom: 14 }}>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 13.5,
                              fontWeight: 700,
                              color: '#141413',
                              marginBottom: 8,
                            }}
                          >
                            1. Mức độ hài lòng của quý khách về Phòng {stay.roomNumber} ({stay.roomTypeName}) &amp; Khách sạn:
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {[1, 2, 3, 4, 5].map((star) => {
                                const active = (hoverRating || ratingInput) >= star;
                                return (
                                  <button
                                    key={star}
                                    type="button"
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    onClick={() => setRatingInput(star)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      fontSize: 30,
                                      lineHeight: 1,
                                      cursor: 'pointer',
                                      color: active ? '#F59E0B' : '#CBD5E1',
                                      padding: '0 2px',
                                      transition: 'transform 0.12s ease',
                                    }}
                                  >
                                    ★
                                  </button>
                                );
                              })}
                            </div>
                            <span
                              style={{
                                fontSize: 13.5,
                                fontWeight: 700,
                                color: '#B45309',
                                background: '#FEF3C7',
                                padding: '4px 12px',
                                borderRadius: 999,
                              }}
                            >
                              {STAR_LABELS[hoverRating || ratingInput]}
                            </span>
                          </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 12.5, color: '#5E5D59', marginBottom: 6 }}>
                            Gợi ý nhanh (bấm để thêm vào nhận xét):
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {QUICK_REVIEW_TAGS.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => handleAddQuickTag(tag)}
                                style={{
                                  background: '#F5F4ED',
                                  color: '#3D3D3A',
                                  border: '1px solid #D5D2C6',
                                  borderRadius: 999,
                                  padding: '4px 11px',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                }}
                              >
                                + {tag}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{ marginBottom: 14 }}>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 13.5,
                              fontWeight: 700,
                              color: '#141413',
                              marginBottom: 6,
                            }}
                          >
                            2. Chia sẻ trải nghiệm thực tế của quý khách về phòng nghỉ, tiện nghi &amp; thái độ phục vụ:
                          </label>
                          <textarea
                            rows={4}
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            placeholder="Nhập cảm nhận của quý khách về không gian phòng, độ sạch sẽ, sự tiện nghi và chất lượng phục vụ tại HMS Luxury Hotel..."
                            required
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: 10,
                              border: '1px solid #CBD5E1',
                              fontSize: 14,
                              fontFamily: 'inherit',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                          <button
                            type="button"
                            onClick={() => setActiveReviewStayId(null)}
                            style={{
                              background: '#F5F4ED',
                              color: '#3D3D3A',
                              border: '1px solid #D5D2C6',
                              padding: '9px 18px',
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
                            disabled={submitting}
                            style={{
                              background: '#C96442',
                              color: '#FAF9F5',
                              border: 'none',
                              padding: '9px 22px',
                              borderRadius: 8,
                              fontSize: 13.5,
                              fontWeight: 700,
                              cursor: submitting ? 'not-allowed' : 'pointer',
                              opacity: submitting ? 0.7 : 1,
                            }}
                          >
                            {submitting ? 'Đang đăng đánh giá...' : 'Gửi Đánh Giá Khách Sạn'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {myStays.length > 3 && (
            <PaginationControl
              currentPage={stayPage}
              totalPages={totalStayPages}
              totalItems={myStays.length}
              pageSize={stayPageSize}
              onPageChange={setStayPage}
              onPageSizeChange={setStayPageSize}
              itemLabel="kỳ nghỉ"
              pageSizeOptions={[3, 5, 10]}
              activeColor="#C96442"
            />
          )}
        </div>
      ) : (
        !isAuthenticated && (
          <div
            style={{
              background: '#FAF9F5',
              border: '1px solid #E2DFD3',
              borderRadius: 14,
              padding: '16px 22px',
              marginBottom: 24,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 14, color: '#3D3D3A' }}>
              <strong>Bạn đã từng lưu trú tại HMS Luxury Hotel?</strong> Đăng nhập tài khoản khách
              hàng để gửi đánh giá về phòng nghỉ và kỳ lưu trú của bạn.
            </div>
            <Link
              to="/login"
              style={{
                background: '#C96442',
                color: '#FAF9F5',
                padding: '8px 16px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 13.5,
                fontWeight: 700,
              }}
            >
              Đăng nhập để đánh giá
            </Link>
          </div>
        )
      )}

      {/* ROOM CATEGORY RATING CARDS */}
      {stats.roomTypeStats.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700, color: '#141413' }}>
            Điểm Đánh Giá Theo Hạng Phòng ({stats.roomTypeStats.length} hạng phòng)
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: 14,
            }}
          >
            {stats.roomTypeStats.map((rt) => {
              const key = rt.roomTypeId || rt.roomTypeName;
              const isSelected = String(selectedRoomTypeId) === String(key);
              return (
                <div
                  key={key}
                  onClick={() => setSelectedRoomTypeId(isSelected ? 'ALL' : key)}
                  style={{
                    background: isSelected ? '#FFFBEB' : '#FFFFFF',
                    border: isSelected ? '2px solid #D97706' : '1px solid #E8E6DC',
                    borderRadius: 12,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10,
                    boxShadow: '0 2px 8px rgba(20, 20, 19, 0.04)',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                    >
                      <strong style={{ fontSize: 14.5, color: '#141413' }}>{rt.roomTypeName}</strong>
                      <span
                        style={{
                          background: '#FEF3C7',
                          color: '#B45309',
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 12.5,
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ★ {rt.avgRating} / 5.0
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4 }}>
                      {rt.count} đánh giá từ khách đã lưu trú
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: 8,
                      borderTop: '1px solid #F1F5F9',
                      fontSize: 12.5,
                    }}
                  >
                    <span style={{ color: isSelected ? '#B45309' : '#64748B', fontWeight: 600 }}>
                      {isSelected ? 'Đang lọc hạng phòng này' : 'Bấm để lọc đánh giá'}
                    </span>
                    {rt.roomTypeId && (
                      <Link
                        to={`/rooms/${rt.roomTypeId}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: '#C96442', fontWeight: 700, textDecoration: 'none' }}
                      >
                        Xem phòng →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FILTER BAR FOR PUBLISHED REVIEWS (UC-42) */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E6DC',
          borderRadius: 14,
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#141413' }}>Bộ lọc:</span>
          <select
            value={selectedRoomTypeId}
            onChange={(e) => setSelectedRoomTypeId(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid #D5D2C6',
              background: '#FAF9F5',
              fontSize: 13.5,
              color: '#141413',
            }}
          >
            <option value="ALL">Tất cả hạng phòng ({publishedReviews.length})</option>
            {stats.roomTypeStats.map((rt) => {
              const key = rt.roomTypeId || rt.roomTypeName;
              return (
                <option key={key} value={key}>
                  {rt.roomTypeName} ({rt.count} đánh giá - ★ {rt.avgRating})
                </option>
              );
            })}
          </select>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['ALL', 5, 4, 3, 2, 1].map((st) => {
              const active = String(selectedStar) === String(st);
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStar(st)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: active ? '1px solid #C96442' : '1px solid #D5D2C6',
                    background: active ? '#C96442' : '#FAF9F5',
                    color: active ? '#FAF9F5' : '#3D3D3A',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {st === 'ALL' ? 'Tất cả sao' : `${st} ★`}
                </button>
              );
            })}
          </div>
        </div>

        <input
          type="text"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder="Tìm theo tên khách, hạng phòng, nội dung..."
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            border: '1px solid #D5D2C6',
            fontSize: 13.5,
            minWidth: 250,
          }}
        />
      </div>

      {/* PUBLISHED REVIEWS LIST (UC-42) */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748B' }}>
          Đang tải danh sách đánh giá khách sạn...
        </div>
      ) : filteredReviews.length === 0 ? (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8E6DC',
            borderRadius: 14,
            padding: 40,
            textAlign: 'center',
            color: '#64748B',
          }}
        >
          Chưa có đánh giá nào khớp với bộ lọc hiện tại.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {paginatedReviews.map((rev) => (
            <div
              key={rev.reviewId}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E8E6DC',
                borderRadius: 14,
                padding: '20px 24px',
                boxShadow: '0 4px 14px rgba(20, 20, 19, 0.04)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: '#141413',
                      color: '#F3D27A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 17,
                    }}
                  >
                    {(rev.customerName || 'K').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 15.5, color: '#141413' }}>
                        {rev.customerName || 'Khách lưu trú xác thực'}
                      </strong>
                      <span
                        style={{
                          background: '#ECFDF5',
                          color: '#047857',
                          border: '1px solid #A7F3D0',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 11.5,
                          fontWeight: 700,
                        }}
                      >
                        ✓ Đã lưu trú xác thực
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: '#5E5D59', marginTop: 3 }}>
                      Hạng phòng:{' '}
                      {rev.roomTypeId ? (
                        <Link
                          to={`/rooms/${rev.roomTypeId}`}
                          style={{ color: '#C96442', fontWeight: 700, textDecoration: 'none' }}
                        >
                          {rev.roomTypeName}
                        </Link>
                      ) : (
                        <strong>{rev.roomTypeName}</strong>
                      )}
                      {rev.roomNumber ? ` • Phòng ${rev.roomNumber}` : ''}
                      {rev.checkInDate && rev.checkOutDate
                        ? ` • Lưu trú: ${formatDate(rev.checkInDate)} – ${formatDate(rev.checkOutDate)}`
                        : ''}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#F59E0B', fontSize: 16, fontWeight: 800, letterSpacing: 1 }}>
                    {'★'.repeat(rev.rating || 5)}
                    <span style={{ color: '#E2E8F0' }}>
                      {'★'.repeat(Math.max(0, 5 - (rev.rating || 5)))}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    {formatDateTime(rev.reviewDate)}
                  </div>
                </div>
              </div>

              <p
                style={{
                  margin: '0 0 8px',
                  fontSize: 14.5,
                  color: '#1E293B',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-line',
                }}
              >
                {rev.comment}
              </p>

              {rev.managementReply && (
                <div
                  style={{
                    marginTop: 14,
                    padding: '14px 18px',
                    background: '#FAF9F5',
                    borderLeft: '4px solid #D4A849',
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <strong style={{ fontSize: 13.5, color: '#141413' }}>
                      🏨 Phản hồi chính thức từ Ban Quản lý Khách sạn HMS Luxury
                    </strong>
                    {rev.repliedAt && (
                      <span style={{ fontSize: 11.5, color: '#64748B' }}>
                        Phản hồi ngày {formatDateTime(rev.repliedAt)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13.5, color: '#3D3D3A', lineHeight: 1.55 }}>
                    {rev.managementReply}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {filteredReviews.length > 0 && (
        <PaginationControl
          currentPage={reviewPage}
          totalPages={totalReviewPages}
          totalItems={filteredReviews.length}
          pageSize={reviewPageSize}
          onPageChange={setReviewPage}
          onPageSizeChange={setReviewPageSize}
          itemLabel="đánh giá"
          pageSizeOptions={[5, 10, 20]}
          activeColor="#C96442"
        />
      )}
    </div>
  );
};

