package com.codenote.service;

import com.codenote.dto.LanguageConfigRequest;
import com.codenote.entity.LanguageConfig;
import com.codenote.repository.LanguageConfigRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class LanguageConfigService {

    private final LanguageConfigRepository languageConfigRepository;

    public LanguageConfigService(LanguageConfigRepository languageConfigRepository) {
        this.languageConfigRepository = languageConfigRepository;
    }

    // 内置默认语言配置（按用户维度，首次访问时初始化）
    public List<LanguageConfig> getLanguageConfigs(UUID userId) {
        List<LanguageConfig> configs = languageConfigRepository.findByUserIdOrderBySortOrderAsc(userId);
        if (configs.isEmpty()) {
            initBuiltInLanguages(userId);
            return languageConfigRepository.findByUserIdOrderBySortOrderAsc(userId);
        }
        // 为已有用户补充缺失的内置语言和扩展名
        ensureBuiltInLanguages(userId, configs);
        return configs;
    }

    public LanguageConfig createLanguageConfig(UUID userId, LanguageConfigRequest request) {
        int sortOrder = (int) languageConfigRepository.count();
        LanguageConfig config = LanguageConfig.builder()
                .userId(userId)
                .name(request.getName())
                .value(request.getValue())
                .mode(request.getMode() != null ? request.getMode() : "javascript")
                .extensions(request.getExtensions() != null ? request.getExtensions() : "")
                .sortOrder(request.getSortOrder() != null ? request.getSortOrder() : sortOrder)
                .isBuiltIn(false)
                .build();
        return languageConfigRepository.save(config);
    }

    public LanguageConfig updateLanguageConfig(UUID userId, UUID id, LanguageConfigRequest request) {
        LanguageConfig config = languageConfigRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Language config not found"));

        if (!config.getUserId().equals(userId)) {
            throw new RuntimeException("Not authorized");
        }

        if (request.getName() != null) config.setName(request.getName());
        if (request.getValue() != null) config.setValue(request.getValue());
        if (request.getMode() != null) config.setMode(request.getMode());
        if (request.getExtensions() != null) config.setExtensions(request.getExtensions());
        if (request.getSortOrder() != null) config.setSortOrder(request.getSortOrder());

        return languageConfigRepository.save(config);
    }

    public void deleteLanguageConfig(UUID userId, UUID id) {
        LanguageConfig config = languageConfigRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Language config not found"));

        if (!config.getUserId().equals(userId)) {
            throw new RuntimeException("Not authorized");
        }

        if (config.getIsBuiltIn() != null && config.getIsBuiltIn()) {
            throw new RuntimeException("Cannot delete built-in language");
        }

        languageConfigRepository.delete(config);
    }

    private void initBuiltInLanguages(UUID userId) {
        // 按照 value, label(name), mode, extensions 的顺序
        String[][] builtIns = {
            {"javascript", "JavaScript", "javascript", ".js,.mjs,.cjs"},
            {"typescript", "TypeScript", "typescript", ".ts,.tsx,.mts,.cts"},
            {"solidity", "Solidity", "javascript", ".sol"},
            {"python", "Python", "python", ".py,.pyw"},
            {"java", "Java", "java", ".java"},
            {"rust", "Rust", "rust", ".rs"},
            {"go", "Go", "go", ".go"},
            {"css", "CSS", "css", ".css,.scss,.less"},
            {"html", "HTML", "html", ".html,.htm,.xhtml"},
            {"json", "JSON", "json", ".json,.jsonc"},
            {"sql", "SQL", "sql", ".sql"},
            {"markdown", "Markdown", "markdown", ".md,.markdown,.mdx"},
            {"xml", "XML", "xml", ".xml,.svg,.xsd,.xsl"},
            {"bash", "Bash", "shell", ".sh,.bash,.zsh,.bat,.cmd"},
            {"powershell", "PowerShell", "powershell", ".ps1,.psm1,.psd1"},
            {"yaml", "YAML", "yaml", ".yaml,.yml"},
        };

        for (int i = 0; i < builtIns.length; i++) {
            LanguageConfig config = LanguageConfig.builder()
                    .userId(userId)
                    .value(builtIns[i][0])
                    .name(builtIns[i][1])
                    .mode(builtIns[i][2])
                    .extensions(builtIns[i][3])
                    .sortOrder(i)
                    .isBuiltIn(true)
                    .build();
            languageConfigRepository.save(config);
        }
    }

    private void ensureBuiltInLanguages(UUID userId, List<LanguageConfig> existing) {
        Set<String> existingValues = existing.stream()
                .map(LanguageConfig::getValue)
                .collect(Collectors.toSet());

        // PowerShell 是新增的内置语言
        if (!existingValues.contains("powershell")) {
            int sortOrder = existing.size();
            LanguageConfig config = LanguageConfig.builder()
                    .userId(userId)
                    .value("powershell")
                    .name("PowerShell")
                    .mode("powershell")
                    .extensions(".ps1,.psm1,.psd1")
                    .sortOrder(sortOrder)
                    .isBuiltIn(true)
                    .build();
            languageConfigRepository.save(config);
            existing.add(config);
        }

        // 为已有的内置 Bash 配置补充 .bat,.cmd 扩展名
        for (LanguageConfig config : existing) {
            if ("bash".equals(config.getValue())
                    && config.getIsBuiltIn() != null && config.getIsBuiltIn()) {
                String exts = config.getExtensions();
                if (exts != null && !exts.contains(".bat")) {
                    config.setExtensions(exts + ",.bat,.cmd");
                    languageConfigRepository.save(config);
                }
            }
        }
    }
}
