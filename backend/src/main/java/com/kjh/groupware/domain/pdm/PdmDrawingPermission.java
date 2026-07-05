package com.kjh.groupware.domain.pdm;

import com.kjh.groupware.domain.dept.Dept;
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
@Table(name = "pdm_drawing_permission")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PdmDrawingPermission extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "permission_id")
    private Long permissionId;

    @Column(name = "category", length = 30)
    private String category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "drawing_id")
    private PdmDrawing drawing;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dept_id")
    private Dept dept;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "emp_id")
    private Emp emp;

    @Column(name = "can_register_yn", nullable = false, length = 1)
    private String canRegisterYn;

    @Column(name = "can_revise_yn", nullable = false, length = 1)
    private String canReviseYn;

    @Column(name = "can_view_yn", nullable = false, length = 1)
    private String canViewYn;

    @Column(name = "can_download_request_yn", nullable = false, length = 1)
    private String canDownloadRequestYn;

    @Column(name = "can_download_approve_yn", nullable = false, length = 1)
    private String canDownloadApproveYn;

    @Builder
    private PdmDrawingPermission(
        String category,
        PdmDrawing drawing,
        Dept dept,
        Emp emp,
        boolean canRegister,
        boolean canRevise,
        boolean canView,
        boolean canDownloadRequest,
        boolean canDownloadApprove
    ) {
        this.category = category;
        this.drawing = drawing;
        this.dept = dept;
        this.emp = emp;
        this.canRegisterYn = yn(canRegister);
        this.canReviseYn = yn(canRevise);
        this.canViewYn = yn(canView);
        this.canDownloadRequestYn = yn(canDownloadRequest);
        this.canDownloadApproveYn = yn(canDownloadApprove);
    }

    public void update(
        String category,
        PdmDrawing drawing,
        Dept dept,
        Emp emp,
        boolean canRegister,
        boolean canRevise,
        boolean canView,
        boolean canDownloadRequest,
        boolean canDownloadApprove
    ) {
        this.category = category;
        this.drawing = drawing;
        this.dept = dept;
        this.emp = emp;
        this.canRegisterYn = yn(canRegister);
        this.canReviseYn = yn(canRevise);
        this.canViewYn = yn(canView);
        this.canDownloadRequestYn = yn(canDownloadRequest);
        this.canDownloadApproveYn = yn(canDownloadApprove);
    }

    private static String yn(boolean value) {
        return value ? "Y" : "N";
    }
}
