package com.kjh.groupware.domain.approval;
import java.time.LocalDate; import java.util.*; import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param;
public interface BereavementPolicyRepository extends JpaRepository<BereavementPolicy,Long>{
 List<BereavementPolicy> findAllByOrderByEventTypeAscFamilyRelationAscEffectiveFromDesc();
 @Query("select p from BereavementPolicy p where p.eventType=:event and p.familyRelation=:relation and p.activeYn='Y' and p.effectiveFrom<=:date and (p.effectiveTo is null or p.effectiveTo>=:date) order by p.effectiveFrom desc,p.bereavementPolicyId desc")
 List<BereavementPolicy> findEffective(@Param("event") String event,@Param("relation") String relation,@Param("date") LocalDate date);
 @Query("""
   select p from BereavementPolicy p
   where p.activeYn='Y' and p.effectiveFrom<=:date and (p.effectiveTo is null or p.effectiveTo>=:date)
   order by p.eventType,p.familyRelation,p.effectiveFrom desc,p.bereavementPolicyId desc
   """)
 List<BereavementPolicy> findAllEffective(@Param("date") LocalDate date);
 @Query("""
   select p from BereavementPolicy p
   where p.eventType=:event and p.familyRelation=:relation and p.activeYn='Y'
     and (:excludeId is null or p.bereavementPolicyId<>:excludeId)
     and p.effectiveFrom<=:endDate and (p.effectiveTo is null or p.effectiveTo>=:startDate)
   """)
 List<BereavementPolicy> findOverlaps(@Param("event") String event,@Param("relation") String relation,@Param("excludeId") Long excludeId,@Param("startDate") LocalDate startDate,@Param("endDate") LocalDate endDate);
}
