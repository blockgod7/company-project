const RICH_TEXT_TAG_PATTERN = /<\/?(?:p|div|br|strong|b|em|i|u|s|strike|ul|ol|li|blockquote|h1|h2|h3|span|mark|a|hr|pre|code|table|thead|tbody|tfoot|tr|th|td|colgroup|col|img)\b/i;

type RichTextOptions = { allowImages?: boolean };

export function isSafeImageUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

const ALLOWED_TAGS = new Set([
  "P", "DIV", "BR", "STRONG", "B", "EM", "I", "U", "S", "STRIKE",
  "UL", "OL", "LI", "BLOCKQUOTE", "H1", "H2", "H3", "SPAN", "MARK",
  "A", "HR", "PRE", "CODE", "TABLE", "THEAD", "TBODY", "TFOOT", "TR",
  "TH", "TD", "COLGROUP", "COL"
]);
const REMOVED_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH", "FORM", "INPUT", "BUTTON"]);
const ALLOWED_FONT_FAMILIES = new Set(["맑은 고딕", "Malgun Gothic", "Arial", "Georgia", "Times New Roman", "monospace"]);
const ALLOWED_LINE_HEIGHTS = new Set(["1", "1.3", "1.5", "1.8", "2"]);
const ALLOWED_INDENTS = new Set(["2em", "4em", "6em", "8em"]);

function isSafeColor(value: string) {
  return /^#[0-9a-f]{3,8}$/i.test(value)
    || /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(value);
}

function isSafeLink(value: string) {
  return /^(?:https?:\/\/|mailto:)/i.test(value);
}

function cleanFontFamily(value: string) {
  return value.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

export function isRichTextHtml(content: string) {
  return RICH_TEXT_TAG_PATTERN.test(content);
}

export function sanitizeRichTextHtml(html: string, { allowImages = false }: RichTextOptions = {}) {
  const template = document.createElement("template");
  template.innerHTML = html;

  Array.from(template.content.querySelectorAll("*")).forEach((element) => {
    if (element.tagName === "IMG") {
      const src = element.getAttribute("src") ?? "";
      if (!allowImages || !isSafeImageUrl(src)) {
        element.remove();
        return;
      }
      const alt = element.getAttribute("alt") ?? "";
      Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));
      element.setAttribute("src", src);
      element.setAttribute("alt", alt);
      element.setAttribute("referrerpolicy", "no-referrer");
      return;
    }
    if (REMOVED_TAGS.has(element.tagName)) {
      element.remove();
      return;
    }
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    const htmlElement = element instanceof HTMLElement ? element : null;
    const textAlign = htmlElement && ["left", "center", "right", "justify"].includes(htmlElement.style.textAlign)
      ? htmlElement.style.textAlign
      : "";
    const fontSize = htmlElement && /^(?:[89]|[1-6]\d|7[0-2])(?:\.\d{1,2})?(?:px|pt)$/.test(htmlElement.style.fontSize)
      ? htmlElement.style.fontSize
      : "";
    const rawFontFamily = htmlElement ? cleanFontFamily(htmlElement.style.fontFamily) : "";
    const fontFamily = ALLOWED_FONT_FAMILIES.has(rawFontFamily) ? rawFontFamily : "";
    const color = htmlElement && isSafeColor(htmlElement.style.color) ? htmlElement.style.color : "";
    const backgroundColor = htmlElement && isSafeColor(htmlElement.style.backgroundColor) ? htmlElement.style.backgroundColor : "";
    const lineHeight = htmlElement && ALLOWED_LINE_HEIGHTS.has(htmlElement.style.lineHeight) ? htmlElement.style.lineHeight : "";
    const marginLeft = htmlElement && ALLOWED_INDENTS.has(htmlElement.style.marginLeft) ? htmlElement.style.marginLeft : "";
    const href = element.tagName === "A" ? element.getAttribute("href") ?? "" : "";
    const indent = element.getAttribute("data-indent") ?? "";
    const colspan = element.getAttribute("colspan") ?? "";
    const rowspan = element.getAttribute("rowspan") ?? "";
    const listStart = element.getAttribute("start") ?? "";

    Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));

    const styles = [
      textAlign ? "text-align: " + textAlign : "",
      fontSize ? "font-size: " + fontSize : "",
      fontFamily ? "font-family: '" + fontFamily + "'" : "",
      color ? "color: " + color : "",
      backgroundColor ? "background-color: " + backgroundColor : "",
      lineHeight ? "line-height: " + lineHeight : "",
      marginLeft ? "margin-left: " + marginLeft : ""
    ].filter(Boolean);
    if (styles.length) element.setAttribute("style", styles.join("; "));

    if (element.tagName === "A" && isSafeLink(href)) {
      element.setAttribute("href", href);
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    }
    if (/^[1-4]$/.test(indent)) element.setAttribute("data-indent", indent);
    if ((element.tagName === "TD" || element.tagName === "TH") && /^[1-9]\d?$/.test(colspan)) {
      element.setAttribute("colspan", colspan);
    }
    if ((element.tagName === "TD" || element.tagName === "TH") && /^[1-9]\d?$/.test(rowspan)) {
      element.setAttribute("rowspan", rowspan);
    }
    if (element.tagName === "OL" && /^[1-9]\d{0,3}$/.test(listStart)) element.setAttribute("start", listStart);
  });

  return template.innerHTML;
}

export function richTextEditorHtml(content: string, options: RichTextOptions = {}) {
  if (!content.trim()) return "";
  if (isRichTextHtml(content)) return sanitizeRichTextHtml(content, options);
  if (!options.allowImages) return plainTextHtml(content);

  // Migrate the image syntax used by the previous board/notice editor.
  const pattern = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  let html = "";
  let lastIndex = 0;
  for (const match of content.matchAll(pattern)) {
    if (!isSafeImageUrl(match[2])) continue;
    const index = match.index ?? 0;
    if (index > lastIndex) html += plainTextHtml(content.slice(lastIndex, index));
    html += '<img src="' + escapeHtml(match[2]) + '" alt="' + escapeHtml(match[1]) + '" referrerpolicy="no-referrer">';
    lastIndex = index + match[0].length;
  }
  if (lastIndex < content.length) html += plainTextHtml(content.slice(lastIndex));
  return html;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function plainTextHtml(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => {
      const escaped = escapeHtml(line);
      return "<p>" + (escaped || "<br>") + "</p>";
    })
    .join("");
}
