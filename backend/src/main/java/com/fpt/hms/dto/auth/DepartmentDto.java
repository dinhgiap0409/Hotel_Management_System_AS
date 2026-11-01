package com.fpt.hms.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentDto {
    private Integer departmentId;
    private String departmentName;
    private String description;
    private Integer managerId;
    private String managerName;
}
