successfully downloaded text file (SHA: 8f4df71a13dc63bde26580f012b04d2058a5acc2)package com.fpt.hms.service.impl;

import com.fpt.hms.common.MessageResolver;
import com.fpt.hms.dto.billing_report.HotelServiceRequest;
import com.fpt.hms.dto.billing_report.InvoiceDto;
import com.fpt.hms.dto.billing_report.PreOrderRequest;
import com.fpt.hms.dto.billing_report.ServiceOrderDto;
import com.fpt.hms.dto.billing_report.ServiceOrderRequest;
import com.fpt.hms.dto.booking.ReservationDto;
import com.fpt.hms.entity.*;
import com.fpt.hms.enums.GuestStayStatus;
import com.fpt.hms.enums.InvoiceStatus;
import com.fpt.hms.enums.PaymentStatus;
import com.fpt.hms.enums.ServiceOrderStatus;
import com.fpt.hms.exception.BusinessException;
import com.fpt.hms.exception.ResourceNotFoundException;
import com.fpt.hms.repository.*;
import com.fpt.hms.service.BillingService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
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

    private final HotelServiceRepository hotelServiceRepository;
    private final GuestStayRepository guestStayRepository;
    private final ServiceOrderRepository serviceOrderRepository;
    private final FolioRepository folioRepository;
    private final VoucherRepository voucherRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final StaffRepository staffRepository;
    private final ReservationRepository reservationRepository;
    private final CustomerRepository customerRepository;
    private final MessageResolver messageResolver;

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
            throw new BusinessException("INVALID_SERVICE_STATUS", "Tráº¡ng thÃ¡i dá»‹ch vá»¥ chá»‰ Ä‘Æ°á»£c lÃ  ACTIVE hoáº·c INACTIVE.");
        }
        HotelService service = findService(serviceId);
        service.setStatus(normalized);
        return hotelServiceRepository.save(service);
    }

    // ------------------------------------------------------------------ UC-35 / UC-36

    @Override
    @Transactional(readOnly = true)
    public List<com.fpt.hms.dto.billing_report.ActiveStaySelectDto> getActiveStaysForSelect() {
        return getActiveStaysForSelect(null, null);
    }

    @Override
    @Transactional(readOnly = true)
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
                    if (stay.getReservation() != null) {
                        resCode = stay.getReservation().getReservationCode();
                        if (stay.getReservation().getContactName() != null) {
                            guestName = stay.getReservation().getContactName();
                        } else if (stay.getReservation().getCustomer() != null) {
                            guestName = stay.getReservation().getCustomer().getFullName();
                        }
                    }
                    return com.fpt.hms.dto.billing_report.ActiveStaySelectDto.builder()
                            .stayId(stay.getStayId())
                            .roomNumber(roomNumber)
                            .guestName(guestName)
                            .reservationCode(resCode)
                            .specialNotes(stay.getReservation() != null ? stay.getReservation().getSpecialNotes() : null)
                            .build();
                })
                .toList();
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
                .orElseThrow(() -> new ResourceNotFoundException("KhÃ´ng tÃ¬m tháº¥y lÆ°á»£t lÆ°u trÃº."));

        if ("CUSTOMER".equals(callerRole) && !isStayOwner(stay, callerAccountId)) {
            throw new BusinessException("AUTH_FORBIDDEN", messageResolver.resolve("AUTH_FORBIDDEN"),
                    org.springframework.http.HttpStatus.FORBIDDEN);
        }
        if (!GuestStayStatus.ACTIVE.name().equalsIgnoreCase(stay.getStatus())) {
            throw new BusinessException("MSG11", messageResolver.resolve("MSG11"));
        }

        HotelService service = findService(request.getServiceId());
        if (!SERVICE_ACTIVE.equalsIgnoreCase(service.getStatus())) {
            throw new BusinessException("SERVICE_INACTIVE", "Dá»‹ch vá»¥ nÃ y Ä‘Ã£ ngá»«ng cung cáº¥p.");
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
            throw new BusinessException("ORDER_NOT_CONFIRMED", "Đơn dịch vụ của khách phải được nhân viên xác nhận chuyển sang chờ phục vụ trước khi hoàn thành.");
        }
        if (!ServiceOrderStatus.ORDERED.name().equals(order.getStatus())) {
            throw new BusinessException("SERVICE_ORDER_STATE", "Chá»‰ Ä‘Æ¡n dá»‹ch vá»¥ Ä‘ang chá» cung cáº¥p má»›i cÃ³ thá»ƒ hoÃ n thÃ nh.");
        }
        Folio folio = folioRepository.findByGuestStay_StayId(order.getGuestStay().getStayId())
                .orElseThrow(() -> new ResourceNotFoundException("KhÃ´ng tÃ¬m tháº¥y Folio cá»§a lÆ°á»£t lÆ°u trÃº."));
        if (FOLIO_CLOSED.equalsIgnoreCase(folio.getStatus())) {
            throw new BusinessException("FOLIO_CLOSED", "Folio Ä‘Ã£ Ä‘Ã³ng, khÃ´ng thá»ƒ ghi thÃªm phÃ­ dá»‹ch vá»¥.");
        }

        order.setStatus(ServiceOrderStatus.COMPLETED.name());
        order.setCompletedAt(Instant.now());
        if (order.getRecordedByStaff() == null) {
            order.setRecordedByStaff(findStaff(callerAccountId));
        }
        folio.setTotalAmount(folio.getTotalAmount().add(lineAmount(order)));
        try {
            folioRepository.saveAndFlush(folio);
        } catch (OptimisticLockingFailureException ex) {
            throw new BusinessException("FOLIO_CONFLICT", "Folio vá»«a Ä‘Æ°á»£c cáº­p nháº­t bá»Ÿi ngÆ°á»i khÃ¡c. Vui lÃ²ng thá»­ láº¡i.",
                    org.springframework.http.HttpStatus.CONFLICT);
        }
        return toDto(serviceOrderRepository.save(order));
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
            throw new BusinessException("CANCEL_REASON_REQUIRED", "Vui lÃ²ng nháº­p lÃ½ do há»§y dá»‹ch vá»¥.");
        }
        ServiceOrder order = findOrder(orderId);
        if ("CUSTOMER".equalsIgnoreCase(callerRole) && !isStayOwner(order.getGuestStay(), callerAccountId)) {
            throw new BusinessException("AUTH_FORBIDDEN", "Quý khách không có quyền hủy đơn dịch vụ của phòng này.",
                    org.springframework.http.HttpStatus.FORBIDDEN);
        }
        // UC-36: only services that have not been provided yet can be voided.
        if (!ServiceOrderStatus.ORDERED.name().equals(order.getStatus())) {
            throw new BusinessException("SERVICE_ORDER_STATE", "Chá»‰ Ä‘Æ°á»£c há»§y dá»‹ch vá»¥ chÆ°a cung cáº¥p.");
        }
        if (isOrderConfirmedByStaff(order)) {
            throw new BusinessException("ORDER_ALREADY_CONFIRMED",
                    "Đơn dịch vụ đã được nhân viên xác nhận chuyển sang chờ phục vụ, không thể hủy.");
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
                .orElseThrow(() -> new ResourceNotFoundException("KhÃ´ng tÃ¬m tháº¥y dá»‹ch vá»¥."));
    }

    private ServiceOrder findOrder(Integer orderId) {
        return serviceOrderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n dá»‹ch vá»¥."));
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
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                if (v.getMaxDiscountAmount().compareTo(BigDecimal.ZERO) > 0
                        && discount.compareTo(v.getMaxDiscountAmount()) > 0) {
                    discount = v.getMaxDiscountAmount();
                }
            } else {
                discount = v.getDiscountValue();
            }
            v.setUsedCount(v.getUsedCount() + 1);
            appliedVoucher = voucherRepository.save(v);
        }

        BigDecimal taxable = subtotal.subtract(discount).max(BigDecimal.ZERO);
        BigDecimal tax = taxable.multiply(new BigDecimal("0.08")).setScale(2, RoundingMode.HALF_UP);
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
        return cancelPreOrderFromNotes(reservationId, serviceId, null, null, callerAccountId, callerRole);
    }

    @Override
    @Transactional
    public String cancelPreOrderFromNotes(Integer reservationId, Integer serviceId, Integer itemIndex, Integer cancelQuantity, Integer callerAccountId, String callerRole) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng."));

        if ("CUSTOMER".equals(callerRole)) {
            Customer customer = reservation.getCustomer();
            if (customer == null || customer.getAccount() == null
                    || !customer.getAccount().getAccountId().equals(callerAccountId)) {
                throw new BusinessException("AUTH_FORBIDDEN", "Quý khách không có quyền thao tác trên đơn đặt phòng này.");
            }
        }

        String notes = reservation.getSpecialNotes();
        if (notes == null || notes.isBlank()) {
            return "Đã hủy dịch vụ đặt trước thành công.";
        }

        String[] lines = notes.split("\n");
        java.util.regex.Pattern qtyPattern = java.util.regex.Pattern.compile("SL:\\s*(\\d+)");

        int totalPreOrderedForService = 0;
        for (String line : lines) {
            if (line.contains("[ĐẶT TRƯỚC]") && line.contains("Mã DV: " + serviceId + ")")) {
                java.util.regex.Matcher m = qtyPattern.matcher(line);
                totalPreOrderedForService += m.find() ? Integer.parseInt(m.group(1)) : 1;
            }
        }

        int totalChargedOrOrdered = 0;
        java.util.Optional<GuestStay> stayOpt = guestStayRepository.findByReservation_ReservationId(reservationId);
        if (stayOpt.isPresent()) {
            GuestStay stay = stayOpt.get();
            totalChargedOrOrdered = serviceOrderRepository.findByGuestStay_StayIdOrderByOrderTimeDesc(stay.getStayId())
                    .stream()
                    .filter(o -> o.getHotelService() != null
                            && o.getHotelService().getServiceId().equals(serviceId)
                            && ("ORDERED".equalsIgnoreCase(o.getStatus()) || "COMPLETED".equalsIgnoreCase(o.getStatus())))
                    .mapToInt(o -> o.getQuantity() != null ? o.getQuantity() : 1)
                    .sum();
        }

        int unchargedRemaining = totalPreOrderedForService - totalChargedOrOrdered;

        java.util.List<String> updatedLines = new java.util.ArrayList<>();
        int currentPreOrderIdx = 0;
        boolean targetHandled = false;

        for (String line : lines) {
            if (line.contains("[ĐẶT TRƯỚC]")) {
                boolean isServiceMatch = line.contains("Mã DV: " + serviceId + ")");
                boolean isIndexMatch = (itemIndex == null) || (currentPreOrderIdx == itemIndex);

                if (!targetHandled && isServiceMatch && isIndexMatch) {
                    java.util.regex.Matcher m = qtyPattern.matcher(line);
                    int lineQty = m.find() ? Integer.parseInt(m.group(1)) : 1;
                    int qtyToCancel = (cancelQuantity != null && cancelQuantity > 0)
                            ? Math.min(cancelQuantity, lineQty)
                            : lineQty;

                    if (stayOpt.isPresent() && qtyToCancel > unchargedRemaining) {
                        throw new BusinessException("PREORDER_ALREADY_CHARGED",
                                "Dịch vụ này đã được nạp vào phòng / Folio của khách, không thể hủy từ danh sách đặt trước. Vui lòng hủy thông qua đơn gọi dịch vụ phòng.");
                    }

                    if (qtyToCancel < lineQty) {
                        int newQty = lineQty - qtyToCancel;
                        String updatedLine = line.replaceFirst("SL:\\s*\\d+", "SL: " + newQty);
                        updatedLines.add(updatedLine);
                    }
                    // Nếu qtyToCancel >= lineQty thì không add vào updatedLines (tức là xóa dòng này)
                    targetHandled = true;
                } else {
                    updatedLines.add(line);
                }
                currentPreOrderIdx++;
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
