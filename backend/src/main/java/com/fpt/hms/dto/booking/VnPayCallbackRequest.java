package com.fpt.hms.dto.booking;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;

@Data
public class VnPayCallbackRequest {
    @NotBlank(message = "Mã đặt phòng (vnp_TxnRef) không được để trống")
    private String reservationCode;

    @NotBlank(message = "Mã phản hồi giao dịch (vnp_ResponseCode) không được để trống")
    private String vnpResponseCode;

    private String vnpTransactionNo;

    private String bankCode;

    /**
     * Amount returned by VNPay in the smallest unit (VND x 100). The backend
     * verifies it against the deposit amount stored for the reservation.
     */
    private Long vnpAmount;

    /** HMAC-SHA512 signature returned by VNPay (vnp_SecureHash). Required in production mode. */
    private String vnpSecureHash;

    private String vnpSecureHashType;

    /**
     * True only when the result comes from the simulated gateway page
     * (mode=gateway, DEMO_TMN). The backend only honours it when the server
     * itself is configured in demo mode; otherwise a signature is required.
     */
    private Boolean demoMode;

    /**
     * All vnp_* query parameters VNPay returned, forwarded verbatim by the
     * frontend so the backend can recompute the signature. Without the full
     * parameter set the signature cannot be verified.
     */
    private Map<String, String> vnpParams;
}

