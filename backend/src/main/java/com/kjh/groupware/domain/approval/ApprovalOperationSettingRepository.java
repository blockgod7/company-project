package com.kjh.groupware.domain.approval;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalOperationSettingRepository extends JpaRepository<ApprovalOperationSetting, String> {

    List<ApprovalOperationSetting> findBySettingKeyIn(Collection<String> settingKeys);
}
