package com.kjh.groupware.domain.emp.dto;

import java.time.LocalDate;

public record EmployeeShiftRequest(String shiftType, LocalDate shiftAnchorDate) {
}
