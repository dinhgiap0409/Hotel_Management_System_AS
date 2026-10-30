package com.fpt.hms.repository;

import com.fpt.hms.entity.RoomTypePrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomTypePriceRepository extends JpaRepository<RoomTypePrice, Integer> {
    List<RoomTypePrice> findByRoomType_RoomTypeIdAndIsActiveTrue(Integer roomTypeId);
}