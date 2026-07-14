package com.kjh.groupware.domain.equipment;

import com.kjh.groupware.domain.dept.Dept;
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
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "equipment")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Equipment extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "equipment_id") private Long equipmentId;
    @Column(name = "equipment_no", nullable = false, unique = true, length = 50) private String equipmentNo;
    @Column(name = "equipment_name", nullable = false, length = 200) private String equipmentName;
    @Column(name = "location", length = 200) private String location;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "process_id") private EquipmentProcess process;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "owner_dept_id") private Dept ownerDept;
    @Column(name = "equipment_type", nullable = false, length = 20) private String equipmentType;
    @Column(name = "asset_no", length = 100) private String assetNo;
    @Column(name = "model_name", length = 200) private String modelName;
    @Column(name = "introduced_year") private Integer introducedYear;
    @Column(name = "introduced_price") private java.math.BigDecimal introducedPrice;
    @Column(name = "manufacturer", length = 200) private String manufacturer;
    @Column(name = "status", nullable = false, length = 30) private String status;

    public Equipment(String equipmentNo, String equipmentName, EquipmentProcess process, Dept ownerDept, String equipmentType, String assetNo, String modelName, Integer introducedYear, java.math.BigDecimal introducedPrice, String manufacturer, String status) {
        this.equipmentNo = equipmentNo;
        this.equipmentName = equipmentName;
        this.process = process;
        this.location = process == null ? null : process.getProcessName();
        this.ownerDept = ownerDept;
        this.equipmentType = equipmentType;
        this.assetNo = assetNo;
        this.modelName = modelName;
        this.introducedYear = introducedYear;
        this.introducedPrice = introducedPrice;
        this.manufacturer = manufacturer;
        this.status = status == null || status.isBlank() ? "ACTIVE" : status;
    }

    public void update(String equipmentName, EquipmentProcess process, Dept ownerDept, String equipmentType, String assetNo, String modelName, Integer introducedYear, java.math.BigDecimal introducedPrice, String manufacturer, String status) {
        this.equipmentName = equipmentName;
        this.process = process;
        this.location = process == null ? null : process.getProcessName();
        this.ownerDept = ownerDept;
        this.equipmentType = equipmentType;
        this.assetNo = assetNo;
        this.modelName = modelName;
        this.introducedYear = introducedYear;
        this.introducedPrice = introducedPrice;
        this.manufacturer = manufacturer;
        this.status = status == null || status.isBlank() ? "ACTIVE" : status;
    }
}
