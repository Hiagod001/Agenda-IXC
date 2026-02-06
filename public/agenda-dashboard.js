const STATUS_LABELS = {
  'Em andamento': 'Agendado no IXC',
};

function getStatusLabel(status){
  return STATUS_LABELS[status] || status || '';
}

let currentUser = null;
let canAdjustVagas = false;

// Variáveis globais
// Evita erro "Identifier 'config' has already been declared" caso outro script da aplicação
// também declare `config` no escopo global (ex.: scripts.js no menu principal).
// Usamos `var` + `window.config` para ser idempotente.
var config = window.config || {};
window.config = config;
let agendamentosAguardando = [];
let cidadeAtual = ""; // Inicializa vazio para ser preenchido pela config
let dataAtual = new Date().toISOString().slice(0, 10);
// =======================
// PERSISTÊNCIA (vagas fechadas)
// =======================
// Antes, as vagas fechadas ficavam só em memória e se perdiam ao atualizar a página.
// Agora persistimos em localStorage (por cidade/data/período/assunto).
// vagas fechadas agora vêm do servidor (banco), não do localStorage
let vagasFechadas = {}; // cache opcional (por chave cidade_data_tipo_periodo_assunto)


// =======================
// TOAST (feedback visual)
// =======================
// O menu principal (public/scripts.js) já possui showToast, mas o dashboard não carrega aquele arquivo.
// Garantimos uma implementação aqui para evitar "showToast is not defined".
if (typeof window.showToast !== 'function') {
    // =======================
    // Toast (fila + anti-spam)
    // =======================
    (function () {
        if (window.__toastManager) return;

        const manager = {
            queue: [],
            showing: false,
            lastMsg: "",
            lastAt: 0,
            maxLen: 180,
            push(message, type = "info") {
                const now = Date.now();
                const msg = String(message ?? "").replace(/\s+/g, " ").trim();

                // anti-spam: não repete a mesma msg em sequência
                if (msg && msg === this.lastMsg && (now - this.lastAt) < 1800) return;
                this.lastMsg = msg;
                this.lastAt = now;

                const clean = msg.replace(/[<>]/g, "");
                const safe = clean.length > this.maxLen ? (clean.slice(0, this.maxLen) + "…") : clean;
                if (clean.length > this.maxLen) console.warn("Toast truncado (mensagem completa):", clean);

                this.queue.push({ message: safe || "Ação inválida", type });
                this._drain();
            },
            _drain() {
                if (this.showing) return;
                const next = this.queue.shift();
                if (!next) return;
                this.showing = true;

                let container = document.getElementById("toastContainer");
                if (!container) {
                    container = document.createElement("div");
                    container.id = "toastContainer";
                    container.className = "toast-container";
                    document.body.appendChild(container);
                }

                const toast = document.createElement("div");
                toast.className = `toast toast--${next.type}`;
                toast.setAttribute("role", "status");
                toast.innerHTML = `
                    <div class="toast__icon"></div>
                    <div class="toast__msg"></div>
                    <button class="toast__close" aria-label="Fechar">×</button>
                `;
                toast.querySelector(".toast__msg").textContent = next.message;

                const closeBtn = toast.querySelector(".toast__close");
                const close = () => {
                    toast.classList.add("toast--hide");
                    setTimeout(() => {
                        toast.remove();
                        this.showing = false;
                        this._drain();
                    }, 220);
                };
                closeBtn.addEventListener("click", close);

                container.appendChild(toast);
                requestAnimationFrame(() => toast.classList.add("toast--show"));
                setTimeout(close, 3200);
            }
        };

        window.__toastManager = manager;
        window.showToast = (message, type = "info") => manager.push(message, type);
    })();
}

// Ajuste rápido de capacidade (+/-) no dashboard
async function ajustarCapacidadeVaga({ city, tipo_os, periodo, assunto, delta }) {
    const resp = await fetch('/api/vacancy-templates/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, tipo_os, periodo, assunto, delta })
    });
    if (!resp.ok) {
        let msg = 'Erro ao ajustar vagas';
        try { const j = await resp.json(); if (j && j.error) msg = j.error; } catch {}
        throw new Error(msg);
    }
    return await resp.json();
}

let tipoAgendaAtual = 'FIBRA'; // Fibra como padrão

// Estado da Consulta (modal)
let consultaState = {
    page: 1,
    pageSize: 25,
    totalPages: 1,
    total: 0,
    lastMeta: null,
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeAgenda();
});

// Inicializar agenda
async function initializeAgenda() {
    // O tema agora é carregado automaticamente pelo dark-mode-system.js
    try {
        await checkAuth();
        setupInterface();
        await loadConfig();
        setupDragAndDrop();
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
        
        window.currentUser = currentUser;
const perms = (currentUser && currentUser.permissions) ? currentUser.permissions : [];
        canAdjustVagas = perms.includes('vagas.adjust') || perms.includes('vagas.manage');
        document.getElementById('userName').textContent = currentUser.username;
        document.getElementById('userNameAgenda').textContent = currentUser.username;
    } catch (error) {
        throw error;
    }
}

// O sistema de modo escuro agora é gerenciado pelo dark-mode-system.js

// Carregar configurações
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        config = await response.json();
        window.config = config;
        
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
    // Form de criação de OS foi movido para a página "Novo Agendamento".
    // Esses selects podem não existir mais no dashboard.
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
    
    // Limpar e preencher selects do formulário de OS (se existirem)
    if (cidadeOsSelect) {
        cidadeOsSelect.innerHTML = '<option value="">Selecione a cidade</option>';
        (config.cidades || []).forEach(cidade => {
            const option = document.createElement('option');
            option.value = cidade;
            option.textContent = cidade;
            cidadeOsSelect.appendChild(option);
        });
    }
    
    if (assuntoSelect) {
        assuntoSelect.innerHTML = '<option value="">Selecione o assunto</option>';
        (config.assuntos || []).forEach(assunto => {
            const option = document.createElement('option');
            option.value = assunto;
            option.textContent = assunto;
            assuntoSelect.appendChild(option);
        });
    }
    
    // Event listeners para mudança de cidade e data
    cidadeSelect.addEventListener('change', carregarAgenda);
    document.getElementById('dataAgenda').addEventListener('change', carregarAgenda);

    // -----------------------
    // Modal de Consulta
    // -----------------------
    const consultaCidade = document.getElementById('consultaCidade');
    const consultaTecnico = document.getElementById('consultaTecnico');
    const consultaStatus = document.getElementById('consultaStatus');
    const consultaTipoOs = document.getElementById('consultaTipoOs');

    if (consultaCidade) {
        consultaCidade.innerHTML = '<option value="">Todas</option>';
        (config.cidades || []).forEach(c => {
            const o = document.createElement('option');
            o.value = c;
            o.textContent = c;
            consultaCidade.appendChild(o);
        });
    }

    if (consultaTecnico) {
        consultaTecnico.innerHTML = '<option value="">Todos</option>';
        (config.tecnicos || []).forEach(t => {
            const o = document.createElement('option');
            o.value = t;
            o.textContent = t;
            consultaTecnico.appendChild(o);
        });
    }

    if (consultaStatus) {
        consultaStatus.innerHTML = '<option value="">Todos</option>';
        (config.statusPossiveis || ['Aberta','Agendada','Em andamento','Concluída','Cancelada']).forEach(s => {
            const o = document.createElement('option');
            o.value = s;
            o.textContent = getStatusLabel(s);
            consultaStatus.appendChild(o);
        });
    }

    if (consultaTipoOs) {
        consultaTipoOs.innerHTML = '<option value="">Todos</option>';
        (config.tiposOS || ['FIBRA','RADIO','Indefinido']).forEach(tp => {
            const o = document.createElement('option');
            o.value = tp;
            o.textContent = tp;
            consultaTipoOs.appendChild(o);
        });
    }
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
    const novaOsForm = document.getElementById('novaOsForm');
    if (novaOsForm) {
        novaOsForm.addEventListener('submit', handleNovaOsSubmit);
    }
    
    // Clique fora do dropdown do usuário para fechar
    document.addEventListener('click', function(e) {
        const userMenu = document.querySelector('.user-menu');
        const userDropdown = document.getElementById('userDropdown');
        
        if (userMenu && userDropdown && !userMenu.contains(e.target)) {
            userDropdown.classList.remove('show');
        }
    });
    
    // Toggle menu no dashboard
    const menuToggleBtn = document.getElementById('menuToggleBtn');
    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', toggleSidebar);
    }
    
    // O sistema de modo escuro agora é gerenciado pelo dark-mode-system.js

    // Event listener para o novo modal de edição do dashboard
    const dashboardEditForm = document.getElementById('dashboardEditForm');
    if (dashboardEditForm) {
        dashboardEditForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const id = document.getElementById('dashboardEditId').value;
            const formData = new FormData(event.target);
            const data = Object.fromEntries(formData.entries());
        
            try {
                const response = await fetch(`/api/agendamentos/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
        
                if (response.ok) {
                    showToast('Agendamento atualizado com sucesso!', 'success');
                    fecharModalDashboard();
                    await carregarAgenda();
                } else {
                    showToast('Erro ao atualizar agendamento.', 'error');
                }
            } catch (error) {
                showToast('Erro de conexão.', 'error');
            }
        });
    }

    // =======================
    // CONSULTA (FILTROS + PAGINAÇÃO)
    // =======================
    const btnAbrirConsulta = document.getElementById('btnAbrirConsulta');
    if (btnAbrirConsulta) {
        btnAbrirConsulta.addEventListener('click', () => abrirConsultaModal());
    }

    const btnFecharConsulta = document.getElementById('btnFecharConsulta');
    if (btnFecharConsulta) {
        btnFecharConsulta.addEventListener('click', fecharConsultaModal);
    }

    const consultaModal = document.getElementById('consultaModal');
    if (consultaModal) {
        consultaModal.addEventListener('click', (e) => {
            if (e.target === consultaModal) fecharConsultaModal();
        });
    }

    const btnBuscarConsulta = document.getElementById('btnBuscarConsulta');
    if (btnBuscarConsulta) {
        btnBuscarConsulta.addEventListener('click', (e) => {
            e.preventDefault();
            consultarAgendamentos(1);
        });
    }

    const btnLimparConsulta = document.getElementById('btnLimparConsulta');
    if (btnLimparConsulta) {
        btnLimparConsulta.addEventListener('click', limparConsulta);
    }

    const consultaPrev = document.getElementById('consultaPrev');
    const consultaNext = document.getElementById('consultaNext');
    if (consultaPrev) consultaPrev.addEventListener('click', () => consultarAgendamentos(consultaState.page - 1));
    if (consultaNext) consultaNext.addEventListener('click', () => consultarAgendamentos(consultaState.page + 1));

    const consultaCliente = document.getElementById('consultaCliente');
    if (consultaCliente) {
        // debounce para não bater na API a cada tecla
        let t = null;
        consultaCliente.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(() => consultarAgendamentos(1), 450);
        });
        consultaCliente.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                consultarAgendamentos(1);
            }
        });
    }

    const consultaPageSize = document.getElementById('consultaPageSize');
    if (consultaPageSize) {
        consultaPageSize.addEventListener('change', () => consultarAgendamentos(1));
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('agendaSidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
}

// Configurar drag and drop
// Configurar drag and drop (Versão Corrigida e Anti-Spam)
function setupDragAndDrop() {
    // Variável local para controlar o spam de alertas DURANTE o arrastar
    let lastAlertTime = 0;

    setTimeout(() => {
        const aguardandoContainer = document.getElementById('agendamentosAguardando');
        if (aguardandoContainer) {
            new Sortable(aguardandoContainer, {
                group: { name: 'agendamentos', pull: true, put: false },
                animation: 150,
                ghostClass: 'sortable-ghost',
                // Impede que cliques em botões dentro do card iniciem o drag
                filter: '.agendamento-delete-btn',
                preventOnFilter: false,
            });
        }

        const vagasContainers = document.querySelectorAll('.vagas-container');
        vagasContainers.forEach(container => {
            new Sortable(container, {
                group: {
                    name: 'agendamentos',
                    pull: false,
                    put: function (to, from, draggedEl) {
                        // Verificação de tempo para não spamar o processador
                        const now = Date.now();
                        const shouldAlert = (now - lastAlertTime > 2000); // Só alerta a cada 2 segundos

                        try {
                            // Validação 1: Tipo de OS
                            // OBS: Algumas OS antigas não têm tipo_os no banco; nesses casos
                            // tratamos como "Indefinido" e NÃO bloqueamos o drop.
                            const tipoItem = (draggedEl.dataset.tipo || 'Indefinido');
                            // Só valida quando o tipo vier preenchido e não for "Indefinido"
                            if (tipoItem && tipoItem !== 'Indefinido' && tipoItem !== tipoAgendaAtual) {
                                if (shouldAlert) {
                                    showToast(`Agenda de ${tipoAgendaAtual} não aceita OS de ${tipoItem}.`, 'error');
                                    lastAlertTime = now;
                                }
                                return false;
                            }
                    
                            // Validação 2: Cidade
                            const itemCidade = draggedEl.dataset.cidade;
                            // Normaliza as strings para evitar erro por maiúscula/minúscula
                            if (itemCidade && itemCidade.toUpperCase() !== cidadeAtual.toUpperCase()) {
                                if (shouldAlert) {
                                    showToast(`Esta OS é para ${itemCidade}, mas a agenda atual é para ${cidadeAtual}.`, 'error');
                                    lastAlertTime = now;
                                }
                                return false;
                            }
                    
                            // Validação 3: Assunto
                            const tipoAssunto = draggedEl.dataset.assunto;
                            const tipoVaga = to.el.dataset.assunto;
                            if (tipoAssunto !== tipoVaga) {
                                // Não precisa de alerta aqui, visualmente o usuário já entende que não encaixa
                                return false;
                            }
                            
                            // Validação 4: Limite de Vagas
                            const limiteTotal = parseInt(to.el.dataset.limite) || 0;
                            const cardsOcupados = to.el.querySelectorAll('.vaga-ocupada').length;
                            const vagasFechadas = to.el.querySelectorAll('.vaga-fechada').length;
                            const vagasDisponiveis = limiteTotal - vagasFechadas;

                            if (cardsOcupados >= vagasDisponiveis) {
                                if (shouldAlert) {
                                    showToast(`Não há vagas disponíveis para '${tipoVaga}'.`, 'warning');
                                    lastAlertTime = now;
                                }
                                return false;
                            }

                            return true; // Tudo certo, permite soltar
                
                        } catch (error) {
                            console.error("Erro na validação 'put':", error);
                            return false;
                        }
                    }
                },
                filter: '.vaga-vazia, .vaga-fechada', 
                animation: 150,
                ghostClass: 'sortable-ghost',
                onAdd: function(evt) {
                    handleDropAgendamento(evt);
                }
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
        const response = await fetch(`/api/ixc/cliente/${clienteId}`);
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById("clienteNome").value = data.razao;
            showToast("Cliente encontrado!", "success");
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
    
    data.status = 'Aberta';
    
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
        const response = await fetch('/api/agendamentos?status=Aberta'); 
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
    
    const canDelete = Array.isArray(window.currentUser?.permissions)
        && window.currentUser.permissions.includes('agenda.delete');

    agendamentosAguardando.forEach(agendamento => {
        const item = document.createElement('div');
        item.className = 'agendamento-item';
        item.dataset.id = agendamento.id;
        item.dataset.assunto = agendamento.assunto;
        item.dataset.cidade = agendamento.cidade;
        // OS antigas podem não ter tipo_os no banco
        item.dataset.tipo = agendamento.tipo_os || 'Indefinido';

        item.innerHTML = `
            <div class="agendamento-header">
                <span class="agendamento-id">#${agendamento.id}</span>
                <div class="agendamento-header-right">
                    <span class="agendamento-tipo">${agendamento.tipo_os || 'Indefinido'}</span>
                    <span class="agendamento-assunto">${agendamento.assunto}</span>
                    ${canDelete ? `
                        <button class="agendamento-delete-btn" title="Excluir agendamento">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="agendamento-cliente">${agendamento.cliente}</div>
            <div class="agendamento-cidade">${agendamento.cidade}</div>
            ${agendamento.observacoes ? `<div class="agendamento-obs"><strong>Obs:</strong> ${agendamento.observacoes}</div>` : ''}
        `;

        if (canDelete) {
            const btn = item.querySelector('.agendamento-delete-btn');
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    excluirAgendamento(agendamento.id);
                });
            }
        }
        
        container.appendChild(item);
    });
}

// =======================
// CONSULTA (FILTROS + PAGINAÇÃO + ORDENAÇÃO)
// =======================
function abrirConsultaModal() {
    const modal = document.getElementById('consultaModal');
    if (!modal) return;
    modal.style.display = 'flex';

    // Defaults amigáveis: último 7 dias
    const ini = document.getElementById('consultaDataIni');
    const fim = document.getElementById('consultaDataFim');
    if (ini && !ini.value) {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        ini.value = d.toISOString().slice(0, 10);
    }
    if (fim && !fim.value) {
        fim.value = new Date().toISOString().slice(0, 10);
    }

    const ps = document.getElementById('consultaPageSize');
    if (ps) {
        consultaState.pageSize = parseInt(ps.value || '25', 10) || 25;
    }

    consultarAgendamentos(1);
}

function fecharConsultaModal() {
    const modal = document.getElementById('consultaModal');
    if (!modal) return;
    modal.style.display = 'none';
}

function limparConsulta() {
    const ids = [
        'consultaCliente',
        'consultaCidade',
        'consultaTecnico',
        'consultaStatus',
        'consultaPeriodo',
        'consultaTipoOs',
        'consultaDataIni',
        'consultaDataFim',
        'consultaOrdenacao',
        'consultaPageSize'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.tagName === 'INPUT') el.value = '';
        if (el.tagName === 'SELECT') el.selectedIndex = 0;
    });
    consultarAgendamentos(1);
}

function getConsultaParams() {
    const get = (id) => (document.getElementById(id)?.value || '').trim();

    const ordenacao = get('consultaOrdenacao');
    let sort_by = 'data_hora', sort_dir = 'desc';
    if (ordenacao) {
        const [by, dir] = ordenacao.split(':');
        if (by) sort_by = by;
        if (dir) sort_dir = dir;
    }

    return {
        cliente: get('consultaCliente'),
        cidade: get('consultaCidade'),
        tecnico: get('consultaTecnico'),
        status: get('consultaStatus'),
        periodo: get('consultaPeriodo'),
        tipo_os: get('consultaTipoOs'),
        data_inicio: get('consultaDataIni'),
        data_fim: get('consultaDataFim'),
        sort_by,
        sort_dir,
    };
}

async function consultarAgendamentos(targetPage = 1) {
    const tbody = document.getElementById('consultaTbody');
    const metaEl = document.getElementById('consultaMeta');
    const pageInfo = document.getElementById('consultaPageInfo');
    const btnPrev = document.getElementById('consultaPrev');
    const btnNext = document.getElementById('consultaNext');

    if (!tbody) return;

    const ps = document.getElementById('consultaPageSize');
    if (ps) {
        consultaState.pageSize = parseInt(ps.value || String(consultaState.pageSize), 10) || consultaState.pageSize;
    }

    const pageNum = Math.max(parseInt(targetPage || 1, 10) || 1, 1);

    const params = getConsultaParams();
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v) qs.set(k, v);
    });
    qs.set('page', String(pageNum));
    qs.set('page_size', String(consultaState.pageSize));

    // loading
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 12px;">Carregando...</td></tr>`;
    if (metaEl) metaEl.textContent = '';

    try {
        const resp = await fetch(`/api/agendamentos/search?${qs.toString()}`);
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || 'Erro ao consultar');
        }
        const data = await resp.json();

        const rows = data.rows || [];
        const meta = data.meta || {};

        consultaState.page = meta.page || pageNum;
        consultaState.totalPages = meta.total_pages || 1;
        consultaState.total = meta.total || 0;
        consultaState.lastMeta = meta;

        renderConsultaRows(rows);

        if (metaEl) {
            metaEl.textContent = `Total: ${consultaState.total} • Página ${consultaState.page} de ${consultaState.totalPages}`;
        }
        if (pageInfo) {
            pageInfo.textContent = `${consultaState.page}/${consultaState.totalPages}`;
        }
        if (btnPrev) btnPrev.disabled = consultaState.page <= 1;
        if (btnNext) btnNext.disabled = consultaState.page >= consultaState.totalPages;

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 12px;">${e.message}</td></tr>`;
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;
    }
}

function formatDateTimeBR(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function renderConsultaRows(rows) {
    const tbody = document.getElementById('consultaTbody');
    if (!tbody) return;

    if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 12px;">Nenhum resultado</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${r.id}</td>
            <td>${(r.cliente || '').toString()}</td>
            <td>${(r.cidade || '').toString()}</td>
            <td>${(r.assunto || '').toString()}</td>
            <td>${getStatusLabel((r.status || '').toString())}</td>
            <td>${(r.tecnico || '').toString()}</td>
            <td>${formatDateTimeBR(r.data_hora || r.created_at)}</td>
            <td>${(r.tipo_os || '').toString()}</td>
`;
        tbody.appendChild(tr);
    });
}

// Carregar agenda
async function carregarAgenda() {
    const cidade = document.getElementById('cidadeAgenda').value;
    const data = document.getElementById('dataAgenda').value;
    
    if (!cidade || !data) return;
    
    cidadeAtual = cidade;
    dataAtual = data;
    
    try {
        // A URL agora inclui o tipo de agenda
        const response = await fetch(`/api/vagas-detalhadas/${cidade}/${tipoAgendaAtual}/${data}`);
        
        if (response.ok) {
            const vagasData = await response.json();
            // monta cache em formato compatível com o layout atual
vagasFechadas = {};
try {
    const vf = vagasData.vagasFechadas || {};
    ['MANHÃ','TARDE'].forEach(periodo => {
        const byAssunto = vf[periodo] || {};
        Object.keys(byAssunto).forEach(assunto => {
            const key = `${cidadeAtual}_${dataAtual}_${tipoAgendaAtual}_${periodo}_${assunto}`;
            vagasFechadas[key] = (byAssunto[assunto] || []).map(n => Number(n));
        });
    });
} catch (_) {}
displayAgenda(vagasData);
            document.getElementById('cidadeAtual').textContent = `${cidade} - ${tipoAgendaAtual}`;
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

    if (!template) {
        console.error("ERRO GRAVE: O 'template' de vagas não foi encontrado!");
        return;
    }

    // Garante que a UI tenha containers para TODOS os assuntos retornados do banco
    // (assim, assuntos/vagas criados no sistema aparecem automaticamente no dashboard)
    ensureAssuntoContainers(template);

    Object.entries(template).forEach(([periodo, assuntos]) => {
        Object.entries(assuntos).forEach(([assunto, total]) => {
            const containerId = getContainerId(periodo, assunto);
            const container = document.getElementById(containerId);

            if (container) {
                container.dataset.limite = total;
                container.innerHTML = ''; // Limpa a vaga

                const titleCounter = container.previousElementSibling.querySelector('span');
                if (titleCounter) {
                    titleCounter.textContent = total;
                }

                // A chave antiga não incluía o tipo de agenda; a nova inclui (pra não conflitar FIBRA x RÁDIO)
                const vagaKeyNew = `${cidadeAtual}_${dataAtual}_${tipoAgendaAtual}_${periodo}_${assunto}`;
                const vagaKeyOld = `${cidadeAtual}_${dataAtual}_${periodo}_${assunto}`;
                const indicesFechados = Array.from(new Set([
                    ...(vagasFechadas[vagaKeyNew] || []),
                    ...(vagasFechadas[vagaKeyOld] || []),
                ]));
                const ocupadas = agendamentos[periodo]?.[assunto] || [];
                
                // 1. Adiciona os agendamentos já agendados
                ocupadas.forEach(agendamento => {
                    const vagaElement = createVagaElement(agendamento);
                    container.appendChild(vagaElement);
                });

                // 2. Calcula e adiciona os slots restantes (vazios ou fechados)
                const disponiveis = total - ocupadas.length;
                for (let i = 0; i < disponiveis; i++) {
                    
                    if (indicesFechados.includes(i)) {
                        const vagaFechada = document.createElement('div');
                        vagaFechada.className = 'vaga-fechada';
                        
                        const btnReabrir = document.createElement('button');
                        btnReabrir.className = 'btn-reabrir-vaga';
                        btnReabrir.innerHTML = `<i class="fas fa-unlock"></i> Reabrir`;
                        btnReabrir.addEventListener('click', () => reabrirVagaUnica(periodo, assunto, i));
                        
                        vagaFechada.appendChild(btnReabrir);
                        container.appendChild(vagaFechada);

                    } else {
                        const slotVazio = document.createElement('div');
                        slotVazio.className = 'vaga-vazia';
                        
                        const texto = document.createElement('span');
                        texto.textContent = 'Arraste uma OS aqui';
                        
                        const btnFechar = document.createElement('button');
                        btnFechar.className = 'btn-indisponibilizar-vaga';
                        btnFechar.title = 'Tornar vaga indisponível';
                        btnFechar.innerHTML = `<i class="fas fa-times"></i>`;
                        btnFechar.addEventListener('click', () => fecharVagaUnica(periodo, assunto, i));
                        
                        slotVazio.appendChild(texto);
                        slotVazio.appendChild(btnFechar);
                        container.appendChild(slotVazio);
                    }
                }
            }
        });
    });
}

// Cria dinamicamente os blocos de assunto (caso não existam no HTML)
function ensureAssuntoContainers(template) {
    if (!template) return;

    const slug = (s) => String(s || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const periodSections = Array.from(document.querySelectorAll('.periodo-section'));
    const findPeriodSection = (periodo) => {
        // tenta achar pelo título h3
        return periodSections.find(sec => {
            const t = sec.querySelector('.periodo-title')?.textContent?.trim()?.toUpperCase();
            return t === String(periodo).trim().toUpperCase();
        });
    };

    Object.entries(template).forEach(([periodo, assuntos]) => {
        const sec = findPeriodSection(periodo);
        if (!sec) return;

        // container onde os grupos de assunto ficam (no HTML atual eles ficam direto dentro da section)
        const host = sec;

        Object.keys(assuntos || {}).forEach((assunto) => {
            // Já existe?
            const existing = host.querySelector(`.vagas-container[data-periodo="${CSS.escape(periodo)}"][data-assunto="${CSS.escape(assunto)}"]`);
            if (existing) return;

            const id = `vaga_${slug(periodo)}_${slug(assunto)}`;
            const countId = `count_${slug(periodo)}_${slug(assunto)}`;

            const group = document.createElement('div');
            group.className = 'assunto-group';

            const h4 = document.createElement('h4');
            h4.className = 'assunto-title';
            h4.innerHTML = `${assunto} (<span id="${countId}">0</span> vagas)`;
if (canAdjustVagas) {
    const actions = document.createElement('span');
    actions.className = 'capacity-actions';

    const btnPlus = document.createElement('button');
    btnPlus.type = 'button';
    btnPlus.className = 'capacity-btn capacity-plus';
    btnPlus.title = 'Adicionar vaga';
    btnPlus.innerHTML = '<i class="fas fa-plus"></i>';

    const btnMinus = document.createElement('button');
    btnMinus.type = 'button';
    btnMinus.className = 'capacity-btn capacity-minus';
    btnMinus.title = 'Remover vaga';
    btnMinus.innerHTML = '<i class="fas fa-minus"></i>';

    // Evita interferir no drag
    btnPlus.addEventListener('mousedown', (e) => e.stopPropagation());
    btnMinus.addEventListener('mousedown', (e) => e.stopPropagation());

    btnPlus.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        try {
            const city = document.getElementById('cidadeAgenda')?.value || '';
            const tipo_os = tipoAgendaAtual || 'FIBRA';
            const periodo = cont.dataset.periodo;
            const assuntoName = cont.dataset.assunto;
            if (!city) return showToast('Selecione a cidade primeiro', 'warning');
            await ajustarCapacidadeVaga({ city, tipo_os, periodo, assunto: assuntoName, delta: 1 });
            showToast('Vaga adicionada', 'success');
            await carregarAgenda();
        } catch (err) {
            showToast(err.message || 'Erro ao adicionar vaga', 'error');
        }
    });

    btnMinus.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        try {
            const city = document.getElementById('cidadeAgenda')?.value || '';
            const tipo_os = tipoAgendaAtual || 'FIBRA';
            const periodo = cont.dataset.periodo;
            const assuntoName = cont.dataset.assunto;
            if (!city) return showToast('Selecione a cidade primeiro', 'warning');
            await ajustarCapacidadeVaga({ city, tipo_os, periodo, assunto: assuntoName, delta: -1 });
            showToast('Vaga removida', 'success');
            await carregarAgenda();
        } catch (err) {
            showToast(err.message || 'Erro ao remover vaga', 'error');
        }
    });

    actions.appendChild(btnPlus);
    actions.appendChild(btnMinus);
    h4.appendChild(actions);
}


            const cont = document.createElement('div');
            cont.className = 'vagas-container';
            cont.id = id;
            cont.dataset.assunto = assunto;
            cont.dataset.periodo = periodo;

            group.appendChild(h4);
            group.appendChild(cont);
            host.appendChild(group);
        });
    });
}

// NOVA FUNÇÃO para fechar uma vaga INDIVIDUAL
function fecharVagaUnica(periodo, assunto, index) {
    const vagaKey = `${cidadeAtual}_${dataAtual}_${tipoAgendaAtual}_${periodo}_${assunto}`;
    const vagaKeyOld = `${cidadeAtual}_${dataAtual}_${periodo}_${assunto}`;
    
    if (!vagasFechadas[vagaKey]) {
        vagasFechadas[vagaKey] = [];
    }
    
    if (!vagasFechadas[vagaKey].includes(index)) {
        vagasFechadas[vagaKey].push(index);
    }

    // limpeza/migração: remove do formato antigo pra evitar contagem duplicada
    if (vagasFechadas[vagaKeyOld]) {
        vagasFechadas[vagaKeyOld] = (vagasFechadas[vagaKeyOld] || []).filter(i => i !== index);
        if (vagasFechadas[vagaKeyOld].length === 0) delete vagasFechadas[vagaKeyOld];
    }

    // persiste no servidor
fetch('/api/vagas-fechadas', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cidade: cidadeAtual, data: dataAtual, tipo: tipoAgendaAtual, periodo, assunto, index, closed: true })
}).then(() => carregarAgenda()).catch(() => carregarAgenda());
    showToast('Vaga indisponibilizada com sucesso!', 'success');
}

// NOVA FUNÇÃO para reabrir uma vaga INDIVIDUAL
function reabrirVagaUnica(periodo, assunto, index) {
    const vagaKey = `${cidadeAtual}_${dataAtual}_${tipoAgendaAtual}_${periodo}_${assunto}`;
    const vagaKeyOld = `${cidadeAtual}_${dataAtual}_${periodo}_${assunto}`;
    
    if (vagasFechadas[vagaKey]) {
        vagasFechadas[vagaKey] = vagasFechadas[vagaKey].filter(i => i !== index);
    }

    // também garante reabertura caso ainda exista no formato antigo
    if (vagasFechadas[vagaKeyOld]) {
        vagasFechadas[vagaKeyOld] = vagasFechadas[vagaKeyOld].filter(i => i !== index);
        if (vagasFechadas[vagaKeyOld].length === 0) delete vagasFechadas[vagaKeyOld];
    }

    // persiste no servidor
fetch('/api/vagas-fechadas', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cidade: cidadeAtual, data: dataAtual, tipo: tipoAgendaAtual, periodo, assunto, index, closed: false })
}).then(() => carregarAgenda()).catch(() => carregarAgenda());
    showToast('Vaga reaberta com sucesso!', 'success');
}

// Criar elemento de vaga ocupada
function createVagaElement(agendamento) {
    const vaga = document.createElement('div');
    vaga.className = 'vaga-ocupada';
    vaga.dataset.id = agendamento.id;

    const canDelete = Array.isArray(window.currentUser?.permissions)
        && window.currentUser.permissions.includes('agenda.delete');

    // Adiciona a classe de status ao elemento principal do card
    if (agendamento.status) {
        const statusClass = agendamento.status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(' ', '-');
        vaga.classList.add(`status-${statusClass}`);
    }

    // Lógica para formatar a hora de forma segura
    let horaFormatada = 'N/A';
    if (agendamento.data_hora) {
        horaFormatada = new Date(agendamento.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    const statusKey = agendamento.status || 'Status N/D';
    const statusText = STATUS_LABELS[statusKey] || statusKey;
    const statusClass = (statusKey)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(' ', '-');

    // Monta o HTML do card com todas as informações
    vaga.innerHTML = `
        <div class="vaga-header">
            <span class="vaga-cliente">${agendamento.cliente}</span>
            ${canDelete ? `
                <button class="vaga-remove" data-action="delete" title="Excluir agendamento">
                    <i class="fas fa-trash"></i>
                </button>
            ` : ''}
        </div>
        <div class="vaga-info">
            <span class="vaga-tecnico">
                <i class="fas fa-user-cog"></i> 
                ${agendamento.tecnico || 'A definir'}
            </span>
            <span class="vaga-status status-${statusClass}">
                ${statusText}
            </span>
        </div>
        ${agendamento.observacoes ? `
            <div class="vaga-obs">
                <strong><i class="fas fa-comment-dots"></i> Obs:</strong> ${agendamento.observacoes}
            </div>
        ` : ''}
    `;

    if (canDelete) {
        const btn = vaga.querySelector('button[data-action="delete"]');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                excluirAgendamento(agendamento.id);
            });
        }
    }

    vaga.addEventListener('click', () => abrirModalDashboard(agendamento));
    return vaga;
}

// Excluir agendamento (DELETE no banco) e recarregar a UI
async function excluirAgendamento(id) {
    if (!id && id !== 0) return;
    const ok = confirm('Tem certeza que deseja EXCLUIR este agendamento? Essa ação não pode ser desfeita.');
    if (!ok) return;

    try {
        const resp = await fetch(`/api/agendamentos/${id}`, { method: 'DELETE' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            showToast(err?.error || 'Erro ao excluir agendamento', 'error');
            return;
        }
        showToast('Agendamento excluído com sucesso!', 'success');
        fecharModalDashboard();
        await carregarAgenda();
        await carregarAgendamentosAguardando();
    } catch (e) {
        showToast('Erro de conexão ao excluir agendamento', 'error');
    }
}

// Handler do botão "Excluir" dentro do modal
function excluirAgendamentoDoDashboard() {
    const id = document.getElementById('dashboardEditId')?.value;
    excluirAgendamento(id);
}

// Manipular drop de agendamento
async function handleDropAgendamento(evt) {
    const agendamentoId = evt.item.dataset.id;
    // Sortable às vezes entrega um container filho; subimos até achar os datasets.
    let targetContainer = evt.to;
    while (targetContainer && targetContainer !== document && (!targetContainer.dataset || (!targetContainer.dataset.periodo || !targetContainer.dataset.assunto))) {
        targetContainer = targetContainer.parentElement;
    }
    if (!targetContainer || !targetContainer.dataset) {
        showToast('Destino inválido para alocar.', 'error');
        return;
    }
    
    evt.item.remove();

    const periodo = targetContainer.dataset.periodo;
    const vagaAssunto = targetContainer.dataset.assunto;
    const dataHora = prepararDataHora(dataAtual, periodo);

    try {
        // Usa a rota /alocar para também gravar o ASSUNTO da vaga.
        const response = await fetch(`/api/agendamentos/${agendamentoId}/alocar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data_hora: dataHora,
                periodo,
                vaga_assunto: vagaAssunto
            })
        });

        if (response.ok) {
            showToast('Agendamento alocado com sucesso!', 'success');
        } else {
            const err = await response.json().catch(() => ({}));
            showToast(err?.error || 'Erro no servidor ao alocar.', 'error');
        }
    } catch (error) {
        showToast('Erro de conexão ao alocar.', 'error');
    } finally {
        await carregarAgenda();
        await carregarAgendamentosAguardando();
    }
}

// Preparar data e hora para o agendamento
function prepararDataHora(data, periodo) {
    const dataObj = new Date(data + 'T00:00:00'); 
    
    if (periodo === 'MANHÃ') {
        dataObj.setHours(9, 0, 0); // 09:00
    } else {
        dataObj.setHours(14, 0, 0); // 14:00
    }
    
    return dataObj.toISOString();
}

// Obter ID do container de vagas
function getContainerId(periodo, assunto) {
    // Prioriza achar pelo dataset (funciona para blocos fixos e dinâmicos)
    const el = document.querySelector(`.vagas-container[data-periodo="${CSS.escape(periodo)}"][data-assunto="${CSS.escape(assunto)}"]`);
    if (el?.id) return el.id;

    // Fallback: id gerado por slug
    const slug = (s) => String(s || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    return `vaga_${slug(periodo)}_${slug(assunto)}`;
}

// Mudar tipo agenda
function mudarAgenda(tipo) {
    tipoAgendaAtual = tipo; // Atualiza o estado global

    // Atualiza o estilo das abas
    document.getElementById('tab-fibra').classList.toggle('active', tipo === 'FIBRA');
    document.getElementById('tab-radio').classList.toggle('active', tipo === 'RADIO');

    // Recarrega a agenda com o novo tipo selecionado
    carregarAgenda();
}


// Obter ID do contador de vagas
function getCountId(periodo, assunto) {
    const containerId = getContainerId(periodo, assunto);
    return `${containerId}Count`;
}

// Obter informações do container a partir do próprio elemento (data-attributes)
function getContainerInfo(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return [null, null];

    const periodo = String(el.dataset.periodo || "").trim().toUpperCase();
    const assunto = String(el.dataset.assunto || "").trim().toUpperCase();

    return [periodo || null, assunto || null];
}


function abrirModalDashboard(agendamento) {
    console.log("Tentando abrir o modal de edição para o agendamento:", agendamento);
    try {
        if (!agendamento || typeof agendamento.id === 'undefined') {
            console.error("Erro: dados do agendamento inválidos ou ausentes.", agendamento);
            showToast("Não foi possível carregar os dados deste agendamento.", "error");
            return;
        }

        const tecnicoSelect = document.getElementById('dashboardEditTecnico');
        if (tecnicoSelect && config.tecnicos) {
            tecnicoSelect.innerHTML = '<option value="">Selecione um técnico</option>';
            config.tecnicos.forEach(t => tecnicoSelect.innerHTML += `<option value="${t}">${t}</option>`);
        }

        const statusSelect = document.getElementById('dashboardEditStatus');
        if (statusSelect && config.statusPossiveis) {
            statusSelect.innerHTML = '';
            config.statusPossiveis.forEach(s => statusSelect.innerHTML += `<option value="${s}">${getStatusLabel(s)}</option>`);
        }

        document.getElementById('dashboardEditId').value = agendamento.id;
        document.getElementById('dashboardEditTecnico').value = agendamento.tecnico || '';
        document.getElementById('dashboardEditStatus').value = agendamento.status || 'Agendada';
        document.getElementById('dashboardEditObservacao').value = agendamento.observacoes || '';

        // Mostra/oculta o botão de excluir conforme permissão
        const delBtn = document.getElementById('dashboardDeleteBtn');
        const canDelete = Array.isArray(window.currentUser?.permissions)
            && window.currentUser.permissions.includes('agenda.delete');
        if (delBtn) delBtn.style.display = canDelete ? 'inline-flex' : 'none';

        // CORREÇÃO: Usa classList.add('show') para exibir o modal
        const modal = document.getElementById('dashboardEditModal');
        if (modal) {
            modal.classList.add('show');
            console.log("Modal de edição exibido com sucesso.");
        } else {
            console.error("ERRO GRAVE: O elemento do modal 'dashboardEditModal' não foi encontrado no HTML!");
        }

    } catch (error) {
        console.error("Erro catastrófico ao tentar abrir o modal de edição:", error);
        showToast("Ocorreu um erro inesperado ao tentar editar.", "error");
    }
}

// Adicione esta função ao seu ficheiro se ela não existir, ou substitua a existente
function fecharModalDashboard() {
    const modal = document.getElementById('dashboardEditModal');
    if (modal) {
        // CORREÇÃO: Usa classList.remove('show') para esconder o modal
        modal.classList.remove('show');
    }
}

// Função para sair do sistema
function logout() {
    window.location.href = '/logout';
}
