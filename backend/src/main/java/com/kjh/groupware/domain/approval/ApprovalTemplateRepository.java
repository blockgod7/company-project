package com.kjh.groupware.domain.approval;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApprovalTemplateRepository extends JpaRepository<ApprovalTemplate, Long> {

    Optional<ApprovalTemplate> findTopByTemplateCodeAndActiveYnOrderByVersionDesc(String templateCode, String activeYn);

    Optional<ApprovalTemplate> findTopByTemplateCodeOrderByVersionDesc(String templateCode);

    List<ApprovalTemplate> findByTemplateCodeAndActiveYn(String templateCode, String activeYn);

    @Query("""
        select t from ApprovalTemplate t
        where t.activeYn = 'Y'
          and t.version = (
            select max(t2.version) from ApprovalTemplate t2
            where t2.templateCode = t.templateCode
              and t2.activeYn = 'Y'
          )
        order by t.sortOrder asc, t.templateName asc
        """)
    List<ApprovalTemplate> findLatestActiveTemplates();

    @Query("""
        select t from ApprovalTemplate t
        where t.version = (
            select max(t2.version) from ApprovalTemplate t2
            where t2.templateCode = t.templateCode
        )
        order by t.sortOrder asc, t.templateName asc
        """)
    List<ApprovalTemplate> findLatestTemplates();

    boolean existsByTemplateCodeAndVersion(@Param("templateCode") String templateCode, @Param("version") Integer version);
}
