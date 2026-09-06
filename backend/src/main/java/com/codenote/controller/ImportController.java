package com.codenote.controller;

import com.codenote.service.ImportService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/import")
public class ImportController {

    private final ImportService importService;

    public ImportController(ImportService importService) {
        this.importService = importService;
    }

    @PostMapping("/folder")
    public ResponseEntity<ImportService.ImportResult> importFolder(
            @AuthenticationPrincipal UUID userId,
            @RequestParam(value = "parentCategoryId", required = false) UUID parentCategoryId,
            @RequestParam("files") MultipartFile[] files,
            @RequestParam("paths") String[] paths) {

        ImportService.ImportResult result = importService.importFolder(userId, parentCategoryId, files, paths);
        return ResponseEntity.ok(result);
    }
}
