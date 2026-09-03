import { useCallback, useState } from "react";
import { api, jsonBody } from "../api";
import type { ApprovalDefaultLineApi } from "../types";
import { defaultLineIds, defaultLinePayload, type ApprovalLineSelection } from "../utils/approvalPeople";

type Options = {
  selection: ApprovalLineSelection;
  onApply: (selection: ApprovalLineSelection) => void;
  setApprovalError: (message: string) => void;
  setDefaultLineMessage: (message: string) => void;
};

export function useApprovalLineLibrary({ selection, onApply, setApprovalError, setDefaultLineMessage }: Options) {
  const [savedApprovalLines, setSavedApprovalLines] = useState<ApprovalDefaultLineApi[]>([]);
  const [selectedSavedLineId, setSelectedSavedLineId] = useState("");

  const loadSavedApprovalLines = useCallback(async () => {
    try {
      const lines = await api<ApprovalDefaultLineApi[]>("/approval-default-lines/me");
      setSavedApprovalLines(lines);
      setSelectedSavedLineId((current) => current && lines.some((line) => String(line.defaultLineId) === current) ? current : (lines[0]?.defaultLineId ? String(lines[0].defaultLineId) : ""));
    } catch {
      setSavedApprovalLines([]);
      setSelectedSavedLineId("");
    }
  }, []);

  async function saveNamedApprovalLine() {
    setApprovalError("");
    if (!selection.approverEmpIds.length) {
      setApprovalError("저장할 결재선에는 결재자를 1명 이상 포함해야 합니다.");
      return;
    }
    const lineName = window.prompt("저장할 결재선 이름", "팀장 최종 결재") ?? "";
    if (!lineName.trim()) return;
    try {
      const saved = await api<ApprovalDefaultLineApi>("/approval-default-lines/me", {
        method: "PUT",
        body: jsonBody(defaultLinePayload(selection, lineName.trim(), false))
      });
      await loadSavedApprovalLines();
      if (saved.defaultLineId) setSelectedSavedLineId(String(saved.defaultLineId));
      setDefaultLineMessage(`${lineName.trim()} 결재선을 저장했습니다.`);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "결재선 저장 중 오류가 발생했습니다.");
    }
  }

  function applySavedApprovalLine() {
    setApprovalError("");
    const savedLine = savedApprovalLines.find((line) => String(line.defaultLineId) === selectedSavedLineId);
    if (!savedLine) {
      setApprovalError("불러올 결재선을 선택해 주세요.");
      return;
    }
    onApply({
      agreementEmpIds: defaultLineIds(savedLine.steps, "AGREEMENT"),
      approverEmpIds: defaultLineIds(savedLine.steps, "APPROVAL"),
      // A reusable personal line must never change the current document receiver.
      receiverEmpIds: selection.receiverEmpIds,
      referenceEmpIds: defaultLineIds(savedLine.steps, "REFERENCE"),
      readerEmpIds: defaultLineIds(savedLine.steps, "READER")
    });
    setDefaultLineMessage(`${savedLine.lineName ?? "저장된 결재선"}을 적용했습니다. 수신자는 현재 문서의 설정을 유지했습니다.`);
  }

  async function renameSavedApprovalLine() {
    setApprovalError("");
    const savedLine = savedApprovalLines.find((line) => String(line.defaultLineId) === selectedSavedLineId);
    if (!savedLine?.defaultLineId) {
      setApprovalError("이름을 변경할 결재선을 선택해 주세요.");
      return;
    }
    const lineName = window.prompt("결재선 이름 변경", savedLine.lineName ?? "") ?? "";
    if (!lineName.trim()) return;
    try {
      await api<ApprovalDefaultLineApi>(`/approval-default-lines/me/${savedLine.defaultLineId}`, {
        method: "PATCH",
        body: jsonBody({ lineName: lineName.trim() })
      });
      await loadSavedApprovalLines();
      setSelectedSavedLineId(String(savedLine.defaultLineId));
      setDefaultLineMessage(`${lineName.trim()}으로 이름을 변경했습니다.`);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "결재선 이름 변경 중 오류가 발생했습니다.");
    }
  }

  async function deleteSavedApprovalLine() {
    setApprovalError("");
    const savedLine = savedApprovalLines.find((line) => String(line.defaultLineId) === selectedSavedLineId);
    if (!savedLine?.defaultLineId) {
      setApprovalError("삭제할 결재선을 선택해 주세요.");
      return;
    }
    if (!window.confirm(`${savedLine.lineName ?? "선택한 결재선"}을 삭제할까요?`)) return;
    try {
      await api<void>(`/approval-default-lines/me/${savedLine.defaultLineId}`, { method: "DELETE" });
      await loadSavedApprovalLines();
      setDefaultLineMessage(`${savedLine.lineName ?? "결재선"}을 삭제했습니다.`);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "결재선 삭제 중 오류가 발생했습니다.");
    }
  }

  return {
    savedApprovalLines, selectedSavedLineId, setSelectedSavedLineId, loadSavedApprovalLines,
    saveNamedApprovalLine, applySavedApprovalLine, renameSavedApprovalLine, deleteSavedApprovalLine
  };
}

export type ApprovalLineLibrary = ReturnType<typeof useApprovalLineLibrary>;
