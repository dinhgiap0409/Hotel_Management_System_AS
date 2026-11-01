package com.fpt.hms.controller;

import com.fpt.hms.dto.auth.*;
import com.fpt.hms.security.UserPrincipal;
import com.fpt.hms.service.AuthenticationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Module 1 (Owner: KhangND) - Authentication & Personal Account Controller (UC-01 to UC-06).
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "1A. Authentication & Personal Account (Module 1 - KhangND)")
public class AuthenticationController {

    private final AuthenticationService authenticationService;

    @PostMapping("/register")
    @Operation(summary = "UC-01: Register a new Customer account")
    public ResponseEntity<UserProfileDto> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authenticationService.registerCustomer(request));
    }

    @PostMapping("/login")
    @Operation(summary = "UC-02: Authenticate credentials, enforce 5-attempt lockout (BR-03), and issue JWT")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authenticationService.login(request));
    }

    @PostMapping("/logout")
    @Operation(summary = "UC-03: Logout and revoke active tokens")
    public ResponseEntity<Map<String, String>> logout(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal != null) {
            authenticationService.logout(principal.getEmail());
        }
        return ResponseEntity.ok(Map.of("message", "Đăng xuất thành công."));
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "UC-04 (Step 1): Request a 6-digit password reset code")
    public ResponseEntity<Map<String, String>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(authenticationService.requestPasswordReset(request));
    }

    @PostMapping("/reset-password")
    @Operation(summary = "UC-04 (Step 2): Reset password using 6-digit verification code")
    public ResponseEntity<Map<String, String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authenticationService.resetPassword(request);
        return ResponseEntity.ok(Map.of("message", "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại."));
    }

    @GetMapping("/me")
    @Operation(summary = "UC-05: View current logged-in user profile")
    public ResponseEntity<UserProfileDto> getCurrentProfile(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(authenticationService.getCurrentUserProfile(principal.getEmail()));
    }

    @PutMapping("/profile")
    @Operation(summary = "UC-05: Update current logged-in user personal profile")
    public ResponseEntity<UserProfileDto> updateProfile(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(authenticationService.updateCurrentUserProfile(principal.getEmail(), request));
    }

    @PostMapping("/change-password")
    @Operation(summary = "UC-06: Change current logged-in user password")
    public ResponseEntity<Map<String, String>> changePassword(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest request) {
        authenticationService.changePassword(principal.getEmail(), request);
        return ResponseEntity.ok(Map.of("message", "Đổi mật khẩu thành công."));
    }
}
