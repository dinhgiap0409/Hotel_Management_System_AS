package com.fpt.hms.dto.room;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * UC-16: Update Physical Room Request (HOUSEKEEPING_MANAGER, ADMIN).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateRoomRequest {

    @NotNull(message = "Hạng phòng không được để trống")
    private Integer roomTypeId;

    @NotBlank(message = "Số phòng không được để trống")
    @Size(max = 100, message = "Số phòng tối đa 100 ký tự")
    private String roomNumber;

    @NotNull(message = "Tầng không được để trống")
    @Min(value = 1, message = "Tầng phải từ 1 trở lên")
    private Integer floor;

    @Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
    private String notes;
}
