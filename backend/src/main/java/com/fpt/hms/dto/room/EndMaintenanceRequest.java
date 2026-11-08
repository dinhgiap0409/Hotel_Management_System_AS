package com.fpt.hms.dto.room;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * End Room Maintenance Request.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EndMaintenanceRequest {

    @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
    private String resolutionNote;

    /**
     * Trạng thái vệ sinh tiếp theo (mặc định là DIRTY để nhân viên vào dọn dẹp).
     */
    private String cleaningStatus;
}

