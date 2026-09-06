package com.codenote.controller;

import com.codenote.entity.Annotation;
import com.codenote.entity.Category;
import com.codenote.entity.Snippet;
import com.codenote.repository.AnnotationRepository;
import com.codenote.repository.CategoryRepository;
import com.codenote.repository.SnippetRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/search")
public class SearchController {

    private final SnippetRepository snippetRepository;
    private final CategoryRepository categoryRepository;
    private final AnnotationRepository annotationRepository;

    public SearchController(SnippetRepository snippetRepository,
                            CategoryRepository categoryRepository,
                            AnnotationRepository annotationRepository) {
        this.snippetRepository = snippetRepository;
        this.categoryRepository = categoryRepository;
        this.annotationRepository = annotationRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> search(
            @AuthenticationPrincipal UUID userId,
            @RequestParam("q") String query,
            @RequestParam(value = "type", defaultValue = "all") String type) {

        Map<String, Object> result = new HashMap<>();
        String keyword = query.trim();

        if (keyword.isBlank()) {
            result.put("snippets", Collections.emptyList());
            result.put("annotations", Collections.emptyList());
            result.put("categories", Collections.emptyList());
            return ResponseEntity.ok(result);
        }

        String lowerKeyword = keyword.toLowerCase();

        if ("all".equals(type) || "snippet".equals(type)) {
            List<Snippet> snippets = snippetRepository.searchByKeyword(userId, lowerKeyword);
            // 限制返回数量
            result.put("snippets", snippets.stream().limit(50).collect(Collectors.toList()));
        } else {
            result.put("snippets", Collections.emptyList());
        }

        if ("all".equals(type) || "annotation".equals(type)) {
            // 搜索注释（标题和内容）
            List<Annotation> allAnnots = annotationRepository.findAllByUserId(userId);
            List<Annotation> matched = allAnnots.stream()
                    .filter(a -> (a.getTitle() != null && a.getTitle().toLowerCase().contains(lowerKeyword))
                            || (a.getContentMarkdown() != null && a.getContentMarkdown().toLowerCase().contains(lowerKeyword)))
                    .limit(50)
                    .collect(Collectors.toList());
            result.put("annotations", matched);
        } else {
            result.put("annotations", Collections.emptyList());
        }

        if ("all".equals(type) || "category".equals(type)) {
            List<Category> cats = categoryRepository.findByUserIdOrderBySortOrderAsc(userId);
            List<Category> matched = cats.stream()
                    .filter(c -> (c.getName() != null && c.getName().toLowerCase().contains(lowerKeyword))
                            || (c.getDescription() != null && c.getDescription().toLowerCase().contains(lowerKeyword)))
                    .limit(20)
                    .collect(Collectors.toList());
            result.put("categories", matched);
        } else {
            result.put("categories", Collections.emptyList());
        }

        return ResponseEntity.ok(result);
    }
}
