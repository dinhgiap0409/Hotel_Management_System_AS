package com.fpt.hms.dto.billing_report;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewReplyRequest {
    @NotBlank(message = "Vui lòng nhập nội dung phản hồi của khách sạn")
    private String managementReply;
}

