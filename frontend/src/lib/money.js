/**
 * Standardized VND Currency formatting (SDD Section 4.1.1.2 & CR-12).
 */
export function formatVND(amount) {
  if (amount === undefined || amount === null || amount === '') return '0 VND';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0 VND';
  return new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' VND';
}

export const formatVnd = formatVND;