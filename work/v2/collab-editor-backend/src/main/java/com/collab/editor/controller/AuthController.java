package com.collab.editor.controller;

import com.collab.editor.model.User;
import com.collab.editor.service.UserService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.security.Principal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    public AuthController(UserService userService, PasswordEncoder passwordEncoder) {
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        Optional<User> userOpt = userService.findByUsername(request.getUsername());
        
        if (!userOpt.isPresent()) {
            return ResponseEntity.badRequest().body(createMap("error", "Invalid username or password"));
        }
        
        User user = userOpt.get();
        
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            return ResponseEntity.badRequest().body(createMap("error", "Invalid username or password"));
        }

        Authentication authentication = new UsernamePasswordAuthenticationToken(
            user.getUsername(),
            user.getPassword()
        );
        
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        
        HttpSession session = httpRequest.getSession(true);
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        session.setAttribute("userId", user.getId());
        session.setAttribute("username", user.getUsername());
        
        userService.setUserOnline(user.getId(), true);
        
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("user", createUserMap(user));
        response.put("sessionId", session.getId());
        
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            String userId = (String) session.getAttribute("userId");
            if (userId != null) {
                userService.setUserOnline(userId, false);
            }
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(createMap("success", true));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Principal principal, HttpSession session) {
        if (principal == null) {
            return ResponseEntity.status(401).body(createMap("error", "Not authenticated"));
        }
        
        String username = principal.getName();
        Optional<User> userOpt = userService.findByUsername(username);
        
        if (!userOpt.isPresent()) {
            return ResponseEntity.status(401).body(createMap("error", "User not found"));
        }
        
        User user = userOpt.get();
        return ResponseEntity.ok(createUserMap(user));
    }

    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (User user : userService.getAllUsers()) {
            result.add(createUserMapWithOnline(user));
        }
        return ResponseEntity.ok(result);
    }

    private Map<String, Object> createMap(String key, Object value) {
        Map<String, Object> map = new HashMap<>();
        map.put(key, value);
        return map;
    }

    private Map<String, Object> createUserMap(User user) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", user.getId());
        map.put("username", user.getUsername());
        map.put("displayName", user.getDisplayName());
        map.put("color", user.getColor());
        return map;
    }

    private Map<String, Object> createUserMapWithOnline(User user) {
        Map<String, Object> map = createUserMap(user);
        map.put("online", user.isOnline());
        return map;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LoginRequest {
        private String username;
        private String password;
    }
}
