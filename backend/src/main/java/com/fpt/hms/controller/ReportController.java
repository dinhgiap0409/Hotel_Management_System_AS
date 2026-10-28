package com.fpt.hms.controller;

import com.fpt.hms.dto.billing_report.RevenueReportDto;
import com.fpt.hms.entity.Invoice;
import com.fpt.hms.entity.Review;
import com.fpt.hms.enums.InvoiceStatus;
import com.fpt.hms.enums.RoomStatus;
import com.fpt.hms.enums.StayStatus;
import com.fpt.hms.repository.HotelServiceRepository;
import com.fpt.hms.repository.InvoiceRepository;
import com.fpt.hms.repository.ReviewRepository;
import com.fpt.hms.repository.RoomRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

/**
 * Module 5 (Owner: LinhNH) - Reviews (SALES_MANAGER) & Management Analytics Reports (GENERAL_MANAGER, ACCOUNTANT, SALES_MANAGER, SERVICE_MANAGER) (UC-41 to UC-50).
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "5. Reviews & Management Analytics Reports (Module 5 - LinhNH)")
public class ReportController {

    private final RoomRepository roomRepository;
    private final InvoiceRepository invoiceRepository;
    private final HotelServiceRepository hotelServiceRepository;
    private final ReviewRepository reviewRepository;

    @GetMapping("/reviews/published")
    @Operation(summary = "UC-42: View published non-hidden guest reviews")
    public ResponseEntity<List<Review>> getPublishedReviews() {
        return ResponseEntity.ok(reviewRepository.findByIsHiddenFalseOrderByReviewDateDesc());
    }

    @GetMapping("/reports/summary")
    @PreAuthorize("hasAnyRole('GENERAL_MANAGER', 'ACCOUNTANT', 'SALES_MANAGER', 'SERVICE_MANAGER')")
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
}
