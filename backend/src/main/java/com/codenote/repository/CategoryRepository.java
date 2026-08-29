package com.codenote.repository;

import com.codenote.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CategoryRepository extends JpaRepository<Category, UUID> {
    List<Category> findByUserIdAndParentIdOrderBySortOrderAsc(UUID userId, UUID parentId);
    List<Category> findByUserIdOrderBySortOrderAsc(UUID userId);
    List<Category> findByParentId(UUID parentId);
    void deleteByUserIdAndId(UUID userId, UUID id);
}
