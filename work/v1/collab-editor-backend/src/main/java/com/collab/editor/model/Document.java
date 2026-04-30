package com.collab.editor.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Document {
    private String id;
    private String title;
    private String content;
    private String ownerId;
    private Set<String> collaboratorIds = new HashSet<>();
    private Set<String> invitedUserIds = new HashSet<>();
    private String language;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
