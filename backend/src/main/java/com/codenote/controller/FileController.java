package com.codenote.controller;

import com.codenote.service.FileStorageService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/files")
public class FileController {

    private final FileStorageService fileStorageService;

    public FileController(FileStorageService fileStorageService) {
        this.fileStorageService = fileStorageService;
    }

    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadFile(
            @RequestParam("file") MultipartFile file) {
        try {
            String url = fileStorageService.uploadFile(file);
            Map<String, String> response = new HashMap<>();
            response.put("url", url);
            response.put("name", file.getOriginalFilename());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "上传失败: " + e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/{fileName}")
    public ResponseEntity<byte[]> getFile(@PathVariable String fileName) {
        try {
            InputStream inputStream = fileStorageService.getFile(fileName);
            byte[] content = inputStream.readAllBytes();
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.IMAGE_PNG); // 默认 PNG，可根据实际调整
            
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(content);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/cleanup")
    public ResponseEntity<Map<String, Object>> cleanupOrphanedFiles(
            @AuthenticationPrincipal UUID userId) {
        try {
            int deletedCount = fileStorageService.cleanupOrphanedFiles(userId);
            Map<String, Object> response = new HashMap<>();
            response.put("deletedCount", deletedCount);
            response.put("message", "清理完成，删除了 " + deletedCount + " 个失效文件");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "清理失败: " + e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
