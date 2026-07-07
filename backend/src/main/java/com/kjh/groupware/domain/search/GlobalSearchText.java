package com.kjh.groupware.domain.search;

final class GlobalSearchText {

    private GlobalSearchText() {
    }

    static String join(String... values) {
        StringBuilder builder = new StringBuilder();
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                if (!builder.isEmpty()) {
                    builder.append(" · ");
                }
                builder.append(value.trim());
            }
        }
        return builder.toString();
    }

    static String snippet(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String normalized = value.replaceAll("\\s+", " ").trim();
        return normalized.length() <= 90 ? normalized : normalized.substring(0, 90) + "...";
    }
}
