package com.codenote.service;

import com.codenote.dto.CategoryRequest;
import com.codenote.entity.Category;
import com.codenote.repository.CategoryRepository;
import com.codenote.repository.SnippetRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final SnippetRepository snippetRepository;

    public CategoryService(CategoryRepository categoryRepository,
                           SnippetRepository snippetRepository) {
        this.categoryRepository = categoryRepository;
        this.snippetRepository = snippetRepository;
    }

    public List<Category> getAllCategories(UUID userId) {
        return categoryRepository.findByUserIdOrderBySortOrderAsc(userId);
    }

    public Category createCategory(UUID userId, CategoryRequest request) {
        if (request.getName() == null || request.getName().isBlank()) {
            throw new RuntimeException("Category name is required");
        }
        // 计算排序值
        int sortOrder = categoryRepository
                .findByUserIdAndParentIdOrderBySortOrderAsc(userId, request.getParentId())
                .size();

        Category category = Category.builder()
                .userId(userId)
                .name(request.getName())
                .parentId(request.getParentId())
                .sortOrder(sortOrder)
                .build();

        return categoryRepository.save(category);
    }

    public Category updateCategory(UUID userId, UUID id, CategoryRequest request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Category not found"));

        if (!category.getUserId().equals(userId)) {
            throw new RuntimeException("Not authorized");
        }

        if (request.getName() != null) {
            category.setName(request.getName());
        }
        if (request.getParentId() != null) {
            category.setParentId(request.getParentId());
        }
        if (request.getDescription() != null) {
            category.setDescription(request.getDescription());
        }
        if (request.getSortOrder() != null) {
            category.setSortOrder(request.getSortOrder());
        }

        return categoryRepository.save(category);
    }

    @Transactional
    public void deleteCategory(UUID userId, UUID id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Category not found"));

        if (!category.getUserId().equals(userId)) {
            throw new RuntimeException("Not authorized");
        }

        // 收集所有后代分类 ID
        List<UUID> idsToDelete = new ArrayList<>();
        collectDescendants(id, idsToDelete);
        idsToDelete.add(id);

        // 删除所有相关分类的片段
        for (UUID catId : idsToDelete) {
            snippetRepository.findByCategoryId(catId).forEach(snippetRepository::delete);
        }

        // 删除分类
        for (UUID catId : idsToDelete) {
            categoryRepository.deleteById(catId);
        }
    }

    private void collectDescendants(UUID parentId, List<UUID> result) {
        categoryRepository.findByParentId(parentId).forEach(child -> {
            result.add(child.getId());
            collectDescendants(child.getId(), result);
        });
    }
}
