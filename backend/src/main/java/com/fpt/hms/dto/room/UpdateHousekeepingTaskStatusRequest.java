package com.fpt.hms.dto.room;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * UC-51: Update Housekeeping Task Status Request (HOUSEKEEPING, HOUSEKEEPING_MANAGER).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateHousekeepingTaskStatusRequest {

    @NotBlank(message = "Trạng thái nhiệm vụ không được để trống (IN_PROGRESS, COMPLETED, CANCELLED)")
    private String status;

    @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
    private String note;
}

