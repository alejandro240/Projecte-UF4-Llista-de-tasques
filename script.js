/**
 * Aplicació de Llista de Tasques amb sincronització offline i backend
 * @file appTareas.js
 */

const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");
const connectionStatus = document.getElementById("connectionStatus");
const ordenarCompletes = document.getElementById("ordenarCompletes");
const ordenarData = document.getElementById("ordenarData");

let tasques = JSON.parse(localStorage.getItem("tasques")) || [];
let pendingSync = JSON.parse(localStorage.getItem("pendingSync")) || [];

/**
 * Mostra l'estat de connexió a la interfície
 */
function updateConnectionStatus() {
  if (navigator.onLine) {
    // Quan estem en línia i sincronitzant
    connectionStatus.textContent = "Estàs en línia. Sincronitzant...";
    connectionStatus.className = "syncing";  // Aplicant el fons negre i text blanc

    // Inicia la sincronització
    sincronitzar();
  } else {
    // Quan estem fora de línia
    connectionStatus.textContent = "Estàs fora de línia. Els canvis es guardaran localment.";
    connectionStatus.className = "offline"; // Missatge per a connexió fora de línia
  }
}


/**
 * Desa les tasques i les operacions pendents al localStorage
 */
function guardarTasques() {
  localStorage.setItem("tasques", JSON.stringify(tasques));
  localStorage.setItem("pendingSync", JSON.stringify(pendingSync));
}

/**
 * Renderitza la llista de tasques
 */
function renderitzarTasques() {
  taskList.innerHTML = "";

  tasques.forEach((tasca, index) => {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.textContent = tasca.nom;
    span.className = tasca.completada ? "completed" : "";

    const botoCompletar = document.createElement("button");
    botoCompletar.textContent = tasca.completada ? "Desfer" : "Completa";
    botoCompletar.className = "complete";
    botoCompletar.onclick = () => {
      tasques[index].completada = !tasques[index].completada;
      guardarTasques();
      renderitzarTasques();
    };

    const botoEditar = document.createElement("button");
    botoEditar.textContent = "Edita";
    botoEditar.className = "edit";
    botoEditar.onclick = () => obrirModalEdicio(index);

    const botoEliminar = document.createElement("button");
    botoEliminar.textContent = "Elimina";
    botoEliminar.className = "delete";
    botoEliminar.onclick = () => {
      tasques.splice(index, 1);
      guardarTasques();
      renderitzarTasques();
    };

    li.appendChild(span);
    li.appendChild(botoCompletar);
    li.appendChild(botoEditar);
    li.appendChild(botoEliminar);
    taskList.appendChild(li);
  });
}

/**
 * Afegeix una nova tasca
 */
taskForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const nomTasca = taskInput.value.trim();
  if (nomTasca === "") return;

  const novaTasca = {
    id: Date.now(),
    nom: nomTasca,
    completada: false,
    data: new Date().toISOString()
  };

  tasques.push(novaTasca);
  pendingSync.push({ accio: "add", tasca: novaTasca });
  guardarTasques();
  renderitzarTasques();
  taskInput.value = "";
});

/**
 * Ordenació per completades
 */
ordenarCompletes.addEventListener("click", () => {
  tasques.sort((a, b) => a.completada - b.completada);
  guardarTasques();
  renderitzarTasques();
});

/**
 * Ordenació per data
 */
ordenarData.addEventListener("click", () => {
  tasques.sort((a, b) => new Date(a.data) - new Date(b.data));
  guardarTasques();
  renderitzarTasques();
});

/**
 * Sincronitza les tasques amb el backend
 */
function sincronitzar() {
  if (!navigator.onLine || pendingSync.length === 0) {
    console.log("No hi ha connexió o no hi ha operacions pendents.");
    return;
  }

  const syncOps = [...pendingSync];
  pendingSync = []; // Esborrem les operacions pendents mentre les sincronitzem.

  Promise.all(syncOps.map(op => {
    if (op.accio === "add") {
      return fetch("http://localhost:3000/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: op.tasca.nom })
      })
      .then(res => res.json()) // Asegura't que el backend respon correctament.
      .catch(error => {
        console.error("Error al sincronitzar tasca afegida:", error);
        pendingSync.push(op); // Tornem a posar l'operació pendent si hi ha un error.
        return null;
      });
    } else if (op.accio === "update") {
      return fetch(`http://localhost:3000/tasks/${op.tasca.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: op.tasca.nom, completed: op.tasca.completada })
      })
      .catch(error => {
        console.error("Error al sincronitzar tasca actualitzada:", error);
        pendingSync.push(op); // Tornem a posar l'operació pendent si hi ha un error.
        return null;
      });
    } else if (op.accio === "delete") {
      return fetch(`http://localhost:3000/tasks/${op.tasca.id}`, { method: "DELETE" })
      .catch(error => {
        console.error("Error al sincronitzar tasca eliminada:", error);
        pendingSync.push(op); // Tornem a posar l'operació pendent si hi ha un error.
        return null;
      });
    }
  }))
  .then(() => {
    connectionStatus.textContent = "Sincronització completada.";
    connectionStatus.className = "online";
    guardarTasques();
  })
  .catch(() => {
    console.error("Error de sincronització completada.");
    connectionStatus.textContent = "Error de sincronització. Tornarem a intentar.";
    connectionStatus.className = "offline";
    guardarTasques();
  });
}

/**
 * Inicialitza l'aplicació
 */
window.addEventListener("load", () => {
  updateConnectionStatus();
  renderitzarTasques();
});

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

// Modal d'edició
const editModal = document.getElementById("editModal");
const editInput = document.getElementById("editInput");
const saveEdit = document.getElementById("saveEdit");
const cancelEdit = document.getElementById("cancelEdit");

let indexEdicio = null;

function obrirModalEdicio(index) {
  indexEdicio = index;
  editInput.value = tasques[index].nom;
  editModal.classList.remove("hidden");
  editInput.focus();
}

cancelEdit.addEventListener("click", () => {
  editModal.classList.add("hidden");
  indexEdicio = null;
});

saveEdit.addEventListener("click", () => {
  const nouNom = editInput.value.trim();
  if (nouNom && indexEdicio !== null) {
    tasques[indexEdicio].nom = nouNom;
    pendingSync.push({ accio: "update", tasca: tasques[indexEdicio] });
    guardarTasques();
    renderitzarTasques();
  }
  editModal.classList.add("hidden");
  indexEdicio = null;
});
