package com.collab.editor.service;

import com.collab.editor.model.Document;
import com.collab.editor.model.User;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class DocumentService {

    private final Map<String, Document> documents = new ConcurrentHashMap<>();
    private final UserService userService;

    public DocumentService(UserService userService) {
        this.userService = userService;
    }

    public Document createDocument(String title, String ownerId, String language) {
        Document document = new Document();
        document.setId(UUID.randomUUID().toString());
        document.setTitle(title);
        document.setContent("");
        document.setOwnerId(ownerId);
        document.setLanguage(language != null ? language : "javascript");
        document.setCreatedAt(LocalDateTime.now());
        document.setUpdatedAt(LocalDateTime.now());
        
        Set<String> collaborators = new HashSet<>();
        collaborators.add(ownerId);
        document.setCollaboratorIds(collaborators);
        document.setInvitedUserIds(new HashSet<>());
        
        documents.put(document.getId(), document);
        userService.addDocumentToUser(ownerId, document.getId());
        
        return document;
    }

    public Optional<Document> findById(String id) {
        return Optional.ofNullable(documents.get(id));
    }

    public List<Document> getDocumentsForUser(String userId) {
        List<Document> result = new ArrayList<>();
        for (Document doc : documents.values()) {
            if (doc.getOwnerId().equals(userId) 
                || doc.getCollaboratorIds().contains(userId)
                || doc.getInvitedUserIds().contains(userId)) {
                result.add(doc);
            }
        }
        result.sort((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()));
        return result;
    }

    public void inviteUserToDocument(String documentId, String inviterId, String inviteeId) {
        Document document = documents.get(documentId);
        if (document == null) {
            throw new IllegalArgumentException("Document not found");
        }
        
        if (!document.getOwnerId().equals(inviterId) && !document.getCollaboratorIds().contains(inviterId)) {
            throw new IllegalArgumentException("You don't have permission to invite users");
        }
        
        Optional<User> invitee = userService.findById(inviteeId);
        if (!invitee.isPresent()) {
            throw new IllegalArgumentException("User not found");
        }
        
        if (document.getOwnerId().equals(inviteeId) 
            || document.getCollaboratorIds().contains(inviteeId)
            || document.getInvitedUserIds().contains(inviteeId)) {
            throw new IllegalArgumentException("User is already a collaborator or invited");
        }
        
        document.getInvitedUserIds().add(inviteeId);
        document.setUpdatedAt(LocalDateTime.now());
    }

    public void acceptInvitation(String documentId, String userId) {
        Document document = documents.get(documentId);
        if (document == null) {
            throw new IllegalArgumentException("Document not found");
        }
        
        if (!document.getInvitedUserIds().contains(userId)) {
            throw new IllegalArgumentException("You are not invited to this document");
        }
        
        document.getInvitedUserIds().remove(userId);
        document.getCollaboratorIds().add(userId);
        userService.addDocumentToUser(userId, documentId);
        document.setUpdatedAt(LocalDateTime.now());
    }

    public void declineInvitation(String documentId, String userId) {
        Document document = documents.get(documentId);
        if (document == null) {
            throw new IllegalArgumentException("Document not found");
        }
        
        if (!document.getInvitedUserIds().contains(userId)) {
            throw new IllegalArgumentException("You are not invited to this document");
        }
        
        document.getInvitedUserIds().remove(userId);
    }

    public void updateDocumentContent(String documentId, String content) {
        Document document = documents.get(documentId);
        if (document == null) {
            throw new IllegalArgumentException("Document not found");
        }
        document.setContent(content);
        document.setUpdatedAt(LocalDateTime.now());
    }

    public boolean canAccessDocument(String documentId, String userId) {
        Document document = documents.get(documentId);
        if (document == null) {
            return false;
        }
        return document.getOwnerId().equals(userId)
            || document.getCollaboratorIds().contains(userId)
            || document.getInvitedUserIds().contains(userId);
    }

    public List<User> getDocumentCollaborators(String documentId) {
        Document document = documents.get(documentId);
        if (document == null) {
            return Collections.emptyList();
        }
        
        Set<String> allUserIds = new HashSet<>();
        allUserIds.add(document.getOwnerId());
        allUserIds.addAll(document.getCollaboratorIds());
        
        return userService.getUsersByIds(allUserIds);
    }
}
