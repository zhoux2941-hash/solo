package com.smartsocket.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class EditMessage extends WebSocketMessage {
    private int from;
    private int to;
    private String text;
    private int version;
    
    public EditMessage(String documentId, String username, int from, int to, String text, int version) {
        super("edit", documentId, username);
        this.from = from;
        this.to = to;
        this.text = text;
        this.version = version;
    }
}
