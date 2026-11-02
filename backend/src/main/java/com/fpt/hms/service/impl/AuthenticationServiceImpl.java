package com.fpt.hms.service.impl;

import com.fpt.hms.common.AuditService;
import com.fpt.hms.dto.auth.*;
import com.fpt.hms.entity.*;
import com.fpt.hms.enums.AccountStatus;
import com.fpt.hms.enums.RoleName;
import com.fpt.hms.exception.BusinessException;
import com.fpt.hms.exception.ResourceNotFoundException;
import com.fpt.hms.repository.*;
import com.fpt.hms.security.JwtTokenProvider;
import com.fpt.hms.security.UserPrincipal;
import com.fpt.hms.service.AuthenticationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Module 1 (Owner: KhangND) - Implementation of Authentication, Profile, User Governance & Audit Logs.
 * Written clearly and modularly for easy reading and refactoring.
 */
@Service
@RequiredArgsConstructor
public class AuthenticationServiceImpl implements AuthenticationService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCK_DURATION_MINUTES = 15;

    private final AccountRepository accountRepository;
    private final RoleRepository roleRepository;
    private final DepartmentRepository departmentRepository;
    private final CustomerRepository customerRepository;
    private final StaffRepository staffRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AuditLogRepository auditLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuditService auditService;

    // In-memory store for 6-digit password reset codes (email -> ResetCodeEntry)
    private final Map<String, ResetCodeEntry> resetCodeStore = new ConcurrentHashMap<>();

    private record ResetCodeEntry(String code, Instant expiresAt) {}

    // =========================================================================
    // UC-01: CUSTOMER REGISTRATION
    // =========================================================================
    @Override
    @Transactional
    public UserProfileDto registerCustomer(RegisterRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        if (accountRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new BusinessException("BR-02", "Email này đã được đăng ký trên hệ thống.", HttpStatus.CONFLICT);
        }

        String trimmedIdentity = StringUtils.hasText(request.getIdentityNumber()) ? request.getIdentityNumber().trim() : null;
        if (trimmedIdentity != null && customerRepository.existsByIdentityNumberIgnoreCase(trimmedIdentity)) {
            throw new BusinessException("VAL-ID", "Số CCCD/Passport này đã được đăng ký trên hệ thống.", HttpStatus.CONFLICT);
        }

        Role customerRole = roleRepository.findByRoleName(RoleName.CUSTOMER.name())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy vai trò CUSTOMER"));

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
                .identityNumber(StringUtils.hasText(request.getIdentityNumber()) ? request.getIdentityNumber().trim() : null)
                .build();
        customerRepository.save(customer);

        auditService.recordAction(
                savedAccount.getAccountId(),
                RoleName.CUSTOMER.name(),
                "REGISTER_ACCOUNT",
                "Account",
                savedAccount.getAccountId(),
                null,
                "email=" + normalizedEmail + ", role=CUSTOMER",
                "Khách hàng tự đăng ký tài khoản"
        );

        return mapToUserProfileDto(savedAccount);
    }

    // =========================================================================
    // UC-02: LOGIN (WITH BR-03 5-ATTEMPT LOCKOUT & REFRESH TOKEN)
    // =========================================================================
    @Override
    @Transactional(noRollbackFor = BusinessException.class)
    public LoginResponse login(LoginRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        Account account = accountRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new BusinessException(
                        "AUTH-01",
                        "Email hoặc mật khẩu không chính xác.",
                        HttpStatus.UNAUTHORIZED
                ));

        // 1. Check if account is deactivated by Admin
        if ("INACTIVE".equalsIgnoreCase(account.getStatus())) {
            throw new BusinessException(
                    "AUTH-02",
                    "Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Quản trị viên.",
                    HttpStatus.FORBIDDEN
            );
        }

        // 2. Check temporary lockout (BR-03: 5 failed attempts -> locked for 15 minutes)
        Instant now = Instant.now();
        if (account.getLockedUntil() != null) {
            if (account.getLockedUntil().isAfter(now)) {
                long remainingMinutes = Math.max(1, Duration.between(now, account.getLockedUntil()).toMinutes() + 1);
                throw new BusinessException(
                        "BR-03",
                        "Tài khoản đang bị tạm khóa do nhập sai mật khẩu quá 5 lần. Vui lòng thử lại sau " + remainingMinutes + " phút.",
                        HttpStatus.FORBIDDEN
                );
            } else {
                // Lock period expired -> unlock automatically
                account.setLockedUntil(null);
                account.setFailedLoginAttempts(0);
                if ("LOCKED".equalsIgnoreCase(account.getStatus())) {
                    account.setStatus(AccountStatus.ACTIVE.name());
                }
            }
        }

        if ("LOCKED".equalsIgnoreCase(account.getStatus())) {
            throw new BusinessException(
                    "AUTH-03",
                    "Tài khoản đang bị khóa bởi Quản trị viên.",
                    HttpStatus.FORBIDDEN
            );
        }

        // 3. Verify password
        if (!passwordEncoder.matches(request.getPassword(), account.getPasswordHash())) {
            int attempts = (account.getFailedLoginAttempts() == null ? 0 : account.getFailedLoginAttempts()) + 1;
            account.setFailedLoginAttempts(attempts);

            if (attempts >= MAX_FAILED_ATTEMPTS) {
                Instant lockUntil = now.plus(LOCK_DURATION_MINUTES, ChronoUnit.MINUTES);
                account.setLockedUntil(lockUntil);
                account.setStatus("LOCKED");
                accountRepository.save(account);

                auditService.recordAction(
                        account.getAccountId(),
                        account.getRole().getRoleName(),
                        "LOGIN_LOCKED",
                        "Account",
                        account.getAccountId(),
                        "failedAttempts=" + (attempts - 1),
                        "status=LOCKED, lockedUntil=" + lockUntil,
                        "Tự động khóa 15 phút do sai mật khẩu 5 lần liên tiếp"
                );

                throw new BusinessException(
                        "BR-03",
                        "Bạn đã nhập sai mật khẩu 5 lần liên tiếp. Tài khoản bị tạm khóa trong 15 phút.",
                        HttpStatus.FORBIDDEN
                );
            }

            accountRepository.save(account);
            int remaining = MAX_FAILED_ATTEMPTS - attempts;
            throw new BusinessException(
                    "AUTH-01",
                    "Email hoặc mật khẩu không chính xác (Còn " + remaining + " lần thử trước khi tạm khóa).",
                    HttpStatus.UNAUTHORIZED
            );
        }

        // 4. Login successful -> reset failed counter & issue JWT + Refresh Token
        account.setFailedLoginAttempts(0);
        account.setLockedUntil(null);
        accountRepository.save(account);

        UserPrincipal principal = new UserPrincipal(account);
        String accessToken = jwtTokenProvider.generateAccessToken(principal);

        RefreshToken refreshToken = RefreshToken.builder()
                .account(account)
                .tokenHash(UUID.randomUUID().toString())
                .expiresAt(now.plus(7, ChronoUnit.DAYS))
                .revoked(false)
                .createdAt(now)
                .build();
        refreshTokenRepository.save(refreshToken);

        auditService.recordAction(
                account.getAccountId(),
                account.getRole().getRoleName(),
                "LOGIN_SUCCESS",
                "Account",
                account.getAccountId(),
                null,
                "email=" + account.getEmail() + ", role=" + account.getRole().getRoleName(),
                "Đăng nhập hệ thống thành công"
        );

        return LoginResponse.builder()
                .accessToken(accessToken)
                .tokenType("Bearer")
                .expiresInMs(900000L)
                .user(mapToUserProfileDto(account))
                .build();
    }

    // =========================================================================
    // UC-03: LOGOUT & REVOKE TOKENS
    // =========================================================================
    @Override
    @Transactional
    public void logout(String email) {
        Account account = accountRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản"));

        account.setTokenVersion(account.getTokenVersion() + 1);
        accountRepository.save(account);

        List<RefreshToken> activeTokens = refreshTokenRepository.findByAccount_AccountIdAndRevokedFalse(account.getAccountId());
        for (RefreshToken token : activeTokens) {
            token.setRevoked(true);
        }
        refreshTokenRepository.saveAll(activeTokens);

        auditService.recordAction(
                account.getAccountId(),
                account.getRole().getRoleName(),
                "LOGOUT",
                "Account",
                account.getAccountId(),
                null,
                "tokenVersion=" + account.getTokenVersion(),
                "Người dùng đăng xuất và thu hồi phiên"
        );
    }

    // =========================================================================
    // UC-04: FORGOT & RESET PASSWORD
    // =========================================================================
    @Override
    @Transactional
    public Map<String, String> requestPasswordReset(ForgotPasswordRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        Account account = accountRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản với email: " + normalizedEmail));

        String code = String.format("%06d", new Random().nextInt(900000) + 100000);
        resetCodeStore.put(normalizedEmail, new ResetCodeEntry(code, Instant.now().plus(15, ChronoUnit.MINUTES)));

        auditService.recordAction(
                account.getAccountId(),
                account.getRole().getRoleName(),
                "PASSWORD_RESET_REQUEST",
                "Account",
                account.getAccountId(),
                null,
                "resetCodeIssued=true",
                "Yêu cầu mã khôi phục mật khẩu"
        );

        Map<String, String> result = new LinkedHashMap<>();
        result.put("email", normalizedEmail);
        result.put("resetCode", code); // Returned for easy testing/demo
        result.put("message", "Mã khôi phục mật khẩu (6 chữ số) có hiệu lực trong 15 phút.");
        return result;
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException("VAL-01", "Mật khẩu xác nhận không khớp với mật khẩu mới.");
        }

        ResetCodeEntry entry = resetCodeStore.get(normalizedEmail);
        if (entry == null || entry.expiresAt().isBefore(Instant.now()) || !entry.code().equals(request.getResetCode().trim())) {
            throw new BusinessException("AUTH-04", "Mã xác nhận không hợp lệ hoặc đã hết hạn (15 phút).");
        }

        Account account = accountRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản"));

        account.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        account.setFailedLoginAttempts(0);
        account.setLockedUntil(null);
        if ("LOCKED".equalsIgnoreCase(account.getStatus())) {
            account.setStatus(AccountStatus.ACTIVE.name());
        }
        account.setTokenVersion(account.getTokenVersion() + 1);
        accountRepository.save(account);

        resetCodeStore.remove(normalizedEmail);

        auditService.recordAction(
                account.getAccountId(),
                account.getRole().getRoleName(),
                "PASSWORD_RESET_COMPLETE",
                "Account",
                account.getAccountId(),
                null,
                "tokenVersion=" + account.getTokenVersion(),
                "Đặt lại mật khẩu thành công qua mã khôi phục"
        );
    }

    // =========================================================================
    // UC-05: VIEW & UPDATE PERSONAL PROFILE
    // =========================================================================
    @Override
    @Transactional(readOnly = true)
    public UserProfileDto getCurrentUserProfile(String email) {
        Account account = accountRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản"));
        return mapToUserProfileDto(account);
    }

    @Override
    @Transactional
    public UserProfileDto updateCurrentUserProfile(String email, UpdateProfileRequest request) {
        Account account = accountRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản"));

        Customer customer = customerRepository.findByAccount_AccountId(account.getAccountId()).orElse(null);
        if (customer != null) {
            customer.setFullName(request.getFullName().trim());
            customer.setPhone(request.getPhone().trim());
            if (request.getIdentityNumber() != null) {
                String trimmedId = request.getIdentityNumber().trim();
                if (!trimmedId.isEmpty() && customerRepository.existsByIdentityNumberIgnoreCaseAndCustomerIdNot(trimmedId, customer.getCustomerId())) {
                    throw new BusinessException("VAL-ID", "Số CCCD/Passport này đã thuộc về một khách hàng khác.", HttpStatus.CONFLICT);
                }
                customer.setIdentityNumber(trimmedId.isEmpty() ? null : trimmedId);
            }
            customerRepository.save(customer);
        } else {
            Staff staff = staffRepository.findByAccount_AccountId(account.getAccountId()).orElse(null);
            if (staff != null) {
                staff.setFullName(request.getFullName().trim());
                staff.setPhone(request.getPhone().trim());
                if (request.getGender() != null) {
                    staff.setGender(request.getGender().trim());
                }
                if (request.getDateOfBirth() != null) {
                    staff.setDateOfBirth(request.getDateOfBirth());
                }
                if (request.getAddress() != null) {
                    staff.setAddress(request.getAddress().trim());
                }
                staff.setUpdatedAt(Instant.now());
                staffRepository.save(staff);
            }
        }

        auditService.recordAction(
                account.getAccountId(),
                account.getRole().getRoleName(),
                "UPDATE_PROFILE",
                "Account",
                account.getAccountId(),
                null,
                "fullName=" + request.getFullName().trim() + ", phone=" + request.getPhone().trim(),
                "Người dùng cập nhật hồ sơ cá nhân"
        );

        return mapToUserProfileDto(account);
    }

    // =========================================================================
    // UC-06: CHANGE PASSWORD
    // =========================================================================
    @Override
    @Transactional
    public void changePassword(String email, ChangePasswordRequest request) {
        Account account = accountRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), account.getPasswordHash())) {
            throw new BusinessException("AUTH-05", "Mật khẩu hiện tại không chính xác.");
        }
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException("VAL-01", "Xác nhận mật khẩu mới không khớp.");
        }
        if (passwordEncoder.matches(request.getNewPassword(), account.getPasswordHash())) {
            throw new BusinessException("BR-01", "Mật khẩu mới không được trùng với mật khẩu hiện tại.");
        }

        account.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        account.setTokenVersion(account.getTokenVersion() + 1);
        accountRepository.save(account);

        auditService.recordAction(
                account.getAccountId(),
                account.getRole().getRoleName(),
                "CHANGE_PASSWORD",
                "Account",
                account.getAccountId(),
                null,
                "tokenVersion=" + account.getTokenVersion(),
                "Người dùng đổi mật khẩu cá nhân"
        );
    }

    // =========================================================================
    // UC-07: ADMIN USER MANAGEMENT (LIST, FILTER, CREATE, UPDATE)
    // =========================================================================
    @Override
    @Transactional(readOnly = true)
    public List<UserProfileDto> listAllUsers(String keyword, String role, String status) {
        List<UserProfileDto> allUsers = accountRepository.findAll().stream()
                .map(this::mapToUserProfileDto)
                .sorted(Comparator.comparing(UserProfileDto::getAccountId))
                .collect(Collectors.toList());

        return allUsers.stream()
                .filter(u -> {
                    if (StringUtils.hasText(role) && !role.equalsIgnoreCase(u.getRole())) {
                        return false;
                    }
                    if (StringUtils.hasText(status) && !status.equalsIgnoreCase(u.getStatus())) {
                        return false;
                    }
                    if (StringUtils.hasText(keyword)) {
                        String kw = keyword.trim().toLowerCase();
                        boolean matchEmail = u.getEmail() != null && u.getEmail().toLowerCase().contains(kw);
                        boolean matchName = u.getFullName() != null && u.getFullName().toLowerCase().contains(kw);
                        boolean matchPhone = u.getPhone() != null && u.getPhone().toLowerCase().contains(kw);
                        boolean matchStaffCode = u.getStaffCode() != null && u.getStaffCode().toLowerCase().contains(kw);
                        return matchEmail || matchName || matchPhone || matchStaffCode;
                    }
                    return true;
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public UserProfileDto getUserById(Integer accountId) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản #" + accountId));
        return mapToUserProfileDto(account);
    }

    @Override
    @Transactional
    public UserProfileDto createUserByAdmin(AdminCreateUserRequest request, UserPrincipal admin) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        if (accountRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new BusinessException("BR-02", "Email " + normalizedEmail + " đã tồn tại trên hệ thống.", HttpStatus.CONFLICT);
        }

        Role role = roleRepository.findByRoleName(request.getRoleName().trim().toUpperCase())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Role: " + request.getRoleName()));

        Account account = Account.builder()
                .role(role)
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .status(AccountStatus.ACTIVE.name())
                .tokenVersion(0)
                .failedLoginAttempts(0)
                .createdAt(Instant.now())
                .build();
        Account savedAccount = accountRepository.save(account);

        if (RoleName.CUSTOMER.name().equalsIgnoreCase(role.getRoleName())) {
            Customer customer = Customer.builder()
                    .account(savedAccount)
                    .fullName(request.getFullName().trim())
                    .email(normalizedEmail)
                    .phone(request.getPhone().trim())
                    .identityNumber(request.getIdentityNumber())
                    .build();
            customerRepository.save(customer);
        } else {
            Integer expectedDeptId = resolveDefaultDepartmentId(role.getRoleName());
            Integer deptId = request.getDepartmentId() != null ? request.getDepartmentId() : expectedDeptId;
            if (!expectedDeptId.equals(deptId)) {
                throw new BusinessException("VAL-DEPT", "Vai trò " + role.getRoleName() + " không thuộc phòng ban đã chọn.");
            }
            Department dept = departmentRepository.findById(deptId)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Phòng ban #" + deptId));

            String generatedStaffCode = String.format("STF-%03d", savedAccount.getAccountId());
            Staff staff = Staff.builder()
                    .account(savedAccount)
                    .department(dept)
                    .staffCode(generatedStaffCode)
                    .fullName(request.getFullName().trim())
                    .email(normalizedEmail)
                    .phone(request.getPhone().trim())
                    .gender(StringUtils.hasText(request.getGender()) ? request.getGender().trim() : "Nam")
                    .dateOfBirth(request.getDateOfBirth())
                    .address(request.getAddress())
                    .hireDate(LocalDate.now())
                    .employmentStatus("ACTIVE")
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();
            staffRepository.save(staff);
        }

        auditService.recordAction(
                admin.getAccountId(),
                admin.getRoleName(),
                "CREATE_USER",
                "Account",
                savedAccount.getAccountId(),
                null,
                "email=" + normalizedEmail + ", role=" + role.getRoleName(),
                "Admin tạo mới tài khoản người dùng"
        );

        return mapToUserProfileDto(savedAccount);
    }

    @Override
    @Transactional
    public UserProfileDto updateUserByAdmin(Integer accountId, AdminUpdateUserRequest request, UserPrincipal admin) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản #" + accountId));

        Customer customer = customerRepository.findByAccount_AccountId(accountId).orElse(null);
        if (customer != null) {
            customer.setFullName(request.getFullName().trim());
            customer.setPhone(request.getPhone().trim());
            if (request.getIdentityNumber() != null) {
                customer.setIdentityNumber(request.getIdentityNumber().trim());
            }
            customerRepository.save(customer);
        } else {
            Staff staff = staffRepository.findByAccount_AccountId(accountId).orElse(null);
            if (staff != null) {
                staff.setFullName(request.getFullName().trim());
                staff.setPhone(request.getPhone().trim());
                if (request.getDepartmentId() != null) {
                    Department dept = departmentRepository.findById(request.getDepartmentId())
                            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Phòng ban #" + request.getDepartmentId()));
                    staff.setDepartment(dept);
                }
                if (request.getGender() != null) {
                    staff.setGender(request.getGender().trim());
                }
                if (request.getDateOfBirth() != null) {
                    staff.setDateOfBirth(request.getDateOfBirth());
                }
                if (request.getAddress() != null) {
                    staff.setAddress(request.getAddress().trim());
                }
                if (StringUtils.hasText(request.getEmploymentStatus())) {
                    staff.setEmploymentStatus(request.getEmploymentStatus().trim().toUpperCase());
                }
                staff.setUpdatedAt(Instant.now());
                staffRepository.save(staff);
            }
        }

        auditService.recordAction(
                admin.getAccountId(),
                admin.getRoleName(),
                "UPDATE_USER",
                "Account",
                accountId,
                null,
                "fullName=" + request.getFullName().trim() + ", phone=" + request.getPhone().trim(),
                "Admin cập nhật thông tin người dùng"
        );

        return mapToUserProfileDto(account);
    }

    // =========================================================================
    // UC-08: LOCK / UNLOCK / TOGGLE ACCOUNT STATUS
    // =========================================================================
    @Override
    @Transactional
    public UserProfileDto updateUserStatus(Integer accountId, String newStatus, UserPrincipal admin) {
        if (admin.getAccountId().equals(accountId)) {
            throw new BusinessException("BR-05", "Quản trị viên không thể tự khóa hoặc vô hiệu hóa tài khoản của chính mình.");
        }

        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản #" + accountId));

        String normalizedStatus = newStatus.trim().toUpperCase();
        String oldStatus = account.getStatus();
        account.setStatus(normalizedStatus);

        if ("ACTIVE".equals(normalizedStatus)) {
            account.setFailedLoginAttempts(0);
            account.setLockedUntil(null);
        }

        // Increment tokenVersion to immediately revoke any active JWT of this account
        account.setTokenVersion(account.getTokenVersion() + 1);
        accountRepository.save(account);

        auditService.recordAction(
                admin.getAccountId(),
                admin.getRoleName(),
                "USER_STATUS_CHANGE",
                "Account",
                accountId,
                "status=" + oldStatus,
                "status=" + normalizedStatus,
                "Admin thay đổi trạng thái tài khoản"
        );

        return mapToUserProfileDto(account);
    }

    // =========================================================================
    // UC-09: ASSIGN ROLE (10 SPECIALIZED ROLES) & DEPARTMENT
    // =========================================================================
    @Override
    @Transactional
    public UserProfileDto assignUserRole(Integer accountId, String roleName, Integer departmentId, UserPrincipal admin) {
        if (admin.getAccountId().equals(accountId) && !"ADMIN".equalsIgnoreCase(roleName)) {
            throw new BusinessException("BR-05", "Quản trị viên không thể tự gỡ quyền ADMIN của chính mình.");
        }

        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản #" + accountId));

        Role newRole = roleRepository.findByRoleName(roleName.trim().toUpperCase())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy vai trò: " + roleName));

        String oldRole = account.getRole().getRoleName();
        account.setRole(newRole);
        account.setTokenVersion(account.getTokenVersion() + 1);
        accountRepository.save(account);

        // Update Staff department if applicable
        Staff staff = staffRepository.findByAccount_AccountId(accountId).orElse(null);
        if (staff != null) {
            Integer targetDeptId = departmentId != null ? departmentId : resolveDefaultDepartmentId(newRole.getRoleName());
            departmentRepository.findById(targetDeptId).ifPresent(dept -> {
                staff.setDepartment(dept);
                staff.setUpdatedAt(Instant.now());
                staffRepository.save(staff);
            });
        }

        auditService.recordAction(
                admin.getAccountId(),
                admin.getRoleName(),
                "ROLE_CHANGE",
                "Account",
                accountId,
                "role=" + oldRole,
                "role=" + newRole.getRoleName(),
                "Admin phân quyền vai trò chuyên biệt"
        );

        return mapToUserProfileDto(account);
    }

    // =========================================================================
    // UC-10: LIST ROLES (10 ROLES) & DEPARTMENTS (7 DEPARTMENTS)
    // =========================================================================
    @Override
    @Transactional(readOnly = true)
    public List<RoleDto> listAllRoles() {
        return roleRepository.findAll().stream()
                .sorted(Comparator.comparing(Role::getRoleId))
                .map(r -> RoleDto.builder()
                        .roleId(r.getRoleId())
                        .roleName(r.getRoleName())
                        .description(r.getDescription())
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<DepartmentDto> listAllDepartments() {
        return departmentRepository.findAll().stream()
                .sorted(Comparator.comparing(Department::getDepartmentId))
                .map(d -> DepartmentDto.builder()
                        .departmentId(d.getDepartmentId())
                        .departmentName(translateDepartmentName(d.getDepartmentId(), d.getDepartmentName()))
                        .description(d.getDescription())
                        .managerId(d.getManager() != null ? d.getManager().getStaffId() : null)
                        .managerName(d.getManager() != null ? d.getManager().getFullName() : "Chưa bổ nhiệm")
                        .build())
                .collect(Collectors.toList());
    }

    // =========================================================================
    // UC-49: LIST & FILTER SECURITY / OPERATIONAL AUDIT LOGS
    // =========================================================================
    @Override
    @Transactional(readOnly = true)
    public List<AuditLogDto> listAuditLogs(String keyword, String action, String entityName) {
        return auditLogRepository.findAllByOrderByPerformedAtDesc().stream()
                .map(log -> AuditLogDto.builder()
                        .auditLogId(log.getAuditLogId())
                        .actorAccountId(log.getActorAccount() != null ? log.getActorAccount().getAccountId() : null)
                        .actorEmail(log.getActorAccount() != null ? log.getActorAccount().getEmail() : "SYSTEM")
                        .actorType(log.getActorType())
                        .action(log.getAction())
                        .entityName(log.getEntityName())
                        .recordId(log.getRecordId())
                        .oldValues(log.getOldValues())
                        .newValues(log.getNewValues())
                        .reason(log.getReason() != null ? log.getReason().replaceAll("\\s*\\((UC|BR)-\\d+\\)", "") : null)
                        .traceId(log.getTraceId())
                        .performedAt(log.getPerformedAt())
                        .build())
                .filter(dto -> {
                    if (StringUtils.hasText(action) && !action.equalsIgnoreCase(dto.getAction())) {
                        return false;
                    }
                    if (StringUtils.hasText(entityName) && !entityName.equalsIgnoreCase(dto.getEntityName())) {
                        return false;
                    }
                    if (StringUtils.hasText(keyword)) {
                        String kw = keyword.trim().toLowerCase();
                        boolean matchEmail = dto.getActorEmail() != null && dto.getActorEmail().toLowerCase().contains(kw);
                        boolean matchReason = dto.getReason() != null && dto.getReason().toLowerCase().contains(kw);
                        boolean matchNewVal = dto.getNewValues() != null && dto.getNewValues().toLowerCase().contains(kw);
                        boolean matchTrace = dto.getTraceId() != null && dto.getTraceId().toLowerCase().contains(kw);
                        return matchEmail || matchReason || matchNewVal || matchTrace;
                    }
                    return true;
                })
                .collect(Collectors.toList());
    }

    // =========================================================================
    // HELPER MAPPERS
    // =========================================================================
    private UserProfileDto mapToUserProfileDto(Account account) {
        UserProfileDto.UserProfileDtoBuilder builder = UserProfileDto.builder()
                .accountId(account.getAccountId())
                .email(account.getEmail())
                .fullName(account.getEmail())
                .phone("")
                .role(account.getRole().getRoleName())
                .status(account.getStatus())
                .failedLoginAttempts(account.getFailedLoginAttempts())
                .lockedUntil(account.getLockedUntil())
                .createdAt(account.getCreatedAt());

        Customer customer = customerRepository.findByAccount_AccountId(account.getAccountId()).orElse(null);
        if (customer != null) {
            builder.customerId(customer.getCustomerId())
                    .fullName(customer.getFullName())
                    .phone(customer.getPhone())
                    .identityNumber(customer.getIdentityNumber());
        } else {
            Staff staff = staffRepository.findByAccount_AccountId(account.getAccountId()).orElse(null);
            if (staff != null) {
                builder.staffId(staff.getStaffId())
                        .staffCode(staff.getStaffCode())
                        .fullName(staff.getFullName())
                        .phone(staff.getPhone())
                        .gender(staff.getGender())
                        .dateOfBirth(staff.getDateOfBirth())
                        .address(staff.getAddress())
                        .hireDate(staff.getHireDate())
                        .employmentStatus(staff.getEmploymentStatus());
                if (staff.getDepartment() != null) {
                    builder.departmentId(staff.getDepartment().getDepartmentId())
                            .departmentName(translateDepartmentName(staff.getDepartment().getDepartmentId(), staff.getDepartment().getDepartmentName()));
                }
            }
        }

        return builder.build();
    }

    private String translateDepartmentName(Integer deptId, String rawName) {
        if (deptId != null) {
            return switch (deptId) {
                case 1 -> "Phòng Công nghệ Thông tin & Kỹ thuật";
                case 2 -> "Ban Giám đốc Điều hành";
                case 3 -> "Phòng Kinh doanh & Tiếp thị";
                case 4 -> "Bộ phận Buồng phòng";
                case 5 -> "Bộ phận Dịch vụ & Tiện ích";
                case 6 -> "Phòng Tài chính - Kế toán";
                case 7 -> "Bộ phận Tiền sảnh & Lễ tân";
                default -> rawName;
            };
        }
        return rawName;
    }

    private Integer resolveDefaultDepartmentId(String roleName) {
        return switch (roleName.toUpperCase()) {
            case "ADMIN" -> 1;
            case "GENERAL_MANAGER" -> 2;
            case "SALES_MANAGER" -> 3;
            case "HOUSEKEEPING_MANAGER", "HOUSEKEEPING" -> 4;
            case "SERVICE_MANAGER", "SERVICE_STAFF" -> 5;
            case "ACCOUNTANT" -> 6;
            default -> 7; // FRONT_DESK -> Front Office Department
        };
    }
}
