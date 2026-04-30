package com.smartsocket.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartsocket.model.*;
import com.smartsocket.service.DocumentService;
import com.smartsocket.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class EditorWebSocketHandler extends TextWebSocketHandler {
    
    private static final Logger logger = LoggerFactory.getLogger(EditorWebSocketHandler.class);
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final Map<String, String> sessionToUser = new ConcurrentHashMap<>();
    private final Map<String, String> sessionToDocument = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> documentToSessions = new ConcurrentHashMap<>();
    
    private final UserService userService;
    private final DocumentService documentService;
    
    public EditorWebSocketHandler(UserService userService, DocumentService documentService) {
        this.userService = userService;
        this.documentService = documentService;
    }
    
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String sessionId = session.getId();
        sessions.put(sessionId, session);
        logger.info("WebSocket connection established: {}", sessionId);
    }
    
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = session.getId();
        String username = sessionToUser.remove(sessionId);
        String documentId = sessionToDocument.remove(sessionId);
        
        if (documentId != null && username != null) {
            documentService.leaveDocument(documentId, username);
            Set<String> docSessions = documentToSessions.get(documentId);
            if (docSessions != null) {
                docSessions.remove(sessionId);
            }
            
            LeaveMessage leaveMsg = new LeaveMessage(documentId, username);
            broadcastToDocument(documentId, leaveMsg, sessionId);
            sendUserListUpdate(documentId);
        }
        
        sessions.remove(sessionId);
        logger.info("WebSocket connection closed: {} (user: {})", sessionId, username);
    }
    
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String sessionId = session.getId();
        try {
            JsonNode jsonNode = objectMapper.readTree(message.getPayload());
            String type = jsonNode.get("type").asText();
            
            switch (type) {
                case "join":
                    handleJoin(session, jsonNode);
                    break;
                case "cursor":
                    handleCursor(session, jsonNode);
                    break;
                case "selection":
                    handleSelection(session, jsonNode);
                    break;
                case "edit":
                    handleEdit(session, jsonNode);
                    break;
                default:
                    logger.warn("Unknown message type: {}", type);
            }
        } catch (Exception e) {
            logger.error("Error handling WebSocket message", e);
        }
    }
    
    private void handleJoin(WebSocketSession session, JsonNode jsonNode) throws IOException {
        String sessionId = session.getId();
        String username = jsonNode.get("username").asText();
        String documentId = jsonNode.get("documentId").asText();
        
        if (!documentService.hasAccess(documentId, username)) {
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(
                Map.of("type", "error", "message", "Access denied to document")
            )));
            return;
        }
        
        sessionToUser.put(sessionId, username);
        sessionToDocument.put(sessionId, documentId);
        documentToSessions.computeIfAbsent(documentId, k -> ConcurrentHashMap.newKeySet()).add(sessionId);
        documentService.joinDocument(documentId, username);
        
        User user = userService.getUserByUsername(username);
        Document doc = documentService.getDocument(documentId);
        
        JoinMessage joinMsg = new JoinMessage(
            documentId, username,
            user.getColor(), user.getNickname(),
            doc.getContent(), documentService.getVersion(documentId, username)
        );
        
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(joinMsg)));
        
        broadcastToDocument(documentId, joinMsg, sessionId);
        sendUserListUpdate(documentId);
        
        logger.info("User {} joined document {}", username, documentId);
    }
    
    private void handleCursor(WebSocketSession session, JsonNode jsonNode) throws IOException {
        String sessionId = session.getId();
        String username = sessionToUser.get(sessionId);
        String documentId = sessionToDocument.get(sessionId);
        
        if (username == null || documentId == null) return;
        
        int position = jsonNode.get("position").asInt();
        documentService.updateCursor(documentId, username, position);
        
        User user = userService.getUserByUsername(username);
        Map<String, Object> cursorMsg = new HashMap<>();
        cursorMsg.put("type", "cursor");
        cursorMsg.put("documentId", documentId);
        cursorMsg.put("username", username);
        cursorMsg.put("nickname", user.getNickname());
        cursorMsg.put("color", user.getColor());
        cursorMsg.put("position", position);
        
        broadcastToDocument(documentId, cursorMsg, sessionId);
    }
    
    private void handleSelection(WebSocketSession session, JsonNode jsonNode) throws IOException {
        String sessionId = session.getId();
        String username = sessionToUser.get(sessionId);
        String documentId = sessionToDocument.get(sessionId);
        
        if (username == null || documentId == null) return;
        
        int from = jsonNode.get("from").asInt();
        int to = jsonNode.get("to").asInt();
        
        boolean hasConflict = documentService.checkConflict(documentId, username, 
            Math.min(from, to), Math.max(from, to));
        
        if (hasConflict) {
            for (String editor : documentService.getActiveEditors(documentId)) {
                if (editor.equals(username)) continue;
                
                int cursorPos = documentService.getCursor(documentId, editor);
                if (cursorPos >= Math.min(from, to) && cursorPos <= Math.max(from, to)) {
                    User conflictUser = userService.getUserByUsername(editor);
                    ConflictWarning warning = new ConflictWarning(
                        documentId, username,
                        editor, conflictUser.getNickname(),
                        Math.min(from, to), Math.max(from, to),
                        conflictUser.getNickname() + " is editing this area"
                    );
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(warning)));
                    break;
                }
            }
        }
        
        User user = userService.getUserByUsername(username);
        Map<String, Object> selectionMsg = new HashMap<>();
        selectionMsg.put("type", "selection");
        selectionMsg.put("documentId", documentId);
        selectionMsg.put("username", username);
        selectionMsg.put("nickname", user.getNickname());
        selectionMsg.put("color", user.getColor());
        selectionMsg.put("from", from);
        selectionMsg.put("to", to);
        
        broadcastToDocument(documentId, selectionMsg, sessionId);
    }
    
    private void handleEdit(WebSocketSession session, JsonNode jsonNode) throws IOException {
        String sessionId = session.getId();
        String username = sessionToUser.get(sessionId);
        String documentId = sessionToDocument.get(sessionId);
        
        if (username == null || documentId == null) return;
        
        int from = jsonNode.get("from").asInt();
        int to = jsonNode.get("to").asInt();
        String text = jsonNode.has("text") ? jsonNode.get("text").asText() : "";
        int receivedVersion = jsonNode.get("version").asInt();
        
        int currentVersion = documentService.getVersion(documentId, username);
        if (receivedVersion != currentVersion) {
            Document doc = documentService.getDocument(documentId);
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(
                Map.of(
                    "type", "syncError",
                    "currentContent", doc.getContent(),
                    "correctVersion", documentService.incrementVersion(documentId, username)
                )
            )));
            return;
        }
        
        Document doc = documentService.getDocument(documentId);
        StringBuilder sb = new StringBuilder(doc.getContent());
        if (from != to) {
            sb.delete(from, to);
        }
        if (!text.isEmpty()) {
            sb.insert(from, text);
        }
        doc.setContent(sb.toString());
        
        int newVersion = documentService.incrementVersion(documentId, username);
        
        User user = userService.getUserByUsername(username);
        Map<String, Object> editMsg = new HashMap<>();
        editMsg.put("type", "edit");
        editMsg.put("documentId", documentId);
        editMsg.put("username", username);
        editMsg.put("nickname", user.getNickname());
        editMsg.put("color", user.getColor());
        editMsg.put("from", from);
        editMsg.put("to", to);
        editMsg.put("text", text);
        editMsg.put("version", newVersion);
        
        broadcastToDocument(documentId, editMsg, sessionId);
        
        logger.debug("Edit by {}: from={}, to={}, text={}", username, from, to, 
            text.length() > 50 ? text.substring(0, 50) + "..." : text);
    }
    
    private void sendUserListUpdate(String documentId) {
        Set<String> activeEditors = documentService.getActiveEditors(documentId);
        List<Map<String, String>> userList = new ArrayList<>();
        
        for (String username : activeEditors) {
            User user = userService.getUserByUsername(username);
            if (user != null) {
                Map<String, String> userInfo = new HashMap<>();
                userInfo.put("username", username);
                userInfo.put("nickname", user.getNickname());
                userInfo.put("color", user.getColor());
                userList.add(userInfo);
            }
        }
        
        UserListMessage userListMsg = new UserListMessage(documentId, userList);
        broadcastToDocument(documentId, userListMsg, null);
    }
    
    private void broadcastToDocument(String documentId, Object message, String excludeSessionId) {
        try {
            String json = objectMapper.writeValueAsString(message);
            TextMessage textMessage = new TextMessage(json);
            
            Set<String> docSessions = documentToSessions.get(documentId);
            if (docSessions != null) {
                for (String sessionId : docSessions) {
                    if (excludeSessionId != null && sessionId.equals(excludeSessionId)) continue;
                    
                    WebSocketSession session = sessions.get(sessionId);
                    if (session != null && session.isOpen()) {
                        session.sendMessage(textMessage);
                    }
                }
            }
        } catch (IOException e) {
            logger.error("Error broadcasting message", e);
        }
    }
}
