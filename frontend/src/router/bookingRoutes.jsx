import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { Route } from 'react-router-dom';
import { HomePage } from '../pages/home/HomePage';
import { LandingSearchPage } from '../pages/booking/LandingSearchPage';
import { RoomDetailPage } from '../pages/booking/RoomDetailPage';
import { VnPayCallbackPage } from '../pages/booking/VnPayCallbackPage';
import { MyBookingsPage } from '../pages/booking/MyBookingsPage';
import { RoleGuard } from '../components/common/RoleGuard';
import { PublicBookingGuard } from '../components/common/PublicBookingGuard';
import { ROLES } from '../config/constants';

export const bookingPublicRoutes = (
  <>
    <Route
      path="/"
      element={
        <PublicBookingGuard>
          <HomePage />
        </PublicBookingGuard>
      }
    />
    <Route
      path="/rooms"
      element={
        <PublicBookingGuard>
          <LandingSearchPage />
        </PublicBookingGuard>
      }
    />
    <Route
      path="/rooms/:roomTypeId"
      element={
        <PublicBookingGuard>
          <RoomDetailPage />
        </PublicBookingGuard>
      }
    />
    <Route path="/booking/payment-callback" element={<VnPayCallbackPage />} />
    <Route
      path="/my-bookings"
      element={
        <RoleGuard allowedRoles={[ROLES.CUSTOMER]}>
          <MyBookingsPage />
        </RoleGuard>
      }
    />
  </>
);
