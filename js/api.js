// ChurchTech - AI API Integration Module
// Handles Deepgram (Speech-to-Text) and OpenAI (Dynamic Prompt & Model Text Structuring)

class AIIntegration {
  constructor() {
    this.deepgramApiKey = localStorage.getItem('deepgramApiKey');
    this.deepgramModel = localStorage.getItem('deepgramModel') || 'nova-3';
    this.deepgramLanguage = localStorage.getItem('deepgramLanguage') || 'en-US';
    
    // Rich default keyterm boosting for Church AV and IT terms
    const defaultChurchKeyterms = 'Dante, ATEM, ProPresenter, Behringer, X32, Allen & Heath, SQ, dLive, Shure, ULXD, QLXD, Axient, Sennheiser, QSC, SDI, NDI, PTZ, FOH, IEM, stagebox, phantom power, submix, talkback, vMix, Companion, Stream Deck, Birddog, Luminex, DMX, Chauvet, ETC, aux send, matrix, multicores, gain staging, balanced cable, speakON, etherCON';
    this.deepgramKeyterms = localStorage.getItem('deepgramKeyterms') || defaultChurchKeyterms;
    
    this.openaiApiKey = localStorage.getItem('openaiApiKey');
    this.audioDeviceId = localStorage.getItem('audioDeviceId') || 'default';
    
    this.isRecording = false;
    this.socket = null;
    this.mediaRecorder = null;
    this.mediaStream = null;
  }

  // Get available audio input devices
  async getAudioInputDevices() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.warn('Media devices API not supported');
        return [];
      }

      // Enumerate devices without opening an audio stream to avoid mic-activation chimes
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (error) {
      console.error('Error getting audio devices:', error);
      return [];
    }
  }

  // Set audio input device
  setAudioInputDevice(deviceId) {
    this.audioDeviceId = deviceId;
    localStorage.setItem('audioDeviceId', deviceId);
  }

  // ============ DEEPGRAM SPEECH-TO-TEXT ============

  // Toggle speech-to-text
  async toggleSpeechToText(onTranscriptReceived, onStatusChange) {
    if (this.isRecording) {
      this.stopRealtimeTranscription();
      if (onStatusChange) onStatusChange(false);
      return false;
    } else {
      const started = await this.startRealtimeTranscription(onTranscriptReceived);
      if (started && onStatusChange) onStatusChange(true);
      return started;
    }
  }

  // Start real-time transcription
  async startRealtimeTranscription(onTranscriptReceived) {
    try {
      this.deepgramApiKey = localStorage.getItem('deepgramApiKey');
      this.deepgramModel = localStorage.getItem('deepgramModel') || 'nova-3';
      this.deepgramLanguage = localStorage.getItem('deepgramLanguage') || 'en-US';
      this.deepgramKeyterms = localStorage.getItem('deepgramKeyterms') || '';

      if (!this.deepgramApiKey) {
        showNotification('Please configure your Deepgram API key in Settings first', 'warning');
        return false;
      }

      showNotification('🎤 Initializing microphone and Deepgram stream...', 'info');

      // Check for Secure Context
      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        showNotification('Microphone access requires HTTPS. Please connect via HTTPS.', 'error');
        return false;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showNotification('Your browser does not support microphone access.', 'error');
        return false;
      }

      // Audio stream constraints
      const constraints = {
        audio: {
          deviceId: this.audioDeviceId !== 'default' ? { exact: this.audioDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Build Deepgram WebSocket URL
      let wsUrl = `wss://api.deepgram.com/v1/listen?model=${this.deepgramModel}&language=${this.deepgramLanguage}&smart_format=true&interim_results=true&vad_events=true&channels=1`;

      if (this.deepgramKeyterms) {
        const terms = this.deepgramKeyterms.split(',').map(t => t.trim()).filter(t => t.length > 0);
        terms.forEach(term => {
          wsUrl += `&keyterm=${encodeURIComponent(term)}`;
        });
      }

      this.socket = new WebSocket(wsUrl, ['token', this.deepgramApiKey]);

      this.socket.onopen = () => {
        console.log('[Deepgram] WebSocket connected');
        showNotification('🔴 Listening... Speak clearly into your microphone', 'success');

        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }

        this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });

        this.mediaRecorder.addEventListener('dataavailable', async (event) => {
          if (event.data.size > 0 && this.socket && this.socket.readyState === WebSocket.OPEN) {
            const buffer = await event.data.arrayBuffer();
            this.socket.send(buffer);
          }
        });

        this.mediaRecorder.start(400); // 400ms chunks for smooth real-time STT
        this.isRecording = true;
      };

      this.socket.onmessage = (message) => {
        try {
          const received = JSON.parse(message.data);
          const transcript = received.channel?.alternatives?.[0]?.transcript;

          if (transcript && onTranscriptReceived) {
            if (received.is_final) {
              onTranscriptReceived(transcript, true);
            }
          }
        } catch (error) {
          console.error('[Deepgram] Error parsing transcript message:', error);
        }
      };

      this.socket.onclose = (event) => {
        console.log('[Deepgram] WebSocket closed', event.code, event.reason);
        if (this.isRecording) {
          this.stopRealtimeTranscription();
        }
      };

      this.socket.onerror = (error) => {
        console.error('[Deepgram] WebSocket error:', error);
        showNotification('Deepgram connection error. Check your API key.', 'error');
        this.stopRealtimeTranscription();
      };

      return true;
    } catch (error) {
      console.error('Error starting transcription:', error);
      showNotification('Could not start microphone: ' + error.message, 'error');
      this.stopRealtimeTranscription();
      return false;
    }
  }

  // Stop real-time transcription
  stopRealtimeTranscription() {
    this.isRecording = false;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch (e) {}
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'CloseStream' }));
        this.socket.close();
      }
      this.socket = null;
    }
  }

  // ============ OPENAI DYNAMIC MODEL & PROMPT TEXT REVISION ============

  // Structure and revise text using selected prompt and arbitrary model
  async reviseTextWithOpenAI(rawText, promptTemplate = null, modelOverride = null) {
    try {
      this.openaiApiKey = localStorage.getItem('openaiApiKey');

      if (!this.openaiApiKey) {
        showNotification('Please configure your OpenAI API key in Settings first', 'warning');
        return null;
      }

      if (!rawText || rawText.trim() === '') {
        showNotification('Please record or enter some notes to structure', 'warning');
        return null;
      }

      // Determine model to use: Model override -> Selected model in promptManager -> fallback
      const model = modelOverride || promptManager.getSelectedModel() || 'gpt-4o';

      // Determine system prompt
      const systemInstruction = typeof promptTemplate === 'string'
        ? promptTemplate
        : (promptTemplate?.prompt || (typeof categoryManager !== 'undefined' ? categoryManager.getDefaultPrompt() : 'You are an expert Church AV and IT Systems Engineer. Convert these notes into a structured document.'));

      showNotification(`✨ Calling OpenAI (${model})... Structuring documentation`, 'info');

      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: systemInstruction
            },
            {
              role: 'user',
              content: `Here are the raw technical notes to structure into documentation:\n\n${rawText}`
            }
          ],
          temperature: 0.3 // Lower temperature for factual, precise technical documentation
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const revisedText = data.choices?.[0]?.message?.content || '';

      if (!revisedText) {
        showNotification('No revision returned from OpenAI', 'warning');
        return null;
      }

      showNotification(`✅ Note structured successfully with ${model}!`, 'success');
      return {
        content: revisedText,
        model: model,
        promptId: promptTemplate?.id || 'custom'
      };

    } catch (error) {
      console.error('OpenAI Structuring Error:', error);
      showNotification('Error structuring note: ' + error.message, 'error');
      return null;
    }
  }

  // Update Deepgram settings
  updateDeepgramSettings(apiKey, model, language, keyterms) {
    if (apiKey) {
      localStorage.setItem('deepgramApiKey', apiKey);
      this.deepgramApiKey = apiKey;
    }
    if (model) {
      localStorage.setItem('deepgramModel', model);
      this.deepgramModel = model;
    }
    if (language) {
      localStorage.setItem('deepgramLanguage', language);
      this.deepgramLanguage = language;
    }
    if (keyterms !== undefined) {
      localStorage.setItem('deepgramKeyterms', keyterms);
      this.deepgramKeyterms = keyterms;
    }
    return true;
  }

  // Update OpenAI settings
  updateOpenAISettings(apiKey, model) {
    if (apiKey) {
      localStorage.setItem('openaiApiKey', apiKey);
      this.openaiApiKey = apiKey;
    }
    if (model) {
      promptManager.setSelectedModel(model);
    }
    return true;
  }

  // Clear API keys
  clearSensitiveData() {
    localStorage.removeItem('deepgramApiKey');
    localStorage.removeItem('openaiApiKey');
    this.deepgramApiKey = null;
    this.openaiApiKey = null;
    return true;
  }
}

// Global AI Integration instance
const aiIntegration = new AIIntegration();
