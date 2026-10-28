package com.fpt.hms.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "[Audit_Log]")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "audit_log_id")
    private Integer auditLogId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_account_id")
    private Account actorAccount;

    @Column(name = "actor_type", nullable = false, length = 30)
    private String actorType;

    @Column(name = "action", nullable = false, length = 30)
    private String action;

    @Column(name = "entity_name", nullable = false, length = 100)
    private String entityName;

    @Column(name = "record_id", nullable = false)
    private Integer recordId;

    @Column(name = "old_values", columnDefinition = "NVARCHAR(MAX)")
    private String oldValues;

    @Column(name = "new_values", columnDefinition = "NVARCHAR(MAX)")
    private String newValues;

    @Column(name = "reason", length = 500)
    private String reason;

    @Column(name = "trace_id", length = 36)
    private String traceId;

    @Column(name = "performed_at", nullable = false)
    private Instant performedAt = Instant.now();
}
