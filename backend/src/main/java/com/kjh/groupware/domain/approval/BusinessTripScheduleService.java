package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BusinessTripScheduleService {
    private final ApprovalDocumentRepository documents;
    private final ApprovalLineRepository lineRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final ObjectMapper mapper;

    public record Schedule(Long approvalId, String title, String destination, LocalDate startDate, LocalDate endDate) {}

    @Transactional(readOnly = true)
    public List<Schedule> mySchedules(LocalDate from, LocalDate to) {
        if (from == null || to == null || from.isAfter(to)) {
            throw BusinessException.badRequest("TRIP_RANGE_INVALID", "출장 조회 기간을 확인해 주세요.");
        }
        return documents.findByRequesterAndTemplateCodeIn(currentEmpProvider.getCurrentEmp(), List.of("BUSINESS_TRIP"))
            .stream()
            .filter(document -> "N".equals(document.getDeletedYn()) && orderApproved(document))
            .map(this::schedule)
            .filter(Objects::nonNull)
            .filter(schedule -> !schedule.startDate().isAfter(to) && !schedule.endDate().isBefore(from))
            .sorted(Comparator.comparing(Schedule::startDate).thenComparing(Schedule::approvalId))
            .toList();
    }


    private boolean orderApproved(ApprovalDocument document) {
        if (ApprovalDocument.STATUS_APPROVED.equals(document.getStatus())) return true;
        if (!ApprovalDocument.STATUS_IN_PROGRESS.equals(document.getStatus())) return false;
        var lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        var receiver = lines.stream().filter(ApprovalLine::isReceiver)
            .min(Comparator.comparing(ApprovalLine::getLineOrder)).orElse(null);
        if (receiver == null) return false;
        var orderDecisions = lines.stream().filter(ApprovalLine::isDecisionLine)
            .filter(line -> line.getLineOrder() < receiver.getLineOrder()).toList();
        return !orderDecisions.isEmpty() && orderDecisions.stream().allMatch(line ->
            ApprovalLine.STATUS_APPROVED.equals(line.getStatus()) || ApprovalLine.STATUS_SKIPPED.equals(line.getStatus()));
    }

    private Schedule schedule(ApprovalDocument document) {
        if (document.getFormDataJson() == null || document.getFormDataJson().isBlank()) return null;
        try {
            var root = mapper.readTree(document.getFormDataJson());
            if (root == null) return null;
            var fields = root.path("fields");
            LocalDate start = LocalDate.parse(fields.path("startDate").asText(""));
            LocalDate end = LocalDate.parse(fields.path("endDate").asText(""));
            if (start.isAfter(end)) return null;
            return new Schedule(document.getApprovalId(), document.getTitle(), fields.path("destination").asText(""), start, end);
        } catch (JsonProcessingException | DateTimeParseException ignored) {
            // Legacy documents without a valid saved trip period cannot be placed on a calendar.
            return null;
        }
    }
}
