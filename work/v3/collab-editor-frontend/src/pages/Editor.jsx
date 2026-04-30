import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import useAuthStore from '../stores/authStore'
import { documentAPI } from '../services/api'
import websocketService from '../services/websocket'
import { toast } from 'react-toastify'

const CodeEditor = () => {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const [document, setDocument] = useState(null)
  const [collaborators, setCollaborators] = useState([])
  const [remoteCursors, setRemoteCursors] = useState(new Map())
  const [remoteSelections, setRemoteSelections] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [decorations, setDecorations] = useState([])
  const isApplyingRemoteChange = useRef(false)
  const decorationsRef = useRef([])

  useEffect(() => {
    loadDocument()
    return () => {
      if (websocketService.isConnected && documentId) {
        websocketService.leaveDocument(documentId)
      }
    }
  }, [documentId])

  useEffect(() => {
    if (document && user) {
      connectWebSocket()
    }
  }, [document, user])

  const loadDocument = async () => {
    try {
      const response = await documentAPI.getDocument(documentId)
      setDocument(response.data)
      
      if (response.data.isInvited) {
        await documentAPI.acceptInvitation(documentId)
      }
    } catch (error) {
      toast.error('Failed to load document')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const connectWebSocket = async () => {
    if (!websocketService.isConnected) {
      try {
        await websocketService.connect(user.id, user.displayName || user.username, user.color)
      } catch (error) {
        console.error('Failed to connect WebSocket:', error)
        toast.error('Failed to connect to collaboration server')
        return
      }
    }
    
    subscribeToEvents()
    websocketService.joinDocument(documentId)
  }

  const subscribeToEvents = () => {
    websocketService.subscribe(`/topic/document/${documentId}/operations`, (message) => {
      if (message.data.userId !== user.id) {
        applyRemoteOperation(message.data)
      }
    })

    websocketService.subscribe(`/topic/document/${documentId}/cursors`, (message) => {
      if (message.userId !== user.id) {
        updateRemoteCursor(message)
      }
    })

    websocketService.subscribe(`/topic/document/${documentId}/selections`, (message) => {
      if (message.userId !== user.id) {
        updateRemoteSelection(message)
      }
    })

    websocketService.subscribe(`/topic/document/${documentId}/events`, (message) => {
      handleCollaborationEvent(message)
    })

    websocketService.subscribe(`/user/queue/errors`, (message) => {
      if (message.type === 'CONFLICT') {
        toast.warning(message.data)
      }
    })
  }

  const handleCollaborationEvent = (message) => {
    if (message.type === 'USER_JOINED') {
      toast.info(`${message.username} joined the document`)
    } else if (message.type === 'USER_LEFT') {
      toast.info(`${message.username} left the document`)
      removeRemoteUser(message.userId)
    }
  }

  const applyRemoteOperation = (operation) => {
    if (!monacoRef.current) return
    
    isApplyingRemoteChange.current = true
    
    const editor = monacoRef.current
    const model = editor.getModel()
    
    try {
      let range
      
      if (operation.type === 'insert') {
        range = new monaco.Range(
          operation.startLine + 1,
          operation.startColumn + 1,
          operation.startLine + 1,
          operation.startColumn + 1
        )
        editor.executeEdits('remote', [
          { range, text: operation.text, forceMoveMarkers: true }
        ])
      } else if (operation.type === 'remove') {
        range = new monaco.Range(
          operation.startLine + 1,
          operation.startColumn + 1,
          operation.endLine + 1,
          operation.endColumn + 1
        )
        editor.executeEdits('remote', [
          { range, text: '', forceMoveMarkers: true }
        ])
      }
    } catch (error) {
      console.error('Error applying remote operation:', error)
    }
    
    isApplyingRemoteChange.current = false
  }

  const updateRemoteCursor = (message) => {
    setRemoteCursors(prev => {
      const newMap = new Map(prev)
      newMap.set(message.userId, {
        userId: message.userId,
        username: message.username,
        color: message.userColor,
        cursor: message.data
      })
      return newMap
    })
    updateRemoteDecorations()
  }

  const updateRemoteSelection = (message) => {
    setRemoteSelections(prev => {
      const newMap = new Map(prev)
      newMap.set(message.userId, {
        userId: message.userId,
        username: message.username,
        color: message.userColor,
        selection: message.data
      })
      return newMap
    })
    updateRemoteDecorations()
  }

  const removeRemoteUser = (userId) => {
    setRemoteCursors(prev => {
      const newMap = new Map(prev)
      newMap.delete(userId)
      return newMap
    })
    setRemoteSelections(prev => {
      const newMap = new Map(prev)
      newMap.delete(userId)
      return newMap
    })
    updateRemoteDecorations()
  }

  const updateRemoteDecorations = useCallback(() => {
    if (!monacoRef.current) return
    
    const editor = monacoRef.current
    const newDecorations = []
    
    remoteCursors.forEach((cursorData, userId) => {
      if (cursorData.cursor) {
        const line = cursorData.cursor.lineNumber
        const column = cursorData.cursor.column
        newDecorations.push({
          range: new monaco.Range(line, column, line, column),
          options: {
            className: `remote-cursor-${userId}`,
            beforeContentClassName: `remote-cursor-label-${userId}`,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        })
      }
    })
    
    remoteSelections.forEach((selectionData, userId) => {
      if (selectionData.selection && selectionData.selection.start && selectionData.selection.end) {
        const range = new monaco.Range(
          selectionData.selection.start.lineNumber + 1,
          selectionData.selection.start.column + 1,
          selectionData.selection.end.lineNumber + 1,
          selectionData.selection.end.column + 1
        )
        newDecorations.push({
          range,
          options: {
            className: `remote-selection-${userId}`,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        })
      }
    })
    
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations)
  }, [remoteCursors, remoteSelections])

  const handleEditorMount = (editor, monacoInstance) => {
    monacoRef.current = editor
    
    editor.onDidChangeModelContent((e) => {
      if (isApplyingRemoteChange.current) return
      
      e.changes.forEach(change => {
        const operation = {
          type: change.text === '' ? 'remove' : 'insert',
          startLine: change.range.startLineNumber - 1,
          startColumn: change.range.startColumn - 1,
          endLine: change.range.endLineNumber - 1,
          endColumn: change.range.endColumn - 1,
          text: change.text,
          version: editor.getModel().getVersionId()
        }
        
        websocketService.sendOperation(documentId, operation)
      })
    })

    editor.onDidChangeCursorPosition((e) => {
      if (isApplyingRemoteChange.current) return
      
      const position = e.position
      websocketService.sendCursorUpdate(documentId, {
        lineNumber: position.lineNumber,
        column: position.column
      })
    })

    editor.onDidChangeCursorSelection((e) => {
      if (isApplyingRemoteChange.current) return
      
      const selection = e.selection
      websocketService.sendSelectionUpdate(documentId, {
        start: {
          lineNumber: selection.startLineNumber - 1,
          column: selection.startColumn - 1
        },
        end: {
          lineNumber: selection.endLineNumber - 1,
          column: selection.endColumn - 1
        }
      })
    })

    editor.onDidChangeModelDecorations(() => {
      const model = editor.getModel()
      const markers = model.getMarkers()
      
      const errorDecorations = markers.map(marker => ({
        range: new monaco.Range(
          marker.startLineNumber,
          marker.startColumn,
          marker.endLineNumber,
          marker.endColumn
        ),
        options: {
          className: marker.severity === monaco.MarkerSeverity.Error 
            ? 'syntax-error' 
            : 'syntax-warning',
          hoverMessage: { value: marker.message }
        }
      }))
    })
    
    addRemoteStyles(monacoInstance)
  }

  const addRemoteStyles = (monacoInstance) => {
    remoteCursors.forEach((data, userId) => {
      const color = data.color
      addCSSStyle(`
        .remote-cursor-${userId} {
          border-left: 2px solid ${color} !important;
          margin-left: -1px;
        }
        .remote-cursor-label-${userId}::before {
          content: "${data.username}";
          background: ${color};
          color: white;
          font-size: 10px;
          padding: 2px 4px;
          border-radius: 2px;
          white-space: nowrap;
          position: relative;
          top: -18px;
        }
      `)
    })
    
    remoteSelections.forEach((data, userId) => {
      const color = data.color
      addCSSStyle(`
        .remote-selection-${userId} {
          background: ${color}40 !important;
          border: 1px solid ${color}80 !important;
        }
      `)
    })
  }

  const addCSSStyle = (css) => {
    const styleId = 'remote-collab-styles'
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    styleEl.innerHTML += css
  }

  const handleGoBack = () => {
    navigate('/dashboard')
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        Loading document...
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={handleGoBack} style={styles.backButton}>
            ← Back
          </button>
          <h1 style={styles.title}>{document?.title}</h1>
        </div>
        
        <div style={styles.collaborators}>
          <span style={styles.collabLabel}>Online: </span>
          <div style={styles.userBadge}>
            <div style={{ ...styles.userColor, backgroundColor: user.color }}></div>
            <span>{user.displayName || user.username}</span>
            <span style={styles.youBadge}>(You)</span>
          </div>
          
          {Array.from(remoteCursors.values()).map((data) => (
            <div key={data.userId} style={styles.userBadge}>
              <div style={{ ...styles.userColor, backgroundColor: data.color }}></div>
              <span>{data.username}</span>
            </div>
          ))}
        </div>
      </header>
      
      <main style={styles.editorArea}>
        {document && (
          <Editor
            height="100%"
            language="javascript"
            theme="vs-dark"
            value={document.content}
            onChange={(value) => {
              if (!isApplyingRemoteChange.current) {
                websocketService.sendContentUpdate(documentId, value || '')
              }
            }}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              fontFamily: 'Consolas, "Courier New", monospace',
              wordWrap: 'on',
              lineNumbers: 'on',
              automaticLayout: true,
              renderWhitespace: 'selection',
              tabSize: 2,
              snippetSuggestions: 'top',
              quickSuggestions: true,
              formatOnType: true,
              formatOnPaste: true,
            }}
          />
        )}
      </main>
      
      <style>{`
        .syntax-error {
          background: rgba(255, 0, 0, 0.15) !important;
          border-bottom: 2px wavy #f14c4c !important;
        }
        .syntax-warning {
          background: rgba(255, 191, 0, 0.15) !important;
          border-bottom: 2px wavy #d7ba7d !important;
        }
      `}</style>
    </div>
  )
}

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1e1e1e',
  },
  loadingContainer: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
  },
  header: {
    backgroundColor: '#252526',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #3c3c3c',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  backButton: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    color: '#3794ff',
    fontSize: '14px',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
  },
  title: {
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 600,
  },
  collaborators: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  collabLabel: {
    color: '#858585',
    fontSize: '13px',
  },
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    backgroundColor: '#2d2d2d',
    borderRadius: '4px',
  },
  userColor: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
  },
  youBadge: {
    color: '#858585',
    fontSize: '12px',
  },
  editorArea: {
    flex: 1,
    overflow: 'hidden',
  },
}

export default CodeEditor
