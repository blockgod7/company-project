package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ScheduledJobStatusResponse;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ScheduledJobStatusService {
    private final ScheduledJobRunRepository repository;
    private final EmployeePermissionService permissions;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void start(String jobName) { run(jobName).start(); }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void success(String jobName, String message) { run(jobName).succeed(message); }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void failure(String jobName, Throwable error) { run(jobName).fail(error == null ? "알 수 없는 오류" : error.getClass().getSimpleName() + ": " + error.getMessage()); }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void skipped(String jobName, String message) { run(jobName).skip(message); }

    @Transactional(readOnly = true)
    public List<ScheduledJobStatusResponse> list() {
        permissions.requireLeaveAdmin();
        return repository.findAllByOrderByJobNameAsc().stream().map(ScheduledJobStatusResponse::from).toList();
    }

    private ScheduledJobRun run(String jobName) {
        return repository.findById(jobName).orElseGet(() -> repository.save(new ScheduledJobRun(jobName)));
    }
}
