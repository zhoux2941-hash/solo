package com.smartsocket.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class LeaveMessage extends WebSocketMessage {
    public LeaveMessage(String documentId, String username) {
        super("leave", documentId, username);
    }
}
