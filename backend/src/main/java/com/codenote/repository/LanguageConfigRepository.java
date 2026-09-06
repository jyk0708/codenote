package com.codenote.repository;

import com.codenote.entity.LanguageConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LanguageConfigRepository extends JpaRepository<LanguageConfig, UUID> {
    List<LanguageConfig> findByUserIdOrderBySortOrderAsc(UUID userId);
}
