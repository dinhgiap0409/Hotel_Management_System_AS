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
public class AuditLogDto {
    private Integer auditLogId;
    private Integer actorAccountId;
    private String actorEmail;
    private String actorType;
    private String action;
    private String entityName;
    private Integer recordId;
    private String oldValues;
    private String newValues;
    private String reason;
    private String traceId;
    private Instant performedAt;
}
