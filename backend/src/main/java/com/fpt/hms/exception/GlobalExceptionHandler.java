package com.fpt.hms.exception;

import com.fpt.hms.common.ApiErrorResponse;
import com.fpt.hms.common.FieldValidationError;
import com.fpt.hms.common.MessageResolver;
import com.fpt.hms.common.TraceIdFilter;
import com.fpt.hms.entity.SystemErrorLog;
import com.fpt.hms.repository.SystemErrorLogRepository;
import com.fpt.hms.security.UserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Centralized Exception Handler (SDD Section 4.1.2.1 - Table 4.1-2).
 */
@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {

    private final MessageResolver messageResolver;
    private final SystemErrorLogRepository systemErrorLogRepository;

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException ex,
                                                             HttpServletRequest request) {
        List<FieldValidationError> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(err -> FieldValidationError.builder()
                        .field(err.getField())
                        .code(err.getCode())
                        .message(err.getDefaultMessage())
                        .build())
                .toList();

        String detailedValidationMessage = fieldErrors.stream()
                .map(FieldValidationError::getMessage)
                .filter(msg -> msg != null && !msg.isBlank())
                .distinct()
                .collect(java.util.stream.Collectors.joining("; "));
        if (detailedValidationMessage.isEmpty()) {
            detailedValidationMessage = messageResolver.resolve("VALIDATION_ERROR");
        }

        ApiErrorResponse payload = ApiErrorResponse.builder()
                .timestamp(Instant.now())
                .status(HttpStatus.BAD_REQUEST.value())
                .errorCode("VALIDATION_ERROR")
                .message(detailedValidationMessage)
                .path(request.getRequestURI())
                .traceId(MDC.get(TraceIdFilter.MDC_TRACE_ID_KEY))
                .validationErrors(fieldErrors)
                .build();

        return ResponseEntity.badRequest().body(payload);
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiErrorResponse> handleBusinessException(BusinessException ex,
                                                                    HttpServletRequest request) {
        log.warn("Business rule violation [{}]: {}", ex.getErrorCode(), ex.getMessage());
        return buildResponse(ex.getHttpStatus(), ex.getErrorCode(),
                ex.getMessage() != null ? ex.getMessage() : messageResolver.resolve(ex.getErrorCode()),
                request);
    }

    @ExceptionHandler(InvalidReservationStateException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidState(InvalidReservationStateException ex,
                                                               HttpServletRequest request) {
        return buildResponse(HttpStatus.CONFLICT, ex.getErrorCode(), ex.getMessage(), request);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNotFound(ResourceNotFoundException ex,
                                                           HttpServletRequest request) {
        return buildResponse(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", ex.getMessage(), request);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiErrorResponse> handleAuthException(AuthenticationException ex,
                                                                HttpServletRequest request) {
        return buildResponse(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS",
                messageResolver.resolve("MSG01B"), request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(AccessDeniedException ex,
                                                               HttpServletRequest request) {
        return buildResponse(HttpStatus.FORBIDDEN, "AUTH_FORBIDDEN",
                messageResolver.resolve("AUTH_FORBIDDEN"), request);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponse> handleMaxUploadSize(MaxUploadSizeExceededException ex,
                                                                HttpServletRequest request) {
        log.warn("Upload rejected: file exceeds the configured size limit");
        return buildResponse(HttpStatus.PAYLOAD_TOO_LARGE, "MSG_IMAGE_TOO_LARGE",
                "Dung lượng ảnh vượt quá giới hạn cho phép (tối đa 5 MB mỗi file, 25 MB mỗi lần tải lên).",
                request);
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<ApiErrorResponse> handleOptimisticLock(OptimisticLockingFailureException ex,
                                                                 HttpServletRequest request) {
        return buildResponse(HttpStatus.CONFLICT, "CONCURRENT_UPDATE",
                "The record was modified by another user. Please refresh and try again.", request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleGenericException(Exception ex,
                                                                   HttpServletRequest request) {
        String traceId = MDC.get(TraceIdFilter.MDC_TRACE_ID_KEY);
        log.error("Unhandled internal error [traceId={}]: ", traceId, ex);
        persistSystemErrorLog(ex, request, traceId);
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
                messageResolver.resolve("INTERNAL_ERROR"), request);
    }

    private void persistSystemErrorLog(Exception ex, HttpServletRequest request, String traceId) {
        try {
            String safeTraceId = (traceId != null && !traceId.isBlank())
                    ? truncate(traceId, 36)
                    : UUID.randomUUID().toString();

            Integer userId = null;
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal) {
                userId = principal.getAccountId();
            }

            String forwardedFor = request.getHeader("X-Forwarded-For");
            String rawIp = (forwardedFor != null && !forwardedFor.isBlank())
                    ? forwardedFor.split(",")[0].trim()
                    : request.getRemoteAddr();

            StringWriter sw = new StringWriter();
            ex.printStackTrace(new PrintWriter(sw));

            String rawMessage = (ex.getMessage() != null && !ex.getMessage().isBlank())
                    ? ex.getMessage()
                    : ex.getClass().getName();

            SystemErrorLog errorLog = SystemErrorLog.builder()
                    .traceId(safeTraceId)
                    .occurredAt(Instant.now())
                    .level("ERROR")
                    .source("BACKEND")
                    .errorCode("INTERNAL_ERROR")
                    .httpStatus(HttpStatus.INTERNAL_SERVER_ERROR.value())
                    .message(rawMessage)
                    .stackTrace(truncate(sw.toString(), 8000))
                    .userId(userId)
                    .clientIp(truncate(rawIp, 45))
                    .userAgent(truncate(request.getHeader("User-Agent"), 255))
                    .endpoint(truncate(request.getRequestURI(), 255))
                    .httpMethod(truncate(request.getMethod(), 10))
                    .status("NEW")
                    .build();

            systemErrorLogRepository.save(errorLog);
        } catch (Exception persistEx) {
            log.warn("Could not persist SystemErrorLog to database: {}", persistEx.getMessage());
        }
    }

    private String truncate(String value, int maxLen) {
        if (value == null) {
            return null;
        }
        return value.length() > maxLen ? value.substring(0, maxLen) : value;
    }

    private ResponseEntity<ApiErrorResponse> buildResponse(HttpStatus status,
                                                           String errorCode,
                                                           String message,
                                                           HttpServletRequest request) {
        ApiErrorResponse payload = ApiErrorResponse.builder()
                .timestamp(Instant.now())
                .status(status.value())
                .errorCode(errorCode)
                .message(message)
                .path(request.getRequestURI())
                .traceId(MDC.get(TraceIdFilter.MDC_TRACE_ID_KEY))
                .build();
        return ResponseEntity.status(status).body(payload);
    }
}
