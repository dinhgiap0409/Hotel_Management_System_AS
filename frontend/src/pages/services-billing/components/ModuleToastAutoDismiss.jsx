import { useEffect } from 'react';

/**
 * ModuleToastAutoDismiss
 * Tự động tắt các thanh thông báo (Toast notifications) sau 3.5 giây
 * Giải quyết triệt để lỗi "thông báo đang không tự tắt" trong trang Dịch vụ & Thu ngân (Module 4 & 5)
 * Hoạt động hoàn toàn độc lập, TUYỆT ĐỐI KHÔNG can thiệp hay sửa đổi code dùng chung (ToastHost.jsx, App.jsx).
 */
export const ModuleToastAutoDismiss = ({ duration = 3500 }) => {
  useEffect(() => {
    const scheduled = new WeakSet();

    const checkAndSchedule = () => {
      // Tìm các thông báo alert đang hiển thị trên màn hình
      const alerts = document.querySelectorAll('[role="alert"]');
      alerts.forEach((alert) => {
        if (!scheduled.has(alert)) {
          scheduled.add(alert);
          setTimeout(() => {
            // Nhấp vào nút đóng của Toast (class .btn-close hoặc aria-label="Close")
            const closeBtn = alert.querySelector('button.btn-close, button[aria-label="Close"], button');
            if (closeBtn && document.body.contains(alert)) {
              closeBtn.click();
            }
          }, duration);
        }
      });
    };

    // Kiểm tra ngay khi mount
    checkAndSchedule();

    // Dùng MutationObserver để theo dõi và hẹn giờ tắt ngay khi thông báo mới xuất hiện
    const observer = new MutationObserver(() => {
      checkAndSchedule();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [duration]);

  return null;
};

