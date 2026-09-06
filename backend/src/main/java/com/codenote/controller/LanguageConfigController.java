package com.codenote.controller;

import com.codenote.dto.LanguageConfigRequest;
import com.codenote.entity.LanguageConfig;
import com.codenote.service.LanguageConfigService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/languages")
public class LanguageConfigController {

    private final LanguageConfigService languageConfigService;

    public LanguageConfigController(LanguageConfigService languageConfigService) {
        this.languageConfigService = languageConfigService;
    }

    @GetMapping
    public ResponseEntity<List<LanguageConfig>> getLanguageConfigs(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(languageConfigService.getLanguageConfigs(userId));
    }

    @PostMapping
    public ResponseEntity<LanguageConfig> createLanguageConfig(@AuthenticationPrincipal UUID userId,
                                                                @RequestBody LanguageConfigRequest request) {
        return ResponseEntity.ok(languageConfigService.createLanguageConfig(userId, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<LanguageConfig> updateLanguageConfig(@AuthenticationPrincipal UUID userId,
                                                                @PathVariable UUID id,
                                                                @RequestBody LanguageConfigRequest request) {
        return ResponseEntity.ok(languageConfigService.updateLanguageConfig(userId, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLanguageConfig(@AuthenticationPrincipal UUID userId,
                                                      @PathVariable UUID id) {
        languageConfigService.deleteLanguageConfig(userId, id);
        return ResponseEntity.noContent().build();
    }
}
