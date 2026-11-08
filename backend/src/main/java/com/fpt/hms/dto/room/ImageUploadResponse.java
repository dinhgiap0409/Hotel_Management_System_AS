package com.fpt.hms.dto.room;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response of POST /api/v1/room-types/images: the public relative paths of
 * the stored files, in upload order. The caller stores them exactly like a
 * pasted image URL — imageUrls[0] into imageUrl, the rest (gallery batch)
 * appended to gallery_images, comma-separated.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ImageUploadResponse {
    private List<String> imageUrls;
}
