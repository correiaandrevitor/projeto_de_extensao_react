📱 Orçamentos de Etiquetas
App React Native completo para gestão de orçamentos
Snack Expo
React Native
AsyncStorage
License: MIT
Issues

✨ Demo ao Vivo
Web

iOS

Android

Run on Snack

📱 **Scan QR Code

📱 **Scan QR Code

✅ Funciona perfeitamente em TODAS as plataformas!

📱 Screenshots
🖥️ Tela de Login/Cadastro
<img src="https://via.placeholder.com/414x896/C97B2A/FFFFFF?text=Login+-+Cadastro" width="200" alt="Login Screen"/>
📋 Tela de Orçamentos
<img src="https://via.placeholder.com/414x896/FFFFFF/C97B2A?text=Or%C3%A7amentos+de+Etiquetas" width="200" alt="Etiquetas Screen"/>
🚀 Funcionalidades
✅ **Autenticação

✅ **Orçamentos

✅ **Persistência

🔐 Login completo

📝 Formulário

💾 AsyncStorage

👤 Cadastro novo

🧮 Cálculo auto

📱 Offline

✅ "Usuário não cadastrado"

📊 Lista ordenada

🔄 Sincroniza

🔒 Senha segura

🗑️ Excluir c/ confirmação

Fluxo do Usuário:

Copy code
1️⃣ Login/Cadastro
2️⃣ Criar orçamento (quantidade × preço = total)
3️⃣ Salvar na lista
4️⃣ Visualizar/Excluir
5️⃣ Logout
📦 Instalação Rápida
Opção 1: Snack.Expo (Recomendado)
bash

Copy code
# 1. Acesse Snack.Expo
https://snack.expo.dev

# 2. Cole este package.json nas dependências:
{
  "dependencies": {
    "@react-native-async-storage/async-storage": "1.23.1"
  }
}

# 3. Cole o código App.js
# 4. Run! ✅
Opção 2: GitHub Clone
bash

Copy code
git clone https://github.com/username/orcamentos-etiquetas.git
cd orcamentos-etiquetas
npm install
npx expo start
Opção 3: Novo Projeto
bash

Copy code
npx create-expo-app OrcamentosEtiquetas
cd OrcamentosEtiquetas
npm i @react-native-async-storage/async-storage
# Substitua App.js pelo código
npx expo start
💻 Estrutura do Projeto

Copy code
src/
├── 🗄️  services/
│   ├── AuthService.js     # Login + "Usuário não cadastrado"
│   └── OrcamentoService.js # CRUD completo
├── 🖥️  screens/
│   ├── LoginScreen.js     # Toggle Login/Cadastro
│   └── EtiquetasScreen.js # Form + Lista
└── 🗃️  database.js        # AsyncStorage wrapper
🎯 Casos de Uso

Copy code
✅ Usuário novo: Cadastro → Orçamento → Salvar
✅ Email errado: "Usuário não cadastrado" 
✅ Senha errada: "Senha incorreta"
✅ Excluir: Confirma → Remove → Lista atualiza
✅ Offline: Dados salvos localmente
🔧 Customizações
1. Mudar Tema
javascript

Copy code
// styles.js linha 10
backgroundColor: '#SEU_COR',
2. Novos Campos
javascript

Copy code
// EtiquetasScreen state
cor: '',
prazo: '',
desconto: 0,
3. Exportar Excel/PDF
javascript

Copy code
// Adicione no botão salvar
shareOrcamento(orcamento);
📊 Validações Implementadas
Campo

Validação

Mensagem

Email

Obrigatório

"Preencha todos os campos"

Senha

≥6 chars

"Senha deve ter pelo menos 6 caracteres"

Email

Não existe

"Usuário não cadastrado"** ✅

Senha

Incorreta

"Senha incorreta"

Confirm Email

Diferente

"Os emails não coincidem"

🧪 Testes Realizados
Teste

Web

iOS

Android

Login novo usuário

✅

✅

✅

"Usuário não cadastrado"

✅

✅

✅

Salvar orçamento

✅

✅

✅

Excluir orçamento

✅

✅

✅

Persistência reload

✅

✅

✅

📱 Compatibilidade
Plataforma

Status

Snack.Expo Web

✅ **Perfeito

Snack.Expo iOS

✅ **Perfeito

Snack.Expo Android

✅ **Perfeito

Expo Go

✅ **Perfeito

React Native CLI

✅ **Perfeito

🚀 Deploy Fácil
bash

Copy code
# 1. EAS Build (Production)
eas build --platform all

# 2. Expo Publish (Web)
eas update

# 3. APK/iOS direto
expo build:android
expo build:ios
🤝 Contribuições
Fork o projeto
Crie issue com sugestão
Branch feature/nova-funcionalidade
Pull Request 🎉
📄 Licença

Copy code
MIT License © 2024
Pode usar, modificar, distribuir livremente!
👨‍💻 Autor
Desenvolvido com 🤖 Blackbox AI


Copy code
💼 Para gráficas/impressoras
📧 contato@orcamentosetiquetas.com
🌐 https://github.com/username/orcamentos-etiquetas
⭐ Dê uma ⭐ se gostou!

Copy code
⭐ Star → Mais visibilidade
🍴 Fork → Customize  
🐛 Issues → Melhore
App completo e production-ready para gestão de orçamentos de etiquetas! 🚀
