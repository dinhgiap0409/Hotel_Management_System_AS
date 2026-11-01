package com.fpt.hms.dto.room;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Bulk update/set pricing schedule for a Room Type.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateRoomTypePricesRequest {

    @NotEmpty(message = "Danh sách biểu giá không được để trống")
    @Valid
    private List<RoomTypePriceDto> prices;
}
