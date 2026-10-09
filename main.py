import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI(title="API Cafeteria Gourmet")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NEON_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    try:
        return psycopg2.connect(NEON_URL)
    except Exception as e:
        print(f"Erro ao ligar à base de dados: {e}")
        return None

# --- MODELOS DE DADOS PARA RECEBER O PEDIDO ---
class ItemCarrinho(BaseModel):
    id: int
    quantidade: int
    preco: float

class PedidoCreate(BaseModel):
    cliente_id: int
    itens: List[ItemCarrinho]

class ClienteSync(BaseModel):
    nome: str
    email: str
    telefone: str
    endereco: str

# --- ROTAS DA API ---

@app.get("/")
def read_root():
    return {"mensagem": "Bem-vindo à API da Cafeteria Gourmet na Nuvem!"}

@app.get("/produtos")
def listar_produtos():
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Erro de ligação")
    
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM produtos;")
    produtos = cursor.fetchall()
    
    cursor.close()
    conn.close()
    return produtos

@app.post("/clientes/sync")
def sincronizar_cliente(cliente: ClienteSync):
    """Verifica se o cliente existe pelo email. Se não existir, cadastra."""
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Erro de ligação")
    
    try:
        cursor = conn.cursor()
        # Procura o cliente pelo email (que é UNIQUE na base de dados)
        cursor.execute("SELECT id FROM clientes WHERE email = %s;", (cliente.email,))
        resultado = cursor.fetchone()
        
        if resultado:
            cliente_id = resultado[0]
            # (Opcional) Atualiza os dados de entrega mais recentes
            cursor.execute(
                "UPDATE clientes SET nome = %s, telefone = %s, endereco = %s WHERE id = %s;",
                (cliente.nome, cliente.telefone, cliente.endereco, cliente_id)
            )
        else:
            # Regista um cliente totalmente novo
            cursor.execute(
                "INSERT INTO clientes (nome, email, telefone, endereco) VALUES (%s, %s, %s, %s) RETURNING id;",
                (cliente.nome, cliente.email, cliente.telefone, cliente.endereco)
            )
            cliente_id = cursor.fetchone()[0]
            
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"cliente_id": cliente_id}
        
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao sincronizar cliente: {e}")

@app.post("/pedidos")
def criar_pedido(pedido: PedidoCreate):
    """Rota para processar o checkout e gravar na base de dados"""
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Erro de ligação")
    
    try:
        cursor = conn.cursor()
        
        # Calcula o total do pedido para gravar na base de dados
        total_pedido = sum(item.preco * item.quantidade for item in pedido.itens)
        
        # 1. Cria o registo na tabela pedidos e obtém o ID gerado
        cursor.execute(
            "INSERT INTO pedidos (cliente_id, total, status) VALUES (%s, %s, %s) RETURNING id;",
            (pedido.cliente_id, total_pedido, 'Pendente')
        )
        pedido_id = cursor.fetchone()[0]
        
        # 2. Grava cada item do carrinho na tabela associativa itens_pedido
        for item in pedido.itens:
            cursor.execute(
                "INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario) VALUES (%s, %s, %s, %s);",
                (pedido_id, item.id, item.quantidade, item.preco)
            )
            
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"mensagem": "Pedido processado com sucesso!", "pedido_id": pedido_id}
        
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao gravar pedido: {e}")