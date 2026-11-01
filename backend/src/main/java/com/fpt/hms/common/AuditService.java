package com.fpt.hms.common;

import com.fpt.hms.dto.auth.AuditConfigDto;
import com.fpt.hms.entity.Account;
import com.fpt.hms.entity.AuditLog;
import com.fpt.hms.repository.AccountRepository;
import com.fpt.hms.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Set;

/**
 * Audit Logging & Parameter Configuration Service (SDD Section 4.1.3.3, BR-42, UC-48, UC-49).
 */
@Service
@RequiredArgsConstructor
public class AuditService {

    private static final Set<String> SECURITY_ACTIONS = Set.of(
            "LOGIN_SUCCESS", "LOGIN_FAILED", "LOGIN_LOCKED", "LOGOUT",
            "REGISTER_ACCOUNT", "CHANGE_PASSWORD", "PASSWORD_RESET_REQUEST",
            "PASSWORD_RESET_COMPLETE", "USER_STATUS_CHANGE", "ROLE_CHANGE",
            "CREATE_USER", "UPDATE_AUDIT_CONFIG"
    );

    private final AuditLogRepository auditLogRepository;
    private final AccountRepository accountRepository;

    // Runtime Audit Configuration Parameters
    private volatile boolean auditEnabled = true;
    private volatile boolean logSecurityEvents = true;
    private volatile boolean logOperationalEvents = true;
    private volatile int retentionDays = 365;
    private volatile Instant configUpdatedAt = Instant.now();
    private volatile String configUpdatedBy = "SYSTEM";

    public AuditConfigDto getAuditConfig() {
        return AuditConfigDto.builder()
                .auditEnabled(auditEnabled)
                .logSecurityEvents(logSecurityEvents)
                .logOperationalEvents(logOperationalEvents)
                .retentionDays(retentionDays)
                .updatedAt(configUpdatedAt)
                .updatedBy(configUpdatedBy)
                .build();
    }

    @Transactional
    public AuditConfigDto updateAuditConfig(AuditConfigDto request, Integer actorAccountId, String actorEmail, String actorRole) {
        String oldSummary = String.format("enabled=%s, security=%s, operational=%s, retentionDays=%d",
                this.auditEnabled, this.logSecurityEvents, this.logOperationalEvents, this.retentionDays);

        this.auditEnabled = request.isAuditEnabled();
        this.logSecurityEvents = request.isLogSecurityEvents();
        this.logOperationalEvents = request.isLogOperationalEvents();
        this.retentionDays = Math.max(30, request.getRetentionDays());
        this.configUpdatedAt = Instant.now();
        this.configUpdatedBy = actorEmail;

        String newSummary = String.format("enabled=%s, security=%s, operational=%s, retentionDays=%d",
                this.auditEnabled, this.logSecurityEvents, this.logOperationalEvents, this.retentionDays);

        // Always record changes to audit configuration itself
        saveLogEntry(actorAccountId, actorRole, "UPDATE_AUDIT_CONFIG", "Audit_Config", 1,
                oldSummary, newSummary, "Updated audit parameters");

        return getAuditConfig();
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void recordAction(Integer actorAccountId,
                             String actorType,
                             String action,
                             String entityName,
                             Integer recordId,
                             String oldValues,
                             String newValues,
                             String reason) {
        if (!auditEnabled) {
            return;
        }
        boolean isSecurity = SECURITY_ACTIONS.contains(action);
        if (isSecurity && !logSecurityEvents) {
            return;
        }
        if (!isSecurity && !logOperationalEvents) {
            return;
        }
        saveLogEntry(actorAccountId, actorType, action, entityName, recordId, oldValues, newValues, reason);
    }

    private void saveLogEntry(Integer actorAccountId,
                              String actorType,
                              String action,
                              String entityName,
                              Integer recordId,
                              String oldValues,
                              String newValues,
                              String reason) {
        Account actor = actorAccountId != null
                ? accountRepository.findById(actorAccountId).orElse(null)
                : null;
        AuditLog logEntry = AuditLog.builder()
                .actorAccount(actor)
                .actorType(actorType != null ? actorType : "SYSTEM")
                .action(action)
                .entityName(entityName)
                .recordId(recordId != null ? recordId : 0)
                .oldValues(oldValues)
                .newValues(newValues)
                .reason(reason)
                .traceId(MDC.get(TraceIdFilter.MDC_TRACE_ID_KEY))
                .performedAt(Instant.now())
                .build();
        auditLogRepository.save(logEntry);
    }
}
