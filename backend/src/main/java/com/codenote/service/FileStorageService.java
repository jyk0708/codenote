package com.codenote.service;

import com.codenote.config.MinioConfig;
import io.minio.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.UUID;

@Service
public class FileStorageService {

    private final MinioClient minioClient;
    private final MinioConfig minioConfig;

    public FileStorageService(MinioClient minioClient, MinioConfig minioConfig) {
        this.minioClient = minioClient;
        this.minioConfig = minioConfig;
    }

    public String uploadFile(MultipartFile file) throws Exception {
        String bucketName = minioConfig.getBucketName();
        
        // 确保 bucket 存在
        boolean bucketExists = minioClient.bucketExists(
            BucketExistsArgs.builder().bucket(bucketName).build()
        );
        if (!bucketExists) {
            minioClient.makeBucket(
                MakeBucketArgs.builder().bucket(bucketName).build()
            );
        }

        // 生成唯一文件名
        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        String fileName = UUID.randomUUID().toString() + extension;

        // 上传文件
        InputStream inputStream = file.getInputStream();
        minioClient.putObject(
            PutObjectArgs.builder()
                .bucket(bucketName)
                .object(fileName)
                .stream(inputStream, file.getSize(), -1)
                .contentType(file.getContentType())
                .build()
        );

        // 返回文件访问 URL
        return "/api/files/" + fileName;
    }

    public InputStream getFile(String fileName) throws Exception {
        return minioClient.getObject(
            GetObjectArgs.builder()
                .bucket(minioConfig.getBucketName())
                .object(fileName)
                .build()
        );
    }
}
