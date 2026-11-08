package com.fpt.hms.dto.room;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * BR-07: room-type base price must be greater than 0. The rule used to rely
 * only on the V1 database CHECK (CK_Room_Type_Price), so a bad price failed
 * at the DB layer with a generic message. Both request DTOs already carry
 * {@code @DecimalMin("0.01")} and the controller validates with {@code @Valid},
 * so this test pins that behaviour: zero/negative prices are rejected at
 * the API boundary, 0.01 is the smallest accepted price.
 */
class RoomTypeRequestValidationTest {

    private static final Validator VALIDATOR =
            Validation.buildDefaultValidatorFactory().getValidator();

    private static Set<ConstraintViolation<CreateRoomTypeRequest>> validateCreate(BigDecimal price) {
        return VALIDATOR.validate(CreateRoomTypeRequest.builder()
                .typeName("Standard").capacity(2).basePrice(price).build());
    }

    private static Set<ConstraintViolation<UpdateRoomTypeRequest>> validateUpdate(BigDecimal price) {
        return VALIDATOR.validate(UpdateRoomTypeRequest.builder()
                .typeName("Standard").capacity(2).basePrice(price).build());
    }

    private static boolean hasBasePriceViolation(Set<? extends ConstraintViolation<?>> violations) {
        return violations.stream().anyMatch(v -> "basePrice".equals(v.getPropertyPath().toString()));
    }

    @Test
    void create_zeroPrice_rejected() {
        assertTrue(hasBasePriceViolation(validateCreate(BigDecimal.ZERO)));
    }

    @Test
    void create_negativePrice_rejected() {
        assertTrue(hasBasePriceViolation(validateCreate(new BigDecimal("-5"))));
    }

    @Test
    void create_minimumPrice_accepted() {
        assertEquals(0, validateCreate(new BigDecimal("0.01")).size());
    }

    @Test
    void create_normalPrice_accepted() {
        assertEquals(0, validateCreate(new BigDecimal("100.00")).size());
    }

    @Test
    void update_zeroPrice_rejected() {
        assertTrue(hasBasePriceViolation(validateUpdate(BigDecimal.ZERO)));
    }

    @Test
    void update_minimumPrice_accepted() {
        assertEquals(0, validateUpdate(new BigDecimal("0.01")).size());
    }
}
