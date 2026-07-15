package com.kjh.groupware.domain.equipment;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.entity.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "equipment_assignment_authority")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EquipmentAssignmentAuthority extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long authorityId;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "emp_id", nullable = false) private Emp emp;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "granted_by_emp_id", nullable = false) private Emp grantedBy;

    public EquipmentAssignmentAuthority(Emp emp, Emp grantedBy) { this.emp = emp; this.grantedBy = grantedBy; }
}
