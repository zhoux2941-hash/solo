package com.smartsocket.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Set;
import java.util.HashSet;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Document {
    private String id;
    private String name;
    private String content;
    private String owner;
    private Set<String> invitedUsers;
    private Set<String> activeEditors;
    
    public Document(String id, String name, String owner) {
        this.id = id;
        this.name = name;
        this.owner = owner;
        this.content = "";
        this.invitedUsers = new HashSet<>();
        this.activeEditors = new HashSet<>();
    }
}
