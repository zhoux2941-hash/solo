package com.collab.editor.service;

import com.collab.editor.model.User;
import jakarta.annotation.PostConstruct;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class UserService {
    
    private final Map<String, User> users = new ConcurrentHashMap<>();
    private final Map<String, User> usersByUsername = new ConcurrentHashMap<>();
    private final PasswordEncoder passwordEncoder;
    
    private final List<Map<String, String>> mockUsers = Arrays.asList(
        Map.of("id", "user1", "username", "alice", "password", "alice123", "displayName", "Alice", "color", "#FF5733"),
        Map.of("id", "user2", "username", "bob", "password", "bob123", "displayName", "Bob", "color", "#33FF57"),
        Map.of("id", "user3", "username", "charlie", "password", "charlie123", "displayName", "Charlie", "color", "#3357FF"),
        Map.of("id", "user4", "username", "diana", "password", "diana123", "displayName", "Diana", "color", "#FF33F5")
    );

    public UserService(PasswordEncoder passwordEncoder) {
        this.passwordEncoder = passwordEncoder;
    }

    @PostConstruct
    public void initMockUsers() {
        System.out.println("\n========================================");
        System.out.println("    Welcome to Collaborative Editor!");
        System.out.println("========================================");
        System.out.println("\nAvailable users for login:");
        System.out.println("----------------------------------------");
        
        for (Map<String, String> mockUser : mockUsers) {
            User user = new User();
            user.setId(mockUser.get("id"));
            user.setUsername(mockUser.get("username"));
            user.setPassword(passwordEncoder.encode(mockUser.get("password")));
            user.setDisplayName(mockUser.get("displayName"));
            user.setColor(mockUser.get("color"));
            user.setDocumentIds(new HashSet<>());
            user.setOnline(false);
            
            users.put(user.getId(), user);
            usersByUsername.put(user.getUsername(), user);
            
            System.out.printf("  Username: %-10s | Password: %-15s | Color: %s%n",
                user.getUsername(),
                mockUser.get("password"),
                user.getColor()
            );
        }
        
        System.out.println("----------------------------------------");
        System.out.println("Use these credentials to login to the editor.");
        System.out.println("========================================\n");
    }

    public Optional<User> findByUsername(String username) {
        return Optional.ofNullable(usersByUsername.get(username));
    }

    public Optional<User> findById(String id) {
        return Optional.ofNullable(users.get(id));
    }

    public List<User> getAllUsers() {
        return new ArrayList<>(users.values());
    }

    public void setUserOnline(String userId, boolean online) {
        User user = users.get(userId);
        if (user != null) {
            user.setOnline(online);
        }
    }

    public void addDocumentToUser(String userId, String documentId) {
        User user = users.get(userId);
        if (user != null) {
            user.getDocumentIds().add(documentId);
        }
    }

    public List<User> getUsersByIds(Collection<String> userIds) {
        List<User> result = new ArrayList<>();
        for (String id : userIds) {
            User user = users.get(id);
            if (user != null) {
                result.add(user);
            }
        }
        return result;
    }
}
