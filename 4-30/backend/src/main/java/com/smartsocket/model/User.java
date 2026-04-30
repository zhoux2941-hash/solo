package com.smartsocket.model;

public class User {
    private String username;
    private String password;
    private String color;
    private String nickname;
    
    public User() {
    }
    
    public User(String username, String password, String color, String nickname) {
        this.username = username;
        this.password = password;
        this.color = color;
        this.nickname = nickname;
    }
    
    public String getUsername() {
        return username;
    }
    
    public void setUsername(String username) {
        this.username = username;
    }
    
    public String getPassword() {
        return password;
    }
    
    public void setPassword(String password) {
        this.password = password;
    }
    
    public String getColor() {
        return color;
    }
    
    public void setColor(String color) {
        this.color = color;
    }
    
    public String getNickname() {
        return nickname;
    }
    
    public void setNickname(String nickname) {
        this.nickname = nickname;
    }
}
