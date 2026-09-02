package com.kjh.groupware.domain.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.kjh.groupware.domain.auth.dto.MyProfileUpdateRequest;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import com.kjh.groupware.global.security.JwtTokenProvider;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

class AuthSelfServiceTest {
    private final EmpRepository employees = mock(EmpRepository.class);
    private final AuthRefreshTokenRepository tokens = mock(AuthRefreshTokenRepository.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final AuthService service = new AuthService(employees, encoder, mock(JwtTokenProvider.class),
        mock(AuditLogService.class), new CurrentEmpProvider(employees), tokens,
        new LoginRateLimiter(3, 300), mock(EmployeePermissionService.class));
    private Emp employee;

    @BeforeEach
    void fixture() {
        employee = Emp.pending("QA-7", "테스트 직원", "FEMALE", "before@example.test", "010-0000-0000", "101",
            null, "대리", "팀원", null, LocalDate.of(2020, 1, 1), "REGULAR", null, null);
        ReflectionTestUtils.setField(employee, "empId", 7L);
        employee.issueAccount("profile-test", encoder.encode("Fixture-before-1"), LocalDateTime.now().plusDays(1));
        when(employees.findActiveByLoginId("profile-test")).thenReturn(Optional.of(employee));
        when(employees.findByLoginIdForUpdate("profile-test")).thenReturn(Optional.of(employee));
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken("profile-test", null, List.of()));
    }

    @AfterEach
    void clearAuthentication() { SecurityContextHolder.clearContext(); }

    @Test
    void profileReadsAuthenticatedEmployeeOnly() {
        var profile = service.myProfile();
        assertEquals("QA-7", profile.empNo());
        assertEquals("profile-test", profile.loginId());
        assertEquals("before@example.test", profile.email());
        verify(employees).findActiveByLoginId("profile-test");
        verifyNoInteractions(tokens);
    }

    @Test
    void updateChangesOnlyContactsAndNormalizesWhitespace() {
        String originalHash = employee.getPasswordHash();
        var result = service.updateMyProfile(new MyProfileUpdateRequest(" new@example.test ", " 010-1111-2222 ", " 202 "));
        assertEquals("new@example.test", result.email());
        assertEquals("010-1111-2222", employee.getPhone());
        assertEquals("202", employee.getExtensionNumber());
        assertEquals("테스트 직원", employee.getEmpName());
        assertEquals("대리", employee.getPositionName());
        assertEquals("USER", employee.getRoleCode());
        assertEquals("QA-7", employee.getEmpNo());
        assertEquals(originalHash, employee.getPasswordHash());
        var order = inOrder(employees);
        order.verify(employees).acquireLoginLock("profile-test");
        order.verify(employees).findByLoginIdForUpdate("profile-test");
    }

    @Test
    void contactFieldsCanBeCleared() {
        service.updateMyProfile(new MyProfileUpdateRequest(" ", null, ""));
        assertNull(employee.getEmail()); assertNull(employee.getPhone()); assertNull(employee.getExtensionNumber());
    }

    @Test
    void anonymousCannotReadOrUpdateProfile() {
        SecurityContextHolder.clearContext();
        assertEquals(HttpStatus.UNAUTHORIZED, assertThrows(BusinessException.class, service::myProfile).getStatus());
        assertThrows(BusinessException.class, () -> service.updateMyProfile(new MyProfileUpdateRequest(null, null, null)));
        verify(employees, never()).acquireLoginLock(anyString());
    }

    @Test
    void wrongCurrentPasswordNeverChangesCredentialsOrRefreshTokens() {
        String originalHash = employee.getPasswordHash();
        var error = assertThrows(BusinessException.class, () -> service.changePassword("Wrong-fixture", "Fixture-after-1"));
        assertEquals("CURRENT_PASSWORD_MISMATCH", error.getCode());
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
        assertEquals(originalHash, employee.getPasswordHash());
        verifyNoInteractions(tokens);
    }

    @Test
    void passwordChangeVerifiesAndHashesPasswordAndRevokesRefreshTokens() {
        service.changePassword("Fixture-before-1", "Fixture-after-1");
        assertTrue(encoder.matches("Fixture-after-1", employee.getPasswordHash()));
        assertFalse(encoder.matches("Fixture-before-1", employee.getPasswordHash()));
        assertEquals("N", employee.getMustChangePasswordYn());
        assertNull(employee.getTempPasswordExpiresAt());
        verify(tokens).deleteByEmp(employee);
    }

    @Test
    void temporaryPasswordAlsoRequiresProofBeforeChanging() {
        assertEquals("Y", employee.getMustChangePasswordYn());
        assertThrows(BusinessException.class, () -> service.changePassword(null, "Fixture-after-1"));
        assertEquals("Y", employee.getMustChangePasswordYn());
        verifyNoInteractions(tokens);
    }

    @Test
    void sameShortAndOversizedUnicodePasswordsAreRejected() {
        assertEquals("PASSWORD_UNCHANGED", assertThrows(BusinessException.class,
            () -> service.changePassword("Fixture-before-1", "Fixture-before-1")).getCode());
        for (String invalid : List.of("short", "        ", "가".repeat(25))) {
            assertEquals("INVALID_NEW_PASSWORD", assertThrows(BusinessException.class,
                () -> service.changePassword("Fixture-before-1", invalid)).getCode());
        }
        verifyNoInteractions(tokens);
    }

    @Test
    void repeatedWrongPasswordsAreRateLimitedWithoutChangingLoginLockState() {
        for (int i = 0; i < 3; i++) {
            assertThrows(BusinessException.class, () -> service.changePassword("wrong", "Fixture-after-1"));
        }
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, assertThrows(BusinessException.class,
            () -> service.changePassword("Fixture-before-1", "Fixture-after-1")).getStatus());
        assertFalse(employee.isAccountLocked());
        verifyNoInteractions(tokens);
    }
}
