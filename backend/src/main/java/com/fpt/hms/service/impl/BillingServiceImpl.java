package com.fpt.hms.service.impl;

import com.fpt.hms.common.MessageResolver;
import com.fpt.hms.dto.billing_report.*;
import com.fpt.hms.dto.booking.ReservationDto;
import com.fpt.hms.entity.*;
import com.fpt.hms.enums.*;
import com.fpt.hms.enums.GuestStayStatus;
import com.fpt.hms.enums.InvoiceStatus;
import com.fpt.hms.enums.PaymentStatus;
import com.fpt.hms.enums.ServiceOrderStatus;
import com.fpt.hms.exception.BusinessException;
import com.fpt.hms.exception.ResourceNotFoundException;
import com.fpt.hms.integration.VnPayGatewayService;
import com.fpt.hms.repository.*;
import com.fpt.hms.service.BillingService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.UUID;

/**
 * Module 4 (Owner: LinhNH) - Ancillary Services & Folio Billing Service (UC-31 to UC-40).
 */
@Service
@RequiredArgsConstructor
public class BillingServiceImpl implements BillingService {

    private static final String SERVICE_ACTIVE = "ACTIVE";
    private static final String SERVICE_INACTIVE = "INACTIVE";
    private static final String FOLIO_CLOSED = "CLOSED";

    @Value("${app.vnpay.tmn-code:GCS1874X}")
    private String vnpTmnCode;

    @Value("${app.vnpay.hash-secret:CAJSNWRIUUYNJWPIPCRAHLAJXNRZASAB}")
    private String vnpHashSecret;

    @Value("${app.vnpay.pay-url:https://sandbox.vnpayment.vn/paymentv2/vpcpay.html}")
    private String vnpPayUrl;

    @Value("${app.vnpay.billing-return-url:http://localhost:5173/staff/services-billing/vnpay-callback}")
    private String vnpBillingReturnUrl;

    private final HotelServiceRepository hotelServiceRepository;
    private final GuestStayRepository guestStayRepository;
    private final ServiceOrderRepository serviceOrderRepository;
    private final FolioRepository folioRepository;
    private final VoucherRepository voucherRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentAttemptRepository paymentAttemptRepository;
    private final StaffRepository staffRepository;
    private final ReservationRepository reservationRepository;
    private final CustomerRepository customerRepository;
    private final AdditionalChargeRepository additionalChargeRepository;
    private final AccountRepository accountRepository;
    private final RoomTypePriceRepository roomTypePriceRepository;
    private final MessageResolver messageResolver;
    private final VnPayGatewayService vnPayGatewayService;

    // ------------------------------------------------------------------ UC-31..34

    @Override
    @Transactional(readOnly = true)
    public List<HotelService> getActiveServices() {
        return hotelServiceRepository.findByStatus(SERVICE_ACTIVE);
    }

    @Override
    @Transactional(readOnly = true)
    public List<HotelService> getAllServices() {
        return hotelServiceRepository.findAll(Sort.by("category", "serviceName"));
    }

    @Override
    @Transactional
    public HotelService createService(HotelServiceRequest request) {
        HotelService service = HotelService.builder()
                .serviceName(request.getServiceName().trim())
                .category(request.getCategory().trim().toUpperCase())
                .billingUnit(request.getBillingUnit().trim().toUpperCase())
                .unitPrice(request.getUnitPrice())
                .description(request.getDescription())
                .status(SERVICE_ACTIVE)
                .build();
        return hotelServiceRepository.save(service);
    }

    @Override
    @Transactional
    public HotelService updateService(Integer serviceId, HotelServiceRequest request) {
        HotelService service = findService(serviceId);
        // BR-27: existing ServiceOrder rows keep their own snapshot unit_price, so a price change only affects new orders.
        service.setServiceName(request.getServiceName().trim());
        service.setCategory(request.getCategory().trim().toUpperCase());
        service.setBillingUnit(request.getBillingUnit().trim().toUpperCase());
        service.setUnitPrice(request.getUnitPrice());
        service.setDescription(request.getDescription());
        return hotelServiceRepository.save(service);
    }

    @Override
    @Transactional
    public HotelService updateServiceStatus(Integer serviceId, String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if (!SERVICE_ACTIVE.equals(normalized) && !SERVICE_INACTIVE.equals(normalized)) {
            throw new BusinessException("INVALID_SERVICE_STATUS", "Trạng thái dịch vụ chỉ được là ACTIVE hoặc INACTIVE.");
        }
        HotelService service = findService(serviceId);
        service.setStatus(normalized);
        return hotelServiceRepository.save(service);
    }

    // ------------------------------------------------------------------ UC-35 / UC-36

    @Override
    @Transactional
    public List<com.fpt.hms.dto.billing_report.ActiveStaySelectDto> getActiveStaysForSelect() {
        return getActiveStaysForSelect(null, null);
    }

    @Override
    @Transactional
    public List<com.fpt.hms.dto.billing_report.ActiveStaySelectDto> getActiveStaysForSelect(Integer callerAccountId, String callerRole) {
        boolean isCustomer = "CUSTOMER".equalsIgnoreCase(callerRole);
        return guestStayRepository.findByStatus(GuestStayStatus.ACTIVE.name()).stream()
                .filter(stay -> !isCustomer || isStayOwner(stay, callerAccountId))
                .map(stay -> {
                    String roomNumber = "Chưa gán phòng";
                    if (stay.getRoomAssignments() != null && !stay.getRoomAssignments().isEmpty()) {
                        roomNumber = stay.getRoomAssignments().get(stay.getRoomAssignments().size() - 1)
                                .getRoom().getRoomNumber();
                    }
                    String guestName = "Khách vãng lai";
                    String resCode = "";
                    Integer resId = null;
                    LocalDate checkInDate = null;
                    LocalDate checkOutDate = null;
                    String phoneNumber = null;

                    if (stay.getReservation() != null) {
                        resId = stay.getReservation().getReservationId();
                        resCode = stay.getReservation().getReservationCode();
                        checkInDate = stay.getReservation().getCheckInDate();
                        checkOutDate = stay.getReservation().getCheckOutDate();
                        phoneNumber = stay.getReservation().getContactPhone();
                        if (stay.getReservation().getContactName() != null) {
                            guestName = stay.getReservation().getContactName();
                        } else if (stay.getReservation().getCustomer() != null) {
                            guestName = stay.getReservation().getCustomer().getFullName();
                            if (phoneNumber == null || phoneNumber.isBlank()) {
                                phoneNumber = stay.getReservation().getCustomer().getPhone();
                            }
                        }
                    }

                    if (checkInDate == null && stay.getActualCheckIn() != null) {
                        checkInDate = stay.getActualCheckIn().atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate();
                    }
                    if (checkOutDate == null && stay.getActualCheckOut() != null) {
                        checkOutDate = stay.getActualCheckOut().atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate();
                    } else if (checkOutDate == null && checkInDate != null) {
                        checkOutDate = checkInDate.plusDays(1);
                    }

                    Folio stayFolio = folioRepository.findByGuestStay_StayId(stay.getStayId()).orElse(null);
                    String folioStatus = stayFolio != null ? stayFolio.getStatus() : "OPEN";
                    BigDecimal totalAmount;

                    if (stayFolio != null && FOLIO_CLOSED.equalsIgnoreCase(stayFolio.getStatus())) {
                        Invoice inv = invoiceRepository.findByFolio_FolioId(stayFolio.getFolioId()).orElse(null);
                        BigDecimal currentSubtotal = calculateEstimatedStaySubtotal(stay, stayFolio, checkInDate, checkOutDate);
                        if (inv != null && inv.getTotalAmount() != null && currentSubtotal.compareTo(inv.getTotalAmount()) > 0) {
                            // Phòng đã quyết toán nhưng Thành viên 4 vừa gia hạn thêm ngày hoặc phát sinh thêm chi phí
                            stayFolio.setStatus("OPEN");
                            folioStatus = "OPEN";
                            BigDecimal reopenedBalance = calculateEstimatedStayBalance(stay, stayFolio, checkInDate, checkOutDate);
                            stayFolio.setTotalAmount(reopenedBalance);
                            folioRepository.save(stayFolio);
                            totalAmount = reopenedBalance;
                        } else {
                            // Đồng bộ dư nợ Folio về 0 để bên Thành viên 4 Check-out không bị chặn
                            if (stayFolio.getTotalAmount() != null && stayFolio.getTotalAmount().compareTo(BigDecimal.ZERO) > 0) {
                                stayFolio.setTotalAmount(BigDecimal.ZERO);
                                folioRepository.save(stayFolio);
                            }
                            totalAmount = BigDecimal.ZERO;
                        }
                    } else {
                        BigDecimal estimatedBalance = calculateEstimatedStayBalance(stay, stayFolio, checkInDate, checkOutDate);
                        if (stayFolio != null && (stayFolio.getTotalAmount() == null || stayFolio.getTotalAmount().compareTo(estimatedBalance) != 0)) {
                            stayFolio.setTotalAmount(estimatedBalance);
                            folioRepository.save(stayFolio);
                        }
                        totalAmount = estimatedBalance;
                    }

                    return com.fpt.hms.dto.billing_report.ActiveStaySelectDto.builder()
                            .stayId(stay.getStayId())
                            .reservationId(resId)
                            .roomNumber(roomNumber)
                            .guestName(guestName)
                            .reservationCode(resCode)
                            .checkInDate(checkInDate)
                            .checkOutDate(checkOutDate)
                            .actualCheckIn(stay.getActualCheckIn())
                            .actualCheckOut(stay.getActualCheckOut())
                            .phoneNumber(phoneNumber)
                            .folioStatus(folioStatus)
                            .totalAmount(totalAmount)
                            .specialNotes(stay.getReservation() != null ? stay.getReservation().getSpecialNotes() : null)
                            .build();
                })
                .toList();
    }

    private BigDecimal calculateEstimatedStaySubtotal(GuestStay stay, Folio stayFolio, LocalDate checkInDate, LocalDate checkOutDate) {
        List<RoomNightItemDto> nights = buildSynchronizedRoomNights(stay, stay.getReservation(), checkInDate, checkOutDate, "N/A");
        BigDecimal roomSubtotal = nights.stream()
                .map(RoomNightItemDto::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Add completed services
        List<ServiceOrder> orders = serviceOrderRepository.findByGuestStay_StayIdOrderByOrderTimeDesc(stay.getStayId());
        BigDecimal serviceSubtotal = orders.stream()
                .filter(o -> ServiceOrderStatus.COMPLETED.name().equalsIgnoreCase(o.getStatus()))
                .map(o -> o.getUnitPrice().multiply(BigDecimal.valueOf(o.getQuantity() != null ? o.getQuantity() : 1)))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Add additional charges (including auto-synced room transfer / upgrade surcharges from Stay_Room_Assignment)
        BigDecimal additionalSubtotal = BigDecimal.ZERO;
        if (stayFolio != null) {
            syncRoomTransferCharges(stay, stayFolio);
            additionalSubtotal = additionalChargeRepository.findByFolio_FolioId(stayFolio.getFolioId()).stream()
                    .filter(c -> !"CANCELLED".equalsIgnoreCase(c.getStatus()) && !"VOID".equalsIgnoreCase(c.getStatus()))
                    .map(AdditionalCharge::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        return roomSubtotal.add(serviceSubtotal).add(additionalSubtotal);
    }

    /**
     * Đồng bộ tự động khoản phụ thu đổi phòng / nâng hạng phòng từ lịch sử Stay_Room_Assignment của Thành viên 4 vào bảng Additional_Charge của Folio.
     */
    private void syncRoomTransferCharges(GuestStay stay, Folio folio) {
        if (stay == null || folio == null || folio.getFolioId() == null) {
            return;
        }
        List<StayRoomAssignment> assignments = stay.getRoomAssignments();
        if (assignments == null || assignments.size() < 2) {
            return;
        }

        List<AdditionalCharge> existingCharges = new ArrayList<>(additionalChargeRepository.findByFolio_FolioId(folio.getFolioId()));
        Account creatorAccount = null;

        for (int i = 0; i < assignments.size() - 1; i++) {
            StayRoomAssignment prevAssign = assignments.get(i);
            StayRoomAssignment nextAssign = assignments.get(i + 1);
            if (prevAssign == null || nextAssign == null || nextAssign.getAssignmentId() == null) {
                continue;
            }

            Room oldRoom = prevAssign.getRoom();
            Room newRoom = nextAssign.getRoom();
            BigDecimal oldPrice = (oldRoom != null && oldRoom.getRoomType() != null && oldRoom.getRoomType().getBasePrice() != null)
                    ? oldRoom.getRoomType().getBasePrice()
                    : BigDecimal.ZERO;
            BigDecimal newPrice = (newRoom != null && newRoom.getRoomType() != null && newRoom.getRoomType().getBasePrice() != null)
                    ? newRoom.getRoomType().getBasePrice()
                    : BigDecimal.ZERO;

            BigDecimal upgradeSurcharge = newPrice.subtract(oldPrice).setScale(0, RoundingMode.HALF_UP);
            if (upgradeSurcharge.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            String markerTag = "[ĐP#" + nextAssign.getAssignmentId() + "]";
            boolean alreadySynced = existingCharges.stream()
                    .anyMatch(c -> c.getDescription() != null && c.getDescription().contains(markerTag));
            if (alreadySynced) {
                continue;
            }

            if (creatorAccount == null) {
                creatorAccount = accountRepository.findAll(Sort.by(Sort.Direction.ASC, "accountId"))
                        .stream()
                        .findFirst()
                        .orElse(null);
                if (creatorAccount == null) {
                    return;
                }
            }

            String oldRoomNum = oldRoom != null && oldRoom.getRoomNumber() != null ? oldRoom.getRoomNumber() : "N/A";
            String oldTypeName = (oldRoom != null && oldRoom.getRoomType() != null && oldRoom.getRoomType().getTypeName() != null)
                    ? oldRoom.getRoomType().getTypeName() : "Tiêu chuẩn";
            String newRoomNum = newRoom != null && newRoom.getRoomNumber() != null ? newRoom.getRoomNumber() : "N/A";
            String newTypeName = (newRoom != null && newRoom.getRoomType() != null && newRoom.getRoomType().getTypeName() != null)
                    ? newRoom.getRoomType().getTypeName() : "Nâng hạng";
            String reasonSuffix = (prevAssign.getTransferReason() != null && !prevAssign.getTransferReason().isBlank())
                    ? " — Lý do: " + prevAssign.getTransferReason().trim()
                    : "";

            String desc = "Phụ thu đổi/nâng hạng phòng từ P." + oldRoomNum + " (" + oldTypeName + ") sang P."
                    + newRoomNum + " (" + newTypeName + ")" + reasonSuffix + " " + markerTag;

            AdditionalCharge autoCharge = AdditionalCharge.builder()
                    .folio(folio)
                    .createdByAccount(creatorAccount)
                    .chargeType("ROOM_UPGRADE")
                    .description(desc)
                    .amount(upgradeSurcharge)
                    .createdAt(nextAssign.getAssignedFrom() != null ? nextAssign.getAssignedFrom() : Instant.now())
                    .status("ACTIVE")
                    .build();

            AdditionalCharge savedCharge = additionalChargeRepository.saveAndFlush(autoCharge);
            existingCharges.add(savedCharge);
        }
    }

    private BigDecimal calculateEstimatedStayTotal(GuestStay stay, Folio stayFolio, LocalDate checkInDate, LocalDate checkOutDate) {
        BigDecimal subtotal = calculateEstimatedStaySubtotal(stay, stayFolio, checkInDate, checkOutDate);
        BigDecimal tax = subtotal.multiply(new BigDecimal("0.08")).setScale(0, RoundingMode.HALF_UP);
        return subtotal.add(tax);
    }

    private BigDecimal calculateEstimatedStayBalance(GuestStay stay, Folio stayFolio, LocalDate checkInDate, LocalDate checkOutDate) {
        BigDecimal estimatedGross = calculateEstimatedStayTotal(stay, stayFolio, checkInDate, checkOutDate);
        BigDecimal depositPaid = BigDecimal.ZERO;
        Reservation res = stay != null ? stay.getReservation() : null;
        if (res != null && res.getReservationId() != null) {
            Invoice inv = (stayFolio != null && stayFolio.getFolioId() != null)
                    ? invoiceRepository.findByFolio_FolioId(stayFolio.getFolioId()).orElse(null)
                    : null;
            boolean isReopenedFolio = stayFolio == null || !FOLIO_CLOSED.equalsIgnoreCase(stayFolio.getStatus());
            depositPaid = paymentRepository.findByReservation_ReservationId(res.getReservationId()).stream()
                    .filter(p -> PaymentStatus.PAID.name().equalsIgnoreCase(p.getStatus())
                            && ("DEPOSIT".equalsIgnoreCase(p.getPaymentType())
                            || (isReopenedFolio && "SETTLEMENT".equalsIgnoreCase(p.getPaymentType())
                                    && p.getInvoice() != null && inv != null && inv.getInvoiceId().equals(p.getInvoice().getInvoiceId()))))
                    .map(Payment::getAmount)
                    .filter(java.util.Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }
        return estimatedGross.subtract(depositPaid).max(BigDecimal.ZERO).setScale(0, RoundingMode.HALF_UP);
    }

    /**
     * Đồng bộ chi tiết từng đêm lưu trú từ checkInDate đến checkOutDate mới nhất (kể cả khi Thành viên 4 gia hạn lưu trú hoặc đổi phòng).
     */
    private List<RoomNightItemDto> buildSynchronizedRoomNights(
            GuestStay stay, Reservation res, LocalDate checkInDate, LocalDate checkOutDate, String fallbackRoomTypeName) {
        Room currentRoom = null;
        if (stay != null && stay.getRoomAssignments() != null && !stay.getRoomAssignments().isEmpty()) {
            currentRoom = stay.getRoomAssignments().get(stay.getRoomAssignments().size() - 1).getRoom();
        }
        RoomType currentRoomType = (currentRoom != null) ? currentRoom.getRoomType() : null;
        if (currentRoomType == null && res != null && res.getDetails() != null && !res.getDetails().isEmpty()) {
            currentRoomType = res.getDetails().get(0).getRoomType();
        }

        String roomTypeName = (currentRoomType != null && currentRoomType.getTypeName() != null)
                ? currentRoomType.getTypeName()
                : (fallbackRoomTypeName != null ? fallbackRoomTypeName : "N/A");
        BigDecimal basePrice = (currentRoomType != null && currentRoomType.getBasePrice() != null)
                ? currentRoomType.getBasePrice()
                : BigDecimal.valueOf(500000);

        // Load bảng giá theo thứ trong tuần từ RoomTypePriceRepository (đồng bộ 100% với thuật toán gia hạn của Thành viên 4)
        Map<Integer, BigDecimal> tariffMap = new java.util.HashMap<>();
        if (currentRoomType != null && currentRoomType.getRoomTypeId() != null) {
            for (RoomTypePrice rtp : roomTypePriceRepository.findByRoomType_RoomTypeIdAndIsActiveTrue(currentRoomType.getRoomTypeId())) {
                if (rtp.getDayOfWeek() != null && rtp.getPrice() != null) {
                    tariffMap.put(rtp.getDayOfWeek(), rtp.getPrice());
                }
            }
        }

        // Thu thập các đêm đã được lưu sẵn trong ReservationNightlyRate theo ngày
        Map<LocalDate, ReservationNightlyRate> matchedTypeRates = new java.util.LinkedHashMap<>();
        Map<LocalDate, ReservationNightlyRate> anyTypeRates = new java.util.LinkedHashMap<>();
        if (res != null && res.getDetails() != null) {
            for (ReservationDetail detail : res.getDetails()) {
                boolean isSameRoomType = currentRoomType != null && detail.getRoomType() != null
                        && currentRoomType.getRoomTypeId().equals(detail.getRoomType().getRoomTypeId());
                if (detail.getNightlyRates() != null) {
                    for (ReservationNightlyRate rate : detail.getNightlyRates()) {
                        if (rate.getStayDate() != null && rate.getUnitPrice() != null) {
                            anyTypeRates.putIfAbsent(rate.getStayDate(), rate);
                            if (isSameRoomType) {
                                matchedTypeRates.put(rate.getStayDate(), rate);
                            }
                        }
                    }
                }
            }
        }

        LocalDate start = checkInDate;
        LocalDate end = checkOutDate;
        if (start == null && res != null) {
            start = res.getCheckInDate();
        }
        if (end == null && res != null) {
            end = res.getCheckOutDate();
        }
        if (start == null) {
            start = LocalDate.now();
        }
        if (end == null || !end.isAfter(start)) {
            end = start.plusDays(1);
        }

        List<RoomNightItemDto> roomNights = new ArrayList<>();
        int generatedId = 1;
        for (LocalDate cur = start; cur.isBefore(end); cur = cur.plusDays(1)) {
            ReservationNightlyRate recorded = matchedTypeRates.getOrDefault(cur, anyTypeRates.get(cur));
            BigDecimal unitPrice;
            Integer rateId;
            if (recorded != null && recorded.getUnitPrice() != null) {
                unitPrice = recorded.getUnitPrice();
                rateId = recorded.getNightlyRateId() != null ? recorded.getNightlyRateId() : generatedId++;
            } else {
                int dow = cur.getDayOfWeek().getValue();
                unitPrice = tariffMap.getOrDefault(dow, basePrice);
                rateId = generatedId++;
            }

            roomNights.add(RoomNightItemDto.builder()
                    .nightlyRateId(rateId)
                    .stayDate(cur)
                    .roomTypeName(roomTypeName)
                    .quantity(1)
                    .unitPrice(unitPrice)
                    .lineTotal(unitPrice)
                    .build());
        }

        return roomNights;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ServiceOrderDto> getServiceOrders(Integer stayId, Integer callerAccountId, String callerRole) {
        List<ServiceOrder> orders = stayId != null
                ? serviceOrderRepository.findByGuestStay_StayIdOrderByOrderTimeDesc(stayId)
                : serviceOrderRepository.findAll(Sort.by(Sort.Direction.DESC, "orderTime"));
        boolean isCustomer = "CUSTOMER".equals(callerRole);
        return orders.stream()
                .filter(o -> !isCustomer || isStayOwner(o.getGuestStay(), callerAccountId))
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional
    public ServiceOrderDto orderServiceToFolio(ServiceOrderRequest request, Integer callerAccountId, String callerRole) {
        GuestStay stay = guestStayRepository.findById(request.getStayId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lượt lưu trú."));

        if ("CUSTOMER".equals(callerRole) && !isStayOwner(stay, callerAccountId)) {
            throw new BusinessException("AUTH_FORBIDDEN", messageResolver.resolve("AUTH_FORBIDDEN"),
                    org.springframework.http.HttpStatus.FORBIDDEN);
        }
        if (!GuestStayStatus.ACTIVE.name().equalsIgnoreCase(stay.getStatus())) {
            throw new BusinessException("MSG11", messageResolver.resolve("MSG11"));
        }

        Folio folio = folioRepository.findByGuestStay_StayId(stay.getStayId()).orElse(null);
        if (folio != null && FOLIO_CLOSED.equalsIgnoreCase(folio.getStatus())) {
            folio.setStatus("OPEN");
            folioRepository.save(folio);
        }

        HotelService service = findService(request.getServiceId());
        if (!SERVICE_ACTIVE.equalsIgnoreCase(service.getStatus())) {
            throw new BusinessException("SERVICE_INACTIVE", "Dịch vụ này đã ngừng cung cấp.");
        }

        // BR-27: snapshot unit_price at ordering time. Folio is charged when the order is COMPLETED.
        boolean isStaffCreator = callerRole != null && !"CUSTOMER".equalsIgnoreCase(callerRole);
        String userNotes = (request.getNotes() != null && !request.getNotes().trim().isEmpty())
                ? "[GHI CHÚ] " + request.getNotes().trim()
                : null;
        String initialMeta;
        if (isStaffCreator) {
            initialMeta = userNotes != null ? "[ĐÃ XÁC NHẬN] " + userNotes : "[ĐÃ XÁC NHẬN]";
        } else {
            initialMeta = userNotes;
        }
        ServiceOrder order = ServiceOrder.builder()
                .guestStay(stay)
                .hotelService(service)
                .recordedByStaff(isStaffCreator ? findStaff(callerAccountId) : null)
                .orderTime(Instant.now())
                .quantity(request.getQuantity())
                .unitPrice(service.getUnitPrice())
                .cancelReason(initialMeta)
                .status(ServiceOrderStatus.ORDERED.name())
                .build();
        return toDto(serviceOrderRepository.save(order));
    }

    @Override
    @Transactional
    public ServiceOrderDto confirmServiceOrder(Integer orderId, Integer callerAccountId) {
        ServiceOrder order = findOrder(orderId);
        if (!ServiceOrderStatus.ORDERED.name().equals(order.getStatus())) {
            throw new BusinessException("SERVICE_ORDER_STATE", "Chỉ đơn dịch vụ đang chờ xác nhận mới có thể thực hiện xác nhận.");
        }
        if (isOrderConfirmedByStaff(order)) {
            return toDto(order);
        }
        Staff staff = findStaff(callerAccountId);
        if (staff != null) {
            order.setRecordedByStaff(staff);
        }
        String currentRaw = order.getCancelReason();
        if (currentRaw == null || currentRaw.isBlank()) {
            order.setCancelReason("[ĐÃ XÁC NHẬN]");
        } else if (!currentRaw.contains("[ĐÃ XÁC NHẬN]")) {
            order.setCancelReason("[ĐÃ XÁC NHẬN] " + currentRaw.trim());
        }
        return toDto(serviceOrderRepository.save(order));
    }

    @Override
    @Transactional
    public ServiceOrderDto completeServiceOrder(Integer orderId, Integer callerAccountId) {
        ServiceOrder order = findOrder(orderId);
        if (!isOrderConfirmedByStaff(order)) {
            Staff staff = findStaff(callerAccountId);
            if (staff != null) {
                order.setRecordedByStaff(staff);
            }
            String currentRaw = order.getCancelReason();
            if (currentRaw == null || currentRaw.isBlank()) {
                order.setCancelReason("[ĐÃ XÁC NHẬN]");
            } else if (!currentRaw.contains("[ĐÃ XÁC NHẬN]")) {
                order.setCancelReason("[ĐÃ XÁC NHẬN] " + currentRaw.trim());
            }
        }
        if (!ServiceOrderStatus.ORDERED.name().equals(order.getStatus())) {
            throw new BusinessException("SERVICE_ORDER_STATE", "Chá»‰ Ä‘Æ¡n dá»‹ch vá»¥ Ä‘ang chá» cung cáº¥p má»›i cÃ³ thá»ƒ hoÃ n thÃ nh.");
        }
        Folio folio = folioRepository.findByGuestStay_StayId(order.getGuestStay().getStayId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hóa đơn phòng (Folio) của lượt lưu trú."));
        if (FOLIO_CLOSED.equalsIgnoreCase(folio.getStatus())) {
            folio.setStatus("OPEN");
        }

        order.setStatus(ServiceOrderStatus.COMPLETED.name());
        order.setCompletedAt(Instant.now());
        if (order.getRecordedByStaff() == null) {
            order.setRecordedByStaff(findStaff(callerAccountId));
        }
        serviceOrderRepository.saveAndFlush(order);
        GuestStay stay = order.getGuestStay();
        LocalDate checkInDate = stay.getReservation() != null ? stay.getReservation().getCheckInDate() : null;
        LocalDate checkOutDate = stay.getReservation() != null ? stay.getReservation().getCheckOutDate() : null;
        folio.setTotalAmount(calculateEstimatedStayBalance(stay, folio, checkInDate, checkOutDate));
        try {
            folioRepository.saveAndFlush(folio);
        } catch (OptimisticLockingFailureException ex) {
            throw new BusinessException("FOLIO_CONFLICT", "Folio vừa được cập nhật bởi người khác. Vui lòng thử lại.",
                    org.springframework.http.HttpStatus.CONFLICT);
        }
        return toDto(order);
    }

    @Override
    @Transactional
    public ServiceOrderDto voidServiceOrder(Integer orderId, String cancelReason, Integer callerAccountId) {
        return voidServiceOrder(orderId, cancelReason, callerAccountId, null);
    }

    @Override
    @Transactional
    public ServiceOrderDto voidServiceOrder(Integer orderId, String cancelReason, Integer callerAccountId, String callerRole) {
        if (cancelReason == null || cancelReason.isBlank()) {
            throw new BusinessException("CANCEL_REASON_REQUIRED", "Vui lòng nhập lý do hủy dịch vụ.");
        }
        ServiceOrder order = findOrder(orderId);

        if (ServiceOrderStatus.VOIDED.name().equalsIgnoreCase(order.getStatus())) {
            throw new BusinessException("ORDER_ALREADY_VOIDED", "Đơn dịch vụ này đã bị hủy trước đó.");
        }

        GuestStay stay = order.getGuestStay();
        if (stay != null) {
            Folio folio = folioRepository.findByGuestStay_StayId(stay.getStayId()).orElse(null);
            if (folio != null && FOLIO_CLOSED.equalsIgnoreCase(folio.getStatus())) {
                throw new BusinessException("FOLIO_CLOSED", "Hóa đơn phòng đã được thanh toán và đóng, không thể hủy đơn dịch vụ.");
            }
        }

        if (ServiceOrderStatus.COMPLETED.name().equalsIgnoreCase(order.getStatus())) {
            throw new BusinessException("SERVICE_ORDER_STATE", "Đơn dịch vụ đã hoàn thành, không thể hủy.");
        }

        if (!ServiceOrderStatus.ORDERED.name().equalsIgnoreCase(order.getStatus())) {
            throw new BusinessException("SERVICE_ORDER_STATE", "Chỉ đơn dịch vụ đang chờ xác nhận mới có thể hủy.");
        }

        if (isOrderConfirmedByStaff(order)) {
            throw new BusinessException("ORDER_ALREADY_CONFIRMED",
                    "Đơn dịch vụ đã được nhân viên xác nhận chuyển sang chờ phục vụ, không thể hủy.");
        }

        if ("CUSTOMER".equalsIgnoreCase(callerRole) && !isStayOwner(order.getGuestStay(), callerAccountId)) {
            throw new BusinessException("AUTH_FORBIDDEN", "Quý khách không có quyền hủy đơn dịch vụ của phòng này.",
                    org.springframework.http.HttpStatus.FORBIDDEN);
        }

        order.setStatus(ServiceOrderStatus.VOIDED.name());
        order.setCancelledAt(Instant.now());

        String formattedReason = "CUSTOMER".equalsIgnoreCase(callerRole)
                ? "Khách hàng hủy: " + cancelReason.trim()
                : cancelReason.trim();

        String currentRaw = order.getCancelReason();
        if (currentRaw != null && currentRaw.contains("[GHI CHÚ] ")) {
            int noteStart = currentRaw.indexOf("[GHI CHÚ] ");
            String existingNotes = currentRaw.contains(" || [HỦY] ")
                    ? currentRaw.substring(noteStart, currentRaw.indexOf(" || [HỦY] "))
                    : currentRaw.substring(noteStart);
            order.setCancelReason(existingNotes + " || [HỦY] " + formattedReason);
        } else {
            order.setCancelReason(formattedReason);
        }

        order.setCancelledByStaff(findStaff(callerAccountId));
        return toDto(serviceOrderRepository.save(order));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Voucher> getAllVouchers() {
        return voucherRepository.findAll(Sort.by(Sort.Direction.DESC, "voucherId"));
    }

    // ------------------------------------------------------------------ helpers

    private HotelService findService(Integer serviceId) {
        return hotelServiceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ."));
    }

    private ServiceOrder findOrder(Integer orderId) {
        return serviceOrderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn dịch vụ."));
    }

    private Staff findStaff(Integer accountId) {
        return accountId == null ? null : staffRepository.findByAccount_AccountId(accountId).orElse(null);
    }

    private boolean isStayOwner(GuestStay stay, Integer accountId) {
        if (stay == null || stay.getReservation() == null || accountId == null) {
            return false;
        }
        Customer customer = stay.getReservation().getCustomer();
        return customer != null && customer.getAccount() != null
                && accountId.equals(customer.getAccount().getAccountId());
    }

    private BigDecimal lineAmount(ServiceOrder order) {
        return order.getUnitPrice().multiply(BigDecimal.valueOf(order.getQuantity()));
    }

    private boolean isOrderConfirmedByStaff(ServiceOrder o) {
        if (o == null) return false;
        if (o.getRecordedByStaff() != null) return true;
        String raw = o.getCancelReason();
        return raw != null && raw.contains("[ĐÃ XÁC NHẬN]");
    }

    private ServiceOrderDto toDto(ServiceOrder o) {
        GuestStay stay = o.getGuestStay();
        Reservation reservation = stay.getReservation();
        HotelService svc = o.getHotelService();
        String guestName = reservation.getContactName() != null
                ? reservation.getContactName()
                : (reservation.getCustomer() != null ? reservation.getCustomer().getFullName() : null);
        String roomNumber = "Chưa gán phòng";
        if (stay.getRoomAssignments() != null && !stay.getRoomAssignments().isEmpty()) {
            roomNumber = stay.getRoomAssignments().get(stay.getRoomAssignments().size() - 1)
                    .getRoom().getRoomNumber();
        }
        boolean staffConfirmed = isOrderConfirmedByStaff(o);
        String rawReason = o.getCancelReason();
        String extractedNotes = null;
        String extractedCancelReason = null;
        if (rawReason != null) {
            String cleaned = rawReason.replace("[ĐÃ XÁC NHẬN]", "").trim();
            if (!cleaned.isEmpty()) {
                if (cleaned.startsWith("[GHI CHÚ] ")) {
                    if (cleaned.contains(" || [HỦY] ")) {
                        int sepIdx = cleaned.indexOf(" || [HỦY] ");
                        extractedNotes = cleaned.substring("[GHI CHÚ] ".length(), sepIdx).trim();
                        extractedCancelReason = cleaned.substring(sepIdx + " || [HỦY] ".length()).trim();
                    } else {
                        extractedNotes = cleaned.substring("[GHI CHÚ] ".length()).trim();
                    }
                } else {
                    extractedCancelReason = cleaned;
                }
            }
        }

        return ServiceOrderDto.builder()
                .serviceOrderId(o.getServiceOrderId())
                .stayId(stay.getStayId())
                .roomNumber(roomNumber)
                .reservationCode(reservation.getReservationCode())
                .guestName(guestName)
                .serviceId(svc.getServiceId())
                .serviceName(svc.getServiceName())
                .category(svc.getCategory())
                .billingUnit(svc.getBillingUnit())
                .quantity(o.getQuantity())
                .unitPrice(o.getUnitPrice())
                .totalAmount(lineAmount(o))
                .orderTime(o.getOrderTime())
                .completedAt(o.getCompletedAt())
                .cancelledAt(o.getCancelledAt())
                .notes(extractedNotes)
                .cancelReason(extractedCancelReason)
                .staffConfirmed(staffConfirmed)
                .status(o.getStatus())
                .build();
    }

    // ------------------------------------------------------------------ UC-37..40 (unchanged, Feature 2)

    @Override
    @Transactional
    public InvoiceDto compileAndSettleInvoice(Integer stayId, String voucherCode, String paymentMethod) {
        Folio folio = folioRepository.findByGuestStay_StayId(stayId)
                .orElseThrow(() -> new ResourceNotFoundException("Folio not found for stayId: " + stayId));

        BigDecimal subtotal = folio.getTotalAmount();
        BigDecimal discount = BigDecimal.ZERO;
        Voucher appliedVoucher = null;

        if (voucherCode != null && !voucherCode.isBlank()) {
            Voucher v = voucherRepository.findByCodeIgnoreCase(voucherCode.trim())
                    .orElseThrow(() -> new BusinessException("MSG09", messageResolver.resolve("MSG09")));
            Instant now = Instant.now();
            if (!"ACTIVE".equalsIgnoreCase(v.getStatus())
                    || now.isBefore(v.getValidFrom())
                    || now.isAfter(v.getValidTo())
                    || v.getUsedCount() >= v.getUsageLimit()
                    || subtotal.compareTo(v.getMinSpend()) < 0) {
                throw new BusinessException("MSG09", messageResolver.resolve("MSG09"));
            }
            if ("PERCENTAGE".equalsIgnoreCase(v.getDiscountType())) {
                discount = subtotal.multiply(v.getDiscountValue())
                        .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
                if (v.getMaxDiscountAmount().compareTo(BigDecimal.ZERO) > 0
                        && discount.compareTo(v.getMaxDiscountAmount()) > 0) {
                    discount = v.getMaxDiscountAmount();
                }
            } else {
                discount = v.getDiscountValue();
            }
            v.setUsedCount(v.getUsedCount() + 1);
            appliedVoucher = voucherRepository.saveAndFlush(v);
        }

        BigDecimal taxable = subtotal.subtract(discount).max(BigDecimal.ZERO);
        BigDecimal tax = taxable.multiply(new BigDecimal("0.08")).setScale(0, RoundingMode.HALF_UP);
        BigDecimal finalAmount = taxable.add(tax);

        Invoice invoice = invoiceRepository.findByFolio_FolioId(folio.getFolioId())
                .orElseGet(() -> Invoice.builder()
                        .folio(folio)
                        .invoiceCode("INV-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase())
                        .build());

        invoice.setVoucher(appliedVoucher);
        invoice.setTotalAmount(subtotal);
        invoice.setDiscountAmount(discount);
        invoice.setTaxAmount(tax);
        invoice.setFinalAmount(finalAmount);
        invoice.setStatus(InvoiceStatus.PAID.name());
        invoice.setIssueDate(Instant.now());
        Invoice savedInvoice = invoiceRepository.save(invoice);

        Payment payment = Payment.builder()
                .invoice(savedInvoice)
                .reservation(folio.getGuestStay().getReservation())
                .paymentType("SETTLEMENT")
                .amount(finalAmount)
                .currency("VND")
                .method(paymentMethod != null ? paymentMethod.toUpperCase() : "CASH")
                .status(PaymentStatus.PAID.name())
                .createdAt(Instant.now())
                .paidAt(Instant.now())
                .build();
        paymentRepository.save(payment);

        folio.setTotalAmount(BigDecimal.ZERO);
        folio.setStatus(FolioStatus.CLOSED.name());
        folioRepository.save(folio);

        return InvoiceDto.builder()
                .invoiceId(savedInvoice.getInvoiceId())
                .invoiceCode(savedInvoice.getInvoiceCode())
                .folioId(folio.getFolioId())
                .totalAmount(savedInvoice.getTotalAmount())
                .discountAmount(savedInvoice.getDiscountAmount())
                .taxAmount(savedInvoice.getTaxAmount())
                .finalAmount(savedInvoice.getFinalAmount())
                .voucherCode(appliedVoucher != null ? appliedVoucher.getCode() : null)
                .status(savedInvoice.getStatus())
                .issueDate(savedInvoice.getIssueDate())
                .build();
    }

    // ------------------------------------------------------------------ UC-38: Voucher Management & Validation

    @Override
    @Transactional
    public Voucher createVoucher(VoucherRequest request) {
        String code = request.getCode().trim().toUpperCase();
        if (voucherRepository.findByCodeIgnoreCase(code).isPresent()) {
            throw new BusinessException("MSG09A", "Mã khuyến mãi '" + code + "' đã tồn tại trên hệ thống.");
        }
        if (request.getValidTo().isBefore(request.getValidFrom())) {
            throw new BusinessException("BR-VOUCHER-DATE", "Thá»i gian káº¿t thÃºc hiá»‡u lá»±c pháº£i sau thá»i gian báº¯t Ä‘áº§u.");
        }

        Voucher v = Voucher.builder()
                .code(code)
                .discountType(request.getDiscountType().trim().toUpperCase())
                .discountValue(request.getDiscountValue())
                .validFrom(request.getValidFrom())
                .validTo(request.getValidTo())
                .minSpend(request.getMinSpend())
                .maxDiscountAmount(request.getMaxDiscountAmount())
                .usageLimit(request.getUsageLimit())
                .usedCount(0)
                .status(request.getStatus() != null ? request.getStatus().trim().toUpperCase() : "ACTIVE")
                .build();
        return voucherRepository.save(v);
    }

    @Override
    @Transactional
    public Voucher updateVoucher(Integer voucherId, VoucherRequest request) {
        Voucher v = voucherRepository.findById(voucherId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy mã voucher với ID: " + voucherId));

        String newCode = request.getCode().trim().toUpperCase();
        if (!v.getCode().equalsIgnoreCase(newCode) && voucherRepository.findByCodeIgnoreCase(newCode).isPresent()) {
            throw new BusinessException("MSG09A", "Mã khuyến mãi '" + newCode + "' đã tồn tại.");
        }
        if (request.getValidTo().isBefore(request.getValidFrom())) {
            throw new BusinessException("BR-VOUCHER-DATE", "Thá»i gian káº¿t thÃºc hiá»‡u lá»±c pháº£i sau thá»i gian báº¯t Ä‘áº§u.");
        }

        v.setCode(newCode);
        v.setDiscountType(request.getDiscountType().trim().toUpperCase());
        v.setDiscountValue(request.getDiscountValue());
        v.setValidFrom(request.getValidFrom());
        v.setValidTo(request.getValidTo());
        v.setMinSpend(request.getMinSpend());
        v.setMaxDiscountAmount(request.getMaxDiscountAmount());
        v.setUsageLimit(request.getUsageLimit());
        if (request.getStatus() != null) {
            v.setStatus(request.getStatus().trim().toUpperCase());
        }
        return voucherRepository.save(v);
    }

    @Override
    @Transactional
    public Voucher toggleVoucherStatus(Integer voucherId, String status) {
        Voucher v = voucherRepository.findById(voucherId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy mã voucher với ID: " + voucherId));

        String newStatus = ("ACTIVE".equalsIgnoreCase(status) || "true".equalsIgnoreCase(status)) ? "ACTIVE" : "INACTIVE";
        v.setStatus(newStatus);
        return voucherRepository.save(v);
    }

    @Override
    @Transactional(readOnly = true)
    public VoucherValidateResponse validateVoucher(VoucherValidateRequest request) {
        if (request.getCode() == null || request.getCode().isBlank()) {
            return VoucherValidateResponse.builder()
                    .valid(false)
                    .message("Vui lòng nhập mã khuyến mãi.")
                    .build();
        }

        Voucher v = voucherRepository.findByCodeIgnoreCase(request.getCode().trim()).orElse(null);
        if (v == null) {
            return VoucherValidateResponse.builder()
                    .valid(false)
                    .message("Mã khuyến mãi không tồn tại trên hệ thống.")
                    .build();
        }

        if (!"ACTIVE".equalsIgnoreCase(v.getStatus())) {
            return VoucherValidateResponse.builder()
                    .valid(false)
                    .code(v.getCode())
                    .message("Mã khuyến mãi hiện đang tạm ngưng hoạt động.")
                    .build();
        }

        Instant now = Instant.now();
        if (now.isBefore(v.getValidFrom())) {
            return VoucherValidateResponse.builder()
                    .valid(false)
                    .code(v.getCode())
                    .message("Mã khuyến mãi chưa đến thời gian áp dụng.")
                    .build();
        }
        if (now.isAfter(v.getValidTo())) {
            return VoucherValidateResponse.builder()
                    .valid(false)
                    .code(v.getCode())
                    .message("Mã khuyến mãi đã hết hạn sử dụng.")
                    .build();
        }

        if (v.getUsedCount() >= v.getUsageLimit()) {
            return VoucherValidateResponse.builder()
                    .valid(false)
                    .code(v.getCode())
                    .message("Mã khuyến mãi đã hết lượt sử dụng.")
                    .build();
        }

        BigDecimal subtotal = request.getSubtotalAmount() != null ? request.getSubtotalAmount() : BigDecimal.ZERO;
        if (subtotal.compareTo(v.getMinSpend()) < 0) {
            return VoucherValidateResponse.builder()
                    .valid(false)
                    .code(v.getCode())
                    .message("Đơn hàng chưa đạt mức chi tiêu tối thiểu (" + v.getMinSpend() + " VND).")
                    .build();
        }

        BigDecimal discount = BigDecimal.ZERO;
        if ("PERCENTAGE".equalsIgnoreCase(v.getDiscountType())) {
            discount = subtotal.multiply(v.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
            if (v.getMaxDiscountAmount() != null && v.getMaxDiscountAmount().compareTo(BigDecimal.ZERO) > 0
                    && discount.compareTo(v.getMaxDiscountAmount()) > 0) {
                discount = v.getMaxDiscountAmount();
            }
        } else {
            discount = v.getDiscountValue().min(subtotal);
        }

        return VoucherValidateResponse.builder()
                .valid(true)
                .message("Áp dụng mã khuyến mãi thành công!")
                .voucherId(v.getVoucherId())
                .code(v.getCode())
                .discountType(v.getDiscountType())
                .discountValue(v.getDiscountValue())
                .discountAmount(discount)
                .subtotalAfterDiscount(subtotal.subtract(discount).max(BigDecimal.ZERO))
                .build();
    }

    // ------------------------------------------------------------------ UC-37: Folio Breakdown & Additional Charges

    @Override
    @Transactional
    public FolioDetailDto getFolioDetail(Integer stayId, Integer callerAccountId, String callerRole) {
        GuestStay stay = guestStayRepository.findById(stayId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lượt lưu trú cho stayId: " + stayId));
        Folio folio = folioRepository.findByGuestStay_StayId(stayId)
                .orElseGet(() -> {
                    Folio newFolio = Folio.builder()
                            .guestStay(stay)
                            .status("OPEN")
                            .totalAmount(BigDecimal.ZERO)
                            .build();
                    return folioRepository.save(newFolio);
                });

        if (RoleName.CUSTOMER.name().equalsIgnoreCase(callerRole)) {
            Reservation r = stay.getReservation();
            if (r.getCustomer() == null || r.getCustomer().getAccount() == null
                    || !r.getCustomer().getAccount().getAccountId().equals(callerAccountId)) {
                throw new BusinessException("BR-UNAUTHORIZED", "Báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p hÃ³a Ä‘Æ¡n cá»§a khÃ¡ch hÃ ng khÃ¡c.");
            }
        }

        return buildFolioDetailDto(folio, stay);
    }

    @Override
    @Transactional
    public AdditionalChargeDto addAdditionalCharge(Integer folioId, AdditionalChargeRequest request, Integer callerAccountId) {
        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Folio cho ID: " + folioId));

        if (FOLIO_CLOSED.equalsIgnoreCase(folio.getStatus())) {
            throw new BusinessException("BR-FOLIO-CLOSED", "Không thể thêm phụ thu vào hóa đơn phòng đã quyết toán/đóng.");
        }

        Account account = accountRepository.findById(callerAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("KhÃ´ng tÃ¬m tháº¥y tÃ i khoáº£n nhÃ¢n viÃªn: " + callerAccountId));

        AdditionalCharge charge = AdditionalCharge.builder()
                .folio(folio)
                .createdByAccount(account)
                .chargeType(request.getChargeType().trim().toUpperCase())
                .description(request.getDescription() != null ? request.getDescription().trim() : "")
                .amount(request.getAmount())
                .createdAt(Instant.now())
                .status("ACTIVE")
                .build();

        AdditionalCharge saved = additionalChargeRepository.saveAndFlush(charge);
        GuestStay stay = folio.getGuestStay();
        LocalDate checkInDate = (stay != null && stay.getReservation() != null) ? stay.getReservation().getCheckInDate() : null;
        LocalDate checkOutDate = (stay != null && stay.getReservation() != null) ? stay.getReservation().getCheckOutDate() : null;
        folio.setTotalAmount(calculateEstimatedStayBalance(stay, folio, checkInDate, checkOutDate));
        folioRepository.save(folio);

        return toAdditionalChargeDto(saved);
    }

    @Override
    @Transactional
    public void deleteAdditionalCharge(Integer chargeId, Integer callerAccountId, String callerRole) {
        AdditionalCharge charge = additionalChargeRepository.findById(chargeId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy khoản phụ thu ID: " + chargeId));

        Folio folio = charge.getFolio();
        if (FOLIO_CLOSED.equalsIgnoreCase(folio.getStatus())) {
            throw new BusinessException("BR-FOLIO-CLOSED", "Không thể xóa phụ thu khi hóa đơn phòng đã quyết toán/đóng.");
        }

        charge.setStatus("CANCELLED");
        additionalChargeRepository.saveAndFlush(charge);

        GuestStay stay = folio.getGuestStay();
        LocalDate checkInDate = (stay != null && stay.getReservation() != null) ? stay.getReservation().getCheckInDate() : null;
        LocalDate checkOutDate = (stay != null && stay.getReservation() != null) ? stay.getReservation().getCheckOutDate() : null;
        folio.setTotalAmount(calculateEstimatedStayBalance(stay, folio, checkInDate, checkOutDate));
        folioRepository.save(folio);
    }

    // ------------------------------------------------------------------ UC-39 & UC-40: Settle Folio & Invoices

    @Override
    @Transactional
    public InvoiceDetailDto settleFolio(Integer stayId, FolioSettlementRequest request, Integer callerAccountId) {
        GuestStay stay = guestStayRepository.findById(stayId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin lưu trú cho stayId: " + stayId));
        Folio folio = folioRepository.findByGuestStay_StayId(stayId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Folio cho stayId: " + stayId));

        FolioDetailDto preview = buildFolioDetailDto(folio, stay);
        if (FOLIO_CLOSED.equalsIgnoreCase(folio.getStatus())) {
            return getInvoiceDetailByStay(stayId, callerAccountId, "STAFF");
        }
        BigDecimal subtotal = preview.getSubtotal();
        BigDecimal discount = BigDecimal.ZERO;
        Voucher appliedVoucher = null;

        if (request.getVoucherCode() != null && !request.getVoucherCode().isBlank()) {
            Voucher v = voucherRepository.findByCodeIgnoreCase(request.getVoucherCode().trim())
                    .orElseThrow(() -> new BusinessException("MSG09", "Mã voucher không tồn tại hoặc không hợp lệ."));
            Instant now = Instant.now();
            if (!"ACTIVE".equalsIgnoreCase(v.getStatus())
                    || now.isBefore(v.getValidFrom())
                    || now.isAfter(v.getValidTo())
                    || v.getUsedCount() >= v.getUsageLimit()
                    || subtotal.compareTo(v.getMinSpend()) < 0) {
                throw new BusinessException("MSG09", "Mã voucher không đủ điều kiện áp dụng.");
            }
            if ("PERCENTAGE".equalsIgnoreCase(v.getDiscountType())) {
                discount = subtotal.multiply(v.getDiscountValue())
                        .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
                if (v.getMaxDiscountAmount() != null && v.getMaxDiscountAmount().compareTo(BigDecimal.ZERO) > 0
                        && discount.compareTo(v.getMaxDiscountAmount()) > 0) {
                    discount = v.getMaxDiscountAmount();
                }
            } else {
                discount = v.getDiscountValue().min(subtotal);
            }
            v.setUsedCount(v.getUsedCount() + 1);
            appliedVoucher = voucherRepository.saveAndFlush(v);
        }

        BigDecimal taxable = subtotal.subtract(discount).max(BigDecimal.ZERO);
        BigDecimal tax = taxable.multiply(new BigDecimal("0.08")).setScale(0, RoundingMode.HALF_UP);
        BigDecimal grossWithTax = taxable.add(tax).setScale(0, RoundingMode.HALF_UP);
        BigDecimal depositPaid = preview.getDepositPaid() != null ? preview.getDepositPaid().setScale(0, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        BigDecimal balancePayable = grossWithTax.subtract(depositPaid).max(BigDecimal.ZERO).setScale(0, RoundingMode.HALF_UP);

        Instant now = Instant.now();
        String generatedCode = "INV-" + DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneId.systemDefault()).format(now)
                + "-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();

        Invoice invoice = invoiceRepository.findByFolio_FolioId(folio.getFolioId())
                .orElseGet(() -> Invoice.builder()
                        .folio(folio)
                        .invoiceCode(generatedCode)
                        .build());

        invoice.setVoucher(appliedVoucher);
        invoice.setTotalAmount(subtotal);
        invoice.setDiscountAmount(discount);
        invoice.setTaxAmount(tax);
        invoice.setFinalAmount(grossWithTax);
        invoice.setStatus(InvoiceStatus.PAID.name());
        invoice.setIssueDate(now);
        Invoice savedInvoice = invoiceRepository.save(invoice);

        String method = request.getPaymentMethod() != null ? request.getPaymentMethod().trim().toUpperCase() : "CASH";
        Payment payment = Payment.builder()
                .invoice(savedInvoice)
                .reservation(stay.getReservation())
                .paymentType("SETTLEMENT")
                .amount(balancePayable)
                .currency("VND")
                .method(method)
                .status(PaymentStatus.PAID.name())
                .createdAt(now)
                .paidAt(now)
                .build();
        paymentRepository.save(payment);

        folio.setTotalAmount(BigDecimal.ZERO);
        folio.setStatus(FolioStatus.CLOSED.name());
        folioRepository.save(folio);

        return buildInvoiceDetailDto(savedInvoice, folio, stay, payment, callerAccountId, request.getNotes());
    }

    @Override
    @Transactional
    public FolioVnPayInitResponse createFolioVnPayUrl(Integer stayId, FolioSettlementRequest request, Integer callerAccountId) {
        GuestStay stay = guestStayRepository.findById(stayId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin lưu trú cho stayId: " + stayId));
        Folio folio = folioRepository.findByGuestStay_StayId(stayId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Folio cho stayId: " + stayId));

        FolioDetailDto preview = buildFolioDetailDto(folio, stay);
        if (FOLIO_CLOSED.equalsIgnoreCase(folio.getStatus())) {
            throw new BusinessException("FOLIO_ALREADY_CLOSED", "Hóa đơn phòng này đã được quyết toán và đóng.");
        }
        BigDecimal subtotal = preview.getSubtotal();
        BigDecimal discount = BigDecimal.ZERO;
        Voucher appliedVoucher = null;

        if (request != null && request.getVoucherCode() != null && !request.getVoucherCode().isBlank()) {
            Voucher v = voucherRepository.findByCodeIgnoreCase(request.getVoucherCode().trim())
                    .orElseThrow(() -> new BusinessException("MSG09", "Mã voucher không tồn tại hoặc không hợp lệ."));
            Instant now = Instant.now();
            if (!"ACTIVE".equalsIgnoreCase(v.getStatus())
                    || now.isBefore(v.getValidFrom())
                    || now.isAfter(v.getValidTo())
                    || v.getUsedCount() >= v.getUsageLimit()
                    || subtotal.compareTo(v.getMinSpend()) < 0) {
                throw new BusinessException("MSG09", "Mã voucher không đủ điều kiện áp dụng.");
            }
            if ("PERCENTAGE".equalsIgnoreCase(v.getDiscountType())) {
                discount = subtotal.multiply(v.getDiscountValue())
                        .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
                if (v.getMaxDiscountAmount() != null && v.getMaxDiscountAmount().compareTo(BigDecimal.ZERO) > 0
                        && discount.compareTo(v.getMaxDiscountAmount()) > 0) {
                    discount = v.getMaxDiscountAmount();
                }
            } else {
                discount = v.getDiscountValue().min(subtotal);
            }
            appliedVoucher = v;
        }

        BigDecimal taxable = subtotal.subtract(discount).max(BigDecimal.ZERO);
        BigDecimal tax = taxable.multiply(new BigDecimal("0.08")).setScale(0, RoundingMode.HALF_UP);
        BigDecimal grossWithTax = taxable.add(tax).setScale(0, RoundingMode.HALF_UP);
        BigDecimal depositPaid = preview.getDepositPaid() != null ? preview.getDepositPaid().setScale(0, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        BigDecimal balancePayable = grossWithTax.subtract(depositPaid).max(BigDecimal.ZERO).setScale(0, RoundingMode.HALF_UP);

        if (balancePayable.compareTo(BigDecimal.valueOf(5000)) < 0) {
            throw new BusinessException("VNPAY_AMOUNT_TOO_LOW",
                    "Số tiền cần thanh toán qua cổng VNPay tối thiểu là 5,000 VND (hiện tại: "
                            + balancePayable.longValue()
                            + " VND). Vui lòng chọn hình thức Tiền mặt tại quầy để chốt hóa đơn trực tiếp.");
        }

        Instant now = Instant.now();
        String generatedCode = "INV-" + DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneId.systemDefault()).format(now)
                + "-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();

        Invoice invoice = invoiceRepository.findByFolio_FolioId(folio.getFolioId())
                .orElseGet(() -> Invoice.builder()
                        .folio(folio)
                        .invoiceCode(generatedCode)
                        .build());

        invoice.setVoucher(appliedVoucher);
        invoice.setTotalAmount(subtotal);
        invoice.setDiscountAmount(discount);
        invoice.setTaxAmount(tax);
        invoice.setFinalAmount(grossWithTax);
        invoice.setStatus(InvoiceStatus.UNPAID.name());
        invoice.setIssueDate(now);
        Invoice savedInvoice = invoiceRepository.save(invoice);

        String notesMeta = (request != null && request.getNotes() != null && !request.getNotes().trim().isEmpty())
                ? request.getNotes().trim()
                : "";
        if (notesMeta.length() > 95) {
            notesMeta = notesMeta.substring(0, 95);
        }

        String txnRef = "FOLIO-" + stayId + "-" + (System.currentTimeMillis() % 100000000L);

        Payment payment = Payment.builder()
                .invoice(savedInvoice)
                .reservation(stay.getReservation())
                .paymentType("SETTLEMENT")
                .amount(balancePayable)
                .currency("VND")
                .method(PaymentMethod.VNPAY.name())
                .idempotencyKey(notesMeta.isEmpty() ? txnRef : notesMeta)
                .status(PaymentStatus.PENDING.name())
                .createdAt(now)
                .build();
        Payment savedPayment = paymentRepository.save(payment);

        PaymentAttempt attempt = PaymentAttempt.builder()
                .payment(savedPayment)
                .gatewayProvider("VNPAY")
                .gatewayRequestRef(txnRef)
                .status("PENDING")
                .createdAt(now)
                .expiredAt(now.plusSeconds(15 * 60))
                .build();
        paymentAttemptRepository.save(attempt);

        String orderInfo = "Quyet toan hoa don phong P." + preview.getRoomNumber() + " ma " + savedInvoice.getInvoiceCode();
        String paymentUrl = buildSignedFolioVnPayUrl(txnRef, balancePayable, orderInfo);

        return FolioVnPayInitResponse.builder()
                .stayId(stayId)
                .txnRef(txnRef)
                .amount(balancePayable)
                .paymentUrl(paymentUrl)
                .build();
    }

    @Override
    @Transactional
    public InvoiceDetailDto processFolioVnPayCallback(FolioVnPayCallbackRequest request, Integer callerAccountId) {
        PaymentAttempt attempt = paymentAttemptRepository.findByGatewayRequestRef(request.getTxnRef().trim())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy giao dịch VNPay với mã tham chiếu: " + request.getTxnRef()));

        Payment payment = attempt.getPayment();
        Invoice invoice = payment.getInvoice();
        if (invoice == null || invoice.getFolio() == null) {
            throw new BusinessException("INVALID_PAYMENT_LINK", "Giao dịch không liên kết với hóa đơn phòng hợp lệ.");
        }

        Folio folio = invoice.getFolio();
        GuestStay stay = folio.getGuestStay();

        // Idempotent: nếu đã đóng Folio và Invoice đã PAID thì trả về kết quả luôn
        if (FOLIO_CLOSED.equalsIgnoreCase(folio.getStatus()) && InvoiceStatus.PAID.name().equalsIgnoreCase(invoice.getStatus())) {
            String savedNotes = (payment.getIdempotencyKey() != null && !payment.getIdempotencyKey().startsWith("FOLIO-"))
                    ? payment.getIdempotencyKey() : null;
            return buildInvoiceDetailDto(invoice, folio, stay, payment, callerAccountId, savedNotes);
        }

        // Xác thực chữ ký HMAC-SHA512 từ VNPay
        if (!vnPayGatewayService.isDemoMode()) {
            boolean sigValid = vnPayGatewayService.verifyCallbackSignature(request.getVnpParams(), request.getVnpSecureHash());
            if (!sigValid) {
                throw new BusinessException("VNPAY_INVALID_SIGNATURE",
                        "Chữ ký bảo mật VNPay (vnp_SecureHash) không hợp lệ hoặc dữ liệu đã bị thay đổi.");
            }
        }

        // Kiểm tra số tiền khớp với Payment theo đơn vị đồng chẵn (VNPay quy đổi vnp_Amount = VND * 100 và cắt bỏ phần xu lẻ thập phân)
        if (request.getVnpAmount() != null && request.getVnpAmount() > 0 && payment.getAmount() != null) {
            long expectedVnd = payment.getAmount().setScale(0, RoundingMode.HALF_UP).longValue();
            long actualVnd = request.getVnpAmount() / 100L;
            if (Math.abs(actualVnd - expectedVnd) > 10L) {
                throw new BusinessException("VNPAY_AMOUNT_MISMATCH",
                        "Số tiền phản hồi từ VNPay không khớp với số tiền cần thanh toán của hóa đơn.");
            }
        }

        Instant now = Instant.now();

        if ("00".equals(request.getVnpResponseCode())) {
            attempt.setStatus("SUCCESS");
            attempt.setGatewayTransactionId(request.getVnpTransactionNo());
            attempt.setBankCode(request.getBankCode());
            attempt.setCompletedAt(now);
            paymentAttemptRepository.save(attempt);

            payment.setStatus(PaymentStatus.PAID.name());
            payment.setMethod(PaymentMethod.VNPAY.name());
            payment.setPaidAt(now);
            paymentRepository.save(payment);

            Voucher v = invoice.getVoucher();
            if (v != null) {
                v.setUsedCount((v.getUsedCount() != null ? v.getUsedCount() : 0) + 1);
                voucherRepository.save(v);
            }

            invoice.setStatus(InvoiceStatus.PAID.name());
            invoice.setIssueDate(now);
            Invoice savedInvoice = invoiceRepository.save(invoice);

            folio.setTotalAmount(BigDecimal.ZERO);
            folio.setStatus(FolioStatus.CLOSED.name());
            folioRepository.save(folio);

            String savedNotes = (payment.getIdempotencyKey() != null && !payment.getIdempotencyKey().startsWith("FOLIO-"))
                    ? payment.getIdempotencyKey() : null;
            String vnpNoteSuffix = "Thanh toán qua VNPay"
                    + (request.getBankCode() != null && !request.getBankCode().isBlank() ? " (" + request.getBankCode() + ")" : "")
                    + (request.getVnpTransactionNo() != null && !request.getVnpTransactionNo().isBlank() ? " - Mã GD: " + request.getVnpTransactionNo() : "");
            String combinedNotes = (savedNotes != null && !savedNotes.isBlank())
                    ? savedNotes + " | " + vnpNoteSuffix
                    : vnpNoteSuffix;

            return buildInvoiceDetailDto(savedInvoice, folio, stay, payment, callerAccountId, combinedNotes);
        } else {
            attempt.setStatus("FAILED");
            attempt.setGatewayTransactionId(request.getVnpTransactionNo());
            attempt.setBankCode(request.getBankCode());
            attempt.setCompletedAt(now);
            paymentAttemptRepository.save(attempt);

            payment.setStatus(PaymentStatus.FAILED.name());
            paymentRepository.save(payment);

            throw new BusinessException("VNPAY_PAYMENT_FAILED",
                    "Giao dịch thanh toán VNPay không thành công hoặc đã bị hủy (Mã phản hồi: " + request.getVnpResponseCode() + "). Hóa đơn phòng vẫn đang mở để thanh toán lại.");
        }
    }

    private String buildSignedFolioVnPayUrl(String txnRef, BigDecimal amount, String orderInfo) {
        long vnpAmount = amount.setScale(0, RoundingMode.HALF_UP).longValue() * 100L;

        String effectiveTmn = (vnpTmnCode == null || vnpTmnCode.isBlank() || "DEMO_TMN".equalsIgnoreCase(vnpTmnCode.trim()))
                ? "GCS1874X" : vnpTmnCode.trim();
        String effectiveSecret = (vnpHashSecret == null || vnpHashSecret.isBlank() || "DEMO_SECRET".equalsIgnoreCase(vnpHashSecret.trim()))
                ? "CAJSNWRIUUYNJWPIPCRAHLAJXNRZASAB" : vnpHashSecret.trim();

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));

        Map<String, String> vnpParams = new TreeMap<>();
        vnpParams.put("vnp_Version", "2.1.0");
        vnpParams.put("vnp_Command", "pay");
        vnpParams.put("vnp_TmnCode", effectiveTmn);
        vnpParams.put("vnp_Amount", String.valueOf(vnpAmount));
        vnpParams.put("vnp_CurrCode", "VND");
        vnpParams.put("vnp_TxnRef", txnRef);
        vnpParams.put("vnp_OrderInfo", orderInfo);
        vnpParams.put("vnp_OrderType", "other");
        vnpParams.put("vnp_Locale", "vn");
        vnpParams.put("vnp_ReturnUrl", vnpBillingReturnUrl);
        vnpParams.put("vnp_IpAddr", "127.0.0.1");
        vnpParams.put("vnp_CreateDate", now.format(fmt));
        vnpParams.put("vnp_ExpireDate", now.plusMinutes(15).format(fmt));

        StringBuilder hashData = new StringBuilder();
        StringBuilder query = new StringBuilder();
        for (Map.Entry<String, String> entry : vnpParams.entrySet()) {
            if (!hashData.isEmpty()) {
                hashData.append('&');
                query.append('&');
            }
            String encodedKey = URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8);
            String encodedVal = URLEncoder.encode(entry.getValue() != null ? entry.getValue() : "", StandardCharsets.UTF_8);
            hashData.append(entry.getKey()).append('=').append(encodedVal);
            query.append(encodedKey).append('=').append(encodedVal);
        }

        String secureHash = hmacSha512Hex(effectiveSecret, hashData.toString());
        return vnpPayUrl + "?" + query + "&vnp_SecureHash=" + secureHash;
    }

    private String hmacSha512Hex(String key, String data) {
        try {
            Mac hmac512 = Mac.getInstance("HmacSHA512");
            SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA512");
            hmac512.init(secretKey);
            byte[] bytes = hmac512.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                sb.append(String.format("%02x", b & 0xff));
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    @Override
    @Transactional
    public InvoiceDetailDto getInvoiceDetail(Integer invoiceId, Integer callerAccountId, String callerRole) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hóa đơn có ID: " + invoiceId));
        Folio folio = invoice.getFolio();
        GuestStay stay = folio.getGuestStay();

        if (RoleName.CUSTOMER.name().equalsIgnoreCase(callerRole)) {
            Reservation r = stay.getReservation();
            if (r.getCustomer() == null || r.getCustomer().getAccount() == null
                    || !r.getCustomer().getAccount().getAccountId().equals(callerAccountId)) {
                throw new BusinessException("BR-UNAUTHORIZED", "Báº¡n khÃ´ng cÃ³ quyá»n xem hÃ³a Ä‘Æ¡n cá»§a khÃ¡ch hÃ ng khÃ¡c.");
            }
        }

        return buildInvoiceDetailDto(invoice, folio, stay, null, callerAccountId, null);
    }

    @Override
    @Transactional
    public InvoiceDetailDto getInvoiceDetailByStay(Integer stayId, Integer callerAccountId, String callerRole) {
        GuestStay stay = guestStayRepository.findById(stayId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin lưu trú cho stayId: " + stayId));
        Folio folio = folioRepository.findByGuestStay_StayId(stayId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Folio cho stayId: " + stayId));

        if (RoleName.CUSTOMER.name().equalsIgnoreCase(callerRole)) {
            Reservation r = stay.getReservation();
            if (r.getCustomer() == null || r.getCustomer().getAccount() == null
                    || !r.getCustomer().getAccount().getAccountId().equals(callerAccountId)) {
                throw new BusinessException("BR-UNAUTHORIZED", "Bạn không có quyền xem hóa đơn của khách hàng khác.");
            }
        }

        // Đồng bộ trạng thái Folio nếu có phát sinh gia hạn mới
        buildFolioDetailDto(folio, stay);

        Invoice invoice = invoiceRepository.findByFolio_FolioId(folio.getFolioId()).orElse(null);
        if (invoice == null || !FOLIO_CLOSED.equalsIgnoreCase(folio.getStatus())
                || !InvoiceStatus.PAID.name().equalsIgnoreCase(invoice.getStatus())) {
            return buildProformaInvoiceDetailDto(folio, stay, callerAccountId);
        }

        return buildInvoiceDetailDto(invoice, folio, stay, null, callerAccountId, null);
    }

    private InvoiceDetailDto buildProformaInvoiceDetailDto(Folio folio, GuestStay stay, Integer callerAccountId) {
        FolioDetailDto folioDetail = buildFolioDetailDto(folio, stay);
        Reservation res = stay.getReservation();
        Customer cust = res != null ? res.getCustomer() : null;

        String cashierName = "Lễ tân HMS";
        if (callerAccountId != null) {
            Optional<Staff> s = staffRepository.findByAccount_AccountId(callerAccountId);
            if (s.isPresent() && s.get().getFullName() != null && !s.get().getFullName().isBlank()) {
                cashierName = s.get().getFullName();
            } else {
                Optional<Account> acc = accountRepository.findById(callerAccountId);
                if (acc.isPresent()) {
                    cashierName = acc.get().getEmail();
                }
            }
        }

        BigDecimal subtotal = folioDetail.getSubtotal();
        BigDecimal discount = BigDecimal.ZERO;
        BigDecimal taxable = subtotal;
        BigDecimal tax = folioDetail.getEstimatedTax();
        BigDecimal deposit = folioDetail.getDepositPaid();
        BigDecimal finalAmt = folioDetail.getEstimatedBalance();

        return InvoiceDetailDto.builder()
                .invoiceId(null)
                .invoiceCode("PROFORMA-P" + folioDetail.getRoomNumber())
                .issueDate(Instant.now())
                .status("DRAFT")
                .folioId(folio.getFolioId())
                .stayId(stay.getStayId())
                .reservationCode(res != null ? res.getReservationCode() : "N/A")
                .guestName(cust != null ? cust.getFullName() : (res != null ? res.getContactName() : "Khách lưu trú"))
                .guestPhone(cust != null && cust.getPhone() != null ? cust.getPhone() : (res != null ? res.getContactPhone() : ""))
                .guestEmail(cust != null && cust.getEmail() != null ? cust.getEmail() : (res != null ? res.getContactEmail() : ""))
                .guestIdNumber(cust != null ? cust.getIdentityNumber() : "")
                .roomNumber(folioDetail.getRoomNumber())
                .roomTypeName(folioDetail.getRoomTypeName())
                .checkInDate(folioDetail.getCheckInDate())
                .checkOutDate(folioDetail.getCheckOutDate())
                .actualCheckIn(stay.getActualCheckIn())
                .actualCheckOut(stay.getActualCheckOut())
                .specialNotes(res != null ? res.getSpecialNotes() : null)
                .roomNights(folioDetail.getRoomNights())
                .serviceOrders(folioDetail.getServiceOrders())
                .additionalCharges(folioDetail.getAdditionalCharges())
                .roomSubtotal(folioDetail.getRoomSubtotal())
                .serviceSubtotal(folioDetail.getServiceSubtotal())
                .additionalSubtotal(folioDetail.getAdditionalSubtotal())
                .totalAmount(subtotal)
                .voucherCode(null)
                .discountAmount(discount)
                .taxableAmount(taxable)
                .taxRate(new BigDecimal("8"))
                .taxAmount(tax)
                .depositDeducted(deposit)
                .finalAmount(finalAmt)
                .paymentMethod("CHƯA QUYẾT TOÁN (TẠM TÍNH)")
                .amountPaid(BigDecimal.ZERO)
                .paidAt(null)
                .cashierName(cashierName)
                .notes("BẢNG KÊ HÓA ĐƠN TẠM TÍNH (PROFORMA INVOICE) - DÙNG ĐỐI SOÁT TRƯỚC KHI QUYẾT TOÁN")
                .build();
    }

    // ------------------------------------------------------------------ Internal Helpers for Folio & Invoices

    private FolioDetailDto buildFolioDetailDto(Folio folio, GuestStay stay) {
        Reservation res = stay.getReservation();
        Customer cust = res != null ? res.getCustomer() : null;
        String roomNumber = "N/A";
        String roomTypeName = "N/A";

        if (stay.getRoomAssignments() != null && !stay.getRoomAssignments().isEmpty()) {
            Room r = stay.getRoomAssignments().getLast().getRoom();
            if (r != null) {
                roomNumber = r.getRoomNumber();
                if (r.getRoomType() != null) {
                    roomTypeName = r.getRoomType().getTypeName();
                }
            }
        }
        if ("N/A".equals(roomTypeName) && res != null && res.getDetails() != null && !res.getDetails().isEmpty()) {
            if (res.getDetails().get(0).getRoomType() != null) {
                roomTypeName = res.getDetails().get(0).getRoomType().getTypeName();
            }
        }

        LocalDate checkInDate = res != null ? res.getCheckInDate() : null;
        LocalDate checkOutDate = res != null ? res.getCheckOutDate() : null;
        if (checkInDate == null && stay.getActualCheckIn() != null) {
            checkInDate = stay.getActualCheckIn().atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate();
        }
        if (checkOutDate == null && stay.getActualCheckOut() != null) {
            checkOutDate = stay.getActualCheckOut().atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate();
        } else if (checkOutDate == null && checkInDate != null) {
            checkOutDate = checkInDate.plusDays(1);
        }

        // 1. Room Nights (Đồng bộ 100% số ngày lưu trú từ checkInDate -> checkOutDate mới nhất khi Thành viên 4 gia hạn / đổi phòng)
        List<RoomNightItemDto> roomNights = buildSynchronizedRoomNights(stay, res, checkInDate, checkOutDate, roomTypeName);
        BigDecimal roomSubtotal = roomNights.stream()
                .map(RoomNightItemDto::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 2. Service Orders (Only COMPLETED)
        List<ServiceOrder> orders = serviceOrderRepository.findByGuestStay_StayIdOrderByOrderTimeDesc(stay.getStayId());
        List<ServiceOrderDto> serviceOrders = orders.stream()
                .filter(o -> ServiceOrderStatus.COMPLETED.name().equalsIgnoreCase(o.getStatus()))
                .map(this::toDto)
                .toList();
        BigDecimal serviceSubtotal = serviceOrders.stream()
                .map(ServiceOrderDto::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 3. Additional Charges (Đồng bộ tự động phụ thu đổi/nâng hạng phòng từ Stay_Room_Assignment của Thành viên 4)
        syncRoomTransferCharges(stay, folio);
        List<AdditionalCharge> charges = additionalChargeRepository.findByFolio_FolioId(folio.getFolioId());
        List<AdditionalChargeDto> additionalCharges = charges.stream()
                .filter(c -> !"CANCELLED".equalsIgnoreCase(c.getStatus()) && !"VOID".equalsIgnoreCase(c.getStatus()))
                .map(this::toAdditionalChargeDto)
                .toList();
        BigDecimal additionalSubtotal = additionalCharges.stream()
                .map(AdditionalChargeDto::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal subtotal = roomSubtotal.add(serviceSubtotal).add(additionalSubtotal);
        Invoice inv = invoiceRepository.findByFolio_FolioId(folio.getFolioId()).orElse(null);

        // Nếu Folio đã CLOSED nhưng sau đó Thành viên 4 lại gia hạn thêm ngày (subtotal mới > inv.totalAmount đã thu) -> Mở lại Folio
        if (FOLIO_CLOSED.equalsIgnoreCase(folio.getStatus()) && inv != null && inv.getTotalAmount() != null) {
            if (subtotal.compareTo(inv.getTotalAmount()) > 0) {
                folio.setStatus("OPEN");
                folioRepository.save(folio);
            } else if (folio.getTotalAmount() != null && folio.getTotalAmount().compareTo(BigDecimal.ZERO) > 0) {
                folio.setTotalAmount(BigDecimal.ZERO);
                folioRepository.save(folio);
            }
        }

        // 4. Deposit Payments (PAID) + Các khoản đã thanh toán trước đó nếu mở lại Folio sau khi gia hạn
        List<Payment> allPayments = res != null
                ? paymentRepository.findByReservation_ReservationId(res.getReservationId())
                : List.of();
        boolean isReopenedFolio = !FOLIO_CLOSED.equalsIgnoreCase(folio.getStatus());
        List<DepositPaymentDto> depositPayments = allPayments.stream()
                .filter(p -> PaymentStatus.PAID.name().equalsIgnoreCase(p.getStatus())
                        && ("DEPOSIT".equalsIgnoreCase(p.getPaymentType())
                        || (isReopenedFolio && "SETTLEMENT".equalsIgnoreCase(p.getPaymentType())
                                && p.getInvoice() != null && inv != null && inv.getInvoiceId().equals(p.getInvoice().getInvoiceId()))))
                .map(p -> DepositPaymentDto.builder()
                        .paymentId(p.getPaymentId())
                        .amount(p.getAmount())
                        .paymentType(p.getPaymentType())
                        .method(p.getMethod())
                        .status(p.getStatus())
                        .paidAt(p.getPaidAt())
                        .build())
                .toList();
        BigDecimal depositPaid = depositPayments.stream()
                .map(DepositPaymentDto::getAmount)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .max(BigDecimal.ZERO)
                .setScale(0, RoundingMode.HALF_UP);

        BigDecimal taxRate = new BigDecimal("8");
        BigDecimal estimatedTax = subtotal.multiply(new BigDecimal("0.08")).setScale(0, RoundingMode.HALF_UP);
        BigDecimal estimatedTotal = subtotal.add(estimatedTax).setScale(0, RoundingMode.HALF_UP);
        BigDecimal estimatedBalance = estimatedTotal.subtract(depositPaid).max(BigDecimal.ZERO).setScale(0, RoundingMode.HALF_UP);

        if (!FOLIO_CLOSED.equalsIgnoreCase(folio.getStatus())) {
            if (folio.getTotalAmount() == null || folio.getTotalAmount().compareTo(estimatedBalance) != 0) {
                folio.setTotalAmount(estimatedBalance);
                folioRepository.save(folio);
            }
        }

        Integer invId = null;
        String invCode = null;
        String invStatus = null;
        String voucherCode = null;
        BigDecimal discountAmt = BigDecimal.ZERO;
        BigDecimal settledAmt = null;
        String paymentMethod = null;
        Instant settledAt = null;

        if (inv != null && FOLIO_CLOSED.equalsIgnoreCase(folio.getStatus())) {
            invId = inv.getInvoiceId();
            invCode = inv.getInvoiceCode();
            invStatus = inv.getStatus();
            discountAmt = inv.getDiscountAmount();
            settledAmt = inv.getFinalAmount();
            if (inv.getVoucher() != null) {
                voucherCode = inv.getVoucher().getCode();
            }
            List<Payment> invPayments = paymentRepository.findByInvoice_InvoiceId(inv.getInvoiceId());
            Payment settlePayment = invPayments.stream()
                    .filter(p -> "SETTLEMENT".equalsIgnoreCase(p.getPaymentType()) && PaymentStatus.PAID.name().equalsIgnoreCase(p.getStatus()))
                    .reduce((first, second) -> second)
                    .orElseGet(() -> invPayments.stream()
                            .filter(p -> "SETTLEMENT".equalsIgnoreCase(p.getPaymentType()))
                            .reduce((first, second) -> second)
                            .orElse(null));
            if (settlePayment != null) {
                paymentMethod = settlePayment.getMethod();
                settledAt = settlePayment.getPaidAt();
            }
        }

        return FolioDetailDto.builder()
                .folioId(folio.getFolioId())
                .stayId(stay.getStayId())
                .folioStatus(folio.getStatus())
                .reservationId(res != null ? res.getReservationId() : null)
                .reservationCode(res != null ? res.getReservationCode() : "N/A")
                .roomNumber(roomNumber)
                .roomTypeName(roomTypeName)
                .guestName(cust != null ? cust.getFullName() : (res != null ? res.getContactName() : "N/A"))
                .guestPhone(cust != null && cust.getPhone() != null ? cust.getPhone() : (res != null ? res.getContactPhone() : ""))
                .guestEmail(cust != null && cust.getEmail() != null ? cust.getEmail() : (res != null ? res.getContactEmail() : ""))
                .guestIdNumber(cust != null ? cust.getIdentityNumber() : "")
                .checkInDate(checkInDate)
                .checkOutDate(checkOutDate)
                .actualCheckIn(stay.getActualCheckIn())
                .actualCheckOut(stay.getActualCheckOut())
                .specialNotes(res != null ? res.getSpecialNotes() : null)
                .roomNights(roomNights)
                .serviceOrders(serviceOrders)
                .additionalCharges(additionalCharges)
                .depositPayments(depositPayments)
                .roomSubtotal(roomSubtotal)
                .serviceSubtotal(serviceSubtotal)
                .additionalSubtotal(additionalSubtotal)
                .subtotal(subtotal)
                .depositPaid(depositPaid)
                .taxRate(taxRate)
                .estimatedTax(estimatedTax)
                .estimatedTotal(estimatedTotal)
                .estimatedBalance(estimatedBalance)
                .invoiceId(invId)
                .invoiceCode(invCode)
                .invoiceStatus(invStatus)
                .voucherCode(voucherCode)
                .discountAmount(discountAmt)
                .settledAmount(settledAmt)
                .paymentMethod(paymentMethod)
                .settledAt(settledAt)
                .build();
    }

    private InvoiceDetailDto buildInvoiceDetailDto(Invoice invoice, Folio folio, GuestStay stay, Payment payment, Integer callerAccountId, String notes) {
        FolioDetailDto folioDetail = buildFolioDetailDto(folio, stay);
        Reservation res = stay.getReservation();
        Customer cust = res != null ? res.getCustomer() : null;

        String cashierName = "Lễ tân HMS";
        if (callerAccountId != null) {
            Optional<Staff> s = staffRepository.findByAccount_AccountId(callerAccountId);
            if (s.isPresent() && s.get().getFullName() != null && !s.get().getFullName().isBlank()) {
                cashierName = s.get().getFullName();
            } else {
                Optional<Account> acc = accountRepository.findById(callerAccountId);
                if (acc.isPresent()) {
                    cashierName = acc.get().getEmail();
                }
            }
        }

        List<Payment> invPayments = paymentRepository.findByInvoice_InvoiceId(invoice.getInvoiceId());
        List<Payment> paidSettlements = invPayments.stream()
                .filter(p -> "SETTLEMENT".equalsIgnoreCase(p.getPaymentType()) && PaymentStatus.PAID.name().equalsIgnoreCase(p.getStatus()))
                .toList();

        if (payment == null) {
            payment = !paidSettlements.isEmpty()
                    ? paidSettlements.get(paidSettlements.size() - 1)
                    : invPayments.stream()
                            .filter(p -> "SETTLEMENT".equalsIgnoreCase(p.getPaymentType()))
                            .reduce((first, second) -> second)
                            .orElse(null);
        }

        String paymentMethod = payment != null ? payment.getMethod() : "CASH";
        BigDecimal paidAmount = !paidSettlements.isEmpty()
                ? paidSettlements.stream().map(Payment::getAmount).filter(java.util.Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add)
                : (payment != null ? payment.getAmount() : invoice.getFinalAmount());
        Instant paidTime = payment != null ? payment.getPaidAt() : invoice.getIssueDate();

        BigDecimal subtotal = invoice.getTotalAmount() != null ? invoice.getTotalAmount() : folioDetail.getSubtotal();
        BigDecimal discount = invoice.getDiscountAmount() != null ? invoice.getDiscountAmount() : BigDecimal.ZERO;
        BigDecimal taxable = subtotal.subtract(discount).max(BigDecimal.ZERO);
        BigDecimal tax = invoice.getTaxAmount() != null ? invoice.getTaxAmount().setScale(0, RoundingMode.HALF_UP) : taxable.multiply(new BigDecimal("0.08")).setScale(0, RoundingMode.HALF_UP);
        BigDecimal deposit = folioDetail.getDepositPaid();
        BigDecimal finalAmt = invoice.getFinalAmount() != null ? invoice.getFinalAmount().setScale(0, RoundingMode.HALF_UP) : taxable.add(tax).setScale(0, RoundingMode.HALF_UP);

        return InvoiceDetailDto.builder()
                .invoiceId(invoice.getInvoiceId())
                .invoiceCode(invoice.getInvoiceCode())
                .issueDate(invoice.getIssueDate())
                .status(invoice.getStatus())
                .folioId(folio.getFolioId())
                .stayId(stay.getStayId())
                .reservationCode(res != null ? res.getReservationCode() : "N/A")
                .guestName(cust != null ? cust.getFullName() : (res != null ? res.getContactName() : "Khách lưu trú"))
                .guestPhone(cust != null && cust.getPhone() != null ? cust.getPhone() : (res != null ? res.getContactPhone() : ""))
                .guestEmail(cust != null && cust.getEmail() != null ? cust.getEmail() : (res != null ? res.getContactEmail() : ""))
                .guestIdNumber(cust != null ? cust.getIdentityNumber() : "")
                .roomNumber(folioDetail.getRoomNumber())
                .roomTypeName(folioDetail.getRoomTypeName())
                .checkInDate(folioDetail.getCheckInDate())
                .checkOutDate(folioDetail.getCheckOutDate())
                .actualCheckIn(stay.getActualCheckIn())
                .actualCheckOut(stay.getActualCheckOut())
                .specialNotes(res != null ? res.getSpecialNotes() : null)
                .roomNights(folioDetail.getRoomNights())
                .serviceOrders(folioDetail.getServiceOrders())
                .additionalCharges(folioDetail.getAdditionalCharges())
                .roomSubtotal(folioDetail.getRoomSubtotal())
                .serviceSubtotal(folioDetail.getServiceSubtotal())
                .additionalSubtotal(folioDetail.getAdditionalSubtotal())
                .totalAmount(subtotal)
                .voucherCode(invoice.getVoucher() != null ? invoice.getVoucher().getCode() : null)
                .discountAmount(discount)
                .taxableAmount(taxable)
                .taxRate(new BigDecimal("8"))
                .taxAmount(tax)
                .depositDeducted(deposit)
                .finalAmount(finalAmt)
                .paymentMethod(paymentMethod)
                .amountPaid(paidAmount)
                .paidAt(paidTime)
                .cashierName(cashierName)
                .notes(notes)
                .build();
    }

    private AdditionalChargeDto toAdditionalChargeDto(AdditionalCharge c) {
        String staffName = "Hệ thống";
        if (c.getCreatedByAccount() != null) {
            staffName = c.getCreatedByAccount().getEmail();
            Optional<Staff> s = staffRepository.findByAccount_AccountId(c.getCreatedByAccount().getAccountId());
            if (s.isPresent() && s.get().getFullName() != null && !s.get().getFullName().isBlank()) {
                staffName = s.get().getFullName();
            }
        }
        return AdditionalChargeDto.builder()
                .additionalChargeId(c.getAdditionalChargeId())
                .folioId(c.getFolio().getFolioId())
                .chargeType(c.getChargeType())
                .description(c.getDescription())
                .amount(c.getAmount())
                .createdByStaffName(staffName)
                .createdAt(c.getCreatedAt())
                .status(c.getStatus())
                .build();
    }

    // ------------------------------------------------------------------ Pre-order before check-in

    @Override
    @Transactional
    public String savePreOrderToNotes(PreOrderRequest request, Integer callerAccountId, String callerRole) {
        Reservation reservation = reservationRepository.findById(request.getReservationId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng."));

        if ("CUSTOMER".equals(callerRole)) {
            Customer customer = reservation.getCustomer();
            if (customer == null || customer.getAccount() == null
                    || !customer.getAccount().getAccountId().equals(callerAccountId)) {
                throw new BusinessException("AUTH_FORBIDDEN", "Quý khách không có quyền thao tác trên đơn đặt phòng này.");
            }
        }

        HotelService service = findService(request.getServiceId());

        String timeStr = request.getScheduledTime() != null && !request.getScheduledTime().isBlank()
                ? request.getScheduledTime().trim() : "Trước khi nhận phòng";
        String detailStr = request.getDetails() != null && !request.getDetails().isBlank()
                ? request.getDetails().trim() : "Không";

        String preOrderEntry = String.format("[ĐẶT TRƯỚC] %s (Mã DV: %d) | SL: %d | Thời gian: %s | Chi tiết: %s",
                service.getServiceName(),
                service.getServiceId(),
                request.getQuantity(),
                timeStr,
                detailStr);

        String oldNotes = reservation.getSpecialNotes();
        if (oldNotes == null || oldNotes.isBlank()) {
            reservation.setSpecialNotes(preOrderEntry);
        } else {
            reservation.setSpecialNotes(oldNotes + "\n" + preOrderEntry);
        }

        reservationRepository.save(reservation);
        return reservation.getSpecialNotes();
    }

    @Override
    @Transactional
    public String cancelPreOrderFromNotes(Integer reservationId, Integer serviceId, Integer callerAccountId, String callerRole) {
        return cancelPreOrderFromNotes(reservationId, serviceId, null, null, null, callerAccountId, callerRole);
    }

    @Override
    @Transactional
    public String cancelPreOrderFromNotes(Integer reservationId, Integer serviceId, Integer itemIndex, Integer cancelQuantity, Integer callerAccountId, String callerRole) {
        return cancelPreOrderFromNotes(reservationId, serviceId, itemIndex, cancelQuantity, null, callerAccountId, callerRole);
    }

    @Override
    @Transactional
    public String cancelPreOrderFromNotes(Integer reservationId, Integer serviceId, Integer itemIndex, Integer cancelQuantity, String cancelReason, Integer callerAccountId, String callerRole) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng."));

        if (cancelReason == null || cancelReason.isBlank()) {
            throw new BusinessException("CANCEL_REASON_REQUIRED", "Vui lòng nhập lý do hủy dịch vụ đặt trước.");
        }

        if ("CUSTOMER".equalsIgnoreCase(callerRole)) {
            Customer customer = reservation.getCustomer();
            if (customer == null || customer.getAccount() == null
                    || !customer.getAccount().getAccountId().equals(callerAccountId)) {
                throw new BusinessException("AUTH_FORBIDDEN", "Quý khách không có quyền thao tác trên đơn đặt phòng này.");
            }
        }

        Optional<GuestStay> stayOpt = guestStayRepository.findByReservation_ReservationId(reservationId);
        if (stayOpt.isPresent()) {
            GuestStay stay = stayOpt.get();
            Folio folio = folioRepository.findByGuestStay_StayId(stay.getStayId()).orElse(null);
            if (folio != null && FOLIO_CLOSED.equalsIgnoreCase(folio.getStatus())) {
                throw new BusinessException("FOLIO_ALREADY_CLOSED", "Kỳ lưu trú đã quyết toán và đóng hóa đơn, không thể hủy dịch vụ đặt trước.");
            }
        }

        String notes = reservation.getSpecialNotes();
        if (notes == null || notes.isBlank()) {
            return "Đã hủy dịch vụ đặt trước thành công.";
        }

        String[] lines = notes.split("\n");
        java.util.regex.Pattern idPattern = java.util.regex.Pattern.compile("Mã DV:\\s*(\\d+)");
        java.util.regex.Pattern qtyPattern = java.util.regex.Pattern.compile("SL:\\s*(\\d+)");
        java.util.regex.Pattern timePattern = java.util.regex.Pattern.compile("Thời gian:\\s*([^|]+)");
        java.util.regex.Pattern detailPattern = java.util.regex.Pattern.compile("Chi tiết:\\s*(.+)$");

        // 1. Phân tích toàn bộ các dòng [ĐẶT TRƯỚC] theo đúng thứ tự
        List<Integer> preOrderLineIndices = new ArrayList<>();
        List<Integer> preOrderServiceIds = new ArrayList<>();
        List<String> preOrderTimes = new ArrayList<>();
        List<String> preOrderDetails = new ArrayList<>();

        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            if (line.contains("[ĐẶT TRƯỚC]")) {
                preOrderLineIndices.add(i);
                java.util.regex.Matcher idM = idPattern.matcher(line);
                preOrderServiceIds.add(idM.find() ? Integer.parseInt(idM.group(1)) : -1);
                java.util.regex.Matcher timeM = timePattern.matcher(line);
                preOrderTimes.add(timeM.find() ? timeM.group(1).trim() : "");
                java.util.regex.Matcher detailM = detailPattern.matcher(line);
                preOrderDetails.add(detailM.find() ? detailM.group(1).trim() : "");
            }
        }

        // 2. Xác định đúng vị trí lượt đặt trước cần hủy (targetPreOrderIdx)
        int targetPreOrderIdx = -1;
        for (int pIdx = 0; pIdx < preOrderLineIndices.size(); pIdx++) {
            boolean isServiceMatch = preOrderServiceIds.get(pIdx).equals(serviceId);
            boolean isIndexMatch = (itemIndex == null) || (pIdx == itemIndex);
            if (isServiceMatch && isIndexMatch) {
                targetPreOrderIdx = pIdx;
                break;
            }
        }

        if (targetPreOrderIdx == -1) {
            return "Đã hủy dịch vụ đặt trước thành công.";
        }

        // 3. Nếu khách đã nhận phòng (GuestStay), đối chiếu 1-1 các lượt [ĐẶT TRƯỚC] với các đơn có thẻ [Đặt trước]
        // Tuyệt đối KHÔNG lấy các đơn dịch vụ gọi tại phòng thông thường (không có [Đặt trước]) để chặn hủy đặt trước!
        ServiceOrder matchedOrderForTarget = null;
        if (stayOpt.isPresent()) {
            GuestStay stay = stayOpt.get();
            List<ServiceOrder> preOrderStayOrders = serviceOrderRepository.findByGuestStay_StayIdOrderByOrderTimeDesc(stay.getStayId())
                    .stream()
                    .filter(o -> !ServiceOrderStatus.VOIDED.name().equalsIgnoreCase(o.getStatus()))
                    .filter(o -> {
                        String raw = o.getCancelReason();
                        if (raw == null) return false;
                        String lower = raw.toLowerCase();
                        return lower.contains("[đặt trước") || lower.contains("[dat truoc");
                    })
                    .toList();

            java.util.Set<Integer> usedOrderIds = new java.util.HashSet<>();
            java.util.Map<Integer, ServiceOrder> matchedByPreOrderIdx = new java.util.HashMap<>();

            // Bước 3a: Khớp chính xác theo thẻ [Đặt trước #idx] hoặc (Giờ hẹn & Yêu cầu)
            for (int pIdx = 0; pIdx < preOrderLineIndices.size(); pIdx++) {
                Integer pServiceId = preOrderServiceIds.get(pIdx);
                String pTime = preOrderTimes.get(pIdx);
                String pDetail = preOrderDetails.get(pIdx);
                String legacyTag = "[Đặt trước #" + (pIdx + 1) + "]";
                String timeTag = (!pTime.isEmpty() && !"Không".equalsIgnoreCase(pTime)) ? "Giờ hẹn: " + pTime : null;
                String detailTag = (!pDetail.isEmpty() && !"Không".equalsIgnoreCase(pDetail)) ? "Yêu cầu: " + pDetail : null;

                for (ServiceOrder o : preOrderStayOrders) {
                    if (usedOrderIds.contains(o.getServiceOrderId())) continue;
                    if (o.getHotelService() == null || !o.getHotelService().getServiceId().equals(pServiceId)) continue;
                    String raw = o.getCancelReason() != null ? o.getCancelReason() : "";
                    boolean isExact = raw.contains(legacyTag)
                            || ((timeTag == null || raw.contains(timeTag)) && (detailTag == null || raw.contains(detailTag)));
                    if (isExact) {
                        usedOrderIds.add(o.getServiceOrderId());
                        matchedByPreOrderIdx.put(pIdx, o);
                        break;
                    }
                }
            }

            // Bước 3b: Khớp dự phòng theo thứ tự thời gian cho các đơn [Đặt trước] còn lại
            List<ServiceOrder> chronologicalPreOrders = new ArrayList<>(preOrderStayOrders);
            chronologicalPreOrders.sort(java.util.Comparator.comparingInt(o -> o.getServiceOrderId() != null ? o.getServiceOrderId() : 0));
            for (int pIdx = 0; pIdx < preOrderLineIndices.size(); pIdx++) {
                if (matchedByPreOrderIdx.containsKey(pIdx)) continue;
                Integer pServiceId = preOrderServiceIds.get(pIdx);
                for (ServiceOrder o : chronologicalPreOrders) {
                    if (usedOrderIds.contains(o.getServiceOrderId())) continue;
                    if (o.getHotelService() != null && o.getHotelService().getServiceId().equals(pServiceId)) {
                        usedOrderIds.add(o.getServiceOrderId());
                        matchedByPreOrderIdx.put(pIdx, o);
                        break;
                    }
                }
            }

            matchedOrderForTarget = matchedByPreOrderIdx.get(targetPreOrderIdx);
        }

        // 4. Kiểm tra trạng thái của lượt đặt trước mục tiêu: Chỉ được hủy khi CHƯA XÁC NHẬN / CHƯA HOÀN THÀNH
        if (matchedOrderForTarget != null) {
            if (ServiceOrderStatus.COMPLETED.name().equalsIgnoreCase(matchedOrderForTarget.getStatus())) {
                throw new BusinessException("PREORDER_ALREADY_COMPLETED",
                        "Lượt dịch vụ đặt trước này đã hoàn thành và tính vào tiền phòng, không thể hủy.");
            }
            if (isOrderConfirmedByStaff(matchedOrderForTarget)) {
                throw new BusinessException("ORDER_ALREADY_CONFIRMED",
                        "Lượt dịch vụ đặt trước này đã được nhân viên xác nhận chuyển sang chờ phục vụ, không thể hủy.");
            }
            // Nếu đơn liên kết đang ở trạng thái ORDERED nhưng chưa xác nhận -> hủy luôn đơn đó
            matchedOrderForTarget.setStatus(ServiceOrderStatus.VOIDED.name());
            matchedOrderForTarget.setCancelledAt(Instant.now());
            matchedOrderForTarget.setCancelledByStaff(findStaff(callerAccountId));
            String curNotes = matchedOrderForTarget.getCancelReason();
            String voidText = "[HỦY TỪ LỊCH ĐẶT TRƯỚC] " + cancelReason.trim();
            if (curNotes != null && curNotes.contains("[GHI CHÚ] ")) {
                int noteStart = curNotes.indexOf("[GHI CHÚ] ");
                String existingNotes = curNotes.contains(" || [HỦY] ")
                        ? curNotes.substring(noteStart, curNotes.indexOf(" || [HỦY] "))
                        : curNotes.substring(noteStart);
                matchedOrderForTarget.setCancelReason(existingNotes + " || [HỦY] " + voidText);
            } else {
                matchedOrderForTarget.setCancelReason(voidText);
            }
            serviceOrderRepository.save(matchedOrderForTarget);
        }

        // 5. Cập nhật lại danh sách specialNotes (giảm số lượng hoặc xóa dòng đặt trước đã hủy)
        int targetLineIndexInNotes = preOrderLineIndices.get(targetPreOrderIdx);
        List<String> updatedLines = new ArrayList<>();
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            if (i == targetLineIndexInNotes) {
                java.util.regex.Matcher m = qtyPattern.matcher(line);
                int lineQty = m.find() ? Integer.parseInt(m.group(1)) : 1;
                int qtyToCancel = (cancelQuantity != null && cancelQuantity > 0)
                        ? Math.min(cancelQuantity, lineQty)
                        : lineQty;
                if (qtyToCancel < lineQty) {
                    int newQty = lineQty - qtyToCancel;
                    String updatedLine = line.replaceFirst("SL:\\s*\\d+", "SL: " + newQty);
                    updatedLines.add(updatedLine);
                }
                // Nếu qtyToCancel >= lineQty thì xóa dòng này khỏi danh sách đặt trước
            } else {
                updatedLines.add(line);
            }
        }

        String updatedNotes = String.join("\n", updatedLines).trim();
        reservation.setSpecialNotes(updatedNotes.isEmpty() ? null : updatedNotes);
        reservationRepository.save(reservation);

        return "Đã hủy dịch vụ đặt trước thành công.";
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReservationDto> getMyConfirmedReservations(Integer callerAccountId) {
        if (callerAccountId == null) {
            return java.util.Collections.emptyList();
        }
        Customer customer = customerRepository.findByAccount_AccountId(callerAccountId).orElse(null);
        if (customer == null) {
            return java.util.Collections.emptyList();
        }

        return reservationRepository.findByCustomer_CustomerIdOrderByReservationDateDesc(customer.getCustomerId())
                .stream()
                .filter(r -> "CONFIRMED".equalsIgnoreCase(r.getStatus())
                        || ("CHECKED_IN".equalsIgnoreCase(r.getStatus())
                                && r.getSpecialNotes() != null
                                && r.getSpecialNotes().contains("[ĐẶT TRƯỚC]")))
                .map(this::toReservationDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReservationDto> getAllUpcomingPreOrders() {
        return reservationRepository.findAll().stream()
                .filter(r -> r.getSpecialNotes() != null && r.getSpecialNotes().contains("[ĐẶT TRƯỚC]"))
                .filter(r -> !"CANCELLED".equalsIgnoreCase(r.getStatus()))
                .sorted((r1, r2) -> {
                    if (r1.getCheckInDate() == null || r2.getCheckInDate() == null) return 0;
                    return r1.getCheckInDate().compareTo(r2.getCheckInDate());
                })
                .map(this::toReservationDto)
                .toList();
    }

    private ReservationDto toReservationDto(Reservation r) {
        String roomTypeName = "Phòng tiêu chuẩn";
        if (r.getDetails() != null && !r.getDetails().isEmpty() && r.getDetails().get(0).getRoomType() != null) {
            roomTypeName = r.getDetails().get(0).getRoomType().getTypeName();
        }
        return ReservationDto.builder()
                .reservationId(r.getReservationId())
                .reservationCode(r.getReservationCode())
                .roomTypeName(roomTypeName)
                .checkInDate(r.getCheckInDate())
                .checkOutDate(r.getCheckOutDate())
                .guestCount(r.getGuestCount())
                .contactName(r.getContactName())
                .contactEmail(r.getContactEmail())
                .contactPhone(r.getContactPhone())
                .specialNotes(r.getSpecialNotes())
                .status(r.getStatus())
                .build();
    }
}
