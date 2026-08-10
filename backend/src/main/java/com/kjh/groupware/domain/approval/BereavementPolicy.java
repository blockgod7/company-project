package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.entity.BaseEntity;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.*;

@Entity @Table(name = "bereavement_policy") @Getter @NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BereavementPolicy extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name="bereavement_policy_id") private Long bereavementPolicyId;
    @Column(name="event_type",nullable=false,length=100) private String eventType;
    @Column(name="family_relation",nullable=false,length=100) private String familyRelation;
    @Column(name="allowed_days",nullable=false,precision=5,scale=1) private BigDecimal allowedDays;
    @Column(name="pay_type",nullable=false,length=20) private String payType;
    @Column(name="evidence_required_yn",nullable=false,length=1) private String evidenceRequiredYn;
    @Column(name="effective_from",nullable=false) private LocalDate effectiveFrom;
    @Column(name="effective_to") private LocalDate effectiveTo;
    @Column(name="active_yn",nullable=false,length=1) private String activeYn;
    @Column(name="change_reason",nullable=false,length=500) private String changeReason;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="last_changed_by") private Emp lastChangedBy;

    public BereavementPolicy(String eventType,String relation,BigDecimal days,String payType,boolean evidence,LocalDate from,LocalDate to,boolean active,String reason,Emp actor){ update(eventType,relation,days,payType,evidence,from,to,active,reason,actor); }
    public void update(String eventType,String relation,BigDecimal days,String payType,boolean evidence,LocalDate from,LocalDate to,boolean active,String reason,Emp actor){this.eventType=eventType;this.familyRelation=relation;this.allowedDays=days;this.payType=payType;this.evidenceRequiredYn=evidence?"Y":"N";this.effectiveFrom=from;this.effectiveTo=to;this.activeYn=active?"Y":"N";this.changeReason=reason;this.lastChangedBy=actor;}
    public boolean isEvidenceRequired(){return "Y".equals(evidenceRequiredYn);} public boolean isActive(){return "Y".equals(activeYn);}
}
