package com.fpt.hms.dto.frontdesk;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CheckInRequest {
    @NotNull(message = "Reservation ID is required")
    private Integer reservationId;

    @NotNull(message = "Physical Room ID is required")
    private Integer roomId;

    @NotBlank(message = "Guest National ID / Passport is required (BR-23)")
    private String guestIdNumber;

    private String keyCardNumber;
}