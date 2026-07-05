package com.kjh.groupware.domain.pdm;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kjh.groupware.domain.file.FileService;
import com.kjh.groupware.domain.pdm.dto.PdmFolderPathRenameRequest;
import com.kjh.groupware.domain.pdm.dto.PdmFolderPathRequest;
import com.kjh.groupware.global.security.JwtTokenProvider;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(PdmController.class)
@AutoConfigureMockMvc(addFilters = false)
class PdmControllerFolderActionTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PdmService pdmService;

    @MockitoBean
    private FileService fileService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void renameFolderPathUsesActionEndpointInsteadOfFolderIdRoute() throws Exception {
        when(pdmService.renameFolderPath(any(PdmFolderPathRenameRequest.class))).thenReturn(List.of());

        mockMvc.perform(post("/api/v1/pdm/folders/actions/rename")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "category": "PRODUCT",
                      "folderKind": "COMPANY",
                      "folderName": "Before",
                      "newFolderName": "After"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));

        verify(pdmService).renameFolderPath(any(PdmFolderPathRenameRequest.class));
    }

    @Test
    void deleteFolderPathUsesPostActionEndpoint() throws Exception {
        when(pdmService.deleteFolderPath(any(PdmFolderPathRequest.class))).thenReturn(List.of());

        mockMvc.perform(post("/api/v1/pdm/folders/actions/delete")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "category": "PRODUCT",
                      "folderKind": "COMPANY",
                      "folderName": "Empty Folder"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));

        verify(pdmService).deleteFolderPath(any(PdmFolderPathRequest.class));
    }

    @Test
    void voidDrawingUsesActionEndpoint() throws Exception {
        mockMvc.perform(post("/api/v1/pdm/drawings/10/actions/void"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));

        verify(pdmService).voidDrawing(any(Long.class), any(), any());
    }

    @Test
    void updateDrawingStatusUsesActionEndpoint() throws Exception {
        mockMvc.perform(post("/api/v1/pdm/drawings/10/actions/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "status": "ON_HOLD"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));

        verify(pdmService).updateDrawingStatus(any(Long.class), any(), any(), any());
    }

    @Test
    void deleteRevisionUsesActionEndpoint() throws Exception {
        mockMvc.perform(post("/api/v1/pdm/revisions/20/actions/delete"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));

        verify(pdmService).deleteRevision(any(Long.class), any(), any());
    }
}
