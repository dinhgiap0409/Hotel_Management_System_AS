package com.fpt.hms.dto.billing_report;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoucherRequest {

    @NotBlank(message = "Mã voucher không được để trống")
    @Size(max = 50, message = "Mã voucher tối đa 50 ký tự")
    private String code;

    @NotBlank(message = "Loại giảm giá không được để trống (PERCENTAGE hoặc FIXED_AMOUNT)")
    private String discountType;

    @NotNull(message = "Giá trị giảm không được để trống")
    @DecimalMin(value = "0.01", message = "Giá trị giảm phải lớn hơn 0")
    private BigDecimal discountValue;

    @NotNull(message = "Thời gian bắt đầu áp dụng không được để trống")
    private Instant validFrom;

    @NotNull(message = "Thời gian kết thúc áp dụng không được để trống")
    private Instant validTo;

    @NotNull(message = "Mức chi tiêu tối thiểu không được để trống")
    @DecimalMin(value = "0.00", message = "Mức chi tiêu tối thiểu không được âm")
    private BigDecimal minSpend;

    @NotNull(message = "Mức giảm tối đa không được để trống")
    @DecimalMin(value = "0.00", message = "Mức giảm tối đa không được âm")
    private BigDecimal maxDiscountAmount;

    @NotNull(message = "Giới hạn số lượt dùng không được để trống")
    @Min(value = 1, message = "Giới hạn số lượt dùng tối thiểu là 1")
    private Integer usageLimit;

    @Builder.Default
    private String status = "ACTIVE";
}

