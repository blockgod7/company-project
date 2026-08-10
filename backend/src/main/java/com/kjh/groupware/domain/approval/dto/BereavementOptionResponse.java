package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.BereavementCatalog;
import com.kjh.groupware.domain.approval.BereavementPolicy;
import java.math.BigDecimal;

public record BereavementOptionResponse(
    String eventType,
    String eventTypeLabel,
    String familyRelation,
    String familyRelationLabel,
    BigDecimal allowedDays,
    String payType,
    boolean evidenceRequired
) {
    public static BereavementOptionResponse from(BereavementPolicy policy) {
        return new BereavementOptionResponse(
            policy.getEventType(), BereavementCatalog.eventLabel(policy.getEventType()),
            policy.getFamilyRelation(), BereavementCatalog.relationLabel(policy.getFamilyRelation()),
            policy.getAllowedDays(), policy.getPayType(), policy.isEvidenceRequired()
        );
    }
}
