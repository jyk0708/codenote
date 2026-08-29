package com.codenote.controller;

import com.codenote.dto.CategoryRequest;
import com.codenote.entity.Category;
import com.codenote.service.CategoryService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/categories")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    public ResponseEntity<List<Category>> getAllCategories(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(categoryService.getAllCategories(userId));
    }

    @PostMapping
    public ResponseEntity<Category> createCategory(@AuthenticationPrincipal UUID userId,
                                                   @Valid @RequestBody CategoryRequest request) {
        return ResponseEntity.ok(categoryService.createCategory(userId, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Category> updateCategory(@AuthenticationPrincipal UUID userId,
                                                   @PathVariable UUID id,
                                                   @RequestBody CategoryRequest request) {
        return ResponseEntity.ok(categoryService.updateCategory(userId, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCategory(@AuthenticationPrincipal UUID userId,
                                               @PathVariable UUID id) {
        categoryService.deleteCategory(userId, id);
        return ResponseEntity.noContent().build();
    }
}
