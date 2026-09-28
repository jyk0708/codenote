package com.codenote.controller;

import com.codenote.dto.UserConfigRequest;
import com.codenote.entity.UserConfig;
import com.codenote.service.UserConfigService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/config")
public class UserConfigController {

    private final UserConfigService userConfigService;

    public UserConfigController(UserConfigService userConfigService) {
        this.userConfigService = userConfigService;
    }

    @GetMapping
    public ResponseEntity<UserConfig> getConfig(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(userConfigService.getConfig(userId));
    }

    @PutMapping
    public ResponseEntity<UserConfig> updateConfig(@AuthenticationPrincipal UUID userId,
                                                    @RequestBody UserConfigRequest request) {
        return ResponseEntity.ok(userConfigService.updateConfig(
                userId,
                request.getTtsEndpoint(),
                request.getTtsTimeout()
        ));
    }
}
