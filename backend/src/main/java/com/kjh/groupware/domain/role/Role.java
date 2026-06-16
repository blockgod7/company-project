package com.kjh.groupware.domain.role;

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
@Table(name = "role")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Role extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "role_id")
    private Long roleId;

    @Column(name = "role_code", nullable = false, unique = true, length = 30)
    private String roleCode;

    @Column(name = "role_name", nullable = false, length = 100)
    private String roleName;

    @Column(name = "description")
    private String description;

    @Column(name = "use_yn", nullable = false, length = 1)
    private String useYn;
}
