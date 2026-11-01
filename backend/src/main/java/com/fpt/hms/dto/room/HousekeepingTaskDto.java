package com.fpt.hms.dto.room;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

/**
 * UC-51: Housekeeping Task DTO.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HousekeepingTaskDto {

    private Integer taskId;
    private Integer roomId;
    private String roomNumber;
    private Integer floor;
    private Integer assignedToStaffId;
    private String assignedToStaffName;
    private Integer assignedByStaffId;
    private String assignedByStaffName;
    private String taskType; // CLEANING, MAINTENANCE
    private Instant scheduledAt;
    private LocalDate estimatedCompletionDate;
    private String status; // ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED
    private Instant startedAt;
    private Instant completedAt;
    private String note;
    private Instant createdAt;

    @JsonProperty("priority")
    public String getPriority() {
        return "NORMAL";
    }

    @JsonProperty("room")
    public Map<String, Object> getRoom() {
        return Map.of(
                "roomId", roomId != null ? roomId : 0,
                "roomNumber", roomNumber != null ? roomNumber : ""
        );
    }
}
