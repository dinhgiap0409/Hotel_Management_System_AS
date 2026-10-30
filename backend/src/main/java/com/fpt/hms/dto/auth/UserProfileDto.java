package com.fpt.hms.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileDto {
    private Integer accountId;
    private String email;
    private String fullName;
    private String phone;
    private String role;
    private String status;
}