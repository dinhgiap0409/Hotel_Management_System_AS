package com.fpt.hms.repository;

import com.fpt.hms.entity.RoomType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomTypeRepository extends JpaRepository<RoomType, Integer> {
    List<RoomType> findByIsActiveTrue();
    List<RoomType> findAllByOrderByRoomTypeIdAsc();
    boolean existsByTypeNameIgnoreCase(String typeName);
    boolean existsByTypeNameIgnoreCaseAndRoomTypeIdNot(String typeName, Integer roomTypeId);
}
