const express = require('express');
const mqtt = require('mqtt');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const MQTT_BROKER = 'mqtt://localhost:1883';
const COMMAND_TOPIC = 'smart-socket/command';
const STATUS_TOPIC = 'smart-socket/status';
const PORT = 3000;

let mqttClient = null;
let socketStatus = '未知';
let lastResponse = '';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

function connectMQTT() {
  console.log('正在连接 MQTT Broker...');
  
  mqttClient = mqtt.connect(MQTT_BROKER, {
    clientId: 'smart-socket-frontend-' + Math.random().toString(16).substr(2, 8),
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 10000
  });

  mqttClient.on('connect', () => {
    console.log('已连接到 MQTT Broker:', MQTT_BROKER);
    mqttClient.subscribe(STATUS_TOPIC, { qos: 1 }, (err) => {
      if (err) {
        console.error('订阅状态主题失败:', err);
      } else {
        console.log('已订阅主题:', STATUS_TOPIC);
      }
    });
  });

  mqttClient.on('message', (topic, message) => {
    const msg = message.toString();
    console.log('收到消息 - 主题:', topic, ', 内容:', msg);
    
    if (topic === STATUS_TOPIC) {
      lastResponse = msg;
      if (msg === '开成功') {
        socketStatus = '已开启';
      } else if (msg === '关成功') {
        socketStatus = '已关闭';
      }
      
      broadcastToClients({
        type: 'status',
        status: socketStatus,
        response: lastResponse,
        timestamp: new Date().toISOString()
      });
    }
  });

  mqttClient.on('error', (err) => {
    console.error('MQTT 错误:', err);
  });

  mqttClient.on('offline', () => {
    console.log('MQTT 连接已断开，尝试重连...');
  });

  mqttClient.on('reconnect', () => {
    console.log('正在重新连接 MQTT Broker...');
  });
}

function broadcastToClients(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

wss.on('connection', (ws) => {
  console.log('新的 WebSocket 连接');
  
  ws.send(JSON.stringify({
    type: 'init',
    status: socketStatus,
    response: lastResponse,
    timestamp: new Date().toISOString()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'command') {
        const command = data.command;
        console.log('收到前端指令:', command);
        
        if (mqttClient && mqttClient.connected) {
          mqttClient.publish(COMMAND_TOPIC, command, { qos: 1 }, (err) => {
            if (err) {
              console.error('发送指令失败:', err);
              ws.send(JSON.stringify({
                type: 'error',
                message: '发送指令失败: ' + err.message
              }));
            } else {
              console.log('已发送指令到 MQTT:', command);
            }
          });
        } else {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'MQTT 连接未建立'
          }));
        }
      }
    } catch (err) {
      console.error('解析 WebSocket 消息失败:', err);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket 连接已关闭');
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: socketStatus,
    response: lastResponse,
    mqttConnected: mqttClient ? mqttClient.connected : false
  });
});

app.post('/api/command', (req, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: '缺少 command 参数' });
  }

  if (!mqttClient || !mqttClient.connected) {
    return res.status(500).json({ error: 'MQTT 连接未建立' });
  }

  mqttClient.publish(COMMAND_TOPIC, command, { qos: 1 }, (err) => {
    if (err) {
      return res.status(500).json({ error: '发送指令失败: ' + err.message });
    }
    
    res.json({ success: true, message: '指令已发送: ' + command });
  });
});

server.listen(PORT, () => {
  console.log('前端服务已启动: http://localhost:' + PORT);
  connectMQTT();
});
