package com.kjh.groupware.domain.search;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.pdm.PdmDrawing;
import com.kjh.groupware.domain.pdm.PdmDrawingRepository;
import com.kjh.groupware.domain.pdm.PdmService;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PdmGlobalSearchProvider implements GlobalSearchProvider {

    private final PdmDrawingRepository drawingRepository;
    private final PdmService pdmService;

    @Override
    public int order() {
        return 40;
    }

    @Override
    public GlobalSearchGroupResponse search(String keyword, int limit, Emp currentEmp) {
        Page<PdmDrawing> page = drawingRepository.search(null, keyword, PageRequest.of(0, Math.max(limit * 3, limit)));
        List<GlobalSearchItemResponse> items = new ArrayList<>();
        for (PdmDrawing drawing : page.getContent()) {
            if (!pdmService.canView(currentEmp, drawing)) {
                continue;
            }
            items.add(new GlobalSearchItemResponse(
                "PDM_DRAWING",
                drawing.getDrawingId(),
                null,
                "pdm",
                drawing.getDrawingNo() + " · " + drawing.getTitle(),
                GlobalSearchText.snippet(drawing.getDescription()),
                GlobalSearchText.join(drawing.getCompanyName(), drawing.getProjectName(), drawing.getBusinessUnit(), drawing.getProcessName(), drawing.getEquipmentName(), drawing.getGroupName()),
                List.of(drawing.getCategory(), drawing.getStatus()),
                drawing.getCreatedAt()
            ));
            if (items.size() >= limit) {
                break;
            }
        }
        return new GlobalSearchGroupResponse("pdm", "도면관리", items.size(), items);
    }
}
