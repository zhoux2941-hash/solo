package com.smartsocket.model;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@JsonTypeInfo(
    use = JsonTypeInfo.Id.NAME,
    include = JsonTypeInfo.As.PROPERTY,
    property = "type"
)
@JsonSubTypes({
    @JsonSubTypes.Type(value = CursorMessage.class, name = "cursor"),
    @JsonSubTypes.Type(value = SelectionMessage.class, name = "selection"),
    @JsonSubTypes.Type(value = EditMessage.class, name = "edit"),
    @JsonSubTypes.Type(value = JoinMessage.class, name = "join"),
    @JsonSubTypes.Type(value = LeaveMessage.class, name = "leave"),
    @JsonSubTypes.Type(value = UserListMessage.class, name = "userList"),
    @JsonSubTypes.Type(value = ConflictWarning.class, name = "conflict")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class WebSocketMessage {
    private String type;
    private String documentId;
    private String username;
}
