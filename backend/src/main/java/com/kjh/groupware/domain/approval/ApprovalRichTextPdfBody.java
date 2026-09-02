package com.kjh.groupware.domain.approval;

import com.openhtmltopdf.outputdevice.helper.BaseRendererBuilder.FontStyle;
import com.openhtmltopdf.outputdevice.helper.ExternalResourceControlPriority;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.jsoup.Jsoup;
import org.jsoup.helper.W3CDom;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.safety.Cleaner;
import org.jsoup.safety.Safelist;

/** Renders only the draft body; the existing renderer overlays approval metadata. */
final class ApprovalRichTextPdfBody {
    private static final Pattern HTML = Pattern.compile(
        "</?(?:p|div|br|strong|b|em|i|u|s|strike|ul|ol|li|blockquote|h[1-3]|span|mark|a|hr|pre|code|table|thead|tbody|tfoot|tr|th|td|colgroup|col)\\b",
        Pattern.CASE_INSENSITIVE);
    private static final Set<String> FONTS = Set.of("맑은 고딕", "Malgun Gothic", "Arial", "Georgia", "Times New Roman", "monospace");
    private static final Safelist SAFE_HTML = new Safelist()
        .addTags("p", "div", "br", "strong", "b", "em", "i", "u", "s", "strike", "ul", "ol", "li",
            "blockquote", "h1", "h2", "h3", "span", "mark", "a", "hr", "pre", "code",
            "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col")
        .addAttributes(":all", "style")
        .addAttributes("a", "href").addProtocols("a", "href", "http", "https", "mailto")
        .addAttributes("td", "colspan", "rowspan").addAttributes("th", "colspan", "rowspan")
        .addAttributes("ol", "start");
    private static final String CSS = """
        @page { size: A4; margin: 74pt 65pt 60pt 72pt; }
        @page:first { margin-top: 496pt; margin-bottom: 196pt; }
        html, body { margin: 0; padding: 0; }
        body { font-family: 'Malgun Gothic'; font-size: 12pt; line-height: 1.75; color: #0f172a; word-wrap: break-word; }
        p { margin: 0 0 .7em; }
        h1 { font-size: 1.8em; } h2 { font-size: 1.5em; } h3 { font-size: 1.2em; }
        h1, h2, h3 { margin: .4em 0 .55em; }
        ul, ol { margin: .5em 0 .8em; padding-left: 1.7em; }
        li p { margin-bottom: .25em; }
        blockquote { margin: .6em 0; padding: .35em .8em; border-left: 3px solid #94a3b8; background: #f8fafc; color: #475569; }
        mark { background-color: #fef08a; }
        s, strike { text-decoration: line-through; }
        code { font-family: monospace; background: #f1f5f9; }
        a { color: #1d4ed8; text-decoration: underline; }
        hr { border: 0; border-top: 1px solid #cbd5e1; margin: 1em 0; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: .7em 0; -fs-table-paginate: paginate; }
        th, td { border: 1px solid #94a3b8; padding: 6pt; vertical-align: top; text-align: left; }
        th { font-weight: bold; background: #f1f5f9; }
        th p, td p { margin: 0; }
        """;

    private ApprovalRichTextPdfBody() {}

    static PDDocument render(String value) throws IOException {
        Document html = safeDocument(value);
        html.head().appendElement("style").text(CSS);
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.withW3cDocument(new W3CDom().fromJsoup(html), null);
            // User HTML must never make the server fetch URLs or read local files.
            builder.useExternalResourceAccessControl((uri, type) -> false,
                ExternalResourceControlPriority.RUN_BEFORE_RESOLVING_URI);
            builder.useExternalResourceAccessControl((uri, type) -> false,
                ExternalResourceControlPriority.RUN_AFTER_RESOLVING_URI);
            registerFonts(builder);
            builder.toStream(output);
            builder.run();
            return Loader.loadPDF(output.toByteArray());
        }
    }

    static Document safeDocument(String value) {
        String content = value == null ? "" : value;
        Document source;
        if (HTML.matcher(content).find()) {
            source = Jsoup.parseBodyFragment(content);
        } else {
            source = Jsoup.parseBodyFragment("");
            for (String line : content.split("\\R", -1)) {
                Element p = source.body().appendElement("p");
                if (line.isEmpty()) p.appendElement("br");
                else p.text(line);
            }
        }
        source.select("script,style,iframe,object,embed,svg,math,form,input,button").remove();
        Document clean = new Cleaner(SAFE_HTML).clean(source);
        for (Element element : clean.body().getAllElements()) {
            String style = safeStyle(element.attr("style"));
            element.removeAttr("style");
            if (!style.isEmpty()) element.attr("style", style);
            for (String attr : List.of("rowspan", "colspan", "start")) {
                if (element.hasAttr(attr) && !element.attr(attr).matches("[1-9][0-9]{0,1}")) element.removeAttr(attr);
            }
        }
        clean.outputSettings().prettyPrint(false);
        return clean;
    }

    private static String safeStyle(String raw) {
        List<String> declarations = new ArrayList<>();
        for (String declaration : raw.split(";")) {
            String[] parts = declaration.split(":", 2);
            if (parts.length != 2) continue;
            String property = parts[0].trim().toLowerCase(Locale.ROOT);
            String value = parts[1].trim();
            boolean allowed = switch (property) {
                case "text-align" -> Set.of("left", "center", "right", "justify").contains(value);
                case "font-size" -> value.matches("(?:[89]|[1-6][0-9]|7[0-2])(?:\\.[0-9]{1,2})?(?:px|pt)");
                case "font-family" -> FONTS.contains(value.replace("'", "").replace("\"", ""));
                case "color", "background-color" -> value.matches("#[0-9a-fA-F]{3,8}")
                    || value.matches("rgb\\(\\s*[0-9]{1,3}\\s*,\\s*[0-9]{1,3}\\s*,\\s*[0-9]{1,3}\\s*\\)");
                case "line-height" -> Set.of("1", "1.3", "1.5", "1.8", "2").contains(value);
                case "margin-left" -> Set.of("2em", "4em", "6em", "8em").contains(value);
                default -> false;
            };
            if (allowed) declarations.add(property + ":" + value);
        }
        return String.join(";", declarations);
    }

    private static void registerFonts(PdfRendererBuilder builder) throws IOException {
        Path regular = Path.of("C:/Windows/Fonts/malgun.ttf");
        if (!Files.isRegularFile(regular)) throw new IOException("Korean PDF font malgun.ttf is not available");
        for (String family : List.of("맑은 고딕", "Malgun Gothic")) {
            registerFont(builder, family, "malgun.ttf", 400, FontStyle.NORMAL);
            registerFont(builder, family, "malgunbd.ttf", 700, FontStyle.NORMAL);
        }
        registerFamily(builder, "Arial", "arial.ttf", "arialbd.ttf", "ariali.ttf", "arialbi.ttf");
        registerFamily(builder, "Georgia", "georgia.ttf", "georgiab.ttf", "georgiai.ttf", "georgiaz.ttf");
        registerFamily(builder, "Times New Roman", "times.ttf", "timesbd.ttf", "timesi.ttf", "timesbi.ttf");
        registerFamily(builder, "monospace", "cour.ttf", "courbd.ttf", "couri.ttf", "courbi.ttf");
    }

    private static void registerFamily(PdfRendererBuilder builder, String family, String regular, String bold, String italic, String boldItalic) {
        registerFont(builder, family, regular, 400, FontStyle.NORMAL);
        registerFont(builder, family, bold, 700, FontStyle.NORMAL);
        registerFont(builder, family, italic, 400, FontStyle.ITALIC);
        registerFont(builder, family, boldItalic, 700, FontStyle.ITALIC);
    }

    private static void registerFont(PdfRendererBuilder builder, String family, String file, int weight, FontStyle style) {
        Path path = Path.of("C:/Windows/Fonts", file);
        if (Files.isRegularFile(path)) builder.useFont(path.toFile(), family, weight, style, true);
    }
}
