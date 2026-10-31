import { Route } from 'react-router-dom';
import { LandingSearchPage } from '../pages/booking/LandingSearchPage';
import { MyBookingsPage } from '../pages/booking/MyBookingsPage';
import { RoleGuard } from '../components/common/RoleGuard';
import { ROLES } from '../config/constants';

export const bookingPublicRoutes = (
  <>
    <Route path="/" element={<LandingSearchPage />} />
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