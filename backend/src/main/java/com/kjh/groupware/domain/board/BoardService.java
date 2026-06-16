package com.kjh.groupware.domain.board;

import com.kjh.groupware.domain.board.dto.BoardCommentRequest;
import com.kjh.groupware.domain.board.dto.BoardCommentResponse;
import com.kjh.groupware.domain.board.dto.BoardPostRequest;
import com.kjh.groupware.domain.board.dto.BoardPostResponse;
import com.kjh.groupware.domain.board.dto.BoardRequest;
import com.kjh.groupware.domain.board.dto.BoardResponse;
import com.kjh.groupware.domain.dept.Dept;
import com.kjh.groupware.domain.dept.DeptRepository;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.response.PageResponse;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BoardService {

    private final BoardRepository boardRepository;
    private final BoardPostRepository boardPostRepository;
    private final BoardCommentRepository boardCommentRepository;
    private final BoardPostReadRepository boardPostReadRepository;
    private final DeptRepository deptRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public List<BoardResponse> findBoards() {
        return boardRepository.findByUseYnOrderByBoardIdAsc("Y").stream()
            .map(BoardResponse::from)
            .toList();
    }

    @Transactional
    public BoardResponse createBoard(BoardRequest request, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        requireAdmin(currentEmp);
        boardRepository.findByBoardCode(request.boardCode()).ifPresent(board -> {
            throw BusinessException.badRequest("BOARD_CODE_DUPLICATED", "Board code already exists");
        });
        Dept dept = request.deptId() == null ? null : deptRepository.findById(request.deptId())
            .orElseThrow(() -> BusinessException.notFound("DEPT_NOT_FOUND", "Department was not found"));
        Board board = Board.builder()
            .boardCode(request.boardCode())
            .boardName(request.boardName())
            .dept(dept)
            .build();
        Board saved = boardRepository.save(board);
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.CREATE, "board", saved.getBoardId(), ipAddress, userAgent);
        return BoardResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<BoardPostResponse> findPosts(Long boardId) {
        Board board = getActiveBoard(boardId);
        return boardPostRepository.findByBoardAndDeletedYnOrderByPostIdDesc(board, "N").stream()
            .filter(post -> !"Y".equals(post.getDraftYn()) || isCurrentWriterOrAdmin(post.getWriter()))
            .map(BoardPostResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<BoardPostResponse> findPosts(Long boardId, int page, int size) {
        Board board = getActiveBoard(boardId);
        PageRequest pageRequest = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
            Sort.by(Sort.Order.desc("postId")));
        return PageResponse.from(boardPostRepository.findByBoardAndDeletedYn(board, "N", pageRequest)
            .map(BoardPostResponse::from));
    }

    @Transactional
    public BoardPostResponse findPost(Long postId) {
        BoardPost post = getActivePost(postId);
        if ("Y".equals(post.getDraftYn()) && !isCurrentWriterOrAdmin(post.getWriter())) {
            throw BusinessException.forbidden("BOARD_POST_FORBIDDEN", "Draft post is visible only to the writer or admin");
        }
        post.increaseViewCount();
        markPostRead(post);
        List<BoardCommentResponse> comments = boardCommentRepository.findByPostAndDeletedYnOrderByCommentIdAsc(post, "N")
            .stream()
            .map(BoardCommentResponse::from)
            .toList();
        return BoardPostResponse.from(post, comments);
    }

    @Transactional
    public BoardPostResponse createPost(Long boardId, BoardPostRequest request, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        Board board = getActiveBoard(boardId);
        BoardPost post = BoardPost.builder()
            .board(board)
            .title(request.title())
            .content(request.content())
            .writer(currentEmp)
            .draft(request.draft())
            .build();
        BoardPost saved = boardPostRepository.save(post);
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.CREATE, "board_post", saved.getPostId(), ipAddress, userAgent);
        return BoardPostResponse.from(saved);
    }

    @Transactional
    public BoardPostResponse updatePost(Long postId, BoardPostRequest request, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        BoardPost post = getActivePost(postId);
        assertWritable(currentEmp, post.getWriter());
        post.update(request.title(), request.content(), request.draft());
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.UPDATE, "board_post", post.getPostId(), ipAddress, userAgent);
        return BoardPostResponse.from(post);
    }

    @Transactional
    public void deletePost(Long postId, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        BoardPost post = getActivePost(postId);
        assertWritable(currentEmp, post.getWriter());
        post.delete(currentEmp);
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.DELETE, "board_post", post.getPostId(), ipAddress, userAgent);
    }

    @Transactional
    public BoardCommentResponse createComment(Long postId, BoardCommentRequest request, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        BoardPost post = getActivePost(postId);
        BoardComment comment = BoardComment.builder()
            .post(post)
            .writer(currentEmp)
            .content(request.content())
            .build();
        BoardComment saved = boardCommentRepository.save(comment);
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.CREATE, "board_comment", saved.getCommentId(), ipAddress, userAgent);
        if (!post.getWriter().getEmpId().equals(currentEmp.getEmpId())) {
            notificationService.notifyEmp(
                post.getWriter().getEmpId(),
                "New board comment",
                currentEmp.getEmpName() + " commented on your post.",
                "BOARD_POST",
                post.getPostId()
            );
        }
        return BoardCommentResponse.from(saved);
    }

    @Transactional
    public void deleteComment(Long commentId, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        BoardComment comment = boardCommentRepository.findById(commentId)
            .orElseThrow(() -> BusinessException.notFound("BOARD_COMMENT_NOT_FOUND", "Board comment was not found"));
        if ("Y".equals(comment.getDeletedYn())) {
            throw BusinessException.notFound("BOARD_COMMENT_NOT_FOUND", "Board comment was not found");
        }
        assertWritable(currentEmp, comment.getWriter());
        comment.delete(currentEmp);
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.DELETE, "board_comment", comment.getCommentId(), ipAddress, userAgent);
    }

    @Transactional
    public void markPostRead(Long postId) {
        markPostRead(getActivePost(postId));
    }

    private void markPostRead(BoardPost post) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        BoardPostReadId id = new BoardPostReadId(post.getPostId(), currentEmp.getEmpId());
        if (!boardPostReadRepository.existsById(id)) {
            boardPostReadRepository.save(new BoardPostRead(post, currentEmp));
        }
    }

    private Board getActiveBoard(Long boardId) {
        Board board = boardRepository.findById(boardId)
            .orElseThrow(() -> BusinessException.notFound("BOARD_NOT_FOUND", "Board was not found"));
        if (!"Y".equals(board.getUseYn())) {
            throw BusinessException.notFound("BOARD_NOT_FOUND", "Board was not found");
        }
        return board;
    }

    private BoardPost getActivePost(Long postId) {
        BoardPost post = boardPostRepository.findById(postId)
            .orElseThrow(() -> BusinessException.notFound("BOARD_POST_NOT_FOUND", "Board post was not found"));
        if ("Y".equals(post.getDeletedYn())) {
            throw BusinessException.notFound("BOARD_POST_NOT_FOUND", "Board post was not found");
        }
        return post;
    }

    private boolean isCurrentWriterOrAdmin(Emp writer) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        return currentEmp.getEmpId().equals(writer.getEmpId()) || "ADMIN".equals(currentEmp.getRoleCode());
    }

    private void assertWritable(Emp currentEmp, Emp writer) {
        if (!currentEmp.getEmpId().equals(writer.getEmpId()) && !"ADMIN".equals(currentEmp.getRoleCode())) {
            throw BusinessException.forbidden("BOARD_POST_FORBIDDEN", "Only the writer or admin can change this post");
        }
    }

    private void requireAdmin(Emp currentEmp) {
        if (!"ADMIN".equals(currentEmp.getRoleCode())) {
            throw BusinessException.forbidden("ADMIN_REQUIRED", "Admin role is required");
        }
    }
}
