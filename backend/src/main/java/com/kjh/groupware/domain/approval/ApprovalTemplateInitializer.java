package com.kjh.groupware.domain.approval;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class ApprovalTemplateInitializer implements ApplicationRunner {

    private final ApprovalTemplateRepository templateRepository;
    private final JdbcTemplate jdbcTemplate;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        ensureApprovalSchema();
        for (DefaultTemplate template : defaultTemplates()) {
            if (!templateRepository.existsByTemplateCodeAndVersion(template.code(), 1)) {
                jdbcTemplate.update("""
                    insert into approval_template (
                        template_code,
                        template_name,
                        version,
                        description,
                        fields_json,
                        print_layout_json,
                        active_yn,
                        sort_order,
                        created_at
                    )
                    values (?, ?, 1, ?, ?, ?, 'Y', ?, now())
                    """,
                    template.code(),
                    template.name(),
                    template.description(),
                    template.fieldsJson(),
                    "{\"sections\":[\"meta\",\"fields\",\"approvalLines\",\"signatures\"]}",
                    template.sortOrder()
                );
            }
        }
    }

    private void ensureApprovalSchema() {
        jdbcTemplate.execute("alter table approval_document add column if not exists template_code varchar(50)");
        jdbcTemplate.execute("alter table approval_document add column if not exists document_no varchar(30)");
        jdbcTemplate.execute("""
            update approval_document
            set document_no = 'APP-' || extract(year from coalesce(requested_at, now()))::int || '-' || lpad(approval_id::text, 6, '0')
            where document_no is null
            """);
        jdbcTemplate.execute("alter table approval_document alter column document_no set not null");
        jdbcTemplate.execute("create unique index if not exists uq_approval_document_no_idx on approval_document(document_no)");
        jdbcTemplate.execute("alter table approval_document add column if not exists form_data_json text");
        jdbcTemplate.execute("alter table approval_document add column if not exists template_version int");
        jdbcTemplate.execute("alter table approval_document add column if not exists template_snapshot_json text");
        jdbcTemplate.execute("alter table approval_document add column if not exists search_text text");
        jdbcTemplate.execute("alter table approval_document add column if not exists correction_of_approval_id bigint");
        jdbcTemplate.execute("alter table approval_document add column if not exists pdf_status varchar(20) not null default 'NONE'");
        jdbcTemplate.execute("alter table approval_document add column if not exists pdf_file_id bigint");
        jdbcTemplate.execute("alter table approval_document add column if not exists pdf_generated_at timestamp");
        jdbcTemplate.execute("alter table approval_document add column if not exists pdf_error_message text");
        jdbcTemplate.execute("alter table approval_document add column if not exists pdf_hash varchar(128)");
        jdbcTemplate.execute("update approval_document set content = '' where content = '{content=}'");
        jdbcTemplate.execute("alter table approval_document drop constraint if exists chk_approval_document_status");
        jdbcTemplate.execute("alter table approval_document add constraint chk_approval_document_status check (status in ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELED'))");
        jdbcTemplate.execute("alter table approval_line add column if not exists signature_snapshot_file_id bigint");
        jdbcTemplate.execute("alter table approval_line add column if not exists signature_snapshot_json text");
        jdbcTemplate.execute("alter table approval_line add column if not exists signed_at timestamp");
    }

    private List<DefaultTemplate> defaultTemplates() {
        return List.of(
            new DefaultTemplate("DRAFT", "기안서", "일반 업무 기안", """
                [{"name":"content","label":"기안 내용","type":"textarea","wide":true}]
                """, 10),
            new DefaultTemplate("CONSULT", "품의서", "예산, 구매, 계약 등 의사결정 품의", """
                [{"name":"content","label":"품의 내용","type":"textarea","wide":true}]
                """, 20),
            new DefaultTemplate("LEAVE", "휴가계", "연차, 반차, 근태 신청", """
                [{"name":"content","label":"휴가 신청 내용","type":"textarea","wide":true}]
                """, 30),
            new DefaultTemplate("PURCHASE", "구매요구서", "품목, 수량, 납기 구매 요청", """
                [{"name":"content","label":"구매 요청 내용","type":"textarea","wide":true}]
                """, 40),
            new DefaultTemplate("TRAINING_REQUEST", "교육신청서", "교육 신청 및 비용 승인", """
                [{"name":"content","label":"교육 신청 내용","type":"textarea","wide":true}]
                """, 50),
            new DefaultTemplate("TRAINING_REPORT", "교육 훈련보고서", "교육 결과 및 후속 계획 보고", """
                [{"name":"content","label":"교육 훈련 보고 내용","type":"textarea","wide":true}]
                """, 60)
        );
    }

    private record DefaultTemplate(String code, String name, String description, String fieldsJson, int sortOrder) {
    }
}
