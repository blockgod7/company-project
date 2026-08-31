package com.kjh.groupware.domain.approval;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;

final class ApprovalPdfCanvas {

    private ApprovalPdfCanvas() {}

    static void drawBox(PDPageContentStream content, float x, float y, float width, float height) throws IOException {
        content.addRect(x, y, width, height);
        content.stroke();
    }

    static void drawText(PDPageContentStream content, PDFont font, String text, float x, float y, float fontSize) throws IOException {
        content.beginText();
        content.setFont(font, fontSize);
        content.newLineAtOffset(x, y);
        content.showText(safe(text));
        content.endText();
    }

    static void drawFittedText(PDPageContentStream content, PDFont font, String text, float x, float y, float width, float fontSize) throws IOException {
        drawText(content, font, fitToWidth(font, safe(text), fontSize, Math.max(4, width)), x, y, fontSize);
    }

    static void drawVerticalText(PDPageContentStream content, PDFont font, String text, float x, float y, float width, float fontSize) throws IOException {
        String value = text == null ? "" : text;
        float lineY = y;
        for (int i = 0; i < value.length(); i++) {
            drawCenteredText(content, font, String.valueOf(value.charAt(i)), x, lineY, width, fontSize, 1);
            lineY -= fontSize + 5;
        }
    }

    static void drawWrappedText(PDPageContentStream content, PDFont font, String text, float x, float startY, float width, float fontSize, int maxLines) throws IOException {
        float y = startY;
        int lines = 0;
        int maxChars = Math.max(12, (int) (width / (fontSize * 0.72f)));
        String printable = text == null ? "-" : text.replace("\r\n", "\n").replace('\r', '\n');
        for (String sourceLine : printable.split("\\n")) {
            for (String wrapped : wrap(safe(sourceLine), maxChars)) {
                if (lines++ >= maxLines) return;
                drawText(content, font, wrapped, x, y, fontSize);
                y -= fontSize + 5;
            }
        }
    }

    static PDFont loadFont(PDDocument pdf) throws IOException {
        for (String path : List.of("C:/Windows/Fonts/malgun.ttf", "C:/Windows/Fonts/malgunsl.ttf")) {
            if (Files.exists(Path.of(path))) return PDType0Font.load(pdf, Path.of(path).toFile());
        }
        return new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    }

    static void writeLine(PDPageContentStream content, String text) throws IOException {
        content.showText(safe(text));
        content.newLine();
    }

    static void drawApprovalColumn(PDPageContentStream content, PDFont font, float x, float y, float width, String position, String signature, String date) throws IOException {
        float dateHeight = 22;
        float signatureHeight = 64;
        float positionHeight = 22;
        content.addRect(x, y + dateHeight + signatureHeight, width, positionHeight);
        content.addRect(x, y + dateHeight, width, signatureHeight);
        content.addRect(x, y, width, dateHeight);
        content.stroke();
        drawCenteredText(content, font, safe(position), x, y + dateHeight + signatureHeight + 7, width, 9, 8);
        drawCenteredText(content, font, safe(signature), x, y + dateHeight + 27, width, 12, 11);
        drawCenteredText(content, font, safe(date), x, y + 7, width, 8, 7);
    }

    static void drawCenteredText(PDPageContentStream content, PDFont font, String text, float x, float y, float width, float fontSize, int maxChars) throws IOException {
        String value = text == null ? "" : text;
        if (value.length() > maxChars) value = value.substring(0, maxChars);
        value = fitToWidth(font, value, fontSize, Math.max(4, width - 4));
        float textWidth = font.getStringWidth(value) / 1000 * fontSize;
        content.beginText();
        content.setFont(font, fontSize);
        content.newLineAtOffset(x + Math.max(2, (width - textWidth) / 2), y);
        content.showText(value);
        content.endText();
    }

    static String fitToWidth(PDFont font, String text, float fontSize, float width) throws IOException {
        String value = text == null ? "" : text;
        while (!value.isEmpty() && font.getStringWidth(value) / 1000 * fontSize > width) {
            value = value.substring(0, value.length() - 1);
        }
        return value;
    }

    static List<String> wrap(String text, int width) {
        if (text == null || text.isBlank()) return List.of("-");
        return text.lines().flatMap(line -> {
            if (line.length() <= width) return java.util.stream.Stream.of(line);
            List<String> parts = new ArrayList<>();
            for (int i = 0; i < line.length(); i += width) parts.add(line.substring(i, Math.min(i + width, line.length())));
            return parts.stream();
        }).limit(28).toList();
    }

    private static String safe(Object value) {
        return value == null ? "" : value.toString().replace("\r", " ").replace("\n", " ");
    }
}
