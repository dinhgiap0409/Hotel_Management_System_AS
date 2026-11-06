successfully downloaded text file (SHA: f1c5725f744e234133785498b6d000c3be979a05)import { http } from '../lib/http';

export const billingApi = {
  // --- Existing function names kept for backward compatibility ---
  getActiveServices: () => http.get('/billing/services'),
  getServiceOrders: (stayId) =>
    http.get('/billing/service-orders', { params: stayId ? { stayId } : {} }),
  createServiceOrder: (data) => http.post('/billing/service-orders', data),
  getInvoices: () => http.get('/invoices'),
  getVouchers: () => http.get('/billing/vouchers'),
  getReviews: () => http.get('/reviews'),
  getDashboardKpi: () => http.get('/reports/kpi'),

  // --- Feature 1: UC-31..UC-36 ---
  getActiveStays: () => http.get('/billing/active-stays'),
  getMyConfirmedReservations: () => http.get('/billing/my-confirmed-reservations'),
  getAllUpcomingPreOrders: () => http.get('/billing/pre-orders'),
  createPreOrder: (data) => http.post('/billing/pre-orders', data),
  cancelPreOrder: (reservationId, serviceId, itemIndex = null, cancelQuantity = null) =>
    http.delete('/billing/pre-orders', {
      params: {
        reservationId,
        serviceId,
        ...(itemIndex !== null && itemIndex !== undefined ? { itemIndex } : {}),
        ...(cancelQuantity !== null && cancelQuantity !== undefined ? { cancelQuantity } : {}),
      },
    }),
  getAllServices: () => http.get('/billing/services/all'),
  createService: (data) => http.post('/billing/services', data),
  updateService: (serviceId, data) => http.put(`/billing/services/${serviceId}`, data),
  toggleServiceStatus: (serviceId, status) =>
    http.patch(`/billing/services/${serviceId}/status`, null, { params: { status } }),
  confirmServiceOrder: (orderId) => http.patch(`/billing/service-orders/${orderId}/confirm`),
  completeServiceOrder: (orderId) => http.patch(`/billing/service-orders/${orderId}/complete`),
  voidServiceOrder: (orderId, cancelReason) =>
    http.patch(`/billing/service-orders/${orderId}/void`, null, { params: { cancelReason } }),
};
