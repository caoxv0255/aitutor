export class SSEClient {
  constructor(url, { onMetadata, onContent, onDone, onError }) {
    this.url = url;
    this.handlers = { onMetadata, onContent, onDone, onError };
    this.controller = new AbortController();
    this.buffer = '';
    this.isConnected = false;
  }

  async connect(body) {
    this.isConnected = true;
    
    const token = this._getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: this.controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (this.isConnected) {
        const { done, value } = await reader.read();
        if (done) break;

        this.buffer += decoder.decode(value, { stream: true });
        this._parseBuffer();
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        if (this.handlers.onError) {
          this.handlers.onError(error);
        }
      }
    } finally {
      this.isConnected = false;
    }
  }

  _parseBuffer() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        this.currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          this._dispatch(this.currentEvent, data);
        } catch (e) {
          console.warn('Failed to parse SSE data:', e);
        }
      }
    }
  }

  _dispatch(event, data) {
    const handler = {
      metadata: this.handlers.onMetadata,
      content: this.handlers.onContent,
      done: this.handlers.onDone
    }[event];
    
    if (handler) {
      handler(data);
    }
  }

  abort() {
    this.isConnected = false;
    this.controller.abort();
  }

  _getToken() {
    try {
      const loginData = localStorage.getItem('aitutor_login');
      if (loginData) {
        const parsed = JSON.parse(loginData);
        if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
          return parsed.id;
        }
      }
    } catch (e) {}
    return null;
  }
}