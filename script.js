let tools = JSON.parse(localStorage.getItem('tools_db')) || [];

document.addEventListener('DOMContentLoaded', () => {
  renderTable();
  checkAlerts();
  setupModal();
  setupForm();
  setupExport(); // Inicializa o botão de exportar
});

function saveData() {
  try {
    localStorage.setItem('tools_db', JSON.stringify(tools));
    renderTable();
    checkAlerts();
  } catch (e) {
    alert("⚠️ Erro ao salvar. Limpe o cache ou reduza a quantidade de registros.");
  }
}

// Calcula dias restantes com precisão
function getDaysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + 'T00:00:00');
  const diffMs = target - today;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function renderTable() {
  const tbody = document.getElementById('tools-body');
  tbody.innerHTML = '';
  if (tools.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:#666">Nenhuma ferramenta cadastrada.</td></tr>';
    return;
  }

  // Ordenar: vencendo primeiro
  tools.sort((a, b) => getDaysUntil(a.validity) - getDaysUntil(b.validity));

  tools.forEach(tool => {
    const days = getDaysUntil(tool.validity);
    let rowClass = '';
    let dateClass = 'date-valid';
    let dateDisplay = new Date(tool.validity + 'T00:00:00').toLocaleDateString('pt-BR');
    let nameSuffix = '';

    if (days <= 0) {
      rowClass = 'row-expired';
      dateClass = 'date-expired';
      nameSuffix = ' (VENCIDO)';
    } else if (days <= 30) {
      rowClass = 'row-warning';
      dateClass = 'date-warn';
      nameSuffix = ` (${days} dias)`;
    }

    const tr = document.createElement('tr');
    tr.className = rowClass;
    tr.innerHTML = `
      <td><strong>${tool.code}</strong></td>
      <td class="${days <= 30 ? 'name-warn' : ''}">${tool.name}${nameSuffix}</td>
      <td>${tool.spec || '-'}</td>
      <td>${tool.nf || '-'}</td>
      <td class="${dateClass}">${dateDisplay}</td>
      <td>
        ${tool.path 
          ? `<button class="btn-sm btn-copy" onclick="copyPath('${tool.path.replace(/\\/g, '\\\\')}')">📋 Copiar Caminho</button>` 
          : '<span style="color:#999">Não informado</span>'}
      </td>
      <td class="actions">
        <button class="btn-sm btn-edit" onclick="editTool('${tool.id}')">✏️</button>
        <button class="btn-sm btn-del" onclick="deleteTool('${tool.id}')">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Função para copiar o caminho da rede
window.copyPath = (path) => {
  navigator.clipboard.writeText(path).then(() => {
    alert("✅ Caminho copiado! Abra o Explorador de Arquivos (Win+E) e cole na barra de endereço.");
  }).catch(() => prompt("Copie manualmente:", path));
};

function checkAlerts() {
  const container = document.getElementById('alert-container');
  container.innerHTML = '';
  const alerts = tools.filter(t => getDaysUntil(t.validity) <= 30);
  
  if (alerts.length > 0) {
    alerts.forEach(tool => {
      const days = getDaysUntil(tool.validity);
      const msg = days <= 0 
        ? `🚨 O certificado da ferramenta <strong>${tool.name}</strong> (${tool.code}) está VENCIDO!` 
        : `⚠️ O certificado da ferramenta <strong>${tool.name}</strong> (${tool.code}) vence em ${days} dias!`;
      
      const div = document.createElement('div');
      div.className = 'alert';
      div.innerHTML = msg;
      container.appendChild(div);
    });
  }
}

window.deleteTool = (id) => {
  if (confirm('Deseja excluir esta ferramenta permanentemente?')) {
    tools = tools.filter(t => t.id !== id);
    saveData();
  }
};

window.editTool = (id) => {
  const tool = tools.find(t => t.id === id);
  if (!tool) return;

  document.getElementById('tool-id').value = tool.id;
  document.getElementById('tool-code').value = tool.code;
  document.getElementById('tool-name').value = tool.name;
  document.getElementById('tool-spec').value = tool.spec || '';
  document.getElementById('tool-nf').value = tool.nf || '';
  document.getElementById('tool-validity').value = tool.validity;
  document.getElementById('tool-path').value = tool.path || '';
  
  document.getElementById('modal-title').textContent = 'Editar Ferramenta';
  document.getElementById('tool-modal').style.display = 'flex';
};

function setupModal() {
  document.getElementById('btn-add').addEventListener('click', () => {
    document.getElementById('tool-form').reset();
    document.getElementById('tool-id').value = '';
    document.getElementById('modal-title').textContent = 'Nova Ferramenta';
    document.getElementById('tool-modal').style.display = 'flex';
  });

  document.querySelector('.close').addEventListener('click', () => document.getElementById('tool-modal').style.display = 'none');
  window.addEventListener('click', e => { if (e.target.classList.contains('modal')) e.target.style.display = 'none'; });
}

function setupForm() {
  document.getElementById('tool-form').addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('tool-id').value || Date.now().toString();
    
    const newTool = {
      id,
      code: document.getElementById('tool-code').value.trim(),
      name: document.getElementById('tool-name').value.trim(),
      spec: document.getElementById('tool-spec').value.trim(),
      nf: document.getElementById('tool-nf').value.trim(),
      validity: document.getElementById('tool-validity').value,
      path: document.getElementById('tool-path').value.trim()
    };

    const exists = tools.find(t => t.id === id);
    if (exists) Object.assign(exists, newTool);
    else tools.push(newTool);

    saveData();
    document.getElementById('tool-modal').style.display = 'none';
  });
}

// --- EXPORTAÇÃO PARA EXCEL ---
function setupExport() {
  if (typeof XLSX === 'undefined') {
    console.warn("Biblioteca SheetJS não carregada.");
    return;
  }

  document.getElementById('btn-export').addEventListener('click', () => {
    // Prepara os dados formatados para o Excel
    const dataRows = tools.map(t => {
      const days = getDaysUntil(t.validity);
      let status = "✅ Em dia";
      if (days <= 0) status = "🚫 VENCIDO";
      else if (days <= 30) status = `⚠️ Vence em ${days} dias`;

      return {
        "Código": t.code,
        "Ferramenta": t.name,
        "Especificação": t.spec || '-',
        "Ref. NF": t.nf || '-',
        "Validade": new Date(t.validity + 'T00:00:00').toLocaleDateString('pt-BR'),
        "Status": status,
        "Caminho Certificado": t.path || '-'
      };
    });

    // Cria a planilha
    const ws = XLSX.utils.json_to_sheet(dataRows);
    
    // Ajusta largura das colunas
    ws['!cols'] = [
      { wch: 12 }, // Código
      { wch: 25 }, // Ferramenta
      { wch: 25 }, // Especificação
      { wch: 12 }, // NF
      { wch: 12 }, // Validade
      { wch: 18 }, // Status
      { wch: 40 }  // Caminho
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ferramentas");

    // Gera o arquivo
    const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    XLSX.writeFile(wb, `Relatorio_Ferramentas_${dateStr}.xlsx`);
  });
}