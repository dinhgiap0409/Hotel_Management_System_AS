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

