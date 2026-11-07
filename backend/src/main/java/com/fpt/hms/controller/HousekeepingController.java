package com.fpt.hms.controller;

import com.fpt.hms.common.PageResponse;
import com.fpt.hms.dto.room.*;
import com.fpt.hms.security.UserPrincipal;
import com.fpt.hms.service.RoomHousekeepingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Module 2 (Owner: HieuVQ) - Room Categories, Physical Inventory, Housekeeping & Maintenance.
 * Handles: UC-11..13, UC-15..20, UC-51.
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "2. Room, Housekeeping & Maintenance (Module 2 - HieuVQ)")
public class HousekeepingController {

    private final RoomHousekeepingService roomHousekeepingService;

    // =========================================================================
    // 1. ROOM TYPES & DYNAMIC PRICING (UC-11..14)
    // =========================================================================

    @GetMapping("/room-types")
    @Operation(summary = "UC-14: Get active room categories (Public, Customer, Front-Desk, Sales Manager)")
    public ResponseEntity<List<RoomTypeDto>> listRoomTypes(
            @RequestParam(required = false) Boolean activeOnly) {
        return ResponseEntity.ok(roomHousekeepingService.getAllRoomTypes(activeOnly != null ? activeOnly : true));
    }

    @GetMapping("/room-types/{roomTypeId}")
    @Operation(summary = "Get single room category details by ID")
    public ResponseEntity<RoomTypeDto> getRoomTypeById(@PathVariable Integer roomTypeId) {
        return ResponseEntity.ok(roomHousekeepingService.getRoomTypeById(roomTypeId));
    }

    @PostMapping("/room-types")
    @PreAuthorize("hasAnyRole('SALES_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-11: Create a new room category (SALES_MANAGER, ADMIN)")
    public ResponseEntity<RoomTypeDto> createRoomType(@Valid @RequestBody CreateRoomTypeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(roomHousekeepingService.createRoomType(request));
    }

    @PutMapping("/room-types/{roomTypeId}")
    @PreAuthorize("hasAnyRole('SALES_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-12: Update room category details and base price (SALES_MANAGER, ADMIN)")
    public ResponseEntity<RoomTypeDto> updateRoomType(
            @PathVariable Integer roomTypeId,
            @Valid @RequestBody UpdateRoomTypeRequest request) {
        return ResponseEntity.ok(roomHousekeepingService.updateRoomType(roomTypeId, request));
    }

    @PatchMapping("/room-types/{roomTypeId}/status")
    @PreAuthorize("hasAnyRole('SALES_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-13: Toggle room category Active/Inactive status (SALES_MANAGER, ADMIN)")
    public ResponseEntity<RoomTypeDto> toggleRoomTypeStatus(@PathVariable Integer roomTypeId) {
        return ResponseEntity.ok(roomHousekeepingService.toggleRoomTypeStatus(roomTypeId));
    }

    @GetMapping("/room-types/{roomTypeId}/prices")
    @PreAuthorize("hasAnyRole('SALES_MANAGER', 'GENERAL_MANAGER', 'ADMIN')")
    @Operation(summary = "Get day-of-week pricing schedule for room category")
    public ResponseEntity<List<RoomTypePriceDto>> getRoomTypePrices(@PathVariable Integer roomTypeId) {
        return ResponseEntity.ok(roomHousekeepingService.getPricesByRoomType(roomTypeId));
    }

    @PutMapping("/room-types/{roomTypeId}/prices")
    @PreAuthorize("hasAnyRole('SALES_MANAGER', 'ADMIN')")
    @Operation(summary = "Set/update day-of-week dynamic prices for room category (SALES_MANAGER, ADMIN)")
    public ResponseEntity<List<RoomTypePriceDto>> updateRoomTypePrices(
            @PathVariable Integer roomTypeId,
            @Valid @RequestBody UpdateRoomTypePricesRequest request) {
        return ResponseEntity.ok(roomHousekeepingService.updateRoomTypePrices(roomTypeId, request));
    }

    // =========================================================================
    // 2. PHYSICAL ROOMS INVENTORY (UC-15..18)
    // =========================================================================

    @GetMapping("/rooms")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'HOUSEKEEPING', 'HOUSEKEEPING_MANAGER', 'SALES_MANAGER', 'GENERAL_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-18 & UC-19: View physical room inventory (supports unpaged list or pagination)")
    public ResponseEntity<?> listRooms(
            @RequestParam(required = false) Integer floor,
            @RequestParam(required = false) Integer roomTypeId,
            @RequestParam(required = false) String stayStatus,
            @RequestParam(required = false) String cleaningStatus,
            @RequestParam(required = false) String roomStatus,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {

        if (page != null) {
            int pageSize = (size != null && size > 0) ? size : 20;
            return ResponseEntity.ok(roomHousekeepingService.searchRooms(
                    floor, roomTypeId, stayStatus, cleaningStatus, roomStatus, search, page, pageSize));
        }

        // Backward-compatible unpaged list
        return ResponseEntity.ok(roomHousekeepingService.getAllRooms());
    }

    @GetMapping("/rooms/search")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'HOUSEKEEPING', 'HOUSEKEEPING_MANAGER', 'SALES_MANAGER', 'GENERAL_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-18: Paginated search of physical room inventory")
    public ResponseEntity<PageResponse<RoomDto>> searchRoomsPaginated(
            @RequestParam(required = false) Integer floor,
            @RequestParam(required = false) Integer roomTypeId,
            @RequestParam(required = false) String stayStatus,
            @RequestParam(required = false) String cleaningStatus,
            @RequestParam(required = false) String roomStatus,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(roomHousekeepingService.searchRooms(
                floor, roomTypeId, stayStatus, cleaningStatus, roomStatus, search, page, size));
    }

    @GetMapping("/rooms/{roomId}")
    @PreAuthorize("hasAnyRole('FRONT_DESK', 'HOUSEKEEPING', 'HOUSEKEEPING_MANAGER', 'SALES_MANAGER', 'GENERAL_MANAGER', 'ADMIN')")
    @Operation(summary = "Get physical room details by ID")
    public ResponseEntity<RoomDto> getRoomById(@PathVariable Integer roomId) {
        return ResponseEntity.ok(roomHousekeepingService.getRoomById(roomId));
    }

    @PostMapping("/rooms")
    @PreAuthorize("hasAnyRole('HOUSEKEEPING_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-15: Create new physical room (HOUSEKEEPING_MANAGER, ADMIN)")
    public ResponseEntity<RoomDto> createRoom(@Valid @RequestBody CreateRoomRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(roomHousekeepingService.createRoom(request));
    }

    @PutMapping("/rooms/{roomId}")
    @PreAuthorize("hasAnyRole('HOUSEKEEPING_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-16: Update physical room details (HOUSEKEEPING_MANAGER, ADMIN)")
    public ResponseEntity<RoomDto> updateRoom(
            @PathVariable Integer roomId,
            @Valid @RequestBody UpdateRoomRequest request) {
        return ResponseEntity.ok(roomHousekeepingService.updateRoom(roomId, request));
    }

    @PatchMapping("/rooms/{roomId}/status")
    @PreAuthorize("hasAnyRole('HOUSEKEEPING_MANAGER', 'HOUSEKEEPING', 'FRONT_DESK', 'ADMIN')")
    @Operation(summary = "UC-17 & UC-19: Update room status or cleanliness")
    public ResponseEntity<RoomDto> updateRoomStatusOrCleanliness(
            @PathVariable Integer roomId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String cleanliness) {

        RoomDto result = null;
        if (cleanliness != null && !cleanliness.isBlank()) {
            UpdateHousekeepingStatusRequest req = new UpdateHousekeepingStatusRequest();
            req.setNewCleaningStatus(cleanliness.toUpperCase());
            result = roomHousekeepingService.updateHousekeepingStatus(roomId, req);
        }
        if (status != null && !status.isBlank()) {
            result = roomHousekeepingService.updateRoomStatus(roomId, status);
        }
        if (result == null) {
            result = roomHousekeepingService.getRoomById(roomId);
        }
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/rooms/{roomId}")
    @PreAuthorize("hasAnyRole('HOUSEKEEPING_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-17: Soft-delete / Archive physical room (HOUSEKEEPING_MANAGER, ADMIN)")
    public ResponseEntity<RoomDto> archiveRoom(@PathVariable Integer roomId) {
        return ResponseEntity.ok(roomHousekeepingService.updateRoomStatus(roomId, "ARCHIVED"));
    }

    // =========================================================================
    // 3. CLEANLINESS & MAINTENANCE (UC-19..20)
    // =========================================================================

    @PatchMapping("/housekeeping/rooms/{roomId}/status")
    @PreAuthorize("hasAnyRole('HOUSEKEEPING', 'HOUSEKEEPING_MANAGER', 'FRONT_DESK')")
    @Operation(summary = "UC-19: Update room cleanliness status (DIRTY -> CLEAN -> INSPECTED)")
    public ResponseEntity<RoomDto> updateCleaningStatus(
            @PathVariable Integer roomId,
            @Valid @RequestBody UpdateHousekeepingStatusRequest request) {
        return ResponseEntity.ok(roomHousekeepingService.updateHousekeepingStatus(roomId, request));
    }

    @PostMapping("/housekeeping/rooms/{roomId}/maintenance")
    @PreAuthorize("hasAnyRole('HOUSEKEEPING', 'HOUSEKEEPING_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-20: Lock room for maintenance with reason and estimated completion date")
    public ResponseEntity<RoomDto> setMaintenance(
            @PathVariable Integer roomId,
            @Valid @RequestBody SetMaintenanceRequest request) {
        return ResponseEntity.ok(roomHousekeepingService.setRoomMaintenance(roomId, request));
    }

    @PostMapping("/housekeeping/rooms/{roomId}/end-maintenance")
    @PreAuthorize("hasAnyRole('HOUSEKEEPING', 'HOUSEKEEPING_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-20: Reopen room after maintenance, resets status to ACTIVE (HOUSEKEEPING_MANAGER, ADMIN)")
    public ResponseEntity<RoomDto> endMaintenance(
            @PathVariable Integer roomId,
            @RequestBody(required = false) EndMaintenanceRequest request) {
        return ResponseEntity.ok(roomHousekeepingService.endRoomMaintenance(roomId, request));
    }

    // =========================================================================
    // 4. HOUSEKEEPING TASKS (UC-51)
    // =========================================================================

    @GetMapping("/housekeeping/staff")
    @PreAuthorize("hasAnyRole('HOUSEKEEPING', 'HOUSEKEEPING_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-51: Get list of housekeeping staff for task allocation")
    public ResponseEntity<List<StaffSimpleDto>> listHousekeepingStaff() {
        return ResponseEntity.ok(roomHousekeepingService.getHousekeepingStaff());
    }

    @GetMapping("/housekeeping/tasks")
    @PreAuthorize("hasAnyRole('HOUSEKEEPING', 'HOUSEKEEPING_MANAGER', 'GENERAL_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-51: Get housekeeping tasks with filters (supports unpaged list or pagination)")
    public ResponseEntity<?> listTasks(
            @RequestParam(required = false) Integer staffId,
            @RequestParam(required = false) Integer roomId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String taskType,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {

        int targetPage = (page != null) ? page : 0;
        int targetSize = (size != null && size > 0) ? size : 100;

        PageResponse<HousekeepingTaskDto> pageResult = roomHousekeepingService.getTasks(
                staffId, roomId, status, taskType, targetPage, targetSize);

        if (page == null) {
            // Backward-compatible for legacy frontend table expecting a direct list
            return ResponseEntity.ok(pageResult.getContent());
        }

        return ResponseEntity.ok(pageResult);
    }

    @GetMapping("/housekeeping/tasks/{taskId}")
    @PreAuthorize("hasAnyRole('HOUSEKEEPING', 'HOUSEKEEPING_MANAGER', 'GENERAL_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-51: Get single housekeeping task details")
    public ResponseEntity<HousekeepingTaskDto> getTaskById(@PathVariable Integer taskId) {
        return ResponseEntity.ok(roomHousekeepingService.getTaskById(taskId));
    }

    @PostMapping("/housekeeping/tasks")
    @PreAuthorize("hasAnyRole('HOUSEKEEPING_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-51: Assign housekeeping task to staff (HOUSEKEEPING_MANAGER, ADMIN)")
    public ResponseEntity<HousekeepingTaskDto> createTask(
            @Valid @RequestBody CreateHousekeepingTaskRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        Integer accountId = (principal != null) ? principal.getAccountId() : null;
        return ResponseEntity.status(HttpStatus.CREATED).body(roomHousekeepingService.createTask(request, accountId));
    }

    @PatchMapping("/housekeeping/tasks/{taskId}/status")
    @PreAuthorize("hasAnyRole('HOUSEKEEPING', 'HOUSEKEEPING_MANAGER', 'ADMIN')")
    @Operation(summary = "UC-51: Update task status (IN_PROGRESS, COMPLETED, CANCELLED)")
    public ResponseEntity<HousekeepingTaskDto> updateTaskStatus(
            @PathVariable Integer taskId,
            @Valid @RequestBody UpdateHousekeepingTaskStatusRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        Integer accountId = (principal != null) ? principal.getAccountId() : null;
        return ResponseEntity.ok(roomHousekeepingService.updateTaskStatus(taskId, request, accountId));
    }
}
