/**
 * @file appTareas.js
 * @description Aplicació de llista de tasques que comunica amb l'endpoint (http://localhost:3000/tasks)
 * mitjançant peticions fetch amb uso de then(), amb gestió offline i documentació amb JSDoc.
 */

document.addEventListener("DOMContentLoaded", function() {
    // URL del backend (endpoint)
    var API_URL = "http://localhost:3000/tasks";
    
    // Variables globals per emmagatzemar les tasques i les accions pendents
    var tasks = [];
    var pendingActions = [];
    
    // Referències als elements del DOM
    var taskList = document.getElementById("taskList");
    var taskForm = document.getElementById("taskForm");
    var taskInput = document.getElementById("taskInput");
    var connectionStatus = document.getElementById("connectionStatus");
    
    /**
     * Renderitza la llista de tasques en el DOM.
     */
    function renderTasks() {
      taskList.innerHTML = "";
      var i, li, span, completeBtn, deleteBtn;
      for (i = 0; i < tasks.length; i++) {
        li = document.createElement("li");
        li.setAttribute("data-id", tasks[i].id);
        
        // Span per el text de la tasca, editable
        span = document.createElement("span");
        span.textContent = tasks[i].text;
        if (tasks[i].completed) {
          span.className = "completed";
        }
        span.contentEditable = "true";
        span.addEventListener("blur", function(e) {
          var newText = e.target.textContent;
          var id = e.target.parentNode.getAttribute("data-id");
          var j;
          for (j = 0; j < tasks.length; j++) {
            if (tasks[j].id == id) {
              if (tasks[j].text !== newText) {
                updateTask(id, { text: newText });
              }
              break;
            }
          }
        });
        li.appendChild(span);
        
        // Botó per marcar o desmarcar
        completeBtn = document.createElement("button");
        completeBtn.textContent = tasks[i].completed ? "Desmarcar" : "Completar";
        completeBtn.addEventListener("click", function(e) {
          var liParent = e.target.parentNode;
          var id = liParent.getAttribute("data-id");
          var k;
          for (k = 0; k < tasks.length; k++) {
            if (tasks[k].id == id) {
              updateTask(id, { completed: !tasks[k].completed });
              break;
            }
          }
        });
        li.appendChild(completeBtn);
        
        // Botó per eliminar la tasca
        deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Eliminar";
        deleteBtn.addEventListener("click", function(e) {
          var liParent = e.target.parentNode;
          var id = liParent.getAttribute("data-id");
          deleteTask(id);
        });
        li.appendChild(deleteBtn);
        
        taskList.appendChild(li);
      }
    }
    
    /**
     * Desa les accions pendents al localStorage.
     */
    function savePendingActions() {
      localStorage.setItem("pendingActions", JSON.stringify(pendingActions));
    }
    
    /**
     * Carrega les accions pendents del localStorage.
     */
    function loadPendingActions() {
      var stored = localStorage.getItem("pendingActions");
      if (stored) {
        pendingActions = JSON.parse(stored);
      }
    }
    
    /**
     * Actualitza l'indicador de connexió.
     */
    function updateConnectionStatus() {
      if (navigator.onLine) {
        connectionStatus.textContent = "Conectat";
        connectionStatus.className = "online";
      } else {
        connectionStatus.textContent = "Sense connexió";
        connectionStatus.className = "offline";
      }
    }
    
    /**
     * Obté totes les tasques del backend (GET).
     */
    function fetchTasks() {
      fetch(API_URL)
        .then(function(response) {
          return response.json();
        })
        .then(function(data) {
          tasks = data;
          localStorage.setItem("tasks", JSON.stringify(tasks));
          renderTasks();
        })
        .catch(function(error) {
          console.log("Error obtenint tasques del servidor:", error);
          // Si hi ha error (per exemple, offline), càrrega les tasques de localStorage
          var stored = localStorage.getItem("tasks");
          if (stored) {
            tasks = JSON.parse(stored);
            renderTasks();
          }
        });
    }
    
    /**
     * Crea una nova tasca (POST).
     * Si no hi ha connexió, desa l'acció pendent i afegeix la tasca de forma provisional.
     *
     * @param {Object} taskData - Objecte amb les dades de la tasca (ex. { text: "Nova tasca", completed: false })
     */
    function createTask(taskData) {
      if (navigator.onLine) {
        fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(taskData)
        })
        .then(function(response) {
          return response.json();
        })
        .then(function(newTask) {
          tasks.push(newTask);
          localStorage.setItem("tasks", JSON.stringify(tasks));
          renderTasks();
        })
        .catch(function(error) {
          console.log("Error creant tasca al servidor:", error);
          pendingActions.push({ method: "POST", data: taskData });
          savePendingActions();
          // Crea una tasca provisional amb un id generat localment
          var offlineTask = { id: Date.now(), text: taskData.text, completed: false };
          tasks.push(offlineTask);
          localStorage.setItem("tasks", JSON.stringify(tasks));
          renderTasks();
        });
      } else {
        pendingActions.push({ method: "POST", data: taskData });
        savePendingActions();
        var offlineTask = { id: Date.now(), text: taskData.text, completed: false };
        tasks.push(offlineTask);
        localStorage.setItem("tasks", JSON.stringify(tasks));
        renderTasks();
      }
    }
    
    /**
     * Actualitza una tasca existent (PUT).
     *
     * @param {number|string} taskId - ID de la tasca que es vol actualitzar.
     * @param {Object} updates - Objecte amb les actualitzacions (ex. { text: "Nou text" } o { completed: true })
     */
    function updateTask(taskId, updates) {
      var i, key;
      for (i = 0; i < tasks.length; i++) {
        if (tasks[i].id == taskId) {
          for (key in updates) {
            tasks[i][key] = updates[key];
          }
          break;
        }
      }
      localStorage.setItem("tasks", JSON.stringify(tasks));
      renderTasks();
      
      if (navigator.onLine) {
        fetch(API_URL + "/" + taskId, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(updates)
        })
        .then(function(response) {
          return response.json();
        })
        .then(function(updatedTask) {
          console.log("Tasca actualitzada al servidor:", updatedTask);
        })
        .catch(function(error) {
          console.log("Error actualitzant la tasca al servidor:", error);
          pendingActions.push({ method: "PUT", id: taskId, data: updates });
          savePendingActions();
        });
      } else {
        pendingActions.push({ method: "PUT", id: taskId, data: updates });
        savePendingActions();
      }
    }
    
    /**
     * Elimina una tasca (DELETE).
     *
     * @param {number|string} taskId - ID de la tasca a eliminar.
     */
    function deleteTask(taskId) {
      var newTasks = [];
      var i;
      for (i = 0; i < tasks.length; i++) {
        if (tasks[i].id != taskId) {
          newTasks.push(tasks[i]);
        }
      }
      tasks = newTasks;
      localStorage.setItem("tasks", JSON.stringify(tasks));
      renderTasks();
      
      if (navigator.onLine) {
        fetch(API_URL + "/" + taskId, {
          method: "DELETE"
        })
        .then(function(response) {
          return response.json();
        })
        .then(function(data) {
          console.log(data.message);
        })
        .catch(function(error) {
          console.log("Error eliminant tasca al servidor:", error);
          pendingActions.push({ method: "DELETE", id: taskId });
          savePendingActions();
        });
      } else {
        pendingActions.push({ method: "DELETE", id: taskId });
        savePendingActions();
      }
    }
    
    /**
     * Sincronitza les accions pendents amb el servidor quan es recupera la connexió.
     */
    function syncPendingActions() {
      var i;
      if (pendingActions.length > 0) {
        for (i = 0; i < pendingActions.length; i++) {
          (function(action) {
            if (action.method === "POST") {
              fetch(API_URL, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(action.data)
              })
              .then(function(response) {
                return response.json();
              })
              .then(function(result) {
                console.log("Sincronització: tasca creada:", result);
              })
              .catch(function(err) {
                console.log("Error sincronitzant acció POST:", err);
              });
            } else if (action.method === "PUT") {
              fetch(API_URL + "/" + action.id, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(action.data)
              })
              .then(function(response) {
                return response.json();
              })
              .then(function(result) {
                console.log("Sincronització: tasca actualitzada:", result);
              })
              .catch(function(err) {
                console.log("Error sincronitzant acció PUT:", err);
              });
            } else if (action.method === "DELETE") {
              fetch(API_URL + "/" + action.id, {
                method: "DELETE"
              })
              .then(function(response) {
                return response.json();
              })
              .then(function(result) {
                console.log("Sincronització: tasca eliminada:", result);
              })
              .catch(function(err) {
                console.log("Error sincronitzant acció DELETE:", err);
              });
            }
          })(pendingActions[i]);
        }
        pendingActions = [];
        localStorage.removeItem("pendingActions");
      }
      updateConnectionStatus();
    }
    
    /* Esdeveniments per detectar canvis en la connexió */
    window.addEventListener("online", function() {
      updateConnectionStatus();
      loadPendingActions();
      syncPendingActions();
      fetchTasks();
    });
    
    window.addEventListener("offline", function() {
      updateConnectionStatus();
    });
    
    /* Enviament del formulari per crear nova tasca */
    taskForm.addEventListener("submit", function(e) {
      e.preventDefault();
      var text = taskInput.value.trim();
      if (text !== "") {
        createTask({ text: text, completed: false });
        taskInput.value = "";
      }
    });
    
    // Inicialització: actualitza estat de connexió, carrega accions pendents i obté tasques
    updateConnectionStatus();
    loadPendingActions();
    fetchTasks();
  });