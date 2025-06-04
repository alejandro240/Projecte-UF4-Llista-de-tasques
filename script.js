/**
 * @file script.js
 * @description Aplicació de Llista de Tasques amb sincronització offline i backend (NodeJS + SQLite).
 * @author Alejandro
 */

/** Referencias a elementos DOM */
const taskForm          = document.getElementById("taskForm");
const taskInput         = document.getElementById("taskInput");
const taskList          = document.getElementById("taskList");
const connectionStatus  = document.getElementById("connectionStatus");
const ordenarCompletes  = document.getElementById("ordenarCompletes");
const ordenarData       = document.getElementById("ordenarData");

const editModal         = document.getElementById("editModal");
const editInput         = document.getElementById("editInput");
const saveEdit          = document.getElementById("saveEdit");
const cancelEdit        = document.getElementById("cancelEdit");

/** Estado local de tareas y operaciones pendientes */
let tasques     = JSON.parse(localStorage.getItem("tasques")) || [];
let pendingSync = JSON.parse(localStorage.getItem("pendingSync")) || [];

/** Índice de tarea en edición */
let indexEdicio = null;

/**
 * Guarda en localStorage las variables 'tasques' y 'pendingSync'.
 */
function guardarTasques() {
  localStorage.setItem("tasques", JSON.stringify(tasques));
  localStorage.setItem("pendingSync", JSON.stringify(pendingSync));
}

/**
 * Obtiene todas las tareas del servidor (GET /tasks) y actualiza 'tasques'.
 * @returns {Promise<void>}
 */
async function fetchTareasServidor() {
  try {
    const respuesta = await fetch("http://localhost:3000/tasks");
    if (!respuesta.ok) {
      console.error("Error HTTP al obtener tareas:", respuesta.status);
      return;
    }
    /** @type {{ id: number, text: string, completed: boolean }[]} */
    const datos = await respuesta.json();

    const tareasServidor = datos.map(t => ({
      id: t.id,
      nom: t.text,
      completada: t.completed,
      data: new Date().toISOString()
    }));

    tasques = tareasServidor;
    guardarTasques();
    renderitzarTasques();

  } catch (error) {
    console.warn("No se pudo conectar al servidor para obtener tareas:", error.message);
  }
}

/**
 * Sincroniza operaciones pendientes (add, update, delete) con el backend.
 * - Primero envía los “add” para obtener IDs reales.
 * - Luego procesa los “update” (PUT).
 * - Finalmente procesa los “delete” (DELETE).
 * Las operaciones que fallen se agregan de nuevo a 'pendingSync'.
 * @returns {Promise<void>}
 */
async function sincronitzar() {
  if (!navigator.onLine || pendingSync.length === 0) {
    console.log("Sincronitzar: no hi ha connexió o no hi ha operacions pendents.");
    return;
  }

  // Hacemos una copia y vaciamos pendingSync para volver a llenarlo solo con los que fallen
  const opsPendents = [...pendingSync];
  pendingSync = [];

  // 1) PROCESAR “add”
  for (const op of opsPendents) {
    if (op.accio !== "add") continue;
    const tascaLocal = op.tasca;
    try {
      const resp = await fetch("http://localhost:3000/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: tascaLocal.nom })
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      /** @type {{ id: number, text: string, completed: boolean }} */
      const datosServidor = await resp.json();

      // Buscar y reemplazar ID temporal
      const idx = tasques.findIndex(t => t.id === tascaLocal.id);
      if (idx !== -1) {
        tasques[idx].id = datosServidor.id;
        tasques[idx].completada = datosServidor.completed;
      }
      // No reencolamos porque fue exitoso
    } catch (error) {
      console.error("Error sincronitzant ADD:", error);
      // Si falla, lo agregamos de nuevo
      pendingSync.push(op);
    }
  }

  // 2) PROCESAR “update”
  for (const op of opsPendents) {
    if (op.accio !== "update") continue;
    const tascaLocal = op.tasca;

    // Si todavía es ID negativo, significa que no se creó aún; reencolamos
    if (tascaLocal.id < 0) {
      pendingSync.push(op);
      continue;
    }

    try {
      const resp = await fetch(`http://localhost:3000/tasks/${tascaLocal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: tascaLocal.nom,
          completed: tascaLocal.completada
        })
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      // Si salió bien, no hacemos nada más
    } catch (error) {
      console.error("Error sincronitzant UPDATE:", error);
      pendingSync.push(op);
    }
  }

  // 3) PROCESAR “delete”
  for (const op of opsPendents) {
    if (op.accio !== "delete") continue;
    const tascaLocal = op.tasca;

    // Si ID negativo, nunca existió en servidor: no reencolamos ni llamamos a DELETE
    if (tascaLocal.id < 0) {
      continue;
    }

    try {
      const resp = await fetch(`http://localhost:3000/tasks/${tascaLocal.id}`, {
        method: "DELETE"
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    } catch (error) {
      console.error("Error sincronitzant DELETE:", error);
      pendingSync.push(op);
    }
  }

  // Guardamos el estado resultante
  guardarTasques();
}

/**
 * Actualiza el indicador visual de conexión (verde/rojo) y, si hay conexión,
 * sincroniza y recarga tareas.
 */
async function updateConnectionStatus() {
  if (navigator.onLine) {
    connectionStatus.textContent = "Estàs en línia. Sincronitzant...";
    connectionStatus.className = "syncing";

    await sincronitzar();
    await fetchTareasServidor();
    renderitzarTasques();

    connectionStatus.textContent = "Conectado";
    connectionStatus.className = "online";
  } else {
    connectionStatus.textContent = "Estàs fora de línia. Els canvis es guardaran localment.";
    connectionStatus.className = "offline";
  }
}

/**
 * Renderitza la llista de tasques en el DOM, aplicant ordenació si la hay.
 */
function renderitzarTasques() {
  taskList.innerHTML = "";

  tasques.forEach((tasca, index) => {
    const li = document.createElement("li");

    // Texto de la tarea (span)
    const span = document.createElement("span");
    span.textContent = tasca.nom;
    if (tasca.completada) span.classList.add("completed");

    // Botón Completar/Desfer
    const botoCompletar = document.createElement("button");
    botoCompletar.textContent = tasca.completada ? "Desfer" : "Completa";
    botoCompletar.className = "complete";
    botoCompletar.onclick = () => {
      // Toggle completada
      tasques[index].completada = !tasques[index].completada;
      // Encolamos la actualización
      pendingSync.push({ accio: "update", tasca: tasques[index] });
      guardarTasques();
      renderitzarTasques();
      if (navigator.onLine) {
        // Sincronizamos de inmediato
        updateConnectionStatus();
      }
    };

    // Botón Editar (abre modal)
    const botoEditar = document.createElement("button");
    botoEditar.textContent = "Edita";
    botoEditar.className = "edit";
    botoEditar.onclick = () => obrirModalEdicio(index);

    // Botón Eliminar
    const botoEliminar = document.createElement("button");
    botoEliminar.textContent = "Elimina";
    botoEliminar.className = "delete";
    botoEliminar.onclick = () => {
      const tascaABorrar = tasques[index];
      // Quitamos localmente
      tasques.splice(index, 1);
      // Encolamos DELETE
      pendingSync.push({ accio: "delete", tasca: tascaABorrar });
      guardarTasques();
      renderitzarTasques();
      if (navigator.onLine) {
        updateConnectionStatus();
      }
    };

    li.appendChild(span);
    li.appendChild(botoCompletar);
    li.appendChild(botoEditar);
    li.appendChild(botoEliminar);
    taskList.appendChild(li);
  });
}

/**
 * Manejo del modal de edición: muestra el input con el texto actual.
 * @param {number} index - índice de la tarea a editar en `tasques`
 */
function obrirModalEdicio(index) {
  indexEdicio = index;
  editInput.value = tasques[index].nom;
  editModal.classList.remove("hidden");
  editInput.focus();
}

/**
 * Cierra el modal sin guardar cambios.
 */
cancelEdit.addEventListener("click", () => {
  editModal.classList.add("hidden");
  indexEdicio = null;
});

/**
 * Guarda la edición de la tarea, encolando el “update”.
 */
saveEdit.addEventListener("click", () => {
  const nouNom = editInput.value.trim();
  if (nouNom !== "" && indexEdicio !== null) {
    tasques[indexEdicio].nom = nouNom;
    // Encolamos la actualización
    pendingSync.push({ accio: "update", tasca: tasques[indexEdicio] });
    guardarTasques();
    renderitzarTasques();
    if (navigator.onLine) {
      updateConnectionStatus();
    }
  }
  editModal.classList.add("hidden");
  indexEdicio = null;
});

/**
 * Ordena las tareas por estado (alternando asc/desc).
 */
let estatAscendente = true;
ordenarCompletes.addEventListener("click", () => {
  if (estatAscendente) {
    tasques.sort((a, b) => a.completada - b.completada);
  } else {
    tasques.sort((a, b) => b.completada - a.completada);
  }
  estatAscendente = !estatAscendente;
  guardarTasques();
  renderitzarTasques();
});

/**
 * Ordena las tareas por fecha (alternando asc/desc).
 */
let dataAscendente = true;
ordenarData.addEventListener("click", () => {
  if (dataAscendente) {
    tasques.sort((a, b) => new Date(a.data) - new Date(b.data));
  } else {
    tasques.sort((a, b) => new Date(b.data) - new Date(a.data));
  }
  dataAscendente = !dataAscendente;
  guardarTasques();
  renderitzarTasques();
});

/**
 * Al cargar la página (load), inicializamos estado, 
 * procesamos sincronización y obtenemos del servidor si estamos online.
 */
window.addEventListener("load", async () => {
  updateConnectionStatus();   // Actualiza indicador y, si hay conexión, sincroniza+fetch
  if (navigator.onLine) {
    // Ya dentro de updateConnectionStatus() se llama a sincronitzar() y fetch
    // Pero nos aseguramos de que se renderice tras esa llamada
    await fetchTareasServidor();
  }
  renderitzarTasques();
});

// Listeners de eventos online/offline
window.addEventListener("online",  updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

/**
 * Lógicamente, el envío de nuevas tareas también se encolará.
 */
taskForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const nomTasca = taskInput.value.trim();
  if (nomTasca === "") return;

  // ID temporal negativo
  const idTemporal = -Date.now();
  const novaTasca = {
    id: idTemporal,
    nom: nomTasca,
    completada: false,
    data: new Date().toISOString()
  };

  tasques.push(novaTasca);
  pendingSync.push({ accio: "add", tasca: novaTasca });
  guardarTasques();
  renderitzarTasques();
  taskInput.value = "";

  if (navigator.onLine) {
    updateConnectionStatus();
  }
});
