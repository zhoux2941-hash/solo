package com.collab.editor.websocket;

import com.collab.editor.model.*;
import com.collab.editor.service.CollaborationService;
import com.collab.editor.service.DocumentService;
import com.collab.editor.service.UserService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.List;
import java.util.Optional;

@Controller
public class CollaborationController {

    private final CollaborationService collaborationService;
    private final DocumentService documentService;
    private final UserService userService;
    private final SimpMessagingTemplate messagingTemplate;

    public CollaborationController(
        CollaborationService collaborationService,
        DocumentService documentService,
        UserService userService,
        SimpMessagingTemplate messagingTemplate
    ) {
        this.collaborationService = collaborationService;
        this.documentService = documentService;
        this.userService = userService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/document/{documentId}/join")
    @SendTo("/topic/document/{documentId}/users")
    public List<CollaboratorState> joinDocument(
        @DestinationVariable String documentId,
        @Payload JoinMessage message,
        SimpMessageHeaderAccessor headerAccessor
    ) {
        String userId = message.getUserId();
        headerAccessor.getSessionAttributes().put("userId", userId);
        headerAccessor.getSessionAttributes().put("documentId", documentId);
        
        collaborationService.userJoinDocument(userId, documentId);
        userService.setUserOnline(userId, true);
        
        WebSocketMessage notification = new WebSocketMessage();
        notification.setType("USER_JOINED");
        notification.setDocumentId(documentId);
        notification.setUserId(userId);
        notification.setUsername(message.getUsername());
        notification.setUserColor(message.getUserColor());
        
        messagingTemplate.convertAndSend("/topic/document/" + documentId + "/events", notification);
        
        return collaborationService.getCollaboratorStates(documentId);
    }

    @MessageMapping("/document/{documentId}/leave")
    @SendTo("/topic/document/{documentId}/users")
    public List<CollaboratorState> leaveDocument(
        @DestinationVariable String documentId,
        @Payload LeaveMessage message,
        SimpMessageHeaderAccessor headerAccessor
    ) {
        String userId = message.getUserId();
        
        collaborationService.userLeaveDocument(userId);
        userService.setUserOnline(userId, false);
        
        WebSocketMessage notification = new WebSocketMessage();
        notification.setType("USER_LEFT");
        notification.setDocumentId(documentId);
        notification.setUserId(userId);
        notification.setUsername(message.getUsername());
        
        messagingTemplate.convertAndSend("/topic/document/" + documentId + "/events", notification);
        
        return collaborationService.getCollaboratorStates(documentId);
    }

    @MessageMapping("/document/{documentId}/operation")
    public void handleOperation(
        @DestinationVariable String documentId,
        @Payload DocumentOperation operation,
        SimpMessageHeaderAccessor headerAccessor
    ) {
        String userId = operation.getUserId();
        
        try {
            collaborationService.checkAndMarkConflict(
                documentId,
                operation.getStartLine(),
                operation.getStartColumn(),
                operation.getEndLine(),
                operation.getEndColumn(),
                userId
            );
            
            collaborationService.markSelectionActive(documentId, operation.getStartLine(), userId);
            
            WebSocketMessage message = new WebSocketMessage();
            message.setType("OPERATION");
            message.setDocumentId(documentId);
            message.setUserId(userId);
            message.setData(operation);
            
            messagingTemplate.convertAndSend("/topic/document/" + documentId + "/operations", message);
            
            if ("insert".equals(operation.getType()) || "remove".equals(operation.getType())) {
                Optional<Document> docOpt = documentService.findById(documentId);
                docOpt.ifPresent(doc -> {
                    if (operation.getText() != null) {
                        documentService.updateDocumentContent(documentId, doc.getContent());
                    }
                });
            }
            
        } catch (IllegalArgumentException e) {
            WebSocketMessage errorMessage = new WebSocketMessage();
            errorMessage.setType("CONFLICT");
            errorMessage.setDocumentId(documentId);
            errorMessage.setUserId(userId);
            errorMessage.setData(e.getMessage());
            
            messagingTemplate.convertAndSendToUser(userId, "/queue/errors", errorMessage);
        }
    }

    @MessageMapping("/document/{documentId}/cursor")
    public void handleCursorMove(
        @DestinationVariable String documentId,
        @Payload CursorUpdateMessage message,
        SimpMessageHeaderAccessor headerAccessor
    ) {
        String userId = message.getUserId();
        collaborationService.updateCursorPosition(userId, message.getCursor());
        
        Optional<User> userOpt = userService.findById(userId);
        userOpt.ifPresent(user -> {
            WebSocketMessage cursorMessage = new WebSocketMessage();
            cursorMessage.setType("CURSOR");
            cursorMessage.setDocumentId(documentId);
            cursorMessage.setUserId(userId);
            cursorMessage.setUsername(user.getDisplayName());
            cursorMessage.setUserColor(user.getColor());
            cursorMessage.setData(message.getCursor());
            
            messagingTemplate.convertAndSend("/topic/document/" + documentId + "/cursors", cursorMessage);
        });
    }

    @MessageMapping("/document/{documentId}/selection")
    public void handleSelection(
        @DestinationVariable String documentId,
        @Payload SelectionUpdateMessage message,
        SimpMessageHeaderAccessor headerAccessor
    ) {
        String userId = message.getUserId();
        collaborationService.updateSelection(userId, message.getSelection());
        
        Optional<User> userOpt = userService.findById(userId);
        userOpt.ifPresent(user -> {
            WebSocketMessage selectionMessage = new WebSocketMessage();
            selectionMessage.setType("SELECTION");
            selectionMessage.setDocumentId(documentId);
            selectionMessage.setUserId(userId);
            selectionMessage.setUsername(user.getDisplayName());
            selectionMessage.setUserColor(user.getColor());
            selectionMessage.setData(message.getSelection());
            
            messagingTemplate.convertAndSend("/topic/document/" + documentId + "/selections", selectionMessage);
        });
    }

    @MessageMapping("/document/{documentId}/content")
    public void handleContentUpdate(
        @DestinationVariable String documentId,
        @Payload ContentUpdateMessage message,
        SimpMessageHeaderAccessor headerAccessor
    ) {
        documentService.updateDocumentContent(documentId, message.getContent());
        
        WebSocketMessage contentMessage = new WebSocketMessage();
        contentMessage.setType("CONTENT");
        contentMessage.setDocumentId(documentId);
        contentMessage.setUserId(message.getUserId());
        contentMessage.setData(message.getContent());
        
        messagingTemplate.convertAndSend("/topic/document/" + documentId + "/content", contentMessage);
    }

    public static class JoinMessage {
        private String userId;
        private String username;
        private String userColor;

        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getUserColor() { return userColor; }
        public void setUserColor(String userColor) { this.userColor = userColor; }
    }

    public static class LeaveMessage {
        private String userId;
        private String username;

        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
    }

    public static class CursorUpdateMessage {
        private String userId;
        private CursorPosition cursor;

        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        public CursorPosition getCursor() { return cursor; }
        public void setCursor(CursorPosition cursor) { this.cursor = cursor; }
    }

    public static class SelectionUpdateMessage {
        private String userId;
        private Selection selection;

        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        public Selection getSelection() { return selection; }
        public void setSelection(Selection selection) { this.selection = selection; }
    }

    public static class ContentUpdateMessage {
        private String userId;
        private String content;

        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
    }
}
