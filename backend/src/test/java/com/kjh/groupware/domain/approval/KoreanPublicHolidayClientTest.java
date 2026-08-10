package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class KoreanPublicHolidayClientTest {
    @Test
    void parsesOnlyPublicHolidaysAndClassifiesSubstituteHoliday() throws Exception {
        String xml = """
            <response><header><resultCode>00</resultCode><resultMsg>OK</resultMsg></header><body><items>
              <item><dateName>신정</dateName><isHoliday>Y</isHoliday><locdate>20280101</locdate></item>
              <item><dateName>대체공휴일(설날)</dateName><isHoliday>Y</isHoliday><locdate>20280126</locdate></item>
              <item><dateName>기념일</dateName><isHoliday>N</isHoliday><locdate>20280201</locdate></item>
              <item><dateName>다른 연도</dateName><isHoliday>Y</isHoliday><locdate>20290101</locdate></item>
            </items></body></response>
            """;
        KoreanPublicHolidayClient client = new KoreanPublicHolidayClient(
            HttpClient.newHttpClient(), "https://example.invalid", "key", true
        );

        List<ApprovalHolidayOfficialCalendar.OfficialHoliday> result = client.parseResponse(
            xml.getBytes(StandardCharsets.UTF_8), 2028
        );

        assertThat(result).extracting(ApprovalHolidayOfficialCalendar.OfficialHoliday::date)
            .containsExactly(LocalDate.of(2028, 1, 1), LocalDate.of(2028, 1, 26));
        assertThat(result.get(1).type()).isEqualTo("SUBSTITUTE_HOLIDAY");
    }
}
