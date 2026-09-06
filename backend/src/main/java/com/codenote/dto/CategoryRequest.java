package com.codenote.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class CategoryRequest {
    private String name;

    private UUID parentId;

    private String description;

    private Integer sortOrder;
}
