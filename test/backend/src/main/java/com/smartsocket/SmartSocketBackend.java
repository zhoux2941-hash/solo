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

public class SmartSocketBackend {

    private static final String BROKER_URL = "tcp://broker.emqx.io:1883";
    private static final String CLIENT_ID_PREFIX = "smart-socket-backend-";
    private static final String COMMAND_TOPIC = "smart-socket/command";
    private static final String STATUS_TOPIC = "smart-socket/status";
    private static final String REPORT_TOPIC = "smart-socket/device/report";
    private static final int REPORT_INTERVAL_SECONDS = 30;

    private MqttClient mqttClient;
    private boolean socketStatus = false;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private final DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public static void main(String[] args) {
        SmartSocketBackend backend = new SmartSocketBackend();
        backend.connect();
        backend.subscribe();
        backend.startPeriodicReport();
        System.out.println("智能插座后端服务已启动，等待指令...");
        System.out.println("设备状态上报周期: " + REPORT_INTERVAL_SECONDS + " 秒");
    }

    public void connect() {
        try {
            String clientId = CLIENT_ID_PREFIX + UUID.randomUUID().toString().substring(0, 8);
            MemoryPersistence persistence = new MemoryPersistence();
            mqttClient = new MqttClient(BROKER_URL, clientId, persistence);

            MqttConnectOptions connOpts = new MqttConnectOptions();
            connOpts.setCleanSession(true);
            connOpts.setAutomaticReconnect(true);
            connOpts.setConnectionTimeout(10);

            mqttClient.setCallback(new MqttCallback() {
                @Override
                public void connectionLost(Throwable cause) {
                    System.out.println("连接断开，正在重连...");
                }

                @Override
                public void messageArrived(String topic, MqttMessage message) {
                    handleMessage(topic, message);
                }

                @Override
                public void deliveryComplete(IMqttDeliveryToken token) {
                }
            });

            mqttClient.connect(connOpts);
            System.out.println("连接到 MQTT Broker: " + BROKER_URL);

        } catch (MqttException e) {
            System.err.println("连接 MQTT Broker 失败: " + e.getMessage());
            System.err.println("使用的是 EMQX 公共 Broker: " + BROKER_URL);
            System.err.println("请检查网络连接是否正常。");
            e.printStackTrace();
            System.exit(1);
        }
    }

    private void handleMessage(String topic, MqttMessage message) {
        String payload = new String(message.getPayload(), StandardCharsets.UTF_8);
        System.out.println("收到消息 - 主题: " + topic + ", 内容: " + payload);

        String response = null;

        if ("开".equals(payload) || "on".equalsIgnoreCase(payload)) {
            socketStatus = true;
            response = "开成功";
            System.out.println("执行操作: 打开插座");
        } else if ("关".equals(payload) || "off".equalsIgnoreCase(payload)) {
            socketStatus = false;
            response = "关成功";
            System.out.println("执行操作: 关闭插座");
        } else {
            System.out.println("未知指令: " + payload);
            return;
        }

        publishResponse(response);
    }

    private void publishResponse(String response) {
        try {
            MqttMessage message = new MqttMessage(response.getBytes(StandardCharsets.UTF_8));
            message.setQos(1);
            mqttClient.publish(STATUS_TOPIC, message);
            System.out.println("已发送响应: " + response);
        } catch (MqttException e) {
            System.err.println("发送响应失败: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void startPeriodicReport() {
        System.out.println("启动定时上报任务...");
        
        Runnable reportTask = () -> {
            try {
                if (mqttClient != null && mqttClient.isConnected()) {
                    String reportData = createReportData();
                    publishReport(reportData);
                } else {
                    System.out.println("MQTT 未连接，跳过本次上报");
                }
            } catch (Exception e) {
                System.err.println("上报任务执行异常: " + e.getMessage());
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
        boolean isOnline = mqttClient != null && mqttClient.isConnected();
        String timestamp = LocalDateTime.now().format(formatter);
        
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        sb.append("\"deviceId\":\"smart-socket-001\",");
        sb.append("\"isOnline\":").append(isOnline).append(",");
        sb.append("\"socketStatus\":").append(socketStatus).append(",");
        sb.append("\"statusText\":\"").append(socketStatus ? "已开启" : "已关闭").append("\",");
        sb.append("\"timestamp\":\"").append(timestamp).append("\"");
        sb.append("}");
        
        return sb.toString();
    }

    private void publishReport(String reportData) {
        try {
            MqttMessage message = new MqttMessage(reportData.getBytes(StandardCharsets.UTF_8));
            message.setQos(1);
            mqttClient.publish(REPORT_TOPIC, message);
            System.out.println("[" + LocalDateTime.now().format(formatter) + "] 设备状态上报: " + reportData);
        } catch (MqttException e) {
            System.err.println("发送上报数据失败: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public void subscribe() {
        try {
            mqttClient.subscribe(COMMAND_TOPIC, 1);
            System.out.println("已订阅主题: " + COMMAND_TOPIC);
        } catch (MqttException e) {
            System.err.println("订阅失败: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
