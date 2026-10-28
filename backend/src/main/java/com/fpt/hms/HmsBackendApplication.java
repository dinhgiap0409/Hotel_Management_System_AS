package com.fpt.hms;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class HmsBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(HmsBackendApplication.class, args);
    }

    @PostConstruct
    public void initUtcTimezone() {
        // SDD Section 4.1.1.2: JVM runs in UTC; business dates use injected hotel Clock
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
    }
}
