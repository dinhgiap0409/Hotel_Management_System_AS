package com.fpt.hms.service.impl;

import com.fpt.hms.common.MessageResolver;
import com.fpt.hms.dto.room.UpdateHousekeepingStatusRequest;
import com.fpt.hms.dto.room.UpdateRoomTypeRequest;
import com.fpt.hms.entity.Reservation;
import com.fpt.hms.entity.ReservationDetail;
import com.fpt.hms.entity.Room;
import com.fpt.hms.entity.RoomType;
import com.fpt.hms.entity.StayRoomAssignment;
import com.fpt.hms.exception.BusinessException;
import com.fpt.hms.repository.HousekeepingTaskRepository;
import com.fpt.hms.repository.ReservationRepository;
import com.fpt.hms.repository.RoomRepository;
import com.fpt.hms.repository.RoomTypePriceRepository;
import com.fpt.hms.repository.RoomTypeRepository;
import com.fpt.hms.repository.StaffRepository;
import com.fpt.hms.repository.StayRoomAssignmentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.repository.query.parser.PartTree;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the BR-11 / BR-12 / BR-13 guards added to
 * RoomHousekeepingServiceImpl. Repositories are mocked — no database needed.
 * The PartTree test additionally proves the two new Spring Data derived-query
 * method names resolve against the real entity model (they are only parsed
 * at runtime by Spring Data, so a plain compile would not catch a typo).
 */
@ExtendWith(MockitoExtension.class)
class RoomHousekeepingServiceImplBrTest {

    @Mock RoomTypeRepository roomTypeRepository;
    @Mock RoomTypePriceRepository roomTypePriceRepository;
    @Mock RoomRepository roomRepository;
    @Mock HousekeepingTaskRepository housekeepingTaskRepository;
    @Mock StaffRepository staffRepository;
    @Mock ReservationRepository reservationRepository;
    @Mock StayRoomAssignmentRepository stayRoomAssignmentRepository;
    @Mock MessageResolver messageResolver;

    @InjectMocks RoomHousekeepingServiceImpl service;

    // ---------------------------------------------------------------- BR-11

    @Test
    void toggleRoomType_deactivateBlockedWhenActiveRoomsExist() {
        RoomType type = roomType(true);
        when(roomTypeRepository.findById(1)).thenReturn(Optional.of(type));
        when(roomRepository.countByRoomType_RoomTypeIdAndRoomStatusNot(1, "ARCHIVED")).thenReturn(2L);
        when(messageResolver.resolve(anyString())).thenAnswer(i -> i.getArgument(0));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.toggleRoomTypeStatus(1));
        assertEquals("MSG_ROOMTYPE_HAS_ROOMS", ex.getErrorCode());
    }

    @Test
    void toggleRoomType_deactivateAllowedWhenNoActiveRooms() {
        RoomType type = roomType(true);
        when(roomTypeRepository.findById(1)).thenReturn(Optional.of(type));
        when(roomRepository.countByRoomType_RoomTypeIdAndRoomStatusNot(1, "ARCHIVED")).thenReturn(0L);
        when(roomTypeRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        assertEquals(false, service.toggleRoomTypeStatus(1).getIsActive());
    }

    @Test
    void toggleRoomType_reactivateAllowedEvenWithActiveRooms() {
        RoomType type = roomType(false);
        when(roomTypeRepository.findById(1)).thenReturn(Optional.of(type));
        when(roomTypeRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        assertEquals(true, service.toggleRoomTypeStatus(1).getIsActive());
    }

    @Test
    void updateRoomType_deactivateViaPutBlockedWhenActiveRoomsExist() {
        RoomType type = roomType(true);
        when(roomTypeRepository.findById(1)).thenReturn(Optional.of(type));
        when(roomTypeRepository.existsByTypeNameIgnoreCaseAndRoomTypeIdNot(anyString(), anyInt()))
                .thenReturn(false);
        when(roomRepository.countByRoomType_RoomTypeIdAndRoomStatusNot(1, "ARCHIVED")).thenReturn(1L);
        when(messageResolver.resolve(anyString())).thenAnswer(i -> i.getArgument(0));

        UpdateRoomTypeRequest req = UpdateRoomTypeRequest.builder()
                .typeName("Deluxe").capacity(2).basePrice(new BigDecimal("100.00"))
                .isActive(false).build();
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.updateRoomType(1, req));
        assertEquals("MSG_ROOMTYPE_HAS_ROOMS", ex.getErrorCode());
    }

    // ---------------------------------------------------------------- BR-12

    @Test
    void archiveRoom_blockedWhenAssignedToActiveStay() {
        Room room = room("VACANT", "INSPECTED", "ACTIVE");
        when(roomRepository.findById(7)).thenReturn(Optional.of(room));
        when(stayRoomAssignmentRepository
                .existsByRoom_RoomIdAndAssignedToIsNullAndGuestStay_Status(7, "ACTIVE"))
                .thenReturn(true);
        when(messageResolver.resolve(anyString())).thenAnswer(i -> i.getArgument(0));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.updateRoomStatus(7, "ARCHIVED"));
        assertEquals("MSG_ROOM_HAS_ACTIVE_BOOKING", ex.getErrorCode());
    }

    @Test
    void archiveRoom_blockedWhenUpcomingReservationCommitsAllRoomsOfType() {
        Room room = room("VACANT", "INSPECTED", "ACTIVE");
        when(roomRepository.findById(7)).thenReturn(Optional.of(room));
        when(stayRoomAssignmentRepository
                .existsByRoom_RoomIdAndAssignedToIsNullAndGuestStay_Status(7, "ACTIVE"))
                .thenReturn(false);
        // Only 1 active room of this type, and 1 unit already committed.
        when(roomRepository.countByRoomType_RoomTypeIdAndRoomStatusNot(1, "ARCHIVED")).thenReturn(1L);
        Reservation reservation = upcomingReservation(1);
        when(reservationRepository.findByStatusInAndCheckOutDateGreaterThanEqual(any(), any()))
                .thenReturn(List.of(reservation));
        when(messageResolver.resolve(anyString())).thenAnswer(i -> i.getArgument(0));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.updateRoomStatus(7, "ARCHIVED"));
        assertEquals("MSG_ROOM_HAS_ACTIVE_BOOKING", ex.getErrorCode());
    }

    @Test
    void archiveRoom_allowedWhenNoActiveStayAndSpareCapacity() {
        Room room = room("VACANT", "INSPECTED", "ACTIVE");
        when(roomRepository.findById(7)).thenReturn(Optional.of(room));
        when(stayRoomAssignmentRepository
                .existsByRoom_RoomIdAndAssignedToIsNullAndGuestStay_Status(7, "ACTIVE"))
                .thenReturn(false);
        // 3 active rooms of this type, only 1 unit committed -> spare capacity.
        when(roomRepository.countByRoomType_RoomTypeIdAndRoomStatusNot(1, "ARCHIVED")).thenReturn(3L);
        when(reservationRepository.findByStatusInAndCheckOutDateGreaterThanEqual(any(), any()))
                .thenReturn(List.of(upcomingReservation(1)));
        when(roomRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        assertEquals("ARCHIVED", service.updateRoomStatus(7, "ARCHIVED").getRoomStatus());
    }

    // ---------------------------------------------------------------- BR-13

    @Test
    void housekeeping_dirtyToCleanAllowed() {
        Room room = room("VACANT", "DIRTY", "ACTIVE");
        when(roomRepository.findById(7)).thenReturn(Optional.of(room));
        when(roomRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        assertEquals("CLEAN", service.updateHousekeepingStatus(7, statusRequest("CLEAN", null))
                .getCleaningStatus());
    }

    @Test
    void housekeeping_cleanToInspectedAllowed() {
        Room room = room("VACANT", "CLEAN", "ACTIVE");
        when(roomRepository.findById(7)).thenReturn(Optional.of(room));
        when(roomRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        assertEquals("INSPECTED", service.updateHousekeepingStatus(7, statusRequest("INSPECTED", null))
                .getCleaningStatus());
    }

    @Test
    void housekeeping_inspectedToDirtyAllowedOnlyWithReason() {
        Room room = room("VACANT", "INSPECTED", "ACTIVE");
        when(roomRepository.findById(7)).thenReturn(Optional.of(room));
        when(roomRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(messageResolver.resolve(anyString())).thenAnswer(i -> i.getArgument(0));

        assertEquals("DIRTY", service.updateHousekeepingStatus(7,
                        statusRequest("DIRTY", "Found dust under the bed"))
                .getCleaningStatus());
        // Same transition without a reason must be rejected.
        Room room2 = room("VACANT", "INSPECTED", "ACTIVE");
        when(roomRepository.findById(8)).thenReturn(Optional.of(room2));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.updateHousekeepingStatus(8, statusRequest("DIRTY", "  ")));
        assertEquals("MSG_INVALID_CLEANING_TRANSITION", ex.getErrorCode());
    }

    @Test
    void housekeeping_invalidTransitionsRejected() {
        when(messageResolver.resolve(anyString())).thenAnswer(i -> i.getArgument(0));
        // CLEAN -> DIRTY (skips inspection backwards without a valid step)
        Room clean = room("VACANT", "CLEAN", "ACTIVE");
        when(roomRepository.findById(7)).thenReturn(Optional.of(clean));
        assertEquals("MSG_INVALID_CLEANING_TRANSITION", assertThrows(BusinessException.class,
                () -> service.updateHousekeepingStatus(7, statusRequest("DIRTY", "reason")))
                .getErrorCode());
        // DIRTY -> INSPECTED (skips CLEAN)
        Room dirty = room("VACANT", "DIRTY", "ACTIVE");
        when(roomRepository.findById(8)).thenReturn(Optional.of(dirty));
        assertEquals("MSG_INVALID_CLEANING_TRANSITION", assertThrows(BusinessException.class,
                () -> service.updateHousekeepingStatus(8, statusRequest("INSPECTED", null)))
                .getErrorCode());
        // Same status is not a progression.
        when(roomRepository.findById(9)).thenReturn(Optional.of(dirty));
        assertEquals("MSG_INVALID_CLEANING_TRANSITION", assertThrows(BusinessException.class,
                () -> service.updateHousekeepingStatus(9, statusRequest("DIRTY", null)))
                .getErrorCode());
        // Unknown status value.
        when(roomRepository.findById(10)).thenReturn(Optional.of(dirty));
        assertEquals("MSG_INVALID_CLEANING_TRANSITION", assertThrows(BusinessException.class,
                () -> service.updateHousekeepingStatus(10, statusRequest("BOGUS", null)))
                .getErrorCode());
    }

    // ------------------------------------------- derived-query name validation

    @Test
    void derivedQueryMethodsResolveAgainstEntities() {
        // Throws IllegalArgumentException if any traversed property does not exist.
        new PartTree("existsByRoom_RoomIdAndAssignedToIsNullAndGuestStay_Status",
                StayRoomAssignment.class);
        new PartTree("findByStatusInAndCheckOutDateGreaterThanEqual", Reservation.class);
        // No mocks are used in this test — it only parses the method names.
    }

    // ------------------------------------------------------------- helpers

    private RoomType roomType(boolean active) {
        return RoomType.builder().roomTypeId(1).typeName("Deluxe").capacity(2)
                .basePrice(new BigDecimal("100.00")).isActive(active).build();
    }

    private Room room(String stayStatus, String cleaningStatus, String roomStatus) {
        return Room.builder().roomId(7).roomNumber("101").floor(1)
                .roomType(roomType(true))
                .stayStatus(stayStatus).cleaningStatus(cleaningStatus)
                .roomStatus(roomStatus).version(0).build();
    }

    private UpdateHousekeepingStatusRequest statusRequest(String target, String notes) {
        UpdateHousekeepingStatusRequest req = new UpdateHousekeepingStatusRequest();
        req.setNewCleaningStatus(target);
        req.setNotes(notes);
        return req;
    }

    private Reservation upcomingReservation(int quantityForType1) {
        ReservationDetail detail = ReservationDetail.builder()
                .roomType(roomType(true)).quantity(quantityForType1).build();
        return Reservation.builder()
                .checkInDate(LocalDate.now())
                .checkOutDate(LocalDate.now().plusDays(2))
                .status("CONFIRMED")
                .details(List.of(detail))
                .build();
    }
}
