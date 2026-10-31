import { Route } from 'react-router-dom';
import { FrontDeskDashboardPage } from '../pages/frontdesk/FrontDeskDashboardPage';
import { RoleGuard } from '../components/common/RoleGuard';
import { ROLES } from '../config/constants';

export const frontDeskStaffRoutes = (
  <Route
    path="/staff/frontdesk"
    element={
      <RoleGuard allowedRoles={[ROLES.FRONT_DESK, ROLES.GENERAL_MANAGER, ROLES.ADMIN]}>
        <FrontDeskDashboardPage />
      </RoleGuard>
    }
  />
);