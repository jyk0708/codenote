package com.codenote.service;

import com.codenote.dto.SnippetRequest;
import com.codenote.entity.Snippet;
import com.codenote.repository.AnnotationRepository;
import com.codenote.repository.SnippetRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class SnippetService {

    private final SnippetRepository snippetRepository;
    private final AnnotationRepository annotationRepository;

    public SnippetService(SnippetRepository snippetRepository,
                          AnnotationRepository annotationRepository) {
        this.snippetRepository = snippetRepository;
        this.annotationRepository = annotationRepository;
    }

    public List<Snippet> getSnippetsByCategory(UUID userId, UUID categoryId) {
        if (categoryId == null) {
            return snippetRepository.findByUserIdOrderByUpdatedAtDesc(userId);
        }
        return snippetRepository.findByUserIdAndCategoryIdOrderByUpdatedAtDesc(userId, categoryId);
    }

    public Snippet getSnippet(UUID userId, UUID id) {
        Snippet snippet = snippetRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Snippet not found"));

        if (!snippet.getUserId().equals(userId)) {
            throw new RuntimeException("Not authorized");
        }

        return snippet;
    }

    public Snippet createSnippet(UUID userId, SnippetRequest request) {
        Snippet snippet = Snippet.builder()
                .userId(userId)
                .title(request.getTitle())
                .language(request.getLanguage())
                .content(request.getContent())
                .description(request.getDescription())
                .tags(request.getTags() != null ? request.getTags() : List.of())
                .categoryId(request.getCategoryId())
                .build();

        return snippetRepository.save(snippet);
    }

    public Snippet updateSnippet(UUID userId, UUID id, SnippetRequest request) {
        Snippet snippet = snippetRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Snippet not found"));

        if (!snippet.getUserId().equals(userId)) {
            throw new RuntimeException("Not authorized");
        }

        if (request.getTitle() != null) snippet.setTitle(request.getTitle());
        if (request.getLanguage() != null) snippet.setLanguage(request.getLanguage());
        if (request.getContent() != null) snippet.setContent(request.getContent());
        if (request.getDescription() != null) snippet.setDescription(request.getDescription());
        if (request.getTags() != null) snippet.setTags(request.getTags());
        if (request.getCategoryId() != null) snippet.setCategoryId(request.getCategoryId());

        return snippetRepository.save(snippet);
    }

    @Transactional
    public void deleteSnippet(UUID userId, UUID id) {
        Snippet snippet = snippetRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Snippet not found"));

        if (!snippet.getUserId().equals(userId)) {
            throw new RuntimeException("Not authorized");
        }

        annotationRepository.deleteBySnippetId(id);
        snippetRepository.delete(snippet);
    }

    public List<Snippet> searchSnippets(UUID userId, String keyword) {
        return snippetRepository.searchByKeyword(userId, keyword);
    }
}
