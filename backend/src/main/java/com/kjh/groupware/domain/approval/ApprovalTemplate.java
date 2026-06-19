package com.kjh.groupware.domain.approval;

import com.kjh.groupware.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "approval_template")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalTemplate extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "template_id")
    private Long templateId;

    @Column(name = "template_code", nullable = false, length = 50)
    private String templateCode;

    @Column(name = "template_name", nullable = false, length = 100)
    private String templateName;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "fields_json", nullable = false, columnDefinition = "text")
    private String fieldsJson;

    @Column(name = "print_layout_json", columnDefinition = "text")
    private String printLayoutJson;

    @Column(name = "active_yn", nullable = false, length = 1)
    private String activeYn;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Builder
    private ApprovalTemplate(
        String templateCode,
        String templateName,
        Integer version,
        String description,
        String fieldsJson,
        String printLayoutJson,
        String activeYn,
        Integer sortOrder
    ) {
        this.templateCode = templateCode;
        this.templateName = templateName;
        this.version = version;
        this.description = description;
        this.fieldsJson = fieldsJson;
        this.printLayoutJson = printLayoutJson;
        this.activeYn = activeYn == null ? "Y" : activeYn;
        this.sortOrder = sortOrder == null ? 0 : sortOrder;
    }
}
