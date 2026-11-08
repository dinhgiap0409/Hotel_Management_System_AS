import { http } from '../lib/http';

export const frontDeskApi = {
  getAvailableRoomTypes: (params) => http.get('/front-desk/available-room-types', { params }),
  calculateBookingQuote: (data) => http.post('/front-desk/quote', data),
  createDirectBooking: (data) => http.post('/front-desk/direct-booking', data),
  confirmCashPayment: (code) => http.post(`/front-desk/reservations/${encodeURIComponent(code)}/confirm-cash`),
  getPaymentStatus: (code) => http.get(`/front-desk/reservations/${encodeURIComponent(code)}/payment-status`),
  cancelDirectBooking: (code, reason) =>
    http.post(`/front-desk/reservations/${encodeURIComponent(code)}/cancel`, null, { params: reason ? { reason } : {} }),
  getArrivals: () => http.get('/front-desk/arrivals'),
  getAvailableRoomsForCheckIn: (roomTypeId) =>
    http.get('/front-desk/available-rooms', { params: roomTypeId ? { roomTypeId } : {} }),
  checkIn: (data) => http.post('/front-desk/check-in', data),
  getActiveStays: () => http.get('/front-desk/active-stays'),
  extendStay: (stayId, data) => http.post(`/front-desk/stays/${stayId}/extend`, data),
  transferRoom: (stayId, data) => http.post(`/front-desk/stays/${stayId}/transfer`, data),
  checkOut: (stayId) => http.post(`/front-desk/stays/${stayId}/check-out`),
  settleStayFolio: (stayId, params) => http.post(`/billing/stays/${stayId}/settle`, null, { params }),
};
