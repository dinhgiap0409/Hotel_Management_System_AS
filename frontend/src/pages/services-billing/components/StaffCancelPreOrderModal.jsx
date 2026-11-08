const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  fontSize: 13.5,
  boxSizing: 'border-box',
};

export const StaffCancelPreOrderModal = ({
  cancelPreOrderModal,
  setCancelPreOrderModal,
  onConfirmCancel,
  busy,
}) => {
  if (!cancelPreOrderModal) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1060,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          width: '100%',
          maxWidth: 460,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
            Xác Nhận Hủy Dịch Vụ Đặt Trước
          </h3>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
            Booking #{cancelPreOrderModal.reservation?.reservationCode} ({cancelPreOrderModal.reservation?.contactName})
          </div>
        </div>

        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 14px',
            fontSize: 13,
            color: '#334155',
            marginBottom: 16,
          }}
        >
          <div>Bạn có chắc chắn muốn hủy yêu cầu đặt trước:</div>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginTop: 4 }}>
            {cancelPreOrderModal.item?.serviceName} (Tổng đặt: {cancelPreOrderModal.item?.quantity || 1} suất)
          </div>
          {cancelPreOrderModal.item?.time && (
            <div style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>
              Thời gian hẹn: <strong>{cancelPreOrderModal.item?.time}</strong>
            </div>
          )}
          {cancelPreOrderModal.item?.detail && cancelPreOrderModal.item?.detail !== 'Không' && (
            <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>
              Ghi chú yêu cầu: <strong>{cancelPreOrderModal.item?.detail}</strong>
            </div>
          )}
        </div>

        {Number(cancelPreOrderModal.item?.quantity || 1) > 1 && (
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16,
            }}
          >
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
              Chọn số lượng suất muốn hủy (Không bắt buộc hủy hết):
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min={1}
                max={Number(cancelPreOrderModal.item?.quantity || 1)}
                value={cancelPreOrderModal.cancelQty || 1}
                onChange={(e) => {
                  const maxQ = Number(cancelPreOrderModal.item?.quantity || 1);
                  const val = Math.max(1, Math.min(maxQ, Number(e.target.value) || 1));
                  setCancelPreOrderModal({ ...cancelPreOrderModal, cancelQty: val });
                }}
                style={{ ...inputStyle, width: 90, fontWeight: 700 }}
              />
              <span style={{ fontSize: 12.5, color: '#78350f' }}>
                / {cancelPreOrderModal.item?.quantity} suất đã đặt
              </span>
              <button
                type="button"
                onClick={() => setCancelPreOrderModal({ ...cancelPreOrderModal, cancelQty: 1 })}
                style={{
                  background: cancelPreOrderModal.cancelQty === 1 ? '#d97706' : '#fff',
                  color: cancelPreOrderModal.cancelQty === 1 ? '#fff' : '#92400e',
                  border: '1px solid #f59e0b',
                  borderRadius: 4,
                  padding: '4px 8px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy 1 suất
              </button>
              <button
                type="button"
                onClick={() =>
                  setCancelPreOrderModal({
                    ...cancelPreOrderModal,
                    cancelQty: Number(cancelPreOrderModal.item?.quantity || 1),
                  })
                }
                style={{
                  background:
                    cancelPreOrderModal.cancelQty === Number(cancelPreOrderModal.item?.quantity || 1)
                      ? '#dc2626'
                      : '#fff',
                  color:
                    cancelPreOrderModal.cancelQty === Number(cancelPreOrderModal.item?.quantity || 1)
                      ? '#fff'
                      : '#dc2626',
                  border: '1px solid #fca5a5',
                  borderRadius: 4,
                  padding: '4px 8px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy tất cả ({cancelPreOrderModal.item?.quantity})
              </button>
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
          {Number(cancelPreOrderModal.cancelQty || 1) < Number(cancelPreOrderModal.item?.quantity || 1)
            ? `Hệ thống sẽ giảm đi ${cancelPreOrderModal.cancelQty} suất và giữ lại ${Number(cancelPreOrderModal.item?.quantity) - Number(cancelPreOrderModal.cancelQty)} suất cho khách.`
            : 'Lượt đặt trước này sẽ được hủy khỏi lịch đón tiếp của khách sạn.'}
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
            Lý do hủy dịch vụ đặt trước <span style={{ color: '#dc2626' }}>* (Bắt buộc)</span>
          </label>
          <textarea
            required
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
            placeholder="Nhập nguyên nhân hủy (Ví dụ: Khách đổi lịch trình không cần xe, hủy buffet, đổi yêu cầu...)"
            value={cancelPreOrderModal.reason || ''}
            onChange={(e) => setCancelPreOrderModal({ ...cancelPreOrderModal, reason: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={() => setCancelPreOrderModal(null)}
            disabled={busy}
            style={{
              background: '#f1f5f9',
              color: '#475569',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={onConfirmCancel}
            disabled={busy || !cancelPreOrderModal.reason?.trim()}
            style={{
              background: !cancelPreOrderModal.reason?.trim() ? '#fca5a5' : '#dc2626',
              color: '#fff',
              border: 'none',
              padding: '8px 18px',
              borderRadius: 6,
              cursor: !cancelPreOrderModal.reason?.trim() ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: 13,
              boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)',
            }}
          >
            {busy
              ? 'Đang hủy...'
              : Number(cancelPreOrderModal.item?.quantity || 1) > 1
              ? `Xác nhận hủy ${cancelPreOrderModal.cancelQty} suất`
              : 'Xác nhận hủy'}
          </button>
        </div>
      </div>
    </div>
  );
};

