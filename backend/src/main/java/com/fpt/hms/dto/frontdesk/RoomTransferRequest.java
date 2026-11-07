package com.fpt.hms.dto.frontdesk;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomTransferRequest {

    @NotNull(message = "Phải chọn phòng vật lý mới cần chuyển đến.")
    private Integer targetRoomId;

    private String reason;

    private BigDecimal additionalCharge;
}

