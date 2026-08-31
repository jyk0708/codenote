package com.codenote.service;

import com.codenote.config.MinioConfig;
import com.codenote.entity.Annotation;
import com.codenote.repository.AnnotationRepository;
import io.minio.*;
import io.minio.messages.Item;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class FileStorageService {

    private final MinioClient minioClient;
    private final MinioConfig minioConfig;
    private final AnnotationRepository annotationRepository;

    private static final Pattern IMAGE_URL_PATTERN = Pattern.compile("!\\[[^\\]]*\\]\\((/api/files/[^)]+)\\)");

    public FileStorageService(MinioClient minioClient, MinioConfig minioConfig,
                              AnnotationRepository annotationRepository) {
        this.minioClient = minioClient;
        this.minioConfig = minioConfig;
        this.annotationRepository = annotationRepository;
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

    /**
     * 清理 MinIO 中未被引用的失效文件
     * 扫描所有注释中的 Markdown 图片引用，与 MinIO 中的文件对比，删除未被引用的文件
     * @return 被删除的文件数量
     */
    public int cleanupOrphanedFiles(UUID userId) throws Exception {
        String bucketName = minioConfig.getBucketName();

        // 1. 收集所有注释中引用的图片文件名
        Set<String> referencedFileNames = new HashSet<>();
        List<Annotation> annotations = annotationRepository.findAllByUserId(userId);
        for (Annotation annotation : annotations) {
            String content = annotation.getContentMarkdown();
            if (content != null) {
                Matcher matcher = IMAGE_URL_PATTERN.matcher(content);
                while (matcher.find()) {
                    String url = matcher.group(1);
                    // /api/files/xxx.png -> xxx.png
                    String fileName = url.replace("/api/files/", "");
                    referencedFileNames.add(fileName);
                }
            }
        }

        // 2. 列出 MinIO bucket 中所有文件
        List<String> allMinioFiles = new ArrayList<>();
        Iterable<Result<Item>> results = minioClient.listObjects(
            ListObjectsArgs.builder()
                .bucket(bucketName)
                .recursive(true)
                .build()
        );
        for (Result<Item> result : results) {
            Item item = result.get();
            allMinioFiles.add(item.objectName());
        }

        // 3. 找出未被引用的文件并删除
        int deletedCount = 0;
        for (String fileName : allMinioFiles) {
            if (!referencedFileNames.contains(fileName)) {
                try {
                    minioClient.removeObject(
                        RemoveObjectArgs.builder()
                            .bucket(bucketName)
                            .object(fileName)
                            .build()
                    );
                    deletedCount++;
                } catch (Exception e) {
                    // 单个文件删除失败不影响整体清理
                    System.err.println("删除文件失败: " + fileName + ", " + e.getMessage());
                }
            }
        }

        return deletedCount;
    }
}
