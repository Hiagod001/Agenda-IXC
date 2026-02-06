# Sistema de Agenda Uai Telecom - Versão 1.5

## Visão Geral

Este é o sistema de agenda de ordens de serviço da Uai Telecom, completamente refatorado com melhorias significativas em segurança, funcionalidade e design visual. O sistema foi redesenhado seguindo a identidade visual da empresa e inclui animações modernas para uma melhor experiência do usuário.

## Principais Melhorias

### 🔒 Segurança
- Sistema de autenticação robusto com bcrypt
- Validação de entrada em todas as rotas
- Middleware de autenticação aprimorado
- Logs detalhados de ações dos usuários
- Tratamento seguro de erros

### 🎨 Design e UX
- Interface moderna baseada na identidade visual da Uai Telecom
- Design responsivo para desktop, tablet e mobile
- Animações suaves e micro-interações
- Cores extraídas da logo oficial (vermelho #E31E24, laranja #F39C12)
- Componentes visuais consistentes

### ⚡ Funcionalidades
- Dashboard com estatísticas em tempo real
- Sistema de notificações toast
- Filtros avançados para agendamentos
- Consulta de vagas por cidade e data
- Relatórios com gráficos interativos
- CRUD completo de agendamentos

### 🛠️ Tecnologias
- **Backend**: Node.js, Express, SQLite3, bcrypt
- **Frontend**: HTML5, CSS3, JavaScript ES6+, Chart.js
- **Segurança**: CORS, express-session, validação de dados
- **Design**: CSS Grid, Flexbox, animações CSS3

## Estrutura do Projeto

```
uai-agenda-refatorado/
├── server.js              # Servidor principal refatorado
├── package.json           # Dependências e scripts
├── .env                   # Variáveis de ambiente
├── .env.example          # Exemplo de configuração
├── agenda.db             # Banco de dados SQLite
├── public/               # Arquivos estáticos
│   ├── index.html        # Página principal
│   ├── login.html        # Página de login
│   ├── style.css         # Estilos principais
│   ├── login.css         # Estilos do login
│   ├── scripts.js        # JavaScript principal
│   ├── login.js          # JavaScript do login
│   └── logo.png          # Logo da Uai Telecom
└── README.md             # Esta documentação
```

## Instalação e Configuração

### Pré-requisitos
- Node.js 14.0.0 ou superior
- npm ou yarn

### Passos de Instalação

1. **Clone ou extraia o projeto**
   ```bash
   cd uai-agenda-refatorado
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente**
   ```bash
   cp .env.example .env
   # Edite o arquivo .env conforme necessário
   ```

4. **Inicie o servidor**
   ```bash
   npm start
   ```

5. **Acesse o sistema**
   - URL: http://localhost:3001
   - Login: hiago / hiago123 (admin)
   
## Funcionalidades Principais

### 1. Sistema de Login
- Autenticação segura com bcrypt
- Sessões persistentes
- Interface moderna com animações
- Validação em tempo real

### 2. Dashboard
- Estatísticas em tempo real
- Cards animados com contadores
- Lista de agendamentos recentes
- Navegação intuitiva

### 3. Gestão de Agendamentos
- Criação de novos agendamentos
- Edição e exclusão
- Filtros por status, cidade e técnico
- Validação de dados

### 4. Consulta de Vagas
- Verificação de disponibilidade por cidade
- Visualização por período (manhã/tarde)
- Contadores de vagas ocupadas/disponíveis

### 5. Relatórios
- Gráficos interativos com Chart.js
- Estatísticas por status, cidade, técnico
- Análise temporal por mês

## Configurações Avançadas

### Variáveis de Ambiente

```env
# Servidor
PORT=3001
NODE_ENV=development

# Segurança
SESSION_SECRET=sua-chave-secreta-aqui

# API IXC (opcional)
IXC_URL=https://sua-api-ixc.com.br
IXC_TOKEN=seu-token-ixc

# Banco de Dados
DB_PATH=./agenda.db
```

### Estrutura de Vagas

O sistema inclui uma estrutura configurável de vagas por cidade:

```javascript
const ESTRUTURA_VAGAS = {
    "PATOS DE MINAS": {
        "MANHÃ": { "SEM CONEXÃO": 7, "CONEXÃO LENTA": 3, "AGENDAMENTO": 5 },
        "TARDE": { "SEM CONEXÃO": 7, "CONEXÃO LENTA": 3, "AGENDAMENTO": 5 }
    },
    // ... outras cidades
};
```

## API Endpoints

### Autenticação
- `POST /login` - Fazer login
- `GET /logout` - Fazer logout
- `GET /api/user` - Verificar usuário logado

### Agendamentos
- `GET /api/agendamentos` - Listar agendamentos
- `POST /api/agendamentos` - Criar agendamento
- `PUT /api/agendamentos/:id` - Atualizar agendamento
- `DELETE /api/agendamentos/:id` - Excluir agendamento

### Configurações
- `GET /api/config` - Obter configurações (cidades, técnicos, status)
- `GET /api/vagas/:cidade/:data` - Consultar vagas

### Clientes (IXC)
- `GET /api/cliente/:id` - Buscar cliente por ID

## Melhorias de Segurança

### 1. Autenticação
- Senhas hasheadas com bcrypt (salt rounds: 10)
- Sessões seguras com express-session
- Middleware de autenticação em todas as rotas protegidas

### 2. Validação
- Validação de entrada em todos os endpoints
- Sanitização de dados
- Tratamento de erros padronizado

### 3. Logs
- Log de todas as ações dos usuários
- Rastreamento de IP
- Timestamps automáticos

## Design System

### Cores Principais
- **Vermelho Principal**: #E31E24
- **Laranja Secundário**: #F39C12
- **Vermelho Escuro**: #C41E3A
- **Branco**: #FFFFFF
- **Cinza Claro**: #F8F9FA
- **Cinza Médio**: #6C757D

### Tipografia
- Fonte: Segoe UI, Tahoma, Geneva, Verdana, sans-serif
- Hierarquia clara com tamanhos consistentes
- Peso variável (regular, semi-bold, bold)

### Componentes
- Cards com sombras suaves
- Botões com gradientes
- Inputs com labels flutuantes
- Tabelas responsivas
- Modais animados

## Responsividade

### Desktop (1200px+)
- Layout de 3 colunas
- Sidebar fixa
- Tabelas completas

### Tablet (768px - 1199px)
- Layout de 2 colunas
- Sidebar retrátil
- Cards empilhados

### Mobile (< 768px)
- Layout de 1 coluna
- Menu hambúrguer
- Cards full-width
- Scroll horizontal em tabelas

## Animações

### Micro-interações
- Hover effects em botões e cards
- Transições suaves entre páginas
- Loading spinners personalizados
- Feedback visual em ações

### Entrada de Elementos
- Fade-in para cards
- Slide-in para modais
- Bounce para notificações
- Contadores animados

## Troubleshooting

### Problemas Comuns

1. **Erro de conexão com banco**
   - Verifique se o arquivo agenda.db existe
   - Confirme as permissões de escrita

2. **Falha na autenticação**
   - Verifique a SESSION_SECRET no .env
   - Limpe os cookies do navegador

3. **API IXC não funciona**
   - Verifique IXC_URL e IXC_TOKEN
   - A API IXC é opcional para funcionamento básico

### Logs
Os logs são armazenados no banco de dados na tabela `logs` e incluem:
- Timestamp
- Usuário
- Ação realizada
- Detalhes da ação
- Endereço IP

## Contribuição

Para contribuir com o projeto:

1. Mantenha o padrão de código estabelecido
2. Teste todas as funcionalidades antes de submeter
3. Documente novas funcionalidades
4. Siga as diretrizes de design da Uai Telecom

## Suporte

Para suporte técnico ou dúvidas sobre o sistema, entre em contato com a equipe de desenvolvimento da Uai Telecom.

---

**Versão**: 2.0.0  
**Data**: Julho 2024  
**Desenvolvido para**: Uai Telecom  
**Tecnologias**: Node.js, Express, SQLite, HTML5, CSS3, JavaScript

