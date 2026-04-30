package com.collab.editor.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CollaboratorState {
    private String userId;
    private String username;
    private String color;
    private CursorPosition cursor;
    private Selection selection;
    private boolean online;
}
