package com.codenote.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "annotations", indexes = {
    @Index(name = "idx_annotation_snippet", columnList = "snippetId"),
    @Index(name = "idx_annotation_offset", columnList = "snippetId, startOffset")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Annotation {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private UUID snippetId;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String contentMarkdown;

    @Column(columnDefinition = "TEXT")
    private String contentHtml;

    @Column(nullable = false)
    private Integer startOffset;

    @Column(nullable = false)
    private Integer endOffset;

    @Column(nullable = false)
    private String color;

    @Builder.Default
    private Integer sortOrder = 0;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
