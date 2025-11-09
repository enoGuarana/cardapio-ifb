// Variáveis Globais de Estado
let carrinho = {}; // Estrutura: {item_id: {nome: '...', preco: 1.00, quantidade: 1}}
let cardapioCompleto = {}; // Armazena todos os dados do cardápio
let pedidoEmFila = null; // Armazena o ID do pedido se ele estiver na fila

const ELEM_LISTA_CARDAPIO = document.getElementById('cardapio-list');
const ELEM_CARRINHO_ITENS = document.getElementById('carrinho-itens');
const ELEM_VALOR_TOTAL = document.getElementById('valor-total');
const ELEM_BTN_FINALIZAR = document.getElementById('btn-finalizar');
const ELEM_NOME_CLIENTE = document.getElementById('nome-cliente');
const ELEM_CONFIRMACAO_SECTION = document.getElementById('confirmacao-section');
const ELEM_BTN_WHATSAPP = document.getElementById('btn-whatsapp');

// --- 1. FUNÇÕES DE INICIALIZAÇÃO E RENDERIZAÇÃO ---

/**
 * Busca o cardápio no backend e inicia a renderização.
 */
async function carregarCardapio() {
    try {
        const response = await fetch('/api/cardapio');
        if (!response.ok) {
            throw new Error('Erro ao carregar os dados do cardápio.');
        }
        cardapioCompleto = await response.json();
        
        // Remove a mensagem de carregamento
        document.getElementById('loading-message').style.display = 'none';

        renderizarCardapio(cardapioCompleto);
    } catch (error) {
        console.error("Falha ao carregar cardápio:", error);
        ELEM_LISTA_CARDAPIO.innerHTML = `<p class="error-message">Não foi possível carregar o cardápio. Tente novamente.</p>`;
    }
}

/**
 * Renderiza os itens do cardápio na tela.
 * @param {object} cardapio - Dados do cardápio agrupados por categoria.
 */
function renderizarCardapio(cardapio) {
    ELEM_LISTA_CARDAPIO.innerHTML = ''; // Limpa o conteúdo

    for (const [categoria, itens] of Object.entries(cardapio)) {
        const categoriaBox = document.createElement('div');
        categoriaBox.className = 'categoria-box';
        categoriaBox.innerHTML = `<h3>${categoria}</h3>`;
        
        itens.forEach(item => {
            const itemId = `${categoria.replace(/\s/g, '_')}_${item.nome.replace(/\s/g, '_')}`;
            
            const itemElement = document.createElement('div');
            itemElement.className = 'item-card';
            itemElement.innerHTML = `
                <div class="item-details">
                    <div class="item-name">${item.nome}</div>
                </div>
                <div class="item-price">R$ ${item.preco.toFixed(2).replace('.', ',')}</div>
                <button class="add-btn" onclick="adicionarAoCarrinho('${itemId}', '${item.nome}', ${item.preco})">+</button>
            `;
            categoriaBox.appendChild(itemElement);
        });

        ELEM_LISTA_CARDAPIO.appendChild(categoriaBox);
    }
}

// --- 2. FUNÇÕES DE GERENCIAMENTO DO CARRINHO ---

/**
 * Adiciona ou incrementa um item no carrinho.
 */
function adicionarAoCarrinho(itemId, nome, preco) {
    if (carrinho[itemId]) {
        carrinho[itemId].quantidade += 1;
    } else {
        carrinho[itemId] = {
            nome: nome,
            preco: preco,
            quantidade: 1
        };
    }
    atualizarCarrinho();
}

/**
 * Altera a quantidade de um item ou o remove se a quantidade for 0.
 */
function alterarQuantidade(itemId, delta) {
    if (!carrinho[itemId]) return;

    carrinho[itemId].quantidade += delta;

    if (carrinho[itemId].quantidade <= 0) {
        delete carrinho[itemId];
    }
    atualizarCarrinho();
}

/**
 * Recalcula o total e renderiza o carrinho.
 */
function atualizarCarrinho() {
    let total = 0;
    ELEM_CARRINHO_ITENS.innerHTML = '';
    
    const ids = Object.keys(carrinho);
    
    if (ids.length === 0) {
        ELEM_CARRINHO_ITENS.innerHTML = '<p class="empty-cart-message">Seu carrinho está vazio. Adicione itens!</p>';
        ELEM_BTN_FINALIZAR.disabled = true;
    } else {
        ELEM_BTN_FINALIZAR.disabled = ELEM_NOME_CLIENTE.value.trim() === ''; // Habilita se tiver itens e nome
        
        ids.forEach(itemId => {
            const item = carrinho[itemId];
            const subtotal = item.preco * item.quantidade;
            total += subtotal;

            const itemElement = document.createElement('div');
            itemElement.className = 'item-card item-carrinho';
            itemElement.innerHTML = `
                <div class="item-details">
                    <span class="item-name">${item.nome}</span>
                    <small> (R$ ${item.preco.toFixed(2).replace('.', ',')} cada)</small>
                </div>
                <div class="item-controls">
                    <button class="qty-btn remove" onclick="alterarQuantidade('${itemId}', -1)">-</button>
                    <span class="qty">${item.quantidade}</span>
                    <button class="qty-btn add" onclick="alterarQuantidade('${itemId}', 1)">+</button>
                </div>
                <div class="item-price">R$ ${subtotal.toFixed(2).replace('.', ',')}</div>
            `;
            ELEM_CARRINHO_ITENS.appendChild(itemElement);
        });
    }

    // Atualiza o total
    ELEM_VALOR_TOTAL.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

// Escuta a mudança no campo de nome para habilitar/desabilitar o botão de finalizar
ELEM_NOME_CLIENTE.addEventListener('input', () => {
    // Habilita se houver itens no carrinho E o campo Nome não estiver vazio
    ELEM_BTN_FINALIZAR.disabled = Object.keys(carrinho).length === 0 || ELEM_NOME_CLIENTE.value.trim() === '';
});

// --- 3. FUNÇÕES DE ENVIO E COMUNICAÇÃO ---

/**
 * Envia o pedido para o backend Flask.
 */
async function enviarPedido() {
    const nome = ELEM_NOME_CLIENTE.value.trim();
    const itens = Object.values(carrinho); // Transforma o objeto carrinho em um array de itens
    
    if (itens.length === 0 || nome === '') {
        alert("Por favor, adicione itens ao carrinho e insira seu nome.");
        return;
    }

    ELEM_BTN_FINALIZAR.disabled = true;
    ELEM_BTN_FINALIZAR.textContent = 'Enviando...';
    
    const pedidoPayload = {
        nome_cliente: nome,
        itens: itens
    };

    try {
        const response = await fetch('/api/pedido', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(pedidoPayload)
        });
        
        const resultado = await response.json();

        if (resultado.success) {
            // Sucesso: Exibe a tela de confirmação e inicia a fila
            document.getElementById('cardapio-section').style.display = 'none';
            document.getElementById('carrinho-section').style.display = 'none';
            ELEM_CONFIRMACAO_SECTION.style.display = 'block';

            pedidoEmFila = resultado.id_pedido; // Salva o ID do pedido
            document.getElementById('pedido-id-display').textContent = `#${pedidoEmFila}`;
            
            montarLinkWhatsApp(nome, pedidoEmFila);
            // Inicia a verificação da fila a cada 5 segundos
            setInterval(verificarFila, 5000); 

            // Limpa o carrinho e campos
            carrinho = {};
            ELEM_NOME_CLIENTE.value = '';
            atualizarCarrinho();
        } else {
            alert("Erro ao finalizar pedido: " + resultado.mensagem);
        }

    } catch (error) {
        console.error("Falha na comunicação com o servidor:", error);
        alert("Erro de conexão. Tente novamente.");
    } finally {
        ELEM_BTN_FINALIZAR.disabled = false;
        ELEM_BTN_FINALIZAR.textContent = 'Finalizar Pedido';
    }
}

/**
 * Monta e configura o botão de compartilhamento via WhatsApp.
 */
function montarLinkWhatsApp(nome, idPedido) {
    const numeroCantina = "5511999999999"; // <-- Substituir pelo número real da cantina
    const urlFila = window.location.href; // A URL atual para o cliente acompanhar a fila

    let resumoItens = Object.values(carrinho).map(item => `${item.quantidade}x ${item.nome}`).join('\n');
    let totalFormatado = ELEM_VALOR_TOTAL.textContent;
    
    // Mensagem a ser enviada
    const mensagem = `
*--- PEDIDO CONFIRMADO ---*
Cliente: ${nome}
ID do Pedido: #${idPedido}
Total: ${totalFormatado}

*Itens:*
${resumoItens}

Acompanhe sua posição na fila: ${urlFila}
Obrigado!
    `;
    
    // Codifica a mensagem para a URL
    const linkWhatsApp = `https://wa.me/${numeroCantina}?text=${encodeURIComponent(mensagem)}`;
    
    ELEM_BTN_WHATSAPP.onclick = () => window.open(linkWhatsApp, '_blank');
}

/**
 * Verifica a posição do pedido na fila online.
 */
async function verificarFila() {
    if (!pedidoEmFila) return;

    try {
        const response = await fetch('/api/fila');
        const pedidosEmFila = await response.json(); // Esperamos uma lista de IDs/Status
        
        const listaIDs = pedidosEmFila.map(p => p.id);
        const index = listaIDs.indexOf(pedidoEmFila); // Encontra a posição do ID atual
        
        if (index !== -1) {
            // Pedido ainda está na fila
            document.getElementById('fila-posicao-display').textContent = `${index + 1}º (de ${listaIDs.length})`;
            document.getElementById('status-pedido').innerHTML = `
                <p>Seu ID de Pedido é: <strong id="pedido-id-display">#${pedidoEmFila}</strong></p>
                <p>Posição na Fila: <strong id="fila-posicao-display">${index + 1}º (de ${listaIDs.length})</strong></p>
                <p class="aviso-fila">Aguarde a atualização da sua posição.</p>
                ${ELEM_BTN_WHATSAPP.outerHTML}
            `;
        } else {
            // Pedido não está mais na lista de pendentes (assumimos que está pronto/removido)
            document.getElementById('fila-posicao-display').textContent = 'Pronto para Retirada!';
            document.getElementById('status-pedido').innerHTML = `
                <p>✅ Pedido <strong id="pedido-id-display">#${pedidoEmFila}</strong></p>
                <h3 style="color: var(--success-color);">Seu pedido está pronto!</h3>
                <p>Dirija-se ao balcão de retirada.</p>
            `;
            // Interrompe a verificação automática
            clearInterval(this); 
        }

    } catch (error) {
        console.error("Falha ao verificar a fila:", error);
    }
}


// --- INÍCIO DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', carregarCardapio);