package com.fpt.hms.controller;

import com.fpt.hms.dto.auth.LoginRequest;
import com.fpt.hms.dto.auth.LoginResponse;
import com.fpt.hms.dto.auth.RegisterRequest;
import com.fpt.hms.dto.auth.UserProfileDto;
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

/**
 * Module 1 (Owner: KhangND) - Authentication & Profile Controller (UC-01 to UC-06, UC-10).
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "1. Authentication & Account (Module 1 - KhangND)")
public class AuthenticationController {

    private final AuthenticationService authenticationService;

    @PostMapping("/login")
    @Operation(summary = "UC-02: Authenticate user credentials and return JWT access token")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authenticationService.login(request));
    }

    @PostMapping("/register")
    @Operation(summary = "UC-01: Register a new Customer account")
    public ResponseEntity<UserProfileDto> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authenticationService.registerCustomer(request));
    }

    @GetMapping("/me")
    @Operation(summary = "UC-03: Get current logged-in user profile")
    public ResponseEntity<UserProfileDto> getCurrentProfile(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(authenticationService.getCurrentUserProfile(principal.getEmail()));
    }
}