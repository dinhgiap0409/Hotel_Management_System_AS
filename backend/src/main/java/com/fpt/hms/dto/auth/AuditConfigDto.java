package com.fpt.hms.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditConfigDto {
    private boolean auditEnabled;
    private boolean logSecurityEvents;
    private boolean logOperationalEvents;
    private int retentionDays;
    private Instant updatedAt;
    private String updatedBy;
}
