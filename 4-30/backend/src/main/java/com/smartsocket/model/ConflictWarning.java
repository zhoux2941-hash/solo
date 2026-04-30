package com.smartsocket.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
public class ConflictWarning extends WebSocketMessage {
    private String conflictUsername;
    private String conflictUserNickname;
    private int conflictFrom;
    private int conflictTo;
    private String warning;
    
    public ConflictWarning(String documentId, String username, String conflictUsername, 
                          String conflictUserNickname, int conflictFrom, int conflictTo, String warning) {
        super("conflict", documentId, username);
        this.conflictUsername = conflictUsername;
        this.conflictUserNickname = conflictUserNickname;
        this.conflictFrom = conflictFrom;
        this.conflictTo = conflictTo;
        this.warning = warning;
    }
}
