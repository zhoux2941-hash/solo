package com.smartsocket;

import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public class SmartSocketBackend {

    private static final String BROKER_URL = "tcp://broker.emqx.io:1883";
    private static final String CLIENT_ID_PREFIX = "smart-socket-backend-";
    private static final String COMMAND_TOPIC = "smart-socket/command";
    private static final String STATUS_TOPIC = "smart-socket/status";
    private static final String REPORT_TOPIC = "smart-socket/device/report";
    private static final int REPORT_INTERVAL_SECONDS = 30;
    private static final int KEEP_ALIVE_INTERVAL = 60;

    private MqttAsyncClient mqttClient;
    private boolean socketStatus = false;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private final DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final AtomicInteger reportCount = new AtomicInteger(0);
    private volatile boolean isConnected = false;

    public static void main(String[] args) {
        SmartSocketBackend backend = new SmartSocketBackend();
        backend.connect();
    }

    public void connect() {
        try {
            String clientId = CLIENT_ID_PREFIX + UUID.randomUUID().toString().substring(0, 8);
            System.out.println("========================================");
            System.out.println("  智能插座后端服务启动");
            System.out.println("========================================");
            System.out.println("Broker: " + BROKER_URL);
            System.out.println("Client ID: " + clientId);
            System.out.println("上报周期: " + REPORT_INTERVAL_SECONDS + " 秒");
            System.out.println("上报主题: " + REPORT_TOPIC);
            System.out.println("命令主题: " + COMMAND_TOPIC);
            System.out.println("状态主题: " + STATUS_TOPIC);
            System.out.println("========================================");

            MemoryPersistence persistence = new MemoryPersistence();
            mqttClient = new MqttAsyncClient(BROKER_URL, clientId, persistence);

            MqttConnectOptions connOpts = new MqttConnectOptions();
            connOpts.setCleanSession(true);
            connOpts.setAutomaticReconnect(true);
            connOpts.setConnectionTimeout(30);
            connOpts.setKeepAliveInterval(KEEP_ALIVE_INTERVAL);
            connOpts.setMaxInflight(10);

            mqttClient.setCallback(new MqttCallbackExtended() {
                @Override
                public void connectComplete(boolean reconnect, String serverURI) {
                    isConnected = true;
                    System.out.println("[" + getTime() + "] " + (reconnect ? "重新连接" : "连接") + "成功: " + serverURI);
                    subscribe();
                    startPeriodicReport();
                }

                @Override
                public void connectionLost(Throwable cause) {
                    isConnected = false;
                    System.out.println("[" + getTime() + "] 连接断开: " + (cause != null ? cause.getMessage() : "未知原因"));
                    System.out.println("[" + getTime() + "] 等待自动重连...");
                }

                @Override
                public void messageArrived(String topic, MqttMessage message) {
                    handleMessage(topic, message);
                }

                @Override
                public void deliveryComplete(IMqttDeliveryToken token) {
                    try {
                        if (token.getMessage() != null) {
                            String msgContent = new String(token.getMessage().getPayload(), StandardCharsets.UTF_8);
                            System.out.println("[" + getTime() + "] 消息发送确认: " + msgContent);
                        }
                    } catch (MqttException e) {
                        System.err.println("[" + getTime() + "] 获取发送确认失败: " + e.getMessage());
                    }
                }
            });

            System.out.println("[" + getTime() + "] 正在连接 MQTT Broker...");
            mqttClient.connect(connOpts);

        } catch (MqttException e) {
            System.err.println("[" + getTime() + "] 连接失败: " + e.getMessage());
            System.err.println("[" + getTime() + "] 错误码: " + e.getReasonCode());
            System.err.println("[" + getTime() + "] 请检查网络连接和 Broker 地址");
            e.printStackTrace();
            System.exit(1);
        }
    }

    private void handleMessage(String topic, MqttMessage message) {
        String payload = new String(message.getPayload(), StandardCharsets.UTF_8);
        System.out.println("[" + getTime() + "] 收到命令 - 主题: " + topic + ", 内容: [" + payload + "], QoS: " + message.getQos());

        String response = null;

        if ("开".equals(payload) || "on".equalsIgnoreCase(payload)) {
            socketStatus = true;
            response = "开成功";
            System.out.println("[" + getTime() + "] >>> 执行操作: 打开插座");
        } else if ("关".equals(payload) || "off".equalsIgnoreCase(payload)) {
            socketStatus = false;
            response = "关成功";
            System.out.println("[" + getTime() + "] >>> 执行操作: 关闭插座");
        } else {
            System.out.println("[" + getTime() + "] 未知指令，忽略: " + payload);
            return;
        }

        publishResponse(response);
    }

    private void publishResponse(String response) {
        if (!isConnected || mqttClient == null || !mqttClient.isConnected()) {
            System.err.println("[" + getTime() + "] 未连接到 Broker，无法发送响应");
            return;
        }

        try {
            MqttMessage message = new MqttMessage(response.getBytes(StandardCharsets.UTF_8));
            message.setQos(1);
            message.setRetained(false);
            
            mqttClient.publish(STATUS_TOPIC, message, null, new IMqttActionListener() {
                @Override
                public void onSuccess(IMqttToken asyncActionToken) {
                    System.out.println("[" + getTime() + "] 响应已发送成功: [" + response + "] -> " + STATUS_TOPIC);
                }

                @Override
                public void onFailure(IMqttToken asyncActionToken, Throwable exception) {
                    System.err.println("[" + getTime() + "] 响应发送失败: " + exception.getMessage());
                }
            });
            
        } catch (MqttException e) {
            System.err.println("[" + getTime() + "] 发送响应异常: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void startPeriodicReport() {
        System.out.println("[" + getTime() + "] 启动定时上报任务，首次上报将在 5 秒后开始...");
        
        Runnable reportTask = () -> {
            try {
                if (isConnected && mqttClient != null && mqttClient.isConnected()) {
                    String reportData = createReportData();
                    int currentCount = reportCount.incrementAndGet();
                    System.out.println("[" + getTime() + "] ─────────────────────────────────");
                    System.out.println("[" + getTime() + "] 开始上报 #" + currentCount);
                    publishReport(reportData, currentCount);
                } else {
                    System.out.println("[" + getTime() + "] MQTT 未连接，跳过本次上报");
                }
            } catch (Exception e) {
                System.err.println("[" + getTime() + "] 上报任务执行异常: " + e.getMessage());
                e.printStackTrace();
            }
        };

        scheduler.scheduleAtFixedRate(
            reportTask,
            5,
            REPORT_INTERVAL_SECONDS,
            TimeUnit.SECONDS
        );
    }

    private String createReportData() {
        boolean online = mqttClient != null && mqttClient.isConnected();
        String timestamp = getTime();
        
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        sb.append("\"deviceId\":\"smart-socket-001\",");
        sb.append("\"isOnline\":").append(online).append(",");
        sb.append("\"socketStatus\":").append(socketStatus).append(",");
        sb.append("\"statusText\":\"").append(socketStatus ? "已开启" : "已关闭").append("\",");
        sb.append("\"timestamp\":\"").append(timestamp).append("\"");
        sb.append("}");
        
        return sb.toString();
    }

    private void publishReport(String reportData, int count) {
        try {
            MqttMessage message = new MqttMessage(reportData.getBytes(StandardCharsets.UTF_8));
            message.setQos(1);
            message.setRetained(false);
            
            System.out.println("[" + getTime() + "] 发布上报数据: " + reportData);
            System.out.println("[" + getTime() + "] 目标主题: " + REPORT_TOPIC);
            
            mqttClient.publish(REPORT_TOPIC, message, null, new IMqttActionListener() {
                @Override
                public void onSuccess(IMqttToken asyncActionToken) {
                    System.out.println("[" + getTime() + "] 上报 #" + count + " 发送成功 ✓");
                }

                @Override
                public void onFailure(IMqttToken asyncActionToken, Throwable exception) {
                    System.err.println("[" + getTime() + "] 上报 #" + count + " 发送失败 ✗: " + exception.getMessage());
                }
            });
            
        } catch (MqttException e) {
            System.err.println("[" + getTime() + "] 上报 #" + count + " 异常: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public void subscribe() {
        if (mqttClient == null || !mqttClient.isConnected()) {
            System.err.println("[" + getTime() + "] 未连接，无法订阅");
            return;
        }

        try {
            mqttClient.subscribe(COMMAND_TOPIC, 1, null, new IMqttActionListener() {
                @Override
                public void onSuccess(IMqttToken asyncActionToken) {
                    System.out.println("[" + getTime() + "] 订阅成功: " + COMMAND_TOPIC);
                }

                @Override
                public void onFailure(IMqttToken asyncActionToken, Throwable exception) {
                    System.err.println("[" + getTime() + "] 订阅失败: " + exception.getMessage());
                }
            });

            System.out.println("[" + getTime() + "] 等待指令和定时上报...");
            System.out.println("========================================");

        } catch (MqttException e) {
            System.err.println("[" + getTime() + "] 订阅异常: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private String getTime() {
        return LocalDateTime.now().format(formatter);
    }
}
