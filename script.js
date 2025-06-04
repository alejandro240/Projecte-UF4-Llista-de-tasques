/** Referències als elements del DOM */
const formulariTasca           = document.getElementById("taskForm");
const entradaNomTasca          = document.getElementById("taskInput");
const llistaTasquesDOM         = document.getElementById("taskList");
const indicadorConnexio        = document.getElementById("connectionStatus");
const botoOrdenarCompletes     = document.getElementById("ordenarCompletes");
const botoOrdenarPerData       = document.getElementById("ordenarData");

const modalEdicio              = document.getElementById("editModal");
const entradaEdicio            = document.getElementById("editInput");
const botoGuardarEdicio        = document.getElementById("saveEdit");
const botoCancel·larEdicio     = document.getElementById("cancelEdit");

/** Estat local de les tasques i operacions pendents */
let llistaTasques              = JSON.parse(localStorage.getItem("tasques")) || [];
let operacionsPendents         = JSON.parse(localStorage.getItem("pendingSync")) || [];

/** Índex de la tasca que s'està editant */
let indexTascaEnEdicio         = null;

/** Guarda l'estat local a localStorage */
function guardarTasques() {
  localStorage.setItem("tasques", JSON.stringify(llistaTasques));
  localStorage.setItem("pendingSync", JSON.stringify(operacionsPendents));
}

/** Obté les tasques del servidor i les desa localment */
async function obtenirTasquesDelServidor() {
  try {
    const resposta = await fetch("http://localhost:3000/tasks");
    if (!resposta.ok) {
      console.error("Error HTTP en obtenir tasques:", resposta.status);
      return;
    }

    const dades = await resposta.json();
    const tasquesServidor = dades.map(t => ({
      id: t.id,
      nom: t.text,
      completada: t.completed,
      data: new Date().toISOString()
    }));

    llistaTasques = tasquesServidor;
    guardarTasques();
    renderitzarTasques();

  } catch (error) {
    console.warn("No s'ha pogut connectar al servidor per obtenir les tasques:", error.message);
  }
}

/** Sincronitza les operacions pendents amb el backend */
async function sincronitzar() {
  if (!navigator.onLine || operacionsPendents.length === 0) {
    console.log("Sincronització: no hi ha connexió o operacions pendents.");
    return;
  }

  const operacionsAProcessar = [...operacionsPendents];
  operacionsPendents = [];

  // 1. Afegir
  for (const op of operacionsAProcessar) {
    if (op.accio !== "add") continue;
    const tascaLocal = op.tasca;
    try {
      const resposta = await fetch("http://localhost:3000/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: tascaLocal.nom })
      });

      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const tascaServidor = await resposta.json();

      const index = llistaTasques.findIndex(t => t.id === tascaLocal.id);
      if (index !== -1) {
        llistaTasques[index].id = tascaServidor.id;
        llistaTasques[index].completada = tascaServidor.completed;
      }

    } catch (error) {
      console.error("Error sincronitzant (afegir):", error);
      operacionsPendents.push(op);
    }
  }

  // 2. Actualitzar
  for (const op of operacionsAProcessar) {
    if (op.accio !== "update") continue;
    const tascaLocal = op.tasca;

    if (tascaLocal.id < 0) {
      operacionsPendents.push(op);
      continue;
    }

    try {
      const resposta = await fetch(`http://localhost:3000/tasks/${tascaLocal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: tascaLocal.nom,
          completed: tascaLocal.completada
        })
      });

      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    } catch (error) {
      console.error("Error sincronitzant (actualitzar):", error);
      operacionsPendents.push(op);
    }
  }

  // 3. Esborrar
  for (const op of operacionsAProcessar) {
    if (op.accio !== "delete") continue;
    const tascaLocal = op.tasca;

    if (tascaLocal.id < 0) continue;

    try {
      const resposta = await fetch(`http://localhost:3000/tasks/${tascaLocal.id}`, {
        method: "DELETE"
      });

      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    } catch (error) {
      console.error("Error sincronitzant (esborrar):", error);
      operacionsPendents.push(op);
    }
  }

  guardarTasques();
}

/** Actualitza l'estat de la connexió i sincronitza si cal */
async function actualitzarEstatConnexio() {
  if (navigator.onLine) {
    indicadorConnexio.textContent = "Estàs en línia. Sincronitzant...";
    indicadorConnexio.className = "syncing";

    await sincronitzar();
    await obtenirTasquesDelServidor();
    renderitzarTasques();

    indicadorConnexio.textContent = "Connectat";
    indicadorConnexio.className = "online";
  } else {
    indicadorConnexio.textContent = "Estàs fora de línia. Els canvis es guardaran localment.";
    indicadorConnexio.className = "offline";
  }
}

/** Renderitza la llista de tasques al DOM */
function renderitzarTasques() {
  llistaTasquesDOM.innerHTML = "";

  llistaTasques.forEach((tasca, index) => {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.textContent = tasca.nom;
    if (tasca.completada) span.classList.add("completed");

    const botoCompletar = document.createElement("button");
    botoCompletar.textContent = tasca.completada ? "Desfer" : "Completa";
    botoCompletar.className = "complete";
    botoCompletar.onclick = () => {
      llistaTasques[index].completada = !llistaTasques[index].completada;
      operacionsPendents.push({ accio: "update", tasca: llistaTasques[index] });
      guardarTasques();
      renderitzarTasques();
      if (navigator.onLine) actualitzarEstatConnexio();
    };

    const botoEditar = document.createElement("button");
    botoEditar.textContent = "Edita";
    botoEditar.className = "edit";
    botoEditar.onclick = () => obrirModalEdicio(index);

    const botoEliminar = document.createElement("button");
    botoEliminar.textContent = "Elimina";
    botoEliminar.className = "delete";
    botoEliminar.onclick = () => {
      const tascaEsborrar = llistaTasques[index];
      llistaTasques.splice(index, 1);
      operacionsPendents.push({ accio: "delete", tasca: tascaEsborrar });
      guardarTasques();
      renderitzarTasques();
      if (navigator.onLine) actualitzarEstatConnexio();
    };

    li.appendChild(span);
    li.appendChild(botoCompletar);
    li.appendChild(botoEditar);
    li.appendChild(botoEliminar);
    llistaTasquesDOM.appendChild(li);
  });
}

/** Mostra el modal d'edició amb la tasca seleccionada */
function obrirModalEdicio(index) {
  indexTascaEnEdicio = index;
  entradaEdicio.value = llistaTasques[index].nom;
  modalEdicio.classList.remove("hidden");
  entradaEdicio.focus();
}

/** Tanca el modal d'edició */
botoCancel·larEdicio.addEventListener("click", () => {
  modalEdicio.classList.add("hidden");
  indexTascaEnEdicio = null;
});

/** Desa els canvis de l'edició */
botoGuardarEdicio.addEventListener("click", () => {
  const nouNom = entradaEdicio.value.trim();
  if (nouNom !== "" && indexTascaEnEdicio !== null) {
    llistaTasques[indexTascaEnEdicio].nom = nouNom;
    operacionsPendents.push({ accio: "update", tasca: llistaTasques[indexTascaEnEdicio] });
    guardarTasques();
    renderitzarTasques();
    if (navigator.onLine) actualitzarEstatConnexio();
  }
  modalEdicio.classList.add("hidden");
  indexTascaEnEdicio = null;
});

/** Ordenació per estat (completades/incompletes) */
let ordenarPerEstatAsc = true;
botoOrdenarCompletes.addEventListener("click", () => {
  llistaTasques.sort((a, b) =>
    ordenarPerEstatAsc ? a.completada - b.completada : b.completada - a.completada
  );
  ordenarPerEstatAsc = !ordenarPerEstatAsc;
  guardarTasques();
  renderitzarTasques();
});

/** Ordenació per data */
let ordenarPerDataAsc = true;
botoOrdenarPerData.addEventListener("click", () => {
  llistaTasques.sort((a, b) =>
    ordenarPerDataAsc ? new Date(a.data) - new Date(b.data) : new Date(b.data) - new Date(a.data)
  );
  ordenarPerDataAsc = !ordenarPerDataAsc;
  guardarTasques();
  renderitzarTasques();
});

/** Inicialització quan es carrega la pàgina */
window.addEventListener("load", async () => {
  actualitzarEstatConnexio();
  if (navigator.onLine) {
    await obtenirTasquesDelServidor();
  }
  renderitzarTasques();
});

/** Escolta canvis d'estat de connexió */
window.addEventListener("online", actualitzarEstatConnexio);
window.addEventListener("offline", actualitzarEstatConnexio);

/** Afegeix una nova tasca */
formulariTasca.addEventListener("submit", function (e) {
  e.preventDefault();
  const nomTasca = entradaNomTasca.value.trim();
  if (nomTasca === "") return;

  const idTemporal = -Date.now();
  const novaTasca = {
    id: idTemporal,
    nom: nomTasca,
    completada: false,
    data: new Date().toISOString()
  };

  llistaTasques.push(novaTasca);
  operacionsPendents.push({ accio: "add", tasca: novaTasca });
  guardarTasques();
  renderitzarTasques();
  entradaNomTasca.value = "";

  if (navigator.onLine) {
    actualitzarEstatConnexio();
  }
});
