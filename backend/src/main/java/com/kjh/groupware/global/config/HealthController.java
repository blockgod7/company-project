package com.kjh.groupware.global.config;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/health")
public class HealthController {

    @GetMapping
    public Map<String, String> health() {
        return Map.of("status", "OK");
    }
}
