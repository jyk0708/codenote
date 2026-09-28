package com.codenote.service;

import com.codenote.entity.UserConfig;
import com.codenote.repository.UserConfigRepository;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class UserConfigService {

    private final UserConfigRepository userConfigRepository;

    public UserConfigService(UserConfigRepository userConfigRepository) {
        this.userConfigRepository = userConfigRepository;
    }

    public UserConfig getConfig(UUID userId) {
        return userConfigRepository.findByUserId(userId)
                .orElseGet(() -> UserConfig.builder()
                        .userId(userId)
                        .ttsTimeout(30000)
                        .build());
    }

    public UserConfig updateConfig(UUID userId, String ttsEndpoint, Integer ttsTimeout) {
        UserConfig config = userConfigRepository.findByUserId(userId)
                .orElseGet(() -> UserConfig.builder()
                        .userId(userId)
                        .ttsTimeout(30000)
                        .build());

        if (ttsEndpoint != null) {
            config.setTtsEndpoint(ttsEndpoint);
        }
        if (ttsTimeout != null) {
            config.setTtsTimeout(ttsTimeout);
        }

        return userConfigRepository.save(config);
    }
}
