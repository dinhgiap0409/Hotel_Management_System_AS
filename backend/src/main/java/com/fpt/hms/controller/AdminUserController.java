package com.fpt.hms.controller;

import com.fpt.hms.common.AuditService;
import com.fpt.hms.dto.auth.*;
import com.fpt.hms.entity.SystemErrorLog;
import com.fpt.hms.exception.ResourceNotFoundException;
import com.fpt.hms.repository.SystemErrorLogRepository;
import com.fpt.hms.security.UserPrincipal;
import com.fpt.hms.service.AuthenticationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Module 1 (Owner: KhangND) - User Governance, 10-Role Assignment & Audit Logs Controller
 * Covers UC-07, UC-08, UC-09, UC-10, UC-48, UC-49.
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Tag(name = "1B. Admin User & Audit Governance (Module 1 - KhangND)")
public class AdminUserController {

    private final AuthenticationService authenticationService;
    private final AuditService auditService;
    private final SystemErrorLogRepository systemErrorLogRepository;

    // =========================================================================
    // UC-07: LIST, SEARCH, VIEW, CREATE & UPDATE USER ACCOUNTS
    // =========================================================================
    @GetMapping({"/users", "/accounts"})
    @PreAuthorize("hasAnyRole('ADMIN', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-07: Search & filter user accounts by keyword, role, or status")
    public ResponseEntity<List<UserProfileDto>> listUsers(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(authenticationService.listAllUsers(keyword, role, status));
    }

    @GetMapping("/users/{accountId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-07: View detailed user profile by accountId")
    public ResponseEntity<UserProfileDto> getUserById(@PathVariable Integer accountId) {
        return ResponseEntity.ok(authenticationService.getUserById(accountId));
    }

    @PostMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "UC-07: Create a new Staff/Manager or Customer account (ADMIN only)")
    public ResponseEntity<UserProfileDto> createUser(
            @Valid @RequestBody AdminCreateUserRequest request,
            @AuthenticationPrincipal UserPrincipal admin) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(authenticationService.createUserByAdmin(request, admin));
    }

    @PutMapping("/users/{accountId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "UC-07: Update user account details (ADMIN only)")
    public ResponseEntity<UserProfileDto> updateUser(
            @PathVariable Integer accountId,
            @Valid @RequestBody AdminUpdateUserRequest request,
            @AuthenticationPrincipal UserPrincipal admin) {
        return ResponseEntity.ok(authenticationService.updateUserByAdmin(accountId, request, admin));
    }

    // =========================================================================
    // UC-08: LOCK / UNLOCK / TOGGLE ACCOUNT STATUS
    // =========================================================================
    @PatchMapping({"/users/{accountId}/status", "/accounts/{accountId}/status"})
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "UC-08: Change user status (ACTIVE, LOCKED, INACTIVE) and revoke tokens immediately")
    public ResponseEntity<UserProfileDto> toggleUserStatus(
            @PathVariable Integer accountId,
            @RequestParam String status,
            @AuthenticationPrincipal UserPrincipal admin) {
        return ResponseEntity.ok(authenticationService.updateUserStatus(accountId, status, admin));
    }

    // =========================================================================
    // UC-09: ASSIGN SPECIALIZED ROLE (10 ROLES) & DEPARTMENT
    // =========================================================================
    @PatchMapping("/users/{accountId}/role")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "UC-09: Assign one of the 10 specialized roles and optional department")
    public ResponseEntity<UserProfileDto> assignUserRole(
            @PathVariable Integer accountId,
            @RequestParam String roleName,
            @RequestParam(required = false) Integer departmentId,
            @AuthenticationPrincipal UserPrincipal admin) {
        return ResponseEntity.ok(authenticationService.assignUserRole(accountId, roleName, departmentId, admin));
    }

    // =========================================================================
    // UC-10: LIST ROLES (10 ROLES) & DEPARTMENTS (7 DEPARTMENTS)
    // =========================================================================
    @GetMapping("/roles")
    @PreAuthorize("hasAnyRole('ADMIN', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-10: Get all 10 system roles with descriptions")
    public ResponseEntity<List<RoleDto>> listRoles() {
        return ResponseEntity.ok(authenticationService.listAllRoles());
    }

    @GetMapping("/departments")
    @PreAuthorize("hasAnyRole('ADMIN', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-10: Get all 7 hotel departments with managers")
    public ResponseEntity<List<DepartmentDto>> listDepartments() {
        return ResponseEntity.ok(authenticationService.listAllDepartments());
    }

    // =========================================================================
    // UC-48: CONFIGURE AUDIT PARAMETERS
    // =========================================================================
    @GetMapping("/audit-config")
    @PreAuthorize("hasAnyRole('ADMIN', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-48: View current audit logging configuration parameters")
    public ResponseEntity<AuditConfigDto> getAuditConfig() {
        return ResponseEntity.ok(auditService.getAuditConfig());
    }

    @PutMapping("/audit-config")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "UC-48: Update audit logging parameters (ADMIN only)")
    public ResponseEntity<AuditConfigDto> updateAuditConfig(
            @RequestBody AuditConfigDto request,
            @AuthenticationPrincipal UserPrincipal admin) {
        return ResponseEntity.ok(auditService.updateAuditConfig(
                request, admin.getAccountId(), admin.getEmail(), admin.getRoleName()));
    }

    // =========================================================================
    // UC-49: INSPECT SECURITY & OPERATIONAL AUDIT LOGS + SYSTEM ERROR LOGS
    // =========================================================================
    @GetMapping("/audit-logs")
    @PreAuthorize("hasAnyRole('ADMIN', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-49: Search and filter immutable Audit Logs (ADMIN & GENERAL_MANAGER)")
    public ResponseEntity<List<AuditLogDto>> listAuditLogs(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String entityName) {
        return ResponseEntity.ok(authenticationService.listAuditLogs(keyword, action, entityName));
    }

    @GetMapping("/error-logs")
    @PreAuthorize("hasAnyRole('ADMIN', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-49: Inspect System Error Logs (500 Trace IDs)")
    public ResponseEntity<List<SystemErrorLog>> listErrorLogs() {
        return ResponseEntity.ok(systemErrorLogRepository.findAllByOrderByOccurredAtDesc());
    }

    @PatchMapping("/error-logs/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    @Operation(summary = "UC-49: Mark a System Error Log as RESOLVED or IGNORED")
    public ResponseEntity<SystemErrorLog> updateErrorLogStatus(
            @PathVariable Long id,
            @RequestParam String status) {
        SystemErrorLog err = systemErrorLogRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bản ghi lỗi #" + id));
        err.setStatus(status.trim().toUpperCase());
        return ResponseEntity.ok(systemErrorLogRepository.save(err));
    }
}
