package com.fpt.hms.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "[Guest_Stay]")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GuestStay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "stay_id")
    private Integer stayId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_id", nullable = false)
    private Reservation reservation;

    @Column(name = "actual_check_in", nullable = false)
    private Instant actualCheckIn = Instant.now();

    @Column(name = "actual_check_out")
    private Instant actualCheckOut;

    @Column(name = "guest_id_number", length = 30)
    private String guestIdNumber;

    @Column(name = "key_card_number", length = 50)
    private String keyCardNumber;

    @Column(name = "status", nullable = false, length = 30)
    private String status;

    @OneToMany(mappedBy = "guestStay", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<StayRoomAssignment> roomAssignments = new ArrayList<>();
}
