# LoL Modo Banheiro — Guia rápido (para os amigos)

1. Baixe o arquivo **LoL-Modo-Banheiro-portatil.zip**.
2. **Extraia** o zip numa pasta qualquer (botão direito → Extrair tudo).
3. Abra a pasta e dê dois cliques em **LoL Modo Banheiro.exe**.
   - Na 1ª vez o Windows pode mostrar um aviso azul ("Windows protegeu o seu PC")
     porque o app não é assinado → clique em **Mais informações → Executar assim mesmo**.
4. Com o **League of Legends aberto**, clique em **"Habilitar modo remoto"**.
5. Aponte a câmera do celular no **QR code** (ou copie o link e cole no navegador do celular).
6. Pronto! Pelo celular dá para acompanhar a fila, aceitar partida, escolher
   campeão e trocar runas.

## Requisitos
- **League of Legends aberto** no PC.
- **PC e celular na mesma rede Wi-Fi**.
- Na 1ª vez o **Windows pode pedir permissão de firewall** → clique em **Permitir**.

## É seguro?
Sim. Não é hack: usa só a API local e oficial do próprio cliente do LoL, e funciona
**apenas na sua rede local** — nada é exposto na internet.

---

## Para quem vai gerar o pacote (dono do projeto)

Na raiz do repositório:

```powershell
pwsh -File build-all.ps1
```

Isso builda tudo e gera `desktop/release/LoL-Modo-Banheiro-portatil.zip` — é esse
arquivo que você manda pros amigos.

### Gerar um instalador .exe (opcional)
O pacote acima é portátil (extrair e rodar). Se quiser um **instalador NSIS** de
verdade, o electron-builder precisa criar links simbólicos ao preparar o assinador
(`winCodeSign`), o que no Windows exige privilégio:

1. Ative o **Modo Desenvolvedor**: Configurações → Privacidade e segurança →
   Para desenvolvedores → **Modo de desenvolvedor: Ativado**.
2. Em `desktop/electron-builder.yml`, troque `target: zip` por `target: nsis` e
   remova a linha `signAndEditExecutable: false`.
3. Rode `cd desktop && npm run build && npx electron-builder` → o instalador sai em
   `desktop/release/`.
