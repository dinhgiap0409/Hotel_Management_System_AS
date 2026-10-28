package com.fpt.hms.controller;

import com.fpt.hms.dto.room.RoomDto;
import com.fpt.hms.dto.room.RoomTypeDto;
import com.fpt.hms.dto.room.SetMaintenanceRequest;
import com.fpt.hms.dto.room.UpdateHousekeepingStatusRequest;
import com.fpt.hms.service.RoomHousekeepingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Module 2 (Owner: HieuVQ) - Room Categories (SALES_MANAGER), Physical Inventory, Housekeeping & Maintenance (HOUSEKEEPING_MANAGER & HOUSEKEEPING).
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "2. Room, Housekeeping & Maintenance (Module 2 - HieuVQ)")
public class HousekeepingController {

    private final RoomHousekeepingService roomHousekeepingService;

    @GetMapping("/room-types")
    @Operation(summary = "UC-14: Get all active room categories (Public, Customer, Front-Desk, Sales Manager)")
    public ResponseEntity<List<RoomTypeDto>> listActiveRoomTypes() {
        return ResponseEntity.ok(roomHousekeepingService.getAllActiveRoomTypes());
    }

    @GetMapping("/rooms")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'HOUSEKEEPING', 'HOUSEKEEPING_MANAGER', 'GENERAL_MANAGER')")
    @Operation(summary = "UC-18 & UC-19: View physical room inventory and housekeeping board")
    public ResponseEntity<List<RoomDto>> listAllRooms() {
        return ResponseEntity.ok(roomHousekeepingService.getAllRooms());
    }

    @PatchMapping("/housekeeping/rooms/{roomId}/status")
    @PreAuthorize("hasAnyRole('HOUSEKEEPING', 'HOUSEKEEPING_MANAGER')")
    @Operation(summary = "UC-19: Update room cleanliness status (DIRTY -> CLEAN -> INSPECTED)")
    public ResponseEntity<RoomDto> updateCleaningStatus(
            @PathVariable Integer roomId,
            @Valid @RequestBody UpdateHousekeepingStatusRequest request) {
        return ResponseEntity.ok(roomHousekeepingService.updateHousekeepingStatus(roomId, request));
    }

    @PostMapping("/housekeeping/rooms/{roomId}/maintenance")
    @PreAuthorize("hasAnyRole('HOUSEKEEPING', 'HOUSEKEEPING_MANAGER')")
    @Operation(summary = "UC-20: Lock room for maintenance with reason and estimated completion date")
    public ResponseEntity<RoomDto> setMaintenance(
            @PathVariable Integer roomId,
            @Valid @RequestBody SetMaintenanceRequest request) {
        return ResponseEntity.ok(roomHousekeepingService.setRoomMaintenance(roomId, request));
    }
}
