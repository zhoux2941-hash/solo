import SockJS from 'sockjs-client'
import Stomp from 'stompjs'

class WebSocketService {
  constructor() {
    this.stompClient = null
    this.subscriptions = new Map()
    this.isConnected = false
    this.userId = null
    this.username = null
    this.userColor = null
    this.currentDocumentId = null
  }

  connect(userId, username, userColor) {
    return new Promise((resolve, reject) => {
      this.userId = userId
      this.username = username
      this.userColor = userColor
      
      const socket = new SockJS('/ws')
      this.stompClient = Stomp.over(socket)
      
      this.stompClient.connect({}, () => {
        this.isConnected = true
        console.log('WebSocket connected')
        resolve()
      }, (error) => {
        console.error('WebSocket connection error:', error)
        reject(error)
      })
    })
  }

  disconnect() {
    if (this.currentDocumentId) {
      this.leaveDocument(this.currentDocumentId)
    }
    
    if (this.stompClient && this.isConnected) {
      this.stompClient.disconnect()
      this.isConnected = false
      this.subscriptions.clear()
      console.log('WebSocket disconnected')
    }
  }

  joinDocument(documentId) {
    if (!this.stompClient || !this.isConnected) {
      console.error('WebSocket not connected')
      return
    }
    
    this.currentDocumentId = documentId
    
    this.stompClient.send(
      `/app/document/${documentId}/join`,
      {},
      JSON.stringify({
        userId: this.userId,
        username: this.username,
        userColor: this.userColor
      })
    )
  }

  leaveDocument(documentId) {
    if (!this.stompClient || !this.isConnected) return
    
    this.stompClient.send(
      `/app/document/${documentId}/leave`,
      {},
      JSON.stringify({
        userId: this.userId,
        username: this.username
      })
    )
    
    this.unsubscribeAll(documentId)
    this.currentDocumentId = null
  }

  subscribe(topic, callback) {
    if (!this.stompClient || !this.isConnected) return
    
    const subscription = this.stompClient.subscribe(topic, (message) => {
      const body = JSON.parse(message.body)
      callback(body)
    })
    
    const key = `${topic}-${Date.now()}`
    this.subscriptions.set(key, subscription)
    
    return () => {
      subscription.unsubscribe()
      this.subscriptions.delete(key)
    }
  }

  unsubscribeAll(documentId) {
    this.subscriptions.forEach((subscription, key) => {
      if (key.includes(documentId)) {
        subscription.unsubscribe()
        this.subscriptions.delete(key)
      }
    })
  }

  sendOperation(documentId, operation) {
    if (!this.stompClient || !this.isConnected) return
    
    this.stompClient.send(
      `/app/document/${documentId}/operation`,
      {},
      JSON.stringify({
        ...operation,
        userId: this.userId,
        timestamp: Date.now()
      })
    )
  }

  sendCursorUpdate(documentId, cursor) {
    if (!this.stompClient || !this.isConnected) return
    
    this.stompClient.send(
      `/app/document/${documentId}/cursor`,
      {},
      JSON.stringify({
        userId: this.userId,
        cursor: cursor
      })
    )
  }

  sendSelectionUpdate(documentId, selection) {
    if (!this.stompClient || !this.isConnected) return
    
    this.stompClient.send(
      `/app/document/${documentId}/selection`,
      {},
      JSON.stringify({
        userId: this.userId,
        selection: selection
      })
    )
  }

  sendContentUpdate(documentId, content) {
    if (!this.stompClient || !this.isConnected) return
    
    this.stompClient.send(
      `/app/document/${documentId}/content`,
      {},
      JSON.stringify({
        userId: this.userId,
        content: content
      })
    )
  }
}

const websocketService = new WebSocketService()
export default websocketService
