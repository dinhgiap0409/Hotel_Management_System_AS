package com.fpt.hms.integration;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Outbound SMTP Mail Notification Service (UC-10, UC-23, UC-26).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MailNotificationService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:dangkhang16125@gmail.com}")
    private String fromEmail;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public void sendBookingConfirmation(String toEmail, String reservationCode, String guestName) {
        if (toEmail == null || toEmail.isBlank() || toEmail.endsWith("@walkin.hotel.local")) {
            return;
        }
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom("HMS Luxury Hotel <" + fromEmail + ">");
            msg.setTo(toEmail.trim());
            msg.setSubject("[HMS Luxury Hotel] Xác nhận đặt phòng thành công - Mã #" + reservationCode);
            msg.setText("Xin chào " + guestName + ",\n\n"
                    + "Cảm ơn quý khách đã lựa chọn HMS Luxury Hotel.\n"
                    + "Đơn đặt phòng của quý khách với mã [#" + reservationCode + "] đã được ghi nhận trên hệ thống.\n"
                    + "Quý khách có thể tra cứu trạng thái đơn đặt phòng tại mục 'Đặt phòng của tôi' trên website.\n\n"
                    + "Trân trọng,\nBan Quản lý HMS Luxury Hotel");
            mailSender.send(msg);
            log.info("Booking confirmation email sent to: {} for code: #{}", toEmail, reservationCode);
        } catch (Exception ex) {
            log.warn("SMTP mail dispatch skipped/failed in local dev environment: {}", ex.getMessage());
        }
    }

    /**
     * Gửi email biên nhận xác nhận đặt phòng trực tiếp tại Quầy Lễ Tân (Direct Booking / Walk-in) (UC-26).
     */
    public void sendDirectBookingConfirmation(String toEmail, String reservationCode, String guestName,
                                              String roomTypeName, int roomQuantity,
                                              LocalDate checkInDate, LocalDate checkOutDate,
                                              BigDecimal depositAmount, String paymentMethod) {
        if (toEmail == null || toEmail.isBlank() || toEmail.endsWith("@walkin.hotel.local")) {
            return;
        }
        try {
            String checkInStr = checkInDate != null ? checkInDate.format(DATE_FORMATTER) : "—";
            String checkOutStr = checkOutDate != null ? checkOutDate.format(DATE_FORMATTER) : "—";
            String depositStr = depositAmount != null ? String.format("%,d", depositAmount.longValue()) : "0";

            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom("HMS Luxury Hotel <" + fromEmail + ">");
            msg.setTo(toEmail.trim());
            msg.setSubject("[HMS Luxury Hotel] Xác nhận đặt phòng tại Quầy Lễ Tân - Mã #" + reservationCode);
            msg.setText("Kính gửi Quý khách " + guestName + ",\n\n"
                    + "HMS Luxury Hotel xin trân trọng thông báo đơn đặt phòng trực tiếp tại Quầy Lễ Tân của Quý khách đã được xác nhận thành công:\n"
                    + "--------------------------------------------------\n"
                    + "• Mã đặt phòng: #" + reservationCode + "\n"
                    + "• Khách đại diện: " + guestName + "\n"
                    + "• Hạng phòng: " + (roomTypeName != null ? roomTypeName : "Phòng tiêu chuẩn") + " (Số lượng: " + roomQuantity + " phòng)\n"
                    + "• Thời gian lưu trú: Từ " + checkInStr + " (14:00) đến " + checkOutStr + " (12:00)\n"
                    + "• Tiền cọc đã ghi nhận: " + depositStr + " VND\n"
                    + "• Hình thức thanh toán: " + (paymentMethod != null ? paymentMethod : "Tiền mặt / Chuyển khoản QR") + "\n"
                    + "--------------------------------------------------\n"
                    + "Đơn đặt phòng của Quý khách đã sẵn sàng để làm thủ tục nhận phòng (Check-in).\n"
                    + "Khi đến nhận phòng, Quý khách vui lòng xuất trình CCCD/Hộ chiếu tại Quầy Lễ Tân.\n\n"
                    + "Chúc Quý khách một kỳ nghỉ tuyệt vời và nhiều trải nghiệm đáng nhớ tại HMS Luxury Hotel!\n\n"
                    + "Trân trọng,\nBộ phận Lễ tân — HMS Luxury Hotel\nHotline: 1900 6868 | Website: http://localhost:5173");
            mailSender.send(msg);
            log.info("Direct booking confirmation email sent to: {} for code: #{}", toEmail, reservationCode);
        } catch (Exception ex) {
            log.warn("SMTP direct booking confirmation email dispatch failed: {}", ex.getMessage());
        }
    }
}
