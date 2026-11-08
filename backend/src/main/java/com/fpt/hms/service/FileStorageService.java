package com.fpt.hms.service;

import com.fpt.hms.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Stores uploaded image files on local disk and returns the public relative
 * path to store in the database — exactly the way image URLs were stored
 * before (Room_Type.image_url / gallery_images hold plain link strings, the
 * file bytes never go into the database).
 *
 * <p>Storage layout: {@code <app.upload.dir>/room-types/<uuid>.<ext>}, served
 * publicly at {@code /uploads/room-types/<uuid>.<ext>} by WebConfig.
 * File names are always generated (UUID) so a malicious original file name
 * can never traverse directories or overwrite another file.
 *
 * <p>Validation (defence in depth, the browser {@code accept} attribute is
 * not trusted): non-empty, size cap, extension allow-list, declared
 * content-type allow-list, and magic-byte sniffing so a renamed script or
 * archive cannot pass as an image.
 */
@Slf4j
@Service
public class FileStorageService {

    /** Public URL prefix the files are served under (see WebConfig). */
    public static final String PUBLIC_PREFIX = "/uploads/";

    /** Sub-directory for room-type photos (main image + gallery). */
    public static final String ROOM_TYPE_SUBDIR = "room-types";

    /** Max files accepted in a single upload request (gallery batch). */
    public static final int MAX_FILES_PER_REQUEST = 10;

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp", "gif");

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif");

    /**
     * Expected magic bytes per extension. WebP has its signature split
     * ("RIFF" at 0, "WEBP" at 8) and is checked separately.
     */
    private static final Map<String, byte[]> MAGIC_BYTES = Map.of(
            "jpg", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF},
            "jpeg", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF},
            "png", new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A},
            "gif", new byte[]{0x47, 0x49, 0x46, 0x38});

    private final Path uploadDir;
    private final DataSize maxFileSize;

    public FileStorageService(
            @Value("${app.upload.dir:uploads}") String uploadDir,
            @Value("${app.upload.max-file-size:10MB}") DataSize maxFileSize) {
        this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();
        this.maxFileSize = maxFileSize;
    }

    /**
     * Stores one image file and returns its public relative path,
     * e.g. {@code /uploads/room-types/3f9a...c1.jpg}.
     */
    public String store(MultipartFile file, String subdir) {
        validate(file);
        String extension = extensionOf(file.getOriginalFilename());
        String storedName = UUID.randomUUID() + "." + extension;
        Path targetDir = uploadDir.resolve(subdir).normalize();
        Path target = targetDir.resolve(storedName).normalize();
        if (!target.startsWith(uploadDir)) {
            throw new BusinessException("MSG_IMAGE_INVALID_TYPE",
                    "Tên file ảnh không hợp lệ.", HttpStatus.BAD_REQUEST);
        }
        try {
            Files.createDirectories(targetDir);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            log.error("Could not store uploaded image {}", storedName, e);
            throw new BusinessException("MSG_IMAGE_STORE_FAILED",
                    "Không thể lưu ảnh tải lên. Vui lòng thử lại.", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        log.info("Stored uploaded image as {}", target);
        return PUBLIC_PREFIX + subdir + "/" + storedName;
    }

    /** Stores a batch of images (gallery upload), preserving request order. */
    public List<String> storeAll(List<MultipartFile> files, String subdir) {
        if (files == null || files.isEmpty()) {
            throw new BusinessException("MSG_IMAGE_EMPTY",
                    "Vui lòng chọn ít nhất một file ảnh để tải lên.", HttpStatus.BAD_REQUEST);
        }
        if (files.size() > MAX_FILES_PER_REQUEST) {
            throw new BusinessException("MSG_IMAGE_TOO_MANY",
                    "Mỗi lần chỉ được tải lên tối đa " + MAX_FILES_PER_REQUEST + " ảnh.",
                    HttpStatus.BAD_REQUEST);
        }
        List<String> urls = new ArrayList<>(files.size());
        for (MultipartFile file : files) {
            urls.add(store(file, subdir));
        }
        return urls;
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("MSG_IMAGE_EMPTY",
                    "File ảnh trống. Vui lòng chọn một file ảnh hợp lệ.", HttpStatus.BAD_REQUEST);
        }
        if (file.getSize() > maxFileSize.toBytes()) {
            throw new BusinessException("MSG_IMAGE_TOO_LARGE",
                    "Dung lượng ảnh vượt quá giới hạn cho phép (tối đa "
                            + maxFileSize.toMegabytes() + " MB mỗi file).",
                    HttpStatus.PAYLOAD_TOO_LARGE);
        }
        String extension = extensionOf(file.getOriginalFilename());
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BusinessException("MSG_IMAGE_INVALID_TYPE",
                    "Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận JPG, PNG, WebP, GIF.",
                    HttpStatus.BAD_REQUEST);
        }
        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank()
                && !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new BusinessException("MSG_IMAGE_INVALID_TYPE",
                    "Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận JPG, PNG, WebP, GIF.",
                    HttpStatus.BAD_REQUEST);
        }
        if (!matchesMagicBytes(file, extension)) {
            throw new BusinessException("MSG_IMAGE_INVALID_CONTENT",
                    "Nội dung file không phải là ảnh hợp lệ.", HttpStatus.BAD_REQUEST);
        }
    }

    private static String extensionOf(String originalFilename) {
        if (originalFilename == null) {
            return "";
        }
        String name = originalFilename.replace('\\', '/');
        int slash = name.lastIndexOf('/');
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return "";
        }
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private boolean matchesMagicBytes(MultipartFile file, String extension) {
        try (InputStream in = file.getInputStream()) {
            byte[] header = in.readNBytes(12);
            if ("webp".equals(extension)) {
                return header.length >= 12
                        && header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F'
                        && header[8] == 'W' && header[9] == 'E' && header[10] == 'B' && header[11] == 'P';
            }
            byte[] expected = MAGIC_BYTES.get(extension);
            if (expected == null || header.length < expected.length) {
                return false;
            }
            for (int i = 0; i < expected.length; i++) {
                if (header[i] != expected[i]) {
                    return false;
                }
            }
            return true;
        } catch (IOException e) {
            log.warn("Could not read uploaded file header for magic-byte check", e);
            return false;
        }
    }
}
