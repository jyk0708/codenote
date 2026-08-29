package com.codenote.repository;

import com.codenote.entity.Snippet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SnippetRepository extends JpaRepository<Snippet, UUID> {
    List<Snippet> findByUserIdAndCategoryIdOrderByUpdatedAtDesc(UUID userId, UUID categoryId);
    List<Snippet> findByUserIdOrderByUpdatedAtDesc(UUID userId);
    List<Snippet> findByCategoryId(UUID categoryId);

    @Query("SELECT s FROM Snippet s WHERE s.userId = :userId AND " +
           "(LOWER(s.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(s.content) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "ORDER BY s.updatedAt DESC")
    List<Snippet> searchByKeyword(@Param("userId") UUID userId, @Param("keyword") String keyword);
}
