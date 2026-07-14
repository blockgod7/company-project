package com.kjh.groupware.domain.equipment;

import com.kjh.groupware.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "equipment_process")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EquipmentProcess extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "process_id") private Long processId;
    @Column(name = "process_name", nullable = false, unique = true, length = 100) private String processName;
    @Column(name = "use_yn", nullable = false, length = 1) private String useYn;

    public EquipmentProcess(String processName) { this.processName = processName.trim(); this.useYn = "Y"; }
    public void update(String processName, String useYn) { this.processName = processName.trim(); this.useYn = useYn; }
}
