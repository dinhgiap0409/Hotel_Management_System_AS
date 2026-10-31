import { useEffect, useState } from 'react';
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
      <h2>Dịch vụ Nội khu, Hóa đơn Folio & Khuyến mãi (UC-21..UC-26)</h2>
      <p style={{ color: '#64748b' }}>
        Phân quyền chuyên biệt: <strong>Service Manager</strong> quản lý danh mục dịch vụ; <strong>Accountant</strong> kiểm soát hóa đơn & hoàn tiền; <strong>Sales & Marketing Manager</strong> quản lý Voucher.
      </p>

      <h3>1. Danh mục Dịch vụ Khách sạn (POS Services)</h3>
      <DataTable
        keyField="serviceId"
        data={services}
        columns={[
          { header: 'Mã DV', render: (s) => `#${s.serviceId}` },
          { header: 'Tên dịch vụ', render: (s) => <strong>{s.serviceName}</strong> },
          { header: 'Nhóm', render: (s) => s.category },
          { header: 'Đơn giá', render: (s) => `${formatVND(s.unitPrice)} / ${s.unit}` },
          { header: 'Trạng thái', render: (s) => <StatusBadge status={s.status} /> },
        ]}
      />

      <h3 style={{ marginTop: 28 }}>2. Đơn gọi Dịch vụ của Khách (Service Orders)</h3>
      <DataTable
        keyField="orderId"
        data={orders}
        columns={[
          { header: 'Mã Order', render: (o) => `#${o.orderId}` },
          { header: 'Tổng tiền', render: (o) => formatVND(o.totalAmount) },
          { header: 'Trạng thái', render: (o) => <StatusBadge status={o.status} /> },
        ]}
      />

      <h3 style={{ marginTop: 28 }}>3. Danh sách Mã Khuyến mãi (Vouchers — Sales & Marketing)</h3>
      <DataTable
        keyField="voucherId"
        data={vouchers}
        columns={[
          { header: 'Mã Code', render: (v) => <code>{v.code}</code> },
          { header: 'Loại giảm', render: (v) => v.discountType },
          { header: 'Giá trị', render: (v) => v.discountValue },
          { header: 'Đơn tối thiểu', render: (v) => formatVND(v.minOrderValue) },
          { header: 'Lượt dùng', render: (v) => `${v.usedCount} / ${v.usageLimit}` },
          { header: 'Trạng thái', render: (v) => <StatusBadge status={v.status} /> },
        ]}
      />
    </div>
  );
};