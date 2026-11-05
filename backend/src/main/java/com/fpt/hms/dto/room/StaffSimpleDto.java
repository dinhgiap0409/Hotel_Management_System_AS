package com.fpt.hms.dto.room;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Lightweight staff DTO for task assignment dropdowns (UC-51).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffSimpleDto {
    private Integer staffId;
    private String staffCode;
    private String fullName;
    private String email;
    private String roleName;
}
