package com.kjh.groupware.domain.emp;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class EmpWorkCategoryPolicyTest {

    @Test
    void classifiesManagementAndFieldPositionsWhenEmployeeIsCreated() {
        assertThat(employee("기장").getWorkCategory()).isEqualTo("MANAGEMENT");
        assertThat(employee("총괄이사").getWorkCategory()).isEqualTo("MANAGEMENT");
        assertThat(employee("조장").getWorkCategory()).isEqualTo("FIELD");
        assertThat(employee("반장").getWorkCategory()).isEqualTo("FIELD");
    }

    @Test
    void preservesManualCategoryForMixedStaffPosition() {
        Emp emp = employee("사원");
        emp.updateWorkCategory("MANAGEMENT");

        emp.updateProfile(
            "테스트", "MALE", null, null, null, null, "사원", null, null,
            LocalDate.of(2024, 1, 1), "REGULAR", null, null
        );

        assertThat(emp.getWorkCategory()).isEqualTo("MANAGEMENT");
    }

    private Emp employee(String positionName) {
        return Emp.pending(
            "TEST-" + positionName, "테스트", "MALE", null, null, null, null,
            positionName, null, null, LocalDate.of(2024, 1, 1), "REGULAR", null, null
        );
    }
}
