package com.kjh.groupware.domain.approval.dto;
import jakarta.validation.constraints.*; import java.math.BigDecimal; import java.time.LocalDate;
public record BereavementPolicyRequest(@NotBlank @Size(max=100) String eventType,@NotBlank @Size(max=100) String familyRelation,@NotNull @DecimalMin("0.5") BigDecimal allowedDays,@NotBlank String payType,@NotNull Boolean evidenceRequired,@NotNull LocalDate effectiveFrom,LocalDate effectiveTo,@NotNull Boolean active,@NotBlank @Size(max=500) String changeReason){}
