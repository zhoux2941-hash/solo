package com.smartsocket.controller;

import com.smartsocket.model.User;
import com.smartsocket.service.UserService;
import com.smartsocket.util.JwtUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {
    
    private final UserService userService;
    private final JwtUtil jwtUtil;
    
    public AuthController(UserService userService, JwtUtil jwtUtil) {
        this.userService = userService;
        this.jwtUtil = jwtUtil;
    }
    
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password");
        
        if (username == null || password == null) {
            return ResponseEntity.badRequest().body(
                Map.of("success", false, "message", "Username and password required")
            );
        }
        
        User user = userService.authenticate(username, password);
        if (user == null) {
            return ResponseEntity.status(401).body(
                Map.of("success", false, "message", "Invalid username or password")
            );
        }
        
        String token = jwtUtil.generateToken(username);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("token", token);
        response.put("user", Map.of(
            "username", user.getUsername(),
            "nickname", user.getNickname(),
            "color", user.getColor()
        ));
        
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/users")
    public ResponseEntity<List<Map<String, String>>> getAvailableUsers(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        
        String username = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtUtil.validateToken(token)) {
                username = jwtUtil.extractUsername(token);
            }
        }
        
        List<User> users;
        if (username != null) {
            users = userService.getOtherUsers(username);
        } else {
            users = userService.getAllUsers();
        }
        
        List<Map<String, String>> result = users.stream()
            .map(u -> Map.of(
                "username", u.getUsername(),
                "nickname", u.getNickname(),
                "color", u.getColor()
            ))
            .collect(Collectors.toList());
        
        return ResponseEntity.ok(result);
    }
    
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getCurrentUser(
            @RequestHeader("Authorization") String authHeader) {
        
        String token = authHeader.substring(7);
        if (!jwtUtil.validateToken(token)) {
            return ResponseEntity.status(401).body(Map.of("success", false));
        }
        
        String username = jwtUtil.extractUsername(token);
        User user = userService.getUserByUsername(username);
        
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("success", false));
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("user", Map.of(
            "username", user.getUsername(),
            "nickname", user.getNickname(),
            "color", user.getColor()
        ));
        
        return ResponseEntity.ok(response);
    }
}
