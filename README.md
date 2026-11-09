# Cafeteria Gourmet

**Aplicação web de cafeteria virtual desenvolvida como projeto acadêmico do Projeto Integrador Transdisciplinar em Sistemas de Informação II (PIT II).**

A Cafeteria Gourmet simula a experiência de compra em uma cafeteria on-line: o visitante pode explorar o cardápio, conhecer os produtos, organizar o carrinho e registrar um **pedido demonstrativo**. O projeto integra uma interface web a uma API REST e a um banco de dados relacional na nuvem.

**[Acessar a aplicação](https://mylena-santosr.github.io/cafeteria-gourmet/)**  
**[Código-fonte no GitHub](https://github.com/Mylena-SantosR/cafeteria-gourmet)**

> **Atenção:** este projeto é uma demonstração acadêmica. Não há cobrança nem processamento de pagamentos reais. Ao testar o checkout, utilize somente **dados fictícios**.

## Objetivo

Desenvolver e aprimorar uma solução web para uma cafeteria, aplicando conhecimentos de desenvolvimento front-end, APIs REST, modelagem de banco de dados, integração de sistemas, usabilidade e testes funcionais. Na PIT II, o foco foi identificar oportunidades de melhoria, implementar correções e documentar os resultados obtidos.

## Funcionalidades

- **Cardápio digital:** catálogo de bebidas, doces e salgados com imagens, descrições e preços.
- **Categorias e pesquisa:** filtros e busca por nome ou descrição dos produtos.
- **Produtos em destaque:** seleção de itens apresentada na página inicial.
- **Detalhes dos produtos:** janela com informações e opções de apresentação, incluindo Café Gourmet Premium pronto para beber, em grãos e moído.
- **Carrinho editável:** inclusão e remoção de itens, alteração de quantidades e atualização dos valores.
- **Checkout demonstrativo:** formulário de identificação, escolha entre entrega e retirada e exibição do resumo do pedido.
- **Cálculo de frete:** taxa demonstrativa de R$ 6,90 para entregas com subtotal inferior a R$ 60,00; entrega gratuita a partir de R$ 60,00 e retirada gratuita.
- **Histórico demonstrativo:** visualização dos itens, quantidades, preços e etapas ilustrativas do pedido, com informações mantidas no navegador.

**Área de entrega apresentada na simulação:** zona urbana de Luziânia (GO), sujeita à confirmação. **Prazo ilustrativo:** 40 a 60 minutos. A aplicação não realiza validação automática da região atendida.

## Tecnologias utilizadas

| Camada | Tecnologias |
| --- | --- |
| Front-end | HTML5, CSS3 e JavaScript |
| Back-end | Python e FastAPI |
| Banco de dados | PostgreSQL |
| Hospedagem da interface | GitHub Pages |
| Hospedagem da API | Render |
| Banco na nuvem | Neon |
| Versionamento | Git e GitHub |
| Desenvolvimento e verificações | WSL (Ubuntu), navegador e SQL Editor do Neon |

## Arquitetura

O PostgreSQL utiliza quatro tabelas principais:

- `clientes`: identificação e dados informados no checkout demonstrativo;
- `produtos`: catálogo, descrições e preços;
- `pedidos`: cliente, subtotal, frete, modalidade, total, status e data;
- `itens_pedido`: produtos, quantidades e preços unitários de cada pedido.

## Organização do repositório

```text
cafeteria-gourmet/
├── img/                 # Imagens e recursos do projeto
├── index.html           # Página principal e estrutura do front-end
├── main.py              # API REST desenvolvida com FastAPI
├── requirements.txt     # Dependências Python
├── ux-melhorias.css     # Estilos das melhorias de usabilidade
├── ux-melhorias.js      # Busca, destaques, carrinho e detalhes
├── ux-pedidos.css       # Estilos do histórico de pedidos
├── ux-pedidos.js        # Histórico demonstrativo
├── ux-checkout-api.css  # Estilos da integração do checkout
├── ux-checkout-api.js   # Resumo e confirmação pela API
└── README.md            # Documentação do repositório
```

## Executar localmente

### Pré-requisitos

- Python 3 instalado;
- Git;
- Acesso a um banco PostgreSQL compatível, caso deseje executar a API localmente.

### 1. Clonar o projeto

```bash
git clone https://github.com/Mylena-SantosR/cafeteria-gourmet.git
cd cafeteria-gourmet
```

### 2. Preparar o ambiente Python

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

No Windows sem WSL, a ativação do ambiente pode variar conforme o terminal.

### 3. Configurar a conexão com o banco

A API lê a variável de ambiente `DATABASE_URL`. Utilize uma conexão de **desenvolvimento/testes**, sem publicar credenciais no repositório.

No Linux ou WSL, para informar a conexão sem exibi-la na tela:

```bash
read -r -s -p "Conexão PostgreSQL: " DATABASE_URL
echo
export DATABASE_URL
```

### 4. Iniciar a API

```bash
python3 -m uvicorn main:app --host 127.0.0.1 --port 8001
```

Documentação interativa da API local: <http://127.0.0.1:8001/docs>.

### 5. Executar a interface

Em outro terminal, dentro da pasta do projeto:

```bash
python3 -m http.server 5500 --bind 127.0.0.1
```

Acesse <http://127.0.0.1:5500>.

**Observação:** o front-end publicado utiliza a URL da API do Render configurada nos arquivos JavaScript/HTML. Para testar a interface especificamente contra a API local, ajuste esses endereços para `http://127.0.0.1:8001` em sua cópia de desenvolvimento. Não envie endereços locais para o site público.

## Principais endpoints da API

| Método | Rota | Finalidade |
| --- | --- | --- |
| `GET` | `/produtos` | Consultar o catálogo de produtos |
| `POST` | `/clientes/sync` | Localizar ou cadastrar um cliente demonstrativo |
| `POST` | `/pedidos/simular-total` | Calcular subtotal, frete e total com base nos preços do banco |
| `POST` | `/pedidos` | Registrar um pedido demonstrativo e seus itens |

> As rotas de cadastro e pedido não substituem um sistema completo de autenticação e autorização. Não utilize informações pessoais verdadeiras nos testes públicos.

## Melhorias realizadas na PIT II

O trabalho de melhoria concentrou-se em cinco áreas: **pesquisa no cardápio**, **edição do carrinho**, **detalhamento dos produtos**, **transparência das informações de entrega** e **destaques na página inicial**. Como complemento, foi aprimorado o **histórico demonstrativo de pedidos** e a API passou a considerar preços oficiais e regras de frete no cálculo do pedido.

As melhorias foram acompanhadas por verificações funcionais da interface, consultas à estrutura do banco no Neon e publicação da versão atualizada no GitHub Pages e no Render.

## Limitações conhecidas

Este é um **MVP acadêmico**, não uma plataforma pronta para comercialização. Permanecem fora do escopo atual:

- autenticação e autorização completas de usuários;
- processamento de pagamentos reais;
- validação automática de endereço e cobertura de entrega;
- sincronização do histórico entre dispositivos;
- atualização automática do status do pedido a partir do banco;
- testes abrangentes de segurança, desempenho e carga.

O histórico exibido na interface e suas etapas de andamento são **demonstrativos** e podem depender dos dados armazenados no próprio navegador.

## Autoria

**Mylena dos Santos Rocha**  
Projeto acadêmico — Sistemas de Informação — PIT II  
GitHub: [@Mylena-SantosR](https://github.com/Mylena-SantosR)

---

*Desenvolvido para fins de aprendizagem, demonstração e aplicação prática de conceitos de Engenharia de Software.*
