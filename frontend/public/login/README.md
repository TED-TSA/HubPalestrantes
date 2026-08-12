# Fundo da tela de login

Coloque dois arquivos aqui:

- `fundo.mp4` — o vídeo que roda em loop atrás do formulário. Sem áudio (ele toca
  mudo de qualquer forma). Mire em **menos de 8 MB**: é baixado toda vez que
  alguém abre o login. Um corte de 10 a 20 segundos em 1080p já basta, porque a
  tela escurece bastante o vídeo.
- `fundo.jpg` — um frame parado do próprio vídeo. É o que aparece no celular, em
  conexão lenta e enquanto o vídeo carrega.

Enquanto os dois não existirem, o login mostra um gradiente escuro com a luz
âmbar do tema. Nada quebra — só fica menos cinematográfico.

O vídeo **não** é baixado no celular, em conexão 2G, com economia de dados ligada
ou quando o sistema pede menos movimento. Nesses casos fica só o `fundo.jpg`.
