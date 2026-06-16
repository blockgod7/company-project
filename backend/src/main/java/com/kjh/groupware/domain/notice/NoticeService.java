package com.kjh.groupware.domain.notice;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.notice.dto.NoticeCommentRequest;
import com.kjh.groupware.domain.notice.dto.NoticeCommentResponse;
import com.kjh.groupware.domain.notice.dto.NoticeRequest;
import com.kjh.groupware.domain.notice.dto.NoticeResponse;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NoticeService {

    private final NoticeRepository noticeRepository;
    private final NoticeCommentRepository noticeCommentRepository;
    private final NoticeReadRepository noticeReadRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public List<NoticeResponse> findAll() {
        return noticeRepository.findByDeletedYnOrderByPinnedYnDescNoticeIdDesc("N").stream()
            .map(NoticeResponse::from)
            .toList();
    }

    @Transactional
    public NoticeResponse findOne(Long noticeId) {
        Notice notice = getActiveNotice(noticeId);
        notice.increaseViewCount();
        List<NoticeCommentResponse> comments = noticeCommentRepository
            .findByNoticeAndDeletedYnOrderByCommentIdAsc(notice, "N")
            .stream()
            .map(NoticeCommentResponse::from)
            .toList();
        return NoticeResponse.from(notice, comments);
    }

    @Transactional
    public NoticeResponse create(NoticeRequest request, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        Notice notice = Notice.builder()
            .title(request.title())
            .content(request.content())
            .writer(currentEmp)
            .pinned(request.pinned())
            .build();
        Notice saved = noticeRepository.save(notice);
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.CREATE, "notice", saved.getNoticeId(), ipAddress, userAgent);
        return NoticeResponse.from(saved);
    }

    @Transactional
    public NoticeResponse update(Long noticeId, NoticeRequest request, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        Notice notice = getActiveNotice(noticeId);
        assertWritable(currentEmp, notice.getWriter());
        notice.update(request.title(), request.content(), request.pinned());
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.UPDATE, "notice", notice.getNoticeId(), ipAddress, userAgent);
        return NoticeResponse.from(notice);
    }

    @Transactional
    public void delete(Long noticeId, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        Notice notice = getActiveNotice(noticeId);
        assertWritable(currentEmp, notice.getWriter());
        notice.delete(currentEmp);
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.DELETE, "notice", notice.getNoticeId(), ipAddress, userAgent);
    }

    @Transactional
    public NoticeCommentResponse createComment(Long noticeId, NoticeCommentRequest request, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        Notice notice = getActiveNotice(noticeId);
        NoticeComment comment = NoticeComment.builder()
            .notice(notice)
            .writer(currentEmp)
            .content(request.content())
            .build();
        NoticeComment saved = noticeCommentRepository.save(comment);
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.CREATE, "notice_comment", saved.getCommentId(), ipAddress, userAgent);
        if (!notice.getWriter().getEmpId().equals(currentEmp.getEmpId())) {
            notificationService.notifyEmp(
                notice.getWriter().getEmpId(),
                "New notice comment",
                currentEmp.getEmpName() + " commented on your notice.",
                "NOTICE",
                notice.getNoticeId()
            );
        }
        return NoticeCommentResponse.from(saved);
    }

    @Transactional
    public void markRead(Long noticeId) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        Notice notice = getActiveNotice(noticeId);
        NoticeReadId id = new NoticeReadId(noticeId, currentEmp.getEmpId());
        if (!noticeReadRepository.existsById(id)) {
            noticeReadRepository.save(new NoticeRead(notice, currentEmp));
        }
    }

    private Notice getActiveNotice(Long noticeId) {
        Notice notice = noticeRepository.findById(noticeId)
            .orElseThrow(() -> BusinessException.notFound("NOTICE_NOT_FOUND", "Notice was not found"));
        if ("Y".equals(notice.getDeletedYn())) {
            throw BusinessException.notFound("NOTICE_NOT_FOUND", "Notice was not found");
        }
        return notice;
    }

    private void assertWritable(Emp currentEmp, Emp writer) {
        if (!currentEmp.getEmpId().equals(writer.getEmpId()) && !"ADMIN".equals(currentEmp.getRoleCode())) {
            throw BusinessException.forbidden("NOTICE_FORBIDDEN", "Only the writer or admin can change this notice");
        }
    }
}
