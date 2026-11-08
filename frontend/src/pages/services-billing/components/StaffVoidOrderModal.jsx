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

export const StaffVoidOrderModal = ({
  voidModalData,
  setVoidModalData,
  onConfirmVoid,
  busy,
}) => {
  if (!voidModalData) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: 24,
          borderRadius: 12,
          width: '100%',
          maxWidth: 480,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
          borderTop: '4px solid #dc2626',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: '#991b1b', fontSize: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
            Hủy Đơn Gọi Dịch Vụ #{voidModalData.order?.serviceOrderId}
          </h3>
          <button
            type="button"
            onClick={() => setVoidModalData(null)}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}
          >
            &times;
          </button>
        </div>

        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: 8,
            padding: 12,
            fontSize: 13,
            color: '#7f1d1d',
            marginBottom: 16,
          }}
        >
          <div>
            <strong>Dịch vụ:</strong> {voidModalData.order?.serviceName} (Số lượng: {voidModalData.order?.quantity})
          </div>
          <div>
            <strong>Lượt lưu trú:</strong> Stay #{voidModalData.order?.stayId}
            {voidModalData.order?.guestName && ` - ${voidModalData.order.guestName}`}
          </div>
          <div style={{ marginTop: 4 }}>
            <strong>Tổng số tiền:</strong> {formatVND(voidModalData.order?.totalAmount)}
          </div>
        </div>

        <form onSubmit={onConfirmVoid}>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>
              Lý do hủy dịch vụ <span style={{ color: '#dc2626' }}>* (Bắt buộc)</span>
            </label>
            <textarea
              required
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Nhập nguyên nhân hủy (Ví dụ: Khách đổi ý, bộ phận nhà bếp hết nguyên liệu...)"
              value={voidModalData.reason}
              onChange={(e) => setVoidModalData({ ...voidModalData, reason: e.target.value })}
            />
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
              Lý do này sẽ được lưu vào biên bản kiểm toán hệ thống để phục vụ đối soát.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={() => setVoidModalData(null)}
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
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Xác Nhận Hủy Đơn
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

