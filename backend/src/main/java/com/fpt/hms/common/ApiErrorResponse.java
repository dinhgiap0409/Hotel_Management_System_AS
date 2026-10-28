package com.fpt.hms.common;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Collections;
import java.util.List;

/**
 * Standardized API error response payload (SDD Section 4.1.2.1).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiErrorResponse {
    private Instant timestamp;
    private int status;
    private String errorCode;
    private String message;
    private String path;
    private String traceId;
    @Builder.Default
    private List<FieldValidationError> validationErrors = Collections.emptyList();
}
