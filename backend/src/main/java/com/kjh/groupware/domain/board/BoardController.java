package com.kjh.groupware.domain.board;

import com.kjh.groupware.domain.board.dto.BoardCommentRequest;
import com.kjh.groupware.domain.board.dto.BoardCommentResponse;
import com.kjh.groupware.domain.board.dto.BoardPostRequest;
import com.kjh.groupware.domain.board.dto.BoardPostResponse;
import com.kjh.groupware.domain.board.dto.BoardRequest;
import com.kjh.groupware.domain.board.dto.BoardResponse;
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
@RequestMapping("${app.api-prefix:/api/v1}/boards")
@RequiredArgsConstructor
public class BoardController {

    private final BoardService boardService;

    @GetMapping
    public ApiResponse<List<BoardResponse>> findBoards() {
        return ApiResponse.ok(boardService.findBoards());
    }

    @PostMapping
    public ApiResponse<BoardResponse> createBoard(
        @Valid @RequestBody BoardRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(boardService.createBoard(request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @GetMapping("/{boardId}/posts")
    public ApiResponse<PageResponse<BoardPostResponse>> findPosts(
        @PathVariable Long boardId,
        @RequestParam(required = false, defaultValue = "0") int page,
        @RequestParam(required = false, defaultValue = "20") int size
    ) {
        return ApiResponse.ok(boardService.findPosts(boardId, page, size));
    }

    @PostMapping("/{boardId}/posts")
    public ApiResponse<BoardPostResponse> createPost(
        @PathVariable Long boardId,
        @Valid @RequestBody BoardPostRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(boardService.createPost(boardId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @GetMapping("/posts/{postId}")
    public ApiResponse<BoardPostResponse> findPost(@PathVariable Long postId) {
        return ApiResponse.ok(boardService.findPost(postId));
    }

    @PutMapping("/posts/{postId}")
    public ApiResponse<BoardPostResponse> updatePost(
        @PathVariable Long postId,
        @Valid @RequestBody BoardPostRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(boardService.updatePost(postId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @DeleteMapping("/posts/{postId}")
    public ApiResponse<Void> deletePost(@PathVariable Long postId, HttpServletRequest httpRequest) {
        boardService.deletePost(postId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        return ApiResponse.ok(null, "Deleted");
    }

    @PostMapping("/posts/{postId}/comments")
    public ApiResponse<BoardCommentResponse> createComment(
        @PathVariable Long postId,
        @Valid @RequestBody BoardCommentRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(boardService.createComment(postId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @DeleteMapping("/posts/comments/{commentId}")
    public ApiResponse<Void> deleteComment(@PathVariable Long commentId, HttpServletRequest httpRequest) {
        boardService.deleteComment(commentId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        return ApiResponse.ok(null, "Deleted");
    }

    @PostMapping("/posts/{postId}/read")
    public ApiResponse<Void> markPostRead(@PathVariable Long postId) {
        boardService.markPostRead(postId);
        return ApiResponse.ok(null, "Read");
    }
}
