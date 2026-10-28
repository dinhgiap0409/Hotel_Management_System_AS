package com.fpt.hms.controller;

import com.fpt.hms.common.AuditService;
import com.fpt.hms.common.PageResponse;
import com.fpt.hms.dto.auth.UserProfileDto;
import com.fpt.hms.entity.Account;
import com.fpt.hms.entity.AuditLog;
import com.fpt.hms.entity.Role;
import com.fpt.hms.exception.BusinessException;
import com.fpt.hms.exception.ResourceNotFoundException;
import com.fpt.hms.repository.AccountRepository;
import com.fpt.hms.repository.AuditLogRepository;
import com.fpt.hms.repository.RoleRepository;
import com.fpt.hms.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/**
 * Module 1 (Owner: KhangND) - User Governance & Audit Logs Controller (UC-07, UC-08, UC-09, UC-48, UC-49).
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Tag(name = "1B. Admin User & Audit Governance (Module 1 - KhangND)")
public class AdminUserController {

    private final AccountRepository accountRepository;
    private final RoleRepository roleRepository;
    private final AuditLogRepository auditLogRepository;
    private final AuditService auditService;

    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "UC-07: List all user accounts with server-side pagination (ADMIN only)")
    public ResponseEntity<PageResponse<UserProfileDto>> listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<UserProfileDto> mapped = accountRepository.findAll(PageRequest.of(page, size))
                .map(acc -> UserProfileDto.builder()
                        .accountId(acc.getAccountId())
                        .email(acc.getEmail())
                        .fullName(acc.getEmail())
                        .role(acc.getRole().getRoleName())
                        .status(acc.getStatus())
                        .build());
        return ResponseEntity.ok(PageResponse.from(mapped));
    }

    @PatchMapping("/users/{accountId}/status")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    @Operation(summary = "UC-08: Toggle user account Active/Inactive status and revoke tokens immediately (ADMIN only)")
    public ResponseEntity<UserProfileDto> toggleUserStatus(
            @PathVariable Integer accountId,
            @RequestParam String status,
            @AuthenticationPrincipal UserPrincipal admin) {
        if (admin.getAccountId().equals(accountId)) {
            // BR-05: Administrators cannot deactivate their own account
            throw new BusinessException("BR-05", "Administrators cannot deactivate their own account.");
        }
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));
        String oldStatus = account.getStatus();
        account.setStatus(status.toUpperCase());
        account.setTokenVersion(account.getTokenVersion() + 1); // SDD 4.1.5.1 immediate token revocation
        accountRepository.save(account);

        auditService.recordAction(admin.getAccountId(), admin.getRoleName(), "USER_STATUS_CHANGE",
                "Account", accountId, oldStatus, account.getStatus(), "Toggled by Admin");

        return ResponseEntity.ok(UserProfileDto.builder()
                .accountId(account.getAccountId())
                .email(account.getEmail())
                .role(account.getRole().getRoleName())
                .status(account.getStatus())
                .build());
    }

    @PatchMapping("/users/{accountId}/role")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    @Operation(summary = "UC-09: Assign specialized staff role (FRONT_DESK, HOUSEKEEPING, SERVICE_STAFF, SALES_MANAGER, HOUSEKEEPING_MANAGER, SERVICE_MANAGER, ACCOUNTANT, GENERAL_MANAGER, ADMIN)")
    public ResponseEntity<UserProfileDto> assignUserRole(
            @PathVariable Integer accountId,
            @RequestParam String roleName,
            @AuthenticationPrincipal UserPrincipal admin) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));
        Role newRole = roleRepository.findByRoleName(roleName.toUpperCase())
                .orElseThrow(() -> new ResourceNotFoundException("Role not found: " + roleName));

        String oldRole = account.getRole().getRoleName();
        account.setRole(newRole);
        account.setTokenVersion(account.getTokenVersion() + 1);
        accountRepository.save(account);

        auditService.recordAction(admin.getAccountId(), admin.getRoleName(), "ROLE_CHANGE",
                "Account", accountId, oldRole, newRole.getRoleName(), "Role updated by Admin");

        return ResponseEntity.ok(UserProfileDto.builder()
                .accountId(account.getAccountId())
                .email(account.getEmail())
                .role(account.getRole().getRoleName())
                .status(account.getStatus())
                .build());
    }

    @GetMapping("/audit-logs")
    @PreAuthorize("hasAnyRole('ADMIN', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-49: Inspect system & operational audit logs (ADMIN & GENERAL_MANAGER)")
    public ResponseEntity<PageResponse<AuditLog>> listAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(PageResponse.from(auditLogRepository.findAll(PageRequest.of(page, size))));
    }
}
