package com.kjh.groupware.domain.approval;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScheduledJobRunRepository extends JpaRepository<ScheduledJobRun, String> {
    List<ScheduledJobRun> findAllByOrderByJobNameAsc();
}
