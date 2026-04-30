package com.collab.editor.service;

import com.collab.editor.model.*;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CollaborationService {

    private final DocumentService documentService;
    private final UserService userService;
    
    private final Map<String, Set<String>> documentUsers = new ConcurrentHashMap<>();
    private final Map<String, String> userDocuments = new ConcurrentHashMap<>();
    private final Map<String, CollaboratorState> collaboratorStates = new ConcurrentHashMap<>();
    private final Map<String, Map<Integer, String>> activeSelections = new ConcurrentHashMap<>();

    public CollaborationService(DocumentService documentService, UserService userService) {
        this.documentService = documentService;
        this.userService = userService;
    }

    public void userJoinDocument(String userId, String documentId) {
        if (!documentService.canAccessDocument(documentId, userId)) {
            throw new IllegalArgumentException("Access denied");
        }
        
        documentUsers.computeIfAbsent(documentId, k -> ConcurrentHashMap.newKeySet()).add(userId);
        userDocuments.put(userId, documentId);
        
        Optional<User> userOpt = userService.findById(userId);
        userOpt.ifPresent(user -> {
            CollaboratorState state = new CollaboratorState();
            state.setUserId(user.getId());
            state.setUsername(user.getUsername());
            state.setColor(user.getColor());
            state.setOnline(true);
            collaboratorStates.put(userId, state);
        });
        
        activeSelections.computeIfAbsent(documentId, k -> new ConcurrentHashMap<>());
    }

    public void userLeaveDocument(String userId) {
        String documentId = userDocuments.remove(userId);
        if (documentId != null) {
            Set<String> users = documentUsers.get(documentId);
            if (users != null) {
                users.remove(userId);
                if (users.isEmpty()) {
                    documentUsers.remove(documentId);
                    activeSelections.remove(documentId);
                }
            }
        }
        collaboratorStates.remove(userId);
    }

    public Set<String> getUsersInDocument(String documentId) {
        return documentUsers.getOrDefault(documentId, Collections.emptySet());
    }

    public List<CollaboratorState> getCollaboratorStates(String documentId) {
        Set<String> userIds = getUsersInDocument(documentId);
        List<CollaboratorState> states = new ArrayList<>();
        for (String userId : userIds) {
            CollaboratorState state = collaboratorStates.get(userId);
            if (state != null) {
                states.add(state);
            }
        }
        return states;
    }

    public void updateCursorPosition(String userId, CursorPosition position) {
        CollaboratorState state = collaboratorStates.get(userId);
        if (state != null) {
            state.setCursor(position);
        }
    }

    public void updateSelection(String userId, Selection selection) {
        CollaboratorState state = collaboratorStates.get(userId);
        if (state != null) {
            state.setSelection(selection);
        }
    }

    public Optional<CollaboratorState> getCollaboratorState(String userId) {
        return Optional.ofNullable(collaboratorStates.get(userId));
    }

    public void checkAndMarkConflict(String documentId, int startLine, int startColumn, int endLine, int endColumn, String currentUserId) {
        Map<Integer, String> selections = activeSelections.get(documentId);
        if (selections == null) {
            return;
        }
        
        for (Map.Entry<Integer, String> entry : selections.entrySet()) {
            int line = entry.getKey();
            String userId = entry.getValue();
            
            if (!userId.equals(currentUserId)) {
                if (line >= startLine && line <= endLine) {
                    throw new IllegalArgumentException("Another user is editing this area. Please wait or select a different location.");
                }
            }
        }
    }

    public void markSelectionActive(String documentId, int line, String userId) {
        Map<Integer, String> selections = activeSelections.computeIfAbsent(documentId, k -> new ConcurrentHashMap<>());
        selections.put(line, userId);
    }

    public void clearSelection(String documentId, int line) {
        Map<Integer, String> selections = activeSelections.get(documentId);
        if (selections != null) {
            selections.remove(line);
        }
    }

    public String getUserCurrentDocument(String userId) {
        return userDocuments.get(userId);
    }
}
