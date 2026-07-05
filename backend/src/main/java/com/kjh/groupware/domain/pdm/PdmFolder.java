package com.kjh.groupware.domain.pdm;

import com.kjh.groupware.domain.emp.Emp;
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
@Table(name = "pdm_folder")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PdmFolder extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "folder_id")
    private Long folderId;

    @Column(name = "category", nullable = false, length = 30)
    private String category;

    @Column(name = "company_name", length = 150)
    private String companyName;

    @Column(name = "project_name", length = 150)
    private String projectName;

    @Column(name = "business_unit", length = 150)
    private String businessUnit;

    @Column(name = "process_name", length = 150)
    private String processName;

    @Column(name = "folder_kind", nullable = false, length = 30)
    private String folderKind;

    @Column(name = "folder_name", nullable = false, length = 150)
    private String folderName;

    @Column(name = "created_by_emp_id", nullable = false)
    private Long createdByEmpId;

    @Builder
    private PdmFolder(
        String category,
        String companyName,
        String projectName,
        String businessUnit,
        String processName,
        String folderKind,
        String folderName,
        Emp createdBy
    ) {
        this.category = category;
        this.companyName = companyName;
        this.projectName = projectName;
        this.businessUnit = businessUnit;
        this.processName = processName;
        this.folderKind = folderKind;
        this.folderName = folderName;
        this.createdByEmpId = createdBy == null ? null : createdBy.getEmpId();
    }

    public void rename(String folderName) {
        this.folderName = folderName;
    }

    public void renameCompany(String oldName, String newName) {
        if (oldName.equals(folderName)) {
            this.folderName = newName;
        }
        if (oldName.equals(companyName)) {
            this.companyName = newName;
        }
    }

    public void renameProject(String oldName, String newName) {
        if (oldName.equals(folderName)) {
            this.folderName = newName;
        }
        if (oldName.equals(projectName)) {
            this.projectName = newName;
        }
    }

    public void renameBusinessUnit(String oldName, String newName) {
        if (oldName.equals(folderName)) {
            this.folderName = newName;
        }
        if (oldName.equals(businessUnit)) {
            this.businessUnit = newName;
        }
    }

    public void renameProcess(String oldName, String newName) {
        if (oldName.equals(folderName)) {
            this.folderName = newName;
        }
        if (oldName.equals(processName)) {
            this.processName = newName;
        }
    }
}
