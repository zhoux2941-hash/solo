package com.collab.editor.controller;

import com.collab.editor.model.Document;
import com.collab.editor.model.User;
import com.collab.editor.service.DocumentService;
import com.collab.editor.service.UserService;
import jakarta.servlet.http.HttpSession;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService documentService;
    private final UserService userService;

    public DocumentController(DocumentService documentService, UserService userService) {
        this.documentService = documentService;
        this.userService = userService;
    }

    @PostMapping
    public ResponseEntity<?> createDocument(@RequestBody CreateDocumentRequest request, Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        
        Optional<User> userOpt = userService.findByUsername(principal.getName());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "User not found"));
        }
        
        User user = userOpt.get();
        Document document = documentService.createDocument(
            request.getTitle(),
            user.getId(),
            request.getLanguage()
        );
        
        return ResponseEntity.ok(buildDocumentResponse(document, user.getId()));
    }

    @GetMapping
    public ResponseEntity<?> getMyDocuments(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        
        Optional<User> userOpt = userService.findByUsername(principal.getName());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "User not found"));
        }
        
        User user = userOpt.get();
        List<Document> documents = documentService.getDocumentsForUser(user.getId());
        
        List<Map<String, Object>> response = documents.stream()
            .map(doc -> buildDocumentResponse(doc, user.getId()))
            .toList();
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{documentId}")
    public ResponseEntity<?> getDocument(@PathVariable String documentId, Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        
        Optional<User> userOpt = userService.findByUsername(principal.getName());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "User not found"));
        }
        
        User user = userOpt.get();
        
        if (!documentService.canAccessDocument(documentId, user.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied"));
        }
        
        Optional<Document> docOpt = documentService.findById(documentId);
        if (docOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Document not found"));
        }
        
        return ResponseEntity.ok(buildDocumentResponse(docOpt.get(), user.getId()));
    }

    @PostMapping("/{documentId}/invite")
    public ResponseEntity<?> inviteUser(
        @PathVariable String documentId,
        @RequestBody InviteUserRequest request,
        Principal principal
    ) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        
        Optional<User> userOpt = userService.findByUsername(principal.getName());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "User not found"));
        }
        
        try {
            documentService.inviteUserToDocument(documentId, userOpt.get().getId(), request.getUserId());
            return ResponseEntity.ok(Map.of("success", true, "message", "User invited successfully"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{documentId}/accept")
    public ResponseEntity<?> acceptInvitation(@PathVariable String documentId, Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        
        Optional<User> userOpt = userService.findByUsername(principal.getName());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "User not found"));
        }
        
        try {
            documentService.acceptInvitation(documentId, userOpt.get().getId());
            return ResponseEntity.ok(Map.of("success", true, "message", "Invitation accepted"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{documentId}/decline")
    public ResponseEntity<?> declineInvitation(@PathVariable String documentId, Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        
        Optional<User> userOpt = userService.findByUsername(principal.getName());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "User not found"));
        }
        
        try {
            documentService.declineInvitation(documentId, userOpt.get().getId());
            return ResponseEntity.ok(Map.of("success", true, "message", "Invitation declined"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{documentId}/collaborators")
    public ResponseEntity<?> getCollaborators(@PathVariable String documentId, Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        
        Optional<User> userOpt = userService.findByUsername(principal.getName());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "User not found"));
        }
        
        if (!documentService.canAccessDocument(documentId, userOpt.get().getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Access denied"));
        }
        
        List<User> collaborators = documentService.getDocumentCollaborators(documentId);
        List<Map<String, Object>> response = collaborators.stream()
            .map(u -> Map.of(
                "id", u.getId(),
                "username", u.getUsername(),
                "displayName", u.getDisplayName(),
                "color", u.getColor(),
                "online", u.isOnline()
            ))
            .toList();
        
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> buildDocumentResponse(Document document, String currentUserId) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", document.getId());
        response.put("title", document.getTitle());
        response.put("content", document.getContent());
        response.put("ownerId", document.getOwnerId());
        response.put("language", document.getLanguage());
        response.put("createdAt", document.getCreatedAt());
        response.put("updatedAt", document.getUpdatedAt());
        response.put("collaboratorIds", document.getCollaboratorIds());
        response.put("invitedUserIds", document.getInvitedUserIds());
        response.put("isOwner", document.getOwnerId().equals(currentUserId));
        response.put("isInvited", document.getInvitedUserIds().contains(currentUserId));
        response.put("isCollaborator", document.getCollaboratorIds().contains(currentUserId));
        return response;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateDocumentRequest {
        private String title;
        private String language;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InviteUserRequest {
        private String userId;
    }
}
