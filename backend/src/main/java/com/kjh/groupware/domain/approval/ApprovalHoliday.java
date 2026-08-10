package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "approval_holiday")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalHoliday {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "holiday_id")
    private Long holidayId;

    @Column(name = "holiday_date", nullable = false, unique = true)
    private LocalDate holidayDate;

    @Column(name = "holiday_name", nullable = false, length = 100)
    private String holidayName;

    @Column(name = "holiday_type", nullable = false, length = 30)
    private String holidayType;

    @Column(name = "source_type", nullable = false, length = 20)
    private String sourceType;

    @Column(name = "repeat_type", nullable = false, length = 20)
    private String repeatType;

    @Column(name = "apply_year")
    private Integer applyYear;

    @Column(name = "repeat_month")
    private Integer repeatMonth;

    @Column(name = "repeat_day")
    private Integer repeatDay;

    @Column(name = "policy_version", length = 50)
    private String policyVersion;

    @Column(name = "basis_source", length = 500)
    private String basisSource;

    @Column(name = "active_yn", nullable = false, length = 1)
    private String activeYn;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private Emp createdBy;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private Emp updatedBy;

    public ApprovalHoliday(LocalDate holidayDate, String holidayName, String holidayType, boolean active, Emp creator) {
        this(
            holidayDate,
            holidayName,
            holidayType,
            isLegalType(holidayType) ? "LEGAL" : "COMPANY",
            "YEAR_ONLY",
            null,
            null,
            active,
            creator
        );
    }

    public ApprovalHoliday(
        LocalDate holidayDate,
        String holidayName,
        String holidayType,
        String sourceType,
        String repeatType,
        String policyVersion,
        String basisSource,
        boolean active,
        Emp creator
    ) {
        this.holidayDate = holidayDate;
        this.holidayName = holidayName;
        this.holidayType = holidayType;
        applyPolicy(sourceType, repeatType, policyVersion, basisSource);
        this.activeYn = active ? "Y" : "N";
        this.createdBy = creator;
    }

    public void update(LocalDate holidayDate, String holidayName, String holidayType, boolean active, Emp editor) {
        update(
            holidayDate,
            holidayName,
            holidayType,
            sourceType,
            repeatType,
            policyVersion,
            basisSource,
            active,
            editor
        );
    }

    public void update(
        LocalDate holidayDate,
        String holidayName,
        String holidayType,
        String sourceType,
        String repeatType,
        String policyVersion,
        String basisSource,
        boolean active,
        Emp editor
    ) {
        this.holidayDate = holidayDate;
        this.holidayName = holidayName;
        this.holidayType = holidayType;
        applyPolicy(sourceType, repeatType, policyVersion, basisSource);
        this.activeYn = active ? "Y" : "N";
        this.updatedBy = editor;
        this.updatedAt = LocalDateTime.now();
    }

    public void deactivate(Emp editor) {
        this.activeYn = "N";
        this.updatedBy = editor;
        this.updatedAt = LocalDateTime.now();
    }

    public boolean isActive() {
        return "Y".equals(activeYn);
    }

    public boolean isAnnualRepeat() {
        return "ANNUAL".equals(repeatType);
    }

    public boolean isOfficial() {
        return "LEGAL".equals(sourceType) && policyVersion != null && !policyVersion.isBlank();
    }

    private void applyPolicy(String sourceType, String repeatType, String policyVersion, String basisSource) {
        this.sourceType = sourceType;
        this.repeatType = repeatType;
        this.applyYear = holidayDate.getYear();
        this.repeatMonth = "ANNUAL".equals(repeatType) ? holidayDate.getMonthValue() : null;
        this.repeatDay = "ANNUAL".equals(repeatType) ? holidayDate.getDayOfMonth() : null;
        this.policyVersion = policyVersion;
        this.basisSource = basisSource;
    }

    private static boolean isLegalType(String holidayType) {
        return "PUBLIC_HOLIDAY".equals(holidayType) || "SUBSTITUTE_HOLIDAY".equals(holidayType);
    }
}
