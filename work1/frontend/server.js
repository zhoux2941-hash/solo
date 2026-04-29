const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mqtt = require('mqtt');
const cors = require('cors');
const path = require('path');
const net = require('net');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =========================================================================
// MQTT Broker 列表 - 按优先级排列
// =========================================================================
// 程序会按顺序尝试连接这些 Broker，直到成功
// 
// 说明：
// - broker-cn.emqx.io: EMQX 中国国内节点，中国用户推荐优先使用
// - broker.emqx.io: EMQX 全球节点
// - broker.hivemq.com: HiveMQ 公共 Broker
// - mqtt.eclipseprojects.io: Eclipse 公共 Broker
// - test.mosquitto.org: Mosquitto 公共 Broker（可能不稳定）
// =========================================================================
const BROKER_LIST = [
    'mqtt://broker-cn.emqx.io:1883',      // 【推荐】EMQX 中国国内
    'mqtt://broker.emqx.io:1883',           // 【备选】EMQX 全球
    'mqtt://broker.hivemq.com:1883',        // 【备选】HiveMQ
    'mqtt://mqtt.eclipseprojects.io:1883',  // 【备选】Eclipse
    'mqtt://test.mosquitto.org:1883'        // 【备选】Mosquitto（可能不稳定）
];

const MQTT_TOPIC_COMMAND = 'smartplug/command';
const MQTT_TOPIC_RESPONSE = 'smartplug/response';

let mqttClient = null;
let currentBroker = null;
let connectedClients = new Set();
let clientId = null;

// 生成唯一的客户端ID
function generateClientId() {
    return 'smartplug-frontend-' + Date.now() + '-' + Math.random().toString(16).substr(2, 4);
}

// 打印启动横幅
function printStartupBanner() {
    console.log('========================================');
    console.log('  物联网智能插座 - 前端服务');
    console.log('========================================');
    console.log('命令主题:', MQTT_TOPIC_COMMAND);
    console.log('响应主题:', MQTT_TOPIC_RESPONSE);
    console.log('可用的 Broker 数量:', BROKER_LIST.length);
    console.log('========================================');
}

/**
 * 测试网络连通性
 */
function testNetworkConnectivity(brokerUrl) {
    return new Promise((resolve) => {
        // 解析 broker URL 格式: mqtt://host:port
        const urlParts = brokerUrl.replace('mqtt://', '').split(':');
        const host = urlParts[0];
        const port = parseInt(urlParts[1]);
        
        console.log('  测试网络连通性: %s:%d', host, port);
        
        const socket = new net.Socket();
        const timeout = 5000; // 5秒超时
        
        const timer = setTimeout(() => {
            socket.destroy();
            console.log('  ❌ 网络连通性测试失败: 连接超时');
            resolve(false);
        }, timeout);
        
        socket.connect(port, host, () => {
            clearTimeout(timer);
            socket.end();
            console.log('  ✅ 网络连通性测试通过');
            resolve(true);
        });
        
        socket.on('error', (err) => {
            clearTimeout(timer);
            console.log('  ❌ 网络连通性测试失败: %s', err.message);
            resolve(false);
        });
    });
}

/**
 * 尝试连接到指定的 Broker
 */
function tryConnect(brokerUrl) {
    return new Promise((resolve) => {
        clientId = generateClientId();
        console.log('  使用客户端ID: %s', clientId);
        console.log('  正在建立 MQTT 连接...');
        
        const client = mqtt.connect(brokerUrl, {
            clientId: clientId,
            clean: true,
            reconnectPeriod: 3000,  // 3秒后尝试重连
            connectTimeout: 15 * 1000,  // 15秒超时
            keepalive: 60,  // 60秒心跳
            resubscribe: true,  // 重连后自动重新订阅
            protocolVersion: 4  // MQTT 3.1.1
        });

        // 连接成功
        client.on('connect', (connack) => {
            console.log('  ✅ MQTT 连接建立成功');
            console.log('     会话是否为新会话: %s', connack.sessionPresent);
            
            // 订阅响应主题
            console.log('  正在订阅主题: %s', MQTT_TOPIC_RESPONSE);
            client.subscribe(MQTT_TOPIC_RESPONSE, { qos: 1 }, (err) => {
                if (!err) {
                    console.log('  ✅ 已订阅主题: %s', MQTT_TOPIC_RESPONSE);
                } else {
                    console.error('  ❌ 订阅主题失败:', err);
                }
            });
            
            // 设置全局客户端
            mqttClient = client;
            currentBroker = brokerUrl;
            
            // 广播连接状态
            broadcastMqttStatus(true);
            
            resolve(true);
        });

        // 收到消息
        client.on('message', (topic, message, packet) => {
            const msg = message.toString();
            console.log('📩 收到 MQTT 消息');
            console.log('   主题: %s', topic);
            console.log('   内容: [%s]', msg);
            console.log('   QoS: %d', packet.qos);
            
            // 广播给所有连接的 WebSocket 客户端
            broadcastMessage('response', {
                topic: topic,
                message: msg,
                qos: packet.qos,
                timestamp: new Date().toISOString()
            });
        });

        // 连接错误
        client.on('error', (err) => {
            console.error('  ❌ MQTT 连接错误:');
            console.error('     错误类型: %s', err.constructor.name);
            console.error('     错误信息: %s', err.message);
            
            // 广播错误状态
            broadcastMessage('error', {
                message: 'MQTT 连接错误: ' + err.message
            });
            
            client.end();
            resolve(false);
        });

        // 重连
        client.on('reconnect', () => {
            console.log('🔄 尝试重新连接 MQTT Broker...');
            broadcastMessage('status', {
                message: '正在重新连接 MQTT Broker...'
            });
        });

        // 离线
        client.on('offline', () => {
            console.log('⚠️ MQTT 连接已断开（离线状态）');
            broadcastMqttStatus(false);
        });

        // 关闭
        client.on('close', () => {
            console.log('⚠️ MQTT 连接已关闭');
            broadcastMqttStatus(false);
        });

        // 断开连接包
        client.on('disconnect', (packet) => {
            console.log('⚠️ MQTT 收到断开连接包');
            if (packet) {
                console.log('   原因码: %d', packet.reasonCode);
            }
        });
    });
}

/**
 * 按顺序尝试连接各个 Broker
 */
async function connectMqtt() {
    printStartupBanner();
    
    // 按顺序尝试连接各个 Broker
    for (const broker of BROKER_LIST) {
        console.log('========================================');
        console.log('尝试连接 Broker: %s', broker);
        console.log('========================================');
        
        // 先测试网络连通性
        const networkOk = await testNetworkConnectivity(broker);
        if (!networkOk) {
            console.warn('⚠️ 网络连通性测试失败，跳过此 Broker');
            continue;
        }
        
        // 尝试连接
        const connected = await tryConnect(broker);
        if (connected) {
            console.log('========================================');
            console.log('✅ 成功连接到 Broker: %s', broker);
            console.log('   前端服务已就绪，等待前端页面连接...');
            console.log('========================================');
            return;
        } else {
            console.warn('❌ 连接失败，尝试下一个 Broker...');
        }
    }
    
    // 所有 Broker 都无法连接
    console.error('========================================');
    console.error('❌ 所有 MQTT Broker 都无法连接！');
    console.error('========================================');
    console.error('可能的原因：');
    console.error('  1. 网络连接问题');
    console.error('  2. 防火墙阻止了 1883 端口');
    console.error('  3. 所有公共 Broker 暂时不可用');
    console.error('');
    console.error('建议检查：');
    console.error('  - 网络是否正常');
    console.error('  - 是否可以访问互联网');
    console.error('  - 防火墙是否允许出站 1883 端口');
    
    // 即使 MQTT 无法连接，也要启动 HTTP 服务器
    // 让用户可以看到错误信息
}

// 广播 MQTT 连接状态
function broadcastMqttStatus(connected) {
    broadcastMessage('mqtt_status', {
        connected: connected,
        broker: currentBroker || '未连接'
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

    // 发送当前 MQTT 状态
    if (mqttClient && mqttClient.connected) {
        ws.send(JSON.stringify({
            type: 'mqtt_status',
            connected: true,
            broker: currentBroker
        }));
    } else {
        ws.send(JSON.stringify({
            type: 'mqtt_status',
            connected: false,
            broker: '未连接'
        }));
    }

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'command') {
                const command = message.command;
                console.log('收到前端命令: [%s]', command);
                
                if (mqttClient && mqttClient.connected) {
                    // 发送命令到 MQTT
                    console.log('📤 发送 MQTT 命令');
                    console.log('   主题: %s', MQTT_TOPIC_COMMAND);
                    console.log('   内容: [%s]', command);
                    
                    mqttClient.publish(MQTT_TOPIC_COMMAND, command, { qos: 1 }, (err) => {
                        if (err) {
                            console.error('   ❌ 发送失败: %s', err.message);
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: '发送命令失败: ' + err.message
                            }));
                        } else {
                            console.log('   ✅ 发送成功');
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
        currentBroker: currentBroker,
        websocketClients: connectedClients.size
    });
});

// 启动服务器
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log('========================================');
    console.log('  智能插座前端服务已启动');
    console.log('========================================');
    console.log('HTTP 服务器端口: %d', PORT);
    console.log('WebSocket 端点: ws://localhost:%d', PORT);
    console.log('');
    console.log('请在浏览器中访问: http://localhost:%d', PORT);
    console.log('========================================');
    
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
