package com.fpt.hms.service.impl;

import com.fpt.hms.common.MessageResolver;
import com.fpt.hms.dto.booking.ReservationDto;
import com.fpt.hms.dto.frontdesk.CheckInRequest;
import com.fpt.hms.dto.frontdesk.DirectBookingRequest;
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
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Module 3B (Owner: TungPV) - Front-Desk Operations & In-House Stay Service (UC-26 to UC-30).
 */
@Service
@RequiredArgsConstructor
public class FrontDeskServiceImpl implements FrontDeskService {

    private final ReservationRepository reservationRepository;
    private final RoomRepository roomRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final RoomTypePriceRepository roomTypePriceRepository;
    private final CustomerRepository customerRepository;
    private final StaffRepository staffRepository;
    private final GuestStayRepository guestStayRepository;
    private final FolioRepository folioRepository;
    private final InvoiceRepository invoiceRepository;
    private final MessageResolver messageResolver;
    private final Clock hotelClock;

    @Override
    @Transactional
    public ReservationDto createDirectBooking(DirectBookingRequest request, Integer staffAccountId) {
        LocalDate today = LocalDate.now(hotelClock);
        if (request.getCheckInDate() == null || request.getCheckOutDate() == null
                || request.getCheckInDate().isBefore(today)
                || !request.getCheckOutDate().isAfter(request.getCheckInDate())) {
            throw new BusinessException("MSG04A", "Ngày nhận phòng không được ở quá khứ và ngày trả phòng phải sau ngày nhận phòng.");
        }

        RoomType roomType = roomTypeRepository.findById(request.getRoomTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng phòng #" + request.getRoomTypeId()));

        if (Boolean.FALSE.equals(roomType.getIsActive())) {
            throw new BusinessException("BR-18", "Hạng phòng này hiện đang tạm ngưng mở đặt phòng.");
        }

        int qty = Math.max(1, request.getQuantity());
        int maxCapacity = (roomType.getCapacity() != null ? roomType.getCapacity() : 2) * qty;
        if (request.getGuestCount() > maxCapacity) {
            throw new BusinessException("BR-17",
                    "Số lượng khách (" + request.getGuestCount() + " người) vượt quá sức chứa tối đa của "
                            + qty + " phòng " + roomType.getTypeName() + " (Tối đa " + maxCapacity + " khách).");
        }

        int availableQuota = computeAvailableQuota(roomType.getRoomTypeId(), request.getCheckInDate(), request.getCheckOutDate(), today);
        if (qty > availableQuota) {
            throw new BusinessException("BR-18",
                    "Số lượng phòng trống của hạng '" + roomType.getTypeName()
                            + "' không đủ trong khoảng ngày đã chọn (Hiện chỉ còn " + availableQuota + " phòng).");
        }

        Staff staff = staffAccountId != null
                ? staffRepository.findByAccount_AccountId(staffAccountId).orElse(null)
                : null;

        String phone = request.getContactPhone().trim();
        Customer customer = customerRepository.findAll().stream()
                .filter(c -> phone.equalsIgnoreCase(c.getPhone()))
                .findFirst()
                .orElse(null);

        String email = (request.getContactEmail() != null && !request.getContactEmail().isBlank())
                ? request.getContactEmail().trim()
                : phone + "@walkin.hotel.local";

        if (customer == null) {
            customer = customerRepository.save(Customer.builder()
                    .fullName(request.getContactName().trim())
                    .phone(phone)
                    .email(email)
                    .identityNumber(request.getGuestIdNumber())
                    .createdByStaff(staff)
                    .build());
        } else if (request.getGuestIdNumber() != null && (customer.getIdentityNumber() == null || customer.getIdentityNumber().isBlank())) {
            customer.setIdentityNumber(request.getGuestIdNumber());
            customerRepository.save(customer);
        }

        String code = "BK-WALKIN-" + UUID.randomUUID().toString().substring(0, 5).toUpperCase();
        Instant now = Instant.now(hotelClock);

        Reservation reservation = Reservation.builder()
                .customer(customer)
                .reservationCode(code)
                .reservationDate(now)
                .checkInDate(request.getCheckInDate())
                .checkOutDate(request.getCheckOutDate())
                .guestCount(request.getGuestCount())
                .specialNotes(request.getSpecialNotes())
                .status(ReservationStatus.CONFIRMED.name())
                .contactName(request.getContactName().trim())
                .contactPhone(phone)
                .contactEmail(email)
                .holdExpiresAt(now.plus(30, ChronoUnit.DAYS))
                .build();

        ReservationDetail detail = ReservationDetail.builder()
                .reservation(reservation)
                .roomType(roomType)
                .quantity(qty)
                .build();

        Map<Integer, BigDecimal> tariffByDay = loadTariffMap(roomType.getRoomTypeId());
        for (LocalDate d = request.getCheckInDate(); d.isBefore(request.getCheckOutDate()); d = d.plusDays(1)) {
            int dow = d.getDayOfWeek().getValue();
            BigDecimal nightPrice = tariffByDay.getOrDefault(dow, roomType.getBasePrice());

            detail.getNightlyRates().add(ReservationNightlyRate.builder()
                    .reservationDetail(detail)
                    .stayDate(d)
                    .unitPrice(nightPrice)
                    .build());
        }

        reservation.getDetails().add(detail);
        Reservation savedReservation = reservationRepository.save(reservation);

        return toReservationDto(savedReservation);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReservationDto> getPendingReservations() {
        return reservationRepository.findAll().stream()
                .filter(r -> ReservationStatus.PENDING.name().equalsIgnoreCase(r.getStatus()))
                .sorted(Comparator.comparing(Reservation::getReservationDate).reversed())
                .map(this::toReservationDto)
                .toList();
    }

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

        return toReservationDto(r);
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

    private int computeAvailableQuota(Integer roomTypeId, LocalDate checkInDate, LocalDate checkOutDate, LocalDate today) {
        Instant now = Instant.now(hotelClock);
        List<Room> activeCategoryRooms = roomRepository.findByRoomStatusNot(RoomStatus.ARCHIVED.name()).stream()
                .filter(r -> r.getRoomType() != null && roomTypeId.equals(r.getRoomType().getRoomTypeId()))
                .filter(r -> RoomStatus.ACTIVE.name().equalsIgnoreCase(r.getRoomStatus()))
                .toList();

        int totalActivePhysicalRooms = activeCategoryRooms.size();

        int bookedQuota = reservationRepository.findAll().stream()
                .filter(res -> isReservationBlockingInventory(res, now))
                .filter(res -> res.getCheckInDate() != null && res.getCheckOutDate() != null)
                .filter(res -> res.getCheckInDate().isBefore(checkOutDate) && res.getCheckOutDate().isAfter(checkInDate))
                .filter(res -> res.getDetails() != null)
                .flatMap(res -> res.getDetails().stream())
                .filter(det -> det.getRoomType() != null && roomTypeId.equals(det.getRoomType().getRoomTypeId()))
                .mapToInt(det -> det.getQuantity() != null ? det.getQuantity() : 1)
                .sum();

        int currentlyOccupiedCount = (int) activeCategoryRooms.stream()
                .filter(r -> StayStatus.OCCUPIED.name().equalsIgnoreCase(r.getStayStatus()))
                .count();

        int committedUnits = checkInDate.equals(today)
                ? Math.max(bookedQuota, currentlyOccupiedCount)
                : bookedQuota;

        return Math.max(0, totalActivePhysicalRooms - committedUnits);
    }

    private boolean isReservationBlockingInventory(Reservation res, Instant now) {
        if (res.getStatus() == null) return false;
        String status = res.getStatus().toUpperCase();
        if (ReservationStatus.CONFIRMED.name().equals(status) || ReservationStatus.CHECKED_IN.name().equals(status)) {
            return true;
        }
        if (ReservationStatus.PENDING.name().equals(status)) {
            return res.getHoldExpiresAt() == null || res.getHoldExpiresAt().isAfter(now);
        }
        return false;
    }

    private Map<Integer, BigDecimal> loadTariffMap(Integer roomTypeId) {
        Map<Integer, BigDecimal> tariffMap = new HashMap<>();
        List<RoomTypePrice> rates = roomTypePriceRepository.findByRoomType_RoomTypeIdAndIsActiveTrue(roomTypeId);
        if (rates != null) {
            for (RoomTypePrice p : rates) {
                tariffMap.put(p.getDayOfWeek(), p.getPrice());
            }
        }
        return tariffMap;
    }

    private ReservationDto toReservationDto(Reservation r) {
        ReservationDetail detail = (r.getDetails() != null && !r.getDetails().isEmpty())
                ? r.getDetails().getFirst()
                : null;
        RoomType rt = detail != null ? detail.getRoomType() : null;
        long nights = (r.getCheckInDate() != null && r.getCheckOutDate() != null)
                ? Math.max(1, ChronoUnit.DAYS.between(r.getCheckInDate(), r.getCheckOutDate()))
                : 1;

        BigDecimal total = BigDecimal.ZERO;
        if (detail != null && detail.getNightlyRates() != null && !detail.getNightlyRates().isEmpty()) {
            total = detail.getNightlyRates().stream()
                    .map(nr -> nr.getUnitPrice().multiply(BigDecimal.valueOf(detail.getQuantity() != null ? detail.getQuantity() : 1)))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        } else if (rt != null && rt.getBasePrice() != null) {
            total = rt.getBasePrice().multiply(BigDecimal.valueOf(nights * (detail != null && detail.getQuantity() != null ? detail.getQuantity() : 1)));
        }

        return ReservationDto.builder()
                .reservationId(r.getReservationId())
                .reservationCode(r.getReservationCode())
                .roomTypeId(rt != null ? rt.getRoomTypeId() : null)
                .roomTypeName(rt != null ? rt.getTypeName() : null)
                .roomImageUrl(rt != null ? rt.getImageUrl() : null)
                .roomQuantity(detail != null ? detail.getQuantity() : 1)
                .checkInDate(r.getCheckInDate())
                .checkOutDate(r.getCheckOutDate())
                .nights(nights)
                .guestCount(r.getGuestCount())
                .contactName(r.getContactName())
                .contactEmail(r.getContactEmail())
                .contactPhone(r.getContactPhone())
                .specialNotes(r.getSpecialNotes())
                .status(r.getStatus())
                .estimatedTotal(total)
                .reservationDate(r.getReservationDate())
                .holdExpiresAt(r.getHoldExpiresAt())
                .build();
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
