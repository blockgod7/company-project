package com.kjh.groupware.domain.pdm;

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
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "pdm_drawing", uniqueConstraints = @UniqueConstraint(name = "uk_pdm_drawing_no", columnNames = "drawing_no"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PdmDrawing extends BaseEntity {

    public static final String CATEGORY_PRODUCT = "PRODUCT";
    public static final String CATEGORY_EQUIPMENT = "EQUIPMENT";
    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_OLD_VERSION = "OLD_VERSION";
    public static final String STATUS_VOIDED = "VOIDED";
    public static final String STATUS_ON_HOLD = "ON_HOLD";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "drawing_id")
    private Long drawingId;

    @Column(name = "category", nullable = false, length = 30)
    private String category;

    @Column(name = "drawing_no", nullable = false, length = 100)
    private String drawingNo;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "company_name", length = 150)
    private String companyName;

    @Column(name = "project_name", length = 150)
    private String projectName;

    @Column(name = "business_unit", length = 150)
    private String businessUnit;

    @Column(name = "process_name", length = 150)
    private String processName;

    @Column(name = "equipment_name", length = 150)
    private String equipmentName;

    @Column(name = "group_name", length = 150)
    private String groupName;

    @Column(name = "status", nullable = false, length = 30)
    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_revision_id")
    private PdmDrawingRevision currentRevision;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "created_by_emp_id", nullable = false)
    private Long createdByEmpId;

    @Builder
    private PdmDrawing(
        String category,
        String drawingNo,
        String title,
        String companyName,
        String projectName,
        String businessUnit,
        String processName,
        String equipmentName,
        String groupName,
        String status,
        String description,
        Emp createdBy
    ) {
        this.category = category;
        this.drawingNo = drawingNo;
        this.title = title;
        this.companyName = companyName;
        this.projectName = projectName;
        this.businessUnit = businessUnit;
        this.processName = processName;
        this.equipmentName = equipmentName;
        this.groupName = groupName;
        this.status = status == null || status.isBlank() ? STATUS_ACTIVE : status;
        this.description = description;
        this.createdByEmpId = createdBy == null ? null : createdBy.getEmpId();
    }

    public void updateMeta(String title, String companyName, String projectName, String businessUnit, String processName, String equipmentName, String groupName, String status, String description) {
        this.title = title;
        this.companyName = companyName;
        this.projectName = projectName;
        this.businessUnit = businessUnit;
        this.processName = processName;
        this.equipmentName = equipmentName;
        this.groupName = groupName;
        this.status = status == null || status.isBlank() ? STATUS_ACTIVE : status;
        this.description = description;
    }

    public void markCurrentRevision(PdmDrawingRevision revision) {
        this.currentRevision = revision;
    }

    public void clearCurrentRevision() {
        this.currentRevision = null;
    }

    public void voidDrawing() {
        this.status = STATUS_VOIDED;
    }

    public void changeStatus(String status) {
        this.status = status == null || status.isBlank() ? STATUS_ACTIVE : status;
    }

    public void renameCompany(String oldName, String newName) {
        if (oldName.equals(companyName)) {
            this.companyName = newName;
        }
    }

    public void renameProject(String oldName, String newName) {
        if (oldName.equals(projectName)) {
            this.projectName = newName;
        }
        if (projectName == null && oldName.equals(groupName)) {
            this.groupName = newName;
        }
    }

    public void renameBusinessUnit(String oldName, String newName) {
        if (oldName.equals(businessUnit)) {
            this.businessUnit = newName;
        }
    }

    public void renameProcess(String oldName, String newName) {
        if (oldName.equals(processName)) {
            this.processName = newName;
        }
    }

    public void renameGroup(String oldName, String newName) {
        if (oldName.equals(groupName)) {
            this.groupName = newName;
        }
    }

    public void renameEquipment(String oldName, String newName) {
        if (oldName.equals(equipmentName)) {
            this.equipmentName = newName;
        }
    }
}
