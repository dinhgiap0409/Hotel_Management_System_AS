import { formatVND } from '../../../lib/money';

export const ConfirmDeleteChargeModal = ({ chargeToDelete, busy, onClose, onConfirm }) => {
  if (!chargeToDelete) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1150,
        padding: 16,
      }}
      onClick={() => !busy && onClose()}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626',
              fontSize: 18,
            }}
          >
            🗑️
          </div>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
            Xác Nhận Xóa Khoản Phụ Thu
          </h4>
        </div>

        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 16 }}>
          Bạn có chắc chắn muốn xóa phụ thu <strong>&ldquo;{chargeToDelete.description || chargeToDelete.chargeType}&rdquo;</strong> có số tiền{' '}
          <strong style={{ color: '#dc2626' }}>{formatVND(chargeToDelete.amount)}</strong> khỏi hóa đơn phòng này?
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
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={() => onConfirm(chargeToDelete.additionalChargeId || chargeToDelete.chargeId)}
            disabled={busy}
            style={{
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              padding: '8px 18px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {busy ? 'Đang xóa...' : 'Đồng ý xóa'}
          </button>
        </div>
      </div>
    </div>
  );
};

