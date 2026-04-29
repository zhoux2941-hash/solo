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

import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.Arrays;
import java.util.List;

public class SmartPlugBackend implements MqttCallback {

    private static final Logger logger = LoggerFactory.getLogger(SmartPlugBackend.class);
    
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
    private static final List<String> BROKER_LIST = Arrays.asList(
        "tcp://broker-cn.emqx.io:1883",      // 【推荐】EMQX 中国国内
        "tcp://broker.emqx.io:1883",           // 【备选】EMQX 全球
        "tcp://broker.hivemq.com:1883",        // 【备选】HiveMQ
        "tcp://mqtt.eclipseprojects.io:1883",  // 【备选】Eclipse
        "tcp://test.mosquitto.org:1883"        // 【备选】Mosquitto（可能不稳定）
    );
    
    private static final String CLIENT_ID = "smartplug-backend-" + System.currentTimeMillis() + "-" + (int)(Math.random() * 10000);
    private static final String COMMAND_TOPIC = "smartplug/command";
    private static final String RESPONSE_TOPIC = "smartplug/response";
    
    private MqttClient client;
    private String currentBroker;
    private boolean plugStatus = false; // 初始状态为关闭

    public static void main(String[] args) {
        SmartPlugBackend backend = new SmartPlugBackend();
        backend.start();
    }

    public void start() {
        printStartupBanner();
        
        // 按顺序尝试连接各个 Broker
        for (String broker : BROKER_LIST) {
            logger.info("========================================");
            logger.info("尝试连接 Broker: {}", broker);
            logger.info("========================================");
            
            // 先测试网络连通性
            if (!testNetworkConnectivity(broker)) {
                logger.warn("网络连通性测试失败，跳过此 Broker");
                continue;
            }
            
            if (tryConnect(broker)) {
                currentBroker = broker;
                logger.info("✅ 成功连接到 Broker: {}", broker);
                break;
            } else {
                logger.warn("❌ 连接失败，尝试下一个 Broker...");
            }
        }
        
        if (currentBroker == null) {
            logger.error("========================================");
            logger.error("❌ 所有 MQTT Broker 都无法连接！");
            logger.error("========================================");
            logger.error("可能的原因：");
            logger.error("  1. 网络连接问题");
            logger.error("  2. 防火墙阻止了 1883 端口");
            logger.error("  3. 所有公共 Broker 暂时不可用");
            logger.error("");
            logger.error("建议检查：");
            logger.error("  - 网络是否正常");
            logger.error("  - 是否可以访问互联网");
            logger.error("  - 防火墙是否允许出站 1883 端口");
            System.exit(1);
        }
        
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
        
        // 保持主线程运行
        try {
            while (true) {
                Thread.sleep(1000);
            }
        } catch (InterruptedException e) {
            logger.info("程序被中断");
        }
    }
    
    private void printStartupBanner() {
        logger.info("========================================");
        logger.info("  物联网智能插座 - 后端服务");
        logger.info("========================================");
        logger.info("客户端ID: {}", CLIENT_ID);
        logger.info("命令主题: {}", COMMAND_TOPIC);
        logger.info("响应主题: {}", RESPONSE_TOPIC);
        logger.info("可用的 Broker 数量: {}", BROKER_LIST.size());
        logger.info("========================================");
    }
    
    /**
     * 测试网络连通性
     */
    private boolean testNetworkConnectivity(String brokerUrl) {
        try {
            // 解析 broker URL 格式: tcp://host:port
            String[] parts = brokerUrl.replace("tcp://", "").split(":");
            String host = parts[0];
            int port = Integer.parseInt(parts[1]);
            
            logger.info("  测试网络连通性: {}:{}", host, port);
            
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, port), 5000); // 5秒超时
                logger.info("  ✅ 网络连通性测试通过");
                return true;
            } catch (Exception e) {
                logger.warn("  ❌ 网络连通性测试失败: {}", e.getMessage());
                return false;
            }
        } catch (Exception e) {
            logger.warn("  ⚠️ 无法解析 Broker 地址", e);
            return false;
        }
    }
    
    /**
     * 尝试连接到指定的 Broker
     */
    private boolean tryConnect(String brokerUrl) {
        try {
            // 创建 MQTT 客户端
            MemoryPersistence persistence = new MemoryPersistence();
            client = new MqttClient(brokerUrl, CLIENT_ID, persistence);
            
            // 设置回调
            client.setCallback(this);
            
            // 配置连接选项
            MqttConnectOptions options = new MqttConnectOptions();
            options.setCleanSession(true);
            options.setAutomaticReconnect(true);
            options.setConnectionTimeout(15);  // 15秒超时
            options.setKeepAliveInterval(60);  // 60秒心跳
            
            logger.info("  正在建立 MQTT 连接...");
            client.connect(options);
            
            // 订阅命令主题
            logger.info("  正在订阅主题: {}", COMMAND_TOPIC);
            client.subscribe(COMMAND_TOPIC, 1);  // QoS 1
            
            logger.info("========================================");
            logger.info("✅ 智能插座后端服务已启动！");
            logger.info("   连接的 Broker: {}", brokerUrl);
            logger.info("   等待接收指令...");
            logger.info("========================================");
            
            return true;
            
        } catch (MqttException e) {
            logger.error("  ❌ 连接失败");
            logger.error("     错误代码: {}", e.getReasonCode());
            logger.error("     错误信息: {}", e.getMessage());
            
            // 详细错误信息
            switch (e.getReasonCode()) {
                case MqttException.REASON_CODE_CLIENT_EXCEPTION:
                    logger.error("     错误类型: 客户端异常");
                    break;
                case MqttException.REASON_CODE_INVALID_PROTOCOL_VERSION:
                    logger.error("     错误类型: 协议版本不支持");
                    break;
                case MqttException.REASON_CODE_CLIENT_IDENTIFIER_NOT_VALID:
                    logger.error("     错误类型: 客户端ID无效");
                    break;
                case MqttException.REASON_CODE_SERVER_UNAVAILABLE:
                    logger.error("     错误类型: 服务器不可用");
                    break;
                case MqttException.REASON_CODE_FAILED_AUTHENTICATION:
                    logger.error("     错误类型: 认证失败");
                    break;
                case MqttException.REASON_CODE_NOT_AUTHORIZED:
                    logger.error("     错误类型: 未授权");
                    break;
                default:
                    logger.error("     错误类型: 未知 (代码: {})", e.getReasonCode());
            }
            
            return false;
        }
    }

    @Override
    public void connectionLost(Throwable cause) {
        logger.warn("⚠️ 连接丢失: {}", cause.getMessage());
        logger.warn("   客户端会自动尝试重连...");
    }

    @Override
    public void messageArrived(String topic, MqttMessage message) throws Exception {
        String payload = new String(message.getPayload(), "UTF-8");
        logger.info("========================================");
        logger.info("📩 收到新消息");
        logger.info("   主题: {}", topic);
        logger.info("   内容: [{}]", payload);
        logger.info("   QoS: {}", message.getQos());
        logger.info("========================================");
        
        String response = processCommand(payload);
        
        if (response != null) {
            sendResponse(response);
        }
    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken token) {
        // 消息发送完成回调
        try {
            if (token.getMessage() != null) {
                logger.debug("✅ 消息发送完成");
            }
        } catch (MqttException e) {
            logger.error("获取发送消息时出错", e);
        }
    }

    private String processCommand(String command) {
        String trimmedCommand = command.trim();
        
        logger.info("🔧 处理指令: [{}]", trimmedCommand);
        
        // 支持中文和英文指令
        switch (trimmedCommand.toLowerCase()) {
            case "开":
            case "on":
                plugStatus = true;
                logger.info("   ✅ 执行打开操作");
                logger.info("   📊 当前状态: 打开");
                return "开成功";
                
            case "关":
            case "off":
                plugStatus = false;
                logger.info("   ✅ 执行关闭操作");
                logger.info("   📊 当前状态: 关闭");
                return "关成功";
                
            case "状态":
            case "status":
                String statusMsg = plugStatus ? "当前状态: 开" : "当前状态: 关";
                logger.info("   📊 {}", statusMsg);
                return statusMsg;
                
            default:
                logger.warn("   ⚠️ 未知指令");
                return "未知指令: " + command;
        }
    }

    private void sendResponse(String response) {
        try {
            MqttMessage message = new MqttMessage(response.getBytes("UTF-8"));
            message.setQos(1);
            message.setRetained(false);
            
            logger.info("📤 发送回复");
            logger.info("   主题: {}", RESPONSE_TOPIC);
            logger.info("   内容: [{}]", response);
            
            client.publish(RESPONSE_TOPIC, message);
            
            logger.info("   ✅ 发送成功");
            
        } catch (Exception e) {
            logger.error("   ❌ 发送失败: {}", e.getMessage());
        }
    }
}
