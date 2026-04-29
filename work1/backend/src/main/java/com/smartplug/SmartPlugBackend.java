package com.smartplug;

import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SmartPlugBackend implements MqttCallback {

    private static final Logger logger = LoggerFactory.getLogger(SmartPlugBackend.class);
    
    // 公共 MQTT Broker 配置
    private static final String BROKER_URL = "tcp://test.mosquitto.org:1883";
    private static final String CLIENT_ID = "smartplug-backend-" + System.currentTimeMillis();
    private static final String COMMAND_TOPIC = "smartplug/command";
    private static final String RESPONSE_TOPIC = "smartplug/response";
    
    private MqttClient client;
    private boolean plugStatus = false; // 初始状态为关闭

    public static void main(String[] args) {
        SmartPlugBackend backend = new SmartPlugBackend();
        backend.start();
    }

    public void start() {
        try {
            // 创建 MQTT 客户端
            MemoryPersistence persistence = new MemoryPersistence();
            client = new MqttClient(BROKER_URL, CLIENT_ID, persistence);
            
            // 设置回调
            client.setCallback(this);
            
            // 配置连接选项
            MqttConnectOptions options = new MqttConnectOptions();
            options.setCleanSession(true);
            options.setAutomaticReconnect(true);
            options.setConnectionTimeout(10);
            options.setKeepAliveInterval(30);
            
            logger.info("正在连接到 MQTT Broker: {}...", BROKER_URL);
            client.connect(options);
            logger.info("成功连接到 MQTT Broker");
            
            // 订阅命令主题
            client.subscribe(COMMAND_TOPIC);
            logger.info("已订阅主题: {}", COMMAND_TOPIC);
            logger.info("智能插座后端服务已启动，等待指令...");
            
            // 保持程序运行
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                try {
                    logger.info("正在关闭连接...");
                    if (client != null && client.isConnected()) {
                        client.disconnect();
                        client.close();
                    }
                    logger.info("连接已关闭");
                } catch (MqttException e) {
                    logger.error("关闭连接时出错", e);
                }
            }));
            
        } catch (MqttException e) {
            logger.error("连接 MQTT Broker 失败", e);
            System.exit(1);
        }
    }

    @Override
    public void connectionLost(Throwable cause) {
        logger.warn("连接丢失: {}", cause.getMessage());
    }

    @Override
    public void messageArrived(String topic, MqttMessage message) throws Exception {
        String payload = new String(message.getPayload());
        logger.info("收到消息 - 主题: {}, 内容: {}", topic, payload);
        
        String response = processCommand(payload);
        
        if (response != null) {
            sendResponse(response);
        }
    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken token) {
        // 消息发送完成回调
    }

    private String processCommand(String command) {
        String trimmedCommand = command.trim().toLowerCase();
        
        switch (trimmedCommand) {
            case "开":
            case "on":
                plugStatus = true;
                logger.info("执行开灯操作，当前状态: 开");
                return "开成功";
                
            case "关":
            case "off":
                plugStatus = false;
                logger.info("执行关灯操作，当前状态: 关");
                return "关成功";
                
            case "状态":
            case "status":
                return plugStatus ? "当前状态: 开" : "当前状态: 关";
                
            default:
                logger.warn("未知指令: {}", command);
                return "未知指令: " + command;
        }
    }

    private void sendResponse(String response) {
        try {
            MqttMessage message = new MqttMessage(response.getBytes());
            message.setQos(1);
            client.publish(RESPONSE_TOPIC, message);
            logger.info("已发送回复: {} 到主题: {}", response, RESPONSE_TOPIC);
        } catch (MqttException e) {
            logger.error("发送回复时出错", e);
        }
    }
}
