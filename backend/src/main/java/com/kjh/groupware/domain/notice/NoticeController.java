package com.kjh.groupware.domain.notice;

import com.kjh.groupware.domain.notice.dto.NoticeCommentRequest;
import com.kjh.groupware.domain.notice.dto.NoticeCommentResponse;
import com.kjh.groupware.domain.notice.dto.NoticeRequest;
import com.kjh.groupware.domain.notice.dto.NoticeResponse;
import com.kjh.groupware.global.response.ApiResponse;
import com.kjh.groupware.global.response.PageResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/notices")
@RequiredArgsConstructor
public class NoticeController {

    private final NoticeService noticeService;

    @GetMapping
    public ApiResponse<PageResponse<NoticeResponse>> findAll(
        @RequestParam(required = false, defaultValue = "0") int page,
        @RequestParam(required = false, defaultValue = "20") int size
    ) {
        return ApiResponse.ok(noticeService.findPage(page, size));
    }

    @GetMapping("/{noticeId}")
    public ApiResponse<NoticeResponse> findOne(@PathVariable Long noticeId) {
        return ApiResponse.ok(noticeService.findOne(noticeId));
    }

    @PostMapping
    public ApiResponse<NoticeResponse> create(
        @Valid @RequestBody NoticeRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(noticeService.create(request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PutMapping("/{noticeId}")
    public ApiResponse<NoticeResponse> update(
        @PathVariable Long noticeId,
        @Valid @RequestBody NoticeRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(noticeService.update(noticeId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @DeleteMapping("/{noticeId}")
    public ApiResponse<Void> delete(@PathVariable Long noticeId, HttpServletRequest httpRequest) {
        noticeService.delete(noticeId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        return ApiResponse.ok(null, "Deleted");
    }

    @PostMapping("/{noticeId}/comments")
    public ApiResponse<NoticeCommentResponse> createComment(
        @PathVariable Long noticeId,
        @Valid @RequestBody NoticeCommentRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(noticeService.createComment(noticeId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @DeleteMapping("/comments/{commentId}")
    public ApiResponse<Void> deleteComment(@PathVariable Long commentId, HttpServletRequest httpRequest) {
        noticeService.deleteComment(commentId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        return ApiResponse.ok(null, "Deleted");
    }

    @PostMapping("/{noticeId}/read")
    public ApiResponse<Void> markRead(@PathVariable Long noticeId) {
        noticeService.markRead(noticeId);
        return ApiResponse.ok(null, "Read");
    }
}
