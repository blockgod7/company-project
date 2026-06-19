package com.kjh.groupware.global.response;

import java.time.LocalDateTime;

public record ApiResponse<T>(
    boolean success,
    T data,
    String code,
    String message,
    Integer status,
    LocalDateTime timestamp
) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null, null, 200, LocalDateTime.now());
    }

    public static <T> ApiResponse<T> ok(T data, String message) {
        return new ApiResponse<>(true, data, null, message, 200, LocalDateTime.now());
    }

    public static <T> ApiResponse<T> fail(String message) {
        return fail("ERROR", message, 500);
    }

    public static <T> ApiResponse<T> fail(String code, String message, int status) {
        return new ApiResponse<>(false, null, code, message, status, LocalDateTime.now());
    }
}
