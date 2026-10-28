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
            msg.setSubject("[HMS] Booking Confirmation - " + reservationCode);
            msg.setText("Dear " + guestName + ",\nYour booking (" + reservationCode + ") has been confirmed.");
            mailSender.send(msg);
        } catch (Exception ex) {
            log.warn("SMTP mail dispatch skipped/failed in local dev environment: {}", ex.getMessage());
        }
    }
}