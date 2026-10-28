import React, { useEffect, useState } from 'react';
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
      <h2>BÃ¡o cÃ¡o KPI Doanh thu & Kiá»ƒm duyá»‡t ÄÃ¡nh giÃ¡ (UC-27, UC-28, UC-29)</h2>
      <p style={{ color: '#64748b' }}>
        DÃ nh cho: <strong>General Manager</strong> (ToÃ n quyá»n KPI), <strong>Accountant</strong> (BÃ¡o cÃ¡o doanh thu), vÃ  <strong>Sales & Marketing Manager</strong> (Kiá»ƒm duyá»‡t Ä‘Ã¡nh giÃ¡ & KPI láº¥p Ä‘áº§y).
      </p>

      {kpi && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Tá»•ng sá»‘ PhÃ²ng</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{kpi.totalRooms}</div>
          </div>
          <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Tá»•ng LÆ°á»£t Äáº·t phÃ²ng</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{kpi.totalBookings}</div>
          </div>
          <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Tá»•ng HÃ³a Ä‘Æ¡n PhÃ¡t hÃ nh</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{kpi.totalInvoices}</div>
          </div>
          <div style={{ background: '#fff', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Tá»•ng Doanh thuÄÃ£ thu</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{formatVND(kpi.totalCollectedRevenue)}</div>
          </div>
        </div>
      )}

      <h3>Danh sÃ¡ch ÄÃ¡nh giÃ¡ cá»§a KhÃ¡ch hÃ ng (Customer Reviews)</h3>
      <DataTable
        keyField="reviewId"
        data={reviews}
        columns={[
          { header: 'ID', render: (r) => `#${r.reviewId}` },
          { header: 'Sá»‘ sao', render: (r) => `${r.rating} / 5 â­` },
          { header: 'Nháº­n xÃ©t', render: (r) => r.comment },
          { header: 'Tráº¡ng thÃ¡i', render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
    </div>
  );
};