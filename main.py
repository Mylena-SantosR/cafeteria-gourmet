import os
from decimal import Decimal
from typing import Literal
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
    tipo_entrega: Literal["entrega", "retirada"] = "entrega"

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

def calcular_resumo_pedido(pedido, cursor):
    if not pedido.itens:
        raise HTTPException(400, "O carrinho está vazio.")

    quantidades = {}

    for item in pedido.itens:
        if item.id <= 0 or item.quantidade <= 0:
            raise HTTPException(400, "Produto ou quantidade inválidos.")

        quantidades[item.id] = (
            quantidades.get(item.id, 0) + item.quantidade
        )

    if sum(quantidades.values()) > 20:
        raise HTTPException(400, "O limite é de 20 unidades por pedido.")

    cursor.execute(
        "SELECT id, preco FROM produtos WHERE id = ANY(%s)",
        (list(quantidades),)
    )

    precos = {
        id_produto: preco
        for id_produto, preco in cursor.fetchall()
    }

    if len(precos) != len(quantidades):
        raise HTTPException(400, "Um ou mais produtos não existem.")

    subtotal = sum(
        (
            Decimal(precos[id_produto]) * quantidade
            for id_produto, quantidade in quantidades.items()
        ),
        Decimal("0.00")
    )

    if pedido.tipo_entrega == "retirada" or subtotal >= Decimal("60.00"):
        frete = Decimal("0.00")
    else:
        frete = Decimal("6.90")

    itens = [
        {
            "id": id_produto,
            "quantidade": quantidade,
            "preco_unitario": precos[id_produto]
        }
        for id_produto, quantidade in quantidades.items()
    ]

    return {
        "subtotal": subtotal,
        "frete": frete,
        "total": subtotal + frete,
        "tipo_entrega": pedido.tipo_entrega,
        "itens": itens
    }


@app.post("/pedidos/simular-total")
def simular_total(pedido: PedidoCreate):
    conn = get_db_connection()

    if conn is None:
        raise HTTPException(500, "Banco de dados indisponível.")

    try:
        with conn.cursor() as cursor:
            return calcular_resumo_pedido(pedido, cursor)
    finally:
        conn.close()


@app.post("/pedidos")
def criar_pedido(pedido: PedidoCreate):
    conn = get_db_connection()

    if conn is None:
        raise HTTPException(500, "Banco de dados indisponível.")

    try:
        with conn.cursor() as cursor:
            resumo = calcular_resumo_pedido(pedido, cursor)

            cursor.execute(
                "SELECT 1 FROM clientes WHERE id = %s",
                (pedido.cliente_id,)
            )

            if cursor.fetchone() is None:
                raise HTTPException(400, "Cliente não encontrado.")

            cursor.execute(
                """
                INSERT INTO pedidos
                (cliente_id, subtotal, frete, tipo_entrega, total, status)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    pedido.cliente_id,
                    resumo["subtotal"],
                    resumo["frete"],
                    resumo["tipo_entrega"],
                    resumo["total"],
                    "Pendente"
                )
            )
            pedido_id = cursor.fetchone()[0]

            for item in resumo["itens"]:
                cursor.execute(
                    """
                    INSERT INTO itens_pedido
                    (pedido_id, produto_id, quantidade, preco_unitario)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (
                        pedido_id,
                        item["id"],
                        item["quantidade"],
                        item["preco_unitario"]
                    )
                )

        conn.commit()

        return {
            "mensagem": "Pedido de demonstração registrado.",
            "pedido_id": pedido_id,
            "status": "Pendente",
            "subtotal": resumo["subtotal"],
            "frete": resumo["frete"],
            "total": resumo["total"],
            "tipo_entrega": resumo["tipo_entrega"]
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            500,
            "Não foi possível registrar o pedido."
        )

    finally:
        conn.close()
