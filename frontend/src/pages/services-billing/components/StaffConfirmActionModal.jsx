export const StaffConfirmActionModal = ({ confirmActionModal, onClose, busy }) => {
  if (!confirmActionModal) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1060,
      }}
      onClick={() => !busy && onClose()}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          width: 480,
          maxWidth: '92vw',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
            {confirmActionModal.title || 'Xác nhận dịch vụ & tính tiền'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Kiểm tra thông tin trước khi ghi nhận vào hóa đơn tiền phòng
          </div>
        </div>

        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: 14,
            fontSize: 13,
            color: '#334155',
            marginBottom: 16,
          }}
        >
          <div style={{ marginBottom: 6 }}>{confirmActionModal.message}</div>
          {confirmActionModal.details && (
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginTop: 4 }}>
              {confirmActionModal.details}
            </div>
          )}
          {confirmActionModal.extra && (
            <div style={{ fontSize: 12, color: '#0369a1', marginTop: 4, fontWeight: 500 }}>
              {confirmActionModal.extra}
            </div>
          )}
        </div>

        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
          Khi xác nhận, hệ thống sẽ chuyển trạng thái đơn sang <strong>Đã hoàn thành</strong> và tự động cộng tổng tiền vào hóa đơn phòng.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
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
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={async () => {
              const action = confirmActionModal.onConfirm;
              if (action) {
                try {
                  await action();
                } finally {
                  onClose();
                }
              } else {
                onClose();
              }
            }}
            disabled={busy}
            style={{
              background: '#16a34a',
              color: '#fff',
              border: 'none',
              padding: '8px 18px',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              boxShadow: '0 1px 2px rgba(22, 163, 74, 0.2)',
            }}
          >
            {busy ? 'Đang xử lý...' : confirmActionModal.confirmLabel || 'Xác nhận hoàn thành'}
          </button>
        </div>
      </div>
    </div>
  );
};

