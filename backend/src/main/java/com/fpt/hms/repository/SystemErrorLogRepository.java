package com.fpt.hms.repository;

import com.fpt.hms.entity.SystemErrorLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SystemErrorLogRepository extends JpaRepository<SystemErrorLog, Long> {
    List<SystemErrorLog> findAllByOrderByOccurredAtDesc();
}
