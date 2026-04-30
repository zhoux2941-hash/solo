package com.smartsocket.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class JoinMessage extends WebSocketMessage {
    private String userColor;
    private String userNickname;
    private String initialContent;
    private int version;
    
    public JoinMessage(String documentId, String username, String userColor, String userNickname, String initialContent, int version) {
        super("join", documentId, username);
        this.userColor = userColor;
        this.userNickname = userNickname;
        this.initialContent = initialContent;
        this.version = version;
    }
}
