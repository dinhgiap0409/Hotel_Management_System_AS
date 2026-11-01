package com.fpt.hms.config;

import com.fpt.hms.entity.Account;
import com.fpt.hms.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Ensures seeded accounts with placeholder BCrypt hash can log in using "Admin@123".
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private static final String PLACEHOLDER_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        try {
            List<Account> accounts = accountRepository.findAll();
            String validHash = passwordEncoder.encode("Admin@123");
            int updatedCount = 0;
            for (Account acc : accounts) {
                if (PLACEHOLDER_HASH.equals(acc.getPasswordHash())) {
                    acc.setPasswordHash(validHash);
                    accountRepository.save(acc);
                    updatedCount++;
                }
            }
            if (updatedCount > 0) {
                log.info("Initialized valid BCrypt hash (Admin@123) for {} seeded accounts.", updatedCount);
            }
        } catch (Exception ex) {
            log.warn("Skipped seed password hash verification: {}", ex.getMessage());
        }
    }
}
