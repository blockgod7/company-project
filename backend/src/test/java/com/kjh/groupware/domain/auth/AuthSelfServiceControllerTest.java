package com.kjh.groupware.domain.auth;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.kjh.groupware.domain.auth.dto.MyProfileResponse;
import com.kjh.groupware.domain.auth.dto.MyProfileUpdateRequest;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.JwtAuthenticationFilter;
import com.kjh.groupware.global.security.JwtTokenProvider;
import com.kjh.groupware.global.security.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class AuthSelfServiceControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean AuthService service;
    @MockitoBean JwtTokenProvider jwt;

    @Test
    void endpointsRequireAuthentication() throws Exception {
        mvc.perform(get("/api/v1/auth/profile")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/auth/profile").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/change-password").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test
    void regularEmployeeCanReadOwnProfileWithoutSensitiveAccountFields() throws Exception {
        when(service.myProfile()).thenReturn(new MyProfileResponse("qa", "QA-1", "테스트", null, null, null, "qa@example.test", null, null));
        mvc.perform(get("/api/v1/auth/profile").with(user("qa").roles("USER")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.email").value("qa@example.test"))
            .andExpect(jsonPath("$.data.passwordHash").doesNotExist())
            .andExpect(jsonPath("$.data.roleCode").doesNotExist());
    }

    @Test
    void profileUpdateAcceptsContactsNotTargetEmployeeOrPrivilegeFields() throws Exception {
        mvc.perform(put("/api/v1/auth/profile").with(user("qa").roles("USER"))
                .contentType(MediaType.APPLICATION_JSON).content("""
                    {"email":" new@example.test ","phone":" 123 ","extensionNumber":" 42 ",
                     "empId":999,"roleCode":"ADMIN","empName":"unauthorized-change"}
                    """))
            .andExpect(status().isOk());
        verify(service).updateMyProfile(new MyProfileUpdateRequest("new@example.test", "123", "42"));
    }

    @Test
    void malformedContactsAreRejectedBeforeCallingService() throws Exception {
        for (String json : new String[] {"{\"email\":\"not-an-email\"}",
            "{\"phone\":\"" + "1".repeat(51) + "\"}", "{\"extensionNumber\":\"" + "1".repeat(21) + "\"}"}) {
            mvc.perform(put("/api/v1/auth/profile").with(user("qa")).contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }

    @Test
    void passwordRequiresCurrentPasswordAndClearsCookieOnSuccess() throws Exception {
        mvc.perform(post("/api/v1/auth/change-password").with(user("qa"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"newPassword\":\"Fixture-after-1\"}"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
        mvc.perform(post("/api/v1/auth/change-password").with(user("qa"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"currentPassword\":\"Fixture-before-1\",\"newPassword\":\"Fixture-after-1\"}"))
            .andExpect(status().isOk()).andExpect(header().string("Set-Cookie", containsString("Max-Age=0")));
        verify(service).changePassword("Fixture-before-1", "Fixture-after-1");
    }

    @Test
    void incorrectPasswordIsRecoverableValidationErrorNotExpiredSession() throws Exception {
        doThrow(BusinessException.badRequest("CURRENT_PASSWORD_MISMATCH", "현재 비밀번호가 일치하지 않습니다."))
            .when(service).changePassword("wrong", "Fixture-after-1");
        mvc.perform(post("/api/v1/auth/change-password").with(user("qa"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"currentPassword\":\"wrong\",\"newPassword\":\"Fixture-after-1\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CURRENT_PASSWORD_MISMATCH"))
            .andExpect(header().doesNotExist("Set-Cookie"));
    }
}
