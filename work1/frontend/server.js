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

// MQTT 配置
const MQTT_BROKER = 'mqtt://test.mosquitto.org';
const MQTT_TOPIC_COMMAND = 'smartplug/command';
const MQTT_TOPIC_RESPONSE = 'smartplug/response';

let mqttClient = null;
let connectedClients = new Set();

// 连接到 MQTT Broker
function connectMqtt() {
    console.log('正在连接到 MQTT Broker...');
    
    mqttClient = mqtt.connect(MQTT_BROKER, {
        clientId: 'smartplug-frontend-' + Math.random().toString(36).substr(2, 8),
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000
    });

    mqttClient.on('connect', () => {
        console.log('成功连接到 MQTT Broker:', MQTT_BROKER);
        mqttClient.subscribe(MQTT_TOPIC_RESPONSE, (err) => {
            if (!err) {
                console.log('已订阅主题:', MQTT_TOPIC_RESPONSE);
            } else {
                console.error('订阅主题失败:', err);
            }
        });
    });

    mqttClient.on('message', (topic, message) => {
        const msg = message.toString();
        console.log('收到 MQTT 消息 - 主题:', topic, '内容:', msg);
        
        // 广播给所有连接的 WebSocket 客户端
        connectedClients.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'response',
                    topic: topic,
                    message: msg,
                    timestamp: new Date().toISOString()
                }));
            }
        });
    });

    mqttClient.on('error', (err) => {
        console.error('MQTT 连接错误:', err);
    });

    mqttClient.on('reconnect', () => {
        console.log('尝试重新连接 MQTT Broker...');
    });

    mqttClient.on('offline', () => {
        console.log('MQTT 连接已断开');
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
