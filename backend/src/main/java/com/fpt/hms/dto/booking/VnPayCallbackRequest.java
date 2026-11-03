package com.fpt.hms.dto.booking;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VnPayCallbackRequest {
    @NotBlank(message = "Mã đặt phòng (vnp_TxnRef) không được để trống")
    private String reservationCode;

    @NotBlank(message = "Mã phản hồi giao dịch (vnp_ResponseCode) không được để trống")
    private String vnpResponseCode;

    private String vnpTransactionNo;

    private String bankCode;
}

