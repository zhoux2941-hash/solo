package com.collab.editor.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentOperation {
    private String type;
    private int startLine;
    private int startColumn;
    private int endLine;
    private int endColumn;
    private String text;
    private int version;
    private String userId;
    private long timestamp;
}
