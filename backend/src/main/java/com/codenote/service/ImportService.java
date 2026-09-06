package com.codenote.service;

import com.codenote.entity.Category;
import com.codenote.entity.LanguageConfig;
import com.codenote.entity.Snippet;
import com.codenote.repository.CategoryRepository;
import com.codenote.repository.SnippetRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ImportService {

    private final CategoryRepository categoryRepository;
    private final SnippetRepository snippetRepository;
    private final LanguageConfigService languageConfigService;

    public ImportService(CategoryRepository categoryRepository,
                         SnippetRepository snippetRepository,
                         LanguageConfigService languageConfigService) {
        this.categoryRepository = categoryRepository;
        this.snippetRepository = snippetRepository;
        this.languageConfigService = languageConfigService;
    }

    @Transactional
    public ImportResult importFolder(UUID userId, UUID parentCategoryId,
                                     MultipartFile[] files, String[] paths) {
        ImportResult result = new ImportResult();

        if (files == null || files.length == 0 || paths == null || paths.length == 0) {
            return result;
        }

        // 获取用户的语言配置，用于后缀匹配
        List<LanguageConfig> langConfigs = languageConfigService.getLanguageConfigs(userId);
        Map<String, LanguageConfig> extToLang = new HashMap<>();
        for (LanguageConfig lc : langConfigs) {
            if (lc.getExtensions() != null && !lc.getExtensions().isBlank()) {
                String[] exts = lc.getExtensions().split(",");
                for (String ext : exts) {
                    String trimmed = ext.trim().toLowerCase();
                    if (!trimmed.isEmpty()) {
                        extToLang.put(trimmed, lc);
                    }
                }
            }
        }

        // 路径到分类 ID 的映射
        Map<String, UUID> categoryPathMap = new HashMap<>();
        if (parentCategoryId != null) {
            categoryPathMap.put("", parentCategoryId);
        }

        // 按路径排序，确保浅目录先处理
        List<FileWithPath> fileList = new ArrayList<>();
        for (int i = 0; i < Math.min(files.length, paths.length); i++) {
            fileList.add(new FileWithPath(files[i], paths[i]));
        }
        fileList.sort(Comparator.comparing(f -> f.path));

        int snippetSortOrder = 0;

        for (FileWithPath fp : fileList) {
            String relativePath = fp.path;
            MultipartFile file = fp.file;

            if (relativePath == null || relativePath.isBlank()) continue;

            // 规范化路径分隔符
            relativePath = relativePath.replace("\\", "/");

            // 分离目录和文件名
            int lastSlash = relativePath.lastIndexOf('/');
            String dirPath = lastSlash > 0 ? relativePath.substring(0, lastSlash) : "";
            String fileName = lastSlash >= 0 ? relativePath.substring(lastSlash + 1) : relativePath;

            // 跳过隐藏文件和二进制/媒体文件
            if (fileName.startsWith(".")) {
                result.skippedFiles++;
                continue;
            }
            String lowerName = fileName.toLowerCase();
            if (isBinaryFile(lowerName)) {
                result.skippedFiles++;
                continue;
            }

            // 确保所有父目录都有对应的分类
            UUID parentId = ensureCategories(userId, dirPath, categoryPathMap);

            // 获取文件后缀（带点）
            String ext = getFileExtensionWithDot(lowerName);

            // 匹配语言
            LanguageConfig matchedLang = extToLang.get(ext);
            if (matchedLang == null) {
                result.skippedFiles++;
                continue;
            }

            // 读取文件内容
            String content;
            try {
                byte[] bytes = file.getBytes();
                // 简单检查是否为二进制文件（包含 null 字节）
                if (isBinaryContent(bytes)) {
                    result.skippedFiles++;
                    continue;
                }
                content = new String(bytes, StandardCharsets.UTF_8);
            } catch (Exception e) {
                result.skippedFiles++;
                continue;
            }

            // 文件太大跳过（超过 500KB）
            if (content.length() > 500 * 1024) {
                result.skippedFiles++;
                continue;
            }

            // 创建代码片段
            Snippet snippet = Snippet.builder()
                    .userId(userId)
                    .title(fileName)
                    .language(matchedLang.getValue())
                    .content(content)
                    .categoryId(parentId)
                    .tags(List.of())
                    .favorite(false)
                    .sortOrder(snippetSortOrder++)
                    .build();

            snippetRepository.save(snippet);
            result.importedSnippets++;
        }

        result.createdCategories = (int) categoryPathMap.entrySet().stream()
                .filter(e -> !e.getKey().isEmpty())
                .count();

        return result;
    }

    /**
     * 确保路径上的所有目录都有对应的分类，返回最内层目录的分类 ID
     */
    private UUID ensureCategories(UUID userId, String dirPath, Map<String, UUID> categoryPathMap) {
        if (dirPath.isEmpty()) {
            return categoryPathMap.getOrDefault("", null);
        }

        if (categoryPathMap.containsKey(dirPath)) {
            return categoryPathMap.get(dirPath);
        }

        // 先确保父目录存在
        int lastSlash = dirPath.lastIndexOf('/');
        String parentPath = lastSlash > 0 ? dirPath.substring(0, lastSlash) : "";
        UUID parentId = ensureCategories(userId, parentPath, categoryPathMap);

        // 当前目录名
        String dirName = lastSlash >= 0 ? dirPath.substring(lastSlash + 1) : dirPath;

        // 跳过空目录名
        if (dirName.isBlank()) {
            return parentId;
        }

        // 检查是否已存在同名分类（同层级）
        List<Category> siblings = categoryRepository.findByUserIdAndParentIdOrderBySortOrderAsc(userId, parentId);
        Optional<Category> existing = siblings.stream()
                .filter(c -> c.getName().equals(dirName))
                .findFirst();

        UUID categoryId;
        if (existing.isPresent()) {
            categoryId = existing.get().getId();
        } else {
            int sortOrder = siblings.size();
            Category category = Category.builder()
                    .userId(userId)
                    .name(dirName)
                    .parentId(parentId)
                    .sortOrder(sortOrder)
                    .build();
            category = categoryRepository.save(category);
            categoryId = category.getId();
        }

        categoryPathMap.put(dirPath, categoryId);
        return categoryId;
    }

    private boolean isBinaryFile(String fileName) {
        String[] binaryExts = {
            ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp", ".bmp",
            ".woff", ".woff2", ".ttf", ".eot", ".otf",
            ".mp3", ".mp4", ".wav", ".ogg", ".webm", ".avi", ".mov",
            ".zip", ".tar", ".gz", ".rar", ".7z", ".bz2", ".xz",
            ".jar", ".war", ".ear", ".class",
            ".exe", ".dll", ".so", ".dylib",
            ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
            ".psd", ".ai", ".sketch", ".fig",
            ".db", ".sqlite", ".sqlite3",
            ".lock"
        };
        for (String ext : binaryExts) {
            if (fileName.endsWith(ext)) return true;
        }
        return false;
    }

    private boolean isBinaryContent(byte[] bytes) {
        if (bytes.length == 0) return false;
        int checkLen = Math.min(bytes.length, 8192);
        for (int i = 0; i < checkLen; i++) {
            if (bytes[i] == 0) return true; // null byte indicates binary
        }
        return false;
    }

    private String getFileExtensionWithDot(String fileName) {
        int dotIdx = fileName.lastIndexOf('.');
        if (dotIdx < 0 || dotIdx == fileName.length() - 1) {
            return "";
        }
        return fileName.substring(dotIdx);
    }

    private static class FileWithPath {
        MultipartFile file;
        String path;

        FileWithPath(MultipartFile file, String path) {
            this.file = file;
            this.path = path;
        }
    }

    public static class ImportResult {
        private int importedSnippets;
        private int createdCategories;
        private int skippedFiles;

        public int getImportedSnippets() { return importedSnippets; }
        public void setImportedSnippets(int v) { importedSnippets = v; }
        public int getCreatedCategories() { return createdCategories; }
        public void setCreatedCategories(int v) { createdCategories = v; }
        public int getSkippedFiles() { return skippedFiles; }
        public void setSkippedFiles(int v) { skippedFiles = v; }
    }
}
