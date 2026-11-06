import { Routes, Route } from 'react-router-dom';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { StaffLayout } from '../layouts/StaffLayout';
import { authPublicRoutes, authStaffRoutes } from './authRoutes';
import { roomStaffRoutes } from './roomRoutes';
import { bookingPublicRoutes } from './bookingRoutes';
import { frontDeskStaffRoutes } from './frontDeskRoutes';
import { billingStaffRoutes, billingCustomerRoutes } from './billingRoutes';
import { NotFoundPage } from '../components/common/NotFoundPage';

export const AppRouter = () => {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        {bookingPublicRoutes}
        {authPublicRoutes}
        {billingCustomerRoutes}
      </Route>
      <Route element={<StaffLayout />}>
        {authStaffRoutes}
        {roomStaffRoutes}
        {frontDeskStaffRoutes}
        {billingStaffRoutes}
      </Route>
      {/*
        Catch-all: mọi URL không khớp route nào ở trên (gõ sai URL, vào trang
        không tồn tại như /booking/checkout, /admin/... với role không khớp)
        đều rơi về NotFoundPage (403 cho đường dẫn nội bộ/đặt phòng, 404 cho
        các đường dẫn còn lại) thay vì render layout với Outlet trống
        (trang trắng). Route "*" có độ ưu tiên thấp nhất nên các route đã
        định nghĩa ở trên vẫn khớp trước.
      */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
