package com.smartsocket.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class UserListMessage extends WebSocketMessage {
    private List<Map<String, String>> users;
    
    public UserListMessage(String documentId, List<Map<String, String>> users) {
        super("userList", documentId, null);
        this.users = users;
    }
}
