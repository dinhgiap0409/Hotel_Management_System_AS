import { getStatusLabel } from '../../config/constants';

const STATUS_COLORS = {
  ACTIVE: { bg: '#dcfce7', text: '#166534' },
  Active: { bg: '#dcfce7', text: '#166534' },
  Available: { bg: '#dcfce7', text: '#166534' },
  AVAILABLE: { bg: '#dcfce7', text: '#166534' },
  VACANT: { bg: '#dcfce7', text: '#166534' },
  Vacant: { bg: '#dcfce7', text: '#166534' },
  Clean: { bg: '#dcfce7', text: '#166534' },
  CLEAN: { bg: '#dcfce7', text: '#166534' },
  INSPECTED: { bg: '#dbeafe', text: '#1e40af' },
  Inspected: { bg: '#dbeafe', text: '#1e40af' },
  Confirmed: { bg: '#dbeafe', text: '#1e40af' },
  CONFIRMED: { bg: '#dbeafe', text: '#1e40af' },
  CheckedIn: { bg: '#e0e7ff', text: '#3730a3' },
  CHECKED_IN: { bg: '#e0e7ff', text: '#3730a3' },
  OCCUPIED: { bg: '#e0e7ff', text: '#3730a3' },
  Occupied: { bg: '#e0e7ff', text: '#3730a3' },
  Completed: { bg: '#dcfce7', text: '#166534' },
  COMPLETED: { bg: '#dcfce7', text: '#166534' },
  PAID: { bg: '#dcfce7', text: '#166534' },
  Paid: { bg: '#dcfce7', text: '#166534' },
  RESOLVED: { bg: '#dcfce7', text: '#166534' },
  Pending: { bg: '#fef9c3', text: '#854d0e' },
  PENDING: { bg: '#fef9c3', text: '#854d0e' },
  UNPAID: { bg: '#fef9c3', text: '#854d0e' },
  Unpaid: { bg: '#fef9c3', text: '#854d0e' },
  NEW: { bg: '#fef9c3', text: '#854d0e' },
  OPEN: { bg: '#fef9c3', text: '#854d0e' },
  IN_PROGRESS: { bg: '#e0f2fe', text: '#0369a1' },
  Dirty: { bg: '#fee2e2', text: '#991b1b' },
  DIRTY: { bg: '#fee2e2', text: '#991b1b' },
  MAINTENANCE: { bg: '#fee2e2', text: '#991b1b' },
  UNDER_MAINTENANCE: { bg: '#fee2e2', text: '#991b1b' },
  LOCKED: { bg: '#fee2e2', text: '#991b1b' },
  Cancelled: { bg: '#fee2e2', text: '#991b1b' },
  CANCELLED: { bg: '#fee2e2', text: '#991b1b' },
  INACTIVE: { bg: '#f1f5f9', text: '#475569' },
  Inactive: { bg: '#f1f5f9', text: '#475569' },
  ADMIN: { bg: '#ede9fe', text: '#5b21b6' },
  GENERAL_MANAGER: { bg: '#fef3c7', text: '#92400e' },
  SALES_MANAGER: { bg: '#e0f2fe', text: '#0369a1' },
  HOUSEKEEPING_MANAGER: { bg: '#dcfce7', text: '#166534' },
  SERVICE_MANAGER: { bg: '#fce7f3', text: '#9d174d' },
  ACCOUNTANT: { bg: '#ffedd5', text: '#9a3412' },
  FRONT_DESK: { bg: '#dbeafe', text: '#1e40af' },
  HOUSEKEEPING: { bg: '#d1fae5', text: '#065f46' },
  SERVICE_STAFF: { bg: '#fae8ff', text: '#86198f' },
  CUSTOMER: { bg: '#f1f5f9', text: '#334155' },
};

export const StatusBadge = ({ status }) => {
  const style = STATUS_COLORS[status] || STATUS_COLORS[String(status).toUpperCase()] || { bg: '#e2e8f0', text: '#1e293b' };
  const label = getStatusLabel(status);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: style.bg,
        color: style.text,
      }}
    >
      {label}
    </span>
  );
};
