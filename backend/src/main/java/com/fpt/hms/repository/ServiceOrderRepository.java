package com.fpt.hms.repository;

import com.fpt.hms.entity.ServiceOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ServiceOrderRepository extends JpaRepository<ServiceOrder, Integer> {
    List<ServiceOrder> findByGuestStay_StayIdOrderByOrderTimeDesc(Integer stayId);
}