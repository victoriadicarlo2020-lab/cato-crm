# Como ligar o CRM à planilha "Prospecção CATO"

Leva uns 10 minutos e só precisa ser feito uma vez. Depois disso, você e o Cael veem os mesmos leads em qualquer computador ou celular.

## 1. Colar o script na planilha

1. Abra a planilha **Prospecção CATO** no Google Sheets.
2. No menu, clique em **Extensões → Apps Script**.
3. Apague tudo o que estiver no arquivo `Código.gs` e cole o conteúdo do arquivo [`Code.gs`](Code.gs) deste repositório.
4. Clique no ícone de disquete (**Salvar**).

## 2. Definir a senha do painel

1. Volte para a aba da planilha e **recarregue a página** (F5).
2. Vai aparecer um menu novo, **CRM Cato**, no topo. Clique em **CRM Cato → Definir senha do painel**.
3. Na primeira vez, o Google pede autorização:
   - clique em **Continuar** e escolha a sua conta;
   - se aparecer "O Google não verificou este app", clique em **Avançado → Acessar Projeto sem título (não seguro)**. O aviso aparece porque o script é seu e não passou pela verificação do Google. Ele só mexe nesta planilha;
   - clique em **Permitir**.
4. Rode **CRM Cato → Definir senha do painel** de novo, se precisar, e digite a senha que vocês vão usar.
5. Clique em **CRM Cato → Preparar colunas do CRM**. Ele cria, no fim do cabeçalho da aba `leads_sem_site`, as colunas **ETAPA CRM, INSTAGRAM, OBSERVAÇÕES, ID CRM, CRIADO EM e ATUALIZADO EM**. As suas colunas e dados continuam como estão.

## 3. Publicar como App da Web

1. No Apps Script, clique em **Implantar → Nova implantação**.
2. Na engrenagem ao lado de "Selecione o tipo", escolha **App da Web**.
3. Preencha:
   - **Executar como:** Eu (sua conta)
   - **Quem pode acessar:** Qualquer pessoa
4. Clique em **Implantar** e copie o **URL do app da Web** (termina em `/exec`).

"Qualquer pessoa" é necessário para o painel conseguir falar com a planilha. Mesmo assim, ninguém lê nem altera nada sem a senha, que fica guardada no script e não no site.

## 4. Entrar no painel

1. Abra https://victoriadicarlo2020-lab.github.io/cato-crm/
2. Digite a senha. O link do App da Web já está fixo no código (`var API_URL` no `index.html`), então não precisa colar nada.

Se um dia você criar uma **implantação nova** (em vez de editar a existente), o link `/exec` muda e precisa ser atualizado nessa linha do `index.html`.

## Como funciona no dia a dia

- **Tudo que muda no painel vai para a planilha:** criar, editar, mover entre etapas e excluir.
- **Tudo que muda na planilha aparece no painel:** o painel busca novidades a cada 15 segundos e sempre que você volta para a aba.
- **Etapa do funil:** fica na coluna **ETAPA CRM** (Leads, Demo Criada, Mensagem Enviada, Em Negociação, Fechado). Pode editar direto na planilha também. Linhas sem etapa aparecem em "Leads", ou em "Demo Criada" se já tiverem link de demo.
- **SITUAÇÃO e SITE CATO** aparecem no painel, mas continuam sendo editadas só na planilha.
- **Excluir no painel apaga a linha da planilha.** Se apagar sem querer, recupere em **Arquivo → Histórico de versões**.
- **Trocar senha:** pelo botão **Senha** do painel ou pelo menu **CRM Cato** na planilha. Vale para todo mundo na hora.

## Se mudar o script depois

Sempre que colar uma versão nova do `Code.gs`, publique de novo em **Implantar → Gerenciar implantações → (lápis) Editar → Versão: Nova versão → Implantar**. Assim o link `/exec` continua o mesmo.
