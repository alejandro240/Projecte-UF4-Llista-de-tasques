/**
 * Inicialització de variables
 */
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");
const connectionStatus = document.getElementById("connectionStatus");
const ordenarCompletes = document.getElementById("ordenarCompletes");
const ordenarData = document.getElementById("ordenarData");

let tasques = JSON.parse(localStorage.getItem("tasques")) || [];

/**
 * Mostra l'estat de connexió
 */
function updateConnectionStatus() {
  if (navigator.onLine) {
    connectionStatus.textContent = "Estàs en línia.";
    connectionStatus.className = "online";
  } else {
    connectionStatus.textContent = "Estàs fora de línia. Els canvis es guardaran localment.";
    connectionStatus.className = "offline";
  }
}

/**
 * Desa les tasques al localStorage
 */
function guardarTasques() {
  localStorage.setItem("tasques", JSON.stringify(tasques));
}

/**
 * Renderitza totes les tasques a la interfície
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
    botoCompletar.onclick = () => {
      tasques[index].completada = !tasques[index].completada;
      guardarTasques();
      renderitzarTasques();
    };

    const botoEliminar = document.createElement("button");
    botoEliminar.textContent = "Elimina";
    botoEliminar.onclick = () => {
      tasques.splice(index, 1);
      guardarTasques();
      renderitzarTasques();
    };

    li.appendChild(span);
    li.appendChild(botoCompletar);
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
    nom: nomTasca,
    completada: false,
    data: new Date().toISOString()
  };

  tasques.push(novaTasca);
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
 * Inicialitza l'aplicació
 */
window.addEventListener("load", () => {
  updateConnectionStatus();
  renderitzarTasques();
});

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
