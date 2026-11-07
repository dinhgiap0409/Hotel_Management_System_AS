import { Route } from 'react-router-dom';
import { HousekeepingBoardPage } from '../pages/housekeeping/HousekeepingBoardPage';
import { RoomInventoryPage } from '../pages/manager-rooms/RoomInventoryPage';
import { RoleGuard } from '../components/common/RoleGuard';
import { ROLES } from '../config/constants';

export const roomStaffRoutes = (
  <>
    {/* Bảng buồng phòng & Nhiệm vụ vệ sinh: Dành riêng cho bộ phận buồng phòng */}
    <Route
      path="/staff/housekeeping"
      element={
        <RoleGuard allowedRoles={[ROLES.HOUSEKEEPING, ROLES.HOUSEKEEPING_MANAGER, ROLES.ADMIN]}>
          <HousekeepingBoardPage />
        </RoleGuard>
      }
    />
    {/* Quản lý Hạng phòng & Sơ đồ kho phòng: Dành cho Sales Manager & Housekeeping Manager */}
    <Route
      path="/staff/rooms"
      element={
        <RoleGuard allowedRoles={[ROLES.SALES_MANAGER, ROLES.HOUSEKEEPING_MANAGER, ROLES.ADMIN]}>
          <RoomInventoryPage />
        </RoleGuard>
      }
    />
  </>
);
