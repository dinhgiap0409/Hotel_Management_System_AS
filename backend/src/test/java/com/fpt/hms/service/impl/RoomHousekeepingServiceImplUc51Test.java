package com.fpt.hms.service.impl;

import com.fpt.hms.common.MessageResolver;
import com.fpt.hms.dto.room.CreateHousekeepingTaskRequest;
import com.fpt.hms.dto.room.UpdateHousekeepingTaskStatusRequest;
import com.fpt.hms.entity.Account;
import com.fpt.hms.entity.HousekeepingTask;
import com.fpt.hms.entity.Role;
import com.fpt.hms.entity.Room;
import com.fpt.hms.entity.Staff;
import com.fpt.hms.exception.BusinessException;
import com.fpt.hms.repository.AccountRepository;
import com.fpt.hms.repository.HousekeepingTaskRepository;
import com.fpt.hms.repository.ReservationRepository;
import com.fpt.hms.repository.RoomRepository;
import com.fpt.hms.repository.RoomTypePriceRepository;
import com.fpt.hms.repository.RoomTypeRepository;
import com.fpt.hms.repository.StaffRepository;
import com.fpt.hms.repository.StayRoomAssignmentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the UC-51 guards added to RoomHousekeepingServiceImpl:
 * Dirty-room check, active-staff check, real priority (V4), no silent
 * assigner fallback, and the ASSIGNED -> IN_PROGRESS -> COMPLETED /
 * CANCELLED task state machine with ownership. Repositories are mocked —
 * no database needed.
 */
@ExtendWith(MockitoExtension.class)
class RoomHousekeepingServiceImplUc51Test {

    @Mock RoomTypeRepository roomTypeRepository;
    @Mock RoomTypePriceRepository roomTypePriceRepository;
    @Mock RoomRepository roomRepository;
    @Mock HousekeepingTaskRepository housekeepingTaskRepository;
    @Mock StaffRepository staffRepository;
    @Mock AccountRepository accountRepository;
    @Mock ReservationRepository reservationRepository;
    @Mock StayRoomAssignmentRepository stayRoomAssignmentRepository;
    @Mock MessageResolver messageResolver;

    @InjectMocks RoomHousekeepingServiceImpl service;

    @BeforeEach
    void stubMessages() {
        // Lenient: success-path tests never call the resolver, throwing
        // tests do — strict stubs would fail the former as "unnecessary".
        lenient().when(messageResolver.resolve(anyString())).thenAnswer(i -> i.getArgument(0));
    }

    // ------------------------------------------------------------------ helpers

    private Role role(String name) {
        return Role.builder().roleId(1).roleName(name).build();
    }

    private Staff staff(int staffId, int accountId, String roleName, String employmentStatus, String accountStatus) {
        Account account = Account.builder().accountId(accountId)
                .role(role(roleName)).status(accountStatus).build();
        return Staff.builder().staffId(staffId).account(account)
                .employmentStatus(employmentStatus).fullName("Staff " + staffId).build();
    }

    private Staff activeHkStaff(int staffId, int accountId) {
        return staff(staffId, accountId, "HOUSEKEEPING", "ACTIVE", "ACTIVE");
    }

    private Staff activeManager(int staffId, int accountId) {
        return staff(staffId, accountId, "HOUSEKEEPING_MANAGER", "ACTIVE", "ACTIVE");
    }

    private Room room(String cleaningStatus) {
        return Room.builder().roomId(103).roomNumber("103").floor(1)
                .stayStatus("VACANT").cleaningStatus(cleaningStatus).roomStatus("ACTIVE").build();
    }

    private CreateHousekeepingTaskRequest createRequest(String taskType, String priority) {
        return CreateHousekeepingTaskRequest.builder()
                .roomId(103).assignedToStaffId(8).taskType(taskType).priority(priority).build();
    }

    private HousekeepingTask task(String status, String taskType, Staff assignee, Room taskRoom) {
        return HousekeepingTask.builder().taskId(1).room(taskRoom)
                .assignedToStaff(assignee).assignedByStaff(activeManager(4, 4))
                .taskType(taskType).status(status).priority("NORMAL").build();
    }

    private void stubActiveAssignment(Room taskRoom, Staff assignee, Staff assigner) {
        when(roomRepository.findById(103)).thenReturn(Optional.of(taskRoom));
        when(staffRepository.findById(8)).thenReturn(Optional.of(assignee));
        when(staffRepository.findByAccount_AccountId(4)).thenReturn(Optional.of(assigner));
        lenient().when(housekeepingTaskRepository.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    // ------------------------------------------------------------- createTask

    @Test
    void createCleaningTask_roomNotDirty_throws() {
        when(roomRepository.findById(103)).thenReturn(Optional.of(room("CLEAN")));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.createTask(createRequest("CLEANING", null), 4));
        assertEquals("MSG_TASK_ROOM_NOT_DIRTY", ex.getErrorCode());
        verify(housekeepingTaskRepository, never()).save(any());
    }

    @Test
    void createCleaningTask_dirtyRoomActiveStaff_createsAssignedWithDefaultPriority() {
        stubActiveAssignment(room("DIRTY"), activeHkStaff(8, 8), activeManager(4, 4));

        var dto = service.createTask(createRequest("CLEANING", null), 4);

        assertEquals("ASSIGNED", dto.getStatus());
        assertEquals("NORMAL", dto.getPriority());
        assertEquals(8, dto.getAssignedToStaffId());
        assertEquals(4, dto.getAssignedByStaffId());
    }

    @Test
    void createTask_priorityNormalizedToUpperCase() {
        stubActiveAssignment(room("DIRTY"), activeHkStaff(8, 8), activeManager(4, 4));

        var dto = service.createTask(createRequest("CLEANING", "high"), 4);

        assertEquals("HIGH", dto.getPriority());
    }

    @Test
    void createTask_invalidPriority_throws() {
        stubActiveAssignment(room("DIRTY"), activeHkStaff(8, 8), activeManager(4, 4));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.createTask(createRequest("CLEANING", "URGENT-PLUS"), 4));
        assertEquals("MSG_INVALID_TASK_PRIORITY", ex.getErrorCode());
    }

    @Test
    void createTask_invalidTaskType_throws() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.createTask(createRequest("DEEP_CLEAN", null), 4));
        assertEquals("MSG_INVALID_TASK_TYPE", ex.getErrorCode());
    }

    @Test
    void createTask_inactiveEmploymentStaff_throws() {
        Staff inactive = staff(8, 8, "HOUSEKEEPING", "INACTIVE", "ACTIVE");
        when(roomRepository.findById(103)).thenReturn(Optional.of(room("DIRTY")));
        when(staffRepository.findById(8)).thenReturn(Optional.of(inactive));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.createTask(createRequest("CLEANING", null), 4));
        assertEquals("MSG_TASK_STAFF_INACTIVE", ex.getErrorCode());
    }

    @Test
    void createTask_inactiveAccountStaff_throws() {
        Staff locked = staff(8, 8, "HOUSEKEEPING", "ACTIVE", "INACTIVE");
        when(roomRepository.findById(103)).thenReturn(Optional.of(room("DIRTY")));
        when(staffRepository.findById(8)).thenReturn(Optional.of(locked));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.createTask(createRequest("CLEANING", null), 4));
        assertEquals("MSG_TASK_STAFF_INACTIVE", ex.getErrorCode());
    }

    @Test
    void createTask_assignerWithoutStaffRecord_throwsInsteadOfFallback() {
        when(roomRepository.findById(103)).thenReturn(Optional.of(room("DIRTY")));
        when(staffRepository.findById(8)).thenReturn(Optional.of(activeHkStaff(8, 8)));
        when(staffRepository.findByAccount_AccountId(99)).thenReturn(Optional.empty());

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.createTask(createRequest("CLEANING", null), 99));
        assertEquals("MSG_TASK_ASSIGNER_NOT_FOUND", ex.getErrorCode());
    }

    @Test
    void createMaintenanceTask_cleanRoom_allowedWithoutDirtyCheck() {
        stubActiveAssignment(room("CLEAN"), activeHkStaff(8, 8), activeManager(4, 4));

        var dto = service.createTask(createRequest("MAINTENANCE", "LOW"), 4);

        assertEquals("ASSIGNED", dto.getStatus());
        assertEquals("LOW", dto.getPriority());
    }

    @Test
    void getHousekeepingStaff_filtersInactiveStaff() {
        when(staffRepository.findAll()).thenReturn(List.of(
                activeHkStaff(8, 8),
                staff(9, 9, "HOUSEKEEPING", "INACTIVE", "ACTIVE"),
                staff(10, 10, "HOUSEKEEPING", "ACTIVE", "LOCKED"),
                activeManager(4, 4)));

        var result = service.getHousekeepingStaff();

        assertEquals(2, result.size());
        assertTrue(result.stream().allMatch(s -> s.getStaffId() == 8 || s.getStaffId() == 4));
    }

    // --------------------------------------------------------- updateTaskStatus

    private UpdateHousekeepingTaskStatusRequest statusRequest(String status) {
        return UpdateHousekeepingTaskStatusRequest.builder().status(status).build();
    }

    private void stubTask(HousekeepingTask t) {
        when(housekeepingTaskRepository.findById(1)).thenReturn(Optional.of(t));
        lenient().when(housekeepingTaskRepository.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void updateTask_assignedToInProgress_byAssignee_setsStartedAt() {
        Staff assignee = activeHkStaff(8, 8);
        stubTask(task("ASSIGNED", "CLEANING", assignee, room("DIRTY")));
        when(staffRepository.findByAccount_AccountId(8)).thenReturn(Optional.of(assignee));

        var dto = service.updateTaskStatus(1, statusRequest("IN_PROGRESS"), 8);

        assertEquals("IN_PROGRESS", dto.getStatus());
        assertTrue(dto.getStartedAt() != null);
    }

    @Test
    void updateTask_inProgressToCompleted_cleaningSetsRoomClean() {
        Staff assignee = activeHkStaff(8, 8);
        Room taskRoom = room("DIRTY");
        stubTask(task("IN_PROGRESS", "CLEANING", assignee, taskRoom));
        when(staffRepository.findByAccount_AccountId(8)).thenReturn(Optional.of(assignee));
        when(roomRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        var dto = service.updateTaskStatus(1, statusRequest("COMPLETED"), 8);

        assertEquals("COMPLETED", dto.getStatus());
        assertTrue(dto.getCompletedAt() != null);
        ArgumentCaptor<Room> roomCaptor = ArgumentCaptor.forClass(Room.class);
        verify(roomRepository).save(roomCaptor.capture());
        assertEquals("CLEAN", roomCaptor.getValue().getCleaningStatus());
    }

    @Test
    void updateTask_assignedStraightToCompleted_throws() {
        Staff assignee = activeHkStaff(8, 8);
        stubTask(task("ASSIGNED", "CLEANING", assignee, room("DIRTY")));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.updateTaskStatus(1, statusRequest("COMPLETED"), 8));
        assertEquals("MSG_INVALID_TASK_TRANSITION", ex.getErrorCode());
    }

    @Test
    void updateTask_completedIsTerminal_throws() {
        Staff assignee = activeHkStaff(8, 8);
        stubTask(task("COMPLETED", "CLEANING", assignee, room("DIRTY")));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.updateTaskStatus(1, statusRequest("IN_PROGRESS"), 8));
        assertEquals("MSG_INVALID_TASK_TRANSITION", ex.getErrorCode());
    }

    @Test
    void updateTask_cancelledIsTerminal_throws() {
        Staff assignee = activeHkStaff(8, 8);
        stubTask(task("CANCELLED", "CLEANING", assignee, room("DIRTY")));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.updateTaskStatus(1, statusRequest("IN_PROGRESS"), 8));
        assertEquals("MSG_INVALID_TASK_TRANSITION", ex.getErrorCode());
    }

    @Test
    void updateTask_sameStatus_throws() {
        Staff assignee = activeHkStaff(8, 8);
        stubTask(task("IN_PROGRESS", "CLEANING", assignee, room("DIRTY")));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.updateTaskStatus(1, statusRequest("IN_PROGRESS"), 8));
        assertEquals("MSG_INVALID_TASK_TRANSITION", ex.getErrorCode());
    }

    @Test
    void updateTask_byOtherStaff_throwsForbidden() {
        Staff assignee = activeHkStaff(8, 8);
        Staff other = activeHkStaff(9, 9);
        stubTask(task("ASSIGNED", "CLEANING", assignee, room("DIRTY")));
        when(staffRepository.findByAccount_AccountId(9)).thenReturn(Optional.of(other));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.updateTaskStatus(1, statusRequest("IN_PROGRESS"), 9));
        assertEquals("MSG_TASK_UPDATE_FORBIDDEN", ex.getErrorCode());
    }

    @Test
    void updateTask_byManager_allowed() {
        Staff assignee = activeHkStaff(8, 8);
        Staff manager = activeManager(4, 4);
        stubTask(task("ASSIGNED", "CLEANING", assignee, room("DIRTY")));
        when(staffRepository.findByAccount_AccountId(4)).thenReturn(Optional.of(manager));

        var dto = service.updateTaskStatus(1, statusRequest("CANCELLED"), 4);

        assertEquals("CANCELLED", dto.getStatus());
    }

    @Test
    void updateTask_byAdminWithoutStaffRecord_allowed() {
        Staff assignee = activeHkStaff(8, 8);
        stubTask(task("ASSIGNED", "CLEANING", assignee, room("DIRTY")));
        when(staffRepository.findByAccount_AccountId(1)).thenReturn(Optional.empty());
        Account admin = Account.builder().accountId(1).role(role("ADMIN")).status("ACTIVE").build();
        when(accountRepository.findById(1)).thenReturn(Optional.of(admin));

        var dto = service.updateTaskStatus(1, statusRequest("IN_PROGRESS"), 1);

        assertEquals("IN_PROGRESS", dto.getStatus());
    }
}
