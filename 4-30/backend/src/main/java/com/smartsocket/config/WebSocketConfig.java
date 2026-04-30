package com.smartsocket.config;

import com.smartsocket.websocket.EditorWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    
    private final EditorWebSocketHandler webSocketHandler;
    
    public WebSocketConfig(EditorWebSocketHandler webSocketHandler) {
        this.webSocketHandler = webSocketHandler;
    }
    
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(webSocketHandler, "/ws/editor")
                .setAllowedOrigins("*");
    }
}
