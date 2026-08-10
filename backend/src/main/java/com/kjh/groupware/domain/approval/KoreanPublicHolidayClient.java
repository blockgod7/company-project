package com.kjh.groupware.domain.approval;

import com.kjh.groupware.global.exception.BusinessException;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import javax.xml.parsers.DocumentBuilderFactory;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

@Component
public class KoreanPublicHolidayClient {
    public static final String BASIS_SOURCE = "https://www.data.go.kr/data/15012690/openapi.do";

    private final HttpClient httpClient;
    private final String baseUrl;
    private final String serviceKey;
    @Getter
    private final boolean enabled;

    @Autowired
    public KoreanPublicHolidayClient(
        @Value("${app.approval.holiday-open-api.base-url:https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo}") String baseUrl,
        @Value("${app.approval.holiday-open-api.service-key:}") String serviceKey,
        @Value("${app.approval.holiday-open-api.enabled:false}") boolean enabled
    ) {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build(), baseUrl, serviceKey, enabled);
    }

    KoreanPublicHolidayClient(HttpClient httpClient, String baseUrl, String serviceKey, boolean enabled) {
        this.httpClient = httpClient;
        this.baseUrl = baseUrl;
        this.serviceKey = serviceKey == null ? "" : serviceKey.trim();
        this.enabled = enabled;
    }

    public boolean isConfigured() {
        return enabled && !serviceKey.isBlank();
    }

    public ApprovalHolidayOfficialCalendar.OfficialYear fetch(int year) {
        if (!isConfigured()) {
            throw BusinessException.badRequest(
                "HOLIDAY_OPEN_API_NOT_CONFIGURED",
                "공공데이터 공휴일 연동이 설정되지 않았습니다. HOLIDAY_OPEN_API_SERVICE_KEY를 등록해 주세요."
            );
        }
        if (year < 2000 || year > 2100) {
            throw BusinessException.badRequest("OFFICIAL_HOLIDAY_YEAR_INVALID", "공휴일 조회 연도를 확인해 주세요.");
        }
        try {
            String url = baseUrl
                + "?serviceKey=" + URLEncoder.encode(serviceKey, StandardCharsets.UTF_8)
                + "&pageNo=1&numOfRows=100&solYear=" + year;
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(10))
                .header("Accept", "application/xml")
                .GET()
                .build();
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("HTTP " + response.statusCode());
            }
            List<ApprovalHolidayOfficialCalendar.OfficialHoliday> holidays = parseResponse(response.body(), year);
            if (holidays.isEmpty()) {
                throw new IllegalStateException("공휴일 응답이 비어 있습니다.");
            }
            return new ApprovalHolidayOfficialCalendar.OfficialYear(
                "KASI-OPENAPI-" + year + "-" + digest(holidays), BASIS_SOURCE, holidays
            );
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw BusinessException.badRequest(
                "HOLIDAY_OPEN_API_FAILED",
                "공공데이터 공휴일 조회에 실패했습니다. 잠시 후 다시 시도하거나 연동 설정을 확인해 주세요."
            );
        }
    }

    List<ApprovalHolidayOfficialCalendar.OfficialHoliday> parseResponse(byte[] xml, int expectedYear) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setExpandEntityReferences(false);
        Element root = factory.newDocumentBuilder().parse(new ByteArrayInputStream(xml)).getDocumentElement();
        String resultCode = text(root, "resultCode");
        if (!"00".equals(resultCode)) {
            throw new IllegalStateException("API result " + resultCode);
        }
        NodeList items = root.getElementsByTagName("item");
        List<ApprovalHolidayOfficialCalendar.OfficialHoliday> result = new ArrayList<>();
        for (int index = 0; index < items.getLength(); index++) {
            Element item = (Element) items.item(index);
            if (!"Y".equalsIgnoreCase(text(item, "isHoliday"))) {
                continue;
            }
            LocalDate date = LocalDate.parse(text(item, "locdate"), DateTimeFormatter.BASIC_ISO_DATE);
            if (date.getYear() != expectedYear) {
                continue;
            }
            String name = text(item, "dateName").trim();
            String type = name.contains("대체공휴일") ? "SUBSTITUTE_HOLIDAY" : "PUBLIC_HOLIDAY";
            result.add(new ApprovalHolidayOfficialCalendar.OfficialHoliday(date, name, type));
        }
        return result.stream()
            .distinct()
            .sorted(Comparator.comparing(ApprovalHolidayOfficialCalendar.OfficialHoliday::date))
            .toList();
    }

    private String text(Element parent, String tagName) {
        NodeList nodes = parent.getElementsByTagName(tagName);
        return nodes.getLength() == 0 ? "" : nodes.item(0).getTextContent();
    }

    private String digest(List<ApprovalHolidayOfficialCalendar.OfficialHoliday> holidays) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        for (ApprovalHolidayOfficialCalendar.OfficialHoliday holiday : holidays) {
            digest.update((holiday.date() + "|" + holiday.name() + "|" + holiday.type() + "\n")
                .getBytes(StandardCharsets.UTF_8));
        }
        return HexFormat.of().formatHex(digest.digest()).substring(0, 12).toUpperCase();
    }
}
