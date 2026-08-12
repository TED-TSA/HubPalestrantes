# Fundo da tela de login

Os dois arquivos já estão aqui, gerados a partir do `Palestrantes.mp4` original
(gala da TradeStars, 46,8 MB) que fica na raiz do projeto e **não** vai para o git.

- `fundo.mp4` — 14 MB, preto e branco, sem áudio, 1908×1080 (resolução nativa),
  40 s. Uma primeira versão de 3,6 MB foi descartada: comprimida demais, borrava
  rosto e plateia.
- `fundo.jpg` — 53 KB, frame dos 4 segundos. É o que aparece no celular, em
  conexão lenta e enquanto o vídeo carrega.

14 MB é pesado para uma tela de entrada, e é uma escolha consciente: nitidez
acima de peso. O custo é pago só uma vez por navegador (depois fica em cache),
nunca no celular e nunca em conexão lenta. Se incomodar, o melhor corte é
encurtar o loop — 15 s em resolução cheia dão cerca de 5 MB sem perder imagem.

O vídeo **não** é baixado no celular, em 2G, com economia de dados ligada ou
quando o sistema pede menos movimento. Nesses casos fica só o `fundo.jpg`.

## Para trocar o vídeo

Deixe o novo original na raiz e rode:

```bash
# vídeo: preto e branco, sem áudio, resolução nativa
# (CRF menor = mais nitidez e mais peso. 23 é o usado aqui; acima de 26 borra.)
ffmpeg -y -i SEU_VIDEO.mp4 -an -vf "hue=s=0" \
  -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -movflags +faststart \
  frontend/public/login/fundo.mp4

# para encurtar o loop, corte antes: -ss 5 -t 15 logo depois do -i

# poster: um frame parado, aqui aos 4 segundos
ffmpeg -y -ss 4 -i SEU_VIDEO.mp4 -frames:v 1 -vf "scale=1600:-2,hue=s=0" -q:v 4 \
  frontend/public/login/fundo.jpg
```

Escolha um trecho com o canto inferior esquerdo escuro: é onde fica o
formulário. Mire em **menos de 8 MB** — o arquivo é baixado em todo login.
