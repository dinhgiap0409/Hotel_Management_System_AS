import { http } from '../lib/http';

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
  cancelPreOrder: (reservationId, serviceId, itemIndex = null, cancelQuantity = null, cancelReason = '') =>
    http.delete('/billing/pre-orders', {
      params: {
        reservationId,
        serviceId,
        ...(itemIndex !== null && itemIndex !== undefined ? { itemIndex } : {}),
        ...(cancelQuantity !== null && cancelQuantity !== undefined ? { cancelQuantity } : {}),
        ...(cancelReason ? { cancelReason } : {}),
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

  // --- Feature 2: UC-37..UC-40 (Folio Breakdown, Vouchers, Settlement & Invoicing) ---
  getFolioDetail: (stayId) => http.get(`/billing/stays/${stayId}/folio`),
  addAdditionalCharge: (folioId, data) => http.post(`/billing/folios/${folioId}/additional-charges`, data),
  deleteAdditionalCharge: (chargeId) => http.delete(`/billing/additional-charges/${chargeId}`),

  createVoucher: (data) => http.post('/billing/vouchers', data),
  updateVoucher: (voucherId, data) => http.put(`/billing/vouchers/${voucherId}`, data),
  toggleVoucherStatus: (voucherId, status) =>
    http.patch(`/billing/vouchers/${voucherId}/status`, null, { params: { status } }),
  validateVoucher: (data) => http.post('/billing/vouchers/validate', data),

  settleFolio: (stayId, data) => http.post(`/billing/stays/${stayId}/settle-folio`, data),
  createFolioVnPayUrl: (stayId, data) => http.post(`/billing/stays/${stayId}/vnpay-url`, data),
  processFolioVnPayCallback: (data) => http.post('/billing/vnpay-callback', data),
  getInvoiceDetail: (invoiceId) => http.get(`/billing/invoices/${invoiceId}`),
  getInvoiceByStay: (stayId) => http.get(`/billing/invoices/by-stay/${stayId}`),

  // --- Feature 3: Module 5 (UC-41..UC-47 & UC-50: Hotel & Room Reviews + Management Analytics) ---
  getPublishedReviews: (params = {}) => http.get('/reviews/published', { params }),
  getAllReviewsForModeration: () => http.get('/reviews'),
  getMyStaysForReview: () => http.get('/reviews/my-stays'),
  submitReview: (data) => http.post('/reviews', data),
  replyToReview: (reviewId, managementReply) =>
    http.patch(`/reviews/${reviewId}/reply`, { managementReply }),
  moderateReviewVisibility: (reviewId, isHidden, hiddenReason = '') =>
    http.patch(`/reviews/${reviewId}/visibility`, { isHidden, hiddenReason }),
  getManagementAnalytics: (fromDate, toDate) =>
    http.get('/reports/analytics', {
      params: {
        ...(fromDate ? { fromDate } : {}),
        ...(toDate ? { toDate } : {}),
      },
    }),
  getReportsSummary: () => http.get('/reports/summary'),
};
