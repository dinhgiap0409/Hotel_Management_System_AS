package com.fpt.hms.service.impl;

import com.fpt.hms.common.MessageResolver;
import com.fpt.hms.dto.booking.ReservationDto;
import com.fpt.hms.dto.frontdesk.CheckInRequest;
import com.fpt.hms.dto.frontdesk.GuestStayDto;
import com.fpt.hms.entity.*;
import com.fpt.hms.enums.*;
import com.fpt.hms.exception.BusinessException;
import com.fpt.hms.exception.ResourceNotFoundException;
import com.fpt.hms.repository.*;
import com.fpt.hms.service.FrontDeskService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Module 3B (Owner: TungPV) - Front-Desk Operations & In-House Stay Service (UC-26 to UC-30).
 */
@Service
@RequiredArgsConstructor
public class FrontDeskServiceImpl implements FrontDeskService {

    private final ReservationRepository reservationRepository;
    private final RoomRepository roomRepository;
    private final GuestStayRepository guestStayRepository;
    private final FolioRepository folioRepository;
    private final InvoiceRepository invoiceRepository;
    private final MessageResolver messageResolver;

    @Override
    @Transactional
    public ReservationDto confirmReservation(Integer reservationId) {
        Reservation r = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found"));
        if (!ReservationStatus.PENDING.name().equalsIgnoreCase(r.getStatus())) {
            throw new BusinessException("BR-22", "Only PENDING reservations can be confirmed.");
        }
        r.setStatus(ReservationStatus.CONFIRMED.name());
        reservationRepository.save(r);

        return ReservationDto.builder()
                .reservationId(r.getReservationId())
                .reservationCode(r.getReservationCode())
                .contactName(r.getContactName())
                .checkInDate(r.getCheckInDate())
                .checkOutDate(r.getCheckOutDate())
                .status(r.getStatus())
                .build();
    }

    @Override
    @Transactional
    public GuestStayDto checkInGuest(CheckInRequest request) {
        Reservation reservation = reservationRepository.findById(request.getReservationId())
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found"));

        if (!ReservationStatus.CONFIRMED.name().equalsIgnoreCase(reservation.getStatus())) {
            throw new BusinessException("BR-23", "Check-in requires a CONFIRMED reservation.");
        }

        Room room = roomRepository.findById(request.getRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("Room not found"));

        // BR-14: Only Vacant and Inspected rooms can be assigned at check-in
        if (!StayStatus.VACANT.name().equalsIgnoreCase(room.getStayStatus())
                || !CleaningStatus.INSPECTED.name().equalsIgnoreCase(room.getCleaningStatus())
                || !RoomStatus.ACTIVE.name().equalsIgnoreCase(room.getRoomStatus())) {
            throw new BusinessException("MSG06A", messageResolver.resolve("MSG06A"));
        }

        // Atomic transaction (SDD 4.1.10): 1. Update Reservation -> 2. Create GuestStay & Assignment -> 3. Initialize Folio -> 4. Mark Room OCCUPIED
        reservation.setStatus(ReservationStatus.CHECKED_IN.name());
        reservationRepository.save(reservation);

        GuestStay stay = GuestStay.builder()
                .reservation(reservation)
                .actualCheckIn(Instant.now())
                .guestIdNumber(request.getGuestIdNumber())
                .keyCardNumber(request.getKeyCardNumber())
                .status(GuestStayStatus.ACTIVE.name())
                .build();

        StayRoomAssignment assignment = StayRoomAssignment.builder()
                .guestStay(stay)
                .room(room)
                .assignedFrom(Instant.now())
                .build();
        stay.getRoomAssignments().add(assignment);
        GuestStay savedStay = guestStayRepository.save(stay);

        long nights = Math.max(1, ChronoUnit.DAYS.between(reservation.getCheckInDate(), reservation.getCheckOutDate()));
        BigDecimal roomCharges = room.getRoomType().getBasePrice().multiply(BigDecimal.valueOf(nights));

        Folio folio = Folio.builder()
                .guestStay(savedStay)
                .createdAt(Instant.now())
                .totalAmount(roomCharges)
                .status(FolioStatus.OPEN.name())
                .build();
        Folio savedFolio = folioRepository.save(folio);

        room.setStayStatus(StayStatus.OCCUPIED.name());
        roomRepository.save(room);

        return toStayDto(savedStay, room.getRoomNumber(), savedFolio);
    }

    @Override
    @Transactional(readOnly = true)
    public List<GuestStayDto> getActiveStays() {
        return guestStayRepository.findByStatus(GuestStayStatus.ACTIVE.name()).stream()
                .map(stay -> {
                    String roomNum = stay.getRoomAssignments().isEmpty()
                            ? "N/A"
                            : stay.getRoomAssignments().getLast().getRoom().getRoomNumber();
                    Folio folio = folioRepository.findByGuestStay_StayId(stay.getStayId()).orElse(null);
                    return toStayDto(stay, roomNum, folio);
                })
                .toList();
    }

    @Override
    @Transactional
    public GuestStayDto checkOutGuest(Integer stayId) {
        GuestStay stay = guestStayRepository.findById(stayId)
                .orElseThrow(() -> new ResourceNotFoundException("Guest stay not found"));

        Folio folio = folioRepository.findByGuestStay_StayId(stayId)
                .orElseThrow(() -> new ResourceNotFoundException("Folio not found for stay"));

        Invoice invoice = invoiceRepository.findByFolio_FolioId(folio.getFolioId()).orElse(null);
        // BR-26: Check-out requires zero outstanding balance (Invoice PAID)
        if (invoice == null || !InvoiceStatus.PAID.name().equalsIgnoreCase(invoice.getStatus())) {
            throw new BusinessException("MSG10", messageResolver.resolve("MSG10"));
        }

        stay.setActualCheckOut(Instant.now());
        stay.setStatus(GuestStayStatus.COMPLETED.name());
        guestStayRepository.save(stay);

        Reservation reservation = stay.getReservation();
        reservation.setStatus(ReservationStatus.COMPLETED.name());
        reservationRepository.save(reservation);

        folio.setStatus(FolioStatus.CLOSED.name());
        folioRepository.save(folio);

        String roomNum = "N/A";
        if (!stay.getRoomAssignments().isEmpty()) {
            StayRoomAssignment currentAssignment = stay.getRoomAssignments().getLast();
            currentAssignment.setAssignedTo(Instant.now());
            Room room = currentAssignment.getRoom();
            room.setStayStatus(StayStatus.VACANT.name());
            room.setCleaningStatus(CleaningStatus.DIRTY.name()); // BR-26: Room becomes Dirty after departure
            roomRepository.save(room);
            roomNum = room.getRoomNumber();
        }

        return toStayDto(stay, roomNum, folio);
    }

    private GuestStayDto toStayDto(GuestStay stay, String roomNumber, Folio folio) {
        return GuestStayDto.builder()
                .stayId(stay.getStayId())
                .reservationId(stay.getReservation().getReservationId())
                .reservationCode(stay.getReservation().getReservationCode())
                .guestName(stay.getReservation().getContactName())
                .guestIdNumber(stay.getGuestIdNumber())
                .roomNumber(roomNumber)
                .checkInDate(stay.getReservation().getCheckInDate())
                .checkOutDate(stay.getReservation().getCheckOutDate())
                .actualCheckIn(stay.getActualCheckIn())
                .actualCheckOut(stay.getActualCheckOut())
                .status(stay.getStatus())
                .folioId(folio != null ? folio.getFolioId() : null)
                .folioTotalAmount(folio != null ? folio.getTotalAmount() : BigDecimal.ZERO)
                .build();
    }
}