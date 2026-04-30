package com.smartsocket.service;

import com.smartsocket.model.Document;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class DocumentService {
    
    private final Map<String, Document> documents = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Integer>> documentVersions = new ConcurrentHashMap<>();
    private final Map<String, Map<String, AtomicInteger>> userCursorPositions = new ConcurrentHashMap<>();
    
    public Document createDocument(String name, String owner) {
        String id = UUID.randomUUID().toString();
        Document doc = new Document(id, name, owner);
        doc.setContent("// Welcome to Collaborative Editor!\n// Start writing JavaScript code...\n\nconsole.log('Hello, World!');\n");
        documents.put(id, doc);
        documentVersions.put(id, new ConcurrentHashMap<>());
        userCursorPositions.put(id, new ConcurrentHashMap<>());
        return doc;
    }
    
    public Document getDocument(String id) {
        return documents.get(id);
    }
    
    public List<Document> getDocumentsOwnedBy(String username) {
        List<Document> result = new ArrayList<>();
        for (Document doc : documents.values()) {
            if (doc.getOwner().equals(username)) {
                result.add(doc);
            }
        }
        return result;
    }
    
    public List<Document> getDocumentsInvitedTo(String username) {
        List<Document> result = new ArrayList<>();
        for (Document doc : documents.values()) {
            if (doc.getInvitedUsers().contains(username)) {
                result.add(doc);
            }
        }
        return result;
    }
    
    public List<Document> getAccessibleDocuments(String username) {
        List<Document> result = new ArrayList<>();
        for (Document doc : documents.values()) {
            if (doc.getOwner().equals(username) || doc.getInvitedUsers().contains(username)) {
                result.add(doc);
            }
        }
        return result;
    }
    
    public boolean inviteUser(String documentId, String username, String inviter) {
        Document doc = documents.get(documentId);
        if (doc == null) return false;
        if (!doc.getOwner().equals(inviter)) return false;
        if (doc.getInvitedUsers().contains(username)) return false;
        
        doc.getInvitedUsers().add(username);
        return true;
    }
    
    public boolean hasAccess(String documentId, String username) {
        Document doc = documents.get(documentId);
        if (doc == null) return false;
        return doc.getOwner().equals(username) || doc.getInvitedUsers().contains(username);
    }
    
    public void joinDocument(String documentId, String username) {
        Document doc = documents.get(documentId);
        if (doc != null) {
            doc.getActiveEditors().add(username);
        }
    }
    
    public void leaveDocument(String documentId, String username) {
        Document doc = documents.get(documentId);
        if (doc != null) {
            doc.getActiveEditors().remove(username);
        }
    }
    
    public Set<String> getActiveEditors(String documentId) {
        Document doc = documents.get(documentId);
        return doc != null ? doc.getActiveEditors() : Collections.emptySet();
    }
    
    public int getVersion(String documentId, String username) {
        Map<String, Integer> versions = documentVersions.get(documentId);
        if (versions == null) return 0;
        return versions.getOrDefault(username, 0);
    }
    
    public int incrementVersion(String documentId, String username) {
        Map<String, Integer> versions = documentVersions.computeIfAbsent(documentId, k -> new ConcurrentHashMap<>());
        int newVersion = versions.getOrDefault(username, 0) + 1;
        versions.put(username, newVersion);
        return newVersion;
    }
    
    public void updateCursor(String documentId, String username, int position) {
        Map<String, AtomicInteger> cursors = userCursorPositions.computeIfAbsent(documentId, k -> new ConcurrentHashMap<>());
        cursors.computeIfAbsent(username, k -> new AtomicInteger(0)).set(position);
    }
    
    public int getCursor(String documentId, String username) {
        Map<String, AtomicInteger> cursors = userCursorPositions.get(documentId);
        if (cursors == null) return 0;
        AtomicInteger pos = cursors.get(username);
        return pos != null ? pos.get() : 0;
    }
    
    public Map<String, Integer> getAllCursors(String documentId) {
        Map<String, AtomicInteger> cursors = userCursorPositions.get(documentId);
        if (cursors == null) return Collections.emptyMap();
        
        Map<String, Integer> result = new HashMap<>();
        for (Map.Entry<String, AtomicInteger> entry : cursors.entrySet()) {
            result.put(entry.getKey(), entry.getValue().get());
        }
        return result;
    }
    
    public boolean checkConflict(String documentId, String username, int from, int to) {
        Document doc = documents.get(documentId);
        if (doc == null) return false;
        
        for (String editor : doc.getActiveEditors()) {
            if (editor.equals(username)) continue;
            
            int cursorPos = getCursor(documentId, editor);
            if (cursorPos >= from && cursorPos <= to) {
                return true;
            }
        }
        return false;
    }
}
