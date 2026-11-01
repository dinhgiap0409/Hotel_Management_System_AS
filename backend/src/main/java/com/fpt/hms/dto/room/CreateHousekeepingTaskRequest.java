package com.fpt.hms.dto.room;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;

/**
 * UC-51: Assign Housekeeping Task Request (HOUSEKEEPING_MANAGER).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateHousekeepingTaskRequest {

    @NotNull(message = "Phòng thực hiện nhiệm vụ không được để trống")
    private Integer roomId;

    @NotNull(message = "Nhân viên thực hiện không được để trống")
    private Integer assignedToStaffId;

    @NotBlank(message = "Loại nhiệm vụ không được để trống (CLEANING, MAINTENANCE)")
    private String taskType;

    private Instant scheduledAt;

    private LocalDate estimatedCompletionDate;

    @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
    private String note;
}

