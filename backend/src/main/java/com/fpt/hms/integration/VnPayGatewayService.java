successfully downloaded text file (SHA: 02f79da433cecb97cb41ffa2bc6168f42ac4b6e8)package com.fpt.hms.integration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.security.MessageDigest;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.TreeMap;

/**
 * VNPay Payment Gateway Integration Service (UC-23).
 * Supports both official VNPay v2.1.0 HMAC-SHA512 signed URLs and local Sandbox Gateway simulation when DEMO_TMN is used.
 */
@Service
public class VnPayGatewayService {

    @Value("${app.vnpay.tmn-code:DEMO_TMN}")
    private String vnpTmnCode;

    @Value("${app.vnpay.hash-secret:DEMO_SECRET}")
    private String vnpHashSecret;

    @Value("${app.vnpay.pay-url:https://sandbox.vnpayment.vn/paymentv2/vpcpay.html}")
    private String vnpPayUrl;

    @Value("${app.vnpay.return-url:http://localhost:5173/booking/payment-callback}")
    private String vnpReturnUrl;

    /**
     * Demo mode is on when no real VNPay terminal is configured. In demo mode
     * the frontend shows a simulated gateway page; in production mode VNPay
     * itself signs the return URL and the backend MUST verify that signature
     * (see {@link #verifyCallbackSignature}) — the frontend result alone is
     * never trusted.
     */
    public boolean isDemoMode() {
        return vnpTmnCode == null || vnpTmnCode.isBlank() || "DEMO_TMN".equalsIgnoreCase(vnpTmnCode.trim())
                || vnpHashSecret == null || vnpHashSecret.isBlank() || "DEMO_SECRET".equalsIgnoreCase(vnpHashSecret.trim());
    }

    /**
     * Verifies a VNPay return/IPN signature (VNPay v2.1.0, HMAC-SHA512).
     * The signed data is all {@code vnp_*} parameters except {@code vnp_SecureHash}
     * and {@code vnp_SecureHashType}, sorted by key, with URL-encoded values,
     * joined with '&' — exactly the format {@link #createDepositPaymentUrl} uses
     * when it signs a payment URL. Returns false when the signature is missing,
     * the parameter map is empty, or the hashes do not match (constant-time).
     */
    public boolean verifyCallbackSignature(Map<String, String> vnpParams, String secureHash) {
        if (vnpParams == null || vnpParams.isEmpty() || secureHash == null || secureHash.isBlank()) {
            return false;
        }
        Map<String, String> signed = new TreeMap<>();
        for (Map.Entry<String, String> entry : vnpParams.entrySet()) {
            String key = entry.getKey();
            if (key == null || "vnp_SecureHash".equals(key) || "vnp_SecureHashType".equals(key)) {
                continue;
            }
            if (key.startsWith("vnp_")) {
                signed.put(key, entry.getValue() != null ? entry.getValue() : "");
            }
        }
        if (signed.isEmpty()) {
            return false;
        }
        StringBuilder hashData = new StringBuilder();
        for (Map.Entry<String, String> entry : signed.entrySet()) {
            if (!hashData.isEmpty()) {
                hashData.append('&');
            }
            hashData.append(entry.getKey()).append('=').append(urlEncode(entry.getValue()));
        }
        String expected = hmacSHA512(vnpHashSecret, hashData.toString());
        if (expected == null || expected.isEmpty()) {
            return false;
        }
        return MessageDigest.isEqual(
                expected.toLowerCase().getBytes(StandardCharsets.UTF_8),
                secureHash.trim().toLowerCase().getBytes(StandardCharsets.UTF_8));
    }

    public String createDepositPaymentUrl(String reservationCode, BigDecimal amount) {
        long vnpAmount = amount.multiply(BigDecimal.valueOf(100)).longValue();

        // In local dev with DEMO_TMN, route to interactive VNPay Sandbox Gateway page on Frontend
        // so students/testers don't hit VNPay Error 71 (Website/Terminal not registered)
        if (vnpTmnCode == null || vnpTmnCode.isBlank() || "DEMO_TMN".equalsIgnoreCase(vnpTmnCode.trim())) {
            return vnpReturnUrl
                    + "?mode=gateway"
                    + "&vnp_TxnRef=" + urlEncode(reservationCode)
                    + "&vnp_Amount=" + vnpAmount
                    + "&vnp_OrderInfo=" + urlEncode("Thanh toan dat coc don dat phong " + reservationCode);
        }

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));

        Map<String, String> vnpParams = new TreeMap<>();
        vnpParams.put("vnp_Version", "2.1.0");
        vnpParams.put("vnp_Command", "pay");
        vnpParams.put("vnp_TmnCode", vnpTmnCode.trim());
        vnpParams.put("vnp_Amount", String.valueOf(vnpAmount));
        vnpParams.put("vnp_CurrCode", "VND");
        vnpParams.put("vnp_TxnRef", reservationCode);
        vnpParams.put("vnp_OrderInfo", "Thanh toan dat coc don dat phong " + reservationCode);
        vnpParams.put("vnp_OrderType", "hotel_booking");
        vnpParams.put("vnp_Locale", "vn");
        vnpParams.put("vnp_ReturnUrl", vnpReturnUrl);
        vnpParams.put("vnp_IpAddr", "127.0.0.1");
        vnpParams.put("vnp_CreateDate", now.format(fmt));
        vnpParams.put("vnp_ExpireDate", now.plusMinutes(15).format(fmt));

        StringBuilder hashData = new StringBuilder();
        StringBuilder query = new StringBuilder();
        for (Map.Entry<String, String> entry : vnpParams.entrySet()) {
            if (!hashData.isEmpty()) {
                hashData.append('&');
                query.append('&');
            }
            String encodedKey = urlEncode(entry.getKey());
            String encodedVal = urlEncode(entry.getValue());
            hashData.append(entry.getKey()).append('=').append(encodedVal);
            query.append(encodedKey).append('=').append(encodedVal);
        }

        String secureHash = hmacSHA512(vnpHashSecret, hashData.toString());
        return vnpPayUrl + "?" + query + "&vnp_SecureHash=" + secureHash;
    }

    private String urlEncode(String val) {
        return URLEncoder.encode(val != null ? val : "", StandardCharsets.UTF_8);
    }

    private String hmacSHA512(String key, String data) {
        try {
            Mac hmac512 = Mac.getInstance("HmacSHA512");
            SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA512");
            hmac512.init(secretKey);
            byte[] bytes = hmac512.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                sb.append(String.format("%02x", b & 0xff));
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }
}
