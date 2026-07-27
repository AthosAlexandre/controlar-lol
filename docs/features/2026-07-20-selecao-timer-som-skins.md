# Seleção — Timer + Som + Skins

## O que foi entregue
- **Timer** da fase, contando suave (local) entre os polls, vermelho/pulsando nos 10s finais.
- **Som** sintético (Web Audio): "ding" quando fica a sua vez (pick ou ban) e bips nos 10s finais.
- **Trocar skin** do campeão (só as que você possui), com miniatura.
- **Depois de escolher o campeão, o grid some** e aparece o botão "Trocar campeão"; no lugar
  ficam as skins.
- **Faixa "Banidos"** com os ícones; campeões **banidos ou já escolhidos** ficam cinza e
  travados no grid (`bans`/`unavailable` no `summarizeChampSelect`).

## Como funciona
- `summarizeChampSelect` passa a devolver `timer` e `isPickPhase`; o app conta o timer
  localmente e dispara os sons nas transições (`web/src/sound.ts`, osciladores — som gerado
  no navegador, não o áudio original do LoL).
- Skins: `GET /api/skins` (as que possuo, do carrossel `skin-carousel-skins`) +
  `POST /api/skins/select` (`PATCH .../my-selection { selectedSkinId }`); miniatura por proxy
  `/api/skin-icon/:id`, que usa o **`tilePath`** de cada item do carrossel
  (ex.: `.../Skins/Base/Images/ashe_splash_tile_0.jpg`) — o caminho derivado
  `champion-tiles/...` dava 400.

## Como testar
Numa seleção: ver o timer contando e ficando vermelho nos 10s; ouvir o "ding" na sua vez e os
bips finais; escolher um campeão e trocar a skin, vendo mudar no cliente.

## Notas / aprendizados
- O som é gerado por osciladores (Web Audio) — um "ding"/bips parecidos, sem depender de
  arquivo nem usar o áudio da Riot.
- O áudio do navegador só toca **após um gesto** do usuário; o app religa o `AudioContext`
  no primeiro toque (`unlockAudio`).
- Se `timer.isInfinite` (modos sem timer), o timer não aparece.
