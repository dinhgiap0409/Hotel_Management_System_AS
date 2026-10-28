package com.fpt.hms.security;

import com.fpt.hms.entity.Account;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

@Getter
public class UserPrincipal implements UserDetails {

    private final Integer accountId;
    private final String email;
    private final String passwordHash;
    private final String roleName;
    private final String status;
    private final Integer tokenVersion;
    private final Collection<? extends GrantedAuthority> authorities;

    public UserPrincipal(Account account) {
        this.accountId = account.getAccountId();
        this.email = account.getEmail();
        this.passwordHash = account.getPasswordHash();
        this.roleName = account.getRole().getRoleName();
        this.status = account.getStatus();
        this.tokenVersion = account.getTokenVersion();
        this.authorities = List.of(new SimpleGrantedAuthority("ROLE_" + this.roleName));
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonLocked() {
        return !"LOCKED".equalsIgnoreCase(status);
    }

    @Override
    public boolean isEnabled() {
        return "ACTIVE".equalsIgnoreCase(status);
    }
}
