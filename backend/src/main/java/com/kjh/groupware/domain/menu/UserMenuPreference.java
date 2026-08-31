package com.kjh.groupware.domain.menu;

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
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
    name = "user_menu_preference",
    uniqueConstraints = @UniqueConstraint(columnNames = {"emp_id", "menu_id"})
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserMenuPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_menu_preference_id")
    private Long userMenuPreferenceId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "emp_id", nullable = false)
    private Emp emp;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "menu_id", nullable = false)
    private Menu menu;

    @Column(name = "sort_order")
    private Integer sortOrder;

    @Column(name = "pinned_yn", nullable = false, length = 1)
    private String pinnedYn;

    @Column(name = "hidden_yn", nullable = false, length = 1)
    private String hiddenYn;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public UserMenuPreference(Emp emp, Menu menu) {
        this.emp = emp;
        this.menu = menu;
        this.pinnedYn = "N";
        this.hiddenYn = "N";
    }

    public void update(Integer sortOrder, boolean pinned, boolean hidden) {
        this.sortOrder = sortOrder;
        this.pinnedYn = pinned ? "Y" : "N";
        this.hiddenYn = hidden ? "Y" : "N";
    }
}
