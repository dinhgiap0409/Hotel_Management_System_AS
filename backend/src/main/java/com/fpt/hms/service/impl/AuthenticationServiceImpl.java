package com.fpt.hms.service.impl;

import com.fpt.hms.common.MessageResolver;
import com.fpt.hms.dto.auth.LoginRequest;
import com.fpt.hms.dto.auth.LoginResponse;
import com.fpt.hms.dto.auth.RegisterRequest;
import com.fpt.hms.dto.auth.UserProfileDto;
import com.fpt.hms.entity.Account;
import com.fpt.hms.entity.Customer;
import com.fpt.hms.entity.Role;
import com.fpt.hms.entity.Staff;
import com.fpt.hms.enums.AccountStatus;
import com.fpt.hms.enums.RoleName;
import com.fpt.hms.exception.BusinessException;
import com.fpt.hms.exception.ResourceNotFoundException;
import com.fpt.hms.repository.AccountRepository;
import com.fpt.hms.repository.CustomerRepository;
import com.fpt.hms.repository.RoleRepository;
import com.fpt.hms.repository.StaffRepository;
import com.fpt.hms.security.JwtTokenProvider;
import com.fpt.hms.security.UserPrincipal;
import com.fpt.hms.service.AuthenticationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Module 1 (Owner: KhangND) - Account & Authentication Service (UC-01 to UC-10).
 */
@Service
@RequiredArgsConstructor
public class AuthenticationServiceImpl implements AuthenticationService {

    private final AuthenticationManager authenticationManager;
    private final AccountRepository accountRepository;
    private final RoleRepository roleRepository;
    private final CustomerRepository customerRepository;
    private final StaffRepository staffRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final MessageResolver messageResolver;

    @Override
    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail().trim().toLowerCase(), request.getPassword())
        );
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        String accessToken = jwtTokenProvider.generateAccessToken(principal);

        return LoginResponse.builder()
                .accessToken(accessToken)
                .tokenType("Bearer")
                .expiresInMs(900000L)
                .user(getCurrentUserProfile(principal.getEmail()))
                .build();
    }

    @Override
    @Transactional
    public UserProfileDto registerCustomer(RegisterRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        if (accountRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new BusinessException("MSG01A", messageResolver.resolve("MSG01A"), HttpStatus.CONFLICT);
        }

        Role customerRole = roleRepository.findByRoleName(RoleName.CUSTOMER.name())
                .orElseThrow(() -> new ResourceNotFoundException("Role CUSTOMER not found"));

        Account account = Account.builder()
                .role(customerRole)
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .status(AccountStatus.ACTIVE.name())
                .tokenVersion(0)
                .failedLoginAttempts(0)
                .createdAt(Instant.now())
                .build();
        Account savedAccount = accountRepository.save(account);

        Customer customer = Customer.builder()
                .account(savedAccount)
                .fullName(request.getFullName().trim())
                .email(normalizedEmail)
                .phone(request.getPhone().trim())
                .build();
        customerRepository.save(customer);

        return UserProfileDto.builder()
                .accountId(savedAccount.getAccountId())
                .email(savedAccount.getEmail())
                .fullName(customer.getFullName())
                .phone(customer.getPhone())
                .role(customerRole.getRoleName())
                .status(savedAccount.getStatus())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public UserProfileDto getCurrentUserProfile(String email) {
        Account account = accountRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found"));

        String fullName = account.getEmail();
        String phone = "";

        Customer customer = customerRepository.findByAccount_AccountId(account.getAccountId()).orElse(null);
        if (customer != null) {
            fullName = customer.getFullName();
            phone = customer.getPhone();
        } else {
            Staff staff = staffRepository.findByAccount_AccountId(account.getAccountId()).orElse(null);
            if (staff != null) {
                fullName = staff.getFullName();
                phone = staff.getPhone();
            }
        }

        return UserProfileDto.builder()
                .accountId(account.getAccountId())
                .email(account.getEmail())
                .fullName(fullName)
                .phone(phone)
                .role(account.getRole().getRoleName())
                .status(account.getStatus())
                .build();
    }
}