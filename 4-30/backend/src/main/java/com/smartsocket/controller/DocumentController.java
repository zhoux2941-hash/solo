package com.smartsocket.controller;

import com.smartsocket.model.Document;
import com.smartsocket.service.DocumentService;
import com.smartsocket.util.JwtUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/documents")
@CrossOrigin(origins = "*")
public class DocumentController {
    
    private final DocumentService documentService;
    private final JwtUtil jwtUtil;
    
    public DocumentController(DocumentService documentService, JwtUtil jwtUtil) {
        this.documentService = documentService;
        this.jwtUtil = jwtUtil;
    }
    
    private String extractUsername(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        String token = authHeader.substring(7);
        if (!jwtUtil.validateToken(token)) {
            return null;
        }
        return jwtUtil.extractUsername(token);
    }
    
    @PostMapping
    public ResponseEntity<Map<String, Object>> createDocument(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, String> request) {
        
        String username = extractUsername(authHeader);
        if (username == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Unauthorized"));
        }
        
        String name = request.get("name");
        if (name == null || name.trim().isEmpty()) {
            name = "Untitled Document";
        }
        
        Document doc = documentService.createDocument(name.trim(), username);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("document", toDocumentMap(doc));
        
        return ResponseEntity.ok(response);
    }
    
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getDocuments(
            @RequestHeader("Authorization") String authHeader) {
        
        String username = extractUsername(authHeader);
        if (username == null) {
            return ResponseEntity.status(401).build();
        }
        
        List<Document> docs = documentService.getAccessibleDocuments(username);
        List<Map<String, Object>> result = docs.stream()
            .map(this::toDocumentMap)
            .collect(Collectors.toList());
        
        return ResponseEntity.ok(result);
    }
    
    @GetMapping("/{documentId}")
    public ResponseEntity<Map<String, Object>> getDocument(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String documentId) {
        
        String username = extractUsername(authHeader);
        if (username == null) {
            return ResponseEntity.status(401).body(Map.of("success", false));
        }
        
        Document doc = documentService.getDocument(documentId);
        if (doc == null) {
            return ResponseEntity.notFound().build();
        }
        
        if (!documentService.hasAccess(documentId, username)) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", "Access denied"));
        }
        
        return ResponseEntity.ok(toDocumentMap(doc));
    }
    
    @PostMapping("/{documentId}/invite")
    public ResponseEntity<Map<String, Object>> inviteUser(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String documentId,
            @RequestBody Map<String, String> request) {
        
        String username = extractUsername(authHeader);
        if (username == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Unauthorized"));
        }
        
        String targetUsername = request.get("username");
        if (targetUsername == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Username required"));
        }
        
        Document doc = documentService.getDocument(documentId);
        if (doc == null) {
            return ResponseEntity.notFound().build();
        }
        
        if (!doc.getOwner().equals(username)) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", "Only owner can invite users"));
        }
        
        boolean success = documentService.inviteUser(documentId, targetUsername, username);
        if (!success) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "User already invited or invalid"));
        }
        
        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "User " + targetUsername + " invited successfully"
        ));
    }
    
    @GetMapping("/{documentId}/invited")
    public ResponseEntity<Map<String, Object>> getInvitedUsers(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String documentId) {
        
        String username = extractUsername(authHeader);
        if (username == null) {
            return ResponseEntity.status(401).build();
        }
        
        Document doc = documentService.getDocument(documentId);
        if (doc == null) {
            return ResponseEntity.notFound().build();
        }
        
        if (!documentService.hasAccess(documentId, username)) {
            return ResponseEntity.status(403).build();
        }
        
        return ResponseEntity.ok(Map.of(
            "owner", doc.getOwner(),
            "invitedUsers", doc.getInvitedUsers()
        ));
    }
    
    private Map<String, Object> toDocumentMap(Document doc) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", doc.getId());
        map.put("name", doc.getName());
        map.put("owner", doc.getOwner());
        map.put("content", doc.getContent());
        map.put("invitedUsers", doc.getInvitedUsers());
        map.put("activeEditors", doc.getActiveEditors());
        return map;
    }
}
