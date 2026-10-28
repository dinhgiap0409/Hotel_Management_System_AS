import { http } from '../lib/http';

export const billingApi = {
  getActiveServices: () => http.get('/services'),
  getServiceOrders: () => http.get('/service-orders'),
  createServiceOrder: (data) => http.post('/service-orders', data),
  getInvoices: () => http.get('/invoices'),
  getVouchers: () => http.get('/vouchers'),
  getReviews: () => http.get('/reviews'),
  getDashboardKpi: () => http.get('/reports/kpi'),
};