package com.fpt.hms.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;

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

    // Customer specific fields
    private Integer customerId;
    private String identityNumber;

    // Staff specific fields
    private Integer staffId;
    private String staffCode;
    private Integer departmentId;
    private String departmentName;
    private String gender;
    private LocalDate dateOfBirth;
    private String address;
    private LocalDate hireDate;
    private String employmentStatus;

    // Security & governance metadata
    private Integer failedLoginAttempts;
    private Instant lockedUntil;
    private Instant createdAt;
}
