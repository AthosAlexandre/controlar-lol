# LoL Modo Banheiro — Guia rápido (para os amigos)

1. Baixe o arquivo **LoL Modo Banheiro Setup.exe**.
2. Dê dois cliques para instalar (escolha a pasta e avance).
   - Na 1ª vez o Windows pode mostrar um aviso azul ("Windows protegeu o seu PC")
     porque o app não é assinado → clique em **Mais informações → Executar assim mesmo**.
3. Abra o programa **LoL Modo Banheiro** (atalho no menu Iniciar / área de trabalho).
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

## Para quem vai gerar o instalador (dono do projeto)

Na raiz do repositório:

```powershell
pwsh -File build-all.ps1
```

Isso builda tudo e gera `desktop/release/LoL Modo Banheiro Setup 0.1.0.exe` — é esse
arquivo que você manda pros amigos.

> **Nota técnica:** o electron-builder baixa o `winCodeSign` (ferramenta de
> assinatura) que contém arquivos de macOS como *symlinks*; criar symlink no Windows
> exige privilégio, então a extração falha. O `build-all.ps1` contorna isso
> pré-extraindo o `winCodeSign` no cache (ignorando os 2 arquivos de macOS que não
> usamos) antes de buildar. O app sai **sem assinatura digital** — por isso o aviso
> do SmartScreen na 1ª execução.
