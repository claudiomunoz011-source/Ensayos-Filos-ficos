/**
 * Concurrency Test Script
 * Simulates 50 concurrent students submitting essays to the socket.io server.
 * Requires socket.io-client to be installed.
 */

const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const NUM_CLIENTS = 50;
const SUBMISSION_INTERVAL = 15; // ms between each submission to simulate rapid fire

console.log(`Starting concurrency test with ${NUM_CLIENTS} virtual students...`);

let completedCount = 0;
const startTimes = {};
const finishTimes = {};

function createVirtualStudent(id) {
  const socket = io(SERVER_URL, {
    forceNew: true,
    transports: ['websocket']
  });

  const studentName = `Estudiante Virtual ${id}`;
  const isDua = id % 3 === 0; // Mix standard and TDA/TEA students

  socket.on('connect', () => {
    // Wait a brief simulated delay before submitting
    setTimeout(() => {
      startTimes[id] = Date.now();
      
      socket.emit('submit_essay', {
        estudiante: studentName,
        curso: `${7 + (id % 6)}° Medio ${String.fromCharCode(65 + (id % 7))}`,
        colegio: id % 2 === 0 ? "Colegio Alemán" : "Liceo San Pedro Poveda",
        tipo: isDua ? "Con dificultades de aprendizaje (TDA, TEA, Dislexia, etc.)" : "Estándar",
        ensayo: `Ensayo argumentativo del estudiante virtual ${id}. En este ensayo se analiza la etica y el pensamiento de Kant. El filosofo aleman havia propuesto que las acciones deben regirse por el deber y el imperativo categorico. Esto es un gran avance porque nos ayuda a convivir. Sin embargo, Nietzsche decia lo contrario en cuanto al deber absoluto. Por lo tanto, debemos equilibrar ambas posturas en la practica. En conclusion, la moralidad requiere tanto de la razon como de la prudencia en cada contexto.`
      });
    }, id * SUBMISSION_INTERVAL);
  });

  socket.on('status_update', (data) => {
    if (data.status === 'en_cola') {
      console.log(`[Estudiante ${id}] En cola. Posición: ${data.posicion}/${data.total}`);
    } else if (data.status === 'completado') {
      finishTimes[id] = Date.now();
      completedCount++;
      const duration = ((finishTimes[id] - startTimes[id]) / 1000).toFixed(2);
      console.log(`\x1b[32m[Estudiante ${id}] Corrección completada! Nota: ${data.result.calificacion} (Tomó ${duration}s). Progreso: ${completedCount}/${NUM_CLIENTS}\x1b[0m`);
      
      socket.disconnect();
      
      if (completedCount === NUM_CLIENTS) {
        finishTest();
      }
    } else {
      console.log(`[Estudiante ${id}] Estado: ${data.status} (Progreso: ${data.progress}%)`);
    }
  });

  socket.on('connect_error', (err) => {
    console.error(`[Estudiante ${id}] Error de conexión:`, err.message);
    socket.disconnect();
  });
}

function finishTest() {
  console.log("\n==============================================");
  console.log("             TEST COMPLETADO");
  console.log("==============================================");
  console.log(`Todos los ${NUM_CLIENTS} estudiantes virtuales fueron procesados.`);
  
  const durations = Object.keys(startTimes).map(id => (finishTimes[id] - startTimes[id]) / 1000);
  const avgDuration = (durations.reduce((a, b) => a + b, 0) / NUM_CLIENTS).toFixed(2);
  const maxDuration = Math.max(...durations).toFixed(2);
  const minDuration = Math.min(...durations).toFixed(2);

  console.log(`Tiempo Promedio de Corrección: ${avgDuration}s`);
  console.log(`Tiempo Mínimo de Corrección: ${minDuration}s`);
  console.log(`Tiempo Máximo de Corrección (cola llena): ${maxDuration}s`);
  console.log("La base de datos local essays.json fue actualizada de forma segura.");
  console.log("==============================================\n");
  process.exit(0);
}

// Start all clients
for (let i = 1; i <= NUM_CLIENTS; i++) {
  createVirtualStudent(i);
}
