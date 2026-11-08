package com.fpt.hms.service.impl;

import com.fpt.hms.common.MessageResolver;
import com.fpt.hms.dto.booking.ReservationDto;
import com.fpt.hms.dto.frontdesk.CheckInRequest;
import com.fpt.hms.dto.frontdesk.DirectBookingRequest;
import com.fpt.hms.dto.frontdesk.ExtendStayRequest;
import com.fpt.hms.dto.frontdesk.FrontDeskBookingQuoteRequest;
import com.fpt.hms.dto.frontdesk.FrontDeskBookingQuoteResponse;
import com.fpt.hms.dto.frontdesk.FrontDeskRoomTypeAvailabilityDto;
import com.fpt.hms.dto.frontdesk.GuestStayDto;
import com.fpt.hms.dto.frontdesk.RoomTransferRequest;
import com.fpt.hms.dto.room.RoomDto;
import com.fpt.hms.entity.*;
import com.fpt.hms.enums.*;
import com.fpt.hms.exception.BusinessException;
import com.fpt.hms.exception.ResourceNotFoundException;
import com.fpt.hms.integration.MailNotificationService;
import com.fpt.hms.integration.VnPayGatewayService;
import com.fpt.hms.repository.*;
import com.fpt.hms.service.FrontDeskService;
import lombok.RequiredArgsConstructor;
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
    private final StayRoomAssignmentRepository stayRoomAssignmentRepository;
    private final FolioRepository folioRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentAttemptRepository paymentAttemptRepository;
    private final VnPayGatewayService vnPayGatewayService;
    private final MailNotificationService mailNotificationService;
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

        // Hỗ trợ chọn nhiều hạng phòng cùng lúc
        List<DirectBookingRequest.SelectedRoomItem> items = new ArrayList<>();
        if (request.getRoomItems() != null && !request.getRoomItems().isEmpty()) {
            items.addAll(request.getRoomItems());
        } else if (request.getRoomTypeId() != null) {
            items.add(DirectBookingRequest.SelectedRoomItem.builder()
                    .roomTypeId(request.getRoomTypeId())
                    .quantity(Math.max(1, request.getQuantity()))
                    .build());
        } else {
            throw new BusinessException("MSG04A", "Vui lòng chọn ít nhất một hạng phòng cần đặt.");
        }

        int totalCalculatedCapacity = 0;
        Map<Integer, RoomType> loadedRoomTypes = new HashMap<>();

        for (DirectBookingRequest.SelectedRoomItem item : items) {
            RoomType rt = roomTypeRepository.findById(item.getRoomTypeId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng phòng #" + item.getRoomTypeId()));

            if (Boolean.FALSE.equals(rt.getIsActive())) {
                throw new BusinessException("BR-18", "Hạng phòng '" + rt.getTypeName() + "' hiện đang tạm ngưng mở đặt phòng.");
            }

            int qty = Math.max(1, item.getQuantity());
            int availableQuota = computeAvailableQuota(rt.getRoomTypeId(), request.getCheckInDate(), request.getCheckOutDate(), today);
            if (qty > availableQuota) {
                throw new BusinessException("BR-18",
                        "Hạng phòng '" + rt.getTypeName() + "' không đủ phòng trống (Yêu cầu "
                                + qty + " phòng, hiện chỉ còn " + availableQuota + " phòng trống).");
            }

            totalCalculatedCapacity += (rt.getCapacity() != null ? rt.getCapacity() : 2) * qty;
            loadedRoomTypes.put(rt.getRoomTypeId(), rt);
        }

        int finalGuestCount = request.getGuestCount() > 0 ? request.getGuestCount() : totalCalculatedCapacity;

        if (request.getContactPhone() == null || request.getContactPhone().trim().isBlank()) {
            throw new BusinessException("MSG04A", "Số điện thoại liên hệ là bắt buộc.");
        }
        if (request.getContactName() == null || request.getContactName().trim().isBlank()) {
            throw new BusinessException("MSG04A", "Họ và tên khách hàng là bắt buộc.");
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
                .guestCount(finalGuestCount)
                .specialNotes(request.getSpecialNotes())
                .status(ReservationStatus.PENDING.name())
                .contactName(request.getContactName().trim())
                .contactPhone(phone)
                .contactEmail(email)
                .holdExpiresAt(now.plus(30, ChronoUnit.DAYS))
                .build();

        for (DirectBookingRequest.SelectedRoomItem item : items) {
            RoomType rt = loadedRoomTypes.get(item.getRoomTypeId());
            int qty = Math.max(1, item.getQuantity());

            ReservationDetail detail = ReservationDetail.builder()
                    .reservation(reservation)
                    .roomType(rt)
                    .quantity(qty)
                    .build();

            Map<Integer, BigDecimal> tariffByDay = loadTariffMap(rt.getRoomTypeId());
            for (LocalDate d = request.getCheckInDate(); d.isBefore(request.getCheckOutDate()); d = d.plusDays(1)) {
                int dow = d.getDayOfWeek().getValue();
                BigDecimal nightPrice = tariffByDay.getOrDefault(dow, rt.getBasePrice());

                detail.getNightlyRates().add(ReservationNightlyRate.builder()
                        .reservationDetail(detail)
                        .stayDate(d)
                        .unitPrice(nightPrice)
                        .build());
            }

            reservation.getDetails().add(detail);
        }

        Reservation savedReservation = reservationRepository.save(reservation);

        // Tính tổng tiền phòng và tạo bản ghi Payment & PaymentAttempt chờ thanh toán
        BigDecimal totalStayAmount = BigDecimal.ZERO;
        for (ReservationDetail d : savedReservation.getDetails()) {
            int qty = d.getQuantity() != null ? d.getQuantity() : 1;
            if (d.getNightlyRates() != null && !d.getNightlyRates().isEmpty()) {
                for (ReservationNightlyRate nr : d.getNightlyRates()) {
                    if (nr.getUnitPrice() != null) {
                        totalStayAmount = totalStayAmount.add(nr.getUnitPrice().multiply(BigDecimal.valueOf(qty)));
                    }
                }
            } else if (d.getRoomType() != null && d.getRoomType().getBasePrice() != null) {
                long nights = Math.max(1, ChronoUnit.DAYS.between(request.getCheckInDate(), request.getCheckOutDate()));
                totalStayAmount = totalStayAmount.add(d.getRoomType().getBasePrice().multiply(BigDecimal.valueOf(nights * qty)));
            }
        }

        // Quy định SDD/SRS: Tiền đặt cọc = 30% tổng tiền lưu trú dự kiến
        BigDecimal depositAmount = totalStayAmount
                .multiply(new BigDecimal("0.30"))
                .setScale(0, RoundingMode.HALF_UP);

        Payment payment = paymentRepository.save(Payment.builder()
                .reservation(savedReservation)
                .paymentType("DEPOSIT")
                .amount(depositAmount)
                .currency("VND")
                .method("VNPAY")
                .idempotencyKey(code + "-WALKIN")
                .status("PENDING")
                .createdAt(now)
                .build());

        paymentAttemptRepository.save(PaymentAttempt.builder()
                .payment(payment)
                .gatewayProvider("VNPAY")
                .gatewayRequestRef(code)
                .status("PENDING")
                .createdAt(now)
                .expiredAt(now.plus(1, ChronoUnit.DAYS))
                .build());

        // Gửi email thông báo đơn đặt phòng tại sảnh cho khách (nếu có email hợp lệ)
        if (savedReservation.getContactEmail() != null && !savedReservation.getContactEmail().isBlank()
                && !savedReservation.getContactEmail().endsWith("@walkin.hotel.local")) {
            mailNotificationService.sendBookingConfirmation(
                    savedReservation.getContactEmail().trim(),
                    savedReservation.getReservationCode(),
                    savedReservation.getContactName()
            );
        }

        return toReservationDto(savedReservation);
    }

    @Override
    @Transactional(readOnly = true)
    public List<FrontDeskRoomTypeAvailabilityDto> getAvailableRoomTypes(LocalDate checkInDate, LocalDate checkOutDate, Integer guests) {
        if (checkInDate == null || checkOutDate == null || !checkOutDate.isAfter(checkInDate)) {
            throw new BusinessException("MSG01A", "Ngày nhận và ngày trả phòng không hợp lệ.");
        }

        LocalDate today = LocalDate.now(hotelClock);
        List<RoomType> activeTypes = roomTypeRepository.findByIsActiveTrue();
        List<Room> nonArchivedRooms = roomRepository.findByRoomStatusNot(RoomStatus.ARCHIVED.name());

        return activeTypes.stream().map(rt -> {
            int availableQuota = computeAvailableQuota(rt.getRoomTypeId(), checkInDate, checkOutDate, today);
            long totalActive = nonArchivedRooms.stream()
                    .filter(r -> r.getRoomType() != null && rt.getRoomTypeId().equals(r.getRoomType().getRoomTypeId()))
                    .filter(r -> RoomStatus.ACTIVE.name().equalsIgnoreCase(r.getRoomStatus()))
                    .count();

            Map<Integer, BigDecimal> tariffMap = loadTariffMap(rt.getRoomTypeId());
            BigDecimal periodTotal = BigDecimal.ZERO;
            List<FrontDeskRoomTypeAvailabilityDto.DailyTariffDto> dailyTariffs = new ArrayList<>();

            for (LocalDate d = checkInDate; d.isBefore(checkOutDate); d = d.plusDays(1)) {
                int dow = d.getDayOfWeek().getValue();
                BigDecimal nightPrice = tariffMap.getOrDefault(dow, rt.getBasePrice());
                periodTotal = periodTotal.add(nightPrice);

                String dowName = toDowFullName(dow);

                dailyTariffs.add(FrontDeskRoomTypeAvailabilityDto.DailyTariffDto.builder()
                        .stayDate(d)
                        .dayOfWeek(dow)
                        .dayOfWeekName(dowName)
                        .price(nightPrice)
                        .build());
            }

            // Gộp các khoảng biểu giá theo các ngày trong tuần (Ví dụ: "Thứ Hai - Thứ Năm": 850.000)
            List<FrontDeskRoomTypeAvailabilityDto.PriceRangeDto> priceRanges = groupTariffRanges(tariffMap, rt.getBasePrice());
            Map<String, BigDecimal> priceRangeMap = new LinkedHashMap<>();
            for (FrontDeskRoomTypeAvailabilityDto.PriceRangeDto pr : priceRanges) {
                priceRangeMap.put(pr.getDayRange(), pr.getPrice());
            }

            return FrontDeskRoomTypeAvailabilityDto.builder()
                    .roomTypeId(rt.getRoomTypeId())
                    .typeName(rt.getTypeName())
                    .capacity(rt.getCapacity() != null ? rt.getCapacity() : 2)
                    .basePrice(rt.getBasePrice())
                    .totalPeriodPrice(periodTotal)
                    .dailyTariffs(dailyTariffs)
                    .priceRanges(priceRanges)
                    .priceRangeMap(priceRangeMap)
                    .totalActiveRooms((int) totalActive)
                    .availableRoomsCount(availableQuota)
                    .imageUrl(rt.getImageUrl())
                    .build();
        }).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReservationDto> getArrivals() {
        return reservationRepository.findAll().stream()
                .map(this::toReservationDto)
                .filter(dto -> {
                    // BR-23: Chỉ đưa vào danh sách Check-in các đơn đã CONFIRMED và ĐÃ THANH TOÁN TIỀN CỌC thành công
                    boolean isDepositPaid = "PAID".equalsIgnoreCase(dto.getDepositPaymentStatus());
                    if (ReservationStatus.CONFIRMED.name().equalsIgnoreCase(dto.getStatus())) {
                        return isDepositPaid;
                    }
                    if (ReservationStatus.CHECKED_IN.name().equalsIgnoreCase(dto.getStatus())) {
                        return dto.getCheckedInRoomsCount() != null
                                && dto.getTotalBookedRoomsCount() != null
                                && dto.getCheckedInRoomsCount() < dto.getTotalBookedRoomsCount();
                    }
                    return false;
                })
                .sorted(Comparator.comparing(ReservationDto::getCheckInDate))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoomDto> getAvailableRoomsForCheckIn(Integer roomTypeId) {
        return roomRepository.findByRoomStatusNot(RoomStatus.ARCHIVED.name()).stream()
                .filter(r -> roomTypeId == null || (r.getRoomType() != null && roomTypeId.equals(r.getRoomType().getRoomTypeId())))
                .filter(r -> RoomStatus.ACTIVE.name().equalsIgnoreCase(r.getRoomStatus()))
                .filter(r -> StayStatus.VACANT.name().equalsIgnoreCase(r.getStayStatus()))
                .filter(r -> CleaningStatus.INSPECTED.name().equalsIgnoreCase(r.getCleaningStatus())
                        || CleaningStatus.CLEAN.name().equalsIgnoreCase(r.getCleaningStatus()))
                .map(r -> RoomDto.builder()
                        .roomId(r.getRoomId())
                        .roomNumber(r.getRoomNumber())
                        .floor(r.getFloor())
                        .roomTypeId(r.getRoomType() != null ? r.getRoomType().getRoomTypeId() : null)
                        .roomTypeName(r.getRoomType() != null ? r.getRoomType().getTypeName() : null)
                        .basePrice(r.getRoomType() != null ? r.getRoomType().getBasePrice() : null)
                        .stayStatus(r.getStayStatus())
                        .cleaningStatus(r.getCleaningStatus())
                        .roomStatus(r.getRoomStatus())
                        .notes(r.getNotes())
                        .build())
                .sorted(Comparator.comparing(RoomDto::getRoomNumber))
                .toList();
    }

    @Override
    @Transactional
    public GuestStayDto checkInGuest(CheckInRequest request) {
        Reservation reservation = reservationRepository.findById(request.getReservationId())
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found"));

        if (!ReservationStatus.CONFIRMED.name().equalsIgnoreCase(reservation.getStatus())
                && !ReservationStatus.CHECKED_IN.name().equalsIgnoreCase(reservation.getStatus())) {
            throw new BusinessException("BR-23", "Thủ tục nhận phòng yêu cầu đơn đặt ở trạng thái CONFIRMED hoặc CHECKED_IN (đang nhận phòng dở).");
        }

        // BR-23: Bắt buộc đơn đặt phòng phải đã thanh toán cọc thành công (PAID) trước khi làm thủ tục Check-in
        List<Payment> payments = paymentRepository.findByReservation_ReservationId(reservation.getReservationId());
        boolean hasPaidDeposit = payments.stream()
                .anyMatch(p -> "DEPOSIT".equalsIgnoreCase(p.getPaymentType()) && "PAID".equalsIgnoreCase(p.getStatus()));

        if (!hasPaidDeposit && !ReservationStatus.CHECKED_IN.name().equalsIgnoreCase(reservation.getStatus())) {
            throw new BusinessException("BR-23", "Không thể làm thủ tục nhận phòng: Đơn đặt phòng #"
                    + reservation.getReservationCode() + " chưa hoàn tất thanh toán tiền cọc.");
        }

        Room room = roomRepository.findById(request.getRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("Room not found"));

        // Validate room matches one of the booked room types
        boolean matchedType = reservation.getDetails() != null && reservation.getDetails().stream()
                .anyMatch(d -> d.getRoomType() != null && room.getRoomType() != null
                        && room.getRoomType().getRoomTypeId().equals(d.getRoomType().getRoomTypeId()));

        if (!matchedType) {
            throw new BusinessException("BR-14", "Phòng " + room.getRoomNumber() + " (" + (room.getRoomType() != null ? room.getRoomType().getTypeName() : "")
                    + ") không thuộc hạng phòng nào trong đơn đặt này.");
        }

        // Count already checked-in rooms for this reservation & roomType
        List<GuestStay> existingStays = guestStayRepository.findAllByReservation_ReservationId(reservation.getReservationId());
        long checkedInForThisType = existingStays.stream()
                .filter(s -> s.getRoomAssignments() != null && !s.getRoomAssignments().isEmpty())
                .map(s -> s.getRoomAssignments().getLast().getRoom())
                .filter(r -> r.getRoomType() != null && room.getRoomType() != null
                        && r.getRoomType().getRoomTypeId().equals(room.getRoomType().getRoomTypeId()))
                .count();

        int allowedForThisType = reservation.getDetails().stream()
                .filter(d -> d.getRoomType() != null && room.getRoomType() != null
                        && d.getRoomType().getRoomTypeId().equals(room.getRoomType().getRoomTypeId()))
                .mapToInt(d -> d.getQuantity() != null ? d.getQuantity() : 1)
                .sum();

        if (checkedInForThisType >= allowedForThisType) {
            throw new BusinessException("BR-23", "Hạng phòng " + (room.getRoomType() != null ? room.getRoomType().getTypeName() : "")
                    + " đã nhận đủ số lượng đặt (" + allowedForThisType + " phòng).");
        }

        // BR-14: Only Vacant and Inspected/Clean rooms can be assigned at check-in
        boolean isCleanOrInspected = CleaningStatus.INSPECTED.name().equalsIgnoreCase(room.getCleaningStatus())
                || CleaningStatus.CLEAN.name().equalsIgnoreCase(room.getCleaningStatus());

        if (!StayStatus.VACANT.name().equalsIgnoreCase(room.getStayStatus())
                || !isCleanOrInspected
                || !RoomStatus.ACTIVE.name().equalsIgnoreCase(room.getRoomStatus())) {
            throw new BusinessException("MSG06A", messageResolver.resolve("MSG06A"));
        }

        // Save CCCD/Identity number to Customer record if provided
        if (request.getGuestIdNumber() != null && !request.getGuestIdNumber().isBlank()
                && reservation.getCustomer() != null) {
            Customer c = reservation.getCustomer();
            if (c.getIdentityNumber() == null || c.getIdentityNumber().isBlank()) {
                c.setIdentityNumber(request.getGuestIdNumber().trim());
                customerRepository.save(c);
            }
        }

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

        BigDecimal roomCharges = BigDecimal.ZERO;
        if (reservation.getDetails() != null) {
            for (ReservationDetail d : reservation.getDetails()) {
                if (d.getRoomType() != null && room.getRoomType() != null
                        && d.getRoomType().getRoomTypeId().equals(room.getRoomType().getRoomTypeId())) {
                    if (d.getNightlyRates() != null && !d.getNightlyRates().isEmpty()) {
                        for (ReservationNightlyRate nr : d.getNightlyRates()) {
                            if (nr.getUnitPrice() != null) {
                                roomCharges = roomCharges.add(nr.getUnitPrice());
                            }
                        }
                    }
                    break;
                }
            }
        }
        if (roomCharges.compareTo(BigDecimal.ZERO) <= 0) {
            Map<Integer, BigDecimal> tariffMap = loadTariffMap(room.getRoomType().getRoomTypeId());
            for (LocalDate d = reservation.getCheckInDate(); d.isBefore(reservation.getCheckOutDate()); d = d.plusDays(1)) {
                int dow = d.getDayOfWeek().getValue();
                roomCharges = roomCharges.add(tariffMap.getOrDefault(dow, room.getRoomType().getBasePrice()));
            }
        }

        // Tìm khoản tiền cọc ĐÃ THANH TOÁN gắn với đơn đặt phòng này
        BigDecimal depositPaid = BigDecimal.ZERO;
        if (reservation.getReservationId() != null) {
            depositPaid = paymentRepository.findByReservation_ReservationId(reservation.getReservationId()).stream()
                    .filter(p -> "DEPOSIT".equalsIgnoreCase(p.getPaymentType()) && PaymentStatus.PAID.name().equalsIgnoreCase(p.getStatus()))
                    .map(Payment::getAmount)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        // Khấu trừ tiền cọc vào dư nợ ban đầu của Folio
        BigDecimal remainingFolioAmount = roomCharges.subtract(depositPaid).max(BigDecimal.ZERO);

        Folio folio = Folio.builder()
                .guestStay(savedStay)
                .createdAt(Instant.now())
                .totalAmount(remainingFolioAmount)
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
        // BR-26: Check-out requires zero outstanding balance (Invoice PAID or zero folio)
        boolean hasOutstanding = folio.getTotalAmount() != null && folio.getTotalAmount().compareTo(BigDecimal.ZERO) > 0;
        if (hasOutstanding && (invoice == null || !InvoiceStatus.PAID.name().equalsIgnoreCase(invoice.getStatus()))) {
            throw new BusinessException("MSG10", messageResolver.resolve("MSG10"));
        }

        stay.setActualCheckOut(Instant.now());
        stay.setStatus(GuestStayStatus.COMPLETED.name());
        guestStayRepository.save(stay);

        Reservation reservation = stay.getReservation();
        List<GuestStay> allStays = guestStayRepository.findAllByReservation_ReservationId(reservation.getReservationId());
        boolean allCompleted = allStays.stream().allMatch(s -> GuestStayStatus.COMPLETED.name().equalsIgnoreCase(s.getStatus()));
        if (allCompleted) {
            reservation.setStatus(ReservationStatus.COMPLETED.name());
            reservationRepository.save(reservation);
        }

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

    @Override
    @Transactional
    public GuestStayDto extendStay(Integer stayId, ExtendStayRequest request) {
        GuestStay stay = guestStayRepository.findById(stayId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin lưu trú."));

        if (!GuestStayStatus.ACTIVE.name().equalsIgnoreCase(stay.getStatus())) {
            throw new BusinessException("BR-29", "Chỉ có thể gia hạn cho phòng đang ở trạng thái lưu trú ACTIVE.");
        }

        Reservation reservation = stay.getReservation();
        LocalDate currentCheckOut = reservation.getCheckOutDate();
        LocalDate newCheckOut = request.getNewCheckOutDate();

        if (newCheckOut == null || !newCheckOut.isAfter(currentCheckOut)) {
            throw new BusinessException("MSG01A", "Ngày trả phòng mới phải sau ngày trả phòng hiện tại (" + currentCheckOut + ").");
        }

        Room currentRoom = stay.getRoomAssignments().isEmpty()
                ? null
                : stay.getRoomAssignments().getLast().getRoom();

        if (currentRoom == null || currentRoom.getRoomType() == null) {
            throw new BusinessException("BR-29", "Không xác định được phòng vật lý của lượt lưu trú này.");
        }

        RoomType roomType = currentRoom.getRoomType();
        LocalDate today = LocalDate.now(hotelClock);

        int availableQuota = computeAvailableQuota(roomType.getRoomTypeId(), currentCheckOut, newCheckOut, today);
        if (availableQuota <= 0) {
            throw new BusinessException("BR-18", "Hạng phòng " + roomType.getTypeName() + " đã kín chỗ trong khoảng ngày gia hạn ("
                    + currentCheckOut + " đến " + newCheckOut + ").");
        }

        Map<Integer, BigDecimal> tariffMap = loadTariffMap(roomType.getRoomTypeId());
        BigDecimal additionalCharges = BigDecimal.ZERO;
        for (LocalDate d = currentCheckOut; d.isBefore(newCheckOut); d = d.plusDays(1)) {
            int dow = d.getDayOfWeek().getValue();
            BigDecimal nightRate = tariffMap.getOrDefault(dow, roomType.getBasePrice());
            additionalCharges = additionalCharges.add(nightRate);
        }

        if (reservation.getDetails() != null) {
            for (ReservationDetail d : reservation.getDetails()) {
                if (d.getRoomType() != null && d.getRoomType().getRoomTypeId().equals(roomType.getRoomTypeId())) {
                    for (LocalDate dDate = currentCheckOut; dDate.isBefore(newCheckOut); dDate = dDate.plusDays(1)) {
                        int dow = dDate.getDayOfWeek().getValue();
                        BigDecimal nightRate = tariffMap.getOrDefault(dow, roomType.getBasePrice());
                        d.getNightlyRates().add(ReservationNightlyRate.builder()
                                .reservationDetail(d)
                                .stayDate(dDate)
                                .unitPrice(nightRate)
                                .build());
                    }
                    break;
                }
            }
        }

        reservation.setCheckOutDate(newCheckOut);
        if (request.getReason() != null && !request.getReason().isBlank()) {
            String note = "[Gia hạn đến " + newCheckOut + ": " + request.getReason().trim() + "]";
            reservation.setSpecialNotes(reservation.getSpecialNotes() != null
                    ? reservation.getSpecialNotes() + " " + note
                    : note);
        }
        reservationRepository.save(reservation);

        Folio folio = folioRepository.findByGuestStay_StayId(stayId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản Folio cho lượt lưu trú này."));

        folio.setTotalAmount(folio.getTotalAmount().add(additionalCharges));
        Folio savedFolio = folioRepository.save(folio);

        return toStayDto(stay, currentRoom.getRoomNumber(), savedFolio);
    }

    @Override
    @Transactional
    public GuestStayDto transferRoom(Integer stayId, RoomTransferRequest request) {
        GuestStay stay = guestStayRepository.findById(stayId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin lưu trú."));

        if (!GuestStayStatus.ACTIVE.name().equalsIgnoreCase(stay.getStatus())) {
            throw new BusinessException("BR-28", "Chỉ có thể đổi phòng cho lượt lưu trú đang ở trạng thái ACTIVE.");
        }

        Room targetRoom = roomRepository.findById(request.getTargetRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng mục tiêu #" + request.getTargetRoomId()));

        if (!StayStatus.VACANT.name().equalsIgnoreCase(targetRoom.getStayStatus())) {
            throw new BusinessException("BR-28", "Phòng " + targetRoom.getRoomNumber() + " hiện không trống (Trạng thái: " + targetRoom.getStayStatus() + ").");
        }

        if (CleaningStatus.DIRTY.name().equalsIgnoreCase(targetRoom.getCleaningStatus())) {
            throw new BusinessException("BR-28", "Phòng " + targetRoom.getRoomNumber() + " đang dơ (DIRTY), chưa dọn dẹp xong nên không thể nhận khách.");
        }

        StayRoomAssignment currentAssignment = stay.getRoomAssignments().isEmpty()
                ? null
                : stay.getRoomAssignments().getLast();

        Room oldRoom = currentAssignment != null ? currentAssignment.getRoom() : null;
        if (oldRoom != null && oldRoom.getRoomId().equals(targetRoom.getRoomId())) {
            throw new BusinessException("BR-28", "Phòng mới trùng với phòng hiện tại đang ở.");
        }

        Instant now = Instant.now();

        // 1. Đóng assignment cũ
        if (currentAssignment != null) {
            currentAssignment.setAssignedTo(now);
            if (request.getReason() != null && !request.getReason().isBlank()) {
                currentAssignment.setTransferReason(request.getReason().trim());
            }
            stayRoomAssignmentRepository.save(currentAssignment);
        }

        // 2. Chuyển phòng cũ thành VACANT & DIRTY (BR-26: Room becomes dirty after leaving)
        if (oldRoom != null) {
            oldRoom.setStayStatus(StayStatus.VACANT.name());
            oldRoom.setCleaningStatus(CleaningStatus.DIRTY.name());
            roomRepository.save(oldRoom);
        }

        // 3. Chuyển phòng mới thành OCCUPIED
        targetRoom.setStayStatus(StayStatus.OCCUPIED.name());
        roomRepository.save(targetRoom);

        // 4. Tạo assignment mới
        StayRoomAssignment newAssignment = StayRoomAssignment.builder()
                .guestStay(stay)
                .room(targetRoom)
                .assignedFrom(now)
                .assignedTo(null)
                .build();
        stayRoomAssignmentRepository.save(newAssignment);
        stay.getRoomAssignments().add(newAssignment);

        // 5. Phụ thu đổi phòng / nâng hạng (nếu có)
        Folio folio = folioRepository.findByGuestStay_StayId(stayId).orElse(null);
        if (request.getAdditionalCharge() != null && request.getAdditionalCharge().compareTo(BigDecimal.ZERO) > 0 && folio != null) {
            folio.setTotalAmount(folio.getTotalAmount().add(request.getAdditionalCharge()));
            folioRepository.save(folio);
        }

        // 6. Ghi chú lịch sử đổi phòng vào Reservation
        Reservation reservation = stay.getReservation();
        String oldRoomNum = oldRoom != null ? oldRoom.getRoomNumber() : "N/A";
        String note = "[Đổi phòng từ " + oldRoomNum + " sang " + targetRoom.getRoomNumber()
                + (request.getReason() != null && !request.getReason().isBlank() ? ": " + request.getReason().trim() : "") + "]";
        reservation.setSpecialNotes(reservation.getSpecialNotes() != null
                ? reservation.getSpecialNotes() + " " + note
                : note);
        reservationRepository.save(reservation);

        return toStayDto(stay, targetRoom.getRoomNumber(), folio);
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
        long nights = (r.getCheckInDate() != null && r.getCheckOutDate() != null)
                ? Math.max(1, ChronoUnit.DAYS.between(r.getCheckInDate(), r.getCheckOutDate()))
                : 1;

        BigDecimal total = BigDecimal.ZERO;
        StringJoiner typeNames = new StringJoiner(", ");
        int totalQuantity = 0;
        Integer firstRoomTypeId = null;
        String firstImageUrl = null;

        List<GuestStay> stays = (r.getReservationId() != null)
                ? guestStayRepository.findAllByReservation_ReservationId(r.getReservationId())
                : Collections.emptyList();
        int checkedInRooms = stays.size();

        Map<Integer, ReservationDto.BookedRoomDetailDto> detailsMap = new LinkedHashMap<>();

        if (r.getDetails() != null && !r.getDetails().isEmpty()) {
            for (ReservationDetail detail : r.getDetails()) {
                int qty = detail.getQuantity() != null ? detail.getQuantity() : 1;
                totalQuantity += qty;

                RoomType rt = detail.getRoomType();
                if (rt != null) {
                    if (firstRoomTypeId == null) {
                        firstRoomTypeId = rt.getRoomTypeId();
                        firstImageUrl = rt.getImageUrl();
                    }

                    ReservationDto.BookedRoomDetailDto existing = detailsMap.get(rt.getRoomTypeId());
                    if (existing != null) {
                        existing.setQuantity(existing.getQuantity() + qty);
                    } else {
                        List<String> assignedNumbers = new ArrayList<>();
                        for (GuestStay s : stays) {
                            if (s.getRoomAssignments() != null && !s.getRoomAssignments().isEmpty()) {
                                Room rm = s.getRoomAssignments().getLast().getRoom();
                                if (rm.getRoomType() != null && rt.getRoomTypeId().equals(rm.getRoomType().getRoomTypeId())) {
                                    assignedNumbers.add(rm.getRoomNumber());
                                }
                            }
                        }
                        detailsMap.put(rt.getRoomTypeId(), ReservationDto.BookedRoomDetailDto.builder()
                                .roomTypeId(rt.getRoomTypeId())
                                .roomTypeName(rt.getTypeName())
                                .quantity(qty)
                                .unitPrice(rt.getBasePrice())
                                .checkedInRoomNumbers(assignedNumbers)
                                .build());
                    }
                }

                if (detail.getNightlyRates() != null && !detail.getNightlyRates().isEmpty()) {
                    BigDecimal detailSum = detail.getNightlyRates().stream()
                            .map(nr -> nr.getUnitPrice().multiply(BigDecimal.valueOf(qty)))
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    total = total.add(detailSum);
                } else if (rt != null && rt.getBasePrice() != null) {
                    total = total.add(rt.getBasePrice().multiply(BigDecimal.valueOf(nights * qty)));
                }
            }
        }

        for (ReservationDto.BookedRoomDetailDto dto : detailsMap.values()) {
            typeNames.add(dto.getRoomTypeName() + " (x" + dto.getQuantity() + ")");
        }
        List<ReservationDto.BookedRoomDetailDto> bookedDetails = new ArrayList<>(detailsMap.values());

        List<Payment> payments = (r.getReservationId() != null)
                ? paymentRepository.findByReservation_ReservationId(r.getReservationId())
                : Collections.emptyList();
        String depositStatus = payments.stream()
                .filter(p -> "DEPOSIT".equalsIgnoreCase(p.getPaymentType()))
                .map(Payment::getStatus)
                .findFirst()
                .orElse("PENDING");

        BigDecimal depositAmount = payments.stream()
                .filter(p -> "DEPOSIT".equalsIgnoreCase(p.getPaymentType()))
                .map(Payment::getAmount)
                .findFirst()
                .orElse(total.multiply(new BigDecimal("0.30")).setScale(0, RoundingMode.HALF_UP));

        String vnpayUrl = null;
        if (!"PAID".equalsIgnoreCase(depositStatus) && r.getReservationCode() != null && depositAmount.compareTo(BigDecimal.ZERO) > 0) {
            vnpayUrl = vnPayGatewayService.createDepositPaymentUrl(r.getReservationCode(), depositAmount);
        }

        return ReservationDto.builder()
                .reservationId(r.getReservationId())
                .reservationCode(r.getReservationCode())
                .roomTypeId(firstRoomTypeId)
                .roomTypeName(typeNames.length() > 0 ? typeNames.toString() : "Chưa chọn")
                .roomImageUrl(firstImageUrl)
                .roomQuantity(totalQuantity > 0 ? totalQuantity : 1)
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
                .bookedDetails(bookedDetails)
                .checkedInRoomsCount(checkedInRooms)
                .totalBookedRoomsCount(totalQuantity)
                .build();
    }

    private GuestStayDto toStayDto(GuestStay stay, String roomNumber, Folio folio) {
        Room room = stay.getRoomAssignments() != null && !stay.getRoomAssignments().isEmpty()
                ? stay.getRoomAssignments().getLast().getRoom()
                : null;
        RoomType rt = room != null ? room.getRoomType() : null;

        BigDecimal depositPaid = BigDecimal.ZERO;
        if (stay.getReservation() != null && stay.getReservation().getReservationId() != null) {
            depositPaid = paymentRepository.findByReservation_ReservationId(stay.getReservation().getReservationId()).stream()
                    .filter(p -> "DEPOSIT".equalsIgnoreCase(p.getPaymentType()) && PaymentStatus.PAID.name().equalsIgnoreCase(p.getStatus()))
                    .map(Payment::getAmount)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        return GuestStayDto.builder()
                .stayId(stay.getStayId())
                .reservationId(stay.getReservation().getReservationId())
                .reservationCode(stay.getReservation().getReservationCode())
                .guestName(stay.getReservation().getContactName())
                .guestIdNumber(stay.getGuestIdNumber())
                .roomNumber(roomNumber)
                .roomTypeId(rt != null ? rt.getRoomTypeId() : null)
                .roomTypeName(rt != null ? rt.getTypeName() : null)
                .roomPrice(rt != null ? rt.getBasePrice() : null)
                .checkInDate(stay.getReservation().getCheckInDate())
                .checkOutDate(stay.getReservation().getCheckOutDate())
                .actualCheckIn(stay.getActualCheckIn())
                .actualCheckOut(stay.getActualCheckOut())
                .status(stay.getStatus())
                .folioId(folio != null ? folio.getFolioId() : null)
                .folioTotalAmount(folio != null ? folio.getTotalAmount() : BigDecimal.ZERO)
                .depositPaid(depositPaid)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public FrontDeskBookingQuoteResponse calculateBookingQuote(FrontDeskBookingQuoteRequest request) {
        LocalDate checkIn = request.getCheckInDate();
        LocalDate checkOut = request.getCheckOutDate();

        if (checkIn == null || checkOut == null || !checkOut.isAfter(checkIn)) {
            throw new BusinessException("MSG01A", "Ngày nhận và ngày trả phòng không hợp lệ.");
        }

        int totalNights = (int) ChronoUnit.DAYS.between(checkIn, checkOut);
        List<FrontDeskBookingQuoteResponse.QuoteRoomTypeItemDto> items = new ArrayList<>();
        BigDecimal totalRoomCharge = BigDecimal.ZERO;
        int totalRoomsCount = 0;
        int totalCapacity = 0;

        if (request.getRoomItems() != null) {
            for (FrontDeskBookingQuoteRequest.SelectedRoomItem it : request.getRoomItems()) {
                if (it.getQuantity() <= 0) continue;

                RoomType rt = roomTypeRepository.findById(it.getRoomTypeId())
                        .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hạng phòng #" + it.getRoomTypeId()));

                Map<Integer, BigDecimal> tariffMap = loadTariffMap(rt.getRoomTypeId());
                BigDecimal periodPricePerRoom = BigDecimal.ZERO;
                List<FrontDeskBookingQuoteResponse.QuoteDailyBreakdownDto> breakdowns = new ArrayList<>();

                // Thu thập các đêm
                List<DailyNightInfo> nights = new ArrayList<>();
                for (LocalDate d = checkIn; d.isBefore(checkOut); d = d.plusDays(1)) {
                    int dow = d.getDayOfWeek().getValue();
                    BigDecimal nightPrice = tariffMap.getOrDefault(dow, rt.getBasePrice());
                    nights.add(new DailyNightInfo(d, dow, nightPrice));
                    periodPricePerRoom = periodPricePerRoom.add(nightPrice);
                }

                // Gom các đêm liên tiếp cùng mức giá
                if (!nights.isEmpty()) {
                    LocalDate blockStart = nights.get(0).date;
                    LocalDate blockEnd = nights.get(0).date;
                    int blockStartDow = nights.get(0).dow;
                    int blockEndDow = nights.get(0).dow;
                    BigDecimal blockPrice = nights.get(0).price;
                    int blockNights = 1;

                    for (int i = 1; i < nights.size(); i++) {
                        DailyNightInfo cur = nights.get(i);
                        if (cur.price.compareTo(blockPrice) == 0) {
                            blockEnd = cur.date;
                            blockEndDow = cur.dow;
                            blockNights++;
                        } else {
                            breakdowns.add(buildBreakdownDto(blockStart, blockEnd, blockStartDow, blockEndDow, blockNights, blockPrice));
                            blockStart = cur.date;
                            blockEnd = cur.date;
                            blockStartDow = cur.dow;
                            blockEndDow = cur.dow;
                            blockPrice = cur.price;
                            blockNights = 1;
                        }
                    }
                    breakdowns.add(buildBreakdownDto(blockStart, blockEnd, blockStartDow, blockEndDow, blockNights, blockPrice));
                }

                BigDecimal lineTotal = periodPricePerRoom.multiply(BigDecimal.valueOf(it.getQuantity()));
                totalRoomCharge = totalRoomCharge.add(lineTotal);
                totalRoomsCount += it.getQuantity();
                int capPerRoom = rt.getCapacity() != null ? rt.getCapacity() : 2;
                totalCapacity += capPerRoom * it.getQuantity();

                items.add(FrontDeskBookingQuoteResponse.QuoteRoomTypeItemDto.builder()
                        .roomTypeId(rt.getRoomTypeId())
                        .typeName(rt.getTypeName())
                        .quantity(it.getQuantity())
                        .capacityPerRoom(capPerRoom)
                        .lineCapacity(capPerRoom * it.getQuantity())
                        .periodPricePerRoom(periodPricePerRoom)
                        .lineTotal(lineTotal)
                        .breakdowns(breakdowns)
                        .build());
            }
        }

        return FrontDeskBookingQuoteResponse.builder()
                .checkInDate(checkIn)
                .checkOutDate(checkOut)
                .checkInDayOfWeek(toDowFullName(checkIn.getDayOfWeek().getValue()))
                .checkOutDayOfWeek(toDowFullName(checkOut.getDayOfWeek().getValue()))
                .totalNights(totalNights)
                .totalRoomsCount(totalRoomsCount)
                .totalCapacity(totalCapacity)
                .items(items)
                .totalRoomCharge(totalRoomCharge)
                .grandTotal(totalRoomCharge) // Đã loại bỏ phí dịch vụ (5%) và thuế VAT (8%)
                .note("Đã áp dụng biểu giá tự động theo ngày trong tuần. Miễn phí dịch vụ và thuế VAT.")
                .build();
    }

    private FrontDeskBookingQuoteResponse.QuoteDailyBreakdownDto buildBreakdownDto(
            LocalDate startDate, LocalDate endDate, int startDow, int endDow, int nights, BigDecimal unitPrice) {
        java.time.format.DateTimeFormatter dtfShort = java.time.format.DateTimeFormatter.ofPattern("dd/MM");
        java.time.format.DateTimeFormatter dtfFull = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");

        String fullLabel;
        String shortLabel;
        boolean isWeekend = (startDow == 6 || startDow == 7 || endDow == 6 || endDow == 7);

        if (nights == 1) {
            fullLabel = toDowFullName(startDow) + " (" + startDate.format(dtfFull) + ")";
            shortLabel = toDowShortName(startDow) + ", " + startDate.format(dtfShort);
        } else {
            fullLabel = toDowFullName(startDow) + " (" + startDate.format(dtfFull) + ") → "
                    + toDowFullName(endDow) + " (" + endDate.format(dtfFull) + ")";
            shortLabel = toDowShortName(startDow) + ", " + startDate.format(dtfShort) + " – "
                    + toDowShortName(endDow) + ", " + endDate.format(dtfShort);
        }

        BigDecimal subtotal = unitPrice.multiply(BigDecimal.valueOf(nights));
        String explanation = nights + " đêm × " + String.format("%,d", unitPrice.longValue()) + " ₫ = " + String.format("%,d", subtotal.longValue()) + " ₫";

        return FrontDeskBookingQuoteResponse.QuoteDailyBreakdownDto.builder()
                .periodLabel(fullLabel)
                .shortLabel(shortLabel)
                .nights(nights)
                .unitPrice(unitPrice)
                .subtotalPerRoom(subtotal)
                .explanation(explanation)
                .isWeekend(isWeekend)
                .build();
    }

    private List<FrontDeskRoomTypeAvailabilityDto.PriceRangeDto> groupTariffRanges(Map<Integer, BigDecimal> tariffMap, BigDecimal fallbackPrice) {
        List<FrontDeskRoomTypeAvailabilityDto.PriceRangeDto> ranges = new ArrayList<>();
        BigDecimal defaultRate = fallbackPrice != null ? fallbackPrice : BigDecimal.ZERO;

        int currentStart = 1;
        BigDecimal currentPrice = tariffMap.getOrDefault(1, defaultRate);

        for (int dow = 2; dow <= 7; dow++) {
            BigDecimal price = tariffMap.getOrDefault(dow, defaultRate);
            if (!price.equals(currentPrice)) {
                ranges.add(createPriceRangeDto(currentStart, dow - 1, currentPrice));
                currentStart = dow;
                currentPrice = price;
            }
        }
        ranges.add(createPriceRangeDto(currentStart, 7, currentPrice));

        return ranges;
    }

    private FrontDeskRoomTypeAvailabilityDto.PriceRangeDto createPriceRangeDto(int startDow, int endDow, BigDecimal price) {
        String dayRange;
        String shortRange;
        if (startDow == endDow) {
            dayRange = toDowFullName(startDow);
            shortRange = toDowShortName(startDow);
        } else {
            dayRange = toDowFullName(startDow) + " - " + toDowFullName(endDow);
            shortRange = toDowShortName(startDow) + " - " + toDowShortName(endDow);
        }

        return FrontDeskRoomTypeAvailabilityDto.PriceRangeDto.builder()
                .dayRange(dayRange)
                .shortRange(shortRange)
                .price(price)
                .startDayOfWeek(startDow)
                .endDayOfWeek(endDow)
                .build();
    }

    private String toDowFullName(int dow) {
        return switch (dow) {
            case 1 -> "Thứ Hai";
            case 2 -> "Thứ Ba";
            case 3 -> "Thứ Tư";
            case 4 -> "Thứ Năm";
            case 5 -> "Thứ Sáu";
            case 6 -> "Thứ Bảy";
            case 7 -> "Chủ Nhật";
            default -> "Ngày " + dow;
        };
    }

    private String toDowShortName(int dow) {
        return switch (dow) {
            case 1 -> "T2";
            case 2 -> "T3";
            case 3 -> "T4";
            case 4 -> "T5";
            case 5 -> "T6";
            case 6 -> "T7";
            case 7 -> "CN";
            default -> "T" + dow;
        };
    }

    @Override
    @Transactional
    public ReservationDto confirmCashPayment(String reservationCode) {
        Reservation reservation = reservationRepository.findByReservationCode(reservationCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + reservationCode));

        reservation.setStatus(ReservationStatus.CONFIRMED.name());
        reservationRepository.save(reservation);

        List<Payment> payments = paymentRepository.findByReservation_ReservationId(reservation.getReservationId());
        Instant now = Instant.now(hotelClock);
        for (Payment p : payments) {
            p.setStatus("PAID");
            p.setMethod("CASH");
            p.setPaidAt(now);
            paymentRepository.save(p);
        }

        PaymentAttempt attempt = paymentAttemptRepository.findByGatewayRequestRef(reservationCode).orElse(null);
        if (attempt != null) {
            attempt.setStatus("SUCCESS");
            attempt.setGatewayTransactionId("CASH-" + System.currentTimeMillis());
            attempt.setBankCode("CASH");
            attempt.setCompletedAt(now);
            paymentAttemptRepository.save(attempt);
        }

        // Gửi email xác nhận đặt phòng và đã thu tiền cọc tại sảnh (nếu khách cung cấp email hợp lệ)
        if (reservation.getContactEmail() != null && !reservation.getContactEmail().isBlank()
                && !reservation.getContactEmail().endsWith("@walkin.hotel.local")) {
            mailNotificationService.sendBookingConfirmation(
                    reservation.getContactEmail().trim(),
                    reservation.getReservationCode(),
                    reservation.getContactName()
            );
        }

        return toReservationDto(reservation);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getReservationPaymentStatus(String reservationCode) {
        Reservation reservation = reservationRepository.findByReservationCode(reservationCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + reservationCode));

        List<Payment> payments = paymentRepository.findByReservation_ReservationId(reservation.getReservationId());
        Payment depositPayment = payments.stream()
                .filter(p -> "DEPOSIT".equalsIgnoreCase(p.getPaymentType()))
                .findFirst()
                .orElse(null);

        String depositStatus = (depositPayment != null) ? depositPayment.getStatus() : "PENDING";
        String method = (depositPayment != null) ? depositPayment.getMethod() : "VNPAY";

        Map<String, Object> result = new HashMap<>();
        result.put("reservationCode", reservationCode);
        result.put("reservationStatus", reservation.getStatus());
        result.put("depositPaymentStatus", depositStatus);
        result.put("method", method);
        result.put("amount", depositPayment != null ? depositPayment.getAmount() : BigDecimal.ZERO);
        return result;
    }

    @Override
    @Transactional
    public ReservationDto cancelDirectBooking(String reservationCode, String reason) {
        Reservation reservation = reservationRepository.findByReservationCode(reservationCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt phòng: " + reservationCode));

        if (ReservationStatus.CHECKED_IN.name().equalsIgnoreCase(reservation.getStatus())
                || ReservationStatus.COMPLETED.name().equalsIgnoreCase(reservation.getStatus())) {
            throw new BusinessException("BR-21", "Không thể hủy đơn đặt phòng đã nhận phòng hoặc đã hoàn tất.");
        }

        reservation.setStatus(ReservationStatus.CANCELLED.name());
        if (reason != null && !reason.isBlank()) {
            reservation.setSpecialNotes((reservation.getSpecialNotes() != null ? reservation.getSpecialNotes() + " | " : "") + "Lý do hủy: " + reason);
        }
        reservationRepository.save(reservation);

        List<Payment> payments = paymentRepository.findByReservation_ReservationId(reservation.getReservationId());
        for (Payment p : payments) {
            if ("PENDING".equalsIgnoreCase(p.getStatus())) {
                p.setStatus("CANCELLED");
                paymentRepository.save(p);
            }
        }

        return toReservationDto(reservation);
    }

    private static class DailyNightInfo {
        LocalDate date;
        int dow;
        BigDecimal price;

        DailyNightInfo(LocalDate date, int dow, BigDecimal price) {
            this.date = date;
            this.dow = dow;
            this.price = price;
        }
    }
}
