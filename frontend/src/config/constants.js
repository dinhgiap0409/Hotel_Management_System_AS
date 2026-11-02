export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

export const ROLES = {
  ADMIN: 'ADMIN',
  GENERAL_MANAGER: 'GENERAL_MANAGER',
  SALES_MANAGER: 'SALES_MANAGER',
  HOUSEKEEPING_MANAGER: 'HOUSEKEEPING_MANAGER',
  SERVICE_MANAGER: 'SERVICE_MANAGER',
  ACCOUNTANT: 'ACCOUNTANT',
  FRONT_DESK: 'FRONT_DESK',
  HOUSEKEEPING: 'HOUSEKEEPING',
  SERVICE_STAFF: 'SERVICE_STAFF',
  CUSTOMER: 'CUSTOMER',
};

export const STAFF_ROLES = [
  ROLES.ADMIN,
  ROLES.GENERAL_MANAGER,
  ROLES.SALES_MANAGER,
  ROLES.HOUSEKEEPING_MANAGER,
  ROLES.SERVICE_MANAGER,
  ROLES.ACCOUNTANT,
  ROLES.FRONT_DESK,
  ROLES.HOUSEKEEPING,
  ROLES.SERVICE_STAFF,
];

export const ROLE_DEFAULT_ROUTES = {
  ADMIN: '/admin/users',
  GENERAL_MANAGER: '/staff/reports',
  SALES_MANAGER: '/staff/rooms',
  HOUSEKEEPING_MANAGER: '/staff/housekeeping',
  SERVICE_MANAGER: '/staff/services-billing',
  ACCOUNTANT: '/staff/reports',
  FRONT_DESK: '/staff/frontdesk',
  HOUSEKEEPING: '/staff/housekeeping',
  SERVICE_STAFF: '/staff/services-billing',
  CUSTOMER: '/',
};

export const ROLE_LABELS = {
  ADMIN: 'Quản trị viên Hệ thống',
  GENERAL_MANAGER: 'Tổng Quản lý',
  SALES_MANAGER: 'Trưởng phòng Kinh doanh & Tiếp thị',
  HOUSEKEEPING_MANAGER: 'Trưởng bộ phận Buồng phòng',
  HOUSEKEEPING: 'Nhân viên Buồng phòng',
  SERVICE_MANAGER: 'Trưởng bộ phận Dịch vụ',
  SERVICE_STAFF: 'Nhân viên Dịch vụ',
  ACCOUNTANT: 'Kế toán',
  FRONT_DESK: 'Nhân viên Lễ tân',
  CUSTOMER: 'Khách hàng',
  SYSTEM: 'Hệ thống',
};

export const DEPARTMENT_LABELS = {
  1: 'Phòng Công nghệ Thông tin & Kỹ thuật',
  2: 'Ban Giám đốc Điều hành',
  3: 'Phòng Kinh doanh & Tiếp thị',
  4: 'Bộ phận Buồng phòng',
  5: 'Bộ phận Dịch vụ & Tiện ích',
  6: 'Phòng Tài chính - Kế toán',
  7: 'Bộ phận Tiền sảnh & Lễ tân',
  'IT & Technical Department': 'Phòng Công nghệ Thông tin & Kỹ thuật',
  'Executive Management Board': 'Ban Giám đốc Điều hành',
  'Sales & Marketing Department': 'Phòng Kinh doanh & Tiếp thị',
  'Housekeeping Department': 'Bộ phận Buồng phòng',
  'Services & Ancillary Division': 'Bộ phận Dịch vụ & Tiện ích',
  'Accounting & Finance Department': 'Phòng Tài chính - Kế toán',
  'Front Office Department': 'Bộ phận Tiền sảnh & Lễ tân',
};

export const STATUS_LABELS = {
  // Trạng thái tài khoản & nhân sự
  ACTIVE: 'Đang hoạt động',
  Active: 'Đang hoạt động',
  LOCKED: 'Đang bị khóa',
  Locked: 'Đang bị khóa',
  INACTIVE: 'Ngừng hoạt động',
  Inactive: 'Ngừng hoạt động',
  ON_LEAVE: 'Đang nghỉ phép',
  RESIGNED: 'Đã nghỉ việc',

  // Trạng thái phòng vật lý & vệ sinh
  AVAILABLE: 'Phòng trống',
  Available: 'Phòng trống',
  VACANT: 'Phòng trống',
  Vacant: 'Phòng trống',
  OCCUPIED: 'Đang có khách',
  Occupied: 'Đang có khách',
  BOOKED: 'Đã đặt trước',
  Booked: 'Đã đặt trước',
  MAINTENANCE: 'Đang bảo trì',
  Maintenance: 'Đang bảo trì',
  UNDER_MAINTENANCE: 'Đang bảo trì',
  UnderMaintenance: 'Đang bảo trì',
  CLEAN: 'Đã dọn sạch',
  Clean: 'Đã dọn sạch',
  DIRTY: 'Chưa dọn',
  Dirty: 'Chưa dọn',
  INSPECTED: 'Đã kiểm tra',
  Inspected: 'Đã kiểm tra',

  // Trạng thái đặt phòng, lưu trú, hóa đơn & công việc
  PENDING: 'Chờ xác nhận',
  Pending: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  Confirmed: 'Đã xác nhận',
  CHECKED_IN: 'Đang lưu trú',
  CheckedIn: 'Đang lưu trú',
  CHECKED_OUT: 'Đã trả phòng',
  CheckedOut: 'Đã trả phòng',
  COMPLETED: 'Hoàn thành',
  Completed: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  Cancelled: 'Đã hủy',
  NO_SHOW: 'Không đến',
  NoShow: 'Không đến',
  UNPAID: 'Chưa thanh toán',
  Unpaid: 'Chưa thanh toán',
  PARTIALLY_PAID: 'Thanh toán một phần',
  PartiallyPaid: 'Thanh toán một phần',
  PAID: 'Đã thanh toán',
  Paid: 'Đã thanh toán',
  REFUNDED: 'Đã hoàn tiền',
  VOIDED: 'Đã hủy dịch vụ',
  DELIVERED: 'Đã phục vụ',
  IN_PROGRESS: 'Đang xử lý',
  InProgress: 'Đang xử lý',
  ASSIGNED: 'Đã phân công',
  NEW: 'Mới ghi nhận',
  OPEN: 'Chưa xử lý',
  RESOLVED: 'Đã xử lý',

  // Mức độ ưu tiên
  LOW: 'Thấp',
  Low: 'Thấp',
  MEDIUM: 'Trung bình',
  Medium: 'Trung bình',
  NORMAL: 'Bình thường',
  Normal: 'Bình thường',
  HIGH: 'Cao',
  High: 'Cao',
  URGENT: 'Khẩn cấp',
  Urgent: 'Khẩn cấp',
};

export const AUDIT_ACTION_LABELS = {
  LOGIN_SUCCESS: 'Đăng nhập thành công',
  LOGIN_LOCKED: 'Tạm khóa do sai mật khẩu',
  LOGOUT: 'Đăng xuất hệ thống',
  REGISTER_ACCOUNT: 'Đăng ký tài khoản khách hàng',
  CREATE_USER: 'Tạo tài khoản nhân sự',
  UPDATE_USER: 'Cập nhật thông tin người dùng',
  USER_STATUS_CHANGE: 'Thay đổi trạng thái tài khoản',
  ROLE_CHANGE: 'Phân quyền vai trò',
  CHANGE_PASSWORD: 'Đổi mật khẩu cá nhân',
  PASSWORD_RESET_REQUEST: 'Yêu cầu khôi phục mật khẩu',
  PASSWORD_RESET_COMPLETE: 'Đặt lại mật khẩu thành công',
  UPDATE_PROFILE: 'Cập nhật hồ sơ cá nhân',
  UPDATE_AUDIT_CONFIG: 'Cập nhật cấu hình kiểm toán',
};

export const getRoleLabel = (role) => {
  if (!role) return '-';
  return ROLE_LABELS[role] || ROLE_LABELS[String(role).toUpperCase()] || role;
};

export const getDepartmentLabel = (deptNameOrId) => {
  if (!deptNameOrId) return '-';
  return DEPARTMENT_LABELS[deptNameOrId] || deptNameOrId;
};

export const getStatusLabel = (status) => {
  if (!status) return '-';
  return (
    STATUS_LABELS[status] ||
    STATUS_LABELS[String(status).toUpperCase()] ||
    ROLE_LABELS[status] ||
    ROLE_LABELS[String(status).toUpperCase()] ||
    status
  );
};

export const getAuditActionLabel = (action) => {
  if (!action) return '-';
  return AUDIT_ACTION_LABELS[action] || AUDIT_ACTION_LABELS[String(action).toUpperCase()] || action;
};
