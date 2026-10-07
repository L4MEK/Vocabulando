document.addEventListener('DOMContentLoaded', () => {
  /* ================= Elementos ================= */
  const quadrados = [...document.querySelectorAll('.quadrados')];
  const teclas = [...document.querySelectorAll('.tecla')];
  const msgEl = document.getElementById('mensagem');
  // Mapa letra -> botão do teclado virtual (ENTER e apagar não têm data-tecla, ficam de fora)
  const teclaPorLetra = Object.fromEntries(
    teclas.filter(t => t.dataset.tecla).map(t => [t.dataset.tecla, t])
  );

  /* ================= Configuração ================= */
  const COLUNAS = 5; // letras por palavra
  const LINHAS = 6;  // tentativas

  // Cor de cada estado e prioridade no teclado: verde (3) > amarelo (2) > preto (1)
  const ESTADOS = {
    verde:   { corQuadro: 'green',     corTecla: '#01ad27',   prio: 3 },
    amarela: { corQuadro: '#ffea00d6', corTecla: '#ffea00d6', prio: 2 },
    preta:   { corQuadro: '#6966663a', corTecla: '#00000088', prio: 1 }
  };

  /* ================= Estado do jogo ================= */
  let entradaAtual = Array(COLUNAS).fill(''); // letras da linha atual
  let linhaAtual = 0;
  let posicaoAtiva = 0;                       // quadrado que está piscando
  let jogoTerminado = false;
  let palavraCorreta = '';
  let palavraCorretaNorm = '';                // sem acento, usada na comparação
  const palavrasValidas = {};                 // sem acento -> versão com acento
  const prioridadeTeclas = {};                // letra -> prioridade da cor atual da tecla
  let timerMsg;                               // controla o tempo da mensagem na tela

  /* ================= Utilitários ================= */
  // Remove acentos: "Á" -> "A", "Ç" -> "C"
  const normalizar = p => p.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Quadrados da linha atual
  const linhaQuadrados = () =>
    quadrados.slice(linhaAtual * COLUNAS, (linhaAtual + 1) * COLUNAS);

  // Aplica uma classe de animação em cada quadrado da linha (com atraso opcional entre eles)
  // e remove a classe quando a animação termina
  const animarLinha = (classe, atraso = 0) => {
    linhaQuadrados().forEach((q, i) => setTimeout(() => {
      q.classList.add(classe);
      q.addEventListener('animationend', () => q.classList.remove(classe), { once: true });
    }, i * atraso));
  };

  // Mostra uma mensagem por 3s com fade
  const mostrarMensagem = texto => {
    clearTimeout(timerMsg); // evita que uma mensagem antiga esconda a nova
    msgEl.textContent = texto;
    msgEl.style.display = 'block';
    setTimeout(() => msgEl.classList.add('show'), 10); // espera o display aplicar para o fade rodar
    timerMsg = setTimeout(() => {
      msgEl.classList.remove('show');
      timerMsg = setTimeout(() => (msgEl.style.display = 'none'), 500);
    }, 3000);
  };

  /* ================= Carregamento das palavras ================= */
  (async () => {
    try {
      const [{ palavras }, { respostas }] = await Promise.all(
        ['palavras.json', 'respostas.json'].map(arq => fetch(arq).then(r => r.json()))
      );
      palavras.forEach(p => {
        p = p.toUpperCase();
        palavrasValidas[normalizar(p)] = p;
      });
      const lista = respostas.map(r => r.toUpperCase());
      palavraCorreta = lista[Math.floor(Math.random() * lista.length)];
      palavraCorretaNorm = normalizar(palavraCorreta);
    } catch (erro) {
      console.error('Erro ao carregar palavras:', erro);
      mostrarMensagem('Erro ao carregar palavras. Tente novamente mais tarde.');
    }
  })();

  /* ================= Interface ================= */
  // Escreve as letras da entrada nos quadrados da linha atual
  const atualizarQuadrados = () =>
    linhaQuadrados().forEach((q, i) => (q.textContent = entradaAtual[i]));

  // Move o indicador piscante (.blinking) para o quadrado ativo; some quando o jogo acaba
  const atualizarPiscar = () => {
    quadrados.forEach(q => q.classList.remove('blinking'));
    if (!jogoTerminado) {
      quadrados[linhaAtual * COLUNAS + posicaoAtiva].classList.add('blinking');
    }
  };

  // Pinta a tecla do teclado virtual, sem nunca "rebaixar" a cor:
  // preta -> amarela -> verde, e verde nunca muda
  const atualizarTecla = (letra, estado) => {
    const tecla = teclaPorLetra[letra];
    const { corTecla, prio } = ESTADOS[estado];
    if (!tecla || prio <= (prioridadeTeclas[letra] || 0)) return;
    tecla.style.backgroundColor = corTecla;
    prioridadeTeclas[letra] = prio;
  };

  /* ================= Digitação ================= */
  const adicionarCaractere = letra => {
    if (jogoTerminado) return;
    entradaAtual[posicaoAtiva] = letra;
    atualizarQuadrados();
    posicaoAtiva = Math.min(posicaoAtiva + 1, COLUNAS - 1);
    atualizarPiscar();
  };

  const removerCaractere = () => {
    if (jogoTerminado) return;
    // Se o quadrado atual já está vazio, apaga o anterior
    if (posicaoAtiva > 0 && !entradaAtual[posicaoAtiva]) posicaoAtiva--;
    entradaAtual[posicaoAtiva] = '';
    atualizarQuadrados();
    atualizarPiscar();
  };

  // Setas do teclado movem o quadrado ativo
  const moverPosicao = direcao => {
    if (jogoTerminado) return;
    posicaoAtiva = Math.max(0, Math.min(COLUNAS - 1, posicaoAtiva + direcao));
    atualizarPiscar();
  };

  /* ================= Verificação ================= */
  const fimDeJogo = mensagem => {
    jogoTerminado = true;
    atualizarPiscar();
    setTimeout(() => mostrarMensagem(mensagem), 100);
  };

  const verificarPalavra = () => {
    const tentativa = normalizar(entradaAtual.join('')).split('');
    const alvo = palavraCorretaNorm.split('');
    const estados = Array(COLUNAS).fill('preta');
    const sobras = {}; // letras da resposta ainda não "gastas" (trata letras repetidas)

    alvo.forEach(l => (sobras[l] = (sobras[l] || 0) + 1));

    // 1ª passada: letras na posição certa (verde)
    tentativa.forEach((l, i) => {
      if (l === alvo[i]) { estados[i] = 'verde'; sobras[l]--; }
    });
    // 2ª passada: letras na posição errada (amarelo), respeitando as sobras
    tentativa.forEach((l, i) => {
      if (estados[i] !== 'verde' && sobras[l] > 0) { estados[i] = 'amarela'; sobras[l]--; }
    });

    // Pinta quadrados e teclado
    linhaQuadrados().forEach((q, i) => {
      q.style.backgroundColor = ESTADOS[estados[i]].corQuadro;
      atualizarTecla(tentativa[i], estados[i]);
    });

    if (estados.every(e => e === 'verde')) fimDeJogo('Você ganhou!');
    else if (linhaAtual + 1 === LINHAS) fimDeJogo('Você perdeu! A palavra era: ' + palavraCorreta);
  };

  const processarEnter = () => {
    if (jogoTerminado) return;

    // Linha incompleta
    if (entradaAtual.includes('')) {
      animarLinha('balancar');
      return mostrarMensagem('Preencha todos os quadrados antes de enviar!');
    }

    // Palavra fora da lista
    const valida = palavrasValidas[normalizar(entradaAtual.join(''))];
    if (!valida) {
      animarLinha('balancar');
      return mostrarMensagem('Palavra inválida!');
    }

    entradaAtual = valida.split(''); // usa a grafia com acento da lista
    atualizarQuadrados();
    verificarPalavra();
    animarLinha('virar', 100); // flip em cascata, 100ms entre cada quadrado

    // Passa para a próxima linha
    if (!jogoTerminado) {
      linhaAtual++;
      entradaAtual = Array(COLUNAS).fill('');
      posicaoAtiva = 0;
      atualizarQuadrados();
      atualizarPiscar();
    }
  };

  /* ================= Eventos ================= */
  // Clique num quadrado da linha atual = escolhe onde digitar
  quadrados.forEach((q, i) =>
    q.addEventListener('click', () => {
      if (!jogoTerminado && Math.floor(i / COLUNAS) === linhaAtual) {
        posicaoAtiva = i % COLUNAS;
        atualizarPiscar();
      }
    })
  );

  // Teclado virtual (um único listener para todas as teclas)
  document.querySelector('.teclado').addEventListener('click', e => {
    const btn = e.target.closest('.tecla'); // closest cobre o clique no ícone SVG do apagar
    if (!btn) return;
    if (btn.dataset.tecla) adicionarCaractere(btn.dataset.tecla);
    else if (btn.hasAttribute('data-enter')) processarEnter();
    else if (btn.hasAttribute('data-apagar')) removerCaractere();
    btn.blur(); // tira o foco para o Enter físico não "clicar" de novo no botão
  });

  // Teclado físico
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // não atrapalha atalhos (Ctrl+R etc.)
    const tecla = e.key.toUpperCase();
    if (/^[A-Z]$/.test(tecla)) adicionarCaractere(tecla);
    else if (tecla === 'ENTER') processarEnter();
    else if (tecla === 'BACKSPACE') removerCaractere();
    else if (tecla === 'ARROWLEFT') moverPosicao(-1);
    else if (tecla === 'ARROWRIGHT') moverPosicao(1);
  });

  /* ================= Início ================= */
  atualizarPiscar();
});
