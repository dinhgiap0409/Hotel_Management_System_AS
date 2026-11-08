package com.fpt.hms.service.impl;

import com.fpt.hms.common.MessageResolver;
import com.fpt.hms.common.PageResponse;
import com.fpt.hms.dto.room.*;
import com.fpt.hms.entity.HousekeepingTask;
import com.fpt.hms.entity.Reservation;
import com.fpt.hms.entity.Room;
import com.fpt.hms.entity.RoomType;
import com.fpt.hms.entity.RoomTypePrice;
import com.fpt.hms.entity.Staff;
import com.fpt.hms.enums.CleaningStatus;
import com.fpt.hms.enums.GuestStayStatus;
import com.fpt.hms.enums.ReservationStatus;
import com.fpt.hms.enums.RoomStatus;
import com.fpt.hms.enums.StayStatus;
import com.fpt.hms.exception.BusinessException;
import com.fpt.hms.exception.ResourceNotFoundException;
import com.fpt.hms.repository.AccountRepository;
import com.fpt.hms.repository.HousekeepingTaskRepository;
import com.fpt.hms.repository.ReservationRepository;
import com.fpt.hms.repository.RoomRepository;
import com.fpt.hms.repository.RoomTypePriceRepository;
import com.fpt.hms.repository.RoomTypeRepository;
import com.fpt.hms.repository.StaffRepository;
import com.fpt.hms.repository.StayRoomAssignmentRepository;
import com.fpt.hms.service.RoomHousekeepingService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Module 2 (Owner: HieuVQ) - Room Types, Physical Rooms, Housekeeping & Maintenance.
 */
@Service
@RequiredArgsConstructor
public class RoomHousekeepingServiceImpl implements RoomHousekeepingService {

    private final RoomTypeRepository roomTypeRepository;
    private final RoomTypePriceRepository roomTypePriceRepository;
    private final RoomRepository roomRepository;
    private final HousekeepingTaskRepository housekeepingTaskRepository;
    private final StaffRepository staffRepository;
    private final AccountRepository accountRepository;
    private final ReservationRepository reservationRepository;
    private final StayRoomAssignmentRepository stayRoomAssignmentRepository;
    private final MessageResolver messageResolver;

    // UC-51: task types (V1 Housekeeping_Task comment) and priorities (V4).
    private static final Set<String> TASK_TYPES = Set.of("CLEANING", "MAINTENANCE");
    private static final Set<String> TASK_PRIORITIES = Set.of("LOW", "NORMAL", "HIGH", "URGENT");
    // UC-51 task lifecycle: ASSIGNED -> IN_PROGRESS -> COMPLETED, or CANCELLED
    // from ASSIGNED / IN_PROGRESS. COMPLETED and CANCELLED are terminal.
    private static final Set<String> TASK_FINAL_STATUSES = Set.of("COMPLETED", "CANCELLED");

    // =========================================================================
    // 1. ROOM TYPES (UC-11..14) & DYNAMIC PRICING
    // =========================================================================

    @Override
    @Transactional(readOnly = true)
    public List<RoomTypeDto> getAllActiveRoomTypes() {
        return roomTypeRepository.findByIsActiveTrue().stream()
                .map(this::toRoomTypeDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoomTypeDto> getAllRoomTypes(Boolean activeOnly) {
        List<RoomType> list = (activeOnly != null && activeOnly)
                ? roomTypeRepository.findByIsActiveTrue()
                : roomTypeRepository.findAllByOrderByRoomTypeIdAsc();
        return list.stream().map(this::toRoomTypeDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public RoomTypeDto getRoomTypeById(Integer roomTypeId) {
        RoomType rt = roomTypeRepository.findById(roomTypeId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng phòng với mã: " + roomTypeId));
        return toRoomTypeDto(rt);
    }

    @Override
    @Transactional
    public RoomTypeDto createRoomType(CreateRoomTypeRequest request) {
        if (roomTypeRepository.existsByTypeNameIgnoreCase(request.getTypeName().trim())) {
            throw new BusinessException("MSG_ROOMTYPE_EXISTS", "Tên hạng phòng đã tồn tại trong hệ thống.");
        }

        RoomType roomType = RoomType.builder()
                .typeName(request.getTypeName().trim())
                .capacity(request.getCapacity())
                .basePrice(request.getBasePrice())
                .amenities(request.getAmenities())
                .description(request.getDescription())
                .imageUrl(request.getImageUrl())
                .isActive(true)
                .build();

        return toRoomTypeDto(roomTypeRepository.save(roomType));
    }

    @Override
    @Transactional
    public RoomTypeDto updateRoomType(Integer roomTypeId, UpdateRoomTypeRequest request) {
        RoomType roomType = roomTypeRepository.findById(roomTypeId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng phòng với mã: " + roomTypeId));

        if (roomTypeRepository.existsByTypeNameIgnoreCaseAndRoomTypeIdNot(request.getTypeName().trim(), roomTypeId)) {
            throw new BusinessException("MSG_ROOMTYPE_EXISTS", "Tên hạng phòng đã tồn tại trong hệ thống.");
        }

        roomType.setTypeName(request.getTypeName().trim());
        roomType.setCapacity(request.getCapacity());
        roomType.setBasePrice(request.getBasePrice());
        roomType.setAmenities(request.getAmenities());
        roomType.setDescription(request.getDescription());
        roomType.setImageUrl(request.getImageUrl());
        if (request.getIsActive() != null) {
            // BR-11: deactivating through the update endpoint is the same
            // rule as the toggle endpoint — check before flipping the flag.
            if (!request.getIsActive() && Boolean.TRUE.equals(roomType.getIsActive())) {
                assertRoomTypeHasNoActiveRooms(roomTypeId);
            }
            roomType.setIsActive(request.getIsActive());
        }

        return toRoomTypeDto(roomTypeRepository.save(roomType));
    }

    /**
     * BR-11: a room type with assigned physical rooms cannot be deactivated.
     * Archived rooms do not count — they are already out of inventory.
     */
    private void assertRoomTypeHasNoActiveRooms(Integer roomTypeId) {
        long activeRooms = roomRepository.countByRoomType_RoomTypeIdAndRoomStatusNot(
                roomTypeId, RoomStatus.ARCHIVED.name());
        if (activeRooms > 0) {
            throw new BusinessException("MSG_ROOMTYPE_HAS_ROOMS",
                    messageResolver.resolve("MSG_ROOMTYPE_HAS_ROOMS"));
        }
    }

    @Override
    @Transactional
    public RoomTypeDto toggleRoomTypeStatus(Integer roomTypeId) {
        RoomType roomType = roomTypeRepository.findById(roomTypeId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng phòng với mã: " + roomTypeId));

        boolean newStatus = !Boolean.TRUE.equals(roomType.getIsActive());
        // BR-11: only deactivation is guarded — reactivation is always allowed.
        if (!newStatus) {
            assertRoomTypeHasNoActiveRooms(roomTypeId);
        }
        roomType.setIsActive(newStatus);
        return toRoomTypeDto(roomTypeRepository.save(roomType));
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoomTypePriceDto> getPricesByRoomType(Integer roomTypeId) {
        if (!roomTypeRepository.existsById(roomTypeId)) {
            throw new ResourceNotFoundException("Không tìm thấy hạng phòng với mã: " + roomTypeId);
        }
        return roomTypePriceRepository.findByRoomType_RoomTypeIdOrderByDayOfWeekAsc(roomTypeId).stream()
                .map(this::toRoomTypePriceDto)
                .toList();
    }

    @Override
    @Transactional
    public List<RoomTypePriceDto> updateRoomTypePrices(Integer roomTypeId, UpdateRoomTypePricesRequest request) {
        RoomType roomType = roomTypeRepository.findById(roomTypeId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng phòng với mã: " + roomTypeId));

        // Xóa bảng giá cũ của hạng phòng này và ghi nhận bảng giá mới
        roomTypePriceRepository.deleteByRoomType_RoomTypeId(roomTypeId);

        List<RoomTypePrice> newPrices = new ArrayList<>();
        for (RoomTypePriceDto dto : request.getPrices()) {
            RoomTypePrice price = RoomTypePrice.builder()
                    .roomType(roomType)
                    .dayOfWeek(dto.getDayOfWeek())
                    .price(dto.getPrice())
                    .effectiveFrom(dto.getEffectiveFrom())
                    .effectiveTo(dto.getEffectiveTo())
                    .isActive(dto.getIsActive() != null ? dto.getIsActive() : true)
                    .build();
            newPrices.add(price);
        }

        List<RoomTypePrice> saved = roomTypePriceRepository.saveAll(newPrices);
        return saved.stream().map(this::toRoomTypePriceDto).toList();
    }

    // =========================================================================
    // 2. PHYSICAL ROOMS INVENTORY (UC-15..18)
    // =========================================================================

    @Override
    @Transactional(readOnly = true)
    public List<RoomDto> getAllRooms() {
        return roomRepository.findByRoomStatusNot(RoomStatus.ARCHIVED.name()).stream()
                .map(this::toRoomDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<RoomDto> searchRooms(Integer floor, Integer roomTypeId, String stayStatus,
                                             String cleaningStatus, String roomStatus, String search,
                                             int page, int size) {
        Specification<Room> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (floor != null) {
                predicates.add(cb.equal(root.get("floor"), floor));
            }
            if (roomTypeId != null) {
                predicates.add(cb.equal(root.get("roomType").get("roomTypeId"), roomTypeId));
            }
            if (stayStatus != null && !stayStatus.isBlank()) {
                predicates.add(cb.equal(cb.upper(root.get("stayStatus")), stayStatus.trim().toUpperCase()));
            }
            if (cleaningStatus != null && !cleaningStatus.isBlank()) {
                predicates.add(cb.equal(cb.upper(root.get("cleaningStatus")), cleaningStatus.trim().toUpperCase()));
            }
            if (roomStatus != null && !roomStatus.isBlank()) {
                predicates.add(cb.equal(cb.upper(root.get("roomStatus")), roomStatus.trim().toUpperCase()));
            } else {
                // Mặc định không hiển thị phòng đã lưu trữ ARCHIVED trừ khi yêu cầu cụ thể
                predicates.add(cb.notEqual(cb.upper(root.get("roomStatus")), RoomStatus.ARCHIVED.name()));
            }
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.like(cb.lower(root.get("roomNumber")), pattern));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        PageRequest pageRequest = PageRequest.of(page, size,
                Sort.by("floor").ascending().and(Sort.by("roomNumber").ascending()));

        Page<Room> pageData = roomRepository.findAll(spec, pageRequest);
        return PageResponse.<RoomDto>builder()
                .content(pageData.getContent().stream().map(this::toRoomDto).toList())
                .page(pageData.getNumber())
                .size(pageData.getSize())
                .totalElements(pageData.getTotalElements())
                .totalPages(pageData.getTotalPages())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public RoomDto getRoomById(Integer roomId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng với mã: " + roomId));
        return toRoomDto(room);
    }

    @Override
    @Transactional
    public RoomDto createRoom(CreateRoomRequest request) {
        String cleanRoomNumber = request.getRoomNumber().trim();
        if (roomRepository.existsByRoomNumberIgnoreCase(cleanRoomNumber)) {
            throw new BusinessException("MSG05A", messageResolver.resolve("MSG05A"));
        }

        RoomType roomType = roomTypeRepository.findById(request.getRoomTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng phòng với mã: " + request.getRoomTypeId()));

        Room room = Room.builder()
                .roomNumber(cleanRoomNumber)
                .floor(request.getFloor())
                .roomType(roomType)
                .stayStatus(StayStatus.VACANT.name())
                .cleaningStatus(CleaningStatus.INSPECTED.name())
                .roomStatus(RoomStatus.ACTIVE.name())
                .notes(request.getNotes())
                .version(0)
                .build();

        return toRoomDto(roomRepository.save(room));
    }

    @Override
    @Transactional
    public RoomDto updateRoom(Integer roomId, UpdateRoomRequest request) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng với mã: " + roomId));

        String cleanRoomNumber = request.getRoomNumber().trim();
        if (roomRepository.existsByRoomNumberIgnoreCaseAndRoomIdNot(cleanRoomNumber, roomId)) {
            throw new BusinessException("MSG05A", messageResolver.resolve("MSG05A"));
        }

        RoomType roomType = roomTypeRepository.findById(request.getRoomTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng phòng với mã: " + request.getRoomTypeId()));

        room.setRoomNumber(cleanRoomNumber);
        room.setFloor(request.getFloor());
        room.setRoomType(roomType);
        if (request.getNotes() != null) {
            room.setNotes(request.getNotes());
        }

        return toRoomDto(roomRepository.save(room));
    }

    @Override
    @Transactional
    public RoomDto updateRoomStatus(Integer roomId, String newStatus) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng với mã: " + roomId));

        String targetStatus = newStatus.trim().toUpperCase();

        // Không cho phép lưu trữ hoặc khóa bảo trì phòng khi đang có khách ở
        if ((RoomStatus.ARCHIVED.name().equals(targetStatus) || RoomStatus.UNDER_MAINTENANCE.name().equals(targetStatus))
                && StayStatus.OCCUPIED.name().equalsIgnoreCase(room.getStayStatus())) {
            throw new BusinessException("MSG08A", messageResolver.resolve("MSG08A"));
        }

        // BR-12: archiving additionally requires no active stay and no
        // upcoming reservation that this room's type is committed to.
        if (RoomStatus.ARCHIVED.name().equals(targetStatus)) {
            assertRoomHasNoActiveOrUpcomingBooking(room);
        }

        room.setRoomStatus(targetStatus);
        return toRoomDto(roomRepository.save(room));
    }

    /**
     * BR-12: an occupied room, or a room with active or upcoming reservations,
     * cannot be archived.
     *
     * A specific room is only ever assigned at check-in (StayRoomAssignment),
     * while a Reservation itself books a room <i>type</i>, not a room. So this
     * checks two things:
     * <ol>
     *   <li>the room is still assigned to an ACTIVE stay, and</li>
     *   <li>archiving it would leave fewer active rooms of its type than the
     *   quantity already committed to upcoming PENDING/CONFIRMED reservations
     *   overlapping the same dates — i.e. a future booking would be stranded.</li>
     * </ol>
     */
    private void assertRoomHasNoActiveOrUpcomingBooking(Room room) {
        if (stayRoomAssignmentRepository.existsByRoom_RoomIdAndAssignedToIsNullAndGuestStay_Status(
                room.getRoomId(), GuestStayStatus.ACTIVE.name())) {
            throw new BusinessException("MSG_ROOM_HAS_ACTIVE_BOOKING",
                    messageResolver.resolve("MSG_ROOM_HAS_ACTIVE_BOOKING"));
        }

        Integer roomTypeId = room.getRoomType().getRoomTypeId();
        long activeRoomsOfType = roomRepository.countByRoomType_RoomTypeIdAndRoomStatusNot(
                roomTypeId, RoomStatus.ARCHIVED.name());
        LocalDate today = LocalDate.now();
        List<Reservation> upcoming = reservationRepository.findByStatusInAndCheckOutDateGreaterThanEqual(
                List.of(ReservationStatus.PENDING.name(), ReservationStatus.CONFIRMED.name()), today);
        for (Reservation reservation : upcoming) {
            int committedForWindow = upcoming.stream()
                    .filter(other -> other.getCheckInDate().isBefore(reservation.getCheckOutDate())
                            && other.getCheckOutDate().isAfter(reservation.getCheckInDate()))
                    .flatMap(other -> other.getDetails().stream())
                    .filter(detail -> roomTypeId.equals(detail.getRoomType().getRoomTypeId()))
                    .mapToInt(detail -> detail.getQuantity() != null ? detail.getQuantity() : 0)
                    .sum();
            // This room is still counted in activeRoomsOfType; archiving it
            // leaves activeRoomsOfType - 1 rooms for committedForWindow bookings.
            if (committedForWindow >= activeRoomsOfType) {
                throw new BusinessException("MSG_ROOM_HAS_ACTIVE_BOOKING",
                        messageResolver.resolve("MSG_ROOM_HAS_ACTIVE_BOOKING"));
            }
        }
    }

    // =========================================================================
    // 3. CLEANLINESS & MAINTENANCE (UC-19..20)
    // =========================================================================

    @Override
    @Transactional
    public RoomDto updateHousekeepingStatus(Integer roomId, UpdateHousekeepingStatusRequest request) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng với mã: " + roomId));

        if (RoomStatus.UNDER_MAINTENANCE.name().equalsIgnoreCase(room.getRoomStatus())) {
            throw new BusinessException("MSG07A", messageResolver.resolve("MSG07A"));
        }

        String targetCleaning = request.getNewCleaningStatus().trim().toUpperCase();
        // BR-13: housekeeping follows Dirty -> Clean -> Inspected; the only
        // backward step is Inspected -> Dirty, and it requires a recorded
        // reason. Enforced here (not just in the UI) so a direct API call
        // cannot bypass the state machine.
        assertValidCleaningTransition(room.getCleaningStatus(), targetCleaning, request.getNotes());
        room.setCleaningStatus(targetCleaning);
        if (request.getNotes() != null) {
            room.setNotes(request.getNotes());
        }
        return toRoomDto(roomRepository.save(room));
    }

    private void assertValidCleaningTransition(String currentCleaning, String targetCleaning, String notes) {
        CleaningStatus current;
        CleaningStatus target;
        try {
            current = CleaningStatus.valueOf(currentCleaning.trim().toUpperCase());
            target = CleaningStatus.valueOf(targetCleaning);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new BusinessException("MSG_INVALID_CLEANING_TRANSITION",
                    messageResolver.resolve("MSG_INVALID_CLEANING_TRANSITION"));
        }
        boolean allowed = (current == CleaningStatus.DIRTY && target == CleaningStatus.CLEAN)
                || (current == CleaningStatus.CLEAN && target == CleaningStatus.INSPECTED)
                || (current == CleaningStatus.INSPECTED && target == CleaningStatus.DIRTY
                        && notes != null && !notes.isBlank());
        if (!allowed) {
            throw new BusinessException("MSG_INVALID_CLEANING_TRANSITION",
                    messageResolver.resolve("MSG_INVALID_CLEANING_TRANSITION"));
        }
    }

    @Override
    @Transactional
    public RoomDto setRoomMaintenance(Integer roomId, SetMaintenanceRequest request) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng với mã: " + roomId));

        if (StayStatus.OCCUPIED.name().equalsIgnoreCase(room.getStayStatus())) {
            throw new BusinessException("MSG08A", messageResolver.resolve("MSG08A"));
        }

        room.setRoomStatus(RoomStatus.UNDER_MAINTENANCE.name());
        room.setNotes("Bảo trì: " + request.getMaintenanceReason()
                + " (Dự kiến xong: " + request.getEstimatedCompletionDate() + ")");
        return toRoomDto(roomRepository.save(room));
    }

    @Override
    @Transactional
    public RoomDto endRoomMaintenance(Integer roomId, EndMaintenanceRequest request) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng với mã: " + roomId));

        if (!RoomStatus.UNDER_MAINTENANCE.name().equalsIgnoreCase(room.getRoomStatus())) {
            throw new BusinessException("MSG_NOT_IN_MAINTENANCE", "Phòng này hiện không ở trạng thái bảo trì.");
        }

        room.setRoomStatus(RoomStatus.ACTIVE.name());

        // Mặc định sau bảo trì phòng chuyển thành DIRTY để nhân viên vào dọn dẹp vệ sinh trước khi đón khách
        String targetCleaning = (request != null && request.getCleaningStatus() != null && !request.getCleaningStatus().isBlank())
                ? request.getCleaningStatus().trim().toUpperCase()
                : CleaningStatus.DIRTY.name();
        room.setCleaningStatus(targetCleaning);

        if (request != null && request.getResolutionNote() != null && !request.getResolutionNote().isBlank()) {
            room.setNotes("Hoàn tất bảo trì: " + request.getResolutionNote().trim());
        }

        return toRoomDto(roomRepository.save(room));
    }

    // =========================================================================
    // 4. HOUSEKEEPING TASKS (UC-51)
    // =========================================================================

    @Override
    @Transactional(readOnly = true)
    public List<StaffSimpleDto> getHousekeepingStaff() {
        return staffRepository.findAll().stream()
                .filter(s -> {
                    if (s.getAccount() == null || s.getAccount().getRole() == null) return false;
                    String role = s.getAccount().getRole().getRoleName();
                    return "HOUSEKEEPING".equalsIgnoreCase(role) || "HOUSEKEEPING_MANAGER".equalsIgnoreCase(role);
                })
                // UC-51 alternative flow: never offer an inactive staff member
                // for assignment (employmentStatus or account not ACTIVE).
                .filter(this::isActiveStaff)
                .map(s -> StaffSimpleDto.builder()
                        .staffId(s.getStaffId())
                        .staffCode(s.getStaffCode())
                        .fullName(s.getFullName())
                        .email(s.getEmail())
                        .roleName(s.getAccount() != null && s.getAccount().getRole() != null ? s.getAccount().getRole().getRoleName() : "")
                        .build())
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<HousekeepingTaskDto> getTasks(Integer staffId, Integer roomId, String status,
                                                      String taskType, int page, int size) {
        Specification<HousekeepingTask> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (staffId != null) {
                predicates.add(cb.equal(root.get("assignedToStaff").get("staffId"), staffId));
            }
            if (roomId != null) {
                predicates.add(cb.equal(root.get("room").get("roomId"), roomId));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(cb.upper(root.get("status")), status.trim().toUpperCase()));
            }
            if (taskType != null && !taskType.isBlank()) {
                predicates.add(cb.equal(cb.upper(root.get("taskType")), taskType.trim().toUpperCase()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("scheduledAt").descending());
        Page<HousekeepingTask> pageData = housekeepingTaskRepository.findAll(spec, pageRequest);

        return PageResponse.<HousekeepingTaskDto>builder()
                .content(pageData.getContent().stream().map(this::toTaskDto).toList())
                .page(pageData.getNumber())
                .size(pageData.getSize())
                .totalElements(pageData.getTotalElements())
                .totalPages(pageData.getTotalPages())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public HousekeepingTaskDto getTaskById(Integer taskId) {
        HousekeepingTask task = housekeepingTaskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhiệm vụ dọn phòng với mã: " + taskId));
        return toTaskDto(task);
    }

    @Override
    @Transactional
    public HousekeepingTaskDto createTask(CreateHousekeepingTaskRequest request, Integer currentAccountId) {
        String taskType = request.getTaskType() != null ? request.getTaskType().trim().toUpperCase() : "";
        if (!TASK_TYPES.contains(taskType)) {
            throw new BusinessException("MSG_INVALID_TASK_TYPE",
                    messageResolver.resolve("MSG_INVALID_TASK_TYPE"));
        }

        Room room = roomRepository.findById(request.getRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng với mã: " + request.getRoomId()));

        // UC-51 main flow: cleaning tasks are assigned from rooms with Dirty
        // status only. (MAINTENANCE is an equipment check, so it has no
        // cleaning-status requirement.)
        if ("CLEANING".equals(taskType)
                && !CleaningStatus.DIRTY.name().equalsIgnoreCase(room.getCleaningStatus())) {
            throw new BusinessException("MSG_TASK_ROOM_NOT_DIRTY",
                    messageResolver.resolve("MSG_TASK_ROOM_NOT_DIRTY"));
        }

        Staff assignedToStaff = staffRepository.findById(request.getAssignedToStaffId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên được giao việc với mã: " + request.getAssignedToStaffId()));

        // UC-51 alternative flow: block assigning to an inactive staff member.
        if (!isActiveStaff(assignedToStaff)) {
            throw new BusinessException("MSG_TASK_STAFF_INACTIVE",
                    messageResolver.resolve("MSG_TASK_STAFF_INACTIVE"));
        }

        // Whoever assigns must have a Staff record; silently recording the
        // assignee as the assigner would log the wrong person (old fallback).
        Staff assignedByStaff = (currentAccountId != null)
                ? staffRepository.findByAccount_AccountId(currentAccountId)
                        .orElseThrow(() -> new BusinessException("MSG_TASK_ASSIGNER_NOT_FOUND",
                                messageResolver.resolve("MSG_TASK_ASSIGNER_NOT_FOUND")))
                : assignedToStaff;

        Instant scheduledAt = request.getScheduledAt() != null ? request.getScheduledAt() : Instant.now();

        HousekeepingTask task = HousekeepingTask.builder()
                .room(room)
                .assignedToStaff(assignedToStaff)
                .assignedByStaff(assignedByStaff)
                .taskType(taskType)
                .scheduledAt(scheduledAt)
                .estimatedCompletionDate(request.getEstimatedCompletionDate())
                .status("ASSIGNED")
                .priority(normalizePriority(request.getPriority()))
                .note(request.getNote())
                .createdAt(Instant.now())
                .build();

        return toTaskDto(housekeepingTaskRepository.save(task));
    }

    @Override
    @Transactional
    public HousekeepingTaskDto updateTaskStatus(Integer taskId, UpdateHousekeepingTaskStatusRequest request, Integer currentAccountId) {
        HousekeepingTask task = housekeepingTaskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhiệm vụ dọn phòng với mã: " + taskId));

        String newStatus = request.getStatus() != null ? request.getStatus().trim().toUpperCase() : "";
        if (!isValidTaskTransition(task.getStatus(), newStatus)) {
            throw new BusinessException("MSG_INVALID_TASK_TRANSITION",
                    messageResolver.resolve("MSG_INVALID_TASK_TRANSITION"));
        }

        // Only the assignee, the housekeeping manager or an admin may change
        // a task's status.
        if (!canUpdateTask(task, currentAccountId)) {
            throw new BusinessException("MSG_TASK_UPDATE_FORBIDDEN",
                    messageResolver.resolve("MSG_TASK_UPDATE_FORBIDDEN"));
        }

        task.setStatus(newStatus);
        if (request.getNote() != null) {
            task.setNote(request.getNote());
        }

        Instant now = Instant.now();
        if ("IN_PROGRESS".equals(newStatus) && task.getStartedAt() == null) {
            task.setStartedAt(now);
        } else if ("COMPLETED".equals(newStatus)) {
            if (task.getStartedAt() == null) {
                task.setStartedAt(now);
            }
            task.setCompletedAt(now);

            // Khi hoàn thành nhiệm vụ dọn dẹp CLEANING, tự động chuyển trạng thái phòng sang CLEAN
            if ("CLEANING".equalsIgnoreCase(task.getTaskType())) {
                Room room = task.getRoom();
                if (!RoomStatus.UNDER_MAINTENANCE.name().equalsIgnoreCase(room.getRoomStatus())) {
                    room.setCleaningStatus(CleaningStatus.CLEAN.name());
                    roomRepository.save(room);
                }
            }
        }

        return toTaskDto(housekeepingTaskRepository.save(task));
    }

    // --- UC-51 helpers -------------------------------------------------------

    /** A staff member counts as active only when both the employment record
     *  and the login account are ACTIVE (SRS UC-51 alternative flow). */
    private boolean isActiveStaff(Staff staff) {
        if (staff == null) return false;
        if (!"ACTIVE".equalsIgnoreCase(staff.getEmploymentStatus())) return false;
        return staff.getAccount() != null && "ACTIVE".equalsIgnoreCase(staff.getAccount().getStatus());
    }

    /** Blank priority defaults to NORMAL (the value the API used to hardcode);
     *  anything outside LOW / NORMAL / HIGH / URGENT is rejected. */
    private String normalizePriority(String priority) {
        if (priority == null || priority.isBlank()) return "NORMAL";
        String normalized = priority.trim().toUpperCase();
        if (!TASK_PRIORITIES.contains(normalized)) {
            throw new BusinessException("MSG_INVALID_TASK_PRIORITY",
                    messageResolver.resolve("MSG_INVALID_TASK_PRIORITY"));
        }
        return normalized;
    }

    /** UC-51 lifecycle: ASSIGNED -> IN_PROGRESS -> COMPLETED, or CANCELLED
     *  from ASSIGNED / IN_PROGRESS. COMPLETED and CANCELLED are terminal,
     *  same-status and ASSIGNED-as-target are rejected. */
    private boolean isValidTaskTransition(String currentStatus, String newStatus) {
        if (currentStatus == null || newStatus == null || newStatus.isBlank()) return false;
        String current = currentStatus.trim().toUpperCase();
        if (TASK_FINAL_STATUSES.contains(current)) return false;
        if (current.equals(newStatus)) return false;
        return switch (current) {
            case "ASSIGNED" -> "IN_PROGRESS".equals(newStatus) || "CANCELLED".equals(newStatus);
            case "IN_PROGRESS" -> "COMPLETED".equals(newStatus) || "CANCELLED".equals(newStatus);
            default -> false;
        };
    }

    private boolean canUpdateTask(HousekeepingTask task, Integer currentAccountId) {
        // Unauthenticated callers keep the old lenient behaviour; in practice
        // the endpoint is authenticated and an account id is always present.
        if (currentAccountId == null) return true;
        return staffRepository.findByAccount_AccountId(currentAccountId)
                .map(actor -> actor.getStaffId().equals(task.getAssignedToStaff().getStaffId())
                        || isManagerRole(actor.getAccount()))
                .orElseGet(() -> accountRepository.findById(currentAccountId)
                        .map(account -> "ADMIN".equalsIgnoreCase(account.getRole().getRoleName()))
                        .orElse(false));
    }

    private boolean isManagerRole(com.fpt.hms.entity.Account account) {
        if (account == null || account.getRole() == null) return false;
        String role = account.getRole().getRoleName();
        return "HOUSEKEEPING_MANAGER".equalsIgnoreCase(role) || "ADMIN".equalsIgnoreCase(role);
    }

    // =========================================================================
    // DTO MAPPERS
    // =========================================================================

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

    private RoomTypeDto toRoomTypeDto(RoomType rt) {
        return RoomTypeDto.builder()
                .roomTypeId(rt.getRoomTypeId())
                .typeName(rt.getTypeName())
                .capacity(rt.getCapacity())
                .basePrice(rt.getBasePrice())
                .amenities(rt.getAmenities())
                .description(rt.getDescription())
                .imageUrl(rt.getImageUrl())
                .isActive(rt.getIsActive())
                .build();
    }

    private RoomTypePriceDto toRoomTypePriceDto(RoomTypePrice rtp) {
        return RoomTypePriceDto.builder()
                .roomTypePriceId(rtp.getRoomTypePriceId())
                .roomTypeId(rtp.getRoomType().getRoomTypeId())
                .dayOfWeek(rtp.getDayOfWeek())
                .price(rtp.getPrice())
                .effectiveFrom(rtp.getEffectiveFrom())
                .effectiveTo(rtp.getEffectiveTo())
                .isActive(rtp.getIsActive())
                .build();
    }

    private HousekeepingTaskDto toTaskDto(HousekeepingTask task) {
        return HousekeepingTaskDto.builder()
                .taskId(task.getTaskId())
                .roomId(task.getRoom().getRoomId())
                .roomNumber(task.getRoom().getRoomNumber())
                .floor(task.getRoom().getFloor())
                .assignedToStaffId(task.getAssignedToStaff().getStaffId())
                .assignedToStaffName(task.getAssignedToStaff().getFullName())
                .assignedByStaffId(task.getAssignedByStaff() != null ? task.getAssignedByStaff().getStaffId() : null)
                .assignedByStaffName(task.getAssignedByStaff() != null ? task.getAssignedByStaff().getFullName() : null)
                .taskType(task.getTaskType())
                .scheduledAt(task.getScheduledAt())
                .estimatedCompletionDate(task.getEstimatedCompletionDate())
                .status(task.getStatus())
                .priority(task.getPriority())
                .startedAt(task.getStartedAt())
                .completedAt(task.getCompletedAt())
                .note(task.getNote())
                .createdAt(task.getCreatedAt())
                .build();
    }
}
