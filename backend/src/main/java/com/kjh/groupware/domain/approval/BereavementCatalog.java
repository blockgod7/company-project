package com.kjh.groupware.domain.approval;

import com.kjh.groupware.global.exception.BusinessException;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class BereavementCatalog {
    public record Item(String code, String label) {}

    public static final List<Item> EVENT_TYPES = List.of(
        new Item("MARRIAGE", "결혼"),
        new Item("BIRTH", "출산"),
        new Item("DEATH", "사망")
    );

    public static final List<Item> FAMILY_RELATIONS = List.of(
        new Item("SELF", "본인"),
        new Item("SPOUSE", "배우자"),
        new Item("CHILD", "자녀"),
        new Item("PARENT", "부모"),
        new Item("SPOUSE_PARENT", "배우자 부모"),
        new Item("GRANDPARENT", "조부모"),
        new Item("SIBLING", "형제자매")
    );

    private static final Map<String, String> EVENT_ALIASES = Map.ofEntries(
        Map.entry("MARRIAGE", "MARRIAGE"), Map.entry("결혼", "MARRIAGE"),
        Map.entry("BIRTH", "BIRTH"), Map.entry("출산", "BIRTH"),
        Map.entry("DEATH", "DEATH"), Map.entry("사망", "DEATH"), Map.entry("조사", "DEATH")
    );
    private static final Map<String, String> RELATION_ALIASES = Map.ofEntries(
        Map.entry("SELF", "SELF"), Map.entry("본인", "SELF"),
        Map.entry("SPOUSE", "SPOUSE"), Map.entry("배우자", "SPOUSE"),
        Map.entry("CHILD", "CHILD"), Map.entry("자녀", "CHILD"),
        Map.entry("PARENT", "PARENT"), Map.entry("부모", "PARENT"), Map.entry("부모님", "PARENT"),
        Map.entry("SPOUSE_PARENT", "SPOUSE_PARENT"), Map.entry("배우자 부모", "SPOUSE_PARENT"), Map.entry("배우자부모", "SPOUSE_PARENT"),
        Map.entry("GRANDPARENT", "GRANDPARENT"), Map.entry("조부모", "GRANDPARENT"),
        Map.entry("SIBLING", "SIBLING"), Map.entry("형제자매", "SIBLING")
    );

    private BereavementCatalog() {}

    public static String normalizeEvent(String value) {
        String normalized = normalize(value, EVENT_ALIASES);
        if (normalized == null) {
            throw BusinessException.badRequest("BEREAVEMENT_EVENT_TYPE_INVALID", "지원하는 경조 유형을 선택해 주세요.");
        }
        return normalized;
    }

    public static String normalizeRelation(String value) {
        String normalized = normalize(value, RELATION_ALIASES);
        if (normalized == null) {
            throw BusinessException.badRequest("BEREAVEMENT_RELATION_INVALID", "지원하는 대상 관계를 선택해 주세요.");
        }
        return normalized;
    }

    public static String eventLabel(String code) {
        return label(EVENT_TYPES, code);
    }

    public static String relationLabel(String code) {
        return label(FAMILY_RELATIONS, code);
    }

    private static String normalize(String value, Map<String, String> aliases) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        return aliases.getOrDefault(trimmed, aliases.get(trimmed.toUpperCase(Locale.ROOT)));
    }

    private static String label(List<Item> items, String code) {
        if (code == null) return "";
        return items.stream().filter(item -> item.code().equals(code)).map(Item::label).findFirst().orElse(code);
    }
}
