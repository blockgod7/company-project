import { Extension } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Highlighter,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
  Unlink
} from "lucide-react";
import { useEffect, useRef } from "react";
import { isSafeImageUrl, richTextEditorHtml, sanitizeRichTextHtml } from "../utils/richText";

const FONT_SIZES = ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px", "48px"];
const FONT_FAMILIES = [
  { label: "맑은 고딕", value: "맑은 고딕" },
  { label: "Arial", value: "Arial" },
  { label: "Georgia", value: "Georgia" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "고정폭", value: "monospace" }
];
const LINE_HEIGHTS = ["1", "1.3", "1.5", "1.8", "2"];

const SafeImage = Image.extend({
  parseHTML() {
    return [{
      tag: "img[src]",
      getAttrs: (element) => isSafeImageUrl(element.getAttribute("src") ?? "") ? null : false
    }];
  }
});

const ParagraphIndent = Extension.create({
  name: "paragraphIndent",
  addGlobalAttributes() {
    return [{
      types: ["paragraph", "heading"],
      attributes: {
        indent: {
          default: 0,
          parseHTML: (element) => {
            const value = Number(element.getAttribute("data-indent") ?? 0);
            return Number.isInteger(value) && value >= 0 && value <= 4 ? value : 0;
          },
          renderHTML: (attributes) => {
            const indent = Number(attributes.indent ?? 0);
            if (!Number.isInteger(indent) || indent <= 0 || indent > 4) return {};
            return {
              "data-indent": String(indent),
              style: "margin-left: " + indent * 2 + "em"
            };
          }
        }
      }
    }];
  }
});

function toolbarButtonClass(active = false) {
  return "rich-text-command" + (active ? " active" : "");
}

export function RichTextEditor({
  content, onChange, readOnly = false, ariaLabel = "기안 내용",
  placeholder = "기안 목적과 주요 내용을 입력하세요.", allowImages = false
}: {
  content: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  allowImages?: boolean;
}) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    // Create after mount so a suspended first render cannot expose a destroyed editor.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          defaultProtocol: "https",
          HTMLAttributes: {
            target: "_blank",
            rel: "noopener noreferrer"
          }
        }
      }),
      TextStyleKit,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"]
      }),
      Highlight,
      TableKit,
      ...(allowImages ? [SafeImage.configure({ allowBase64: false, HTMLAttributes: { referrerpolicy: "no-referrer" } })] : []),
      Placeholder.configure({
        placeholder
      }),
      ParagraphIndent
    ],
    content: richTextEditorHtml(content, { allowImages }),
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: "tiptap",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": ariaLabel
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChangeRef.current(currentEditor.isEmpty ? "" : sanitizeRichTextHtml(currentEditor.getHTML(), { allowImages }));
    }
  });

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor?.isActive("bold") ?? false,
      italic: currentEditor?.isActive("italic") ?? false,
      underline: currentEditor?.isActive("underline") ?? false,
      strike: currentEditor?.isActive("strike") ?? false,
      code: currentEditor?.isActive("code") ?? false,
      highlight: currentEditor?.isActive("highlight") ?? false,
      bulletList: currentEditor?.isActive("bulletList") ?? false,
      orderedList: currentEditor?.isActive("orderedList") ?? false,
      link: currentEditor?.isActive("link") ?? false,
      table: currentEditor?.isActive("table") ?? false,
      blockStyle: currentEditor?.isActive("heading") ? String(currentEditor.getAttributes("heading").level) : "paragraph",
      fontSize: String(currentEditor?.getAttributes("textStyle").fontSize ?? "default"),
      fontFamily: String(currentEditor?.getAttributes("textStyle").fontFamily ?? "default").replace(/['"]/g, ""),
      lineHeight: String(currentEditor?.getAttributes("textStyle").lineHeight ?? "default"),
      alignLeft: currentEditor?.isActive({ textAlign: "left" }) ?? false,
      alignCenter: currentEditor?.isActive({ textAlign: "center" }) ?? false,
      alignRight: currentEditor?.isActive({ textAlign: "right" }) ?? false,
      alignJustify: currentEditor?.isActive({ textAlign: "justify" }) ?? false,
      canUndo: currentEditor?.can().chain().undo().run() ?? false,
      canRedo: currentEditor?.can().chain().redo().run() ?? false
    })
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!readOnly, false);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const next = richTextEditorHtml(content, { allowImages });
    const current = editor.isEmpty ? "" : sanitizeRichTextHtml(editor.getHTML(), { allowImages });
    if (current !== next) editor.commands.setContent(next, { emitUpdate: false });
  }, [content, editor, allowImages]);

  function insertImage() {
    if (!editor || !allowImages) return;
    const entered = window.prompt("본문에 넣을 이미지 URL을 입력하세요.");
    if (!entered?.trim()) return;
    const src = entered.trim();
    if (!isSafeImageUrl(src)) {
      window.alert("http 또는 https 형식의 이미지 주소를 입력하세요.");
      return;
    }
    const alt = window.prompt("이미지 설명을 입력하세요.")?.trim() || "본문 이미지";
    editor.chain().focus().setImage({ src, alt }).run();
  }

  function setBlockStyle(value: string) {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (value === "paragraph") chain.setParagraph().run();
    else chain.setHeading({ level: Number(value) as 1 | 2 | 3 }).run();
  }

  function setLink() {
    if (!editor) return;
    const previous = String(editor.getAttributes("link").href ?? "");
    const entered = window.prompt("연결할 주소를 입력하세요.", previous || "https://");
    if (entered === null) return;
    let href = entered.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^[a-z][a-z\d+.-]*:/i.test(href)) href = "https://" + href;
    try {
      const url = new URL(href);
      if (!["http:", "https:", "mailto:"].includes(url.protocol)) throw new Error("Unsupported protocol");
    } catch {
      window.alert("http, https 또는 mailto 형식의 올바른 주소를 입력하세요.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  function adjustIndent(direction: 1 | -1) {
    if (!editor) return;
    if (editor.isActive("listItem")) {
      const chain = editor.chain().focus();
      if (direction > 0) chain.sinkListItem("listItem").run();
      else chain.liftListItem("listItem").run();
      return;
    }
    const nodeType = editor.isActive("heading") ? "heading" : "paragraph";
    const current = Number(editor.getAttributes(nodeType).indent ?? 0);
    editor.chain().focus().updateAttributes(nodeType, {
      indent: Math.max(0, Math.min(4, current + direction))
    }).run();
  }

  if (!editor || !toolbarState) return <div className="rich-text-editor loading" aria-busy="true" />;

  return (
    <div className={"rich-text-editor tiptap-shell" + (readOnly ? " read-only" : "")}>
      {!readOnly && (
        <>
          <div className="rich-text-toolbar" role="toolbar" aria-label={ariaLabel + " 글자 서식"}
            onMouseDown={(event) => {
              if ((event.target as HTMLElement).closest("button")) event.preventDefault();
            }}>
            <select
              aria-label="문단 스타일"
              value={toolbarState.blockStyle}
              onChange={(event) => {
                setBlockStyle(event.target.value);
              }}
            >
              <option value="paragraph">본문</option>
              <option value="1">제목 1</option>
              <option value="2">제목 2</option>
              <option value="3">제목 3</option>
            </select>
            <select
              aria-label="글꼴"
              value={toolbarState.fontFamily}
              onChange={(event) => {
                if (event.target.value === "default") editor.chain().focus().unsetFontFamily().run();
                else editor.chain().focus().setFontFamily(event.target.value).run();
              }}
            >
              <option value="default">기본 글꼴</option>
              {FONT_FAMILIES.map((font) => <option value={font.value} key={font.value}>{font.label}</option>)}
            </select>
            <select
              aria-label="글자 크기"
              value={toolbarState.fontSize}
              onChange={(event) => {
                if (event.target.value === "default") editor.chain().focus().unsetFontSize().run();
                else editor.chain().focus().setFontSize(event.target.value).run();
              }}
            >
              <option value="default">기본 (16px)</option>
              {toolbarState.fontSize !== "default" && !FONT_SIZES.includes(toolbarState.fontSize) &&
                <option value={toolbarState.fontSize}>{toolbarState.fontSize}</option>}
              {FONT_SIZES.map((size) => <option value={size} key={size}>{size}</option>)}
            </select>
            <select
              aria-label="줄 간격"
              value={toolbarState.lineHeight}
              onChange={(event) => {
                if (event.target.value === "default") editor.chain().focus().unsetLineHeight().run();
                else editor.chain().focus().setLineHeight(event.target.value).run();
              }}
            >
              <option value="default">줄 간격 기본</option>
              {LINE_HEIGHTS.map((height) => <option value={height} key={height}>{height}</option>)}
            </select>
            <span className="rich-text-toolbar-divider" />
            <button type="button" className={toolbarButtonClass(toolbarState.bold)} aria-pressed={toolbarState.bold} title="굵게" aria-label="굵게" onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></button>
            <button type="button" className={toolbarButtonClass(toolbarState.italic)} aria-pressed={toolbarState.italic} title="기울임" aria-label="기울임" onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></button>
            <button type="button" className={toolbarButtonClass(toolbarState.underline)} aria-pressed={toolbarState.underline} title="밑줄" aria-label="밑줄" onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline size={16} /></button>
            <button type="button" className={toolbarButtonClass(toolbarState.strike)} aria-pressed={toolbarState.strike} title="취소선" aria-label="취소선" onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={16} /></button>
            <button type="button" className={toolbarButtonClass(toolbarState.code)} aria-pressed={toolbarState.code} title="코드 서식" aria-label="코드 서식" onClick={() => editor.chain().focus().toggleCode().run()}><Code2 size={16} /></button>
            <label className="rich-text-color-control" title="글자색">
              <span>글자색</span>
              <input type="color" defaultValue="#0f172a" onInput={(event) => editor.chain().focus().setColor(event.currentTarget.value).run()} />
            </label>
            <button type="button" className={toolbarButtonClass(toolbarState.highlight)} aria-pressed={toolbarState.highlight} title="형광펜" aria-label="형광펜" onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter size={16} /></button>
            <span className="rich-text-toolbar-divider" />
            <button type="button" className={toolbarButtonClass(toolbarState.bulletList)} aria-pressed={toolbarState.bulletList} title="글머리 기호" aria-label="글머리 기호" onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></button>
            <button type="button" className={toolbarButtonClass(toolbarState.orderedList)} aria-pressed={toolbarState.orderedList} title="번호 매기기" aria-label="번호 매기기" onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></button>
            <button type="button" className={toolbarButtonClass()} title="내어쓰기" aria-label="내어쓰기" onClick={() => adjustIndent(-1)}><IndentDecrease size={16} /></button>
            <button type="button" className={toolbarButtonClass()} title="들여쓰기" aria-label="들여쓰기" onClick={() => adjustIndent(1)}><IndentIncrease size={16} /></button>
            <span className="rich-text-toolbar-divider" />
            <button type="button" className={toolbarButtonClass(toolbarState.alignLeft)} aria-pressed={toolbarState.alignLeft} title="왼쪽 정렬" aria-label="왼쪽 정렬" onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft size={16} /></button>
            <button type="button" className={toolbarButtonClass(toolbarState.alignCenter)} aria-pressed={toolbarState.alignCenter} title="가운데 정렬" aria-label="가운데 정렬" onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter size={16} /></button>
            <button type="button" className={toolbarButtonClass(toolbarState.alignRight)} aria-pressed={toolbarState.alignRight} title="오른쪽 정렬" aria-label="오른쪽 정렬" onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight size={16} /></button>
            <button type="button" className={toolbarButtonClass(toolbarState.alignJustify)} aria-pressed={toolbarState.alignJustify} title="양쪽 정렬" aria-label="양쪽 정렬" onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify size={16} /></button>
            <span className="rich-text-toolbar-divider" />
            <button type="button" className={toolbarButtonClass(toolbarState.link)} aria-pressed={toolbarState.link} title="링크" aria-label="링크" onClick={setLink}><Link2 size={16} /></button>
            <button type="button" className={toolbarButtonClass()} title="링크 제거" aria-label="링크 제거" disabled={!toolbarState.link} onClick={() => editor.chain().focus().unsetLink().run()}><Unlink size={16} /></button>
            {allowImages && <button type="button" className={toolbarButtonClass()} title="본문 이미지" aria-label="본문 이미지" onClick={insertImage}><ImagePlus size={16} /></button>}
            <button type="button" className={toolbarButtonClass()} title="가로선" aria-label="가로선" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={16} /></button>
            <button type="button" className={toolbarButtonClass(toolbarState.table)} aria-pressed={toolbarState.table} title="3×3 표 삽입" aria-label="3×3 표 삽입" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={16} /></button>
            <span className="rich-text-toolbar-divider" />
            <button type="button" className={toolbarButtonClass()} title="실행 취소" aria-label="실행 취소" disabled={!toolbarState.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} /></button>
            <button type="button" className={toolbarButtonClass()} title="다시 실행" aria-label="다시 실행" disabled={!toolbarState.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} /></button>
            <button type="button" className={toolbarButtonClass()} title="서식 지우기" aria-label="서식 지우기" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting size={16} /></button>
          </div>
          {toolbarState.table && (
            <div className="rich-text-table-toolbar" role="toolbar" aria-label="표 편집"
              onMouseDown={(event) => {
                if ((event.target as HTMLElement).closest("button")) event.preventDefault();
              }}>
              <strong>표 편집</strong>
              <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>행 추가</button>
              <button type="button" onClick={() => editor.chain().focus().deleteRow().run()}>행 삭제</button>
              <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>열 추가</button>
              <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()}>열 삭제</button>
              <button type="button" disabled={!editor.can().mergeCells()} onClick={() => editor.chain().focus().mergeCells().run()}>셀 합치기</button>
              <button type="button" disabled={!editor.can().splitCell()} onClick={() => editor.chain().focus().splitCell().run()}>셀 나누기</button>
              <button type="button" className="danger" onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 size={14} /> 표 삭제</button>
            </div>
          )}
        </>
      )}
      <EditorContent editor={editor} className="tiptap-editor-content" />
    </div>
  );
}
