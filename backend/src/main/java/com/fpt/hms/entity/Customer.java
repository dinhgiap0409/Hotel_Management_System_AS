package com.fpt.hms.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "[Customer]")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "customer_id")
    private Integer customerId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id")
    private Account account;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_staff_id")
    private Staff createdByStaff;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(name = "email", length = 254)
    private String email;

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "identity_number", length = 30)
    private String identityNumber;
}
