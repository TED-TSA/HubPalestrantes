# Fundo da tela de login

O login é um card partido ao meio: o vídeo ocupa a metade esquerda (um painel
**vertical** de mais ou menos 500×660), e o formulário fica na direita.

**Um palestrante por acesso, sorteado.** Cada login baixa um vídeo só, e o nome
de quem está na tela aparece no rodapé do painel. Emendar todos num arquivo único
daria perto de 10 MB por acesso; assim fica entre 1,9 MB e 4,6 MB e ainda muda de
rosto a cada visita.

| Arquivo | Vídeo | Poster |
|---|---|---|
| `bam` | 4,6 MB | 40 KB |
| `elidiano` | 1,9 MB | 39 KB |
| `luiz-hota` | 2,8 MB | 52 KB |
| `siqueira` | 3,8 MB | 27 KB |
| `tonho` | 2,9 MB | 50 KB |

Todos em **720×1280, preto e branco, sem áudio** — os originais já vieram em
retrato, que é o formato do painel, então nada precisou ser recortado.

O vídeo **não** é baixado no celular, em 2G, com economia de dados ligada ou
quando o sistema pede menos movimento. Nesses casos fica só o `<slug>.jpg`.

## Para adicionar, trocar ou remover um palestrante

1. Gere os dois arquivos:

```bash
# video: preto e branco, sem audio
ffmpeg -y -i ORIGINAL.MOV -an -vf "scale=720:-2,hue=s=0" \
  -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p -movflags +faststart \
  frontend/public/login/<slug>.mp4

# poster: um frame parado, aqui a 30% da duracao
ffmpeg -y -ss 5 -i ORIGINAL.MOV -frames:v 1 -vf "scale=720:-2,hue=s=0" -q:v 4 \
  frontend/public/login/<slug>.jpg
```

2. Acrescente a entrada na lista `FUNDOS` no topo de `frontend/login.js`:

```js
{ slug: 'novo-nome', nome: 'Novo Nome' },
```

Se a fonte for deitada em vez de retrato, recorte antes de escalar — por exemplo
`crop=810:1080:549:0,scale=720:-2,hue=s=0` para um 1908×1080. CRF menor deixa
mais nítido e mais pesado; 23 é o usado aqui, e acima de 26 começa a borrar rosto.
