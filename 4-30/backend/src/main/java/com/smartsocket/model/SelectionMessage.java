package com.smartsocket.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class SelectionMessage extends WebSocketMessage {
    private int from;
    private int to;
    
    public SelectionMessage(String documentId, String username, int from, int to) {
        super("selection", documentId, username);
        this.from = from;
        this.to = to;
    }
}
