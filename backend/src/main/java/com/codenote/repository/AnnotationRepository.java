package com.codenote.repository;

import com.codenote.entity.Annotation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AnnotationRepository extends JpaRepository<Annotation, UUID> {
    List<Annotation> findBySnippetIdOrderByStartOffsetAsc(UUID snippetId);
    void deleteBySnippetId(UUID snippetId);
    long countBySnippetId(UUID snippetId);

    @Query("SELECT a FROM Annotation a, Snippet s WHERE a.snippetId = s.id AND s.userId = :userId")
    List<Annotation> findAllByUserId(@Param("userId") UUID userId);
}
