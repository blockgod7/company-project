package com.kjh.groupware.domain.search;

import com.kjh.groupware.domain.approval.ApprovalDelegationService;
import com.kjh.groupware.domain.approval.ApprovalDocument;
import com.kjh.groupware.domain.approval.ApprovalDocumentRepository;
import com.kjh.groupware.domain.approval.ApprovalLine;
import com.kjh.groupware.domain.approval.ApprovalLineRepository;
import com.kjh.groupware.domain.approval.ApprovalPermissionService;
import com.kjh.groupware.domain.emp.Emp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ApprovalGlobalSearchProvider implements GlobalSearchProvider {

    private final ApprovalDocumentRepository documentRepository;
    private final ApprovalLineRepository lineRepository;
    private final ApprovalPermissionService permissionService;
    private final ApprovalDelegationService delegationService;

    @Override
    public int order() {
        return 10;
    }

    @Override
    public GlobalSearchGroupResponse search(String keyword, int limit, Emp currentEmp) {
        List<Emp> decisionAssignees = delegationService.decisionAssigneesFor(currentEmp);
        if (decisionAssignees == null || decisionAssignees.isEmpty()) {
            decisionAssignees = List.of(currentEmp);
        }
        Page<ApprovalDocument> page = documentRepository.searchVisible(
            true,
            keyword,
            false,
            "",
            false,
            "",
            false,
            currentEmp,
            currentEmp,
            decisionAssignees,
            permissionService.canViewAllDocuments(currentEmp),
            true,
            true,
            true,
            true,
            true,
            true,
            permissionService.canViewAllDocuments(currentEmp),
            true,
            false,
            LocalDateTime.now(),
            false,
            LocalDateTime.now(),
            PageRequest.of(0, Math.max(limit * 3, limit), Sort.by(Sort.Order.desc("approvalId")))
        );

        List<GlobalSearchItemResponse> items = new ArrayList<>();
        for (ApprovalDocument document : page.getContent()) {
            List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
            if (!permissionService.permissions(currentEmp, document, lines).canView()) {
                continue;
            }
            items.add(new GlobalSearchItemResponse(
                "APPROVAL",
                document.getApprovalId(),
                null,
                "approvals",
                document.getTitle(),
                GlobalSearchText.snippet(document.getSearchText()),
                GlobalSearchText.join(document.getDocumentNo(), document.getRequester().getEmpName(), document.getStatus()),
                approvalBadges(document, currentEmp, lines),
                document.getRequestedAt()
            ));
            if (items.size() >= limit) {
                break;
            }
        }
        return new GlobalSearchGroupResponse("approvals", "전자결재", items.size(), items);
    }

    private List<String> approvalBadges(ApprovalDocument document, Emp currentEmp, List<ApprovalLine> lines) {
        List<String> badges = new ArrayList<>();
        if (document.getRequester().getEmpId().equals(currentEmp.getEmpId())) {
            badges.add("작성자");
        }
        if (lines.stream().anyMatch(line -> line.getAssignedEmp() != null && line.getAssignedEmp().getEmpId().equals(currentEmp.getEmpId()))) {
            badges.add("결재라인 포함");
        }
        badges.add(document.getStatus());
        return badges;
    }
}
