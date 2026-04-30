package com.smartsocket.model;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class WebSocketMessage {
    
    public static Map<String, Object> cursor(String documentId, String username, String nickname, String color, int position) {
        Map<String, Object> msg = new HashMap<>();
        msg.put("type", "cursor");
        msg.put("documentId", documentId);
        msg.put("username", username);
        msg.put("nickname", nickname);
        msg.put("color", color);
        msg.put("position", position);
        return msg;
    }
    
    public static Map<String, Object> selection(String documentId, String username, String nickname, String color, int from, int to) {
        Map<String, Object> msg = new HashMap<>();
        msg.put("type", "selection");
        msg.put("documentId", documentId);
        msg.put("username", username);
        msg.put("nickname", nickname);
        msg.put("color", color);
        msg.put("from", from);
        msg.put("to", to);
        return msg;
    }
    
    public static Map<String, Object> edit(String documentId, String username, String nickname, String color, 
                                            int from, int to, String text, int version) {
        Map<String, Object> msg = new HashMap<>();
        msg.put("type", "edit");
        msg.put("documentId", documentId);
        msg.put("username", username);
        msg.put("nickname", nickname);
        msg.put("color", color);
        msg.put("from", from);
        msg.put("to", to);
        msg.put("text", text);
        msg.put("version", version);
        return msg;
    }
    
    public static Map<String, Object> join(String documentId, String username, String userColor, 
                                             String userNickname, String initialContent, int version) {
        Map<String, Object> msg = new HashMap<>();
        msg.put("type", "join");
        msg.put("documentId", documentId);
        msg.put("username", username);
        msg.put("userColor", userColor);
        msg.put("userNickname", userNickname);
        msg.put("initialContent", initialContent);
        msg.put("version", version);
        return msg;
    }
    
    public static Map<String, Object> leave(String documentId, String username) {
        Map<String, Object> msg = new HashMap<>();
        msg.put("type", "leave");
        msg.put("documentId", documentId);
        msg.put("username", username);
        return msg;
    }
    
    public static Map<String, Object> userList(String documentId, List<Map<String, String>> users) {
        Map<String, Object> msg = new HashMap<>();
        msg.put("type", "userList");
        msg.put("documentId", documentId);
        msg.put("users", users);
        return msg;
    }
    
    public static Map<String, Object> conflict(String documentId, String username, String conflictUsername,
                                                 String conflictUserNickname, int conflictFrom, int conflictTo, String warning) {
        Map<String, Object> msg = new HashMap<>();
        msg.put("type", "conflict");
        msg.put("documentId", documentId);
        msg.put("username", username);
        msg.put("conflictUsername", conflictUsername);
        msg.put("conflictUserNickname", conflictUserNickname);
        msg.put("conflictFrom", conflictFrom);
        msg.put("conflictTo", conflictTo);
        msg.put("warning", warning);
        return msg;
    }
    
    public static Map<String, Object> error(String message) {
        Map<String, Object> msg = new HashMap<>();
        msg.put("type", "error");
        msg.put("message", message);
        return msg;
    }
    
    public static Map<String, Object> syncError(String currentContent, int correctVersion) {
        Map<String, Object> msg = new HashMap<>();
        msg.put("type", "syncError");
        msg.put("currentContent", currentContent);
        msg.put("correctVersion", correctVersion);
        return msg;
    }
}
