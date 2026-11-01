package com.fpt.hms.service;

import com.fpt.hms.common.PageResponse;
import com.fpt.hms.dto.room.*;

import java.util.List;

/**
 * Module 2 (Owner: HieuVQ) - Room Types, Physical Rooms, Housekeeping & Maintenance.
 * Covers: UC-11..13, UC-15..20, UC-51.
 */
public interface RoomHousekeepingService {

    // --- UC-11..14: Room Types & Dynamic Pricing ---
    List<RoomTypeDto> getAllActiveRoomTypes();
    List<RoomTypeDto> getAllRoomTypes(Boolean activeOnly);
    RoomTypeDto getRoomTypeById(Integer roomTypeId);
    RoomTypeDto createRoomType(CreateRoomTypeRequest request);
    RoomTypeDto updateRoomType(Integer roomTypeId, UpdateRoomTypeRequest request);
    RoomTypeDto toggleRoomTypeStatus(Integer roomTypeId);
    List<RoomTypePriceDto> getPricesByRoomType(Integer roomTypeId);
    List<RoomTypePriceDto> updateRoomTypePrices(Integer roomTypeId, UpdateRoomTypePricesRequest request);

    // --- UC-15..18: Physical Room Inventory ---
    List<RoomDto> getAllRooms();
    PageResponse<RoomDto> searchRooms(Integer floor, Integer roomTypeId, String stayStatus,
                                      String cleaningStatus, String roomStatus, String search,
                                      int page, int size);
    RoomDto getRoomById(Integer roomId);
    RoomDto createRoom(CreateRoomRequest request);
    RoomDto updateRoom(Integer roomId, UpdateRoomRequest request);
    RoomDto updateRoomStatus(Integer roomId, String newStatus);

    // --- UC-19..20: Cleanliness & Maintenance ---
    RoomDto updateHousekeepingStatus(Integer roomId, UpdateHousekeepingStatusRequest request);
    RoomDto setRoomMaintenance(Integer roomId, SetMaintenanceRequest request);
    RoomDto endRoomMaintenance(Integer roomId, EndMaintenanceRequest request);

    // --- UC-51: Housekeeping Task Assignment ---
    PageResponse<HousekeepingTaskDto> getTasks(Integer staffId, Integer roomId, String status,
                                               String taskType, int page, int size);
    HousekeepingTaskDto getTaskById(Integer taskId);
    HousekeepingTaskDto createTask(CreateHousekeepingTaskRequest request, Integer currentAccountId);
    HousekeepingTaskDto updateTaskStatus(Integer taskId, UpdateHousekeepingTaskStatusRequest request, Integer currentAccountId);
}
