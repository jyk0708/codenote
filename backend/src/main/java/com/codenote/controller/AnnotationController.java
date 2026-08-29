package com.codenote.controller;

import com.codenote.dto.AnnotationRequest;
import com.codenote.entity.Annotation;
import com.codenote.service.AnnotationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/snippets/{snippetId}/annotations")
public class AnnotationController {

    private final AnnotationService annotationService;

    public AnnotationController(AnnotationService annotationService) {
        this.annotationService = annotationService;
    }

    @GetMapping
    public ResponseEntity<List<Annotation>> getAnnotations(@AuthenticationPrincipal UUID userId,
                                                           @PathVariable UUID snippetId) {
        return ResponseEntity.ok(annotationService.getAnnotationsBySnippet(userId, snippetId));
    }

    @PostMapping
    public ResponseEntity<Annotation> createAnnotation(@AuthenticationPrincipal UUID userId,
                                                        @PathVariable UUID snippetId,
                                                        @Valid @RequestBody AnnotationRequest request) {
        return ResponseEntity.ok(annotationService.createAnnotation(userId, snippetId, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Annotation> updateAnnotation(@AuthenticationPrincipal UUID userId,
                                                        @PathVariable UUID snippetId,
                                                        @PathVariable UUID id,
                                                        @RequestBody AnnotationRequest request) {
        return ResponseEntity.ok(annotationService.updateAnnotation(userId, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAnnotation(@AuthenticationPrincipal UUID userId,
                                                  @PathVariable UUID snippetId,
                                                  @PathVariable UUID id) {
        annotationService.deleteAnnotation(userId, id);
        return ResponseEntity.noContent().build();
    }
}
