## Visão geral

Nova seção **Culto Inteligente** acessível pelo menu lateral. Um botão "Iniciar Culto" grava áudio direto do navegador, captura data/hora/GPS, e ao "Encerrar Culto" envia o áudio para transcrição por IA, extrai automaticamente os dados estruturados (hinos, palavra, pregador, atendimentos, congregações, versículos), apresenta um **relatório editável** para conferência e, ao confirmar, grava nas tabelas existentes (`cultos`, `hinos`, `palavras`, `atendimentos`, `visitantes`) e arquiva a gravação + transcrição.

## Escopo desta entrega (MVP funcional ponta-a-ponta)

1. Gravação de áudio no navegador (MediaRecorder, formato webm/opus) com cronômetro, pausa e botão "Encerrar".
2. Captura automática de: data, horário início/fim, duração, GPS (latitude/longitude) e cidade aproximada (reverse geocode IBGE/Nominatim).
3. Upload da gravação para bucket privado de Storage.
4. Transcrição com **ElevenLabs Scribe v2** (PT-BR, com diarização e timestamps).
5. Extração estruturada via **Lovable AI (Gemini 3 Flash)** com schema Zod: hinos chamados, palavra (irmão, cargo, texto bíblico, tema, resumo), atendimentos, visitantes mencionados, versículos citados, temas-chave, observações.
6. Tela de **revisão humana**: formulário editável pré-preenchido (corrigir, adicionar, remover) antes de salvar.
7. Ao confirmar, persiste em `cultos` + filhos (`hinos`, `palavras`, `atendimentos`, `visitantes`) e em nova tabela `cultos_inteligentes` (áudio, transcrição, metadados, status).
8. **Histórico**: lista das gravações com player, download, busca dentro da transcrição (ILIKE) e link para o culto gerado.
9. Reaproveita o dashboard **Insights** existente — os dados extraídos alimentam automaticamente "hinos mais chamados / pregadores frequentes / congregações visitadas".

## Fora de escopo (deixar claro)

- Transcrição em tempo real (streaming) — usaremos transcrição em lote após "Encerrar". Mais barata, mais precisa.
- Identificação biométrica de voz por pessoa (apenas diarização anônima por "Speaker A/B…").
- App nativo offline. Funciona em qualquer celular moderno via navegador; precisa de internet para subir.

## Decisões técnicas

```text
Frontend gravação → MediaRecorder (audio/webm;codecs=opus)
Upload          → Storage bucket privado "cultos-audio" (cada arquivo: user_id/<id>.webm)
Transcrição     → ElevenLabs scribe_v2, language_code="por", diarize=true, tag_audio_events=true
Extração IA     → Gemini 3 Flash via Lovable AI Gateway com Output.object(schema)
Persistência    → server functions (createServerFn) com requireSupabaseAuth
```

## Pré-requisitos / o que preciso confirmar com você

1. **Conector ElevenLabs**: vou pedir para você linkar o conector ElevenLabs (1 clique). Sem ele não há transcrição em português com qualidade.
2. **Permissão de microfone**: o navegador pedirá ao iniciar — normal.
3. **Bucket privado de áudios**: vou criar `cultos-audio` (privado, áudios baixados via URL assinada).

## Tabelas / migrações

- Nova tabela `cultos_inteligentes`:
  - `id`, `user_id`, `culto_id` (FK opcional após confirmação), `iniciado_em`, `encerrado_em`, `duracao_segundos`
  - `latitude`, `longitude`, `cidade_detectada`
  - `audio_path` (caminho no Storage), `audio_size_bytes`, `audio_mime`
  - `transcricao_texto`, `transcricao_json` (palavras+timestamps+speakers)
  - `extracao_json` (resultado bruto da IA)
  - `status` ('gravando' | 'processando' | 'aguardando_revisao' | 'salvo' | 'erro')
  - `erro_mensagem`
  - RLS: leitura/escrita pelo dono; admin vê tudo
  - GRANT padrão authenticated + service_role
- Bucket Storage privado `cultos-audio` com políticas por dono.

## Server functions (todas autenticadas)

- `iniciarCulto()` → cria registro `status='gravando'`, retorna `{ id }`.
- `finalizarUpload({ id, audioPath, duracao, lat, lng })` → marca `status='processando'`, dispara transcrição + extração e responde com `{ extracao }`.
- `salvarCultoConfirmado({ id, dadosEditados })` → cria `culto` + hinos/palavras/atendimentos/visitantes, vincula `culto_id`, marca `status='salvo'`.
- `urlAudioAssinada({ id })` → retorna signed URL de 1h para player/download.
- `buscarTranscricao({ termo })` → busca textual nas transcrições do usuário.

## Telas

- `/_authenticated/culto-inteligente` — botão grande "Iniciar Culto" + cronômetro + indicador de gravação. Ao encerrar, mostra spinner ("Transcrevendo… Analisando…") e abre o formulário de revisão.
- `/_authenticated/culto-inteligente/historico` — lista de gravações com busca, player inline, download, status, link para o culto associado.

## Custos & limites (transparência)

Cultos longos = arquivos grandes. Vou comprimir o áudio (opus ~24 kbps mono) — um culto de 2h fica ~25 MB. A transcrição via ElevenLabs é cobrada por minuto de áudio; a extração via Lovable AI consome uma chamada Gemini (barata). Vou avisar no UI o tamanho estimado antes do envio.

## Sequência de execução (após sua aprovação)

1. Linkar conector ElevenLabs.
2. Migração (tabela `cultos_inteligentes`).
3. Criar bucket privado `cultos-audio` + policies.
4. Server functions de gravação/transcrição/extração/salvamento.
5. Tela "Culto Inteligente" (gravação + revisão).
6. Tela "Histórico".
7. Item no menu lateral.

**Posso seguir com esse plano?** (Confirme e eu já abro o pedido de conexão do ElevenLabs e parto para a migração.)
