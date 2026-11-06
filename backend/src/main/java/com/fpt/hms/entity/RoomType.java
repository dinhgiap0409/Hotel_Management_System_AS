successfully downloaded text file (SHA: 2a711a908fc6f13a929a87e5237bf8791ca77df1)package com.fpt.hms.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "[Room_Type]")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "room_type_id")
    private Integer roomTypeId;

    @Column(name = "type_name", nullable = false, unique = true, length = 100)
    private String typeName;

    @Column(name = "capacity", nullable = false)
    private Integer capacity;

    @Column(name = "base_price", nullable = false, precision = 18, scale = 2)
    private BigDecimal basePrice;

    @Column(name = "amenities", length = 1000)
    private String amenities;

    @Column(name = "description", length = 1000)
    private String description;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    /**
     * Extra detail photos for the room-type gallery (UC-22), stored as a
     * comma-separated list of image URLs. All seed photos are Unsplash hotel
     * photos (images.unsplash.com) verified to return HTTP 200; see
     * database/V2__seed_master_data.sql.
     */
    @Column(name = "gallery_images", columnDefinition = "NVARCHAR(MAX)")
    private String galleryImages;

    /** Detail-gallery URLs, trimmed and non-blank, in stored order. */
    @Transient
    public List<String> getGalleryImageList() {
        List<String> result = new ArrayList<>();
        if (galleryImages != null) {
            for (String url : galleryImages.split(",")) {
                String trimmed = url.trim();
                if (!trimmed.isEmpty()) {
                    result.add(trimmed);
                }
            }
        }
        return result;
    }

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
}
