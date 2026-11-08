package com.fpt.hms.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Serves uploaded files (room-type photos, see FileStorageService) from the
 * local upload directory at the public path {@code /uploads/**}.
 * Files are stored outside the deployable artifact, so a redeploy never
 * wipes them; the path is public (see SecurityConfig) so guests can see
 * room-type photos on the catalogue without logging in.
 *
 * <p>The resource location MUST end with a trailing slash: Spring resolves a
 * requested file with {@code new URL(location, relativePath)}, and a location
 * without the slash makes it drop the last path segment (the upload dir
 * itself), so every file 404s even though the upload succeeded. Worse,
 * {@code Path.toUri()} only appends the slash when the directory already
 * exists — and at the first backend start the upload dir usually does not
 * exist yet (FileStorageService creates it lazily on the first upload).
 * Creating the directory at startup and forcing the trailing slash makes
 * serving work from the very first upload.
 */
@Slf4j
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path dir = Path.of(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            log.warn("Could not create upload directory {}", dir, e);
        }
        String location = dir.toUri().toString();
        if (!location.endsWith("/")) {
            location += "/";
        }
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(location)
                .setCachePeriod(3600);
    }
}
