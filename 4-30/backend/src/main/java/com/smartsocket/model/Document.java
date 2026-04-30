package com.smartsocket.model;

import java.util.HashSet;
import java.util.Set;

public class Document {
    private String id;
    private String name;
    private String content;
    private String owner;
    private Set<String> invitedUsers;
    private Set<String> activeEditors;
    
    public Document() {
        this.invitedUsers = new HashSet<>();
        this.activeEditors = new HashSet<>();
    }
    
    public Document(String id, String name, String owner) {
        this.id = id;
        this.name = name;
        this.owner = owner;
        this.content = "";
        this.invitedUsers = new HashSet<>();
        this.activeEditors = new HashSet<>();
    }
    
    public String getId() {
        return id;
    }
    
    public void setId(String id) {
        this.id = id;
    }
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public String getContent() {
        return content;
    }
    
    public void setContent(String content) {
        this.content = content;
    }
    
    public String getOwner() {
        return owner;
    }
    
    public void setOwner(String owner) {
        this.owner = owner;
    }
    
    public Set<String> getInvitedUsers() {
        return invitedUsers;
    }
    
    public void setInvitedUsers(Set<String> invitedUsers) {
        this.invitedUsers = invitedUsers;
    }
    
    public Set<String> getActiveEditors() {
        return activeEditors;
    }
    
    public void setActiveEditors(Set<String> activeEditors) {
        this.activeEditors = activeEditors;
    }
}
