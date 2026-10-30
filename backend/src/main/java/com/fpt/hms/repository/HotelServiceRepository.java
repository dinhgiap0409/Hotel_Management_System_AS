package com.fpt.hms.repository;

import com.fpt.hms.entity.HotelService;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HotelServiceRepository extends JpaRepository<HotelService, Integer> {
    List<HotelService> findByStatus(String status);
}