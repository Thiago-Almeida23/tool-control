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
  const tbody = document.getElementById(sec === 'equipamentos' ? 'tbody-eq' : sec === 'ferramentas' ? 'tbody-tool' : 'tbody-lift');
  tbody.innerHTML = '';
  const data = db[sec];

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${sec === 'izamento' ? 15 : 11}" style="text-align:center; padding:2rem; color:#64748b">Nenhum registro cadastrado.</td></tr>`;
    return;
  }

  // Ordenação por data de vencimento
  const sortFn = (a,b) => {
    const da = sec === 'equipamentos' ? a.eq_date_prox : a.lift_date_prox;
    const db_ = sec === 'equipamentos' ? b.eq_date_prox : b.lift_date_prox;
    return new Date(da || '2099-01-01') - new Date(db_ || '2099-01-01');
  };
  if (sec !== 'ferramentas') data.sort(sortFn);

  data.forEach(item => {
    let tr = document.createElement('tr');
    
    // Helper para adicionar title em todas as células (evita compressão visual)
    const addTitleToCells = (row) => {
      row.querySelectorAll('td').forEach(td => {
        if (td.textContent.trim() !== '-') td.title = td.textContent.trim();
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

function saveDB(sec) {
  localStorage.setItem(`db_${sec}`, JSON.stringify(db[sec]));
  renderSection(sec);
  if (sec === 'izamento') checkAlerts();
}

function checkAlerts() {
  const container = document.getElementById('alert-container');
  container.innerHTML = '';
  if (currentSection !== 'izamento' && currentSection !== 'equipamentos') return;
  
  const dateField = currentSection === 'equipamentos' ? 'eq_date_prox' : 'lift_date_prox';
  const alerts = db[currentSection].filter(i => {
    const s = getStatus(i[dateField]);
    return s.class !== 'status-valid' && s.class !== 'status-na';
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
  if (!ctx || statusChart) { if(statusChart) statusChart.destroy(); return; }

  let counts = { valid: 0, warning: 0, expired: 0 };
  
  // Agrega todos os itens com data
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
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} itens` } }
      }
    }
  });
}

// CRUD
window.deleteItem = (sec, id) => {
  if (confirm('Excluir este item?')) {
    db[sec] = db[sec].filter(i => i.id !== id);
    saveDB(sec);
  }
};

window.editItem = (sec, id) => {
  const item = db[sec].find(i => i.id === id);
  if (!item) return;
  const modal = document.getElementById(`modal-${sec}`);
  modal.querySelector('#title-' + sec).textContent = sec === 'eq' ? 'Editar Equipamento' : sec === 'tool' ? 'Editar Ferramenta' : 'Editar Material';
  modal.style.display = 'flex';
  Object.keys(item).forEach(key => { const inp = document.getElementById(key); if(inp) inp.value = item[key]; });
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
  document.getElementById(`modal-${sec}`).style.display = 'flex';
  document.getElementById(`title-${sec}`).textContent = sec === 'eq' ? 'Novo Equipamento' : sec === 'tool' ? 'Nova Ferramenta' : 'Novo Material';
  document.getElementById(`form-${sec}`).reset();
  document.getElementById(`${sec === 'eq' ? 'eq' : sec === 'tool' ? 'tool' : 'lift'}-id`).value = '';
}

function setupForms() {
  ['eq', 'tool', 'lift'].forEach(sec => {
    document.getElementById(`form-${sec}`).addEventListener('submit', e => {
      e.preventDefault();
      const id = document.getElementById(`${sec === 'eq' ? 'eq' : sec === 'tool' ? 'tool' : 'lift'}-id`).value || Date.now().toString();
      const formData = {};
      e.target.querySelectorAll('input').forEach(inp => {
        if (inp.id !== `${sec === 'eq' ? 'eq' : sec === 'tool' ? 'tool' : 'lift'}-id`) formData[inp.id] = inp.value.trim();
      });
      const item = { id, ...formData };
      const existing = db[sec].find(i => i.id === id);
      if (existing) Object.assign(existing, item); else db[sec].push(item);
      saveDB(sec);
      document.getElementById(`modal-${sec}`).style.display = 'none';
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