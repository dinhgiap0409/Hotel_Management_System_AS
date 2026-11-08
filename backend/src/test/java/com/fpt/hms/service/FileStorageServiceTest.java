package com.fpt.hms.service;

import com.fpt.hms.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Unit tests for room-type image upload storage. No Spring context, no
 * database — the service only touches the local filesystem.
 */
class FileStorageServiceTest {

    private static final byte[] PNG_BYTES = {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x01, 0x02, 0x03};
    private static final byte[] JPEG_BYTES = {
            (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x01, 0x02, 0x03};
    private static final byte[] WEBP_BYTES = {
            'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P', 0x01};

    @TempDir
    Path tempDir;

    private FileStorageService service() {
        return new FileStorageService(tempDir.toString(), DataSize.ofMegabytes(5));
    }

    private static MockMultipartFile png(String name) {
        return new MockMultipartFile("files", name, "image/png", PNG_BYTES);
    }

    @Test
    void storeValidPng_returnsPublicPathAndWritesFile() throws IOException {
        String url = service().store(png("phong-deluxe.png"), "room-types");

        assertTrue(url.startsWith("/uploads/room-types/"), "url: " + url);
        assertTrue(url.endsWith(".png"), "url: " + url);
        Path stored = tempDir.resolve("room-types").resolve(url.substring("/uploads/room-types/".length()));
        assertTrue(Files.exists(stored));
        assertTrue(java.util.Arrays.equals(PNG_BYTES, Files.readAllBytes(stored)));
    }

    @Test
    void storeValidJpegAndWebp_keepExtension() {
        String jpg = service().store(
                new MockMultipartFile("files", "a.jpg", "image/jpeg", JPEG_BYTES), "room-types");
        String webp = service().store(
                new MockMultipartFile("files", "b.webp", "image/webp", WEBP_BYTES), "room-types");
        assertTrue(jpg.endsWith(".jpg"), "url: " + jpg);
        assertTrue(webp.endsWith(".webp"), "url: " + webp);
    }

    @Test
    void storeSameFileTwice_generatesDifferentNames() {
        FileStorageService s = service();
        String first = s.store(png("same.png"), "room-types");
        String second = s.store(png("same.png"), "room-types");
        assertNotEquals(first, second);
    }

    @Test
    void storeEmptyFile_rejected() {
        BusinessException ex = assertThrows(BusinessException.class, () ->
                service().store(
                        new MockMultipartFile("files", "empty.png", "image/png", new byte[0]),
                        "room-types"));
        assertEquals("MSG_IMAGE_EMPTY", ex.getErrorCode());
    }

    @Test
    void storeOversizedFile_rejected() {
        FileStorageService tiny = new FileStorageService(tempDir.toString(), DataSize.ofBytes(10));
        BusinessException ex = assertThrows(BusinessException.class, () ->
                tiny.store(png("big.png"), "room-types"));
        assertEquals("MSG_IMAGE_TOO_LARGE", ex.getErrorCode());
    }

    @Test
    void storeDisallowedExtension_rejected() {
        BusinessException ex = assertThrows(BusinessException.class, () ->
                service().store(
                        new MockMultipartFile("files", "script.exe", "application/octet-stream",
                                PNG_BYTES),
                        "room-types"));
        assertEquals("MSG_IMAGE_INVALID_TYPE", ex.getErrorCode());
    }

    @Test
    void storeFakePngWithTextContent_rejectedByMagicBytes() {
        BusinessException ex = assertThrows(BusinessException.class, () ->
                service().store(
                        new MockMultipartFile("files", "fake.png", "image/png",
                                "not an image at all".getBytes()),
                        "room-types"));
        assertEquals("MSG_IMAGE_INVALID_CONTENT", ex.getErrorCode());
    }

    @Test
    void storePathTraversalFilename_neverEscapesUploadDir() throws IOException {
        String url = service().store(png("../../evil.png"), "room-types");

        assertTrue(!url.contains(".."), "url: " + url);
        Path stored = tempDir.resolve("room-types").resolve(url.substring("/uploads/room-types/".length()));
        assertTrue(Files.exists(stored));
        assertTrue(stored.normalize().startsWith(tempDir.normalize()));
    }

    @Test
    void storeAllEmptyList_rejected() {
        BusinessException ex = assertThrows(BusinessException.class, () ->
                service().storeAll(List.of(), "room-types"));
        assertEquals("MSG_IMAGE_EMPTY", ex.getErrorCode());
    }

    @Test
    void storeAllTooManyFiles_rejected() {
        List<MultipartFile> files = new ArrayList<>();
        for (int i = 0; i < 11; i++) {
            files.add(png("img" + i + ".png"));
        }
        BusinessException ex = assertThrows(BusinessException.class, () ->
                service().storeAll(files, "room-types"));
        assertEquals("MSG_IMAGE_TOO_MANY", ex.getErrorCode());
    }

    @Test
    void storeAll_preservesOrder() {
        List<String> urls = service().storeAll(List.of(
                        png("first.png"),
                        new MockMultipartFile("files", "second.jpg", "image/jpeg", JPEG_BYTES)),
                "room-types");
        assertEquals(2, urls.size());
        assertTrue(urls.get(0).endsWith(".png"), "urls: " + urls);
        assertTrue(urls.get(1).endsWith(".jpg"), "urls: " + urls);
    }
}
