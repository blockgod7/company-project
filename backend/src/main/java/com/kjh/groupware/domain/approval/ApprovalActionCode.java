package com.kjh.groupware.domain.approval;

import com.kjh.groupware.global.exception.BusinessException;

public enum ApprovalActionCode {
    APPROVE("approve"),
    REJECT("reject"),
    WITHDRAW("withdraw"),
    CANCEL("cancel"),
    REDRAFT("redraft"),
    RECEIVE("receive"),
    COMPLETE_RECEIPT("complete-receipt"),
    STATUS_CORRECTION("status-correction"),
    REGENERATE_PDF("regenerate-pdf");

    private final String code;

    ApprovalActionCode(String code) {
        this.code = code;
    }

    public String code() {
        return code;
    }

    public static ApprovalActionCode from(String value) {
        for (ApprovalActionCode action : values()) {
            if (action.code.equals(value)) {
                return action;
            }
        }
        throw BusinessException.badRequest("APPROVAL_ACTION_INVALID", "지원하지 않는 전자결재 처리 액션입니다.");
    }
}
