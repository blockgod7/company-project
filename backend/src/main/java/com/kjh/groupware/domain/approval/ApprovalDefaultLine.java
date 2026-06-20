package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "approval_default_line")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalDefaultLine extends BaseEntity {

    public static final String TYPE_PERSONAL = "PERSONAL";
    public static final String TYPE_TEMPLATE = "TEMPLATE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "default_line_id")
    private Long defaultLineId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_emp_id")
    private Emp owner;

    @Column(name = "template_code", length = 50)
    private String templateCode;

    @Column(name = "line_name", nullable = false, length = 100)
    private String lineName;

    @Column(name = "default_type", nullable = false, length = 30)
    private String defaultType;

    @Column(name = "active_yn", nullable = false, length = 1)
    private String activeYn;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(name = "deleted_yn", nullable = false, length = 1)
    private String deletedYn;

    @Builder
    private ApprovalDefaultLine(
        Emp owner,
        String templateCode,
        String lineName,
        String defaultType,
        String activeYn,
        Integer sortOrder,
        String deletedYn
    ) {
        this.owner = owner;
        this.templateCode = templateCode;
        this.lineName = lineName == null || lineName.isBlank() ? "기본 결재선" : lineName;
        this.defaultType = defaultType == null ? TYPE_PERSONAL : defaultType;
        this.activeYn = activeYn == null ? "Y" : activeYn;
        this.sortOrder = sortOrder == null ? 0 : sortOrder;
        this.deletedYn = deletedYn == null ? "N" : deletedYn;
    }

    public void deactivate() {
        this.activeYn = "N";
    }
}
