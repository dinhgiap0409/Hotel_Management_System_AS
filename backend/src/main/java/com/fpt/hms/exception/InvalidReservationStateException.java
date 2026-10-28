package com.fpt.hms.exception;

import lombok.Getter;

@Getter
public class InvalidReservationStateException extends RuntimeException {
    private final String errorCode;

    public InvalidReservationStateException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
