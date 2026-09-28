package com.codenote.dto;

import lombok.Data;

@Data
public class UserConfigRequest {
    private String ttsEndpoint;
    private Integer ttsTimeout;
}
