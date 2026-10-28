import React, { useEffect, useState } from 'react';
import { billingApi } from '../../services/billingApi';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatVND } from '../../lib/money';

export const ServicesAndBillingPage = () => {
  const [services, setServices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vouchers, setVouchers] = useState([]);

  useEffect(() => {
    billingApi.getActiveServices().then((r) => setServices(r.data.data || []));
    billingApi.getServiceOrders().then((r) => setOrders(r.data.data || []));
    billingApi.getVouchers().then((r) => setVouchers(r.data.data || []));
  }, []);

  return (
    <div>
      <h2>Dá»‹ch vá»¥ Ná»™i khu, HÃ³a Ä‘Æ¡n Folio & Khuyáº¿n mÃ£i (UC-21..UC-26)</h2>
      <p style={{ color: '#64748b' }}>
        PhÃ¢n quyá»n chuyÃªn biá»‡t: <strong>Service Manager</strong> quáº£n lÃ½ danh má»¥c dá»‹ch vá»¥; <strong>Accountant</strong> kiá»ƒm soÃ¡t hÃ³a Ä‘Æ¡n & hoÃ n tiá»n; <strong>Sales & Marketing Manager</strong> quáº£n lÃ½ Voucher.
      </p>

      <h3>1. Danh má»¥c Dá»‹ch vá»¥ KhÃ¡ch sáº¡n (POS Services)</h3>
      <DataTable
        keyField="serviceId"
        data={services}
        columns={[
          { header: 'MÃ£ DV', render: (s) => `#${s.serviceId}` },
          { header: 'TÃªn dá»‹ch vá»¥', render: (s) => <strong>{s.serviceName}</strong> },
          { header: 'NhÃ³m', render: (s) => s.category },
          { header: 'ÄÆ¡n giÃ¡', render: (s) => `${formatVND(s.unitPrice)} / ${s.unit}` },
          { header: 'Tráº¡ng thÃ¡i', render: (s) => <StatusBadge status={s.status} /> },
        ]}
      />

      <h3 style={{ marginTop: 28 }}>2. ÄÆ¡n gá»i Dá»‹ch vá»¥ cá»§a KhÃ¡ch (Service Orders)</h3>
      <DataTable
        keyField="orderId"
        data={orders}
        columns={[
          { header: 'MÃ£ Order', render: (o) => `#${o.orderId}` },
          { header: 'Tá»•ng tiá»n', render: (o) => formatVND(o.totalAmount) },
          { header: 'Tráº¡ng thÃ¡i', render: (o) => <StatusBadge status={o.status} /> },
        ]}
      />

      <h3 style={{ marginTop: 28 }}>3. Danh sÃ¡ch MÃ£ Khuyáº¿n mÃ£i (Vouchers â€” Sales & Marketing)</h3>
      <DataTable
        keyField="voucherId"
        data={vouchers}
        columns={[
          { header: 'MÃ£ Code', render: (v) => <code>{v.code}</code> },
          { header: 'Loáº¡i giáº£m', render: (v) => v.discountType },
          { header: 'GiÃ¡ trá»‹', render: (v) => v.discountValue },
          { header: 'ÄÆ¡n tá»‘i thiá»ƒu', render: (v) => formatVND(v.minOrderValue) },
          { header: 'LÆ°á»£t dÃ¹ng', render: (v) => `${v.usedCount} / ${v.usageLimit}` },
          { header: 'Tráº¡ng thÃ¡i', render: (v) => <StatusBadge status={v.status} /> },
        ]}
      />
    </div>
  );
};