package com.kjh.groupware.domain.approval;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.approval")
public record ApprovalOperationProperties(
    long decisionDueHours,
    long reminderFixedDelayMs
) {

    public ApprovalOperationProperties {
        if (decisionDueHours < 1) {
            decisionDueHours = 72;
        }
        if (reminderFixedDelayMs < 1000) {
            reminderFixedDelayMs = 300000;
        }
    }
}
