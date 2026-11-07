package com.fpt.hms.dto.frontdesk;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExtendStayRequest {
    @NotNull(message = "Ngày trả phòng mới là bắt buộc")
    private LocalDate newCheckOutDate;

    private String reason;
}

