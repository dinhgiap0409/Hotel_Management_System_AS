package com.fpt.hms.dto.billing_report;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewSubmitRequest {
    @NotNull(message = "Vui lòng chọn kỳ lưu trú cần đánh giá")
    private Integer stayId;

    @NotNull(message = "Vui lòng chọn số sao đánh giá")
    @Min(value = 1, message = "Điểm đánh giá tối thiểu là 1 sao")
    @Max(value = 5, message = "Điểm đánh giá tối đa là 5 sao")
    private Integer rating;

    @NotBlank(message = "Vui lòng nhập nội dung nhận xét về phòng và kỳ lưu trú")
    private String comment;
}

