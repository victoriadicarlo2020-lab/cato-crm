/**
 * CRM Cato Mídias · ponte entre o painel (GitHub Pages) e a planilha "Prospecção CATO".
 *
 * Como instalar: veja apps-script/COMO-INSTALAR.md no repositório cato-crm.
 * Resumo: Extensões → Apps Script → cole este arquivo → Implantar → App da Web
 *         (Executar como: Eu · Quem pode acessar: Qualquer pessoa).
 *
 * A senha do painel fica guardada aqui no script (Propriedades do script), nunca no site.
 * Defina pelo menu da planilha: CRM Cato → Definir senha do painel.
 */

var ABA = 'leads_sem_site';

var ETAPAS = [
  {id: 'leads',   nome: 'Leads'},
  {id: 'demo',    nome: 'Demo Criada'},
  {id: 'msg',     nome: 'Mensagem Enviada'},
  {id: 'neg',     nome: 'Em Negociação'},
  {id: 'fechado', nome: 'Fechado'}
];

// campo do CRM → nomes aceitos no cabeçalho. O primeiro nome é usado se a coluna precisar ser criada.
var CAMPOS = {
  nome:         ['NOME'],
  categoria:    ['CATEGORIA'],
  endereco:     ['ENDEREÇO', 'ENDERECO'],
  telefone:     ['TELEFONE'],
  website:      ['WEBSITE', 'SITE'],
  situacao:     ['SITUAÇÃO', 'SITUACAO'],
  siteCato:     ['SITE CATO'],
  demo:         ['LINK DE ACESSO A DEMONSTRAÇÃO', 'LINK DA DEMO', 'DEMO'],
  etapa:        ['ETAPA CRM'],
  instagram:    ['INSTAGRAM'],
  obs:          ['OBSERVAÇÕES', 'OBSERVACOES', 'OBS'],
  id:           ['ID CRM'],
  criadoEm:     ['CRIADO EM'],
  atualizadoEm: ['ATUALIZADO EM']
};
// colunas que o script cria no fim do cabeçalho se ainda não existirem
var CRIAR = ['etapa', 'instagram', 'obs', 'id', 'criadoEm', 'atualizadoEm'];
// campos que o painel pode alterar (SITUAÇÃO e SITE CATO continuam só na planilha)
var EDITAVEIS = ['nome', 'categoria', 'endereco', 'telefone', 'website', 'demo', 'etapa', 'instagram', 'obs'];

var PROP_SENHA = 'CRM_SENHA_HASH';
var MAX_FALHAS = 10; // tentativas de senha erradas em 10 minutos antes de bloquear

/* ======================= Entrada do App da Web ======================= */

function doGet() {
  return ContentService.createTextOutput('CRM Cato: conectado à planilha. Use este link no painel.');
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    checarSenha_(req.senha);
    lock.waitLock(20000);
    var r;
    switch (req.acao) {
      case 'listar':     r = {leads: listar_()}; break;
      case 'salvar':     r = {lead: salvar_(req.lead || {})}; break;
      case 'excluir':    excluir_(req.id); r = {}; break;
      case 'importar':   r = importar_(req.leads || [], req.modo); break;
      case 'trocarSenha':
        if (!req.nova || String(req.nova).length < 4) throw erro_('A nova senha precisa ter pelo menos 4 caracteres.');
        gravarSenha_(String(req.nova)); r = {}; break;
      default: throw erro_('Ação desconhecida.');
    }
    r.ok = true;
    return json_(r);
  } catch (err) {
    return json_({ok: false, erro: err.message || String(err), codigo: err.codigo || ''});
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function erro_(msg, codigo) { var e = new Error(msg); e.codigo = codigo || ''; return e; }

/* ======================= Senha ======================= */

function hash_(s) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'cato-crm::' + s, Utilities.Charset.UTF_8);
  return b.map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('');
}
function gravarSenha_(s) { PropertiesService.getScriptProperties().setProperty(PROP_SENHA, hash_(s)); }

function checarSenha_(senha) {
  var guardada = PropertiesService.getScriptProperties().getProperty(PROP_SENHA);
  if (!guardada) throw erro_('A senha ainda não foi definida. Na planilha, use o menu CRM Cato → Definir senha do painel.', 'senha');
  var cache = CacheService.getScriptCache();
  var falhas = Number(cache.get('falhas') || 0);
  if (falhas >= MAX_FALHAS) throw erro_('Muitas tentativas com senha errada. Espere 10 minutos.', 'bloqueado');
  if (hash_(String(senha || '')) !== guardada) {
    cache.put('falhas', String(falhas + 1), 600);
    throw erro_('Senha incorreta.', 'senha');
  }
}

/* ======================= Menu na planilha ======================= */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('CRM Cato')
    .addItem('Definir senha do painel', 'definirSenha')
    .addItem('Preparar colunas do CRM', 'prepararColunas')
    .addToUi();
}

function definirSenha() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Senha do painel CRM', 'Digite a senha que você e o Cael vão usar no painel (mínimo 4 caracteres):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var s = r.getResponseText();
  if (s.length < 4) { ui.alert('A senha precisa ter pelo menos 4 caracteres.'); return; }
  gravarSenha_(s);
  CacheService.getScriptCache().remove('falhas');
  ui.alert('Senha definida. Use essa senha para entrar no painel.');
}

function prepararColunas() {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { var n = listar_().length; } finally { lock.releaseLock(); }
  SpreadsheetApp.getUi().alert('Pronto! Colunas do CRM conferidas. ' + n + ' leads encontrados na aba "' + ABA + '".');
}

/* ======================= Planilha ======================= */

function norm_(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}
function nomeChave_(s) { return norm_(s).toLowerCase(); }

function aba_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(ABA);
  if (!sh) throw erro_('Não achei a aba "' + ABA + '" na planilha.');
  return sh;
}

// Acha a linha de cabeçalho (a que tem "NOME") e o número de cada coluna. Cria as colunas do CRM que faltarem.
function estrutura_(sh) {
  var largura = Math.max(sh.getLastColumn(), 1);
  var topo = sh.getRange(1, 1, Math.min(15, Math.max(sh.getLastRow(), 1)), largura).getDisplayValues();
  var hr = -1;
  for (var r = 0; r < topo.length; r++) {
    if (topo[r].some(function (v) { return norm_(v) === 'NOME'; })) { hr = r + 1; break; }
  }
  if (hr < 0) throw erro_('Não achei a linha de cabeçalho com a coluna NOME na aba "' + ABA + '".');
  var cab = topo[hr - 1].map(norm_);
  var col = {};
  Object.keys(CAMPOS).forEach(function (k) {
    var nomes = CAMPOS[k].map(norm_);
    var i = cab.findIndex(function (h) { return nomes.indexOf(h) > -1; });
    if (i > -1) col[k] = i + 1;
  });
  var faltam = CRIAR.filter(function (k) { return !col[k]; });
  if (faltam.length) {
    var prox = sh.getLastColumn() + 1;
    var modelo = sh.getRange(hr, col.nome);
    faltam.forEach(function (k) {
      if (prox > sh.getMaxColumns()) sh.insertColumnAfter(sh.getMaxColumns());
      var c = sh.getRange(hr, prox);
      modelo.copyTo(c, {formatOnly: true});
      c.setValue(CAMPOS[k][0]);
      col[k] = prox++;
    });
  }
  return {hr: hr, col: col};
}

function etapaId_(v) {
  var n = norm_(String(v || '').replace(/^\s*\d+\s*[.)-]\s*/, ''));
  if (!n) return '';
  for (var i = 0; i < ETAPAS.length; i++) {
    if (n === norm_(ETAPAS[i].id) || n === norm_(ETAPAS[i].nome)) return ETAPAS[i].id;
  }
  return '';
}
function etapaNome_(id) {
  for (var i = 0; i < ETAPAS.length; i++) if (ETAPAS[i].id === id) return ETAPAS[i].nome;
  return ETAPAS[0].nome;
}
function iso_(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString();
  if (v) { var d = new Date(v); if (!isNaN(d)) return d.toISOString(); }
  return '';
}

function gravar_(sh, linha, col, campo, valor) {
  var c = sh.getRange(linha, col);
  if (campo === 'criadoEm' || campo === 'atualizadoEm') {
    c.setNumberFormat('dd/MM/yyyy HH:mm').setValue(valor ? new Date(valor) : '');
  } else {
    if (campo === 'etapa') valor = etapaNome_(valor);
    // formato texto: evita que "+55 16…" vire fórmula e que telefones percam o zero
    c.setNumberFormat('@').setValue(String(valor == null ? '' : valor).slice(0, 5000));
  }
}

// Lê todas as linhas com nome. Dá ID e data de criação para linhas que ainda não têm.
function ler_() {
  var sh = aba_(), e = estrutura_(sh), col = e.col;
  var ultima = sh.getLastRow(), linhas = [];
  if (ultima <= e.hr) return {sh: sh, e: e, linhas: linhas};
  var n = ultima - e.hr, w = sh.getLastColumn();
  var vals = sh.getRange(e.hr + 1, 1, n, w).getValues();
  var disp = sh.getRange(e.hr + 1, 1, n, w).getDisplayValues();
  for (var i = 0; i < n; i++) {
    var get = function (k) { return col[k] ? String(disp[i][col[k] - 1] || '').trim() : ''; };
    var nome = get('nome');
    if (!nome) continue;
    var linha = e.hr + 1 + i;
    var l = {
      linha: linha, id: get('id'), nome: nome,
      categoria: get('categoria'), endereco: get('endereco'), telefone: get('telefone'),
      website: get('website'), situacao: get('situacao'), siteCato: get('siteCato'),
      demo: get('demo'), instagram: get('instagram'), obs: col.obs ? String(vals[i][col.obs - 1] || '') : '',
      etapa: etapaId_(get('etapa')),
      criadoEm: iso_(vals[i][col.criadoEm - 1]), atualizadoEm: iso_(vals[i][col.atualizadoEm - 1])
    };
    if (!l.etapa) l.etapa = (l.demo || /demo/i.test(l.siteCato)) ? 'demo' : 'leads';
    if (!l.id) {
      l.id = Utilities.getUuid().slice(0, 13);
      gravar_(sh, linha, col.id, 'id', l.id);
    }
    if (!l.criadoEm) {
      l.criadoEm = new Date().toISOString();
      gravar_(sh, linha, col.criadoEm, 'criadoEm', l.criadoEm);
    }
    linhas.push(l);
  }
  return {sh: sh, e: e, linhas: linhas};
}

function publico_(l) {
  var o = {};
  Object.keys(l).forEach(function (k) { if (k !== 'linha') o[k] = l[k]; });
  return o;
}

function listar_() { return ler_().linhas.map(publico_); }

function idValido_(id) { return /^[A-Za-z0-9-]{4,40}$/.test(String(id || '')); }

// Atualiza só os campos enviados (assim mover um card não apaga o que o sócio está editando em outro campo).
function aplicar_(sh, col, linha, dados) {
  EDITAVEIS.forEach(function (k) {
    if (dados[k] === undefined || !col[k]) return;
    if (k === 'nome' && !String(dados.nome).trim()) return;
    gravar_(sh, linha, col[k], k, k === 'etapa' ? (etapaId_(dados.etapa) || 'leads') : dados[k]);
  });
  gravar_(sh, linha, col.atualizadoEm, 'atualizadoEm', new Date().toISOString());
}

function salvar_(lead) {
  var d = ler_(), sh = d.sh, col = d.e.col;
  var atual = lead.id ? d.linhas.find(function (l) { return l.id === lead.id; }) : null;
  var linha;
  if (atual) {
    linha = atual.linha;
  } else {
    if (!String(lead.nome || '').trim()) throw erro_('O lead precisa ter um nome.');
    linha = sh.getLastRow() + 1;
    var id = idValido_(lead.id) ? lead.id : Utilities.getUuid().slice(0, 13);
    gravar_(sh, linha, col.id, 'id', id);
    gravar_(sh, linha, col.criadoEm, 'criadoEm', new Date().toISOString());
    if (lead.etapa === undefined) lead.etapa = 'leads';
  }
  aplicar_(sh, col, linha, lead);
  SpreadsheetApp.flush();
  var nova = ler_().linhas.find(function (l) { return l.linha === linha; });
  return nova ? publico_(nova) : null;
}

function excluir_(id) {
  var d = ler_();
  var l = d.linhas.find(function (x) { return x.id === id; });
  if (!l) throw erro_('Esse lead não está mais na planilha.');
  d.sh.deleteRow(l.linha);
}

// modo "novos": só adiciona quem ainda não existe (importar CSV).
// modo "mesclar": também atualiza quem já existe, se a versão enviada for mais recente (restaurar backup).
function importar_(lista, modo) {
  var d = ler_(), sh = d.sh, col = d.e.col;
  var porId = {}, porNome = {};
  d.linhas.forEach(function (l) { porId[l.id] = l; porNome[nomeChave_(l.nome)] = l; });
  var r = {adicionados: 0, atualizados: 0, ignorados: 0};
  var prox = sh.getLastRow() + 1;
  lista.slice(0, 2000).forEach(function (n) {
    if (!n || !String(n.nome || '').trim()) { r.ignorados++; return; }
    var ex = porId[n.id] || porNome[nomeChave_(n.nome)];
    if (ex) {
      if (modo === 'mesclar' && String(n.atualizadoEm || '') > String(ex.atualizadoEm || '')) {
        aplicar_(sh, col, ex.linha, n); r.atualizados++;
      } else r.ignorados++;
      return;
    }
    var id = idValido_(n.id) && !porId[n.id] ? n.id : Utilities.getUuid().slice(0, 13);
    gravar_(sh, prox, col.id, 'id', id);
    gravar_(sh, prox, col.criadoEm, 'criadoEm', iso_(n.criadoEm) || new Date().toISOString());
    aplicar_(sh, col, prox, Object.assign({etapa: 'leads'}, n));
    porId[id] = porNome[nomeChave_(n.nome)] = {id: id, linha: prox, nome: n.nome};
    prox++; r.adicionados++;
  });
  SpreadsheetApp.flush();
  r.leads = listar_();
  return r;
}
