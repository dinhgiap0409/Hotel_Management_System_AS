package com.fpt.hms.service;

import com.fpt.hms.dto.auth.LoginRequest;
import com.fpt.hms.dto.auth.LoginResponse;
import com.fpt.hms.dto.auth.RegisterRequest;
import com.fpt.hms.dto.auth.UserProfileDto;

public interface AuthenticationService {
    LoginResponse login(LoginRequest request);
    UserProfileDto registerCustomer(RegisterRequest request);
    UserProfileDto getCurrentUserProfile(String email);
}