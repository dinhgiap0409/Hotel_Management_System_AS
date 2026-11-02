package com.fpt.hms.service.impl;

import com.fpt.hms.common.MessageResolver;
import com.fpt.hms.dto.booking.*;
import com.fpt.hms.entity.*;
import com.fpt.hms.enums.ReservationStatus;
import com.fpt.hms.enums.RoomStatus;
import com.fpt.hms.enums.StayStatus;
import com.fpt.hms.exception.BusinessException;
import com.fpt.hms.exception.ResourceNotFoundException;
import com.fpt.hms.repository.*;
import com.fpt.hms.service.ReservationService;
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
 * Module 3A (Owner: GiapND) - Room Search & Online Reservation Service (UC-14, UC-21 to UC-25).
 */
@Service
@RequiredArgsConstructor
public class ReservationServiceImpl implements ReservationService {

    private final RoomTypeRepository roomTypeRepository;
    private final RoomTypePriceRepository roomTypePriceRepository;
    private final RoomRepository roomRepository;
    private final ReviewRepository reviewRepository;
    private final ReservationRepository reservationRepository;
    private final CustomerRepository customerRepository;
    private final MessageResolver messageResolver;
    private final Clock hotelClock;

    @Override
    @Transactional(readOnly = true)
    public List<PublicRoomCategoryDto> getActiveRoomCategories() {
        List<Room> nonArchivedRooms = roomRepository.findByRoomStatusNot(RoomStatus.ARCHIVED.name());
        List<Review> publishedReviews = reviewRepository.findByIsHiddenFalseOrderByReviewDateDesc();

        return roomTypeRepository.findByIsActiveTrue().stream()
                .map(rt -> toPublicRoomCategoryDto(rt, nonArchivedRooms, publishedReviews, null, null))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PublicRoomCategoryDto> searchAvailableRoomTypes(LocalDate checkInDate, LocalDate checkOutDate, int guests) {
        LocalDate today = LocalDate.now(hotelClock);

        // UC-21 Step 2 (BR-17): Validate date logic (departure after arrival; arrival not in past) and guest count
        if (checkInDate == null || checkOutDate == null
                || checkInDate.isBefore(today)
                || !checkOutDate.isAfter(checkInDate)) {
            throw new BusinessException("MSG04A", messageResolver.resolve("MSG04A"));
        }
        if (guests < 1) {
            throw new BusinessException("MSG04B", "Số lượng khách phải từ 1 người trở lên.");
        }

        long nights = ChronoUnit.DAYS.between(checkInDate, checkOutDate);
        Instant now = Instant.now(hotelClock);

        List<Room> nonArchivedRooms = roomRepository.findByRoomStatusNot(RoomStatus.ARCHIVED.name());
        List<Review> publishedReviews = reviewRepository.findByIsHiddenFalseOrderByReviewDateDesc();
        List<Reservation> allReservations = reservationRepository.findAll();

        List<Reservation> overlappingReservations = allReservations.stream()
                .filter(res -> isReservationBlockingInventory(res, now))
                .filter(res -> res.getCheckInDate() != null && res.getCheckOutDate() != null)
                .filter(res -> res.getCheckInDate().isBefore(checkOutDate) && res.getCheckOutDate().isAfter(checkInDate))
                .toList();

        return roomTypeRepository.findByIsActiveTrue().stream()
                .filter(rt -> rt.getCapacity() != null && rt.getCapacity() >= guests)
                .map(rt -> {
                    PublicRoomCategoryDto dto = toPublicRoomCategoryDto(
                            rt, nonArchivedRooms, publishedReviews, nights, rt.getBasePrice().multiply(BigDecimal.valueOf(nights))
                    );

                    int totalActivePhysicalRooms = dto.getTotalActiveRooms() != null ? dto.getTotalActiveRooms() : 0;

                    int bookedQuota = overlappingReservations.stream()
                            .filter(res -> res.getDetails() != null)
                            .flatMap(res -> res.getDetails().stream())
                            .filter(det -> det.getRoomType() != null && rt.getRoomTypeId().equals(det.getRoomType().getRoomTypeId()))
                            .mapToInt(det -> det.getQuantity() != null ? det.getQuantity() : 1)
                            .sum();

                    int currentlyOccupiedCount = (int) nonArchivedRooms.stream()
                            .filter(r -> r.getRoomType() != null && rt.getRoomTypeId().equals(r.getRoomType().getRoomTypeId()))
                            .filter(r -> RoomStatus.ACTIVE.name().equalsIgnoreCase(r.getRoomStatus()))
                            .filter(r -> StayStatus.OCCUPIED.name().equalsIgnoreCase(r.getStayStatus()))
                            .count();

                    int committedUnits = checkInDate.equals(today)
                            ? Math.max(bookedQuota, currentlyOccupiedCount)
                            : bookedQuota;

                    int availableForRequestedDates = Math.max(0, totalActivePhysicalRooms - committedUnits);
                    dto.setAvailableRoomsCount(availableForRequestedDates);
                    return dto;
                })
                .filter(dto -> dto.getAvailableRoomsCount() != null && dto.getAvailableRoomsCount() > 0)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public RoomCategoryDetailDto getRoomCategoryDetails(Integer roomTypeId, LocalDate checkInDate, LocalDate checkOutDate) {
        RoomType rt = roomTypeRepository.findById(roomTypeId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng phòng #" + roomTypeId));

        List<Room> categoryRooms = roomRepository.findByRoomStatusNot(RoomStatus.ARCHIVED.name()).stream()
                .filter(r -> r.getRoomType() != null && roomTypeId.equals(r.getRoomType().getRoomTypeId()))
                .filter(r -> RoomStatus.ACTIVE.name().equalsIgnoreCase(r.getRoomStatus()))
                .toList();

        int totalActiveRooms = categoryRooms.size();
        int availableRoomsCount = (int) categoryRooms.stream()
                .filter(r -> StayStatus.VACANT.name().equalsIgnoreCase(r.getStayStatus()))
                .count();

        List<Integer> floorNumbers = categoryRooms.stream()
                .map(Room::getFloor)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();

        List<String> sampleRoomNumbers = categoryRooms.stream()
                .map(Room::getRoomNumber)
                .filter(Objects::nonNull)
                .sorted()
                .toList();

        List<String> amenitiesList = (rt.getAmenities() != null && !rt.getAmenities().isBlank())
                ? Arrays.stream(rt.getAmenities().split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList()
                : Collections.emptyList();

        // Day-of-week tariffs from Room_Type_Price table in SQL Server
        List<RoomTypePrice> dbTariffs = roomTypePriceRepository.findByRoomType_RoomTypeIdAndIsActiveTrue(roomTypeId);
        Map<Integer, BigDecimal> tariffByDay = new HashMap<>();
        for (RoomTypePrice rtp : dbTariffs) {
            if (rtp.getDayOfWeek() != null && rtp.getPrice() != null) {
                tariffByDay.put(rtp.getDayOfWeek(), rtp.getPrice());
            }
        }

        String[] dayLabels = {"", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"};
        List<DayOfWeekRateDto> dayOfWeekRates = new ArrayList<>();
        for (int dow = 1; dow <= 7; dow++) {
            BigDecimal rate = tariffByDay.getOrDefault(dow, rt.getBasePrice());
            dayOfWeekRates.add(DayOfWeekRateDto.builder()
                    .dayOfWeek(dow)
                    .dayLabel(dayLabels[dow])
                    .price(rate)
                    .isWeekendSurcharge(rate.compareTo(rt.getBasePrice()) > 0)
                    .build());
        }

        // Compute stay nights & estimated total if dates are provided
        Long nights = null;
        BigDecimal estimatedTotal = null;
        if (checkInDate != null && checkOutDate != null && checkOutDate.isAfter(checkInDate)) {
            nights = ChronoUnit.DAYS.between(checkInDate, checkOutDate);
            BigDecimal sum = BigDecimal.ZERO;
            for (LocalDate d = checkInDate; d.isBefore(checkOutDate); d = d.plusDays(1)) {
                int dow = d.getDayOfWeek().getValue();
                sum = sum.add(tariffByDay.getOrDefault(dow, rt.getBasePrice()));
            }
            estimatedTotal = sum;
        }

        // Verified Reviews from Review table in SQL Server
        List<Review> categoryReviews = reviewRepository.findByIsHiddenFalseOrderByReviewDateDesc().stream()
                .filter(rev -> belongsToRoomType(rev, roomTypeId))
                .toList();

        int reviewCount = categoryReviews.size();
        Double averageRating = reviewCount > 0
                ? Math.round(categoryReviews.stream().mapToInt(Review::getRating).average().orElse(0.0) * 10.0) / 10.0
                : null;

        List<RoomReviewItemDto> verifiedReviews = categoryReviews.stream()
                .map(rev -> {
                    String guestName = (rev.getGuestStay() != null && rev.getGuestStay().getReservation() != null
                            && rev.getGuestStay().getReservation().getContactName() != null)
                            ? rev.getGuestStay().getReservation().getContactName()
                            : (rev.getCustomer() != null ? rev.getCustomer().getFullName() : "Khách lưu trú");

                    String roomNum = null;
                    if (rev.getGuestStay() != null && rev.getGuestStay().getRoomAssignments() != null
                            && !rev.getGuestStay().getRoomAssignments().isEmpty()) {
                        Room r = rev.getGuestStay().getRoomAssignments().getFirst().getRoom();
                        if (r != null) roomNum = r.getRoomNumber();
                    }

                    return RoomReviewItemDto.builder()
                            .reviewId(rev.getReviewId())
                            .customerName(guestName)
                            .rating(rev.getRating())
                            .comment(rev.getComment())
                            .reviewDate(rev.getReviewDate())
                            .managementReply(rev.getManagementReply())
                            .repliedAt(rev.getRepliedAt())
                            .roomNumber(roomNum)
                            .build();
                })
                .toList();

        List<String> photoGallery = new ArrayList<>();
        if (rt.getImageUrl() != null && !rt.getImageUrl().isBlank()) {
            photoGallery.add(rt.getImageUrl().trim());
        }
        photoGallery.add("/images/hotel-bg.jpg");

        return RoomCategoryDetailDto.builder()
                .roomTypeId(rt.getRoomTypeId())
                .typeName(rt.getTypeName())
                .capacity(rt.getCapacity())
                .basePrice(rt.getBasePrice())
                .bedLayout(deriveBedLayoutFromAmenities(rt, amenitiesList))
                .amenities(rt.getAmenities())
                .amenitiesList(amenitiesList)
                .description(rt.getDescription())
                .imageUrl(rt.getImageUrl())
                .photoGallery(photoGallery)
                .isActive(rt.getIsActive())
                .totalActiveRooms(totalActiveRooms)
                .availableRoomsCount(availableRoomsCount)
                .floorNumbers(floorNumbers)
                .sampleRoomNumbers(sampleRoomNumbers)
                .averageRating(averageRating)
                .reviewCount(reviewCount)
                .nights(nights)
                .estimatedTotal(estimatedTotal)
                .dayOfWeekRates(dayOfWeekRates)
                .verifiedReviews(verifiedReviews)
                .build();
    }

    private String deriveBedLayoutFromAmenities(RoomType rt, List<String> amenitiesList) {
        for (String item : amenitiesList) {
            String lower = item.toLowerCase();
            if (lower.contains("bed") || lower.contains("giường")) {
                return item;
            }
        }
        String name = rt.getTypeName() != null ? rt.getTypeName().toLowerCase() : "";
        if (name.contains("twin")) return "2 Giường đơn tiêu chuẩn (Twin Beds)";
        if (name.contains("king")) return "1 Giường đôi cỡ lớn (King Bed)";
        if (name.contains("double")) return "1 Giường đôi tiêu chuẩn (Queen/Double Bed)";
        if (name.contains("family")) return "2 Giường lớn gia đình (2 Queen Beds)";
        return "Giường tiêu chuẩn theo sức chứa " + rt.getCapacity() + " khách";
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

    private PublicRoomCategoryDto toPublicRoomCategoryDto(
            RoomType rt,
            List<Room> nonArchivedRooms,
            List<Review> publishedReviews,
            Long nights,
            BigDecimal estimatedTotal) {

        List<Room> categoryRooms = nonArchivedRooms.stream()
                .filter(r -> r.getRoomType() != null && rt.getRoomTypeId().equals(r.getRoomType().getRoomTypeId()))
                .filter(r -> RoomStatus.ACTIVE.name().equalsIgnoreCase(r.getRoomStatus()))
                .toList();

        int totalActiveRooms = categoryRooms.size();
        int availableRoomsCount = (int) categoryRooms.stream()
                .filter(r -> StayStatus.VACANT.name().equalsIgnoreCase(r.getStayStatus()))
                .count();

        List<Review> categoryReviews = publishedReviews.stream()
                .filter(rev -> belongsToRoomType(rev, rt.getRoomTypeId()))
                .toList();

        int reviewCount = categoryReviews.size();
        Double averageRating = reviewCount > 0
                ? Math.round(categoryReviews.stream().mapToInt(Review::getRating).average().orElse(0.0) * 10.0) / 10.0
                : null;

        List<String> amenitiesList = (rt.getAmenities() != null && !rt.getAmenities().isBlank())
                ? Arrays.stream(rt.getAmenities().split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList()
                : Collections.emptyList();

        return PublicRoomCategoryDto.builder()
                .roomTypeId(rt.getRoomTypeId())
                .typeName(rt.getTypeName())
                .capacity(rt.getCapacity())
                .basePrice(rt.getBasePrice())
                .amenities(rt.getAmenities())
                .amenitiesList(amenitiesList)
                .description(rt.getDescription())
                .imageUrl(rt.getImageUrl())
                .isActive(rt.getIsActive())
                .totalActiveRooms(totalActiveRooms)
                .availableRoomsCount(availableRoomsCount)
                .averageRating(averageRating)
                .reviewCount(reviewCount)
                .nights(nights)
                .estimatedTotal(estimatedTotal)
                .build();
    }

    private boolean belongsToRoomType(Review rev, Integer roomTypeId) {
        if (rev.getGuestStay() == null) return false;
        if (rev.getGuestStay().getRoomAssignments() != null && !rev.getGuestStay().getRoomAssignments().isEmpty()) {
            return rev.getGuestStay().getRoomAssignments().stream()
                    .anyMatch(a -> a.getRoom() != null
                            && a.getRoom().getRoomType() != null
                            && roomTypeId.equals(a.getRoom().getRoomType().getRoomTypeId()));
        }
        if (rev.getGuestStay().getReservation() != null && rev.getGuestStay().getReservation().getDetails() != null) {
            return rev.getGuestStay().getReservation().getDetails().stream()
                    .anyMatch(d -> d.getRoomType() != null && roomTypeId.equals(d.getRoomType().getRoomTypeId()));
        }
        return false;
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
