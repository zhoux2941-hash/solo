const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mqtt = require('mqtt');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MQTT 配置 - 使用免费公共 MQTT Broker
// test.mosquitto.org 是 Eclipse 提供的免费公共 MQTT Broker
// TCP 端口: 1883 (非加密), 8883 (加密 TLS)
// WebSocket 端口: 8080 (非加密), 8081 (加密 TLS)
const MQTT_BROKER = 'mqtt://test.mosquitto.org:1883';
const MQTT_TOPIC_COMMAND = 'smartplug/command';
const MQTT_TOPIC_RESPONSE = 'smartplug/response';

// 其他可用的免费公共 MQTT Broker（可选）:
// 1. broker.hivemq.com:1883 (HiveMQ)
// 2. mqtt.eclipseprojects.io:1883 (Eclipse)
// 3. broker.emqx.io:1883 (EMQX)

let mqttClient = null;
let connectedClients = new Set();

// 连接到 MQTT Broker
function connectMqtt() {
    console.log('正在连接到 MQTT Broker: ' + MQTT_BROKER);
    
    // 生成唯一的客户端ID
    const clientId = 'smartplug-frontend-' + Date.now() + '-' + Math.random().toString(16).substr(2, 4);
    
    console.log('使用客户端ID: ' + clientId);
    
    mqttClient = mqtt.connect(MQTT_BROKER, {
        clientId: clientId,
        clean: true,
        reconnectPeriod: 3000,  // 3秒后尝试重连
        connectTimeout: 10 * 1000,  // 10秒超时
        keepalive: 60,  // 60秒心跳
        resubscribe: true,  // 重连后自动重新订阅
        protocolVersion: 4  // MQTT 3.1.1
    });

    mqttClient.on('connect', (connack) => {
        console.log('✓ 成功连接到 MQTT Broker: ' + MQTT_BROKER);
        console.log('  会话是否为新会话: ' + connack.sessionPresent);
        
        // 订阅响应主题
        mqttClient.subscribe(MQTT_TOPIC_RESPONSE, { qos: 1 }, (err) => {
            if (!err) {
                console.log('✓ 已订阅主题: ' + MQTT_TOPIC_RESPONSE);
            } else {
                console.error('✗ 订阅主题失败:', err);
            }
        });
        
        // 广播连接状态给所有 WebSocket 客户端
        broadcastMqttStatus(true);
    });

    mqttClient.on('message', (topic, message, packet) => {
        const msg = message.toString();
        console.log('📩 收到 MQTT 消息');
        console.log('   主题: ' + topic);
        console.log('   内容: ' + msg);
        console.log('   QoS: ' + packet.qos);
        
        // 广播给所有连接的 WebSocket 客户端
        broadcastMessage('response', {
            topic: topic,
            message: msg,
            qos: packet.qos,
            timestamp: new Date().toISOString()
        });
    });

    mqttClient.on('error', (err) => {
        console.error('✗ MQTT 连接错误:');
        console.error('  错误类型: ' + err.constructor.name);
        console.error('  错误信息: ' + err.message);
        
        // 广播错误状态
        broadcastMessage('error', {
            message: 'MQTT 连接错误: ' + err.message
        });
    });

    mqttClient.on('reconnect', () => {
        console.log('🔄 尝试重新连接 MQTT Broker...');
        broadcastMessage('status', {
            message: '正在重新连接 MQTT Broker...'
        });
    });

    mqttClient.on('offline', () => {
        console.log('⚠️ MQTT 连接已断开（离线状态）');
        broadcastMqttStatus(false);
    });

    mqttClient.on('close', () => {
        console.log('⚠️ MQTT 连接已关闭');
        broadcastMqttStatus(false);
    });

    mqttClient.on('disconnect', (packet) => {
        console.log('⚠️ MQTT 收到断开连接包');
        if (packet) {
            console.log('   原因码: ' + packet.reasonCode);
        }
    });
}

// 广播 MQTT 连接状态
function broadcastMqttStatus(connected) {
    broadcastMessage('mqtt_status', {
        connected: connected,
        broker: MQTT_BROKER
    });
}

// 广播消息给所有 WebSocket 客户端
function broadcastMessage(type, data) {
    const message = JSON.stringify({
        type: type,
        ...data
    });
    
    connectedClients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(message);
            } catch (err) {
                console.error('发送 WebSocket 消息失败:', err);
            }
        }
    });
}

// WebSocket 连接处理
wss.on('connection', (ws) => {
    console.log('新的 WebSocket 客户端已连接');
    connectedClients.add(ws);

    // 发送初始连接状态
    ws.send(JSON.stringify({
        type: 'status',
        status: 'connected',
        message: 'WebSocket 连接已建立'
    }));

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'command') {
                const command = message.command;
                console.log('收到前端命令:', command);
                
                if (mqttClient && mqttClient.connected) {
                    // 发送命令到 MQTT
                    mqttClient.publish(MQTT_TOPIC_COMMAND, command, { qos: 1 }, (err) => {
                        if (err) {
                            console.error('发送 MQTT 命令失败:', err);
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: '发送命令失败: ' + err.message
                            }));
                        } else {
                            console.log('已发送 MQTT 命令:', command);
                            ws.send(JSON.stringify({
                                type: 'sent',
                                command: command,
                                message: '命令已发送: ' + command
                            }));
                        }
                    });
                } else {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'MQTT 连接未就绪'
                    }));
                }
            }
        } catch (error) {
            console.error('解析 WebSocket 消息失败:', error);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket 客户端已断开连接');
        connectedClients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket 错误:', error);
        connectedClients.delete(ws);
    });
});

// REST API 端点（可选，用于兼容非 WebSocket 客户端）
app.post('/api/command', (req, res) => {
    const { command } = req.body;
    
    if (!command) {
        return res.status(400).json({ error: '缺少 command 参数' });
    }

    if (!mqttClient || !mqttClient.connected) {
        return res.status(503).json({ error: 'MQTT 连接未就绪' });
    }

    mqttClient.publish(MQTT_TOPIC_COMMAND, command, { qos: 1 }, (err) => {
        if (err) {
            return res.status(500).json({ error: '发送命令失败: ' + err.message });
        }
        res.json({ success: true, command: command, message: '命令已发送' });
    });
});

// 获取状态端点
app.get('/api/status', (req, res) => {
    res.json({
        mqttConnected: mqttClient ? mqttClient.connected : false,
        websocketClients: connectedClients.size
    });
});

// 启动服务器
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log('智能插座前端服务已启动');
    console.log('HTTP 服务器端口:', PORT);
    console.log('WebSocket 端点: ws://localhost:' + PORT);
    console.log('MQTT Broker:', MQTT_BROKER);
    console.log('命令主题:', MQTT_TOPIC_COMMAND);
    console.log('响应主题:', MQTT_TOPIC_RESPONSE);
    console.log('');
    console.log('请在浏览器中访问: http://localhost:' + PORT);
    
    // 连接 MQTT
    connectMqtt();
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('正在关闭服务器...');
    
    if (mqttClient) {
        mqttClient.end();
    }
    
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});
