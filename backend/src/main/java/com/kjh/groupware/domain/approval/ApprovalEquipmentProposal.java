package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "approval_equipment_proposal")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalEquipmentProposal extends BaseEntity {

    public static final String TEMPLATE_CODE = "EQUIPMENT_PROPOSAL";
    public static final String MOLD_FIXTURE_TEMPLATE_CODE = "MOLD_FIXTURE_PROPOSAL";
    public static final String STAGE_USER_APPROVAL = "USER_APPROVAL";
    public static final String STAGE_PE_INPUT = "PE_INPUT";
    public static final String STAGE_PE_APPROVAL = "PE_APPROVAL";
    public static final String STAGE_PURCHASE_INPUT = "PURCHASE_INPUT";
    public static final String STAGE_PURCHASE_APPROVAL = "PURCHASE_APPROVAL";
    public static final String STAGE_COMPLETED = "COMPLETED";

    public static final String TARGET_USER = "APPROVAL_EQUIPMENT_USER";
    public static final String TARGET_PE = "APPROVAL_EQUIPMENT_PE";
    public static final String TARGET_PURCHASE = "APPROVAL_EQUIPMENT_PURCHASE";

    public static boolean isProposalTemplate(String templateCode) {
        return TEMPLATE_CODE.equals(templateCode) || MOLD_FIXTURE_TEMPLATE_CODE.equals(templateCode);
    }

    @Id
    @Column(name = "approval_id")
    private Long approvalId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId
    @JoinColumn(name = "approval_id", nullable = false)
    private ApprovalDocument approval;

    @Column(name = "workflow_stage", nullable = false, length = 40)
    private String workflowStage = STAGE_USER_APPROVAL;

    @Column(name = "request_dept_name", length = 100)
    private String requestDeptName;

    @Column(name = "equipment_name", length = 200)
    private String equipmentName;

    @Column(name = "required_completion_date", length = 30)
    private String requiredCompletionDate;

    @Column(name = "equipment_capacity", length = 200)
    private String equipmentCapacity;

    @Column(name = "request_type", length = 50)
    private String requestType;

    @Column(name = "mold_fixture_type", length = 20)
    private String moldFixtureType;

    @Column(name = "customer_name", length = 200)
    private String customerName;

    @Column(name = "product_name", length = 200)
    private String productName;

    @Column(name = "usage_text", length = 300)
    private String usageText;

    @Column(name = "part_name", length = 200)
    private String partName;

    @Column(name = "cavity", length = 100)
    private String cavity;

    @Column(name = "material", length = 100)
    private String material;

    @Column(name = "mold_no", length = 100)
    private String moldNo;

    @Column(name = "current_state", columnDefinition = "text")
    private String currentState;

    @Column(name = "requirements", columnDefinition = "text")
    private String requirements;

    @Column(name = "instructions", columnDefinition = "text")
    private String instructions;

    @Column(name = "user_economic_review", columnDefinition = "text")
    private String userEconomicReview;

    @Column(name = "pe_opinion", columnDefinition = "text")
    private String peOpinion;

    @Column(name = "design_opinion", columnDefinition = "text")
    private String designOpinion;

    @Column(name = "pe_economic_review", columnDefinition = "text")
    private String peEconomicReview;

    @Column(name = "purchase_opinion", columnDefinition = "text")
    private String purchaseOpinion;

    @Column(name = "vendor_name", length = 200)
    private String vendorName;

    @Column(name = "delivery_due_date", length = 30)
    private String deliveryDueDate;

    @Column(name = "purchase_item_name", length = 200)
    private String purchaseItemName;

    @Column(name = "purchase_usage", length = 300)
    private String purchaseUsage;

    @Column(name = "quantity", length = 100)
    private String quantity;

    @Column(name = "price", length = 100)
    private String price;

    @Column(name = "purchase_note", columnDefinition = "text")
    private String purchaseNote;

    @Column(name = "attachment_contract_yn", nullable = false, length = 1)
    private String attachmentContractYn = "N";

    @Column(name = "attachment_quote_yn", nullable = false, length = 1)
    private String attachmentQuoteYn = "N";

    @Column(name = "attachment_drawing_yn", nullable = false, length = 1)
    private String attachmentDrawingYn = "N";

    @Column(name = "attachment_spec_yn", nullable = false, length = 1)
    private String attachmentSpecYn = "N";

    @Column(name = "attachment_etc", length = 200)
    private String attachmentEtc;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pe_assignee_emp_id")
    private Emp peAssignee;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_assignee_emp_id")
    private Emp purchaseAssignee;

    public ApprovalEquipmentProposal(ApprovalDocument approval) {
        this.approval = approval;
        this.workflowStage = STAGE_USER_APPROVAL;
    }

    public void updateUserSection(
        String requestDeptName,
        String equipmentName,
        String requiredCompletionDate,
        String equipmentCapacity,
        String requestType,
        String currentState,
        String requirements,
        String instructions,
        String userEconomicReview
    ) {
        this.requestDeptName = requestDeptName;
        this.equipmentName = equipmentName;
        this.requiredCompletionDate = requiredCompletionDate;
        this.equipmentCapacity = equipmentCapacity;
        this.requestType = requestType;
        this.currentState = currentState;
        this.requirements = requirements;
        this.instructions = instructions;
        this.userEconomicReview = userEconomicReview;
    }

    public void updateMoldFixtureSection(
        String moldFixtureType,
        String customerName,
        String productName,
        String usageText,
        String partName,
        String cavity,
        String material,
        String quantity,
        String moldNo
    ) {
        this.moldFixtureType = moldFixtureType;
        this.customerName = customerName;
        this.productName = productName;
        this.usageText = usageText;
        this.partName = partName;
        this.cavity = cavity;
        this.material = material;
        this.quantity = quantity;
        this.moldNo = moldNo;
    }

    public void updatePeSection(String peOpinion, String designOpinion, String peEconomicReview) {
        this.peOpinion = peOpinion;
        this.designOpinion = designOpinion;
        this.peEconomicReview = peEconomicReview;
    }

    public void updatePurchaseSection(
        String purchaseOpinion,
        String vendorName,
        String deliveryDueDate,
        String purchaseItemName,
        String purchaseUsage,
        String quantity,
        String price,
        String purchaseNote,
        boolean attachmentContract,
        boolean attachmentQuote,
        boolean attachmentDrawing,
        boolean attachmentSpec,
        String attachmentEtc
    ) {
        this.purchaseOpinion = purchaseOpinion;
        this.vendorName = vendorName;
        this.deliveryDueDate = deliveryDueDate;
        this.purchaseItemName = purchaseItemName;
        this.purchaseUsage = purchaseUsage;
        this.quantity = quantity;
        this.price = price;
        this.purchaseNote = purchaseNote;
        this.attachmentContractYn = yn(attachmentContract);
        this.attachmentQuoteYn = yn(attachmentQuote);
        this.attachmentDrawingYn = yn(attachmentDrawing);
        this.attachmentSpecYn = yn(attachmentSpec);
        this.attachmentEtc = attachmentEtc;
    }

    public void moveToPeInput(Emp assignee) {
        this.workflowStage = STAGE_PE_INPUT;
        this.peAssignee = assignee;
    }

    public void moveToPeApproval() {
        this.workflowStage = STAGE_PE_APPROVAL;
    }

    public void moveToPurchaseInput(Emp assignee) {
        this.workflowStage = STAGE_PURCHASE_INPUT;
        this.purchaseAssignee = assignee;
    }

    public void moveToPurchaseApproval() {
        this.workflowStage = STAGE_PURCHASE_APPROVAL;
    }

    public void complete() {
        this.workflowStage = STAGE_COMPLETED;
    }

    public void assignPe(Emp assignee) {
        this.peAssignee = assignee;
    }

    public void assignPurchase(Emp assignee) {
        this.purchaseAssignee = assignee;
    }

    private String yn(boolean value) {
        return value ? "Y" : "N";
    }
}
