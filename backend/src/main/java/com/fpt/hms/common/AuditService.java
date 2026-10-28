package com.fpt.hms.common;

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

/**
 * Audit Logging Service (SDD Section 4.1.3.3 & BR-42).
 */
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final AccountRepository accountRepository;

    @Transactional(propagation = Propagation.REQUIRED)
    public void recordAction(Integer actorAccountId,
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
