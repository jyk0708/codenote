package com.codenote.dto;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class SnippetRequest {
    private String title;
    private String language;
    private String content;
    private String description;
    private List<String> tags;
    private UUID categoryId;
    private Boolean favorite;
    private Integer sortOrder;
}
