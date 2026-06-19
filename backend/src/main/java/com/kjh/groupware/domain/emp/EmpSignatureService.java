package com.kjh.groupware.domain.emp;

import com.kjh.groupware.domain.file.AttachFile;
import com.kjh.groupware.domain.file.dto.AttachFileResponse;
import com.kjh.groupware.domain.file.FileService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class EmpSignatureService {

    private final EmpRepository empRepository;
    private final EmpSignatureRepository signatureRepository;
    private final FileService fileService;
    private final CurrentEmpProvider currentEmpProvider;

    @Transactional
    public EmpSignature upload(Long empId, MultipartFile file, HttpServletRequest request) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        if (!currentEmp.getEmpId().equals(empId) && !"ADMIN".equals(currentEmp.getRoleCode())) {
            throw BusinessException.forbidden("SIGNATURE_FORBIDDEN", "Only the employee or an admin can update a signature");
        }
        Emp target = empRepository.findById(empId)
            .orElseThrow(() -> BusinessException.notFound("EMP_NOT_FOUND", "Employee was not found"));
        signatureRepository.findTopByEmpAndActiveYnOrderBySignatureIdDesc(target, "Y")
            .ifPresent(EmpSignature::deactivate);
        AttachFileResponse uploaded = fileService.upload("EMP_SIGNATURE", empId, file, request.getRemoteAddr(), request.getHeader("User-Agent"));
        AttachFile signatureFile = fileService.getDownloadableFile(uploaded.fileId());
        return signatureRepository.save(EmpSignature.builder()
            .emp(target)
            .signatureFile(signatureFile)
            .displayName(target.getEmpName())
            .activeYn("Y")
            .build());
    }

    @Transactional(readOnly = true)
    public String snapshotJson(Emp emp) {
        return signatureRepository.findTopByEmpAndActiveYnOrderBySignatureIdDesc(emp, "Y")
            .map(signature -> "{\"type\":\"IMAGE\",\"displayName\":\"" + escape(signature.getDisplayName()) + "\",\"fileId\":" +
                (signature.getSignatureFile() == null ? "null" : signature.getSignatureFile().getFileId()) + "}")
            .orElseGet(() -> "{\"type\":\"DEFAULT_STAMP\",\"displayName\":\"" + escape(emp.getEmpName()) +
                "\",\"position\":\"" + escape(emp.getPositionName()) + "\"}");
    }

    @Transactional(readOnly = true)
    public AttachFile activeSignatureFile(Emp emp) {
        return signatureRepository.findTopByEmpAndActiveYnOrderBySignatureIdDesc(emp, "Y")
            .map(EmpSignature::getSignatureFile)
            .orElse(null);
    }

    private String escape(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
