package com.kjh.groupware.domain.equipment;

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
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "equipment_history_event")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EquipmentHistoryEvent extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "event_id") private Long eventId;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "equipment_id", nullable = false) private Equipment equipment;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "report_id", nullable = false) private EquipmentReport report;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "actor_emp_id") private Emp actor;
    @Column(name = "event_type", nullable = false, length = 50) private String eventType;
    @Column(name = "message", nullable = false, columnDefinition = "text") private String message;
    public EquipmentHistoryEvent(Equipment equipment, EquipmentReport report, Emp actor, String eventType, String message) {
        this.equipment = equipment; this.report = report; this.actor = actor; this.eventType = eventType; this.message = message;
    }
}
