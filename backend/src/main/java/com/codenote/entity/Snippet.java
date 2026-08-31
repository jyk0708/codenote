package com.codenote.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "snippets", indexes = {
    @Index(name = "idx_snippet_user", columnList = "userId"),
    @Index(name = "idx_snippet_category", columnList = "categoryId"),
    @Index(name = "idx_snippet_language", columnList = "language")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Snippet {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    private UUID categoryId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String language;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(columnDefinition = "TEXT")
    private String description;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @Builder.Default
    private Boolean favorite = false;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
