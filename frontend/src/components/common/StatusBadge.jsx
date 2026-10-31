const STATUS_COLORS = {
  Active: { bg: '#dcfce7', text: '#166534' },
  Available: { bg: '#dcfce7', text: '#166534' },
  Clean: { bg: '#dcfce7', text: '#166534' },
  Confirmed: { bg: '#dbeafe', text: '#1e40af' },
  CheckedIn: { bg: '#e0e7ff', text: '#3730a3' },
  Completed: { bg: '#dcfce7', text: '#166534' },
  Pending: { bg: '#fef9c3', text: '#854d0e' },
  Dirty: { bg: '#fee2e2', text: '#991b1b' },
  Cancelled: { bg: '#fee2e2', text: '#991b1b' },
  Inactive: { bg: '#f1f5f9', text: '#475569' },
};

export const StatusBadge = ({ status }) => {
  const style = STATUS_COLORS[status] || { bg: '#e2e8f0', text: '#1e293b' };
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
      {status}
    </span>
  );
};