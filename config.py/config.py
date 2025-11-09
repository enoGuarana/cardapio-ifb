import os

# Pega o caminho absoluto do diretório onde o arquivo está rodando
basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    # Chave Secreta: Usada para segurança de sessões e cookies no Flask.
    # É fundamental que este valor seja uma string aleatória e complexa em produção.
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'voce-nao-vai-adivinhar-essa-chave'
    
    # Configuração do Banco de Dados SQLAlchemy
    # Usamos SQLite (arquivo) e chamamos o nosso banco de dados de pedidos.db
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'pedidos.db')
        
    # Desativa um recurso de rastreamento de modificações que consome muita memória
    SQLALCHEMY_TRACK_MODIFICATIONS = False