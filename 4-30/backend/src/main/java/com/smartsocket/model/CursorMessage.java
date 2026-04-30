package com.smartsocket.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class CursorMessage extends WebSocketMessage {
    private int position;
    
    public CursorMessage(String documentId, String username, int position) {
        super("cursor", documentId, username);
        this.position = position;
    }
}
