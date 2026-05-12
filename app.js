import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ================= DATABASE (AsyncStorage) =================
const DB = {
  async getTable(name) {
    try {
      const raw = await AsyncStorage.getItem(`@db:${name}`);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.log('DB getTable error:', error);
      return {};
    }
  },

  async setTable(name, data) {
    try {
      await AsyncStorage.setItem(`@db:${name}`, JSON.stringify(data));
    } catch (error) {
      console.log('DB setTable error:', error);
    }
  },
};

const initDB = async () => {
  try {
    const users = await DB.getTable('users');
    const orcamentos = await DB.getTable('orcamentos');
    if (Object.keys(users).length === 0) await DB.setTable('users', {});
    if (Object.keys(orcamentos).length === 0) await DB.setTable('orcamentos', {});
  } catch (error) {
    console.log('initDB error:', error);
  }
};

// ================= AUTH SERVICE COM MENSAGEM ESPECÍFICA =================
const AuthService = {
  currentUser: null,

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString();
  },

  async userExists(email) {
    try {
      const users = await DB.getTable('users');
      const key = email.toLowerCase().trim();
      return !!users[key];
    } catch (error) {
      return false;
    }
  },

  async register(email, password) {
    try {
      const users = await DB.getTable('users');
      const key = email.toLowerCase().trim();

      if (users[key]) {
        return { success: false, error: 'Email já cadastrado' };
      }

      const passwordHash = this.simpleHash(password + key);

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
      // ✅ VERIFICA SE USUÁRIO EXISTE PRIMEIRO
      const exists = await this.userExists(email);
      if (!exists) {
        return { success: false, error: 'Usuário não cadastrado' };
      }

      const users = await DB.getTable('users');
      const key = email.toLowerCase().trim();
      const user = users[key];

      if (!user) {
        return { success: false, error: 'Usuário não cadastrado' };
      }

      const passwordHash = this.simpleHash(password + key);
      const isValid = passwordHash === user.password_hash;

      if (!isValid) {
        return { success: false, error: 'Senha incorreta' };
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

    try {
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

      // ✅ LOGIN COM VERIFICAÇÃO ESPECÍFICA
      const result = await AuthService.login(email, password);

      if (result.success) {
        onLogin(result.user);
      } else {
        Alert.alert('Erro', result.error); // ✅ "Usuário não cadastrado" ou "Senha incorreta"
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={styles.content}>
        <Image
          source={{ uri: 'https://reactnative.dev/img/tiny_logo.png' }}
          style={styles.logo}
          onError={() => {}}
        />

        <Text style={styles.subtitle}>Orçamentos de Etiquetas</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#999"
        />

        {!isLogin && (
          <TextInput
            style={styles.input}
            placeholder="Confirmar Email"
            value={confirmEmail}
            onChangeText={setConfirmEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#999"
          />
        )}

        <View style={styles.passwordWrapper}>
          <TextInput
            style={styles.inputPassword}
            placeholder="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholderTextColor="#999"
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
          style={styles.switchContainer}
        >
          <Text style={styles.switchText}>
            {isLogin 
              ? 'Não tem conta? Cadastre-se' 
              : 'Já tem conta? Entre'
            }
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ================= RESTO DO CÓDIGO (EtiquetasScreen e App) - MESMO DA VERSÃO ANTERIOR =================
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
    try {
      const lista = await OrcamentoService.getByUser(user.id);
      setOrcamentos(lista);
    } catch (error) {
      console.log('loadOrcamentos error:', error);
    }
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
    try {
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
    } catch (error) {
      Alert.alert('Erro', 'Erro ao salvar orçamento');
    } finally {
      setLoading(false);
    }
  };

  const deletarOrcamento = (id) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Deseja realmente excluir este orçamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await OrcamentoService.delete(id, user.id);
              if (result.success) {
                Alert.alert('Sucesso', 'Orçamento excluído!');
                await loadOrcamentos();
              } else {
                Alert.alert('Erro', result.error || 'Erro ao excluir');
              }
            } catch (error) {
              Alert.alert('Erro', 'Erro ao excluir orçamento');
              console.log('delete error:', error);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 20 }}>
      <View style={styles.header}>
        <Text style={styles.userEmail} numberOfLines={1}>
          {user.email}
        </Text>
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
        placeholderTextColor="#999"
      />

      <TextInput
        style={styles.input}
        placeholder="Tamanho (ex: 10x5cm)"
        value={orcamento.tamanho}
        onChangeText={(text) => setOrcamento({ ...orcamento, tamanho: text })}
        placeholderTextColor="#999"
      />

      <TextInput
        style={styles.input}
        placeholder="Material"
        value={orcamento.material}
        onChangeText={(text) => setOrcamento({ ...orcamento, material: text })}
        placeholderTextColor="#999"
      />

      <TextInput
        style={styles.input}
        placeholder="Impressão"
        value={orcamento.impressao}
        onChangeText={(text) => setOrcamento({ ...orcamento, impressao: text })}
        placeholderTextColor="#999"
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
        placeholderTextColor="#999"
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

      <Text style={styles.sectionTitle}>Orçamentos Salvos ({orcamentos.length})</Text>

      {orcamentos.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum orçamento salvo ainda</Text>
      ) : (
        orcamentos.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTotal}>R$ {Number(item.total).toFixed(2)}</Text>
              <Text style={styles.itemDetail}>Qtd: {item.quantidade} × R$ {Number(item.preco_unitario).toFixed(2)}</Text>
              {item.tamanho ? <Text style={styles.itemDetail}>Tamanho: {item.tamanho}</Text> : null}
              {item.material ? <Text style={styles.itemDetail}>Material: {item.material}</Text> : null}
              {item.impressao ? <Text style={styles.itemDetail}>Impressão: {item.impressao}</Text> : null}
              <Text style={styles.itemDate}>
                {new Date(item.created_at).toLocaleDateString('pt-BR')}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => deletarOrcamento(item.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
};

// ================= APP PRINCIPAL =================
export default function App() {
  const [screen, setScreen] = useState('loading');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const setup = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await initDB();
        setScreen('login');
      } catch (error) {
        console.log('App setup error:', error);
        setScreen('login');
      }
    };
    setup();
  }, []);

  if (screen === 'loading') {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#C97B2A" />
        <Text style={styles.loadingText}>Carregando app...</Text>
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

// ================= STYLES (MESMOS DA VERSÃO ANTERIOR) =================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#C97B2A',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 20,
    borderRadius: 50,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 30,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  input: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  switchContainer: {
    padding: 10,
  },
  switchText: {
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#fff',
    fontSize: 16,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  inputPassword: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  eyeBtn: {
    paddingHorizontal: 15,
    paddingVertical: 15,
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
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  userEmail: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  logoutBtn: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 15,
  },
  total: {
    textAlign: 'center',
    marginVertical: 15,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.1)',
    padding: 15,
    borderRadius: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#fff',
    opacity: 0.8,
    fontSize: 16,
    marginTop: 30,
    fontStyle: 'italic',
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#C97B2A',
    marginBottom: 5,
  },
  itemDetail: {
    fontSize: 14,
    color: '#555',
    marginTop: 2,
  },
  itemDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  deleteBtn: {
    backgroundColor: '#ff3b30',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  deleteText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
