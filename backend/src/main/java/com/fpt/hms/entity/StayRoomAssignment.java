package com.fpt.hms.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "[Stay_Room_Assignment]")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StayRoomAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "assignment_id")
    private Integer assignmentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stay_id", nullable = false)
    private GuestStay guestStay;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(name = "assigned_from", nullable = false)
    private Instant assignedFrom = Instant.now();

    @Column(name = "assigned_to")
    private Instant assignedTo;

    @Column(name = "transfer_reason", length = 500)
    private String transferReason;
}
