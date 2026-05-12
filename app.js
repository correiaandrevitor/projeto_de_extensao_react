import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

// ================= DATABASE (AsyncStorage) =================
// Simulates relational tables using AsyncStorage key-value pairs.
// Structure:
//   @db:users        → { [email]: { id, email, password_hash, created_at } }
//   @db:orcamentos   → { [id]: { id, user_id, quantidade, ... } }

const DB = {
  async getTable(name) {
    const raw = await AsyncStorage.getItem(`@db:${name}`);
    return raw ? JSON.parse(raw) : {};
  },

  async setTable(name, data) {
    await AsyncStorage.setItem(`@db:${name}`, JSON.stringify(data));
  },
};

const initDB = async () => {
  // Ensure tables exist (no-op if already created)
  const users = await DB.getTable('users');
  const orcamentos = await DB.getTable('orcamentos');
  if (!users) await DB.setTable('users', {});
  if (!orcamentos) await DB.setTable('orcamentos', {});
};

// ================= CRYPTO (crypto-js) =================
const CryptoService = {
  generateSalt() {
    // 16 random words → hex string
    const words = CryptoJS.lib.WordArray.random(16);
    return `$salt$${words.toString(CryptoJS.enc.Hex)}`;
  },

  hashPassword(password, salt) {
    // PBKDF2 with 10000 iterations, SHA-256, 256-bit key
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 10000,
      hasher: CryptoJS.algo.SHA256,
    });
    return `${salt}:${key.toString(CryptoJS.enc.Hex)}`;
  },

  verifyPassword(password, storedHash) {
    const colonIdx = storedHash.indexOf(':');
    const salt = storedHash.substring(0, colonIdx);
    const newHash = this.hashPassword(password, salt);
    return newHash === storedHash;
  },
};

// ================= AUTH SERVICE =================
const AuthService = {
  currentUser: null,

  async register(email, password) {
    try {
      const users = await DB.getTable('users');
      const key = email.toLowerCase().trim();

      if (users[key]) {
        return { success: false, error: 'Email já cadastrado' };
      }

      const salt = CryptoService.generateSalt();
      const passwordHash = CryptoService.hashPassword(password, salt);

      users[key] = {
        id: Date.now().toString(),
        email: key,
        password_hash: passwordHash,
        created_at: new Date().toISOString(),
      };

      await DB.setTable('users', users);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Erro ao cadastrar usuário' };
    }
  },

  async login(email, password) {
    try {
      const users = await DB.getTable('users');
      const key = email.toLowerCase().trim();
      const user = users[key];

      if (!user) {
        return { success: false, error: 'Email ou senha incorretos' };
      }

      const isValid = CryptoService.verifyPassword(password, user.password_hash);

      if (!isValid) {
        return { success: false, error: 'Email ou senha incorretos' };
      }

      this.currentUser = { id: user.id, email: user.email };
      return { success: true, user: this.currentUser };
    } catch (error) {
      return { success: false, error: 'Erro ao fazer login' };
    }
  },

  logout() {
    this.currentUser = null;
  },
};

// ================= ORCAMENTO SERVICE =================
const OrcamentoService = {
  async save(userId, orcamento) {
    try {
      const orcamentos = await DB.getTable('orcamentos');
      const id = Date.now().toString();

      orcamentos[id] = {
        id,
        user_id: userId,
        quantidade: parseFloat(orcamento.quantidade) || 0,
        tamanho: orcamento.tamanho || '',
        material: orcamento.material || '',
        impressao: orcamento.impressao || '',
        preco_unitario: parseFloat(orcamento.precoUnitario) || 0,
        total: parseFloat(orcamento.total) || 0,
        created_at: new Date().toISOString(),
      };

      await DB.setTable('orcamentos', orcamentos);
      return { success: true, id };
    } catch (error) {
      return { success: false, error: 'Erro ao salvar orçamento' };
    }
  },

  async getByUser(userId) {
    try {
      const orcamentos = await DB.getTable('orcamentos');
      return Object.values(orcamentos)
        .filter(o => o.user_id === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (error) {
      return [];
    }
  },

  async delete(id, userId) {
    try {
      const orcamentos = await DB.getTable('orcamentos');
      if (orcamentos[id]?.user_id !== userId) {
        return { success: false, error: 'Não autorizado' };
      }
      delete orcamentos[id];
      await DB.setTable('orcamentos', orcamentos);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Erro ao deletar orçamento' };
    }
  },
};

// ================= LOGIN SCREEN =================
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    if (!isLogin) {
      if (email !== confirmEmail) {
        Alert.alert('Erro', 'Os emails não coincidem');
        setLoading(false);
        return;
      }

      const result = await AuthService.register(email, password);

      if (result.success) {
        Alert.alert('Sucesso', 'Usuário cadastrado com sucesso!');
        setEmail('');
        setPassword('');
        setConfirmEmail('');
        setIsLogin(true);
      } else {
        Alert.alert('Erro', result.error);
      }

      setLoading(false);
      return;
    }

    const result = await AuthService.login(email, password);

    if (result.success) {
      onLogin(result.user);
    } else {
      Alert.alert('Erro', result.error);
    }

    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://reactnative.dev/img/tiny_logo.png' }}
        style={styles.logo}
      />

      <Text style={styles.subtitle}>Orçamentos de Etiquetas</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />

      {!isLogin && (
        <TextInput
          style={styles.input}
          placeholder="Confirmar Email"
          value={confirmEmail}
          onChangeText={setConfirmEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      )}

      <View style={styles.passwordWrapper}>
        <TextInput
          style={styles.inputPassword}
          placeholder="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoComplete={isLogin ? 'password' : 'new-password'}
        />
        <TouchableOpacity
          style={styles.eyeBtn}
          onPress={() => setShowPassword(v => !v)}
        >
          <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {isLogin ? 'ENTRAR' : 'CADASTRAR'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          setIsLogin(!isLogin);
          setEmail('');
          setPassword('');
          setConfirmEmail('');
          setShowPassword(false);
        }}
      >
        <Text style={styles.switchText}>
          {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ================= ETIQUETAS SCREEN =================
const EtiquetasScreen = ({ user, onLogout }) => {
  const [orcamento, setOrcamento] = useState({
    quantidade: '',
    tamanho: '',
    material: '',
    impressao: '',
    precoUnitario: '',
    total: '0.00'
  });

  const [orcamentos, setOrcamentos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOrcamentos();
  }, []);

  const loadOrcamentos = async () => {
    const lista = await OrcamentoService.getByUser(user.id);
    setOrcamentos(lista);
  };

  const calcularTotal = (novo) => {
    const qtd = parseFloat(novo.quantidade) || 0;
    const preco = parseFloat(novo.precoUnitario) || 0;
    return (qtd * preco).toFixed(2);
  };

  const salvarOrcamento = async () => {
    if (!orcamento.quantidade || !orcamento.precoUnitario) {
      Alert.alert('Atenção', 'Informe quantidade e preço unitário');
      return;
    }

    setLoading(true);
    const result = await OrcamentoService.save(user.id, orcamento);

    if (result.success) {
      Alert.alert('Sucesso', 'Orçamento salvo!');
      setOrcamento({
        quantidade: '',
        tamanho: '',
        material: '',
        impressao: '',
        precoUnitario: '',
        total: '0.00'
      });
      loadOrcamentos();
    } else {
      Alert.alert('Erro', result.error);
    }

    setLoading(false);
  };

  const deletarOrcamento = (id) => {
    Alert.alert(
      'Confirmar',
      'Deseja excluir este orçamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await OrcamentoService.delete(id, user.id);
            loadOrcamentos();
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.userEmail}>{user.email}</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Novo Orçamento</Text>

      <TextInput
        style={styles.input}
        placeholder="Quantidade"
        value={orcamento.quantidade}
        onChangeText={(text) => {
          const novo = { ...orcamento, quantidade: text };
          novo.total = calcularTotal(novo);
          setOrcamento(novo);
        }}
        keyboardType="numeric"
      />

      <TextInput
        style={styles.input}
        placeholder="Tamanho (ex: 10x5cm)"
        value={orcamento.tamanho}
        onChangeText={(text) => setOrcamento({ ...orcamento, tamanho: text })}
      />

      <TextInput
        style={styles.input}
        placeholder="Material"
        value={orcamento.material}
        onChangeText={(text) => setOrcamento({ ...orcamento, material: text })}
      />

      <TextInput
        style={styles.input}
        placeholder="Impressão"
        value={orcamento.impressao}
        onChangeText={(text) => setOrcamento({ ...orcamento, impressao: text })}
      />

      <TextInput
        style={styles.input}
        placeholder="Preço Unitário (R$)"
        value={orcamento.precoUnitario}
        onChangeText={(text) => {
          const novo = { ...orcamento, precoUnitario: text };
          novo.total = calcularTotal(novo);
          setOrcamento(novo);
        }}
        keyboardType="numeric"
      />

      <Text style={styles.total}>Total: R$ {orcamento.total}</Text>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={salvarOrcamento}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>SALVAR ORÇAMENTO</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Orçamentos Salvos</Text>

      {orcamentos.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum orçamento salvo</Text>
      ) : (
        orcamentos.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTotal}>R$ {Number(item.total).toFixed(2)}</Text>
              <Text style={styles.itemDetail}>Qtd: {item.quantidade} × R$ {Number(item.preco_unitario).toFixed(2)}</Text>
              {item.tamanho ? <Text style={styles.itemDetail}>Tamanho: {item.tamanho}</Text> : null}
              {item.material ? <Text style={styles.itemDetail}>Material: {item.material}</Text> : null}
              {item.impressao ? <Text style={styles.itemDetail}>Impressão: {item.impressao}</Text> : null}
              <Text style={styles.itemDate}>{new Date(item.created_at).toLocaleDateString('pt-BR')}</Text>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => deletarOrcamento(item.id)}
            >
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
};

// ================= APP =================
export default function App() {
  const [screen, setScreen] = useState('loading');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const setup = async () => {
      try {
        await initDB();
        setScreen('login');
      } catch (error) {
        Alert.alert('Erro', 'Falha ao inicializar banco de dados');
        console.error('DB init error:', error);
      }
    };
    setup();
  }, []);

  if (screen === 'loading') {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Iniciando...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {screen === 'login' ? (
        <LoginScreen
          onLogin={(user) => {
            setCurrentUser(user);
            setScreen('etiquetas');
          }}
        />
      ) : (
        <EtiquetasScreen
          user={currentUser}
          onLogout={() => {
            AuthService.logout();
            setCurrentUser(null);
            setScreen('login');
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#C97B2A',
    padding: 20,
  },

  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },

  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: 10,
  },

  subtitle: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },

  input: {
    backgroundColor: '#eee',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    fontSize: 16,
  },

  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },

  switchText: {
    textAlign: 'center',
    marginTop: 10,
    fontWeight: 'bold',
    color: '#00008B',
  },

  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eee',
    borderRadius: 10,
    marginBottom: 10,
  },

  inputPassword: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },

  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  eyeIcon: {
    fontSize: 20,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  userEmail: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
    marginRight: 10,
  },

  logoutBtn: {
    backgroundColor: 'red',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },

  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 10,
  },

  total: {
    textAlign: 'center',
    marginVertical: 10,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },

  emptyText: {
    textAlign: 'center',
    color: '#fff',
    opacity: 0.7,
    marginTop: 20,
  },

  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  itemInfo: {
    flex: 1,
  },

  itemTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C97B2A',
  },

  itemDetail: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
  },

  itemDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 5,
  },

  deleteBtn: {
    backgroundColor: '#ff3b30',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  deleteText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
