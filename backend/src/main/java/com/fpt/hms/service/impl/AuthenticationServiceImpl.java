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
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import javax.naming.NameNotFoundException;
import javax.naming.NamingException;
import javax.naming.directory.Attributes;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Module 1 (Owner: KhangND) - Implementation of Authentication, Profile, User Governance & Audit Logs.
 * Written clearly and modularly for easy reading and refactoring.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthenticationServiceImpl implements AuthenticationService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCK_DURATION_MINUTES = 15;
    private static final int MAX_OTP_ATTEMPTS = 5;
    private static final int OTP_EXPIRATION_MINUTES = 15;

    private static final Pattern STRICT_EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private static final Set<String> DISPOSABLE_EMAIL_DOMAINS = Set.of(
            "mailinator.com", "yopmail.com", "10minutemail.com", "tempmail.com",
            "temp-mail.org", "guerrillamail.com", "guerrillamailblock.com", "sharklasers.com",
            "trashmail.com", "dispostable.com", "fakeinbox.com", "maildrop.cc",
            "getnada.com", "throwawaymail.com", "mohmal.com", "emailondeck.com",
            "minutemail.com", "tempmailo.com", "example.com", "example.org",
            "example.net", "test.com", "localhost", "invalid"
    );

    private final SecureRandom secureRandom = new SecureRandom();

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
    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String mailFrom;

    // In-memory store for 6-digit password reset codes (email -> ResetCodeEntry)
    private final Map<String, ResetCodeEntry> resetCodeStore = new ConcurrentHashMap<>();

    // In-memory store for pending customer registrations awaiting email OTP verification
    private final Map<String, PendingRegistrationEntry> pendingRegistrationStore = new ConcurrentHashMap<>();

    private record ResetCodeEntry(String code, Instant expiresAt) {}

    private record PendingRegistrationEntry(
            String fullName,
            String email,
            String phone,
            String identityNumber,
            String passwordHash,
            String otpCode,
            Instant expiresAt,
            int failedAttempts
    ) {}

    // =========================================================================
    // UC-01: CUSTOMER REGISTRATION (2-STEP WITH EMAIL OTP VERIFICATION)
    // =========================================================================
    @Override
    @Transactional(readOnly = true)
    public Map<String, String> requestRegistrationOtp(RegisterRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        validateDeliverableEmail(normalizedEmail);

        if (accountRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new BusinessException("BR-02", "Email này đã được đăng ký trên hệ thống.", HttpStatus.CONFLICT);
        }

        String trimmedIdentity = StringUtils.hasText(request.getIdentityNumber()) ? request.getIdentityNumber().trim() : null;
        if (trimmedIdentity != null && customerRepository.existsByIdentityNumberIgnoreCase(trimmedIdentity)) {
            throw new BusinessException("VAL-ID", "Số CCCD/Passport này đã được đăng ký trên hệ thống.", HttpStatus.CONFLICT);
        }

        String otpCode = generateSixDigitCode();
        String fullName = request.getFullName().trim();
        String phone = request.getPhone().trim();
        String passwordHash = passwordEncoder.encode(request.getPassword());

        boolean emailSent = sendRegistrationVerificationEmail(normalizedEmail, fullName, otpCode);

        pendingRegistrationStore.put(
                normalizedEmail,
                new PendingRegistrationEntry(
                        fullName,
                        normalizedEmail,
                        phone,
                        trimmedIdentity,
                        passwordHash,
                        otpCode,
                        Instant.now().plus(OTP_EXPIRATION_MINUTES, ChronoUnit.MINUTES),
                        0
                )
        );

        return buildRegistrationOtpResponse(normalizedEmail, otpCode, emailSent, false);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, String> resendRegistrationOtp(ResendRegistrationOtpRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        PendingRegistrationEntry existing = pendingRegistrationStore.get(normalizedEmail);
        if (existing == null) {
            throw new BusinessException(
                    "REG-01",
                    "Phiên đăng ký đã hết hạn hoặc chưa được khởi tạo. Vui lòng nhập lại thông tin đăng ký."
            );
        }

        if (accountRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            pendingRegistrationStore.remove(normalizedEmail);
            throw new BusinessException("BR-02", "Email này đã được đăng ký trên hệ thống.", HttpStatus.CONFLICT);
        }

        String newOtpCode = generateSixDigitCode();
        boolean emailSent = sendRegistrationVerificationEmail(normalizedEmail, existing.fullName(), newOtpCode);

        pendingRegistrationStore.put(
                normalizedEmail,
                new PendingRegistrationEntry(
                        existing.fullName(),
                        existing.email(),
                        existing.phone(),
                        existing.identityNumber(),
                        existing.passwordHash(),
                        newOtpCode,
                        Instant.now().plus(OTP_EXPIRATION_MINUTES, ChronoUnit.MINUTES),
                        0
                )
        );

        return buildRegistrationOtpResponse(normalizedEmail, newOtpCode, emailSent, true);
    }

    @Override
    @Transactional
    public UserProfileDto verifyRegistrationOtp(VerifyRegistrationOtpRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        PendingRegistrationEntry pending = pendingRegistrationStore.get(normalizedEmail);

        if (pending == null || pending.expiresAt().isBefore(Instant.now())) {
            pendingRegistrationStore.remove(normalizedEmail);
            throw new BusinessException(
                    "AUTH-04",
                    "Mã xác thực đã hết hạn (15 phút) hoặc phiên đăng ký không tồn tại. Vui lòng bấm gửi lại mã mới."
            );
        }

        String submittedCode = request.getOtpCode().trim();
        if (!pending.otpCode().equals(submittedCode)) {
            int attempts = pending.failedAttempts() + 1;
            if (attempts >= MAX_OTP_ATTEMPTS) {
                pendingRegistrationStore.remove(normalizedEmail);
                throw new BusinessException(
                        "AUTH-06",
                        "Bạn đã nhập sai mã xác thực quá 5 lần liên tiếp. Vui lòng quay lại bước đăng ký hoặc nhận mã mới."
                );
            }
            pendingRegistrationStore.put(
                    normalizedEmail,
                    new PendingRegistrationEntry(
                            pending.fullName(),
                            pending.email(),
                            pending.phone(),
                            pending.identityNumber(),
                            pending.passwordHash(),
                            pending.otpCode(),
                            pending.expiresAt(),
                            attempts
                    )
            );
            int remaining = MAX_OTP_ATTEMPTS - attempts;
            throw new BusinessException(
                    "AUTH-04",
                    "Mã xác thực không chính xác (Còn " + remaining + " lần thử)."
            );
        }

        // Re-verify uniqueness right before committing to DB
        if (accountRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            pendingRegistrationStore.remove(normalizedEmail);
            throw new BusinessException("BR-02", "Email này đã được đăng ký trên hệ thống.", HttpStatus.CONFLICT);
        }
        if (pending.identityNumber() != null && customerRepository.existsByIdentityNumberIgnoreCase(pending.identityNumber())) {
            pendingRegistrationStore.remove(normalizedEmail);
            throw new BusinessException("VAL-ID", "Số CCCD/Passport này đã được đăng ký trên hệ thống.", HttpStatus.CONFLICT);
        }

        Role customerRole = roleRepository.findByRoleName(RoleName.CUSTOMER.name())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy vai trò CUSTOMER"));

        Account account = Account.builder()
                .role(customerRole)
                .email(normalizedEmail)
                .passwordHash(pending.passwordHash())
                .status(AccountStatus.ACTIVE.name())
                .tokenVersion(0)
                .failedLoginAttempts(0)
                .createdAt(Instant.now())
                .build();
        Account savedAccount = accountRepository.saveAndFlush(account);

        Customer customer = Customer.builder()
                .account(savedAccount)
                .fullName(pending.fullName())
                .email(normalizedEmail)
                .phone(pending.phone())
                .identityNumber(pending.identityNumber())
                .build();
        customerRepository.saveAndFlush(customer);

        pendingRegistrationStore.remove(normalizedEmail);

        auditService.recordAction(
                savedAccount.getAccountId(),
                RoleName.CUSTOMER.name(),
                "REGISTER_ACCOUNT",
                "Account",
                savedAccount.getAccountId(),
                null,
                "email=" + normalizedEmail + ", role=CUSTOMER, emailVerified=true",
                "Khách hàng đăng ký và xác thực email thành công"
        );

        log.info("[AUTH-REGISTER] Đã xác thực OTP và tạo tài khoản CUSTOMER thành công cho '{}'", normalizedEmail);
        return mapToUserProfileDto(savedAccount);
    }

    private String generateSixDigitCode() {
        return String.format("%06d", secureRandom.nextInt(900_000) + 100_000);
    }

    private boolean isRealSmtpConfigured() {
        return StringUtils.hasText(mailFrom) && !"your-email@gmail.com".equalsIgnoreCase(mailFrom.trim());
    }

    private void validateDeliverableEmail(String normalizedEmail) {
        if (!STRICT_EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            throw new BusinessException("VAL-EMAIL", "Định dạng địa chỉ email không hợp lệ (ví dụ: ten@gmail.com).");
        }
        int atIdx = normalizedEmail.lastIndexOf('@');
        String domain = normalizedEmail.substring(atIdx + 1).toLowerCase(Locale.ROOT);

        if (DISPOSABLE_EMAIL_DOMAINS.contains(domain)) {
            throw new BusinessException(
                    "VAL-EMAIL",
                    "Vui lòng sử dụng địa chỉ email cá nhân hợp lệ (hệ thống không chấp nhận email ảo / email dùng một lần)."
            );
        }

        if (isRealSmtpConfigured()) {
            verifyDomainHasMailServer(domain);
        }
    }

    private void verifyDomainHasMailServer(String domain) {
        Hashtable<String, String> env = new Hashtable<>();
        env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
        env.put("com.sun.jndi.dns.timeout.initial", "2500");
        env.put("com.sun.jndi.dns.timeout.retries", "1");
        DirContext ctx = null;
        try {
            ctx = new InitialDirContext(env);
            Attributes mxAttrs = ctx.getAttributes(domain, new String[]{"MX"});
            if (mxAttrs != null && mxAttrs.get("MX") != null && mxAttrs.get("MX").size() > 0) {
                return;
            }
            Attributes aAttrs = ctx.getAttributes(domain, new String[]{"A"});
            if (aAttrs == null || aAttrs.get("A") == null || aAttrs.get("A").size() == 0) {
                throw new BusinessException(
                        "VAL-EMAIL",
                        "Tên miền email '@" + domain + "' không hỗ trợ nhận thư. Vui lòng kiểm tra lại địa chỉ email."
                );
            }
        } catch (NameNotFoundException ex) {
            throw new BusinessException(
                    "VAL-EMAIL",
                    "Tên miền email '@" + domain + "' không tồn tại. Vui lòng kiểm tra lại chính tả địa chỉ email."
            );
        } catch (NamingException ex) {
            // Network / firewall blocked UDP 53: allow SMTP delivery step to handle verification gracefully
            log.debug("[AUTH-DNS] Bỏ qua kiểm tra DNS MX cho '{}' do mạng nội bộ: {}", domain, ex.getMessage());
        } finally {
            if (ctx != null) {
                try {
                    ctx.close();
                } catch (NamingException ignored) {
                }
            }
        }
    }

    private boolean sendRegistrationVerificationEmail(String recipientEmail, String fullName, String otpCode) {
        if (!isRealSmtpConfigured()) {
            log.info("[HMS-MAIL-DEV] Chưa cấu hình MAIL_USERNAME thật. Mã OTP kích hoạt đăng ký cho {} là: {}", recipientEmail, otpCode);
            return false;
        }
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, false, "UTF-8");
            helper.setFrom(mailFrom);
            helper.setTo(recipientEmail);
            helper.setSubject("[HMS Luxury Hotel] Mã xác thực đăng ký tài khoản");
            String htmlContent = """
                    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 10px; background: #faf9f5; color: #141413;">
                        <h2 style="margin-top: 0; color: #16233b;">HMS Luxury Hotel — Xác thực Đăng ký Tài khoản</h2>
                        <p>Xin chào <strong>%s</strong>,</p>
                        <p>Cảm ơn bạn đã đăng ký tài khoản khách hàng tại <strong>HMS Luxury Hotel</strong> với địa chỉ email <strong>%s</strong>.</p>
                        <p>Vui lòng nhập mã xác thực 6 chữ số dưới đây để hoàn tất kích hoạt tài khoản:</p>
                        <div style="text-align: center; margin: 22px 0;">
                            <span style="display: inline-block; padding: 12px 28px; font-size: 26px; font-weight: 700; letter-spacing: 6px; color: #faf9f5; background: #16233b; border-radius: 8px;">%s</span>
                        </div>
                        <p style="font-size: 13px; color: #5e5d59;">Mã xác thực có hiệu lực trong vòng <strong>15 phút</strong>. Tài khoản sẽ chỉ được tạo sau khi bạn xác nhận thành công mã này.</p>
                        <hr style="border: none; border-top: 1px solid #e8e6dc; margin: 20px 0;" />
                        <p style="font-size: 12px; color: #64748b; margin: 0;">Trân trọng,<br/>Ban Quản trị Hệ thống HMS Luxury Hotel</p>
                    </div>
                    """.formatted(fullName, recipientEmail, otpCode);
            helper.setText(htmlContent, true);
            mailSender.send(mimeMessage);
            log.info("[AUTH-REGISTER] Đã gửi mã OTP xác thực đăng ký tới {}", recipientEmail);
            return true;
        } catch (Exception ex) {
            log.error("[AUTH-REGISTER] Gửi email xác thực đăng ký thất bại tới {}: {}", recipientEmail, ex.getMessage());
            throw new BusinessException(
                    "MAIL-01",
                    "Không thể gửi email xác thực tới địa chỉ " + recipientEmail + ". Vui lòng kiểm tra lại email hợp lệ và kết nối mạng."
            );
        }
    }

    private Map<String, String> buildRegistrationOtpResponse(
            String normalizedEmail,
            String otpCode,
            boolean emailSent,
            boolean isResend
    ) {
        Map<String, String> result = new LinkedHashMap<>();
        result.put("email", normalizedEmail);
        result.put("mailSent", String.valueOf(emailSent));
        if (emailSent) {
            result.put(
                    "message",
                    (isResend
                            ? "Đã gửi lại mã xác thực (6 chữ số) mới tới hộp thư "
                            : "Mã xác thực (6 chữ số) đã được gửi tới hộp thư ")
                            + normalizedEmail + ". Vui lòng kiểm tra hộp thư (kể cả mục Thư rác/Spam) trong vòng 15 phút."
            );
        } else {
            result.put("verificationCode", otpCode);
            result.put(
                    "message",
                    "Chế độ phát triển (chưa cấu hình SMTP Gmail trong application.yml): Mã xác thực kiểm thử có hiệu lực 15 phút."
            );
        }
        return result;
    }

    // =========================================================================
    // UC-02: LOGIN (WITH BR-03 5-ATTEMPT LOCKOUT & REFRESH TOKEN)
    // =========================================================================
    @Override
    @Transactional(noRollbackFor = BusinessException.class)
    public LoginResponse login(LoginRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        Account account = accountRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> {
                    log.warn("[AUTH-LOGIN] Không tìm thấy tài khoản với email: '{}'", normalizedEmail);
                    return new BusinessException(
                            "AUTH-01",
                            "Email hoặc mật khẩu không chính xác.",
                            HttpStatus.UNAUTHORIZED
                    );
                });

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
            log.warn("[AUTH-LOGIN] Sai mật khẩu cho email '{}' (lần thử {}/{})", normalizedEmail, attempts, MAX_FAILED_ATTEMPTS);

            if (attempts >= MAX_FAILED_ATTEMPTS) {
                Instant lockUntil = now.plus(LOCK_DURATION_MINUTES, ChronoUnit.MINUTES);
                account.setLockedUntil(lockUntil);
                account.setStatus("LOCKED");
                accountRepository.saveAndFlush(account);

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

            accountRepository.saveAndFlush(account);
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
        accountRepository.saveAndFlush(account);

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
    // UC-04: FORGOT & RESET PASSWORD (WITH JAVAMAILSENDER SMTP)
    // =========================================================================
    @Override
    @Transactional
    public Map<String, String> requestPasswordReset(ForgotPasswordRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        Account account = accountRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản với email: " + normalizedEmail));

        String code = generateSixDigitCode();
        resetCodeStore.put(normalizedEmail, new ResetCodeEntry(code, Instant.now().plus(15, ChronoUnit.MINUTES)));

        boolean emailSent = sendPasswordResetEmail(normalizedEmail, code);

        auditService.recordAction(
                account.getAccountId(),
                account.getRole().getRoleName(),
                "PASSWORD_RESET_REQUEST",
                "Account",
                account.getAccountId(),
                null,
                "emailSent=" + emailSent,
                "Yêu cầu mã khôi phục mật khẩu qua email"
        );

        Map<String, String> result = new LinkedHashMap<>();
        result.put("email", normalizedEmail);
        result.put("mailSent", String.valueOf(emailSent));
        if (emailSent) {
            result.put("message", "Mã xác nhận (6 chữ số) đã được gửi tới hộp thư " + normalizedEmail + ". Mã có hiệu lực trong 15 phút.");
        } else {
            result.put("resetCode", code);
            result.put("message", "Hệ thống chưa cấu hình tài khoản SMTP Gmail thật trong application.yml nên hiển thị mã xác thực tại đây để kiểm thử (hiệu lực 15 phút).");
        }
        return result;
    }

    private boolean sendPasswordResetEmail(String recipientEmail, String code) {
        if (!isRealSmtpConfigured()) {
            log.info("[HMS-MAIL-DEV] Chưa cấu hình MAIL_USERNAME thật. Mã OTP khôi phục mật khẩu cho {} là: {}", recipientEmail, code);
            return false;
        }
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, false, "UTF-8");
            helper.setFrom(mailFrom);
            helper.setTo(recipientEmail);
            helper.setSubject("[HMS Luxury Hotel] Mã xác thực khôi phục mật khẩu");
            String htmlContent = """
                    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 10px; background: #faf9f5; color: #141413;">
                        <h2 style="margin-top: 0; color: #16233b;">HMS Luxury Hotel — Khôi phục Mật khẩu</h2>
                        <p>Xin chào,</p>
                        <p>Hệ thống vừa nhận được yêu cầu đặt lại mật khẩu cho tài khoản gắn với địa chỉ email <strong>%s</strong>.</p>
                        <p>Mã xác thực 6 chữ số của bạn là:</p>
                        <div style="text-align: center; margin: 22px 0;">
                            <span style="display: inline-block; padding: 12px 28px; font-size: 26px; font-weight: 700; letter-spacing: 6px; color: #faf9f5; background: #16233b; border-radius: 8px;">%s</span>
                        </div>
                        <p style="font-size: 13px; color: #5e5d59;">Mã này có hiệu lực trong vòng <strong>15 phút</strong>. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
                        <hr style="border: none; border-top: 1px solid #e8e6dc; margin: 20px 0;" />
                        <p style="font-size: 12px; color: #64748b; margin: 0;">Trân trọng,<br/>Ban Quản trị Hệ thống HMS Luxury Hotel</p>
                    </div>
                    """.formatted(recipientEmail, code);
            helper.setText(htmlContent, true);
            mailSender.send(mimeMessage);
            log.info("Đã gửi email khôi phục mật khẩu thành công tới {}", recipientEmail);
            return true;
        } catch (Exception ex) {
            log.warn("Không thể gửi email qua SMTP tới {} ({}). Mã OTP dự phòng: {}", recipientEmail, ex.getMessage(), code);
            return false;
        }
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

        String encodedPassword = passwordEncoder.encode(request.getNewPassword());
        account.setPasswordHash(encodedPassword);
        account.setFailedLoginAttempts(0);
        account.setLockedUntil(null);
        if ("LOCKED".equalsIgnoreCase(account.getStatus())) {
            account.setStatus(AccountStatus.ACTIVE.name());
        }
        account.setTokenVersion(account.getTokenVersion() + 1);
        accountRepository.saveAndFlush(account);
        log.info("[AUTH-RESET] Đã cập nhật mật khẩu mới thành công cho email '{}' (accountId={}, tokenVersion={})",
                normalizedEmail, account.getAccountId(), account.getTokenVersion());

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
    public Map<String, String> changePassword(String email, ChangePasswordRequest request) {
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
        // Increment tokenVersion to revoke tokens on other devices, then issue a fresh JWT for the current session
        account.setTokenVersion(account.getTokenVersion() + 1);
        Account savedAccount = accountRepository.saveAndFlush(account);

        String refreshedAccessToken = jwtTokenProvider.generateAccessToken(new UserPrincipal(savedAccount));

        auditService.recordAction(
                savedAccount.getAccountId(),
                savedAccount.getRole().getRoleName(),
                "CHANGE_PASSWORD",
                "Account",
                savedAccount.getAccountId(),
                null,
                "tokenVersion=" + savedAccount.getTokenVersion(),
                "Người dùng đổi mật khẩu cá nhân"
        );

        return Map.of(
                "message", "Đổi mật khẩu thành công.",
                "accessToken", refreshedAccessToken
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

        boolean isCustomerRole = RoleName.CUSTOMER.name().equalsIgnoreCase(role.getRoleName());
        String normalizedIdentity = StringUtils.hasText(request.getIdentityNumber())
                ? request.getIdentityNumber().trim()
                : null;
        if (isCustomerRole && normalizedIdentity != null
                && customerRepository.existsByIdentityNumberIgnoreCase(normalizedIdentity)) {
            throw new BusinessException("VAL-ID", "Số CCCD/Passport này đã được đăng ký cho một khách hàng khác.", HttpStatus.CONFLICT);
        }

        Department staffDepartment = null;
        if (!isCustomerRole) {
            Integer expectedDeptId = resolveDefaultDepartmentId(role.getRoleName());
            Integer deptId = request.getDepartmentId() != null ? request.getDepartmentId() : expectedDeptId;
            if (!expectedDeptId.equals(deptId)) {
                throw new BusinessException("VAL-DEPT", "Vai trò " + role.getRoleName() + " không thuộc phòng ban đã chọn.");
            }
            staffDepartment = departmentRepository.findById(deptId)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Phòng ban #" + deptId));
        }

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

        if (isCustomerRole) {
            Customer customer = Customer.builder()
                    .account(savedAccount)
                    .fullName(request.getFullName().trim())
                    .email(normalizedEmail)
                    .phone(request.getPhone().trim())
                    .identityNumber(normalizedIdentity)
                    .build();
            customerRepository.save(customer);
        } else {
            String generatedStaffCode = String.format("STF-%03d", savedAccount.getAccountId());
            Staff staff = Staff.builder()
                    .account(savedAccount)
                    .department(staffDepartment)
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
                String trimmedId = request.getIdentityNumber().trim();
                if (!trimmedId.isEmpty()
                        && customerRepository.existsByIdentityNumberIgnoreCaseAndCustomerIdNot(trimmedId, customer.getCustomerId())) {
                    throw new BusinessException("VAL-ID", "Số CCCD/Passport này đã thuộc về một khách hàng khác.", HttpStatus.CONFLICT);
                }
                customer.setIdentityNumber(trimmedId.isEmpty() ? null : trimmedId);
            }
            customerRepository.save(customer);
        } else {
            Staff staff = staffRepository.findByAccount_AccountId(accountId).orElse(null);
            if (staff != null) {
                staff.setFullName(request.getFullName().trim());
                staff.setPhone(request.getPhone().trim());
                if (request.getDepartmentId() != null) {
                    Integer expectedDeptId = resolveDefaultDepartmentId(account.getRole().getRoleName());
                    if (!expectedDeptId.equals(request.getDepartmentId())) {
                        throw new BusinessException(
                                "VAL-DEPT",
                                "Phòng ban đã chọn không khớp với vai trò hiện tại (" + account.getRole().getRoleName() + "). Vui lòng cập nhật vai trò tương ứng."
                        );
                    }
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

        if (!StringUtils.hasText(newStatus)) {
            throw new BusinessException("VAL-STATUS", "Trạng thái tài khoản không được để trống.");
        }
        String normalizedStatus = newStatus.trim().toUpperCase();
        try {
            AccountStatus.valueOf(normalizedStatus);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("VAL-STATUS", "Trạng thái tài khoản không hợp lệ (chỉ chấp nhận ACTIVE, LOCKED hoặc INACTIVE).");
        }

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

        boolean currentIsCustomer = RoleName.CUSTOMER.name().equalsIgnoreCase(account.getRole().getRoleName());
        boolean targetIsCustomer = RoleName.CUSTOMER.name().equalsIgnoreCase(newRole.getRoleName());
        if (currentIsCustomer != targetIsCustomer) {
            throw new BusinessException("BR-04", "Không thể chuyển đổi trực tiếp giữa tài khoản Khách hàng và Nhân sự nội bộ.");
        }

        Integer expectedDeptId = targetIsCustomer ? null : resolveDefaultDepartmentId(newRole.getRoleName());
        if (!targetIsCustomer && departmentId != null && !expectedDeptId.equals(departmentId)) {
            throw new BusinessException("VAL-DEPT", "Vai trò " + newRole.getRoleName() + " không thuộc phòng ban đã chọn.");
        }

        String oldRole = account.getRole().getRoleName();
        account.setRole(newRole);
        account.setTokenVersion(account.getTokenVersion() + 1);
        accountRepository.save(account);

        // Update Staff department if applicable
        if (!targetIsCustomer && expectedDeptId != null) {
            Staff staff = staffRepository.findByAccount_AccountId(accountId).orElse(null);
            if (staff != null) {
                Department dept = departmentRepository.findById(expectedDeptId)
                        .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Phòng ban #" + expectedDeptId));
                staff.setDepartment(dept);
                staff.setUpdatedAt(Instant.now());
                staffRepository.save(staff);
            }
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
