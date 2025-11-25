// scanner.js - usa html5-qrcode para leer códigos de barras/ISBN y enviar el valor al formulario
let html5QrCode = null;
const resultContainer = document.getElementById('scanned-isbn');
const resultDisplay = document.getElementById('scanned-isbn-display');
const cameraSelect = document.getElementById('camera-select');
const startButton = document.getElementById('start-scanner');
const stopButton = document.getElementById('stop-scanner');
const testButton = document.getElementById('test-camera');
const diagnosticsDiv = document.getElementById('scanner-diagnostics');

function isISBN(str) {
  const s = str.replace(/[^0-9Xx]/g,'');
  return s.length === 10 || s.length === 13;
}

function onScanSuccess(decodedText, decodedResult) {
  console.log(`Scan result: ${decodedText}`);
  let isbn = decodedText.replace(/\D/g, '');
  if (isbn.length === 13 && (isbn.startsWith('978') || isbn.startsWith('979'))) {
    // keep as 13
  }
  if (isbn.length === 10 || isbn.length === 13) {
    if (resultContainer) {
      resultContainer.value = isbn;
      if (resultDisplay) resultDisplay.value = isbn;
      document.getElementById('isbn-form').submit();
    }
  } else {
    alert('Código detectado pero no parece un ISBN válido: ' + decodedText);
  }
}

function onScanError(errorMessage) {
  // console.log('Scan error:', errorMessage);
}

function populateCameraList() {
  if (!cameraSelect) return;
  cameraSelect.innerHTML = '';
  appendDiag('Intentando listar cámaras con Html5Qrcode.getCameras()...');
  // Try quick list first
  Html5Qrcode.getCameras().then(devices => {
    if (devices && devices.length) {
      appendDiag('Html5Qrcode.getCameras() encontró ' + devices.length + ' dispositivos.');
      devices.forEach((dev, idx) => {
        const opt = document.createElement('option');
        opt.value = dev.id;
        opt.textContent = dev.label || `Camera ${idx+1}`;
        cameraSelect.appendChild(opt);
      });
      return;
    }

    appendDiag('No se encontraron cámaras en la primera pasada. Intentando forzar prompt de permiso...');

    // If nothing found or labels are empty, try to prompt for permission then re-enumerate
    const tryPromptAndList = async () => {
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
        appendDiag('API mediaDevices.getUserMedia no disponible en este navegador.');
        const opt = document.createElement('option'); opt.value = ''; opt.textContent = 'API de cámara no disponible'; cameraSelect.appendChild(opt);
        return;
      }

      try {
        appendDiag('Solicitando permiso de cámara (getUserMedia) para revelar etiquetas de dispositivo...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        try { stream.getTracks().forEach(t => t.stop()); } catch(e){}
      } catch (permErr) {
        appendDiag('Permiso denegado o error al solicitar permiso: ' + (permErr && permErr.message ? permErr.message : permErr));
        const opt = document.createElement('option'); opt.value = ''; opt.textContent = 'Permiso de cámara denegado o no disponible'; cameraSelect.appendChild(opt);
        return;
      }

      // After permission granted, try to enumerate devices using navigator.mediaDevices
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devs.filter(d => d.kind === 'videoinput');
        appendDiag('enumerateDevices encontró ' + videoInputs.length + ' videoinput(s).');
        if (videoInputs && videoInputs.length) {
          videoInputs.forEach((dev, idx) => {
            const opt = document.createElement('option');
            opt.value = dev.deviceId || '';
            opt.textContent = dev.label || `Camera ${idx+1}`;
            cameraSelect.appendChild(opt);
          });
          return;
        }
      } catch (enumErr) {
        appendDiag('Error al enumerar dispositivos tras permiso: ' + (enumErr && enumErr.message ? enumErr.message : enumErr));
      }

      // Last resort: call Html5Qrcode.getCameras() again
      try {
        const devs2 = await Html5Qrcode.getCameras();
        if (devs2 && devs2.length) {
          appendDiag('Html5Qrcode.getCameras() (2ª pasada) encontró ' + devs2.length + ' dispositivos.');
          devs2.forEach((dev, idx) => {
            const opt = document.createElement('option');
            opt.value = dev.id;
            opt.textContent = dev.label || `Camera ${idx+1}`;
            cameraSelect.appendChild(opt);
          });
          return;
        }
      } catch (e2) {
        appendDiag('Error en Html5Qrcode.getCameras() 2ª pasada: ' + (e2 && e2.message ? e2.message : e2));
      }

      // If still nothing, show fallback message
      const opt = document.createElement('option'); opt.value = ''; opt.textContent = 'No se detectaron cámaras'; cameraSelect.appendChild(opt);
    };

    tryPromptAndList();
  }).catch(err => {
    console.error('Error al obtener cámaras (Html5Qrcode.getCameras):', err);
    appendDiag('Error al obtener cámaras con Html5Qrcode.getCameras(): ' + (err && err.message ? err.message : err));
    const opt = document.createElement('option'); opt.value = ''; opt.textContent = 'Error al listar cámaras'; cameraSelect.appendChild(opt);
  });
}

function appendDiag(msg) {
  try {
    if (!diagnosticsDiv) return;
    const p = document.createElement('div');
    p.textContent = msg;
    diagnosticsDiv.appendChild(p);
  } catch(e){ console.warn('diag error', e); }
}

function clearDiag(){ if(diagnosticsDiv) diagnosticsDiv.innerHTML = ''; }

async function enumerateAndReport(){
  clearDiag();
  appendDiag('Enumerando dispositivos...');
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    appendDiag('API navigator.mediaDevices.enumerateDevices no disponible en este navegador.');
    return;
  }
  try{
    const devices = await navigator.mediaDevices.enumerateDevices();
    devices.forEach((d, i) => appendDiag(`${i+1}. kind=${d.kind} label='${d.label}' id=${d.deviceId}`));
  }catch(e){
    appendDiag('Error enumerating devices: ' + e.message);
  }

  // permissions query (if supported)
  if (navigator.permissions && navigator.permissions.query) {
    try{
      const p = await navigator.permissions.query({ name: 'camera' });
      appendDiag('Permiso cámara: ' + p.state);
    }catch(e){
      // some browsers don't support querying 'camera'
    }
  }
}

async function testCameraPreview(deviceId){
  // Create an ephemeral video element to check camera stream
  clearDiag();
  appendDiag('Solicitando acceso a la cámara...');
  let constraints = { video: true };
  if (deviceId) constraints = { video: { deviceId: { exact: deviceId } } };
  let stream = null;
  try{
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    appendDiag('Acceso concedido. Mostrando vista previa por 5s...');
    const video = document.createElement('video');
    video.style.maxWidth = '240px';
    video.style.display = 'block';
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    diagnosticsDiv.appendChild(video);
    // stop after 5 seconds
    setTimeout(()=>{
      try{ stream.getTracks().forEach(t=>t.stop()); }catch(e){}
      try{ video.remove(); }catch(e){}
      appendDiag('Vista previa detenida.');
    }, 5000);
  }catch(err){
    appendDiag('Error al obtener stream de cámara: ' + (err && err.message ? err.message : err));
    if (stream){ try{ stream.getTracks().forEach(t=>t.stop()); }catch(e){} }
  }
}

async function startScannerWithCamera(cameraId) {
  appendDiag('Iniciando escáner con cameraId: ' + (cameraId || '<auto>'));
  if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
  // If already running, stop first (ignore errors)
  try {
    appendDiag('Deteniendo escáner si estaba en ejecución...');
    await html5QrCode.stop();
    try { html5QrCode.clear(); } catch(e){}
  } catch(e) {
    // ignore if not running or method not available
  }

  // Helper to attempt start and handle errors
  const tryStart = async (camParam, desc) => {
    appendDiag('Intentando start con: ' + desc);
    try {
      if (!window.Html5Qrcode) {
        appendDiag('ERROR: Html5Qrcode no está definido en window. ¿Se cargó la librería CDN?');
        return false;
      }
      if (!document.getElementById('reader')) {
        appendDiag('ERROR: No existe elemento con id "reader" en la página.');
        return false;
      }

      // Race between start() promise and a timeout to detect hangs
      const startPromise = html5QrCode.start(
        camParam,
        { fps: 10, qrbox: 250 },
        (decodedText, decodedResult) => {
          try { onScanSuccess(decodedText, decodedResult); } catch(e){ console.error('onScanSuccess error', e); }
        },
        (errorMessage) => { try { onScanError(errorMessage); } catch(e){ console.error('onScanError error', e); } }
      );

      const timed = await Promise.race([
        startPromise,
        new Promise((_, rej) => setTimeout(() => rej(new Error('start-timeout')), 7000))
      ]);

      appendDiag('Escáner iniciado correctamente con: ' + desc);
      return true;
    } catch (err) {
      try {
        console.error('Error al iniciar con ' + desc + ':', err);
        const name = err && err.name ? err.name : 'Error';
        const msg = err && err.message ? err.message : String(err);
        appendDiag('Error al iniciar con ' + desc + ': ' + name + ' - ' + msg);
        if (err && err.stack) appendDiag('Stack: ' + err.stack);
      } catch (ee) { console.warn('diag append failed', ee); }
      return false;
    }
  };

  // Sequential attempts with diagnostic logs
  try {
    // If no cameraId, try to list devices and pick first
    if (!cameraId) {
      appendDiag('No cameraId proporcionado — listando dispositivos...');
      try {
        const devices = await Html5Qrcode.getCameras();
        appendDiag('Html5Qrcode.getCameras() retornó ' + (devices ? devices.length : 0) + ' dispositivos');
        if (devices && devices.length) {
          cameraId = devices[0].id;
          appendDiag('Usando primer dispositivo listado: ' + (devices[0].label || devices[0].id));
        }
      } catch(e) {
        appendDiag('No se pudieron obtener cámaras para auto-escoger: ' + (e && e.message ? e.message : e));
      }
    }

    // Try start with cameraId string first (if available)
    if (cameraId) {
      appendDiag('Intentando iniciar con cameraId: ' + cameraId);
      const ok = await tryStart(cameraId, 'cameraId');
      if (ok) return;
    }

    // Try with facingMode environment
    appendDiag('Intentando iniciar con facingMode exact environment');
    const okFacing = await tryStart({ facingMode: { exact: 'environment' } }, 'facingMode=environment');
    if (okFacing) return;

    // Try with generic facingMode
    appendDiag('Intentando iniciar con facingMode fallback');
    const okFacing2 = await tryStart({ facingMode: 'environment' }, 'facingMode (fallback)');
    if (okFacing2) return;

    // Try with default camera param
    appendDiag('Intentando iniciar con parámetro por defecto');
    const okDefault = await tryStart({ deviceId: undefined }, 'default');
    if (okDefault) return;

    appendDiag('No se pudo iniciar el escáner con ninguno de los métodos probados.');
  } catch (e) {
    appendDiag('Error inesperado durante el proceso de inicio: ' + (e && e.message ? e.message : e));
  }
}

function stopScanner() {
  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      // clear camera preview
      try { html5QrCode.clear(); } catch(e){}
    }).catch(err => {
      console.warn('Error stopping scanner', err);
    });
  }
}

window.addEventListener('load', () => {
  // populate camera list on load
  try { populateCameraList(); } catch(e){ console.warn('No se pudo listar cámaras', e); }
  // Auto-start scanner for convenience (if camera available)
  try { startScannerWithCamera().catch(e => console.warn('No se pudo iniciar el scanner automáticamente.', e)); } catch(e) { console.warn('No se pudo iniciar el scanner automáticamente.', e); }

  if (startButton) startButton.addEventListener('click', (e) => {
    e.preventDefault();
    const cam = cameraSelect ? cameraSelect.value : null;
    startScannerWithCamera(cam).catch(err => console.warn('Error starting scanner from button', err));
  });
  if (stopButton) stopButton.addEventListener('click', (e) => {
    e.preventDefault();
    stopScanner();
  });

  if (testButton) testButton.addEventListener('click', (e)=>{
    e.preventDefault();
    const cam = cameraSelect ? cameraSelect.value : null;
    // if cam empty, pass null to use default
    testCameraPreview(cam || null);
  });

  // run enumeration report to help debug
  try{ enumerateAndReport(); }catch(e){ console.warn('enumeration failed', e); }

  // Si el usuario escribe manualmente, copiar al hidden antes de enviar
  const isbnForm = document.getElementById('isbn-form');
  if (isbnForm) {
    isbnForm.addEventListener('submit', (e) => {
      if (resultDisplay && resultContainer) {
        const v = resultDisplay.value.trim();
        // normalizar: quitar espacios y caracteres no relevantes
        resultContainer.value = v.replace(/[^0-9Xx-]/g, '');
      }
    });
  }
});
