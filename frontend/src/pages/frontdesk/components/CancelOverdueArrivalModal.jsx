import { useState } from 'react';
import { frontDeskApi } from '../../../services/frontDeskApi';
import { formatVND } from '../../../lib/money';
import { notifyToast } from '../../../lib/http';

export const CancelOverdueArrivalModal = ({ data, onClose, onSuccess, checkOverdueArrival }) => {
  const [cancelReason, setCancelReason] = useState(
    'Khách không đến nhận phòng quá giờ quy định (No-show)'
  );
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!data) return null;

  const isPaid = data.depositPaymentStatus === 'PAID';

  const handleConfirmCancel = async () => {
    setIsSubmitting(true);
    const finalReason = cancelReason === 'Khác' ? customReason.trim() : cancelReason;
    try {
      await frontDeskApi.cancelDirectBooking(
        data.reservationCode,
        finalReason || 'Khách không đến nhận phòng quá giờ quy định (No-show)'
      );
      notifyToast({
        type: 'SUCCESS',
        message: `Đã hủy đơn #${data.reservationCode} do quá thời gian. Quota phòng đã được giải phóng.`,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      notifyToast({
        type: 'ERROR',
        message: err.response?.data?.message || 'Hủy đơn thất bại.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fd-modal-overlay">
      <div className="fd-modal-dialog" style={{ maxWidth: 480 }}>
        {/* Header */}
        <div className="fd-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                background: '#fee2e2',
                color: '#b91c1c',
                padding: '4px 8px',
                borderRadius: 6,
                fontSize: 16,
              }}
            >
              <i className="bi bi-exclamation-triangle-fill"></i>
            </span>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Xác Nhận Hủy Đặt Phòng Quá Giờ
            </h3>
          </div>
          <button type="button" onClick={onClose} className="fd-modal-close-btn">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="fd-modal-body">
          {/* Tóm tắt đơn giản, loại bỏ thông tin rườm rà */}
          <div className="fd-info-block" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div>
                <strong style={{ fontFamily: 'monospace', fontSize: 14, color: '#0f172a' }}>
                  #{data.reservationCode}
                </strong>
                <span style={{ color: '#64748b', fontSize: 13, marginLeft: 8 }}>
                  • {data.contactName}
                </span>
              </div>
              <span className="fd-badge fd-badge-blue" style={{ fontSize: 12 }}>
                {data.roomTypeName || 'N/A'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: '#475569' }}>
              <span>Tiền cọc:</span>
              <strong style={{ color: isPaid ? '#b91c1c' : '#64748b' }}>
                {formatVND(data.depositAmount || 0)} {isPaid ? '(Thu hồi cọc do No-show)' : '(Chưa cọc)'}
              </strong>
            </div>
          </div>

          <p style={{ fontSize: 13, color: '#64748b', margin: '10px 0 12px 0', lineHeight: 1.5 }}>
            Đơn sẽ chuyển sang trạng thái <strong>HỦY (CANCELLED)</strong> và giải phóng quota phòng ngay lập tức.
          </p>

          {/* Lý do hủy */}
          <div style={{ marginBottom: 4 }}>
            <label className="fd-label" style={{ fontSize: 13, marginBottom: 4 }}>
              Lý do hủy <span style={{ color: '#dc2626' }}>*</span>:
            </label>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="fd-select"
              style={{ fontSize: 13, padding: '7px 10px', marginBottom: cancelReason === 'Khác' ? 6 : 0 }}
            >
              <option value="Khách không đến nhận phòng quá giờ quy định (No-show)">
                Khách không đến nhận phòng quá giờ quy định (No-show)
              </option>
              <option value="Quá thời hạn giữ chỗ">Quá thời hạn giữ chỗ (7 phút)</option>
              <option value="Khách liên hệ xin hủy do trễ giờ">Khách liên hệ xin hủy do trễ giờ</option>
              <option value="Khác">Lý do khác...</option>
            </select>

            {cancelReason === 'Khác' && (
              <input
                type="text"
                placeholder="Nhập lý do chi tiết..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="fd-input"
                style={{ fontSize: 13, padding: '7px 10px' }}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="fd-modal-footer" style={{ padding: '10px 16px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="fd-btn fd-btn-secondary"
            style={{ fontSize: 13, padding: '7px 14px' }}
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleConfirmCancel}
            disabled={isSubmitting}
            className="fd-btn fd-btn-danger"
            style={{ fontSize: 13, padding: '7px 14px' }}
          >
            {isSubmitting ? 'Đang xử lý...' : 'Xác Nhận Hủy Đơn'}
          </button>
        </div>
      </div>
    </div>
  );
};
