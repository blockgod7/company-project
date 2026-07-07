package com.kjh.groupware.domain.search;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.notice.Notice;
import com.kjh.groupware.domain.notice.NoticeRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class NoticeGlobalSearchProvider implements GlobalSearchProvider {

    private final NoticeRepository noticeRepository;

    @Override
    public int order() {
        return 30;
    }

    @Override
    public GlobalSearchGroupResponse search(String keyword, int limit, Emp currentEmp) {
        Page<Notice> page = noticeRepository.searchGlobal(keyword, PageRequest.of(0, limit));
        List<GlobalSearchItemResponse> items = page.getContent().stream()
            .map(notice -> new GlobalSearchItemResponse(
                "NOTICE",
                notice.getNoticeId(),
                null,
                "notices",
                notice.getTitle(),
                GlobalSearchText.snippet(notice.getContent()),
                GlobalSearchText.join(notice.getWriter().getEmpName(), notice.getPinnedYn().equals("Y") ? "상단 고정" : null),
                notice.getPinnedYn().equals("Y") ? List.of("상단 고정") : List.of("공지사항"),
                notice.getCreatedAt()
            ))
            .toList();
        return new GlobalSearchGroupResponse("notices", "공지사항", page.getTotalElements(), items);
    }
}
