import { Routes, Route } from 'react-router-dom';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { StaffLayout } from '../layouts/StaffLayout';
import { authPublicRoutes, authStaffRoutes } from './authRoutes';
import { roomStaffRoutes } from './roomRoutes';
import { bookingPublicRoutes } from './bookingRoutes';
import { frontDeskStaffRoutes } from './frontDeskRoutes';
import { billingStaffRoutes } from './billingRoutes';

export const AppRouter = () => {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        {bookingPublicRoutes}
        {authPublicRoutes}
      </Route>
      <Route element={<StaffLayout />}>
        {authStaffRoutes}
        {roomStaffRoutes}
        {frontDeskStaffRoutes}
        {billingStaffRoutes}
      </Route>
    </Routes>
  );
};