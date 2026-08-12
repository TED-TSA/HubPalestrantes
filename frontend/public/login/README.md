# Fundo da tela de login

O login é um card partido ao meio: o vídeo ocupa a metade esquerda (um painel
**vertical** de mais ou menos 500×660), e o formulário fica na direita.

Os dois arquivos já estão aqui, gerados a partir do `Palestrantes.mp4` original
(gala da TradeStars, 46,8 MB) que fica na raiz do projeto e **não** vai para o git.

- `fundo.mp4` — 6,6 MB, preto e branco, sem áudio, **720×960**, 40 s.
- `fundo.jpg` — 23 KB, frame dos 12 segundos, no mesmo recorte. É o que aparece
  no celular, em conexão lenta e enquanto o vídeo carrega.

## Por que o vídeo é vertical

O original é deitado (1908×1080). Num painel vertical, o `object-fit: cover`
jogaria fora as laterais de qualquer jeito — então essas laterais são cortadas
**antes** de codificar. O resultado é um arquivo menor e mais nítido no painel ao
mesmo tempo, porque nenhum pixel gravado é desperdiçado.

## Para trocar o vídeo

Deixe o novo original na raiz e rode:

```bash
# vídeo: recorte central 3:4, preto e branco, sem áudio
# (o crop 810:1080:549:0 é o centro de um 1908x1080 — ajuste se a sua fonte
#  tiver outra resolução ou se o assunto não estiver no meio do quadro)
ffmpeg -y -i SEU_VIDEO.mp4 -an -vf "crop=810:1080:549:0,scale=720:-2,hue=s=0" \
  -c:v libx264 -crf 21 -preset slow -pix_fmt yuv420p -movflags +faststart \
  frontend/public/login/fundo.mp4

# poster: um frame parado no mesmo recorte
ffmpeg -y -ss 12 -i SEU_VIDEO.mp4 -frames:v 1 \
  -vf "crop=810:1080:549:0,scale=720:-2,hue=s=0" -q:v 4 \
  frontend/public/login/fundo.jpg
```

CRF menor deixa mais nítido e mais pesado; 21 é o usado aqui, e acima de 26
começa a borrar rosto. Para encurtar o loop, acrescente `-ss 5 -t 15` logo depois
do `-i`: 15 s ficam em torno de 2,5 MB.

O vídeo **não** é baixado no celular, em 2G, com economia de dados ligada ou
quando o sistema pede menos movimento. Nesses casos fica só o `fundo.jpg`.
