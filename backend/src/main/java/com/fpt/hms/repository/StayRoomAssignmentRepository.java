package com.fpt.hms.repository;

import com.fpt.hms.entity.StayRoomAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StayRoomAssignmentRepository extends JpaRepository<StayRoomAssignment, Integer> {
    List<StayRoomAssignment> findByGuestStay_StayIdOrderByAssignedFromDesc(Integer stayId);

    /**
     * BR-12: true when the room is still assigned to an active stay
     * (assignment not yet closed — assignedTo is null — and the stay is ACTIVE).
     */
    boolean existsByRoom_RoomIdAndAssignedToIsNullAndGuestStay_Status(Integer roomId, String guestStayStatus);
}