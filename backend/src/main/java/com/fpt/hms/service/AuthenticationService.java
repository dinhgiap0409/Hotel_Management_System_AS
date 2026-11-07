package com.fpt.hms.service;

import com.fpt.hms.dto.auth.*;
import com.fpt.hms.security.UserPrincipal;

import java.util.List;
import java.util.Map;

/**
 * Module 1 (Owner: KhangND) - Authentication, Account & User Governance Service
 * Covers UC-01 to UC-10, UC-48, UC-49.
 */
public interface AuthenticationService {

    // UC-01: Customer Self-Registration (2-step with Email OTP Verification)
    Map<String, String> requestRegistrationOtp(RegisterRequest request);
    Map<String, String> resendRegistrationOtp(ResendRegistrationOtpRequest request);
    UserProfileDto verifyRegistrationOtp(VerifyRegistrationOtpRequest request);

    // UC-02: Login with 5-attempt lockout (BR-03) & JWT generation
    LoginResponse login(LoginRequest request);

    // UC-03: Logout & Token Revocation
    void logout(String email);

    // UC-04: Forgot & Reset Password
    Map<String, String> requestPasswordReset(ForgotPasswordRequest request);
    void resetPassword(ResetPasswordRequest request);

    // UC-05: View & Update Personal Profile
    UserProfileDto getCurrentUserProfile(String email);
    UserProfileDto updateCurrentUserProfile(String email, UpdateProfileRequest request);

    // UC-06: Change Password (keeps current session alive with refreshed JWT)
    Map<String, String> changePassword(String email, ChangePasswordRequest request);

    // UC-07: Admin User Management (Search, Detail, Create, Update)
    List<UserProfileDto> listAllUsers(String keyword, String role, String status);
    UserProfileDto getUserById(Integer accountId);
    UserProfileDto createUserByAdmin(AdminCreateUserRequest request, UserPrincipal admin);
    UserProfileDto updateUserByAdmin(Integer accountId, AdminUpdateUserRequest request, UserPrincipal admin);

    // UC-08: Lock / Unlock / Deactivate Account
    UserProfileDto updateUserStatus(Integer accountId, String newStatus, UserPrincipal admin);

    // UC-09: Assign Specialized Role (10 Roles) & Department
    UserProfileDto assignUserRole(Integer accountId, String roleName, Integer departmentId, UserPrincipal admin);

    // UC-10: Roles & Departments Lookup
    List<RoleDto> listAllRoles();
    List<DepartmentDto> listAllDepartments();

    // UC-49: Search & Filter Security/Operational Audit Logs
    List<AuditLogDto> listAuditLogs(String keyword, String action, String entityName);
}
