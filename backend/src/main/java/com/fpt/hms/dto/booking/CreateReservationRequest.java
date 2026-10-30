package com.fpt.hms.dto.booking;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateReservationRequest {
    @NotNull(message = "Room type ID is required")
    private Integer roomTypeId;

    @NotNull(message = "Check-in date is required")
    private LocalDate checkInDate;

    @NotNull(message = "Check-out date is required")
    private LocalDate checkOutDate;

    @Min(value = 1, message = "At least 1 guest is required")
    private int guestCount = 1;

    @Min(value = 1, message = "At least 1 room is required")
    private int quantity = 1;

    @NotBlank(message = "Contact name is required")
    @Size(max = 100)
    private String contactName;

    @NotBlank(message = "Contact email is required")
    @Email
    private String contactEmail;

    @NotBlank(message = "Contact phone is required")
    private String contactPhone;

    @Size(max = 500)
    private String specialNotes;
}