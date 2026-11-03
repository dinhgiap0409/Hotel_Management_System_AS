import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { Route } from 'react-router-dom';
import { HomePage } from '../pages/home/HomePage';
import { LandingSearchPage } from '../pages/booking/LandingSearchPage';
import { RoomDetailPage } from '../pages/booking/RoomDetailPage';
import { MyBookingsPage } from '../pages/booking/MyBookingsPage';
import { RoleGuard } from '../components/common/RoleGuard';
import { ROLES } from '../config/constants';

export const bookingPublicRoutes = (
  <>
    <Route path="/" element={<HomePage />} />
    <Route path="/rooms" element={<LandingSearchPage />} />
    <Route path="/rooms/:roomTypeId" element={<RoomDetailPage />} />
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
