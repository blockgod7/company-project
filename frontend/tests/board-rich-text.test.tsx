import "./rich-text-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Editor } from "@tiptap/core";
import { BoardEditor, NoticeEditor } from "../src/components/BoardEditors";
import { ReadDetail } from "../src/components/ContentTools";
import { RichTextEditor } from "../src/components/RichTextEditor";
import { isSafeImageUrl, richTextEditorHtml, sanitizeRichTextHtml } from "../src/utils/richText";
import type { DraftAttachment } from "../src/utils/attachments";

afterEach(cleanup);
type PostForm = { title: string; content: string; pinned: boolean; draft: boolean };

function Harness({ kind, initial, canAttach = true, onSave = () => {} }: {
  kind: "board" | "notice"; initial?: string; canAttach?: boolean; onSave?: (form: PostForm) => void;
}) {
  const [form, setForm] = useState<PostForm>({
    title: "기존 제목", content: initial ?? "선택한 글자\n다음 줄", pinned: true, draft: true
  });
  const [files, setFiles] = useState<DraftAttachment[]>([]);
  const props = {
    title: "게시글 작성", form, pendingFiles: files, setPendingFiles: setFiles, canAttach,
    onSave: () => onSave(form), onCancel: () => {}
  };
  return <>
    {kind === "board"
      ? <BoardEditor {...props} setForm={(value) => setForm((current) => ({ ...current, ...value }))} />
      : <NoticeEditor {...props} setForm={(value) => setForm((current) => ({ ...current, ...value }))} />}
    <output data-testid="form">{JSON.stringify(form)}</output>
  </>;
}

function formValue(): PostForm { return JSON.parse(screen.getByTestId("form").textContent ?? "{}"); }

for (const kind of ["board", "notice"] as const) {
  const label = kind === "board" ? "게시글 본문" : "공지사항 본문";
  const toggle = kind === "board" ? "임시글" : "상단 고정";

  test(kind + ": format selected text, save, reopen and display the same formatting", async () => {
    let submitted: PostForm | undefined;
    render(<Harness kind={kind} onSave={(form) => { submitted = form; }} />);
    const textbox = await screen.findByRole("textbox", { name: label });
    const editor = (textbox as HTMLElement & { editor: Editor }).editor;
    assert.equal(document.querySelector("textarea"), null);
    assert.equal(screen.queryByRole("toolbar", { name: "기안 내용 글자 서식" }), null);
    assert.equal(screen.getByRole("checkbox", { name: toggle }).checked, true);
    act(() => { editor.chain().focus().setTextSelection({ from: 1, to: 7 }).run(); });
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole("combobox", { name: "글자 크기" }), "24px");
    await user.click(screen.getByRole("button", { name: "가운데 정렬" }));
    await user.click(screen.getByRole("button", { name: "굵게" }));
    await user.clear(screen.getByPlaceholderText("제목"));
    await user.type(screen.getByPlaceholderText("제목"), "변경 제목");
    await user.click(screen.getByRole("button", { name: "저장" }));
    assert.ok(submitted);
    assert.equal(submitted.title, "변경 제목");
    assert.equal(submitted.pinned, true);
    assert.equal(submitted.draft, true);
    assert.match(submitted.content, /font-size: 24px/);
    assert.match(submitted.content, /text-align: center/);
    assert.match(submitted.content, /<strong>/);
    assert.match(submitted.content, /다음 줄/);
    const stored = submitted.content;
    cleanup();
    render(<Harness kind={kind} initial={stored} />);
    const reopened = await screen.findByRole("textbox", { name: label });
    assert.equal(reopened.querySelector("strong")?.textContent, "선택한 글자");
    cleanup();
    render(<ReadDetail title="변경 제목" content={stored} meta="" canEdit={false} onEdit={() => {}} onDelete={() => {}} />);
    assert.equal(document.querySelector<HTMLElement>(".rich-text-content span")?.style.fontSize, "24px");
    assert.equal(document.querySelector<HTMLElement>(".rich-text-content p")?.style.textAlign, "center");
    assert.match(document.querySelector(".rich-text-content")?.textContent ?? "", /다음 줄/);
  });

  test(kind + ": preserves options and attachment selection permissions", async () => {
    render(<Harness kind={kind} />);
    await screen.findByRole("textbox", { name: label });
    const user = userEvent.setup();
    const file = new window.File(["첨부"], "안내.txt", { type: "text/plain" });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    assert.ok(screen.getByText("안내.txt"));
    await user.click(screen.getByRole("checkbox", { name: toggle }));
    assert.equal(kind === "board" ? formValue().draft : formValue().pinned, false);
    await user.click(screen.getByRole("button", { name: "제거" }));
    assert.equal(screen.queryByText("안내.txt"), null);
    cleanup();
    render(<Harness kind={kind} canAttach={false} />);
    await screen.findByRole("textbox", { name: label });
    assert.equal(document.querySelector('input[type="file"]'), null);
    assert.ok(screen.getByRole("toolbar", { name: label + " 글자 서식" }));
  });

  test(kind + ": legacy inline images survive formatting, save and detail display", async () => {
    render(<Harness kind={kind} initial={'첫 줄\n![기존 "사진"](https://example.com/picture.png?x=1&y=2)\n마지막 줄'} />);
    const textbox = await screen.findByRole("textbox", { name: label });
    assert.equal(textbox.querySelector("img")?.getAttribute("src"), "https://example.com/picture.png?x=1&y=2");
    const editor = (textbox as HTMLElement & { editor: Editor }).editor;
    act(() => { editor.chain().focus().setTextSelection({ from: 1, to: 4 }).run(); });
    await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: "글자 크기" }), "20px");
    const stored = formValue().content;
    assert.match(stored, /<img/);
    assert.match(stored, /font-size: 20px/);
    cleanup();
    render(<ReadDetail title="기존 글" content={stored} meta="" canEdit={false} onEdit={() => {}} onDelete={() => {}} />);
    assert.equal(screen.getByRole("img", { name: '기존 "사진"' }).getAttribute("src"), "https://example.com/picture.png?x=1&y=2");
    assert.match(document.body.textContent ?? "", /첫 줄/);
    assert.match(document.body.textContent ?? "", /마지막 줄/);
  });
}

test("HTML images allow only safe URLs and strip executable attributes", () => {
  const source = '<p>본문</p><img src="https://example.com/image.png" alt="설명" onerror="alert(1)" style="position:fixed">'
    + '<img src="javascript:alert(1)"><img src="data:image/svg+xml,bad"><img src="file:///private">'
    + '<img src="https://user:password@example.com/private">';
  const clean = sanitizeRichTextHtml(source, { allowImages: true });
  assert.equal((clean.match(/<img/g) ?? []).length, 1);
  assert.doesNotMatch(clean, /onerror|position|javascript|data:|file:|password/);
  assert.match(clean, /referrerpolicy="no-referrer"/);
  assert.equal(sanitizeRichTextHtml(clean, { allowImages: true }), clean);
  assert.doesNotMatch(sanitizeRichTextHtml(source), /<img/);
  assert.equal(isSafeImageUrl("https://"), false);
  assert.match(richTextEditorHtml('텍스트 <b>굵게</b>'), /<b>굵게<\/b>/);
});

test("shared editor stays usable when React StrictMode remounts its effects", async () => {
  render(<React.StrictMode><Harness kind="board" /></React.StrictMode>);
  const textbox = await screen.findByRole("textbox", { name: "게시글 본문" });
  const editor = (textbox as HTMLElement & { editor: Editor }).editor;
  act(() => { editor.chain().focus().setTextSelection({ from: 1, to: 7 }).run(); });
  await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: "글자 크기" }), "28px");
  assert.match(formValue().content, /font-size: 28px/);
  assert.equal(editor.isDestroyed, false);
});

test("image insertion uses the shared editor and is disabled for the draft by default", async () => {
  let saved = "";
  const previousPrompt = window.prompt;
  window.prompt = () => "https://example.com/new.png";
  try {
    render(<RichTextEditor content="<p>본문</p>" ariaLabel="공지사항 본문" allowImages onChange={(value) => { saved = value; }} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "본문 이미지" }));
    assert.match(saved, /<img/);
    assert.match(saved, /https:\/\/example.com\/new.png/);
  } finally { window.prompt = previousPrompt; }
  cleanup();
  render(<RichTextEditor content="" onChange={() => {}} />);
  assert.equal(screen.queryByRole("button", { name: "본문 이미지" }), null);
});
