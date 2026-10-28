package com.fpt.hms.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class ClockConfig {

    @Bean
    public Clock hotelClock(@Value("${app.hotel.timezone:Asia/Ho_Chi_Minh}") String timezone) {
        return Clock.system(ZoneId.of(timezone));
    }
}
