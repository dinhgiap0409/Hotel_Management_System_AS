import { useEffect, useState } from 'react';
import { billingApi } from '../../services/billingApi';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatVND } from '../../lib/money';

export const ReportsDashboardPage = () => {
  const [kpi, setKpi] = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    billingApi.getDashboardKpi().then((r) => setKpi(r.data.data));
    billingApi.getReviews().then((r) => setReviews(r.data.data || []));
  }, []);

  return (
    <div>
      <h2>Báo cáo KPI Doanh thu & Kiểm duyệt Đánh giá (UC-27, UC-28, UC-29)</h2>
      <p style={{ color: '#64748b' }}>
        Dành cho: <strong>General Manager</strong> (Toàn quyền KPI), <strong>Accountant</strong> (Báo cáo doanh thu), và <strong>Sales & Marketing Manager</strong> (Kiểm duyệt đánh giá & KPI lấp đầy).
      </p>

      {kpi && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Tổng số Phòng</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{kpi.totalRooms}</div>
          </div>
          <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Tổng Lượt Đặt phòng</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{kpi.totalBookings}</div>
          </div>
          <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Tổng Hóa đơn Phát hành</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{kpi.totalInvoices}</div>
          </div>
          <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Tổng Doanh thuĐã thu</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{formatVND(kpi.totalCollectedRevenue)}</div>
          </div>
        </div>
      )}

      <h3>Danh sách Đánh giá của Khách hàng (Customer Reviews)</h3>
      <DataTable
        keyField="reviewId"
        data={reviews}
        columns={[
          { header: 'ID', render: (r) => `#${r.reviewId}` },
          { header: 'Số sao', render: (r) => `${r.rating} / 5 ⭐` },
          { header: 'Nhận xét', render: (r) => r.comment },
          { header: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
    </div>
  );
};