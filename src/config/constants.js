// Constantes e estrutura padrão de vagas
// Extraído do server.js original para manter comportamento

const cidades = ['PARACATU', 'PATROCINIO', 'PATOS DE MINAS', 'VARJÃO DE MINAS', 'LAGOA FORMOSA', 'PANTANO', 'CARMO DO PARANAIBA', 'CRUZEIRO DA FORTALEZA', 'SAO GONÇALO'];
const tecnicos = ['João Silva', 'Maria Souza', 'Carlos Rocha', 'A definir'];
const statusPossiveis = ['Aberta', 'Agendada', 'Em andamento', 'Concluída', 'Cancelada'];
const assuntos = ['SEM CONEXÃO', 'CONEXÃO LENTA', 'AGENDAMENTO', 'INSTALAÇÃO', 'MANUTENÇÃO'];
const tiposOS = ['FIBRA', 'RADIO'];

// Estrutura de vagas por cidade
const ESTRUTURA_VAGAS = {
    "PATOS DE MINAS": {
        "FIBRA": {
            "MANHÃ": { "SEM CONEXÃO": 5, "CONEXÃO LENTA": 2, "AGENDAMENTO": 3 },
            "TARDE": { "SEM CONEXÃO": 5, "CONEXÃO LENTA": 2, "AGENDAMENTO": 3 }
        },
        "RADIO": {
            "MANHÃ": { "SEM CONEXÃO": 2, "CONEXÃO LENTA": 1, "AGENDAMENTO": 2 },
            "TARDE": { "SEM CONEXÃO": 2, "CONEXÃO LENTA": 1, "AGENDAMENTO": 2 }
        }
    },
    "PATROCINIO": {
        "FIBRA": {
            "MANHÃ": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
            "TARDE": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
        },
        "RADIO": {
            "MANHÃ": { "SEM CONEXÃO": 1, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
            "TARDE": { "SEM CONEXÃO": 1, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
        }
    },
    "PARACATU": {
        "FIBRA": {
            "MANHÃ": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
            "TARDE": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
        },
        "RADIO": {
            "MANHÃ": { "SEM CONEXÃO": 1, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
            "TARDE": { "SEM CONEXÃO": 1, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
        }
    },
    "VARJAO DE MINAS": {
        "FIBRA": {
            "MANHÃ": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
            "TARDE": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
        },
        "RADIO": {
            "MANHÃ": { "SEM CONEXÃO": 1, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
            "TARDE": { "SEM CONEXÃO": 1, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
        }
    },
    "LAGOA FORMOSA": {
        "FIBRA": {
            "MANHÃ": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
            "TARDE": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
        },
        "RADIO": {
            "MANHÃ": { "SEM CONEXÃO": 1, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
            "TARDE": { "SEM CONEXÃO": 1, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
        }
    },
    "PANTANO": {
        "FIBRA": {
            "MANHÃ": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
            "TARDE": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
        },
        "RADIO": {
            "MANHÃ": { "SEM CONEXÃO": 1, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
            "TARDE": { "SEM CONEXÃO": 1, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
        }
    },
    "CARMO DO PARANAIBA": {
        "FIBRA": {
            "MANHÃ": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
            "TARDE": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
        },
        "RADIO": {
            "MANHÃ": { "SEM CONEXÃO": 1, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
            "TARDE": { "SEM CONEXÃO": 1, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
        }
    },
    "CRUZEIRO DA FORTALEZA": {
        "FIBRA": {
            "MANHÃ": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
            "TARDE": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
        },
        "RADIO": {
            "MANHÃ": { "SEM CONEXÃO": 1, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
            "TARDE": { "SEM CONEXÃO": 1, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
        }
    },
    "SAO GONÇALO": {
        "FIBRA": {
            "MANHÃ": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
            "TARDE": { "SEM CONEXÃO": 3, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
        },
        "RADIO": {
            "MANHÃ": { "SEM CONEXÃO": 1, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 },
            "TARDE": { "SEM CONEXÃO": 1, "CONEXÃO LENTA": 1, "AGENDAMENTO": 1 }
        }
    }
};

module.exports = { cidades, tecnicos, statusPossiveis, assuntos, tiposOS, ESTRUTURA_VAGAS };