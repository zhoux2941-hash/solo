const express = require('express');
const mqtt = require('mqtt');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const MQTT_BROKER = 'mqtt://broker.emqx.io:1883';
const COMMAND_TOPIC = 'smart-socket/command';
const STATUS_TOPIC = 'smart-socket/status';
const REPORT_TOPIC = 'smart-socket/device/report';
const PORT = 3000;

let mqttClient = null;
let socketStatus = '未知';
let lastResponse = '';
let reportCount = 0;
let statusCount = 0;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

function getTime() {
  const now = new Date();
  return now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function connectMQTT() {
  console.log('========================================');
  console.log('  智能插座前端服务启动');
  console.log('========================================');
  console.log('[' + getTime() + '] 正在连接 MQTT Broker: ' + MQTT_BROKER);
  console.log('[' + getTime() + '] 命令主题: ' + COMMAND_TOPIC);
  console.log('[' + getTime() + '] 状态主题: ' + STATUS_TOPIC);
  console.log('[' + getTime() + '] 上报主题: ' + REPORT_TOPIC);
  console.log('========================================');
  
  const clientId = 'smart-socket-frontend-' + Math.random().toString(16).substr(2, 8);
  console.log('[' + getTime() + '] Client ID: ' + clientId);
  
  mqttClient = mqtt.connect(MQTT_BROKER, {
    clientId: clientId,
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 30000,
    keepalive: 60,
    resubscribe: true
  });

  mqttClient.on('connect', (connack) => {
    console.log('[' + getTime() + '] ✅ MQTT 连接成功!');
    console.log('[' + getTime() + '] 开始订阅主题...');
    
    mqttClient.subscribe(STATUS_TOPIC, { qos: 1 }, (err) => {
      if (err) {
        console.error('[' + getTime() + '] ❌ 订阅状态主题失败:', err.message);
      } else {
        console.log('[' + getTime() + '] ✅ 已订阅状态主题: ' + STATUS_TOPIC);
      }
    });
    
    mqttClient.subscribe(REPORT_TOPIC, { qos: 1 }, (err) => {
      if (err) {
        console.error('[' + getTime() + '] ❌ 订阅上报主题失败:', err.message);
      } else {
        console.log('[' + getTime() + '] ✅ 已订阅上报主题: ' + REPORT_TOPIC);
        console.log('========================================');
        console.log('[' + getTime() + '] 等待消息...');
        console.log('========================================');
      }
    });
  });

  mqttClient.on('message', (topic, message) => {
    const msg = message.toString();
    
    console.log('');
    console.log('[' + getTime() + '] ════════════════════════════════');
    console.log('[' + getTime() + '] 收到 MQTT 消息');
    console.log('[' + getTime() + '] 主题: ' + topic);
    console.log('[' + getTime() + '] 内容: ' + msg);
    
    if (topic === STATUS_TOPIC) {
      statusCount++;
      console.log('[' + getTime() + '] 类型: 状态响应 (#' + statusCount + ')');
      
      lastResponse = msg;
      if (msg === '开成功') {
        socketStatus = '已开启';
      } else if (msg === '关成功') {
        socketStatus = '已关闭';
      }
      
      const data = {
        type: 'status',
        status: socketStatus,
        response: lastResponse,
        timestamp: new Date().toISOString()
      };
      
      console.log('[' + getTime() + '] 广播到 WebSocket 客户端...');
      broadcastToClients(data);
      
    } else if (topic === REPORT_TOPIC) {
      reportCount++;
      console.log('[' + getTime() + '] 类型: 设备上报 (#' + reportCount + ')');
      
      try {
        const reportData = JSON.parse(msg);
        console.log('[' + getTime() + '] 解析 JSON 成功');
        console.log('[' + getTime() + ']   - 设备: ' + reportData.deviceId);
        console.log('[' + getTime() + ']   - 在线: ' + reportData.isOnline);
        console.log('[' + getTime() + ']   - 状态: ' + reportData.statusText);
        console.log('[' + getTime() + ']   - 时间: ' + reportData.timestamp);
        
        const data = {
          type: 'report',
          data: reportData,
          timestamp: new Date().toISOString()
        };
        
        console.log('[' + getTime() + '] 广播到 WebSocket 客户端...');
        broadcastToClients(data);
        console.log('[' + getTime() + '] ✅ 上报处理完成');
        
      } catch (err) {
        console.error('[' + getTime() + '] ❌ 解析上报数据失败:', err.message);
        console.error('[' + getTime() + '] 原始数据: ' + msg);
      }
    }
    
    console.log('[' + getTime() + '] ════════════════════════════════');
  });

  mqttClient.on('error', (err) => {
    console.error('[' + getTime() + '] ❌ MQTT 错误:', err.message);
  });

  mqttClient.on('offline', () => {
    console.log('[' + getTime() + '] ⚠️ MQTT 连接已断开，尝试重连...');
  });

  mqttClient.on('reconnect', () => {
    console.log('[' + getTime() + '] 🔄 正在重新连接 MQTT Broker...');
  });

  mqttClient.on('close', () => {
    console.log('[' + getTime() + '] MQTT 连接已关闭');
  });
}

function broadcastToClients(data) {
  const clientCount = wss.clients.size;
  if (clientCount === 0) {
    console.log('[' + getTime() + '] ⚠️ 没有 WebSocket 客户端连接，消息未发送');
    return;
  }
  
  let sentCount = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(data));
        sentCount++;
      } catch (err) {
        console.error('[' + getTime() + '] ❌ 发送 WebSocket 消息失败:', err.message);
      }
    }
  });
  
  console.log('[' + getTime() + '] ✅ 已发送到 ' + sentCount + '/' + clientCount + ' 个客户端');
}

wss.on('connection', (ws) => {
  console.log('');
  console.log('[' + getTime() + '] 🔌 新的 WebSocket 连接');
  console.log('[' + getTime() + '] 当前客户端数: ' + wss.clients.size);
  
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
        console.log('');
        console.log('[' + getTime() + '] ─────────────────────────────────');
        console.log('[' + getTime() + '] 收到前端指令: [' + command + ']');
        
        if (mqttClient && mqttClient.connected) {
          console.log('[' + getTime() + '] 发布到 MQTT 主题: ' + COMMAND_TOPIC);
          
          mqttClient.publish(COMMAND_TOPIC, command, { qos: 1 }, (err) => {
            if (err) {
              console.error('[' + getTime() + '] ❌ 发送指令失败:', err.message);
              ws.send(JSON.stringify({
                type: 'error',
                message: '发送指令失败: ' + err.message
              }));
            } else {
              console.log('[' + getTime() + '] ✅ 指令已发送: [' + command + ']');
            }
          });
        } else {
          console.error('[' + getTime() + '] ❌ MQTT 连接未建立');
          ws.send(JSON.stringify({
            type: 'error',
            message: 'MQTT 连接未建立'
          }));
        }
        console.log('[' + getTime() + '] ─────────────────────────────────');
      }
    } catch (err) {
      console.error('[' + getTime() + '] ❌ 解析 WebSocket 消息失败:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('[' + getTime() + '] 🔌 WebSocket 连接已关闭');
    console.log('[' + getTime() + '] 剩余客户端数: ' + wss.clients.size);
  });

  ws.on('error', (err) => {
    console.error('[' + getTime() + '] ❌ WebSocket 错误:', err.message);
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: socketStatus,
    response: lastResponse,
    mqttConnected: mqttClient ? mqttClient.connected : false,
    reportCount: reportCount,
    statusCount: statusCount
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
  console.log('');
  console.log('========================================');
  console.log('  前端服务已启动');
  console.log('========================================');
  console.log('  访问地址: http://localhost:' + PORT);
  console.log('  启动时间: ' + getTime());
  console.log('========================================');
  console.log('');
  connectMQTT();
});
