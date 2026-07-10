require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || 'profesor2026';

// Ensure data folder exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const DB_PATH = path.join(dataDir, 'essays.json');

// Ensure essays database file exists and is seeded if empty
const seedPath = path.join(__dirname, 'data_seed.json');
if (!fs.existsSync(DB_PATH)) {
  if (fs.existsSync(seedPath)) {
    console.log("Seeding database from data_seed.json");
    fs.copyFileSync(seedPath, DB_PATH);
  } else {
    fs.writeFileSync(DB_PATH, '[]', 'utf8');
  }
} else {
  try {
    const fileContent = fs.readFileSync(DB_PATH, 'utf8').trim();
    if (fileContent === '' || fileContent === '[]') {
      if (fs.existsSync(seedPath)) {
        console.log("Seeding empty database from data_seed.json");
        fs.copyFileSync(seedPath, DB_PATH);
      }
    }
  } catch (err) {
    console.error("Error checking or seeding empty database:", err);
  }
}

// Serialization queue for database writes
let writeQueue = Promise.resolve();
async function saveEssay(essayData) {
  writeQueue = writeQueue.then(async () => {
    try {
      let data = [];
      if (fs.existsSync(DB_PATH)) {
        const fileContent = fs.readFileSync(DB_PATH, 'utf8');
        data = JSON.parse(fileContent || '[]');
      }
      data.push(essayData);
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error("Error writing to database:", err);
    }
  }).catch(err => {
    console.error("Database queue critical error:", err);
  });
  return writeQueue;
}

// Read database
function readEssays() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const fileContent = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(fileContent || '[]');
    }
  } catch (err) {
    console.error("Error reading database:", err);
  }
  return [];
}

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API endpoints
app.post('/api/teacher/auth', (req, res) => {
  const { password } = req.body;
  if (password === TEACHER_PASSWORD) {
    return res.json({ success: true, token: 'session_' + Buffer.from(TEACHER_PASSWORD).toString('base64') });
  }
  return res.status(401).json({ success: false, message: 'Clave incorrecta' });
});

app.get('/api/essays', (req, res) => {
  const authHeader = req.headers.authorization;
  const expectedToken = 'session_' + Buffer.from(TEACHER_PASSWORD).toString('base64');
  if (authHeader !== expectedToken) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const essays = readEssays();
  return res.json(essays);
});

// ==========================================
// SIMULATED AGENTS IMPLEMENTATION
// ==========================================

// Agent 1: Spelling & Grammar Checker
const erroresComunes = [
  { regex: /\bhavia\b/gi, sugerencia: "había", explicacion: "El verbo 'haber' en pretérito imperfecto lleva 'h' y tilde en la 'í'." },
  { regex: /\betica\b/gi, sugerencia: "ética", explicacion: "La palabra 'ética' es esdrújula y siempre lleva tilde en la primera 'e'." },
  { regex: /\bfilosofo\b/gi, sugerencia: "filósofo", explicacion: "La palabra 'filósofo' es esdrújula y siempre lleva tilde en la primera 'o'." },
  { regex: /\baleman\b/gi, sugerencia: "alemán", explicacion: "La palabra 'alemán' es aguda, termina en 'n' y lleva tilde en la 'a'." },
  { regex: /\bmaxima\b/gi, sugerencia: "máxima", explicacion: "La palabra 'máxima' es esdrújula y siempre lleva tilde en la primera 'a'." },
  { regex: /\bcategorico\b/gi, sugerencia: "categórico", explicacion: "La palabra 'categórico' es esdrújula y siempre lleva tilde en la 'o'." },
  { regex: /\bmas\b/gi, sugerencia: "más", explicacion: "Se escribe 'más' (con tilde) cuando funciona como adverbio de cantidad, a diferencia de la conjunción 'mas' (que equivale a 'pero')." },
  { regex: /\bdecia\b/gi, sugerencia: "decía", explicacion: "El pretérito imperfecto del verbo 'decir' lleva tilde en la 'í' por el hiato vocal." },
  { regex: /\bdificil\b/gi, sugerencia: "difícil", explicacion: "La palabra 'difícil' es llana y no termina en 'n', 's' o vocal, por lo que lleva tilde en la 'í'." },
  { regex: /\besperiencia\b/gi, sugerencia: "experiencia", explicacion: "Se escribe con 'x' ('experiencia'), derivado del latín 'experientia'." },
  { regex: /\bilusion\b/gi, sugerencia: "ilusión", explicacion: "La palabra 'ilusión' es aguda, termina en 'n' y lleva tilde en la 'ó'." },
  { regex: /\btambien\b/gi, sugerencia: "también", explicacion: "La palabra 'también' es aguda, termina en 'n' y lleva tilde en la segunda 'e'." },
  { regex: /\btenia\b/gi, sugerencia: "tenía", explicacion: "El verbo 'tener' en pretérito imperfecto lleva tilde en la 'í' por hiato." },
  { regex: /\bhaci\b/gi, sugerencia: "así", explicacion: "El adverbio 'así' se escribe con 's' y lleva tilde en la 'í'." },
  { regex: /\bdesicion\b/gi, sugerencia: "decisión", explicacion: "Se escribe con 'c' en la primera sílaba y 's' con tilde en la 'ó' en la última." },
  { regex: /\ba traves\b/gi, sugerencia: "a través", explicacion: "La locución 'a través' se escribe con 's' y tilde en la 'e'." },
  { regex: /\bpor que\b/gi, sugerencia: "porque", explicacion: "Se escribe 'porque' (junto y sin tilde) cuando es una conjunción causal (para introducir explicaciones)." },
  { regex: /\bqueria\b/gi, sugerencia: "quería", explicacion: "El verbo 'querer' en pretérito imperfecto lleva tilde en la 'í'." },
  { regex: /\bcoerencia\b/gi, sugerencia: "coherencia", explicacion: "Se escribe con 'h' intercalada entre las dos vocales ('coherencia')." },
  { regex: /\bteoria\b/gi, sugerencia: "teoría", explicacion: "Lleva tilde en la 'í' debido a un hiato de vocal débil tónica y fuerte átona." },
  { regex: /\brazon\b/gi, sugerencia: "razón", explicacion: "Palabra aguda que termina en 'n', por lo tanto lleva tilde en la 'ó'." },
  { regex: /\bmetodo\b/gi, sugerencia: "método", explicacion: "La palabra 'método' es esdrújula y siempre lleva tilde en la primera 'e'." },
  { regex: /\banalisis\b/gi, sugerencia: "análisis", explicacion: "La palabra 'análisis' es esdrújula y siempre lleva tilde en la 'a'." },
  { regex: /\bconclusion\b/gi, sugerencia: "conclusión", explicacion: "La palabra 'conclusión' es aguda y termina en 'n', lleva tilde en la 'ó'." },
  { regex: /\blinea\b/gi, sugerencia: "línea", explicacion: "La palabra 'línea' es esdrújula y lleva tilde en la 'í'." }
];

function evaluarOrtografia(texto) {
  const report = [];
  const lowerText = texto.toLowerCase();
  
  erroresComunes.forEach(item => {
    item.regex.lastIndex = 0;
    let match;
    while ((match = item.regex.exec(texto)) !== null) {
      report.push({
        error: match[0],
        sugerencia: item.sugerencia,
        explicacion: item.explicacion,
        indexStart: match.index,
        indexEnd: match.index + match[0].length
      });
    }
  });

  // Check double spaces
  const doubleSpaceRegex = / {2,}/g;
  let match;
  while ((match = doubleSpaceRegex.exec(texto)) !== null) {
    report.push({
      error: match[0],
      sugerencia: " ",
      explicacion: "Se detectó un exceso de espacios en blanco consecutivos. Utiliza un único espacio entre palabras.",
      indexStart: match.index,
      indexEnd: match.index + match[0].length
    });
  }

  // Check lowercase after period
  const dotRegex = /\. +([a-zñáéíóú])/g;
  while ((match = dotRegex.exec(texto)) !== null) {
    report.push({
      error: match[1],
      sugerencia: match[1].toUpperCase(),
      explicacion: "Después de un punto seguido, la primera palabra debe comenzar con mayúscula.",
      indexStart: match.index + match[0].length - 1,
      indexEnd: match.index + match[0].length
    });
  }

  // Sort by indexStart
  return report.sort((a, b) => a.indexStart - b.indexStart);
}

// Agent 2: Philosophy Specialist
const filosofosDisponibles = {
  kant: {
    nombre: "Immanuel Kant",
    conceptos: ["imperativo", "categórico", "deber", "ética", "razón", "crítica", "autonomía", "moral", "rigorismo"],
    inconsistencias: [
      {
        trigger: /esperiencia|sentidos|empirismo/i,
        observacion: "Se le atribuye a Kant la tesis empirista pura de que todo conocimiento procede únicamente de la experiencia sensible y los sentidos.",
        sugerencia: "Revisa la distinción entre empirismo y racionalismo. Kant sostiene en su 'Crítica de la Razón Pura' que si bien todo conocimiento *comienza* con la experiencia, no todo *procede* de ella (sintetiza ambos postulados)."
      }
    ]
  },
  nietzsche: {
    nombre: "Friedrich Nietzsche",
    conceptos: ["superhombre", "voluntad de poder", "nihilismo", "dios ha muerto", "moral", "eterno retorno", "perspectivismo"],
    inconsistencias: [
      {
        trigger: /deber absoluto|imperativo/i,
        observacion: "Se vincula a Nietzsche de forma positiva con la ética del deber absoluto de Kant.",
        sugerencia: "Clarifica que Nietzsche es un detractor radical de la moral universal de Kant. Para él, el 'deber' universal estrangula las fuerzas vitales y prefiere la creación individual de valores."
      }
    ]
  },
  platon: {
    nombre: "Platón",
    conceptos: ["ideas", "caverna", "dualismo", "mito", "alma", "república", "sensible", "inteligible", "dialéctica"],
    inconsistencias: [
      {
        trigger: /sentidos como verdad|materia como realidad/i,
        observacion: "Se asume que para Platón el mundo material (sensible) es el depósito del conocimiento real y absoluto.",
        sugerencia: "Aclara que para Platón los sentidos son engañosos (sólo producen opinión o 'doxa'). El conocimiento verdadero ('episteme') se encuentra en la captación racional del mundo inteligible (las Ideas)."
      }
    ]
  },
  aristoteles: {
    nombre: "Aristóteles",
    conceptos: ["ética", "virtud", "causa", "sustancia", "felicidad", "eudaimonia", "término medio", "acto", "potencia"],
    inconsistencias: [
      {
        trigger: /virtud extrema|exceso/i,
        observacion: "Se describe la virtud en Aristóteles como un extremo absoluto de perfección moral.",
        sugerencia: "Recuerda que en la 'Ética a Nicómaco', Aristóteles define la virtud moral como el 'término medio' relativo a nosotros, entre dos extremos que constituyen vicios (uno por exceso y otro por defecto)."
      }
    ]
  },
  foucault: {
    nombre: "Michel Foucault",
    conceptos: ["biopolítica", "poder", "vigilar", "castigar", "discurso", "sujeto", "panóptico", "arqueología", "genealogía"],
    inconsistencias: [
      {
        trigger: /poder concentrado en el rey|soberano unico/i,
        observacion: "Se infiere que para Foucault el poder opera de manera puramente piramidal y vertical, concentrado exclusivamente en el Estado.",
        sugerencia: "Aclara que Foucault propone una concepción microfísica o capilar del poder. El poder no se posee, se ejerce, y está diseminado en toda la red social mediante instituciones y discursos."
      }
    ]
  },
  hume: {
    nombre: "David Hume",
    conceptos: ["empirismo", "experiencia", "impresiones", "ideas", "escepticismo", "causalidad", "costumbre"],
    inconsistencias: [
      {
        trigger: /razon como origen del conocimiento/i,
        observacion: "Se argumenta que Hume considera la razón como la fuente originaria del conocimiento moral y real.",
        sugerencia: "Modifica este punto: Hume es un empirista radical. Establece que la razón es y debe ser 'esclava de las pasiones', y que todo conocimiento proviene de impresiones sensoriales previas."
      }
    ]
  },
  descartes: {
    nombre: "René Descartes",
    conceptos: ["duda", "metódica", "pienso luego existo", "cogito", "racionalismo", "ideas innatas", "dualismo", "res cogitans"],
    inconsistencias: [
      {
        trigger: /sentidos como fiables/i,
        observacion: "Se argumenta que la duda cartesiana justifica la fiabilidad inicial de los sentidos.",
        sugerencia: "Aclara que Descartes rechaza los sentidos en la primera etapa de su duda metódica ('los sentidos a veces nos engañan'), buscando un fundamento indudable en la pura razón ('cogito, ergo sum')."
      }
    ]
  },
  sartre: {
    nombre: "Jean-Paul Sartre",
    conceptos: ["existencialismo", "libertad", "angustia", "esencia", "existencia", "mala fe", "determinismo"],
    inconsistencias: [
      {
        trigger: /esencia precede/i,
        observacion: "Se postula que para Sartre la esencia humana precede y determina su existencia.",
        sugerencia: "Recuerda la premisa máxima del existencialismo sartreano: 'la existencia precede a la esencia'. El ser humano no está predefinido; se autodefine a través de sus elecciones libres y acciones."
      }
    ]
  }
};

function cleanText(t) {
  if (!t) return "";
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function evaluarFilosofia(texto) {
  const report = [];
  const normalizedText = cleanText(texto);
  let filosofosMencionados = 0;

  // Verify thinkers and their concepts
  Object.keys(filosofosDisponibles).forEach(key => {
    const info = filosofosDisponibles[key];
    const cleanKey = cleanText(key);
    const regexName = new RegExp(`\\b${cleanKey}\\b`, 'i');
    
    if (regexName.test(normalizedText)) {
      filosofosMencionados++;
      
      // Check concepts
      const conceptosEncontrados = info.conceptos.filter(concepto => {
        const cleanConcepto = cleanText(concepto);
        const regexCon = new RegExp(`\\b${cleanConcepto}s?\\b`, 'i');
        return regexCon.test(normalizedText);
      });

      if (conceptosEncontrados.length === 0) {
        report.push({
          observacion: `Mencionas a ${info.nombre} pero no utilizas ninguno de sus conceptos fundamentales.`,
          sugerencia: `Enriquece la exposición contextualizando la tesis de ${info.nombre} con términos clave como: ${info.conceptos.slice(0, 3).join(', ')}.`
        });
      }

      // Check inconsistencies
      info.inconsistencias.forEach(inc => {
        if (inc.trigger.test(normalizedText)) {
          report.push({
            observacion: inc.observacion,
            sugerencia: inc.sugerencia
          });
        }
      });
    }
  });

  if (filosofosMencionados === 0) {
    report.push({
      observacion: "Tu escrito no menciona explícitamente a ningún filósofo de referencia en la discusión de las premisas.",
      sugerencia: "Para elevar el nivel formal del ensayo, incorpora citas o doctrinas de filósofos clásicos o contemporáneos (ej. Platón, Kant, Aristóteles, Nietzsche) que robustezcan tu postura."
    });
  }

  // Check argumentative connectors & logic coherence
  const conectoresArgumento = [
    /\bpor (lo tanto|ende|consiguiente)\b/i,
    /\ben consecuencia\b/i,
    /\bdado que\b/i,
    /\bya que\b/i,
    /\ben conclusion\b/i,
    /\basi pues\b/i,
    /\bdebido a (que)?\b/i,
    /\bpor lo cual\b/i
  ];

  let matchesConectores = 0;
  conectoresArgumento.forEach(regex => {
    if (regex.test(normalizedText)) {
      matchesConectores++;
    }
  });

  if (matchesConectores < 2) {
    report.push({
      observacion: "El ensayo presenta una estructura argumentativa débil o inconexa, con escasez de conectores lógicos de causa-consecuencia.",
      sugerencia: "Organiza tu discurso estableciendo premisas explícitas unidas por conectores como 'por lo tanto', 'ya que' o 'en consecuencia' para culminar en una conclusión fundamentada."
    });
  }

  return report;
}

// Agent 3: DUA and Methodologist Evaluator
function evaluarDuaMetodologo(colegio, tipoEstudiante, erroresOrtografia, criticasFilosoficas, numPalabras) {
  // Determine difficulty level
  let dificultad = 50; // default
  let esDiferenciada = false;

  if (tipoEstudiante.includes("dificultades") || tipoEstudiante.includes("Diferenciado") || tipoEstudiante.includes("apoyo") || tipoEstudiante === "diferenciada") {
    dificultad = 50;
    esDiferenciada = true;
  } else {
    if (colegio === "Colegio Alemán") {
      dificultad = 45;
    } else if (colegio === "Liceo San Pedro Poveda") {
      dificultad = 60;
    }
  }

  // Base score calculation (starts at 7.0)
  let nota = 7.0;
  
  // Spelling error weight (scaled for 1.0 to 7.0 range)
  const pesoOrtografia = 0.2 * (dificultad / 50);
  const deduccionOrtografia = erroresOrtografia.length * pesoOrtografia;
  
  // Philosophy error weight (scaled for 1.0 to 7.0 range)
  const pesoFilosofia = 0.8 * (dificultad / 50);
  const deduccionFilosofia = criticasFilosoficas.length * pesoFilosofia;

  // Length weight check
  let deduccionLargo = 0;
  if (numPalabras < 100) {
    deduccionLargo = 3.0;
  } else if (numPalabras < 300) {
    deduccionLargo = 1.5;
  } else if (numPalabras < 600) {
    deduccionLargo = 0.5;
  }

  nota = nota - deduccionOrtografia - deduccionFilosofia - deduccionLargo;

  // Limit bounds
  if (nota < 1.0) nota = 1.0;
  if (nota > 7.0) nota = 7.0;
  nota = parseFloat(nota.toFixed(1));

  // Build comments based on DUA and performance
  let comentario_final = "";
  let tipo_correccion = esDiferenciada ? "diferenciada" : "estandar";

  if (esDiferenciada) {
    // DUA Differentiated Feedback (bulleted, visual, structured, step-by-step guidance)
    let estado = nota >= 4.0 ? "¡Excelente esfuerzo! Has logrado estructurar tus ideas filosóficas." : "¡Vas por buen camino! Sigamos trabajando en ordenar las ideas de tu ensayo.";
    
    comentario_final = `
<div class="dua-feedback-box">
  <h4>🌟 ${estado}</h4>
  <p>Hemos analizado tu ensayo utilizando tres lentes diferentes (ortografía, coherencia de filósofos y método de escritura). Aquí tienes una guía visual paso a paso para mejorar tu trabajo:</p>
  
  <div class="dua-section">
    <strong>📋 Resumen de tu avance:</strong>
    <ul>
      <li>✍️ Redactaste un texto de <strong>${numPalabras} palabras</strong>.</li>
      <li>⚠️ El detector encontró <strong>${erroresOrtografia.length} detalles de ortografía o espaciado</strong>.</li>
      <li>💡 El asesor filosófico tiene <strong>${criticasFilosoficas.length} sugerencias</strong> para afinar tus argumentos.</li>
    </ul>
  </div>

  <div class="dua-section">
    <strong>🚀 Plan de acción paso a paso para mejorar tu nota:</strong>
    <ol>
      ${erroresOrtografia.length > 0 ? '<li><strong>Corrige las palabras marcadas en rojo:</strong> Haz clic en las sugerencias del visor de texto para enmendar los acentos u letras omitidas.</li>' : '<li><strong>Ortografía impecable:</strong> ¡No se detectaron errores ortográficos comunes! Excelente trabajo de escritura.</li>'}
      ${criticasFilosoficas.length > 0 ? `<li><strong>Ajusta tus ideas de filosofía:</strong> ${criticasFilosoficas[0].sugerencia}</li>` : '<li><strong>Coherencia de pensamiento:</strong> Lograste vincular bien tus autores y conectores argumentativos.</li>'}
      <li><strong>Próximo paso:</strong> Vuelve a leer tu escrito en voz alta para verificar que las frases sean cortas y fáciles de entender.</li>
    </ol>
  </div>

  <div class="dua-section suggestion-notes">
    <strong>💡 Recomendación de visualización cognitiva:</strong>
    <p>Para la próxima redacción, te recomendamos dibujar un mapa mental con tu idea principal en el centro y las razones (premisas) a los lados antes de comenzar a escribir.</p>
  </div>
</div>
`;
  } else {
    // Standard Feedback (scholastic paragraphs)
    let estadoStr = nota >= 4.0 ? "Aprobado con desempeño satisfactorio." : "Reprobado. Se requiere reestructuración del texto.";
    
    comentario_final = `
<div class="standard-feedback-box">
  <h4>Evaluación Metodológica: ${estadoStr}</h4>
  <p>El ensayo presentado consta de ${numPalabras} palabras, evaluado bajo una rúbrica de nivel de exigencia institucional del <strong>${(dificultad * 100 / 100).toFixed(0)}%</strong>.</p>
  <p><strong>Análisis de Desempeño:</strong> Se identificaron ${erroresOrtografia.length} errores de nivel gramatical/ortográfico y ${criticasFilosoficas.length} observaciones referidas a la coherencia epistemológica o formal de los argumentos filosóficos planteados.</p>
  <p><strong>Recomendaciones Académicas:</strong> Se aconseja incorporar mayor rigor conceptual en la exposición de las citas doctrinales y utilizar una variedad más amplia de conectores lógicos subordinantes. Asimismo, es prioritario revisar el texto con un corrector lexicográfico antes de su reenvío para eliminar las desviaciones de tildación y concordancia reportadas.</p>
</div>
`;
  }

  return {
    calificacion: nota,
    tipo_correccion,
    comentario_final
  };
}

// ==========================================
// CONCURRENCY WORKER QUEUE SYSTEM (MAX 50 CO-RUN)
// ==========================================
class ConcurrentQueue {
  constructor(concurrencyLimit = 3) {
    this.limit = concurrencyLimit;
    this.queue = [];
    this.activeWorkers = 0;
  }

  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.updateQueuePositions();
      this.processNext();
    });
  }

  updateQueuePositions() {
    this.queue.forEach((item, index) => {
      if (item.task.onQueueUpdate) {
        item.task.onQueueUpdate(index + 1, this.queue.length);
      }
    });
  }

  async processNext() {
    if (this.activeWorkers >= this.limit || this.queue.length === 0) {
      return;
    }

    const { task, resolve, reject } = this.queue.shift();
    this.activeWorkers++;
    this.updateQueuePositions();

    try {
      const result = await this.runTask(task);
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.activeWorkers--;
      this.processNext();
    }
  }

  async runTask(task) {
    const steps = [
      { status: 'analizando_ortografia', progress: 15, delay: 1500 },
      { status: 'analizando_filosofia', progress: 50, delay: 1500 },
      { status: 'evaluando_dua', progress: 85, delay: 1500 }
    ];

    for (const step of steps) {
      task.onStep(step.status, step.progress);
      await new Promise(r => setTimeout(r, step.delay));
    }

    // Run actual evaluation logic
    const text = task.payload.ensayo;
    const cleanText = text.replace(/[\r\n]+/g, ' ').trim();
    const words = cleanText === "" ? 0 : cleanText.split(/\s+/).length;

    const ortografia = evaluarOrtografia(text);
    const filosofia = evaluarFilosofia(text);
    const dua = evaluarDuaMetodologo(
      task.payload.colegio,
      task.payload.tipo,
      ortografia,
      filosofia,
      words
    );

    const report = {
      id: 'essay_' + Math.random().toString(36).substr(2, 9),
      estudiante: task.payload.estudiante,
      curso: task.payload.curso,
      colegio: task.payload.colegio,
      tipo: task.payload.tipo,
      ensayo: text,
      calificacion: dua.calificacion,
      fecha: new Date().toISOString(),
      detalles: {
        ortografia,
        filosofia,
        dua: {
          tipo_correccion: dua.tipo_correccion,
          comentario_final: dua.comentario_final
        }
      }
    };

    // Save in file database
    await saveEssay(report);
    
    return report;
  }
}

const processingQueue = new ConcurrentQueue(3); // Process 3 essays concurrently, others wait in queue

// WebSocket Connection Handler
io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  socket.on('submit_essay', async (payload) => {
    try {
      console.log(`Ensayo recibido de: ${payload.estudiante}`);
      
      const task = {
        payload,
        onQueueUpdate: (posicion, total) => {
          socket.emit('status_update', {
            status: 'en_cola',
            posicion,
            total,
            progress: 5
          });
        },
        onStep: (status, progress) => {
          socket.emit('status_update', {
            status,
            progress
          });
        }
      };

      const report = await processingQueue.enqueue(task);
      
      // Send final results
      socket.emit('status_update', {
        status: 'completado',
        progress: 100,
        result: report
      });

      // Broadcast update to teacher panel if connected
      io.emit('essay_submitted_notification', report);

    } catch (err) {
      console.error("Error processing essay:", err);
      socket.emit('status_update', {
        status: 'error',
        message: 'Ocurrió un error en el servidor al evaluar tu ensayo.'
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`Servidor de Ensayo Argumentativo + corriendo en http://localhost:${PORT}`);
});
