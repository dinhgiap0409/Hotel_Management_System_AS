package com.fpt.hms.integration;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Outbound SMTP Mail Notification Service (UC-10, UC-23, UC-26).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MailNotificationService {

    private final JavaMailSender mailSender;

    public void sendBookingConfirmation(String toEmail, String reservationCode, String guestName) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setTo(toEmail);
            msg.setSubject("[HMS Luxury Hotel] Xác nhận đặt phòng thành công - Mã " + reservationCode);
            msg.setText("Xin chào " + guestName + ",\n\n"
                    + "Cảm ơn quý khách đã lựa chọn HMS Luxury Hotel.\n"
                    + "Đơn đặt phòng của quý khách với mã [" + reservationCode + "] đã được ghi nhận trên hệ thống.\n"
                    + "Quý khách có thể tra cứu trạng thái đơn đặt phòng tại mục 'Đặt phòng của tôi' trên website.\n\n"
                    + "Trân trọng,\nBan Quản lý HMS Luxury Hotel");
            mailSender.send(msg);
        } catch (Exception ex) {
            log.warn("SMTP mail dispatch skipped/failed in local dev environment: {}", ex.getMessage());
        }
    }
}
