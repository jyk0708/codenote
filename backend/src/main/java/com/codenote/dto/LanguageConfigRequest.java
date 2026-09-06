package com.codenote.dto;

import lombok.Data;

@Data
public class LanguageConfigRequest {
    private String name;
    private String value;
    private String mode;
    private String extensions;
    private Integer sortOrder;
}
