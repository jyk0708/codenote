package com.codenote.service;

import com.codenote.dto.AnnotationRequest;
import com.codenote.entity.Annotation;
import com.codenote.entity.Snippet;
import com.codenote.repository.AnnotationRepository;
import com.codenote.repository.SnippetRepository;
import org.commonmark.node.Node;
import org.commonmark.parser.Parser;
import org.commonmark.renderer.html.HtmlRenderer;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class AnnotationService {

    private static final String[] COLORS = {
            "indigo", "amber", "emerald", "rose", "sky", "fuchsia", "lime", "orange"
    };

    private final AnnotationRepository annotationRepository;
    private final SnippetRepository snippetRepository;
    private final Parser markdownParser;
    private final HtmlRenderer htmlRenderer;

    public AnnotationService(AnnotationRepository annotationRepository,
                             SnippetRepository snippetRepository) {
        this.annotationRepository = annotationRepository;
        this.snippetRepository = snippetRepository;
        this.markdownParser = Parser.builder().build();
        this.htmlRenderer = HtmlRenderer.builder().build();
    }

    public List<Annotation> getAnnotationsBySnippet(UUID userId, UUID snippetId) {
        validateSnippetOwnership(userId, snippetId);
        return annotationRepository.findBySnippetIdOrderByStartOffsetAsc(snippetId);
    }

    public Annotation createAnnotation(UUID userId, UUID snippetId, AnnotationRequest request) {
        validateSnippetOwnership(userId, snippetId);

        // 确定颜色
        String color = request.getColor();
        if (color == null || color.isEmpty()) {
            long count = annotationRepository.countBySnippetId(snippetId);
            color = COLORS[(int) (count % COLORS.length)];
        }

        // 渲染 Markdown 为 HTML
        String contentHtml = renderMarkdown(request.getContentMarkdown());

        int sortOrder = annotationRepository.findBySnippetIdOrderByStartOffsetAsc(snippetId).size();

        Annotation annotation = Annotation.builder()
                .snippetId(snippetId)
                .title(request.getTitle())
                .contentMarkdown(request.getContentMarkdown())
                .contentHtml(contentHtml)
                .startOffset(request.getStartOffset())
                .endOffset(request.getEndOffset())
                .color(color)
                .sortOrder(sortOrder)
                .build();

        return annotationRepository.save(annotation);
    }

    public Annotation updateAnnotation(UUID userId, UUID id, AnnotationRequest request) {
        Annotation annotation = annotationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Annotation not found"));

        validateSnippetOwnership(userId, annotation.getSnippetId());

        if (request.getTitle() != null) annotation.setTitle(request.getTitle());
        if (request.getContentMarkdown() != null) {
            annotation.setContentMarkdown(request.getContentMarkdown());
            annotation.setContentHtml(renderMarkdown(request.getContentMarkdown()));
        }
        if (request.getStartOffset() != null) annotation.setStartOffset(request.getStartOffset());
        if (request.getEndOffset() != null) annotation.setEndOffset(request.getEndOffset());
        if (request.getColor() != null) annotation.setColor(request.getColor());

        return annotationRepository.save(annotation);
    }

    public void deleteAnnotation(UUID userId, UUID id) {
        Annotation annotation = annotationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Annotation not found"));

        validateSnippetOwnership(userId, annotation.getSnippetId());

        annotationRepository.delete(annotation);
    }

    private void validateSnippetOwnership(UUID userId, UUID snippetId) {
        Snippet snippet = snippetRepository.findById(snippetId)
                .orElseThrow(() -> new RuntimeException("Snippet not found"));
        if (!snippet.getUserId().equals(userId)) {
            throw new RuntimeException("Not authorized");
        }
    }

    private String renderMarkdown(String markdown) {
        if (markdown == null) return "";
        Node document = markdownParser.parse(markdown);
        return htmlRenderer.render(document);
    }
}
