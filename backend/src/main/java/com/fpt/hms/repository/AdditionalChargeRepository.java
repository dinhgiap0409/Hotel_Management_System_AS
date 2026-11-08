package com.fpt.hms.repository;

import com.fpt.hms.entity.AdditionalCharge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AdditionalChargeRepository extends JpaRepository<AdditionalCharge, Integer> {
    List<AdditionalCharge> findByFolio_FolioId(Integer folioId);
    List<AdditionalCharge> findByFolio_GuestStay_StayId(Integer stayId);
}