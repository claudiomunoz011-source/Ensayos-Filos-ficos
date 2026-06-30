// Connect to Socket.io server
const socket = io();

// Constants & Globals
let currentReport = null;
let teacherToken = null;
let allEssays = [];
let simulationCases = [];

// DOM Elements
const editor = document.getElementById('essay-editor');
const wordCountSpan = document.getElementById('word-count');
const wordCounterBadge = document.getElementById('word-counter-badge');
const progressBar = document.getElementById('editor-progress-bar');
const submitBtn = document.getElementById('btn-submit');
const queueOverlay = document.getElementById('queue-overlay');

// Fallback simulation cases if fetch fails
const fallbackSimulationCases = [
  {
    "id": "sim-poveda-estandar",
    "estudiante": "Carlos Muñoz",
    "curso": "3° Medio A",
    "colegio": "Liceo San Pedro Poveda",
    "tipo": "Estándar",
    "ensayo": "En este ensayo se analiza la etica de Kant. El filosofo aleman havia propuesto que las acciones humanas deben regirse por el deber. Kant decia que debemos actuar de tal manera que nuestra maxima se convierta en ley universal, lo que el llama el imperativo categorico. Sin embargo, considero que esta postura es muy rigida porque a veces las consecuencias son mas importantes que el deber en si. Por lo tanto, hay situaciones donde mentir para salvar una vida es moralmente correcto, lo que contradice el rigorismo kantiano. En conclusion, la moral no puede ser absoluta y debe evaluar el contexto."
  },
  {
    "id": "sim-aleman-tda",
    "estudiante": "Sofía Landeta",
    "curso": "4° Medio C",
    "colegio": "Colegio Alemán",
    "tipo": "Diferenciado (Con apoyo metodológico)",
    "ensayo": "Yo creo que la libertad es super importante para el ser humano. El filosofo Nietzsche decia que la vida es voluntad de poder y que debemos superar los valores antiguos para ser libres. Pero a veces es dificil porque la sociedad nos impone reglas. Nietzsche decia que 'el hombre es una cuerda tendida entre la bestia y el superhombre'. Tambien creo que Kant tenia razon cuando decia que todo conocimiento viene de la esperiencia y los sentidos, porque si no tocamos las cosas no podemos saber como son. Por lo tanto, la libertad es una ilusion si no tenemos esperiencia de la realidad."
  }
];

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  populateCourseSelector();
  updateCollegeInfo();
  loadDemos();

  // Listen to WebSocket progress updates
  socket.on('status_update', handleQueueStatusUpdate);

  // Listen for real-time submission notification (updates teacher panel dynamically if logged in)
  socket.on('essay_submitted_notification', (essayInfo) => {
    if (teacherToken) {
      allEssays.push(essayInfo);
      renderTeacherDashboard();
    }
  });

  // Event delegation listener for spelling highlights in the viewer
  const viewer = document.getElementById('rep-text-viewer');
  if (viewer) {
    viewer.addEventListener('click', (e) => {
      const span = e.target.closest('.spell-error-highlight');
      if (span) {
        const index = span.getAttribute('data-index');
        const sugerencia = span.getAttribute('data-sugerencia');
        const explicacion = span.getAttribute('data-explicacion');
        window.selectErrorSpan(index, sugerencia, explicacion);
      }
    });
  }
});

// ==========================================
// FORM SETUP & CONTROLS
// ==========================================

function populateCourseSelector() {
  const select = document.getElementById('student-course');
  const grades = [
    "7° Básico",
    "8° Básico",
    "1° Medio",
    "2° Medio",
    "3° Medio",
    "4° Medio"
  ];
  const sections = ["A", "B", "C", "D", "E", "F", "G"];

  grades.forEach(grade => {
    const optGroup = document.createElement('optgroup');
    optGroup.label = grade;
    
    sections.forEach(sec => {
      const opt = document.createElement('option');
      opt.value = `${grade} ${sec}`;
      opt.innerText = `${grade} ${sec}`;
      optGroup.appendChild(opt);
    });
    
    select.appendChild(optGroup);
  });
}

function updateCollegeInfo() {
  const college = document.getElementById('student-college').value;
  const helpInfo = document.getElementById('college-info-help');
  if (college === 'Colegio Alemán') {
    helpInfo.innerText = "Nivel de rigurosidad: Colegio Alemán (45% Flexible)";
  } else {
    helpInfo.innerText = "Nivel de rigurosidad: Liceo San Pedro Poveda (60% Exigente)";
  }
}

function toggleDuaRecommendation(isActive) {
  const badge = document.getElementById('dua-recommendation-badge');
  if (isActive) {
    badge.classList.remove('hide');
  } else {
    badge.classList.add('hide');
  }
}

// ==========================================
// EDITOR WORD COUNT & WRITING LOCK
// ==========================================

function handleEditorInput() {
  const text = editor.value.trim();
  const words = text === "" ? [] : text.split(/\s+/);
  
  if (words.length > 1500) {
    // Cut text to exactly 1500 words
    const cutIndex = getWordCutIndex(editor.value, 1500);
    editor.value = editor.value.substring(0, cutIndex);
    
    const newText = editor.value.trim();
    const newWords = newText === "" ? [] : newText.split(/\s+/);
    wordCountSpan.innerText = newWords.length;
  } else {
    wordCountSpan.innerText = words.length;
  }
  
  // Update progress bar percentage
  const percent = Math.min((words.length / 1500) * 100, 100);
  progressBar.style.width = `${percent}%`;
  
  // Visual limit warning
  if (words.length >= 1500) {
    wordCounterBadge.className = "word-counter-badge danger";
  } else if (words.length >= 1350) {
    wordCounterBadge.className = "word-counter-badge warning";
  } else {
    wordCounterBadge.className = "word-counter-badge";
  }
}

// Find cutting point index in text after N words
function getWordCutIndex(text, limit) {
  let count = 0;
  let i = 0;
  let inWord = false;
  while (i < text.length) {
    const char = text[i];
    const isWhitespace = /\s/.test(char);
    if (!isWhitespace && !inWord) {
      inWord = true;
      count++;
      if (count > limit) {
        return i; // Return before the start of the 1501st word
      }
    } else if (isWhitespace && inWord) {
      inWord = false;
    }
    i++;
  }
  return text.length;
}

// ==========================================
// ACCESSIBILITY TOOLS
// ==========================================

function changeTheme(themeClass) {
  document.body.classList.remove('theme-standard', 'theme-high-contrast-dark', 'theme-high-contrast-light');
  document.body.classList.add(`theme-${themeClass}`);

  // Highlight active button
  document.getElementById('theme-btn-standard').classList.remove('active');
  document.getElementById('theme-btn-hclight').classList.remove('active');
  document.getElementById('theme-btn-hcdark').classList.remove('active');

  if (themeClass === 'standard') {
    document.getElementById('theme-btn-standard').classList.add('active');
  } else if (themeClass === 'high-contrast-light') {
    document.getElementById('theme-btn-hclight').classList.add('active');
  } else if (themeClass === 'high-contrast-dark') {
    document.getElementById('theme-btn-hcdark').classList.add('active');
  }
}

function changeFontSize(sizeClass) {
  document.body.classList.remove('size-normal', 'size-large', 'size-xlarge');
  document.body.classList.add(`size-${sizeClass}`);
}

// ==========================================
// DEMO SIMULATION LOADERS
// ==========================================

async function loadDemos() {
  try {
    const res = await fetch('/examples/simulation_cases.json');
    if (res.ok) {
      simulationCases = await res.json();
    } else {
      simulationCases = fallbackSimulationCases;
    }
  } catch (err) {
    console.warn("Could not fetch simulation cases file, loading local fallbacks.", err);
    simulationCases = fallbackSimulationCases;
  }
}

function loadSimulationCase(caseId) {
  const foundCase = simulationCases.find(c => c.id === caseId);
  if (!foundCase) return;

  document.getElementById('student-name').value = foundCase.estudiante;
  document.getElementById('student-course').value = foundCase.curso;
  document.getElementById('student-college').value = foundCase.colegio;
  
  // Set radio value
  const radios = document.getElementsByName('student-type');
  for (let i = 0; i < radios.length; i++) {
    if (radios[i].value === foundCase.tipo) {
      radios[i].checked = true;
      toggleDuaRecommendation(foundCase.tipo.includes('Diferenciado') || foundCase.tipo.includes('dificultades'));
    }
  }

  // Inject essay text
  editor.value = foundCase.ensayo;
  handleEditorInput();
  updateCollegeInfo();
}

// ==========================================
// WEBSOCKET PROCESSOR LOGIC
// ==========================================

function submitEssay() {
  const name = document.getElementById('student-name').value.trim();
  const curso = document.getElementById('student-course').value;
  const colegio = document.getElementById('student-college').value;
  const essayText = editor.value.trim();
  
  // Get active radio button for type
  let type = "Estándar";
  const radios = document.getElementsByName('student-type');
  for (let i = 0; i < radios.length; i++) {
    if (radios[i].checked) {
      type = radios[i].value;
      break;
    }
  }

  // Validation
  if (!name) {
    alert("Por favor, ingresa tu nombre completo.");
    document.getElementById('student-name').focus();
    return;
  }
  if (!curso) {
    alert("Por favor, selecciona tu curso.");
    document.getElementById('student-course').focus();
    return;
  }
  if (!essayText) {
    alert("El ensayo está vacío. Por favor, escribe tus planteamientos antes de enviar.");
    editor.focus();
    return;
  }

  // Prepare payload
  const payload = {
    estudiante: name,
    curso,
    colegio,
    tipo: type,
    ensayo: essayText
  };

  // Show queue overlay
  queueOverlay.classList.remove('hide');
  resetQueueSteps();
  
  // Emit WebSocket Submission
  socket.emit('submit_essay', payload);
}

function resetQueueSteps() {
  document.getElementById('queue-title').innerText = "Conectando al Servidor de Agentes...";
  document.getElementById('queue-subtitle').innerText = "Tu envío está siendo transmitido.";
  document.getElementById('queue-progress-bar').style.width = "5%";
  
  const steps = ['step-queue', 'step-ortografia', 'step-filosofia', 'step-dua'];
  steps.forEach(id => {
    const el = document.getElementById(id);
    el.className = "queue-step";
  });
}

function handleQueueStatusUpdate(data) {
  const pBar = document.getElementById('queue-progress-bar');
  const title = document.getElementById('queue-title');
  const subtitle = document.getElementById('queue-subtitle');

  pBar.style.width = `${data.progress}%`;

  // UI feedback based on WebSocket queue stages
  switch(data.status) {
    case 'en_cola':
      title.innerText = "Cola de solicitudes activa";
      subtitle.innerText = `Estás en la posición ${data.posicion} de ${data.total} en la cola de procesamiento.`;
      document.getElementById('step-queue').className = "queue-step active";
      break;
    case 'analizando_ortografia':
      title.innerText = "Agente 1: Ortografía y Gramática";
      subtitle.innerText = "Escaneando el texto para verificar puntuación y acentos...";
      document.getElementById('step-queue').className = "queue-step complete";
      document.getElementById('step-ortografia').className = "queue-step active";
      break;
    case 'analizando_filosofia':
      title.innerText = "Agente 2: Especialista en Filosofía";
      subtitle.innerText = "Validando pertinencia conceptual de citas y solidez argumentativa...";
      document.getElementById('step-ortografia').className = "queue-step complete";
      document.getElementById('step-filosofia').className = "queue-step active";
      break;
    case 'evaluando_dua':
      title.innerText = "Agente 3: Metodólogo y Evaluador DUA";
      subtitle.innerText = "Aplicando adaptaciones curriculares y calculando la ponderación final...";
      document.getElementById('step-filosofia').className = "queue-step complete";
      document.getElementById('step-dua').className = "queue-step active";
      break;
    case 'completado':
      document.getElementById('step-dua').className = "queue-step complete";
      // Delay closing to let user see completion animation
      setTimeout(() => {
        queueOverlay.classList.add('hide');
        displayReport(data.result);
      }, 800);
      break;
    case 'error':
      queueOverlay.classList.add('hide');
      alert(data.message || "Error al procesar el ensayo.");
      break;
  }
}

// ==========================================
// REPORT DRAWING & INTERACTIVE VISOR
// ==========================================

function displayReport(report) {
  currentReport = report;

  // Set general information fields
  document.getElementById('rep-student').innerText = report.estudiante;
  document.getElementById('rep-course').innerText = report.curso;
  document.getElementById('rep-college').innerText = report.colegio;
  document.getElementById('rep-type').innerText = (report.tipo.includes('Diferenciado') || report.tipo.includes('dificultades')) ? 'Diferenciado (DUA)' : 'Estándar';
  
  // Format ISO Date
  const dateObj = new Date(report.fecha);
  document.getElementById('rep-date').innerText = dateObj.toLocaleString('es-CL');

  // Set grade gauge
  document.getElementById('rep-grade').innerText = report.calificacion.toFixed(1);

  // Set tab details
  renderInteractiveViewer(report.ensayo, report.detalles.ortografia);
  renderOrthographyList(report.detalles.ortografia);
  renderPhilosophyList(report.detalles.filosofia);
  renderDuaComment(report.detalles.dua);

  // Default to Viewer Tab
  switchReportTab('tab-viewer');

  // Open Report Modal
  const modal = document.getElementById('report-modal');
  modal.classList.remove('hide');
  modal.setAttribute('aria-hidden', 'false');
}

function closeReportModal() {
  const modal = document.getElementById('report-modal');
  modal.classList.add('hide');
  modal.setAttribute('aria-hidden', 'true');
}

function switchReportTab(tabId) {
  // Toggle buttons active class using data-tab attribute (safer than parsing onclick)
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => {
    const btnTab = btn.getAttribute('data-tab');
    if (btnTab === tabId) {
      btn.classList.add('active');
      btn.style.color = 'var(--primary-main)';
      btn.style.borderBottomColor = 'var(--primary-main)';
    } else {
      btn.classList.remove('active');
      btn.style.color = '';
      btn.style.borderBottomColor = 'transparent';
    }
  });

  // Toggle contents hide class
  const contents = document.querySelectorAll('.tab-content');
  contents.forEach(cont => {
    if (cont.id === `report-${tabId}`) {
      cont.classList.remove('hide');
    } else {
      cont.classList.add('hide');
    }
  });

  // Close tooltip container if switching away from viewer
  if (tabId !== 'tab-viewer') {
    const tooltip = document.getElementById('tooltip-display-box');
    if (tooltip) tooltip.classList.add('hide');
  }
}

// Highlight spelling mistakes in the viewer tab
function renderInteractiveViewer(essayText, errors) {
  const viewer = document.getElementById('rep-text-viewer');
  
  if (errors.length === 0) {
    viewer.innerText = essayText;
    return;
  }

  // To prevent index shifting during replacement, we modify the string backwards (from the end to the start)
  let htmlText = essayText;
  const sortedErrors = [...errors].sort((a, b) => b.indexStart - a.indexStart);

  sortedErrors.forEach((err, index) => {
    // Generate clean indices based on the original string
    const before = htmlText.substring(0, err.indexStart);
    const term = htmlText.substring(err.indexStart, err.indexEnd);
    const after = htmlText.substring(err.indexEnd);
    
    // Create interactive span with data attributes to prevent inline quote encoding crashes
    const span = `<span class="spell-error-highlight cursor-pointer" id="err-span-${index}" data-index="${index}" data-sugerencia="${escapeHtml(err.sugerencia)}" data-explicacion="${escapeHtml(err.explicacion)}">${term}</span>`;
    
    htmlText = before + span + after;
  });

  viewer.innerHTML = htmlText;
}

// Interaction when clicking a highlighted word in text
window.selectErrorSpan = function(index, sugerencia, explicacion) {
  // Remove active styling on other spans
  document.querySelectorAll('.spell-error-highlight').forEach(el => {
    el.classList.remove('active');
  });

  // Highlight selected span
  const activeSpan = document.getElementById(`err-span-${index}`);
  if (activeSpan) {
    activeSpan.classList.add('active');
  }

  // Display details in the tooltip info panel below the viewer text
  const tooltipBox = document.getElementById('tooltip-display-box');
  document.getElementById('tooltip-suggest').innerText = sugerencia;
  document.getElementById('tooltip-explain').innerText = explicacion;
  tooltipBox.classList.remove('hide');
};

function renderOrthographyList(errors) {
  const container = document.getElementById('rep-list-ortografia');
  container.innerHTML = "";

  if (errors.length === 0) {
    container.innerHTML = `<div class="error-item-card">✔️ ¡Excelente! El Agente 1 no encontró errores ortográficos comunes.</div>`;
    return;
  }

  errors.forEach(err => {
    const card = document.createElement('div');
    card.className = "error-item-card";
    card.innerHTML = `
      <div class="error-item-header">
        <span class="error-bad">"${err.error}"</span>
        <span class="error-good"><i class="fa-solid fa-arrow-right"></i> Sugerido: "${err.sugerencia}"</span>
      </div>
      <p class="error-explain">${err.explicacion}</p>
    `;
    container.appendChild(card);
  });
}

function renderPhilosophyList(critiques) {
  const container = document.getElementById('rep-list-filosofia');
  container.innerHTML = "";

  if (critiques.length === 0) {
    container.innerHTML = `<div class="error-item-card">✔️ ¡Excelente! El Agente 2 ha validado la coherencia y mención de autores sin detectar discrepancias conceptuales.</div>`;
    return;
  }

  critiques.forEach(crit => {
    const card = document.createElement('div');
    card.className = "error-item-card phil-observation-card";
    card.innerHTML = `
      <p class="phil-obs-text"><i class="fa-solid fa-triangle-exclamation" style="color: var(--info)"></i> ${crit.observacion}</p>
      <p class="phil-sug-text"><strong>Sugerencia de reescritura:</strong> ${crit.sugerencia}</p>
    `;
    container.appendChild(card);
  });
}

function renderDuaComment(dua) {
  const container = document.getElementById('rep-content-dua');
  // Inject DUA generated HTML comments directly
  container.innerHTML = dua.comentario_final;
}

// HTML Entity escaper utility
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Generate PDF Report using html2pdf.js
function downloadReportPDF() {
  if (!currentReport) return;

  const element = document.getElementById('report-printable-area');
  
  // Set export configuration options
  const opt = {
    margin:       [15, 15],
    filename:     `Reporte_Ensayo_${currentReport.estudiante.replace(/\s+/g, '_')}_Nota_${currentReport.calificacion.toFixed(1)}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { 
      scale: 2, 
      useCORS: true, 
      backgroundColor: '#ffffff'
    },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  // We add a temporary CSS print class to enforce high-contrast light colors inside the generated canvas.
  // This ensures the PDF looks clean, white-backed, and readable on print.
  const isDark = document.body.classList.contains('theme-high-contrast-dark') || document.body.classList.contains('theme-standard');
  
  if (isDark) {
    document.body.classList.add('theme-high-contrast-light');
  }

  html2pdf().set(opt).from(element).save().then(() => {
    // Restore theme afterwards
    if (isDark) {
      document.body.classList.remove('theme-high-contrast-light');
    }
  });
}

// ==========================================
// TEACHER DASHBOARD & AUTHENTICATION
// ==========================================

function openTeacherPortal() {
  const modal = document.getElementById('teacher-modal');
  modal.classList.remove('hide');
  modal.setAttribute('aria-hidden', 'false');

  // Check if already authenticated in this session
  if (teacherToken) {
    document.getElementById('teacher-lock-view').classList.add('hide');
    document.getElementById('teacher-dashboard-view').classList.remove('hide');
    fetchTeacherEssays();
  } else {
    document.getElementById('teacher-lock-view').classList.remove('hide');
    document.getElementById('teacher-dashboard-view').classList.add('hide');
    document.getElementById('teacher-password').focus();
  }
}

function closeTeacherPortal() {
  const modal = document.getElementById('teacher-modal');
  modal.classList.add('hide');
  modal.setAttribute('aria-hidden', 'true');
}

async function authenticateTeacher() {
  const password = document.getElementById('teacher-password').value;
  const errorMsg = document.getElementById('auth-error-msg');

  try {
    const res = await fetch('/api/teacher/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });

    const data = await res.json();

    if (data.success) {
      teacherToken = data.token;
      errorMsg.classList.add('hide');
      document.getElementById('teacher-lock-view').classList.add('hide');
      document.getElementById('teacher-dashboard-view').classList.remove('hide');
      document.getElementById('teacher-password').value = ""; // Clear input
      fetchTeacherEssays();
    } else {
      errorMsg.classList.remove('hide');
    }
  } catch (err) {
    console.error("Auth server error:", err);
    alert("No se pudo conectar al servidor de autenticación.");
  }
}

function logoutTeacher() {
  teacherToken = null;
  allEssays = [];
  document.getElementById('teacher-lock-view').classList.remove('hide');
  document.getElementById('teacher-dashboard-view').classList.add('hide');
  document.getElementById('teacher-password').focus();
}

async function fetchTeacherEssays() {
  if (!teacherToken) return;

  try {
    const res = await fetch('/api/essays', {
      headers: {
        'Authorization': teacherToken
      }
    });

    if (res.ok) {
      allEssays = await res.json();
      renderTeacherDashboard();
      populateTeacherCourseFilter();
    } else {
      alert("Sesión no autorizada. Por favor, ingresa de nuevo.");
      logoutTeacher();
    }
  } catch (err) {
    console.error("Error retrieving essays:", err);
    alert("Error al cargar la base de datos de ensayos.");
  }
}

function populateTeacherCourseFilter() {
  const filter = document.getElementById('filter-course');
  // Clear non-ALL options
  filter.innerHTML = `<option value="ALL">Todos los cursos</option>`;

  // Collect unique courses from submissions
  const uniqueCourses = [...new Set(allEssays.map(e => e.curso))].sort();
  uniqueCourses.forEach(course => {
    const opt = document.createElement('option');
    opt.value = course;
    opt.innerText = course;
    filter.appendChild(opt);
  });
}

function renderTeacherDashboard() {
  // 1. Calculate and update overall statistics
  const total = allEssays.length;
  document.getElementById('stat-total-essays').innerText = total;

  if (total === 0) {
    document.getElementById('stat-avg-grade').innerText = "0.0";
    document.getElementById('stat-pass-rate').innerText = "0%";
    document.getElementById('stat-dua-count').innerText = "0";
    renderTeacherTable(allEssays);
    return;
  }

  // Calculate Average
  const sum = allEssays.reduce((acc, curr) => acc + curr.calificacion, 0);
  const avg = sum / total;
  document.getElementById('stat-avg-grade').innerText = avg.toFixed(1);

  // Calculate pass rate (nota >= 4.0)
  const passCount = allEssays.filter(e => e.calificacion >= 4.0).length;
  const passPercent = (passCount / total) * 100;
  document.getElementById('stat-pass-rate').innerText = `${passPercent.toFixed(0)}%`;

  // DUA count
  const duaCount = allEssays.filter(e => e.tipo.includes('Diferenciado') || e.tipo.includes('dificultades')).length;
  document.getElementById('stat-dua-count').innerText = duaCount;

  // 2. Render table row items
  applyTeacherFilters();
}

function applyTeacherFilters() {
  const courseFilter = document.getElementById('filter-course').value;
  const collegeFilter = document.getElementById('filter-college').value;
  const typeFilter = document.getElementById('filter-type').value;

  const filtered = allEssays.filter(essay => {
    const matchesCourse = (courseFilter === 'ALL' || essay.curso === courseFilter);
    const matchesCollege = (collegeFilter === 'ALL' || essay.colegio === collegeFilter);
    
    let matchesType = true;
    if (typeFilter === 'Estándar') {
      matchesType = !(essay.tipo.includes('Diferenciado') || essay.tipo.includes('dificultades'));
    } else if (typeFilter === 'Diferenciado') {
      matchesType = (essay.tipo.includes('Diferenciado') || essay.tipo.includes('dificultades'));
    }

    return matchesCourse && matchesCollege && matchesType;
  });

  renderTeacherTable(filtered);
}

function renderTeacherTable(essaysList) {
  const tbody = document.getElementById('teacher-table-body');
  tbody.innerHTML = "";

  if (essaysList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-table-msg">No se encontraron ensayos correspondientes a los filtros.</td></tr>`;
    return;
  }

  essaysList.forEach(essay => {
    const dateObj = new Date(essay.fecha);
    const formattedDate = dateObj.toLocaleDateString('es-CL') + " " + dateObj.toLocaleTimeString('es-CL', {hour: '2-digit', minute:'2-digit'});

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escapeHtml(essay.estudiante)}</strong></td>
      <td>${escapeHtml(essay.curso)}</td>
      <td>${escapeHtml(essay.colegio)}</td>
      <td>
        <span class="badge-type ${(essay.tipo.includes('Diferenciado') || essay.tipo.includes('dificultades')) ? 'badge-dua' : 'badge-std'}">
          ${(essay.tipo.includes('Diferenciado') || essay.tipo.includes('dificultades')) ? 'Diferenciado (DUA)' : 'Estándar'}
        </span>
      </td>
      <td>${formattedDate}</td>
      <td><span class="table-grade">${essay.calificacion.toFixed(1)}</span></td>
      <td>
        <button class="btn-secondary" onclick="viewDetailedCorrection('${essay.id}')">
          <i class="fa-solid fa-eye"></i> Ver Corrección
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Function triggered from teacher portal table row action
window.viewDetailedCorrection = function(essayId) {
  // Find full essay details
  const essay = allEssays.find(e => e.id === essayId);
  if (!essay) return;

  // Render report & open modal
  displayReport(essay);
};
