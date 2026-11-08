import { useState, useEffect } from 'react';
import { formatVND } from '../../../lib/money';

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

export const HotelServiceModal = ({
  show,
  editingId,
  serviceForm,
  setServiceForm,
  onSubmit,
  onClose,
  busy,
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [serviceForm.imageUrl, show]);

  if (!show) return null;

  return (
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
          maxWidth: 580,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: 18 }}>
            {editingId ? 'Cập Nhật Thông Tin Dịch Vụ' : 'Thêm Dịch Vụ Mới'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={onSubmit}>
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

          {/* Ô NHẬP HÌNH ẢNH & KHO ẢNH MẪU */}
          <div style={{ marginBottom: 14, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Hình ảnh dịch vụ (URL)</label>
              <span style={{ fontSize: 11, color: '#64748b' }}>Không bắt buộc</span>
            </div>
            <input
              style={inputStyle}
              placeholder="https://images.unsplash.com/..."
              value={serviceForm.imageUrl || ''}
              onChange={(e) => setServiceForm({ ...serviceForm, imageUrl: e.target.value })}
              maxLength={500}
            />

            {/* Live Preview Box */}
            <div style={{ marginTop: 10 }}>
              {serviceForm.imageUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  {!imgError ? (
                    <img
                      src={serviceForm.imageUrl}
                      alt="Xem trước dịch vụ"
                      onError={() => setImgError(true)}
                      style={{ width: 100, height: 65, objectFit: 'cover', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 100,
                        height: 65,
                        background: '#fee2e2',
                        color: '#991b1b',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        textAlign: 'center',
                        padding: 4,
                      }}
                    >
                      Lỗi tải ảnh
                    </div>
                  )}
                  <div style={{ flex: 1, fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: imgError ? '#b91c1c' : '#166534' }}>
                      {imgError ? '⚠️ Đường dẫn ảnh không tải được' : '✓ Ảnh hợp lệ (Xem trước thực tế)'}
                    </div>
                    <div style={{ color: '#64748b', fontSize: 11, marginTop: 2, wordBreak: 'break-all' }}>
                      {imgError ? 'Vui lòng kiểm tra lại link ảnh hoặc chọn từ kho ảnh mẫu.' : 'Ảnh này sẽ hiển thị trên thẻ dịch vụ của khách và bảng quản lý.'}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px dashed #cbd5e1',
                    fontSize: 12,
                    color: '#94a3b8',
                    textAlign: 'center',
                  }}
                >
                  Chưa chọn ảnh (Hệ thống sẽ hiển thị icon gradient mặc định theo danh mục)
                </div>
              )}
            </div>
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
              onClick={onClose}
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
  );
};

