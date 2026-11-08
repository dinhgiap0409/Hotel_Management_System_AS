package com.fpt.hms.dto.billing_report;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewModerateRequest {
    @NotNull(message = "Vui lòng chọn trạng thái hiển thị")
    private Boolean isHidden;

    private String hiddenReason;
}

