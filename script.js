
    const state = {
      theme: 'dark',
      selectedFile: null,
      selectedFormat: 'xml',
      downloads: []
    };

    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    const startTodayBtn = document.getElementById('startTodayBtn');
    const navLinks = document.querySelectorAll('.nav-link');
    const panelNames = ['converter', 'downloads', 'privacy'];
    const fileInput = document.getElementById('fileInput');
    const uploadZone = document.getElementById('uploadZone');
    const fileSummary = document.getElementById('fileSummary');
    const fileNameLabel = document.getElementById('fileNameLabel');
    const fileSizeLabel = document.getElementById('fileSizeLabel');
    const convertBtn = document.getElementById('convertBtn');
    const downloadsList = document.getElementById('downloadsList');
    const activityFeed = document.getElementById('activityFeed');
    const outputChips = document.querySelectorAll('.chip');

    function formatBytes(bytes) {
      if (!bytes || Number.isNaN(bytes)) return '0 KB';
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = bytes;
      let unitIndex = 0;
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
      }
      return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
    }

    function setTheme(theme) {
      state.theme = theme;
      body.setAttribute('data-theme', theme);
      themeToggle.textContent = theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode';
    }

    function triggerReveal() {
      document.querySelectorAll('.reveal-item').forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.top < window.innerHeight - 40) {
          element.classList.add('visible');
        }
      });
    }

    function switchPanel(panelId) {
      panelNames.forEach((name) => {
        const panel = document.getElementById(`panel-${name}`);
        if (panel) {
          panel.classList.toggle('active-panel', name === panelId);
        }
      });

      navLinks.forEach((link) => {
        link.classList.toggle('active', link.dataset.panel === panelId);
      });
    }

    function enterApp() {
      body.classList.add('app-active');
      switchPanel('converter');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function addLogMessage(title, text, symbol = '✓') {
      const logRow = document.createElement('div');
      logRow.className = 'log-node';
      logRow.innerHTML = `
        <div class="log-node-indicator">${symbol}</div>
        <div class="log-node-body">
          <strong>${title}</strong>
          <p>${text}</p>
        </div>
      `;
      activityFeed.prepend(logRow);
      while (activityFeed.children.length > 4) {
        activityFeed.removeChild(activityFeed.lastChild);
      }
    }

    function setSelectedOutput(format) {
      state.selectedFormat = format;
      outputChips.forEach((chip) => {
        chip.classList.toggle('selected', chip.dataset.format === format);
      });
    }

    function addDownloadItem(name, label) {
      const item = document.createElement('div');
      item.className = 'download-item';
      item.innerHTML = `
        <div class="download-item-main">
          <div class="download-icon">↓</div>
          <div class="download-meta">
            <strong>${name}</strong>
            <span>${label} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        <a href="#" class="download-link">Download</a>
      `;
      downloadsList.prepend(item);
    }

    function createXmlManifest(file) {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<audio-manifest>
  <source>
    <fileName>${file.name}</fileName>
    <sizeBytes>${file.size}</sizeBytes>
    <mimeType>${file.type || 'audio/mpeg'}</mimeType>
    <generatedAt>${new Date().toISOString()}</generatedAt>
  </source>
  <target>
    <format>${state.selectedFormat}</format>
    <profile>Local Browser Export</profile>
    <status>Converted</status>
  </target>
  <metadata>
    <bitrate>128 kbps</bitrate>
    <channels>stereo</channels>
    <workflow>secure-local</workflow>
  </metadata>
</audio-manifest>`;
      return xml;
    }

    function encodeWav(audioBuffer) {
      const numberOfChannels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      const format = 1;
      const bitDepth = 16;
      const bytesPerSample = bitDepth / 8;
      const blockAlign = numberOfChannels * bytesPerSample;
      const dataLength = audioBuffer.length * blockAlign;
      const arrayBuffer = new ArrayBuffer(44 + dataLength);
      const view = new DataView(arrayBuffer);

      const writeString = (offset, text) => {
        for (let i = 0; i < text.length; i += 1) {
          view.setUint8(offset + i, text.charCodeAt(i));
        }
      };

      writeString(0, 'RIFF');
      view.setUint32(4, 36 + dataLength, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, format, true);
      view.setUint16(22, numberOfChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitDepth, true);
      writeString(36, 'data');
      view.setUint32(40, dataLength, true);

      let offset = 44;
      for (let i = 0; i < audioBuffer.length; i += 1) {
        for (let channel = 0; channel < numberOfChannels; channel += 1) {
          const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
          offset += 2;
        }
      }

      return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    async function runLocalConversion() {
      if (!state.selectedFile) {
        addLogMessage('No file selected', 'Please upload a valid MP3 file before starting a conversion.', '!');
        return;
      }

      const sourceName = state.selectedFile.name.replace(/\.[^.]+$/, '');
      const outputFormat = state.selectedFormat;

      if (outputFormat === 'xml') {
        const xmlBlob = new Blob([createXmlManifest(state.selectedFile)], { type: 'application/xml' });
        const xmlName = `${sourceName}.xml`;
        const url = URL.createObjectURL(xmlBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = xmlName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addDownloadItem(xmlName, 'XML Data');
        addLogMessage('XML export complete', `Metadata package generated for ${state.selectedFile.name}.`, '✓');
        return;
      }

      try {
        addLogMessage('Conversion started', `Preparing ${state.selectedFile.name} for ${outputFormat.toUpperCase()} export.`, '↻');
        const audioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!audioContextClass) {
          throw new Error('Web Audio is unavailable in this browser.');
        }

        const audioContext = new audioContextClass();
        const arrayBuffer = await state.selectedFile.arrayBuffer();
        const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const wavBlob = encodeWav(decoded);
        const exportName = `${sourceName}.wav`;
        const url = URL.createObjectURL(wavBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = exportName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        await audioContext.close();

        const formatNote = outputFormat === 'wav'
          ? 'High-fidelity WAV output generated successfully.'
          : `Native ${outputFormat.toUpperCase()} browser encoding is not available in this runtime, so a secure WAV fallback was exported instead.`;

        addDownloadItem(exportName, 'WAV');
        addLogMessage('Audio export complete', formatNote, '✓');
      } catch (error) {
        console.error(error);
        addLogMessage('Conversion failed', 'The selected MP3 could not be decoded in this browser runtime.', '!');
      }
    }

    function selectFile(file) {
      if (!file) return;
      const isValidMp3 = /\.mp3$/i.test(file.name) || file.type === 'audio/mpeg';
      if (!isValidMp3) {
        addLogMessage('Unsupported file', 'Please select a valid MP3 file before conversion.', '!');
        return;
      }

      state.selectedFile = file;
      const uploadContent = uploadZone.querySelector('div');
      uploadContent.innerHTML = `
        <div class="upload-icon" aria-hidden="true">✓</div>
        <strong>${file.name}</strong>
        <span>Ready for conversion.</span>
      `;
      uploadZone.classList.add('is-ready');
      fileSummary.hidden = false;
      fileNameLabel.textContent = file.name;
      fileSizeLabel.textContent = formatBytes(file.size);
      addLogMessage('File detected', `${file.name} is ready for export.`, '✓');
    }

    function bindEvents() {
      themeToggle.addEventListener('click', () => {
        setTheme(state.theme === 'dark' ? 'light' : 'dark');
      });

      startTodayBtn.addEventListener('click', enterApp);

      navLinks.forEach((link) => {
        link.addEventListener('click', () => {
          const panel = link.dataset.panel;
          body.classList.add('app-active');
          switchPanel(panel);
        });
      });

      document.querySelector('.secondary-btn[data-panel="privacy"]').addEventListener('click', () => {
        body.classList.add('app-active');
        switchPanel('privacy');
      });

      outputChips.forEach((chip) => {
        chip.addEventListener('click', () => {
          setSelectedOutput(chip.dataset.format);
        });
      });

      convertBtn.addEventListener('click', runLocalConversion);

      fileInput.addEventListener('change', (event) => {
        const [file] = event.target.files;
        if (file) selectFile(file);
      });

      uploadZone.addEventListener('click', () => fileInput.click());
      uploadZone.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          fileInput.click();
        }
      });

      ['dragenter', 'dragover'].forEach((eventName) => {
        uploadZone.addEventListener(eventName, (event) => {
          event.preventDefault();
          uploadZone.style.borderColor = 'rgba(56, 189, 248, 0.8)';
        });
      });

      ['dragleave', 'drop'].forEach((eventName) => {
        uploadZone.addEventListener(eventName, (event) => {
          event.preventDefault();
          uploadZone.style.borderColor = 'rgba(139, 92, 246, 0.36)';
        });
      });

      uploadZone.addEventListener('drop', (event) => {
        event.preventDefault();
        const [file] = event.dataTransfer.files;
        if (file) selectFile(file);
      });
    }

    function seedDownloads() {
      downloadsList.innerHTML = '';
      const starterDownloads = [
        { name: 'studio-export.xml', type: 'XML Data' },
        { name: 'master-track.wav', type: 'WAV' }
      ];
      starterDownloads.forEach((item) => addDownloadItem(item.name, item.type));
    }

    function init() {
      bindEvents();
      seedDownloads();
      setTheme('dark');
      switchPanel('converter');
      window.addEventListener('scroll', triggerReveal, { passive: true });
      window.addEventListener('load', triggerReveal);
    }

    init();
  