// Variáveis globais
let currentUser = null;
let config = {};
let agendamentosAguardando = [];
let cidadeAtual = ""; // Inicializa vazio para ser preenchido pela config
let dataAtual = new Date().toISOString().slice(0, 10);

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeAgenda();
});

// Inicializar agenda
async function initializeAgenda() {
    try {
        // Verificar autenticação
        await checkAuth();
        
        // Carregar configurações
        await loadConfig();
        
        // Configurar interface
        setupInterface();
        
        // Configurar drag and drop
        setupDragAndDrop();
        
        // Ocultar loading screen
        hideLoadingScreen();
        
    } catch (error) {
        console.error('Erro ao inicializar agenda:', error);
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
        document.getElementById('userNameAgenda').textContent = currentUser.username;
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
        
        // Definir cidade padrão após carregar config
        if (config.cidades && config.cidades.length > 0) {
            cidadeAtual = config.cidades[0]; // Define a primeira cidade como padrão
            document.getElementById('cidadeAgenda').value = cidadeAtual;
            document.getElementById('cidadeAtual').textContent = cidadeAtual;
            
            // Carregar dados iniciais após a configuração da cidade
            await loadInitialData();
        }
        
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        showToast('Erro ao carregar configurações', 'error');
    }
}

// Preencher selects
function populateSelects() {
    const cidadeSelect = document.getElementById('cidadeAgenda');
    const cidadeOsSelect = document.getElementById('cidadeOs');
    const assuntoSelect = document.getElementById('assuntoOs');
    
    // Limpar e preencher select de cidade da agenda
    cidadeSelect.innerHTML = '<option value="">Selecione a cidade</option>';
    config.cidades.forEach(cidade => {
        const option = document.createElement('option');
        option.value = cidade;
        option.textContent = cidade;
        cidadeSelect.appendChild(option);
    });
    
    // Limpar e preencher select de cidade da OS
    cidadeOsSelect.innerHTML = '<option value="">Selecione a cidade</option>';
    config.cidades.forEach(cidade => {
        const option = document.createElement('option');
        option.value = cidade;
        option.textContent = cidade;
        cidadeOsSelect.appendChild(option);
    });
    
    // Limpar e preencher select de assunto da OS
    assuntoSelect.innerHTML = '<option value="">Selecione o assunto</option>';
    config.assuntos.forEach(assunto => {
        const option = document.createElement('option');
        option.value = assunto;
        option.textContent = assunto;
        assuntoSelect.appendChild(option);
    });
    
    // Event listeners para mudança de cidade e data
    cidadeSelect.addEventListener('change', carregarAgenda);
    document.getElementById('dataAgenda').addEventListener('change', carregarAgenda);
}

// Configurar interface
function setupInterface() {
    // Configurar data padrão
    document.getElementById('dataAgenda').value = dataAtual;
    
    // Event listeners
    setupEventListeners();
}

// Configurar event listeners
function setupEventListeners() {
    // Formulário de nova OS
    document.getElementById('novaOsForm').addEventListener('submit', handleNovaOsSubmit);
    
    // Clique fora do dropdown do usuário para fechar
    document.addEventListener('click', function(e) {
        const userMenu = document.querySelector('.user-menu');
        const userDropdown = document.getElementById('userDropdown');
        
        if (userMenu && userDropdown && !userMenu.contains(e.target)) {
            userDropdown.classList.remove('show');
        }
    });
}

// Configurar drag and drop
function setupDragAndDrop() {
    // Aguardar um pouco para garantir que os elementos estejam carregados
    setTimeout(() => {
        // Configurar área de agendamentos aguardando como draggable
        const aguardandoContainer = document.getElementById('agendamentosAguardando');
        
        if (aguardandoContainer) {
            new Sortable(aguardandoContainer, {
                group: {
                    name: 'agendamentos',
                    pull: 'clone',
                    put: false
                },
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                onStart: function(evt) {
                    evt.item.classList.add('dragging');
                },
                onEnd: function(evt) {
                    evt.item.classList.remove('dragging');
                }
            });
        }
        
        // Configurar containers de vagas como droppable
        const vagasContainers = document.querySelectorAll('.vagas-container');
        
        vagasContainers.forEach(container => {
            new Sortable(container, {
                group: {
                    name: 'agendamentos',
                    pull: false,
                    put: true
                },
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                onAdd: function(evt) {
                    handleDropAgendamento(evt);
                },
                onUpdate: function(evt) {
                    // Permitir reordenação dentro da mesma vaga
                    console.log('Reordenação dentro da vaga');
                }
            });
            
            // Event listeners para drag over visual feedback
            container.addEventListener('dragover', function(e) {
                e.preventDefault();
                this.classList.add('drag-over');
            });
            
            container.addEventListener('dragleave', function(e) {
                this.classList.remove('drag-over');
            });
            
            container.addEventListener('drop', function(e) {
                this.classList.remove('drag-over');
            });
        });
    }, 1000);
}

// Carregar dados iniciais
async function loadInitialData() {
    await Promise.all([
        carregarAgendamentosAguardando(),
        carregarAgenda()
    ]);
}

// Ocultar loading screen
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
}

// Toggle user menu
function toggleUserMenu() {
    const userDropdown = document.getElementById('userDropdown');
    if (userDropdown) {
        userDropdown.classList.toggle('show');
    }
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
            document.getElementById('cidadeOs').value = data.cidade;
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

// Manipular envio do formulário de nova OS
async function handleNovaOsSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    // Validações
    if (!data.cliente) {
        showToast('Busque o cliente primeiro', 'warning');
        return;
    }
    
    if (!data.cidade) {
        showToast('Selecione a cidade', 'warning');
        return;
    }
    
    if (!data.assunto) {
        showToast('Selecione o assunto', 'warning');
        return;
    }
    
    // Definir data/hora temporária para agendamento não alocado
    data.data_hora = new Date().toISOString();
    data.status = 'Aberta'; // Status para agendamentos aguardando
    
    try {
        const response = await fetch('/api/agendamentos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showToast('OS adicionada à agenda!', 'success');
            limparFormularioOs();
            await carregarAgendamentosAguardando();
        } else {
            const error = await response.json();
            showToast(error.error || 'Erro ao criar OS', 'error');
        }
    } catch (error) {
        console.error('Erro ao criar OS:', error);
        showToast('Erro ao criar OS', 'error');
    }
}

// Limpar formulário de OS
function limparFormularioOs() {
    document.getElementById('novaOsForm').reset();
    document.getElementById('clienteNome').value = '';
}

// Carregar agendamentos aguardando
async function carregarAgendamentosAguardando() {
    try {
        const response = await fetch('/api/agendamentos/nao-alocados');
        if (!response.ok) {
            throw new Error('Erro ao carregar agendamentos');
        }
        
        agendamentosAguardando = await response.json();
        displayAgendamentosAguardando();
        
    } catch (error) {
        console.error('Erro ao carregar agendamentos aguardando:', error);
        showToast('Erro ao carregar agendamentos aguardando', 'error');
    }
}

// Exibir agendamentos aguardando
function displayAgendamentosAguardando() {
    const container = document.getElementById('agendamentosAguardando');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (agendamentosAguardando.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--medium-gray); padding: 1rem;">Nenhuma OS aguardando agendamento</p>';
        return;
    }
    
    agendamentosAguardando.forEach(agendamento => {
        const item = document.createElement('div');
        item.className = 'agendamento-item';
        item.dataset.id = agendamento.id;
        item.dataset.assunto = agendamento.assunto;
        item.dataset.cidade = agendamento.cidade;
        
        item.innerHTML = `
            <div class="agendamento-header">
                <span class="agendamento-id">#${agendamento.id}</span>
                <span class="agendamento-assunto">${agendamento.assunto}</span>
            </div>
            <div class="agendamento-cliente">${agendamento.cliente}</div>
            <div class="agendamento-cidade">${agendamento.cidade}</div>
            ${agendamento.observacoes ? `<div class="agendamento-obs">${agendamento.observacoes}</div>` : ''}
        `;
        
        container.appendChild(item);
    });
}

// Carregar agenda
async function carregarAgenda() {
    const cidade = document.getElementById('cidadeAgenda').value;
    const data = document.getElementById('dataAgenda').value;
    
    if (!cidade || !data) {
        return;
    }
    
    cidadeAtual = cidade;
    dataAtual = data;
    
    try {
        const response = await fetch(`/api/vagas-detalhadas/${cidade}/${data}`);
        
        if (response.ok) {
            const vagasData = await response.json();
            displayAgenda(vagasData);
            document.getElementById('cidadeAtual').textContent = cidade;
        } else {
            const error = await response.json();
            showToast(error.error || 'Erro ao carregar agenda', 'error');
        }
    } catch (error) {
        console.error('Erro ao carregar agenda:', error);
        showToast('Erro ao carregar agenda', 'error');
    }
}

// Exibir agenda
function displayAgenda(data) {
    const { template, agendamentos } = data;
    
    // Atualizar contadores e limpar containers
    Object.entries(template).forEach(([periodo, assuntos]) => {
        Object.entries(assuntos).forEach(([assunto, total]) => {
            const containerId = getContainerId(periodo, assunto);
            const countId = getCountId(periodo, assunto);
            
            // Atualizar contador e título com disponibilidade
            const countElement = document.getElementById(countId);
            const container = document.getElementById(containerId);
            
            if (countElement && container) {
                const ocupadas = agendamentos[periodo] && agendamentos[periodo][assunto] ? agendamentos[periodo][assunto].length : 0;
                const disponiveis = total - ocupadas;
                countElement.textContent = disponiveis;
                
                // Limpar e preencher container
                container.innerHTML = '';
                
                // Adicionar slots vazios
                for (let i = 0; i < disponiveis; i++) {
                    const slot = document.createElement('div');
                    slot.className = 'vaga-vazia';
                    slot.innerHTML = '<span>Arraste uma OS aqui</span>';
                    container.appendChild(slot);
                }
                
                // Adicionar agendamentos existentes
                if (agendamentos[periodo] && agendamentos[periodo][assunto]) {
                    agendamentos[periodo][assunto].forEach(agendamento => {
                        const vagaElement = createVagaElement(agendamento);
                        container.appendChild(vagaElement);
                    });
                }
            }
        });
    });
}

// Criar elemento de vaga ocupada
function createVagaElement(agendamento) {
    const vaga = document.createElement('div');
    vaga.className = 'vaga-ocupada';
    vaga.dataset.id = agendamento.id;
    
    vaga.innerHTML = `
        <div class="vaga-header">
            <span class="vaga-cliente">${agendamento.cliente}</span>
            <span class="vaga-hora">${agendamento.hora || '08:00'}</span>
        </div>
        <div class="vaga-tecnico">Téc: ${agendamento.tecnico || 'A definir'}</div>
        <button class="vaga-remove" onclick="removerAgendamento(${agendamento.id})" title="Remover agendamento">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    return vaga;
}

// Manipular drop de agendamento
async function handleDropAgendamento(evt) {
    const item = evt.item;
    const container = evt.to;
    
    const agendamentoId = item.dataset.id;
    const periodo = container.dataset.periodo;
    const vagaAssunto = container.dataset.assunto;
    
    // Verificar se o assunto da OS corresponde à vaga
    const agendamentoAssunto = item.dataset.assunto;
    if (agendamentoAssunto !== vagaAssunto) {
        showToast(`Esta OS é de "${agendamentoAssunto}" e não pode ser alocada em vaga de "${vagaAssunto}"`, 'error');
        item.remove(); // Remove o item clonado
        return;
    }
    
    // Verificar se a cidade corresponde
    const agendamentoCidade = item.dataset.cidade;
    if (agendamentoCidade !== cidadeAtual) {
        showToast(`Esta OS é de "${agendamentoCidade}" e não pode ser alocada em "${cidadeAtual}"`, 'error');
        item.remove(); // Remove o item clonado
        return;
    }
    
    // Calcular data/hora baseada no período
    const dataHora = calcularDataHora(dataAtual, periodo);
    
    try {
        const response = await fetch(`/api/agendamentos/${agendamentoId}/alocar`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data_hora: dataHora,
                periodo: periodo,
                vaga_assunto: vagaAssunto
            })
        });
        
        if (response.ok) {
            showToast('Agendamento alocado com sucesso!', 'success');
            
            // Remover item da lista de aguardando
            item.remove();
            
            // Recarregar dados
            await Promise.all([
                carregarAgendamentosAguardando(),
                carregarAgenda()
            ]);
        } else {
            const error = await response.json();
            showToast(error.error || 'Erro ao alocar agendamento', 'error');
            item.remove(); // Remove o item clonado
        }
    } catch (error) {
        console.error('Erro ao alocar agendamento:', error);
        showToast('Erro ao alocar agendamento', 'error');
        item.remove(); // Remove o item clonado
    }
}

// Calcular data/hora baseada no período
function calcularDataHora(data, periodo) {
    const dataObj = new Date(data + 'T00:00:00');
    
    if (periodo === 'MANHÃ') {
        dataObj.setHours(8, 0, 0, 0); // 08:00
    } else {
        dataObj.setHours(14, 0, 0, 0); // 14:00
    }
    
    return dataObj.toISOString().slice(0, 16);
}

// Remover agendamento
async function removerAgendamento(id) {
    if (!confirm('Tem certeza que deseja remover este agendamento da agenda?')) {
        return;
    }
    
    try {
        // Atualizar status para 'Aberta' (volta para aguardando)
        const response = await fetch(`/api/agendamentos/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'Aberta',
                data_hora: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            showToast('Agendamento removido da agenda', 'success');
            
            // Recarregar dados
            await Promise.all([
                carregarAgendamentosAguardando(),
                carregarAgenda()
            ]);
        } else {
            const error = await response.json();
            showToast(error.error || 'Erro ao remover agendamento', 'error');
        }
    } catch (error) {
        console.error('Erro ao remover agendamento:', error);
        showToast('Erro ao remover agendamento', 'error');
    }
}

// Utilitários para IDs
function getContainerId(periodo, assunto) {
    const assuntoMap = {
        'SEM CONEXÃO': 'semConexao',
        'CONEXÃO LENTA': 'conexaoLenta',
        'AGENDAMENTO': 'agendamento'
    };
    
    const periodoSuffix = periodo === 'MANHÃ' ? 'Manha' : 'Tarde';
    return assuntoMap[assunto] + periodoSuffix;
}

function getCountId(periodo, assunto) {
    const assuntoMap = {
        'SEM CONEXÃO': 'semConexao',
        'CONEXÃO LENTA': 'conexaoLenta',
        'AGENDAMENTO': 'agendamento'
    };
    
    const periodoSuffix = periodo === 'MANHÃ' ? 'Manha' : 'Tarde';
    return assuntoMap[assunto] + periodoSuffix + 'Count';
}

// Sistema de Toast
function showToast(message, type = 'info') {
    let toastContainer = document.getElementById('toastContainer');
    
    // Criar container se não existir
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
        `;
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196F3'};
        color: white;
        padding: 12px 20px;
        margin-bottom: 10px;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    toast.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; margin-left: 10px;">×</button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Animação de entrada
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove após 5 segundos
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// Função para sair
function logout() {
    fetch('/api/logout', { method: 'POST' })
        .then(() => {
            window.location.href = '/login.html';
        })
        .catch(error => {
            console.error('Erro ao fazer logout:', error);
            window.location.href = '/login.html';
        });
}

