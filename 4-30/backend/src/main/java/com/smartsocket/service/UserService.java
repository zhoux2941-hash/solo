package com.smartsocket.service;

import com.smartsocket.model.User;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class UserService {
    
    private static final Logger logger = LoggerFactory.getLogger(UserService.class);
    
    private final Map<String, User> users = new HashMap<>();
    private final List<User> userList = new ArrayList<>();
    
    @PostConstruct
    public void initMockUsers() {
        User[] mockUsers = {
            new User("alice", "password123", "#FF6B6B", "Alice Chen"),
            new User("bob", "password123", "#4ECDC4", "Bob Wang"),
            new User("charlie", "password123", "#45B7D1", "Charlie Liu"),
            new User("david", "password123", "#96CEB4", "David Zhang")
        };
        
        for (User user : mockUsers) {
            users.put(user.getUsername(), user);
            userList.add(user);
        }
        
        logger.info("========================================");
        logger.info("      MOCK USERS FOR LOGIN");
        logger.info("========================================");
        for (User user : userList) {
            logger.info("Username: {} | Password: {} | Name: {}", 
                user.getUsername(), user.getPassword(), user.getNickname());
        }
        logger.info("========================================");
    }
    
    public User authenticate(String username, String password) {
        User user = users.get(username);
        if (user != null && user.getPassword().equals(password)) {
            return user;
        }
        return null;
    }
    
    public User getUserByUsername(String username) {
        return users.get(username);
    }
    
    public List<User> getAllUsers() {
        return new ArrayList<>(userList);
    }
    
    public List<User> getOtherUsers(String excludeUsername) {
        List<User> others = new ArrayList<>();
        for (User user : userList) {
            if (!user.getUsername().equals(excludeUsername)) {
                others.add(user);
            }
        }
        return others;
    }
}
