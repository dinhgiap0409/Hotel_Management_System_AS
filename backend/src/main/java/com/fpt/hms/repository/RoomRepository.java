package com.fpt.hms.repository;

import com.fpt.hms.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomRepository extends JpaRepository<Room, Integer>, JpaSpecificationExecutor<Room> {
    boolean existsByRoomNumberIgnoreCase(String roomNumber);
    boolean existsByRoomNumberIgnoreCaseAndRoomIdNot(String roomNumber, Integer roomId);
    List<Room> findByRoomStatusNot(String roomStatus);
    long countByRoomType_RoomTypeIdAndRoomStatusNot(Integer roomTypeId, String roomStatus);
}
