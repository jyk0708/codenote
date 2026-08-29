package com.codenote.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RegisterRequest {
    @NotBlank
    private String email;

    @NotBlank
    private String password;

    private String nickname;
}
