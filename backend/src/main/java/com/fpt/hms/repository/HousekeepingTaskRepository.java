package com.fpt.hms.repository;

import com.fpt.hms.entity.HousekeepingTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HousekeepingTaskRepository extends JpaRepository<HousekeepingTask, Integer> {
    List<HousekeepingTask> findByAssignedToStaff_StaffIdOrderByScheduledAtDesc(Integer staffId);
}