import React from 'react';
import { Route } from 'react-router-dom';
import { HousekeepingBoardPage } from '../pages/housekeeping/HousekeepingBoardPage';
import { RoomInventoryPage } from '../pages/manager-rooms/RoomInventoryPage';
import { RoleGuard } from '../components/common/RoleGuard';
import { ROLES } from '../config/constants';

export const roomStaffRoutes = (
  <>
    <Route
      path="/staff/housekeeping"
      element={
        <RoleGuard allowedRoles={[ROLES.HOUSEKEEPING, ROLES.HOUSEKEEPING_MANAGER, ROLES.GENERAL_MANAGER, ROLES.ADMIN]}>
          <HousekeepingBoardPage />
        </RoleGuard>
      }
    />
    <Route
      path="/staff/rooms"
      element={
        <RoleGuard allowedRoles={[ROLES.SALES_MANAGER, ROLES.HOUSEKEEPING_MANAGER, ROLES.GENERAL_MANAGER, ROLES.ADMIN]}>
          <RoomInventoryPage />
        </RoleGuard>
      }
    />
  </>
);