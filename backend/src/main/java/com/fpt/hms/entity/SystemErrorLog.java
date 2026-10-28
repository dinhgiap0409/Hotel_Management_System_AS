package com.fpt.hms.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "[System_Error_Log]")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SystemErrorLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "trace_id", nullable = false, length = 36)
    private String traceId;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt = Instant.now();

    @Column(name = "level", nullable = false, length = 10)
    private String level;

    @Column(name = "source", nullable = false, length = 10)
    private String source;

    @Column(name = "error_code", nullable = false, length = 40)
    private String errorCode;

    @Column(name = "http_status", nullable = false)
    private Integer httpStatus;

    @Column(name = "message", nullable = false, columnDefinition = "NVARCHAR(MAX)")
    private String message;

    @Column(name = "stack_trace", columnDefinition = "NVARCHAR(MAX)")
    private String stackTrace;

    @Column(name = "user_id")
    private Integer userId;

    @Column(name = "client_ip", length = 45)
    private String clientIp;

    @Column(name = "user_agent", length = 255)
    private String userAgent;

    @Column(name = "endpoint", length = 255)
    private String endpoint;

    @Column(name = "http_method", length = 10)
    private String httpMethod;

    @Column(name = "status", nullable = false, length = 15)
    private String status = "NEW";
}
