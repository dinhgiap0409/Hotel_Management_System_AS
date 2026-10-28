package com.fpt.hms.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "[Role]")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "role_id")
    private Integer roleId;

    @Column(name = "role_name", nullable = false, unique = true, length = 100)
    private String roleName;

    @Column(name = "description", length = 500)
    private String description;
}
