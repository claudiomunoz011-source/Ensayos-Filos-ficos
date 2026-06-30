# Ensayo Argumentativo +

**Ensayo Argumentativo +** es una plataforma web educativa diseñada para la redacción y evaluación de ensayos argumentativos de hasta 1.500 palabras. El sistema incorpora una arquitectura de corrección automática multiagente basada en WebSockets que simula tres perfiles evaluadores expertos, aplicando criterios metodológicos y adaptaciones del **Diseño Universal para el Aprendizaje (DUA)**.

El sistema está diseñado para soportar más de **50 estudiantes trabajando simultáneamente** sin bloquear la interfaz de usuario, gracias a una cola de procesamiento concurrente en memoria y comunicación en tiempo real.

---

## 📂 Estructura del Proyecto

```text
Proyecto ensayo/
├── .env                          # Variables de entorno (puerto, clave del profesor)
├── package.json                  # Dependencias del servidor (express, socket.io, dotenv)
├── server.js                     # Servidor HTTP, WebSockets, Cola de Tareas y Lógica de Agentes
├── README.md                     # Documentación general de instalación y uso
├── data/
│   └── essays.json               # Persistencia de ensayos y reportes corregidos (Base de Datos JSON)
├── examples/
│   └── simulation_cases.json     # Casos de prueba pre-cargados (Liceo Poveda vs Colegio Alemán)
└── public/
    ├── index.html                # Interfaz de Usuario (Accesibilidad, Formulario, Editor, Reportes)
    ├── styles.css                # Diseño UI Premium, adaptaciones DUA (contrastes y tipografías)
    └── app.js                    # Lógica Cliente (Conexión WebSocket, visor interactivo y descarga PDF)
```

---

## 🛠️ Instalación y Configuración

### Requisitos Previos
- **Node.js** v16.x o superior instalado en el equipo.

### Paso 1: Instalar dependencias
Abre una terminal en el directorio raíz del proyecto (`Proyecto ensayo`) y ejecuta:
```bash
npm install
```

### Paso 2: Variables de entorno
El proyecto utiliza un archivo `.env` para almacenar variables clave. Por defecto ya se encuentra creado con los siguientes valores:
```env
PORT=3000
TEACHER_PASSWORD=profesor2026
```
*Puedes modificar el puerto o la clave de acceso del profesor editando este archivo.*

---

## 🚀 Ejecución de la Aplicación

### Modo Servidor Local
Para iniciar el servidor, ejecuta en la consola:
```bash
npm start
```
Una vez iniciado, abre tu navegador e ingresa a:
👉 [http://localhost:3000](http://localhost:3000)

---

## 🧪 Pruebas de Simulación Pre-cargadas

Para facilitar la evaluación de las diferentes rigurosidades de calificación y adaptaciones DUA, la plataforma incluye un área de **Simulaciones de Prueba** en el formulario de la izquierda con dos casos pre-cargados:

### Caso 1: Estudiante Estándar (Liceo San Pedro Poveda)
- **Colegio:** Liceo San Pedro Poveda.
- **Nivel de Dificultad:** **60% (Exigente)**.
- **Tipo de Ajuste:** Estándar.
- **Resultados esperados:**
  - El sistema aplica una corrección de ortografía y redacción rigurosa.
  - La calificación final es más baja debido al peso del rigor metodológico y de ortografía (por ejemplo, cada error ortográfico resta `0.36` puntos).
  - El comentario cualitativo final del Agente 3 se entrega en formato de párrafos de retroalimentación estándar.

### Caso 2: Estudiante con TDA/TEA (Colegio Alemán)
- **Colegio:** Colegio Alemán.
- **Nivel de Dificultad:** **50% (Ajustado por Dificultades de Aprendizaje)**.
- **Tipo de Ajuste:** Diferenciado (DUA).
- **Resultados esperados:**
  - El sistema detecta que el estudiante tiene dificultades de aprendizaje, por lo que bloquea la dificultad en 50% (en lugar de 45% por ser Colegio Alemán) para mantener consistencia pedagógica.
  - Se activa la **retroalimentación diferenciada DUA**: el comentario del Agente 3 se estructura en secciones visuales diferenciadas, emojis de progreso, listas con viñetas claras y un **plan de acción paso a paso** para mejorar la redacción.
  - La interfaz de usuario le permite a este estudiante ajustar el tamaño de letra (A, A+, A++) y cambiar el contraste (Estándar, Alto Contraste Claro, Alto Contraste Oscuro) para facilitar la lectura.

---

## 🤖 El Sistema Multiagente (Lógica de Corrección)

Cuando un ensayo es enviado, se añade a la cola y es analizado en tres etapas:

1. **Agente 1 (Ortografía y Redacción):** Examina el ensayo mediante un diccionario léxico interactivo detectando errores de puntuación, tildación y gramática en español. Retorna la ubicación exacta del error para resaltarlo en rojo en el visor del reporte.
2. **Agente 2 (Filosofía - Nivel Doctorado):** Detecta la mención de filósofos clásicos (Platón, Aristóteles, Kant, Nietzsche, Descartes, etc.) y evalúa la pertinencia conceptual. Si se cometen contradicciones típicas (como atribuir empirismo sensorial a Kant), el agente lo señala con una propuesta de solución racional. También evalúa el uso de conectores causales.
3. **Agente 3 (Metodólogo y Evaluador DUA):** Recopila los errores detectados por los Agentes 1 y 2, calcula el promedio en una escala del 1.0 al 7.0 (según el factor de exigencia del colegio) y redacta la devolución personalizada (estándar o adaptada con viñetas DUA).
