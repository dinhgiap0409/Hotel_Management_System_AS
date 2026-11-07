import { Route } from 'react-router-dom';
import { ServicesAndBillingPage } from '../pages/services-billing/ServicesAndBillingPage';
import { CustomerServiceOrderPage } from '../pages/services-billing/CustomerServiceOrderPage';
import { ReportsDashboardPage } from '../pages/reports-reviews/ReportsDashboardPage';
import { RoleGuard } from '../components/common/RoleGuard';
import { ROLES } from '../config/constants';

export const billingCustomerRoutes = (
  <>
    <Route
      path="/customer/room-service"
      element={
        <RoleGuard allowedRoles={[ROLES.CUSTOMER]}>
          <CustomerServiceOrderPage />
        </RoleGuard>
      }
    />
    <Route
      path="/services"
      element={
        <RoleGuard allowedRoles={[ROLES.CUSTOMER]}>
          <CustomerServiceOrderPage />
        </RoleGuard>
      }
    />
  </>
);

export const billingStaffRoutes = (
  <>
    <Route
      path="/staff/services-billing"
      element={
        <RoleGuard
          allowedRoles={[
            ROLES.SERVICE_STAFF,
            ROLES.SERVICE_MANAGER,
            ROLES.ACCOUNTANT,
            ROLES.SALES_MANAGER,
            ROLES.FRONT_DESK,
            ROLES.GENERAL_MANAGER,
            ROLES.ADMIN,
          ]}
        >
          <ServicesAndBillingPage />
        </RoleGuard>
      }
    />
    <Route
      path="/staff/reports"
      element={
        <RoleGuard allowedRoles={[ROLES.GENERAL_MANAGER, ROLES.ACCOUNTANT, ROLES.SALES_MANAGER, ROLES.ADMIN]}>
          <ReportsDashboardPage />
        </RoleGuard>
      }
    />
  </>
);