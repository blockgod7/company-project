package com.kjh.groupware.domain.search;

import com.kjh.groupware.domain.board.BoardPost;
import com.kjh.groupware.domain.board.BoardPostRepository;
import com.kjh.groupware.domain.emp.Emp;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class BoardGlobalSearchProvider implements GlobalSearchProvider {

    private final BoardPostRepository boardPostRepository;

    @Override
    public int order() {
        return 20;
    }

    @Override
    public GlobalSearchGroupResponse search(String keyword, int limit, Emp currentEmp) {
        boolean admin = "ADMIN".equals(currentEmp.getRoleCode());
        Page<BoardPost> page = boardPostRepository.searchGlobal(keyword, currentEmp, admin, PageRequest.of(0, limit));
        List<GlobalSearchItemResponse> items = page.getContent().stream()
            .map(post -> new GlobalSearchItemResponse(
                "BOARD_POST",
                post.getPostId(),
                post.getBoard().getBoardId(),
                "boards",
                post.getTitle(),
                GlobalSearchText.snippet(post.getContent()),
                GlobalSearchText.join(post.getBoard().getBoardName(), post.getWriter().getEmpName()),
                "Y".equals(post.getDraftYn()) ? List.of("임시글", "작성자") : List.of("게시판"),
                post.getCreatedAt()
            ))
            .toList();
        return new GlobalSearchGroupResponse("boards", "게시판", page.getTotalElements(), items);
    }
}
