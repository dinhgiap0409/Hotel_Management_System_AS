package com.fpt.hms.controller;

import com.fpt.hms.dto.billing_report.*;
import com.fpt.hms.entity.*;
import com.fpt.hms.enums.InvoiceStatus;
import com.fpt.hms.enums.RoomStatus;
import com.fpt.hms.enums.ServiceOrderStatus;
import com.fpt.hms.enums.StayStatus;
import com.fpt.hms.exception.BusinessException;
import com.fpt.hms.exception.ResourceNotFoundException;
import com.fpt.hms.repository.*;
import com.fpt.hms.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Module 5 (Owner: LinhNH) - Hotel & Room Reviews (UC-41..44) & Management Analytics Reports (UC-45..47 & UC-50).
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "5. Reviews & Management Analytics Reports (Module 5 - LinhNH)")
public class ReportController {

    private static final ZoneId HOTEL_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final RoomRepository roomRepository;
    private final RoomTypeRepository roomTypeRepository;
    private final InvoiceRepository invoiceRepository;
    private final FolioRepository folioRepository;
    private final PaymentRepository paymentRepository;
    private final HotelServiceRepository hotelServiceRepository;
    private final ServiceOrderRepository serviceOrderRepository;
    private final AdditionalChargeRepository additionalChargeRepository;
    private final ReviewRepository reviewRepository;
    private final GuestStayRepository guestStayRepository;
    private final CustomerRepository customerRepository;

    // =========================================================================
    // UC-41..44: HOTEL & ROOM STAY REVIEWS
    // =========================================================================

    @GetMapping("/reviews/published")
    @Transactional(readOnly = true)
    @Operation(summary = "UC-42: View published non-hidden room & hotel stay reviews (All Users)")
    public ResponseEntity<List<ReviewDto>> getPublishedReviews(
            @RequestParam(required = false) Integer roomTypeId,
            @RequestParam(required = false) Integer rating) {
        List<ReviewDto> result = reviewRepository.findByIsHiddenFalseOrderByReviewDateDesc()
                .stream()
                .map(this::toReviewDto)
                .filter(dto -> roomTypeId == null || roomTypeId.equals(dto.getRoomTypeId()))
                .filter(dto -> rating == null || rating.equals(dto.getRating()))
                .toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/reviews")
    @PreAuthorize("hasAnyRole('SALES_MANAGER', 'FRONT_DESK', 'GENERAL_MANAGER', 'ACCOUNTANT', 'SERVICE_MANAGER', 'ADMIN')")
    @Transactional(readOnly = true)
    @Operation(summary = "UC-42..44: List all hotel & room reviews including hidden ones for staff moderation")
    public ResponseEntity<List<ReviewDto>> getAllReviewsForModeration() {
        List<ReviewDto> all = reviewRepository.findAll()
                .stream()
                .sorted(Comparator.comparing(
                        (Review r) -> r.getReviewDate() != null ? r.getReviewDate() : Instant.EPOCH
                ).reversed())
                .map(this::toReviewDto)
                .toList();
        return ResponseEntity.ok(all);
    }

    @GetMapping("/reviews/my-stays")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Transactional(readOnly = true)
    @Operation(summary = "UC-41: Get customer's guest stays and their review status")
    public ResponseEntity<List<CustomerStayReviewCandidateDto>> getMyStaysForReview(
            @AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null || principal.getAccountId() == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        Customer customer = customerRepository.findByAccount_AccountId(principal.getAccountId())
                .orElse(null);
        if (customer == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        Map<Integer, Review> reviewByStayId = reviewRepository.findAll()
                .stream()
                .filter(r -> r.getGuestStay() != null && r.getGuestStay().getStayId() != null)
                .collect(Collectors.toMap(
                        r -> r.getGuestStay().getStayId(),
                        r -> r,
                        (existing, replacement) -> existing
                ));

        List<GuestStay> myStays = guestStayRepository.findAll()
                .stream()
                .filter(s -> s.getReservation() != null
                        && s.getReservation().getCustomer() != null
                        && customer.getCustomerId().equals(s.getReservation().getCustomer().getCustomerId()))
                .sorted(Comparator.comparing(
                        (GuestStay s) -> s.getActualCheckIn() != null ? s.getActualCheckIn() : Instant.EPOCH
                ).reversed())
                .toList();

        List<CustomerStayReviewCandidateDto> candidates = myStays.stream()
                .map(stay -> toStayCandidateDto(stay, reviewByStayId.get(stay.getStayId())))
                .sorted((c1, c2) -> {
                    // 1. Ưu tiên đưa kỳ lưu trú có thể đánh giá (canReview = true) lên trên đầu
                    boolean can1 = c1.isCanReview();
                    boolean can2 = c2.isCanReview();
                    if (can1 && !can2) return -1;
                    if (!can1 && can2) return 1;

                    // 2. Chưa đánh giá xếp trước kỳ đã đánh giá
                    boolean rev1 = c1.getExistingReview() != null;
                    boolean rev2 = c2.getExistingReview() != null;
                    if (!rev1 && rev2) return -1;
                    if (rev1 && !rev2) return 1;

                    // 3. Thời gian trả phòng/nhận phòng mới nhất trước
                    Instant d1 = c1.getActualCheckOut() != null ? c1.getActualCheckOut()
                            : (c1.getActualCheckIn() != null ? c1.getActualCheckIn() : Instant.EPOCH);
                    Instant d2 = c2.getActualCheckOut() != null ? c2.getActualCheckOut()
                            : (c2.getActualCheckIn() != null ? c2.getActualCheckIn() : Instant.EPOCH);
                    return d2.compareTo(d1);
                })
                .toList();

        return ResponseEntity.ok(candidates);
    }

    @PostMapping("/reviews")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Transactional
    @Operation(summary = "UC-41: Submit a 1-5 star room & hotel stay review after checkout (CUSTOMER)")
    public ResponseEntity<ReviewDto> submitReview(
            @Valid @RequestBody ReviewSubmitRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null || principal.getAccountId() == null) {
            throw new BusinessException("AUTH_REQUIRED", "Vui lòng đăng nhập tài khoản khách hàng để gửi đánh giá.");
        }
        Customer customer = customerRepository.findByAccount_AccountId(principal.getAccountId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hồ sơ khách hàng."));

        GuestStay stay = guestStayRepository.findById(request.getStayId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy kỳ lưu trú #" + request.getStayId()));

        if (stay.getReservation() == null
                || stay.getReservation().getCustomer() == null
                || !customer.getCustomerId().equals(stay.getReservation().getCustomer().getCustomerId())) {
            throw new BusinessException("REVIEW_FORBIDDEN", "Bạn chỉ có thể đánh giá kỳ lưu trú của chính mình.");
        }

        boolean isStayCompleted = "COMPLETED".equalsIgnoreCase(stay.getStatus())
                || "CHECKED_OUT".equalsIgnoreCase(stay.getStatus())
                || (stay.getReservation() != null && "COMPLETED".equalsIgnoreCase(stay.getReservation().getStatus()));
        if (!isStayCompleted) {
            throw new BusinessException("STAY_NOT_COMPLETED",
                    "Chỉ có thể gửi đánh giá khách sạn sau khi đã hoàn tất thủ tục trả phòng (Check-out).");
        }

        if (reviewRepository.existsByGuestStay_StayId(stay.getStayId())) {
            throw new BusinessException("REVIEW_ALREADY_EXISTS",
                    "Kỳ lưu trú này đã được bạn gửi đánh giá trước đó.");
        }

        String trimmedComment = request.getComment() != null ? request.getComment().trim() : "";
        if (trimmedComment.length() < 5) {
            throw new BusinessException("REVIEW_COMMENT_TOO_SHORT",
                    "Vui lòng nhập nhận xét tối thiểu 5 ký tự để chia sẻ trải nghiệm lưu trú của bạn.");
        }

        Review review = Review.builder()
                .customer(customer)
                .guestStay(stay)
                .rating(request.getRating())
                .comment(trimmedComment)
                .reviewDate(Instant.now())
                .isHidden(false)
                .build();

        Review saved = reviewRepository.save(review);
        return ResponseEntity.ok(toReviewDto(saved));
    }

    @PatchMapping("/reviews/{reviewId}/reply")
    @PreAuthorize("hasAnyRole('SALES_MANAGER', 'FRONT_DESK', 'GENERAL_MANAGER', 'ADMIN')")
    @Transactional
    @Operation(summary = "UC-43: Publish or update official management reply to a guest review")
    public ResponseEntity<ReviewDto> replyToReview(
            @PathVariable Integer reviewId,
            @Valid @RequestBody ReviewReplyRequest request) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đánh giá #" + reviewId));

        String replyText = request.getManagementReply() != null ? request.getManagementReply().trim() : "";
        if (replyText.isEmpty()) {
            throw new BusinessException("REPLY_EMPTY", "Nội dung phản hồi không được để trống.");
        }

        review.setManagementReply(replyText);
        review.setRepliedAt(Instant.now());
        Review saved = reviewRepository.save(review);
        return ResponseEntity.ok(toReviewDto(saved));
    }

    @PatchMapping("/reviews/{reviewId}/visibility")
    @PreAuthorize("hasAnyRole('SALES_MANAGER', 'GENERAL_MANAGER', 'ADMIN')")
    @Transactional
    @Operation(summary = "UC-44: Hide or restore a guest review with audit reason")
    public ResponseEntity<ReviewDto> moderateReviewVisibility(
            @PathVariable Integer reviewId,
            @Valid @RequestBody ReviewModerateRequest request) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đánh giá #" + reviewId));

        boolean hide = Boolean.TRUE.equals(request.getIsHidden());
        if (hide) {
            String reason = request.getHiddenReason() != null ? request.getHiddenReason().trim() : "";
            if (reason.isEmpty()) {
                throw new BusinessException("HIDDEN_REASON_REQUIRED",
                        "Vui lòng nhập lý do ẩn đánh giá để lưu vết kiểm duyệt (UC-44).");
            }
            review.setIsHidden(true);
            review.setHiddenReason(reason);
        } else {
            review.setIsHidden(false);
            review.setHiddenReason(null);
        }

        Review saved = reviewRepository.save(review);
        return ResponseEntity.ok(toReviewDto(saved));
    }

    // =========================================================================
    // UC-45, UC-46, UC-47 & UC-50: MANAGEMENT ANALYTICS & EXPORT DASHBOARD
    // =========================================================================

    @GetMapping("/reports/analytics")
    @PreAuthorize("hasAnyRole('GENERAL_MANAGER', 'ACCOUNTANT', 'SALES_MANAGER', 'SERVICE_MANAGER', 'FRONT_DESK', 'ADMIN')")
    @Transactional(readOnly = true)
    @Operation(summary = "UC-45, UC-46, UC-47 & UC-50: Comprehensive occupancy, revenue, and service consumption analytics")
    public ResponseEntity<ManagementReportResponse> getManagementAnalytics(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {

        LocalDate today = LocalDate.now(HOTEL_ZONE);
        LocalDate effectiveTo = toDate != null ? toDate : today;
        LocalDate effectiveFrom = fromDate != null ? fromDate : effectiveTo.minusDays(29);
        if (effectiveFrom.isAfter(effectiveTo)) {
            LocalDate tmp = effectiveFrom;
            effectiveFrom = effectiveTo;
            effectiveTo = tmp;
        }
        long periodDays = Math.max(1, ChronoUnit.DAYS.between(effectiveFrom, effectiveTo) + 1);

        final LocalDate finalFrom = effectiveFrom;
        final LocalDate finalTo = effectiveTo;

        // 1. Rooms & Occupancy Analytics (UC-45)
        List<Room> allNonArchivedRooms = roomRepository.findByRoomStatusNot(RoomStatus.ARCHIVED.name());
        long totalRooms = allNonArchivedRooms.size();
        long occupiedRooms = allNonArchivedRooms.stream()
                .filter(r -> StayStatus.OCCUPIED.name().equalsIgnoreCase(r.getStayStatus()))
                .count();
        long maintenanceRooms = allNonArchivedRooms.stream()
                .filter(r -> "MAINTENANCE".equalsIgnoreCase(r.getRoomStatus())
                        || "INACTIVE".equalsIgnoreCase(r.getRoomStatus())
                        || "MAINTENANCE".equalsIgnoreCase(r.getCleaningStatus()))
                .count();
        long vacantRooms = Math.max(0, totalRooms - occupiedRooms - maintenanceRooms);
        double currentOccupancyRate = totalRooms > 0
                ? Math.round((occupiedRooms * 10000.0) / totalRooms) / 100.0
                : 0.0;

        List<GuestStay> allStays = guestStayRepository.findAll();
        List<Review> allReviews = reviewRepository.findAll();
        List<Review> publishedReviews = allReviews.stream()
                .filter(r -> !Boolean.TRUE.equals(r.getIsHidden()))
                .toList();

        List<RoomType> roomTypes = roomTypeRepository.findAllByOrderByRoomTypeIdAsc();
        List<ManagementReportResponse.RoomTypeOccupancyItem> occupancyByRoomType = new ArrayList<>();
        long totalPeriodNightsSold = 0;
        long totalPeriodAvailableRoomNights = 0;

        for (RoomType rt : roomTypes) {
            List<Room> rtRooms = allNonArchivedRooms.stream()
                    .filter(r -> r.getRoomType() != null && rt.getRoomTypeId().equals(r.getRoomType().getRoomTypeId()))
                    .toList();
            int rtTotal = rtRooms.size();
            int rtOccupied = (int) rtRooms.stream()
                    .filter(r -> StayStatus.OCCUPIED.name().equalsIgnoreCase(r.getStayStatus()))
                    .count();
            int rtMaint = (int) rtRooms.stream()
                    .filter(r -> "MAINTENANCE".equalsIgnoreCase(r.getRoomStatus())
                            || "INACTIVE".equalsIgnoreCase(r.getRoomStatus()))
                    .count();
            int rtVacant = Math.max(0, rtTotal - rtOccupied - rtMaint);
            double rtCurrentOcc = rtTotal > 0 ? Math.round((rtOccupied * 10000.0) / rtTotal) / 100.0 : 0.0;

            long rtNightsSold = 0;
            for (GuestStay stay : allStays) {
                if ("CANCELLED".equalsIgnoreCase(stay.getStatus())) continue;
                Integer stayRtId = extractRoomTypeIdFromStay(stay);
                if (!rt.getRoomTypeId().equals(stayRtId)) continue;

                LocalDate stayStart = extractStayCheckInDate(stay);
                LocalDate stayEnd = extractStayCheckOutDate(stay, today);
                if (stayStart == null || stayEnd == null) continue;

                LocalDate overlapStart = stayStart.isAfter(finalFrom) ? stayStart : finalFrom;
                LocalDate overlapEnd = stayEnd.isBefore(finalTo.plusDays(1)) ? stayEnd : finalTo.plusDays(1);
                if (overlapStart.isBefore(overlapEnd)) {
                    rtNightsSold += Math.max(1, ChronoUnit.DAYS.between(overlapStart, overlapEnd));
                }
            }

            long rtAvailNights = Math.max(1, (long) Math.max(1, rtTotal - rtMaint) * periodDays);
            double rtPeriodOcc = rtTotal > 0
                    ? Math.min(100.0, Math.round((rtNightsSold * 10000.0) / rtAvailNights) / 100.0)
                    : 0.0;
            BigDecimal basePrice = rt.getBasePrice() != null ? rt.getBasePrice() : BigDecimal.ZERO;
            BigDecimal estRoomRev = basePrice.multiply(BigDecimal.valueOf(rtNightsSold));

            List<Review> rtReviews = publishedReviews.stream()
                    .filter(rev -> rt.getRoomTypeId().equals(extractRoomTypeIdFromStay(rev.getGuestStay())))
                    .toList();
            Double rtAvgRating = rtReviews.isEmpty()
                    ? null
                    : Math.round(rtReviews.stream().mapToInt(Review::getRating).average().orElse(0.0) * 10.0) / 10.0;

            totalPeriodNightsSold += rtNightsSold;
            totalPeriodAvailableRoomNights += (long) rtTotal * periodDays;

            occupancyByRoomType.add(ManagementReportResponse.RoomTypeOccupancyItem.builder()
                    .roomTypeId(rt.getRoomTypeId())
                    .roomTypeName(rt.getTypeName())
                    .basePrice(basePrice)
                    .capacity(rt.getCapacity() != null ? rt.getCapacity() : 2)
                    .totalRooms(rtTotal)
                    .occupiedRooms(rtOccupied)
                    .vacantRooms(rtVacant)
                    .maintenanceRooms(rtMaint)
                    .currentOccupancyPercent(rtCurrentOcc)
                    .nightsSoldInPeriod(rtNightsSold)
                    .availableRoomNightsInPeriod((long) rtTotal * periodDays)
                    .periodOccupancyPercent(rtPeriodOcc)
                    .estimatedRoomRevenue(estRoomRev)
                    .averageRating(rtAvgRating)
                    .reviewCount(rtReviews.size())
                    .build());
        }

        double periodOccupancyRate = totalPeriodAvailableRoomNights > 0
                ? Math.min(100.0, Math.round((totalPeriodNightsSold * 10000.0) / totalPeriodAvailableRoomNights) / 100.0)
                : 0.0;

        // 2. Revenue & Invoice Analytics (UC-46)
        List<Payment> allPayments = paymentRepository.findAll();
        Map<Integer, List<Payment>> paymentsByInvoiceId = allPayments.stream()
                .filter(p -> p.getInvoice() != null && p.getInvoice().getInvoiceId() != null)
                .collect(Collectors.groupingBy(p -> p.getInvoice().getInvoiceId()));
        Map<Integer, List<Payment>> paymentsByReservationId = allPayments.stream()
                .filter(p -> p.getReservation() != null && p.getReservation().getReservationId() != null)
                .collect(Collectors.groupingBy(p -> p.getReservation().getReservationId()));

        List<ServiceOrder> allServiceOrders = serviceOrderRepository.findAll();
        Map<Integer, List<ServiceOrder>> serviceOrdersByStayId = allServiceOrders.stream()
                .filter(o -> o.getGuestStay() != null && o.getGuestStay().getStayId() != null)
                .collect(Collectors.groupingBy(o -> o.getGuestStay().getStayId()));

        List<AdditionalCharge> allAddCharges = additionalChargeRepository.findAll();
        Map<Integer, List<AdditionalCharge>> addChargesByFolioId = allAddCharges.stream()
                .filter(ac -> ac.getFolio() != null && ac.getFolio().getFolioId() != null)
                .collect(Collectors.groupingBy(ac -> ac.getFolio().getFolioId()));

        List<Invoice> paidInvoicesInPeriod = invoiceRepository.findAll().stream()
                .filter(inv -> InvoiceStatus.PAID.name().equalsIgnoreCase(inv.getStatus()))
                .filter(inv -> {
                    LocalDate issueLocal = inv.getIssueDate() != null
                            ? inv.getIssueDate().atZone(HOTEL_ZONE).toLocalDate()
                            : today;
                    return !issueLocal.isBefore(finalFrom) && !issueLocal.isAfter(finalTo);
                })
                .sorted(Comparator.comparing(
                        (Invoice inv) -> inv.getIssueDate() != null ? inv.getIssueDate() : Instant.EPOCH
                ).reversed())
                .toList();

        BigDecimal totalRoomRevenue = BigDecimal.ZERO;
        BigDecimal totalServiceRevenue = BigDecimal.ZERO;
        BigDecimal totalAdditionalRevenue = BigDecimal.ZERO;
        BigDecimal totalDiscountAmount = BigDecimal.ZERO;
        BigDecimal totalTaxAmount = BigDecimal.ZERO;
        BigDecimal totalNetRevenue = BigDecimal.ZERO;
        BigDecimal totalDepositCollected = BigDecimal.ZERO;

        Map<LocalDate, ManagementReportResponse.DailyRevenueItem> dailyMap = new TreeMap<>();
        Map<String, BigDecimal> amountByMethod = new LinkedHashMap<>();
        Map<String, Integer> countByMethod = new LinkedHashMap<>();
        for (String m : List.of("CASH", "VNPAY")) {
            amountByMethod.put(m, BigDecimal.ZERO);
            countByMethod.put(m, 0);
        }

        List<ManagementReportResponse.InvoiceReportItem> invoiceItems = new ArrayList<>();

        for (Invoice inv : paidInvoicesInPeriod) {
            Folio folio = inv.getFolio();
            GuestStay stay = folio != null ? folio.getGuestStay() : null;
            Reservation res = stay != null ? stay.getReservation() : null;

            BigDecimal serviceSub = BigDecimal.ZERO;
            if (stay != null) {
                List<ServiceOrder> stayOrders = serviceOrdersByStayId.getOrDefault(stay.getStayId(), Collections.emptyList());
                for (ServiceOrder so : stayOrders) {
                    if (ServiceOrderStatus.COMPLETED.name().equalsIgnoreCase(so.getStatus())
                            && so.getUnitPrice() != null && so.getQuantity() != null) {
                        serviceSub = serviceSub.add(so.getUnitPrice().multiply(BigDecimal.valueOf(so.getQuantity())));
                    }
                }
            }

            BigDecimal additionalSub = BigDecimal.ZERO;
            if (folio != null) {
                List<AdditionalCharge> charges = addChargesByFolioId.getOrDefault(folio.getFolioId(), Collections.emptyList());
                for (AdditionalCharge ac : charges) {
                    if (!"VOIDED".equalsIgnoreCase(ac.getStatus()) && ac.getAmount() != null) {
                        additionalSub = additionalSub.add(ac.getAmount());
                    }
                }
            }

            BigDecimal invTotalBeforeTax = inv.getTotalAmount() != null ? inv.getTotalAmount() : BigDecimal.ZERO;
            BigDecimal roomSub = invTotalBeforeTax.subtract(serviceSub).subtract(additionalSub);
            if (roomSub.compareTo(BigDecimal.ZERO) < 0) {
                roomSub = BigDecimal.ZERO;
            }

            BigDecimal discount = inv.getDiscountAmount() != null ? inv.getDiscountAmount() : BigDecimal.ZERO;
            BigDecimal tax = inv.getTaxAmount() != null ? inv.getTaxAmount() : BigDecimal.ZERO;
            BigDecimal finalAmt = inv.getFinalAmount() != null ? inv.getFinalAmount() : BigDecimal.ZERO;

            BigDecimal depositDeducted = BigDecimal.ZERO;
            if (res != null) {
                List<Payment> resPayments = paymentsByReservationId.getOrDefault(res.getReservationId(), Collections.emptyList());
                for (Payment rp : resPayments) {
                    if ("DEPOSIT".equalsIgnoreCase(rp.getPaymentType()) && "PAID".equalsIgnoreCase(rp.getStatus()) && rp.getAmount() != null) {
                        depositDeducted = depositDeducted.add(rp.getAmount());
                    }
                }
            }

            // Total actual revenue collected for this stay = finalAmount (settlement) + depositDeducted
            BigDecimal stayActualRevenue = finalAmt.add(depositDeducted);

            List<Payment> invPayments = paymentsByInvoiceId.getOrDefault(inv.getInvoiceId(), Collections.emptyList());
            String paymentMethod = "CASH";
            for (Payment ip : invPayments) {
                if ("PAID".equalsIgnoreCase(ip.getStatus()) && ip.getMethod() != null) {
                    paymentMethod = ip.getMethod().toUpperCase();
                    break;
                }
            }

            amountByMethod.put(paymentMethod, amountByMethod.getOrDefault(paymentMethod, BigDecimal.ZERO).add(stayActualRevenue));
            countByMethod.put(paymentMethod, countByMethod.getOrDefault(paymentMethod, 0) + 1);

            totalRoomRevenue = totalRoomRevenue.add(roomSub);
            totalServiceRevenue = totalServiceRevenue.add(serviceSub);
            totalAdditionalRevenue = totalAdditionalRevenue.add(additionalSub);
            totalDiscountAmount = totalDiscountAmount.add(discount);
            totalTaxAmount = totalTaxAmount.add(tax);
            totalDepositCollected = totalDepositCollected.add(depositDeducted);
            totalNetRevenue = totalNetRevenue.add(stayActualRevenue);

            LocalDate issueDay = inv.getIssueDate() != null
                    ? inv.getIssueDate().atZone(HOTEL_ZONE).toLocalDate()
                    : today;
            ManagementReportResponse.DailyRevenueItem dayItem = dailyMap.computeIfAbsent(issueDay, d ->
                    ManagementReportResponse.DailyRevenueItem.builder()
                            .date(d)
                            .invoiceCount(0)
                            .roomRevenue(BigDecimal.ZERO)
                            .serviceRevenue(BigDecimal.ZERO)
                            .additionalRevenue(BigDecimal.ZERO)
                            .taxAmount(BigDecimal.ZERO)
                            .discountAmount(BigDecimal.ZERO)
                            .netRevenue(BigDecimal.ZERO)
                            .build()
            );
            dayItem.setInvoiceCount(dayItem.getInvoiceCount() + 1);
            dayItem.setRoomRevenue(dayItem.getRoomRevenue().add(roomSub));
            dayItem.setServiceRevenue(dayItem.getServiceRevenue().add(serviceSub));
            dayItem.setAdditionalRevenue(dayItem.getAdditionalRevenue().add(additionalSub));
            dayItem.setTaxAmount(dayItem.getTaxAmount().add(tax));
            dayItem.setDiscountAmount(dayItem.getDiscountAmount().add(discount));
            dayItem.setNetRevenue(dayItem.getNetRevenue().add(stayActualRevenue));

            invoiceItems.add(ManagementReportResponse.InvoiceReportItem.builder()
                    .invoiceId(inv.getInvoiceId())
                    .invoiceCode(inv.getInvoiceCode())
                    .stayId(stay != null ? stay.getStayId() : null)
                    .reservationCode(res != null ? res.getReservationCode() : "N/A")
                    .customerName(extractCustomerNameFromStay(stay))
                    .roomNumber(extractRoomNumberFromStay(stay))
                    .roomTypeName(extractRoomTypeNameFromStay(stay))
                    .roomSubtotal(roomSub)
                    .serviceSubtotal(serviceSub)
                    .additionalSubtotal(additionalSub)
                    .totalAmount(invTotalBeforeTax)
                    .discountAmount(discount)
                    .taxAmount(tax)
                    .depositDeducted(depositDeducted)
                    .finalAmount(stayActualRevenue)
                    .paymentMethod(paymentMethod)
                    .voucherCode(inv.getVoucher() != null ? inv.getVoucher().getCode() : null)
                    .status(inv.getStatus())
                    .issueDate(inv.getIssueDate())
                    .build());
        }

        List<Folio> openFolios = folioRepository.findAll().stream()
                .filter(f -> "OPEN".equalsIgnoreCase(f.getStatus()))
                .toList();
        BigDecimal outstandingFolioBalance = openFolios.stream()
                .map(f -> f.getTotalAmount() != null ? f.getTotalAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<ManagementReportResponse.PaymentMethodBreakdownItem> revenueByPaymentMethod = new ArrayList<>();
        Map<String, String> methodLabels = Map.of(
                "CASH", "Tiền mặt tại quầy",
                "VNPAY", "Cổng thanh toán VNPay",
                "BANK_TRANSFER", "Chuyển khoản Ngân hàng",
                "CREDIT_CARD", "Thẻ tín dụng / POS"
        );
        for (Map.Entry<String, BigDecimal> entry : amountByMethod.entrySet()) {
            String method = entry.getKey();
            BigDecimal amt = entry.getValue();
            int cnt = countByMethod.getOrDefault(method, 0);
            double pct = totalNetRevenue.compareTo(BigDecimal.ZERO) > 0
                    ? amt.multiply(BigDecimal.valueOf(10000)).divide(totalNetRevenue, 0, RoundingMode.HALF_UP).doubleValue() / 100.0
                    : 0.0;
            revenueByPaymentMethod.add(ManagementReportResponse.PaymentMethodBreakdownItem.builder()
                    .paymentMethod(method)
                    .label(methodLabels.getOrDefault(method, method))
                    .transactionCount(cnt)
                    .totalAmount(amt)
                    .sharePercent(pct)
                    .build());
        }

        // 3. Service Consumption Analytics (UC-47)
        List<HotelService> allCatalogServices = hotelServiceRepository.findAll();
        int activeServicesCount = (int) allCatalogServices.stream()
                .filter(s -> "ACTIVE".equalsIgnoreCase(s.getStatus()))
                .count();

        List<ServiceOrder> ordersInPeriod = allServiceOrders.stream()
                .filter(o -> {
                    LocalDate orderLocal = o.getOrderTime() != null
                            ? o.getOrderTime().atZone(HOTEL_ZONE).toLocalDate()
                            : today;
                    return !orderLocal.isBefore(finalFrom) && !orderLocal.isAfter(finalTo);
                })
                .toList();

        int completedOrdersCount = (int) ordersInPeriod.stream()
                .filter(o -> ServiceOrderStatus.COMPLETED.name().equalsIgnoreCase(o.getStatus()))
                .count();
        int voidedOrdersCount = (int) ordersInPeriod.stream()
                .filter(o -> ServiceOrderStatus.VOIDED.name().equalsIgnoreCase(o.getStatus()))
                .count();

        List<ServiceOrder> completedOrdersInPeriod = ordersInPeriod.stream()
                .filter(o -> ServiceOrderStatus.COMPLETED.name().equalsIgnoreCase(o.getStatus()))
                .toList();

        BigDecimal totalCompletedServiceRevenue = completedOrdersInPeriod.stream()
                .map(o -> (o.getUnitPrice() != null ? o.getUnitPrice() : BigDecimal.ZERO)
                        .multiply(BigDecimal.valueOf(o.getQuantity() != null ? o.getQuantity() : 0)))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int totalServiceUnitsSold = completedOrdersInPeriod.stream()
                .mapToInt(o -> o.getQuantity() != null ? o.getQuantity() : 0)
                .sum();

        List<ManagementReportResponse.ServiceConsumptionItem> serviceConsumptionRanking = new ArrayList<>();
        for (HotelService svc : allCatalogServices) {
            List<ServiceOrder> svcOrders = completedOrdersInPeriod.stream()
                    .filter(o -> o.getHotelService() != null && svc.getServiceId().equals(o.getHotelService().getServiceId()))
                    .toList();
            int ordersCnt = svcOrders.size();
            int qtySum = svcOrders.stream().mapToInt(o -> o.getQuantity() != null ? o.getQuantity() : 0).sum();
            BigDecimal revSum = svcOrders.stream()
                    .map(o -> (o.getUnitPrice() != null ? o.getUnitPrice() : BigDecimal.ZERO)
                            .multiply(BigDecimal.valueOf(o.getQuantity() != null ? o.getQuantity() : 0)))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            double sharePct = totalCompletedServiceRevenue.compareTo(BigDecimal.ZERO) > 0
                    ? revSum.multiply(BigDecimal.valueOf(10000)).divide(totalCompletedServiceRevenue, 0, RoundingMode.HALF_UP).doubleValue() / 100.0
                    : 0.0;

            serviceConsumptionRanking.add(ManagementReportResponse.ServiceConsumptionItem.builder()
                    .serviceId(svc.getServiceId())
                    .serviceName(svc.getServiceName())
                    .category(svc.getCategory())
                    .billingUnit(svc.getBillingUnit())
                    .unitPrice(svc.getUnitPrice())
                    .ordersCount(ordersCnt)
                    .totalQuantity(qtySum)
                    .totalRevenue(revSum)
                    .revenueSharePercent(sharePct)
                    .build());
        }

        serviceConsumptionRanking.sort(Comparator
                .comparing(ManagementReportResponse.ServiceConsumptionItem::getTotalRevenue, Comparator.reverseOrder())
                .thenComparing(ManagementReportResponse.ServiceConsumptionItem::getTotalQuantity, Comparator.reverseOrder()));

        Map<String, String> categoryLabels = Map.of(
                "F&B", "Ẩm thực & Nhà hàng (F&B)",
                "SPA", "Spa & Chăm sóc sức khỏe",
                "LAUNDRY", "Giặt ủi cao cấp (Laundry)",
                "TRANSPORT", "Đưa đón & Vận chuyển",
                "MINIBAR", "Minibar tại phòng",
                "OTHER", "Tiện ích & Dịch vụ khác"
        );
        Map<String, List<ManagementReportResponse.ServiceConsumptionItem>> byCat = serviceConsumptionRanking.stream()
                .collect(Collectors.groupingBy(item -> item.getCategory() != null ? item.getCategory().toUpperCase() : "OTHER"));

        List<ManagementReportResponse.ServiceCategoryBreakdownItem> serviceByCategory = new ArrayList<>();
        for (Map.Entry<String, List<ManagementReportResponse.ServiceConsumptionItem>> entry : byCat.entrySet()) {
            String cat = entry.getKey();
            List<ManagementReportResponse.ServiceConsumptionItem> items = entry.getValue();
            int ordCnt = items.stream().mapToInt(ManagementReportResponse.ServiceConsumptionItem::getOrdersCount).sum();
            int qtyCnt = items.stream().mapToInt(ManagementReportResponse.ServiceConsumptionItem::getTotalQuantity).sum();
            BigDecimal catRev = items.stream()
                    .map(ManagementReportResponse.ServiceConsumptionItem::getTotalRevenue)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            double sharePct = totalCompletedServiceRevenue.compareTo(BigDecimal.ZERO) > 0
                    ? catRev.multiply(BigDecimal.valueOf(10000)).divide(totalCompletedServiceRevenue, 0, RoundingMode.HALF_UP).doubleValue() / 100.0
                    : 0.0;

            serviceByCategory.add(ManagementReportResponse.ServiceCategoryBreakdownItem.builder()
                    .category(cat)
                    .label(categoryLabels.getOrDefault(cat, cat))
                    .servicesCount(items.size())
                    .ordersCount(ordCnt)
                    .totalQuantity(qtyCnt)
                    .totalRevenue(catRev)
                    .sharePercent(sharePct)
                    .build());
        }
        serviceByCategory.sort(Comparator.comparing(ManagementReportResponse.ServiceCategoryBreakdownItem::getTotalRevenue, Comparator.reverseOrder()));

        // 4. Guest Reviews Summary (UC-42..44)
        double avgRating = publishedReviews.isEmpty()
                ? 0.0
                : Math.round(publishedReviews.stream().mapToInt(Review::getRating).average().orElse(0.0) * 10.0) / 10.0;
        int repliedCount = (int) allReviews.stream()
                .filter(r -> r.getManagementReply() != null && !r.getManagementReply().isBlank())
                .count();
        Map<Integer, Integer> ratingDist = new LinkedHashMap<>();
        for (int star = 5; star >= 1; star--) {
            final int s = star;
            int cnt = (int) publishedReviews.stream().filter(r -> r.getRating() != null && r.getRating() == s).count();
            ratingDist.put(star, cnt);
        }

        ManagementReportResponse response = ManagementReportResponse.builder()
                .fromDate(finalFrom)
                .toDate(finalTo)
                .periodDays(periodDays)
                .totalRooms(totalRooms)
                .occupiedRooms(occupiedRooms)
                .vacantRooms(vacantRooms)
                .maintenanceRooms(maintenanceRooms)
                .currentOccupancyRate(currentOccupancyRate)
                .periodRoomNightsSold(totalPeriodNightsSold)
                .periodAvailableRoomNights(totalPeriodAvailableRoomNights)
                .periodOccupancyRate(periodOccupancyRate)
                .occupancyByRoomType(occupancyByRoomType)
                .paidInvoicesCount(paidInvoicesInPeriod.size())
                .openFoliosCount(openFolios.size())
                .totalRoomRevenue(totalRoomRevenue)
                .totalServiceRevenue(totalServiceRevenue)
                .totalAdditionalRevenue(totalAdditionalRevenue)
                .totalSubtotalBeforeTax(totalRoomRevenue.add(totalServiceRevenue).add(totalAdditionalRevenue))
                .totalDiscountAmount(totalDiscountAmount)
                .totalTaxAmount(totalTaxAmount)
                .totalNetRevenue(totalNetRevenue)
                .totalDepositCollected(totalDepositCollected)
                .outstandingFolioBalance(outstandingFolioBalance)
                .revenueByPaymentMethod(revenueByPaymentMethod)
                .revenueByDate(new ArrayList<>(dailyMap.values()))
                .invoices(invoiceItems)
                .activeServicesCount(activeServicesCount)
                .completedServiceOrdersCount(completedOrdersCount)
                .voidedServiceOrdersCount(voidedOrdersCount)
                .totalServiceUnitsSold(totalServiceUnitsSold)
                .serviceConsumptionRanking(serviceConsumptionRanking)
                .serviceByCategory(serviceByCategory)
                .averageRating(avgRating)
                .totalReviewsCount(allReviews.size())
                .publishedReviewsCount(publishedReviews.size())
                .hiddenReviewsCount(allReviews.size() - publishedReviews.size())
                .repliedReviewsCount(repliedCount)
                .ratingDistribution(ratingDist)
                .build();

        return ResponseEntity.ok(response);
    }

    @GetMapping("/reports/summary")
    @PreAuthorize("hasAnyRole('GENERAL_MANAGER', 'ACCOUNTANT', 'SALES_MANAGER', 'SERVICE_MANAGER', 'FRONT_DESK', 'ADMIN')")
    @Transactional(readOnly = true)
    @Operation(summary = "UC-45, UC-46, UC-47 & UC-50: Generate occupancy, revenue, and service analytics summary")
    public ResponseEntity<RevenueReportDto> getDashboardAnalyticsSummary() {
        var activeRooms = roomRepository.findByRoomStatusNot(RoomStatus.ARCHIVED.name());
        long totalRooms = activeRooms.size();
        long occupiedRooms = activeRooms.stream()
                .filter(r -> StayStatus.OCCUPIED.name().equalsIgnoreCase(r.getStayStatus()))
                .count();
        double occupancyPct = totalRooms > 0 ? Math.round((occupiedRooms * 10000.0) / totalRooms) / 100.0 : 0.0;

        List<Invoice> paidInvoices = invoiceRepository.findAll().stream()
                .filter(inv -> InvoiceStatus.PAID.name().equalsIgnoreCase(inv.getStatus()))
                .toList();

        BigDecimal totalRevenue = paidInvoices.stream()
                .map(Invoice::getFinalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return ResponseEntity.ok(RevenueReportDto.builder()
                .totalRooms(totalRooms)
                .occupiedRooms(occupiedRooms)
                .occupancyPercentage(occupancyPct)
                .paidInvoicesCount(paidInvoices.size())
                .totalSettledRevenue(totalRevenue)
                .activeServicesCount(hotelServiceRepository.findByStatus("ACTIVE").size())
                .build());
    }

    // =========================================================================
    // HELPER MAPPERS
    // =========================================================================

    private ReviewDto toReviewDto(Review rev) {
        GuestStay stay = rev.getGuestStay();
        Reservation res = stay != null ? stay.getReservation() : null;
        Customer cust = rev.getCustomer();

        String customerName = (res != null && res.getContactName() != null && !res.getContactName().isBlank())
                ? res.getContactName()
                : (cust != null && cust.getFullName() != null ? cust.getFullName() : "Khách lưu trú xác thực");
        String customerEmail = (res != null && res.getContactEmail() != null && !res.getContactEmail().isBlank())
                ? res.getContactEmail()
                : (cust != null ? cust.getEmail() : null);

        Room assignedRoom = extractLatestRoomFromStay(stay);
        RoomType roomType = assignedRoom != null ? assignedRoom.getRoomType() : extractRoomTypeFromReservation(res);

        return ReviewDto.builder()
                .reviewId(rev.getReviewId())
                .stayId(stay != null ? stay.getStayId() : null)
                .reservationId(res != null ? res.getReservationId() : null)
                .reservationCode(res != null ? res.getReservationCode() : null)
                .roomId(assignedRoom != null ? assignedRoom.getRoomId() : null)
                .roomNumber(assignedRoom != null ? assignedRoom.getRoomNumber() : null)
                .roomTypeId(roomType != null ? roomType.getRoomTypeId() : null)
                .roomTypeName(roomType != null ? roomType.getTypeName() : "Phòng tiêu chuẩn HMS")
                .roomImageUrl(roomType != null ? roomType.getImageUrl() : null)
                .customerId(cust != null ? cust.getCustomerId() : null)
                .customerName(customerName)
                .customerEmail(customerEmail)
                .rating(rev.getRating())
                .comment(rev.getComment())
                .reviewDate(rev.getReviewDate())
                .isHidden(Boolean.TRUE.equals(rev.getIsHidden()))
                .hiddenReason(rev.getHiddenReason())
                .managementReply(rev.getManagementReply())
                .repliedAt(rev.getRepliedAt())
                .checkInDate(res != null ? res.getCheckInDate() : null)
                .checkOutDate(res != null ? res.getCheckOutDate() : null)
                .actualCheckIn(stay != null ? stay.getActualCheckIn() : null)
                .actualCheckOut(stay != null ? stay.getActualCheckOut() : null)
                .stayStatus(stay != null ? stay.getStatus() : null)
                .build();
    }

    private CustomerStayReviewCandidateDto toStayCandidateDto(GuestStay stay, Review existingReview) {
        Reservation res = stay.getReservation();
        Room assignedRoom = extractLatestRoomFromStay(stay);
        RoomType roomType = assignedRoom != null ? assignedRoom.getRoomType() : extractRoomTypeFromReservation(res);

        LocalDate checkIn = extractStayCheckInDate(stay);
        LocalDate checkOut = extractStayCheckOutDate(stay, LocalDate.now(HOTEL_ZONE));
        long nights = (checkIn != null && checkOut != null)
                ? Math.max(1, ChronoUnit.DAYS.between(checkIn, checkOut))
                : 1;

        boolean completed = "COMPLETED".equalsIgnoreCase(stay.getStatus())
                || "CHECKED_OUT".equalsIgnoreCase(stay.getStatus())
                || (res != null && "COMPLETED".equalsIgnoreCase(res.getStatus()));

        return CustomerStayReviewCandidateDto.builder()
                .stayId(stay.getStayId())
                .reservationId(res != null ? res.getReservationId() : null)
                .reservationCode(res != null ? res.getReservationCode() : ("STAY-" + stay.getStayId()))
                .roomId(assignedRoom != null ? assignedRoom.getRoomId() : null)
                .roomNumber(assignedRoom != null ? assignedRoom.getRoomNumber() : "N/A")
                .roomTypeId(roomType != null ? roomType.getRoomTypeId() : null)
                .roomTypeName(roomType != null ? roomType.getTypeName() : "Phòng tiêu chuẩn HMS")
                .roomImageUrl(roomType != null ? roomType.getImageUrl() : null)
                .checkInDate(checkIn)
                .checkOutDate(checkOut)
                .actualCheckIn(stay.getActualCheckIn())
                .actualCheckOut(stay.getActualCheckOut())
                .nights(nights)
                .stayStatus(stay.getStatus())
                .canReview(completed && existingReview == null)
                .existingReview(existingReview != null ? toReviewDto(existingReview) : null)
                .build();
    }

    private Room extractLatestRoomFromStay(GuestStay stay) {
        if (stay == null || stay.getRoomAssignments() == null || stay.getRoomAssignments().isEmpty()) {
            return null;
        }
        List<StayRoomAssignment> assignments = stay.getRoomAssignments();
        return assignments.get(assignments.size() - 1).getRoom();
    }

    private RoomType extractRoomTypeFromReservation(Reservation res) {
        if (res == null || res.getDetails() == null || res.getDetails().isEmpty()) {
            return null;
        }
        return res.getDetails().get(0).getRoomType();
    }

    private Integer extractRoomTypeIdFromStay(GuestStay stay) {
        Room room = extractLatestRoomFromStay(stay);
        if (room != null && room.getRoomType() != null) {
            return room.getRoomType().getRoomTypeId();
        }
        if (stay != null && stay.getReservation() != null) {
            RoomType rt = extractRoomTypeFromReservation(stay.getReservation());
            if (rt != null) return rt.getRoomTypeId();
        }
        return null;
    }

    private String extractRoomNumberFromStay(GuestStay stay) {
        Room room = extractLatestRoomFromStay(stay);
        return room != null ? room.getRoomNumber() : "N/A";
    }

    private String extractRoomTypeNameFromStay(GuestStay stay) {
        Room room = extractLatestRoomFromStay(stay);
        if (room != null && room.getRoomType() != null) {
            return room.getRoomType().getTypeName();
        }
        if (stay != null && stay.getReservation() != null) {
            RoomType rt = extractRoomTypeFromReservation(stay.getReservation());
            if (rt != null) return rt.getTypeName();
        }
        return "Phòng tiêu chuẩn";
    }

    private String extractCustomerNameFromStay(GuestStay stay) {
        if (stay == null || stay.getReservation() == null) return "Khách lưu trú";
        Reservation res = stay.getReservation();
        if (res.getContactName() != null && !res.getContactName().isBlank()) {
            return res.getContactName();
        }
        if (res.getCustomer() != null && res.getCustomer().getFullName() != null) {
            return res.getCustomer().getFullName();
        }
        return "Khách lưu trú";
    }

    private LocalDate extractStayCheckInDate(GuestStay stay) {
        if (stay == null) return null;
        if (stay.getActualCheckIn() != null) {
            return stay.getActualCheckIn().atZone(HOTEL_ZONE).toLocalDate();
        }
        return stay.getReservation() != null ? stay.getReservation().getCheckInDate() : null;
    }

    private LocalDate extractStayCheckOutDate(GuestStay stay, LocalDate fallbackToday) {
        if (stay == null) return null;
        if (stay.getActualCheckOut() != null) {
            return stay.getActualCheckOut().atZone(HOTEL_ZONE).toLocalDate();
        }
        if (stay.getReservation() != null && stay.getReservation().getCheckOutDate() != null) {
            return stay.getReservation().getCheckOutDate();
        }
        return fallbackToday;
    }
}
