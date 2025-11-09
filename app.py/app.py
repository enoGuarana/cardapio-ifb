from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from config import Config
from datetime import datetime
import json
import logging

# Configuração de Logging (Opcional, mas útil para debug)
logging.basicConfig(level=logging.INFO)

# --- ESTRUTURA DE DADOS DO CARDÁPIO (Mapeado da imagem) ---
# Usamos o preço aqui para calcular o total no servidor (por segurança)
CARDAPIO_DATA = {
    "ALMOÇO": [
        {"nome": "Self Service", "preco": 42.99},
        {"nome": "Self Service Vegetariano", "preco": 33.99},
        {"nome": "Proteína", "preco": 59.99},
        {"nome": "Sobremesa", "preco": 54.99}
    ],
    "LANCHES": [
        {"nome": "Salgado Assado", "preco": 4.50},
        {"nome": "Salgado Vegetariano", "preco": 4.50},
        {"nome": "Pão de Queijo 50g", "preco": 2.50},
        {"nome": "Salada de Fruta", "preco": 6.00},
        {"nome": "Pizza", "preco": 9.00},
        {"nome": "Sanduíche Natural 150g", "preco": 7.00},
        {"nome": "Sanduíche Vegetariano 120g", "preco": 7.00},
        {"nome": "Bolo Simples 100g", "preco": 3.00},
        {"nome": "Pão C/ Sal/Margarina ou Manteiga 50g", "preco": 2.00},
        {"nome": "Misto Simples", "preco": 5.00},
        {"nome": "Misto Completo", "preco": 7.00},
        {"nome": "Queijo Simples", "preco": 5.00},
        {"nome": "Queijo Quente", "preco": 7.50},
        {"nome": "Queijo Quente Completo", "preco": 7.50},
        {"nome": "Fruta", "preco": 1.00}
    ],
    "TAPIOCA": [
        {"nome": "Com Manteiga", "preco": 4.00},
        {"nome": "Com Ovo", "preco": 7.00},
        {"nome": "Presunto e Queijo", "preco": 9.00},
        {"nome": "Presunto, Queijo e Ovo", "preco": 11.00}
    ],
    "CUSCUZ": [
        {"nome": "Cuscuz Puro", "preco": 3.75},
        {"nome": "Com Ovo", "preco": 5.50},
        {"nome": "Presunto e Queijo", "preco": 7.50},
        {"nome": "Presunto, Queijo e Ovo", "preco": 9.50},
        {"nome": "Com Manteiga", "preco": 4.50}
    ],
    "OMELETE": [
        {"nome": "Omelete Simples", "preco": 12.00},
        {"nome": "Omelete Completo", "preco": 15.00}
    ],
    "BEBIDAS": [
        {"nome": "Café Puro 50 ml", "preco": 2.50},
        {"nome": "Café Com Leite 50 ml", "preco": 3.00},
        {"nome": "Leite Puro 50 ml", "preco": 2.60},
        {"nome": "Leite Com Chocolate", "preco": 3.50},
        {"nome": "100 ml", "preco": 6.00},
        {"nome": "Vitamina de Frutas 300 ml", "preco": 8.00},
        {"nome": "Suco Natural 300 ml", "preco": 6.00}
    ]
}

# --- FUNÇÃO DE BUSCA DE PREÇO ---
def buscar_preco_item(nome_item):
    """Busca o preço oficial do item no CARDAPIO_DATA."""
    for categoria in CARDAPIO_DATA.values():
        for item in categoria:
            if item['nome'] == nome_item:
                return item['preco']
    return None

# --- INICIALIZAÇÃO DO FLASK E DB ---
app = Flask(__name__)
app.config.from_object(Config)
db = SQLAlchemy(app)

# --- 1. MODELOS DO BANCO DE DADOS ---

class Pedido(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nome_cliente = db.Column(db.String(100), nullable=False)
    horario_pedido = db.Column(db.DateTime, default=datetime.utcnow)
    valor_total = db.Column(db.Float, default=0.0)
    # Status: Pendente, Em Preparo, Pronto, Cancelado
    status = db.Column(db.String(20), default='Pendente')
    
    # Relação com Detalhes: 'backref' permite acessar os detalhes do pedido
    detalhes = db.relationship('DetalhePedido', backref='pedido', lazy=True)

class DetalhePedido(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    pedido_id = db.Column(db.Integer, db.ForeignKey('pedido.id'), nullable=False)
    nome_item = db.Column(db.String(100), nullable=False)
    quantidade = db.Column(db.Integer, nullable=False)
    preco_unitario = db.Column(db.Float, nullable=False)

# --- 2. ROTAS DE VISUALIZAÇÃO (HTML) ---

@app.route('/')
def index():
    return render_template('index.html')

# ROTA DA COZINHA (VISUALIZAÇÃO DE PEDIDOS PENDENTES)
@app.route('/cozinha')
def cozinha():
    # Buscamos todos os pedidos que não foram marcados como 'Pronto' ou 'Cancelado'
    pedidos_ativos = Pedido.query.filter(
        Pedido.status.in_(['Pendente', 'Em Preparo'])
    ).order_by(Pedido.horario_pedido.asc()).all()
    
    # Para cada pedido, carregamos os detalhes (os itens que foram pedidos)
    pedidos_com_detalhes = []
    for p in pedidos_ativos:
        pedidos_com_detalhes.append({
            'id': p.id,
            'nome_cliente': p.nome_cliente,
            'horario': p.horario_pedido.strftime('%H:%M:%S'),
            'status': p.status,
            'detalhes': [{'nome': d.nome_item, 'qtd': d.quantidade} for d in p.detalhes]
        })
        
    return render_template('cozinha.html', pedidos=pedidos_com_detalhes)


# --- 3. ROTAS DE API (JSON) ---

@app.route('/api/cardapio')
def api_cardapio():
    """Retorna o cardápio mapeado (usado pelo JS)."""
    return jsonify(CARDAPIO_DATA)

@app.route('/api/pedido', methods=['POST'])
def receber_pedido():
    """Recebe, calcula e salva o novo pedido."""
    data = request.json
    nome_cliente = data.get('nome_cliente')
    itens_pedido = data.get('itens', [])
    
    if not nome_cliente or not itens_pedido:
        return jsonify({"success": False, "mensagem": "Dados inválidos."}), 400

    valor_total = 0.0
    detalhes_para_salvar = []

    try:
        # 1. Validação e Cálculo de Segurança no Servidor
        for item_data in itens_pedido:
            nome_item = item_data.get('nome')
            quantidade = item_data.get('quantidade', 0)
            
            # Busca o preço oficial do servidor
            preco_oficial = buscar_preco_item(nome_item) 

            if preco_oficial is None or quantidade <= 0:
                logging.warning(f"Item ou quantidade inválida recebida: {nome_item}, {quantidade}")
                raise ValueError("Item ou quantidade inválida no pedido.")

            subtotal = preco_oficial * quantidade
            valor_total += subtotal
            
            detalhes_para_salvar.append({
                'nome_item': nome_item, 
                'quantidade': quantidade, 
                'preco_unitario': preco_oficial
            })

        # 2. Criação do Pedido Principal
        novo_pedido = Pedido(
            nome_cliente=nome_cliente,
            valor_total=valor_total,
            status='Pendente' 
        )
        db.session.add(novo_pedido)
        db.session.flush() # Força a obtenção do ID antes do commit

        # 3. Criação dos Detalhes do Pedido
        for detalhe in detalhes_para_salvar:
            novo_detalhe = DetalhePedido(
                pedido_id=novo_pedido.id,
                nome_item=detalhe['nome_item'],
                quantidade=detalhe['quantidade'],
                preco_unitario=detalhe['preco_unitario']
            )
            db.session.add(novo_detalhe)
            
        db.session.commit()
        
        logging.info(f"Pedido #{novo_pedido.id} de {nome_cliente} salvo com sucesso.")
        
        return jsonify({
            "success": True, 
            "id_pedido": novo_pedido.id, 
            "mensagem": "Pedido recebido!"
        })

    except Exception as e:
        db.session.rollback()
        logging.error(f"Erro ao processar pedido: {e}")
        return jsonify({"success": False, "mensagem": "Erro interno ao salvar pedido."}), 500

@app.route('/api/fila')
def api_fila():
    """Retorna IDs e status dos pedidos 'Pendente' ou 'Em Preparo'."""
    # Filtra apenas os pedidos ativos na fila
    pedidos_ativos = Pedido.query.filter(
        Pedido.status.in_(['Pendente', 'Em Preparo'])
    ).order_by(Pedido.horario_pedido.asc()).all()
    
    # Retorna uma lista simples de objetos com ID e Status
    fila = [{'id': p.id, 'status': p.status} for p in pedidos_ativos]
    
    return jsonify(fila)

# --- 4. ROTAS DA CANTINA (ADMINISTRAÇÃO) ---

@app.route('/cozinha/update_status', methods=['POST'])
def update_status_cozinha():
    """Atualiza o status de um pedido (usado pela interface da cantina)."""
    data = request.json
    pedido_id = data.get('pedido_id')
    novo_status = data.get('status')
    
    if novo_status not in ['Pendente', 'Em Preparo', 'Pronto', 'Cancelado']:
        return jsonify({"success": False, "mensagem": "Status inválido."}), 400

    pedido = Pedido.query.get(pedido_id)
    
    if not pedido:
        return jsonify({"success": False, "mensagem": "Pedido não encontrado."}), 404

    try:
        pedido.status = novo_status
        db.session.commit()
        logging.info(f"Status do Pedido #{pedido_id} atualizado para {novo_status}.")
        return jsonify({"success": True, "id": pedido_id, "status": novo_status})
    except Exception as e:
        db.session.rollback()
        logging.error(f"Erro ao atualizar status do pedido #{pedido_id}: {e}")
        return jsonify({"success": False, "mensagem": "Erro ao atualizar DB."}), 500

# --- 5. ROTA DE RELATÓRIO (ADMIN) ---

@app.route('/admin/relatorio')
def relatorio():
    # IMPLEMENTAÇÃO FUTURA: Adicione autenticação básica aqui!
    
    # Buscamos todos os pedidos (Prontos e Pendentes) para o relatório
    todos_pedidos = Pedido.query.order_by(Pedido.horario_pedido.desc()).all()
    
    conta_final = sum(p.valor_total for p in todos_pedidos if p.status != 'Cancelado')
    
    relatorio_data = []
    for p in todos_pedidos:
        relatorio_data.append({
            'id': p.id,
            'nome_cliente': p.nome_cliente,
            'horario': p.horario_pedido.strftime('%d/%m/%Y %H:%M:%S'),
            'valor_total': f"R$ {p.valor_total:.2f}".replace('.', ','),
            'status': p.status,
            'detalhes': [f"{d.quantidade}x {d.nome_item}" for d in p.detalhes]
        })

    return render_template('relatorio.html', 
                           pedidos=relatorio_data, 
                           conta_final=f"R$ {conta_final:.2f}".replace('.', ','))

# --- INÍCIO DA APLICAÇÃO ---

if __name__ == '__main__':
    with app.app_context():
        # Cria as tabelas (Pedido e DetalhePedido) no arquivo pedidos.db
        db.create_all() 
    app.run(debug=True)