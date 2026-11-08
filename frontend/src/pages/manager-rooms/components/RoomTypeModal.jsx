import { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { roomApi } from '../../../services/roomApi';
import { resolveImageUrl } from '../../../lib/imageUrl';
import { notifyToast } from '../../../lib/http';

// Chỉ 1 ảnh đại diện cho mỗi hạng phòng, tối đa 10 MB/file
// (khớp backend app.upload.max-file-size).
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const validateImageFile = (file) => {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `File "${file.name}" không phải ảnh JPG, PNG, WebP hoặc GIF.`;
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return `File "${file.name}" vượt quá 10 MB.`;
  }
  return null;
};

export const RoomTypeModal = ({ show, onHide, roomType, onSuccess }) => {
  const isEdit = Boolean(roomType && roomType.roomTypeId);

  const [formData, setFormData] = useState({
    typeName: '',
    capacity: 2,
    basePrice: '',
    amenities: '',
    description: '',
    imageUrl: '',
    isActive: true,
  });

  // File ảnh đại diện chọn từ máy (chưa upload).
  const [mainImageFile, setMainImageFile] = useState(null);
  const [mainPreview, setMainPreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (roomType) {
      setFormData({
        typeName: roomType.typeName || '',
        capacity: roomType.capacity || 2,
        basePrice: roomType.basePrice || '',
        amenities: roomType.amenities || '',
        description: roomType.description || '',
        imageUrl: roomType.imageUrl || '',
        isActive: roomType.isActive !== undefined ? roomType.isActive : true,
      });
    } else {
      setFormData({
        typeName: '',
        capacity: 2,
        basePrice: '',
        amenities: '',
        description: '',
        imageUrl: '',
        isActive: true,
      });
    }
    setMainImageFile(null);
    setErrorMsg(null);
  }, [roomType, show]);

  // Thu hồi object URL của ảnh xem trước khi đổi file / đóng modal.
  useEffect(() => {
    return () => {
      if (mainPreview) URL.revokeObjectURL(mainPreview);
    };
  }, [mainPreview]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleMainFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }
    setErrorMsg(null);
    if (mainPreview) URL.revokeObjectURL(mainPreview);
    setMainImageFile(file);
    setMainPreview(URL.createObjectURL(file));
  };

  const clearMainFile = () => {
    if (mainPreview) URL.revokeObjectURL(mainPreview);
    setMainImageFile(null);
    setMainPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.typeName.trim()) {
      setErrorMsg('Vui lòng nhập tên hạng phòng.');
      return;
    }
    if (!formData.capacity || Number(formData.capacity) < 1) {
      setErrorMsg('Sức chứa tối đa phải ít nhất 1 khách.');
      return;
    }
    if (!formData.basePrice || Number(formData.basePrice) <= 0) {
      setErrorMsg('Giá cơ sở phải lớn hơn 0 VNĐ.');
      return;
    }

    setLoading(true);
    try {
      // Upload ảnh đại diện trước, lấy đường dẫn rồi mới lưu form —
      // đường dẫn trả về được lưu vào imageUrl y như khi dán link ngoài.
      let imageUrl = formData.imageUrl.trim();

      if (mainImageFile) {
        setUploading(true);
        try {
          const { data } = await roomApi.uploadRoomTypeImages([mainImageFile]);
          const urls = data?.imageUrls || [];
          if (urls[0]) imageUrl = urls[0];
        } finally {
          setUploading(false);
        }
      }

      const payload = {
        typeName: formData.typeName.trim(),
        capacity: Number(formData.capacity),
        basePrice: Number(formData.basePrice),
        amenities: formData.amenities.trim(),
        description: formData.description.trim(),
        imageUrl,
        // Không sửa gallery ở đây nữa: giữ nguyên gallery cũ (nếu có) khi
        // chỉnh sửa, hạng phòng mới không có gallery.
        galleryImages: isEdit ? roomType.galleryImages || '' : '',
        ...(isEdit && { isActive: formData.isActive }),
      };

      if (isEdit) {
        await roomApi.updateRoomType(roomType.roomTypeId, payload);
        notifyToast({ type: 'SUCCESS', message: 'Cập nhật thông tin hạng phòng thành công!' });
      } else {
        await roomApi.createRoomType(payload);
        notifyToast({ type: 'SUCCESS', message: 'Thêm mới hạng phòng thành công!' });
      }

      onSuccess();
      onHide();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể lưu hạng phòng. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const mainPreviewSrc = mainPreview || resolveImageUrl(formData.imageUrl);

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static" size="lg">
      <Modal.Header closeButton style={{ background: '#0f172a', color: '#fff' }}>
        <Modal.Title style={{ fontSize: 18, fontWeight: 600 }}>
          {isEdit ? `Chỉnh Sửa Hạng Phòng #${roomType?.roomTypeId}` : 'Thêm Mới Hạng Phòng'}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body style={{ padding: 24 }}>
          {errorMsg && <Alert variant="danger" className="py-2 mb-3">{errorMsg}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600 }}>
              Tên hạng phòng <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              name="typeName"
              placeholder="Ví dụ: Deluxe City View, Suite VIP..."
              value={formData.typeName}
              onChange={handleChange}
              maxLength={100}
              required
            />
          </Form.Group>

          <div className="row">
            <div className="col-md-6 mb-3">
              <Form.Group>
                <Form.Label style={{ fontWeight: 600 }}>
                  Sức chứa tối đa (Khách) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="number"
                  name="capacity"
                  min="1"
                  max="20"
                  value={formData.capacity}
                  onChange={handleChange}
                  required
                />
              </Form.Group>
            </div>
            <div className="col-md-6 mb-3">
              <Form.Group>
                <Form.Label style={{ fontWeight: 600 }}>
                  Giá cơ bản / Đêm (VND) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="number"
                  name="basePrice"
                  step="10000"
                  min="10000"
                  placeholder="Ví dụ: 1200000"
                  value={formData.basePrice}
                  onChange={handleChange}
                  required
                />
              </Form.Group>
            </div>
          </div>

          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600 }}>Tiện nghi nổi bật</Form.Label>
            <Form.Control
              type="text"
              name="amenities"
              placeholder="Ví dụ: Wifi tốc độ cao, Ban công ngắm phố, Bồn tắm sục, Mini Bar..."
              value={formData.amenities}
              onChange={handleChange}
              maxLength={1000}
            />
            <Form.Text className="text-muted">Ngăn cách các tiện nghi bằng dấu phẩy.</Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600 }}>Ảnh đại diện</Form.Label>
            <Form.Control
              type="url"
              name="imageUrl"
              placeholder="Dán link ảnh ngoài, ví dụ: https://images.unsplash.com/..."
              value={formData.imageUrl}
              onChange={handleChange}
              maxLength={500}
            />
            <Form.Text className="text-muted">
              Hoặc tải ảnh từ máy (JPG, PNG, WebP, GIF — tối đa 10 MB). File tải lên sẽ thay thế link ở trên khi lưu.
            </Form.Text>
            <Form.Control
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleMainFileChange}
              className="mt-2"
            />
            {mainImageFile && (
              <div className="text-muted small mt-1">
                File đã chọn: {mainImageFile.name}{' '}
                <Button variant="link" size="sm" className="p-0" onClick={clearMainFile}>
                  Hủy file đã chọn
                </Button>
              </div>
            )}
            {mainPreviewSrc && (
              <img
                src={mainPreviewSrc}
                alt="Xem trước ảnh đại diện"
                className="mt-2 rounded"
                style={{ maxWidth: '100%', maxHeight: 180, objectFit: 'cover' }}
              />
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600 }}>Mô tả chi tiết</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="description"
              placeholder="Thông tin giới thiệu về hạng phòng..."
              value={formData.description}
              onChange={handleChange}
              maxLength={1000}
            />
          </Form.Group>

          {isEdit && (
            <Form.Check
              type="switch"
              id="isActiveSwitch"
              label="Trạng thái mở bán (Kích hoạt)"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="mt-2"
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={loading}>
            Hủy bỏ
          </Button>
          <Button variant="primary" type="submit" disabled={loading} style={{ background: '#0284c7', borderColor: '#0284c7' }}>
            {loading ? (uploading ? 'Đang tải ảnh lên...' : 'Đang lưu...') : isEdit ? 'Cập nhật Hạng Phòng' : 'Tạo Hạng Phòng'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};
