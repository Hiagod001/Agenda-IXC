// Variáveis globais
let currentUser = null;
let agendamentos = [];
let config = {};
let charts = {};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Inicializar aplicação
async function initializeApp() {
    try {
        // Verificar autenticação
        await checkAuth();
        
        // Carregar configurações
        await loadConfig();
        
        // Configurar interface
        setupInterface();
        
        // Carregar dados iniciais
        await loadInitialData();
        
        // Ocultar loading screen
        hideLoadingScreen();
        
        // Mostrar dashboard por padrão
        showSection('dashboard');
        
    } catch (error) {
        console.error('Erro ao inicializar aplicação:', error);
        window.location.href = '/login.html';
    }
}

// Verificar autenticação
async function checkAuth() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) {
            throw new Error('Não autenticado');
        }
        currentUser = await response.json();
        document.getElementById('userName').textContent = currentUser.username;
    } catch (error) {
        throw error;
    }
}

// Carregar configurações
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        config = await response.json();
        
        // Preencher selects
        populateSelects();
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        showToast('Erro ao carregar configurações', 'error');
    }
}

// Preencher selects com dados de configuração
function populateSelects() {
    const selects = {
        'cidade': config.cidades,
        'editCidade': config.cidades,
        'filterCidade': config.cidades,
        'vagasCidade': config.cidades,
        'tecnico': config.tecnicos,
        'editTecnico': config.tecnicos,
        'filterTecnico': config.tecnicos
    };
    
    Object.entries(selects).forEach(([selectId, options]) => {
        const select = document.getElementById(selectId);
        if (select) {
            // Limpar opções existentes (exceto a primeira)
            while (select.children.length > 1) {
                select.removeChild(select.lastChild);
            }
            
            // Adicionar novas opções
            options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                select.appendChild(optionElement);
            });
        }
    });
}

// Configurar interface
function setupInterface() {
    // Event listeners
    setupEventListeners();
    
    // Configurar data mínima para inputs de data
    const today = new Date().toISOString().slice(0, 16);
    const dataInputs = document.querySelectorAll('input[type="datetime-local"]');
    dataInputs.forEach(input => {
        input.min = today;
    });
    
    // Configurar data padrão para consulta de vagas
    document.getElementById('vagasData').value = new Date().toISOString().slice(0, 10);
}

// Configurar event listeners
function setupEventListeners() {
    // Formulário de agendamento
    document.getElementById('agendamentoForm').addEventListener('submit', handleAgendamentoSubmit);
    
    // Formulário de edição
    document.getElementById('editForm').addEventListener('submit', handleEditSubmit);
    
    // Clique fora do modal para fechar
    document.getElementById('editModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeEditModal();
        }
    });
    
    // Clique fora do dropdown do usuário para fechar
    document.addEventListener('click', function(e) {
        const userMenu = document.querySelector('.user-menu');
        const userDropdown = document.getElementById('userDropdown');
        
        if (!userMenu.contains(e.target)) {
            userDropdown.classList.remove('show');
        }
    });
    
    // Redimensionamento da janela
    window.addEventListener('resize', handleResize);
}

// Carregar dados iniciais
async function loadInitialData() {
    await loadAgendamentos();
    updateDashboardStats();
    loadRecentAppointments();
}

// Ocultar loading screen
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
        loadingScreen.style.display = 'none';
    }, 500);
}

// Navegação entre seções
function showSection(sectionId) {
    // Ocultar todas as seções
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remover classe active de todos os nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Mostrar seção selecionada
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Adicionar classe active ao nav item correspondente
    const navLink = document.querySelector(`[onclick="showSection('${sectionId}')"]`);
    if (navLink) {
        navLink.closest('.nav-item').classList.add('active');
    }
    
    // Ações específicas por seção
    switch (sectionId) {
        case 'dashboard':
            updateDashboardStats();
            loadRecentAppointments();
            break;
        case 'agendamentos':
            loadAgendamentos();
            break;
        case 'relatorios':
            loadReports();
            break;
    }
    
    // Fechar sidebar em mobile
    if (window.innerWidth <= 1024) {
        document.getElementById('sidebar').classList.remove('show');
    }
}

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (window.innerWidth <= 1024) {
        sidebar.classList.toggle('show');
    } else {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    }
}

// Toggle user menu
function toggleUserMenu() {
    const userDropdown = document.getElementById('userDropdown');
    userDropdown.classList.toggle('show');
}

// Carregar agendamentos
async function loadAgendamentos() {
    try {
        const response = await fetch('/api/agendamentos');
        if (!response.ok) {
            throw new Error('Erro ao carregar agendamentos');
        }
        
        agendamentos = await response.json();
        displayAgendamentos(agendamentos);
        
    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
        showToast('Erro ao carregar agendamentos', 'error');
    }
}

// Exibir agendamentos na tabela
function displayAgendamentos(data) {
    const tbody = document.querySelector('#agendamentosTable tbody');
    tbody.innerHTML = '';
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--medium-gray);">Nenhum agendamento encontrado</td></tr>';
        return;
    }
    
    data.forEach(agendamento => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${agendamento.id}</td>
            <td>${agendamento.cliente}</td>
            <td>${agendamento.assunto}</td>
            <td>${agendamento.cidade}</td>
            <td>${formatDateTime(agendamento.data_hora)}</td>
            <td>${agendamento.tecnico || 'A definir'}</td>
            <td><span class="appointment-status status-${agendamento.status.toLowerCase().replace(' ', '-')}">${agendamento.status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit-btn" onclick="editAgendamento(${agendamento.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteAgendamento(${agendamento.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Filtrar agendamentos
function filterAgendamentos() {
    const statusFilter = document.getElementById('filterStatus').value;
    const cidadeFilter = document.getElementById('filterCidade').value;
    const tecnicoFilter = document.getElementById('filterTecnico').value;
    
    let filteredData = agendamentos;
    
    if (statusFilter) {
        filteredData = filteredData.filter(item => item.status === statusFilter);
    }
    
    if (cidadeFilter) {
        filteredData = filteredData.filter(item => item.cidade === cidadeFilter);
    }
    
    if (tecnicoFilter) {
        filteredData = filteredData.filter(item => item.tecnico === tecnicoFilter);
    }
    
    displayAgendamentos(filteredData);
}

// Limpar filtros
function clearFilters() {
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterCidade').value = '';
    document.getElementById('filterTecnico').value = '';
    displayAgendamentos(agendamentos);
}

// Buscar cliente
async function buscarCliente() {
    const clienteId = document.getElementById('clienteId').value.trim();
    
    if (!clienteId) {
        showToast('Digite o ID do cliente', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`/api/cliente/${clienteId}`);
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById('clienteNome').value = data.cliente;
            document.getElementById('cidade').value = data.cidade;
            showToast('Cliente encontrado!', 'success');
        } else {
            const error = await response.json();
            showToast(error.erro || 'Cliente não encontrado', 'error');
            document.getElementById('clienteNome').value = '';
        }
    } catch (error) {
        console.error('Erro ao buscar cliente:', error);
        showToast('Erro ao buscar cliente', 'error');
    }
}

// Manipular envio do formulário de agendamento
async function handleAgendamentoSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    // Validações
    if (!data.cliente) {
        showToast('Busque o cliente primeiro', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/agendamentos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showToast('Agendamento criado com sucesso!', 'success');
            limparFormulario();
            loadAgendamentos();
            updateDashboardStats();
        } else {
            const error = await response.json();
            showToast(error.error || 'Erro ao criar agendamento', 'error');
        }
    } catch (error) {
        console.error('Erro ao criar agendamento:', error);
        showToast('Erro ao criar agendamento', 'error');
    }
}

// Limpar formulário
function limparFormulario() {
    document.getElementById('agendamentoForm').reset();
    document.getElementById('clienteNome').value = '';
}

// Editar agendamento
function editAgendamento(id) {
    const agendamento = agendamentos.find(item => item.id === id);
    
    if (!agendamento) {
        showToast('Agendamento não encontrado', 'error');
        return;
    }
    
    // Preencher formulário de edição
    document.getElementById('editId').value = agendamento.id;
    document.getElementById('editCliente').value = agendamento.cliente;
    document.getElementById('editAssunto').value = agendamento.assunto;
    document.getElementById('editCidade').value = agendamento.cidade;
    document.getElementById('editDataHora').value = agendamento.data_hora;
    document.getElementById('editTecnico').value = agendamento.tecnico || '';
    document.getElementById('editStatus').value = agendamento.status;
    document.getElementById('editObservacao').value = agendamento.observacao || '';
    
    // Mostrar modal
    document.getElementById('editModal').classList.add('show');
}

// Manipular envio do formulário de edição
async function handleEditSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    const id = data.id;
    delete data.id;
    
    try {
        const response = await fetch(`/api/agendamentos/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showToast('Agendamento atualizado com sucesso!', 'success');
            closeEditModal();
            loadAgendamentos();
            updateDashboardStats();
        } else {
            const error = await response.json();
            showToast(error.error || 'Erro ao atualizar agendamento', 'error');
        }
    } catch (error) {
        console.error('Erro ao atualizar agendamento:', error);
        showToast('Erro ao atualizar agendamento', 'error');
    }
}

// Fechar modal de edição
function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
}

// Deletar agendamento
async function deleteAgendamento(id) {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/agendamentos/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Agendamento excluído com sucesso!', 'success');
            loadAgendamentos();
            updateDashboardStats();
        } else {
            const error = await response.json();
            showToast(error.error || 'Erro ao excluir agendamento', 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir agendamento:', error);
        showToast('Erro ao excluir agendamento', 'error');
    }
}

// Consultar vagas
async function consultarVagas() {
    const cidade = document.getElementById('vagasCidade').value;
    const data = document.getElementById('vagasData').value;
    
    if (!cidade || !data) {
        showToast('Selecione a cidade e a data', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`/api/vagas/${cidade}/${data}`);
        
        if (response.ok) {
            const vagasData = await response.json();
            displayVagas(vagasData);
        } else {
            const error = await response.json();
            showToast(error.error || 'Erro ao consultar vagas', 'error');
        }
    } catch (error) {
        console.error('Erro ao consultar vagas:', error);
        showToast('Erro ao consultar vagas', 'error');
    }
}

// Exibir resultado das vagas
function displayVagas(data) {
    const resultContainer = document.getElementById('vagasResult');
    const template = data.template;
    const ocupadas = data.ocupadas;
    
    let html = '<h3>Disponibilidade de Vagas</h3><div class="vagas-grid">';
    
    Object.entries(template).forEach(([periodo, assuntos]) => {
        html += `
            <div class="periodo-card">
                <h4>${periodo}</h4>
        `;
        
        Object.entries(assuntos).forEach(([assunto, total]) => {
            const ocupadasCount = ocupadas.filter(item => 
                item.assunto === assunto
            ).length;
            const disponiveis = total - ocupadasCount;
            
            html += `
                <div class="assunto-item">
                    <strong>${assunto}</strong>
                    <div class="vagas-info">
                        <span class="vagas-total">Total: ${total}</span>
                        <span class="vagas-ocupadas">Ocupadas: ${ocupadasCount}</span>
                        <span class="vagas-disponiveis">Disponíveis: ${disponiveis}</span>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
    });
    
    html += '</div>';
    
    resultContainer.innerHTML = html;
    resultContainer.style.display = 'block';
}

// Atualizar estatísticas do dashboard
function updateDashboardStats() {
    const total = agendamentos.length;
    const hoje = new Date().toISOString().slice(0, 10);
    const agendamentosHoje = agendamentos.filter(item => 
        item.data_hora.startsWith(hoje)
    ).length;
    const concluidos = agendamentos.filter(item => 
        item.status === 'Concluída'
    ).length;
    const pendentes = agendamentos.filter(item => 
        ['Aberta', 'Agendada', 'Em andamento'].includes(item.status)
    ).length;
    
    // Animar contadores
    animateCounter('totalAgendamentos', total);
    animateCounter('agendamentosHoje', agendamentosHoje);
    animateCounter('agendamentosConcluidos', concluidos);
    animateCounter('agendamentosPendentes', pendentes);
}

// Animar contador
function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const startValue = 0;
    const duration = 1000;
    const startTime = performance.now();
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentValue = Math.floor(startValue + (targetValue - startValue) * progress);
        
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }
    
    requestAnimationFrame(updateCounter);
}

// Carregar agendamentos recentes
function loadRecentAppointments() {
    const recent = agendamentos
        .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora))
        .slice(0, 5);
    
    const container = document.getElementById('recentAppointments');
    
    if (recent.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--medium-gray); padding: 2rem;">Nenhum agendamento encontrado</p>';
        return;
    }
    
    container.innerHTML = recent.map(agendamento => `
        <div class="appointment-item">
            <div class="appointment-info">
                <h4>${agendamento.cliente}</h4>
                <p>${agendamento.assunto} - ${agendamento.cidade}</p>
                <p><i class="fas fa-clock"></i> ${formatDateTime(agendamento.data_hora)}</p>
            </div>
            <span class="appointment-status status-${agendamento.status.toLowerCase().replace(' ', '-')}">
                ${agendamento.status}
            </span>
        </div>
    `).join('');
}

// Carregar relatórios
function loadReports() {
    loadStatusChart();
    loadCidadeChart();
    loadTecnicoChart();
    loadMesChart();
}

// Gráfico de status
function loadStatusChart() {
    const ctx = document.getElementById('statusChart').getContext('2d');
    
    const statusCount = {};
    config.statusPossiveis.forEach(status => {
        statusCount[status] = agendamentos.filter(item => item.status === status).length;
    });
    
    if (charts.statusChart) {
        charts.statusChart.destroy();
    }
    
    charts.statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCount),
            datasets: [{
                data: Object.values(statusCount),
                backgroundColor: [
                    '#FFC107',
                    '#28A745',
                    '#17A2B8',
                    '#6C757D',
                    '#DC3545'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Gráfico de cidades
function loadCidadeChart() {
    const ctx = document.getElementById('cidadeChart').getContext('2d');
    
    const cidadeCount = {};
    config.cidades.forEach(cidade => {
        cidadeCount[cidade] = agendamentos.filter(item => item.cidade === cidade).length;
    });
    
    if (charts.cidadeChart) {
        charts.cidadeChart.destroy();
    }
    
    charts.cidadeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(cidadeCount),
            datasets: [{
                label: 'Agendamentos',
                data: Object.values(cidadeCount),
                backgroundColor: '#E31E24'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Gráfico de técnicos
function loadTecnicoChart() {
    const ctx = document.getElementById('tecnicoChart').getContext('2d');
    
    const tecnicoCount = {};
    config.tecnicos.forEach(tecnico => {
        tecnicoCount[tecnico] = agendamentos.filter(item => item.tecnico === tecnico).length;
    });
    
    if (charts.tecnicoChart) {
        charts.tecnicoChart.destroy();
    }
    
    charts.tecnicoChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(tecnicoCount),
            datasets: [{
                data: Object.values(tecnicoCount),
                backgroundColor: [
                    '#E31E24',
                    '#F39C12',
                    '#28A745',
                    '#17A2B8'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Gráfico por mês
function loadMesChart() {
    const ctx = document.getElementById('mesChart').getContext('2d');
    
    const mesCount = {};
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    meses.forEach((mes, index) => {
        mesCount[mes] = agendamentos.filter(item => {
            const data = new Date(item.data_hora);
            return data.getMonth() === index;
        }).length;
    });
    
    if (charts.mesChart) {
        charts.mesChart.destroy();
    }
    
    charts.mesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(mesCount),
            datasets: [{
                label: 'Agendamentos',
                data: Object.values(mesCount),
                borderColor: '#E31E24',
                backgroundColor: 'rgba(227, 30, 36, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Mostrar toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        ${message}
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove após 5 segundos
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// Formatar data e hora
function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Manipular redimensionamento
function handleResize() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (window.innerWidth > 1024) {
        sidebar.classList.remove('show');
        if (sidebar.classList.contains('collapsed')) {
            mainContent.classList.add('expanded');
        } else {
            mainContent.classList.remove('expanded');
        }
    } else {
        sidebar.classList.remove('collapsed');
        mainContent.classList.remove('expanded');
    }
}

// Funções de perfil e configurações (placeholder)
function showProfile() {
    showToast('Funcionalidade em desenvolvimento', 'info');
}

function showSettings() {
    showToast('Funcionalidade em desenvolvimento', 'info');
}

// Adicionar efeitos visuais
document.addEventListener('DOMContentLoaded', function() {
    // Efeito de hover nos cards
    document.querySelectorAll('.stat-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Efeito de ripple nos botões
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
            `;
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
});

// Adicionar CSS para animação de ripple
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

