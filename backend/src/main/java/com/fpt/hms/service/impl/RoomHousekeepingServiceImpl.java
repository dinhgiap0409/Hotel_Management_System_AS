package com.fpt.hms.service.impl;

import com.fpt.hms.common.MessageResolver;
import com.fpt.hms.dto.room.RoomDto;
import com.fpt.hms.dto.room.RoomTypeDto;
import com.fpt.hms.dto.room.SetMaintenanceRequest;
import com.fpt.hms.dto.room.UpdateHousekeepingStatusRequest;
import com.fpt.hms.entity.Room;
import com.fpt.hms.enums.RoomStatus;
import com.fpt.hms.enums.StayStatus;
import com.fpt.hms.exception.BusinessException;
import com.fpt.hms.exception.ResourceNotFoundException;
import com.fpt.hms.repository.RoomRepository;
import com.fpt.hms.repository.RoomTypeRepository;
import com.fpt.hms.service.RoomHousekeepingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Module 2 (Owner: HieuVQ) - Room & Facility, Housekeeping & Maintenance Service (UC-11..20, UC-51).
 */
@Service
@RequiredArgsConstructor
public class RoomHousekeepingServiceImpl implements RoomHousekeepingService {

    private final RoomTypeRepository roomTypeRepository;
    private final RoomRepository roomRepository;
    private final MessageResolver messageResolver;

    @Override
    @Transactional(readOnly = true)
    public List<RoomTypeDto> getAllActiveRoomTypes() {
        return roomTypeRepository.findByIsActiveTrue().stream()
                .map(rt -> RoomTypeDto.builder()
                        .roomTypeId(rt.getRoomTypeId())
                        .typeName(rt.getTypeName())
                        .capacity(rt.getCapacity())
                        .basePrice(rt.getBasePrice())
                        .amenities(rt.getAmenities())
                        .description(rt.getDescription())
                        .imageUrl(rt.getImageUrl())
                        .isActive(rt.getIsActive())
                        .build())
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoomDto> getAllRooms() {
        return roomRepository.findByRoomStatusNot(RoomStatus.ARCHIVED.name()).stream()
                .map(this::toRoomDto)
                .toList();
    }

    @Override
    @Transactional
    public RoomDto updateHousekeepingStatus(Integer roomId, UpdateHousekeepingStatusRequest request) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Room not found"));

        if (RoomStatus.UNDER_MAINTENANCE.name().equalsIgnoreCase(room.getRoomStatus())) {
            throw new BusinessException("MSG07A", messageResolver.resolve("MSG07A"));
        }

        room.setCleaningStatus(request.getNewCleaningStatus().toUpperCase());
        if (request.getNotes() != null) {
            room.setNotes(request.getNotes());
        }
        return toRoomDto(roomRepository.save(room));
    }

    @Override
    @Transactional
    public RoomDto setRoomMaintenance(Integer roomId, SetMaintenanceRequest request) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Room not found"));

        if (StayStatus.OCCUPIED.name().equalsIgnoreCase(room.getStayStatus())) {
            throw new BusinessException("MSG08A", messageResolver.resolve("MSG08A"));
        }

        room.setRoomStatus(RoomStatus.UNDER_MAINTENANCE.name());
        room.setNotes("Maintenance: " + request.getMaintenanceReason()
                + " (Est: " + request.getEstimatedCompletionDate() + ")");
        return toRoomDto(roomRepository.save(room));
    }

    private RoomDto toRoomDto(Room room) {
        return RoomDto.builder()
                .roomId(room.getRoomId())
                .roomNumber(room.getRoomNumber())
                .floor(room.getFloor())
                .roomTypeId(room.getRoomType().getRoomTypeId())
                .roomTypeName(room.getRoomType().getTypeName())
                .basePrice(room.getRoomType().getBasePrice())
                .stayStatus(room.getStayStatus())
                .cleaningStatus(room.getCleaningStatus())
                .roomStatus(room.getRoomStatus())
                .notes(room.getNotes())
                .build();
    }
}