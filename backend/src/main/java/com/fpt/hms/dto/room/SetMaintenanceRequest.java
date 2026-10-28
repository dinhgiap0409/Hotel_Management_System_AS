package com.fpt.hms.dto.room;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class SetMaintenanceRequest {
    @NotBlank(message = "Maintenance reason is required")
    @Size(max = 500)
    private String maintenanceReason;

    @NotNull(message = "Estimated completion date is required")
    @Future(message = "Estimated completion must be after today")
    private LocalDate estimatedCompletionDate;
}