package com.codenote.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class SnippetRequest {
    @NotBlank
    private String title;

    @NotBlank
    private String language;

    @NotBlank
    private String content;

    private String description;

    private List<String> tags;

    private UUID categoryId;
}
