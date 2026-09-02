import "./rich-text-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Editor } from "@tiptap/core";
import { RichTextEditor } from "../src/components/RichTextEditor";
import { richTextEditorHtml, sanitizeRichTextHtml } from "../src/utils/richText";

afterEach(cleanup);

function Harness({ initial = "<p>선택한 글자 나머지</p>" }: { initial?: string }) {
  const [content, setContent] = useState(initial);
  return <><RichTextEditor content={content} onChange={setContent} /><output data-testid="saved">{content}</output></>;
}

function editor() {
  return (screen.getByRole("textbox", { name: "기안 내용" }) as HTMLElement & { editor: Editor }).editor;
}
function selectText(from = 1, to = 7) {
  act(() => { editor().chain().focus().setTextSelection({ from, to }).run(); });
}
function saved() { return screen.getByTestId("saved").textContent ?? ""; }

test("selected Korean text keeps its range after font-size dropdown focus and parent state update", async () => {
  render(<Harness />);
  selectText();
  const before = editor().state.selection.toJSON();
  const user = userEvent.setup();
  await user.selectOptions(screen.getByRole("combobox", { name: "글자 크기" }), "24px");
  assert.deepEqual(editor().state.selection.toJSON(), before);
  assert.match(saved(), /font-size: 24px/);
  assert.equal(editor().getAttributes("textStyle").fontSize, "24px");
  assert.equal((screen.getByRole("combobox", { name: "글자 크기" }) as HTMLSelectElement).value, "24px");
  assert.equal(screen.getByRole("textbox").querySelector("span")?.textContent, "선택한 글자");
  await user.selectOptions(screen.getByRole("combobox", { name: "글자 크기" }), "14px");
  assert.match(saved(), /font-size: 14px/);
  assert.doesNotMatch(saved(), /24px/);
});

test("alignment applies to selected paragraphs and survives saved HTML reload", async () => {
  render(<Harness initial="<p>첫 문단</p><p>둘째 문단</p>" />);
  selectText(1, 12);
  await userEvent.setup().click(screen.getByRole("button", { name: "가운데 정렬" }));
  assert.equal(screen.getByRole("textbox").querySelectorAll('p[style*="text-align: center"]').length, 2);
  const stored = saved();
  cleanup();
  render(<RichTextEditor content={stored} onChange={() => {}} readOnly />);
  assert.equal(screen.getByRole("textbox").querySelectorAll('p[style*="text-align: center"]').length, 2);
  assert.equal(screen.queryByRole("toolbar"), null);
  assert.equal(screen.getByRole("textbox").getAttribute("contenteditable"), "false");
});

test("font, color, bold, highlight, line spacing, undo and redo are retained", async () => {
  render(<Harness />);
  selectText();
  const user = userEvent.setup();
  await user.selectOptions(screen.getByRole("combobox", { name: "글꼴" }), "Georgia");
  await user.selectOptions(screen.getByRole("combobox", { name: "줄 간격" }), "2");
  fireEvent.input(screen.getByLabelText("글자색"), { target: { value: "#ff0000" } });
  await user.click(screen.getByRole("button", { name: "굵게" }));
  await user.click(screen.getByRole("button", { name: "형광펜" }));
  assert.match(saved(), /Georgia/);
  assert.match(saved(), /line-height: 2/);
  assert.match(saved(), /rgb\(255, 0, 0\)/);
  assert.match(saved(), /<strong>/);
  assert.match(saved(), /<mark>/);
  await user.click(screen.getByRole("button", { name: "실행 취소" }));
  assert.doesNotMatch(saved(), /<mark>/);
  await user.click(screen.getByRole("button", { name: "다시 실행" }));
  assert.match(saved(), /<mark>/);
});

test("table rows/columns are editable and roundtrip with cell contents", async () => {
  render(<Harness />);
  selectText(1, 1);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "3×3 표 삽입" }));
  await waitFor(() => assert.equal(screen.getByRole("textbox").querySelectorAll("tr").length, 3));
  act(() => { editor().commands.insertContent("품명"); });
  await user.click(screen.getByRole("button", { name: "행 추가" }));
  assert.equal(screen.getByRole("textbox").querySelectorAll("tr").length, 4);
  await user.click(screen.getByRole("button", { name: "열 추가" }));
  assert.equal(screen.getByRole("textbox").querySelector("tr")?.children.length, 4);
  const stored = saved();
  cleanup();
  render(<RichTextEditor content={stored} onChange={() => {}} readOnly />);
  assert.equal(document.querySelectorAll("tr").length, 4);
  assert.match(document.body.textContent ?? "", /품명/);
});

test("plain text migration, Word-style pasted HTML, and sanitizer are safe and idempotent", () => {
  assert.equal(richTextEditorHtml("첫 줄\n둘째 & <내용>"), "<p>첫 줄</p><p>둘째 &amp; &lt;내용&gt;</p>");
  const html = '<p class="MsoNormal" style="text-align:right"><span style="font-size:11pt;color:#123456;font-family:Arial">워드 내용</span></p>'
    + '<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)" onclick="alert(1)">위험 링크</a>'
    + '<table><tr><td colspan="2" style="background-image:url(https://bad.invalid/a)">합친 셀</td></tr></table>';
  const clean = sanitizeRichTextHtml(html);
  assert.equal(sanitizeRichTextHtml(clean), clean);
  assert.match(clean, /font-size: 11pt/);
  assert.match(clean, /text-align: right/);
  assert.match(clean, /colspan="2"/);
  assert.doesNotMatch(clean, /script|onclick|onerror|javascript:|<img|background-image|MsoNormal/);
});

test("repeated parent echoes do not reset selection or undo history", async () => {
  render(<Harness />);
  selectText();
  const user = userEvent.setup();
  for (const size of ["18px", "24px", "32px", "12px"]) {
    await user.selectOptions(screen.getByRole("combobox", { name: "글자 크기" }), size);
    assert.equal(editor().state.selection.from, 1);
    assert.equal(editor().state.selection.to, 7);
  }
  assert.equal(editor().can().undo(), true);
  assert.equal(saved(), sanitizeRichTextHtml(editor().getHTML()));
});

test("paragraph indent and ordered lists remain editable after reload", async () => {
  render(<Harness />);
  selectText();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "들여쓰기" }));
  assert.match(saved(), /data-indent="1"/);
  await user.click(screen.getByRole("button", { name: "내어쓰기" }));
  assert.doesNotMatch(saved(), /data-indent/);
  await user.click(screen.getByRole("button", { name: "번호 매기기" }));
  const stored = saved();
  assert.match(stored, /<ol>/);
  cleanup();
  render(<Harness initial={stored} />);
  assert.equal(screen.getByRole("textbox").querySelectorAll("ol li").length, 1);
});

test("Word HTML parsed by the editor retains supported point sizes, alignment, and marks", () => {
  render(<Harness />);
  act(() => {
    editor().commands.selectAll();
    editor().commands.insertContent('<p class="MsoNormal" style="text-align:right"><span style="font-size:11pt;font-family:Arial;font-weight:bold;color:#123456">붙여넣은 내용</span></p>');
  });
  assert.match(saved(), /font-size: 11pt/);
  assert.match(saved(), /text-align: right/);
  assert.match(saved(), /<strong>/);
  assert.doesNotMatch(saved(), /MsoNormal/);
});
