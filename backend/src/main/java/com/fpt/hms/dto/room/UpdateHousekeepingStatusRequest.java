package com.fpt.hms.dto.room;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateHousekeepingStatusRequest {
    @NotBlank(message = "New housekeeping status is required")
    private String newCleaningStatus; // DIRTY, CLEAN, INSPECTED

    @Size(max = 500)
    private String notes;
}