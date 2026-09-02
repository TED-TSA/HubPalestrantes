# Fundo da tela de login

O login é um card partido ao meio: o vídeo ocupa a metade esquerda (um painel
**vertical** de mais ou menos 500×660), e o formulário fica na direita.

- `fundo.mp4` — 5,7 MB, preto e branco, sem áudio, **720×1280**, 29,5 s.
- `fundo.jpg` — 52 KB, frame dos 2 s. É o que aparece no celular, em conexão
  lenta e enquanto o vídeo carrega.

## O que está no vídeo

Um trecho de cada palestrante, emendado, para que os cinco apareçam em toda
visita. Os originais já vieram em retrato — o formato do painel — então nada
precisou ser recortado.

| Ordem | Palestrante | Trecho do original |
|---|---|---|
| 1 | Luiz Hota | 0 – 5,5 s |
| 2 | Elidiano | 1,5 – 7,5 s |
| 3 | Siqueira | 5,5 – 11,5 s |
| 4 | Bam | 6,5 – 12,5 s |
| 5 | Tonho | 11 – 17 s |

Os trechos foram escolhidos olhando quadro a quadro. Vale saber por quê, caso
alguém refaça: o **bam** e o **tonho** têm um pedaço em que a câmera vira para a
plateia ou pega uma tela, e o **luiz hota** fica pequeno demais no plano aberto
do fim. Cortar pelo meio, sem olhar, pega justamente esses pedaços.

O vídeo **não** é baixado no celular, em 2G, com economia de dados ligada ou
quando o sistema pede menos movimento. Nesses casos fica só o `fundo.jpg`.

## Para refazer com outros vídeos

Deixe os originais numa pasta e ajuste os pares `-ss` (início) e `-t` (duração)
de cada entrada:

```bash
ffmpeg -y \
  -ss 0   -t 5.5 -i "luiz hota.MOV" \
  -ss 1.5 -t 6   -i "elidiano.MOV" \
  -ss 5.5 -t 6   -i "siqueira.MOV" \
  -ss 6.5 -t 6   -i "bam.MOV" \
  -ss 11  -t 6   -i "tonho.MOV" \
  -filter_complex "\
[0:v]scale=720:1280,setsar=1,fps=30,hue=s=0[v0];\
[1:v]scale=720:1280,setsar=1,fps=30,hue=s=0[v1];\
[2:v]scale=720:1280,setsar=1,fps=30,hue=s=0[v2];\
[3:v]scale=720:1280,setsar=1,fps=30,hue=s=0[v3];\
[4:v]scale=720:1280,setsar=1,fps=30,hue=s=0[v4];\
[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[out]" \
  -map "[out]" -an -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p \
  -movflags +faststart public/login/fundo.mp4

# poster: um frame parado do resultado
ffmpeg -y -ss 2 -i public/login/fundo.mp4 -frames:v 1 -q:v 4 \
  public/login/fundo.jpg
```

Para escolher os trechos sem abrir editor, monte uma folha de contato de cada
original e olhe:

```bash
ffmpeg -y -i ORIGINAL.MOV -vf "fps=8/DURACAO,scale=150:-1,hue=s=0,tile=8x1" \
  -frames:v 1 folha.png
```

`hue=s=0` é o que tira a cor. CRF menor deixa mais nítido e mais pesado; 23 é o
usado aqui, e acima de 26 começa a borrar rosto. Se a fonte for deitada em vez de
retrato, recorte antes de escalar — por exemplo `crop=810:1080:549:0` num
1908×1080.
