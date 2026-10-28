package com.fpt.hms.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "[Room]")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "room_id")
    private Integer roomId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_type_id", nullable = false)
    private RoomType roomType;

    @Column(name = "room_number", nullable = false, unique = true, length = 100)
    private String roomNumber;

    @Column(name = "floor", nullable = false)
    private Integer floor;

    @Column(name = "stay_status", nullable = false, length = 30)
    private String stayStatus;

    @Column(name = "cleaning_status", nullable = false, length = 30)
    private String cleaningStatus;

    @Column(name = "room_status", nullable = false, length = 30)
    private String roomStatus;

    @Column(name = "notes", length = 500)
    private String notes;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version = 0;
}
