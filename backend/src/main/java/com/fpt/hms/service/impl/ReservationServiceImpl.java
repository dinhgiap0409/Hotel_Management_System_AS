package com.fpt.hms.service.impl;

import com.fpt.hms.common.MessageResolver;
import com.fpt.hms.dto.booking.CreateReservationRequest;
import com.fpt.hms.dto.booking.ReservationDto;
import com.fpt.hms.dto.room.RoomTypeDto;
import com.fpt.hms.entity.*;
import com.fpt.hms.enums.ReservationStatus;
import com.fpt.hms.exception.BusinessException;
import com.fpt.hms.exception.ResourceNotFoundException;
import com.fpt.hms.repository.CustomerRepository;
import com.fpt.hms.repository.ReservationRepository;
import com.fpt.hms.repository.RoomTypeRepository;
import com.fpt.hms.service.ReservationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Module 3A (Owner: GiapND) - Room Search & Online Reservation Service (UC-21 to UC-25).
 */
@Service
@RequiredArgsConstructor
public class ReservationServiceImpl implements ReservationService {

    private final RoomTypeRepository roomTypeRepository;
    private final ReservationRepository reservationRepository;
    private final CustomerRepository customerRepository;
    private final MessageResolver messageResolver;
    private final Clock hotelClock;

    @Override
    @Transactional(readOnly = true)
    public List<RoomTypeDto> searchAvailableRoomTypes(LocalDate checkInDate, LocalDate checkOutDate, int guests) {
        LocalDate today = LocalDate.now(hotelClock);
        // BR-17: Check-in date must not be in the past; check-out date must be after check-in date
        if (checkInDate == null || checkOutDate == null
                || checkInDate.isBefore(today)
                || !checkOutDate.isAfter(checkInDate)) {
            throw new BusinessException("MSG04A", messageResolver.resolve("MSG04A"));
        }

        return roomTypeRepository.findByIsActiveTrue().stream()
                .filter(rt -> rt.getCapacity() >= guests)
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
    @Transactional
    public ReservationDto createReservation(CreateReservationRequest request, Integer accountId) {
        LocalDate today = LocalDate.now(hotelClock);
        if (request.getCheckInDate().isBefore(today) || !request.getCheckOutDate().isAfter(request.getCheckInDate())) {
            throw new BusinessException("MSG04A", messageResolver.resolve("MSG04A"));
        }

        RoomType roomType = roomTypeRepository.findById(request.getRoomTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("Room Type not found"));

        Customer customer = null;
        if (accountId != null) {
            customer = customerRepository.findByAccount_AccountId(accountId).orElse(null);
        }
        if (customer == null) {
            customer = customerRepository.save(Customer.builder()
                    .fullName(request.getContactName())
                    .email(request.getContactEmail())
                    .phone(request.getContactPhone())
                    .build());
        }

        String code = "BK-" + LocalDate.now(hotelClock).getYear() + "-"
                + UUID.randomUUID().toString().substring(0, 5).toUpperCase();

        // BR-19: New reservations start as PENDING and hold quota for 24 hours
        Reservation reservation = Reservation.builder()
                .customer(customer)
                .reservationCode(code)
                .reservationDate(Instant.now())
                .checkInDate(request.getCheckInDate())
                .checkOutDate(request.getCheckOutDate())
                .guestCount(request.getGuestCount())
                .specialNotes(request.getSpecialNotes())
                .status(ReservationStatus.PENDING.name())
                .contactName(request.getContactName())
                .contactEmail(request.getContactEmail())
                .contactPhone(request.getContactPhone())
                .holdExpiresAt(Instant.now().plus(24, ChronoUnit.HOURS))
                .build();

        ReservationDetail detail = ReservationDetail.builder()
                .reservation(reservation)
                .roomType(roomType)
                .quantity(request.getQuantity())
                .build();

        for (LocalDate d = request.getCheckInDate(); d.isBefore(request.getCheckOutDate()); d = d.plusDays(1)) {
            detail.getNightlyRates().add(ReservationNightlyRate.builder()
                    .reservationDetail(detail)
                    .stayDate(d)
                    .unitPrice(roomType.getBasePrice())
                    .build());
        }
        reservation.getDetails().add(detail);

        return toDto(reservationRepository.save(reservation));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReservationDto> getAllReservations() {
        return reservationRepository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ReservationDto findByCode(String reservationCode) {
        Reservation reservation = reservationRepository.findByReservationCode(reservationCode)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found: " + reservationCode));
        return toDto(reservation);
    }

    @Override
    @Transactional
    public ReservationDto cancelReservation(Integer reservationId) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found"));

        if (ReservationStatus.CHECKED_IN.name().equalsIgnoreCase(reservation.getStatus())
                || ReservationStatus.COMPLETED.name().equalsIgnoreCase(reservation.getStatus())) {
            throw new BusinessException("BR-21", "Cannot cancel a reservation that is already Checked-In or Completed.");
        }
        reservation.setStatus(ReservationStatus.CANCELLED.name());
        return toDto(reservationRepository.save(reservation));
    }

    private ReservationDto toDto(Reservation r) {
        long nights = ChronoUnit.DAYS.between(r.getCheckInDate(), r.getCheckOutDate());
        String roomTypeName = "Standard";
        int qty = 1;
        BigDecimal basePrice = BigDecimal.ZERO;
        if (!r.getDetails().isEmpty()) {
            ReservationDetail d = r.getDetails().getFirst();
            roomTypeName = d.getRoomType().getTypeName();
            qty = d.getQuantity();
            basePrice = d.getRoomType().getBasePrice();
        }
        BigDecimal total = basePrice.multiply(BigDecimal.valueOf(nights)).multiply(BigDecimal.valueOf(qty));
        return ReservationDto.builder()
                .reservationId(r.getReservationId())
                .reservationCode(r.getReservationCode())
                .roomTypeName(roomTypeName)
                .roomQuantity(qty)
                .checkInDate(r.getCheckInDate())
                .checkOutDate(r.getCheckOutDate())
                .nights(nights)
                .guestCount(r.getGuestCount())
                .contactName(r.getContactName())
                .contactEmail(r.getContactEmail())
                .contactPhone(r.getContactPhone())
                .status(r.getStatus())
                .estimatedTotal(total)
                .holdExpiresAt(r.getHoldExpiresAt())
                .build();
    }
}