package com.fpt.hms.service;

import com.fpt.hms.dto.room.RoomDto;
import com.fpt.hms.dto.room.RoomTypeDto;
import com.fpt.hms.dto.room.SetMaintenanceRequest;
import com.fpt.hms.dto.room.UpdateHousekeepingStatusRequest;

import java.util.List;

public interface RoomHousekeepingService {
    List<RoomTypeDto> getAllActiveRoomTypes();
    List<RoomDto> getAllRooms();
    RoomDto updateHousekeepingStatus(Integer roomId, UpdateHousekeepingStatusRequest request);
    RoomDto setRoomMaintenance(Integer roomId, SetMaintenanceRequest request);
}