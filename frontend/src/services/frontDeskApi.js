import { http } from '../lib/http';

export const frontDeskApi = {
  getActiveStays: () => http.get('/front-desk/stays/active'),
  checkIn: (bookingId, roomId) =>
    http.post('/front-desk/check-in', null, { params: { bookingId, roomId } }),
  checkOut: (stayId) => http.post(`/front-desk/check-out/${stayId}`),
};