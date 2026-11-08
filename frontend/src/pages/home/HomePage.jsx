import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { bookingApi } from '../../services/bookingApi';
import { roomApi } from '../../services/roomApi';
import { formatVND } from '../../lib/money';
import { RoomCategoryModal } from '../../components/booking/RoomCategoryModal';
import { ROLE_DEFAULT_ROUTES, getRoleLabel } from '../../config/constants';

const HOTEL_HIGHLIGHTS = [
  {
    title: 'Đặt phòng trực tuyến tức thì',
    desc: 'Tra cứu tình trạng phòng trống theo thời gian thực, giữ chỗ nhanh chóng và nhận mã xác nhận ngay lập tức.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C96442" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    title: 'Không gian lưu trú kiểm duyệt 3 bước',
    desc: 'Mỗi căn phòng đều trải qua quy trình làm sạch và kiểm định nghiêm ngặt trước khi bàn giao tới quý khách.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C96442" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'Dịch vụ ẩm thực & Spa tại phòng',
    desc: 'Thưởng thức thực đơn Á - Âu, minibar, giặt ủi và liệu trình chăm sóc sức khỏe được ghi nhận minh bạch vào hóa đơn.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C96442" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    ),
  },
  {
    title: 'Lễ tân & Hỗ trợ lưu trú 24/7',
    desc: 'Đội ngũ tiền sảnh luôn sẵn sàng hỗ trợ thủ tục nhận phòng sớm, gia hạn kỳ nghỉ hoặc chuyển đổi hạng phòng linh hoạt.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C96442" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
  },
];

export const HomePage = () => {
  const { isAuthenticated, user } = useAuth();
  const [featuredRooms, setFeaturedRooms] = useState([]);
  // GiapND (UC-23): direct booking — the "Đặt phòng" button on a featured
  // card opens RoomCategoryModal for that room type instead of navigating
  // to another page (there is no checkout page in this project).
  const [selectedCategory, setSelectedCategory] = useState(null);

  const loadFeaturedRooms = () => {
    bookingApi
      .getRoomCategories()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setFeaturedRooms(list.slice(0, 3));
      })
      .catch(() => {
        roomApi
          .getRoomTypes()
          .then((res) => {
            const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
            setFeaturedRooms(list.slice(0, 3));
          })
          .catch(() => { });
      });
  };

  useEffect(() => {
    loadFeaturedRooms();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 44, paddingBottom: 28 }}>
      {/* Hero Banner */}
      <section
        style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          minHeight: 440,
          display: 'flex',
          alignItems: 'center',
          padding: '52px 48px',
          color: '#FAF9F5',
          backgroundImage:
            'linear-gradient(115deg, rgba(20, 20, 19, 0.86) 0%, rgba(22, 35, 59, 0.72) 55%, rgba(20, 20, 19, 0.58) 100%), url("/images/hotel-bg.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: '0 20px 44px rgba(20, 20, 19, 0.16)',
        }}
      >
        <div style={{ maxWidth: 1500 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(250, 249, 245, 0.12)',
              border: '1px solid rgba(232, 230, 220, 0.28)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 20,
            }}
          >
            <img
              src="/images/hms-logo.png"
              alt="HMS Logo"
              style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
            />
            HMS Luxury Hospitality
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 44,
              fontWeight: 400,
              lineHeight: 1.14,
              letterSpacing: '-0.02em',
              margin: '0 0 18px',
              color: '#FAF9F5',
            }}
          >
            Điểm chạm nghỉ dưỡng <em style={{ fontStyle: 'italic', color: '#F5E6D3' }}>thanh lịch</em> &amp; <em style={{ fontStyle: 'italic', color: '#F5E6D3' }}>chuẩn mực</em>.
          </h1>

          <p
            style={{
              fontSize: 16,
              lineHeight: 1.65,
              color: '#E8E6DC',
              margin: '0 0 28px',
              maxWidth: '56ch',
            }}
          >
            Chào mừng quý khách đến với HMS Luxury Hotel. Khám phá bộ sưu tập phòng nghỉ tinh tế, đặt phòng trực tuyến minh bạch và tận hưởng dịch vụ chăm sóc lưu trú trọn vẹn.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <Link
              to="/rooms"
              style={{
                background: '#C96442',
                color: '#FAF9F5',
                padding: '13px 24px',
                borderRadius: 6,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 14.5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Tìm &amp; Đặt Phòng Ngay
            </Link>

            {isAuthenticated && user ? (
              user.role === 'CUSTOMER' ? (
                <Link
                  to="/my-bookings"
                  style={{
                    background: 'rgba(250, 249, 245, 0.14)',
                    color: '#FAF9F5',
                    border: '1px solid rgba(232, 230, 220, 0.45)',
                    padding: '13px 22px',
                    borderRadius: 6,
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: 14.5,
                  }}
                >
                  Xem Đặt Phòng Của Tôi
                </Link>
              ) : (
                <Link
                  to={ROLE_DEFAULT_ROUTES[user.role] || '/staff/frontdesk'}
                  style={{
                    background: 'rgba(250, 249, 245, 0.14)',
                    color: '#FAF9F5',
                    border: '1px solid rgba(232, 230, 220, 0.45)',
                    padding: '13px 22px',
                    borderRadius: 6,
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: 14.5,
                  }}
                >
                  Vào Cổng Nội Bộ ({getRoleLabel(user.role)})
                </Link>
              )
            ) : (
              <Link
                to="/register"
                style={{
                  background: 'rgba(250, 249, 245, 0.14)',
                  color: '#FAF9F5',
                  border: '1px solid rgba(232, 230, 220, 0.45)',
                  padding: '13px 22px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 14.5,
                }}
              >
                Đăng Ký Thành Viên
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Key Metrics Strip */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 18,
          background: '#FAF9F5',
          padding: '24px 28px',
          borderRadius: 10,
          border: '1px solid #E8E6DC',
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 600, color: '#16233B' }}>05</div>
          <div style={{ fontSize: 13, color: '#5E5D59', marginTop: 4 }}>Hạng phòng tiêu chuẩn &amp; Suite</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 600, color: '#16233B' }}>100%</div>
          <div style={{ fontSize: 13, color: '#5E5D59', marginTop: 4 }}>Phòng kiểm tra sạch trước Check-in</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 600, color: '#16233B' }}>24/7</div>
          <div style={{ fontSize: 13, color: '#5E5D59', marginTop: 4 }}>Lễ tân &amp; Phục vụ buồng phòng</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 600, color: '#C96442' }}>14:00 - 12:00</div>
          <div style={{ fontSize: 13, color: '#5E5D59', marginTop: 4 }}>Khung giờ Nhận &amp; Trả phòng chuẩn</div>
        </div>
      </section>

      {/* Core Hospitality Values */}
      <section>
        <div style={{ marginBottom: 22 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#C96442',
              marginBottom: 6,
            }}
          >
            Dịch vụ &amp; Tiện ích
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 30,
              fontWeight: 500,
              color: '#141413',
              margin: 0,
            }}
          >
            Trải nghiệm lưu trú đồng bộ từ đặt phòng đến trả phòng
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
          {HOTEL_HIGHLIGHTS.map((item) => (
            <div
              key={item.title}
              style={{
                background: '#FAF9F5',
                padding: 24,
                borderRadius: 10,
                border: '1px solid #E8E6DC',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: '#F5F4ED',
                  border: '1px solid #E8E6DC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#141413', margin: 0 }}>{item.title}</h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#5E5D59', margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Room Categories Preview */}
      {featuredRooms.length > 0 && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22 }}>
            <div>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#C96442',
                  marginBottom: 6,
                }}
              >
                Không gian Nghỉ dưỡng
              </div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 30,
                  fontWeight: 500,
                  color: '#141413',
                  margin: 0,
                }}
              >
                Các hạng phòng tiêu biểu
              </h2>
            </div>

            <Link
              to="/rooms"
              style={{
                color: '#16233B',
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
                borderBottom: '1px solid #16233B',
                paddingBottom: 2,
              }}
            >
              Xem tất cả hạng phòng &amp; kiểm tra phòng trống →
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {featuredRooms.map((rt) => {
              const id = rt.roomTypeId || rt.id;
              const name = rt.typeName || rt.name;
              const price = rt.basePrice || rt.nightlyRate || 0;
              const capacity = rt.maxOccupancy || rt.capacity || 2;
              return (
                <div
                  key={id}
                  style={{
                    background: '#FAF9F5',
                    borderRadius: 10,
                    border: '1px solid #E8E6DC',
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: '#5E5D59',
                          background: '#F5F4ED',
                          padding: '4px 10px',
                          borderRadius: 999,
                          border: '1px solid #E8E6DC',
                        }}
                      >
                        Tối đa {capacity} khách
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: '#C96442' }}>
                        {formatVND(price)} / đêm
                      </span>
                    </div>

                    <h3
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 22,
                        fontWeight: 500,
                        color: '#141413',
                        margin: '0 0 8px',
                      }}
                    >
                      {name}
                    </h3>

                    <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#5E5D59', margin: 0 }}>
                      {rt.description || 'Phòng nghỉ đầy đủ tiện nghi cao cấp, tầm nhìn thoáng đãng và không gian yên tĩnh.'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid #E8E6DC' }}>
                    <Link
                      to={`/rooms/${id}`}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        padding: '9px 14px',
                        borderRadius: 6,
                        border: '1px solid #16233B',
                        color: '#16233B',
                        textDecoration: 'none',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      Chi tiết hạng phòng
                    </Link>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(rt)}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        padding: '9px 14px',
                        borderRadius: 6,
                        border: 'none',
                        background: '#16233B',
                        color: '#FAF9F5',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Đặt phòng
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* UC-23 direct booking modal (same as /rooms): pick dates + contact,
          confirm -> PENDING hold 24h -> VNPay deposit. No checkout page. */}
      <RoomCategoryModal
        selectedCategory={selectedCategory}
        onClose={() => setSelectedCategory(null)}
        onBookingSuccess={() => loadFeaturedRooms()}
        isSearchActive={false}
        activeSearchMeta={null}
      />
    </div>
  );
};
