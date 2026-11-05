import { useEffect, useState, useMemo } from 'react';
import { Card, Row, Col, Button, Table, Badge, Form, Spinner, Alert } from 'react-bootstrap';
import { roomApi } from '../../services/roomApi';
import { useAuth } from '../../context/AuthContext';
import { notifyToast } from '../../lib/http';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CleanlinessModal } from './components/CleanlinessModal';
import { SetMaintenanceModal } from './components/SetMaintenanceModal';
import { EndMaintenanceModal } from './components/EndMaintenanceModal';
import { AssignTaskModal } from './components/AssignTaskModal';

export const HousekeepingBoardPage = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'HOUSEKEEPING_MANAGER' || user?.role === 'ADMIN';

  // --- ROOMS STATE ---
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomFilter, setRoomFilter] = useState({
    floor: '',
    cleaningStatus: '',
    status: '',
    search: '',
  });

  // --- TASKS STATE ---
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskFilter, setTaskFilter] = useState({
    status: '',
    taskType: '',
  });

  // --- MODALS STATE ---
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showCleanlinessModal, setShowCleanlinessModal] = useState(false);
  const [showSetMaintenanceModal, setShowSetMaintenanceModal] = useState(false);
  const [showEndMaintenanceModal, setShowEndMaintenanceModal] = useState(false);
  const [showAssignTaskModal, setShowAssignTaskModal] = useState(false);

  // Load Rooms and Tasks
  const loadRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await roomApi.getAllRooms();
      setRooms(Array.isArray(res.data) ? res.data : res.data?.content || []);
    } catch (err) {
      console.error('Failed to load rooms:', err);
      notifyToast({ message: 'Không thể tải danh sách phòng', type: 'ERROR' });
    } finally {
      setLoadingRooms(false);
    }
  };

  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const params = {};
      if (taskFilter.status) params.status = taskFilter.status;
      if (taskFilter.taskType) params.taskType = taskFilter.taskType;

      const res = await roomApi.getHousekeepingTasks(params);
      setTasks(Array.isArray(res.data) ? res.data : res.data?.content || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      notifyToast({ message: 'Không thể tải danh sách nhiệm vụ', type: 'ERROR' });
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    loadRooms();
    loadTasks();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [taskFilter]);

  // --- KPI STATISTICS ---
  const stats = useMemo(() => {
    const total = rooms.length;
    let dirty = 0;
    let clean = 0;
    let inspected = 0;
    let maintenance = 0;

    rooms.forEach((r) => {
      if (r.status === 'UNDER_MAINTENANCE' || r.roomStatus === 'UNDER_MAINTENANCE') {
        maintenance++;
      }
      const c = (r.cleanliness || r.cleaningStatus || '').toUpperCase();
      if (c === 'DIRTY') dirty++;
      else if (c === 'CLEAN') clean++;
      else if (c === 'INSPECTED') inspected++;
    });

    return { total, dirty, clean, inspected, maintenance };
  }, [rooms]);

  // --- FILTERED ROOMS ---
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (roomFilter.floor && String(r.floor) !== String(roomFilter.floor)) {
        return false;
      }
      if (roomFilter.cleaningStatus) {
        const c = (r.cleanliness || r.cleaningStatus || '').toUpperCase();
        if (c !== roomFilter.cleaningStatus) return false;
      }
      if (roomFilter.status) {
        const s = (r.status || r.roomStatus || '').toUpperCase();
        if (s !== roomFilter.status) return false;
      }
      if (roomFilter.search) {
        const q = roomFilter.search.toLowerCase();
        const num = (r.roomNumber || '').toLowerCase();
        if (!num.includes(q)) return false;
      }
      return true;
    });
  }, [rooms, roomFilter]);

  // --- ACTIONS ON ROOM ---
  const handleQuickClean = async (room) => {
    try {
      await roomApi.updateHousekeepingStatus(room.roomId, {
        newCleaningStatus: 'CLEAN',
        notes: 'Xác nhận dọn nhanh từ bảng điều phối',
      });
      notifyToast({ message: `Phòng ${room.roomNumber} đã chuyển sang CLEAN!`, type: 'SUCCESS' });
      loadRooms();
    } catch (err) {
      notifyToast({
        message: err.response?.data?.message || 'Không thể cập nhật trạng thái dọn dẹp',
        type: 'ERROR',
      });
    }
  };

  const handleQuickInspect = async (room) => {
    try {
      await roomApi.updateHousekeepingStatus(room.roomId, {
        newCleaningStatus: 'INSPECTED',
        notes: 'Giám sát viên đã nghiệm thu đạt chuẩn',
      });
      notifyToast({ message: `Phòng ${room.roomNumber} đã duyệt đạt chuẩn (INSPECTED)!`, type: 'SUCCESS' });
      loadRooms();
    } catch (err) {
      notifyToast({
        message: err.response?.data?.message || 'Không thể cập nhật trạng thái kiểm tra',
        type: 'ERROR',
      });
    }
  };

  // --- ACTIONS ON TASK ---
  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      await roomApi.updateHousekeepingTaskStatus(taskId, {
        status: newStatus,
        note: `Trạng thái cập nhật: ${newStatus}`,
      });
      notifyToast({ message: `Cập nhật nhiệm vụ #${taskId} sang ${newStatus}!`, type: 'SUCCESS' });
      loadTasks();
      loadRooms(); // In case task completing auto-syncs room to CLEAN
    } catch (err) {
      notifyToast({
        message: err.response?.data?.message || 'Không thể cập nhật nhiệm vụ',
        type: 'ERROR',
      });
    }
  };

  // Available unique floors for filter
  const floors = useMemo(() => {
    const set = new Set(rooms.map((r) => r.floor).filter(Boolean));
    return Array.from(set).sort((a, b) => a - b);
  }, [rooms]);

  return (
    <div className="container-fluid py-3 px-4">
      {/* Title */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-1" style={{ fontSize: '1.65rem' }}>
            Bảng Điều Phối Buồng Phòng & Bảo Trì
          </h2>
          <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
            Quản lý vòng đời vệ sinh (DIRTY &rarr; CLEAN &rarr; INSPECTED), khóa bảo trì (UC-20) và phân bổ công việc (UC-51).
          </p>
        </div>
        <div className="d-flex gap-2">
          {isManager && (
            <Button
              variant="primary"
              onClick={() => {
                setSelectedRoom(null);
                setShowAssignTaskModal(true);
              }}
            >
              + Giao nhiệm vụ dọn phòng
            </Button>
          )}
          <Button variant="outline-secondary" onClick={() => { loadRooms(); loadTasks(); }}>
            Làm mới
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <Row className="g-3 mb-4">
        <Col xs={12} sm={6} md={4} lg>
          <Card className="border-0 shadow-sm text-center py-2 bg-light">
            <Card.Body className="p-2">
              <div className="text-muted small fw-semibold">TỔNG SỐ PHÒNG</div>
              <div className="fs-3 fw-bold text-dark">{stats.total}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} md={4} lg>
          <Card className="border-0 shadow-sm text-center py-2" style={{ backgroundColor: '#fff5f5' }}>
            <Card.Body className="p-2">
              <div className="small fw-semibold text-danger">CẦN DỌN DẸP (DIRTY)</div>
              <div className="fs-3 fw-bold text-danger">{stats.dirty}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} md={4} lg>
          <Card className="border-0 shadow-sm text-center py-2" style={{ backgroundColor: '#f0f9ff' }}>
            <Card.Body className="p-2">
              <div className="small fw-semibold text-primary">ĐÃ DỌN DẸP (CLEAN)</div>
              <div className="fs-3 fw-bold text-primary">{stats.clean}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} md={4} lg>
          <Card className="border-0 shadow-sm text-center py-2" style={{ backgroundColor: '#f0fdf4' }}>
            <Card.Body className="p-2">
              <div className="small fw-semibold text-success">ĐÃ DUYỆT (INSPECTED)</div>
              <div className="fs-3 fw-bold text-success">{stats.inspected}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} md={4} lg>
          <Card className="border-0 shadow-sm text-center py-2" style={{ backgroundColor: '#fffbeb' }}>
            <Card.Body className="p-2">
              <div className="small fw-semibold text-warning">ĐANG BẢO TRÌ</div>
              <div className="fs-3 fw-bold text-warning">{stats.maintenance}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* SECTION 1: PHYSICAL ROOMS HOUSEKEEPING BOARD */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Header className="bg-white border-bottom py-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <h5 className="mb-0 fw-bold">1. Danh Sách Phòng & Trạng Thái Vệ Sinh (UC-19, UC-20)</h5>
            <span className="text-muted small">
              Hiển thị: <strong>{filteredRooms.length}</strong> / {rooms.length} phòng
            </span>
          </div>
        </Card.Header>
        <Card.Body>
          {/* Filters Bar */}
          <Row className="g-2 mb-3">
            <Col xs={12} sm={6} md={3}>
              <Form.Select
                size="sm"
                value={roomFilter.floor}
                onChange={(e) => setRoomFilter((prev) => ({ ...prev, floor: e.target.value }))}
              >
                <option value="">-- Tất cả tầng --</option>
                {floors.map((fl) => (
                  <option key={fl} value={fl}>
                    Tầng {fl}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={12} sm={6} md={3}>
              <Form.Select
                size="sm"
                value={roomFilter.cleaningStatus}
                onChange={(e) => setRoomFilter((prev) => ({ ...prev, cleaningStatus: e.target.value }))}
              >
                <option value="">-- Tất cả trạng thái vệ sinh --</option>
                <option value="DIRTY">DIRTY (Cần dọn)</option>
                <option value="CLEAN">CLEAN (Đã dọn)</option>
                <option value="INSPECTED">INSPECTED (Đã duyệt)</option>
              </Form.Select>
            </Col>
            <Col xs={12} sm={6} md={3}>
              <Form.Select
                size="sm"
                value={roomFilter.status}
                onChange={(e) => setRoomFilter((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="">-- Trạng thái vận hành --</option>
                <option value="AVAILABLE">AVAILABLE (Trống)</option>
                <option value="OCCUPIED">OCCUPIED (Đang có khách)</option>
                <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE (Bảo trì)</option>
              </Form.Select>
            </Col>
            <Col xs={12} sm={6} md={3}>
              <Form.Control
                size="sm"
                placeholder="Tìm số phòng..."
                value={roomFilter.search}
                onChange={(e) => setRoomFilter((prev) => ({ ...prev, search: e.target.value }))}
              />
            </Col>
          </Row>

          {/* Rooms Table */}
          {loadingRooms ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <div className="mt-2 text-muted">Đang tải danh sách phòng...</div>
            </div>
          ) : filteredRooms.length === 0 ? (
            <Alert variant="info" className="text-center py-4 mb-0">
              Không tìm thấy phòng nào phù hợp với bộ lọc hiện tại.
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead className="table-light">
                  <tr style={{ fontSize: '0.875rem' }}>
                    <th>Số phòng</th>
                    <th>Tầng</th>
                    <th>Hạng phòng</th>
                    <th>Lưu trú</th>
                    <th>Vệ sinh (UC-19)</th>
                    <th>Vận hành (UC-20)</th>
                    <th>Ghi chú / Bảo trì</th>
                    <th className="text-end">Hành động</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: '0.875rem' }}>
                  {filteredRooms.map((room) => {
                    const isMaint = room.status === 'UNDER_MAINTENANCE' || room.roomStatus === 'UNDER_MAINTENANCE';
                    const isOccupied = room.stayStatus === 'OCCUPIED';
                    const cleanStatus = (room.cleanliness || room.cleaningStatus || 'DIRTY').toUpperCase();

                    return (
                      <tr key={room.roomId}>
                        <td>
                          <span className="fw-bold fs-6">{room.roomNumber}</span>
                        </td>
                        <td>{room.floor}</td>
                        <td>{room.roomTypeName || room.roomType?.typeName}</td>
                        <td>
                          <StatusBadge status={room.stayStatus || 'AVAILABLE'} />
                        </td>
                        <td>
                          <StatusBadge status={cleanStatus} />
                        </td>
                        <td>
                          <StatusBadge status={isMaint ? 'UNDER_MAINTENANCE' : (room.status || 'AVAILABLE')} />
                        </td>
                        <td style={{ maxWidth: 220 }}>
                          {isMaint ? (
                            <div className="text-danger small">
                              <strong>Lý do:</strong> {room.maintenanceReason || 'Đang sửa chữa'}
                              {room.estimatedCompletionDate && (
                                <div className="text-muted">Hạn: {room.estimatedCompletionDate}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted small">Bình thường</span>
                          )}
                        </td>
                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-1 flex-wrap">
                            {/* Quick clean DIRTY -> CLEAN */}
                            {cleanStatus === 'DIRTY' && !isMaint && (
                              <Button
                                size="sm"
                                variant="success"
                                className="py-0 px-2"
                                style={{ fontSize: '0.78rem' }}
                                onClick={() => handleQuickClean(room)}
                                title="Chuyển nhanh sang Đã dọn dẹp"
                              >
                                Đã dọn sạch
                              </Button>
                            )}

                            {/* Manager Inspect CLEAN -> INSPECTED */}
                            {cleanStatus === 'CLEAN' && !isMaint && isManager && (
                              <Button
                                size="sm"
                                variant="outline-success"
                                className="py-0 px-2"
                                style={{ fontSize: '0.78rem' }}
                                onClick={() => handleQuickInspect(room)}
                                title="Giám sát nghiệm thu đạt chuẩn"
                              >
                                Nghiệm thu
                              </Button>
                            )}

                            {/* Full cleanliness modal */}
                            {!isMaint && (
                              <Button
                                size="sm"
                                variant="outline-primary"
                                className="py-0 px-2"
                                style={{ fontSize: '0.78rem' }}
                                onClick={() => {
                                  setSelectedRoom(room);
                                  setShowCleanlinessModal(true);
                                }}
                              >
                                Đổi vệ sinh
                              </Button>
                            )}

                            {/* Assign Task */}
                            {isManager && !isMaint && (
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                className="py-0 px-2"
                                style={{ fontSize: '0.78rem' }}
                                onClick={() => {
                                  setSelectedRoom(room);
                                  setShowAssignTaskModal(true);
                                }}
                              >
                                Giao việc
                              </Button>
                            )}

                            {/* Maintenance lock / unlock */}
                            {isMaint ? (
                              <Button
                                size="sm"
                                variant="warning"
                                className="py-0 px-2 text-dark"
                                style={{ fontSize: '0.78rem' }}
                                onClick={() => {
                                  setSelectedRoom(room);
                                  setShowEndMaintenanceModal(true);
                                }}
                              >
                                Mở phòng
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline-danger"
                                className="py-0 px-2"
                                style={{ fontSize: '0.78rem' }}
                                disabled={isOccupied}
                                onClick={() => {
                                  setSelectedRoom(room);
                                  setShowSetMaintenanceModal(true);
                                }}
                                title={isOccupied ? 'Không thể khóa bảo trì phòng có khách' : 'Khóa bảo trì phòng'}
                              >
                                Khóa bảo trì
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* SECTION 2: HOUSEKEEPING TASKS (UC-51) */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white border-bottom py-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <h5 className="mb-0 fw-bold">2. Danh Sách Nhiệm Vụ Buồng Phòng (UC-51)</h5>
              <div className="text-muted small">
                Nhân viên buồng nhận việc, bắt đầu làm (IN_PROGRESS) và hoàn tất (COMPLETED).
              </div>
            </div>
            <div className="d-flex gap-2">
              <Form.Select
                size="sm"
                style={{ width: 170 }}
                value={taskFilter.status}
                onChange={(e) => setTaskFilter((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="">-- Tất cả trạng thái --</option>
                <option value="ASSIGNED">ASSIGNED (Chờ làm)</option>
                <option value="IN_PROGRESS">IN_PROGRESS (Đang làm)</option>
                <option value="COMPLETED">COMPLETED (Hoàn tất)</option>
                <option value="CANCELLED">CANCELLED (Đã hủy)</option>
              </Form.Select>
              <Form.Select
                size="sm"
                style={{ width: 160 }}
                value={taskFilter.taskType}
                onChange={(e) => setTaskFilter((prev) => ({ ...prev, taskType: e.target.value }))}
              >
                <option value="">-- Tất cả loại --</option>
                <option value="CLEANING">CLEANING (Vệ sinh)</option>
                <option value="MAINTENANCE">MAINTENANCE (Bảo dưỡng)</option>
              </Form.Select>
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          {loadingTasks ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <div className="mt-2 text-muted">Đang tải danh sách nhiệm vụ...</div>
            </div>
          ) : tasks.length === 0 ? (
            <Alert variant="light" className="text-center py-4 mb-0 text-muted">
              Chưa có nhiệm vụ buồng phòng nào được giao.
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead className="table-light">
                  <tr style={{ fontSize: '0.875rem' }}>
                    <th>Mã</th>
                    <th>Phòng</th>
                    <th>Loại công việc</th>
                    <th>Nhân viên phụ trách</th>
                    <th>Người giao việc</th>
                    <th>Hạn hoàn tất</th>
                    <th>Trạng thái</th>
                    <th>Ghi chú</th>
                    <th className="text-end">Cập nhật tiến độ</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: '0.875rem' }}>
                  {tasks.map((t) => {
                    const isAssigned = t.status === 'ASSIGNED';
                    const isInProgress = t.status === 'IN_PROGRESS';
                    const isDone = t.status === 'COMPLETED' || t.status === 'CANCELLED';

                    return (
                      <tr key={t.taskId}>
                        <td>
                          <strong>#{t.taskId}</strong>
                        </td>
                        <td>
                          <strong>Phòng {t.roomNumber || t.room?.roomNumber}</strong>
                          {t.floor && <span className="text-muted small"> (T{t.floor})</span>}
                        </td>
                        <td>
                          <Badge bg={t.taskType === 'CLEANING' ? 'info' : 'warning'} className="text-dark">
                            {t.taskType}
                          </Badge>
                        </td>
                        <td>
                          <div className="fw-semibold">{t.assignedToStaffName || 'Chưa phân bổ'}</div>
                        </td>
                        <td className="text-muted small">{t.assignedByStaffName || 'Hệ thống'}</td>
                        <td className="small">
                          {t.estimatedCompletionDate || (t.scheduledAt ? new Date(t.scheduledAt).toLocaleDateString() : '-')}
                        </td>
                        <td>
                          <StatusBadge status={t.status} />
                        </td>
                        <td style={{ maxWidth: 200 }} className="text-truncate" title={t.note}>
                          {t.note || '-'}
                        </td>
                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-1">
                            {isAssigned && (
                              <Button
                                size="sm"
                                variant="outline-primary"
                                className="py-0 px-2"
                                style={{ fontSize: '0.78rem' }}
                                onClick={() => handleUpdateTaskStatus(t.taskId, 'IN_PROGRESS')}
                              >
                                Bắt đầu làm
                              </Button>
                            )}

                            {isInProgress && (
                              <Button
                                size="sm"
                                variant="success"
                                className="py-0 px-2"
                                style={{ fontSize: '0.78rem' }}
                                onClick={() => handleUpdateTaskStatus(t.taskId, 'COMPLETED')}
                              >
                                Hoàn tất
                              </Button>
                            )}

                            {!isDone && isManager && (
                              <Button
                                size="sm"
                                variant="outline-danger"
                                className="py-0 px-2"
                                style={{ fontSize: '0.78rem' }}
                                onClick={() => handleUpdateTaskStatus(t.taskId, 'CANCELLED')}
                              >
                                Hủy task
                              </Button>
                            )}

                            {isDone && (
                              <span className="text-muted small">Đã đóng</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* MODALS */}
      <CleanlinessModal
        show={showCleanlinessModal}
        onHide={() => setShowCleanlinessModal(false)}
        room={selectedRoom}
        onSuccess={(msg) => {
          notifyToast({ message: msg, type: 'SUCCESS' });
          loadRooms();
        }}
      />

      <SetMaintenanceModal
        show={showSetMaintenanceModal}
        onHide={() => setShowSetMaintenanceModal(false)}
        room={selectedRoom}
        onSuccess={(msg) => {
          notifyToast({ message: msg, type: 'SUCCESS' });
          loadRooms();
        }}
      />

      <EndMaintenanceModal
        show={showEndMaintenanceModal}
        onHide={() => setShowEndMaintenanceModal(false)}
        room={selectedRoom}
        onSuccess={(msg) => {
          notifyToast({ message: msg, type: 'SUCCESS' });
          loadRooms();
        }}
      />

      <AssignTaskModal
        show={showAssignTaskModal}
        onHide={() => setShowAssignTaskModal(false)}
        preselectedRoom={selectedRoom}
        rooms={rooms}
        onSuccess={(msg) => {
          notifyToast({ message: msg, type: 'SUCCESS' });
          loadTasks();
        }}
      />
    </div>
  );
};
