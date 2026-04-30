package com.smartsocket;

import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

public class SmartSocketBackend {

    private static final String BROKER_URL = "tcp://broker.emqx.io:1883";
    private static final String CLIENT_ID_PREFIX = "smart-socket-backend-";
    private static final String COMMAND_TOPIC = "smart-socket/command";
    private static final String STATUS_TOPIC = "smart-socket/status";

    private MqttClient mqttClient;
    private boolean socketStatus = false;

    public static void main(String[] args) {
        SmartSocketBackend backend = new SmartSocketBackend();
        backend.connect();
        backend.subscribe();
        System.out.println("智能插座后端服务已启动，等待指令...");
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
