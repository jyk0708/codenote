package com.codenote.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class AnnotationRequest {
    @NotBlank
    private String title;

    @NotBlank
    private String contentMarkdown;

    @NotNull
    private Integer startOffset;

    @NotNull
    private Integer endOffset;

    private String color;
}
