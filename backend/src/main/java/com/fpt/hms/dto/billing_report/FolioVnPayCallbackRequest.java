package com.fpt.hms.dto.billing_report;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FolioVnPayCallbackRequest {

    @NotBlank(message = "Mã tham chiếu giao dịch (vnp_TxnRef) không được để trống")
    private String txnRef;

    @NotBlank(message = "Mã phản hồi giao dịch (vnp_ResponseCode) không được để trống")
    private String vnpResponseCode;

    private String vnpTransactionNo;

    private String bankCode;

    private Long vnpAmount;

    private String vnpSecureHash;

    private String vnpSecureHashType;

    private Map<String, String> vnpParams;
}

