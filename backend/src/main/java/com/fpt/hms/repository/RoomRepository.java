package com.fpt.hms.repository;

import com.fpt.hms.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, Integer> {
    boolean existsByRoomNumberIgnoreCase(String roomNumber);
    List<Room> findByRoomStatusNot(String roomStatus);
}