package com.fpt.hms.service.impl;

import com.fpt.hms.common.AuditService;
import com.fpt.hms.common.MessageResolver;
import com.fpt.hms.dto.booking.*;
import com.fpt.hms.entity.*;
import com.fpt.hms.enums.ReservationStatus;
import com.fpt.hms.enums.RoomStatus;
import com.fpt.hms.enums.StayStatus;
import com.fpt.hms.exception.BusinessException;
import com.fpt.hms.exception.ResourceNotFoundException;
import com.fpt.hms.integration.MailNotificationService;
import com.fpt.hms.integration.VnPayGatewayService;
import com.fpt.hms.repository.*;
import com.fpt.hms.service.ReservationService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
    private final PaymentRepository paymentRepository;
    private final PaymentAttemptRepository paymentAttemptRepository;
    private final VnPayGatewayService vnPayGatewayService;
    private final MailNotificationService mailNotificationService;
    private final MessageResolver messageResolver;
    private final Clock hotelClock;
    private final AuditService auditService;

    /** BR-19 hold duration, configured in application.yml (app.booking.hold-hours, default 24h). */
    @Value("${app.booking.hold-hours:24}")
    private long bookingHoldHours;

    @Override
    @Transactional(readOnly = true)
    public List<PublicRoomCategoryDto> getActiveRoomCategories() {
        LocalDate today = LocalDate.now(hotelClock);
        LocalDate tomorrow = today.plusDays(1);
        List<Room> nonArchivedRooms = roomRepository.findByRoomStatusNot(RoomStatus.ARCHIVED.name());
        List<Review> publishedReviews = reviewRepository.findByIsHiddenFalseOrderByReviewDateDesc();

        return roomTypeRepository.findByIsActiveTrue().stream()
                .map(rt -> {
                    PublicRoomCategoryDto dto = toPublicRoomCategoryDto(rt, nonArchivedRooms, publishedReviews, null, null);
                    int realTimeAvailable = computeAvailableQuotaForRoomType(rt.getRoomTypeId(), today, tomorrow, today);
                    dto.setAvailableRoomsCount(realTimeAvailable);
                    return dto;
                })
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
                    // UC-21: one single price rule everywhere — the stay total is
                    // the sum of the nightly Room_Type_Price tariffs for the
                    // requested dates (weekend surcharge included), exactly as
                    // getRoomCategoryDetails and createReservation charge it.
                    // Never basePrice * nights here, or the card total would
                    // differ from the detail/modal/deposit totals.
                    PublicRoomCategoryDto dto = toPublicRoomCategoryDto(
                            rt, nonArchivedRooms, publishedReviews, nights,
                            calculateNightlyTotal(rt, checkInDate, checkOutDate)
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
        LocalDate today = LocalDate.now(hotelClock);
        LocalDate targetCheckIn = checkInDate != null ? checkInDate : today;
        LocalDate targetCheckOut = (checkOutDate != null && checkOutDate.isAfter(targetCheckIn)) ? checkOutDate : targetCheckIn.plusDays(1);

        RoomType rt = roomTypeRepository.findById(roomTypeId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng phòng #" + roomTypeId));

        // UC-22: only an active room type may be viewed in detail (BR-18).
        // Inactive types are hidden from the catalog and must not be reachable
        // by direct URL either.
        if (Boolean.FALSE.equals(rt.getIsActive())) {
            throw new BusinessException("BR-18", "Hạng phòng này hiện đang tạm ngưng, không xem được chi tiết.");
        }

        List<Room> categoryRooms = roomRepository.findByRoomStatusNot(RoomStatus.ARCHIVED.name()).stream()
                .filter(r -> r.getRoomType() != null && roomTypeId.equals(r.getRoomType().getRoomTypeId()))
                .filter(r -> RoomStatus.ACTIVE.name().equalsIgnoreCase(r.getRoomStatus()))
                .toList();

        int totalActiveRooms = categoryRooms.size();
        int availableRoomsCount = computeAvailableQuotaForRoomType(roomTypeId, targetCheckIn, targetCheckOut, today);

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

        // Day-of-week tariffs from Room_Type_Price table in SQL Server.
        // Shared helper with search/createReservation: one price rule.
        List<DayOfWeekRateDto> dayOfWeekRates = buildDayOfWeekRates(rt);

        // Compute stay nights & estimated total if dates are provided
        Long nights = null;
        BigDecimal estimatedTotal = null;
        if (checkInDate != null && checkOutDate != null && checkOutDate.isAfter(checkInDate)) {
            nights = ChronoUnit.DAYS.between(checkInDate, checkOutDate);
            estimatedTotal = calculateNightlyTotal(rt, checkInDate, checkOutDate);
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

        // UC-22 gallery: main photo + the room type's gallery_images, so the
        // detail page shows 4 photos (overview, bed, bathroom, amenities)
        // instead of the main photo plus a generic hotel placeholder.
        // UC-22 gallery: main photo + the room type's gallery_images, so the
        // detail page shows 4 photos (overview, bed, bathroom, amenities)
        // instead of the main photo plus a generic hotel placeholder.
        List<String> photoGallery = new ArrayList<>();
        if (rt.getImageUrl() != null && !rt.getImageUrl().isBlank()) {
            photoGallery.add(rt.getImageUrl().trim());
        }
        photoGallery.addAll(rt.getGalleryImageList());
        if (photoGallery.isEmpty()) {
            photoGallery.add("/images/hotel-bg.jpg");
        }

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
                .dayOfWeekRates(buildDayOfWeekRates(rt))
                .build();
    }

    /**
     * THE single price rule for the whole booking flow (UC-14, UC-21..23):
     * the stay total is the sum of one nightly Room_Type_Price tariff per
     * night of the stay (day-of-week price, weekend surcharge included).
     * A weekday with no tariff row falls back to basePrice for that night
     * only — the same rule getRoomCategoryDetails and createReservation use.
     * Never basePrice * nights: that under-prices weekend stays and makes
     * the card total differ from the detail/modal/deposit totals.
     */
    private BigDecimal calculateNightlyTotal(RoomType rt, LocalDate checkInDate, LocalDate checkOutDate) {
        if (checkInDate == null || checkOutDate == null || !checkOutDate.isAfter(checkInDate)) {
            return null;
        }
        Map<Integer, BigDecimal> tariffByDay = loadTariffMap(rt.getRoomTypeId());
        BigDecimal sum = BigDecimal.ZERO;
        for (LocalDate d = checkInDate; d.isBefore(checkOutDate); d = d.plusDays(1)) {
            sum = sum.add(tariffByDay.getOrDefault(d.getDayOfWeek().getValue(), rt.getBasePrice()));
        }
        return sum;
    }

    /** Day-of-week tariff table for one room type, from Room_Type_Price. */
    private List<DayOfWeekRateDto> buildDayOfWeekRates(RoomType rt) {
        Map<Integer, BigDecimal> tariffByDay = loadTariffMap(rt.getRoomTypeId());
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
        return dayOfWeekRates;
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
        if (request.getCheckInDate() == null || request.getCheckOutDate() == null
                || request.getCheckInDate().isBefore(today)
                || !request.getCheckOutDate().isAfter(request.getCheckInDate())) {
            throw new BusinessException("MSG04A", "Ngày nhận phòng không được ở quá khứ và ngày trả phòng phải sau ngày nhận phòng.");
        }

        RoomType roomType = roomTypeRepository.findById(request.getRoomTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng phòng #" + request.getRoomTypeId()));

        if (Boolean.FALSE.equals(roomType.getIsActive())) {
            throw new BusinessException("BR-18", "Hạng phòng này hiện đang tạm ngưng mở đặt trực tuyến.");
        }

        int qty = Math.max(1, request.getQuantity());
        int maxAllowedGuests = (roomType.getCapacity() != null ? roomType.getCapacity() : 2) * qty;
        if (request.getGuestCount() > maxAllowedGuests) {
            throw new BusinessException(
                    "BR-17",
                    "Số lượng khách (" + request.getGuestCount() + " người) vượt quá sức chứa tối đa của "
                            + qty + " phòng " + roomType.getTypeName() + " (Tối đa " + maxAllowedGuests + " khách)."
            );
        }

        // Check real-time available quota for the requested [checkInDate, checkOutDate) window
        int availableQuota = computeAvailableQuotaForRoomType(
                roomType.getRoomTypeId(), request.getCheckInDate(), request.getCheckOutDate(), today
        );
        if (qty > availableQuota) {
            throw new BusinessException(
                    "BR-18",
                    "Số lượng phòng trống của hạng phòng '" + roomType.getTypeName()
                            + "' không đủ trong khoảng ngày bạn chọn (Chỉ còn " + availableQuota + " phòng trống)."
            );
        }

        Customer customer = null;
        if (accountId != null) {
            customer = customerRepository.findByAccount_AccountId(accountId).orElse(null);
        }
        if (customer == null) {
            // Reuse the existing customer record for this email instead of
            // creating an orphan duplicate (e.g. a returning guest, or a
            // logged-in customer whose profile was created by another flow).
            // Note: the record is reused as-is; linking it to the account is
            // a follow-up (needs AccountRepository here).
            customer = customerRepository.findByEmailIgnoreCase(request.getContactEmail().trim()).orElse(null);
        }
        if (customer == null) {
            customer = customerRepository.save(Customer.builder()
                    .fullName(request.getContactName().trim())
                    .email(request.getContactEmail().trim())
                    .phone(request.getContactPhone().trim())
                    .build());
        }

        String code = "BK-" + LocalDate.now(hotelClock).getYear() + "-"
                + UUID.randomUUID().toString().substring(0, 5).toUpperCase();

        Instant now = Instant.now(hotelClock);
        // BR-19: hold the room quota for app.booking.hold-hours (default 24h).
        // The scheduler cancels PENDING reservations past this instant.
        Instant holdExpiresAt = now.plus(bookingHoldHours, ChronoUnit.HOURS);

        // BR-19: New reservations start as PENDING and hold quota for 24 hours
        Reservation reservation = Reservation.builder()
                .customer(customer)
                .reservationCode(code)
                .reservationDate(now)
                .checkInDate(request.getCheckInDate())
                .checkOutDate(request.getCheckOutDate())
                .guestCount(request.getGuestCount())
                .specialNotes(request.getSpecialNotes())
                .status(ReservationStatus.PENDING.name())
                .contactName(request.getContactName().trim())
                .contactEmail(request.getContactEmail().trim())
                .contactPhone(request.getContactPhone().trim())
                .holdExpiresAt(holdExpiresAt)
                .build();

        ReservationDetail detail = ReservationDetail.builder()
                .reservation(reservation)
                .roomType(roomType)
                .quantity(qty)
                .build();

        // Snapshot nightly tariffs from Room_Type_Price table in SQL Server
        Map<Integer, BigDecimal> tariffByDay = loadTariffMap(roomType.getRoomTypeId());
        BigDecimal singleRoomStaySum = BigDecimal.ZERO;
        for (LocalDate d = request.getCheckInDate(); d.isBefore(request.getCheckOutDate()); d = d.plusDays(1)) {
            int dow = d.getDayOfWeek().getValue();
            BigDecimal nightPrice = tariffByDay.getOrDefault(dow, roomType.getBasePrice());
            singleRoomStaySum = singleRoomStaySum.add(nightPrice);

            detail.getNightlyRates().add(ReservationNightlyRate.builder()
                    .reservationDetail(detail)
                    .stayDate(d)
                    .unitPrice(nightPrice)
                    .build());
        }
        reservation.getDetails().add(detail);

        Reservation savedReservation = reservationRepository.save(reservation);

        auditService.recordAction(accountId, accountId != null ? "CUSTOMER" : "GUEST",
                "RESERVATION_CREATED", "Reservation", savedReservation.getReservationId(),
                null, "code=" + code + ";status=PENDING;holdHours=" + bookingHoldHours,
                "Tao don dat phong online (UC-23)");

        // Create Deposit Payment (30% of estimated stay total) & VNPay PaymentAttempt record
        BigDecimal estimatedTotal = singleRoomStaySum.multiply(BigDecimal.valueOf(qty));
        BigDecimal depositAmount = estimatedTotal
                .multiply(new BigDecimal("0.30"))
                .setScale(0, RoundingMode.HALF_UP);

        Payment depositPayment = paymentRepository.save(Payment.builder()
                .reservation(savedReservation)
                .paymentType("DEPOSIT")
                .amount(depositAmount)
                .currency("VND")
                .method("VNPAY")
                .idempotencyKey(code + "-DEPOSIT")
                .status("PENDING")
                .createdAt(now)
                .build());

        paymentAttemptRepository.save(PaymentAttempt.builder()
                .payment(depositPayment)
                .gatewayProvider("VNPAY")
                .gatewayRequestRef(code)
                .status("PENDING")
                .createdAt(now)
                .expiredAt(holdExpiresAt)
                .build());

        return toDto(savedReservation);
    }

    @Override
    @Transactional
    public ReservationDto processVnPayCallback(VnPayCallbackRequest request) {
        String code = request.getReservationCode().trim();
        Reservation reservation = reservationRepository.findByReservationCode(code)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng với mã: " + code));

        Instant now = Instant.now(hotelClock);
        boolean isSuccess = request.getVnpResponseCode() != null && "00".equals(request.getVnpResponseCode().trim());

        List<Payment> payments = paymentRepository.findByReservation_ReservationId(reservation.getReservationId());
        Payment depositPayment = payments.stream()
                .filter(p -> "DEPOSIT".equalsIgnoreCase(p.getPaymentType()))
                .findFirst()
                .orElse(null);

        PaymentAttempt attempt = paymentAttemptRepository.findByGatewayRequestRef(reservation.getReservationCode())
                .orElse(null);

        // Idempotent replay: a callback that was already processed successfully
        // must not re-confirm the booking or send a second confirmation email.
        boolean alreadyConfirmed = ReservationStatus.CONFIRMED.name().equalsIgnoreCase(reservation.getStatus())
                || ReservationStatus.CHECKED_IN.name().equalsIgnoreCase(reservation.getStatus())
                || ReservationStatus.COMPLETED.name().equalsIgnoreCase(reservation.getStatus());
        if (alreadyConfirmed && depositPayment != null && "PAID".equalsIgnoreCase(depositPayment.getStatus())) {
            return toDto(reservation);
        }

        if (ReservationStatus.CANCELLED.name().equalsIgnoreCase(reservation.getStatus())) {
            throw new BusinessException("BR-19", "Đơn đặt phòng này đã bị hủy hoặc quá hạn giữ chỗ 24 giờ.");
        }

        // BR-19: a PENDING booking whose hold has expired cannot be confirmed
        // by a late callback (the scheduler may not have cancelled it yet).
        if (ReservationStatus.PENDING.name().equalsIgnoreCase(reservation.getStatus())
                && reservation.getHoldExpiresAt() != null && now.isAfter(reservation.getHoldExpiresAt())) {
            throw new BusinessException("BR-19", "Đơn đặt phòng đã hết hạn giữ chỗ 24 giờ. Vui lòng đặt phòng lại.");
        }

        if (isSuccess) {
            // The backend is the source of truth: a claimed success is only
            // accepted after the VNPay signature, amount and transaction ref
            // have been verified (or, in demo mode, after an explicit demo
            // simulation). The frontend result alone is never trusted.
            verifyVnPayCallbackOrThrow(reservation, depositPayment, attempt, request);

            reservation.setStatus(ReservationStatus.CONFIRMED.name());
            reservationRepository.save(reservation);

            boolean depositJustPaid = false;
            if (depositPayment != null && !"PAID".equalsIgnoreCase(depositPayment.getStatus())) {
                depositPayment.setStatus("PAID");
                depositPayment.setPaidAt(now);
                paymentRepository.save(depositPayment);
                depositJustPaid = true;
            }
            if (attempt != null) {
                attempt.setStatus("SUCCESS");
                attempt.setGatewayTransactionId(
                        request.getVnpTransactionNo() != null && !request.getVnpTransactionNo().isBlank()
                                ? request.getVnpTransactionNo().trim()
                                : "VNP-" + System.currentTimeMillis()
                );
                attempt.setBankCode(
                        request.getBankCode() != null && !request.getBankCode().isBlank()
                                ? request.getBankCode().trim()
                                : "NCB"
                );
                attempt.setCompletedAt(now);
                paymentAttemptRepository.save(attempt);
            }

            if (depositJustPaid) {
                mailNotificationService.sendBookingConfirmation(
                        reservation.getContactEmail(),
                        reservation.getReservationCode(),
                        reservation.getContactName()
                );
            }
            Integer actorId = reservation.getCustomer() != null && reservation.getCustomer().getAccount() != null
                    ? reservation.getCustomer().getAccount().getAccountId() : null;
            auditService.recordAction(actorId, "VNPAY", "VNPAY_CALLBACK_SUCCESS",
                    "Reservation", reservation.getReservationId(),
                    "status=PENDING", "status=CONFIRMED",
                    "Xac thuc VNPay thanh cong, xac nhan dat phong (UC-23)");
        } else {
            if (attempt != null && !"SUCCESS".equalsIgnoreCase(attempt.getStatus())) {
                attempt.setStatus("FAILED");
                attempt.setCompletedAt(now);
                paymentAttemptRepository.save(attempt);
            }
            auditService.recordAction(null, "VNPAY", "VNPAY_CALLBACK_FAILED",
                    "Reservation", reservation.getReservationId(),
                    "status=" + reservation.getStatus(), "status=" + reservation.getStatus(),
                    "VNPay tra ve ma loi " + request.getVnpResponseCode());
        }

        return toDto(reservation);
    }

    /**
     * Verifies a claimed-success VNPay callback before the booking is confirmed.
     * Checks, in order: the transaction ref matches this reservation's payment
     * attempt, the amount (VND x 100) matches the stored 30% deposit, and — unless
     * the server is in demo mode and the frontend explicitly simulated the gateway
     * — the HMAC-SHA512 signature over the full vnp_* parameter set.
     */
    private void verifyVnPayCallbackOrThrow(Reservation reservation, Payment depositPayment,
                                            PaymentAttempt attempt, VnPayCallbackRequest request) {
        if (attempt != null && !reservation.getReservationCode().equalsIgnoreCase(attempt.getGatewayRequestRef())) {
            throw new BusinessException("VNPAY_TXN_MISMATCH",
                    "Mã giao dịch VNPay (vnp_TxnRef) không khớp với đơn đặt phòng.");
        }
        if (request.getVnpAmount() != null && depositPayment != null && depositPayment.getAmount() != null) {
            long expectedAmount = depositPayment.getAmount().multiply(BigDecimal.valueOf(100)).longValue();
            if (!request.getVnpAmount().equals(expectedAmount)) {
                throw new BusinessException("VNPAY_AMOUNT_MISMATCH",
                        "Số tiền VNPay không khớp với số tiền đặt cọc của đơn đặt phòng.");
            }
        }
        boolean demoSimulation = Boolean.TRUE.equals(request.getDemoMode()) && vnPayGatewayService.isDemoMode();
        if (demoSimulation) {
            // Demo only: the simulated gateway page (mode=gateway, DEMO_TMN) has no
            // real signature. This path is only reachable when the server itself
            // is configured with DEMO_TMN/DEMO_SECRET; see VnPayGatewayService.
            return;
        }
        if (request.getVnpSecureHash() == null || request.getVnpSecureHash().isBlank()) {
            throw new BusinessException("VNPAY_SIGNATURE_MISSING",
                    "Thiếu chữ ký VNPay (vnp_SecureHash). Giao dịch chưa được xác thực.");
        }
        if (!vnPayGatewayService.verifyCallbackSignature(request.getVnpParams(), request.getVnpSecureHash())) {
            throw new BusinessException("VNPAY_SIGNATURE_INVALID",
                    "Chữ ký VNPay không hợp lệ. Giao dịch chưa được xác thực.");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReservationDto> getMyReservations(Integer accountId) {
        if (accountId == null) {
            return Collections.emptyList();
        }
        Optional<Customer> customerOpt = customerRepository.findByAccount_AccountId(accountId);
        if (customerOpt.isEmpty()) {
            return Collections.emptyList();
        }
        return reservationRepository
                .findByCustomer_CustomerIdOrderByReservationDateDesc(customerOpt.get().getCustomerId())
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReservationDto> getAllReservations() {
        return reservationRepository.findAll().stream()
                .sorted(Comparator.comparing(Reservation::getReservationDate, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ReservationDto findByCode(String reservationCode) {
        Reservation reservation = reservationRepository.findByReservationCode(reservationCode.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng với mã: " + reservationCode));
        return toDto(reservation);
    }

    @Override
    @Transactional
    public ReservationDto cancelReservation(Integer reservationId, Integer accountId, String roleName) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng #" + reservationId));

        // UC-24/UC-25: a customer may only cancel their own booking. Front-desk
        // staff cancel on the guest's behalf (SRS screen 10.4).
        // UC-25 actors are Customer and Front-Desk Staff only; the controller
        // already restricts this endpoint to those two roles.
        boolean isStaff = roleName != null && "FRONT_DESK".equalsIgnoreCase(roleName);
        if (accountId != null && !isStaff && reservation.getCustomer() != null
                && reservation.getCustomer().getAccount() != null
                && !accountId.equals(reservation.getCustomer().getAccount().getAccountId())) {
            throw new AccessDeniedException("Bạn chỉ được hủy đơn đặt phòng của chính mình.");
        }

        if (ReservationStatus.CHECKED_IN.name().equalsIgnoreCase(reservation.getStatus())
                || ReservationStatus.COMPLETED.name().equalsIgnoreCase(reservation.getStatus())) {
            throw new BusinessException("BR-21", "Không thể hủy đơn đặt phòng đã Nhận phòng (Checked-In) hoặc đã Hoàn tất (Completed).");
        }
        if (ReservationStatus.CANCELLED.name().equalsIgnoreCase(reservation.getStatus())) {
            return toDto(reservation);
        }
        String oldStatus = reservation.getStatus();
        reservation.setStatus(ReservationStatus.CANCELLED.name());
        Reservation saved = reservationRepository.save(reservation);

        // Release the unpaid deposit hold so the room quota frees immediately
        // instead of waiting for the hold-expiry scheduler.
        List<Payment> payments = paymentRepository.findByReservation_ReservationId(reservation.getReservationId());
        for (Payment payment : payments) {
            if ("PENDING".equalsIgnoreCase(payment.getStatus())) {
                payment.setStatus("FAILED");
            }
        }
        paymentRepository.saveAll(payments);
        paymentAttemptRepository.findByGatewayRequestRef(reservation.getReservationCode())
                .ifPresent(attempt -> {
                    if ("PENDING".equalsIgnoreCase(attempt.getStatus())) {
                        attempt.setStatus("FAILED");
                        attempt.setCompletedAt(Instant.now(hotelClock));
                        paymentAttemptRepository.save(attempt);
                    }
                });

        auditService.recordAction(accountId, roleName != null ? roleName : "CUSTOMER",
                "RESERVATION_CANCELLED", "Reservation", saved.getReservationId(),
                "status=" + oldStatus, "status=CANCELLED",
                "Huy don dat phong (UC-25)");
        return toDto(saved);
    }

    private int computeAvailableQuotaForRoomType(Integer roomTypeId, LocalDate checkInDate, LocalDate checkOutDate, LocalDate today) {
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

    private Map<Integer, BigDecimal> loadTariffMap(Integer roomTypeId) {
        List<RoomTypePrice> dbTariffs = roomTypePriceRepository.findByRoomType_RoomTypeIdAndIsActiveTrue(roomTypeId);
        Map<Integer, BigDecimal> tariffByDay = new HashMap<>();
        for (RoomTypePrice rtp : dbTariffs) {
            if (rtp.getDayOfWeek() != null && rtp.getPrice() != null) {
                tariffByDay.put(rtp.getDayOfWeek(), rtp.getPrice());
            }
        }
        return tariffByDay;
    }

    private ReservationDto toDto(Reservation r) {
        long nights = Math.max(1, ChronoUnit.DAYS.between(r.getCheckInDate(), r.getCheckOutDate()));
        Integer roomTypeId = null;
        String roomTypeName = "Standard";
        String roomImageUrl = "/images/hotel-bg.jpg";
        int qty = 1;
        BigDecimal basePrice = BigDecimal.ZERO;
        List<ReservationDto.NightlyRateItemDto> nightlyBreakdown = new ArrayList<>();
        String[] dayLabels = {"", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"};

        BigDecimal total = BigDecimal.ZERO;
        if (r.getDetails() != null && !r.getDetails().isEmpty()) {
            ReservationDetail d = r.getDetails().getFirst();
            qty = d.getQuantity() != null ? d.getQuantity() : 1;
            if (d.getRoomType() != null) {
                roomTypeId = d.getRoomType().getRoomTypeId();
                roomTypeName = d.getRoomType().getTypeName();
                if (d.getRoomType().getImageUrl() != null && !d.getRoomType().getImageUrl().isBlank()) {
                    roomImageUrl = d.getRoomType().getImageUrl();
                }
                basePrice = d.getRoomType().getBasePrice() != null ? d.getRoomType().getBasePrice() : BigDecimal.ZERO;
            }

            if (d.getNightlyRates() != null && !d.getNightlyRates().isEmpty()) {
                for (ReservationNightlyRate nr : d.getNightlyRates()) {
                    BigDecimal unit = nr.getUnitPrice() != null ? nr.getUnitPrice() : basePrice;
                    BigDecimal lineTotal = unit.multiply(BigDecimal.valueOf(qty));
                    total = total.add(lineTotal);
                    int dow = nr.getStayDate() != null ? nr.getStayDate().getDayOfWeek().getValue() : 1;
                    nightlyBreakdown.add(ReservationDto.NightlyRateItemDto.builder()
                            .stayDate(nr.getStayDate())
                            .dayLabel(dayLabels[dow])
                            .unitPrice(unit)
                            .quantity(qty)
                            .lineTotal(lineTotal)
                            .build());
                }
            }
        }

        if (total.compareTo(BigDecimal.ZERO) <= 0) {
            total = basePrice.multiply(BigDecimal.valueOf(nights)).multiply(BigDecimal.valueOf(qty));
        }

        BigDecimal depositAmount = total.multiply(new BigDecimal("0.30")).setScale(0, RoundingMode.HALF_UP);
        String depositStatus = "NOT_REQUIRED";
        if (ReservationStatus.PENDING.name().equalsIgnoreCase(r.getStatus())) {
            depositStatus = "PENDING";
        } else if (ReservationStatus.CONFIRMED.name().equalsIgnoreCase(r.getStatus())
                || ReservationStatus.CHECKED_IN.name().equalsIgnoreCase(r.getStatus())
                || ReservationStatus.COMPLETED.name().equalsIgnoreCase(r.getStatus())) {
            depositStatus = "PAID";
        }

        List<Payment> payments = paymentRepository.findByReservation_ReservationId(r.getReservationId());
        for (Payment p : payments) {
            if ("DEPOSIT".equalsIgnoreCase(p.getPaymentType())) {
                if (p.getAmount() != null) {
                    depositAmount = p.getAmount();
                }
                if (p.getStatus() != null) {
                    depositStatus = p.getStatus();
                }
                break;
            }
        }

        String vnpayUrl = null;
        if (ReservationStatus.PENDING.name().equalsIgnoreCase(r.getStatus()) && !"PAID".equalsIgnoreCase(depositStatus)) {
            vnpayUrl = vnPayGatewayService.createDepositPaymentUrl(r.getReservationCode(), depositAmount);
        }

        return ReservationDto.builder()
                .reservationId(r.getReservationId())
                .reservationCode(r.getReservationCode())
                .roomTypeId(roomTypeId)
                .roomTypeName(roomTypeName)
                .roomImageUrl(roomImageUrl)
                .roomQuantity(qty)
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
                .depositAmount(depositAmount)
                .depositPaymentStatus(depositStatus)
                .vnpayPaymentUrl(vnpayUrl)
                .reservationDate(r.getReservationDate())
                .holdExpiresAt(r.getHoldExpiresAt())
                .nightlyBreakdown(nightlyBreakdown)
                .build();
    }
}
