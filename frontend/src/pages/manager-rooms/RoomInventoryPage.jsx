import { useEffect, useState } from 'react';
import { Tabs, Tab, Button, Form, Badge, Table, Spinner, Pagination } from 'react-bootstrap';
import { roomApi } from '../../services/roomApi';
import { useAuth } from '../../context/AuthContext';
import { formatVND } from '../../lib/money';
import { StatusBadge } from '../../components/common/StatusBadge';
import { RoomTypeModal } from './components/RoomTypeModal';
import { RoomTypePriceModal } from './components/RoomTypePriceModal';
import { PhysicalRoomModal } from './components/PhysicalRoomModal';
import { ConfirmArchiveModal } from './components/ConfirmArchiveModal';

export const RoomInventoryPage = () => {
  const { user } = useAuth();
  const isSalesManager = user?.role === 'SALES_MANAGER' || user?.role === 'ADMIN';
  const isHkManager = user?.role === 'HOUSEKEEPING_MANAGER' || user?.role === 'ADMIN';

  // Default tab based on role
  const [activeTab, setActiveTab] = useState(isSalesManager ? 'roomTypes' : 'rooms');

  // --- STATE TAB 1: Room Types ---
  const [roomTypes, setRoomTypes] = useState([]);
  const [loadingRoomTypes, setLoadingRoomTypes] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState(null);
  const [showRoomTypeModal, setShowRoomTypeModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);

  // --- STATE TAB 2: Physical Rooms ---
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // Pagination & Filters for Physical Rooms (UC-18)
  const [page, setPage] = useState(0);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  const [filters, setFilters] = useState({
    floor: '',
    roomTypeId: '',
    stayStatus: '',
    cleaningStatus: '',
    roomStatus: '',
    search: '',
  });

  // Load initial data
  useEffect(() => {
    loadRoomTypes();
    loadRooms(0);
  }, []);

  const loadRoomTypes = async () => {
    setLoadingRoomTypes(true);
    try {
      const res = await roomApi.getRoomTypes(false);
      setRoomTypes(res.data || []);
    } catch (err) {
      console.error('Failed to load room types:', err);
    } finally {
      setLoadingRoomTypes(false);
    }
  };

  const loadRooms = async (targetPage = page) => {
    setLoadingRooms(true);
    try {
      const params = {
        page: targetPage,
        size: pageSize,
        ...(filters.floor && { floor: Number(filters.floor) }),
        ...(filters.roomTypeId && { roomTypeId: Number(filters.roomTypeId) }),
        ...(filters.stayStatus && { stayStatus: filters.stayStatus }),
        ...(filters.cleaningStatus && { cleaningStatus: filters.cleaningStatus }),
        ...(filters.roomStatus && { roomStatus: filters.roomStatus }),
        ...(filters.search.trim() && { search: filters.search.trim() }),
      };

      const res = await roomApi.searchRooms(params);
      const data = res.data;
      if (data && data.content) {
        setRooms(data.content);
        setTotalPages(data.totalPages || 1);
        setTotalElements(data.totalElements || 0);
        setPage(data.page || 0);
      } else {
        setRooms(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load physical rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    loadRooms(0);
  };

  const handleResetFilters = () => {
    setFilters({
      floor: '',
      roomTypeId: '',
      stayStatus: '',
      cleaningStatus: '',
      roomStatus: '',
      search: '',
    });
    // Trigger load without filters
    setTimeout(() => {
      roomApi.searchRooms({ page: 0, size: pageSize }).then((res) => {
        const data = res.data;
        if (data?.content) {
          setRooms(data.content);
          setTotalPages(data.totalPages || 1);
          setTotalElements(data.totalElements || 0);
          setPage(0);
        }
      });
    }, 50);
  };

  const handleToggleRoomTypeStatus = async (roomTypeId) => {
    try {
      await roomApi.toggleRoomTypeStatus(roomTypeId);
      loadRoomTypes();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
            Quản Lý Hạng Phòng, Biểu Giá & Sơ Đồ Kho Phòng (Module 2)
          </h2>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 0 }}>
            Hạng phòng & Giá theo thứ do <strong>Sales & Marketing Manager</strong> quản lý; Danh mục Phòng vật lý do <strong>Housekeeping Manager</strong> phụ trách.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
        style={{ borderBottom: '2px solid #e2e8f0', fontWeight: 600 }}
      >
        <Tab eventKey="roomTypes" title={`1. Danh Mục Hạng Phòng & Biểu Giá (${roomTypes.length})`}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h4 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>
                  Danh Mục Hạng Phòng Lưu Trú
                </h4>
                <span style={{ fontSize: 13, color: '#64748b' }}>
                  Cấu hình các loại phòng, sức chứa, giá niêm yết cơ sở và biểu giá phụ trội theo các ngày trong tuần.
                </span>
              </div>
              {isSalesManager && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setSelectedRoomType(null);
                    setShowRoomTypeModal(true);
                  }}
                  style={{ background: '#0284c7', borderColor: '#0284c7', fontWeight: 600, fontSize: 14 }}
                >
                  + Thêm Hạng Phòng Mới
                </Button>
              )}
            </div>

            {loadingRoomTypes ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <div className="mt-2 text-muted" style={{ fontSize: 14 }}>Đang tải danh mục hạng phòng...</div>
              </div>
            ) : roomTypes.length === 0 ? (
              <div className="text-center py-5 text-muted">Chưa có hạng phòng nào được thiết lập.</div>
            ) : (
              <Table hover responsive style={{ fontSize: 14, verticalAlign: 'middle' }}>
                <thead style={{ background: '#f8fafc', color: '#475569' }}>
                  <tr>
                    <th style={{ width: 60 }}>Mã</th>
                    <th style={{ width: 220 }}>Tên Hạng Phòng</th>
                    <th style={{ width: 100 }}>Sức Chứa</th>
                    <th style={{ width: 140 }}>Giá Cơ Sở / Đêm</th>
                    <th>Tiện Nghi Nổi Bật</th>
                    <th style={{ width: 120 }}>Trạng Thái</th>
                    {isSalesManager && <th style={{ width: 230, textAlign: 'center' }}>Thao Tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {roomTypes.map((rt) => (
                    <tr key={rt.roomTypeId}>
                      <td><span style={{ color: '#64748b', fontWeight: 600 }}>#{rt.roomTypeId}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {rt.imageUrl ? (
                            <img
                              src={rt.imageUrl}
                              alt={rt.typeName}
                              style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 6, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11 }}>
                              No Pic
                            </div>
                          )}
                          <strong>{rt.typeName}</strong>
                        </div>
                      </td>
                      <td>{rt.capacity} khách</td>
                      <td>
                        <strong style={{ color: '#0369a1' }}>{formatVND(rt.basePrice)}</strong>
                      </td>
                      <td style={{ color: '#475569', fontSize: 13 }}>
                        {rt.amenities || <span className="text-muted">Chưa cấu hình</span>}
                      </td>
                      <td>
                        {rt.isActive ? (
                          <Badge bg="success" style={{ fontSize: 12, padding: '5px 10px' }}>Đang Mở Bán</Badge>
                        ) : (
                          <Badge bg="secondary" style={{ fontSize: 12, padding: '5px 10px' }}>Tạm Ngưng</Badge>
                        )}
                      </td>
                      {isSalesManager && (
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => {
                                setSelectedRoomType(rt);
                                setShowRoomTypeModal(true);
                              }}
                              title="Chỉnh sửa thông tin hạng phòng"
                            >
                              Sửa
                            </Button>
                            <Button
                              variant="outline-info"
                              size="sm"
                              onClick={() => {
                                setSelectedRoomType(rt);
                                setShowPriceModal(true);
                              }}
                              title="Cấu hình giá linh hoạt theo thứ trong tuần"
                            >
                              Giá Theo Thứ
                            </Button>
                            <Button
                              variant={rt.isActive ? 'outline-warning' : 'outline-success'}
                              size="sm"
                              onClick={() => handleToggleRoomTypeStatus(rt.roomTypeId)}
                              title="Bật / Tắt kích hoạt hạng phòng"
                            >
                              {rt.isActive ? 'Khóa' : 'Kích hoạt'}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Tab>

        <Tab eventKey="rooms" title={`2. Sơ Đồ Kho Phòng Vật Lý (${totalElements})`}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h4 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>
                  Danh Sách Phòng Vật Lý Trong Khách Sạn
                </h4>
                <span style={{ fontSize: 13, color: '#64748b' }}>
                  Quản lý số phòng theo từng tầng lầu, kiểm tra trạng thái lưu trú và theo dõi độ sạch buồng phòng.
                </span>
              </div>
              {isHkManager && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setSelectedRoom(null);
                    setShowRoomModal(true);
                  }}
                  style={{ background: '#0284c7', borderColor: '#0284c7', fontWeight: 600, fontSize: 14 }}
                >
                  + Thêm Phòng Vật Lý Mới
                </Button>
              )}
            </div>

            {/* Filter Bar */}
            <Form onSubmit={handleFilterSubmit} className="p-3 mb-4 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="row g-2 align-items-end">
                <div className="col-md-2 col-sm-6">
                  <Form.Label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Tầng lầu</Form.Label>
                  <Form.Select size="sm" name="floor" value={filters.floor} onChange={handleFilterChange}>
                    <option value="">Tất cả tầng</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((f) => (
                      <option key={f} value={f}>Tầng {f}</option>
                    ))}
                  </Form.Select>
                </div>
                <div className="col-md-2 col-sm-6">
                  <Form.Label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Hạng phòng</Form.Label>
                  <Form.Select size="sm" name="roomTypeId" value={filters.roomTypeId} onChange={handleFilterChange}>
                    <option value="">Tất cả hạng phòng</option>
                    {roomTypes.map((rt) => (
                      <option key={rt.roomTypeId} value={rt.roomTypeId}>{rt.typeName}</option>
                    ))}
                  </Form.Select>
                </div>
                <div className="col-md-2 col-sm-6">
                  <Form.Label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Độ sạch</Form.Label>
                  <Form.Select size="sm" name="cleaningStatus" value={filters.cleaningStatus} onChange={handleFilterChange}>
                    <option value="">Tất cả độ sạch</option>
                    <option value="DIRTY">Bẩn (Dirty)</option>
                    <option value="CLEAN">Đã dọn (Clean)</option>
                    <option value="INSPECTED">Đã kiểm tra (Inspected)</option>
                  </Form.Select>
                </div>
                <div className="col-md-2 col-sm-6">
                  <Form.Label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Khách ở</Form.Label>
                  <Form.Select size="sm" name="stayStatus" value={filters.stayStatus} onChange={handleFilterChange}>
                    <option value="">Tất cả lưu trú</option>
                    <option value="VACANT">Phòng trống (Vacant)</option>
                    <option value="OCCUPIED">Đang có khách (Occupied)</option>
                  </Form.Select>
                </div>
                <div className="col-md-2 col-sm-6">
                  <Form.Label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Trạng thái phòng</Form.Label>
                  <Form.Select size="sm" name="roomStatus" value={filters.roomStatus} onChange={handleFilterChange}>
                    <option value="">Hoạt động (Trừ lưu trữ)</option>
                    <option value="ACTIVE">Hoạt động bình thường</option>
                    <option value="UNDER_MAINTENANCE">Đang bảo trì</option>
                    <option value="ARCHIVED">Đã lưu trữ</option>
                  </Form.Select>
                </div>
                <div className="col-md-2 col-sm-6">
                  <Form.Label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Tìm số phòng</Form.Label>
                  <Form.Control
                    size="sm"
                    type="text"
                    name="search"
                    placeholder="Ví dụ: 101, 202..."
                    value={filters.search}
                    onChange={handleFilterChange}
                  />
                </div>
              </div>
              <div className="mt-3 d-flex justify-content-end gap-2">
                <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                  Đặt Lại Bộ Lọc
                </Button>
                <Button variant="primary" size="sm" type="submit" style={{ background: '#0284c7', borderColor: '#0284c7' }}>
                  Tìm Kiếm Phòng
                </Button>
              </div>
            </Form>

            {loadingRooms ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <div className="mt-2 text-muted" style={{ fontSize: 14 }}>Đang tải danh sách phòng...</div>
              </div>
            ) : rooms.length === 0 ? (
              <div className="text-center py-5 text-muted">Không tìm thấy phòng nào phù hợp với điều kiện tìm kiếm.</div>
            ) : (
              <>
                <Table hover responsive style={{ fontSize: 14, verticalAlign: 'middle' }}>
                  <thead style={{ background: '#f8fafc', color: '#475569' }}>
                    <tr>
                      <th style={{ width: 90 }}>Số Phòng</th>
                      <th style={{ width: 80 }}>Tầng</th>
                      <th>Hạng Phòng</th>
                      <th style={{ width: 140 }}>Đơn Giá Cơ Sở</th>
                      <th style={{ width: 130 }}>Khách Lưu Trú</th>
                      <th style={{ width: 130 }}>Độ Sạch</th>
                      <th style={{ width: 130 }}>Trạng Thái</th>
                      <th>Ghi Chú</th>
                      {isHkManager && <th style={{ width: 140, textAlign: 'center' }}>Thao Tác</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((r) => (
                      <tr key={r.roomId}>
                        <td>
                          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                            {r.roomNumber}
                          </span>
                        </td>
                        <td>Tầng {r.floor}</td>
                        <td>
                          <strong>{r.roomTypeName || r.roomType?.typeName}</strong>
                        </td>
                        <td>
                          <span style={{ color: '#0369a1' }}>{formatVND(r.basePrice)}</span>
                        </td>
                        <td>
                          <StatusBadge status={r.stayStatus} />
                        </td>
                        <td>
                          <StatusBadge status={r.cleaningStatus} />
                        </td>
                        <td>
                          <StatusBadge status={r.roomStatus} />
                        </td>
                        <td style={{ fontSize: 13, color: '#64748b' }}>
                          {r.notes || '—'}
                        </td>
                        {isHkManager && (
                          <td>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => {
                                  setSelectedRoom(r);
                                  setShowRoomModal(true);
                                }}
                                title="Chỉnh sửa thông tin phòng"
                              >
                                Sửa
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => {
                                  setSelectedRoom(r);
                                  setShowArchiveModal(true);
                                }}
                                title="Lưu trữ phòng"
                              >
                                Lưu Trữ
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </Table>

                {/* Server-side Pagination */}
                {totalPages > 1 && (
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <span style={{ fontSize: 13, color: '#64748b' }}>
                      Hiển thị trang <strong>{page + 1}</strong> / <strong>{totalPages}</strong> (Tổng số: {totalElements} phòng)
                    </span>
                    <Pagination size="sm" className="mb-0">
                      <Pagination.Prev disabled={page <= 0} onClick={() => loadRooms(page - 1)} />
                      {[...Array(totalPages)].map((_, i) => (
                        <Pagination.Item key={i} active={i === page} onClick={() => loadRooms(i)}>
                          {i + 1}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next disabled={page >= totalPages - 1} onClick={() => loadRooms(page + 1)} />
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </div>
        </Tab>
      </Tabs>

      {/* Modals for Tab 1 */}
      <RoomTypeModal
        show={showRoomTypeModal}
        onHide={() => setShowRoomTypeModal(false)}
        roomType={selectedRoomType}
        onSuccess={loadRoomTypes}
      />

      <RoomTypePriceModal
        show={showPriceModal}
        onHide={() => setShowPriceModal(false)}
        roomType={selectedRoomType}
        onSuccess={loadRoomTypes}
      />

      {/* Modals for Tab 2 */}
      <PhysicalRoomModal
        show={showRoomModal}
        onHide={() => setShowRoomModal(false)}
        room={selectedRoom}
        roomTypes={roomTypes}
        onSuccess={() => loadRooms(page)}
      />

      <ConfirmArchiveModal
        show={showArchiveModal}
        onHide={() => setShowArchiveModal(false)}
        room={selectedRoom}
        onSuccess={() => loadRooms(page)}
      />
    </div>
  );
};
