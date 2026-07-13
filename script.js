const db = {
  equipamentos: JSON.parse(localStorage.getItem('db_equipamentos')) || [],
  ferramentas: JSON.parse(localStorage.getItem('db_ferramentas')) || [],
  izamento: JSON.parse(localStorage.getItem('db_izamento')) || []
};

let currentSection = null;
let statusChart = null;

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupModals();
  setupForms();
  setupExport();
  renderDashboardChart();
  
  const lastSec = sessionStorage.getItem('last_sec');
  if (lastSec) openSection(lastSec, false);
});

// NAVEGAÇÃO
function openSection(sec, saveSession = true) {
  currentSection = sec;
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('app-header').style.display = 'block';
  document.querySelectorAll('.sec-view').forEach(el => el.style.display = 'none');
  document.getElementById(`sec-${sec}`).style.display = 'block';
  
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.sec === sec));
  if (saveSession) sessionStorage.setItem('last_sec', sec);
  
  renderSection(sec);
  checkAlerts();
}

document.getElementById('btn-home').addEventListener('click', () => {
  document.getElementById('app-header').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  currentSection = null;
  sessionStorage.removeItem('last_sec');
  renderDashboardChart();
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => openSection(tab.dataset.sec));
});

function setupNavigation() {} 

// RENDERIZAÇÃO
function renderSection(sec) {
  const tbodyId = sec === 'equipamentos' ? 'tbody-eq' : sec === 'ferramentas' ? 'tbody-tool' : 'tbody-lift';
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = '';
  const data = db[sec];

  // Calcula colspan correto para cada seção
  let colCount = sec === 'eq' ? 11 : sec === 'tool' ? 7 : 15;
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center; padding:2rem; color:#64748b">Nenhum registro cadastrado.</td></tr>`;
    return;
  }

  // Ordenação por data de vencimento (ignora vazios)
  if (sec !== 'ferramentas') {
    const dateField = sec === 'equipamentos' ? 'eq_date_prox' : 'lift_date_prox';
    data.sort((a, b) => {
      const da = new Date(a[dateField] || '2099-01-01');
      const db_ = new Date(b[dateField] || '2099-01-01');
      return da - db_;
    });
  }

  data.forEach(item => {
    let tr = document.createElement('tr');
    
    const addTitleToCells = (row) => {
      row.querySelectorAll('td').forEach(td => {
        if (td.textContent.trim() !== '-' && td.textContent.trim() !== '') td.title = td.textContent.trim();
      });
    };

    if (sec === 'equipamentos') {
      const status = getStatus(item.eq_date_prox);
      const linkBtn = item.eq_link ? `<button class="btn-sm btn-copy" onclick="copyPath('${item.eq_link.replace(/\\/g, '\\\\')}')">📋</button>` : '-';
      tr.innerHTML = `
        <td class="sticky-col">${item.eq_desc}</td><td>${item.eq_fab||'-'}</td><td>${item.eq_sn||'-'}</td>
        <td>${item.eq_framo||'-'}</td><td>${item.eq_obs||'-'}</td>
        <td class="cert">${item.eq_cert_num||'-'}</td><td class="cert">${formatDate(item.eq_date_cal)}</td>
        <td class="cert">${formatDate(item.eq_date_prox)}</td>
        <td class="cert"><span class="status-badge ${status.class}">${status.label}</span></td>
        <td>${linkBtn}</td>
        <td class="actions"><button class="btn-sm btn-edit" onclick="editItem('eq','${item.id}')">✏️</button> <button class="btn-sm btn-del" onclick="deleteItem('eq','${item.id}')">🗑️</button></td>
      `;
      addTitleToCells(tr);
    } else if (sec === 'ferramentas') {
      const linkBtn = item.tool_path ? `<button class="btn-sm btn-copy" onclick="copyPath('${item.tool_path.replace(/\\/g, '\\\\')}')">📋</button>` : '-';
      tr.innerHTML = `
        <td class="sticky-col"><strong>${item.tool_code}</strong></td><td>${item.tool_name}</td><td>${item.tool_spec||'-'}</td>
        <td>${item.tool_nf||'-'}</td><td>${formatDate(item.tool_validity)}</td><td>${linkBtn}</td>
        <td class="actions"><button class="btn-sm btn-edit" onclick="editItem('tool','${item.id}')">✏️</button> <button class="btn-sm btn-del" onclick="deleteItem('tool','${item.id}')">🗑️</button></td>
      `;
      addTitleToCells(tr);
    } else if (sec === 'izamento') {
      const status = getStatus(item.lift_date_prox);
      const linkBtn = item.lift_link ? `<button class="btn-sm btn-copy" onclick="copyPath('${item.lift_link.replace(/\\/g, '\\\\')}')">📋</button>` : '-';
      tr.innerHTML = `
        <td class="sticky-col">${item.lift_desc}</td><td>${item.lift_cap||'-'}</td><td>${item.lift_dim||'-'}</td>
        <td>${item.lift_qty}</td><td>${item.lift_obs||'-'}</td>
        <td>${item.lift_rast||'-'}</td><td>${item.lift_sn||'-'}</td><td>${item.lift_framo||'-'}</td>
        <td>${item.lift_nf||'-'}</td><td class="cert">${item.lift_cert_num||'-'}</td>
        <td class="cert">${formatDate(item.lift_date_cert)}</td><td class="cert">${formatDate(item.lift_date_prox)}</td>
        <td class="cert"><span class="status-badge ${status.class}">${status.label}</span></td>
        <td>${linkBtn}</td>
        <td class="actions"><button class="btn-sm btn-edit" onclick="editItem('lift','${item.id}')">✏️</button> <button class="btn-sm btn-del" onclick="deleteItem('lift','${item.id}')">🗑️</button></td>
      `;
      addTitleToCells(tr);
    }
    tbody.appendChild(tr);
  });
}

// UTILITÁRIOS
function formatDate(dateStr) { return !dateStr ? '-' : new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR'); }

function getStatus(dateStr) {
  if (!dateStr) return { label: 'N/A', class: 'status-na' };
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + 'T00:00:00');
  const diff = Math.ceil((target - today) / (1000*60*60*24));
  if (diff < 0) return { label: '🔴 Vencido', class: 'status-expired' };
  if (diff <= 30) return { label: '⚠️ Venc. Próximo', class: 'status-warning' };
  return { label: '✅ Válido', class: 'status-valid' };
}

window.copyPath = (path) => {
  navigator.clipboard.writeText(path).then(() => alert("✅ Caminho copiado! Cole no Explorador de Arquivos.")).catch(() => prompt("Copie manualmente:", path));
};

function saveData(sec) {
  try {
    localStorage.setItem(`db_${sec}`, JSON.stringify(db[sec]));
    renderSection(sec);
    checkAlerts();
    renderDashboardChart(); // Atualiza o gráfico da home
  } catch (err) {
    alert('⚠️ Erro ao salvar: armazenamento local cheio ou bloqueado pelo navegador.');
    console.error('Erro localStorage:', err);
  }
}

function checkAlerts() {
  const container = document.getElementById('alert-container');
  container.innerHTML = '';
  if (!currentSection || currentSection === 'ferramentas') return;
  
  const dateField = currentSection === 'equipamentos' ? 'eq_date_prox' : 'lift_date_prox';
  const alerts = db[currentSection].filter(i => {
    const s = getStatus(i[dateField]);
    return s.class === 'status-expired' || s.class === 'status-warning';
  });

  alerts.forEach(i => {
    const s = getStatus(i[dateField]);
    const div = document.createElement('div');
    div.className = 'alert';
    div.textContent = `${s.label}: ${i.eq_desc || i.lift_desc} (Próx: ${formatDate(i[dateField])})`;
    container.appendChild(div);
  });
}

// DASHBOARD CHART
function renderDashboardChart() {
  const ctx = document.getElementById('statusChart');
  if (!ctx) return;
  if (statusChart) statusChart.destroy();

  let counts = { valid: 0, warning: 0, expired: 0 };
  
  db.equipamentos.forEach(i => { const s = getStatus(i.eq_date_prox); if(s.class !== 'status-na') counts[s.class]++; });
  db.ferramentas.forEach(i => { const s = getStatus(i.tool_validity); if(s.class !== 'status-na') counts[s.class]++; });
  db.izamento.forEach(i => { const s = getStatus(i.lift_date_prox); if(s.class !== 'status-na') counts[s.class]++; });

  statusChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['✅ Válido', '⚠️ Venc. Próximo', '🔴 Vencido'],
      datasets: [{
        data: [counts.valid, counts.warning, counts.expired],
        backgroundColor: ['#dcfce7', '#fef3c7', '#fee2e2'],
        borderColor: ['#16a34a', '#d97706', '#dc2626'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} itens` } }
      }
    }
  });
}

// CRUD
window.deleteItem = (sec, id) => {
  if (confirm('Excluir este item permanentemente?')) {
    db[sec] = db[sec].filter(i => i.id !== id);
    saveData(sec);
  }
};

window.editItem = (sec, id) => {
  const item = db[sec].find(i => i.id === id);
  if (!item) return;
  const modal = document.getElementById(`modal-${sec}`);
  modal.querySelector(`#title-${sec}`).textContent = sec === 'eq' ? 'Editar Equipamento' : sec === 'tool' ? 'Editar Ferramenta' : 'Editar Material';
  modal.style.display = 'flex';
  
  // Preenche campos explicitamente para evitar falhas
  Object.keys(item).forEach(key => {
    const input = document.getElementById(key);
    if (input && input.type !== 'hidden') input.value = item[key];
  });
};

// MODAIS & FORMULÁRIOS
function setupModals() {
  document.querySelectorAll('.close').forEach(btn => btn.addEventListener('click', () => btn.parentElement.parentElement.style.display = 'none'));
  window.addEventListener('click', e => { if (e.target.classList.contains('modal')) e.target.style.display = 'none'; });
  
  document.getElementById('btn-add-eq').addEventListener('click', () => openModal('eq'));
  document.getElementById('btn-add-tool').addEventListener('click', () => openModal('tool'));
  document.getElementById('btn-add-lift').addEventListener('click', () => openModal('lift'));
}

function openModal(sec) {
  const modal = document.getElementById(`modal-${sec}`);
  modal.style.display = 'flex';
  document.getElementById(`title-${sec}`).textContent = sec === 'eq' ? 'Novo Equipamento' : sec === 'tool' ? 'Nova Ferramenta' : 'Novo Material';
  modal.querySelector(`form`).reset();
  modal.querySelector(`input[type="hidden"]`).value = '';
}

function setupForms() {
  ['eq', 'tool', 'lift'].forEach(sec => {
    const form = document.getElementById(`form-${sec}`);
    form.addEventListener('submit', e => {
      e.preventDefault();
      
      const hiddenId = form.querySelector('input[type="hidden"]');
      const id = hiddenId.value || Date.now().toString();
      
      const newItem = { id };
      form.querySelectorAll('input:not([type="hidden"])').forEach(inp => {
        if (inp.id) newItem[inp.id] = inp.value.trim();
      });

      // Atualiza ou insere
      const existingIndex = db[sec].findIndex(i => i.id === id);
      if (existingIndex > -1) {
        db[sec][existingIndex] = { ...db[sec][existingIndex], ...newItem };
      } else {
        db[sec].push(newItem);
      }

      saveData(sec);
      modal.style.display = 'none';
      form.reset();
      hiddenId.value = '';
    });
  });
}

// EXPORTAÇÃO
function setupExport() {
  ['eq', 'tool', 'lift'].forEach(sec => {
    document.getElementById(`btn-export-${sec}`).addEventListener('click', () => exportToExcel(sec));
  });
}

function exportToExcel(sec) {
  if (typeof XLSX === 'undefined') return alert("Biblioteca não carregada.");
  const data = db[sec];
  if (!data.length) return alert("Nada para exportar.");

  let rows = [];
  if (sec === 'eq') {
    rows = data.map(i => ({
      "Descrição": i.eq_desc, "Fabricante": i.eq_fab, "Serial Number": i.eq_sn, "Id Framo": i.eq_framo,
      "Observações": i.eq_obs, "Nº Certificado": i.eq_cert_num, "Data Calibração": formatDate(i.eq_date_cal),
      "Próxima Calibração": formatDate(i.eq_date_prox), "Status": getStatus(i.eq_date_prox).label, "Link": i.eq_link
    }));
  } else if (sec === 'tool') {
    rows = data.map(i => ({
      "Código": i.tool_code, "Ferramenta": i.tool_name, "Especificação": i.tool_spec, "Ref. NF": i.tool_nf,
      "Validade": formatDate(i.tool_validity), "Caminho": i.tool_path
    }));
  } else {
    rows = data.map(i => {
      const s = getStatus(i.lift_date_prox);
      return {
        "Descrição": i.lift_desc, "Capacidade": i.lift_cap, "Dimensão": i.lift_dim, "Qtd": i.lift_qty,
        "Observações": i.lift_obs, "Rastreabilidade": i.lift_rast, "Serial Number": i.lift_sn, "Id Framo": i.lift_framo,
        "Nota Fiscal": i.lift_nf, "Nº Certificado": i.lift_cert_num, "Data Certificado": formatDate(i.lift_date_cert),
        "Próxima Certificação": formatDate(i.lift_date_prox), "Status": s.label, "Link": i.lift_link
      };
    });
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sec === 'eq' ? 'Equipamentos' : sec === 'tool' ? 'Ferramentas' : 'Içamento');
  const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  XLSX.writeFile(wb, `Relatorio_${sec === 'eq' ? 'Equipamentos' : sec === 'tool' ? 'Ferramentas' : 'Içamento'}_${date}.xlsx`);
}