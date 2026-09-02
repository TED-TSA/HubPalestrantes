# Fotos dos instrutores

Cada foto é `<slug>.jpg`, onde `<slug>` é o **nome do instrutor como ele aparece
no campo `Conexao` do BigQuery**, em minúsculas, sem acento e com hífens no lugar
de espaços — a mesma regra do `slug()` em `server/domain/texto.js`.

Exemplos:
- Instrutor `Elidiano` → `elidiano.jpg`
- Instrutor `João Gomes` → `joao-gomes.jpg`

As fotos aparecem em preto e branco e ganham cor ao passar o mouse. Quem não
tiver arquivo aparece com um avatar de iniciais automático — a ausência nunca
quebra a tela.

## Para adicionar uma foto

O app só lê `.jpg`, em 400×400. Se a sua imagem for PNG ou não for quadrada:

```bash
ffmpeg -y -i original.png \
  -vf "scale=400:400:force_original_aspect_ratio=increase,crop=400:400" -q:v 3 \
  public/instrutores/<slug>.jpg
```

O corte é centralizado, então confira o resultado se o rosto não estiver no meio
da imagem original.

> **Depois de adicionar**: inclua o `<slug>` na lista `NOMES_COM_FOTO` em
> `server/data/fotos.js` — o servidor não lê esta pasta em runtime (ela é
> servida direto pela Vercel), então essa lista é quem diz ao app quem tem foto.

> **Atenção ao vínculo:** a foto é resolvida pelo nome nos dados, não pelo nome
> do cadastro. Se o instrutor estiver cadastrado como "João Gomes" mas o
> `Conexao` trouxer "Joao G.", o arquivo precisa ser `joao-g.jpg`. A tela de
> Instrutores mostra qual nome está vindo dos dados.
