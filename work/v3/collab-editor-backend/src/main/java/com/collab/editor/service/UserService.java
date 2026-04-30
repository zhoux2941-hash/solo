package com.collab.editor.service;

import com.collab.editor.model.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class UserService {
    
    private final Map<String, User> users = new ConcurrentHashMap<>();
    private final Map<String, User> usersByUsername = new ConcurrentHashMap<>();
    private final PasswordEncoder passwordEncoder;

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
        
        List<Map<String, String>> mockUsers = createMockUsers();
        
        for (Map<String, String> mockUser : mockUsers) {
            User user = new User();
            user.setId(mockUser.get("id"));
            user.setUsername(mockUser.get("username"));
            user.setPassword(passwordEncoder.encode(mockUser.get("password")));
            user.setDisplayName(mockUser.get("displayName"));
            user.setColor(mockUser.get("color"));
            user.setDocumentIds(new HashSet<String>());
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

    private List<Map<String, String>> createMockUsers() {
        List<Map<String, String>> mockUsers = new ArrayList<>();
        mockUsers.add(createUserMap("user1", "alice", "alice123", "Alice", "#FF5733"));
        mockUsers.add(createUserMap("user2", "bob", "bob123", "Bob", "#33FF57"));
        mockUsers.add(createUserMap("user3", "charlie", "charlie123", "Charlie", "#3357FF"));
        mockUsers.add(createUserMap("user4", "diana", "diana123", "Diana", "#FF33F5"));
        return mockUsers;
    }

    private Map<String, String> createUserMap(String id, String username, String password, String displayName, String color) {
        Map<String, String> map = new HashMap<>();
        map.put("id", id);
        map.put("username", username);
        map.put("password", password);
        map.put("displayName", displayName);
        map.put("color", color);
        return map;
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
