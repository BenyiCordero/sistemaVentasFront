// js/clientes.js
import { displayError, displayMessage } from "./utils.js";
import { getUserProfile } from "./session.js";

const BASE_API_URL = "/api";

const GET_CLIENTS_ENDPOINT = `${BASE_API_URL}/client`;
const CREATE_CLIENT_ENDPOINT = `${BASE_API_URL}/client`;
const UPDATE_CLIENT_ENDPOINT = (id) => `${BASE_API_URL}/client/${id}`;

const clientsTableBody = () => document.querySelector("#clientsTable tbody");
const clientsEmpty = () => document.getElementById("clients-empty");

let currentClients = [];
let modalInstance = null;
let editingClientId = null;

function renderClientRow(client) {
  const tr = document.createElement("tr");
  const nombreCompleto = [
    client.persona.nombre,
    client.persona.primerApellido,
    client.persona.segundoApellido,
  ]
    .filter(Boolean)
    .join(" ");
  const fechaRegistro = new Date(
    client.createdAt || Date.now()
  ).toLocaleDateString();

  tr.innerHTML = `
    <td>${client.idCliente ?? client.id ?? ""}</td>
    <td>${nombreCompleto}</td>
    <td>${client.persona.numeroTelefono || "N/A"}</td>
    <td><span class="badge bg-${client.creditoActivo ? "success" : "secondary"
    }">${client.creditoActivo ? "Activo" : "Inactivo"}</span></td>
    <td>${fechaRegistro}</td>
    <td>
        <button class="btn btn-sm btn-outline-primary btn-edit me-1" data-id="${client.idCliente || client.id
    }">
            <i class="bi bi-pencil"></i>
        </button>
    </td>
    `;
  return tr;
}

function renderClientsTable(clients) {
  const tbody = clientsTableBody();
  tbody.innerHTML = "";
  if (!clients || clients.length === 0) {
    clientsEmpty().classList.remove("d-none");
    return;
  }
  clientsEmpty().classList.add("d-none");
  clients.forEach((client) => tbody.appendChild(renderClientRow(client)));
}

function filterClients() {
  const searchTerm = document.getElementById("inputSearch").value.toLowerCase();
  const creditoFilter = document.getElementById("selectCredito").value;

  let filtered = currentClients.filter((client) => {
    const persona = client.persona || {};

    const nombreCompleto = [
      persona.nombre,
      persona.primerApellido,
      persona.segundoApellido,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      !searchTerm ||
      nombreCompleto.includes(searchTerm) ||
      persona.numeroTelefono?.includes(searchTerm) ||
      (client.id ?? client.idCliente)?.toString().includes(searchTerm);

    const matchesCredito =
      !creditoFilter ||
      (creditoFilter === "activo" && client.creditoActivo) ||
      (creditoFilter === "inactivo" && !client.creditoActivo);

    return matchesSearch && matchesCredito;
  });

  renderClientsTable(filtered);
}


async function fetchClients() {
  const token = localStorage.getItem("authToken");
  const res = await fetch(GET_CLIENTS_ENDPOINT, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    let txt = `Status ${res.status}`;
    try {
      const obj = await res.json();
      txt = obj.message || JSON.stringify(obj);
    } catch (e) {
      const t = await res.text();
      if (t) txt = t;
    }
    throw new Error(txt);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : data?.clients ?? data?.data ?? [];
}

async function createClient(clientPayload) {
  const token = localStorage.getItem("authToken");
  const res = await fetch(CREATE_CLIENT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(clientPayload),
  });
  if (!res.ok) {
    const body = await res.text(); // solo se lee UNA VEZ
    let txt = `Status ${res.status}`;

    if (body) {
      try {
        const json = JSON.parse(body);
        txt = json.message || body;
      } catch (_) {
        txt = body;
      }
    }

    throw new Error(txt);
  }

  return await res.json();
}

async function updateClient(id, clientPayload) {
  const token = localStorage.getItem("authToken");
  const res = await fetch(UPDATE_CLIENT_ENDPOINT(id), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(clientPayload),
  });
  if (!res.ok) {
    let txt = `Status ${res.status}`;
    try {
      const obj = await res.json();
      txt = obj.message || JSON.stringify(obj);
    } catch (e) {
      const t = await res.text();
      if (t) txt = t;
    }
    throw new Error(txt);
  }
  return await res.json();
}

function initModalLogic() {
  const modalEl = document.getElementById("modalClient");
  modalInstance = new bootstrap.Modal(modalEl);

  document.getElementById("btnOpenNewClient").addEventListener("click", () => {
    editingClientId = null;
    document.getElementById("modalClientTitle").textContent = "Nuevo cliente";
    document.getElementById("formClient").reset();
    document.getElementById("inputClientCredito").checked = false;
    modalInstance.show();
  });

  document
    .getElementById("formClient")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const payload = {
        nombre: document.getElementById("inputClientNombre").value.trim(),
        primerApellido: document
          .getElementById("inputClientPrimerApellido")
          .value.trim(),
        segundoApellido: document
          .getElementById("inputClientSegundoApellido")
          .value.trim(),
        numeroTelefono: document
          .getElementById("inputClientTelefono")
          .value.trim(),
        creditoActivo: !!document.getElementById("inputClientCredito").checked,
      };

      try {
        const btn = document.getElementById("btnSubmitClient");
        btn.disabled = true;
        btn.textContent = editingClientId ? "Actualizando..." : "Guardando...";

        if (editingClientId) {
          await updateClient(editingClientId, payload);
        } else {
          await createClient(payload);
        }

        modalInstance.hide();
        await loadClients();
      } catch (err) {
        console.error("saveClient error", err);
        displayError(`No se pudo guardar el cliente: ${err.message || err}`);
      } finally {
        const btn = document.getElementById("btnSubmitClient");
        btn.disabled = false;
        btn.textContent = "Guardar cliente";
      }
    });
}

function initTableHandlers() {
  document.getElementById("btnRefreshClients").addEventListener("click", () => {
    loadClients();
  });

  document.getElementById("btnFilter").addEventListener("click", () => {
    filterClients();
  });

  document.getElementById("inputSearch").addEventListener("input", () => {
    filterClients();
  });

  document.getElementById("selectCredito").addEventListener("change", () => {
    filterClients();
  });

  document
    .querySelector("#clientsTable tbody")
    .addEventListener("click", async (e) => {
      const btnEdit = e.target.closest(".btn-edit");
      const btnDelete = e.target.closest(".btn-delete");

      if (btnEdit) {
        const id = btnEdit.getAttribute("data-id");
        const client = currentClients.find((c) => (c.idCliente || c.id) == id);
        if (client) {
          editingClientId = id;
          document.getElementById("modalClientTitle").textContent =
            "Editar cliente";
          document.getElementById("inputClientNombre").value =
            client.persona?.nombre || "";

          document.getElementById("inputClientPrimerApellido").value =
            client.persona?.primerApellido || "";

          document.getElementById("inputClientSegundoApellido").value =
            client.persona?.segundoApellido || "";

          document.getElementById("inputClientTelefono").value =
            client.persona?.numeroTelefono || "";

          document.getElementById("inputClientCredito").checked =
            client.creditoActivo || false;

          modalInstance.show();
        }
      }

      if (btnDelete) {
        const id = btnDelete.getAttribute("data-id");
        if (confirm("¿Estás seguro de que deseas eliminar este cliente?")) {
          try {
            await deleteClient(id);
            displayMessage &&
              displayMessage("Cliente eliminado correctamente.");
            await loadClients();
          } catch (err) {
            console.error("deleteClient error", err);
            displayError(
              `No se pudo eliminar el cliente: ${err.message || err}`
            );
          }
        }
      }
    });
}

async function loadClients() {
  try {
    const clients = await fetchClients();
    currentClients = clients;
    filterClients();
  } catch (err) {
    console.error("loadClients error", err);
    displayError(`Error cargando clientes: ${err.message || err}`);
    renderClientsTable([]);
  }
}

async function init() {
  try {
    await getUserProfile().catch((err) => {
      console.warn("getUserProfile falló: ", err);
      return null;
    });

    initModalLogic();
    initTableHandlers();
    await loadClients();
  } catch (err) {
    console.error("init clientes error", err);
    displayError("Error inicializando módulo de clientes.");
  }
}

if (window.partialsReady) init();
else document.addEventListener("partialsLoaded", init);
