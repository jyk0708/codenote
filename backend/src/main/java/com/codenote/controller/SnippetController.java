package com.codenote.controller;

import com.codenote.dto.SnippetRequest;
import com.codenote.entity.Snippet;
import com.codenote.service.SnippetService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/snippets")
public class SnippetController {

    private final SnippetService snippetService;

    public SnippetController(SnippetService snippetService) {
        this.snippetService = snippetService;
    }

    @GetMapping
    public ResponseEntity<List<Snippet>> getSnippets(
            @AuthenticationPrincipal UUID userId,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) String search) {

        if (search != null && !search.isEmpty()) {
            return ResponseEntity.ok(snippetService.searchSnippets(userId, search));
        }
        return ResponseEntity.ok(snippetService.getSnippetsByCategory(userId, categoryId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Snippet> getSnippet(@AuthenticationPrincipal UUID userId,
                                              @PathVariable UUID id) {
        return ResponseEntity.ok(snippetService.getSnippet(userId, id));
    }

    @PostMapping
    public ResponseEntity<Snippet> createSnippet(@AuthenticationPrincipal UUID userId,
                                                 @Valid @RequestBody SnippetRequest request) {
        return ResponseEntity.ok(snippetService.createSnippet(userId, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Snippet> updateSnippet(@AuthenticationPrincipal UUID userId,
                                                 @PathVariable UUID id,
                                                 @RequestBody SnippetRequest request) {
        return ResponseEntity.ok(snippetService.updateSnippet(userId, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSnippet(@AuthenticationPrincipal UUID userId,
                                               @PathVariable UUID id) {
        snippetService.deleteSnippet(userId, id);
        return ResponseEntity.noContent().build();
    }
}
