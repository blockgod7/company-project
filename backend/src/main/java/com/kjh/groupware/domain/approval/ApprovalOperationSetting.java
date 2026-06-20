package com.kjh.groupware.domain.approval;

import com.kjh.groupware.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "approval_operation_setting")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalOperationSetting extends BaseEntity {

    public static final String KEY_DECISION_DUE_HOURS = "DECISION_DUE_HOURS";
    public static final String KEY_REMINDER_FIXED_DELAY_MS = "REMINDER_FIXED_DELAY_MS";
    public static final String KEY_DELETED_DOCUMENT_RETENTION_DAYS = "DELETED_DOCUMENT_RETENTION_DAYS";
    public static final String KEY_PERMANENT_DELETE_ENABLED = "PERMANENT_DELETE_ENABLED";

    @Id
    @Column(name = "setting_key", nullable = false, length = 100)
    private String settingKey;

    @Column(name = "setting_value", nullable = false, length = 500)
    private String settingValue;

    @Column(name = "description", length = 500)
    private String description;

    public ApprovalOperationSetting(String settingKey, String settingValue, String description) {
        this.settingKey = settingKey;
        this.settingValue = settingValue;
        this.description = description;
    }

    public void updateValue(String settingValue) {
        this.settingValue = settingValue;
    }
}
