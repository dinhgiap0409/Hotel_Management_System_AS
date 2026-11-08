package com.fpt.hms.repository;

import com.fpt.hms.entity.HousekeepingTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HousekeepingTaskRepository extends JpaRepository<HousekeepingTask, Integer>, JpaSpecificationExecutor<HousekeepingTask> {
    List<HousekeepingTask> findByAssignedToStaff_StaffIdOrderByScheduledAtDesc(Integer staffId);
    List<HousekeepingTask> findByRoom_RoomIdOrderByScheduledAtDesc(Integer roomId);
    boolean existsByRoom_RoomIdAndStatusIn(Integer roomId, List<String> statuses);
}
